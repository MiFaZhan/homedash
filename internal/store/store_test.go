package store

import (
	"path/filepath"
	"testing"

	"homedash/internal/model"
)

func TestMergeKeepsManualFields(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Services = []model.Service{{
		ID:          "demo",
		Name:        "我改过的名字",
		Description: "我的描述",
		Icon:        "🧪",
		Page:        "home",
		Managed:     model.ManagedManual,
	}}
	discovered := []model.Service{{
		ID:        "demo",
		Name:      "scanner name",
		Icon:      "scanner-icon",
		Page:      "auto",
		Runtime:   model.RuntimeProcess,
		Status:    model.StatusOnline,
		LatencyMS: 12,
	}}
	Merge(cfg, discovered)

	svc := cfg.Services[0]
	if svc.Name != "我改过的名字" {
		t.Fatalf("name = %q, manual field was overwritten", svc.Name)
	}
	if svc.Icon != "🧪" {
		t.Fatalf("icon = %q, manual field was overwritten", svc.Icon)
	}
	if svc.Status != model.StatusOnline {
		t.Fatalf("status = %q, volatile field was not refreshed", svc.Status)
	}
	if svc.LatencyMS != 12 {
		t.Fatalf("latency = %d, volatile field was not refreshed", svc.LatencyMS)
	}
}

func TestMergeAddsNewServices(t *testing.T) {
	cfg := DefaultConfig()
	Merge(cfg, []model.Service{{ID: "new", Name: "New"}})
	if len(cfg.Services) != 1 {
		t.Fatalf("expected 1 service, got %d", len(cfg.Services))
	}
	if cfg.Services[0].Page != "auto" {
		t.Fatalf("page = %q, want auto", cfg.Services[0].Page)
	}
}

func TestSaveLoadRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	cfg := DefaultConfig()
	cfg.Services = append(cfg.Services, model.Service{ID: "x", Name: "X", URL: "http://x"})
	if err := Save(path, cfg); err != nil {
		t.Fatalf("save: %v", err)
	}
	loaded, err := Load(path)
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if len(loaded.Services) != 1 || loaded.Services[0].Name != "X" {
		t.Fatalf("unexpected round trip result: %+v", loaded.Services)
	}
}
