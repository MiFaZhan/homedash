<div align="center">

# homedash

**自托管的本机服务导航盘** —— 自动发现这台机器上正在跑的服务，用网页把它们整理成可以翻页的卡片墙。

[English](README.en.md) · [文档](docs/) · [贡献指南](CONTRIBUTING.md)

</div>

---

## 它解决什么问题

家里/工位上一台 Linux 机器，跑着十几个服务：OpenViking、Glances、noVNC、几个 MCP 网关、偶尔还有临时起的调试端口。
没人记得每个东西的地址和端口，于是每次都要 `ss -ltnp` 翻一遍。

homedash 做三件事：

1. **自动发现**：扫描本机监听端口，反查属主进程，识别它是 Docker 容器、systemd 服务、宿主机裸进程还是 Tailscale 代理；
2. **可编辑**：在浏览器里增删改图标、名称、地址、归属页面、顺序，配置落盘为一份可进 git 的 YAML；
3. **可暴露**：默认只监听回环地址，用 Tailscale（`tailscale serve`）或 Cloudflare Tunnel 对外提供访问。

## 特性

- **运行形态徽标**：🐳 Docker / ⚙️ systemd / 🖥️ 宿主机进程 / 🔗 Tailscale，一眼分清"容器跑的"还是"装在本机的"
- **多页而非分组**：像 WeTab 一样一页一场景（首页 / 开发 / 运维 / 外部 / 自动发现），左右翻页，页面可自建
- **健康状态**：定时 HTTP 探测，卡片上直接显示 online/offline 与延迟
- **现代前端**：React 19 + TypeScript + Vite + Tailwind CSS v4 + Radix UI 组件 + TanStack Query，构建产物用 `go:embed` 打进单二进制
- **配置即真相**：`config.yaml` 是唯一数据源，界面上的每一次编辑都原子写盘并保留备份
- **可选认证**：默认关闭；开启后为 HTTP Basic Auth（bcrypt），公网暴露时建议必开
- **主题切换**：深色 / 浅色 / 跟随系统，顶栏一键切换，选择记在浏览器本地
- **自定义壁纸**：上传图片作为背景，可调模糊与压暗，支持"桌面模式"隐藏顶栏
- **图标文字开关**：全局开关 + 每个图标单独覆盖
- **自由摆放**：图标可直接拖到任意位置并持久化，也可退回自动弧线排布
- **Docker 友好**：容器内扫描靠挂载 `/proc` 与 `/var/run/docker.sock`，compose 文件开箱即用

## 快速开始

### 二进制

```bash
go install github.com/mifazhan/homedash@latest   # 或从 Releases 下载
homedash init                                    # 生成 ~/.config/homedash/config.yaml
homedash serve                                   # 启动，默认 127.0.0.1:3010
```

打开 <http://127.0.0.1:3010> 即可看到本机服务。

### Docker Compose

```bash
git clone https://github.com/mifazhan/homedash && cd homedash
docker compose up -d
```

compose 里做了两件关键事：`network_mode: host`（拿到真实网卡地址）、挂载 `/proc` 与 `docker.sock`（识别宿主机与容器服务）。

### systemd（用户级）

```ini
# ~/.config/systemd/user/homedash.service
[Unit]
Description=homedash dashboard
After=network-online.target

[Service]
Environment=HOMEDASH_CONFIG=%h/.config/homedash/config.yaml
ExecStart=%h/.local/bin/homedash serve
Restart=always

[Install]
WantedBy=default.target
```

## 配置

`~/.config/homedash/config.yaml`：

```yaml
appearance:
  wallpaper: ""            # /wallpapers/xxx.png，空则用默认渐变
  wallpaper_blur: 0
  wallpaper_dim: 0.35
  show_labels: true        # 是否显示图标文字
  tile_size: md            # sm / md / lg
  desktop_mode: false      # 桌面模式：隐藏顶栏与侧栏
  free_layout: true        # 自由摆放：图标可拖动并记住位置

server:
  listen: 127.0.0.1:3010
  data_dir: ~/.local/share/homedash
  scan_interval: 60s
  preferred_host: ""      # 留空自动选择（Tailscale IP 优先，其次内网 IPv4）
  external_url: ""

discovery:
  include_local: false    # 是否收录只监听 127.0.0.1 的服务
  probe: true             # 是否做 HTTP 健康探测
  hide_ports: []          # 永远不显示的端口
  ports_table: ""         # 自定义端口归并表，默认读 <data_dir>/ports.yaml

auth:
  enabled: false
  user: admin
  password_hash: ""       # homedash hash-password <password> 生成

pages:
  - id: home
    name: 首页
    order: 10

services:
  - id: openviking
    name: OpenViking
    url: http://100.x.x.x:1933/
    page: home
    icon: database
    managed: manual        # manual 的条目不会被自动扫描覆盖
```

端口归并表（`~/.local/share/homedash/ports.yaml`）可以把"端口 8081"翻译成"Grafana"：

```yaml
ports:
  8081:
    name: Grafana
    description: 可观测性面板
    icon: chart
    page: ops
  9000:
    name: 内部调试端口
    hidden: true
```

## 对外暴露

### 方式 A：Tailscale（推荐）

```bash
tailscale serve --bg --http=8091 http://127.0.0.1:3010
# 其他设备访问 http://<host>.<tailnet>.ts.net:8091
```

tailnet 内部流量本身由 WireGuard 加密，HTTP 入口足够安全。若你的 tailnet 已能正常签发
Let's Encrypt 证书，也可以用 `--https=443` 提供 HTTPS 入口。

### 方式 B：公网

homedash 默认只监听回环地址，公网暴露请用反向代理或隧道：

```bash
# Cloudflare Tunnel
cloudflared tunnel run --url http://127.0.0.1:3010

# 或 nginx + Let's Encrypt 反代到 127.0.0.1:3010
```

**公网暴露时必须开启 `auth.enabled`。**

## HTTP API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/config` | 页面与服务全量配置 |
| POST | `/api/scan` | 立即触发一次扫描 |
| POST | `/api/services` | 新增服务 |
| PUT | `/api/services/{id}` | 更新服务 |
| DELETE | `/api/services/{id}` | 删除服务 |
| POST | `/api/services/reorder` | 批量排序与换页 |
| POST | `/api/pages` | 新增/更新页面 |
| DELETE | `/api/pages/{id}` | 删除页面（服务移到自动发现页） |
| POST | `/api/icons` | 上传图标（multipart，字段 `file`） |
| POST | `/api/settings` | 保存外观设置（壁纸/文字/图标大小/桌面模式/自由摆放） |
| POST | `/api/wallpapers` | 上传壁纸（multipart，字段 `file`） |

## 扫描原理

| 数据源 | 采集内容 |
|---|---|
| `/proc/net/tcp{,6}` + `/proc/*/fd` | 监听端口与属主进程（无需 root，除少数特权进程） |
| `/proc/<pid>/cgroup` | 运行形态判定：Docker / systemd / 宿主机进程 |
| `systemctl show` | 单元描述、状态（用户单元自动回退 `--user`） |
| Docker API | 容器名与镜像（需要 `docker.sock`） |
| nginx / caddy 配置 | 反代端口归并，避免重复条目 |
| `tailscale serve status` | 标出 Tailscale 代理的端口与其上游 |

细节见 [docs/SCANNING.md](docs/SCANNING.md)。

## 技术栈

| 层 | 选型 |
|---|---|
| 后端 | Go 1.26（标准库 HTTP + `yaml.v3` + `x/crypto/bcrypt`），单二进制 |
| 前端 | React 19 · TypeScript · Vite 7 · Tailwind CSS v4 |
| UI 组件 | Radix UI primitives（Dialog / Select / Switch / Slider / Tooltip）· lucide-react |
| 数据 | TanStack Query · 拖拽排序 @dnd-kit |
| 打包 | Vite 产物 → `go:embed` → 一个可执行文件 |

## 开发

```bash
git clone https://github.com/mifazhan/homedash && cd homedash
make all        # 构建前端 + 编译后端
make run        # 运行 ./homedash（前端已内嵌）
make dev        # 后端 :3010 + Vite :5173（热更新，/api 自动代理）
make test       # go test ./...  + 前端 tsc 类型检查
```

改前端只需在 `web/` 下开发，`make dev` 有热更新；发布前 `make all` 会把新产物写进
`internal/web/dist` 并被 Go 打包。

## License

[MIT](LICENSE)
