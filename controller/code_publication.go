package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func buildCodePublicationQuery(c *gin.Context) (model.CodePublicationQuery, error) {
	filters := model.CodePublicationQuery{
		Keyword:            strings.TrimSpace(c.Query("keyword")),
		PublicationStatus:  strings.TrimSpace(c.Query("publication_status")),
		CodeType:           strings.TrimSpace(c.Query("code_type")),
		SourcePlatform:     strings.TrimSpace(c.Query("source_platform")),
		ExternalOrderNo:    strings.TrimSpace(c.Query("external_order_no")),
		ClaimedProduct:     strings.TrimSpace(c.Query("claimed_product")),
		PublicationChannel: strings.TrimSpace(c.Query("publication_channel")),
	}
	var err error
	if filters.CodeId, err = parsePositiveIntQuery(c.Query("code_id"), "发放对象"); err != nil {
		return filters, err
	}
	if filters.OrderClaimId, err = parsePositiveIntQuery(c.Query("order_claim_id"), "订单申领"); err != nil {
		return filters, err
	}
	if filters.TargetUserId, err = parsePositiveIntQuery(c.Query("target_user_id"), "目标用户"); err != nil {
		return filters, err
	}
	if filters.PublishedBy, err = parsePositiveIntQuery(c.Query("published_by"), "发放人"); err != nil {
		return filters, err
	}
	if filters.PublishedFrom, err = parseTimestampQuery(c.Query("published_from"), "发放开始时间"); err != nil {
		return filters, err
	}
	if filters.PublishedTo, err = parseTimestampQuery(c.Query("published_to"), "发放结束时间"); err != nil {
		return filters, err
	}
	return filters, nil
}

func buildCodeDeliveryQuery(c *gin.Context) (model.CodeDeliveryQuery, error) {
	filters := model.CodeDeliveryQuery{
		Keyword:         strings.TrimSpace(c.Query("keyword")),
		DeliveryStatus:  strings.TrimSpace(c.Query("delivery_status")),
		CodeType:        strings.TrimSpace(c.Query("code_type")),
		SourcePlatform:  strings.TrimSpace(c.Query("source_platform")),
		ExternalOrderNo: strings.TrimSpace(c.Query("external_order_no")),
		ClaimedProduct:  strings.TrimSpace(c.Query("claimed_product")),
		DeliveryChannel: strings.TrimSpace(c.Query("delivery_channel")),
	}
	var err error
	if filters.PublicationId, err = parsePositiveIntQuery(c.Query("publication_id"), "发放记录"); err != nil {
		return filters, err
	}
	if filters.OrderClaimId, err = parsePositiveIntQuery(c.Query("order_claim_id"), "订单申领"); err != nil {
		return filters, err
	}
	if filters.TargetUserId, err = parsePositiveIntQuery(c.Query("target_user_id"), "目标用户"); err != nil {
		return filters, err
	}
	if filters.DeliveredBy, err = parsePositiveIntQuery(c.Query("delivered_by"), "送达人"); err != nil {
		return filters, err
	}
	if filters.AttemptNo, err = parsePositiveIntQuery(c.Query("attempt_no"), "尝试序号"); err != nil {
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

func GetAllCodePublications(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	filters, err := buildCodePublicationQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items, total, err := model.GetAllCodePublications(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetCodePublication(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "发放记录 ID 无效")
		return
	}
	item, err := model.GetCodePublicationById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func GetCodePublicationDetail(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "发放记录 ID 无效")
		return
	}
	item, err := model.GetCodePublicationDetail(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func GetAllCodeDeliveries(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	filters, err := buildCodeDeliveryQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	items, total, err := model.GetAllCodeDeliveries(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(items)
	common.ApiSuccess(c, pageInfo)
}

func GetCodeDelivery(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "送达记录 ID 无效")
		return
	}
	item, err := model.GetCodeDeliveryById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func GetCodeDeliveryDetail(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "送达记录 ID 无效")
		return
	}
	item, err := model.GetCodeDeliveryDetail(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func UpdateCodeDeliveryStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "送达记录 ID 无效")
		return
	}
	payload := &model.CodeDeliveryUpdateInput{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	item, err := model.UpdateCodeDeliveryStatus(id, c.GetInt("id"), payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func ReissueCodePublication(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "发放记录 ID 无效")
		return
	}
	payload := &model.CodePublicationActionInput{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	item, err := model.ReissueCodePublication(id, c.GetInt("id"), payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func RevokeCodePublication(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "发放记录 ID 无效")
		return
	}
	payload := &model.CodePublicationActionInput{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	item, err := model.RevokeCodePublication(id, c.GetInt("id"), payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}

func RollbackCodePublication(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		common.ApiErrorMsg(c, "发放记录 ID 无效")
		return
	}
	payload := &model.CodePublicationActionInput{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	item, err := model.RollbackCodePublication(id, c.GetInt("id"), payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}
