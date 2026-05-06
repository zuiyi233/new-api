package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

// GetCheckinStatus 获取用户签到状态和历史记录
func GetCheckinStatus(c *gin.Context) {
	setting := operation_setting.GetNormalizedCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}
	userId := c.GetInt("id")
	// 获取月份参数，默认为当前月份
	month := c.DefaultQuery("month", time.Now().Format("2006-01"))

	stats, err := model.GetUserCheckinStats(userId, month)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	currentQuota, err := model.GetUserQuota(userId, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取用户额度失败",
		})
		return
	}
	tiers, eligibility, eligibilityErr := model.BuildUserCheckinEligibilityWithCap(userId, currentQuota)
	if eligibilityErr != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取签到资格失败",
		})
		return
	}
	remainingCooldownSeconds, nextCheckinAt, cooldownErr := model.GetUserCheckinCooldown(userId, setting.MinIntervalHours)
	if cooldownErr != nil {
		remainingCooldownSeconds = 0
		nextCheckinAt = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"enabled":                    setting.Enabled,
			"entry_min_balance_quota":    setting.EntryMinBalanceQuota,
			"entry_max_balance_quota":    setting.EntryMaxBalanceQuota,
			"entry_min_quota":            setting.EntryMinQuota,
			"entry_max_quota":            setting.EntryMaxQuota,
			"entry_reward_bands":         setting.EntryRewardBands,
			"medium_min_balance_quota":   setting.BasicMinBalanceQuota,
			"medium_max_balance_quota":   setting.BasicMaxBalanceQuota,
			"medium_min_quota":           setting.MinQuota,
			"medium_max_quota":           setting.MaxQuota,
			"medium_reward_bands":        setting.BasicRewardBands,
			"min_quota":                  setting.MinQuota,
			"max_quota":                  setting.MaxQuota,
			"basic_min_balance_quota":    setting.BasicMinBalanceQuota,
			"basic_max_balance_quota":    setting.BasicMaxBalanceQuota,
			"basic_reward_bands":         setting.BasicRewardBands,
			"advanced_enabled":           setting.AdvancedEnabled,
			"advanced_min_balance_quota": setting.AdvancedMinBalanceQuota,
			"advanced_max_balance_quota": setting.AdvancedMaxBalanceQuota,
			"advanced_min_quota":         setting.AdvancedMinQuota,
			"advanced_max_quota":         setting.AdvancedMaxQuota,
			"advanced_reward_bands":      setting.AdvancedRewardBands,
			"min_interval_hours":         setting.MinIntervalHours,
			"weekly_reward_cap_quota":    setting.WeeklyRewardCapQuota,
			"reward_rule":                setting.RewardRule,
			"stats":                      stats,
			"tiers":                      tiers,
			"eligibility":                eligibility,
			"remaining_cooldown_seconds": remainingCooldownSeconds,
			"next_checkin_at":            nextCheckinAt,
		},
	})
}

// DoCheckin 执行用户签到
func DoCheckin(c *gin.Context) {
	setting := operation_setting.GetNormalizedCheckinSetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "签到功能未启用")
		return
	}

	userId := c.GetInt("id")

	checkin, err := model.UserCheckin(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	currentQuota, _ := model.GetUserQuota(userId, true)
	model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf("用户签到[%s]，获得额度 %s", checkin.CheckinTier, logger.LogQuota(checkin.QuotaAwarded)))
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "签到成功",
		"data": gin.H{
			"quota_awarded": checkin.QuotaAwarded,
			"checkin_date":  checkin.CheckinDate,
			"checkin_tier":  checkin.CheckinTier,
			"current_quota": currentQuota,
		},
	})
}
