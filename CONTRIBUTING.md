# 贡献指南

感谢参与 homedash。

## 开发

```bash
git clone https://github.com/mifazhan/homedash && cd homedash
make test    # go test ./...
make build
make run
```

约定：

- **前端没有构建步骤**：原生 JS/CSS，放在 `internal/web/assets/`，改完 `make build` 即可；
- **提交前跑** `gofmt -l ./cmd ./internal`（应无输出）、`go vet ./...`、`go test ./...`；
- 提交信息用英文祈使句：`add docker runtime badge`、`fix ipv6 port parsing`。

## 提交规则

- 一个 PR 一件事；较大的改动先开 issue 讨论；
- 新增行为请补测试（`internal/scan` 里已有端口解析与运行形态判定的样例）；
- 涉及扫描逻辑时，注意兼容非 root 运行：读不到 `/proc/<pid>/fd` 时必须优雅降级，而不是报错。

## 路线图

见 [README](README.md#特性) 与 issue 列表。新特性请先开 issue 讨论，避免重复劳动。

## 许可证

贡献即表示同意你的代码以 MIT 许可证发布。
