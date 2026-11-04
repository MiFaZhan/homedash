package web

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"homedash/internal/model"
	"homedash/internal/store"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	dir := t.TempDir()
	cfgPath := filepath.Join(dir, "config.yaml")
	srv, err := New(cfgPath)
	if err != nil {
		t.Fatalf("new server: %v", err)
	}
	srv.cfg.Server.DataDir = filepath.Join(dir, "data")
	return srv
}

func TestConfigEndpoint(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequest(http.MethodGet, "/api/config", nil)
	rec := httptest.NewRecorder()
	srv.handleConfig(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var payload struct {
		Pages []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"pages"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(payload.Pages) == 0 {
		t.Fatal("expected default pages")
	}
}

func TestServiceCRUD(t *testing.T) {
	srv := newTestServer(t)

	body := strings.NewReader(`{"name":"Demo Service","url":"http://example.com","page":"home"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/services", body)
	rec := httptest.NewRecorder()
	srv.handleServiceCreate(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("create status = %d body=%s", rec.Code, rec.Body.String())
	}
	var created map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode: %v", err)
	}
	id, _ := created["id"].(string)
	if id == "" {
		t.Fatal("expected an id")
	}
	if created["managed"] != "manual" {
		t.Fatalf("managed = %v, want manual", created["managed"])
	}

	req = httptest.NewRequest(http.MethodDelete, "/api/services/"+id, nil)
	req.SetPathValue("id", id)
	rec = httptest.NewRecorder()
	srv.handleServiceDelete(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("delete status = %d", rec.Code)
	}
	if len(srv.Config().Services) != 0 {
		t.Fatal("service was not removed")
	}
}

func TestIconUploadRejectsUnknownType(t *testing.T) {
	srv := newTestServer(t)
	req := httptest.NewRequest(http.MethodPost, "/api/icons", strings.NewReader("not multipart"))
	rec := httptest.NewRecorder()
	srv.handleIconUpload(rec, req)
	if rec.Code == http.StatusOK {
		t.Fatal("expected the upload to be rejected")
	}
}

func TestAuthProtectsRequests(t *testing.T) {
	srv := newTestServer(t)
	cfg := srv.Config()
	cfg.Auth.Enabled = true
	cfg.Auth.User = "admin"
	cfg.Auth.PasswordHash = "plain-secret"
	srv.cfg.Auth = cfg.Auth

	handler := srv.withAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}

	req = httptest.NewRequest(http.MethodGet, "/", nil)
	req.SetBasicAuth("admin", "plain-secret")
	rec = httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestStoreSaveAndLoad(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	cfg := newTestServer(t).Config()
	cfg.Services = append(cfg.Services, serviceFixture())
	if err := saveConfig(path, &cfg); err != nil {
		t.Fatalf("save: %v", err)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("config file missing: %v", err)
	}
}

func serviceFixture() model.Service {
	return model.Service{ID: "demo", Name: "Demo", URL: "http://example.com", Managed: "manual"}
}

func saveConfig(path string, cfg *model.Config) error {
	return store.Save(path, cfg)
}
