package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
)

func performOIDCAdminRequest(t *testing.T, router *gin.Engine, request *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, request)
	return recorder
}

func TestOIDCAdminTokenAuthAllowsAdminSession(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := cookie.NewStore([]byte("oidc-admin-session-secret"))

	router := gin.New()
	router.Use(sessions.Sessions("oidc_test_session", store))
	router.GET("/seed-session", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("id", 1001)
		session.Set("role", common.RoleRootUser)
		session.Set("status", common.UserStatusEnabled)
		session.Set("username", "root")
		_ = session.Save()
		c.JSON(http.StatusOK, gin.H{"success": true})
	})
	router.GET("/oidc", OIDCAdminTokenAuth(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"user_id": c.GetInt("oidc_admin_user_id"),
		})
	})

	seedRecorder := performOIDCAdminRequest(t, router, httptest.NewRequest(http.MethodGet, "/seed-session", nil))
	if seedRecorder.Code != http.StatusOK {
		t.Fatalf("seed session failed, status=%d body=%s", seedRecorder.Code, seedRecorder.Body.String())
	}

	request := httptest.NewRequest(http.MethodGet, "/oidc", nil)
	for _, cookieValue := range seedRecorder.Result().Cookies() {
		request.AddCookie(cookieValue)
	}
	recorder := performOIDCAdminRequest(t, router, request)
	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d body=%s", recorder.Code, recorder.Body.String())
	}

	var response struct {
		Success bool `json:"success"`
		UserID  int  `json:"user_id"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !response.Success {
		t.Fatalf("expected success=true, got false")
	}
	if response.UserID != 1001 {
		t.Fatalf("expected user_id=1001, got %d", response.UserID)
	}
}

func TestOIDCAdminTokenAuthRejectsMissingCredential(t *testing.T) {
	gin.SetMode(gin.TestMode)
	store := cookie.NewStore([]byte("oidc-admin-session-secret"))

	router := gin.New()
	router.Use(sessions.Sessions("oidc_test_session", store))
	router.GET("/oidc", OIDCAdminTokenAuth(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	recorder := performOIDCAdminRequest(t, router, httptest.NewRequest(http.MethodGet, "/oidc", nil))
	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d body=%s", recorder.Code, recorder.Body.String())
	}
}
