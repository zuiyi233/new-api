package model

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type OrderClaim struct {
	Id                        int            `json:"id"`
	UserId                    int            `json:"user_id" gorm:"index"`
	SourcePlatform            string         `json:"source_platform" gorm:"type:varchar(64);index"`
	ExternalOrderNo           string         `json:"external_order_no" gorm:"type:varchar(128);index"`
	BuyerContact              string         `json:"buyer_contact" gorm:"type:varchar(128);index"`
	ClaimedProduct            string         `json:"claimed_product" gorm:"type:varchar(128);index"`
	ClaimNote                 string         `json:"claim_note" gorm:"type:text"`
	ClaimStatus               string         `json:"claim_status" gorm:"type:varchar(32);index"`
	ProofImagesJSON           string         `json:"-" gorm:"column:proof_images;type:text"`
	ProofImages               []string       `json:"proof_images" gorm:"-:all"`
	ReviewerId                int            `json:"reviewer_id" gorm:"index"`
	ReviewNote                string         `json:"review_note" gorm:"type:text"`
	ReviewedAt                int64          `json:"reviewed_at" gorm:"bigint"`
	GrantType                 string         `json:"grant_type" gorm:"type:varchar(32);index"`
	GrantedCode               string         `json:"granted_code" gorm:"type:varchar(128)"`
	GrantedPlanId             int            `json:"granted_plan_id" gorm:"index"`
	GrantedProductKey         string         `json:"granted_product_key" gorm:"type:varchar(64);index"`
	GrantedQuota              int            `json:"granted_quota"`
	GrantedRedemptionId       int            `json:"granted_redemption_id" gorm:"index"`
	GrantedRegistrationCodeId int            `json:"granted_registration_code_id" gorm:"index"`
	GrantedSubscriptionCodeId int            `json:"granted_subscription_code_id" gorm:"index"`
	GrantedSubscriptionId     int            `json:"granted_subscription_id" gorm:"index"`
	CreatedAt                 int64          `json:"created_at" gorm:"bigint;index"`
	UpdatedAt                 int64          `json:"updated_at" gorm:"bigint"`
	DeletedAt                 gorm.DeletedAt `json:"-" gorm:"index"`
}

type OrderClaimQuery struct {
	Keyword        string
	ClaimStatus    string
	SourcePlatform string
	ClaimedProduct string
	UserId         int
	ReviewerId     int
	CreatedFrom    int64
	CreatedTo      int64
}

type OrderClaimReviewInput struct {
	Action     string
	ReviewNote string
	GrantType  string
	PlanId     int
	ProductKey string
	Quota      int
	ExpiresAt  int64
	MaxUses    int
	GrantName  string
	GrantNote  string
}

type OrderClaimGrantedSubscription struct {
	SubscriptionId int    `json:"subscription_id"`
	PlanId         int    `json:"plan_id"`
	PlanTitle      string `json:"plan_title"`
	StartTime      int64  `json:"start_time"`
	EndTime        int64  `json:"end_time"`
	Status         string `json:"status"`
	Source         string `json:"source"`
}

type OrderClaimReviewResult struct {
	Claim             *OrderClaim                    `json:"claim"`
	Message           string                         `json:"message"`
	GeneratedCode     string                         `json:"generated_code,omitempty"`
	GeneratedCodeType string                         `json:"generated_code_type,omitempty"`
	Subscription      *OrderClaimGrantedSubscription `json:"subscription,omitempty"`
}

func normalizeOrderClaimImages(images []string) []string {
	if len(images) == 0 {
		return []string{}
	}
	normalized := make([]string, 0, len(images))
	for _, item := range images {
		value := strings.TrimSpace(item)
		if value == "" {
			continue
		}
		normalized = append(normalized, value)
	}
	return normalized
}

func (claim *OrderClaim) normalizeFields() {
	if claim == nil {
		return
	}
	claim.SourcePlatform = strings.TrimSpace(claim.SourcePlatform)
	claim.ExternalOrderNo = strings.TrimSpace(claim.ExternalOrderNo)
	claim.BuyerContact = strings.TrimSpace(claim.BuyerContact)
	claim.ClaimedProduct = strings.TrimSpace(claim.ClaimedProduct)
	claim.ClaimNote = strings.TrimSpace(claim.ClaimNote)
	claim.ReviewNote = strings.TrimSpace(claim.ReviewNote)
	claim.GrantType = strings.TrimSpace(claim.GrantType)
	claim.GrantedCode = strings.TrimSpace(claim.GrantedCode)
	claim.GrantedProductKey = strings.TrimSpace(claim.GrantedProductKey)
	claim.ProofImages = normalizeOrderClaimImages(claim.ProofImages)
}

func (claim *OrderClaim) syncProofImagesJSON() error {
	if claim == nil {
		return nil
	}
	claim.ProofImages = normalizeOrderClaimImages(claim.ProofImages)
	if len(claim.ProofImages) == 0 {
		claim.ProofImagesJSON = "[]"
		return nil
	}
	data, err := common.Marshal(claim.ProofImages)
	if err != nil {
		return err
	}
	claim.ProofImagesJSON = string(data)
	return nil
}

func (claim *OrderClaim) loadProofImages() error {
	if claim == nil {
		return nil
	}
	if strings.TrimSpace(claim.ProofImagesJSON) == "" {
		claim.ProofImages = []string{}
		return nil
	}
	images := make([]string, 0)
	if err := common.UnmarshalJsonStr(claim.ProofImagesJSON, &images); err != nil {
		return err
	}
	claim.ProofImages = normalizeOrderClaimImages(images)
	return nil
}

func (claim *OrderClaim) BeforeCreate(tx *gorm.DB) error {
	claim.normalizeFields()
	if err := claim.syncProofImagesJSON(); err != nil {
		return err
	}
	if claim.ClaimStatus == "" {
		claim.ClaimStatus = common.OrderClaimStatusPendingReview
	}
	now := common.GetTimestamp()
	if claim.CreatedAt == 0 {
		claim.CreatedAt = now
	}
	claim.UpdatedAt = now
	return nil
}

func (claim *OrderClaim) BeforeUpdate(tx *gorm.DB) error {
	claim.normalizeFields()
	if err := claim.syncProofImagesJSON(); err != nil {
		return err
	}
	claim.UpdatedAt = common.GetTimestamp()
	return nil
}

func (claim *OrderClaim) AfterFind(tx *gorm.DB) error {
	return claim.loadProofImages()
}

func ValidateOrderClaimCreatePayload(claim *OrderClaim) error {
	if claim == nil {
		return errors.New("订单申领参数不能为空")
	}
	claim.normalizeFields()
	if claim.SourcePlatform == "" {
		return errors.New("来源平台不能为空")
	}
	if claim.ExternalOrderNo == "" {
		return errors.New("外部订单号不能为空")
	}
	if claim.BuyerContact == "" {
		return errors.New("买家联系方式不能为空")
	}
	if claim.ClaimedProduct == "" {
		return errors.New("申领产品不能为空")
	}
	if len([]rune(claim.SourcePlatform)) > 64 {
		return errors.New("来源平台长度不能超过 64 个字符")
	}
	if len([]rune(claim.ExternalOrderNo)) > 128 {
		return errors.New("外部订单号长度不能超过 128 个字符")
	}
	if len([]rune(claim.BuyerContact)) > 128 {
		return errors.New("买家联系方式长度不能超过 128 个字符")
	}
	if len([]rune(claim.ClaimedProduct)) > 128 {
		return errors.New("申领产品长度不能超过 128 个字符")
	}
	if len([]rune(claim.ClaimNote)) > 1000 {
		return errors.New("申领备注长度不能超过 1000 个字符")
	}
	if len(claim.ProofImages) > 10 {
		return errors.New("凭证图片数量不能超过 10 个")
	}
	for _, item := range claim.ProofImages {
		if len([]rune(item)) > 500 {
			return errors.New("凭证图片地址长度不能超过 500 个字符")
		}
	}
	return nil
}

func ValidateOrderClaimReviewInput(input *OrderClaimReviewInput) error {
	if input == nil {
		return errors.New("审核参数不能为空")
	}
	input.Action = strings.TrimSpace(input.Action)
	input.ReviewNote = strings.TrimSpace(input.ReviewNote)
	input.GrantType = strings.TrimSpace(input.GrantType)
	input.ProductKey = strings.TrimSpace(input.ProductKey)
	input.GrantName = strings.TrimSpace(input.GrantName)
	input.GrantNote = strings.TrimSpace(input.GrantNote)
	if input.Action != common.OrderClaimActionApprove && input.Action != common.OrderClaimActionReject {
		return errors.New("审核动作无效")
	}
	if len([]rune(input.ReviewNote)) > 1000 {
		return errors.New("审核备注长度不能超过 1000 个字符")
	}
	if input.Action == common.OrderClaimActionReject {
		return nil
	}
	switch input.GrantType {
	case common.OrderClaimGrantTypeSubscription:
		if input.PlanId <= 0 {
			return errors.New("请选择订阅套餐")
		}
	case common.OrderClaimGrantTypeSubscriptionCode:
		if input.PlanId <= 0 {
			return errors.New("请选择订阅套餐")
		}
		if input.MaxUses < 0 {
			return errors.New("订阅码最大使用次数不能小于 0")
		}
	case common.OrderClaimGrantTypeRegistrationCode:
		if input.ProductKey == "" {
			input.ProductKey = common.ProductKeyNovel
		}
		if input.MaxUses < 0 {
			return errors.New("注册码最大使用次数不能小于 0")
		}
	case common.OrderClaimGrantTypeRedemption:
		if input.Quota <= 0 {
			return errors.New("兑换额度必须大于 0")
		}
	default:
		return errors.New("发放方式无效")
	}
	if input.ExpiresAt != 0 && input.ExpiresAt < common.GetTimestamp() {
		return errors.New("过期时间不能早于当前时间")
	}
	if len([]rune(input.GrantName)) > 128 {
		return errors.New("发放名称长度不能超过 128 个字符")
	}
	if len([]rune(input.GrantNote)) > 1000 {
		return errors.New("发放备注长度不能超过 1000 个字符")
	}
	return nil
}

func buildOrderClaimName(claim *OrderClaim, fallback string) string {
	parts := make([]string, 0, 3)
	if fallback != "" {
		parts = append(parts, fallback)
	}
	if claim != nil && claim.ClaimedProduct != "" {
		parts = append(parts, claim.ClaimedProduct)
	}
	if claim != nil && claim.ExternalOrderNo != "" {
		parts = append(parts, claim.ExternalOrderNo)
	}
	if len(parts) == 0 {
		return "订单申领发放"
	}
	return strings.Join(parts, "-")
}

func applyOrderClaimFilters(query *gorm.DB, filters OrderClaimQuery) (*gorm.DB, error) {
	if query == nil {
		query = DB.Model(&OrderClaim{})
	}
	if keyword := strings.TrimSpace(filters.Keyword); keyword != "" {
		if id, convErr := strconv.Atoi(keyword); convErr == nil {
			query = query.Where(
				"id = ? OR external_order_no LIKE ? OR buyer_contact LIKE ? OR claimed_product LIKE ?",
				id,
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
			)
		} else {
			query = query.Where(
				"external_order_no LIKE ? OR buyer_contact LIKE ? OR claimed_product LIKE ?",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
			)
		}
	}
	if value := strings.TrimSpace(filters.ClaimStatus); value != "" {
		query = query.Where("claim_status = ?", value)
	}
	if value := strings.TrimSpace(filters.SourcePlatform); value != "" {
		query = query.Where("source_platform LIKE ?", "%"+value+"%")
	}
	if value := strings.TrimSpace(filters.ClaimedProduct); value != "" {
		query = query.Where("claimed_product LIKE ?", "%"+value+"%")
	}
	if filters.UserId > 0 {
		query = query.Where("user_id = ?", filters.UserId)
	}
	if filters.ReviewerId > 0 {
		query = query.Where("reviewer_id = ?", filters.ReviewerId)
	}
	if filters.CreatedFrom > 0 {
		query = query.Where("created_at >= ?", filters.CreatedFrom)
	}
	if filters.CreatedTo > 0 {
		query = query.Where("created_at <= ?", filters.CreatedTo)
	}
	return query, nil
}

func GetAllOrderClaims(startIdx int, num int, filters OrderClaimQuery) (claims []*OrderClaim, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query, err := applyOrderClaimFilters(tx.Model(&OrderClaim{}), filters)
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	if err = query.Order("id desc").Limit(num).Offset(startIdx).Find(&claims).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return claims, total, nil
}

func GetOrderClaimById(id int) (*OrderClaim, error) {
	if id <= 0 {
		return nil, errors.New("订单申领 id 无效")
	}
	claim := &OrderClaim{}
	if err := DB.First(claim, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return claim, nil
}

func GetOrderClaimByIdForUser(id int, userId int) (*OrderClaim, error) {
	if id <= 0 || userId <= 0 {
		return nil, errors.New("订单申领参数无效")
	}
	claim := &OrderClaim{}
	if err := DB.Where("id = ? AND user_id = ?", id, userId).First(claim).Error; err != nil {
		return nil, err
	}
	return claim, nil
}

func CreateOrderClaim(userId int, claim *OrderClaim) (*OrderClaim, error) {
	if userId <= 0 {
		return nil, errors.New("用户 id 无效")
	}
	if err := ValidateOrderClaimCreatePayload(claim); err != nil {
		return nil, err
	}
	claim.UserId = userId
	claim.ClaimStatus = common.OrderClaimStatusPendingReview

	var existing OrderClaim
	err := DB.Where(
		"user_id = ? AND source_platform = ? AND external_order_no = ? AND claim_status IN ?",
		userId,
		claim.SourcePlatform,
		claim.ExternalOrderNo,
		[]string{common.OrderClaimStatusPendingReview, common.OrderClaimStatusApproved},
	).First(&existing).Error
	if err == nil && existing.Id > 0 {
		return nil, errors.New("该订单已存在待审核或已通过的申领记录")
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err := DB.Create(claim).Error; err != nil {
		return nil, err
	}
	RecordLog(userId, LogTypeSystem, fmt.Sprintf(
		"提交订单申领成功，来源平台: %s，订单号: %s",
		claim.SourcePlatform,
		claim.ExternalOrderNo,
	))
	return claim, nil
}

func AdminReviewOrderClaim(claimId int, reviewerId int, input *OrderClaimReviewInput) (*OrderClaimReviewResult, error) {
	if claimId <= 0 {
		return nil, errors.New("订单申领 id 无效")
	}
	if reviewerId <= 0 {
		return nil, errors.New("审核人无效")
	}
	if err := ValidateOrderClaimReviewInput(input); err != nil {
		return nil, err
	}

	var (
		result         *OrderClaimReviewResult
		cacheGroup     string
		publication    *CodePublicationCreateInput
		userLogMsg     string
		reviewerLogMsg string
		targetUserId   int
	)

	err := DB.Transaction(func(tx *gorm.DB) error {
		claim := &OrderClaim{}
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("id = ?", claimId).First(claim).Error; err != nil {
			return err
		}
		if claim.ClaimStatus != common.OrderClaimStatusPendingReview {
			return errors.New("当前订单申领已处理，请刷新后重试")
		}

		targetUserId = claim.UserId
		claim.ReviewerId = reviewerId
		claim.ReviewNote = input.ReviewNote
		claim.ReviewedAt = common.GetTimestamp()

		if input.Action == common.OrderClaimActionReject {
			claim.ClaimStatus = common.OrderClaimStatusRejected
			if err := tx.Model(claim).Select(
				"claim_status",
				"reviewer_id",
				"review_note",
				"reviewed_at",
				"updated_at",
			).Updates(claim).Error; err != nil {
				return err
			}
			result = &OrderClaimReviewResult{
				Claim:   claim,
				Message: "订单申领已驳回",
			}
			userLogMsg = fmt.Sprintf("订单申领已被驳回，订单号: %s", claim.ExternalOrderNo)
			reviewerLogMsg = fmt.Sprintf(
				"审核订单申领并驳回，申领ID: %d，用户ID: %d，订单号: %s",
				claim.Id,
				claim.UserId,
				claim.ExternalOrderNo,
			)
			return nil
		}

		claim.ClaimStatus = common.OrderClaimStatusApproved
		claim.GrantType = input.GrantType
		claim.GrantedPlanId = 0
		claim.GrantedProductKey = ""
		claim.GrantedQuota = 0
		claim.GrantedCode = ""
		claim.GrantedRedemptionId = 0
		claim.GrantedRegistrationCodeId = 0
		claim.GrantedSubscriptionCodeId = 0
		claim.GrantedSubscriptionId = 0

		baseNote := strings.TrimSpace(input.GrantNote)
		if baseNote == "" {
			baseNote = fmt.Sprintf("order_claim:%d", claim.Id)
		}

		switch input.GrantType {
		case common.OrderClaimGrantTypeSubscription:
			plan, err := getSubscriptionPlanByIdTx(tx, input.PlanId)
			if err != nil {
				return err
			}
			subscription, err := CreateUserSubscriptionFromPlanTx(tx, claim.UserId, plan, "order_claim")
			if err != nil {
				return err
			}
			claim.GrantedPlanId = plan.Id
			claim.GrantedSubscriptionId = subscription.Id
			cacheGroup = strings.TrimSpace(plan.UpgradeGroup)
			result = &OrderClaimReviewResult{
				Claim:   claim,
				Message: "订单申领审核通过，已直接开通订阅",
				Subscription: &OrderClaimGrantedSubscription{
					SubscriptionId: subscription.Id,
					PlanId:         plan.Id,
					PlanTitle:      plan.Title,
					StartTime:      subscription.StartTime,
					EndTime:        subscription.EndTime,
					Status:         subscription.Status,
					Source:         subscription.Source,
				},
			}
			publication = &CodePublicationCreateInput{
				OrderClaimId:          claim.Id,
				CodeType:              common.OrderClaimGrantTypeSubscription,
				CodeId:                subscription.Id,
				TargetUserId:          claim.UserId,
				TargetContact:         claim.BuyerContact,
				SourcePlatform:        claim.SourcePlatform,
				ExternalOrderNo:       claim.ExternalOrderNo,
				ClaimedProduct:        claim.ClaimedProduct,
				GrantPlanId:           plan.Id,
				GrantedSubscriptionId: subscription.Id,
				PublicationChannel:    common.CodePublicationChannelOrderClaim,
				PublishedBy:           reviewerId,
				PublishedAt:           claim.ReviewedAt,
				Notes:                 baseNote,
			}
			userLogMsg = fmt.Sprintf("订单申领审核通过，已开通订阅套餐: %s", plan.Title)
			reviewerLogMsg = fmt.Sprintf(
				"审核订单申领并直接开通订阅，申领ID: %d，用户ID: %d，套餐ID: %d",
				claim.Id,
				claim.UserId,
				plan.Id,
			)
		case common.OrderClaimGrantTypeSubscriptionCode:
			plan, err := getSubscriptionPlanByIdTx(tx, input.PlanId)
			if err != nil {
				return err
			}
			maxUses := input.MaxUses
			if maxUses == 0 {
				maxUses = 1
			}
			code := &SubscriptionCode{
				Name:            buildOrderClaimName(claim, input.GrantName),
				PlanId:          plan.Id,
				Status:          common.SubscriptionCodeStatusEnabled,
				ExpiresAt:       input.ExpiresAt,
				MaxUses:         maxUses,
				CreatedBy:       reviewerId,
				BatchNo:         fmt.Sprintf("order-claim-%d", claim.Id),
				CampaignName:    claim.ClaimedProduct,
				Channel:         "order_claim",
				SourcePlatform:  claim.SourcePlatform,
				ExternalOrderNo: claim.ExternalOrderNo,
				Notes:           baseNote,
			}
			if err := tx.Create(code).Error; err != nil {
				return err
			}
			claim.GrantedPlanId = plan.Id
			claim.GrantedCode = code.Code
			claim.GrantedSubscriptionCodeId = code.Id
			result = &OrderClaimReviewResult{
				Claim:             claim,
				Message:           "订单申领审核通过，已发放订阅码",
				GeneratedCode:     code.Code,
				GeneratedCodeType: common.OrderClaimGrantTypeSubscriptionCode,
			}
			publication = &CodePublicationCreateInput{
				OrderClaimId:       claim.Id,
				CodeType:           common.OrderClaimGrantTypeSubscriptionCode,
				CodeId:             code.Id,
				CodeValue:          code.Code,
				TargetUserId:       claim.UserId,
				TargetContact:      claim.BuyerContact,
				SourcePlatform:     claim.SourcePlatform,
				ExternalOrderNo:    claim.ExternalOrderNo,
				ClaimedProduct:     claim.ClaimedProduct,
				GrantPlanId:        plan.Id,
				PublicationChannel: common.CodePublicationChannelOrderClaim,
				PublishedBy:        reviewerId,
				PublishedAt:        claim.ReviewedAt,
				Notes:              baseNote,
			}
			userLogMsg = fmt.Sprintf("订单申领审核通过，已发放订阅码，套餐: %s", plan.Title)
			reviewerLogMsg = fmt.Sprintf(
				"审核订单申领并发放订阅码，申领ID: %d，用户ID: %d，订阅码ID: %d",
				claim.Id,
				claim.UserId,
				code.Id,
			)
		case common.OrderClaimGrantTypeRegistrationCode:
			maxUses := input.MaxUses
			if maxUses == 0 {
				maxUses = 1
			}
			productKey := input.ProductKey
			if productKey == "" {
				productKey = common.ProductKeyNovel
			}
			code := &RegistrationCode{
				Name:            buildOrderClaimName(claim, input.GrantName),
				Status:          common.RegistrationCodeStatusEnabled,
				ProductKey:      productKey,
				ExpiresAt:       input.ExpiresAt,
				MaxUses:         maxUses,
				CreatedBy:       reviewerId,
				BatchNo:         fmt.Sprintf("order-claim-%d", claim.Id),
				CampaignName:    claim.ClaimedProduct,
				Channel:         "order_claim",
				SourcePlatform:  claim.SourcePlatform,
				ExternalOrderNo: claim.ExternalOrderNo,
				Notes:           baseNote,
			}
			if err := tx.Create(code).Error; err != nil {
				return err
			}
			claim.GrantedCode = code.Code
			claim.GrantedProductKey = code.ProductKey
			claim.GrantedRegistrationCodeId = code.Id
			result = &OrderClaimReviewResult{
				Claim:             claim,
				Message:           "订单申领审核通过，已发放注册码",
				GeneratedCode:     code.Code,
				GeneratedCodeType: common.OrderClaimGrantTypeRegistrationCode,
			}
			publication = &CodePublicationCreateInput{
				OrderClaimId:       claim.Id,
				CodeType:           common.OrderClaimGrantTypeRegistrationCode,
				CodeId:             code.Id,
				CodeValue:          code.Code,
				TargetUserId:       claim.UserId,
				TargetContact:      claim.BuyerContact,
				SourcePlatform:     claim.SourcePlatform,
				ExternalOrderNo:    claim.ExternalOrderNo,
				ClaimedProduct:     claim.ClaimedProduct,
				GrantProductKey:    code.ProductKey,
				PublicationChannel: common.CodePublicationChannelOrderClaim,
				PublishedBy:        reviewerId,
				PublishedAt:        claim.ReviewedAt,
				Notes:              baseNote,
			}
			userLogMsg = fmt.Sprintf("订单申领审核通过，已发放注册码，产品: %s", code.ProductKey)
			reviewerLogMsg = fmt.Sprintf(
				"审核订单申领并发放注册码，申领ID: %d，用户ID: %d，注册码ID: %d",
				claim.Id,
				claim.UserId,
				code.Id,
			)
		case common.OrderClaimGrantTypeRedemption:
			keyValue := common.GetUUID()
			code := &Redemption{
				UserId:          reviewerId,
				Key:             keyValue,
				Status:          common.RedemptionCodeStatusEnabled,
				Name:            buildOrderClaimName(claim, input.GrantName),
				Quota:           input.Quota,
				BatchNo:         fmt.Sprintf("order-claim-%d", claim.Id),
				CampaignName:    claim.ClaimedProduct,
				Channel:         "order_claim",
				SourcePlatform:  claim.SourcePlatform,
				ExternalOrderNo: claim.ExternalOrderNo,
				Notes:           baseNote,
				CreatedTime:     common.GetTimestamp(),
				ExpiredTime:     input.ExpiresAt,
			}
			if err := tx.Create(code).Error; err != nil {
				return err
			}
			claim.GrantedCode = code.Key
			claim.GrantedQuota = code.Quota
			claim.GrantedRedemptionId = code.Id
			result = &OrderClaimReviewResult{
				Claim:             claim,
				Message:           "订单申领审核通过，已发放兑换码",
				GeneratedCode:     code.Key,
				GeneratedCodeType: common.OrderClaimGrantTypeRedemption,
			}
			publication = &CodePublicationCreateInput{
				OrderClaimId:       claim.Id,
				CodeType:           common.OrderClaimGrantTypeRedemption,
				CodeId:             code.Id,
				CodeValue:          code.Key,
				TargetUserId:       claim.UserId,
				TargetContact:      claim.BuyerContact,
				SourcePlatform:     claim.SourcePlatform,
				ExternalOrderNo:    claim.ExternalOrderNo,
				ClaimedProduct:     claim.ClaimedProduct,
				GrantQuota:         code.Quota,
				PublicationChannel: common.CodePublicationChannelOrderClaim,
				PublishedBy:        reviewerId,
				PublishedAt:        claim.ReviewedAt,
				Notes:              baseNote,
			}
			userLogMsg = fmt.Sprintf("订单申领审核通过，已发放兑换码，额度: %d", code.Quota)
			reviewerLogMsg = fmt.Sprintf(
				"审核订单申领并发放兑换码，申领ID: %d，用户ID: %d，兑换码ID: %d",
				claim.Id,
				claim.UserId,
				code.Id,
			)
		default:
			return errors.New("发放方式无效")
		}

		if publication != nil {
			if _, _, err := CreateCodePublicationWithInitialDeliveryTx(tx, publication); err != nil {
				return err
			}
		}

		if err := tx.Model(claim).Select(
			"claim_status",
			"reviewer_id",
			"review_note",
			"reviewed_at",
			"grant_type",
			"granted_code",
			"granted_plan_id",
			"granted_product_key",
			"granted_quota",
			"granted_redemption_id",
			"granted_registration_code_id",
			"granted_subscription_code_id",
			"granted_subscription_id",
			"updated_at",
		).Updates(claim).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	if cacheGroup != "" && targetUserId > 0 {
		_ = UpdateUserGroupCache(targetUserId, cacheGroup)
	}
	if targetUserId > 0 && userLogMsg != "" {
		RecordLog(targetUserId, LogTypeSystem, userLogMsg)
	}
	if reviewerId > 0 && reviewerLogMsg != "" {
		RecordLog(reviewerId, LogTypeManage, reviewerLogMsg)
	}
	return result, nil
}
