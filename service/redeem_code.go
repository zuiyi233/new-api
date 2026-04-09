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

	RedeemCodeActionQuotaTopUp         = "quota_topup"
	RedeemCodeActionCreateSubscription = "create_subscription"
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
	Subscription *RedeemCodeSubscriptionResult `json:"subscription,omitempty"`
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

	quota, _, err := model.RedeemWithDetail(code, userId)
	if err != nil {
		return nil, err
	}
	return &RedeemCodeResult{
		CodeType: RedeemCodeTypeRedemption,
		Action:   RedeemCodeActionQuotaTopUp,
		Message:  "兑换成功，额度已到账",
		Quota:    quota,
	}, nil
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
