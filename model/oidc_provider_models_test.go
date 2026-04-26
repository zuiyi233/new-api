package model

import (
	"fmt"
	"strings"
	"testing"

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
	if err = db.AutoMigrate(&OIDCClient{}); err != nil {
		t.Fatalf("failed to migrate oidc client model: %v", err)
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
