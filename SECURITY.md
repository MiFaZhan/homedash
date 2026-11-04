# 安全策略

## 支持版本

| 版本 | 受支持 |
|---|---|
| latest | ✅ |
| < latest | ❌ |

## 报告漏洞

请勿公开提交 issue。用 GitHub 的 Security Advisory 私下报告，或邮件联系维护者。

## 部署建议

- homedash 默认只监听 `127.0.0.1`，对外请用 Tailscale / 反向代理 / 隧道；
- 公网暴露时**必须**开启 `auth.enabled`；
- `config.yaml` 与图标目录权限建议 600 / 700；
- 扫描器只做只读操作（读 `/proc`、发 GET/HEAD 探测），不修改任何被扫描的服务。
