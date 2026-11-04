package scan

import (
	"os"
	"strconv"

	"gopkg.in/yaml.v3"
)

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

// builtinPorts is the fallback table used when no ports.yaml is present.
var builtinPorts = map[int]PortHint{
	22:    {Name: "SSH", Description: "远程登录", Icon: "terminal", Hidden: true},
	80:    {Name: "nginx", Description: "HTTP 反向代理", Icon: "nginx"},
	443:   {Name: "HTTPS", Description: "TLS 入口", Icon: "nginx"},
	631:   {Name: "CUPS 打印", Description: "打印服务", Icon: "printer", Hidden: true},
	3000:  {Name: "Homepage", Description: "服务导航盘", Icon: "layout-dashboard"},
	3389:  {Name: "远程桌面 RDP", Description: "gnome-remote-desktop", Icon: "monitor"},
	3425:  {Name: "Magpie", Description: "图像/文档服务", Icon: "image"},
	5900:  {Name: "VNC", Description: "x11vnc 图形桌面", Icon: "monitor"},
	6080:  {Name: "noVNC 网页桌面", Description: "浏览器直连 Ubuntu 图形桌面", Icon: "monitor"},
	7897:  {Name: "Clash Verge", Description: "本地代理混合端口", Icon: "network"},
	8080:  {Name: "Tailscale Serve 8080", Description: "tailnet 内 HTTP 入口", Icon: "network"},
	8090:  {Name: "Tailscale Serve 8090", Description: "tailnet 内 Homepage 入口", Icon: "network"},
	1933:  {Name: "OpenViking", Description: "AI 上下文库服务", Icon: "database"},
	27213: {Name: "HiFox daemon", Description: "HiFox 本机服务（内部 API）", Icon: "bot"},
	61208: {Name: "Glances", Description: "CPU/内存/温度监控", Icon: "activity"},
	18080: {Name: "内部端口 18080", Description: "待确认用途", Icon: "help-circle"},
	18081: {Name: "内部端口 18081", Description: "待确认用途", Icon: "help-circle"},
}

// loadPortTable merges the builtin table with an optional YAML file.
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
