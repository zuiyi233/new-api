package controller

import (
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

const (
	oidcDefaultScope      = "openid profile email"
	oidcAccessTokenTTL    = time.Hour
	oidcRefreshTokenTTL   = 30 * 24 * time.Hour
	oidcAuthorizationTTL  = 90 * time.Second
	oidcClientTypePublic  = "public"
	oidcClientTypePrivate = "confidential"
)

type oidcClientResponse struct {
	ClientID     string   `json:"client_id"`
	Name         string   `json:"name"`
	RedirectURIs []string `json:"redirect_uris"`
	Scopes       []string `json:"scopes"`
	ClientType   string   `json:"client_type"`
	Enabled      bool     `json:"enabled"`
	CreatedAt    string   `json:"created_at"`
	UpdatedAt    string   `json:"updated_at"`
}

type oidcClientCreateRequest struct {
	Name         string   `json:"name"`
	RedirectURIs []string `json:"redirect_uris"`
	Scopes       []string `json:"scopes"`
	ClientType   string   `json:"client_type"`
	Enabled      *bool    `json:"enabled"`
}

type oidcClientUpdateRequest struct {
	Name         string   `json:"name"`
	RedirectURIs []string `json:"redirect_uris"`
	Scopes       []string `json:"scopes"`
	ClientType   string   `json:"client_type"`
	Enabled      *bool    `json:"enabled"`
}

func GetOIDCDiscoveryConfiguration(c *gin.Context) {
	if err := model.EnsureDefaultOIDCSigningKey(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":             "server_error",
			"error_description": "failed to initialize signing keys",
		})
		return
	}

	issuer := getOIDCIssuer(c)
	config := gin.H{
		"issuer":                                issuer,
		"authorization_endpoint":                issuer + "/oauth/authorize",
		"token_endpoint":                        issuer + "/oauth/token",
		"userinfo_endpoint":                     issuer + "/oauth/userinfo",
		"jwks_uri":                              issuer + "/.well-known/jwks.json",
		"scopes_supported":                      []string{"openid", "profile", "email", "offline_access"},
		"response_types_supported":              []string{"code"},
		"grant_types_supported":                 []string{"authorization_code", "refresh_token"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post", "none"},
		"code_challenge_methods_supported":      []string{"S256", "plain"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
	}
	c.JSON(http.StatusOK, config)
}

func GetOIDCJWKS(c *gin.Context) {
	jwks, err := model.GetOIDCJWKS()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":             "server_error",
			"error_description": "failed to load jwks",
		})
		return
	}
	c.JSON(http.StatusOK, jwks)
}

func OIDCAuthorize(c *gin.Context) {
	responseType := strings.TrimSpace(c.Query("response_type"))
	clientID := strings.TrimSpace(c.Query("client_id"))
	redirectURI := strings.TrimSpace(c.Query("redirect_uri"))
	scope := strings.TrimSpace(c.Query("scope"))
	state := strings.TrimSpace(c.Query("state"))
	nonce := strings.TrimSpace(c.Query("nonce"))
	codeChallenge := strings.TrimSpace(c.Query("code_challenge"))
	codeChallengeMethod := strings.ToUpper(strings.TrimSpace(c.Query("code_challenge_method")))

	if codeChallengeMethod == "" {
		codeChallengeMethod = "PLAIN"
	}

	if responseType != "code" {
		oauthAuthorizeError(c, "", state, "unsupported_response_type", "response_type must be code")
		return
	}
	if clientID == "" || redirectURI == "" {
		oauthAuthorizeError(c, "", state, "invalid_request", "client_id and redirect_uri are required")
		return
	}
	if state == "" {
		oauthAuthorizeError(c, "", "", "invalid_request", "state is required")
		return
	}

	client, err := model.GetOIDCClientByClientID(clientID)
	if err != nil {
		oauthAuthorizeError(c, "", state, "unauthorized_client", "unknown client")
		return
	}
	if !client.Enabled {
		oauthAuthorizeError(c, redirectURI, state, "unauthorized_client", "client is disabled")
		return
	}
	if !isRedirectURIAllowed(client.RedirectURIs, redirectURI) {
		oauthAuthorizeError(c, "", state, "invalid_request", "redirect_uri mismatch")
		return
	}

	normalizedScope, err := normalizeRequestedScope(scope, client.Scopes)
	if err != nil {
		oauthAuthorizeError(c, redirectURI, state, "invalid_scope", err.Error())
		return
	}

	isPublicClient := strings.EqualFold(strings.TrimSpace(client.ClientType), oidcClientTypePublic)
	if isPublicClient {
		if codeChallenge == "" {
			oauthAuthorizeError(c, redirectURI, state, "invalid_request", "public client must use PKCE")
			return
		}
		if codeChallengeMethod != "S256" {
			oauthAuthorizeError(c, redirectURI, state, "invalid_request", "public client only supports S256 code_challenge_method")
			return
		}
	} else if codeChallenge != "" && codeChallengeMethod != "S256" && codeChallengeMethod != "PLAIN" {
		oauthAuthorizeError(c, redirectURI, state, "invalid_request", "unsupported code_challenge_method")
		return
	}

	session := sessions.Default(c)
	userIDAny := session.Get("id")
	if userIDAny == nil {
		continuePath := c.Request.URL.RequestURI()
		loginURL := "/login?continue=" + url.QueryEscape(continuePath)
		logOIDCAudit(c, "authorize", clientID, 0, "redirect_login", "not logged in")
		c.Redirect(http.StatusFound, loginURL)
		return
	}

	userID, ok := userIDAny.(int)
	if !ok || userID <= 0 {
		oauthAuthorizeError(c, redirectURI, state, "access_denied", "invalid session")
		return
	}
	if statusAny := session.Get("status"); statusAny != nil {
		if status, ok := statusAny.(int); ok && status != common.UserStatusEnabled {
			oauthAuthorizeError(c, redirectURI, state, "access_denied", "user is disabled")
			logOIDCAudit(c, "authorize", clientID, userID, "denied", "disabled user")
			return
		}
	}

	code, err := model.CreateAuthorizationCode(&model.CreateAuthorizationCodeInput{
		ClientID:            clientID,
		UserID:              userID,
		RedirectURI:         redirectURI,
		Scope:               normalizedScope,
		CodeChallenge:       codeChallenge,
		CodeChallengeMethod: codeChallengeMethod,
		Nonce:               nonce,
		ExpiresAt:           timePtr(time.Now().Add(oidcAuthorizationTTL)),
	})
	if err != nil {
		oauthAuthorizeError(c, redirectURI, state, "server_error", "failed to generate authorization code")
		logOIDCAudit(c, "authorize", clientID, userID, "failed", err.Error())
		return
	}

	callback, err := url.Parse(redirectURI)
	if err != nil {
		oauthAuthorizeError(c, "", state, "server_error", "invalid redirect uri")
		return
	}
	query := callback.Query()
	query.Set("code", code)
	query.Set("state", state)
	callback.RawQuery = query.Encode()

	logOIDCAudit(c, "authorize", clientID, userID, "success", "issued authorization code")
	c.Redirect(http.StatusFound, callback.String())
}

func OIDCToken(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		writeOAuthError(c, http.StatusBadRequest, "invalid_request", "failed to parse form")
		return
	}

	grantType := strings.TrimSpace(c.PostForm("grant_type"))
	if grantType == "" {
		writeOAuthError(c, http.StatusBadRequest, "invalid_request", "grant_type is required")
		return
	}

	clientID, clientSecret, authMethod, err := parseOAuthClientCredentials(c)
	if err != nil {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", err.Error())
		return
	}

	client, err := model.GetOIDCClientByClientID(clientID)
	if err != nil {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "unknown client")
		logOIDCAudit(c, "token", clientID, 0, "failed", "unknown client")
		return
	}
	if !client.Enabled {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "client is disabled")
		logOIDCAudit(c, "token", clientID, 0, "failed", "client disabled")
		return
	}

	if strings.EqualFold(client.ClientType, oidcClientTypePublic) {
		if authMethod != "none" && clientSecret != "" {
			writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "public client must not use client_secret")
			return
		}
	} else {
		if clientSecret == "" {
			writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "client authentication required")
			return
		}
		if _, err = model.ValidateOIDCClientSecret(clientID, clientSecret); err != nil {
			writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "invalid client credentials")
			return
		}
	}

	switch grantType {
	case "authorization_code":
		oidcTokenByAuthorizationCode(c, client)
		return
	case "refresh_token":
		oidcTokenByRefreshToken(c, client)
		return
	default:
		writeOAuthError(c, http.StatusBadRequest, "unsupported_grant_type", "grant_type not supported")
		return
	}
}

func OIDCUserInfo(c *gin.Context) {
	token := extractBearerToken(c.GetHeader("Authorization"))
	if token == "" {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_token", "missing bearer token")
		return
	}
	oauthToken, err := model.GetOIDCTokenByAccessToken(token)
	if err != nil {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_token", "invalid or expired access_token")
		return
	}

	user, err := model.GetUserById(oauthToken.UserID, false)
	if err != nil {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_token", "user not found")
		return
	}
	if user.Status != common.UserStatusEnabled {
		writeOAuthError(c, http.StatusForbidden, "invalid_token", "user is disabled")
		return
	}

	response := buildOIDCUserInfo(user)
	c.JSON(http.StatusOK, response)
}

func OIDCRevokeToken(c *gin.Context) {
	if err := c.Request.ParseForm(); err != nil {
		writeOAuthError(c, http.StatusBadRequest, "invalid_request", "failed to parse form")
		return
	}
	authClientID, clientSecret, _, err := parseOAuthClientCredentials(c)
	if err != nil {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", err.Error())
		return
	}
	clientID := strings.TrimSpace(authClientID)
	if clientID == "" {
		clientID = strings.TrimSpace(c.PostForm("client_id"))
	}
	if clientID == "" {
		writeOAuthError(c, http.StatusBadRequest, "invalid_request", "client_id is required")
		return
	}

	client, err := model.GetOIDCClientByClientID(clientID)
	if err != nil {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "unknown client")
		return
	}
	if strings.EqualFold(client.ClientType, oidcClientTypePrivate) {
		if clientSecret == "" {
			writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "client authentication required")
			return
		}
		if _, err = model.ValidateOIDCClientSecret(clientID, clientSecret); err != nil {
			writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "invalid client credentials")
			return
		}
	}

	token := strings.TrimSpace(c.PostForm("token"))
	if token == "" {
		writeOAuthError(c, http.StatusBadRequest, "invalid_request", "token is required")
		return
	}
	_ = model.RevokeOIDCTokenByAccessToken(token)
	c.Status(http.StatusOK)
}

func AdminListOIDCClients(c *gin.Context) {
	clients, err := model.ListOIDCClients()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	response := make([]*oidcClientResponse, 0, len(clients))
	for _, client := range clients {
		response = append(response, toOIDCClientResponse(client))
	}
	common.ApiSuccess(c, response)
}

func AdminCreateOIDCClient(c *gin.Context) {
	request := &oidcClientCreateRequest{}
	if err := common.DecodeJson(c.Request.Body, request); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	if strings.TrimSpace(request.Name) == "" {
		common.ApiErrorMsg(c, "name is required")
		return
	}
	if len(request.RedirectURIs) == 0 {
		common.ApiErrorMsg(c, "redirect_uris is required")
		return
	}
	clientType := normalizeOIDCClientType(request.ClientType)

	createInput := &model.CreateOIDCClientInput{
		Name:         strings.TrimSpace(request.Name),
		RedirectURIs: request.RedirectURIs,
		Scopes:       normalizeScopeArray(request.Scopes),
		ClientType:   clientType,
		Enabled:      request.Enabled,
	}
	if createInput.Enabled == nil {
		defaultEnabled := true
		createInput.Enabled = &defaultEnabled
	}
	client, clientSecret, err := model.CreateOIDCClient(createInput)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"client":        toOIDCClientResponse(client),
		"client_secret": clientSecret,
	})
}

func AdminUpdateOIDCClient(c *gin.Context) {
	clientID := strings.TrimSpace(c.Param("client_id"))
	if clientID == "" {
		common.ApiErrorMsg(c, "client_id is required")
		return
	}
	client, err := model.GetOIDCClientByClientID(clientID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "client not found")
			return
		}
		common.ApiError(c, err)
		return
	}

	request := &oidcClientUpdateRequest{}
	if err = common.DecodeJson(c.Request.Body, request); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}

	if strings.TrimSpace(request.Name) != "" {
		client.Name = strings.TrimSpace(request.Name)
	}
	if len(request.RedirectURIs) > 0 {
		urisBytes, marshalErr := common.Marshal(normalizeURIArray(request.RedirectURIs))
		if marshalErr != nil {
			common.ApiError(c, marshalErr)
			return
		}
		client.RedirectURIs = string(urisBytes)
	}
	if len(request.Scopes) > 0 {
		scopesBytes, marshalErr := common.Marshal(normalizeScopeArray(request.Scopes))
		if marshalErr != nil {
			common.ApiError(c, marshalErr)
			return
		}
		client.Scopes = string(scopesBytes)
	}
	if strings.TrimSpace(request.ClientType) != "" {
		client.ClientType = normalizeOIDCClientType(request.ClientType)
	}
	if request.Enabled != nil {
		client.Enabled = *request.Enabled
	}

	if err = model.UpdateOIDCClient(client); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, toOIDCClientResponse(client))
}

func AdminDisableOIDCClient(c *gin.Context) {
	clientID := strings.TrimSpace(c.Param("client_id"))
	if clientID == "" {
		common.ApiErrorMsg(c, "client_id is required")
		return
	}
	if err := model.SetOIDCClientEnabled(clientID, false); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"client_id": clientID, "enabled": false})
}

func AdminEnableOIDCClient(c *gin.Context) {
	clientID := strings.TrimSpace(c.Param("client_id"))
	if clientID == "" {
		common.ApiErrorMsg(c, "client_id is required")
		return
	}
	if err := model.SetOIDCClientEnabled(clientID, true); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"client_id": clientID, "enabled": true})
}

func AdminDeleteOIDCClient(c *gin.Context) {
	clientID := strings.TrimSpace(c.Param("client_id"))
	if clientID == "" {
		common.ApiErrorMsg(c, "client_id is required")
		return
	}
	if err := model.DeleteOIDCClient(clientID); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"client_id": clientID, "deleted": true})
}

func oidcTokenByAuthorizationCode(c *gin.Context, client *model.OIDCClient) {
	code := strings.TrimSpace(c.PostForm("code"))
	redirectURI := strings.TrimSpace(c.PostForm("redirect_uri"))
	codeVerifier := strings.TrimSpace(c.PostForm("code_verifier"))
	if code == "" || redirectURI == "" {
		writeOAuthError(c, http.StatusBadRequest, "invalid_request", "code and redirect_uri are required")
		return
	}

	authorizationCode, err := model.ConsumeAuthorizationCode(code, client.ClientID, redirectURI)
	if err != nil {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "invalid authorization code")
		logOIDCAudit(c, "token", client.ClientID, 0, "failed", "invalid authorization code")
		return
	}

	if authorizationCode.CodeChallenge != "" {
		if codeVerifier == "" {
			writeOAuthError(c, http.StatusBadRequest, "invalid_request", "code_verifier is required")
			return
		}
		if !verifyPKCE(authorizationCode.CodeChallenge, authorizationCode.CodeChallengeMethod, codeVerifier) {
			writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "pkce verification failed")
			return
		}
	} else if strings.EqualFold(strings.TrimSpace(client.ClientType), oidcClientTypePublic) {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "public client requires PKCE")
		return
	}

	oauthToken, accessToken, refreshToken, err := model.CreateOIDCToken(&model.CreateOIDCTokenInput{
		ClientID:              client.ClientID,
		UserID:                authorizationCode.UserID,
		Scope:                 authorizationCode.Scope,
		Subject:               strconv.Itoa(authorizationCode.UserID),
		AccessTokenExpiresAt:  timePtr(time.Now().Add(oidcAccessTokenTTL)),
		RefreshTokenExpiresAt: timePtr(time.Now().Add(oidcRefreshTokenTTL)),
	})
	if err != nil {
		writeOAuthError(c, http.StatusInternalServerError, "server_error", "failed to issue token")
		logOIDCAudit(c, "token", client.ClientID, authorizationCode.UserID, "failed", err.Error())
		return
	}

	user, err := model.GetUserById(authorizationCode.UserID, false)
	if err != nil {
		writeOAuthError(c, http.StatusInternalServerError, "server_error", "failed to load user")
		return
	}

	idToken, err := signOIDCIDToken(c, client.ClientID, user, authorizationCode.Nonce)
	if err != nil {
		writeOAuthError(c, http.StatusInternalServerError, "server_error", "failed to sign id_token")
		return
	}

	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"token_type":    "Bearer",
		"expires_in":    int(time.Until(oauthToken.AccessTokenExpiresAt).Seconds()),
		"refresh_token": refreshToken,
		"id_token":      idToken,
		"scope":         authorizationCode.Scope,
	})
	logOIDCAudit(c, "token", client.ClientID, authorizationCode.UserID, "success", "issued access token")
}

func oidcTokenByRefreshToken(c *gin.Context, client *model.OIDCClient) {
	refreshToken := strings.TrimSpace(c.PostForm("refresh_token"))
	if refreshToken == "" {
		writeOAuthError(c, http.StatusBadRequest, "invalid_request", "refresh_token is required")
		return
	}

	existingToken, err := model.GetOIDCTokenByRefreshToken(refreshToken)
	if err != nil {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "invalid refresh_token")
		return
	}
	if existingToken.ClientID != client.ClientID {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "refresh_token does not belong to client")
		return
	}

	requestedScope := strings.TrimSpace(c.PostForm("scope"))
	scope := existingToken.Scope
	if requestedScope != "" {
		normalizedScope, normalizeErr := normalizeRequestedScope(requestedScope, existingToken.Scope)
		if normalizeErr != nil {
			writeOAuthError(c, http.StatusBadRequest, "invalid_scope", normalizeErr.Error())
			return
		}
		scope = normalizedScope
	}

	oauthToken, accessToken, rotatedRefreshToken, err := model.RotateRefreshToken(refreshToken, &model.CreateOIDCTokenInput{
		ClientID:              existingToken.ClientID,
		UserID:                existingToken.UserID,
		Scope:                 scope,
		Subject:               strconv.Itoa(existingToken.UserID),
		AccessTokenExpiresAt:  timePtr(time.Now().Add(oidcAccessTokenTTL)),
		RefreshTokenExpiresAt: timePtr(time.Now().Add(oidcRefreshTokenTTL)),
	})
	if err != nil {
		writeOAuthError(c, http.StatusInternalServerError, "server_error", "failed to rotate refresh_token")
		return
	}

	user, err := model.GetUserById(existingToken.UserID, false)
	if err != nil {
		writeOAuthError(c, http.StatusInternalServerError, "server_error", "failed to load user")
		return
	}
	idToken, err := signOIDCIDToken(c, client.ClientID, user, "")
	if err != nil {
		writeOAuthError(c, http.StatusInternalServerError, "server_error", "failed to sign id_token")
		return
	}

	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"token_type":    "Bearer",
		"expires_in":    int(time.Until(oauthToken.AccessTokenExpiresAt).Seconds()),
		"refresh_token": rotatedRefreshToken,
		"id_token":      idToken,
		"scope":         scope,
	})
	logOIDCAudit(c, "refresh_token", client.ClientID, existingToken.UserID, "success", "rotated refresh token")
}

func signOIDCIDToken(c *gin.Context, clientID string, user *model.User, nonce string) (string, error) {
	if err := model.EnsureDefaultOIDCSigningKey(); err != nil {
		return "", err
	}
	signingKey, err := model.GetActiveSigningKey()
	if err != nil {
		return "", err
	}

	privateKey, err := parseRSAPrivateKey(signingKey.PrivateKey)
	if err != nil {
		return "", err
	}

	now := time.Now()
	claims := jwt.MapClaims{
		"iss":                getOIDCIssuer(c),
		"sub":                strconv.Itoa(user.Id),
		"aud":                clientID,
		"exp":                now.Add(oidcAccessTokenTTL).Unix(),
		"iat":                now.Unix(),
		"preferred_username": user.Username,
		"name":               user.DisplayName,
		"email":              user.Email,
	}
	if nonce != "" {
		claims["nonce"] = nonce
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = signingKey.Kid
	return token.SignedString(privateKey)
}

func parseRSAPrivateKey(privateKeyPEM string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(privateKeyPEM))
	if block == nil {
		return nil, fmt.Errorf("invalid private key pem")
	}
	if privateKey, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return privateKey, nil
	}
	pkcs8Key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	privateKey, ok := pkcs8Key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("private key is not RSA")
	}
	return privateKey, nil
}

func parseOAuthClientCredentials(c *gin.Context) (clientID, clientSecret, method string, err error) {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Basic") {
			return "", "", "", fmt.Errorf("unsupported authorization header")
		}
		decoded, decodeErr := base64.StdEncoding.DecodeString(strings.TrimSpace(parts[1]))
		if decodeErr != nil {
			return "", "", "", fmt.Errorf("malformed basic auth")
		}
		credentialParts := strings.SplitN(string(decoded), ":", 2)
		if len(credentialParts) != 2 {
			return "", "", "", fmt.Errorf("malformed basic auth")
		}
		return strings.TrimSpace(credentialParts[0]), credentialParts[1], "client_secret_basic", nil
	}

	clientID = strings.TrimSpace(c.PostForm("client_id"))
	clientSecret = c.PostForm("client_secret")
	if clientID == "" {
		return "", "", "", fmt.Errorf("client_id is required")
	}
	if clientSecret != "" {
		return clientID, clientSecret, "client_secret_post", nil
	}
	return clientID, "", "none", nil
}

func normalizeRequestedScope(requestedScope string, allowedScopeSource string) (string, error) {
	allowedScopes := parseAllowedScopeSource(allowedScopeSource)
	if len(allowedScopes) == 0 {
		allowedScopes = scopeStringToList(oidcDefaultScope)
	}
	allowedSet := make(map[string]struct{}, len(allowedScopes))
	for _, scope := range allowedScopes {
		allowedSet[scope] = struct{}{}
	}

	scopeToUse := strings.TrimSpace(requestedScope)
	if scopeToUse == "" {
		scopeToUse = strings.Join(allowedScopes, " ")
	}

	requestedScopes := scopeStringToList(scopeToUse)
	if len(requestedScopes) == 0 {
		return "", fmt.Errorf("scope is required")
	}
	if !containsString(requestedScopes, "openid") {
		return "", fmt.Errorf("scope must include openid")
	}

	normalized := make([]string, 0, len(requestedScopes))
	seen := make(map[string]struct{}, len(requestedScopes))
	for _, scope := range requestedScopes {
		if _, ok := allowedSet[scope]; !ok {
			return "", fmt.Errorf("scope %s is not allowed", scope)
		}
		if _, ok := seen[scope]; ok {
			continue
		}
		seen[scope] = struct{}{}
		normalized = append(normalized, scope)
	}
	return strings.Join(normalized, " "), nil
}

func parseAllowedScopeSource(source string) []string {
	trimmed := strings.TrimSpace(source)
	if trimmed == "" {
		return []string{}
	}
	if strings.HasPrefix(trimmed, "[") {
		if parsed, err := model.ParseOIDCStringArray(trimmed); err == nil {
			return parsed
		}
	}
	return scopeStringToList(trimmed)
}

func normalizeScopeArray(scopes []string) []string {
	if len(scopes) == 0 {
		return scopeStringToList(oidcDefaultScope)
	}
	result := make([]string, 0, len(scopes))
	seen := make(map[string]struct{}, len(scopes))
	for _, scope := range scopes {
		normalized := strings.TrimSpace(scope)
		if normalized == "" {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	if len(result) == 0 {
		return scopeStringToList(oidcDefaultScope)
	}
	if !containsString(result, "openid") {
		result = append([]string{"openid"}, result...)
	}
	return result
}

func normalizeURIArray(input []string) []string {
	result := make([]string, 0, len(input))
	seen := make(map[string]struct{}, len(input))
	for _, rawURI := range input {
		normalized := strings.TrimSpace(rawURI)
		if normalized == "" {
			continue
		}
		if _, err := url.Parse(normalized); err != nil {
			continue
		}
		if _, ok := seen[normalized]; ok {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}
	return result
}

func toOIDCClientResponse(client *model.OIDCClient) *oidcClientResponse {
	redirectURIs := parseJSONArrString(client.RedirectURIs)
	scopes := parseJSONArrString(client.Scopes)
	return &oidcClientResponse{
		ClientID:     client.ClientID,
		Name:         client.Name,
		RedirectURIs: redirectURIs,
		Scopes:       scopes,
		ClientType:   client.ClientType,
		Enabled:      client.Enabled,
		CreatedAt:    client.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    client.UpdatedAt.Format(time.RFC3339),
	}
}

func parseJSONArrString(raw string) []string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return []string{}
	}
	array := make([]string, 0)
	if err := common.UnmarshalJsonStr(value, &array); err != nil {
		return []string{}
	}
	return array
}

func isRedirectURIAllowed(redirectURIsJSON string, redirectURI string) bool {
	redirectURIs := parseJSONArrString(redirectURIsJSON)
	for _, item := range redirectURIs {
		if strings.TrimSpace(item) == redirectURI {
			return true
		}
	}
	return false
}

func normalizeOIDCClientType(clientType string) string {
	return model.NormalizeOIDCClientType(clientType)
}

func timePtr(value time.Time) *time.Time {
	return &value
}

func writeOAuthError(c *gin.Context, statusCode int, errCode string, errDesc string) {
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.JSON(statusCode, gin.H{
		"error":             errCode,
		"error_description": errDesc,
	})
}

func oauthAuthorizeError(c *gin.Context, redirectURI string, state string, errCode string, errDesc string) {
	if redirectURI != "" {
		if parsedURI, err := url.Parse(redirectURI); err == nil {
			query := parsedURI.Query()
			query.Set("error", errCode)
			query.Set("error_description", errDesc)
			if state != "" {
				query.Set("state", state)
			}
			parsedURI.RawQuery = query.Encode()
			c.Redirect(http.StatusFound, parsedURI.String())
			return
		}
	}
	writeOAuthError(c, http.StatusBadRequest, errCode, errDesc)
}

func verifyPKCE(codeChallenge string, codeChallengeMethod string, codeVerifier string) bool {
	method := strings.ToUpper(strings.TrimSpace(codeChallengeMethod))
	switch method {
	case "S256":
		digest := sha256.Sum256([]byte(codeVerifier))
		computed := base64.RawURLEncoding.EncodeToString(digest[:])
		return computed == codeChallenge
	case "", "PLAIN":
		return codeVerifier == codeChallenge
	default:
		return false
	}
}

func extractBearerToken(header string) string {
	trimmed := strings.TrimSpace(header)
	if trimmed == "" {
		return ""
	}
	parts := strings.SplitN(trimmed, " ", 2)
	if len(parts) != 2 {
		return ""
	}
	if !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func scopeStringToList(scope string) []string {
	normalized := strings.TrimSpace(scope)
	if normalized == "" {
		return []string{}
	}
	parts := strings.Fields(normalized)
	result := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func getOIDCIssuer(c *gin.Context) string {
	configuredIssuer := strings.TrimSpace(os.Getenv("OIDC_PROVIDER_ISSUER"))
	if configuredIssuer != "" {
		return strings.TrimSuffix(configuredIssuer, "/")
	}

	scheme := c.Request.Header.Get("X-Forwarded-Proto")
	if scheme != "" {
		schemeParts := strings.Split(scheme, ",")
		scheme = strings.TrimSpace(schemeParts[0])
	}
	if scheme == "" {
		scheme = "http"
		if c.Request.TLS != nil {
			scheme = "https"
		}
	}

	host := strings.TrimSpace(c.Request.Header.Get("X-Forwarded-Host"))
	if host == "" {
		host = c.Request.Host
	}
	if host == "" {
		host = "localhost"
	}
	return fmt.Sprintf("%s://%s", scheme, host)
}

func buildOIDCUserInfo(user *model.User) gin.H {
	picture := ""
	return gin.H{
		"sub":                strconv.Itoa(user.Id),
		"preferred_username": user.Username,
		"name":               user.DisplayName,
		"email":              user.Email,
		"picture":            picture,
		"id":                 strconv.Itoa(user.Id),
		"username":           user.Username,
		"avatar":             picture,
	}
}

func logOIDCAudit(c *gin.Context, action string, clientID string, userID int, result string, detail string) {
	common.SysLog(fmt.Sprintf("[OIDC_AUDIT] action=%s client_id=%s user_id=%d ip=%s ua=%q result=%s detail=%q", action, clientID, userID, c.ClientIP(), c.Request.UserAgent(), result, detail))
}
