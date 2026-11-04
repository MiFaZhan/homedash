# 对外暴露

homedash 默认监听 `127.0.0.1:3010`，自身不做 TLS 与账号体系，请用下面的方式之一发布。

## Tailscale（推荐）

```bash
tailscale serve --bg --https=443 http://127.0.0.1:3010
```

- 证书自动签发，无需域名；
- 访问控制用 tailnet ACL（可以只允许特定设备访问）；
- 不要使用 `tailscale funnel`，那会把服务暴露到公网。

## Cloudflare Tunnel

```bash
cloudflared tunnel run --url http://127.0.0.1:3010
```

适合没有公网 IP 的机器。公网可达时建议配合 Cloudflare Access 做身份认证。

## nginx / Caddy 反代

```nginx
location / {
    proxy_pass http://127.0.0.1:3010;
    proxy_set_header Host $host;
}
```

## 认证

```bash
homedash hash-password 'your-password'
```

把结果写进 `config.yaml` 的 `auth.password_hash`，并设置 `auth.enabled: true`。

**公网暴露必须开认证。**
