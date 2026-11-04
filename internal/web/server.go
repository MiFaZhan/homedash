// Package web serves the dashboard UI and its JSON API.
package web

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
	"unicode"

	"homedash/internal/model"
	"homedash/internal/scan"
	"homedash/internal/store"
)

//go:embed assets
var assets embed.FS

// Server owns the configuration, the scanner and the HTTP routes.
type Server struct {
	cfgPath string
	mu      sync.RWMutex
	cfg     *model.Config
	log     *log.Logger
}

// New loads the configuration and prepares a server.
func New(cfgPath string) (*Server, error) {
	cfg, err := store.Load(cfgPath)
	if err != nil {
		return nil, err
	}
	return &Server{cfgPath: cfgPath, cfg: cfg, log: log.Default()}, nil
}

// Config returns a copy of the current configuration.
func (s *Server) Config() model.Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return *s.cfg
}

// Run starts the background scanner and the HTTP listener.
func (s *Server) Run(ctx context.Context) error {
	interval := 60 * time.Second
	if d, err := time.ParseDuration(s.Config().Server.ScanInterval); err == nil && d > 0 {
		interval = d
	}
	go s.scanLoop(ctx, interval)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/config", s.handleConfig)
	mux.HandleFunc("POST /api/scan", s.handleScan)
	mux.HandleFunc("POST /api/services", s.handleServiceCreate)
	mux.HandleFunc("PUT /api/services/{id}", s.handleServiceUpdate)
	mux.HandleFunc("DELETE /api/services/{id}", s.handleServiceDelete)
	mux.HandleFunc("POST /api/services/reorder", s.handleReorder)
	mux.HandleFunc("POST /api/pages", s.handlePageUpsert)
	mux.HandleFunc("DELETE /api/pages/{id}", s.handlePageDelete)
	mux.HandleFunc("POST /api/icons", s.handleIconUpload)
	mux.HandleFunc("POST /api/settings", s.handleSettings)
	mux.HandleFunc("POST /api/wallpapers", s.handleWallpaperUpload)
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /assets/", s.handleAssets)
	mux.HandleFunc("GET /icons/{name}", s.handleIcons)
	mux.HandleFunc("GET /wallpapers/{name}", s.handleWallpaper)
	mux.HandleFunc("GET /", s.handleIndex)

	handler := s.withAuth(mux)
	srv := &http.Server{
		Addr:              s.Config().Server.Listen,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
	}
	s.log.Printf("homedash listening on %s", srv.Addr)
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdown)
	}()
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) scanLoop(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err := s.Scan(); err != nil {
				s.log.Printf("scan failed: %v", err)
			}
		}
	}
}

// ScanResult summarises one discovery run.
type ScanResult struct {
	Added   []string `json:"added"`
	Removed []string `json:"removed"`
	Updated []string `json:"updated"`
	Total   int      `json:"total"`
}

// Scan performs a discovery run, merges it into the configuration and saves it.
func (s *Server) Scan() (ScanResult, error) {
	cfg := s.Config()
	portsTable := firstNonEmpty(cfg.Discovery.PortsTable,
		filepath.Join(store.Expand(cfg.Server.DataDir), "ports.yaml"))
	res, err := scan.Scan(scan.Options{
		IncludeLocal: cfg.Discovery.IncludeLocal,
		Probe:        cfg.Discovery.Probe,
		PortsTable:   portsTable,
		HidePorts:    cfg.Discovery.HidePorts,
		Host:         cfg.Server.PreferredHost,
	})
	if err != nil {
		return ScanResult{}, err
	}
	before := map[string]bool{}
	for _, svc := range cfg.Services {
		before[svc.ID] = true
	}
	after := map[string]bool{}
	for _, svc := range res.Services {
		after[svc.ID] = true
	}

	out := ScanResult{Total: len(res.Services)}
	s.mu.Lock()
	store.Merge(s.cfg, res.Services)
	// drop discovered entries whose service disappeared
	kept := s.cfg.Services[:0]
	for _, svc := range s.cfg.Services {
		if svc.Managed == model.ManagedDiscovered && !after[svc.ID] {
			out.Removed = append(out.Removed, svc.ID)
			continue
		}
		kept = append(kept, svc)
	}
	s.cfg.Services = kept
	s.mu.Unlock()

	for id := range after {
		if !before[id] {
			out.Added = append(out.Added, id)
		}
	}
	for id := range before {
		if !after[id] {
			if _, still := findService(s.Config().Services, id); still {
				out.Updated = append(out.Updated, id)
			}
		}
	}
	if err := s.save(); err != nil {
		return out, err
	}
	return out, nil
}

func findService(list []model.Service, id string) (model.Service, bool) {
	for _, s := range list {
		if s.ID == id {
			return s, true
		}
	}
	return model.Service{}, false
}

func (s *Server) save() error {
	s.mu.RLock()
	cfg := s.cfg
	s.mu.RUnlock()
	return store.Save(s.cfgPath, cfg)
}

func (s *Server) handleConfig(w http.ResponseWriter, r *http.Request) {
	cfg := s.Config()
	writeJSON(w, http.StatusOK, map[string]any{
		"pages":      cfg.Pages,
		"services":   cfg.Services,
		"server":     cfg.Server,
		"appearance": cfg.Appearance,
		"auth":       map[string]bool{"enabled": cfg.Auth.Enabled},
	})
}

func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	res, err := s.Scan()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (s *Server) handleServiceCreate(w http.ResponseWriter, r *http.Request) {
	svc, err := decodeService(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	s.mu.Lock()
	store.Upsert(s.cfg, svc)
	stored, _ := findService(s.cfg.Services, svc.ID)
	s.mu.Unlock()
	if err := s.save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, stored)
}

func (s *Server) handleServiceUpdate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	svc, err := decodeService(r)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	svc.ID = id
	s.mu.Lock()
	store.Upsert(s.cfg, svc)
	stored, _ := findService(s.cfg.Services, svc.ID)
	s.mu.Unlock()
	if err := s.save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, stored)
}

func (s *Server) handleServiceDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.mu.Lock()
	removed := store.Remove(s.cfg, id)
	s.mu.Unlock()
	if !removed {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
		return
	}
	if err := s.save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"removed": true})
}

type reorderRequest struct {
	Page string   `json:"page"`
	IDs  []string `json:"ids"`
}

func (s *Server) handleReorder(w http.ResponseWriter, r *http.Request) {
	var req reorderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	s.mu.Lock()
	for i, id := range req.IDs {
		if idx, svc := findIndex(s.cfg.Services, id); idx >= 0 {
			s.cfg.Services[idx].Order = (i + 1) * 10
			s.cfg.Services[idx].Page = req.Page
			_ = svc
		}
	}
	s.mu.Unlock()
	if err := s.save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func findIndex(list []model.Service, id string) (int, *model.Service) {
	for i := range list {
		if list[i].ID == id {
			return i, &list[i]
		}
	}
	return -1, nil
}

func (s *Server) handlePageUpsert(w http.ResponseWriter, r *http.Request) {
	var page model.Page
	if err := json.NewDecoder(r.Body).Decode(&page); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if page.ID == "" {
		page.ID = slug(page.Name)
	}
	s.mu.Lock()
	found := false
	for i := range s.cfg.Pages {
		if s.cfg.Pages[i].ID == page.ID {
			s.cfg.Pages[i] = page
			found = true
		}
	}
	if !found {
		s.cfg.Pages = append(s.cfg.Pages, page)
	}
	s.mu.Unlock()
	if err := s.save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (s *Server) handlePageDelete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.mu.Lock()
	pages := s.cfg.Pages[:0]
	for _, p := range s.cfg.Pages {
		if p.ID != id {
			pages = append(pages, p)
		}
	}
	s.cfg.Pages = pages
	for i := range s.cfg.Services {
		if s.cfg.Services[i].Page == id {
			s.cfg.Services[i].Page = "auto"
		}
	}
	s.mu.Unlock()
	if err := s.save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"removed": true})
}

func (s *Server) handleIconUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(8 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if ext != ".png" && ext != ".svg" && ext != ".ico" && ext != ".jpg" && ext != ".jpeg" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported icon type"})
		return
	}
	data, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	dir := filepath.Join(store.Expand(s.Config().Server.DataDir), "icons")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	name := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": "/icons/" + name})
}

type settingsRequest struct {
	Wallpaper     *string  `json:"wallpaper"`
	WallpaperBlur *int     `json:"wallpaper_blur"`
	WallpaperDim  *float64 `json:"wallpaper_dim"`
	ShowLabels    *bool    `json:"show_labels"`
	TileSize      *string  `json:"tile_size"`
	DesktopMode   *bool    `json:"desktop_mode"`
	FreeLayout    *bool    `json:"free_layout"`
}

func (s *Server) handleSettings(w http.ResponseWriter, r *http.Request) {
	var req settingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	s.mu.Lock()
	ap := &s.cfg.Appearance
	if req.Wallpaper != nil {
		ap.Wallpaper = *req.Wallpaper
	}
	if req.WallpaperBlur != nil {
		ap.WallpaperBlur = *req.WallpaperBlur
	}
	if req.WallpaperDim != nil {
		ap.WallpaperDim = *req.WallpaperDim
	}
	if req.ShowLabels != nil {
		ap.ShowLabels = *req.ShowLabels
	}
	if req.TileSize != nil {
		ap.TileSize = *req.TileSize
	}
	if req.DesktopMode != nil {
		ap.DesktopMode = *req.DesktopMode
	}
	if req.FreeLayout != nil {
		ap.FreeLayout = *req.FreeLayout
	}
	result := *ap
	s.mu.Unlock()
	if err := s.save(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleWallpaperUpload(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	defer file.Close()
	ext := strings.ToLower(filepath.Ext(header.Filename))
	switch ext {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg":
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported wallpaper type"})
		return
	}
	data, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	dir := filepath.Join(store.Expand(s.Config().Server.DataDir), "wallpapers")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	name := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"url": "/wallpapers/" + name})
}

func (s *Server) handleWallpaper(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, "..") {
		http.NotFound(w, r)
		return
	}
	dir := filepath.Join(store.Expand(s.Config().Server.DataDir), "wallpapers")
	data, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	http.ServeContent(w, r, name, time.Time{}, strings.NewReader(string(data)))
}

func (s *Server) handleIcons(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, "..") {
		http.NotFound(w, r)
		return
	}
	dir := filepath.Join(store.Expand(s.Config().Server.DataDir), "icons")
	data, err := os.ReadFile(filepath.Join(dir, name))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	http.ServeContent(w, r, name, time.Time{}, strings.NewReader(string(data)))
}

func (s *Server) handleAssets(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/assets/")
	if name == "" {
		http.NotFound(w, r)
		return
	}
	data, err := fs.ReadFile(assets, "assets/"+name)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	switch {
	case strings.HasSuffix(name, ".html"):
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	case strings.HasSuffix(name, ".css"):
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
	case strings.HasSuffix(name, ".js"):
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	}
	w.Write(data)
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	data, err := fs.ReadFile(assets, "assets/index.html")
	if err != nil {
		http.Error(w, "assets missing", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(data)
}

func decodeService(r *http.Request) (model.Service, error) {
	var svc model.Service
	if err := json.NewDecoder(r.Body).Decode(&svc); err != nil {
		return svc, err
	}
	if svc.Name == "" {
		return svc, fmt.Errorf("name is required")
	}
	if svc.URL == "" {
		return svc, fmt.Errorf("url is required")
	}
	if svc.ID == "" {
		svc.ID = slug(svc.Name)
	}
	if svc.Page == "" {
		svc.Page = "home"
	}
	return svc, nil
}

// slug builds a URL friendly identifier. Unicode letters are kept so that
// Chinese service names remain readable in the configuration file.
func slug(s string) string {
	s = strings.TrimSpace(s)
	var b strings.Builder
	for _, r := range s {
		switch {
		case unicode.IsLetter(r) || unicode.IsDigit(r):
			b.WriteRune(unicode.ToLower(r))
		case r == ' ' || r == '-' || r == '_' || r == '.':
			b.WriteByte('-')
		}
	}
	out := strings.Trim(b.String(), "-")
	for strings.Contains(out, "--") {
		out = strings.ReplaceAll(out, "--", "-")
	}
	if out == "" {
		out = "item"
	}
	return out
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

// SetServerListen overrides the listen address of the server.
func (s *Server) SetServerListen(addr string) {
	s.mu.Lock()
	s.cfg.Server.Listen = addr
	s.mu.Unlock()
}
