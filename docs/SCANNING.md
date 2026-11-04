# 扫描原理

## 1. 端口

解析 `/proc/net/tcp` 与 `/proc/net/tcp6`，取 `st == 0A`（LISTEN）的行。

- 地址是主机字节序的小端十六进制；IPv6 由 4 个 32 位字组成，每个字内部小端；
- 端口是十六进制（`0x1F90` = 8080），这是最容易踩的坑；
- 同一端口可能有多个绑定（IPv4/IPv6、通配符），按"可达地址 > IPv4 > 有属主"择优保留一条。

## 2. 属主进程

用 socket inode 反查 `/proc/<pid>/fd` 中的 `socket:[inode]` 链接。非 root 运行时，
其它用户的进程读不到 fd，这些端口会归属为 `unknown`。

## 3. 运行形态

| 形态 | 判据 |
|---|---|
| Docker | `/proc/<pid>/cgroup` 含 `docker-<64hex>.scope`、`/docker/`、`/kubepods/` |
| systemd | cgroup 含 `*.service`（用户单元用 `systemctl --user show` 取描述） |
| 宿主机进程 | 其余情况，附带 exe 路径与命令行 |
| Tailscale | 端口出现在 `tailscale serve status` 中 |

有 Docker socket 时，会再查 Docker API 补上容器名与镜像。

## 4. 噪声治理

- 默认不收录只监听回环地址的服务（`discovery.include_local` 可打开）；
- 反代端口（nginx `proxy_pass` / caddy `reverse_proxy`）不单独成条；
- 端口归并表把端口翻译成服务名，`hidden: true` 的条目被丢弃；
- 40000 以上且未登记的端口视为临时端口，丢弃；
- `discovery.hide_ports` 里列出的端口永远不显示。

## 5. 健康探测

对每个服务发一次 GET（超时 4 秒，跳过重定向），记录状态码与延迟；
5xx 记为 offline，其余视为 online。
