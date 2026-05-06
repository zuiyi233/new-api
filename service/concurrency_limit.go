package service

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
)

type UserConcurrencySnapshot struct {
	UserId            int    `json:"user_id"`
	GlobalDefault     int    `json:"global_default"`
	UserOverride      *int   `json:"user_override,omitempty"`
	CodeStackTotal    int    `json:"code_stack_total"`
	CodeOverrideValue int    `json:"code_override_value"`
	OverridePolicy    string `json:"override_policy"`
	EffectiveLimit    int    `json:"effective_limit"`
}

func BuildUserConcurrencySnapshot(user *model.User, now int64) (*UserConcurrencySnapshot, error) {
	if user == nil {
		return nil, fmt.Errorf("user is nil")
	}
	if user.Id <= 0 {
		return nil, fmt.Errorf("invalid user id")
	}
	if now <= 0 {
		now = common.GetTimestamp()
	}

	stackTotal, codeOverride, err := model.ComputeUserConcurrencyBenefit(user.Id, setting.ConcurrencyCodeOverridePolicy, now)
	if err != nil {
		return nil, err
	}

	globalDefault := setting.GlobalDefaultConcurrency
	if globalDefault <= 0 {
		globalDefault = 1
	}

	base := globalDefault
	if user.ConcurrencyOverride != nil && *user.ConcurrencyOverride > 0 {
		base = *user.ConcurrencyOverride
	}
	if codeOverride > base {
		base = codeOverride
	}

	effective := base + stackTotal
	if effective <= 0 {
		effective = 1
	}

	return &UserConcurrencySnapshot{
		UserId:            user.Id,
		GlobalDefault:     globalDefault,
		UserOverride:      user.ConcurrencyOverride,
		CodeStackTotal:    stackTotal,
		CodeOverrideValue: codeOverride,
		OverridePolicy:    setting.ConcurrencyCodeOverridePolicy,
		EffectiveLimit:    effective,
	}, nil
}

func GetUserConcurrencySnapshot(userId int) (*UserConcurrencySnapshot, error) {
	user, err := model.GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	return BuildUserConcurrencySnapshot(user, common.GetTimestamp())
}
