package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func buildOrderClaimQuery(c *gin.Context, keyword string) (model.OrderClaimQuery, error) {
	filters := model.OrderClaimQuery{
		Keyword:        strings.TrimSpace(keyword),
		ClaimStatus:    strings.TrimSpace(c.Query("claim_status")),
		SourcePlatform: strings.TrimSpace(c.Query("source_platform")),
		ClaimedProduct: strings.TrimSpace(c.Query("claimed_product")),
	}
	var err error
	if filters.UserId, err = parsePositiveIntQuery(c.Query("user_id"), "用户"); err != nil {
		return filters, err
	}
	if filters.ReviewerId, err = parsePositiveIntQuery(c.Query("reviewer_id"), "审核人"); err != nil {
		return filters, err
	}
	if filters.CreatedFrom, err = parseTimestampQuery(c.Query("created_from"), "创建开始时间"); err != nil {
		return filters, err
	}
	if filters.CreatedTo, err = parseTimestampQuery(c.Query("created_to"), "创建结束时间"); err != nil {
		return filters, err
	}
	return filters, nil
}

func GetSelfOrderClaims(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	filters, err := buildOrderClaimQuery(c, c.Query("keyword"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	filters.UserId = c.GetInt("id")
	claims, total, err := model.GetAllOrderClaims(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(claims)
	common.ApiSuccess(c, pageInfo)
}

func CreateOrderClaim(c *gin.Context) {
	payload := &model.OrderClaim{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	claim, err := model.CreateOrderClaim(c.GetInt("id"), payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"claim_id": claim.Id,
		"status":   claim.ClaimStatus,
		"claim":    claim,
	})
}

func GetAllOrderClaims(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	filters, err := buildOrderClaimQuery(c, c.Query("keyword"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	claims, total, err := model.GetAllOrderClaims(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(claims)
	common.ApiSuccess(c, pageInfo)
}

func GetOrderClaim(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "订单申领 ID 无效")
		return
	}
	claim, err := model.GetOrderClaimById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, claim)
}

func ReviewOrderClaim(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "订单申领 ID 无效")
		return
	}
	payload := &model.OrderClaimReviewInput{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := model.AdminReviewOrderClaim(id, c.GetInt("id"), payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
