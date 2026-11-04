package scan

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	nginxListenRe = regexp.MustCompile(`listen\s+(\d+)`)
	serveURLRe    = regexp.MustCompile(`https?://[^/\s]+:(\d+)`)
)

// rootUnitPorts maps ports of services we cannot attribute through /proc
// (they run as root) onto the systemd unit that owns them.
func rootUnitPorts() map[int]string {
	result := map[int]string{}
	// nginx: read the listen directives from its configuration
	for _, root := range []string{"/etc/nginx/nginx.conf", "/etc/nginx/sites-enabled"} {
		files, _ := filepath.Glob(filepath.Join(root, "*"))
		if root == "/etc/nginx/nginx.conf" {
			files = append(files, root)
		}
		for _, f := range files {
			b, err := os.ReadFile(f)
			if err != nil {
				continue
			}
			for _, line := range strings.Split(string(b), "\n") {
				trimmed := strings.TrimSpace(line)
				if strings.HasPrefix(trimmed, "#") {
					continue
				}
				for _, m := range nginxListenRe.FindAllStringSubmatch(trimmed, -1) {
					if p, err := strconv.Atoi(m[1]); err == nil {
						result[p] = "nginx.service"
					}
				}
			}
		}
	}
	return result
}

// tailscaleServePorts maps the ports handled by "tailscale serve" onto their
// upstream target.
func tailscaleServePorts() map[int]string {
	result := map[int]string{}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "tailscale", "serve", "status").Output()
	if err != nil {
		return result
	}
	targetRe := regexp.MustCompile(`(https?://\S+)`)
	currentPort := 0
	for _, line := range strings.Split(string(out), "\n") {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "|") {
			if m := targetRe.FindStringSubmatch(trimmed); m != nil && currentPort > 0 {
				result[currentPort] = m[1]
			}
			continue
		}
		port := 0
		if strings.HasPrefix(trimmed, "https://") {
			port = 443
			if m := serveURLRe.FindStringSubmatch(trimmed); m != nil {
				if p, err := strconv.Atoi(m[1]); err == nil {
					port = p
				}
			}
		} else if m := serveURLRe.FindStringSubmatch(trimmed); m != nil {
			if p, err := strconv.Atoi(m[1]); err == nil {
				port = p
			}
		}
		if port > 0 {
			currentPort = port
			if _, ok := result[port]; !ok {
				result[port] = "tailscale serve"
			}
		}
	}
	return result
}
