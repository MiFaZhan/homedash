// Package model holds the configuration structures of homedash.
package model

import (
	"encoding/json"
	"fmt"
	"time"
)

// FlexTime accepts the timestamp formats humans and tools actually write,
// including "2006-01-02 15:04:05" with a space separator.
type FlexTime struct {
	time.Time
}

// UnmarshalYAML parses RFC3339 as well as the space separated variant.
func (t *FlexTime) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	if err := unmarshal(&s); err == nil {
		if s == "" {
			t.Time = time.Time{}
			return nil
		}
		layouts := []string{
			time.RFC3339Nano,
			time.RFC3339,
			"2006-01-02 15:04:05.999999999Z07:00",
			"2006-01-02 15:04:05",
			"2006-01-02",
		}
		for _, layout := range layouts {
			if v, err := time.Parse(layout, s); err == nil {
				t.Time = v
				return nil
			}
		}
		return fmt.Errorf("cannot parse timestamp %q", s)
	}
	var tv time.Time
	if err := unmarshal(&tv); err == nil {
		t.Time = tv
		return nil
	}
	return fmt.Errorf("cannot parse timestamp")
}

// MarshalYAML writes RFC3339.
func (t FlexTime) MarshalYAML() (interface{}, error) {
	if t.IsZero() {
		return "", nil
	}
	return t.Time.Format(time.RFC3339Nano), nil
}

// MarshalJSON writes RFC3339.
func (t FlexTime) MarshalJSON() ([]byte, error) {
	if t.IsZero() {
		return []byte(`""`), nil
	}
	return json.Marshal(t.Time.Format(time.RFC3339))
}

// Runtime classifies how a service is executed on the machine.
const (
	RuntimeDocker    = "docker"
	RuntimeSystemd   = "systemd"
	RuntimeProcess   = "process"
	RuntimeTailscale = "tailscale"
	RuntimeUnknown   = "unknown"
)

// Managed marks the origin of an entry.
const (
	ManagedManual     = "manual"
	ManagedDiscovered = "discovered"
)

// Status values of a discovered service.
const (
	StatusOnline  = "online"
	StatusOffline = "offline"
	StatusUnknown = "unknown"
)

// Server holds the HTTP server settings.
type Server struct {
	Listen        string `yaml:"listen" json:"listen"`
	DataDir       string `yaml:"data_dir" json:"data_dir"`
	ScanInterval  string `yaml:"scan_interval" json:"scan_interval"`
	PreferredHost string `yaml:"preferred_host" json:"preferred_host"`
	ExternalURL   string `yaml:"external_url" json:"external_url"`
}

// Discovery controls the automatic service discovery.
type Discovery struct {
	IncludeLocal bool   `yaml:"include_local" json:"include_local"`
	Probe        bool   `yaml:"probe" json:"probe"`
	HidePorts    []int  `yaml:"hide_ports" json:"hide_ports"`
	PortsTable   string `yaml:"ports_table" json:"ports_table"`
}

// Auth holds the optional password protection.
type Auth struct {
	Enabled      bool   `yaml:"enabled" json:"enabled"`
	User         string `yaml:"user" json:"user"`
	PasswordHash string `yaml:"password_hash" json:"-"`
}

// Appearance holds the launcher look and feel settings.
type Appearance struct {
	Wallpaper     string  `yaml:"wallpaper" json:"wallpaper"`
	WallpaperBlur int     `yaml:"wallpaper_blur" json:"wallpaper_blur"`
	WallpaperDim  float64 `yaml:"wallpaper_dim" json:"wallpaper_dim"`
	ShowLabels    bool    `yaml:"show_labels" json:"show_labels"`
	TileSize      string  `yaml:"tile_size" json:"tile_size"`
	DesktopMode   bool    `yaml:"desktop_mode" json:"desktop_mode"`
	FreeLayout    bool    `yaml:"free_layout" json:"free_layout"`
	Layout        string  `yaml:"layout" json:"layout"`
}

// Service is one tile on a page.
type Service struct {
	ID          string            `yaml:"id" json:"id"`
	Name        string            `yaml:"name" json:"name"`
	URL         string            `yaml:"url" json:"url"`
	Description string            `yaml:"description,omitempty" json:"description,omitempty"`
	Icon        string            `yaml:"icon,omitempty" json:"icon,omitempty"`
	Page        string            `yaml:"page,omitempty" json:"page,omitempty"`
	X           *int              `yaml:"x,omitempty" json:"x,omitempty"`
	Y           *int              `yaml:"y,omitempty" json:"y,omitempty"`
	ShowLabel   *bool             `yaml:"show_label,omitempty" json:"show_label,omitempty"`
	Order       int               `yaml:"order,omitempty" json:"order,omitempty"`
	Pin         bool              `yaml:"pin,omitempty" json:"pin,omitempty"`
	Hidden      bool              `yaml:"hidden,omitempty" json:"hidden,omitempty"`
	Port        int               `yaml:"port,omitempty" json:"port,omitempty"`
	Addr        string            `yaml:"addr,omitempty" json:"addr,omitempty"`
	Runtime     string            `yaml:"runtime" json:"runtime"`
	Detail      map[string]string `yaml:"runtime_detail,omitempty" json:"runtime_detail,omitempty"`
	Managed     string            `yaml:"managed" json:"managed"`
	Status      string            `yaml:"status" json:"status"`
	LatencyMS   int64             `yaml:"latency_ms,omitempty" json:"latency_ms,omitempty"`
	HTTPStatus  int               `yaml:"http_status,omitempty" json:"http_status,omitempty"`
	LastSeen    FlexTime          `yaml:"last_seen" json:"last_seen"`
}

// Page is a tab of the dashboard. The dashboard shows one page at a time and
// the user can flip between pages, in the spirit of WeTab.
type Page struct {
	ID    string `yaml:"id" json:"id"`
	Name  string `yaml:"name" json:"name"`
	Icon  string `yaml:"icon,omitempty" json:"icon,omitempty"`
	Order int    `yaml:"order,omitempty" json:"order,omitempty"`
}

// Config is the single source of truth, stored as YAML.
type Config struct {
	Server     Server     `yaml:"server" json:"server"`
	Discovery  Discovery  `yaml:"discovery" json:"discovery"`
	Auth       Auth       `yaml:"auth" json:"auth"`
	Appearance Appearance `yaml:"appearance" json:"appearance"`
	Pages      []Page     `yaml:"pages" json:"pages"`
	Services   []Service  `yaml:"services" json:"services"`
}
