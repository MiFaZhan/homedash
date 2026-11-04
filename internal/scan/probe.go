package scan

import (
	"context"
	"crypto/tls"
	"net/http"
	"strings"
	"time"
)

// ProbeResult is the outcome of one HTTP health check.
type ProbeResult struct {
	Status     string
	LatencyMS  int64
	HTTPStatus int
}

var probeClient = &http.Client{
	Timeout: 4 * time.Second,
	Transport: &http.Transport{
		TLSClientConfig:     &tls.Config{InsecureSkipVerify: true},
		DisableKeepAlives:   true,
		TLSHandshakeTimeout: 3 * time.Second,
	},
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse
	},
}

// probe performs a cheap HTTP check against a URL.
func probe(url string) ProbeResult {
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return ProbeResult{Status: "unknown"}
	}
	req.Header.Set("User-Agent", "homedash-scanner/1.0")
	resp, err := probeClient.Do(req)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		return ProbeResult{Status: "offline", LatencyMS: latency}
	}
	defer resp.Body.Close()
	status := "online"
	if resp.StatusCode >= 500 {
		status = "offline"
	}
	return ProbeResult{Status: status, LatencyMS: latency, HTTPStatus: resp.StatusCode}
}

// looksLikeHTTP returns true when the service answered like a web server.
func looksLikeHTTP(status int, headers http.Header) bool {
	if status == 0 {
		return false
	}
	ct := headers.Get("Content-Type")
	return strings.Contains(ct, "text/html") || strings.Contains(ct, "application/json") ||
		strings.Contains(ct, "text/plain") || strings.Contains(ct, "application/xml")
}
