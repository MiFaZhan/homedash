package scan

import (
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

var (
	nginxProxyRe = regexp.MustCompile(`proxy_pass\s+https?://[^;]+`)
	caddyProxyRe = regexp.MustCompile(`reverse_proxy\s+[^\s{]+`)
)

// proxyPorts returns host ports that are only reverse proxies in front of
// another service, so we do not show them as separate entries.
func detectProxyPorts() map[int]string {
	result := map[int]string{}
	roots := []string{"/etc/nginx/sites-enabled", "/etc/nginx/conf.d", "/etc/nginx/conf"}
	for _, root := range roots {
		files, _ := filepath.Glob(filepath.Join(root, "*.conf"))
		files = append(files, root)
		for _, f := range files {
			b, err := os.ReadFile(f)
			if err != nil {
				continue
			}
			for _, m := range nginxProxyRe.FindAllString(string(b), -1) {
				if port, ok := portFromURL(m); ok {
					result[port] = "nginx proxy_pass"
				}
			}
		}
	}
	if b, err := os.ReadFile("/etc/caddy/Caddyfile"); err == nil {
		for _, m := range caddyProxyRe.FindAllString(string(b), -1) {
			if port, ok := portFromURL(m); ok {
				result[port] = "caddy reverse_proxy"
			}
		}
	}
	return result
}

func portFromURL(s string) (int, bool) {
	if i := strings.Index(s, "://"); i >= 0 {
		s = s[i+3:]
	}
	if i := strings.IndexAny(s, "/ \t"); i >= 0 {
		s = s[:i]
	}
	if i := strings.LastIndexByte(s, ':'); i >= 0 {
		s = s[i+1:]
	} else {
		return 0, false
	}
	p, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil {
		return 0, false
	}
	return p, true
}
