package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	RedeemCodeTypeRedemption   = "redemption"
	RedeemCodeTypeSubscription = "subscription"

	RedeemCodeActionQuotaTopUp          = "quota_topup"
	RedeemCodeActionGrantConcurrency    = "grant_concurrency"
	RedeemCodeActionQuotaAndConcurrency = "quota_and_concurrency"
	RedeemCodeActionCreateSubscription  = "create_subscription"
)

type RedeemCodeSubscriptionResult struct {
	SubscriptionId int    `json:"subscription_id"`
	PlanId         int    `json:"plan_id"`
	PlanTitle      string `json:"plan_title"`
	StartTime      int64  `json:"start_time"`
	EndTime        int64  `json:"end_time"`
	Status         string `json:"status"`
	Source         string `json:"source"`
}

type RedeemCodeResult struct {
	CodeType     string                        `json:"code_type"`
	Action       string                        `json:"action"`
	Message      string                        `json:"message"`
	Quota        int                           `json:"quota,omitempty"`
	Concurrency  *RedeemCodeConcurrencyResult  `json:"concurrency,omitempty"`
	Subscription *RedeemCodeSubscriptionResult `json:"subscription,omitempty"`
}

type RedeemCodeConcurrencyResult struct {
	Mode              string `json:"mode"`
	Value             int    `json:"value"`
	EffectiveLimit    int    `json:"effective_limit"`
	GlobalDefault     int    `json:"global_default"`
	UserOverride      *int   `json:"user_override,omitempty"`
	CodeStackTotal    int    `json:"code_stack_total"`
	CodeOverrideValue int    `json:"code_override_value"`
	ExpiresAt         int64  `json:"expires_at"`
}

func RedeemUnifiedCode(userId int, rawCode string, clientIP string) (*RedeemCodeResult, error) {
	code := strings.TrimSpace(rawCode)
	if code == "" {
		return nil, errors.New("交付码不能为空")
	}
	if userId <= 0 {
		return nil, errors.New("无效的用户 ID")
	}

	subscriptionCode, err := model.FindSubscriptionCodeByCode(code)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if subscriptionCode != nil && subscriptionCode.Id > 0 {
		return redeemSubscriptionCode(userId, code, clientIP)
	}

	quota, redemption, err := model.RedeemWithDetail(code, userId)
	if err != nil {
		return nil, err
	}
	benefitType := normalizeRedemptionBenefitType(redemption.BenefitType)
	includesQuota := redemptionIncludesQuotaBenefit(benefitType)
	includesConcurrency := redemptionIncludesConcurrencyBenefit(benefitType)

	result := &RedeemCodeResult{
		CodeType: RedeemCodeTypeRedemption,
		Action:   RedeemCodeActionQuotaTopUp,
		Message:  "兑换成功，额度已到账",
		Quota:    quota,
	}

	if includesConcurrency {
		snapshot, snapErr := GetUserConcurrencySnapshot(userId)
		if snapErr != nil {
			return nil, snapErr
		}
		mode := strings.TrimSpace(redemption.ConcurrencyMode)
		if mode == "" {
			if benefitType == model.RedemptionBenefitTypeConcurrencyOverride {
				mode = model.ConcurrencyGrantModeOverride
			} else {
				mode = model.ConcurrencyGrantModeStack
			}
		}
		result.Concurrency = &RedeemCodeConcurrencyResult{
			Mode:              mode,
			Value:             redemption.ConcurrencyValue,
			EffectiveLimit:    snapshot.EffectiveLimit,
			GlobalDefault:     snapshot.GlobalDefault,
			UserOverride:      snapshot.UserOverride,
			CodeStackTotal:    snapshot.CodeStackTotal,
			CodeOverrideValue: snapshot.CodeOverrideValue,
			ExpiresAt:         redemption.BenefitExpiresAt,
		}
	}

	switch {
	case includesQuota && includesConcurrency:
		result.Action = RedeemCodeActionQuotaAndConcurrency
		result.Message = "兑换成功，额度和并发权益已生效"
	case includesConcurrency:
		result.Action = RedeemCodeActionGrantConcurrency
		result.Message = "兑换成功，并发权益已生效"
		result.Quota = 0
	default:
		result.Action = RedeemCodeActionQuotaTopUp
		result.Message = "兑换成功，额度已到账"
	}

	return result, nil
}

func redeemSubscriptionCode(userId int, rawCode string, clientIP string) (*RedeemCodeResult, error) {
	var result *RedeemCodeResult
	var cacheGroup string
	var logTitle string
	var subscriptionId int

	err := model.DB.Transaction(func(tx *gorm.DB) error {
		subscriptionCode, err := model.ValidateSubscriptionCodeTx(tx, rawCode)
		if err != nil {
			return err
		}
		plan, err := model.GetSubscriptionPlanById(subscriptionCode.PlanId)
		if err != nil {
			return err
		}
		subscription, err := subscriptionCode.ConsumeForUserTx(tx, userId, clientIP, "redeem_code")
		if err != nil {
			return err
		}
		cacheGroup = strings.TrimSpace(plan.UpgradeGroup)
		logTitle = plan.Title
		subscriptionId = subscription.Id
		result = &RedeemCodeResult{
			CodeType: RedeemCodeTypeSubscription,
			Action:   RedeemCodeActionCreateSubscription,
			Message:  "订阅开通成功",
			Subscription: &RedeemCodeSubscriptionResult{
				SubscriptionId: subscription.Id,
				PlanId:         plan.Id,
				PlanTitle:      plan.Title,
				StartTime:      subscription.StartTime,
				EndTime:        subscription.EndTime,
				Status:         subscription.Status,
				Source:         subscription.Source,
			},
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if cacheGroup != "" {
		_ = model.UpdateUserGroupCache(userId, cacheGroup)
	}
	model.RecordLog(userId, model.LogTypeTopup, fmt.Sprintf("通过订阅码开通订阅，套餐: %s，订阅ID: %d", logTitle, subscriptionId))
	return result, nil
}

func normalizeRedemptionBenefitType(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case model.RedemptionBenefitTypeConcurrencyStack:
		return model.RedemptionBenefitTypeConcurrencyStack
	case model.RedemptionBenefitTypeConcurrencyOverride:
		return model.RedemptionBenefitTypeConcurrencyOverride
	case model.RedemptionBenefitTypeMixed:
		return model.RedemptionBenefitTypeMixed
	default:
		return model.RedemptionBenefitTypeQuota
	}
}

func redemptionIncludesQuotaBenefit(benefitType string) bool {
	switch normalizeRedemptionBenefitType(benefitType) {
	case model.RedemptionBenefitTypeQuota, model.RedemptionBenefitTypeMixed:
		return true
	default:
		return false
	}
}

func redemptionIncludesConcurrencyBenefit(benefitType string) bool {
	switch normalizeRedemptionBenefitType(benefitType) {
	case model.RedemptionBenefitTypeConcurrencyStack, model.RedemptionBenefitTypeConcurrencyOverride, model.RedemptionBenefitTypeMixed:
		return true
	default:
		return false
	}
}
