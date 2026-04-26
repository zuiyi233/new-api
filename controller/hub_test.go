package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type hubBootstrapAPIResponse struct {
	Success bool           `json:"success"`
	Message string         `json:"message"`
	Data    map[string]any `json:"data"`
}

func setupHubBootstrapTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalRedisEnabled := common.RedisEnabled
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open sqlite db: %v", err)
	}

	model.DB = db
	model.LOG_DB = db

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	if err := db.AutoMigrate(
		&model.User{},
		&model.Token{},
		&model.OIDCToken{},
		&model.UserProductEntitlement{},
		&model.UserConcurrencyGrant{},
		&model.Ability{},
	); err != nil {
		t.Fatalf("failed to migrate hub bootstrap test db: %v", err)
	}
	return db
}

func createHubBootstrapTestUser(t *testing.T, db *gorm.DB) *model.User {
	t.Helper()
	user := &model.User{
		Username:    "hub_bootstrap_user",
		Password:    "Temp123456!",
		DisplayName: "Hub Bootstrap",
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
		Group:       "default",
	}
	if err := db.Create(user).Error; err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}
	return user
}

func createOIDCAccessTokenForUser(t *testing.T, user *model.User, clientID string) string {
	t.Helper()
	_, accessToken, _, err := model.CreateOIDCToken(&model.CreateOIDCTokenInput{
		ClientID: clientID,
		UserID:   user.Id,
		Subject:  strconv.Itoa(user.Id),
		Scope:    "openid profile email",
	})
	if err != nil {
		t.Fatalf("failed to create oidc access token: %v", err)
	}
	return accessToken
}

func callHubSessionBootstrap(t *testing.T, authorization string, requestBody map[string]any) hubBootstrapAPIResponse {
	t.Helper()

	var requestPayload []byte
	if requestBody != nil {
		payload, err := common.Marshal(requestBody)
		if err != nil {
			t.Fatalf("failed to marshal request body: %v", err)
		}
		requestPayload = payload
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/hub/session/bootstrap", bytes.NewReader(requestPayload))
	ctx.Request.Header.Set("Authorization", authorization)
	if requestBody != nil {
		ctx.Request.Header.Set("Content-Type", "application/json")
	}

	HubSessionBootstrap(ctx)
	if recorder.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d, body=%s", recorder.Code, recorder.Body.String())
	}
	response := hubBootstrapAPIResponse{}
	if err := common.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return response
}

func TestHubSessionBootstrapOIDCAndSystemAccessTokenFlow(t *testing.T) {
	db := setupHubBootstrapTestDB(t)
	user := createHubBootstrapTestUser(t, db)
	oidcAccessToken := createOIDCAccessTokenForUser(t, user, "oidc_hub_demo")

	bootstrapResponse := callHubSessionBootstrap(t, "Bearer "+oidcAccessToken, map[string]any{
		"client_id": "site-demo-001",
		"site_name": "Site Demo",
	})
	if !bootstrapResponse.Success {
		t.Fatalf("expected success response, got message: %s", bootstrapResponse.Message)
	}
	if got := fmt.Sprintf("%v", bootstrapResponse.Data["auth_source"]); got != hubAuthSourceOIDCAccessToken {
		t.Fatalf("expected auth_source=%s, got %s", hubAuthSourceOIDCAccessToken, got)
	}

	systemAccessToken, _ := bootstrapResponse.Data["system_access_token"].(string)
	if strings.TrimSpace(systemAccessToken) == "" {
		t.Fatalf("expected non-empty system access token")
	}
	if created, ok := bootstrapResponse.Data["system_access_token_created"].(bool); !ok || !created {
		t.Fatalf("expected system_access_token_created=true, got %#v", bootstrapResponse.Data["system_access_token_created"])
	}

	hubTokenAny, ok := bootstrapResponse.Data["hub_api_token"].(map[string]any)
	if !ok {
		t.Fatalf("expected hub_api_token object in response")
	}
	hubTokenKey, _ := hubTokenAny["key"].(string)
	if strings.TrimSpace(hubTokenKey) == "" {
		t.Fatalf("expected non-empty hub api token key")
	}
	if created, ok := hubTokenAny["created"].(bool); !ok || !created {
		t.Fatalf("expected hub_api_token.created=true, got %#v", hubTokenAny["created"])
	}

	modelsAny, ok := bootstrapResponse.Data["models"].([]any)
	if !ok {
		t.Fatalf("expected models array in response, got %#v", bootstrapResponse.Data["models"])
	}
	_ = modelsAny

	freshUser, err := model.GetUserById(user.Id, false)
	if err != nil {
		t.Fatalf("failed to reload user: %v", err)
	}
	if freshUser.GetAccessToken() != systemAccessToken {
		t.Fatalf("expected user access token persisted, got %q want %q", freshUser.GetAccessToken(), systemAccessToken)
	}

	secondBootstrap := callHubSessionBootstrap(t, "Bearer "+systemAccessToken, map[string]any{
		"client_id": "site-demo-001",
	})
	if !secondBootstrap.Success {
		t.Fatalf("expected second bootstrap success, got message: %s", secondBootstrap.Message)
	}
	if got := fmt.Sprintf("%v", secondBootstrap.Data["auth_source"]); got != hubAuthSourceSystemAccessToken {
		t.Fatalf("expected auth_source=%s on second bootstrap, got %s", hubAuthSourceSystemAccessToken, got)
	}
	if created, ok := secondBootstrap.Data["system_access_token_created"].(bool); !ok || created {
		t.Fatalf("expected system_access_token_created=false on second bootstrap, got %#v", secondBootstrap.Data["system_access_token_created"])
	}
	secondHubTokenAny, ok := secondBootstrap.Data["hub_api_token"].(map[string]any)
	if !ok {
		t.Fatalf("expected hub_api_token object in second response")
	}
	if created, ok := secondHubTokenAny["created"].(bool); !ok || created {
		t.Fatalf("expected hub_api_token.created=false on second bootstrap, got %#v", secondHubTokenAny["created"])
	}
	secondHubTokenKey, _ := secondHubTokenAny["key"].(string)
	if hubTokenKey != secondHubTokenKey {
		t.Fatalf("expected same hub token key reused, first=%q second=%q", hubTokenKey, secondHubTokenKey)
	}
}
