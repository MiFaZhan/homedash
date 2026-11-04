package scan

import "testing"

func TestSplitHexAddrIPv4(t *testing.T) {
	host, port, err := splitHexAddr("0100007F:1F90", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if host != "127.0.0.1" {
		t.Fatalf("host = %q, want 127.0.0.1", host)
	}
	if port != "1F90" {
		t.Fatalf("port = %q, want 1F90", port)
	}
}

func TestSplitHexAddrIPv4Wildcard(t *testing.T) {
	host, _, err := splitHexAddr("00000000:0050", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if host != "0.0.0.0" {
		t.Fatalf("host = %q, want 0.0.0.0", host)
	}
}

func TestSplitHexAddrIPv6Loopback(t *testing.T) {
	host, _, err := splitHexAddr("00000000000000000000000001000000:0016", true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if host != "::1" {
		t.Fatalf("host = %q, want ::1", host)
	}
}

func TestClassifyDocker(t *testing.T) {
	p := &Process{Cgroup: "0::/system.slice/docker-3f2a1b4c5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f70.scope\n"}
	c := classify(p)
	if c.Runtime != "docker" {
		t.Fatalf("runtime = %q, want docker", c.Runtime)
	}
	if c.Detail["container_id"] == "" {
		t.Fatal("expected container id")
	}
}

func TestClassifySystemd(t *testing.T) {
	p := &Process{Cgroup: "0::/user.slice/user-1000.slice/user@1000.service/app.slice/glances.service\n"}
	c := classify(p)
	if c.Runtime != "systemd" {
		t.Fatalf("runtime = %q, want systemd", c.Runtime)
	}
	if c.Detail["unit"] != "glances.service" {
		t.Fatalf("unit = %q, want glances.service", c.Detail["unit"])
	}
}

func TestClassifyHostProcess(t *testing.T) {
	p := &Process{Cgroup: "0::/user.slice/user-1000.slice/session-3.scope\n",
		Exe: "/home/ubuntu/.local/bin/openviking-server"}
	c := classify(p)
	if c.Runtime != "process" {
		t.Fatalf("runtime = %q, want process", c.Runtime)
	}
	if c.Detail["exe"] != "/home/ubuntu/.local/bin/openviking-server" {
		t.Fatalf("exe = %q", c.Detail["exe"])
	}
}

func TestBuildURL(t *testing.T) {
	if got := buildURL("100.96.247.26", 3000); got != "http://100.96.247.26:3000" {
		t.Fatalf("got %q", got)
	}
	if got := buildURL("fd7a::1", 443); got != "http://[fd7a::1]:443" {
		t.Fatalf("got %q", got)
	}
}
