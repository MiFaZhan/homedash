// Package store reads and writes the homedash configuration file.
package store

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"

	"homedash/internal/model"
)

// DefaultPath is the canonical location of the configuration file.
const DefaultPath = "~/.config/homedash/config.yaml"

// Expand resolves a leading ~ to the user home directory.
func Expand(path string) string {
	if path == "" {
		path = DefaultPath
	}
	if path[0] == '~' {
		home, err := os.UserHomeDir()
		if err == nil {
			path = filepath.Join(home, path[1:])
		}
	}
	return path
}

// DefaultConfig returns the configuration used before the user edits anything.
func DefaultConfig() *model.Config {
	return &model.Config{
		Pages: []model.Page{
			{ID: "home", Name: "首页", Order: 10},
			{ID: "dev", Name: "开发", Order: 20},
			{ID: "ops", Name: "运维", Order: 30},
			{ID: "external", Name: "外部", Order: 40},
			{ID: "auto", Name: "自动发现", Order: 50},
		},
	}
}

// Load reads the configuration, creating a default one when it does not exist.
func Load(path string) (*model.Config, error) {
	path = Expand(path)
	b, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return DefaultConfig(), nil
	}
	if err != nil {
		return nil, err
	}
	cfg := DefaultConfig()
	if err := yaml.Unmarshal(b, cfg); err != nil {
		return nil, fmt.Errorf("解析配置失败 %s: %w", path, err)
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
	for i, s := range cfg.Services {
		index[s.ID] = i
	}
	for _, d := range discovered {
		i, ok := index[d.ID]
		if !ok {
			cfg.Services = append(cfg.Services, d)
			continue
		}
		cur := &cfg.Services[i]
		// refresh volatile fields only
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
