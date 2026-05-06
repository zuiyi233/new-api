package controller

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type userEntitlementPayload struct {
	Id         int    `json:"id"`
	ProductKey string `json:"product_key"`
	Status     int    `json:"status"`
	SourceType string `json:"source_type"`
	SourceId   int    `json:"source_id"`
	ExpiresAt  int64  `json:"expires_at"`
	Notes      string `json:"notes"`
}

func loadAdminTargetUser(c *gin.Context) (*model.User, bool) {
	user, err := model.GetUserById(common.String2Int(c.Param("id")), false)
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	myRole := c.GetInt("role")
	if myRole <= user.Role && myRole != common.RoleRootUser {
		common.ApiErrorMsg(c, "无权管理同级或更高权限用户的产品资格")
		return nil, false
	}
	return user, true
}

func GetUserEntitlementsByAdmin(c *gin.Context) {
	user, ok := loadAdminTargetUser(c)
	if !ok {
		return
	}
	entitlements, err := model.GetUserProductEntitlements(user.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"user_id": user.Id,
		"items":   entitlements,
	})
}

func AddUserEntitlementByAdmin(c *gin.Context) {
	user, ok := loadAdminTargetUser(c)
	if !ok {
		return
	}
	payload := &userEntitlementPayload{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	entitlement := &model.UserProductEntitlement{
		UserId:     user.Id,
		ProductKey: strings.TrimSpace(payload.ProductKey),
		Status:     payload.Status,
		SourceType: common.EntitlementSourceTypeAdminGrant,
		SourceId:   c.GetInt("id"),
		ExpiresAt:  payload.ExpiresAt,
		Notes:      strings.TrimSpace(payload.Notes),
	}
	if entitlement.ProductKey == "" {
		entitlement.ProductKey = common.ProductKeyNovel
	}
	if err := model.ValidateUserProductEntitlement(entitlement, false); err != nil {
		common.ApiError(c, err)
		return
	}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		return model.GrantUserProductEntitlementTx(tx, entitlement)
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	current, err := model.GetUserProductEntitlementByUserAndProduct(user.Id, entitlement.ProductKey)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, current)
}

func UpdateUserEntitlementByAdmin(c *gin.Context) {
	user, ok := loadAdminTargetUser(c)
	if !ok {
		return
	}
	payload := &userEntitlementPayload{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Id == 0 {
		common.ApiErrorMsg(c, "产品资格 ID 不能为空")
		return
	}
	entitlement, err := model.GetUserProductEntitlementById(user.Id, payload.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Status != 0 {
		entitlement.Status = payload.Status
	}
	entitlement.ExpiresAt = payload.ExpiresAt
	entitlement.Notes = strings.TrimSpace(payload.Notes)
	if err := model.ValidateUserProductEntitlement(entitlement, true); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := entitlement.UpdateAdminFields(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, entitlement)
}
