BINARY := homedash
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.Version=$(VERSION)

.PHONY: all build web dev test lint fmt run docker clean

all: web build

# 构建前端（产物写入 internal/web/dist，由 Go embed 打包）
web:
	cd web && npm ci --no-audit --no-fund && npm run build

build:
	go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/homedash

dev: ## 并行启动 Go 后端与 Vite 开发服务器
	@echo "backend: http://127.0.0.1:3010   frontend: http://127.0.0.1:5173"
	@(go run ./cmd/homedash serve &) ; cd web && npm run dev

test: build
	go test ./...
	cd web && npm run typecheck

lint:
	go vet ./...

fmt:
	gofmt -l -w ./cmd ./internal

run: build
	./$(BINARY) serve

docker:
	docker build -t $(BINARY):$(VERSION) .

clean:
	rm -f $(BINARY)
