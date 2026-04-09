package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type RegistrationCode struct {
	Id              int            `json:"id"`
	Code            string         `json:"code" gorm:"type:varchar(64);uniqueIndex"`
	Name            string         `json:"name" gorm:"index"`
	Status          int            `json:"status" gorm:"default:1"`
	ProductKey      string         `json:"product_key" gorm:"type:varchar(64);index"`
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

type RegistrationCodeUsage struct {
	Id                 int            `json:"id"`
	RegistrationCodeId int            `json:"registration_code_id" gorm:"index"`
	UserId             int            `json:"user_id" gorm:"index"`
	UsedAt             int64          `json:"used_at" gorm:"bigint"`
	IP                 string         `json:"ip" gorm:"type:varchar(64)"`
	Notes              string         `json:"notes" gorm:"type:text"`
	DeletedAt          gorm.DeletedAt `json:"-" gorm:"index"`
}

type RegistrationCodeUsageView struct {
	Id                   int    `json:"id"`
	RegistrationCodeId   int    `json:"registration_code_id"`
	Code                 string `json:"code"`
	RegistrationCodeName string `json:"registration_code_name"`
	ProductKey           string `json:"product_key"`
	UserId               int    `json:"user_id"`
	Username             string `json:"username"`
	UsedAt               int64  `json:"used_at"`
	IP                   string `json:"ip"`
	Notes                string `json:"notes"`
}

type RegistrationCodeQuery struct {
	Keyword         string
	Status          int
	ProductKey      string
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

func normalizeRegistrationCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func (registrationCode *RegistrationCode) BeforeCreate(tx *gorm.DB) error {
	registrationCode.Code = normalizeRegistrationCode(registrationCode.Code)
	if registrationCode.Code == "" {
		registrationCode.Code = strings.ToUpper(common.GetUUID())
	}
	registrationCode.BatchNo = strings.TrimSpace(registrationCode.BatchNo)
	registrationCode.CampaignName = strings.TrimSpace(registrationCode.CampaignName)
	registrationCode.Channel = strings.TrimSpace(registrationCode.Channel)
	registrationCode.SourcePlatform = strings.TrimSpace(registrationCode.SourcePlatform)
	registrationCode.ExternalOrderNo = strings.TrimSpace(registrationCode.ExternalOrderNo)
	registrationCode.Notes = strings.TrimSpace(registrationCode.Notes)
	if registrationCode.ProductKey == "" {
		registrationCode.ProductKey = common.ProductKeyNovel
	}
	if registrationCode.Status == 0 {
		registrationCode.Status = common.RegistrationCodeStatusEnabled
	}
	now := common.GetTimestamp()
	if registrationCode.CreatedAt == 0 {
		registrationCode.CreatedAt = now
	}
	registrationCode.UpdatedAt = now
	return nil
}

func (registrationCode *RegistrationCode) BeforeUpdate(tx *gorm.DB) error {
	if registrationCode.Code != "" {
		registrationCode.Code = normalizeRegistrationCode(registrationCode.Code)
	}
	registrationCode.BatchNo = strings.TrimSpace(registrationCode.BatchNo)
	registrationCode.CampaignName = strings.TrimSpace(registrationCode.CampaignName)
	registrationCode.Channel = strings.TrimSpace(registrationCode.Channel)
	registrationCode.SourcePlatform = strings.TrimSpace(registrationCode.SourcePlatform)
	registrationCode.ExternalOrderNo = strings.TrimSpace(registrationCode.ExternalOrderNo)
	registrationCode.Notes = strings.TrimSpace(registrationCode.Notes)
	if registrationCode.ProductKey == "" {
		registrationCode.ProductKey = common.ProductKeyNovel
	}
	registrationCode.UpdatedAt = common.GetTimestamp()
	return nil
}

func (registrationCode *RegistrationCode) IsExpired() bool {
	return registrationCode.ExpiresAt != 0 && registrationCode.ExpiresAt < common.GetTimestamp()
}

func (registrationCode *RegistrationCode) IsExhausted() bool {
	return registrationCode.MaxUses > 0 && registrationCode.UsedCount >= registrationCode.MaxUses
}

func applyRegistrationCodeFilters(query *gorm.DB, filters RegistrationCodeQuery) (*gorm.DB, error) {
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
	if filters.CreatedBy > 0 {
		query = query.Where("created_by = ?", filters.CreatedBy)
	}
	if productKey := strings.TrimSpace(filters.ProductKey); productKey != "" {
		query = query.Where("product_key = ?", productKey)
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
		query = query.Where("status = ?", common.RegistrationCodeStatusEnabled).
			Where("(expires_at = 0 OR expires_at >= ?)", now).
			Where("(max_uses = 0 OR used_count < max_uses)")
	case "exhausted":
		query = query.Where("max_uses > 0 AND used_count >= max_uses")
	case "expired":
		query = query.Where("expires_at != 0 AND expires_at < ?", now)
	case "disabled":
		query = query.Where("status = ?", common.RegistrationCodeStatusDisabled)
	default:
		return nil, errors.New("注册码可用性筛选无效")
	}
	return query, nil
}

func GetAllRegistrationCodes(startIdx int, num int, filters RegistrationCodeQuery) (registrationCodes []*RegistrationCode, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query, err := applyRegistrationCodeFilters(tx.Model(&RegistrationCode{}), filters)
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&registrationCodes).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return registrationCodes, total, nil
}

func SearchRegistrationCodes(keyword string, startIdx int, num int, filters RegistrationCodeQuery) (registrationCodes []*RegistrationCode, total int64, err error) {
	filters.Keyword = keyword
	return GetAllRegistrationCodes(startIdx, num, filters)
}

func GetRegistrationCodeBatchSummaries(filters RegistrationCodeQuery, limit int) ([]*CodeBatchSummary, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	now := common.GetTimestamp()
	query, err := applyRegistrationCodeFilters(DB.Model(&RegistrationCode{}), filters)
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
			SUM(CASE WHEN max_uses > 0 AND used_count >= max_uses THEN 1 ELSE 0 END) AS exhausted_count,
			SUM(CASE WHEN expires_at != 0 AND expires_at < ? THEN 1 ELSE 0 END) AS expired_count,
			MAX(created_at) AS latest_created_at`,
			common.RegistrationCodeStatusEnabled,
			now,
			common.RegistrationCodeStatusEnabled,
			common.RegistrationCodeStatusDisabled,
			now,
		).
		Group("batch_no").
		Order("latest_created_at desc").
		Limit(limit).
		Scan(&summaries).Error
	return summaries, err
}

func GetRegistrationCodeById(id int) (*RegistrationCode, error) {
	if id == 0 {
		return nil, errors.New("注册码 id 为空")
	}
	registrationCode := RegistrationCode{Id: id}
	err := DB.First(&registrationCode, "id = ?", id).Error
	return &registrationCode, err
}

func validateRegistrationCodeQuery(tx *gorm.DB, rawCode string, forUpdate bool) (*RegistrationCode, error) {
	code := normalizeRegistrationCode(rawCode)
	if code == "" {
		return nil, errors.New("注册码不能为空")
	}
	registrationCode := &RegistrationCode{}
	query := tx
	if forUpdate {
		query = query.Set("gorm:query_option", "FOR UPDATE")
	}
	err := query.Where("code = ?", code).First(registrationCode).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("注册码无效")
		}
		return nil, err
	}
	if registrationCode.Status != common.RegistrationCodeStatusEnabled {
		return nil, errors.New("注册码已禁用")
	}
	if registrationCode.IsExpired() {
		return nil, errors.New("注册码已过期")
	}
	if registrationCode.IsExhausted() {
		return nil, errors.New("注册码已使用完毕")
	}
	return registrationCode, nil
}

func (registrationCode *RegistrationCode) Insert() error {
	return DB.Create(registrationCode).Error
}

func (registrationCode *RegistrationCode) Update() error {
	return DB.Model(registrationCode).Select("name", "status", "product_key", "expires_at", "max_uses", "batch_no", "campaign_name", "channel", "source_platform", "external_order_no", "notes", "updated_at").Updates(registrationCode).Error
}

func (registrationCode *RegistrationCode) Delete() error {
	return DB.Delete(registrationCode).Error
}

func DeleteRegistrationCodeById(id int) error {
	if id == 0 {
		return errors.New("注册码 id 为空")
	}
	registrationCode := RegistrationCode{Id: id}
	if err := DB.Where("id = ?", id).First(&registrationCode).Error; err != nil {
		return err
	}
	return registrationCode.Delete()
}

func BatchDeleteRegistrationCodes(ids []int) (int64, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 不能为空")
	}
	result := DB.Where("id IN ?", ids).Delete(&RegistrationCode{})
	return result.RowsAffected, result.Error
}

func BatchUpdateRegistrationCodeStatus(ids []int, status int) (int64, error) {
	if len(ids) == 0 {
		return 0, errors.New("ids 不能为空")
	}
	if status != common.RegistrationCodeStatusEnabled && status != common.RegistrationCodeStatusDisabled {
		return 0, errors.New("注册码状态无效")
	}
	result := DB.Model(&RegistrationCode{}).
		Where("id IN ?", ids).
		Update("status", status)
	return result.RowsAffected, result.Error
}

func ValidateRegistrationCode(rawCode string) (*RegistrationCode, error) {
	return validateRegistrationCodeQuery(DB, rawCode, false)
}

func ValidateRegistrationCodeTx(tx *gorm.DB, rawCode string) (*RegistrationCode, error) {
	return validateRegistrationCodeQuery(tx, rawCode, true)
}

func (registrationCode *RegistrationCode) ConsumeForUserTx(tx *gorm.DB, userId int, ip string, notes string) error {
	if registrationCode == nil || registrationCode.Id == 0 {
		return errors.New("注册码不存在")
	}
	if userId == 0 {
		return errors.New("用户 id 无效")
	}
	registrationCode.UsedCount++
	registrationCode.UpdatedAt = common.GetTimestamp()
	if err := tx.Model(registrationCode).Select("used_count", "updated_at").Updates(registrationCode).Error; err != nil {
		return err
	}
	usage := RegistrationCodeUsage{
		RegistrationCodeId: registrationCode.Id,
		UserId:             userId,
		UsedAt:             common.GetTimestamp(),
		IP:                 ip,
		Notes:              notes,
	}
	return tx.Create(&usage).Error
}

func GetRegistrationCodeUsages(startIdx int, num int, registrationCodeId int) (usages []*RegistrationCodeUsageView, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	baseQuery := tx.Table("registration_code_usages AS rcu").
		Joins("LEFT JOIN registration_codes rc ON rc.id = rcu.registration_code_id").
		Joins("LEFT JOIN users u ON u.id = rcu.user_id")
	if registrationCodeId > 0 {
		baseQuery = baseQuery.Where("rcu.registration_code_id = ?", registrationCodeId)
	}

	err = baseQuery.Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	err = baseQuery.Select("rcu.id, rcu.registration_code_id, rc.code, rc.name AS registration_code_name, rc.product_key, rcu.user_id, u.username, rcu.used_at, rcu.ip, rcu.notes").
		Order("rcu.id desc").
		Limit(num).
		Offset(startIdx).
		Scan(&usages).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return usages, total, nil
}

func BuildRegistrationCodes(createBy int, template RegistrationCode) ([]*RegistrationCode, []string) {
	count := template.Count
	if count <= 0 {
		count = 1
	}
	createdCodes := make([]*RegistrationCode, 0, count)
	codes := make([]string, 0, count)
	for i := 0; i < count; i++ {
		code := template.Code
		if count > 1 || strings.TrimSpace(code) == "" {
			code = strings.ToUpper(common.GetUUID())
		}
		registrationCode := &RegistrationCode{
			Code:            code,
			Name:            template.Name,
			Status:          template.Status,
			ProductKey:      template.ProductKey,
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
		createdCodes = append(createdCodes, registrationCode)
		codes = append(codes, normalizeRegistrationCode(code))
	}
	return createdCodes, codes
}

func ValidateRegistrationCodeAdminPayload(registrationCode *RegistrationCode) error {
	if registrationCode == nil {
		return errors.New("注册码参数不能为空")
	}
	if strings.TrimSpace(registrationCode.Name) == "" {
		return errors.New("注册码名称不能为空")
	}
	if registrationCode.MaxUses < 0 {
		return errors.New("最大使用次数不能小于 0")
	}
	if registrationCode.ExpiresAt != 0 && registrationCode.ExpiresAt < common.GetTimestamp() {
		return errors.New("过期时间不能早于当前时间")
	}
	if registrationCode.ProductKey == "" {
		registrationCode.ProductKey = common.ProductKeyNovel
	}
	registrationCode.BatchNo = strings.TrimSpace(registrationCode.BatchNo)
	registrationCode.CampaignName = strings.TrimSpace(registrationCode.CampaignName)
	registrationCode.Channel = strings.TrimSpace(registrationCode.Channel)
	registrationCode.SourcePlatform = strings.TrimSpace(registrationCode.SourcePlatform)
	registrationCode.ExternalOrderNo = strings.TrimSpace(registrationCode.ExternalOrderNo)
	registrationCode.Notes = strings.TrimSpace(registrationCode.Notes)
	if registrationCode.Status == 0 {
		registrationCode.Status = common.RegistrationCodeStatusEnabled
	}
	if registrationCode.Count < 0 {
		return errors.New("批量创建数量不能小于 0")
	}
	if registrationCode.Count > 100 {
		return errors.New("批量创建数量不能超过 100")
	}
	return nil
}

func (registrationCode *RegistrationCode) ValidateUpdateConstraints() error {
	if registrationCode.MaxUses > 0 && registrationCode.MaxUses < registrationCode.UsedCount {
		return fmt.Errorf("最大使用次数不能小于已使用次数（%d）", registrationCode.UsedCount)
	}
	if registrationCode.ExpiresAt != 0 && registrationCode.ExpiresAt < common.GetTimestamp() {
		return errors.New("过期时间不能早于当前时间")
	}
	return nil
}
