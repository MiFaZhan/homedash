<div align="center">

# homedash

**A self-hosted dashboard for the services running on your machine** — discovers them automatically and lets you curate them in the browser.

[中文](README.md) · [Docs](docs/) · [Contributing](CONTRIBUTING.md)

</div>

---

## Why

A single Linux box ends up running a dozen things: a knowledge base, a metrics dashboard, a remote desktop, a few MCP gateways, plus whatever debug port you opened five minutes ago. Nobody remembers every address and port, so everyone greps `ss -ltnp`.

homedash does three things:

1. **Discover** — scan listening sockets, resolve the owning process, and tell whether it runs in Docker, under systemd, as a plain host process, or behind a Tailscale proxy.
2. **Curate** — add, rename, re-icon, reorder and move services between pages from the browser. Everything lands in a git-friendly YAML file.
3. **Expose** — binds to loopback by default; publish it with Tailscale (`tailscale serve`) or a Cloudflare Tunnel.

## Features

- **Runtime badges** — 🐳 Docker / ⚙️ systemd / 🖥️ host process / 🔗 Tailscale, so containers and host-installed services never get mixed up
- **Pages, not groups** — one scenario per page (Home / Dev / Ops / External / Discovered), flip between them like WeTab; create your own pages
- **Health status** — periodic HTTP probes show online/offline plus latency on every card
- **Zero-build frontend** — vanilla JS and CSS embedded in a single Go binary
- **Config is the source of truth** — every edit is written atomically with a timestamped backup
- **Optional auth** — off by default; HTTP Basic Auth (bcrypt) when you need it
- **Docker friendly** — mount `/proc` and `docker.sock`, run with host networking

## Quick start

```bash
go install github.com/mifazhan/homedash@latest
homedash init
homedash serve          # http://127.0.0.1:3010
```

Docker:

```bash
docker compose up -d
```

## Configuration

`~/.config/homedash/config.yaml` holds pages, services and settings. See the
[Chinese README](README.md#配置) for the annotated example — the file format is
identical.

## Exposure

```bash
# Tailscale (recommended, automatic TLS, ACL-protected)
tailscale serve --bg --https=443 http://127.0.0.1:3010

# Public internet: tunnel or reverse proxy in front of 127.0.0.1:3010
cloudflared tunnel run --url http://127.0.0.1:3010
```

Always enable `auth.enabled` when the dashboard is reachable from the internet.

## Development

```bash
make test
make build
make run
```

No frontend build step: edit `internal/web/assets/*` and rebuild.

## License

[MIT](LICENSE)
