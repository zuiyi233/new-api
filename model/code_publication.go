package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	CodeDeliveryOperationPublish       = "publish"
	CodeDeliveryOperationMarkPending   = "mark_pending_delivery"
	CodeDeliveryOperationMarkDelivered = "mark_delivered"
	CodeDeliveryOperationMarkClaimed   = "mark_claimed"
	CodeDeliveryOperationMarkUsed      = "mark_used"
	CodeDeliveryOperationMarkRevoked   = "mark_revoked"
	CodeDeliveryOperationReissue       = "reissue"
	CodeDeliveryOperationRollback      = "rollback"
)

type CodePublication struct {
	Id                    int            `json:"id"`
	OrderClaimId          int            `json:"order_claim_id" gorm:"index"`
	CodeType              string         `json:"code_type" gorm:"type:varchar(32);index"`
	CodeId                int            `json:"code_id" gorm:"index"`
	CodeValue             string         `json:"code_value" gorm:"type:varchar(128)"`
	PublicationStatus     string         `json:"publication_status" gorm:"type:varchar(32);index"`
	TargetUserId          int            `json:"target_user_id" gorm:"index"`
	TargetContact         string         `json:"target_contact" gorm:"type:varchar(128);index"`
	SourcePlatform        string         `json:"source_platform" gorm:"type:varchar(64);index"`
	ExternalOrderNo       string         `json:"external_order_no" gorm:"type:varchar(128);index"`
	ClaimedProduct        string         `json:"claimed_product" gorm:"type:varchar(128);index"`
	GrantPlanId           int            `json:"grant_plan_id" gorm:"index"`
	GrantProductKey       string         `json:"grant_product_key" gorm:"type:varchar(64);index"`
	GrantQuota            int            `json:"grant_quota"`
	GrantedSubscriptionId int            `json:"granted_subscription_id" gorm:"index"`
	PublicationChannel    string         `json:"publication_channel" gorm:"type:varchar(64);index"`
	PublishedBy           int            `json:"published_by" gorm:"index"`
	PublishedAt           int64          `json:"published_at" gorm:"bigint;index"`
	LastDeliveryStatus    string         `json:"last_delivery_status" gorm:"type:varchar(32);index"`
	LastDeliveryAt        int64          `json:"last_delivery_at" gorm:"bigint"`
	Notes                 string         `json:"notes" gorm:"type:text"`
	CreatedAt             int64          `json:"created_at" gorm:"bigint;index"`
	UpdatedAt             int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt             gorm.DeletedAt `json:"-" gorm:"index"`
}

type CodeDelivery struct {
	Id               int            `json:"id"`
	PublicationId    int            `json:"publication_id" gorm:"index"`
	OrderClaimId     int            `json:"order_claim_id" gorm:"index"`
	CodeType         string         `json:"code_type" gorm:"type:varchar(32);index"`
	CodeId           int            `json:"code_id" gorm:"index"`
	CodeValue        string         `json:"code_value" gorm:"type:varchar(128)"`
	AttemptNo        int            `json:"attempt_no" gorm:"index"`
	ParentDeliveryId int            `json:"parent_delivery_id" gorm:"index"`
	OperationType    string         `json:"operation_type" gorm:"type:varchar(32);index"`
	DeliveryStatus   string         `json:"delivery_status" gorm:"type:varchar(32);index"`
	DeliveryChannel  string         `json:"delivery_channel" gorm:"type:varchar(64);index"`
	TargetUserId     int            `json:"target_user_id" gorm:"index"`
	TargetContact    string         `json:"target_contact" gorm:"type:varchar(128);index"`
	SourcePlatform   string         `json:"source_platform" gorm:"type:varchar(64);index"`
	ExternalOrderNo  string         `json:"external_order_no" gorm:"type:varchar(128);index"`
	ClaimedProduct   string         `json:"claimed_product" gorm:"type:varchar(128);index"`
	DeliveredBy      int            `json:"delivered_by" gorm:"index"`
	DeliveredAt      int64          `json:"delivered_at" gorm:"bigint;index"`
	ClaimedByUserId  int            `json:"claimed_by_user_id" gorm:"index"`
	ClaimedAt        int64          `json:"claimed_at" gorm:"bigint"`
	UsedAt           int64          `json:"used_at" gorm:"bigint"`
	RevokedAt        int64          `json:"revoked_at" gorm:"bigint"`
	RevokeReason     string         `json:"revoke_reason" gorm:"type:text"`
	Notes            string         `json:"notes" gorm:"type:text"`
	CreatedAt        int64          `json:"created_at" gorm:"bigint;index"`
	UpdatedAt        int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt        gorm.DeletedAt `json:"-" gorm:"index"`
}

type CodeDeliveryOperationLog struct {
	Id              int            `json:"id"`
	PublicationId   int            `json:"publication_id" gorm:"index"`
	DeliveryId      int            `json:"delivery_id" gorm:"index"`
	OperationType   string         `json:"operation_type" gorm:"type:varchar(32);index"`
	FromStatus      string         `json:"from_status" gorm:"type:varchar(32);index"`
	ToStatus        string         `json:"to_status" gorm:"type:varchar(32);index"`
	OperatorId      int            `json:"operator_id" gorm:"index"`
	DeliveryChannel string         `json:"delivery_channel" gorm:"type:varchar(64);index"`
	RevokeReason    string         `json:"revoke_reason" gorm:"type:text"`
	Notes           string         `json:"notes" gorm:"type:text"`
	MetaJSON        string         `json:"meta_json" gorm:"type:text"`
	CreatedAt       int64          `json:"created_at" gorm:"bigint;index"`
	DeletedAt       gorm.DeletedAt `json:"-" gorm:"index"`
}

type CodeDeliveryOperationLogView struct {
	Id              int    `json:"id"`
	PublicationId   int    `json:"publication_id"`
	DeliveryId      int    `json:"delivery_id"`
	OperationType   string `json:"operation_type"`
	FromStatus      string `json:"from_status"`
	ToStatus        string `json:"to_status"`
	OperatorId      int    `json:"operator_id"`
	OperatorName    string `json:"operator_name"`
	DeliveryChannel string `json:"delivery_channel"`
	RevokeReason    string `json:"revoke_reason"`
	Notes           string `json:"notes"`
	MetaJSON        string `json:"meta_json"`
	CreatedAt       int64  `json:"created_at"`
}

type CodePublicationQuery struct {
	Keyword            string
	PublicationStatus  string
	CodeType           string
	CodeId             int
	OrderClaimId       int
	TargetUserId       int
	SourcePlatform     string
	ExternalOrderNo    string
	ClaimedProduct     string
	PublicationChannel string
	PublishedBy        int
	PublishedFrom      int64
	PublishedTo        int64
}

type CodeDeliveryQuery struct {
	Keyword         string
	DeliveryStatus  string
	CodeType        string
	PublicationId   int
	OrderClaimId    int
	TargetUserId    int
	SourcePlatform  string
	ExternalOrderNo string
	ClaimedProduct  string
	DeliveryChannel string
	DeliveredBy     int
	AttemptNo       int
	CreatedFrom     int64
	CreatedTo       int64
}

type CodePublicationCreateInput struct {
	OrderClaimId          int
	CodeType              string
	CodeId                int
	CodeValue             string
	TargetUserId          int
	TargetContact         string
	SourcePlatform        string
	ExternalOrderNo       string
	ClaimedProduct        string
	GrantPlanId           int
	GrantProductKey       string
	GrantQuota            int
	GrantedSubscriptionId int
	PublicationChannel    string
	PublishedBy           int
	PublishedAt           int64
	Notes                 string
}

type CodeDeliveryUpdateInput struct {
	DeliveryStatus  string `json:"delivery_status"`
	DeliveryChannel string `json:"delivery_channel"`
	RevokeReason    string `json:"revoke_reason"`
	Notes           string `json:"notes"`
}

type CodePublicationActionInput struct {
	DeliveryChannel string `json:"delivery_channel"`
	RevokeReason    string `json:"revoke_reason"`
	Notes           string `json:"notes"`
}

type CodeObjectSummary struct {
	CodeType              string `json:"code_type"`
	ObjectId              int    `json:"object_id"`
	CodeValue             string `json:"code_value"`
	Name                  string `json:"name"`
	Status                string `json:"status"`
	StatusText            string `json:"status_text"`
	ProductKey            string `json:"product_key"`
	PlanId                int    `json:"plan_id"`
	PlanTitle             string `json:"plan_title"`
	Quota                 int    `json:"quota"`
	MaxUses               int    `json:"max_uses"`
	UsedCount             int    `json:"used_count"`
	ExpiresAt             int64  `json:"expires_at"`
	CreatedBy             int    `json:"created_by"`
	BatchNo               string `json:"batch_no"`
	CampaignName          string `json:"campaign_name"`
	Channel               string `json:"channel"`
	SourcePlatform        string `json:"source_platform"`
	ExternalOrderNo       string `json:"external_order_no"`
	Notes                 string `json:"notes"`
	GrantedSubscriptionId int    `json:"granted_subscription_id"`
	SubscriptionStatus    string `json:"subscription_status"`
	SubscriptionStartTime int64  `json:"subscription_start_time"`
	SubscriptionEndTime   int64  `json:"subscription_end_time"`
}

type CodePublicationDetail struct {
	Publication   *CodePublication                `json:"publication"`
	OrderClaim    *OrderClaim                     `json:"order_claim,omitempty"`
	CodeObject    *CodeObjectSummary              `json:"code_object,omitempty"`
	Deliveries    []*CodeDelivery                 `json:"deliveries"`
	OperationLogs []*CodeDeliveryOperationLogView `json:"operation_logs"`
}

type CodeDeliveryDetail struct {
	Delivery      *CodeDelivery                   `json:"delivery"`
	Publication   *CodePublication                `json:"publication,omitempty"`
	OrderClaim    *OrderClaim                     `json:"order_claim,omitempty"`
	CodeObject    *CodeObjectSummary              `json:"code_object,omitempty"`
	Deliveries    []*CodeDelivery                 `json:"deliveries"`
	OperationLogs []*CodeDeliveryOperationLogView `json:"operation_logs"`
}

func (publication *CodePublication) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	if publication.CreatedAt == 0 {
		publication.CreatedAt = now
	}
	publication.UpdatedAt = now
	if publication.PublishedAt == 0 {
		publication.PublishedAt = now
	}
	publication.CodeType = strings.TrimSpace(publication.CodeType)
	publication.CodeValue = strings.TrimSpace(publication.CodeValue)
	publication.PublicationStatus = strings.TrimSpace(publication.PublicationStatus)
	publication.TargetContact = strings.TrimSpace(publication.TargetContact)
	publication.SourcePlatform = strings.TrimSpace(publication.SourcePlatform)
	publication.ExternalOrderNo = strings.TrimSpace(publication.ExternalOrderNo)
	publication.ClaimedProduct = strings.TrimSpace(publication.ClaimedProduct)
	publication.GrantProductKey = strings.TrimSpace(publication.GrantProductKey)
	publication.PublicationChannel = strings.TrimSpace(publication.PublicationChannel)
	publication.LastDeliveryStatus = strings.TrimSpace(publication.LastDeliveryStatus)
	publication.Notes = strings.TrimSpace(publication.Notes)
	return nil
}

func (publication *CodePublication) BeforeUpdate(tx *gorm.DB) error {
	publication.UpdatedAt = common.GetTimestamp()
	publication.CodeType = strings.TrimSpace(publication.CodeType)
	publication.CodeValue = strings.TrimSpace(publication.CodeValue)
	publication.PublicationStatus = strings.TrimSpace(publication.PublicationStatus)
	publication.TargetContact = strings.TrimSpace(publication.TargetContact)
	publication.SourcePlatform = strings.TrimSpace(publication.SourcePlatform)
	publication.ExternalOrderNo = strings.TrimSpace(publication.ExternalOrderNo)
	publication.ClaimedProduct = strings.TrimSpace(publication.ClaimedProduct)
	publication.GrantProductKey = strings.TrimSpace(publication.GrantProductKey)
	publication.PublicationChannel = strings.TrimSpace(publication.PublicationChannel)
	publication.LastDeliveryStatus = strings.TrimSpace(publication.LastDeliveryStatus)
	publication.Notes = strings.TrimSpace(publication.Notes)
	return nil
}

func (delivery *CodeDelivery) BeforeCreate(tx *gorm.DB) error {
	now := common.GetTimestamp()
	if delivery.CreatedAt == 0 {
		delivery.CreatedAt = now
	}
	delivery.UpdatedAt = now
	delivery.CodeType = strings.TrimSpace(delivery.CodeType)
	delivery.CodeValue = strings.TrimSpace(delivery.CodeValue)
	delivery.OperationType = strings.TrimSpace(delivery.OperationType)
	delivery.DeliveryStatus = strings.TrimSpace(delivery.DeliveryStatus)
	delivery.DeliveryChannel = strings.TrimSpace(delivery.DeliveryChannel)
	delivery.TargetContact = strings.TrimSpace(delivery.TargetContact)
	delivery.SourcePlatform = strings.TrimSpace(delivery.SourcePlatform)
	delivery.ExternalOrderNo = strings.TrimSpace(delivery.ExternalOrderNo)
	delivery.ClaimedProduct = strings.TrimSpace(delivery.ClaimedProduct)
	delivery.RevokeReason = strings.TrimSpace(delivery.RevokeReason)
	delivery.Notes = strings.TrimSpace(delivery.Notes)
	return nil
}

func (delivery *CodeDelivery) BeforeUpdate(tx *gorm.DB) error {
	delivery.UpdatedAt = common.GetTimestamp()
	delivery.CodeType = strings.TrimSpace(delivery.CodeType)
	delivery.CodeValue = strings.TrimSpace(delivery.CodeValue)
	delivery.OperationType = strings.TrimSpace(delivery.OperationType)
	delivery.DeliveryStatus = strings.TrimSpace(delivery.DeliveryStatus)
	delivery.DeliveryChannel = strings.TrimSpace(delivery.DeliveryChannel)
	delivery.TargetContact = strings.TrimSpace(delivery.TargetContact)
	delivery.SourcePlatform = strings.TrimSpace(delivery.SourcePlatform)
	delivery.ExternalOrderNo = strings.TrimSpace(delivery.ExternalOrderNo)
	delivery.ClaimedProduct = strings.TrimSpace(delivery.ClaimedProduct)
	delivery.RevokeReason = strings.TrimSpace(delivery.RevokeReason)
	delivery.Notes = strings.TrimSpace(delivery.Notes)
	return nil
}

func (log *CodeDeliveryOperationLog) BeforeCreate(tx *gorm.DB) error {
	if log.CreatedAt == 0 {
		log.CreatedAt = common.GetTimestamp()
	}
	log.OperationType = strings.TrimSpace(log.OperationType)
	log.FromStatus = strings.TrimSpace(log.FromStatus)
	log.ToStatus = strings.TrimSpace(log.ToStatus)
	log.DeliveryChannel = strings.TrimSpace(log.DeliveryChannel)
	log.RevokeReason = strings.TrimSpace(log.RevokeReason)
	log.Notes = strings.TrimSpace(log.Notes)
	log.MetaJSON = strings.TrimSpace(log.MetaJSON)
	return nil
}

func isValidCodePublicationStatus(status string) bool {
	switch status {
	case common.CodePublicationStatusPendingDelivery,
		common.CodePublicationStatusPublished,
		common.CodePublicationStatusDelivered,
		common.CodePublicationStatusClaimed,
		common.CodePublicationStatusUsed,
		common.CodePublicationStatusRevoked:
		return true
	default:
		return false
	}
}

func publicationStatusFromDeliveryStatus(status string) string {
	switch status {
	case common.CodePublicationStatusPendingDelivery:
		return common.CodePublicationStatusPublished
	case common.CodePublicationStatusDelivered,
		common.CodePublicationStatusClaimed,
		common.CodePublicationStatusUsed,
		common.CodePublicationStatusRevoked:
		return status
	default:
		return common.CodePublicationStatusPublished
	}
}

func deliveryOperationTypeFromStatus(status string) string {
	switch status {
	case common.CodePublicationStatusPendingDelivery:
		return CodeDeliveryOperationMarkPending
	case common.CodePublicationStatusDelivered:
		return CodeDeliveryOperationMarkDelivered
	case common.CodePublicationStatusClaimed:
		return CodeDeliveryOperationMarkClaimed
	case common.CodePublicationStatusUsed:
		return CodeDeliveryOperationMarkUsed
	case common.CodePublicationStatusRevoked:
		return CodeDeliveryOperationMarkRevoked
	default:
		return CodeDeliveryOperationPublish
	}
}

func applyCodePublicationFilters(query *gorm.DB, filters CodePublicationQuery) *gorm.DB {
	if keyword := strings.TrimSpace(filters.Keyword); keyword != "" {
		if id, convErr := strconv.Atoi(keyword); convErr == nil {
			query = query.Where(
				"id = ? OR order_claim_id = ? OR code_id = ? OR code_value LIKE ? OR target_contact LIKE ? OR external_order_no LIKE ? OR claimed_product LIKE ?",
				id,
				id,
				id,
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
			)
		} else {
			query = query.Where(
				"code_value LIKE ? OR target_contact LIKE ? OR external_order_no LIKE ? OR claimed_product LIKE ?",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
			)
		}
	}
	if value := strings.TrimSpace(filters.PublicationStatus); value != "" {
		query = query.Where("publication_status = ?", value)
	}
	if value := strings.TrimSpace(filters.CodeType); value != "" {
		query = query.Where("code_type = ?", value)
	}
	if filters.CodeId > 0 {
		query = query.Where("code_id = ?", filters.CodeId)
	}
	if filters.OrderClaimId > 0 {
		query = query.Where("order_claim_id = ?", filters.OrderClaimId)
	}
	if filters.TargetUserId > 0 {
		query = query.Where("target_user_id = ?", filters.TargetUserId)
	}
	if value := strings.TrimSpace(filters.SourcePlatform); value != "" {
		query = query.Where("source_platform LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.ExternalOrderNo); value != "" {
		query = query.Where("external_order_no LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.ClaimedProduct); value != "" {
		query = query.Where("claimed_product LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.PublicationChannel); value != "" {
		query = query.Where("publication_channel LIKE ?", "%"+value+"%")
	}
	if filters.PublishedBy > 0 {
		query = query.Where("published_by = ?", filters.PublishedBy)
	}
	if filters.PublishedFrom > 0 {
		query = query.Where("published_at >= ?", filters.PublishedFrom)
	}
	if filters.PublishedTo > 0 {
		query = query.Where("published_at <= ?", filters.PublishedTo)
	}
	return query
}

func applyCodeDeliveryFilters(query *gorm.DB, filters CodeDeliveryQuery) *gorm.DB {
	if keyword := strings.TrimSpace(filters.Keyword); keyword != "" {
		if id, convErr := strconv.Atoi(keyword); convErr == nil {
			query = query.Where(
				"id = ? OR publication_id = ? OR order_claim_id = ? OR code_id = ? OR code_value LIKE ? OR target_contact LIKE ? OR external_order_no LIKE ? OR claimed_product LIKE ?",
				id,
				id,
				id,
				id,
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
			)
		} else {
			query = query.Where(
				"code_value LIKE ? OR target_contact LIKE ? OR external_order_no LIKE ? OR claimed_product LIKE ?",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
			)
		}
	}
	if value := strings.TrimSpace(filters.DeliveryStatus); value != "" {
		query = query.Where("delivery_status = ?", value)
	}
	if value := strings.TrimSpace(filters.CodeType); value != "" {
		query = query.Where("code_type = ?", value)
	}
	if filters.PublicationId > 0 {
		query = query.Where("publication_id = ?", filters.PublicationId)
	}
	if filters.OrderClaimId > 0 {
		query = query.Where("order_claim_id = ?", filters.OrderClaimId)
	}
	if filters.TargetUserId > 0 {
		query = query.Where("target_user_id = ?", filters.TargetUserId)
	}
	if value := strings.TrimSpace(filters.SourcePlatform); value != "" {
		query = query.Where("source_platform LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.ExternalOrderNo); value != "" {
		query = query.Where("external_order_no LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.ClaimedProduct); value != "" {
		query = query.Where("claimed_product LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.DeliveryChannel); value != "" {
		query = query.Where("delivery_channel LIKE ?", "%"+value+"%")
	}
	if filters.DeliveredBy > 0 {
		query = query.Where("delivered_by = ?", filters.DeliveredBy)
	}
	if filters.AttemptNo > 0 {
		query = query.Where("attempt_no = ?", filters.AttemptNo)
	}
	if filters.CreatedFrom > 0 {
		query = query.Where("created_at >= ?", filters.CreatedFrom)
	}
	if filters.CreatedTo > 0 {
		query = query.Where("created_at <= ?", filters.CreatedTo)
	}
	return query
}

func GetAllCodePublications(startIdx int, num int, filters CodePublicationQuery) ([]*CodePublication, int64, error) {
	query := applyCodePublicationFilters(DB.Model(&CodePublication{}), filters)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	publications := make([]*CodePublication, 0)
	if err := query.Order("id desc").Limit(num).Offset(startIdx).Find(&publications).Error; err != nil {
		return nil, 0, err
	}
	return publications, total, nil
}

func GetCodePublicationById(id int) (*CodePublication, error) {
	if id <= 0 {
		return nil, errors.New("发放记录 id 无效")
	}
	publication := &CodePublication{}
	if err := DB.First(publication, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return publication, nil
}

func GetAllCodeDeliveries(startIdx int, num int, filters CodeDeliveryQuery) ([]*CodeDelivery, int64, error) {
	query := applyCodeDeliveryFilters(DB.Model(&CodeDelivery{}), filters)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	deliveries := make([]*CodeDelivery, 0)
	if err := query.Order("attempt_no desc, id desc").Limit(num).Offset(startIdx).Find(&deliveries).Error; err != nil {
		return nil, 0, err
	}
	return deliveries, total, nil
}

func GetCodeDeliveryById(id int) (*CodeDelivery, error) {
	if id <= 0 {
		return nil, errors.New("送达记录 id 无效")
	}
	delivery := &CodeDelivery{}
	if err := DB.First(delivery, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return delivery, nil
}

func GetCodeDeliveriesByPublicationId(publicationId int, limit int) ([]*CodeDelivery, error) {
	if publicationId <= 0 {
		return []*CodeDelivery{}, nil
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	deliveries := make([]*CodeDelivery, 0)
	err := DB.Where("publication_id = ?", publicationId).
		Order("attempt_no desc, id desc").
		Limit(limit).
		Find(&deliveries).Error
	return deliveries, err
}

func GetCodeDeliveryOperationLogsByRelation(publicationId int, deliveryId int, limit int) ([]*CodeDeliveryOperationLogView, error) {
	if publicationId <= 0 && deliveryId <= 0 {
		return []*CodeDeliveryOperationLogView{}, nil
	}
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	logs := make([]*CodeDeliveryOperationLogView, 0)
	query := DB.Table("code_delivery_operation_logs AS cdol").
		Joins("LEFT JOIN users u ON u.id = cdol.operator_id")
	if publicationId > 0 {
		query = query.Where("cdol.publication_id = ?", publicationId)
	}
	if deliveryId > 0 {
		query = query.Where("cdol.delivery_id = ?", deliveryId)
	}
	err := query.Select("cdol.id, cdol.publication_id, cdol.delivery_id, cdol.operation_type, cdol.from_status, cdol.to_status, cdol.operator_id, u.username AS operator_name, cdol.delivery_channel, cdol.revoke_reason, cdol.notes, cdol.meta_json, cdol.created_at").
		Order("cdol.id desc").
		Limit(limit).
		Scan(&logs).Error
	return logs, err
}

func ValidateCodePublicationCreateInput(input *CodePublicationCreateInput) error {
	if input == nil {
		return errors.New("发放参数不能为空")
	}
	input.CodeType = strings.TrimSpace(input.CodeType)
	input.CodeValue = strings.TrimSpace(input.CodeValue)
	input.TargetContact = strings.TrimSpace(input.TargetContact)
	input.SourcePlatform = strings.TrimSpace(input.SourcePlatform)
	input.ExternalOrderNo = strings.TrimSpace(input.ExternalOrderNo)
	input.ClaimedProduct = strings.TrimSpace(input.ClaimedProduct)
	input.GrantProductKey = strings.TrimSpace(input.GrantProductKey)
	input.PublicationChannel = strings.TrimSpace(input.PublicationChannel)
	input.Notes = strings.TrimSpace(input.Notes)
	if input.CodeType == "" {
		return errors.New("发放类型不能为空")
	}
	switch input.CodeType {
	case common.OrderClaimGrantTypeSubscription,
		common.OrderClaimGrantTypeSubscriptionCode,
		common.OrderClaimGrantTypeRegistrationCode,
		common.OrderClaimGrantTypeRedemption:
	default:
		return errors.New("发放类型无效")
	}
	if input.TargetUserId <= 0 {
		return errors.New("目标用户不能为空")
	}
	if input.PublishedBy <= 0 {
		return errors.New("发放人不能为空")
	}
	if input.PublicationChannel == "" {
		input.PublicationChannel = common.CodePublicationChannelOrderClaim
	}
	if len([]rune(input.CodeValue)) > 128 {
		return errors.New("发放码长度不能超过 128 个字符")
	}
	if len([]rune(input.TargetContact)) > 128 {
		return errors.New("目标联系方式长度不能超过 128 个字符")
	}
	if len([]rune(input.SourcePlatform)) > 64 {
		return errors.New("来源平台长度不能超过 64 个字符")
	}
	if len([]rune(input.ExternalOrderNo)) > 128 {
		return errors.New("外部订单号长度不能超过 128 个字符")
	}
	if len([]rune(input.ClaimedProduct)) > 128 {
		return errors.New("申领产品长度不能超过 128 个字符")
	}
	if len([]rune(input.GrantProductKey)) > 64 {
		return errors.New("产品 Key 长度不能超过 64 个字符")
	}
	if len([]rune(input.PublicationChannel)) > 64 {
		return errors.New("发放渠道长度不能超过 64 个字符")
	}
	if len([]rune(input.Notes)) > 1000 {
		return errors.New("发放备注长度不能超过 1000 个字符")
	}
	return nil
}

func ValidateCodeDeliveryUpdateInput(input *CodeDeliveryUpdateInput) error {
	if input == nil {
		return errors.New("送达更新参数不能为空")
	}
	input.DeliveryStatus = strings.TrimSpace(input.DeliveryStatus)
	input.DeliveryChannel = strings.TrimSpace(input.DeliveryChannel)
	input.RevokeReason = strings.TrimSpace(input.RevokeReason)
	input.Notes = strings.TrimSpace(input.Notes)
	if !isValidCodePublicationStatus(input.DeliveryStatus) || input.DeliveryStatus == common.CodePublicationStatusPublished {
		return errors.New("送达状态无效")
	}
	if len([]rune(input.DeliveryChannel)) > 64 {
		return errors.New("送达渠道长度不能超过 64 个字符")
	}
	if len([]rune(input.RevokeReason)) > 1000 {
		return errors.New("撤回原因长度不能超过 1000 个字符")
	}
	if len([]rune(input.Notes)) > 1000 {
		return errors.New("送达备注长度不能超过 1000 个字符")
	}
	if input.DeliveryStatus == common.CodePublicationStatusRevoked && input.RevokeReason == "" {
		return errors.New("撤回状态必须填写撤回原因")
	}
	return nil
}

func ValidateCodePublicationActionInput(input *CodePublicationActionInput) error {
	if input == nil {
		return errors.New("操作参数不能为空")
	}
	input.DeliveryChannel = strings.TrimSpace(input.DeliveryChannel)
	input.RevokeReason = strings.TrimSpace(input.RevokeReason)
	input.Notes = strings.TrimSpace(input.Notes)
	if len([]rune(input.DeliveryChannel)) > 64 {
		return errors.New("送达渠道长度不能超过 64 个字符")
	}
	if len([]rune(input.RevokeReason)) > 1000 {
		return errors.New("撤回原因长度不能超过 1000 个字符")
	}
	if len([]rune(input.Notes)) > 1000 {
		return errors.New("备注长度不能超过 1000 个字符")
	}
	return nil
}

func nextCodeDeliveryAttemptNoTx(tx *gorm.DB, publicationId int) (int, error) {
	var count int64
	if err := tx.Model(&CodeDelivery{}).Where("publication_id = ?", publicationId).Count(&count).Error; err != nil {
		return 0, err
	}
	return int(count) + 1, nil
}

func getLatestCodeDeliveryByPublicationIdTx(tx *gorm.DB, publicationId int) (*CodeDelivery, error) {
	if publicationId <= 0 {
		return nil, errors.New("发放记录 id 无效")
	}
	delivery := &CodeDelivery{}
	if err := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("publication_id = ?", publicationId).
		Order("attempt_no desc, id desc").
		First(delivery).Error; err != nil {
		return nil, err
	}
	return delivery, nil
}

func createCodeDeliveryOperationLogTx(tx *gorm.DB, log *CodeDeliveryOperationLog) error {
	if tx == nil {
		tx = DB
	}
	if log == nil {
		return nil
	}
	return tx.Create(log).Error
}

func applyDeliveryTimestampsByStatus(delivery *CodeDelivery, operatorId int, status string, now int64) {
	if delivery == nil {
		return
	}
	delivery.DeliveryStatus = status
	switch status {
	case common.CodePublicationStatusPendingDelivery:
		delivery.DeliveredBy = 0
		delivery.DeliveredAt = 0
		delivery.ClaimedAt = 0
		delivery.ClaimedByUserId = 0
		delivery.UsedAt = 0
		delivery.RevokedAt = 0
	case common.CodePublicationStatusDelivered:
		delivery.DeliveredBy = operatorId
		delivery.DeliveredAt = now
		delivery.ClaimedAt = 0
		delivery.ClaimedByUserId = 0
		delivery.UsedAt = 0
		delivery.RevokedAt = 0
	case common.CodePublicationStatusClaimed:
		delivery.DeliveredBy = operatorId
		delivery.DeliveredAt = now
		delivery.ClaimedAt = now
		if delivery.ClaimedByUserId == 0 {
			delivery.ClaimedByUserId = delivery.TargetUserId
		}
		delivery.UsedAt = 0
		delivery.RevokedAt = 0
	case common.CodePublicationStatusUsed:
		delivery.DeliveredBy = operatorId
		delivery.DeliveredAt = now
		delivery.ClaimedAt = now
		if delivery.ClaimedByUserId == 0 {
			delivery.ClaimedByUserId = delivery.TargetUserId
		}
		delivery.UsedAt = now
		delivery.RevokedAt = 0
	case common.CodePublicationStatusRevoked:
		delivery.RevokedAt = now
		if delivery.DeliveredAt == 0 {
			delivery.DeliveredAt = now
		}
		if delivery.DeliveredBy == 0 {
			delivery.DeliveredBy = operatorId
		}
	}
}

func buildDeliveryAttemptFromPrevious(previous *CodeDelivery, publication *CodePublication, attemptNo int, operatorId int, status string, operationType string, deliveryChannel string, revokeReason string, notes string, now int64) *CodeDelivery {
	next := &CodeDelivery{
		PublicationId:    publication.Id,
		OrderClaimId:     publication.OrderClaimId,
		CodeType:         publication.CodeType,
		CodeId:           publication.CodeId,
		CodeValue:        publication.CodeValue,
		AttemptNo:        attemptNo,
		ParentDeliveryId: 0,
		OperationType:    operationType,
		DeliveryStatus:   status,
		DeliveryChannel:  strings.TrimSpace(deliveryChannel),
		TargetUserId:     publication.TargetUserId,
		TargetContact:    publication.TargetContact,
		SourcePlatform:   publication.SourcePlatform,
		ExternalOrderNo:  publication.ExternalOrderNo,
		ClaimedProduct:   publication.ClaimedProduct,
		RevokeReason:     strings.TrimSpace(revokeReason),
		Notes:            strings.TrimSpace(notes),
		CreatedAt:        now,
	}
	if previous != nil {
		next.ParentDeliveryId = previous.Id
		if next.DeliveryChannel == "" {
			next.DeliveryChannel = previous.DeliveryChannel
		}
		if next.RevokeReason == "" {
			next.RevokeReason = previous.RevokeReason
		}
		next.ClaimedByUserId = previous.ClaimedByUserId
	}
	if next.DeliveryChannel == "" {
		next.DeliveryChannel = publication.PublicationChannel
	}
	if status != common.CodePublicationStatusRevoked {
		next.RevokeReason = ""
	}
	applyDeliveryTimestampsByStatus(next, operatorId, status, now)
	return next
}

func buildCodeObjectSummary(codeType string, codeId int) (*CodeObjectSummary, error) {
	if codeId <= 0 && codeType != common.OrderClaimGrantTypeSubscription {
		return nil, nil
	}
	switch codeType {
	case common.OrderClaimGrantTypeSubscription:
		if codeId <= 0 {
			return nil, nil
		}
		subscription := &UserSubscription{}
		if err := DB.Where("id = ?", codeId).First(subscription).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, nil
			}
			return nil, err
		}
		summary := &CodeObjectSummary{
			CodeType:              codeType,
			ObjectId:              subscription.Id,
			GrantedSubscriptionId: subscription.Id,
			Status:                subscription.Status,
			StatusText:            subscription.Status,
			PlanId:                subscription.PlanId,
			SubscriptionStatus:    subscription.Status,
			SubscriptionStartTime: subscription.StartTime,
			SubscriptionEndTime:   subscription.EndTime,
		}
		plan, err := GetSubscriptionPlanById(subscription.PlanId)
		if err == nil && plan != nil {
			summary.Name = plan.Title
			summary.PlanTitle = plan.Title
		}
		return summary, nil
	case common.OrderClaimGrantTypeSubscriptionCode:
		subscriptionCode, err := GetSubscriptionCodeById(codeId)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, nil
			}
			return nil, err
		}
		summary := &CodeObjectSummary{
			CodeType:        codeType,
			ObjectId:        subscriptionCode.Id,
			CodeValue:       subscriptionCode.Code,
			Name:            subscriptionCode.Name,
			Status:          strconv.Itoa(subscriptionCode.Status),
			StatusText:      strconv.Itoa(subscriptionCode.Status),
			PlanId:          subscriptionCode.PlanId,
			MaxUses:         subscriptionCode.MaxUses,
			UsedCount:       subscriptionCode.UsedCount,
			ExpiresAt:       subscriptionCode.ExpiresAt,
			CreatedBy:       subscriptionCode.CreatedBy,
			BatchNo:         subscriptionCode.BatchNo,
			CampaignName:    subscriptionCode.CampaignName,
			Channel:         subscriptionCode.Channel,
			SourcePlatform:  subscriptionCode.SourcePlatform,
			ExternalOrderNo: subscriptionCode.ExternalOrderNo,
			Notes:           subscriptionCode.Notes,
		}
		plan, err := GetSubscriptionPlanById(subscriptionCode.PlanId)
		if err == nil && plan != nil {
			summary.PlanTitle = plan.Title
		}
		return summary, nil
	case common.OrderClaimGrantTypeRegistrationCode:
		registrationCode, err := GetRegistrationCodeById(codeId)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, nil
			}
			return nil, err
		}
		return &CodeObjectSummary{
			CodeType:        codeType,
			ObjectId:        registrationCode.Id,
			CodeValue:       registrationCode.Code,
			Name:            registrationCode.Name,
			Status:          strconv.Itoa(registrationCode.Status),
			StatusText:      strconv.Itoa(registrationCode.Status),
			ProductKey:      registrationCode.ProductKey,
			MaxUses:         registrationCode.MaxUses,
			UsedCount:       registrationCode.UsedCount,
			ExpiresAt:       registrationCode.ExpiresAt,
			CreatedBy:       registrationCode.CreatedBy,
			BatchNo:         registrationCode.BatchNo,
			CampaignName:    registrationCode.CampaignName,
			Channel:         registrationCode.Channel,
			SourcePlatform:  registrationCode.SourcePlatform,
			ExternalOrderNo: registrationCode.ExternalOrderNo,
			Notes:           registrationCode.Notes,
		}, nil
	case common.OrderClaimGrantTypeRedemption:
		redemption, err := GetRedemptionById(codeId)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, nil
			}
			return nil, err
		}
		return &CodeObjectSummary{
			CodeType:        codeType,
			ObjectId:        redemption.Id,
			CodeValue:       redemption.Key,
			Name:            redemption.Name,
			Status:          strconv.Itoa(redemption.Status),
			StatusText:      strconv.Itoa(redemption.Status),
			Quota:           redemption.Quota,
			CreatedBy:       redemption.UserId,
			BatchNo:         redemption.BatchNo,
			CampaignName:    redemption.CampaignName,
			Channel:         redemption.Channel,
			SourcePlatform:  redemption.SourcePlatform,
			ExternalOrderNo: redemption.ExternalOrderNo,
			Notes:           redemption.Notes,
			ExpiresAt:       redemption.ExpiredTime,
		}, nil
	default:
		return nil, nil
	}
}

func getOptionalOrderClaimById(id int) (*OrderClaim, error) {
	if id <= 0 {
		return nil, nil
	}
	claim := &OrderClaim{}
	err := DB.Where("id = ?", id).First(claim).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return claim, nil
}

func CreateCodePublicationWithInitialDeliveryTx(tx *gorm.DB, input *CodePublicationCreateInput) (*CodePublication, *CodeDelivery, error) {
	if tx == nil {
		tx = DB
	}
	if err := ValidateCodePublicationCreateInput(input); err != nil {
		return nil, nil, err
	}
	now := input.PublishedAt
	if now == 0 {
		now = common.GetTimestamp()
	}

	publicationStatus := common.CodePublicationStatusPublished
	deliveryStatus := common.CodePublicationStatusPendingDelivery
	if input.CodeType == common.OrderClaimGrantTypeSubscription {
		publicationStatus = common.CodePublicationStatusClaimed
		deliveryStatus = common.CodePublicationStatusClaimed
	}

	publication := &CodePublication{
		OrderClaimId:          input.OrderClaimId,
		CodeType:              input.CodeType,
		CodeId:                input.CodeId,
		CodeValue:             input.CodeValue,
		PublicationStatus:     publicationStatus,
		TargetUserId:          input.TargetUserId,
		TargetContact:         input.TargetContact,
		SourcePlatform:        input.SourcePlatform,
		ExternalOrderNo:       input.ExternalOrderNo,
		ClaimedProduct:        input.ClaimedProduct,
		GrantPlanId:           input.GrantPlanId,
		GrantProductKey:       input.GrantProductKey,
		GrantQuota:            input.GrantQuota,
		GrantedSubscriptionId: input.GrantedSubscriptionId,
		PublicationChannel:    input.PublicationChannel,
		PublishedBy:           input.PublishedBy,
		PublishedAt:           now,
		LastDeliveryStatus:    deliveryStatus,
		LastDeliveryAt:        now,
		Notes:                 input.Notes,
	}
	if err := tx.Create(publication).Error; err != nil {
		return nil, nil, err
	}

	delivery := buildDeliveryAttemptFromPrevious(nil, publication, 1, input.PublishedBy, deliveryStatus, CodeDeliveryOperationPublish, input.PublicationChannel, "", input.Notes, now)
	if err := tx.Create(delivery).Error; err != nil {
		return nil, nil, err
	}
	if err := createCodeDeliveryOperationLogTx(tx, &CodeDeliveryOperationLog{
		PublicationId:   publication.Id,
		DeliveryId:      delivery.Id,
		OperationType:   CodeDeliveryOperationPublish,
		FromStatus:      "",
		ToStatus:        deliveryStatus,
		OperatorId:      input.PublishedBy,
		DeliveryChannel: delivery.DeliveryChannel,
		Notes:           input.Notes,
		CreatedAt:       now,
	}); err != nil {
		return nil, nil, err
	}
	return publication, delivery, nil
}

func UpdateCodeDeliveryStatus(id int, operatorId int, input *CodeDeliveryUpdateInput) (*CodeDelivery, error) {
	if id <= 0 {
		return nil, errors.New("送达记录 id 无效")
	}
	if operatorId <= 0 {
		return nil, errors.New("操作人无效")
	}
	if err := ValidateCodeDeliveryUpdateInput(input); err != nil {
		return nil, err
	}

	var updated *CodeDelivery
	err := DB.Transaction(func(tx *gorm.DB) error {
		target := &CodeDelivery{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", id).First(target).Error; err != nil {
			return err
		}
		publication := &CodePublication{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", target.PublicationId).First(publication).Error; err != nil {
			return err
		}
		latest, err := getLatestCodeDeliveryByPublicationIdTx(tx, publication.Id)
		if err != nil {
			return err
		}

		now := common.GetTimestamp()
		attemptNo, err := nextCodeDeliveryAttemptNoTx(tx, publication.Id)
		if err != nil {
			return err
		}
		delivery := buildDeliveryAttemptFromPrevious(
			latest,
			publication,
			attemptNo,
			operatorId,
			input.DeliveryStatus,
			deliveryOperationTypeFromStatus(input.DeliveryStatus),
			input.DeliveryChannel,
			input.RevokeReason,
			input.Notes,
			now,
		)
		if err := tx.Create(delivery).Error; err != nil {
			return err
		}
		publication.PublicationStatus = publicationStatusFromDeliveryStatus(delivery.DeliveryStatus)
		publication.LastDeliveryStatus = delivery.DeliveryStatus
		publication.LastDeliveryAt = now
		if err := tx.Model(publication).Select(
			"publication_status",
			"last_delivery_status",
			"last_delivery_at",
			"updated_at",
		).Updates(publication).Error; err != nil {
			return err
		}
		if err := createCodeDeliveryOperationLogTx(tx, &CodeDeliveryOperationLog{
			PublicationId:   publication.Id,
			DeliveryId:      delivery.Id,
			OperationType:   delivery.OperationType,
			FromStatus:      latest.DeliveryStatus,
			ToStatus:        delivery.DeliveryStatus,
			OperatorId:      operatorId,
			DeliveryChannel: delivery.DeliveryChannel,
			RevokeReason:    delivery.RevokeReason,
			Notes:           delivery.Notes,
			CreatedAt:       now,
		}); err != nil {
			return err
		}
		updated = delivery
		return nil
	})
	if err != nil {
		return nil, err
	}

	RecordLog(operatorId, LogTypeManage, fmt.Sprintf(
		"更新发放送达状态，送达记录ID: %d，新状态: %s",
		id,
		input.DeliveryStatus,
	))
	return updated, nil
}

func ReissueCodePublication(id int, operatorId int, input *CodePublicationActionInput) (*CodeDelivery, error) {
	if id <= 0 {
		return nil, errors.New("发放记录 id 无效")
	}
	if operatorId <= 0 {
		return nil, errors.New("操作人无效")
	}
	if err := ValidateCodePublicationActionInput(input); err != nil {
		return nil, err
	}
	var created *CodeDelivery
	err := DB.Transaction(func(tx *gorm.DB) error {
		publication := &CodePublication{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", id).First(publication).Error; err != nil {
			return err
		}
		latest, err := getLatestCodeDeliveryByPublicationIdTx(tx, publication.Id)
		if err != nil {
			return err
		}
		now := common.GetTimestamp()
		attemptNo, err := nextCodeDeliveryAttemptNoTx(tx, publication.Id)
		if err != nil {
			return err
		}
		delivery := buildDeliveryAttemptFromPrevious(
			latest,
			publication,
			attemptNo,
			operatorId,
			common.CodePublicationStatusPendingDelivery,
			CodeDeliveryOperationReissue,
			input.DeliveryChannel,
			"",
			input.Notes,
			now,
		)
		if err := tx.Create(delivery).Error; err != nil {
			return err
		}
		publication.PublicationStatus = common.CodePublicationStatusPublished
		publication.LastDeliveryStatus = delivery.DeliveryStatus
		publication.LastDeliveryAt = now
		if err := tx.Model(publication).Select(
			"publication_status",
			"last_delivery_status",
			"last_delivery_at",
			"updated_at",
		).Updates(publication).Error; err != nil {
			return err
		}
		if err := createCodeDeliveryOperationLogTx(tx, &CodeDeliveryOperationLog{
			PublicationId:   publication.Id,
			DeliveryId:      delivery.Id,
			OperationType:   CodeDeliveryOperationReissue,
			FromStatus:      latest.DeliveryStatus,
			ToStatus:        delivery.DeliveryStatus,
			OperatorId:      operatorId,
			DeliveryChannel: delivery.DeliveryChannel,
			Notes:           delivery.Notes,
			CreatedAt:       now,
		}); err != nil {
			return err
		}
		created = delivery
		return nil
	})
	if err != nil {
		return nil, err
	}
	RecordLog(operatorId, LogTypeManage, fmt.Sprintf("补发发放记录，发放ID: %d", id))
	return created, nil
}

func RevokeCodePublication(id int, operatorId int, input *CodePublicationActionInput) (*CodeDelivery, error) {
	if id <= 0 {
		return nil, errors.New("发放记录 id 无效")
	}
	if operatorId <= 0 {
		return nil, errors.New("操作人无效")
	}
	if err := ValidateCodePublicationActionInput(input); err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.RevokeReason) == "" {
		return nil, errors.New("撤回必须填写原因")
	}
	var created *CodeDelivery
	err := DB.Transaction(func(tx *gorm.DB) error {
		publication := &CodePublication{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", id).First(publication).Error; err != nil {
			return err
		}
		latest, err := getLatestCodeDeliveryByPublicationIdTx(tx, publication.Id)
		if err != nil {
			return err
		}
		now := common.GetTimestamp()
		attemptNo, err := nextCodeDeliveryAttemptNoTx(tx, publication.Id)
		if err != nil {
			return err
		}
		delivery := buildDeliveryAttemptFromPrevious(
			latest,
			publication,
			attemptNo,
			operatorId,
			common.CodePublicationStatusRevoked,
			CodeDeliveryOperationMarkRevoked,
			input.DeliveryChannel,
			input.RevokeReason,
			input.Notes,
			now,
		)
		if err := tx.Create(delivery).Error; err != nil {
			return err
		}
		publication.PublicationStatus = common.CodePublicationStatusRevoked
		publication.LastDeliveryStatus = delivery.DeliveryStatus
		publication.LastDeliveryAt = now
		if err := tx.Model(publication).Select(
			"publication_status",
			"last_delivery_status",
			"last_delivery_at",
			"updated_at",
		).Updates(publication).Error; err != nil {
			return err
		}
		if err := createCodeDeliveryOperationLogTx(tx, &CodeDeliveryOperationLog{
			PublicationId:   publication.Id,
			DeliveryId:      delivery.Id,
			OperationType:   CodeDeliveryOperationMarkRevoked,
			FromStatus:      latest.DeliveryStatus,
			ToStatus:        delivery.DeliveryStatus,
			OperatorId:      operatorId,
			DeliveryChannel: delivery.DeliveryChannel,
			RevokeReason:    delivery.RevokeReason,
			Notes:           delivery.Notes,
			CreatedAt:       now,
		}); err != nil {
			return err
		}
		created = delivery
		return nil
	})
	if err != nil {
		return nil, err
	}
	RecordLog(operatorId, LogTypeManage, fmt.Sprintf("撤回发放记录，发放ID: %d", id))
	return created, nil
}

func RollbackCodePublication(id int, operatorId int, input *CodePublicationActionInput) (*CodeDelivery, error) {
	if id <= 0 {
		return nil, errors.New("发放记录 id 无效")
	}
	if operatorId <= 0 {
		return nil, errors.New("操作人无效")
	}
	if err := ValidateCodePublicationActionInput(input); err != nil {
		return nil, err
	}
	var created *CodeDelivery
	err := DB.Transaction(func(tx *gorm.DB) error {
		publication := &CodePublication{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", id).First(publication).Error; err != nil {
			return err
		}
		latest, err := getLatestCodeDeliveryByPublicationIdTx(tx, publication.Id)
		if err != nil {
			return err
		}
		previous := &CodeDelivery{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("publication_id = ? AND id <> ?", publication.Id, latest.Id).
			Order("attempt_no desc, id desc").
			First(previous).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return errors.New("没有可回滚的上一条送达状态")
			}
			return err
		}
		now := common.GetTimestamp()
		attemptNo, err := nextCodeDeliveryAttemptNoTx(tx, publication.Id)
		if err != nil {
			return err
		}
		delivery := buildDeliveryAttemptFromPrevious(
			latest,
			publication,
			attemptNo,
			operatorId,
			previous.DeliveryStatus,
			CodeDeliveryOperationRollback,
			input.DeliveryChannel,
			previous.RevokeReason,
			input.Notes,
			now,
		)
		if strings.TrimSpace(input.DeliveryChannel) == "" {
			delivery.DeliveryChannel = strings.TrimSpace(previous.DeliveryChannel)
			if delivery.DeliveryChannel == "" {
				delivery.DeliveryChannel = publication.PublicationChannel
			}
		}
		if delivery.DeliveryStatus == common.CodePublicationStatusRevoked {
			delivery.RevokeReason = strings.TrimSpace(previous.RevokeReason)
			if delivery.RevokeReason == "" {
				delivery.RevokeReason = strings.TrimSpace(input.RevokeReason)
			}
		} else {
			delivery.RevokeReason = ""
		}
		if err := tx.Create(delivery).Error; err != nil {
			return err
		}
		publication.PublicationStatus = publicationStatusFromDeliveryStatus(delivery.DeliveryStatus)
		publication.LastDeliveryStatus = delivery.DeliveryStatus
		publication.LastDeliveryAt = now
		if err := tx.Model(publication).Select(
			"publication_status",
			"last_delivery_status",
			"last_delivery_at",
			"updated_at",
		).Updates(publication).Error; err != nil {
			return err
		}
		metaJSON := ""
		metaMap := map[string]any{
			"rollback_from_delivery_id":   latest.Id,
			"rollback_target_delivery_id": previous.Id,
		}
		if data, err := common.Marshal(metaMap); err == nil {
			metaJSON = string(data)
		}
		if err := createCodeDeliveryOperationLogTx(tx, &CodeDeliveryOperationLog{
			PublicationId:   publication.Id,
			DeliveryId:      delivery.Id,
			OperationType:   CodeDeliveryOperationRollback,
			FromStatus:      latest.DeliveryStatus,
			ToStatus:        delivery.DeliveryStatus,
			OperatorId:      operatorId,
			DeliveryChannel: delivery.DeliveryChannel,
			RevokeReason:    delivery.RevokeReason,
			Notes:           delivery.Notes,
			MetaJSON:        metaJSON,
			CreatedAt:       now,
		}); err != nil {
			return err
		}
		created = delivery
		return nil
	})
	if err != nil {
		return nil, err
	}
	RecordLog(operatorId, LogTypeManage, fmt.Sprintf("回滚发放记录，发放ID: %d", id))
	return created, nil
}

func GetCodePublicationDetail(id int) (*CodePublicationDetail, error) {
	publication, err := GetCodePublicationById(id)
	if err != nil {
		return nil, err
	}
	orderClaim, err := getOptionalOrderClaimById(publication.OrderClaimId)
	if err != nil {
		return nil, err
	}
	codeObject, err := buildCodeObjectSummary(publication.CodeType, publication.CodeId)
	if err != nil {
		return nil, err
	}
	deliveries, err := GetCodeDeliveriesByPublicationId(publication.Id, 100)
	if err != nil {
		return nil, err
	}
	logs, err := GetCodeDeliveryOperationLogsByRelation(publication.Id, 0, 200)
	if err != nil {
		return nil, err
	}
	return &CodePublicationDetail{
		Publication:   publication,
		OrderClaim:    orderClaim,
		CodeObject:    codeObject,
		Deliveries:    deliveries,
		OperationLogs: logs,
	}, nil
}

func GetCodeDeliveryDetail(id int) (*CodeDeliveryDetail, error) {
	delivery, err := GetCodeDeliveryById(id)
	if err != nil {
		return nil, err
	}
	publication, err := GetCodePublicationById(delivery.PublicationId)
	if err != nil {
		return nil, err
	}
	orderClaim, err := getOptionalOrderClaimById(publication.OrderClaimId)
	if err != nil {
		return nil, err
	}
	codeObject, err := buildCodeObjectSummary(publication.CodeType, publication.CodeId)
	if err != nil {
		return nil, err
	}
	deliveries, err := GetCodeDeliveriesByPublicationId(publication.Id, 100)
	if err != nil {
		return nil, err
	}
	logs, err := GetCodeDeliveryOperationLogsByRelation(publication.Id, 0, 200)
	if err != nil {
		return nil, err
	}
	return &CodeDeliveryDetail{
		Delivery:      delivery,
		Publication:   publication,
		OrderClaim:    orderClaim,
		CodeObject:    codeObject,
		Deliveries:    deliveries,
		OperationLogs: logs,
	}, nil
}
