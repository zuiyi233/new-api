package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func buildSubscriptionCodeQuery(c *gin.Context, keyword string) (model.SubscriptionCodeQuery, error) {
	filters := model.SubscriptionCodeQuery{
		Keyword:         strings.TrimSpace(keyword),
		Availability:    strings.TrimSpace(c.Query("availability")),
		BatchNo:         strings.TrimSpace(c.Query("batch_no")),
		CampaignName:    strings.TrimSpace(c.Query("campaign_name")),
		Channel:         strings.TrimSpace(c.Query("channel")),
		SourcePlatform:  strings.TrimSpace(c.Query("source_platform")),
		ExternalOrderNo: strings.TrimSpace(c.Query("external_order_no")),
	}
	var err error
	if rawStatus := strings.TrimSpace(c.Query("status")); rawStatus != "" {
		filters.Status, err = strconv.Atoi(rawStatus)
		if err != nil {
			return filters, errors.New("订阅码状态无效")
		}
	}
	if rawPlanId := strings.TrimSpace(c.Query("plan_id")); rawPlanId != "" {
		filters.PlanId, err = strconv.Atoi(rawPlanId)
		if err != nil || filters.PlanId <= 0 {
			return filters, errors.New("套餐 ID 无效")
		}
	}
	if filters.CreatedBy, err = parsePositiveIntQuery(c.Query("created_by"), "创建人"); err != nil {
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

func GetAllSubscriptionCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	filters, err := buildSubscriptionCodeQuery(c, c.Query("keyword"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	codes, total, err := model.GetAllSubscriptionCodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func SearchSubscriptionCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")
	filters, err := buildSubscriptionCodeQuery(c, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	codes, total, err := model.SearchSubscriptionCodes(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func GetSubscriptionCodeBatchSummaries(c *gin.Context) {
	filters, err := buildSubscriptionCodeQuery(c, c.Query("keyword"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	limit, err := parsePositiveIntQuery(c.Query("limit"), "limit")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	summaries, err := model.GetSubscriptionCodeBatchSummaries(filters, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summaries)
}

func GetSubscriptionCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	code, err := model.GetSubscriptionCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, code)
}

func AddSubscriptionCode(c *gin.Context) {
	payload := &model.SubscriptionCode{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Count <= 0 {
		payload.Count = 1
	}
	if err := model.ValidateSubscriptionCodeAdminPayload(payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Count > 1 && strings.TrimSpace(payload.Code) != "" {
		common.ApiErrorMsg(c, "批量创建时不能指定固定订阅码")
		return
	}

	operatorId := c.GetInt("id")
	entities, createdCodes := model.BuildSubscriptionCodes(operatorId, *payload)
	for _, code := range entities {
		if err := code.Insert(); err != nil {
			common.ApiError(c, err)
			return
		}
	}

	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeSubscriptionCode,
		OperationType: model.CodeOperationCreate,
		BatchNo:       payload.BatchNo,
		TargetSummary: "创建订阅码",
		TotalCount:    len(createdCodes),
		SuccessCount:  len(createdCodes),
		Notes:         payload.Name,
		ErrorDetails:  marshalLogValue(createdCodes),
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    createdCodes,
	})
}

func UpdateSubscriptionCode(c *gin.Context) {
	statusOnly := c.Query("status_only") != ""
	payload := &model.SubscriptionCode{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Id == 0 {
		common.ApiErrorMsg(c, "订阅码 ID 不能为空")
		return
	}
	code, err := model.GetSubscriptionCodeById(payload.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if statusOnly {
		if payload.Status != common.SubscriptionCodeStatusEnabled && payload.Status != common.SubscriptionCodeStatusDisabled {
			common.ApiErrorMsg(c, "订阅码状态无效")
			return
		}
		code.Status = payload.Status
	} else {
		if payload.Status == 0 {
			payload.Status = code.Status
		}
		payload.Count = 1
		if err := model.ValidateSubscriptionCodeAdminPayload(payload); err != nil {
			common.ApiError(c, err)
			return
		}
		code.Name = payload.Name
		code.PlanId = payload.PlanId
		code.Status = payload.Status
		code.ExpiresAt = payload.ExpiresAt
		code.MaxUses = payload.MaxUses
		code.BatchNo = payload.BatchNo
		code.CampaignName = payload.CampaignName
		code.Channel = payload.Channel
		code.SourcePlatform = payload.SourcePlatform
		code.ExternalOrderNo = payload.ExternalOrderNo
		code.Notes = payload.Notes
		if code.MaxUses > 0 && code.UsedCount > code.MaxUses {
			common.ApiErrorMsg(c, "最大使用次数不能小于已使用次数")
			return
		}
	}
	if err := code.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeSubscriptionCode,
		OperationType: model.CodeOperationUpdate,
		BatchNo:       code.BatchNo,
		TargetSummary: "id=" + strconv.Itoa(code.Id),
		TotalCount:    1,
		SuccessCount:  1,
		Notes:         code.Name,
	})
	common.ApiSuccess(c, code)
}

func DeleteSubscriptionCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	code, err := model.GetSubscriptionCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteSubscriptionCodeById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeSubscriptionCode,
		OperationType: model.CodeOperationDelete,
		BatchNo:       code.BatchNo,
		TargetSummary: "删除订阅码",
		TotalCount:    1,
		SuccessCount:  1,
		Notes:         code.Name,
		ErrorDetails:  marshalLogValue([]string{code.Code}),
	})
	common.ApiSuccess(c, nil)
}

func DeleteSubscriptionCodeBatch(c *gin.Context) {
	ids, err := parseCodeBatchPayload(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	count, err := model.BatchDeleteSubscriptionCodes(ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeSubscriptionCode,
		OperationType: model.CodeOperationBatchDelete,
		TargetSummary: summarizeIDs(ids),
		TotalCount:    len(ids),
		SuccessCount:  int(count),
		FailedCount:   len(ids) - int(count),
	})
	common.ApiSuccess(c, count)
}

func UpdateSubscriptionCodeBatchStatus(c *gin.Context) {
	ids, status, err := parseCodeBatchStatusPayload(
		c,
		common.SubscriptionCodeStatusEnabled,
		common.SubscriptionCodeStatusDisabled,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	count, err := model.BatchUpdateSubscriptionCodeStatus(ids, status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeSubscriptionCode,
		OperationType: model.CodeOperationBatchStatus,
		TargetSummary: summarizeIDs(ids),
		TotalCount:    len(ids),
		SuccessCount:  int(count),
		FailedCount:   len(ids) - int(count),
		Notes:         "status=" + strconv.Itoa(status),
	})
	common.ApiSuccess(c, count)
}

func GetSubscriptionCodeUsages(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	subscriptionCodeId := 0
	if rawId := strings.TrimSpace(c.Query("subscription_code_id")); rawId != "" {
		parsedId, err := strconv.Atoi(rawId)
		if err != nil || parsedId <= 0 {
			common.ApiErrorMsg(c, "订阅码 ID 无效")
			return
		}
		subscriptionCodeId = parsedId
	}
	usages, total, err := model.GetSubscriptionCodeUsages(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), subscriptionCodeId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(usages)
	common.ApiSuccess(c, pageInfo)
}

func PreviewSubscriptionCodeImport(c *gin.Context) {
	payload, err := parseCodeImportPayload(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.PreviewSubscriptionCodeCSV(payload.FileName, payload.CsvContent)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeSubscriptionCode,
		OperationType: model.CodeOperationImportPreview,
		FileName:      result.FileName,
		BatchNo:       result.BatchNo,
		TotalCount:    result.TotalRows,
		SuccessCount:  result.ValidRows,
		FailedCount:   result.InvalidRows,
		ErrorDetails:  marshalLogValue(result.Errors),
	})
	common.ApiSuccess(c, result)
}

func ImportSubscriptionCode(c *gin.Context) {
	payload, err := parseCodeImportPayload(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.ImportSubscriptionCodeCSV(c.GetInt("id"), payload.FileName, payload.CsvContent)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeSubscriptionCode,
		OperationType: model.CodeOperationImport,
		FileName:      result.FileName,
		BatchNo:       result.BatchNo,
		TotalCount:    result.TotalRows,
		SuccessCount:  result.SuccessCount,
		FailedCount:   result.FailedCount,
		ErrorDetails:  marshalLogValue(result.Errors),
		Notes:         marshalLogValue(result.CreatedCodes),
	})
	common.ApiSuccess(c, result)
}
