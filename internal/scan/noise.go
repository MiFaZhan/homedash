package scan

import (
	_ "embed"
	"os"
	"strconv"

	"gopkg.in/yaml.v3"
)

//go:embed ports_default.yaml
var defaultPortsYAML []byte

// PortHint is the curated description of a well known port.
type PortHint struct {
	Name        string `yaml:"name"`
	Description string `yaml:"description,omitempty"`
	Icon        string `yaml:"icon,omitempty"`
	Page        string `yaml:"page,omitempty"`
	Hidden      bool   `yaml:"hidden,omitempty"`
	Probe       *bool  `yaml:"probe,omitempty"`
}

type portTableFile struct {
	Ports map[string]PortHint `yaml:"ports"`
}

// builtinPorts is the table used when no user table is present.
var builtinPorts = map[int]PortHint{}

func init() {
	var f portTableFile
	if err := yaml.Unmarshal(defaultPortsYAML, &f); err == nil {
		for k, v := range f.Ports {
			if port, err := strconv.Atoi(k); err == nil {
				builtinPorts[port] = v
			}
		}
	}
}

// loadPortTable merges the embedded table with an optional user YAML file.
func loadPortTable(path string) map[int]PortHint {
	table := map[int]PortHint{}
	for k, v := range builtinPorts {
		table[k] = v
	}
	if path == "" {
		return table
	}
	b, err := os.ReadFile(path)
	if err != nil {
		return table
	}
	var f portTableFile
	if err := yaml.Unmarshal(b, &f); err != nil {
		return table
	}
	for k, v := range f.Ports {
		port, err := strconv.Atoi(k)
		if err != nil {
			continue
		}
		table[port] = v
	}
	return table
}
