BINARY := homedash
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS := -s -w -X main.Version=$(VERSION)

.PHONY: build test lint fmt run clean docker

build:
	go build -trimpath -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/homedash

test:
	go test ./...

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
