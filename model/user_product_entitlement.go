package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type UserProductEntitlement struct {
	Id         int            `json:"id"`
	UserId     int            `json:"user_id" gorm:"uniqueIndex:idx_user_product;index"`
	ProductKey string         `json:"product_key" gorm:"type:varchar(64);uniqueIndex:idx_user_product;index"`
	Status     int            `json:"status" gorm:"default:1;index"`
	SourceType string         `json:"source_type" gorm:"type:varchar(64)"`
	SourceId   int            `json:"source_id"`
	GrantedAt  int64          `json:"granted_at" gorm:"bigint"`
	ExpiresAt  int64          `json:"expires_at" gorm:"bigint"`
	Notes      string         `json:"notes" gorm:"type:text"`
	UpdatedAt  int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
}

func (entitlement *UserProductEntitlement) IsActive() bool {
	if entitlement.Status != common.UserProductEntitlementStatusEnabled {
		return false
	}
	if entitlement.ExpiresAt != 0 && entitlement.ExpiresAt < common.GetTimestamp() {
		return false
	}
	return true
}

func GrantUserProductEntitlementTx(tx *gorm.DB, entitlement *UserProductEntitlement) error {
	if entitlement == nil {
		return errors.New("产品资格不能为空")
	}
	if entitlement.UserId == 0 {
		return errors.New("用户 id 不能为空")
	}
	if entitlement.ProductKey == "" {
		return errors.New("产品标识不能为空")
	}
	if entitlement.Status == 0 {
		entitlement.Status = common.UserProductEntitlementStatusEnabled
	}
	now := common.GetTimestamp()
	if entitlement.GrantedAt == 0 {
		entitlement.GrantedAt = now
	}
	entitlement.UpdatedAt = now

	var existing UserProductEntitlement
	err := tx.Where("user_id = ? AND product_key = ?", entitlement.UserId, entitlement.ProductKey).First(&existing).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return tx.Create(entitlement).Error
		}
		return err
	}

	existing.Status = entitlement.Status
	existing.SourceType = entitlement.SourceType
	existing.SourceId = entitlement.SourceId
	existing.GrantedAt = entitlement.GrantedAt
	existing.ExpiresAt = entitlement.ExpiresAt
	existing.Notes = entitlement.Notes
	existing.UpdatedAt = entitlement.UpdatedAt
	return tx.Model(&existing).Select("status", "source_type", "source_id", "granted_at", "expires_at", "notes", "updated_at").Updates(&existing).Error
}

func ValidateUserProductEntitlement(entitlement *UserProductEntitlement, isUpdate bool) error {
	if entitlement == nil {
		return errors.New("产品资格不能为空")
	}
	if entitlement.UserId == 0 {
		return errors.New("用户 id 不能为空")
	}
	entitlement.ProductKey = strings.TrimSpace(entitlement.ProductKey)
	if entitlement.ProductKey == "" {
		entitlement.ProductKey = common.ProductKeyNovel
	}
	if entitlement.Status == 0 {
		entitlement.Status = common.UserProductEntitlementStatusEnabled
	}
	if entitlement.Status != common.UserProductEntitlementStatusEnabled && entitlement.Status != common.UserProductEntitlementStatusDisabled {
		return errors.New("产品资格状态无效")
	}
	if entitlement.ExpiresAt != 0 && entitlement.ExpiresAt < common.GetTimestamp() {
		return errors.New("过期时间不能早于当前时间")
	}
	if !isUpdate {
		entitlement.SourceType = strings.TrimSpace(entitlement.SourceType)
		if entitlement.SourceType == "" {
			entitlement.SourceType = common.EntitlementSourceTypeAdminGrant
		}
	}
	return nil
}

func GetUserProductEntitlements(userId int) ([]*UserProductEntitlement, error) {
	if userId == 0 {
		return nil, errors.New("用户 id 不能为空")
	}
	var entitlements []*UserProductEntitlement
	err := DB.Where("user_id = ?", userId).Order("id desc").Find(&entitlements).Error
	return entitlements, err
}

func GetUserProductEntitlementByUserAndProduct(userId int, productKey string) (*UserProductEntitlement, error) {
	if userId == 0 {
		return nil, errors.New("用户 id 不能为空")
	}
	if strings.TrimSpace(productKey) == "" {
		return nil, errors.New("产品标识不能为空")
	}
	entitlement := &UserProductEntitlement{}
	err := DB.Where("user_id = ? AND product_key = ?", userId, strings.TrimSpace(productKey)).
		First(entitlement).Error
	return entitlement, err
}

func GetUserProductEntitlementById(userId int, id int) (*UserProductEntitlement, error) {
	if userId == 0 {
		return nil, errors.New("用户 id 不能为空")
	}
	if id == 0 {
		return nil, errors.New("产品资格 id 不能为空")
	}
	entitlement := &UserProductEntitlement{}
	err := DB.Where("id = ? AND user_id = ?", id, userId).First(entitlement).Error
	return entitlement, err
}

func (entitlement *UserProductEntitlement) UpdateAdminFields() error {
	if entitlement == nil || entitlement.Id == 0 {
		return errors.New("产品资格不存在")
	}
	entitlement.UpdatedAt = common.GetTimestamp()
	return DB.Model(entitlement).Select("status", "source_type", "expires_at", "notes", "updated_at").Updates(entitlement).Error
}

func HasActiveProductEntitlement(userId int, productKey string) (bool, error) {
	if userId == 0 {
		return false, errors.New("用户 id 不能为空")
	}
	if productKey == "" {
		return false, errors.New("产品标识不能为空")
	}
	var entitlements []*UserProductEntitlement
	err := DB.Where("user_id = ? AND product_key = ?", userId, productKey).Order("id desc").Find(&entitlements).Error
	if err != nil {
		return false, err
	}
	for _, entitlement := range entitlements {
		if entitlement.IsActive() {
			return true, nil
		}
	}
	return false, nil
}
