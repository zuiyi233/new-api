package controller

import (
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type codePublicationLegacyPublishInput struct {
	PublicationID   int    `json:"publication_id"`
	Action          string `json:"action"`
	DeliveryChannel string `json:"delivery_channel"`
	RevokeReason    string `json:"revoke_reason"`
	Notes           string `json:"notes"`
}

type codePublicationLegacyPublishInputRaw struct {
	PublicationID      int    `json:"publication_id"`
	PublicationIDAlt   int    `json:"publicationId"`
	PublicationIDByID  int    `json:"id"`
	Action             string `json:"action"`
	DeliveryChannel    string `json:"delivery_channel"`
	DeliveryChannelAlt string `json:"deliveryChannel"`
	RevokeReason       string `json:"revoke_reason"`
	RevokeReasonAlt    string `json:"revokeReason"`
	Notes              string `json:"notes"`
}

func (i *codePublicationLegacyPublishInput) UnmarshalJSON(data []byte) error {
	var raw codePublicationLegacyPublishInputRaw
	if err := common.Unmarshal(data, &raw); err != nil {
		return err
	}
	i.PublicationID = raw.PublicationID
	if i.PublicationID <= 0 {
		i.PublicationID = raw.PublicationIDAlt
	}
	if i.PublicationID <= 0 {
		i.PublicationID = raw.PublicationIDByID
	}
	i.Action = raw.Action
	i.DeliveryChannel = raw.DeliveryChannel
	if i.DeliveryChannel == "" {
		i.DeliveryChannel = raw.DeliveryChannelAlt
	}
	i.RevokeReason = raw.RevokeReason
	if i.RevokeReason == "" {
		i.RevokeReason = raw.RevokeReasonAlt
	}
	i.Notes = raw.Notes
	return nil
}

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

// PublishCodePublicationCompat keeps backward compatibility for legacy
// /api/code-publication/publish clients by dispatching to the newer
// /api/code-publication/:id/{reissue|revoke|rollback} actions.
func PublishCodePublicationCompat(c *gin.Context) {
	payload := &codePublicationLegacyPublishInput{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}

	publicationID := payload.PublicationID
	if publicationID <= 0 {
		common.ApiErrorMsg(c, "publication_id is required")
		return
	}

	action := strings.ToLower(strings.TrimSpace(payload.Action))
	if action == "" {
		action = "reissue"
	}
	actionInput := &model.CodePublicationActionInput{
		DeliveryChannel: strings.TrimSpace(payload.DeliveryChannel),
		RevokeReason:    strings.TrimSpace(payload.RevokeReason),
		Notes:           strings.TrimSpace(payload.Notes),
	}

	var (
		item *model.CodeDelivery
		err  error
	)
	switch action {
	case "reissue":
		item, err = model.ReissueCodePublication(publicationID, c.GetInt("id"), actionInput)
	case "revoke":
		item, err = model.RevokeCodePublication(publicationID, c.GetInt("id"), actionInput)
	case "rollback":
		item, err = model.RollbackCodePublication(publicationID, c.GetInt("id"), actionInput)
	default:
		common.ApiErrorMsg(c, "unsupported action: "+action)
		return
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, item)
}
