package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type SubscriptionCode struct {
	Id              int            `json:"id"`
	Code            string         `json:"code" gorm:"type:varchar(64);uniqueIndex"`
	Name            string         `json:"name" gorm:"index"`
	PlanId          int            `json:"plan_id" gorm:"index"`
	Status          int            `json:"status" gorm:"default:1"`
	ExpiresAt       int64          `json:"expires_at" gorm:"bigint"`
	MaxUses         int            `json:"max_uses" gorm:"default:1"`
	UsedCount       int            `json:"used_count" gorm:"default:0"`
	CreatedBy       int            `json:"created_by" gorm:"index"`
	BatchNo         string         `json:"batch_no" gorm:"type:varchar(128);index"`
	CampaignName    string         `json:"campaign_name" gorm:"type:varchar(128);index"`
	Channel         string         `json:"channel" gorm:"type:varchar(64);index"`
	SourcePlatform  string         `json:"source_platform" gorm:"type:varchar(64);index"`
	ExternalOrderNo string         `json:"external_order_no" gorm:"type:varchar(128);index"`
	Notes           string         `json:"notes" gorm:"type:text"`
	CreatedAt       int64          `json:"created_at" gorm:"bigint"`
	UpdatedAt       int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`
	Count           int            `json:"count" gorm:"-:all"`
}

type SubscriptionCodeUsage struct {
	Id                 int            `json:"id"`
	SubscriptionCodeId int            `json:"subscription_code_id" gorm:"index"`
	UserId             int            `json:"user_id" gorm:"index"`
	UserSubscriptionId int            `json:"user_subscription_id" gorm:"index"`
	PlanId             int            `json:"plan_id" gorm:"index"`
	UsedAt             int64          `json:"used_at" gorm:"bigint"`
	IP                 string         `json:"ip" gorm:"type:varchar(64)"`
	Notes              string         `json:"notes" gorm:"type:text"`
	DeletedAt          gorm.DeletedAt `json:"-" gorm:"index"`
}

type SubscriptionCodeUsageView struct {
	Id                   int    `json:"id"`
	SubscriptionCodeId   int    `json:"subscription_code_id"`
	Code                 string `json:"code"`
	SubscriptionCodeName string `json:"subscription_code_name"`
	PlanId               int    `json:"plan_id"`
	PlanTitle            string `json:"plan_title"`
	UserId               int    `json:"user_id"`
	Username             string `json:"username"`
	UserSubscriptionId   int    `json:"user_subscription_id"`
	UsedAt               int64  `json:"used_at"`
	IP                   string `json:"ip"`
	Notes                string `json:"notes"`
}

type SubscriptionCodeQuery struct {
	Keyword         string
	Status          int
	PlanId          int
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

func normalizeSubscriptionCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func (subscriptionCode *SubscriptionCode) BeforeCreate(tx *gorm.DB) error {
	subscriptionCode.Code = normalizeSubscriptionCode(subscriptionCode.Code)
	if subscriptionCode.Code == "" {
		subscriptionCode.Code = strings.ToUpper(common.GetUUID())
	}
	subscriptionCode.BatchNo = strings.TrimSpace(subscriptionCode.BatchNo)
	subscriptionCode.CampaignName = strings.TrimSpace(subscriptionCode.CampaignName)
	subscriptionCode.Channel = strings.TrimSpace(subscriptionCode.Channel)
	subscriptionCode.SourcePlatform = strings.TrimSpace(subscriptionCode.SourcePlatform)
	subscriptionCode.ExternalOrderNo = strings.TrimSpace(subscriptionCode.ExternalOrderNo)
	subscriptionCode.Notes = strings.TrimSpace(subscriptionCode.Notes)
	if subscriptionCode.Status == 0 {
		subscriptionCode.Status = common.SubscriptionCodeStatusEnabled
	}
	now := common.GetTimestamp()
	if subscriptionCode.CreatedAt == 0 {
		subscriptionCode.CreatedAt = now
	}
	subscriptionCode.UpdatedAt = now
	return nil
}

func (subscriptionCode *SubscriptionCode) BeforeUpdate(tx *gorm.DB) error {
	if subscriptionCode.Code != "" {
		subscriptionCode.Code = normalizeSubscriptionCode(subscriptionCode.Code)
	}
	subscriptionCode.BatchNo = strings.TrimSpace(subscriptionCode.BatchNo)
	subscriptionCode.CampaignName = strings.TrimSpace(subscriptionCode.CampaignName)
	subscriptionCode.Channel = strings.TrimSpace(subscriptionCode.Channel)
	subscriptionCode.SourcePlatform = strings.TrimSpace(subscriptionCode.SourcePlatform)
	subscriptionCode.ExternalOrderNo = strings.TrimSpace(subscriptionCode.ExternalOrderNo)
	subscriptionCode.Notes = strings.TrimSpace(subscriptionCode.Notes)
	subscriptionCode.UpdatedAt = common.GetTimestamp()
	return nil
}

func (subscriptionCode *SubscriptionCode) IsExpired() bool {
	return subscriptionCode.ExpiresAt != 0 && subscriptionCode.ExpiresAt < common.GetTimestamp()
}

func (subscriptionCode *SubscriptionCode) IsExhausted() bool {
	return subscriptionCode.MaxUses > 0 && subscriptionCode.UsedCount >= subscriptionCode.MaxUses
}

func applySubscriptionCodeFilters(query *gorm.DB, filters SubscriptionCodeQuery) (*gorm.DB, error) {
	now := common.GetTimestamp()
	if keyword := strings.TrimSpace(filters.Keyword); keyword != "" {
		if id, convErr := strconv.Atoi(keyword); convErr == nil {
			query = query.Where(
				"id = ? OR name LIKE ? OR code LIKE ?",
				id,
				"%"+keyword+"%",
				"%"+strings.ToUpper(keyword)+"%",
			)
		} else {
			query = query.Where(
				"name LIKE ? OR code LIKE ?",
				"%"+keyword+"%",
				"%"+strings.ToUpper(keyword)+"%",
			)
		}
	}
	if filters.Status != 0 {
		query = query.Where("status = ?", filters.Status)
	}
	if filters.PlanId > 0 {
		query = query.Where("plan_id = ?", filters.PlanId)
	}
	if filters.CreatedBy > 0 {
		query = query.Where("created_by = ?", filters.CreatedBy)
	}
	if batchNo := strings.TrimSpace(filters.BatchNo); batchNo != "" {
		query = query.Where("batch_no LIKE ?", "%"+batchNo+"%")
	}
	if campaignName := strings.TrimSpace(filters.CampaignName); campaignName != "" {
		query = query.Where("campaign_name LIKE ?", "%"+campaignName+"%")
	}
	if channel := strings.TrimSpace(filters.Channel); channel != "" {
		query = query.Where("channel LIKE ?", "%"+channel+"%")
	}
	if sourcePlatform := strings.TrimSpace(filters.SourcePlatform); sourcePlatform != "" {
		query = query.Where("source_platform LIKE ?", "%"+sourcePlatform+"%")
	}
	if externalOrderNo := strings.TrimSpace(filters.ExternalOrderNo); externalOrderNo != "" {
		query = query.Where("external_order_no LIKE ?", "%"+externalOrderNo+"%")
	}
	if filters.CreatedFrom > 0 {
		query = query.Where("created_at >= ?", filters.CreatedFrom)
	}
	if filters.CreatedTo > 0 {
		query = query.Where("created_at <= ?", filters.CreatedTo)
	}
	switch strings.ToLower(strings.TrimSpace(filters.Availability)) {
	case "":
		return query, nil
	case "available":
		query = query.Where("status = ?", common.SubscriptionCodeStatusEnabled).
			Where("(expires_at = 0 OR expires_at >= ?)", now).
			Where("(max_uses = 0 OR used_count < max_uses)")
	case "exhausted":
		query = query.Where("max_uses > 0 AND used_count >= max_uses")
	case "expired":
		query = query.Where("expires_at != 0 AND expires_at < ?", now)
	case "disabled":
		query = query.Where("status = ?", common.SubscriptionCodeStatusDisabled)
	default:
		return nil, errors.New("订阅码可用性筛选无效")
	}
	return query, nil
}

func GetAllSubscriptionCodes(startIdx int, num int, filters SubscriptionCodeQuery) (subscriptionCodes []*SubscriptionCode, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query, err := applySubscriptionCodeFilters(tx.Model(&SubscriptionCode{}), filters)
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&subscriptionCodes).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return subscriptionCodes, total, nil
}

func SearchSubscriptionCodes(keyword string, startIdx int, num int, filters SubscriptionCodeQuery) (subscriptionCodes []*SubscriptionCode, total int64, err error) {
	filters.Keyword = keyword
	return GetAllSubscriptionCodes(startIdx, num, filters)
}

func GetSubscriptionCodeBatchSummaries(filters SubscriptionCodeQuery, limit int) ([]*CodeBatchSummary, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	now := common.GetTimestamp()
	query, err := applySubscriptionCodeFilters(DB.Model(&SubscriptionCode{}), filters)
	if err != nil {
		return nil, err
	}
	summaries := make([]*CodeBatchSummary, 0)
	err = query.
		Where("batch_no != ''").
		Select(
			`batch_no,
			COUNT(*) AS total_count,
			SUM(CASE WHEN status = ? AND (expires_at = 0 OR expires_at >= ?) AND (max_uses = 0 OR used_count < max_uses) THEN 1 ELSE 0 END) AS available_count,
			SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS enabled_count,
			SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS disabled_count,
			SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS used_count,
			SUM(CASE WHEN max_uses > 0 AND used_count >= max_uses THEN 1 ELSE 0 END) AS exhausted_count,
			SUM(CASE WHEN expires_at != 0 AND expires_at < ? THEN 1 ELSE 0 END) AS expired_count,
			MAX(created_at) AS latest_created_at`,
			common.SubscriptionCodeStatusEnabled,
			now,
			common.SubscriptionCodeStatusEnabled,
			common.SubscriptionCodeStatusDisabled,
			common.SubscriptionCodeStatusUsed,
			now,
		).
		Group("batch_no").
		Order("latest_created_at desc").
		Limit(limit).
		Scan(&summaries).Error
	return summaries, err
}

func GetSubscriptionCodeById(id int) (*SubscriptionCode, error) {
	if id == 0 {
		return nil, errors.New("订阅码 id 为空")
	}
	subscriptionCode := SubscriptionCode{Id: id}
	err := DB.First(&subscriptionCode, "id = ?", id).Error
	return &subscriptionCode, err
}

func validateSubscriptionCodeQuery(tx *gorm.DB, rawCode string, forUpdate bool) (*SubscriptionCode, error) {
	code := normalizeSubscriptionCode(rawCode)
	if code == "" {
		return nil, errors.New("订阅码不能为空")
	}
	subscriptionCode := &SubscriptionCode{}
	query := tx
	if forUpdate {
		query = query.Set("gorm:query_option", "FOR UPDATE")
	}
	err := query.Where("code = ?", code).First(subscriptionCode).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("订阅码无效")
		}
		return nil, err
	}
	if subscriptionCode.Status != common.SubscriptionCodeStatusEnabled {
		return nil, errors.New("订阅码已禁用")
	}
	if subscriptionCode.IsExpired() {
		return nil, errors.New("订阅码已过期")
	}
	if subscriptionCode.IsExhausted() {
		return nil, errors.New("订阅码已使用完毕")
	}
	return subscriptionCode, nil
}

func ValidateSubscriptionCode(rawCode string) (*SubscriptionCode, error) {
	return validateSubscriptionCodeQuery(DB, rawCode, false)
}

func ValidateSubscriptionCodeTx(tx *gorm.DB, rawCode string) (*SubscriptionCode, error) {
	return validateSubscriptionCodeQuery(tx, rawCode, true)
}

func FindSubscriptionCodeByCode(rawCode string) (*SubscriptionCode, error) {
	code := normalizeSubscriptionCode(rawCode)
	if code == "" {
		return nil, errors.New("订阅码不能为空")
	}
	subscriptionCode := &SubscriptionCode{}
	err := DB.Where("code = ?", code).First(subscriptionCode).Error
	return subscriptionCode, err
}

func (subscriptionCode *SubscriptionCode) Insert() error {
	return DB.Create(subscriptionCode).Error
}

func (subscriptionCode *SubscriptionCode) Update() error {
	return DB.Model(subscriptionCode).Select("name", "plan_id", "status", "expires_at", "max_uses", "batch_no", "campaign_name", "channel", "source_platform", "external_order_no", "notes", "updated_at").Updates(subscriptionCode).Error
}

func (subscriptionCode *SubscriptionCode) Delete() error {
	return DB.Delete(subscriptionCode).Error
}

func DeleteSubscriptionCodeById(id int) error {
	if id == 0 {
		return errors.New("订阅码 id 为空")
	}
	subscriptionCode := SubscriptionCode{Id: id}
	if err := DB.Where("id = ?", id).First(&subscriptionCode).Error; err != nil {
		return err
	}
	return subscriptionCode.Delete()
}

func BatchDeleteSubscriptionCodes(ids []int) (int64, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 不能为空")
	}
	result := DB.Where("id IN ?", ids).Delete(&SubscriptionCode{})
	return result.RowsAffected, result.Error
}

func BatchUpdateSubscriptionCodeStatus(ids []int, status int) (int64, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 不能为空")
	}
	if status != common.SubscriptionCodeStatusEnabled && status != common.SubscriptionCodeStatusDisabled {
		return 0, errors.New("订阅码状态无效")
	}
	result := DB.Model(&SubscriptionCode{}).
		Where("id IN ?", ids).
		Where("status IN ?", []int{common.SubscriptionCodeStatusEnabled, common.SubscriptionCodeStatusDisabled}).
		Update("status", status)
	return result.RowsAffected, result.Error
}

func ValidateSubscriptionCodeAdminPayload(subscriptionCode *SubscriptionCode) error {
	if subscriptionCode == nil {
		return errors.New("订阅码参数不能为空")
	}
	subscriptionCode.Name = strings.TrimSpace(subscriptionCode.Name)
	if subscriptionCode.Name == "" {
		return errors.New("订阅码名称不能为空")
	}
	if len([]rune(subscriptionCode.Name)) > 64 {
		return errors.New("订阅码名称长度不能超过 64 个字符")
	}
	subscriptionCode.Code = normalizeSubscriptionCode(subscriptionCode.Code)
	if subscriptionCode.Code != "" && len([]rune(subscriptionCode.Code)) > 64 {
		return errors.New("订阅码长度不能超过 64 个字符")
	}
	if subscriptionCode.PlanId <= 0 {
		return errors.New("套餐 ID 不能为空")
	}
	if _, err := GetSubscriptionPlanById(subscriptionCode.PlanId); err != nil {
		return errors.New("套餐不存在")
	}
	if subscriptionCode.MaxUses < 0 {
		return errors.New("最大使用次数不能小于 0")
	}
	if subscriptionCode.ExpiresAt != 0 && subscriptionCode.ExpiresAt < common.GetTimestamp() {
		return errors.New("过期时间不能早于当前时间")
	}
	if subscriptionCode.Status == 0 {
		subscriptionCode.Status = common.SubscriptionCodeStatusEnabled
	}
	if subscriptionCode.Status != common.SubscriptionCodeStatusEnabled && subscriptionCode.Status != common.SubscriptionCodeStatusDisabled {
		return errors.New("订阅码状态无效")
	}
	subscriptionCode.BatchNo = strings.TrimSpace(subscriptionCode.BatchNo)
	subscriptionCode.CampaignName = strings.TrimSpace(subscriptionCode.CampaignName)
	subscriptionCode.Channel = strings.TrimSpace(subscriptionCode.Channel)
	subscriptionCode.SourcePlatform = strings.TrimSpace(subscriptionCode.SourcePlatform)
	subscriptionCode.ExternalOrderNo = strings.TrimSpace(subscriptionCode.ExternalOrderNo)
	subscriptionCode.Notes = strings.TrimSpace(subscriptionCode.Notes)
	return nil
}

func (subscriptionCode *SubscriptionCode) ConsumeForUserTx(tx *gorm.DB, userId int, ip string, notes string) (*UserSubscription, error) {
	if subscriptionCode == nil || subscriptionCode.Id == 0 {
		return nil, errors.New("订阅码不存在")
	}
	if userId == 0 {
		return nil, errors.New("用户 id 无效")
	}
	plan, err := getSubscriptionPlanByIdTx(tx, subscriptionCode.PlanId)
	if err != nil {
		return nil, err
	}
	subscriptionCode.UsedCount++
	if subscriptionCode.MaxUses > 0 && subscriptionCode.UsedCount >= subscriptionCode.MaxUses {
		subscriptionCode.Status = common.SubscriptionCodeStatusUsed
	}
	subscriptionCode.UpdatedAt = common.GetTimestamp()
	if err = tx.Model(subscriptionCode).Select("used_count", "status", "updated_at").Updates(subscriptionCode).Error; err != nil {
		return nil, err
	}
	subscription, err := CreateUserSubscriptionFromPlanTx(tx, userId, plan, "code")
	if err != nil {
		return nil, err
	}
	usage := SubscriptionCodeUsage{
		SubscriptionCodeId: subscriptionCode.Id,
		UserId:             userId,
		UserSubscriptionId: subscription.Id,
		PlanId:             plan.Id,
		UsedAt:             common.GetTimestamp(),
		IP:                 ip,
		Notes:              notes,
	}
	if err = tx.Create(&usage).Error; err != nil {
		return nil, err
	}
	return subscription, nil
}

func GetSubscriptionCodeUsages(startIdx int, num int, subscriptionCodeId int) (usages []*SubscriptionCodeUsageView, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	baseQuery := tx.Table("subscription_code_usages AS scu").
		Joins("LEFT JOIN subscription_codes sc ON sc.id = scu.subscription_code_id").
		Joins("LEFT JOIN users u ON u.id = scu.user_id").
		Joins("LEFT JOIN subscription_plans sp ON sp.id = scu.plan_id")
	if subscriptionCodeId > 0 {
		baseQuery = baseQuery.Where("scu.subscription_code_id = ?", subscriptionCodeId)
	}

	if err = baseQuery.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = baseQuery.Select("scu.id, scu.subscription_code_id, sc.code, sc.name AS subscription_code_name, scu.plan_id, sp.title AS plan_title, scu.user_id, u.username, scu.user_subscription_id, scu.used_at, scu.ip, scu.notes").
		Order("scu.id desc").
		Limit(num).
		Offset(startIdx).
		Scan(&usages).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return usages, total, nil
}

func BuildSubscriptionCodes(createBy int, template SubscriptionCode) ([]*SubscriptionCode, []string) {
	count := template.Count
	if count <= 0 {
		count = 1
	}
	createdCodes := make([]*SubscriptionCode, 0, count)
	codes := make([]string, 0, count)
	for i := 0; i < count; i++ {
		code := template.Code
		if count > 1 || strings.TrimSpace(code) == "" {
			code = strings.ToUpper(common.GetUUID())
		}
		subscriptionCode := &SubscriptionCode{
			Code:            code,
			Name:            template.Name,
			PlanId:          template.PlanId,
			Status:          template.Status,
			ExpiresAt:       template.ExpiresAt,
			MaxUses:         template.MaxUses,
			CreatedBy:       createBy,
			BatchNo:         template.BatchNo,
			CampaignName:    template.CampaignName,
			Channel:         template.Channel,
			SourcePlatform:  template.SourcePlatform,
			ExternalOrderNo: template.ExternalOrderNo,
			Notes:           template.Notes,
		}
		createdCodes = append(createdCodes, subscriptionCode)
		codes = append(codes, normalizeSubscriptionCode(code))
	}
	return createdCodes, codes
}
