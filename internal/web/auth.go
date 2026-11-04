package web

import (
	"crypto/subtle"
	"net/http"
	"os"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

// withAuth protects the dashboard with HTTP Basic Auth when it is enabled.
// Passwords are stored as a bcrypt hash; a plain value is accepted for
// convenience but reported as insecure in the logs.
func (s *Server) withAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cfg := s.Config()
		if !cfg.Auth.Enabled {
			next.ServeHTTP(w, r)
			return
		}
		user, pass, ok := r.BasicAuth()
		if !ok {
			unauthorized(w)
			return
		}
		if subtle.ConstantTimeCompare([]byte(user), []byte(cfg.Auth.User)) != 1 {
			unauthorized(w)
			return
		}
		if !passwordMatches(cfg.Auth.PasswordHash, pass) {
			unauthorized(w)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func passwordMatches(hash, plain string) bool {
	if hash == "" {
		return false
	}
	if strings.HasPrefix(hash, "$2") {
		return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
	}
	// plain text fallback (documented as insecure)
	return subtle.ConstantTimeCompare([]byte(hash), []byte(plain)) == 1
}

// HashPassword produces a bcrypt hash suitable for the configuration file.
func HashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func unauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", `Basic realm="homedash", charset="UTF-8"`)
	http.Error(w, "unauthorized", http.StatusUnauthorized)
}

var _ = os.Getenv
