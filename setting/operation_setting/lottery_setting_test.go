package operation_setting

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestLotteryTypeConfigGetPrizesByTier(t *testing.T) {
	tc := LotteryTypeConfig{
		Type: "wheel",
		Prizes: []LotteryPrizeConfig{
			{Id: "default"},
		},
		BasicPrizes: []LotteryPrizeConfig{
			{Id: "basic"},
		},
		MediumPrizes: []LotteryPrizeConfig{
			{Id: "medium"},
		},
		AdvancedPrizes: []LotteryPrizeConfig{
			{Id: "advanced"},
		},
	}

	cases := []struct {
		name string
		tier string
		want string
	}{
		{name: "basic tier", tier: CheckinTierBasic, want: "basic"},
		{name: "medium tier", tier: CheckinTierMedium, want: "medium"},
		{name: "advanced tier", tier: CheckinTierAdvanced, want: "advanced"},
		{name: "fallback unknown tier", tier: "unknown", want: "basic"},
	}

	for _, tcCase := range cases {
		tcCase := tcCase
		t.Run(tcCase.name, func(t *testing.T) {
			prizes := tc.GetPrizesByTier(tcCase.tier)
			if len(prizes) != 1 {
				t.Fatalf("expected 1 prize, got %d", len(prizes))
			}
			if prizes[0].Id != tcCase.want {
				t.Fatalf("expected prize id %s, got %s", tcCase.want, prizes[0].Id)
			}
		})
	}
}

func TestLotteryTypeConfigGetPrizesByTierFallbackToDefault(t *testing.T) {
	tc := LotteryTypeConfig{
		Type: "scratch",
		Prizes: []LotteryPrizeConfig{
			{Id: "default_fallback"},
		},
	}

	for _, tier := range []string{CheckinTierBasic, CheckinTierMedium, CheckinTierAdvanced} {
		prizes := tc.GetPrizesByTier(tier)
		if len(prizes) != 1 {
			t.Fatalf("tier %s expected 1 prize, got %d", tier, len(prizes))
		}
		if prizes[0].Id != "default_fallback" {
			t.Fatalf("tier %s expected default fallback prize, got %s", tier, prizes[0].Id)
		}
	}
}

func TestDefaultLotterySettingUnlockAndTierPrizes(t *testing.T) {
	normalized := GetNormalizedLotterySetting()
	if len(normalized.Types) != 4 {
		t.Fatalf("expected 4 lottery types, got %d", len(normalized.Types))
	}

	expectedUnlock := map[string]struct {
		mode  string
		value int
	}{
		"wheel": {
			mode:  LotteryUnlockModeBalanceQuota,
			value: int(50 * common.QuotaPerUnit),
		},
		"scratch": {
			mode:  LotteryUnlockModeTotalCheckins,
			value: 30,
		},
		"egg": {
			mode:  LotteryUnlockModeTotalCheckins,
			value: 60,
		},
		"shake": {
			mode:  LotteryUnlockModeTotalCheckins,
			value: 90,
		},
	}

	for _, tc := range normalized.Types {
		exp, ok := expectedUnlock[tc.Type]
		if !ok {
			t.Fatalf("unexpected lottery type %s", tc.Type)
		}
		if tc.UnlockMode != exp.mode {
			t.Fatalf("type %s unlock mode expected %s, got %s", tc.Type, exp.mode, tc.UnlockMode)
		}
		if tc.UnlockValue != exp.value {
			t.Fatalf("type %s unlock value expected %d, got %d", tc.Type, exp.value, tc.UnlockValue)
		}
		if len(tc.BasicPrizes) == 0 || len(tc.MediumPrizes) == 0 || len(tc.AdvancedPrizes) == 0 {
			t.Fatalf("type %s should have prizes for all tiers", tc.Type)
		}
	}
}

func TestNormalizeLotterySettingTierMultipliers(t *testing.T) {
	raw := &LotterySetting{
		Enabled:                true,
		BasicTierMultiplier:    0.5,
		MediumTierMultiplier:   1.25,
		AdvancedTierMultiplier: 2.0,
		Types: []LotteryTypeConfig{
			{
				Type: "wheel",
				Prizes: []LotteryPrizeConfig{
					{
						Id:       "p1",
						MinQuota: 100,
						MaxQuota: 200,
						Weight:   10,
					},
				},
			},
		},
	}

	normalized := normalizeLotterySetting(raw)
	if len(normalized.Types) != 1 {
		t.Fatalf("expected 1 lottery type, got %d", len(normalized.Types))
	}
	got := normalized.Types[0]
	if len(got.BasicPrizes) != 1 || len(got.MediumPrizes) != 1 || len(got.AdvancedPrizes) != 1 {
		t.Fatalf("tier prizes were not generated from base prizes")
	}

	if got.BasicPrizes[0].MinQuota != 50 || got.BasicPrizes[0].MaxQuota != 100 {
		t.Fatalf("basic tier multiplier not applied, got [%d,%d]", got.BasicPrizes[0].MinQuota, got.BasicPrizes[0].MaxQuota)
	}
	if got.MediumPrizes[0].MinQuota != 125 || got.MediumPrizes[0].MaxQuota != 250 {
		t.Fatalf("medium tier multiplier not applied, got [%d,%d]", got.MediumPrizes[0].MinQuota, got.MediumPrizes[0].MaxQuota)
	}
	if got.AdvancedPrizes[0].MinQuota != 200 || got.AdvancedPrizes[0].MaxQuota != 400 {
		t.Fatalf("advanced tier multiplier not applied, got [%d,%d]", got.AdvancedPrizes[0].MinQuota, got.AdvancedPrizes[0].MaxQuota)
	}
}

func TestNormalizeLotterySettingTierMultipliersFallbackAndClamp(t *testing.T) {
	raw := &LotterySetting{
		Enabled:                true,
		BasicTierMultiplier:    0,
		MediumTierMultiplier:   math.NaN(),
		AdvancedTierMultiplier: 999,
		Types: []LotteryTypeConfig{
			{
				Type: "scratch",
				Prizes: []LotteryPrizeConfig{
					{
						Id:       "p2",
						MinQuota: 100,
						MaxQuota: 100,
						Weight:   1,
					},
				},
			},
		},
	}

	normalized := normalizeLotterySetting(raw)
	if normalized.BasicTierMultiplier != defaultLotteryTierMultiplierBasic {
		t.Fatalf("basic multiplier fallback mismatch, got %v", normalized.BasicTierMultiplier)
	}
	if normalized.MediumTierMultiplier != defaultLotteryTierMultiplierMedium {
		t.Fatalf("medium multiplier fallback mismatch, got %v", normalized.MediumTierMultiplier)
	}
	if normalized.AdvancedTierMultiplier != 100 {
		t.Fatalf("advanced multiplier should be clamped to 100, got %v", normalized.AdvancedTierMultiplier)
	}

	got := normalized.Types[0]
	if got.BasicPrizes[0].MinQuota != int(float64(100)*defaultLotteryTierMultiplierBasic) {
		t.Fatalf("basic fallback multiplier not applied to prize pool")
	}
	if got.MediumPrizes[0].MinQuota != int(float64(100)*defaultLotteryTierMultiplierMedium) {
		t.Fatalf("medium fallback multiplier not applied to prize pool")
	}
	if got.AdvancedPrizes[0].MinQuota != 100*100 {
		t.Fatalf("advanced clamp multiplier not applied to prize pool")
	}
}
