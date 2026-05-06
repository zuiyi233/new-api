package operation_setting

import (
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const (
	CheckinTierBasic    = "basic"
	CheckinTierMedium   = "medium"
	CheckinTierAdvanced = "advanced"

	CheckinRewardRuleHighestEligible = "highest_eligible"
	CheckinRewardRuleLowestEligible  = "lowest_eligible"
)

// CheckinRewardBand 概率分段
type CheckinRewardBand struct {
	MinQuota int `json:"min_quota"`
	MaxQuota int `json:"max_quota"`
	Weight   int `json:"weight"`
}

// CheckinSetting 签到功能配置
type CheckinSetting struct {
	Enabled bool `json:"enabled"` // 是否启用签到功能

	// 基础签到（低门槛档）
	EntryMinBalanceQuota int                 `json:"entry_min_balance_quota"` // 基础签到解锁余额门槛
	EntryMaxBalanceQuota int                 `json:"entry_max_balance_quota"` // 基础签到余额上限（0 表示不限制）
	EntryMinQuota        int                 `json:"entry_min_quota"`         // 基础签到最小奖励
	EntryMaxQuota        int                 `json:"entry_max_quota"`         // 基础签到最大奖励
	EntryRewardBands     []CheckinRewardBand `json:"entry_reward_bands"`      // 基础签到概率分布

	// 中级签到（兼容历史字段 basic_*/min_quota/max_quota）
	BasicMinBalanceQuota int                 `json:"basic_min_balance_quota"` // 中级签到解锁余额门槛
	BasicMaxBalanceQuota int                 `json:"basic_max_balance_quota"` // 中级签到余额上限（0 表示不限制）
	MinQuota             int                 `json:"min_quota"`               // 中级签到最小奖励
	MaxQuota             int                 `json:"max_quota"`               // 中级签到最大奖励
	BasicRewardBands     []CheckinRewardBand `json:"basic_reward_bands"`      // 中级签到概率分布

	// 高级签到
	AdvancedEnabled         bool                `json:"advanced_enabled"`           // 是否启用高级签到
	AdvancedMinBalanceQuota int                 `json:"advanced_min_balance_quota"` // 高级签到解锁余额门槛
	AdvancedMaxBalanceQuota int                 `json:"advanced_max_balance_quota"` // 高级签到余额上限（0 表示不限制）
	AdvancedMinQuota        int                 `json:"advanced_min_quota"`         // 高级签到最小奖励
	AdvancedMaxQuota        int                 `json:"advanced_max_quota"`         // 高级签到最大奖励
	AdvancedRewardBands     []CheckinRewardBand `json:"advanced_reward_bands"`      // 高级签到概率分布

	// 频率限制（小时）
	MinIntervalHours int `json:"min_interval_hours"`
	// 周奖励封顶（0 表示不限制）
	WeeklyRewardCapQuota int `json:"weekly_reward_cap_quota"`

	// 奖励发放规则：highest_eligible / lowest_eligible
	RewardRule string `json:"reward_rule"`
}

func defaultEntryRewardBands() []CheckinRewardBand {
	return []CheckinRewardBand{
		{
			MinQuota: int(0.01 * common.QuotaPerUnit),
			MaxQuota: int(0.05 * common.QuotaPerUnit),
			Weight:   72,
		},
		{
			MinQuota: int(0.05 * common.QuotaPerUnit),
			MaxQuota: int(0.12 * common.QuotaPerUnit),
			Weight:   23,
		},
		{
			MinQuota: int(0.12 * common.QuotaPerUnit),
			MaxQuota: int(0.2 * common.QuotaPerUnit),
			Weight:   5,
		},
	}
}

func defaultBasicRewardBands() []CheckinRewardBand {
	return []CheckinRewardBand{
		{
			MinQuota: int(0.05 * common.QuotaPerUnit),
			MaxQuota: int(0.2 * common.QuotaPerUnit),
			Weight:   70,
		},
		{
			MinQuota: int(0.2 * common.QuotaPerUnit),
			MaxQuota: int(0.6 * common.QuotaPerUnit),
			Weight:   25,
		},
		{
			MinQuota: int(0.6 * common.QuotaPerUnit),
			MaxQuota: int(1.0 * common.QuotaPerUnit),
			Weight:   5,
		},
	}
}

func defaultAdvancedRewardBands() []CheckinRewardBand {
	return []CheckinRewardBand{
		{
			MinQuota: int(0.5 * common.QuotaPerUnit),
			MaxQuota: int(1.5 * common.QuotaPerUnit),
			Weight:   65,
		},
		{
			MinQuota: int(1.5 * common.QuotaPerUnit),
			MaxQuota: int(3.0 * common.QuotaPerUnit),
			Weight:   30,
		},
		{
			MinQuota: int(3.0 * common.QuotaPerUnit),
			MaxQuota: int(5.0 * common.QuotaPerUnit),
			Weight:   5,
		},
	}
}

// 默认配置：
// - 基础签到：余额达到 10 才可签到，奖励 0.01 - 0.20
// - 中级签到：余额达到 50 才可签到，奖励 0.05 - 1.00（兼容历史基础档）
// - 高级签到：余额达到 100 才可签到，奖励 0.50 - 5.00
// 数值按系统额度单位（quota）存储。
var checkinSetting = CheckinSetting{
	Enabled: false,

	EntryMinBalanceQuota: 0,
	EntryMaxBalanceQuota: int(49 * common.QuotaPerUnit),
	EntryMinQuota:        int(0.01 * common.QuotaPerUnit),
	EntryMaxQuota:        int(0.2 * common.QuotaPerUnit),
	EntryRewardBands:     defaultEntryRewardBands(),

	BasicMinBalanceQuota: int(50 * common.QuotaPerUnit),
	BasicMaxBalanceQuota: int(85 * common.QuotaPerUnit),
	MinQuota:             int(0.05 * common.QuotaPerUnit),
	MaxQuota:             int(1 * common.QuotaPerUnit),
	BasicRewardBands:     defaultBasicRewardBands(),

	AdvancedEnabled:         true,
	AdvancedMinBalanceQuota: int(100 * common.QuotaPerUnit),
	AdvancedMaxBalanceQuota: int(150 * common.QuotaPerUnit),
	AdvancedMinQuota:        int(0.5 * common.QuotaPerUnit),
	AdvancedMaxQuota:        int(5 * common.QuotaPerUnit),
	AdvancedRewardBands:     defaultAdvancedRewardBands(),

	MinIntervalHours:     24,
	WeeklyRewardCapQuota: int(3 * common.QuotaPerUnit),
	RewardRule:           CheckinRewardRuleHighestEligible,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("checkin_setting", &checkinSetting)
}

// GetCheckinSetting 获取签到配置（原始值）
func GetCheckinSetting() *CheckinSetting {
	return &checkinSetting
}

// GetNormalizedCheckinSetting 获取归一化后的签到配置
func GetNormalizedCheckinSetting() CheckinSetting {
	return normalizeCheckinSetting(&checkinSetting)
}

// IsCheckinEnabled 是否启用签到功能
func IsCheckinEnabled() bool {
	return checkinSetting.Enabled
}

// GetCheckinQuotaRange 获取基础签到额度范围（兼容历史调用）
func GetCheckinQuotaRange() (min, max int) {
	normalized := GetNormalizedCheckinSetting()
	return normalized.MinQuota, normalized.MaxQuota
}

// IsValidCheckinRewardRule 校验奖励规则是否合法
func IsValidCheckinRewardRule(rule string) bool {
	switch strings.ToLower(strings.TrimSpace(rule)) {
	case CheckinRewardRuleHighestEligible, CheckinRewardRuleLowestEligible:
		return true
	default:
		return false
	}
}

// ValidateCheckinRewardBands 校验并限制概率分段
func ValidateCheckinRewardBands(bands []CheckinRewardBand, minQuota int, maxQuota int) error {
	if len(bands) == 0 {
		return fmt.Errorf("奖励分布至少要有一个分段")
	}
	if len(bands) > 20 {
		return fmt.Errorf("奖励分布分段数量不能超过 20")
	}
	if maxQuota < minQuota {
		return fmt.Errorf("奖励区间非法：max 小于 min")
	}

	validIntersectCount := 0
	for i := range bands {
		if bands[i].Weight <= 0 {
			return fmt.Errorf("第 %d 个分段权重必须大于 0", i+1)
		}
		if bands[i].MinQuota < 0 || bands[i].MaxQuota < 0 {
			return fmt.Errorf("第 %d 个分段奖励不能小于 0", i+1)
		}
		if bands[i].MaxQuota < bands[i].MinQuota {
			return fmt.Errorf("第 %d 个分段 max_quota 不能小于 min_quota", i+1)
		}
		if !(bands[i].MaxQuota < minQuota || bands[i].MinQuota > maxQuota) {
			validIntersectCount++
		}
	}

	if validIntersectCount == 0 {
		return fmt.Errorf("奖励分布未覆盖当前等级奖励区间")
	}

	return nil
}

func normalizeRewardBands(
	bands []CheckinRewardBand,
	minQuota int,
	maxQuota int,
	fallback []CheckinRewardBand,
) []CheckinRewardBand {
	if maxQuota < minQuota {
		maxQuota = minQuota
	}

	normalized := make([]CheckinRewardBand, 0, len(bands))
	for i := range bands {
		b := bands[i]
		if b.Weight <= 0 {
			continue
		}
		if b.MaxQuota < b.MinQuota {
			continue
		}

		if b.MinQuota < minQuota {
			b.MinQuota = minQuota
		}
		if b.MaxQuota > maxQuota {
			b.MaxQuota = maxQuota
		}
		if b.MaxQuota < b.MinQuota {
			continue
		}
		normalized = append(normalized, b)
	}

	if len(normalized) == 0 {
		normalized = make([]CheckinRewardBand, len(fallback))
		copy(normalized, fallback)
		for i := range normalized {
			if normalized[i].MinQuota < minQuota {
				normalized[i].MinQuota = minQuota
			}
			if normalized[i].MaxQuota > maxQuota {
				normalized[i].MaxQuota = maxQuota
			}
			if normalized[i].MaxQuota < normalized[i].MinQuota {
				normalized[i].MaxQuota = normalized[i].MinQuota
			}
		}
	}

	sort.SliceStable(normalized, func(i, j int) bool {
		if normalized[i].MinQuota == normalized[j].MinQuota {
			return normalized[i].MaxQuota < normalized[j].MaxQuota
		}
		return normalized[i].MinQuota < normalized[j].MinQuota
	})

	return normalized
}

// GetRewardBandsByTier 获取指定等级的概率分段
func GetRewardBandsByTier(setting CheckinSetting, tier string) []CheckinRewardBand {
	switch tier {
	case CheckinTierAdvanced:
		bands := make([]CheckinRewardBand, len(setting.AdvancedRewardBands))
		copy(bands, setting.AdvancedRewardBands)
		return bands
	case CheckinTierMedium:
		bands := make([]CheckinRewardBand, len(setting.BasicRewardBands))
		copy(bands, setting.BasicRewardBands)
		return bands
	default:
		bands := make([]CheckinRewardBand, len(setting.EntryRewardBands))
		copy(bands, setting.EntryRewardBands)
		return bands
	}
}

func normalizeCheckinSetting(raw *CheckinSetting) CheckinSetting {
	if raw == nil {
		return CheckinSetting{}
	}
	normalized := *raw

	normalized.EntryMinBalanceQuota = common.Max(normalized.EntryMinBalanceQuota, 0)
	normalized.EntryMaxBalanceQuota = common.Max(normalized.EntryMaxBalanceQuota, 0)
	if normalized.EntryMaxBalanceQuota > 0 && normalized.EntryMaxBalanceQuota < normalized.EntryMinBalanceQuota {
		normalized.EntryMaxBalanceQuota = normalized.EntryMinBalanceQuota
	}
	normalized.EntryMinQuota = common.Max(normalized.EntryMinQuota, 0)
	normalized.EntryMaxQuota = common.Max(normalized.EntryMaxQuota, 0)
	if normalized.EntryMaxQuota < normalized.EntryMinQuota {
		normalized.EntryMaxQuota = normalized.EntryMinQuota
	}
	normalized.EntryRewardBands = normalizeRewardBands(
		normalized.EntryRewardBands,
		normalized.EntryMinQuota,
		normalized.EntryMaxQuota,
		defaultEntryRewardBands(),
	)

	normalized.BasicMinBalanceQuota = common.Max(normalized.BasicMinBalanceQuota, normalized.EntryMinBalanceQuota)
	normalized.BasicMaxBalanceQuota = common.Max(normalized.BasicMaxBalanceQuota, 0)
	if normalized.BasicMaxBalanceQuota > 0 && normalized.BasicMaxBalanceQuota < normalized.BasicMinBalanceQuota {
		normalized.BasicMaxBalanceQuota = normalized.BasicMinBalanceQuota
	}
	normalized.MinQuota = common.Max(normalized.MinQuota, 0)
	normalized.MaxQuota = common.Max(normalized.MaxQuota, 0)
	if normalized.MaxQuota < normalized.MinQuota {
		normalized.MaxQuota = normalized.MinQuota
	}
	normalized.BasicRewardBands = normalizeRewardBands(
		normalized.BasicRewardBands,
		normalized.MinQuota,
		normalized.MaxQuota,
		defaultBasicRewardBands(),
	)

	normalized.AdvancedMinBalanceQuota = common.Max(normalized.AdvancedMinBalanceQuota, normalized.BasicMinBalanceQuota)
	normalized.AdvancedMaxBalanceQuota = common.Max(normalized.AdvancedMaxBalanceQuota, 0)
	if normalized.AdvancedMaxBalanceQuota > 0 && normalized.AdvancedMaxBalanceQuota < normalized.AdvancedMinBalanceQuota {
		normalized.AdvancedMaxBalanceQuota = normalized.AdvancedMinBalanceQuota
	}
	normalized.AdvancedMinQuota = common.Max(normalized.AdvancedMinQuota, 0)
	normalized.AdvancedMaxQuota = common.Max(normalized.AdvancedMaxQuota, 0)
	if normalized.AdvancedMaxQuota < normalized.AdvancedMinQuota {
		normalized.AdvancedMaxQuota = normalized.AdvancedMinQuota
	}
	normalized.AdvancedRewardBands = normalizeRewardBands(
		normalized.AdvancedRewardBands,
		normalized.AdvancedMinQuota,
		normalized.AdvancedMaxQuota,
		defaultAdvancedRewardBands(),
	)

	normalized.MinIntervalHours = common.Max(normalized.MinIntervalHours, 0)
	normalized.WeeklyRewardCapQuota = common.Max(normalized.WeeklyRewardCapQuota, 0)
	if !IsValidCheckinRewardRule(normalized.RewardRule) {
		normalized.RewardRule = CheckinRewardRuleHighestEligible
	}

	return normalized
}
