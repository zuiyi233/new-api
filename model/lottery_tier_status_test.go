package model

import (
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/require"
)

func TestGetLotteryStatusUsesTierPrizesAndReturnsTier(t *testing.T) {
	truncateTables(t)

	originalLottery := *operation_setting.GetLotterySetting()
	originalCheckin := *operation_setting.GetCheckinSetting()
	t.Cleanup(func() {
		*operation_setting.GetLotterySetting() = originalLottery
		*operation_setting.GetCheckinSetting() = originalCheckin
	})

	lotteryCfg := operation_setting.GetLotterySetting()
	lotteryCfg.Enabled = true
	lotteryCfg.Types = []operation_setting.LotteryTypeConfig{
		{
			Type:        LotteryTypeWheel,
			Name:        "Lucky Wheel",
			Description: "Spin",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeNone,
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "default_only", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
	}

	checkinCfg := operation_setting.GetCheckinSetting()
	checkinCfg.Enabled = true
	checkinCfg.RewardRule = operation_setting.CheckinRewardRuleHighestEligible
	checkinCfg.EntryMinBalanceQuota = 0
	checkinCfg.EntryMaxBalanceQuota = int(49 * common.QuotaPerUnit)
	checkinCfg.EntryMinQuota = int(0.01 * common.QuotaPerUnit)
	checkinCfg.EntryMaxQuota = int(0.2 * common.QuotaPerUnit)
	checkinCfg.MinQuota = int(0.05 * common.QuotaPerUnit)
	checkinCfg.MaxQuota = int(1 * common.QuotaPerUnit)
	checkinCfg.BasicMinBalanceQuota = int(50 * common.QuotaPerUnit)
	checkinCfg.BasicMaxBalanceQuota = int(89 * common.QuotaPerUnit)
	checkinCfg.AdvancedEnabled = true
	checkinCfg.AdvancedMinBalanceQuota = int(90 * common.QuotaPerUnit)
	checkinCfg.AdvancedMaxBalanceQuota = 0
	checkinCfg.AdvancedMinQuota = int(0.5 * common.QuotaPerUnit)
	checkinCfg.AdvancedMaxQuota = int(5 * common.QuotaPerUnit)
	checkinCfg.WeeklyRewardCapQuota = 0

	user := &User{
		Id:       19001,
		Username: "lottery_tier_status_user",
		Password: "Passw0rd!",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		Group:    "default",
		AffCode:  "lottery_tier_status_user_aff",
		Quota:    int(120 * common.QuotaPerUnit),
	}
	require.NoError(t, DB.Create(user).Error)

	status, err := GetLotteryStatus(user.Id)
	require.NoError(t, err)
	require.True(t, status.Enabled)
	require.Equal(t, operation_setting.CheckinTierAdvanced, status.CheckinTier)
	require.Len(t, status.Types, 1)
	require.Len(t, status.Types[0].Prizes, 1)
	require.Equal(t, "wheel_advanced_default_only", status.Types[0].Prizes[0].Id)
}

func TestLotteryUnlockRulesBalanceAndCheckinMilestones(t *testing.T) {
	truncateTables(t)

	originalLottery := *operation_setting.GetLotterySetting()
	originalCheckin := *operation_setting.GetCheckinSetting()
	t.Cleanup(func() {
		*operation_setting.GetLotterySetting() = originalLottery
		*operation_setting.GetCheckinSetting() = originalCheckin
	})

	lotteryCfg := operation_setting.GetLotterySetting()
	lotteryCfg.Enabled = true
	lotteryCfg.Types = []operation_setting.LotteryTypeConfig{
		{
			Type:        LotteryTypeWheel,
			Name:        "Lucky Wheel",
			Description: "Spin",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeBalanceQuota,
			UnlockValue: int(50 * common.QuotaPerUnit),
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "wheel_default_only", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
		{
			Type:        LotteryTypeScratch,
			Name:        "Scratch",
			Description: "Scratch",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeTotalCheckins,
			UnlockValue: 30,
			DailyLimit:  5,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "scratch_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
		{
			Type:        LotteryTypeEgg,
			Name:        "Egg",
			Description: "Egg",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeTotalCheckins,
			UnlockValue: 60,
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "egg_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
		{
			Type:        LotteryTypeShake,
			Name:        "Shake",
			Description: "Shake",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeTotalCheckins,
			UnlockValue: 90,
			DailyLimit:  5,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "shake_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
	}

	checkinCfg := operation_setting.GetCheckinSetting()
	checkinCfg.Enabled = true
	checkinCfg.RewardRule = operation_setting.CheckinRewardRuleHighestEligible
	checkinCfg.EntryMinBalanceQuota = 0
	checkinCfg.EntryMaxBalanceQuota = int(49 * common.QuotaPerUnit)
	checkinCfg.EntryMinQuota = int(0.01 * common.QuotaPerUnit)
	checkinCfg.EntryMaxQuota = int(0.2 * common.QuotaPerUnit)
	checkinCfg.BasicMinBalanceQuota = int(50 * common.QuotaPerUnit)
	checkinCfg.BasicMaxBalanceQuota = int(99 * common.QuotaPerUnit)
	checkinCfg.MinQuota = int(0.05 * common.QuotaPerUnit)
	checkinCfg.MaxQuota = int(1 * common.QuotaPerUnit)
	checkinCfg.AdvancedEnabled = true
	checkinCfg.AdvancedMinBalanceQuota = int(100 * common.QuotaPerUnit)
	checkinCfg.AdvancedMaxBalanceQuota = 0
	checkinCfg.AdvancedMinQuota = int(0.5 * common.QuotaPerUnit)
	checkinCfg.AdvancedMaxQuota = int(5 * common.QuotaPerUnit)
	checkinCfg.WeeklyRewardCapQuota = 0

	userLow := &User{
		Id:       19101,
		Username: "lottery_unlock_low",
		Password: "Passw0rd!",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		Group:    "default",
		AffCode:  "lottery_unlock_low_aff",
		Quota:    int(40 * common.QuotaPerUnit),
	}
	require.NoError(t, DB.Create(userLow).Error)

	statusLow, err := GetLotteryStatus(userLow.Id)
	require.NoError(t, err)
	require.Equal(t, operation_setting.CheckinTierBasic, statusLow.CheckinTier)
	require.Len(t, statusLow.Types, 4)
	require.False(t, findLotteryType(statusLow.Types, LotteryTypeWheel).IsUnlocked)
	require.False(t, findLotteryType(statusLow.Types, LotteryTypeScratch).IsUnlocked)
	require.False(t, findLotteryType(statusLow.Types, LotteryTypeEgg).IsUnlocked)
	require.False(t, findLotteryType(statusLow.Types, LotteryTypeShake).IsUnlocked)

	userMid := &User{
		Id:       19102,
		Username: "lottery_unlock_mid",
		Password: "Passw0rd!",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		Group:    "default",
		AffCode:  "lottery_unlock_mid_aff",
		Quota:    int(80 * common.QuotaPerUnit),
	}
	require.NoError(t, DB.Create(userMid).Error)
	insertCheckins(t, userMid.Id, 30)

	statusMid, err := GetLotteryStatus(userMid.Id)
	require.NoError(t, err)
	require.Equal(t, operation_setting.CheckinTierMedium, statusMid.CheckinTier)
	require.True(t, findLotteryType(statusMid.Types, LotteryTypeWheel).IsUnlocked)
	require.Equal(t, "wheel_medium_wheel_default_only", findLotteryType(statusMid.Types, LotteryTypeWheel).Prizes[0].Id)
	require.True(t, findLotteryType(statusMid.Types, LotteryTypeScratch).IsUnlocked)
	require.False(t, findLotteryType(statusMid.Types, LotteryTypeEgg).IsUnlocked)
	require.False(t, findLotteryType(statusMid.Types, LotteryTypeShake).IsUnlocked)

	userHigh := &User{
		Id:       19103,
		Username: "lottery_unlock_high",
		Password: "Passw0rd!",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		Group:    "default",
		AffCode:  "lottery_unlock_high_aff",
		Quota:    int(120 * common.QuotaPerUnit),
	}
	require.NoError(t, DB.Create(userHigh).Error)
	insertCheckins(t, userHigh.Id, 90)

	statusHigh, err := GetLotteryStatus(userHigh.Id)
	require.NoError(t, err)
	require.Equal(t, operation_setting.CheckinTierAdvanced, statusHigh.CheckinTier)
	require.True(t, findLotteryType(statusHigh.Types, LotteryTypeWheel).IsUnlocked)
	require.Equal(t, "wheel_advanced_wheel_default_only", findLotteryType(statusHigh.Types, LotteryTypeWheel).Prizes[0].Id)
	require.True(t, findLotteryType(statusHigh.Types, LotteryTypeScratch).IsUnlocked)
	require.True(t, findLotteryType(statusHigh.Types, LotteryTypeEgg).IsUnlocked)
	require.True(t, findLotteryType(statusHigh.Types, LotteryTypeShake).IsUnlocked)
}

func TestLotteryStatusLockedWhenCheckinBalanceTooHigh(t *testing.T) {
	truncateTables(t)

	originalLottery := *operation_setting.GetLotterySetting()
	originalCheckin := *operation_setting.GetCheckinSetting()
	t.Cleanup(func() {
		*operation_setting.GetLotterySetting() = originalLottery
		*operation_setting.GetCheckinSetting() = originalCheckin
	})

	lotteryCfg := operation_setting.GetLotterySetting()
	lotteryCfg.Enabled = true
	lotteryCfg.Types = []operation_setting.LotteryTypeConfig{
		{
			Type:        LotteryTypeWheel,
			Name:        "Lucky Wheel",
			Description: "Spin",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeNone,
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "wheel_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
		{
			Type:        LotteryTypeScratch,
			Name:        "Scratch",
			Description: "Scratch",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeNone,
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "scratch_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
		{
			Type:        LotteryTypeEgg,
			Name:        "Egg",
			Description: "Egg",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeNone,
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "egg_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
		{
			Type:        LotteryTypeShake,
			Name:        "Shake",
			Description: "Shake",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeNone,
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "shake_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
	}

	checkinCfg := operation_setting.GetCheckinSetting()
	checkinCfg.Enabled = true
	checkinCfg.RewardRule = operation_setting.CheckinRewardRuleHighestEligible
	checkinCfg.EntryMinBalanceQuota = 0
	checkinCfg.EntryMaxBalanceQuota = int(49 * common.QuotaPerUnit)
	checkinCfg.EntryMinQuota = int(0.01 * common.QuotaPerUnit)
	checkinCfg.EntryMaxQuota = int(0.2 * common.QuotaPerUnit)
	checkinCfg.BasicMinBalanceQuota = int(50 * common.QuotaPerUnit)
	checkinCfg.BasicMaxBalanceQuota = int(85 * common.QuotaPerUnit)
	checkinCfg.MinQuota = int(0.05 * common.QuotaPerUnit)
	checkinCfg.MaxQuota = int(1 * common.QuotaPerUnit)
	checkinCfg.AdvancedEnabled = true
	checkinCfg.AdvancedMinBalanceQuota = int(100 * common.QuotaPerUnit)
	checkinCfg.AdvancedMaxBalanceQuota = int(150 * common.QuotaPerUnit)
	checkinCfg.AdvancedMinQuota = int(0.5 * common.QuotaPerUnit)
	checkinCfg.AdvancedMaxQuota = int(5 * common.QuotaPerUnit)
	checkinCfg.WeeklyRewardCapQuota = 0

	user := &User{
		Id:       19201,
		Username: "lottery_locked_high_balance",
		Password: "Passw0rd!",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		Group:    "default",
		AffCode:  "lottery_locked_high_balance_aff",
		Quota:    int(201 * common.QuotaPerUnit),
	}
	require.NoError(t, DB.Create(user).Error)

	status, err := GetLotteryStatus(user.Id)
	require.NoError(t, err)
	require.True(t, status.Enabled)
	require.False(t, status.CheckinEligible)
	require.Equal(t, "none", status.CheckinTier)
	require.NotEmpty(t, status.CheckinLockReason)
	require.Contains(t, status.CheckinLockReason, "超过签到余额上限")
	require.Len(t, status.Types, 4)
	for _, entry := range status.Types {
		require.Falsef(t, entry.IsUnlocked, "expected locked for lottery type %s", entry.Type)
	}
}

func TestLotteryPlayBlockedWhenCheckinBalanceTooHigh(t *testing.T) {
	truncateTables(t)

	originalLottery := *operation_setting.GetLotterySetting()
	originalCheckin := *operation_setting.GetCheckinSetting()
	t.Cleanup(func() {
		*operation_setting.GetLotterySetting() = originalLottery
		*operation_setting.GetCheckinSetting() = originalCheckin
	})

	lotteryCfg := operation_setting.GetLotterySetting()
	lotteryCfg.Enabled = true
	lotteryCfg.Types = []operation_setting.LotteryTypeConfig{
		{
			Type:        LotteryTypeWheel,
			Name:        "Lucky Wheel",
			Description: "Spin",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeNone,
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "wheel_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
		{
			Type:        LotteryTypeScratch,
			Name:        "Scratch",
			Description: "Scratch",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeNone,
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "scratch_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
		{
			Type:        LotteryTypeEgg,
			Name:        "Egg",
			Description: "Egg",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeNone,
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "egg_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
		{
			Type:        LotteryTypeShake,
			Name:        "Shake",
			Description: "Shake",
			Enabled:     true,
			UnlockMode:  operation_setting.LotteryUnlockModeNone,
			DailyLimit:  3,
			Prizes: []operation_setting.LotteryPrizeConfig{
				{Id: "shake_default", Name: "Default", MinQuota: 1, MaxQuota: 1, Weight: 1},
			},
		},
	}

	checkinCfg := operation_setting.GetCheckinSetting()
	checkinCfg.Enabled = true
	checkinCfg.RewardRule = operation_setting.CheckinRewardRuleHighestEligible
	checkinCfg.EntryMinBalanceQuota = 0
	checkinCfg.EntryMaxBalanceQuota = int(49 * common.QuotaPerUnit)
	checkinCfg.EntryMinQuota = int(0.01 * common.QuotaPerUnit)
	checkinCfg.EntryMaxQuota = int(0.2 * common.QuotaPerUnit)
	checkinCfg.BasicMinBalanceQuota = int(50 * common.QuotaPerUnit)
	checkinCfg.BasicMaxBalanceQuota = int(85 * common.QuotaPerUnit)
	checkinCfg.MinQuota = int(0.05 * common.QuotaPerUnit)
	checkinCfg.MaxQuota = int(1 * common.QuotaPerUnit)
	checkinCfg.AdvancedEnabled = true
	checkinCfg.AdvancedMinBalanceQuota = int(100 * common.QuotaPerUnit)
	checkinCfg.AdvancedMaxBalanceQuota = int(150 * common.QuotaPerUnit)
	checkinCfg.AdvancedMinQuota = int(0.5 * common.QuotaPerUnit)
	checkinCfg.AdvancedMaxQuota = int(5 * common.QuotaPerUnit)
	checkinCfg.WeeklyRewardCapQuota = 0

	user := &User{
		Id:       19202,
		Username: "lottery_play_blocked_high_balance",
		Password: "Passw0rd!",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
		Group:    "default",
		AffCode:  "lottery_play_blocked_high_balance_aff",
		Quota:    int(201 * common.QuotaPerUnit),
	}
	require.NoError(t, DB.Create(user).Error)

	initialQuota := user.Quota
	for _, lotteryType := range []string{
		LotteryTypeWheel,
		LotteryTypeScratch,
		LotteryTypeEgg,
		LotteryTypeShake,
	} {
		result, err := UserLotteryPlay(user.Id, lotteryType)
		require.Error(t, err, "expected blocked lottery type %s", lotteryType)
		require.Nil(t, result)
		require.True(
			t,
			strings.Contains(err.Error(), "超过签到余额上限"),
			"unexpected error for %s: %v",
			lotteryType,
			err,
		)
	}

	var reloaded User
	require.NoError(t, DB.First(&reloaded, user.Id).Error)
	require.Equal(t, initialQuota, reloaded.Quota)

	var lotteryRecordCount int64
	require.NoError(t, DB.Model(&LotteryRecord{}).Where("user_id = ?", user.Id).Count(&lotteryRecordCount).Error)
	require.EqualValues(t, 0, lotteryRecordCount)
}

func findLotteryType(types []LotteryTypeInfo, lotteryType string) LotteryTypeInfo {
	for i := range types {
		if types[i].Type == lotteryType {
			return types[i]
		}
	}
	return LotteryTypeInfo{}
}

func insertCheckins(t *testing.T, userId int, count int) {
	t.Helper()
	base := time.Now().Add(-time.Hour * 24 * time.Duration(count+2))
	for i := 0; i < count; i++ {
		checkinTime := base.Add(time.Hour * 24 * time.Duration(i))
		record := Checkin{
			UserId:       userId,
			CheckinDate:  checkinTime.Format("2006-01-02"),
			QuotaAwarded: 1,
			CheckinTier:  operation_setting.CheckinTierBasic,
			CreatedAt:    checkinTime.Unix(),
		}
		require.NoError(t, DB.Create(&record).Error)
	}
}
