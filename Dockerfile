# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath \
      -ldflags "-s -w -X main.Version=${VERSION}" \
      -o /out/homedash ./cmd/homedash

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
