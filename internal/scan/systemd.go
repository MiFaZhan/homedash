package scan

import (
	"context"
	"os/exec"
	"strings"
	"time"
)

// systemdInfo enriches a systemd unit with its description and exec start.
// User units live in a different scope, so fall back to "systemctl --user".
func systemdInfo(unit string) map[string]string {
	out := map[string]string{}
	if unit == "" {
		return out
	}
	if info := showUnit(nil, unit); len(info) > 0 {
		return info
	}
	return showUnit([]string{"--user"}, unit)
}

func showUnit(extra []string, unit string) map[string]string {
	out := map[string]string{}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	args := append([]string{}, extra...)
	args = append(args, "show", unit,
		"--property=Description,ExecStart,FragmentPath,ActiveState", "--no-pager")
	cmd := exec.CommandContext(ctx, "systemctl", args...)
	b, err := cmd.Output()
	if err != nil {
		return out
	}
	for _, line := range strings.Split(string(b), "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(line), "=")
		if !ok {
			continue
		}
		switch k {
		case "Description":
			if v != "" {
				out["description"] = v
			}
		case "FragmentPath":
			if v != "" {
				out["unit_file"] = v
			}
		case "ActiveState":
			out["active_state"] = v
		}
	}
	return out
}
