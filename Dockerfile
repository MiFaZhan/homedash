# syntax=docker/dockerfile:1

# 1) 前端：React + Vite 构建，产物交给 Go embed
FROM node:22-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# 2) 后端：静态编译
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web /src/internal/web/dist ./internal/web/dist
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags "-s -w -X main.Version=${VERSION}" \
      -o /out/homedash ./cmd/homedash

# 3) 运行
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -u 1000 homedash
COPY --from=build /out/homedash /usr/local/bin/homedash
USER homedash
ENV HOMEDASH_CONFIG=/config/config.yaml
VOLUME ["/config", "/data"]
EXPOSE 3010
ENTRYPOINT ["/usr/local/bin/homedash"]
CMD ["serve", "--listen", "0.0.0.0:3010"]
