package model

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupOIDCClientModelTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	originalDB := DB
	originalLogDB := LOG_DB
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
	DB = db
	LOG_DB = db

	t.Cleanup(func() {
		DB = originalDB
		LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.RedisEnabled = originalRedisEnabled
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	if err = db.AutoMigrate(&OIDCClient{}, &OIDCAuthorizationCode{}, &OIDCToken{}); err != nil {
		t.Fatalf("failed to migrate oidc provider models: %v", err)
	}
	return db
}

func TestRotateOIDCClientSecret(t *testing.T) {
	setupOIDCClientModelTestDB(t)

	enabled := true
	client, originalSecret, err := CreateOIDCClient(&CreateOIDCClientInput{
		Name:         "hub-site-demo",
		RedirectURIs: []string{"https://example.com/oauth/callback"},
		Scopes:       []string{"openid", "profile", "email"},
		ClientType:   "confidential",
		Enabled:      &enabled,
	})
	if err != nil {
		t.Fatalf("failed to create oidc client: %v", err)
	}
	if strings.TrimSpace(originalSecret) == "" {
		t.Fatalf("expected non-empty original secret")
	}
	originalHash := client.ClientSecretHash

	rotatedClient, rotatedSecret, err := RotateOIDCClientSecret(client.ClientID)
	if err != nil {
		t.Fatalf("failed to rotate client secret: %v", err)
	}
	if strings.TrimSpace(rotatedSecret) == "" {
		t.Fatalf("expected non-empty rotated secret")
	}
	if rotatedSecret == originalSecret {
		t.Fatalf("expected rotated secret different from original")
	}
	if rotatedClient.ClientSecretHash == originalHash {
		t.Fatalf("expected rotated hash changed")
	}

	if _, err = ValidateOIDCClientSecret(client.ClientID, rotatedSecret); err != nil {
		t.Fatalf("rotated secret should be valid, got error: %v", err)
	}
	if _, err = ValidateOIDCClientSecret(client.ClientID, originalSecret); err == nil {
		t.Fatalf("original secret should be invalid after rotation")
	}
}

func TestOIDCRevokeAccessToken(t *testing.T) {
	setupOIDCClientModelTestDB(t)

	created, accessToken, _, err := CreateOIDCToken(&CreateOIDCTokenInput{
		ClientID: "client-access-revoke",
		UserID:   1001,
		Subject:  "user-1001",
		Scope:    "openid profile",
	})
	if err != nil {
		t.Fatalf("failed to create oidc token: %v", err)
	}
	if err = RevokeOIDCToken(accessToken, "access_token"); err != nil {
		t.Fatalf("failed to revoke access token: %v", err)
	}
	if _, err = GetOIDCTokenByAccessToken(accessToken); err == nil {
		t.Fatalf("expected revoked access token to be unusable")
	}

	var record OIDCToken
	if err = DB.Where("id = ?", created.Id).First(&record).Error; err != nil {
		t.Fatalf("failed to query revoked token record: %v", err)
	}
	if record.RevokedAt == nil {
		t.Fatalf("expected revoked_at to be set after access revoke")
	}
}

func TestOIDCRevokeRefreshToken(t *testing.T) {
	setupOIDCClientModelTestDB(t)

	created, _, refreshToken, err := CreateOIDCToken(&CreateOIDCTokenInput{
		ClientID: "client-refresh-revoke",
		UserID:   1002,
		Subject:  "user-1002",
		Scope:    "openid email",
	})
	if err != nil {
		t.Fatalf("failed to create oidc token: %v", err)
	}
	if err = RevokeOIDCToken(refreshToken, "refresh_token"); err != nil {
		t.Fatalf("failed to revoke refresh token: %v", err)
	}
	if _, err = GetOIDCTokenByRefreshToken(refreshToken); err == nil {
		t.Fatalf("expected revoked refresh token to be unusable")
	}

	var record OIDCToken
	if err = DB.Where("id = ?", created.Id).First(&record).Error; err != nil {
		t.Fatalf("failed to query revoked token record: %v", err)
	}
	if record.RevokedAt == nil {
		t.Fatalf("expected revoked_at to be set after refresh revoke")
	}
}

func TestOIDCCleanupExpiredData(t *testing.T) {
	setupOIDCClientModelTestDB(t)

	now := time.Now()
	consumedAt := now.Add(-2 * time.Minute)
	validCodeExpiresAt := now.Add(15 * time.Minute)

	staleCode := &OIDCAuthorizationCode{
		CodeHash:    hashOIDCValue("cleanup-expired-code"),
		ClientID:    "cleanup-client",
		UserID:      2001,
		RedirectURI: "https://example.com/callback",
		Scope:       "openid",
		ExpiresAt:   now.Add(-5 * time.Minute),
	}
	consumedCode := &OIDCAuthorizationCode{
		CodeHash:    hashOIDCValue("cleanup-consumed-code"),
		ClientID:    "cleanup-client",
		UserID:      2002,
		RedirectURI: "https://example.com/callback",
		Scope:       "openid",
		ExpiresAt:   now.Add(10 * time.Minute),
		ConsumedAt:  &consumedAt,
	}
	validCode := &OIDCAuthorizationCode{
		CodeHash:    hashOIDCValue("cleanup-valid-code"),
		ClientID:    "cleanup-client",
		UserID:      2003,
		RedirectURI: "https://example.com/callback",
		Scope:       "openid",
		ExpiresAt:   validCodeExpiresAt,
	}
	if err := DB.Create(staleCode).Error; err != nil {
		t.Fatalf("failed to seed stale code: %v", err)
	}
	if err := DB.Create(consumedCode).Error; err != nil {
		t.Fatalf("failed to seed consumed code: %v", err)
	}
	if err := DB.Create(validCode).Error; err != nil {
		t.Fatalf("failed to seed valid code: %v", err)
	}

	expiredRefresh := now.Add(-1 * time.Minute)
	revokedAt := now.Add(-3 * time.Minute)
	validRefresh := now.Add(20 * time.Minute)
	if err := DB.Create(&OIDCToken{
		ClientID:              "cleanup-client",
		UserID:                3001,
		Subject:               "cleanup-user-1",
		Scope:                 "openid",
		AccessTokenHash:       hashOIDCValue("cleanup-token-revoked-at"),
		RefreshTokenHash:      hashOIDCValue("cleanup-refresh-revoked-at"),
		AccessTokenExpiresAt:  now.Add(25 * time.Minute),
		RefreshTokenExpiresAt: &validRefresh,
		RevokedAt:             &revokedAt,
	}).Error; err != nil {
		t.Fatalf("failed to seed revoked token: %v", err)
	}
	if err := DB.Create(&OIDCToken{
		ClientID:              "cleanup-client",
		UserID:                3002,
		Subject:               "cleanup-user-2",
		Scope:                 "openid",
		AccessTokenHash:       hashOIDCValue("cleanup-token-expired-access"),
		RefreshTokenHash:      hashOIDCValue("cleanup-refresh-expired-access"),
		AccessTokenExpiresAt:  now.Add(-10 * time.Minute),
		RefreshTokenExpiresAt: &validRefresh,
	}).Error; err != nil {
		t.Fatalf("failed to seed access-expired token: %v", err)
	}
	if err := DB.Create(&OIDCToken{
		ClientID:              "cleanup-client",
		UserID:                3003,
		Subject:               "cleanup-user-3",
		Scope:                 "openid",
		AccessTokenHash:       hashOIDCValue("cleanup-token-expired-refresh"),
		RefreshTokenHash:      hashOIDCValue("cleanup-refresh-expired-refresh"),
		AccessTokenExpiresAt:  now.Add(25 * time.Minute),
		RefreshTokenExpiresAt: &expiredRefresh,
	}).Error; err != nil {
		t.Fatalf("failed to seed refresh-expired token: %v", err)
	}
	if err := DB.Create(&OIDCToken{
		ClientID:              "cleanup-client",
		UserID:                3004,
		Subject:               "cleanup-user-4",
		Scope:                 "openid",
		AccessTokenHash:       hashOIDCValue("cleanup-token-valid"),
		RefreshTokenHash:      hashOIDCValue("cleanup-refresh-valid"),
		AccessTokenExpiresAt:  now.Add(25 * time.Minute),
		RefreshTokenExpiresAt: &validRefresh,
	}).Error; err != nil {
		t.Fatalf("failed to seed valid token: %v", err)
	}

	cleanupResult, err := CleanupExpiredOIDCProviderData(now)
	if err != nil {
		t.Fatalf("cleanup failed: %v", err)
	}
	if cleanupResult.DeletedAuthorizationCodes != 2 {
		t.Fatalf("expected 2 authorization codes deleted, got %d", cleanupResult.DeletedAuthorizationCodes)
	}
	if cleanupResult.DeletedTokens != 3 {
		t.Fatalf("expected 3 tokens deleted, got %d", cleanupResult.DeletedTokens)
	}

	var remainingCodes []OIDCAuthorizationCode
	if err = DB.Find(&remainingCodes).Error; err != nil {
		t.Fatalf("failed to query remaining codes: %v", err)
	}
	if len(remainingCodes) != 1 {
		t.Fatalf("expected exactly 1 valid authorization code remaining, got %d", len(remainingCodes))
	}
	if remainingCodes[0].CodeHash != validCode.CodeHash {
		t.Fatalf("expected valid authorization code to remain")
	}

	var remainingTokens []OIDCToken
	if err = DB.Find(&remainingTokens).Error; err != nil {
		t.Fatalf("failed to query remaining tokens: %v", err)
	}
	if len(remainingTokens) != 1 {
		t.Fatalf("expected exactly 1 valid token remaining, got %d", len(remainingTokens))
	}
	if remainingTokens[0].AccessTokenHash != hashOIDCValue("cleanup-token-valid") {
		t.Fatalf("expected valid token to remain")
	}
}
