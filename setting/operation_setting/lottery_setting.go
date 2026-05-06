package operation_setting

import (
	"fmt"
	"math"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	LotteryUnlockModeNone          = "none"
	LotteryUnlockModeBalanceQuota  = "balance_quota"
	LotteryUnlockModeTotalCheckins = "total_checkins"
	LotteryUnlockModeTotalLottery  = "total_lottery"
)

type LotteryPrizeConfig struct {
	Id           string `json:"id"`
	Name         string `json:"name"`
	MinQuota     int    `json:"min_quota"`
	MaxQuota     int    `json:"max_quota"`
	Weight       int    `json:"weight"`
	Color        string `json:"color"`
	Icon         string `json:"icon"`
	IsGrandPrize bool   `json:"is_grand_prize"`
}

type LotteryTypeConfig struct {
	Type           string               `json:"type"`
	Name           string               `json:"name"`
	Description    string               `json:"description"`
	Icon           string               `json:"icon"`
	Enabled        bool                 `json:"enabled"`
	UnlockMode     string               `json:"unlock_mode"`
	UnlockValue    int                  `json:"unlock_value"`
	DailyLimit     int                  `json:"daily_limit"`
	Prizes         []LotteryPrizeConfig `json:"prizes"`
	BasicPrizes    []LotteryPrizeConfig `json:"basic_prizes"`
	MediumPrizes   []LotteryPrizeConfig `json:"medium_prizes"`
	AdvancedPrizes []LotteryPrizeConfig `json:"advanced_prizes"`
	IsTimeLimited  bool                 `json:"is_time_limited"`
	StartTime      int64                `json:"start_time"`
	EndTime        int64                `json:"end_time"`
}

type LotterySetting struct {
	Enabled                bool                `json:"enabled"`
	BasicTierMultiplier    float64             `json:"basic_tier_multiplier"`
	MediumTierMultiplier   float64             `json:"medium_tier_multiplier"`
	AdvancedTierMultiplier float64             `json:"advanced_tier_multiplier"`
	Types                  []LotteryTypeConfig `json:"types"`
}

const (
	defaultLotteryTierMultiplierBasic    = 0.6
	defaultLotteryTierMultiplierMedium   = 1.0
	defaultLotteryTierMultiplierAdvanced = 1.8
)

func defaultWheelPrizes() []LotteryPrizeConfig {
	return []LotteryPrizeConfig{
		{Id: "wheel_grand", Name: "Grand Prize", MinQuota: int(5 * common.QuotaPerUnit), MaxQuota: int(10 * common.QuotaPerUnit), Weight: 2, Color: "#FFD700", Icon: "trophy", IsGrandPrize: true},
		{Id: "wheel_big", Name: "Big Win", MinQuota: int(1 * common.QuotaPerUnit), MaxQuota: int(5 * common.QuotaPerUnit), Weight: 8, Color: "#FF6B6B", Icon: "star", IsGrandPrize: false},
		{Id: "wheel_medium", Name: "Medium Win", MinQuota: int(0.3 * common.QuotaPerUnit), MaxQuota: int(1 * common.QuotaPerUnit), Weight: 20, Color: "#4ECDC4", Icon: "gift", IsGrandPrize: false},
		{Id: "wheel_small", Name: "Small Win", MinQuota: int(0.05 * common.QuotaPerUnit), MaxQuota: int(0.3 * common.QuotaPerUnit), Weight: 35, Color: "#45B7D1", Icon: "coin", IsGrandPrize: false},
		{Id: "wheel_tiny", Name: "Tiny Win", MinQuota: int(0.01 * common.QuotaPerUnit), MaxQuota: int(0.05 * common.QuotaPerUnit), Weight: 35, Color: "#96CEB4", Icon: "sparkle", IsGrandPrize: false},
	}
}

func defaultWheelBasicPrizes() []LotteryPrizeConfig {
	return []LotteryPrizeConfig{
		{Id: "wheel_basic_grand", Name: "Grand Prize", MinQuota: int(3 * common.QuotaPerUnit), MaxQuota: int(6 * common.QuotaPerUnit), Weight: 1, Color: "#FFD700", Icon: "trophy", IsGrandPrize: true},
		{Id: "wheel_basic_big", Name: "Big Win", MinQuota: int(0.8 * common.QuotaPerUnit), MaxQuota: int(3 * common.QuotaPerUnit), Weight: 6, Color: "#FF6B6B", Icon: "star", IsGrandPrize: false},
		{Id: "wheel_basic_medium", Name: "Medium Win", MinQuota: int(0.2 * common.QuotaPerUnit), MaxQuota: int(0.8 * common.QuotaPerUnit), Weight: 18, Color: "#4ECDC4", Icon: "gift", IsGrandPrize: false},
		{Id: "wheel_basic_small", Name: "Small Win", MinQuota: int(0.03 * common.QuotaPerUnit), MaxQuota: int(0.2 * common.QuotaPerUnit), Weight: 35, Color: "#45B7D1", Icon: "coin", IsGrandPrize: false},
		{Id: "wheel_basic_tiny", Name: "Tiny Win", MinQuota: int(0.005 * common.QuotaPerUnit), MaxQuota: int(0.03 * common.QuotaPerUnit), Weight: 40, Color: "#96CEB4", Icon: "sparkle", IsGrandPrize: false},
	}
}

func defaultWheelAdvancedPrizes() []LotteryPrizeConfig {
	return []LotteryPrizeConfig{
		{Id: "wheel_adv_grand", Name: "Grand Prize", MinQuota: int(8 * common.QuotaPerUnit), MaxQuota: int(16 * common.QuotaPerUnit), Weight: 3, Color: "#FFD700", Icon: "trophy", IsGrandPrize: true},
		{Id: "wheel_adv_big", Name: "Big Win", MinQuota: int(2 * common.QuotaPerUnit), MaxQuota: int(8 * common.QuotaPerUnit), Weight: 10, Color: "#FF6B6B", Icon: "star", IsGrandPrize: false},
		{Id: "wheel_adv_medium", Name: "Medium Win", MinQuota: int(0.6 * common.QuotaPerUnit), MaxQuota: int(2 * common.QuotaPerUnit), Weight: 24, Color: "#4ECDC4", Icon: "gift", IsGrandPrize: false},
		{Id: "wheel_adv_small", Name: "Small Win", MinQuota: int(0.1 * common.QuotaPerUnit), MaxQuota: int(0.6 * common.QuotaPerUnit), Weight: 33, Color: "#45B7D1", Icon: "coin", IsGrandPrize: false},
		{Id: "wheel_adv_tiny", Name: "Tiny Win", MinQuota: int(0.03 * common.QuotaPerUnit), MaxQuota: int(0.1 * common.QuotaPerUnit), Weight: 30, Color: "#96CEB4", Icon: "sparkle", IsGrandPrize: false},
	}
}

func defaultScratchPrizes() []LotteryPrizeConfig {
	return []LotteryPrizeConfig{
		{Id: "scratch_grand", Name: "Jackpot", MinQuota: int(8 * common.QuotaPerUnit), MaxQuota: int(15 * common.QuotaPerUnit), Weight: 1, Color: "#FFD700", Icon: "trophy", IsGrandPrize: true},
		{Id: "scratch_big", Name: "Big Reveal", MinQuota: int(2 * common.QuotaPerUnit), MaxQuota: int(8 * common.QuotaPerUnit), Weight: 5, Color: "#FF6B6B", Icon: "star", IsGrandPrize: false},
		{Id: "scratch_medium", Name: "Nice Find", MinQuota: int(0.5 * common.QuotaPerUnit), MaxQuota: int(2 * common.QuotaPerUnit), Weight: 15, Color: "#4ECDC4", Icon: "gift", IsGrandPrize: false},
		{Id: "scratch_small", Name: "Small Find", MinQuota: int(0.05 * common.QuotaPerUnit), MaxQuota: int(0.5 * common.QuotaPerUnit), Weight: 40, Color: "#45B7D1", Icon: "coin", IsGrandPrize: false},
		{Id: "scratch_tiny", Name: "Try Again", MinQuota: int(0.01 * common.QuotaPerUnit), MaxQuota: int(0.05 * common.QuotaPerUnit), Weight: 39, Color: "#96CEB4", Icon: "sparkle", IsGrandPrize: false},
	}
}

func scaleLotteryPrizesWithMultiplier(
	base []LotteryPrizeConfig,
	idPrefix string,
	multiplier float64,
) []LotteryPrizeConfig {
	if multiplier <= 0 {
		multiplier = 1
	}
	scaled := make([]LotteryPrizeConfig, 0, len(base))
	for i := range base {
		p := base[i]
		p.Id = fmt.Sprintf("%s_%s", idPrefix, p.Id)
		p.MinQuota = common.Max(int(float64(p.MinQuota)*multiplier), 0)
		p.MaxQuota = common.Max(int(float64(p.MaxQuota)*multiplier), p.MinQuota)
		scaled = append(scaled, p)
	}
	return scaled
}

func normalizeLotteryTierMultiplier(raw float64, fallback float64) float64 {
	if math.IsNaN(raw) || math.IsInf(raw, 0) || raw <= 0 {
		return fallback
	}
	// 防止异常值导致奖池膨胀失控
	if raw > 100 {
		return 100
	}
	return raw
}

func defaultEggPrizes() []LotteryPrizeConfig {
	return []LotteryPrizeConfig{
		{Id: "egg_grand", Name: "Golden Egg", MinQuota: int(10 * common.QuotaPerUnit), MaxQuota: int(20 * common.QuotaPerUnit), Weight: 1, Color: "#FFD700", Icon: "trophy", IsGrandPrize: true},
		{Id: "egg_big", Name: "Silver Egg", MinQuota: int(3 * common.QuotaPerUnit), MaxQuota: int(10 * common.QuotaPerUnit), Weight: 4, Color: "#C0C0C0", Icon: "star", IsGrandPrize: false},
		{Id: "egg_medium", Name: "Bronze Egg", MinQuota: int(0.5 * common.QuotaPerUnit), MaxQuota: int(3 * common.QuotaPerUnit), Weight: 15, Color: "#CD7F32", Icon: "gift", IsGrandPrize: false},
		{Id: "egg_small", Name: "Cracked Egg", MinQuota: int(0.05 * common.QuotaPerUnit), MaxQuota: int(0.5 * common.QuotaPerUnit), Weight: 40, Color: "#45B7D1", Icon: "coin", IsGrandPrize: false},
		{Id: "egg_tiny", Name: "Empty Shell", MinQuota: int(0.01 * common.QuotaPerUnit), MaxQuota: int(0.05 * common.QuotaPerUnit), Weight: 40, Color: "#96CEB4", Icon: "sparkle", IsGrandPrize: false},
	}
}

func defaultShakePrizes() []LotteryPrizeConfig {
	return []LotteryPrizeConfig{
		{Id: "shake_grand", Name: "Lucky Shake", MinQuota: int(6 * common.QuotaPerUnit), MaxQuota: int(12 * common.QuotaPerUnit), Weight: 2, Color: "#FFD700", Icon: "trophy", IsGrandPrize: true},
		{Id: "shake_big", Name: "Great Shake", MinQuota: int(1.5 * common.QuotaPerUnit), MaxQuota: int(6 * common.QuotaPerUnit), Weight: 8, Color: "#FF6B6B", Icon: "star", IsGrandPrize: false},
		{Id: "shake_medium", Name: "Good Shake", MinQuota: int(0.3 * common.QuotaPerUnit), MaxQuota: int(1.5 * common.QuotaPerUnit), Weight: 20, Color: "#4ECDC4", Icon: "gift", IsGrandPrize: false},
		{Id: "shake_small", Name: "Light Shake", MinQuota: int(0.05 * common.QuotaPerUnit), MaxQuota: int(0.3 * common.QuotaPerUnit), Weight: 35, Color: "#45B7D1", Icon: "coin", IsGrandPrize: false},
		{Id: "shake_tiny", Name: "Tiny Shake", MinQuota: int(0.01 * common.QuotaPerUnit), MaxQuota: int(0.05 * common.QuotaPerUnit), Weight: 35, Color: "#96CEB4", Icon: "sparkle", IsGrandPrize: false},
	}
}

var lotterySetting = LotterySetting{
	Enabled:                false,
	BasicTierMultiplier:    defaultLotteryTierMultiplierBasic,
	MediumTierMultiplier:   defaultLotteryTierMultiplierMedium,
	AdvancedTierMultiplier: defaultLotteryTierMultiplierAdvanced,
	Types: []LotteryTypeConfig{
		{
			Type:           "wheel",
			Name:           "Lucky Wheel",
			Description:    "Spin the wheel and win big prizes!",
			Icon:           "circle-dot",
			Enabled:        true,
			UnlockMode:     LotteryUnlockModeBalanceQuota,
			UnlockValue:    int(50 * common.QuotaPerUnit),
			DailyLimit:     3,
			Prizes:         defaultWheelPrizes(),
			BasicPrizes:    defaultWheelBasicPrizes(),
			MediumPrizes:   defaultWheelPrizes(),
			AdvancedPrizes: defaultWheelAdvancedPrizes(),
		},
		{
			Type:        "scratch",
			Name:        "Scratch Card",
			Description: "Scratch to reveal your hidden prize!",
			Icon:        "eraser",
			Enabled:     true,
			UnlockMode:  LotteryUnlockModeTotalCheckins,
			UnlockValue: 30,
			DailyLimit:  5,
			Prizes:      defaultScratchPrizes(),
		},
		{
			Type:        "egg",
			Name:        "Smash the Egg",
			Description: "Smash golden eggs for amazing rewards!",
			Icon:        "egg",
			Enabled:     true,
			UnlockMode:  LotteryUnlockModeTotalCheckins,
			UnlockValue: 60,
			DailyLimit:  3,
			Prizes:      defaultEggPrizes(),
		},
		{
			Type:        "shake",
			Name:        "Shake & Win",
			Description: "Shake your device to win lucky prizes!",
			Icon:        "smartphone",
			Enabled:     true,
			UnlockMode:  LotteryUnlockModeTotalCheckins,
			UnlockValue: 90,
			DailyLimit:  5,
			Prizes:      defaultShakePrizes(),
		},
	},
}

func init() {
	config.GlobalConfig.Register("lottery_setting", &lotterySetting)
}

func GetLotterySetting() *LotterySetting {
	return &lotterySetting
}

func GetNormalizedLotterySetting() LotterySetting {
	return normalizeLotterySetting(&lotterySetting)
}

func IsLotteryEnabled() bool {
	return lotterySetting.Enabled
}

func (s *LotterySetting) GetTypeConfig(lotteryType string) (LotteryTypeConfig, error) {
	for _, tc := range s.Types {
		if tc.Type == lotteryType {
			return tc, nil
		}
	}
	return LotteryTypeConfig{}, fmt.Errorf("lottery type %s not found", lotteryType)
}

func (s *LotterySetting) GetAllTypeConfigs() []LotteryTypeConfig {
	return s.Types
}

func cloneLotteryPrizes(prizes []LotteryPrizeConfig) []LotteryPrizeConfig {
	cloned := make([]LotteryPrizeConfig, len(prizes))
	copy(cloned, prizes)
	return cloned
}

func normalizeLotteryPrizeList(prizes []LotteryPrizeConfig, idPrefix string) []LotteryPrizeConfig {
	if len(prizes) == 0 {
		return nil
	}
	normalized := make([]LotteryPrizeConfig, 0, len(prizes))
	for i := range prizes {
		p := prizes[i]
		if p.Weight <= 0 {
			p.Weight = 1
		}
		p.MinQuota = common.Max(p.MinQuota, 0)
		p.MaxQuota = common.Max(p.MaxQuota, p.MinQuota)
		if p.Id == "" {
			p.Id = fmt.Sprintf("%s_prize_%d", idPrefix, i)
		}
		normalized = append(normalized, p)
	}
	return normalized
}

func normalizeLotteryTierPrizes(prizes []LotteryPrizeConfig, fallback []LotteryPrizeConfig, idPrefix string) []LotteryPrizeConfig {
	normalized := normalizeLotteryPrizeList(prizes, idPrefix)
	if len(normalized) == 0 {
		return cloneLotteryPrizes(fallback)
	}
	return normalized
}

func (tc LotteryTypeConfig) GetPrizesByTier(tier string) []LotteryPrizeConfig {
	switch tier {
	case CheckinTierAdvanced:
		if len(tc.AdvancedPrizes) > 0 {
			return cloneLotteryPrizes(tc.AdvancedPrizes)
		}
	case CheckinTierMedium:
		if len(tc.MediumPrizes) > 0 {
			return cloneLotteryPrizes(tc.MediumPrizes)
		}
	default:
		if len(tc.BasicPrizes) > 0 {
			return cloneLotteryPrizes(tc.BasicPrizes)
		}
	}
	return cloneLotteryPrizes(tc.Prizes)
}

func normalizeLotterySetting(raw *LotterySetting) LotterySetting {
	if raw == nil {
		return LotterySetting{}
	}
	normalized := *raw
	normalized.BasicTierMultiplier = normalizeLotteryTierMultiplier(
		normalized.BasicTierMultiplier,
		defaultLotteryTierMultiplierBasic,
	)
	normalized.MediumTierMultiplier = normalizeLotteryTierMultiplier(
		normalized.MediumTierMultiplier,
		defaultLotteryTierMultiplierMedium,
	)
	normalized.AdvancedTierMultiplier = normalizeLotteryTierMultiplier(
		normalized.AdvancedTierMultiplier,
		defaultLotteryTierMultiplierAdvanced,
	)

	for i := range normalized.Types {
		tc := &normalized.Types[i]

		if tc.UnlockMode == "" {
			tc.UnlockMode = LotteryUnlockModeNone
		}
		tc.UnlockValue = common.Max(tc.UnlockValue, 0)
		tc.DailyLimit = common.Max(tc.DailyLimit, 0)

		if tc.IsTimeLimited && tc.EndTime <= tc.StartTime {
			tc.IsTimeLimited = false
		}

		tc.Prizes = normalizeLotteryPrizeList(tc.Prizes, tc.Type)
		// 三档奖池统一由基础奖池 + 配置倍率生成，确保所有玩法都遵循同一套倍率规则。
		tc.BasicPrizes = normalizeLotteryTierPrizes(
			scaleLotteryPrizesWithMultiplier(
				tc.Prizes,
				fmt.Sprintf("%s_basic", tc.Type),
				normalized.BasicTierMultiplier,
			),
			tc.Prizes,
			fmt.Sprintf("%s_basic", tc.Type),
		)
		tc.MediumPrizes = normalizeLotteryTierPrizes(
			scaleLotteryPrizesWithMultiplier(
				tc.Prizes,
				fmt.Sprintf("%s_medium", tc.Type),
				normalized.MediumTierMultiplier,
			),
			tc.Prizes,
			fmt.Sprintf("%s_medium", tc.Type),
		)
		tc.AdvancedPrizes = normalizeLotteryTierPrizes(
			scaleLotteryPrizesWithMultiplier(
				tc.Prizes,
				fmt.Sprintf("%s_advanced", tc.Type),
				normalized.AdvancedTierMultiplier,
			),
			tc.Prizes,
			fmt.Sprintf("%s_advanced", tc.Type),
		)
	}

	return normalized
}
