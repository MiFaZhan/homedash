package scan

import (
	"fmt"
	"net"
	"os/exec"
	"sort"
	"strings"
	"time"

	"homedash/internal/model"
)

// Options controls one scan run.
type Options struct {
	IncludeLocal bool   // also collect 127.0.0.1 listeners
	Probe        bool   // run HTTP health checks
	PortsTable   string // optional ports.yaml
	HidePorts    []int  // ports the user never wants to see
	SelfPort     int    // our own port, skipped
	Host         string // preferred host for building URLs
}

// Filtered records a listener that was intentionally left out.
type Filtered struct {
	Port   int
	Addr   string
	Reason string
}

// Result is the outcome of a scan.
type Result struct {
	Services []model.Service
	Filtered []Filtered
	Host     string
	Docker   bool
}

// Scan inspects the machine and returns the discovered services.
func Scan(opts Options) (Result, error) {
	res := Result{Host: opts.Host}
	if res.Host == "" {
		res.Host = preferredHost()
	}

	sockets, err := listenSockets()
	if err != nil {
		return res, err
	}
	procs := processesBySocketInode()
	table := loadPortTable(opts.PortsTable)
	proxies := detectProxyPorts()
	rootUnits := rootUnitPorts()
	servePorts := tailscaleServePorts()
	dockerByPort := map[int]DockerContainer{}
	if dockerAvailable() {
		res.Docker = true
		if m, ok := dockerContainers(); ok {
			dockerByPort = m
		}
	}

	// pick the best candidate per port: prefer a reachable bind address, then
	// IPv4, then a socket whose owning process we could resolve.
	best := map[int]socketEntry{}
	for _, s := range sockets {
		if s.Port == opts.SelfPort {
			continue
		}
		cur, ok := best[s.Port]
		if !ok || betterSocket(s, cur, procs) {
			best[s.Port] = s
		}
	}
	ports := make([]int, 0, len(best))
	for p := range best {
		ports = append(ports, p)
	}
	sort.Ints(ports)

	for _, port := range ports {
		s := best[port]
		proc := procs[s.Inode]
		cls := classify(proc)

		// loopback only listeners are internal by default
		if !opts.IncludeLocal && isLoopback(s.Addr) {
			res.Filtered = append(res.Filtered, Filtered{Port: s.Port, Addr: s.Addr, Reason: "仅监听回环地址（内部服务）"})
			continue
		}

		hint, hasHint := table[s.Port]
		if containsInt(opts.HidePorts, s.Port) {
			res.Filtered = append(res.Filtered, Filtered{Port: s.Port, Addr: s.Addr, Reason: "用户隐藏"})
			continue
		}
		if reason, ok := proxies[s.Port]; ok && !hasHint {
			res.Filtered = append(res.Filtered, Filtered{Port: s.Port, Addr: s.Addr, Reason: "反代端口（" + reason + "）"})
			continue
		}
		if hasHint && hint.Hidden {
			res.Filtered = append(res.Filtered, Filtered{Port: s.Port, Addr: s.Addr, Reason: "按规则隐藏"})
			continue
		}
		if !hasHint && s.Port > 40000 {
			res.Filtered = append(res.Filtered, Filtered{Port: s.Port, Addr: s.Addr, Reason: "临时端口，未登记"})
			continue
		}

		host := res.Host
		if !s.AnyAddr && !isLoopback(s.Addr) {
			host = s.Addr
		}

		svc := model.Service{
			ID:       slug(fmt.Sprintf("%s-%d", nameFor(svcName(s, hint, proc)), s.Port)),
			Port:     s.Port,
			Addr:     s.Addr,
			Runtime:  cls.Runtime,
			Detail:   cls.Detail,
			Managed:  model.ManagedDiscovered,
			Status:   model.StatusUnknown,
			LastSeen: time.Now(),
		}
		svc.Name = nameFor(svcName(s, hint, proc))
		svc.Description = hint.Description
		svc.Icon = hint.Icon
		svc.Page = hint.Page
		svc.URL = buildURL(host, s.Port)

		// runtime details
		if cls.Runtime == model.RuntimeDocker {
			if c, ok := dockerByPort[s.Port]; ok {
				svc.Detail["container"] = strings.TrimPrefix(firstOr(c.Names, ""), "/")
				svc.Detail["image"] = c.Image
				svc.Detail["container_id"] = shortID(c.ID)
			}
		}
		if cls.Runtime == model.RuntimeSystemd {
			for k, v := range systemdInfo(cls.Detail["unit"]) {
				svc.Detail[k] = v
			}
		}
		if cls.Runtime == model.RuntimeProcess && proc != nil && proc.Comm != "" {
			svc.Detail["process"] = proc.Comm
		}

		// fallback attribution for root owned services we cannot read from /proc
		if cls.Runtime == model.RuntimeUnknown {
			if unit, ok := rootUnits[s.Port]; ok {
				svc.Runtime = model.RuntimeSystemd
				svc.Detail["unit"] = unit
				for k, v := range systemdInfo(unit) {
					svc.Detail[k] = v
				}
			} else if target, ok := servePorts[s.Port]; ok {
				svc.Runtime = "tailscale"
				svc.Detail["serve_target"] = target
				svc.Detail["process"] = "tailscaled"
			}
		}

		// health probe
		if opts.Probe && shouldProbe(hint) {
			p := probe(svc.URL)
			svc.Status = p.Status
			svc.LatencyMS = p.LatencyMS
			svc.HTTPStatus = p.HTTPStatus
			if p.Status == model.StatusOffline {
				svc.Status = model.StatusOffline
			}
		}

		res.Services = append(res.Services, svc)
	}

	sort.Slice(res.Services, func(i, j int) bool {
		if res.Services[i].Port != res.Services[j].Port {
			return res.Services[i].Port < res.Services[j].Port
		}
		return res.Services[i].Name < res.Services[j].Name
	})
	return res, nil
}

func containsInt(list []int, v int) bool {
	for _, x := range list {
		if x == v {
			return true
		}
	}
	return false
}

func shouldProbe(hint PortHint) bool {
	if hint.Probe != nil {
		return *hint.Probe
	}
	return true
}

// betterSocket reports whether candidate a should be preferred over b.
func betterSocket(a, b socketEntry, procs map[string]*Process) bool {
	loopA := isLoopback(a.Addr)
	loopB := isLoopback(b.Addr)
	if loopA != loopB {
		return !loopA
	}
	if a.IPv6 != b.IPv6 {
		return !a.IPv6
	}
	_, hasA := procs[a.Inode]
	_, hasB := procs[b.Inode]
	return hasA && !hasB
}

// buildURL renders a browsable URL, bracketing IPv6 literals.
func buildURL(host string, port int) string {
	if strings.Contains(host, ":") {
		return fmt.Sprintf("http://[%s]:%d", host, port)
	}
	return fmt.Sprintf("http://%s:%d", host, port)
}

func svcName(s socketEntry, hint PortHint, proc *Process) string {
	if hint.Name != "" {
		return hint.Name
	}
	if proc != nil {
		return prettyName(proc.Comm, proc.Exe)
	}
	return fmt.Sprintf("端口 %d", s.Port)
}

func nameFor(n string) string { return n }

func firstOr(list []string, def string) string {
	if len(list) > 0 && list[0] != "" {
		return list[0]
	}
	return def
}

func shortID(id string) string {
	if len(id) > 12 {
		return id[:12]
	}
	return id
}

func isLoopback(addr string) bool {
	if addr == "127.0.0.1" || addr == "::1" {
		return true
	}
	ip := net.ParseIP(addr)
	return ip != nil && ip.IsLoopback()
}

// preferredHost returns the address used when a service binds to every
// interface: Tailscale first, then the first global LAN address.
func preferredHost() string {
	if h := tailscaleIP(); h != "" {
		return h
	}
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return "127.0.0.1"
	}
	for _, a := range addrs {
		ipn, ok := a.(*net.IPNet)
		if !ok || ipn.IP.IsLoopback() {
			continue
		}
		if ip4 := ipn.IP.To4(); ip4 != nil {
			return ip4.String()
		}
	}
	return "127.0.0.1"
}

func tailscaleIP() string {
	out, err := exec.Command("tailscale", "ip", "-4").Output()
	if err != nil {
		return ""
	}
	fields := strings.Fields(string(out))
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}
