package model

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	oidcDefaultRSAKeyBits              = 2048
	oidcDefaultClientIDLen             = 24
	oidcDefaultClientSecretLen         = 48
	oidcDefaultAuthorizationCodeLen    = 64
	oidcDefaultAccessTokenLen          = 48
	oidcDefaultRefreshTokenLen         = 64
	oidcDefaultAuthorizationCodeTTL    = 5 * time.Minute
	oidcDefaultAccessTokenTTL          = time.Hour
	oidcDefaultRefreshTokenTTL         = 30 * 24 * time.Hour
	oidcDefaultClientIDPrefix          = "oidc_"
	oidcDefaultClientSecretPrefix      = "oidc_sec_"
	oidcDefaultAuthorizationCodePrefix = "oidc_code_"
	oidcDefaultAccessTokenPrefix       = "oidc_at_"
	oidcDefaultRefreshTokenPrefix      = "oidc_rt_"
	oidcClientTypePublic               = "public"
	oidcClientTypeConfidential         = "confidential"
	oidcTokenTypeHintAccessToken       = "access_token"
	oidcTokenTypeHintRefreshToken      = "refresh_token"
	oidcDefaultCleanupInterval         = 10 * time.Minute
)

var oidcScopePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9:._-]*$`)

// OIDCClient stores OAuth/OIDC clients.
// redirect_uris/scopes are JSON string arrays persisted in TEXT columns.
type OIDCClient struct {
	Id               int       `json:"id" gorm:"primaryKey"`
	ClientID         string    `json:"client_id" gorm:"type:varchar(128);not null;uniqueIndex"`
	ClientSecretHash string    `json:"-" gorm:"column:client_secret_hash;type:varchar(128);not null"`
	Name             string    `json:"name" gorm:"type:varchar(128);not null"`
	RedirectURIs     string    `json:"redirect_uris" gorm:"type:text;not null"` // JSON array string
	Scopes           string    `json:"scopes" gorm:"type:text;not null"`        // JSON array string
	ClientType       string    `json:"client_type" gorm:"type:varchar(32);not null;default:'confidential';index"`
	Enabled          bool      `json:"enabled" gorm:"default:true;index"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (OIDCClient) TableName() string {
	return "oauth_clients"
}

// OIDCAuthorizationCode stores one-time authorization codes (hashed at rest).
type OIDCAuthorizationCode struct {
	Id                  int        `json:"id" gorm:"primaryKey"`
	CodeHash            string     `json:"-" gorm:"column:code_hash;type:varchar(128);not null;uniqueIndex"`
	ClientID            string     `json:"client_id" gorm:"type:varchar(128);not null;index"`
	UserID              int        `json:"user_id" gorm:"not null;index"`
	RedirectURI         string     `json:"redirect_uri" gorm:"type:text;not null"`
	Scope               string     `json:"scope" gorm:"type:text;default:''"`
	Nonce               string     `json:"nonce" gorm:"type:varchar(255);default:''"`
	CodeChallenge       string     `json:"code_challenge" gorm:"type:varchar(255);default:''"`
	CodeChallengeMethod string     `json:"code_challenge_method" gorm:"type:varchar(32);default:''"`
	ExpiresAt           time.Time  `json:"expires_at" gorm:"index"`
	ConsumedAt          *time.Time `json:"consumed_at,omitempty" gorm:"index"`
	CreatedAt           time.Time  `json:"created_at"`
}

func (OIDCAuthorizationCode) TableName() string {
	return "oauth_authorization_codes"
}

// OIDCToken stores hashed access/refresh tokens and their lifecycle.
type OIDCToken struct {
	Id                    int        `json:"id" gorm:"primaryKey"`
	ClientID              string     `json:"client_id" gorm:"type:varchar(128);not null;index"`
	UserID                int        `json:"user_id" gorm:"not null;index"`
	Subject               string     `json:"subject" gorm:"type:varchar(128);default:''"`
	Scope                 string     `json:"scope" gorm:"type:text;default:''"`
	AccessTokenHash       string     `json:"-" gorm:"column:access_token_hash;type:varchar(128);not null;uniqueIndex"`
	RefreshTokenHash      string     `json:"-" gorm:"column:refresh_token_hash;type:varchar(128);index"`
	AccessTokenExpiresAt  time.Time  `json:"access_token_expires_at" gorm:"index"`
	RefreshTokenExpiresAt *time.Time `json:"refresh_token_expires_at,omitempty" gorm:"index"`
	RevokedAt             *time.Time `json:"revoked_at,omitempty" gorm:"index"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

func (OIDCToken) TableName() string {
	return "oauth_tokens"
}

// OIDCSigningKey stores signing key material (private PEM + public JWK JSON).
type OIDCSigningKey struct {
	Id         int       `json:"id" gorm:"primaryKey"`
	Kid        string    `json:"kid" gorm:"type:varchar(128);not null;uniqueIndex"`
	Alg        string    `json:"alg" gorm:"type:varchar(32);not null;default:'RS256'"`
	PrivateKey string    `json:"-" gorm:"column:private_key;type:text;not null"`
	PublicJWK  string    `json:"public_jwk" gorm:"column:public_jwk;type:text;not null"`
	Active     bool      `json:"active" gorm:"default:true;index"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (OIDCSigningKey) TableName() string {
	return "oauth_signing_keys"
}

type CreateOIDCClientInput struct {
	ClientID     string   `json:"client_id"`
	Name         string   `json:"name"`
	RedirectURIs []string `json:"redirect_uris"`
	Scopes       []string `json:"scopes"`
	ClientType   string   `json:"client_type"`
	Enabled      *bool    `json:"enabled"`
}

type CreateAuthorizationCodeInput struct {
	ClientID            string     `json:"client_id"`
	UserID              int        `json:"user_id"`
	RedirectURI         string     `json:"redirect_uri"`
	Scope               string     `json:"scope"`
	Nonce               string     `json:"nonce"`
	CodeChallenge       string     `json:"code_challenge"`
	CodeChallengeMethod string     `json:"code_challenge_method"`
	ExpiresAt           *time.Time `json:"expires_at"`
}

type CreateOIDCTokenInput struct {
	ClientID              string     `json:"client_id"`
	UserID                int        `json:"user_id"`
	Subject               string     `json:"subject"`
	Scope                 string     `json:"scope"`
	AccessTokenExpiresAt  *time.Time `json:"access_token_expires_at"`
	RefreshTokenExpiresAt *time.Time `json:"refresh_token_expires_at"`
}

// SerializeOIDCStringArray serializes a non-empty string array into JSON string.
func SerializeOIDCStringArray(items []string) (string, error) {
	normalized := normalizeOIDCStringArray(items)
	if len(normalized) == 0 {
		return "", errors.New("empty string list")
	}
	raw, err := common.Marshal(normalized)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

// ParseOIDCStringArray parses a JSON string array and normalizes values.
func ParseOIDCStringArray(raw string) ([]string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("empty json string")
	}
	var parsed []string
	if err := common.UnmarshalJsonStr(trimmed, &parsed); err != nil {
		return nil, err
	}
	normalized := normalizeOIDCStringArray(parsed)
	if len(normalized) == 0 {
		return nil, errors.New("empty string list")
	}
	return normalized, nil
}

func (c *OIDCClient) GetRedirectURIList() ([]string, error) {
	return ParseOIDCStringArray(c.RedirectURIs)
}

func (c *OIDCClient) SetRedirectURIList(redirectURIs []string) error {
	if err := ValidateOIDCRedirectURIs(redirectURIs); err != nil {
		return err
	}
	serialized, err := SerializeOIDCStringArray(redirectURIs)
	if err != nil {
		return err
	}
	c.RedirectURIs = serialized
	return nil
}

func (c *OIDCClient) GetScopeList() ([]string, error) {
	return ParseOIDCStringArray(c.Scopes)
}

func (c *OIDCClient) SetScopeList(scopes []string) error {
	if err := ValidateOIDCScopeItems(scopes); err != nil {
		return err
	}
	serialized, err := SerializeOIDCStringArray(scopes)
	if err != nil {
		return err
	}
	c.Scopes = serialized
	return nil
}

func normalizeOIDCStringArray(items []string) []string {
	res := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		clean := strings.TrimSpace(item)
		if clean == "" {
			continue
		}
		if _, ok := seen[clean]; ok {
			continue
		}
		seen[clean] = struct{}{}
		res = append(res, clean)
	}
	return res
}

func NormalizeOIDCClientType(clientType string) string {
	switch strings.ToLower(strings.TrimSpace(clientType)) {
	case oidcClientTypePublic:
		return oidcClientTypePublic
	default:
		return oidcClientTypeConfidential
	}
}

func SplitOIDCScopeString(scope string) []string {
	return normalizeOIDCStringArray(strings.Fields(scope))
}

func ValidateOIDCRedirectURIs(redirectURIs []string) error {
	normalized := normalizeOIDCStringArray(redirectURIs)
	if len(normalized) == 0 {
		return errors.New("at least one redirect uri is required")
	}
	for _, redirectURI := range normalized {
		if err := validateOIDCRedirectURI(redirectURI); err != nil {
			return err
		}
	}
	return nil
}

func validateOIDCRedirectURI(redirectURI string) error {
	parsed, err := url.Parse(redirectURI)
	if err != nil {
		return fmt.Errorf("invalid redirect uri: %w", err)
	}
	if parsed.Scheme == "" || parsed.Host == "" {
		return errors.New("redirect uri must be absolute")
	}
	if parsed.Fragment != "" {
		return errors.New("redirect uri must not contain fragment")
	}
	return nil
}

func IsRedirectURIExactMatch(registered []string, redirectURI string) bool {
	cleanTarget := strings.TrimSpace(redirectURI)
	if cleanTarget == "" {
		return false
	}
	for _, item := range normalizeOIDCStringArray(registered) {
		if item == cleanTarget {
			return true
		}
	}
	return false
}

func ValidateOIDCClientRedirectURI(client *OIDCClient, redirectURI string) error {
	if client == nil {
		return errors.New("oidc client is nil")
	}
	registered, err := client.GetRedirectURIList()
	if err != nil {
		return err
	}
	if !IsRedirectURIExactMatch(registered, redirectURI) {
		return errors.New("redirect uri mismatch")
	}
	return nil
}

func ValidateOIDCScopeItems(scopes []string) error {
	normalized := normalizeOIDCStringArray(scopes)
	if len(normalized) == 0 {
		return errors.New("at least one scope is required")
	}
	for _, scope := range normalized {
		if !oidcScopePattern.MatchString(scope) {
			return fmt.Errorf("invalid scope: %s", scope)
		}
	}
	return nil
}

func ValidateOIDCRequestedScopes(client *OIDCClient, requestedScopes []string) error {
	if client == nil {
		return errors.New("oidc client is nil")
	}
	allowed, err := client.GetScopeList()
	if err != nil {
		return err
	}
	if err := ValidateOIDCScopeItems(allowed); err != nil {
		return err
	}

	requested := normalizeOIDCStringArray(requestedScopes)
	if len(requested) == 0 {
		return errors.New("requested scopes are empty")
	}
	if err := ValidateOIDCScopeItems(requested); err != nil {
		return err
	}

	allowedMap := make(map[string]struct{}, len(allowed))
	for _, scope := range allowed {
		allowedMap[scope] = struct{}{}
	}
	for _, scope := range requested {
		if _, ok := allowedMap[scope]; !ok {
			return fmt.Errorf("scope not allowed: %s", scope)
		}
	}
	return nil
}

func CreateOIDCClient(input *CreateOIDCClientInput) (*OIDCClient, string, error) {
	if input == nil {
		return nil, "", errors.New("create oidc client input is nil")
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, "", errors.New("client name is required")
	}
	if err := ValidateOIDCRedirectURIs(input.RedirectURIs); err != nil {
		return nil, "", err
	}
	if err := ValidateOIDCScopeItems(input.Scopes); err != nil {
		return nil, "", err
	}

	clientID := strings.TrimSpace(input.ClientID)
	if clientID == "" {
		randomPart, err := common.GenerateRandomCharsKey(oidcDefaultClientIDLen)
		if err != nil {
			return nil, "", err
		}
		clientID = oidcDefaultClientIDPrefix + randomPart
	}

	plainSecret, err := generateOIDCClientSecret()
	if err != nil {
		return nil, "", err
	}

	redirectURIs, err := SerializeOIDCStringArray(input.RedirectURIs)
	if err != nil {
		return nil, "", err
	}
	scopes, err := SerializeOIDCStringArray(input.Scopes)
	if err != nil {
		return nil, "", err
	}

	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	clientType := NormalizeOIDCClientType(input.ClientType)

	client := &OIDCClient{
		ClientID:         clientID,
		ClientSecretHash: hashOIDCValue(plainSecret),
		Name:             name,
		RedirectURIs:     redirectURIs,
		Scopes:           scopes,
		ClientType:       clientType,
		Enabled:          enabled,
	}
	if err := DB.Create(client).Error; err != nil {
		return nil, "", err
	}
	return client, plainSecret, nil
}

func ListOIDCClients() ([]*OIDCClient, error) {
	var clients []*OIDCClient
	if err := DB.Order("id asc").Find(&clients).Error; err != nil {
		return nil, err
	}
	return clients, nil
}

func GetOIDCClientByClientID(clientID string) (*OIDCClient, error) {
	cleanID := strings.TrimSpace(clientID)
	if cleanID == "" {
		return nil, errors.New("client id is required")
	}

	var client OIDCClient
	if err := DB.Where("client_id = ?", cleanID).First(&client).Error; err != nil {
		return nil, err
	}
	return &client, nil
}

func UpdateOIDCClient(client *OIDCClient) error {
	if client == nil {
		return errors.New("oidc client is nil")
	}

	var existing OIDCClient
	switch {
	case client.Id > 0:
		if err := DB.Where("id = ?", client.Id).First(&existing).Error; err != nil {
			return err
		}
	case strings.TrimSpace(client.ClientID) != "":
		if err := DB.Where("client_id = ?", strings.TrimSpace(client.ClientID)).First(&existing).Error; err != nil {
			return err
		}
	default:
		return errors.New("client id or id is required")
	}

	cleanName := strings.TrimSpace(client.Name)
	if cleanName == "" {
		return errors.New("client name is required")
	}
	redirectURIs, err := ParseOIDCStringArray(client.RedirectURIs)
	if err != nil {
		return err
	}
	if err := ValidateOIDCRedirectURIs(redirectURIs); err != nil {
		return err
	}
	scopes, err := ParseOIDCStringArray(client.Scopes)
	if err != nil {
		return err
	}
	if err := ValidateOIDCScopeItems(scopes); err != nil {
		return err
	}

	updates := map[string]any{
		"name":          cleanName,
		"redirect_uris": client.RedirectURIs,
		"scopes":        client.Scopes,
		"client_type":   NormalizeOIDCClientType(client.ClientType),
		"enabled":       client.Enabled,
	}
	if cleanClientID := strings.TrimSpace(client.ClientID); cleanClientID != "" {
		updates["client_id"] = cleanClientID
	}
	if strings.TrimSpace(client.ClientSecretHash) != "" {
		updates["client_secret_hash"] = strings.TrimSpace(client.ClientSecretHash)
	}

	if err := DB.Model(&OIDCClient{}).Where("id = ?", existing.Id).Updates(updates).Error; err != nil {
		return err
	}
	return nil
}

func DeleteOIDCClient(clientID string) error {
	cleanID := strings.TrimSpace(clientID)
	if cleanID == "" {
		return errors.New("client id is required")
	}
	return DB.Where("client_id = ?", cleanID).Delete(&OIDCClient{}).Error
}

func SetOIDCClientEnabled(clientID string, enabled bool) error {
	cleanID := strings.TrimSpace(clientID)
	if cleanID == "" {
		return errors.New("client id is required")
	}
	return DB.Model(&OIDCClient{}).Where("client_id = ?", cleanID).Update("enabled", enabled).Error
}

func DisableOIDCClient(clientID string) error {
	return SetOIDCClientEnabled(clientID, false)
}

func EnableOIDCClient(clientID string) error {
	return SetOIDCClientEnabled(clientID, true)
}

func ValidateOIDCClientSecret(clientID, secret string) (*OIDCClient, error) {
	client, err := GetOIDCClientByClientID(clientID)
	if err != nil {
		return nil, err
	}
	if !client.Enabled {
		return nil, errors.New("oidc client is disabled")
	}
	if strings.TrimSpace(secret) == "" {
		return nil, errors.New("client secret is required")
	}
	if client.ClientSecretHash != hashOIDCValue(secret) {
		return nil, errors.New("invalid client secret")
	}
	return client, nil
}

func RotateOIDCClientSecret(clientID string) (*OIDCClient, string, error) {
	cleanID := strings.TrimSpace(clientID)
	if cleanID == "" {
		return nil, "", errors.New("client id is required")
	}

	client, err := GetOIDCClientByClientID(cleanID)
	if err != nil {
		return nil, "", err
	}

	plainSecret, err := generateOIDCClientSecret()
	if err != nil {
		return nil, "", err
	}

	updates := map[string]any{
		"client_secret_hash": hashOIDCValue(plainSecret),
	}
	if err = DB.Model(&OIDCClient{}).Where("id = ?", client.Id).Updates(updates).Error; err != nil {
		return nil, "", err
	}
	client.ClientSecretHash = updates["client_secret_hash"].(string)
	return client, plainSecret, nil
}

func CreateAuthorizationCode(input *CreateAuthorizationCodeInput) (string, error) {
	if input == nil {
		return "", errors.New("create authorization code input is nil")
	}
	if strings.TrimSpace(input.ClientID) == "" {
		return "", errors.New("client id is required")
	}
	if input.UserID <= 0 {
		return "", errors.New("user id is required")
	}

	redirectURI := strings.TrimSpace(input.RedirectURI)
	if err := validateOIDCRedirectURI(redirectURI); err != nil {
		return "", err
	}

	expiresAt, err := resolveAuthorizationCodeExpiry(input.ExpiresAt)
	if err != nil {
		return "", err
	}

	for i := 0; i < 3; i++ {
		rawCode, err := generateOIDCAuthorizationCode()
		if err != nil {
			return "", err
		}
		record := &OIDCAuthorizationCode{
			CodeHash:            hashOIDCValue(rawCode),
			ClientID:            strings.TrimSpace(input.ClientID),
			UserID:              input.UserID,
			RedirectURI:         redirectURI,
			Scope:               strings.TrimSpace(input.Scope),
			Nonce:               strings.TrimSpace(input.Nonce),
			CodeChallenge:       strings.TrimSpace(input.CodeChallenge),
			CodeChallengeMethod: strings.TrimSpace(input.CodeChallengeMethod),
			ExpiresAt:           expiresAt,
		}
		if err := DB.Create(record).Error; err != nil {
			continue
		}
		return rawCode, nil
	}
	return "", errors.New("failed to generate unique authorization code")
}

func ConsumeAuthorizationCode(code, clientID, redirectURI string) (*OIDCAuthorizationCode, error) {
	cleanCode := strings.TrimSpace(code)
	cleanClientID := strings.TrimSpace(clientID)
	cleanRedirectURI := strings.TrimSpace(redirectURI)
	if cleanCode == "" {
		return nil, errors.New("authorization code is required")
	}
	if cleanClientID == "" {
		return nil, errors.New("client id is required")
	}
	if cleanRedirectURI == "" {
		return nil, errors.New("redirect uri is required")
	}

	codeHash := hashOIDCValue(cleanCode)
	var consumed OIDCAuthorizationCode
	err := DB.Transaction(func(tx *gorm.DB) error {
		var record OIDCAuthorizationCode
		if err := tx.Where("code_hash = ? AND client_id = ?", codeHash, cleanClientID).First(&record).Error; err != nil {
			return err
		}
		if record.RedirectURI != cleanRedirectURI {
			return errors.New("redirect uri mismatch")
		}
		if record.ConsumedAt != nil {
			return errors.New("authorization code already consumed")
		}
		if time.Now().After(record.ExpiresAt) {
			return errors.New("authorization code expired")
		}

		now := time.Now()
		result := tx.Model(&OIDCAuthorizationCode{}).
			Where("id = ? AND consumed_at IS NULL", record.Id).
			Update("consumed_at", now)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("authorization code already consumed")
		}

		record.ConsumedAt = &now
		consumed = record
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &consumed, nil
}

func CreateOIDCToken(input *CreateOIDCTokenInput) (*OIDCToken, string, string, error) {
	if input == nil {
		return nil, "", "", errors.New("create oidc token input is nil")
	}
	if strings.TrimSpace(input.ClientID) == "" {
		return nil, "", "", errors.New("client id is required")
	}
	if input.UserID <= 0 {
		return nil, "", "", errors.New("user id is required")
	}

	accessExpiresAt, err := resolveAccessTokenExpiry(input.AccessTokenExpiresAt)
	if err != nil {
		return nil, "", "", err
	}
	refreshExpiresAt, err := resolveRefreshTokenExpiry(input.RefreshTokenExpiresAt)
	if err != nil {
		return nil, "", "", err
	}

	if scope := strings.TrimSpace(input.Scope); scope != "" {
		if err := ValidateOIDCScopeItems(SplitOIDCScopeString(scope)); err != nil {
			return nil, "", "", err
		}
	}

	accessToken, err := generateOIDCAccessToken()
	if err != nil {
		return nil, "", "", err
	}
	refreshToken, err := generateOIDCRefreshToken()
	if err != nil {
		return nil, "", "", err
	}

	token := &OIDCToken{
		ClientID:              strings.TrimSpace(input.ClientID),
		UserID:                input.UserID,
		Subject:               strings.TrimSpace(input.Subject),
		Scope:                 strings.TrimSpace(input.Scope),
		AccessTokenHash:       hashOIDCValue(accessToken),
		RefreshTokenHash:      hashOIDCValue(refreshToken),
		AccessTokenExpiresAt:  accessExpiresAt,
		RefreshTokenExpiresAt: &refreshExpiresAt,
	}
	if err := DB.Create(token).Error; err != nil {
		return nil, "", "", err
	}
	return token, accessToken, refreshToken, nil
}

func GetOIDCTokenByAccessToken(accessToken string) (*OIDCToken, error) {
	clean := strings.TrimSpace(accessToken)
	if clean == "" {
		return nil, errors.New("access token is required")
	}

	var token OIDCToken
	if err := DB.Where("access_token_hash = ? AND revoked_at IS NULL", hashOIDCValue(clean)).First(&token).Error; err != nil {
		return nil, err
	}
	if time.Now().After(token.AccessTokenExpiresAt) {
		return nil, errors.New("access token expired")
	}
	return &token, nil
}

func GetOIDCTokenByRefreshToken(refreshToken string) (*OIDCToken, error) {
	clean := strings.TrimSpace(refreshToken)
	if clean == "" {
		return nil, errors.New("refresh token is required")
	}

	var token OIDCToken
	if err := DB.Where("refresh_token_hash = ? AND revoked_at IS NULL", hashOIDCValue(clean)).First(&token).Error; err != nil {
		return nil, err
	}
	if token.RefreshTokenExpiresAt != nil && time.Now().After(*token.RefreshTokenExpiresAt) {
		return nil, errors.New("refresh token expired")
	}
	return &token, nil
}

func RotateRefreshToken(refreshToken string, input *CreateOIDCTokenInput) (*OIDCToken, string, string, error) {
	cleanRefresh := strings.TrimSpace(refreshToken)
	if cleanRefresh == "" {
		return nil, "", "", errors.New("refresh token is required")
	}

	current, err := GetOIDCTokenByRefreshToken(cleanRefresh)
	if err != nil {
		return nil, "", "", err
	}

	accessExpiresAt, err := resolveAccessTokenExpiry(nil)
	if err != nil {
		return nil, "", "", err
	}
	refreshExpiresAt, err := resolveRefreshTokenExpiry(nil)
	if err != nil {
		return nil, "", "", err
	}
	clientID := current.ClientID
	userID := current.UserID
	subject := current.Subject
	scope := current.Scope

	if input != nil {
		if cleanClientID := strings.TrimSpace(input.ClientID); cleanClientID != "" {
			if cleanClientID != current.ClientID {
				return nil, "", "", errors.New("client id mismatch for refresh token rotation")
			}
			clientID = cleanClientID
		}
		if input.UserID > 0 {
			if input.UserID != current.UserID {
				return nil, "", "", errors.New("user id mismatch for refresh token rotation")
			}
			userID = input.UserID
		}
		if strings.TrimSpace(input.Subject) != "" {
			subject = strings.TrimSpace(input.Subject)
		}
		if strings.TrimSpace(input.Scope) != "" {
			if err := ValidateOIDCScopeItems(SplitOIDCScopeString(input.Scope)); err != nil {
				return nil, "", "", err
			}
			scope = strings.TrimSpace(input.Scope)
		}
		accessExpiresAt, err = resolveAccessTokenExpiry(input.AccessTokenExpiresAt)
		if err != nil {
			return nil, "", "", err
		}
		refreshExpiresAt, err = resolveRefreshTokenExpiry(input.RefreshTokenExpiresAt)
		if err != nil {
			return nil, "", "", err
		}
	}

	newAccessToken, err := generateOIDCAccessToken()
	if err != nil {
		return nil, "", "", err
	}
	newRefreshToken, err := generateOIDCRefreshToken()
	if err != nil {
		return nil, "", "", err
	}

	currentRefreshHash := hashOIDCValue(cleanRefresh)
	newAccessHash := hashOIDCValue(newAccessToken)
	newRefreshHash := hashOIDCValue(newRefreshToken)

	var updated OIDCToken
	err = DB.Transaction(func(tx *gorm.DB) error {
		var latest OIDCToken
		if err := tx.Where("id = ? AND revoked_at IS NULL", current.Id).First(&latest).Error; err != nil {
			return err
		}
		if latest.RefreshTokenHash != currentRefreshHash {
			return errors.New("refresh token already rotated")
		}
		if latest.RefreshTokenExpiresAt != nil && time.Now().After(*latest.RefreshTokenExpiresAt) {
			return errors.New("refresh token expired")
		}

		updates := map[string]any{
			"client_id":                clientID,
			"user_id":                  userID,
			"subject":                  subject,
			"scope":                    scope,
			"access_token_hash":        newAccessHash,
			"refresh_token_hash":       newRefreshHash,
			"access_token_expires_at":  accessExpiresAt,
			"refresh_token_expires_at": refreshExpiresAt,
		}
		result := tx.Model(&OIDCToken{}).
			Where("id = ? AND refresh_token_hash = ? AND revoked_at IS NULL", latest.Id, currentRefreshHash).
			Updates(updates)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return errors.New("refresh token rotation conflict")
		}

		latest.ClientID = clientID
		latest.UserID = userID
		latest.Subject = subject
		latest.Scope = scope
		latest.AccessTokenHash = newAccessHash
		latest.RefreshTokenHash = newRefreshHash
		latest.AccessTokenExpiresAt = accessExpiresAt
		latest.RefreshTokenExpiresAt = &refreshExpiresAt
		updated = latest
		return nil
	})
	if err != nil {
		return nil, "", "", err
	}
	return &updated, newAccessToken, newRefreshToken, nil
}

func RevokeOIDCTokenByAccessToken(accessToken string) error {
	clean := strings.TrimSpace(accessToken)
	if clean == "" {
		return errors.New("access token is required")
	}
	now := time.Now()
	return DB.Model(&OIDCToken{}).
		Where("access_token_hash = ? AND revoked_at IS NULL", hashOIDCValue(clean)).
		Update("revoked_at", now).Error
}

func RevokeOIDCTokenByRefreshToken(refreshToken string) error {
	clean := strings.TrimSpace(refreshToken)
	if clean == "" {
		return errors.New("refresh token is required")
	}
	now := time.Now()
	return DB.Model(&OIDCToken{}).
		Where("refresh_token_hash = ? AND revoked_at IS NULL", hashOIDCValue(clean)).
		Update("revoked_at", now).Error
}

// RevokeOIDCToken revokes OAuth tokens by token value and optional token type hint.
// tokenTypeHint supports "access_token" and "refresh_token". Unknown/empty hint falls back to both.
func RevokeOIDCToken(tokenValue string, tokenTypeHint string) error {
	cleanToken := strings.TrimSpace(tokenValue)
	if cleanToken == "" {
		return errors.New("token is required")
	}
	now := time.Now()
	tokenHash := hashOIDCValue(cleanToken)

	switch strings.ToLower(strings.TrimSpace(tokenTypeHint)) {
	case oidcTokenTypeHintAccessToken:
		return DB.Model(&OIDCToken{}).
			Where("access_token_hash = ? AND revoked_at IS NULL", tokenHash).
			Update("revoked_at", now).Error
	case oidcTokenTypeHintRefreshToken:
		return DB.Model(&OIDCToken{}).
			Where("refresh_token_hash = ? AND revoked_at IS NULL", tokenHash).
			Update("revoked_at", now).Error
	default:
		return DB.Model(&OIDCToken{}).
			Where("revoked_at IS NULL AND (access_token_hash = ? OR refresh_token_hash = ?)", tokenHash, tokenHash).
			Update("revoked_at", now).Error
	}
}

type OIDCCleanupResult struct {
	DeletedAuthorizationCodes int64 `json:"deleted_authorization_codes"`
	DeletedTokens             int64 `json:"deleted_tokens"`
}

// CleanupExpiredOIDCProviderData deletes expired/consumed authorization codes and expired/revoked tokens.
func CleanupExpiredOIDCProviderData(now time.Time) (*OIDCCleanupResult, error) {
	if now.IsZero() {
		now = time.Now()
	}
	result := &OIDCCleanupResult{}
	err := DB.Transaction(func(tx *gorm.DB) error {
		codesDelete := tx.Where("expires_at < ? OR consumed_at IS NOT NULL", now).Delete(&OIDCAuthorizationCode{})
		if codesDelete.Error != nil {
			return codesDelete.Error
		}
		result.DeletedAuthorizationCodes = codesDelete.RowsAffected

		tokensDelete := tx.Where("revoked_at IS NOT NULL OR access_token_expires_at < ? OR (refresh_token_expires_at IS NOT NULL AND refresh_token_expires_at < ?)", now, now).Delete(&OIDCToken{})
		if tokensDelete.Error != nil {
			return tokensDelete.Error
		}
		result.DeletedTokens = tokensDelete.RowsAffected
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// StartOIDCProviderCleanupTicker starts a background cleanup ticker for OIDC auth data.
// Pass a closed stop channel to stop the loop.
func StartOIDCProviderCleanupTicker(interval time.Duration, stop <-chan struct{}) {
	if interval <= 0 {
		interval = oidcDefaultCleanupInterval
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if _, err := CleanupExpiredOIDCProviderData(time.Now()); err != nil {
				common.SysError(fmt.Sprintf("oidc cleanup failed: %v", err))
			}
		case <-stop:
			return
		}
	}
}

func EnsureDefaultOIDCSigningKey() error {
	_, err := ensureActiveSigningKey()
	return err
}

func GetActiveSigningKey() (*OIDCSigningKey, error) {
	return ensureActiveSigningKey()
}

func GetOIDCJWKS() (map[string]any, error) {
	if err := EnsureDefaultOIDCSigningKey(); err != nil {
		return nil, err
	}

	var keys []*OIDCSigningKey
	if err := DB.Where("active = ?", true).Order("id asc").Find(&keys).Error; err != nil {
		return nil, err
	}

	jwks := make([]any, 0, len(keys))
	for _, signingKey := range keys {
		var parsed map[string]any
		if err := common.UnmarshalJsonStr(signingKey.PublicJWK, &parsed); err != nil {
			return nil, err
		}
		jwks = append(jwks, parsed)
	}
	return map[string]any{"keys": jwks}, nil
}

func ListOIDCSigningKeys() ([]*OIDCSigningKey, error) {
	if err := EnsureDefaultOIDCSigningKey(); err != nil {
		return nil, err
	}

	var keys []*OIDCSigningKey
	if err := DB.Order("id desc").Find(&keys).Error; err != nil {
		return nil, err
	}
	return keys, nil
}

func RotateOIDCSigningKey() (*OIDCSigningKey, error) {
	privatePEM, publicJWK, kid, err := generateOIDCSigningMaterial()
	if err != nil {
		return nil, err
	}

	created := &OIDCSigningKey{
		Kid:        kid,
		Alg:        "RS256",
		PrivateKey: privatePEM,
		PublicJWK:  publicJWK,
		Active:     true,
	}

	if err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&OIDCSigningKey{}).Where("active = ?", true).Update("active", false).Error; err != nil {
			return err
		}
		if err := tx.Create(created).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return created, nil
}

func ActivateOIDCSigningKey(kid string) (*OIDCSigningKey, error) {
	cleanKid := strings.TrimSpace(kid)
	if cleanKid == "" {
		return nil, errors.New("kid is required")
	}

	var target OIDCSigningKey
	if err := DB.Where("kid = ?", cleanKid).First(&target).Error; err != nil {
		return nil, err
	}

	if err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&OIDCSigningKey{}).Where("active = ?", true).Update("active", false).Error; err != nil {
			return err
		}
		if err := tx.Model(&OIDCSigningKey{}).Where("id = ?", target.Id).Update("active", true).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}

	target.Active = true
	return &target, nil
}

func ensureActiveSigningKey() (*OIDCSigningKey, error) {
	var key OIDCSigningKey
	err := DB.Where("active = ?", true).Order("id desc").First(&key).Error
	if err == nil {
		return &key, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	privatePEM, publicJWK, kid, err := generateOIDCSigningMaterial()
	if err != nil {
		return nil, err
	}
	created := &OIDCSigningKey{
		Kid:        kid,
		Alg:        "RS256",
		PrivateKey: privatePEM,
		PublicJWK:  publicJWK,
		Active:     true,
	}

	if err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&OIDCSigningKey{}).Where("active = ?", true).Update("active", false).Error; err != nil {
			return err
		}
		if err := tx.Create(created).Error; err != nil {
			return err
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return created, nil
}

func generateOIDCSigningMaterial() (privatePEM string, publicJWK string, kid string, err error) {
	privateKey, err := rsa.GenerateKey(rand.Reader, oidcDefaultRSAKeyBits)
	if err != nil {
		return "", "", "", err
	}
	privateDER := x509.MarshalPKCS1PrivateKey(privateKey)
	privatePEMBytes := pem.EncodeToMemory(&pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: privateDER,
	})
	if len(privatePEMBytes) == 0 {
		return "", "", "", errors.New("failed to encode private key")
	}

	n := base64.RawURLEncoding.EncodeToString(privateKey.PublicKey.N.Bytes())
	eBytes := big.NewInt(int64(privateKey.PublicKey.E)).Bytes()
	e := base64.RawURLEncoding.EncodeToString(eBytes)

	kid = buildOIDCKid(n, e)
	jwk := map[string]any{
		"kty": "RSA",
		"use": "sig",
		"kid": kid,
		"alg": "RS256",
		"n":   n,
		"e":   e,
	}
	jwkBytes, err := common.Marshal(jwk)
	if err != nil {
		return "", "", "", err
	}
	return string(privatePEMBytes), string(jwkBytes), kid, nil
}

func buildOIDCKid(n, e string) string {
	raw := fmt.Sprintf("%s.%s.%d", n, e, time.Now().UnixNano())
	digest := common.GenerateHMAC(raw)
	if len(digest) > 16 {
		digest = digest[:16]
	}
	return "oidc-" + digest
}

func resolveAuthorizationCodeExpiry(expiresAt *time.Time) (time.Time, error) {
	if expiresAt == nil {
		return time.Now().Add(oidcDefaultAuthorizationCodeTTL), nil
	}
	if !expiresAt.After(time.Now()) {
		return time.Time{}, errors.New("authorization code expiry must be in the future")
	}
	return *expiresAt, nil
}

func resolveAccessTokenExpiry(expiresAt *time.Time) (time.Time, error) {
	if expiresAt == nil {
		return time.Now().Add(oidcDefaultAccessTokenTTL), nil
	}
	if !expiresAt.After(time.Now()) {
		return time.Time{}, errors.New("access token expiry must be in the future")
	}
	return *expiresAt, nil
}

func resolveRefreshTokenExpiry(expiresAt *time.Time) (time.Time, error) {
	if expiresAt == nil {
		return time.Now().Add(oidcDefaultRefreshTokenTTL), nil
	}
	if !expiresAt.After(time.Now()) {
		return time.Time{}, errors.New("refresh token expiry must be in the future")
	}
	return *expiresAt, nil
}

func generateOIDCClientSecret() (string, error) {
	secret, err := common.GenerateRandomCharsKey(oidcDefaultClientSecretLen)
	if err != nil {
		return "", err
	}
	return oidcDefaultClientSecretPrefix + secret, nil
}

func generateOIDCAuthorizationCode() (string, error) {
	code, err := common.GenerateRandomCharsKey(oidcDefaultAuthorizationCodeLen)
	if err != nil {
		return "", err
	}
	return oidcDefaultAuthorizationCodePrefix + code, nil
}

func generateOIDCAccessToken() (string, error) {
	token, err := common.GenerateRandomCharsKey(oidcDefaultAccessTokenLen)
	if err != nil {
		return "", err
	}
	return oidcDefaultAccessTokenPrefix + token, nil
}

func generateOIDCRefreshToken() (string, error) {
	token, err := common.GenerateRandomCharsKey(oidcDefaultRefreshTokenLen)
	if err != nil {
		return "", err
	}
	return oidcDefaultRefreshTokenPrefix + token, nil
}

func hashOIDCValue(raw string) string {
	return common.GenerateHMAC("oidc:" + raw)
}
