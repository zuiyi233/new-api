package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type codeCenterStatsPayload struct {
	RegistrationCodes codeCenterCodeStats `json:"registration_codes"`
	SubscriptionCodes codeCenterCodeStats `json:"subscription_codes"`
}

type codeCenterCodeStats struct {
	Total    int64 `json:"total"`
	Enabled  int64 `json:"enabled"`
	Disabled int64 `json:"disabled"`
	Used     int64 `json:"used"`
	Expired  int64 `json:"expired"`
}

// GetCodeCenterStatsCompat provides a lightweight backend stats endpoint for
// code center pages that still call /api/code-center/stats.
func GetCodeCenterStatsCompat(c *gin.Context) {
	regTotal, regEnabled, regDisabled, regUsed, regExpired, err := countRegistrationCodeStats()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	subTotal, subEnabled, subDisabled, subUsed, subExpired, err := countSubscriptionCodeStats()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	common.ApiSuccess(c, codeCenterStatsPayload{
		RegistrationCodes: codeCenterCodeStats{
			Total:    regTotal,
			Enabled:  regEnabled,
			Disabled: regDisabled,
			Used:     regUsed,
			Expired:  regExpired,
		},
		SubscriptionCodes: codeCenterCodeStats{
			Total:    subTotal,
			Enabled:  subEnabled,
			Disabled: subDisabled,
			Used:     subUsed,
			Expired:  subExpired,
		},
	})
}

func countRegistrationCodeStats() (total int64, enabled int64, disabled int64, used int64, expired int64, err error) {
	now := common.GetTimestamp()
	base := model.DB.Model(&model.RegistrationCode{})

	if err = base.Count(&total).Error; err != nil {
		return
	}
	if err = base.Where("status = ?", common.RegistrationCodeStatusEnabled).Count(&enabled).Error; err != nil {
		return
	}
	if err = base.Where("status = ?", common.RegistrationCodeStatusDisabled).Count(&disabled).Error; err != nil {
		return
	}
	if err = base.Where("max_uses > 0 AND used_count >= max_uses").Count(&used).Error; err != nil {
		return
	}
	if err = base.Where("expires_at != 0 AND expires_at < ?", now).Count(&expired).Error; err != nil {
		return
	}
	return
}

func countSubscriptionCodeStats() (total int64, enabled int64, disabled int64, used int64, expired int64, err error) {
	now := common.GetTimestamp()
	base := model.DB.Model(&model.SubscriptionCode{})

	if err = base.Count(&total).Error; err != nil {
		return
	}
	if err = base.Where("status = ?", common.SubscriptionCodeStatusEnabled).Count(&enabled).Error; err != nil {
		return
	}
	if err = base.Where("status = ?", common.SubscriptionCodeStatusDisabled).Count(&disabled).Error; err != nil {
		return
	}
	if err = base.Where("status = ?", common.SubscriptionCodeStatusUsed).Count(&used).Error; err != nil {
		return
	}
	if err = base.Where("expires_at != 0 AND expires_at < ?", now).Count(&expired).Error; err != nil {
		return
	}
	return
}
