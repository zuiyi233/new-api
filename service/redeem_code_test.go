package service

import (
	"errors"
	"testing"

	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRedeemUnifiedCode_ConcurrencySnapshotFailureStillReturnsSuccess(t *testing.T) {
	originFind := findSubscriptionCodeByCodeFn
	originRedeem := redeemWithDetailFn
	originSnapshot := getUserConcurrencySnapshotFn
	t.Cleanup(func() {
		findSubscriptionCodeByCodeFn = originFind
		redeemWithDetailFn = originRedeem
		getUserConcurrencySnapshotFn = originSnapshot
	})

	findSubscriptionCodeByCodeFn = func(string) (*model.SubscriptionCode, error) {
		return nil, gorm.ErrRecordNotFound
	}
	redeemWithDetailFn = func(string, int) (int, *model.Redemption, error) {
		return 0, &model.Redemption{
			BenefitType:      model.RedemptionBenefitTypeConcurrencyStack,
			ConcurrencyMode:  model.ConcurrencyGrantModeStack,
			ConcurrencyValue: 4,
			BenefitExpiresAt: 1893456000,
		}, nil
	}
	getUserConcurrencySnapshotFn = func(int) (*UserConcurrencySnapshot, error) {
		return nil, errors.New("snapshot query timeout")
	}

	result, err := RedeemUnifiedCode(1001, "  test-code  ", "127.0.0.1")
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, RedeemCodeActionGrantConcurrency, result.Action)
	require.Contains(t, result.Message, "并发快照暂不可用")
	require.Contains(t, result.Message, "并发权益已生效")
	require.NotNil(t, result.Concurrency)
	require.Equal(t, model.ConcurrencyGrantModeStack, result.Concurrency.Mode)
	require.Equal(t, 4, result.Concurrency.Value)
	require.Equal(t, int64(1893456000), result.Concurrency.ExpiresAt)
}

func TestRedeemUnifiedCode_ConcurrencySnapshotSuccessKeepsConcurrencyData(t *testing.T) {
	originFind := findSubscriptionCodeByCodeFn
	originRedeem := redeemWithDetailFn
	originSnapshot := getUserConcurrencySnapshotFn
	t.Cleanup(func() {
		findSubscriptionCodeByCodeFn = originFind
		redeemWithDetailFn = originRedeem
		getUserConcurrencySnapshotFn = originSnapshot
	})

	override := 9
	findSubscriptionCodeByCodeFn = func(string) (*model.SubscriptionCode, error) {
		return nil, gorm.ErrRecordNotFound
	}
	redeemWithDetailFn = func(string, int) (int, *model.Redemption, error) {
		return 1200, &model.Redemption{
			BenefitType:      model.RedemptionBenefitTypeMixed,
			ConcurrencyMode:  model.ConcurrencyGrantModeOverride,
			ConcurrencyValue: 6,
			BenefitExpiresAt: 1999999999,
		}, nil
	}
	getUserConcurrencySnapshotFn = func(int) (*UserConcurrencySnapshot, error) {
		return &UserConcurrencySnapshot{
			UserId:            1002,
			GlobalDefault:     3,
			UserOverride:      &override,
			CodeStackTotal:    2,
			CodeOverrideValue: 6,
			EffectiveLimit:    11,
		}, nil
	}

	result, err := RedeemUnifiedCode(1002, "MIXED-CODE", "127.0.0.1")
	require.NoError(t, err)
	require.NotNil(t, result)
	require.Equal(t, RedeemCodeActionQuotaAndConcurrency, result.Action)
	require.Equal(t, "兑换成功，额度和并发权益已生效", result.Message)
	require.Equal(t, 1200, result.Quota)
	require.NotNil(t, result.Concurrency)
	require.Equal(t, model.ConcurrencyGrantModeOverride, result.Concurrency.Mode)
	require.Equal(t, 6, result.Concurrency.Value)
	require.Equal(t, 11, result.Concurrency.EffectiveLimit)
	require.Equal(t, 3, result.Concurrency.GlobalDefault)
	require.NotNil(t, result.Concurrency.UserOverride)
	require.Equal(t, 9, *result.Concurrency.UserOverride)
	require.Equal(t, 2, result.Concurrency.CodeStackTotal)
	require.Equal(t, 6, result.Concurrency.CodeOverrideValue)
}
