package scan

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Listener is a socket found in LISTEN state together with the owning process.
type Listener struct {
	Addr    string // human readable bind address, e.g. 0.0.0.0 or 100.96.247.26
	Port    int
	Process *Process
}

// Process describes the process owning a listening socket.
type Process struct {
	PID     int
	Comm    string
	Exe     string
	Cmdline string
	Cwd     string
	Cgroup  string
}

const procNet = "/proc/net"

// listenSockets returns every listening TCP socket with its inode.
func listenSockets() ([]socketEntry, error) {
	var out []socketEntry
	for _, f := range []string{"tcp", "tcp6"} {
		entries, err := readProcNet(filepath.Join(procNet, f))
		if err != nil {
			continue
		}
		out = append(out, entries...)
	}
	return out, nil
}

type socketEntry struct {
	Addr    string
	Port    int
	Inode   string
	IPv6    bool
	AnyAddr bool
}

func readProcNet(path string) ([]socketEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	var out []socketEntry
	first := true
	for sc.Scan() {
		line := sc.Text()
		if first {
			first = false
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 10 {
			continue
		}
		if fields[3] != "0A" { // TCP_LISTEN
			continue
		}
		host, portStr, err := splitHexAddr(fields[1], strings.HasSuffix(path, "tcp6"))
		if err != nil {
			continue
		}
		port, err := strconv.ParseUint(portStr, 16, 16)
		if err != nil {
			continue
		}
		out = append(out, socketEntry{
			Addr:    host,
			Port:    int(port),
			Inode:   fields[9],
			IPv6:    strings.HasSuffix(path, "tcp6"),
			AnyAddr: host == "0.0.0.0" || host == "::",
		})
	}
	return out, sc.Err()
}

// splitHexAddr decodes the "0100007F:1F90" form used by /proc/net/tcp.
// The address is stored in host byte order (little endian on x86).
func splitHexAddr(s string, ipv6 bool) (string, string, error) {
	parts := strings.Split(s, ":")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("bad address %q", s)
	}
	if ipv6 {
		if len(parts[0]) != 32 {
			return "", "", fmt.Errorf("bad ipv6 address %q", s)
		}
		b := make([]byte, 16)
		for i := 0; i < 4; i++ {
			chunk := parts[0][i*8 : i*8+8]
			w, err := strconv.ParseUint(chunk, 16, 32)
			if err != nil {
				return "", "", err
			}
			b[i*4+0] = byte(w)
			b[i*4+1] = byte(w >> 8)
			b[i*4+2] = byte(w >> 16)
			b[i*4+3] = byte(w >> 24)
		}
		return net.IP(b).String(), parts[1], nil
	}
	raw, err := strconv.ParseUint(parts[0], 16, 32)
	if err != nil {
		return "", "", err
	}
	b := []byte{byte(raw), byte(raw >> 8), byte(raw >> 16), byte(raw >> 24)}
	return fmt.Sprintf("%d.%d.%d.%d", b[0], b[1], b[2], b[3]), parts[1], nil
}

// processesBySocketInode maps socket inode -> owning process.
func processesBySocketInode() map[string]*Process {
	result := map[string]*Process{}
	entries, err := os.ReadDir("/proc")
	if err != nil {
		return result
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		pid, err := strconv.Atoi(e.Name())
		if err != nil {
			continue
		}
		proc := readProcess(pid)
		if proc == nil {
			continue
		}
		fdDir := filepath.Join("/proc", e.Name(), "fd")
		fds, err := os.ReadDir(fdDir)
		if err != nil {
			continue // not our process
		}
		for _, fd := range fds {
			link, err := os.Readlink(filepath.Join(fdDir, fd.Name()))
			if err != nil {
				continue
			}
			if !strings.HasPrefix(link, "socket:[") {
				continue
			}
			inode := strings.TrimSuffix(strings.TrimPrefix(link, "socket:["), "]")
			if _, ok := result[inode]; !ok {
				result[inode] = proc
			}
		}
	}
	return result
}

func readProcess(pid int) *Process {
	base := filepath.Join("/proc", strconv.Itoa(pid))
	if _, err := os.Stat(base); err != nil {
		return nil
	}
	p := &Process{PID: pid}
	if b, err := os.ReadFile(filepath.Join(base, "comm")); err == nil {
		p.Comm = strings.TrimSpace(string(b))
	}
	if b, err := os.ReadFile(filepath.Join(base, "cmdline")); err == nil {
		p.Cmdline = strings.TrimSpace(strings.ReplaceAll(string(b), "\x00", " "))
	}
	if link, err := os.Readlink(filepath.Join(base, "exe")); err == nil {
		p.Exe = link
	}
	if link, err := os.Readlink(filepath.Join(base, "cwd")); err == nil {
		p.Cwd = link
	}
	if b, err := os.ReadFile(filepath.Join(base, "cgroup")); err == nil {
		p.Cgroup = string(b)
	}
	return p
}
