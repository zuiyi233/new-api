package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func newTestCheckinSetting() operation_setting.CheckinSetting {
	return operation_setting.CheckinSetting{
		Enabled: true,

		EntryMinBalanceQuota: int(10 * common.QuotaPerUnit),
		EntryMaxBalanceQuota: int(49 * common.QuotaPerUnit),
		EntryMinQuota:        int(0.01 * common.QuotaPerUnit),
		EntryMaxQuota:        int(0.2 * common.QuotaPerUnit),
		EntryRewardBands: []operation_setting.CheckinRewardBand{
			{
				MinQuota: int(0.01 * common.QuotaPerUnit),
				MaxQuota: int(0.05 * common.QuotaPerUnit),
				Weight:   75,
			},
			{
				MinQuota: int(0.05 * common.QuotaPerUnit),
				MaxQuota: int(0.2 * common.QuotaPerUnit),
				Weight:   25,
			},
		},

		BasicMinBalanceQuota: int(50 * common.QuotaPerUnit),
		BasicMaxBalanceQuota: int(80 * common.QuotaPerUnit),
		MinQuota:             int(0.05 * common.QuotaPerUnit),
		MaxQuota:             int(1 * common.QuotaPerUnit),
		BasicRewardBands: []operation_setting.CheckinRewardBand{
			{
				MinQuota: int(0.05 * common.QuotaPerUnit),
				MaxQuota: int(0.3 * common.QuotaPerUnit),
				Weight:   80,
			},
			{
				MinQuota: int(0.3 * common.QuotaPerUnit),
				MaxQuota: int(1 * common.QuotaPerUnit),
				Weight:   20,
			},
		},

		AdvancedEnabled:         true,
		AdvancedMinBalanceQuota: int(100 * common.QuotaPerUnit),
		AdvancedMaxBalanceQuota: int(150 * common.QuotaPerUnit),
		AdvancedMinQuota:        int(0.5 * common.QuotaPerUnit),
		AdvancedMaxQuota:        int(5 * common.QuotaPerUnit),
		AdvancedRewardBands: []operation_setting.CheckinRewardBand{
			{
				MinQuota: int(0.5 * common.QuotaPerUnit),
				MaxQuota: int(2 * common.QuotaPerUnit),
				Weight:   75,
			},
			{
				MinQuota: int(2 * common.QuotaPerUnit),
				MaxQuota: int(5 * common.QuotaPerUnit),
				Weight:   25,
			},
		},

		MinIntervalHours:     24,
		WeeklyRewardCapQuota: int(3 * common.QuotaPerUnit),
		RewardRule:           operation_setting.CheckinRewardRuleHighestEligible,
	}
}

func TestBuildUserCheckinEligibilityLocked(t *testing.T) {
	setting := newTestCheckinSetting()
	_, eligibility := buildUserCheckinEligibility(int(5*common.QuotaPerUnit), setting)

	if eligibility.CanCheckin {
		t.Fatalf("expected locked eligibility, got can_checkin=true")
	}
	if eligibility.NextTier != operation_setting.CheckinTierBasic {
		t.Fatalf("expected next tier basic, got %s", eligibility.NextTier)
	}
	if eligibility.NextTierMinBalanceQuota != setting.EntryMinBalanceQuota {
		t.Fatalf("expected next tier threshold %d, got %d", setting.EntryMinBalanceQuota, eligibility.NextTierMinBalanceQuota)
	}
}

func TestBuildUserCheckinEligibilityBasic(t *testing.T) {
	setting := newTestCheckinSetting()
	_, eligibility := buildUserCheckinEligibility(setting.EntryMinBalanceQuota, setting)

	if !eligibility.CanCheckin {
		t.Fatalf("expected can_checkin=true")
	}
	if eligibility.CurrentTier != operation_setting.CheckinTierBasic {
		t.Fatalf("expected basic tier, got %s", eligibility.CurrentTier)
	}
	if eligibility.RewardMinQuota != setting.EntryMinQuota || eligibility.RewardMaxQuota != setting.EntryMaxQuota {
		t.Fatalf("expected basic reward range [%d, %d], got [%d, %d]",
			setting.EntryMinQuota, setting.EntryMaxQuota, eligibility.RewardMinQuota, eligibility.RewardMaxQuota)
	}
}

func TestBuildUserCheckinEligibilityMedium(t *testing.T) {
	setting := newTestCheckinSetting()
	_, eligibility := buildUserCheckinEligibility(setting.BasicMinBalanceQuota, setting)

	if !eligibility.CanCheckin {
		t.Fatalf("expected can_checkin=true")
	}
	if eligibility.CurrentTier != operation_setting.CheckinTierMedium {
		t.Fatalf("expected medium tier, got %s", eligibility.CurrentTier)
	}
	if eligibility.RewardMinQuota != setting.MinQuota || eligibility.RewardMaxQuota != setting.MaxQuota {
		t.Fatalf("expected medium reward range [%d, %d], got [%d, %d]",
			setting.MinQuota, setting.MaxQuota, eligibility.RewardMinQuota, eligibility.RewardMaxQuota)
	}
}

func TestBuildUserCheckinEligibilityAdvancedWithHighestRule(t *testing.T) {
	setting := newTestCheckinSetting()
	_, eligibility := buildUserCheckinEligibility(setting.AdvancedMinBalanceQuota, setting)

	if !eligibility.CanCheckin {
		t.Fatalf("expected can_checkin=true")
	}
	if eligibility.CurrentTier != operation_setting.CheckinTierAdvanced {
		t.Fatalf("expected advanced tier, got %s", eligibility.CurrentTier)
	}
	if eligibility.RewardMinQuota != setting.AdvancedMinQuota || eligibility.RewardMaxQuota != setting.AdvancedMaxQuota {
		t.Fatalf("expected advanced reward range [%d, %d], got [%d, %d]",
			setting.AdvancedMinQuota, setting.AdvancedMaxQuota, eligibility.RewardMinQuota, eligibility.RewardMaxQuota)
	}
}

func TestBuildUserCheckinEligibilityAdvancedWithLowestRule(t *testing.T) {
	setting := newTestCheckinSetting()
	setting.EntryMaxBalanceQuota = setting.AdvancedMinBalanceQuota
	setting.BasicMaxBalanceQuota = setting.AdvancedMinBalanceQuota
	setting.RewardRule = operation_setting.CheckinRewardRuleLowestEligible
	_, eligibility := buildUserCheckinEligibility(setting.AdvancedMinBalanceQuota, setting)

	if !eligibility.CanCheckin {
		t.Fatalf("expected can_checkin=true")
	}
	if eligibility.CurrentTier != operation_setting.CheckinTierBasic {
		t.Fatalf("expected basic tier with lowest_eligible rule, got %s", eligibility.CurrentTier)
	}
}

func TestBuildUserCheckinEligibilityBalanceTooHigh(t *testing.T) {
	setting := newTestCheckinSetting()
	_, eligibility := buildUserCheckinEligibility(int(200*common.QuotaPerUnit), setting)

	if eligibility.CanCheckin {
		t.Fatalf("expected can_checkin=false for too-high balance")
	}
	if eligibility.LockReason == "" {
		t.Fatalf("expected lock reason for too-high balance")
	}
}

func TestGenerateRandomQuotaAwardRange(t *testing.T) {
	minQuota := 100
	maxQuota := 200
	for i := 0; i < 100; i++ {
		value, err := generateRandomQuotaAward(minQuota, maxQuota)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if value < minQuota || value > maxQuota {
			t.Fatalf("reward out of range: %d not in [%d, %d]", value, minQuota, maxQuota)
		}
	}
}

func TestGenerateRandomQuotaAwardByBandsRange(t *testing.T) {
	bands := []operation_setting.CheckinRewardBand{
		{
			MinQuota: 100,
			MaxQuota: 140,
			Weight:   90,
		},
		{
			MinQuota: 141,
			MaxQuota: 200,
			Weight:   10,
		},
	}
	for i := 0; i < 200; i++ {
		value, err := generateRandomQuotaAwardByBands(100, 200, bands)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if value < 100 || value > 200 {
			t.Fatalf("reward out of range: %d not in [100, 200]", value)
		}
	}
}

func TestGenerateRandomQuotaAwardByBandsFallback(t *testing.T) {
	invalidBands := []operation_setting.CheckinRewardBand{
		{
			MinQuota: 1,
			MaxQuota: 2,
			Weight:   100,
		},
	}
	for i := 0; i < 50; i++ {
		value, err := generateRandomQuotaAwardByBands(100, 200, invalidBands)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if value < 100 || value > 200 {
			t.Fatalf("fallback reward out of range: %d not in [100, 200]", value)
		}
	}
}
