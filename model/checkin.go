package model

import (
	crand "crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// Checkin 签到记录
type Checkin struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;uniqueIndex:idx_user_checkin_date"`
	CheckinDate  string `json:"checkin_date" gorm:"type:varchar(10);not null;uniqueIndex:idx_user_checkin_date"` // 格式: YYYY-MM-DD
	QuotaAwarded int    `json:"quota_awarded" gorm:"not null"`
	CheckinTier  string `json:"checkin_tier" gorm:"type:varchar(32);not null;default:basic"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint"`
}

// CheckinRecord 用于API返回的签到记录（不包含敏感字段）
type CheckinRecord struct {
	CheckinDate  string `json:"checkin_date"`
	QuotaAwarded int    `json:"quota_awarded"`
	CheckinTier  string `json:"checkin_tier"`
}

// CheckinTierPolicy 签到等级策略（用于前端展示）
type CheckinTierPolicy struct {
	Tier            string                                `json:"tier"`
	TierName        string                                `json:"tier_name"`
	Enabled         bool                                  `json:"enabled"`
	MinBalanceQuota int                                   `json:"min_balance_quota"`
	MaxBalanceQuota int                                   `json:"max_balance_quota"`
	RewardMinQuota  int                                   `json:"reward_min_quota"`
	RewardMaxQuota  int                                   `json:"reward_max_quota"`
	RewardBands     []operation_setting.CheckinRewardBand `json:"reward_bands"`
	Eligible        bool                                  `json:"eligible"`
}

// CheckinEligibility 当前用户签到资格
type CheckinEligibility struct {
	CanCheckin bool `json:"can_checkin"`

	CurrentQuota int `json:"current_quota"`

	CurrentTier                string `json:"current_tier"`
	CurrentTierName            string `json:"current_tier_name"`
	CurrentTierMaxBalanceQuota int    `json:"current_tier_max_balance_quota"`

	RewardMinQuota int `json:"reward_min_quota"`
	RewardMaxQuota int `json:"reward_max_quota"`

	NextTier                string `json:"next_tier"`
	NextTierName            string `json:"next_tier_name"`
	NextTierMinBalanceQuota int    `json:"next_tier_min_balance_quota"`

	WeeklyRewardCapQuota       int `json:"weekly_reward_cap_quota"`
	WeeklyRewardAwardedQuota   int `json:"weekly_reward_awarded_quota"`
	WeeklyRewardRemainingQuota int `json:"weekly_reward_remaining_quota"`

	LockReason string `json:"lock_reason"`
}

func (Checkin) TableName() string {
	return "checkins"
}

// GetUserCheckinRecords 获取用户在指定日期范围内的签到记录
func GetUserCheckinRecords(userId int, startDate, endDate string) ([]Checkin, error) {
	var records []Checkin
	err := DB.Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?",
		userId, startDate, endDate).
		Order("checkin_date DESC").
		Find(&records).Error
	return records, err
}

// HasCheckedInToday 检查用户今天是否已签到
func HasCheckedInToday(userId int) (bool, error) {
	today := time.Now().Format("2006-01-02")
	return hasCheckedInDate(DB, userId, today)
}

func hasCheckedInDate(db *gorm.DB, userId int, date string) (bool, error) {
	var count int64
	err := db.Model(&Checkin{}).
		Where("user_id = ? AND checkin_date = ?", userId, date).
		Count(&count).Error
	return count > 0, err
}

func getTierDisplayName(tier string) string {
	switch tier {
	case operation_setting.CheckinTierAdvanced:
		return "高级签到"
	case operation_setting.CheckinTierMedium:
		return "中级签到"
	case operation_setting.CheckinTierBasic:
		return "基础签到"
	default:
		return "未解锁"
	}
}

func buildCheckinTierPolicies(setting operation_setting.CheckinSetting) []CheckinTierPolicy {
	policies := []CheckinTierPolicy{
		{
			Tier:            operation_setting.CheckinTierBasic,
			TierName:        getTierDisplayName(operation_setting.CheckinTierBasic),
			Enabled:         true,
			MinBalanceQuota: setting.EntryMinBalanceQuota,
			MaxBalanceQuota: setting.EntryMaxBalanceQuota,
			RewardMinQuota:  setting.EntryMinQuota,
			RewardMaxQuota:  setting.EntryMaxQuota,
			RewardBands:     operation_setting.GetRewardBandsByTier(setting, operation_setting.CheckinTierBasic),
		},
		{
			Tier:            operation_setting.CheckinTierMedium,
			TierName:        getTierDisplayName(operation_setting.CheckinTierMedium),
			Enabled:         true,
			MinBalanceQuota: setting.BasicMinBalanceQuota,
			MaxBalanceQuota: setting.BasicMaxBalanceQuota,
			RewardMinQuota:  setting.MinQuota,
			RewardMaxQuota:  setting.MaxQuota,
			RewardBands:     operation_setting.GetRewardBandsByTier(setting, operation_setting.CheckinTierMedium),
		},
	}

	if setting.AdvancedEnabled {
		policies = append(policies, CheckinTierPolicy{
			Tier:            operation_setting.CheckinTierAdvanced,
			TierName:        getTierDisplayName(operation_setting.CheckinTierAdvanced),
			Enabled:         true,
			MinBalanceQuota: setting.AdvancedMinBalanceQuota,
			MaxBalanceQuota: setting.AdvancedMaxBalanceQuota,
			RewardMinQuota:  setting.AdvancedMinQuota,
			RewardMaxQuota:  setting.AdvancedMaxQuota,
			RewardBands:     operation_setting.GetRewardBandsByTier(setting, operation_setting.CheckinTierAdvanced),
		})
	}

	return policies
}

func buildUserCheckinEligibility(currentQuota int, setting operation_setting.CheckinSetting) ([]CheckinTierPolicy, CheckinEligibility) {
	policies := buildCheckinTierPolicies(setting)
	eligibility := CheckinEligibility{
		CurrentQuota: currentQuota,
		CurrentTier:  "none",
	}

	eligiblePolicies := make([]CheckinTierPolicy, 0, len(policies))
	var nextTier *CheckinTierPolicy
	maxReachableQuota := 0

	for i := range policies {
		if !policies[i].Enabled {
			continue
		}
		inMinRange := currentQuota >= policies[i].MinBalanceQuota
		inMaxRange := policies[i].MaxBalanceQuota <= 0 || currentQuota <= policies[i].MaxBalanceQuota
		if inMinRange && inMaxRange {
			policies[i].Eligible = true
			eligiblePolicies = append(eligiblePolicies, policies[i])
		}
		if currentQuota < policies[i].MinBalanceQuota &&
			(nextTier == nil || policies[i].MinBalanceQuota < nextTier.MinBalanceQuota) {
			p := policies[i]
			nextTier = &p
		}
		if policies[i].MaxBalanceQuota > maxReachableQuota {
			maxReachableQuota = policies[i].MaxBalanceQuota
		}
	}

	if len(eligiblePolicies) == 0 {
		eligibility.CanCheckin = false
		if nextTier != nil {
			eligibility.NextTier = nextTier.Tier
			eligibility.NextTierName = nextTier.TierName
			eligibility.NextTierMinBalanceQuota = nextTier.MinBalanceQuota
			eligibility.LockReason = fmt.Sprintf(
				"余额不足：当前余额 %s，达到 %s 后解锁%s",
				logger.LogQuota(currentQuota),
				logger.LogQuota(nextTier.MinBalanceQuota),
				nextTier.TierName,
			)
		} else if maxReachableQuota > 0 && currentQuota > maxReachableQuota {
			eligibility.LockReason = fmt.Sprintf(
				"当前余额 %s 已超过签到余额上限 %s，请先消费后再签到",
				logger.LogQuota(currentQuota),
				logger.LogQuota(maxReachableQuota),
			)
		} else {
			eligibility.LockReason = "当前未配置可用签到等级"
		}
		return policies, eligibility
	}

	var selectedPolicy CheckinTierPolicy
	switch strings.ToLower(strings.TrimSpace(setting.RewardRule)) {
	case operation_setting.CheckinRewardRuleLowestEligible:
		selectedPolicy = eligiblePolicies[0]
	default:
		selectedPolicy = eligiblePolicies[len(eligiblePolicies)-1]
	}

	eligibility.CanCheckin = true
	eligibility.CurrentTier = selectedPolicy.Tier
	eligibility.CurrentTierName = selectedPolicy.TierName
	eligibility.CurrentTierMaxBalanceQuota = selectedPolicy.MaxBalanceQuota
	eligibility.RewardMinQuota = selectedPolicy.RewardMinQuota
	eligibility.RewardMaxQuota = selectedPolicy.RewardMaxQuota

	if nextTier != nil {
		eligibility.NextTier = nextTier.Tier
		eligibility.NextTierName = nextTier.TierName
		eligibility.NextTierMinBalanceQuota = nextTier.MinBalanceQuota
	}

	return policies, eligibility
}

// BuildUserCheckinEligibility 构建用户签到资格与等级（用于状态展示）
func BuildUserCheckinEligibility(currentQuota int) ([]CheckinTierPolicy, CheckinEligibility) {
	setting := operation_setting.GetNormalizedCheckinSetting()
	return buildUserCheckinEligibility(currentQuota, setting)
}

// BuildUserCheckinEligibilityWithCap 构建签到资格（含周奖励封顶约束）
func BuildUserCheckinEligibilityWithCap(userId int, currentQuota int) ([]CheckinTierPolicy, CheckinEligibility, error) {
	setting := operation_setting.GetNormalizedCheckinSetting()
	tiers, eligibility := buildUserCheckinEligibility(currentQuota, setting)
	if _, _, err := applyWeeklyRewardCapConstraint(DB, userId, time.Now(), setting, &eligibility); err != nil {
		return tiers, eligibility, err
	}
	return tiers, eligibility, nil
}

// GetUserCheckinCooldown 获取用户签到冷却状态
func GetUserCheckinCooldown(userId int, minIntervalHours int) (remainingSeconds int, nextCheckinAt int64, err error) {
	if minIntervalHours <= 0 {
		return 0, 0, nil
	}

	var lastCheckin Checkin
	if dbErr := DB.Where("user_id = ?", userId).Order("created_at DESC").First(&lastCheckin).Error; dbErr != nil {
		if errors.Is(dbErr, gorm.ErrRecordNotFound) {
			return 0, 0, nil
		}
		return 0, 0, dbErr
	}

	nextCheckinAt = lastCheckin.CreatedAt + int64(minIntervalHours*3600)
	remainingSeconds = int(nextCheckinAt - time.Now().Unix())
	if remainingSeconds < 0 {
		remainingSeconds = 0
	}

	return remainingSeconds, nextCheckinAt, nil
}

func validateCheckinFrequency(db *gorm.DB, userId int, now time.Time, minIntervalHours int) error {
	today := now.Format("2006-01-02")
	hasChecked, err := hasCheckedInDate(db, userId, today)
	if err != nil {
		return err
	}
	if hasChecked {
		return errors.New("今日已签到")
	}

	if minIntervalHours <= 0 {
		return nil
	}

	var lastCheckin Checkin
	err = db.Where("user_id = ?", userId).Order("created_at DESC").First(&lastCheckin).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	nextAllowed := time.Unix(lastCheckin.CreatedAt, 0).Add(time.Duration(minIntervalHours) * time.Hour)
	if now.Before(nextAllowed) {
		remainSeconds := int(nextAllowed.Sub(now).Seconds())
		if remainSeconds <= 0 {
			remainSeconds = 1
		}
		return fmt.Errorf("签到冷却中，请 %s 后再试", common.Seconds2Time(remainSeconds))
	}

	return nil
}

func getUserQuotaForCheckin(db *gorm.DB, userId int, lockForUpdate bool) (int, error) {
	var user User
	query := db.Select("id", "quota").Where("id = ?", userId)
	if lockForUpdate {
		query = query.Set("gorm:query_option", "FOR UPDATE")
	}
	if err := query.First(&user).Error; err != nil {
		return 0, err
	}
	return user.Quota, nil
}

func getWeekDateRange(now time.Time) (startDate string, endDate string) {
	base := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	weekday := int(base.Weekday()) // Sunday = 0
	if weekday == 0 {
		weekday = 7
	}
	weekStart := base.AddDate(0, 0, -(weekday - 1))
	weekEnd := weekStart.AddDate(0, 0, 6)
	return weekStart.Format("2006-01-02"), weekEnd.Format("2006-01-02")
}

func getUserAwardedQuotaByDateRange(db *gorm.DB, userId int, startDate string, endDate string) (int, error) {
	var totalQuota int64
	err := db.Model(&Checkin{}).
		Where("user_id = ? AND checkin_date >= ? AND checkin_date <= ?", userId, startDate, endDate).
		Select("COALESCE(SUM(quota_awarded), 0)").
		Scan(&totalQuota).Error
	if err != nil {
		return 0, err
	}
	return int(totalQuota), nil
}

func applyWeeklyRewardCapConstraint(
	db *gorm.DB,
	userId int,
	now time.Time,
	setting operation_setting.CheckinSetting,
	eligibility *CheckinEligibility,
) (int, int, error) {
	if eligibility == nil {
		return 0, 0, nil
	}
	eligibility.WeeklyRewardCapQuota = setting.WeeklyRewardCapQuota
	if setting.WeeklyRewardCapQuota <= 0 {
		eligibility.WeeklyRewardAwardedQuota = 0
		eligibility.WeeklyRewardRemainingQuota = 0
		return 0, 0, nil
	}

	startDate, endDate := getWeekDateRange(now)
	weeklyAwarded, err := getUserAwardedQuotaByDateRange(db, userId, startDate, endDate)
	if err != nil {
		return 0, 0, err
	}

	remaining := setting.WeeklyRewardCapQuota - weeklyAwarded
	if remaining < 0 {
		remaining = 0
	}

	eligibility.WeeklyRewardAwardedQuota = weeklyAwarded
	eligibility.WeeklyRewardRemainingQuota = remaining

	if !eligibility.CanCheckin {
		return weeklyAwarded, remaining, nil
	}

	if remaining <= 0 {
		eligibility.CanCheckin = false
		eligibility.LockReason = fmt.Sprintf(
			"本周签到奖励已达上限（%s）",
			logger.LogQuota(setting.WeeklyRewardCapQuota),
		)
		return weeklyAwarded, remaining, nil
	}

	if remaining < eligibility.RewardMinQuota {
		eligibility.CanCheckin = false
		eligibility.LockReason = fmt.Sprintf(
			"本周可领取奖励仅剩 %s，低于当前等级最低奖励 %s",
			logger.LogQuota(remaining),
			logger.LogQuota(eligibility.RewardMinQuota),
		)
		return weeklyAwarded, remaining, nil
	}

	if remaining < eligibility.RewardMaxQuota {
		eligibility.RewardMaxQuota = remaining
	}

	return weeklyAwarded, remaining, nil
}

func generateRandomQuotaAward(minQuota, maxQuota int) (int, error) {
	minQuota = common.Max(minQuota, 0)
	maxQuota = common.Max(maxQuota, 0)
	if maxQuota < minQuota {
		maxQuota = minQuota
	}
	if maxQuota == minQuota {
		return minQuota, nil
	}

	rangeSize := int64(maxQuota) - int64(minQuota) + 1
	if rangeSize <= 0 {
		return 0, errors.New("invalid reward range")
	}
	n, err := crand.Int(crand.Reader, big.NewInt(rangeSize))
	if err != nil {
		return 0, err
	}
	return minQuota + int(n.Int64()), nil
}

func generateRandomQuotaAwardByBands(
	minQuota int,
	maxQuota int,
	bands []operation_setting.CheckinRewardBand,
) (int, error) {
	minQuota = common.Max(minQuota, 0)
	maxQuota = common.Max(maxQuota, 0)
	if maxQuota < minQuota {
		maxQuota = minQuota
	}
	if len(bands) == 0 {
		return generateRandomQuotaAward(minQuota, maxQuota)
	}

	type weightedBand struct {
		minQuota int
		maxQuota int
		weight   int
	}

	validBands := make([]weightedBand, 0, len(bands))
	totalWeight := 0
	for i := range bands {
		weight := bands[i].Weight
		if weight <= 0 {
			continue
		}
		bandMin := common.Max(bands[i].MinQuota, minQuota)
		bandMax := bands[i].MaxQuota
		if bandMax > maxQuota {
			bandMax = maxQuota
		}
		if bandMax < bandMin {
			continue
		}
		validBands = append(validBands, weightedBand{
			minQuota: bandMin,
			maxQuota: bandMax,
			weight:   weight,
		})
		totalWeight += weight
	}

	if len(validBands) == 0 || totalWeight <= 0 {
		return generateRandomQuotaAward(minQuota, maxQuota)
	}

	randomWeight, err := crand.Int(crand.Reader, big.NewInt(int64(totalWeight)))
	if err != nil {
		return 0, err
	}
	selectedWeight := int(randomWeight.Int64())

	selectedBand := validBands[len(validBands)-1]
	runningWeight := 0
	for i := range validBands {
		runningWeight += validBands[i].weight
		if selectedWeight < runningWeight {
			selectedBand = validBands[i]
			break
		}
	}

	return generateRandomQuotaAward(selectedBand.minQuota, selectedBand.maxQuota)
}

func mapCheckinCreateError(err error) error {
	if err == nil {
		return nil
	}
	lower := strings.ToLower(err.Error())
	if strings.Contains(lower, "idx_user_checkin_date") ||
		strings.Contains(lower, "checkins_user_id_checkin_date") ||
		strings.Contains(lower, "duplicate") ||
		strings.Contains(lower, "unique") {
		return errors.New("今日已签到")
	}
	return errors.New("签到失败，请稍后重试")
}

// UserCheckin 执行用户签到
// MySQL 和 PostgreSQL 使用事务保证原子性
// SQLite 不支持嵌套事务，使用顺序操作 + 手动回滚
func UserCheckin(userId int) (*Checkin, error) {
	setting := operation_setting.GetNormalizedCheckinSetting()
	if !setting.Enabled {
		return nil, errors.New("签到功能未启用")
	}
	now := time.Now()

	// 根据数据库类型选择不同的策略
	if common.UsingSQLite {
		// SQLite 不支持嵌套事务，使用顺序操作 + 手动回滚
		return userCheckinWithoutTransaction(userId, setting, now)
	}

	// MySQL 和 PostgreSQL 支持事务，使用事务保证原子性
	return userCheckinWithTransaction(userId, setting, now)
}

// userCheckinWithTransaction 使用事务执行签到（适用于 MySQL 和 PostgreSQL）
func userCheckinWithTransaction(userId int, setting operation_setting.CheckinSetting, now time.Time) (*Checkin, error) {
	var checkin *Checkin
	var quotaAwarded int

	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := validateCheckinFrequency(tx, userId, now, setting.MinIntervalHours); err != nil {
			return err
		}

		userQuota, err := getUserQuotaForCheckin(tx, userId, true)
		if err != nil {
			return err
		}

		_, eligibility := buildUserCheckinEligibility(userQuota, setting)
		if !eligibility.CanCheckin {
			return errors.New(eligibility.LockReason)
		}

		if _, _, err = applyWeeklyRewardCapConstraint(tx, userId, now, setting, &eligibility); err != nil {
			return errors.New("签到失败：周封顶计算异常")
		}
		if !eligibility.CanCheckin {
			return errors.New(eligibility.LockReason)
		}

		rewardBands := operation_setting.GetRewardBandsByTier(setting, eligibility.CurrentTier)
		quotaAwarded, err = generateRandomQuotaAwardByBands(
			eligibility.RewardMinQuota,
			eligibility.RewardMaxQuota,
			rewardBands,
		)
		if err != nil {
			return errors.New("签到失败：奖励生成异常")
		}

		checkin = &Checkin{
			UserId:       userId,
			CheckinDate:  now.Format("2006-01-02"),
			QuotaAwarded: quotaAwarded,
			CheckinTier:  eligibility.CurrentTier,
			CreatedAt:    now.Unix(),
		}

		// 步骤1: 创建签到记录
		// 数据库有唯一约束 (user_id, checkin_date)，可以防止并发重复签到
		if err := tx.Create(checkin).Error; err != nil {
			return mapCheckinCreateError(err)
		}

		// 步骤2: 在事务中增加用户额度
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", quotaAwarded)).Error; err != nil {
			return errors.New("签到失败：更新额度出错")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	// 事务成功后，异步更新缓存
	go func() {
		_ = cacheIncrUserQuota(userId, int64(quotaAwarded))
	}()

	return checkin, nil
}

// userCheckinWithoutTransaction 不使用事务执行签到（适用于 SQLite）
func userCheckinWithoutTransaction(userId int, setting operation_setting.CheckinSetting, now time.Time) (*Checkin, error) {
	if err := validateCheckinFrequency(DB, userId, now, setting.MinIntervalHours); err != nil {
		return nil, err
	}

	userQuota, err := getUserQuotaForCheckin(DB, userId, false)
	if err != nil {
		return nil, err
	}
	_, eligibility := buildUserCheckinEligibility(userQuota, setting)
	if !eligibility.CanCheckin {
		return nil, errors.New(eligibility.LockReason)
	}

	if _, _, err = applyWeeklyRewardCapConstraint(DB, userId, now, setting, &eligibility); err != nil {
		return nil, errors.New("签到失败：周封顶计算异常")
	}
	if !eligibility.CanCheckin {
		return nil, errors.New(eligibility.LockReason)
	}

	rewardBands := operation_setting.GetRewardBandsByTier(setting, eligibility.CurrentTier)
	quotaAwarded, err := generateRandomQuotaAwardByBands(
		eligibility.RewardMinQuota,
		eligibility.RewardMaxQuota,
		rewardBands,
	)
	if err != nil {
		return nil, errors.New("签到失败：奖励生成异常")
	}

	checkin := &Checkin{
		UserId:       userId,
		CheckinDate:  now.Format("2006-01-02"),
		QuotaAwarded: quotaAwarded,
		CheckinTier:  eligibility.CurrentTier,
		CreatedAt:    now.Unix(),
	}

	// 步骤1: 创建签到记录
	// 数据库有唯一约束 (user_id, checkin_date)，可以防止并发重复签到
	if err := DB.Create(checkin).Error; err != nil {
		return nil, mapCheckinCreateError(err)
	}

	// 步骤2: 增加用户额度
	if err := DB.Model(&User{}).Where("id = ?", userId).
		Update("quota", gorm.Expr("quota + ?", quotaAwarded)).Error; err != nil {
		// 如果增加额度失败，需要回滚签到记录
		if rollbackErr := DB.Delete(checkin).Error; rollbackErr != nil {
			common.SysError("checkin rollback failed: " + rollbackErr.Error())
		}
		return nil, errors.New("签到失败：更新额度出错")
	}
	go func() {
		_ = cacheIncrUserQuota(userId, int64(quotaAwarded))
	}()

	return checkin, nil
}

// GetUserCheckinStats 获取用户签到统计信息
func GetUserCheckinStats(userId int, month string) (map[string]interface{}, error) {
	// 获取指定月份的所有签到记录
	startDate := month + "-01"
	endDate := month + "-31"

	records, err := GetUserCheckinRecords(userId, startDate, endDate)
	if err != nil {
		return nil, err
	}

	// 转换为不包含敏感字段的记录
	checkinRecords := make([]CheckinRecord, len(records))
	for i, r := range records {
		checkinRecords[i] = CheckinRecord{
			CheckinDate:  r.CheckinDate,
			QuotaAwarded: r.QuotaAwarded,
			CheckinTier:  r.CheckinTier,
		}
	}

	// 检查今天是否已签到
	hasCheckedToday, _ := HasCheckedInToday(userId)

	// 获取用户所有时间的签到统计
	var totalCheckins int64
	var totalQuota int64
	DB.Model(&Checkin{}).Where("user_id = ?", userId).Count(&totalCheckins)
	DB.Model(&Checkin{}).Where("user_id = ?", userId).Select("COALESCE(SUM(quota_awarded), 0)").Scan(&totalQuota)

	normalizedSetting := operation_setting.GetNormalizedCheckinSetting()
	weekStartDate, weekEndDate := getWeekDateRange(time.Now())
	weeklyQuotaAwarded, err := getUserAwardedQuotaByDateRange(DB, userId, weekStartDate, weekEndDate)
	if err != nil {
		return nil, err
	}
	weeklyRemaining := 0
	if normalizedSetting.WeeklyRewardCapQuota > 0 {
		weeklyRemaining = normalizedSetting.WeeklyRewardCapQuota - weeklyQuotaAwarded
		if weeklyRemaining < 0 {
			weeklyRemaining = 0
		}
	}

	return map[string]interface{}{
		"total_quota":                   totalQuota,                             // 所有时间累计获得的额度
		"total_checkins":                totalCheckins,                          // 所有时间累计签到次数
		"checkin_count":                 len(records),                           // 本月签到次数
		"checked_in_today":              hasCheckedToday,                        // 今天是否已签到
		"records":                       checkinRecords,                         // 本月签到记录详情（不含id和user_id）
		"weekly_quota_awarded":          weeklyQuotaAwarded,                     // 本周累计签到奖励
		"weekly_reward_cap_quota":       normalizedSetting.WeeklyRewardCapQuota, // 本周奖励上限（0 表示不限制）
		"weekly_reward_remaining_quota": weeklyRemaining,                        // 本周剩余额度
		"week_start_date":               weekStartDate,                          // 本周起始日（周一）
		"week_end_date":                 weekEndDate,                            // 本周结束日（周日）
	}, nil
}
