// Command homedash is a self-hosted dashboard that discovers the services
// running on a machine and lets the user curate them in the browser.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"sort"
	"strings"
	"syscall"
	"text/tabwriter"
	"time"

	"homedash/internal/model"
	"homedash/internal/scan"
	"homedash/internal/store"
	"homedash/internal/web"
)

// Version is set at build time.
var Version = "dev"

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "serve":
		os.Exit(cmdServe(os.Args[2:]))
	case "scan":
		os.Exit(cmdScan(os.Args[2:]))
	case "init":
		os.Exit(cmdInit(os.Args[2:]))
	case "hash-password":
		os.Exit(cmdHashPassword(os.Args[2:]))
	case "version", "--version", "-v":
		fmt.Printf("homedash %s\n", Version)
	case "help", "--help", "-h":
		usage()
	default:
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Print(`homedash - 自托管的本机服务导航盘

用法:
  homedash serve [flags]            启动 Web 面板（默认命令）
  homedash scan [flags]             扫描本机服务并写入配置
  homedash init [flags]             生成一份默认配置文件
  homedash hash-password <password>  生成 Basic Auth 用的 bcrypt 哈希
  homedash version                  打印版本号

全局环境变量:
  HOMEDASH_CONFIG   配置文件路径（默认 ~/.config/homedash/config.yaml）
`)
}

func cmdServe(args []string) int {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	cfgPath := fs.String("config", envOr("HOMEDASH_CONFIG", store.DefaultPath), "配置文件路径")
	listen := fs.String("listen", "", "监听地址，覆盖配置文件")
	_ = fs.Parse(args)

	srv, err := web.New(*cfgPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "cannot load config:", err)
		return 1
	}
	if *listen != "" {
		cfg := srv.Config()
		cfg.Server.Listen = *listen
		srv.SetServerListen(*listen)
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := srv.Run(ctx); err != nil {
		fmt.Fprintln(os.Stderr, "server stopped:", err)
		return 1
	}
	return 0
}

func cmdInit(args []string) int {
	fs := flag.NewFlagSet("init", flag.ExitOnError)
	cfgPath := fs.String("config", envOr("HOMEDASH_CONFIG", store.DefaultPath), "配置文件路径")
	force := fs.Bool("force", false, "覆盖已存在的配置文件")
	_ = fs.Parse(args)

	path := store.Expand(*cfgPath)
	if _, err := os.Stat(path); err == nil && !*force {
		fmt.Printf("配置文件已存在：%s（使用 --force 覆盖）\n", path)
		return 0
	}
	if err := store.Save(path, store.DefaultConfig()); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Printf("已写入 %s\n", path)
	return 0
}

func cmdScan(args []string) int {
	fs := flag.NewFlagSet("scan", flag.ExitOnError)
	cfgPath := fs.String("config", envOr("HOMEDASH_CONFIG", store.DefaultPath), "配置文件路径")
	probe := fs.Bool("probe", true, "执行 HTTP 健康探测")
	includeLocal := fs.Bool("include-local", false, "同时收录只监听回环地址的服务")
	portsTable := fs.String("ports-table", "", "端口归并表 YAML 路径")
	dryRun := fs.Bool("dry-run", false, "只打印结果，不写配置")
	_ = fs.Parse(args)

	cfg, err := store.Load(*cfgPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	table := *portsTable
	if table == "" {
		table = cfg.Discovery.PortsTable
	}
	res, err := scan.Scan(scan.Options{
		IncludeLocal: *includeLocal || cfg.Discovery.IncludeLocal,
		Probe:        *probe && cfg.Discovery.Probe,
		PortsTable:   table,
		HidePorts:    cfg.Discovery.HidePorts,
		Host:         cfg.Server.PreferredHost,
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, "scan failed:", err)
		return 1
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 4, 2, ' ', 0)
	fmt.Fprintln(w, "NAME\tPORT\tRUNTIME\tSTATUS\tLATENCY\tURL")
	for _, s := range res.Services {
		fmt.Fprintf(w, "%s\t%d\t%s\t%s\t%dms\t%s\n", s.Name, s.Port, s.Runtime, s.Status, s.LatencyMS, s.URL)
	}
	w.Flush()
	fmt.Printf("\n%d services discovered\n", len(res.Services))

	if *dryRun {
		return 0
	}
	store.Merge(cfg, res.Services)
	if err := store.Save(*cfgPath, cfg); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Printf("written to %s\n", store.Expand(*cfgPath))
	return 0
}

func cmdHashPassword(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "用法: homedash hash-password <password>")
		return 2
	}
	hash, err := web.HashPassword(args[0])
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Println(hash)
	return 0
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

var _ = sort.Strings
var _ = strings.TrimSpace
var _ = model.ManagedManual
var _ = time.Now
