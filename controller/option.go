package controller

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

var completionRatioMetaOptionKeys = []string{
	"ModelPrice",
	"ModelRatio",
	"CompletionRatio",
	"CacheRatio",
	"CreateCacheRatio",
	"ImageRatio",
	"AudioRatio",
	"AudioCompletionRatio",
}

var checkinQuotaAmountOptionKeys = map[string]struct{}{
	"checkin_setting.entry_min_balance_quota":    {},
	"checkin_setting.entry_max_balance_quota":    {},
	"checkin_setting.entry_min_quota":            {},
	"checkin_setting.entry_max_quota":            {},
	"checkin_setting.min_quota":                  {},
	"checkin_setting.max_quota":                  {},
	"checkin_setting.basic_min_balance_quota":    {},
	"checkin_setting.basic_max_balance_quota":    {},
	"checkin_setting.advanced_min_balance_quota": {},
	"checkin_setting.advanced_max_balance_quota": {},
	"checkin_setting.advanced_min_quota":         {},
	"checkin_setting.advanced_max_quota":         {},
	"checkin_setting.weekly_reward_cap_quota":    {},
}

type checkinRewardBandAmount struct {
	MinQuota float64 `json:"min_quota"`
	MaxQuota float64 `json:"max_quota"`
	Weight   int     `json:"weight"`
}

func isCheckinQuotaAmountOptionKey(key string) bool {
	_, ok := checkinQuotaAmountOptionKeys[key]
	return ok
}

func amountToQuotaValue(amount float64) int {
	if math.IsNaN(amount) || math.IsInf(amount, 0) || amount <= 0 {
		return 0
	}
	quota := math.Round(amount * common.QuotaPerUnit)
	if quota <= 0 {
		return 0
	}
	return int(quota)
}

func looksLikeLegacyQuotaValue(value float64) bool {
	if common.QuotaPerUnit <= 0 {
		return value > 10000
	}
	return value > common.QuotaPerUnit
}

func quotaToAmountValue(quota float64) float64 {
	if math.IsNaN(quota) || math.IsInf(quota, 0) || quota <= 0 {
		return 0
	}
	if common.QuotaPerUnit <= 0 {
		return quota
	}
	amount := quota / common.QuotaPerUnit
	return math.Round(amount*10000) / 10000
}

func normalizeAmountString(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

func convertCheckinOptionValueForDisplay(key string, rawValue string) (string, error) {
	switch key {
	case "checkin_setting.entry_reward_bands",
		"checkin_setting.basic_reward_bands",
		"checkin_setting.advanced_reward_bands":
		var bands []operation_setting.CheckinRewardBand
		if err := common.UnmarshalJsonStr(rawValue, &bands); err != nil {
			return "", err
		}
		amountBands := make([]checkinRewardBandAmount, 0, len(bands))
		for i := range bands {
			amountBands = append(amountBands, checkinRewardBandAmount{
				MinQuota: quotaToAmountValue(float64(bands[i].MinQuota)),
				MaxQuota: quotaToAmountValue(float64(bands[i].MaxQuota)),
				Weight:   bands[i].Weight,
			})
		}
		payload, err := common.Marshal(amountBands)
		if err != nil {
			return "", err
		}
		return string(payload), nil
	default:
		if !isCheckinQuotaAmountOptionKey(key) {
			return rawValue, nil
		}
		quotaValue, err := strconv.ParseFloat(rawValue, 64)
		if err != nil {
			return "", err
		}
		amountValue := quotaToAmountValue(quotaValue)
		return normalizeAmountString(amountValue), nil
	}
}

func convertCheckinOptionValueToStorage(key string, displayValue string) (string, error) {
	switch key {
	case "checkin_setting.entry_reward_bands",
		"checkin_setting.basic_reward_bands",
		"checkin_setting.advanced_reward_bands":
		var amountBands []checkinRewardBandAmount
		if err := common.UnmarshalJsonStr(displayValue, &amountBands); err != nil {
			var quotaBands []operation_setting.CheckinRewardBand
			// 兼容旧客户端直接传 quota 的情况
			if legacyErr := common.UnmarshalJsonStr(displayValue, &quotaBands); legacyErr == nil {
				payload, marshalErr := common.Marshal(quotaBands)
				if marshalErr != nil {
					return "", marshalErr
				}
				return string(payload), nil
			}
			return "", err
		}
		quotaBands := make([]operation_setting.CheckinRewardBand, 0, len(amountBands))
		useLegacyQuota := false
		for i := range amountBands {
			if looksLikeLegacyQuotaValue(amountBands[i].MinQuota) || looksLikeLegacyQuotaValue(amountBands[i].MaxQuota) {
				useLegacyQuota = true
				break
			}
		}
		for i := range amountBands {
			minQuota := amountToQuotaValue(amountBands[i].MinQuota)
			maxQuota := amountToQuotaValue(amountBands[i].MaxQuota)
			if useLegacyQuota {
				minQuota = int(math.Round(amountBands[i].MinQuota))
				maxQuota = int(math.Round(amountBands[i].MaxQuota))
			}
			quotaBands = append(quotaBands, operation_setting.CheckinRewardBand{
				MinQuota: minQuota,
				MaxQuota: maxQuota,
				Weight:   amountBands[i].Weight,
			})
		}
		payload, err := common.Marshal(quotaBands)
		if err != nil {
			return "", err
		}
		return string(payload), nil
	default:
		if !isCheckinQuotaAmountOptionKey(key) {
			return displayValue, nil
		}
		amountValue, err := strconv.ParseFloat(displayValue, 64)
		if err != nil {
			return "", err
		}
		if looksLikeLegacyQuotaValue(amountValue) {
			return strconv.Itoa(int(math.Round(amountValue))), nil
		}
		quotaValue := amountToQuotaValue(amountValue)
		return strconv.Itoa(quotaValue), nil
	}
}

func isVisiblePublicKeyOption(key string) bool {
	switch key {
	case "WaffoPancakeWebhookPublicKey", "WaffoPancakeWebhookTestKey":
		return true
	default:
		return false
	}
}

func collectModelNamesFromOptionValue(raw string, modelNames map[string]struct{}) {
	if strings.TrimSpace(raw) == "" {
		return
	}

	var parsed map[string]any
	if err := common.UnmarshalJsonStr(raw, &parsed); err != nil {
		return
	}

	for modelName := range parsed {
		modelNames[modelName] = struct{}{}
	}
}

func buildCompletionRatioMetaValue(optionValues map[string]string) string {
	modelNames := make(map[string]struct{})
	for _, key := range completionRatioMetaOptionKeys {
		collectModelNamesFromOptionValue(optionValues[key], modelNames)
	}

	meta := make(map[string]ratio_setting.CompletionRatioInfo, len(modelNames))
	for modelName := range modelNames {
		meta[modelName] = ratio_setting.GetCompletionRatioInfo(modelName)
	}

	jsonBytes, err := common.Marshal(meta)
	if err != nil {
		return "{}"
	}
	return string(jsonBytes)
}

func validateCheckinOptionValue(key string, value string) error {
	const maxCheckinQuotaValue = 2_000_000_000
	const maxCheckinIntervalHours = 24 * 365

	candidate := operation_setting.GetNormalizedCheckinSetting()

	parseIntWithRange := func(minAllowed int, maxAllowed int) (int, error) {
		intValue, err := strconv.Atoi(value)
		if err != nil {
			// 兼容数据库中可能存在的 "2.000000" 这类值
			floatValue, floatErr := strconv.ParseFloat(value, 64)
			if floatErr != nil {
				return 0, fmt.Errorf("签到配置 %s 需要为整数", key)
			}
			intValue = int(floatValue)
		}
		if intValue < minAllowed {
			return 0, fmt.Errorf("签到配置 %s 不能小于 %d", key, minAllowed)
		}
		if intValue > maxAllowed {
			return 0, fmt.Errorf("签到配置 %s 不能大于 %d", key, maxAllowed)
		}
		return intValue, nil
	}

	switch key {
	case "checkin_setting.enabled":
		enabled, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("签到配置 %s 需要为布尔值", key)
		}
		candidate.Enabled = enabled
	case "checkin_setting.advanced_enabled":
		enabled, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("签到配置 %s 需要为布尔值", key)
		}
		candidate.AdvancedEnabled = enabled
	case "checkin_setting.entry_min_balance_quota",
		"checkin_setting.entry_max_balance_quota",
		"checkin_setting.entry_min_quota",
		"checkin_setting.entry_max_quota",
		"checkin_setting.min_quota",
		"checkin_setting.max_quota",
		"checkin_setting.basic_min_balance_quota",
		"checkin_setting.basic_max_balance_quota",
		"checkin_setting.advanced_min_balance_quota",
		"checkin_setting.advanced_max_balance_quota",
		"checkin_setting.advanced_min_quota",
		"checkin_setting.advanced_max_quota",
		"checkin_setting.weekly_reward_cap_quota":
		intValue, err := parseIntWithRange(0, maxCheckinQuotaValue)
		if err != nil {
			return err
		}
		switch key {
		case "checkin_setting.entry_min_balance_quota":
			candidate.EntryMinBalanceQuota = intValue
		case "checkin_setting.entry_max_balance_quota":
			candidate.EntryMaxBalanceQuota = intValue
		case "checkin_setting.entry_min_quota":
			candidate.EntryMinQuota = intValue
		case "checkin_setting.entry_max_quota":
			candidate.EntryMaxQuota = intValue
		case "checkin_setting.min_quota":
			candidate.MinQuota = intValue
		case "checkin_setting.max_quota":
			candidate.MaxQuota = intValue
		case "checkin_setting.basic_min_balance_quota":
			candidate.BasicMinBalanceQuota = intValue
		case "checkin_setting.basic_max_balance_quota":
			candidate.BasicMaxBalanceQuota = intValue
		case "checkin_setting.advanced_min_balance_quota":
			candidate.AdvancedMinBalanceQuota = intValue
		case "checkin_setting.advanced_max_balance_quota":
			candidate.AdvancedMaxBalanceQuota = intValue
		case "checkin_setting.advanced_min_quota":
			candidate.AdvancedMinQuota = intValue
		case "checkin_setting.advanced_max_quota":
			candidate.AdvancedMaxQuota = intValue
		case "checkin_setting.weekly_reward_cap_quota":
			candidate.WeeklyRewardCapQuota = intValue
		}
	case "checkin_setting.entry_reward_bands":
		var bands []operation_setting.CheckinRewardBand
		if err := common.UnmarshalJsonStr(value, &bands); err != nil {
			return fmt.Errorf("签到配置 %s 需要为合法 JSON", key)
		}
		candidate.EntryRewardBands = bands
	case "checkin_setting.basic_reward_bands":
		var bands []operation_setting.CheckinRewardBand
		if err := common.UnmarshalJsonStr(value, &bands); err != nil {
			return fmt.Errorf("签到配置 %s 需要为合法 JSON", key)
		}
		candidate.BasicRewardBands = bands
	case "checkin_setting.advanced_reward_bands":
		var bands []operation_setting.CheckinRewardBand
		if err := common.UnmarshalJsonStr(value, &bands); err != nil {
			return fmt.Errorf("签到配置 %s 需要为合法 JSON", key)
		}
		candidate.AdvancedRewardBands = bands
	case "checkin_setting.min_interval_hours":
		intValue, err := parseIntWithRange(0, maxCheckinIntervalHours)
		if err != nil {
			return err
		}
		candidate.MinIntervalHours = intValue
	case "checkin_setting.reward_rule":
		if !operation_setting.IsValidCheckinRewardRule(value) {
			return fmt.Errorf("签到配置 reward_rule 非法，仅支持 %s / %s",
				operation_setting.CheckinRewardRuleHighestEligible,
				operation_setting.CheckinRewardRuleLowestEligible)
		}
		candidate.RewardRule = value
	}

	if candidate.EntryMaxQuota < candidate.EntryMinQuota {
		return errors.New("基础签到最大奖励不能小于最小奖励")
	}
	if candidate.EntryMaxBalanceQuota > 0 && candidate.EntryMaxBalanceQuota < candidate.EntryMinBalanceQuota {
		return errors.New("基础签到余额上限不能低于基础签到余额门槛")
	}
	if candidate.BasicMinBalanceQuota < candidate.EntryMinBalanceQuota {
		return errors.New("中级签到余额门槛不能低于基础签到余额门槛")
	}
	if candidate.MaxQuota < candidate.MinQuota {
		return errors.New("中级签到最大奖励不能小于最小奖励")
	}
	if candidate.BasicMaxBalanceQuota > 0 && candidate.BasicMaxBalanceQuota < candidate.BasicMinBalanceQuota {
		return errors.New("中级签到余额上限不能低于中级签到余额门槛")
	}
	if candidate.AdvancedEnabled {
		if candidate.AdvancedMinBalanceQuota < candidate.BasicMinBalanceQuota {
			return errors.New("高级签到余额门槛不能低于中级签到余额门槛")
		}
		if candidate.AdvancedMaxBalanceQuota > 0 &&
			candidate.AdvancedMaxBalanceQuota < candidate.AdvancedMinBalanceQuota {
			return errors.New("高级签到余额上限不能低于高级签到余额门槛")
		}
		if candidate.AdvancedMaxQuota < candidate.AdvancedMinQuota {
			return errors.New("高级签到最大奖励不能小于最小奖励")
		}
	}
	if candidate.WeeklyRewardCapQuota > 0 &&
		candidate.WeeklyRewardCapQuota < candidate.EntryMinQuota {
		return errors.New("每周奖励封顶不能低于基础签到最小奖励")
	}

	switch key {
	case "checkin_setting.entry_reward_bands":
		if err := operation_setting.ValidateCheckinRewardBands(
			candidate.EntryRewardBands,
			candidate.EntryMinQuota,
			candidate.EntryMaxQuota,
		); err != nil {
			return fmt.Errorf("基础签到奖励分布校验失败：%w", err)
		}
	case "checkin_setting.basic_reward_bands":
		if err := operation_setting.ValidateCheckinRewardBands(
			candidate.BasicRewardBands,
			candidate.MinQuota,
			candidate.MaxQuota,
		); err != nil {
			return fmt.Errorf("中级签到奖励分布校验失败：%w", err)
		}
	case "checkin_setting.advanced_reward_bands":
		if err := operation_setting.ValidateCheckinRewardBands(
			candidate.AdvancedRewardBands,
			candidate.AdvancedMinQuota,
			candidate.AdvancedMaxQuota,
		); err != nil {
			return fmt.Errorf("高级签到奖励分布校验失败：%w", err)
		}
	}

	return nil
}

func validateLotteryOptionValue(key string, value string) error {
	switch key {
	case "lottery_setting.enabled":
		if _, err := strconv.ParseBool(value); err != nil {
			return fmt.Errorf("抽奖配置 %s 需要为布尔值", key)
		}
	case "lottery_setting.basic_tier_multiplier",
		"lottery_setting.medium_tier_multiplier",
		"lottery_setting.advanced_tier_multiplier":
		floatValue, err := strconv.ParseFloat(value, 64)
		if err != nil || math.IsNaN(floatValue) || math.IsInf(floatValue, 0) {
			return fmt.Errorf("抽奖配置 %s 需要为合法数字", key)
		}
		if floatValue <= 0 {
			return fmt.Errorf("抽奖配置 %s 必须大于 0", key)
		}
		if floatValue > 100 {
			return fmt.Errorf("抽奖配置 %s 不能大于 100", key)
		}
	}
	return nil
}

func GetOptions(c *gin.Context) {
	var options []*model.Option
	optionValues := make(map[string]string)
	common.OptionMapRWMutex.Lock()
	for k, v := range common.OptionMap {
		value := common.Interface2String(v)
		displayValue := value
		if strings.HasPrefix(k, "checkin_setting.") {
			if converted, convertErr := convertCheckinOptionValueForDisplay(k, value); convertErr == nil {
				displayValue = converted
			}
		}
		if k == "SMTPProvidersPreview" {
			providers, parseErr := common.ParseSMTPProvidersFromJSONString(value)
			if parseErr == nil {
				sanitized := common.SanitizeSMTPProvidersForDisplay(providers)
				payload, marshalErr := common.Marshal(sanitized)
				if marshalErr == nil {
					displayValue = string(payload)
				}
			}
		}
		isSensitiveKey := strings.HasSuffix(k, "Token") ||
			k == "SMTPProviders" ||
			k == common.SMTPProviderUsageStatsOptionKey ||
			strings.HasSuffix(k, "Secret") ||
			strings.HasSuffix(k, "Key") ||
			strings.HasSuffix(k, "secret") ||
			strings.HasSuffix(k, "api_key")
		if isSensitiveKey && !isVisiblePublicKeyOption(k) {
			continue
		}
		options = append(options, &model.Option{
			Key:   k,
			Value: displayValue,
		})
		for _, optionKey := range completionRatioMetaOptionKeys {
			if optionKey == k {
				optionValues[k] = value
				break
			}
		}
	}
	common.OptionMapRWMutex.Unlock()
	options = append(options, &model.Option{
		Key:   "CompletionRatioMeta",
		Value: buildCompletionRatioMetaValue(optionValues),
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    options,
	})
	return
}

type OptionUpdateRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

func UpdateOption(c *gin.Context) {
	var option OptionUpdateRequest
	err := common.DecodeJson(c.Request.Body, &option)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	switch option.Value.(type) {
	case bool:
		option.Value = common.Interface2String(option.Value.(bool))
	case float64:
		option.Value = common.Interface2String(option.Value.(float64))
	case int:
		option.Value = common.Interface2String(option.Value.(int))
	default:
		option.Value = fmt.Sprintf("%v", option.Value)
	}
	originalOptionValue := option.Value.(string)

	if strings.HasPrefix(option.Key, "checkin_setting.") {
		convertedValue, convertErr := convertCheckinOptionValueToStorage(option.Key, originalOptionValue)
		if convertErr != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": fmt.Sprintf("签到配置 %s 格式错误，请输入元金额", option.Key),
			})
			return
		}
		option.Value = convertedValue
	}

	switch option.Key {
	case "GitHubOAuthEnabled":
		if option.Value == "true" && common.GitHubClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 GitHub OAuth，请先填入 GitHub Client Id 以及 GitHub Client Secret！",
			})
			return
		}
	case "discord.enabled":
		if option.Value == "true" && system_setting.GetDiscordSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Discord OAuth，请先填入 Discord Client Id 以及 Discord Client Secret！",
			})
			return
		}
	case "oidc.enabled":
		if option.Value == "true" && system_setting.GetOIDCSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 OIDC 登录，请先填入 OIDC Client Id 以及 OIDC Client Secret！",
			})
			return
		}
	case "LinuxDOOAuthEnabled":
		if option.Value == "true" && common.LinuxDOClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 LinuxDO OAuth，请先填入 LinuxDO Client Id 以及 LinuxDO Client Secret！",
			})
			return
		}
	case "EmailDomainRestrictionEnabled":
		if option.Value == "true" && len(common.EmailDomainWhitelist) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用邮箱域名限制，请先填入限制的邮箱域名！",
			})
			return
		}
	case "QQNumericMailboxOnlyEnabled":
		if option.Value == "true" && !containsDomain(common.EmailDomainWhitelist, "qq.com") {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用纯数字 QQ 邮箱限制，请先在邮箱域名白名单中加入 qq.com！",
			})
			return
		}
	case "WeChatAuthEnabled":
		if option.Value == "true" && common.WeChatServerAddress == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用微信登录，请先填入微信登录相关配置信息！",
			})
			return
		}
	case "TurnstileCheckEnabled":
		if option.Value == "true" && common.TurnstileSiteKey == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Turnstile 校验，请先填入 Turnstile 校验相关配置信息！",
			})

			return
		}
	case "TelegramOAuthEnabled":
		if option.Value == "true" && common.TelegramBotToken == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Telegram OAuth，请先填入 Telegram Bot Token！",
			})
			return
		}
	case "theme.frontend":
		if option.Value != "default" && option.Value != "classic" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无效的主题值，可选值：default（新版前端）、classic（经典前端）",
			})
			return
		}
	case "GroupRatio":
		err = ratio_setting.CheckGroupRatio(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "ImageRatio":
		err = ratio_setting.UpdateImageRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "图片倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioRatio":
		err = ratio_setting.UpdateAudioRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioCompletionRatio":
		err = ratio_setting.UpdateAudioCompletionRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频补全倍率设置失败: " + err.Error(),
			})
			return
		}
	case "CreateCacheRatio":
		err = ratio_setting.UpdateCreateCacheRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "缓存创建倍率设置失败: " + err.Error(),
			})
			return
		}
	case "ModelRequestRateLimitGroup":
		err = setting.CheckModelRequestRateLimitGroup(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "GlobalDefaultConcurrency":
		err = setting.ValidateGlobalDefaultConcurrency(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "ConcurrencyCodeOverridePolicy":
		err = setting.ValidateConcurrencyCodeOverridePolicy(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "ConcurrencyCounterTtlSeconds":
		err = setting.ValidateConcurrencyCounterTtlSeconds(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "ConcurrencyQueueWaitMs":
		err = setting.ValidateConcurrencyQueueWaitMs(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "AutomaticDisableStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "AutomaticRetryStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.api_info":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "ApiInfo")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.announcements":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "Announcements")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.faq":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "FAQ")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.uptime_kuma_groups":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "UptimeKumaGroups")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "SMTPProviders":
		providers, parseErr := common.ParseSMTPProvidersFromJSONString(option.Value.(string))
		if parseErr != nil {
			err = parseErr
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "SMTPProviders 配置格式错误: " + err.Error(),
			})
			return
		}
		if len(providers) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "SMTPProviders 至少需要一个账号",
			})
			return
		}
		for i := range providers {
			if providers[i].Weight <= 0 {
				providers[i].Weight = common.DefaultSMTPProviderWeight
			}
			if providers[i].CooldownSecond <= 0 {
				providers[i].CooldownSecond = common.DefaultSMTPProviderFailureCooldownSecond
			}
		}
		resolvedProviders := common.ResolveSMTPProvidersForUpdate(
			providers,
			common.GetSMTPProvidersSnapshot(),
		)
		// 保留真实 token 到数据库，重启后才能恢复 SMTP 发送能力。
		// 对外展示由 SMTPProvidersPreview（脱敏）承担。
		payload, marshalErr := common.Marshal(resolvedProviders)
		if marshalErr != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "SMTPProviders 序列化失败: " + marshalErr.Error(),
			})
			return
		}
		option.Value = string(payload)
	case common.SMTPProviderUsageStatsOptionKey:
		_, err = common.ParseSMTPProviderUsageStatsFromJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "SMTPProviderUsageStats 配置格式错误: " + err.Error(),
			})
			return
		}
	case "SMTPMonthlyLimit":
		limit, parseErr := strconv.Atoi(strings.TrimSpace(option.Value.(string)))
		if parseErr != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "SMTPMonthlyLimit 必须为正整数",
			})
			return
		}
		if limit <= 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "SMTPMonthlyLimit 必须大于 0",
			})
			return
		}
	case "EmailVerificationIPRateLimitNum":
		limit, parseErr := strconv.Atoi(strings.TrimSpace(option.Value.(string)))
		if parseErr != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "同一IP可发次数必须为整数",
			})
			return
		}
		if limit < 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "同一IP可发次数不能小于 0",
			})
			return
		}
	case "EmailVerificationIPRateLimitDuration":
		seconds, parseErr := strconv.ParseInt(strings.TrimSpace(option.Value.(string)), 10, 64)
		if parseErr != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "IP 限制时间窗口必须为整数秒",
			})
			return
		}
		if seconds < 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "IP 限制时间窗口不能小于 0",
			})
			return
		}
	case "EmailVerificationEmailCooldownSeconds":
		seconds, parseErr := strconv.ParseInt(strings.TrimSpace(option.Value.(string)), 10, 64)
		if parseErr != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "同一邮箱冷却时间必须为整数秒",
			})
			return
		}
		if seconds < 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "同一邮箱冷却时间不能小于 0",
			})
			return
		}
	case "EmailVerificationDailyLimit":
		limit, parseErr := strconv.Atoi(strings.TrimSpace(option.Value.(string)))
		if parseErr != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "每天总上限必须为整数",
			})
			return
		}
		if limit < 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "每天总上限不能小于 0",
			})
			return
		}
	}

	if strings.HasPrefix(option.Key, "checkin_setting.") {
		err = validateCheckinOptionValue(option.Key, option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	}
	if strings.HasPrefix(option.Key, "lottery_setting.") {
		err = validateLotteryOptionValue(option.Key, option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	}

	err = model.UpdateOption(option.Key, option.Value.(string))
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if strings.HasPrefix(option.Key, "checkin_setting.") {
		adminId := c.GetInt("id")
		model.RecordLogWithAdminInfo(adminId, model.LogTypeManage,
			fmt.Sprintf("更新签到配置 %s（元）= %s", option.Key, originalOptionValue),
			map[string]interface{}{
				"option_key":           option.Key,
				"option_value_display": originalOptionValue,
				"option_value_storage": option.Value.(string),
				"client_ip":            c.ClientIP(),
			},
		)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}

func containsDomain(domains []string, target string) bool {
	target = strings.ToLower(strings.TrimSpace(target))
	for _, domain := range domains {
		if strings.ToLower(strings.TrimSpace(domain)) == target {
			return true
		}
	}
	return false
}
