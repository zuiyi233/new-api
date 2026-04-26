package controller

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	hubAuthSourceSystemAccessToken = "system_access_token"
	hubAuthSourceOIDCAccessToken   = "oidc_access_token"
	hubTokenNamePrefix             = "Hub@"
	hubTokenNameMaxLength          = 50
)

type hubSessionBootstrapRequest struct {
	ClientID  string `json:"client_id"`
	SiteName  string `json:"site_name"`
	TokenName string `json:"token_name"`
}

// HubSessionBootstrap 为第三方站点提供“登录后一次拉齐”能力：
// 1) 支持 OIDC access_token 或系统 access_token 鉴权；
// 2) 自动确保用户拥有系统 access_token；
// 3) 自动创建/复用站点专用 API Token；
// 4) 返回用户信息、可用模型、资格与并发快照。
func HubSessionBootstrap(c *gin.Context) {
	request, err := parseHubSessionBootstrapRequest(c)
	if err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}

	user, authSource, oidcClientID, err := resolveHubBootstrapUser(c.GetHeader("Authorization"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "invalid authorization token",
		})
		return
	}
	if user.Status != common.UserStatusEnabled {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "user is disabled",
		})
		return
	}

	systemAccessToken, systemTokenCreated, err := ensureUserSystemAccessToken(user)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	hubTokenName := resolveHubTokenName(request, oidcClientID)
	hubToken, apiTokenCreated, apiTokenProvisioning, err := ensureHubAPIToken(user.Id, hubTokenName)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	latestUser, err := model.GetUserById(user.Id, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	latestUser.SetAccessToken(systemAccessToken)

	models, err := collectHubUserModels(latestUser.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	entitlements, hasNovelProduct, err := loadHubEntitlements(latestUser.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	concurrencySnapshot, err := service.GetUserConcurrencySnapshot(latestUser.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	baseURL := strings.TrimSuffix(getOIDCIssuer(c), "/")

	common.ApiSuccess(c, gin.H{
		"auth_source":                   authSource,
		"oidc_client_id":                oidcClientID,
		"system_access_token":           systemAccessToken,
		"system_access_token_created":   systemTokenCreated,
		"system_access_token_bearer":    "Bearer " + systemAccessToken,
		"hub_api_token":                 buildHubAPITokenResponse(hubToken, apiTokenCreated, apiTokenProvisioning),
		"user":                          buildHubSelfUserResponse(latestUser),
		"user_raw":                      buildHubRawUser(latestUser),
		"models":                        models,
		"entitlements":                  entitlements,
		"has_novel_product_entitlement": hasNovelProduct,
		"concurrency":                   concurrencySnapshot,
		"quick_start": gin.H{
			"api_base_url":        baseURL + "/api",
			"relay_base_url":      baseURL + "/v1",
			"hub_bootstrap_url":   baseURL + "/api/hub/session/bootstrap",
			"hub_user_self_url":   baseURL + "/api/hub/user/self",
			"hub_user_models_url": baseURL + "/api/hub/user/models",
			"oidc_authorize_url":  baseURL + "/oauth/authorize",
			"oidc_token_url":      baseURL + "/oauth/token",
			"oidc_userinfo_url":   baseURL + "/oauth/userinfo",
		},
	})
}

func parseHubSessionBootstrapRequest(c *gin.Context) (*hubSessionBootstrapRequest, error) {
	request := &hubSessionBootstrapRequest{}
	if c.Request == nil || c.Request.Body == nil {
		return request, nil
	}
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return nil, err
	}
	if len(strings.TrimSpace(string(payload))) == 0 {
		return request, nil
	}
	if err = common.Unmarshal(payload, request); err != nil {
		return nil, err
	}
	return request, nil
}

func resolveHubBootstrapUser(authorization string) (*model.User, string, string, error) {
	authHeader := strings.TrimSpace(authorization)
	if authHeader == "" {
		return nil, "", "", nil
	}

	normalizedForSystemToken := authHeader
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		normalizedForSystemToken = "Bearer " + strings.TrimSpace(authHeader[7:])
	}

	user, err := model.ValidateAccessToken(normalizedForSystemToken)
	if err != nil {
		return nil, "", "", err
	}
	if user != nil {
		return user, hubAuthSourceSystemAccessToken, "", nil
	}

	bearerToken := extractBearerToken(normalizedForSystemToken)
	if bearerToken == "" {
		return nil, "", "", nil
	}
	oidcToken, err := model.GetOIDCTokenByAccessToken(bearerToken)
	if err != nil {
		return nil, "", "", nil
	}
	user, err = model.GetUserById(oidcToken.UserID, false)
	if err != nil {
		return nil, "", "", err
	}
	return user, hubAuthSourceOIDCAccessToken, oidcToken.ClientID, nil
}

func ensureUserSystemAccessToken(user *model.User) (string, bool, error) {
	if user == nil || user.Id <= 0 {
		return "", false, errors.New("invalid user")
	}
	existingToken := strings.TrimSpace(user.GetAccessToken())
	if existingToken != "" {
		return existingToken, false, nil
	}

	for i := 0; i < 5; i++ {
		randI := common.GetRandomInt(4)
		token, err := common.GenerateRandomKey(29 + randI)
		if err != nil {
			return "", false, err
		}
		result := model.DB.Model(&model.User{}).
			Where("id = ? AND (access_token IS NULL OR access_token = '')", user.Id).
			Update("access_token", token)
		if result.Error != nil {
			continue
		}
		if result.RowsAffected > 0 {
			user.SetAccessToken(token)
			return token, true, nil
		}

		latest, err := model.GetUserById(user.Id, false)
		if err != nil {
			return "", false, err
		}
		if latestToken := strings.TrimSpace(latest.GetAccessToken()); latestToken != "" {
			user.SetAccessToken(latestToken)
			return latestToken, false, nil
		}
	}
	return "", false, errors.New("failed to allocate system access token")
}

func resolveHubTokenName(request *hubSessionBootstrapRequest, oidcClientID string) string {
	if request != nil {
		if customTokenName := strings.TrimSpace(request.TokenName); customTokenName != "" {
			return truncateStringByRune(customTokenName, hubTokenNameMaxLength)
		}
	}
	identifier := ""
	if request != nil {
		identifier = strings.TrimSpace(request.ClientID)
		if identifier == "" {
			identifier = strings.TrimSpace(request.SiteName)
		}
	}
	if identifier == "" {
		identifier = strings.TrimSpace(oidcClientID)
	}
	if identifier == "" {
		identifier = "default"
	}

	cleanIdentifier := strings.NewReplacer(
		" ", "_",
		"/", "_",
		"\\", "_",
		":", "_",
		";", "_",
	).Replace(identifier)
	tokenName := fmt.Sprintf("%s%s", hubTokenNamePrefix, cleanIdentifier)
	return truncateStringByRune(tokenName, hubTokenNameMaxLength)
}

func ensureHubAPIToken(userID int, tokenName string) (*model.Token, bool, string, error) {
	if userID <= 0 {
		return nil, false, "", errors.New("invalid user id")
	}
	tokenName = strings.TrimSpace(tokenName)
	if tokenName == "" {
		tokenName = hubTokenNamePrefix + "default"
	}

	existing, err := getUserTokenByName(userID, tokenName)
	if err == nil {
		return existing, false, "reuse_named_token", nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, "", err
	}

	maxUserTokens := operation_setting.GetMaxUserTokens()
	tokenCount, err := model.CountUserTokens(userID)
	if err != nil {
		return nil, false, "", err
	}
	if maxUserTokens > 0 && int(tokenCount) >= maxUserTokens {
		reusableToken, reuseErr := getLatestReusableUserToken(userID)
		if reuseErr != nil {
			return nil, false, "", reuseErr
		}
		return reusableToken, false, "reuse_existing_when_reach_limit", nil
	}

	for i := 0; i < 3; i++ {
		key, keyErr := common.GenerateKey()
		if keyErr != nil {
			return nil, false, "", keyErr
		}
		now := common.GetTimestamp()
		token := &model.Token{
			UserId:             userID,
			Name:               tokenName,
			Key:                key,
			CreatedTime:        now,
			AccessedTime:       now,
			ExpiredTime:        -1,
			RemainQuota:        0,
			UnlimitedQuota:     true,
			ModelLimitsEnabled: false,
		}
		if setting.DefaultUseAutoGroup {
			token.Group = "auto"
		}
		if insertErr := token.Insert(); insertErr != nil {
			if i == 2 {
				return nil, false, "", insertErr
			}
			continue
		}
		return token, true, "created", nil
	}
	return nil, false, "", errors.New("failed to provision hub api token")
}

func getUserTokenByName(userID int, tokenName string) (*model.Token, error) {
	var token model.Token
	err := model.DB.Where("user_id = ? AND name = ?", userID, tokenName).Order("id desc").First(&token).Error
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func getLatestReusableUserToken(userID int) (*model.Token, error) {
	var token model.Token
	err := model.DB.Where("user_id = ? AND status = ?", userID, common.TokenStatusEnabled).Order("id desc").First(&token).Error
	if err == nil {
		return &token, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	err = model.DB.Where("user_id = ?", userID).Order("id desc").First(&token).Error
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func collectHubUserModels(userID int) ([]string, error) {
	hasNovelProduct, err := model.HasActiveProductEntitlement(userID, common.ProductKeyNovel)
	if err != nil {
		return nil, err
	}
	if !hasNovelProduct {
		return []string{}, nil
	}
	user, err := model.GetUserCache(userID)
	if err != nil {
		return nil, err
	}
	groups := service.GetUserUsableGroups(user.Group)
	models := make([]string, 0)
	for group := range groups {
		for _, modelName := range model.GetGroupEnabledModels(group) {
			if !common.StringsContains(models, modelName) {
				models = append(models, modelName)
			}
		}
	}
	sort.Strings(models)
	return models, nil
}

func loadHubEntitlements(userID int) ([]gin.H, bool, error) {
	entitlements, err := model.GetUserProductEntitlements(userID)
	if err != nil {
		return nil, false, err
	}
	hasNovelProduct, err := model.HasActiveProductEntitlement(userID, common.ProductKeyNovel)
	if err != nil {
		return nil, false, err
	}
	items := make([]gin.H, 0, len(entitlements))
	for _, entitlement := range entitlements {
		items = append(items, gin.H{
			"id":          entitlement.Id,
			"user_id":     entitlement.UserId,
			"product_key": entitlement.ProductKey,
			"status":      entitlement.Status,
			"source_type": entitlement.SourceType,
			"source_id":   entitlement.SourceId,
			"granted_at":  entitlement.GrantedAt,
			"expires_at":  entitlement.ExpiresAt,
			"notes":       entitlement.Notes,
		})
	}
	return items, hasNovelProduct, nil
}

func buildHubSelfUserResponse(user *model.User) gin.H {
	if user == nil {
		return gin.H{}
	}
	userSetting := user.GetSetting()
	responseData := gin.H{
		"id":                   user.Id,
		"username":             user.Username,
		"display_name":         user.DisplayName,
		"role":                 user.Role,
		"status":               user.Status,
		"email":                user.Email,
		"github_id":            user.GitHubId,
		"discord_id":           user.DiscordId,
		"oidc_id":              user.OidcId,
		"wechat_id":            user.WeChatId,
		"telegram_id":          user.TelegramId,
		"group":                user.Group,
		"quota":                user.Quota,
		"used_quota":           user.UsedQuota,
		"request_count":        user.RequestCount,
		"aff_code":             user.AffCode,
		"aff_count":            user.AffCount,
		"aff_quota":            user.AffQuota,
		"aff_history_quota":    user.AffHistoryQuota,
		"inviter_id":           user.InviterId,
		"linux_do_id":          user.LinuxDOId,
		"setting":              user.Setting,
		"concurrency_override": user.ConcurrencyOverride,
		"stripe_customer":      user.StripeCustomer,
		"sidebar_modules":      userSetting.SidebarModules,
		"permissions":          calculateUserPermissions(user.Role),
		"access_token":         user.GetAccessToken(),
	}
	if snapshot, snapErr := service.BuildUserConcurrencySnapshot(user, common.GetTimestamp()); snapErr == nil {
		responseData["effective_concurrency_limit"] = snapshot.EffectiveLimit
		responseData["global_default_concurrency"] = snapshot.GlobalDefault
		responseData["code_stack_concurrency"] = snapshot.CodeStackTotal
		responseData["code_override_concurrency"] = snapshot.CodeOverrideValue
	}
	return responseData
}

func buildHubRawUser(user *model.User) gin.H {
	if user == nil {
		return gin.H{}
	}
	raw := gin.H{}
	payload, err := common.Marshal(user)
	if err != nil {
		return gin.H{
			"id":           user.Id,
			"username":     user.Username,
			"display_name": user.DisplayName,
			"role":         user.Role,
			"status":       user.Status,
			"email":        user.Email,
			"group":        user.Group,
			"quota":        user.Quota,
			"used_quota":   user.UsedQuota,
			"access_token": user.GetAccessToken(),
		}
	}
	if err = common.Unmarshal(payload, &raw); err != nil {
		return gin.H{
			"id":           user.Id,
			"username":     user.Username,
			"display_name": user.DisplayName,
			"role":         user.Role,
			"status":       user.Status,
			"email":        user.Email,
			"group":        user.Group,
			"quota":        user.Quota,
			"used_quota":   user.UsedQuota,
			"access_token": user.GetAccessToken(),
		}
	}
	delete(raw, "password")
	delete(raw, "original_password")
	delete(raw, "verification_code")
	raw["access_token"] = user.GetAccessToken()
	return raw
}

func buildHubAPITokenResponse(token *model.Token, created bool, provisioning string) gin.H {
	if token == nil {
		return gin.H{
			"created":      created,
			"provisioning": provisioning,
		}
	}
	fullKey := token.GetFullKey()
	return gin.H{
		"id":              token.Id,
		"name":            token.Name,
		"status":          token.Status,
		"group":           token.Group,
		"created":         created,
		"provisioning":    provisioning,
		"key":             fullKey,
		"sk_key":          "sk-" + fullKey,
		"authorization":   "Bearer " + fullKey,
		"model_limits":    token.GetModelLimitsMap(),
		"unlimited_quota": token.UnlimitedQuota,
		"remain_quota":    token.RemainQuota,
	}
}

func truncateStringByRune(input string, maxRuneLength int) string {
	if maxRuneLength <= 0 {
		return ""
	}
	if utf8.RuneCountInString(input) <= maxRuneLength {
		return input
	}
	runes := []rune(input)
	return string(runes[:maxRuneLength])
}
