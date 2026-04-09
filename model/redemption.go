package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

type Redemption struct {
	Id              int            `json:"id"`
	UserId          int            `json:"user_id"`
	Key             string         `json:"key" gorm:"type:char(32);uniqueIndex"`
	Status          int            `json:"status" gorm:"default:1"`
	Name            string         `json:"name" gorm:"index"`
	Quota           int            `json:"quota" gorm:"default:100"`
	BatchNo         string         `json:"batch_no" gorm:"type:varchar(128);index"`
	CampaignName    string         `json:"campaign_name" gorm:"type:varchar(128);index"`
	Channel         string         `json:"channel" gorm:"type:varchar(64);index"`
	SourcePlatform  string         `json:"source_platform" gorm:"type:varchar(64);index"`
	ExternalOrderNo string         `json:"external_order_no" gorm:"type:varchar(128);index"`
	Notes           string         `json:"notes" gorm:"type:text"`
	CreatedTime     int64          `json:"created_time" gorm:"bigint"`
	RedeemedTime    int64          `json:"redeemed_time" gorm:"bigint"`
	Count           int            `json:"count" gorm:"-:all"` // only for api request
	UsedUserId      int            `json:"used_user_id"`
	DeletedAt       gorm.DeletedAt `gorm:"index"`
	ExpiredTime     int64          `json:"expired_time" gorm:"bigint"` // 过期时间，0 表示不过期
}

type RedemptionQuery struct {
	Keyword         string
	Status          int
	Availability    string
	BatchNo         string
	CampaignName    string
	Channel         string
	SourcePlatform  string
	ExternalOrderNo string
	CreatedBy       int
	CreatedFrom     int64
	CreatedTo       int64
}

func normalizeRedemptionKey(key string) string {
	return strings.ToUpper(strings.TrimSpace(key))
}

func applyRedemptionFilters(query *gorm.DB, filters RedemptionQuery) (*gorm.DB, error) {
	now := common.GetTimestamp()
	if keyword := strings.TrimSpace(filters.Keyword); keyword != "" {
		if id, convErr := strconv.Atoi(keyword); convErr == nil {
			query = query.Where(
				"id = ? OR name LIKE ? OR "+commonKeyCol+" LIKE ?",
				id,
				"%"+keyword+"%",
				"%"+strings.ToUpper(keyword)+"%",
			)
		} else {
			query = query.Where(
				"name LIKE ? OR "+commonKeyCol+" LIKE ?",
				"%"+keyword+"%",
				"%"+strings.ToUpper(keyword)+"%",
			)
		}
	}
	if filters.Status != 0 {
		query = query.Where("status = ?", filters.Status)
	}
	if value := strings.TrimSpace(filters.BatchNo); value != "" {
		query = query.Where("batch_no LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.CampaignName); value != "" {
		query = query.Where("campaign_name LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.Channel); value != "" {
		query = query.Where("channel LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.SourcePlatform); value != "" {
		query = query.Where("source_platform LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.ExternalOrderNo); value != "" {
		query = query.Where("external_order_no LIKE ?", "%"+value+"%")
	}
	if filters.CreatedBy > 0 {
		query = query.Where("user_id = ?", filters.CreatedBy)
	}
	if filters.CreatedFrom > 0 {
		query = query.Where("created_time >= ?", filters.CreatedFrom)
	}
	if filters.CreatedTo > 0 {
		query = query.Where("created_time <= ?", filters.CreatedTo)
	}
	switch strings.ToLower(strings.TrimSpace(filters.Availability)) {
	case "":
		return query, nil
	case "available":
		query = query.Where("status = ?", common.RedemptionCodeStatusEnabled).
			Where("(expired_time = 0 OR expired_time >= ?)", now)
	case "expired":
		query = query.Where("expired_time != 0 AND expired_time < ?", now)
	case "disabled":
		query = query.Where("status = ?", common.RedemptionCodeStatusDisabled)
	case "used":
		query = query.Where("status = ?", common.RedemptionCodeStatusUsed)
	default:
		return nil, errors.New("兑换码可用性筛选无效")
	}
	return query, nil
}

func GetAllRedemptions(startIdx int, num int, filters RedemptionQuery) (redemptions []*Redemption, total int64, err error) {
	// 开始事务
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query, err := applyRedemptionFilters(tx.Model(&Redemption{}), filters)
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取总数
	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 获取分页数据
	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&redemptions).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// 提交事务
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return redemptions, total, nil
}

func SearchRedemptions(keyword string, startIdx int, num int, filters RedemptionQuery) (redemptions []*Redemption, total int64, err error) {
	filters.Keyword = keyword
	return GetAllRedemptions(startIdx, num, filters)
}

func GetRedemptionBatchSummaries(filters RedemptionQuery, limit int) ([]*CodeBatchSummary, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	now := common.GetTimestamp()
	query, err := applyRedemptionFilters(DB.Model(&Redemption{}), filters)
	if err != nil {
		return nil, err
	}
	summaries := make([]*CodeBatchSummary, 0)
	err = query.
		Where("batch_no != ''").
		Select(
			`batch_no,
			COUNT(*) AS total_count,
			SUM(CASE WHEN status = ? AND (expired_time = 0 OR expired_time >= ?) THEN 1 ELSE 0 END) AS available_count,
			SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS enabled_count,
			SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS disabled_count,
			SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS used_count,
			SUM(CASE WHEN expired_time != 0 AND expired_time < ? THEN 1 ELSE 0 END) AS expired_count,
			MAX(created_time) AS latest_created_at`,
			common.RedemptionCodeStatusEnabled,
			now,
			common.RedemptionCodeStatusEnabled,
			common.RedemptionCodeStatusDisabled,
			common.RedemptionCodeStatusUsed,
			now,
		).
		Group("batch_no").
		Order("latest_created_at desc").
		Limit(limit).
		Scan(&summaries).Error
	return summaries, err
}

func GetRedemptionById(id int) (*Redemption, error) {
	if id == 0 {
		return nil, errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	var err error = nil
	err = DB.First(&redemption, "id = ?", id).Error
	return &redemption, err
}

func Redeem(key string, userId int) (quota int, err error) {
	quota, _, err = RedeemWithDetail(key, userId)
	if err != nil {
		common.SysError("redemption failed: " + err.Error())
		return 0, ErrRedeemFailed
	}
	return quota, nil
}

func RedeemWithDetail(key string, userId int) (quota int, redemption *Redemption, err error) {
	if key == "" {
		return 0, nil, errors.New("未提供兑换码")
	}
	if userId == 0 {
		return 0, nil, errors.New("无效的 user id")
	}
	redemption = &Redemption{}

	keyCol := "`key`"
	if common.UsingPostgreSQL {
		keyCol = `"key"`
	}
	common.RandomSleep()
	err = DB.Transaction(func(tx *gorm.DB) error {
		err := tx.Set("gorm:query_option", "FOR UPDATE").Where(keyCol+" = ?", normalizeRedemptionKey(key)).First(redemption).Error
		if err != nil {
			return errors.New("无效的兑换码")
		}
		if redemption.Status != common.RedemptionCodeStatusEnabled {
			return errors.New("该兑换码已被使用")
		}
		if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
			return errors.New("该兑换码已过期")
		}
		err = tx.Model(&User{}).Where("id = ?", userId).Update("quota", gorm.Expr("quota + ?", redemption.Quota)).Error
		if err != nil {
			return err
		}
		redemption.RedeemedTime = common.GetTimestamp()
		redemption.Status = common.RedemptionCodeStatusUsed
		redemption.UsedUserId = userId
		err = tx.Save(redemption).Error
		return err
	})
	if err != nil {
		return 0, nil, err
	}
	RecordLog(userId, LogTypeTopup, fmt.Sprintf("通过兑换码充值 %s，兑换码ID %d", logger.LogQuota(redemption.Quota), redemption.Id))
	return redemption.Quota, redemption, nil
}

func (redemption *Redemption) Insert() error {
	redemption.Key = normalizeRedemptionKey(redemption.Key)
	var err error
	err = DB.Create(redemption).Error
	return err
}

func (redemption *Redemption) SelectUpdate() error {
	// This can update zero values
	return DB.Model(redemption).Select("redeemed_time", "status").Updates(redemption).Error
}

// Update Make sure your token's fields is completed, because this will update non-zero values
func (redemption *Redemption) Update() error {
	redemption.Key = normalizeRedemptionKey(redemption.Key)
	var err error
	err = DB.Model(redemption).Select("name", "status", "quota", "batch_no", "campaign_name", "channel", "source_platform", "external_order_no", "notes", "redeemed_time", "expired_time").Updates(redemption).Error
	return err
}

func (redemption *Redemption) Delete() error {
	var err error
	err = DB.Delete(redemption).Error
	return err
}

func DeleteRedemptionById(id int) (err error) {
	if id == 0 {
		return errors.New("id 为空！")
	}
	redemption := Redemption{Id: id}
	err = DB.Where(redemption).First(&redemption).Error
	if err != nil {
		return err
	}
	return redemption.Delete()
}

func BatchDeleteRedemptions(ids []int) (int64, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 不能为空")
	}
	result := DB.Where("id IN ?", ids).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}

func BatchUpdateRedemptionStatus(ids []int, status int) (int64, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 不能为空")
	}
	if status != common.RedemptionCodeStatusEnabled && status != common.RedemptionCodeStatusDisabled {
		return 0, errors.New("兑换码状态无效")
	}
	result := DB.Model(&Redemption{}).
		Where("id IN ?", ids).
		Where("status IN ?", []int{common.RedemptionCodeStatusEnabled, common.RedemptionCodeStatusDisabled}).
		Update("status", status)
	return result.RowsAffected, result.Error
}

func DeleteInvalidRedemptions() (int64, error) {
	now := common.GetTimestamp()
	result := DB.Where("status IN ? OR (status = ? AND expired_time != 0 AND expired_time < ?)", []int{common.RedemptionCodeStatusUsed, common.RedemptionCodeStatusDisabled}, common.RedemptionCodeStatusEnabled, now).Delete(&Redemption{})
	return result.RowsAffected, result.Error
}

func ValidateRedemptionAdminPayload(redemption *Redemption) error {
	if redemption == nil {
		return errors.New("兑换码参数不能为空")
	}
	redemption.Name = strings.TrimSpace(redemption.Name)
	if redemption.Name == "" {
		return errors.New("兑换码名称不能为空")
	}
	if utf8Len := len([]rune(redemption.Name)); utf8Len > 64 {
		return errors.New("兑换码名称长度不能超过 64 个字符")
	}
	redemption.Key = normalizeRedemptionKey(redemption.Key)
	if redemption.Key != "" && len([]rune(redemption.Key)) > 64 {
		return errors.New("兑换码长度不能超过 64 个字符")
	}
	if redemption.Quota <= 0 {
		return errors.New("兑换额度必须大于 0")
	}
	if redemption.Count < 0 {
		return errors.New("批量创建数量不能小于 0")
	}
	if redemption.Count > 100 {
		return errors.New("批量创建数量不能超过 100")
	}
	if redemption.Status == 0 {
		redemption.Status = common.RedemptionCodeStatusEnabled
	}
	if redemption.Status != common.RedemptionCodeStatusEnabled && redemption.Status != common.RedemptionCodeStatusDisabled {
		return errors.New("兑换码状态无效")
	}
	if redemption.ExpiredTime != 0 && redemption.ExpiredTime < common.GetTimestamp() {
		return errors.New("过期时间不能早于当前时间")
	}
	redemption.BatchNo = strings.TrimSpace(redemption.BatchNo)
	redemption.CampaignName = strings.TrimSpace(redemption.CampaignName)
	redemption.Channel = strings.TrimSpace(redemption.Channel)
	redemption.SourcePlatform = strings.TrimSpace(redemption.SourcePlatform)
	redemption.ExternalOrderNo = strings.TrimSpace(redemption.ExternalOrderNo)
	redemption.Notes = strings.TrimSpace(redemption.Notes)
	return nil
}
