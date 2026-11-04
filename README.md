# homedash

本机服务导航盘：自动发现这台机器上在跑的服务，网页上直接编辑图标，最后通过 Tailscale（或可选的公网方式）对外提供访问。

## 现状（M1：扫描器）

```bash
cd ~/services/homedash
go build -o homedash ./cmd/homedash

./homedash scan --dry-run          # 只打印，不写文件
./homedash scan --dry-run --probe=false   # 跳过健康探测
./homedash scan                     # 写入 ~/.config/homedash/config.yaml
```

常用参数：

| 参数 | 说明 |
|---|---|
| `--probe` | HTTP 健康探测（默认开），产出 online/offline 与延迟 |
| `--include-local` | 同时收录只监听 127.0.0.1 的内部服务 |
| `--ports-table` | 指定端口归并表（默认内置，可指向 `config/ports.yaml`） |
| `--out` | 配置文件路径，默认 `~/.config/homedash/config.yaml` |
| `--self-port` | 跳过自身占用的端口 |

## 运行形态识别

| 徽标 | 判定依据 |
|---|---|
| 🐳 Docker | 进程 cgroup 含 `docker-<64hex>.scope` / `kubepods` / `containerd`，并用 Docker API 补容器名与镜像 |
| ⚙️ systemd | cgroup 含 `*.service`（`systemctl show` 取单元描述，用户单元自动回退 `systemctl --user`） |
| 🖥️ 宿主机进程 | 其余裸进程 / 自编译二进制 / 用户级脚本，附可执行文件路径与命令行 |
| 🔗 Tailscale | 端口由 `tailscale serve` 代理，附上游目标 |
| ❓ 未知 | root 进程且无法从 `/proc` 读取时，用 nginx 配置与 systemd 单元兜底匹配 |

## 目录

```
cmd/homedash/        CLI：scan / serve
internal/scan/       采集：ports / classify / systemd / docker / proxy / rootunits / probe / noise
internal/model/      数据模型（Service / Page / Config）
internal/store/      YAML 读写、原子写与备份、manual 优先合并
config/ports.yaml    端口归并表（名称/图标/页面/隐藏）
```

## 页面模型

参考 WeTab：**一页一场景**，而不是一页里分组。`pages` 在配置里定义（默认 `首页 / 开发 / 运维 / 外部 / 自动发现`），每个服务归属一页；前端做成可左右翻页的卡片墙。

## 测试

```bash
go test ./...
```
