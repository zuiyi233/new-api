package model

import (
	crand "crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

const (
	LotteryTypeWheel   = "wheel"
	LotteryTypeScratch = "scratch"
	LotteryTypeEgg     = "egg"
	LotteryTypeShake   = "shake"
)

type LotteryRecord struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int    `json:"user_id" gorm:"not null;index:idx_lottery_user_date"`
	LotteryType  string `json:"lottery_type" gorm:"type:varchar(32);not null;index:idx_lottery_user_date"`
	PrizeId      string `json:"prize_id" gorm:"type:varchar(64);not null"`
	QuotaAwarded int    `json:"quota_awarded" gorm:"not null;default:0"`
	CreatedAt    int64  `json:"created_at" gorm:"bigint;not null"`
}

func (LotteryRecord) TableName() string {
	return "lottery_records"
}

type LotteryTypeInfo struct {
	Type          string                                 `json:"type"`
	Name          string                                 `json:"name"`
	Description   string                                 `json:"description"`
	Icon          string                                 `json:"icon"`
	Enabled       bool                                   `json:"enabled"`
	UnlockMode    string                                 `json:"unlock_mode"`
	UnlockValue   int                                    `json:"unlock_value"`
	DailyLimit    int                                    `json:"daily_limit"`
	Prizes        []operation_setting.LotteryPrizeConfig `json:"prizes"`
	IsUnlocked    bool                                   `json:"is_unlocked"`
	Remaining     int                                    `json:"remaining"`
	IsTimeLimited bool                                   `json:"is_time_limited"`
	StartTime     int64                                  `json:"start_time"`
	EndTime       int64                                  `json:"end_time"`
}

type LotteryStatusResponse struct {
	Enabled           bool              `json:"enabled"`
	Types             []LotteryTypeInfo `json:"types"`
	TotalPlays        int64             `json:"total_plays"`
	TotalQuota        int64             `json:"total_quota"`
	CheckinTier       string            `json:"checkin_tier"`
	CheckinEligible   bool              `json:"checkin_eligible"`
	CheckinLockReason string            `json:"checkin_lock_reason,omitempty"`
}

type LotteryPlayResponse struct {
	Success      bool                                  `json:"success"`
	Prize        *operation_setting.LotteryPrizeConfig `json:"prize"`
	QuotaAwarded int                                   `json:"quota_awarded"`
	CurrentQuota int                                   `json:"current_quota"`
	Remaining    int                                   `json:"remaining"`
	CheckinTier  string                                `json:"checkin_tier"`
}

func resolveLotteryCheckinTier(userId int) (string, error) {
	userQuota, err := GetUserQuota(userId, true)
	if err != nil {
		return "", err
	}
	_, eligibility := BuildUserCheckinEligibility(userQuota)
	if !eligibility.CanCheckin {
		if eligibility.LockReason != "" {
			return "", errors.New(eligibility.LockReason)
		}
		return "", errors.New("当前签到资格不可用")
	}
	if eligibility.CurrentTier == "" {
		return operation_setting.CheckinTierBasic, nil
	}
	switch eligibility.CurrentTier {
	case operation_setting.CheckinTierAdvanced, operation_setting.CheckinTierMedium, operation_setting.CheckinTierBasic:
		return eligibility.CurrentTier, nil
	default:
		return operation_setting.CheckinTierBasic, nil
	}
}

func resolveLotteryCheckinEligibility(userId int) (CheckinEligibility, error) {
	userQuota, err := GetUserQuota(userId, true)
	if err != nil {
		return CheckinEligibility{}, err
	}
	_, eligibility := BuildUserCheckinEligibility(userQuota)
	return eligibility, nil
}

func mapCheckinTierForLotteryStatus(rawTier string) string {
	switch rawTier {
	case operation_setting.CheckinTierAdvanced, operation_setting.CheckinTierMedium, operation_setting.CheckinTierBasic:
		return rawTier
	case "", "none":
		return "none"
	default:
		return "none"
	}
}

func getUserLotteryTodayCount(db *gorm.DB, userId int, lotteryType string) (int64, error) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location()).Unix()
	endOfDay := startOfDay + 86400
	var count int64
	err := db.Model(&LotteryRecord{}).
		Where("user_id = ? AND lottery_type = ? AND created_at >= ? AND created_at < ?", userId, lotteryType, startOfDay, endOfDay).
		Count(&count).Error
	return count, err
}

func getUserTotalLotteryCount(db *gorm.DB, userId int) (int64, error) {
	var count int64
	err := db.Model(&LotteryRecord{}).Where("user_id = ?", userId).Count(&count).Error
	return count, err
}

func getUserTotalLotteryQuota(db *gorm.DB, userId int) (int64, error) {
	var total int64
	err := db.Model(&LotteryRecord{}).Where("user_id = ?", userId).
		Select("COALESCE(SUM(quota_awarded), 0)").Scan(&total).Error
	return total, err
}

func selectPrizeByWeight(prizes []operation_setting.LotteryPrizeConfig) (*operation_setting.LotteryPrizeConfig, error) {
	if len(prizes) == 0 {
		return nil, errors.New("no prizes configured")
	}

	totalWeight := 0
	for i := range prizes {
		if prizes[i].Weight <= 0 {
			continue
		}
		totalWeight += prizes[i].Weight
	}

	if totalWeight <= 0 {
		return nil, errors.New("no valid prize weights")
	}

	n, err := crand.Int(crand.Reader, big.NewInt(int64(totalWeight)))
	if err != nil {
		return nil, err
	}
	selectedWeight := int(n.Int64())

	runningWeight := 0
	for i := range prizes {
		if prizes[i].Weight <= 0 {
			continue
		}
		runningWeight += prizes[i].Weight
		if selectedWeight < runningWeight {
			return &prizes[i], nil
		}
	}

	return &prizes[len(prizes)-1], nil
}

func generatePrizeQuota(prize *operation_setting.LotteryPrizeConfig) (int, error) {
	if prize.MinQuota == prize.MaxQuota {
		return prize.MinQuota, nil
	}
	minQ := common.Max(prize.MinQuota, 0)
	maxQ := common.Max(prize.MaxQuota, minQ)
	if maxQ == minQ {
		return minQ, nil
	}
	rangeSize := int64(maxQ) - int64(minQ) + 1
	n, err := crand.Int(crand.Reader, big.NewInt(rangeSize))
	if err != nil {
		return 0, err
	}
	return minQ + int(n.Int64()), nil
}

func isLotteryTypeUnlocked(
	db *gorm.DB,
	userId int,
	typeConfig operation_setting.LotteryTypeConfig,
) (bool, error) {
	switch typeConfig.UnlockMode {
	case operation_setting.LotteryUnlockModeTotalCheckins:
		var totalCheckins int64
		if err := db.Model(&Checkin{}).Where("user_id = ?", userId).Count(&totalCheckins).Error; err != nil {
			return false, err
		}
		return int(totalCheckins) >= typeConfig.UnlockValue, nil
	case operation_setting.LotteryUnlockModeTotalLottery:
		totalLottery, err := getUserTotalLotteryCount(db, userId)
		if err != nil {
			return false, err
		}
		return int(totalLottery) >= typeConfig.UnlockValue, nil
	case operation_setting.LotteryUnlockModeBalanceQuota:
		userQuota, err := GetUserQuota(userId, true)
		if err != nil {
			return false, err
		}
		return userQuota >= typeConfig.UnlockValue, nil
	default:
		return true, nil
	}
}

func UserLotteryPlay(userId int, lotteryType string) (*LotteryPlayResponse, error) {
	setting := operation_setting.GetNormalizedLotterySetting()
	if !setting.Enabled {
		return nil, errors.New("lottery feature is not enabled")
	}

	typeConfig, err := setting.GetTypeConfig(lotteryType)
	if err != nil {
		return nil, err
	}
	if !typeConfig.Enabled {
		return nil, fmt.Errorf("lottery type %s is not enabled", lotteryType)
	}

	now := time.Now()
	if typeConfig.IsTimeLimited {
		if now.Unix() < typeConfig.StartTime {
			return nil, errors.New("lottery event has not started yet")
		}
		if now.Unix() > typeConfig.EndTime {
			return nil, errors.New("lottery event has ended")
		}
	}

	unlocked, err := isLotteryTypeUnlocked(DB, userId, typeConfig)
	if err != nil {
		return nil, errors.New("failed to check unlock requirement")
	}
	if !unlocked {
		switch typeConfig.UnlockMode {
		case operation_setting.LotteryUnlockModeTotalCheckins:
			var totalCheckins int64
			_ = DB.Model(&Checkin{}).Where("user_id = ?", userId).Count(&totalCheckins).Error
			return nil, fmt.Errorf("unlock requires %d total check-ins, you have %d", typeConfig.UnlockValue, totalCheckins)
		case operation_setting.LotteryUnlockModeTotalLottery:
			totalLottery, _ := getUserTotalLotteryCount(DB, userId)
			return nil, fmt.Errorf("unlock requires %d total lottery plays, you have %d", typeConfig.UnlockValue, totalLottery)
		case operation_setting.LotteryUnlockModeBalanceQuota:
			userQuota, _ := GetUserQuota(userId, true)
			return nil, fmt.Errorf("unlock requires %s account balance, you have %s",
				logger.LogQuota(typeConfig.UnlockValue),
				logger.LogQuota(userQuota))
		default:
			return nil, errors.New("lottery type is locked")
		}
	}

	if typeConfig.DailyLimit > 0 {
		todayCount, err := getUserLotteryTodayCount(DB, userId, lotteryType)
		if err != nil {
			return nil, errors.New("failed to check daily limit")
		}
		if int(todayCount) >= typeConfig.DailyLimit {
			return nil, errors.New("daily limit reached for this lottery type")
		}
	}

	checkinTier, err := resolveLotteryCheckinTier(userId)
	if err != nil {
		return nil, err
	}

	prizes := typeConfig.GetPrizesByTier(checkinTier)
	if len(prizes) == 0 {
		return nil, errors.New("no prizes configured for this lottery type")
	}

	selectedPrize, err := selectPrizeByWeight(prizes)
	if err != nil {
		return nil, err
	}

	quotaAwarded, err := generatePrizeQuota(selectedPrize)
	if err != nil {
		return nil, errors.New("failed to generate prize quota")
	}

	if common.UsingSQLite {
		return userLotteryPlayWithoutTransaction(userId, lotteryType, selectedPrize, quotaAwarded, checkinTier, typeConfig)
	}
	return userLotteryPlayWithTransaction(userId, lotteryType, selectedPrize, quotaAwarded, checkinTier, typeConfig)
}

func userLotteryPlayWithTransaction(userId int, lotteryType string, prize *operation_setting.LotteryPrizeConfig, quotaAwarded int, checkinTier string, typeConfig operation_setting.LotteryTypeConfig) (*LotteryPlayResponse, error) {
	var remaining int

	err := DB.Transaction(func(tx *gorm.DB) error {
		if typeConfig.DailyLimit > 0 {
			todayCount, err := getUserLotteryTodayCount(tx, userId, lotteryType)
			if err != nil {
				return err
			}
			if int(todayCount) >= typeConfig.DailyLimit {
				return errors.New("daily limit reached for this lottery type")
			}
			remaining = typeConfig.DailyLimit - int(todayCount) - 1
		} else {
			remaining = -1
		}

		record := &LotteryRecord{
			UserId:       userId,
			LotteryType:  lotteryType,
			PrizeId:      prize.Id,
			QuotaAwarded: quotaAwarded,
			CreatedAt:    time.Now().Unix(),
		}
		if err := tx.Create(record).Error; err != nil {
			return errors.New("failed to create lottery record")
		}

		if quotaAwarded > 0 {
			if err := tx.Model(&User{}).Where("id = ?", userId).
				Update("quota", gorm.Expr("quota + ?", quotaAwarded)).Error; err != nil {
				return errors.New("failed to update user quota")
			}
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	go func() {
		_ = cacheIncrUserQuota(userId, int64(quotaAwarded))
	}()

	currentQuota, _ := GetUserQuota(userId, true)

	RecordLog(userId, LogTypeSystem, fmt.Sprintf("lottery[%s] prize[%s] quota %s", lotteryType, prize.Id, logger.LogQuota(quotaAwarded)))

	return &LotteryPlayResponse{
		Success:      true,
		Prize:        prize,
		QuotaAwarded: quotaAwarded,
		CurrentQuota: currentQuota,
		Remaining:    remaining,
		CheckinTier:  checkinTier,
	}, nil
}

func userLotteryPlayWithoutTransaction(userId int, lotteryType string, prize *operation_setting.LotteryPrizeConfig, quotaAwarded int, checkinTier string, typeConfig operation_setting.LotteryTypeConfig) (*LotteryPlayResponse, error) {
	var remaining int

	if typeConfig.DailyLimit > 0 {
		todayCount, err := getUserLotteryTodayCount(DB, userId, lotteryType)
		if err != nil {
			return nil, err
		}
		if int(todayCount) >= typeConfig.DailyLimit {
			return nil, errors.New("daily limit reached for this lottery type")
		}
		remaining = typeConfig.DailyLimit - int(todayCount) - 1
	} else {
		remaining = -1
	}

	record := &LotteryRecord{
		UserId:       userId,
		LotteryType:  lotteryType,
		PrizeId:      prize.Id,
		QuotaAwarded: quotaAwarded,
		CreatedAt:    time.Now().Unix(),
	}
	if err := DB.Create(record).Error; err != nil {
		return nil, errors.New("failed to create lottery record")
	}

	if quotaAwarded > 0 {
		if err := DB.Model(&User{}).Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", quotaAwarded)).Error; err != nil {
			if rollbackErr := DB.Delete(record).Error; rollbackErr != nil {
				common.SysError("lottery rollback failed: " + rollbackErr.Error())
			}
			return nil, errors.New("failed to update user quota")
		}
	}

	go func() {
		_ = cacheIncrUserQuota(userId, int64(quotaAwarded))
	}()

	currentQuota, _ := GetUserQuota(userId, true)

	RecordLog(userId, LogTypeSystem, fmt.Sprintf("lottery[%s] prize[%s] quota %s", lotteryType, prize.Id, logger.LogQuota(quotaAwarded)))

	return &LotteryPlayResponse{
		Success:      true,
		Prize:        prize,
		QuotaAwarded: quotaAwarded,
		CurrentQuota: currentQuota,
		Remaining:    remaining,
		CheckinTier:  checkinTier,
	}, nil
}

func GetLotteryStatus(userId int) (*LotteryStatusResponse, error) {
	setting := operation_setting.GetNormalizedLotterySetting()
	if !setting.Enabled {
		return &LotteryStatusResponse{Enabled: false}, nil
	}

	eligibility, err := resolveLotteryCheckinEligibility(userId)
	if err != nil {
		return nil, errors.New("failed to resolve checkin tier")
	}
	checkinTier := mapCheckinTierForLotteryStatus(eligibility.CurrentTier)

	typeConfigs := setting.GetAllTypeConfigs()
	types := make([]LotteryTypeInfo, 0, len(typeConfigs))

	for _, tc := range typeConfigs {
		prizes := tc.GetPrizesByTier(checkinTier)
		if len(prizes) == 0 {
			prizes = tc.Prizes
		}

		info := LotteryTypeInfo{
			Type:          tc.Type,
			Name:          tc.Name,
			Description:   tc.Description,
			Icon:          tc.Icon,
			Enabled:       tc.Enabled,
			UnlockMode:    tc.UnlockMode,
			UnlockValue:   tc.UnlockValue,
			DailyLimit:    tc.DailyLimit,
			Prizes:        prizes,
			IsTimeLimited: tc.IsTimeLimited,
			StartTime:     tc.StartTime,
			EndTime:       tc.EndTime,
		}

		isUnlocked := eligibility.CanCheckin
		if isUnlocked && tc.UnlockMode != operation_setting.LotteryUnlockModeNone {
			unlocked, unlockErr := isLotteryTypeUnlocked(DB, userId, tc)
			if unlockErr != nil {
				return nil, errors.New("failed to check unlock requirement")
			}
			isUnlocked = unlocked
		}
		info.IsUnlocked = isUnlocked

		if tc.DailyLimit > 0 {
			todayCount, _ := getUserLotteryTodayCount(DB, userId, tc.Type)
			info.Remaining = tc.DailyLimit - int(todayCount)
			if info.Remaining < 0 {
				info.Remaining = 0
			}
		} else {
			info.Remaining = -1
		}

		types = append(types, info)
	}

	totalPlays, _ := getUserTotalLotteryCount(DB, userId)
	totalQuota, _ := getUserTotalLotteryQuota(DB, userId)

	return &LotteryStatusResponse{
		Enabled:           true,
		Types:             types,
		TotalPlays:        totalPlays,
		TotalQuota:        totalQuota,
		CheckinTier:       checkinTier,
		CheckinEligible:   eligibility.CanCheckin,
		CheckinLockReason: eligibility.LockReason,
	}, nil
}

func GetLotteryHistory(userId int, lotteryType string, page int, pageSize int) ([]LotteryRecord, int64, error) {
	var records []LotteryRecord
	var total int64

	query := DB.Model(&LotteryRecord{}).Where("user_id = ?", userId)
	if lotteryType != "" {
		query = query.Where("lottery_type = ?", lotteryType)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&records).Error
	return records, total, err
}
