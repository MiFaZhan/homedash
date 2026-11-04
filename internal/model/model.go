// Package model holds the configuration structures of homedash.
package model

import "time"

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

// Service is one tile on a page.
type Service struct {
	ID          string            `yaml:"id" json:"id"`
	Name        string            `yaml:"name" json:"name"`
	URL         string            `yaml:"url" json:"url"`
	Description string            `yaml:"description,omitempty" json:"description,omitempty"`
	Icon        string            `yaml:"icon,omitempty" json:"icon,omitempty"`
	Page        string            `yaml:"page,omitempty" json:"page,omitempty"`
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
	LastSeen    time.Time         `yaml:"last_seen" json:"last_seen"`
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
	Server    Server    `yaml:"server" json:"server"`
	Discovery Discovery `yaml:"discovery" json:"discovery"`
	Auth      Auth      `yaml:"auth" json:"auth"`
	Pages     []Page    `yaml:"pages" json:"pages"`
	Services  []Service `yaml:"services" json:"services"`
}
