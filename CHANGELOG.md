# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added
- 自动发现本机监听端口，并反查属主进程
- 运行形态识别：Docker / systemd / 宿主机进程 / Tailscale serve
- HTTP 健康探测，卡片显示 online/offline 与延迟
- 多页模型（WeTab 式翻页），页面可自建
- Web 编辑：增删改服务、图标上传、拖拽排序、换页
- 可选 HTTP Basic Auth（bcrypt）
- 端口归并表（内置 + 用户自定义 YAML）
- HTTP API、Dockerfile、docker-compose、GitHub Actions、goreleaser
