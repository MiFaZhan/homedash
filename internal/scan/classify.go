package scan

import (
	"fmt"
	"regexp"
	"strings"
)

// Runtime classification result for a listener.
type Classification struct {
	Runtime string
	Detail  map[string]string
}

var (
	dockerScopeRe = regexp.MustCompile(`(?:docker[-/])([0-9a-f]{12,64})`)
	dockerPathRe  = regexp.MustCompile(`/(?:docker|containerd|kubepods)[/-]`)
	systemdRe     = regexp.MustCompile(`/([^/\s]+\.service)(?:\s|$)`)
)

// classify decides whether a process runs inside a container, under systemd or
// directly on the host.
func classify(p *Process) Classification {
	c := Classification{Runtime: "unknown", Detail: map[string]string{}}
	if p == nil {
		return c
	}
	cgroup := p.Cgroup

	if m := dockerScopeRe.FindStringSubmatch(cgroup); m != nil {
		c.Runtime = "docker"
		c.Detail["container_id"] = m[1]
		c.Detail["cgroup"] = firstLine(cgroup)
		return c
	}
	if dockerPathRe.MatchString(cgroup) {
		c.Runtime = "docker"
		c.Detail["cgroup"] = firstLine(cgroup)
		return c
	}
	if m := systemdRe.FindStringSubmatch(cgroup); m != nil {
		c.Runtime = "systemd"
		c.Detail["unit"] = m[1]
		c.Detail["cgroup"] = firstLine(cgroup)
		return c
	}

	c.Runtime = "process"
	if p.Exe != "" {
		c.Detail["exe"] = p.Exe
	}
	if p.Cmdline != "" {
		c.Detail["cmdline"] = truncate(p.Cmdline, 300)
	}
	if p.Cwd != "" {
		c.Detail["cwd"] = p.Cwd
	}
	return c
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return strings.TrimSpace(s[:i])
	}
	return strings.TrimSpace(s)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

// prettyName turns a process name into a human friendly service name.
func prettyName(comm, exe string) string {
	name := comm
	if name == "" {
		name = filepathBase(exe)
	}
	switch name {
	case "node":
		if exe != "" {
			base := filepathBase(filepathDir(exe))
			if base != "" && base != "." {
				name = base
			}
		}
	case "python3", "python":
		return "Python 应用"
	}
	name = strings.ReplaceAll(name, "_", " ")
	name = strings.ReplaceAll(name, "-", " ")
	return strings.TrimSpace(name)
}

func filepathBase(p string) string {
	if i := strings.LastIndexByte(p, '/'); i >= 0 {
		return p[i+1:]
	}
	return p
}

func filepathDir(p string) string {
	if i := strings.LastIndexByte(p, '/'); i > 0 {
		return p[:i]
	}
	return ""
}

func slug(s string) string {
	s = strings.ToLower(s)
	var b strings.Builder
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		case r == ' ' || r == '-' || r == '_' || r == '.':
			b.WriteByte('-')
		}
	}
	out := strings.Trim(b.String(), "-")
	for strings.Contains(out, "--") {
		out = strings.ReplaceAll(out, "--", "-")
	}
	if out == "" {
		out = "svc"
	}
	return out
}

func fmtLabel(runtime string) string {
	switch runtime {
	case "docker":
		return "🐳 Docker"
	case "systemd":
		return "⚙️ systemd"
	case "process":
		return "🖥️ 宿主机进程"
	default:
		return "❓ 未知"
	}
}

var _ = fmt.Sprintf
