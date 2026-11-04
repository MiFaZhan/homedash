package scan

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// faviconLinkRe finds the icon declaration inside an HTML head.
var faviconLinkRe = regexp.MustCompile(`(?i)<link[^>]+rel=["']?(?:shortcut )?icon["']?[^>]*>`)
var hrefRe = regexp.MustCompile(`(?i)href=["']([^"']+)["']`)

var faviconClient = &http.Client{
	Timeout: 5 * time.Second,
	Transport: &http.Transport{
		DisableKeepAlives:   true,
		TLSHandshakeTimeout: 4 * time.Second,
		Proxy:               nil, // never send discovery traffic through a proxy
	},
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) > 3 {
			return http.ErrUseLastResponse
		}
		return nil
	},
}

// FetchFavicon downloads the icon of a service and caches it under dir.
// It returns the cache file name (not a URL), or "" when nothing was found.
func FetchFavicon(rawURL, dir string) string {
	u, err := url.Parse(rawURL)
	if err != nil || u.Host == "" {
		return ""
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return ""
	}
	sum := sha1.Sum([]byte(u.Scheme + "://" + u.Host))
	name := hex.EncodeToString(sum[:8])
	for _, ext := range []string{".png", ".svg", ".ico", ".webp", ".jpg"} {
		if _, err := os.Stat(filepath.Join(dir, "fav-"+name+ext)); err == nil {
			return "fav-" + name + ext
		}
	}

	candidates := faviconCandidates(u)
	for _, cand := range candidates {
		data, ctype, ok := download(cand)
		if !ok || len(data) == 0 || len(data) > 2<<20 {
			continue
		}
		ext := extFor(ctype, cand)
		if ext == "" {
			continue
		}
		file := "fav-" + name + ext
		if err := os.WriteFile(filepath.Join(dir, file), data, 0o644); err != nil {
			continue
		}
		return file
	}
	return ""
}

func faviconCandidates(u *url.URL) []string {
	base := u.Scheme + "://" + u.Host
	out := []string{base + "/favicon.ico", base + "/favicon.svg", base + "/favicon.png"}
	// look for a <link rel=icon> on the page itself
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/", nil)
	if err == nil {
		req.Header.Set("User-Agent", "homedash-favicon/1.0")
		if resp, err := faviconClient.Do(req); err == nil {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 256<<10))
			resp.Body.Close()
			for _, tag := range faviconLinkRe.FindAllString(string(body), -1) {
				m := hrefRe.FindStringSubmatch(tag)
				if m == nil {
					continue
				}
				ref, err := url.Parse(m[1])
				if err != nil {
					continue
				}
				out = append([]string{u.ResolveReference(ref).String()}, out...)
			}
		}
	}
	return out
}

func download(rawURL string) ([]byte, string, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, "", false
	}
	req.Header.Set("User-Agent", "homedash-favicon/1.0")
	resp, err := faviconClient.Do(req)
	if err != nil || resp.StatusCode >= 400 {
		if resp != nil {
			resp.Body.Close()
		}
		return nil, "", false
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, "", false
	}
	return data, resp.Header.Get("Content-Type"), true
}

func extFor(ctype, rawURL string) string {
	ct := strings.ToLower(ctype)
	switch {
	case strings.Contains(ct, "svg"):
		return ".svg"
	case strings.Contains(ct, "png"):
		return ".png"
	case strings.Contains(ct, "icon"), strings.Contains(ct, "vnd.microsoft.icon"):
		return ".ico"
	case strings.Contains(ct, "webp"):
		return ".webp"
	case strings.Contains(ct, "jpeg"):
		return ".jpg"
	}
	switch {
	case strings.HasSuffix(rawURL, ".svg"):
		return ".svg"
	case strings.HasSuffix(rawURL, ".png"):
		return ".png"
	case strings.HasSuffix(rawURL, ".ico"):
		return ".ico"
	case strings.HasSuffix(rawURL, ".webp"):
		return ".webp"
	}
	return ""
}
