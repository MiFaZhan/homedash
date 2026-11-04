package scan

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

// DockerContainer is the subset of the docker API we need.
type DockerContainer struct {
	ID     string `json:"Id"`
	Names  []string
	Image  string
	State  string
	Labels map[string]string
	Ports  []struct {
		IP          string `json:"IP"`
		PrivatePort int    `json:"PrivatePort"`
		PublicPort  int    `json:"PublicPort"`
		Type        string `json:"Type"`
	} `json:"Ports"`
}

type dockerListItem struct {
	ID     string            `json:"Id"`
	Names  []string          `json:"Names"`
	Image  string            `json:"Image"`
	State  string            `json:"State"`
	Labels map[string]string `json:"Labels"`
	Ports  []struct {
		IP          string `json:"IP"`
		PrivatePort int    `json:"PrivatePort"`
		PublicPort  int    `json:"PublicPort"`
		Type        string `json:"Type"`
	} `json:"Ports"`
}

// dockerAvailable reports whether a docker daemon socket can be used.
func dockerAvailable() bool {
	for _, p := range []string{"/var/run/docker.sock", "/run/docker.sock"} {
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	return false
}

// dockerContainers lists containers and maps published host ports to them.
func dockerContainers() (map[int]DockerContainer, bool) {
	socket := "/var/run/docker.sock"
	if _, err := os.Stat(socket); err != nil {
		socket = "/run/docker.sock"
	}
	client := &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return (&net.Dialer{Timeout: 3 * time.Second}).DialContext(ctx, "unix", socket)
			},
		},
	}
	req, err := http.NewRequest(http.MethodGet, "http://docker/containers/json?all=1", nil)
	if err != nil {
		return nil, false
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, false
	}
	defer resp.Body.Close()
	var items []dockerListItem
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, false
	}
	byPort := map[int]DockerContainer{}
	for _, it := range items {
		name := ""
		if len(it.Names) > 0 {
			name = strings.TrimPrefix(it.Names[0], "/")
		}
		c := DockerContainer{ID: it.ID, Names: []string{name}, Image: it.Image, State: it.State, Labels: it.Labels}
		for _, p := range it.Ports {
			if p.PublicPort > 0 {
				byPort[p.PublicPort] = c
			}
		}
	}
	return byPort, true
}
