// Package store reads and writes the homedash configuration file.
package store

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"

	"homedash/internal/model"
)

// DefaultPath is the canonical location of the configuration file.
const DefaultPath = "~/.config/homedash/config.yaml"

// Expand resolves a leading ~ and environment variables in a path.
func Expand(path string) string {
	if path == "" {
		path = DefaultPath
	}
	path = os.ExpandEnv(path)
	if strings.HasPrefix(path, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			path = filepath.Join(home, path[2:])
		}
	}
	return path
}

// DefaultConfig returns the configuration used before the user edits anything.
func DefaultConfig() *model.Config {
	return &model.Config{
		Server: model.Server{
			Listen:        "127.0.0.1:3010",
			DataDir:       "~/.local/share/homedash",
			ScanInterval:  "60s",
			PreferredHost: "",
			ExternalURL:   "",
		},
		Discovery: model.Discovery{
			IncludeLocal: false,
			Probe:        true,
			PortsTable:   "",
		},
		Auth: model.Auth{Enabled: false, User: "admin"},
		Appearance: model.Appearance{
			Wallpaper:     "",
			WallpaperBlur: 0,
			WallpaperDim:  0.35,
			ShowLabels:    true,
			TileSize:      "md",
			DesktopMode:   false,
			FreeLayout:    true,
			Layout:        "desktop",
		},
		Pages: []model.Page{
			{ID: "home", Name: "Home", Order: 10},
			{ID: "dev", Name: "Development", Order: 20},
			{ID: "ops", Name: "Operations", Order: 30},
			{ID: "external", Name: "External", Order: 40},
			{ID: "auto", Name: "Discovered", Order: 50},
		},
	}
}

// Load reads the configuration, returning defaults when the file is missing.
func Load(path string) (*model.Config, error) {
	path = Expand(path)
	cfg := DefaultConfig()
	b, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return cfg, nil
	}
	if err != nil {
		return nil, err
	}
	if err := yaml.Unmarshal(b, cfg); err != nil {
		return nil, fmt.Errorf("cannot parse %s: %w", path, err)
	}
	if len(cfg.Pages) == 0 {
		cfg.Pages = DefaultConfig().Pages
	}
	return cfg, nil
}

// Save writes the configuration atomically and keeps a timestamped backup.
func Save(path string, cfg *model.Config) error {
	path = Expand(path)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	b, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	if old, err := os.ReadFile(path); err == nil {
		backup := fmt.Sprintf("%s.bak.%s", path, time.Now().Format("20060102-150405"))
		if err := os.WriteFile(backup, old, 0o600); err != nil {
			return err
		}
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// Merge overlays discovered services onto the configuration. Fields the user
// edited manually are never overwritten.
func Merge(cfg *model.Config, discovered []model.Service) {
	index := map[string]int{}
	// ports already covered by hand-curated entries; a discovered service on the
	// same port would only be a duplicate of it
	manualPorts := map[int]bool{}
	for i, s := range cfg.Services {
		index[s.ID] = i
		if s.Managed == model.ManagedManual && s.Port != 0 {
			manualPorts[s.Port] = true
		}
	}
	for _, d := range discovered {
		if d.Port != 0 && manualPorts[d.Port] {
			continue
		}
		i, ok := index[d.ID]
		if !ok {
			if d.Page == "" {
				d.Page = "auto"
			}
			cfg.Services = append(cfg.Services, d)
			continue
		}
		cur := &cfg.Services[i]
		cur.Status = d.Status
		cur.LatencyMS = d.LatencyMS
		cur.HTTPStatus = d.HTTPStatus
		cur.LastSeen = d.LastSeen
		cur.Runtime = d.Runtime
		if cur.Managed == model.ManagedManual {
			continue
		}
		cur.Detail = d.Detail
		cur.URL = d.URL
		cur.Addr = d.Addr
		cur.Port = d.Port
		if cur.Name == "" {
			cur.Name = d.Name
		}
		if cur.Icon == "" {
			cur.Icon = d.Icon
		}
		if cur.Page == "" {
			cur.Page = d.Page
		}
	}
}

// Find returns the service with the given id.
func Find(cfg *model.Config, id string) (int, *model.Service) {
	for i := range cfg.Services {
		if cfg.Services[i].ID == id {
			return i, &cfg.Services[i]
		}
	}
	return -1, nil
}

// Upsert creates or updates a service, marking it as manually managed.
func Upsert(cfg *model.Config, svc model.Service) {
	if i, _ := Find(cfg, svc.ID); i >= 0 {
		cur := &cfg.Services[i]
		*cur = svc
		cur.Managed = model.ManagedManual
		return
	}
	svc.Managed = model.ManagedManual
	cfg.Services = append(cfg.Services, svc)
}

// Remove deletes a service by id and reports whether it existed.
func Remove(cfg *model.Config, id string) bool {
	i, _ := Find(cfg, id)
	if i < 0 {
		return false
	}
	cfg.Services = append(cfg.Services[:i], cfg.Services[i+1:]...)
	return true
}
