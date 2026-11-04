# 架构

```
┌───────────────┐        ┌──────────────────────────────┐
│ 浏览器          │  HTTP  │ homedash (单二进制)            │
│ 卡片墙 / 编辑   │◀──────▶│  web.Server  ── JSON API     │
└───────────────┘        │  store     ── config.yaml     │
                         │  scan      ── 发现器           │
                         └──────────────┬───────────────┘
                                        │ 只读
                    /proc/net/tcp{,6} · /proc/<pid>/* · systemctl · docker API · tailscale
```

## 模块

| 包 | 职责 |
|---|---|
| `internal/model` | 配置结构：Server / Discovery / Auth / Page / Service |
| `internal/store` | YAML 读写、原子写 + 备份、manual 优先合并 |
| `internal/scan` | 发现器：ports / classify / systemd / docker / proxy / rootunits / probe / noise |
| `internal/web` | HTTP 服务、JSON API、Basic Auth、静态资源（`embed`） |

## 关键设计

**配置即真相**：`config.yaml` 是唯一数据源。扫描结果只刷新 `managed: discovered` 条目的
`status / latency / last_seen / runtime`；用户手工创建的条目（`managed: manual`）的
`name / description / icon / page / order` 永不被覆盖。

**写盘安全**：临时文件 + `rename` 原子替换，写前保留时间戳备份，配置权限 0600。

**优雅降级**：无权读取 `/proc/<pid>/fd` 的进程（root 服务）先尝试用 nginx 配置、
systemd 单元与 `tailscale serve status` 反查归属，仍无法判定时归为 `unknown`，
不影响其余条目的采集。

**扫描器无副作用**：只读 `/proc`、只发 GET 探测，不改动被扫描的任何服务。
