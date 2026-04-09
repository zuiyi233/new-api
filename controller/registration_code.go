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

type registrationCodeValidatePayload struct {
	Code             string `json:"code"`
	RegistrationCode string `json:"registration_code"`
}

func buildRegistrationCodeQuery(c *gin.Context, keyword string) (model.RegistrationCodeQuery, error) {
	filters := model.RegistrationCodeQuery{
		Keyword:         strings.TrimSpace(keyword),
		ProductKey:      strings.TrimSpace(c.Query("product_key")),
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
			return filters, errors.New("注册码状态无效")
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

func GetAllRegistrationCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	filters, err := buildRegistrationCodeQuery(c, c.Query("keyword"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	codes, total, err := model.GetAllRegistrationCodes(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func SearchRegistrationCodes(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")
	filters, err := buildRegistrationCodeQuery(c, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	codes, total, err := model.SearchRegistrationCodes(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(codes)
	common.ApiSuccess(c, pageInfo)
}

func GetRegistrationCodeBatchSummaries(c *gin.Context) {
	filters, err := buildRegistrationCodeQuery(c, c.Query("keyword"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	limit, err := parsePositiveIntQuery(c.Query("limit"), "limit")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	summaries, err := model.GetRegistrationCodeBatchSummaries(filters, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summaries)
}

func ValidateRegistrationCode(c *gin.Context) {
	payload := &registrationCodeValidatePayload{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}

	rawCode := strings.TrimSpace(payload.RegistrationCode)
	if rawCode == "" {
		rawCode = strings.TrimSpace(payload.Code)
	}
	if rawCode == "" {
		common.ApiErrorMsg(c, "注册码不能为空")
		return
	}

	registrationCode, err := model.ValidateRegistrationCode(rawCode)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	remainingUses := 0
	if registrationCode.MaxUses > 0 {
		remainingUses = registrationCode.MaxUses - registrationCode.UsedCount
		if remainingUses < 0 {
			remainingUses = 0
		}
	}

	common.ApiSuccess(c, gin.H{
		"available":      true,
		"code":           registrationCode.Code,
		"name":           registrationCode.Name,
		"product_key":    registrationCode.ProductKey,
		"status":         registrationCode.Status,
		"expires_at":     registrationCode.ExpiresAt,
		"max_uses":       registrationCode.MaxUses,
		"used_count":     registrationCode.UsedCount,
		"remaining_uses": remainingUses,
	})
}

func GetRegistrationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	code, err := model.GetRegistrationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, code)
}

func AddRegistrationCode(c *gin.Context) {
	payload := &model.RegistrationCode{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Count <= 0 {
		payload.Count = 1
	}
	if err := model.ValidateRegistrationCodeAdminPayload(payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Count > 1 && strings.TrimSpace(payload.Code) != "" {
		common.ApiErrorMsg(c, "批量创建时不能指定固定注册码")
		return
	}

	operatorId := c.GetInt("id")
	entities, createdCodes := model.BuildRegistrationCodes(operatorId, *payload)
	for _, code := range entities {
		if err := code.Insert(); err != nil {
			common.ApiError(c, err)
			return
		}
	}

	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRegistrationCode,
		OperationType: model.CodeOperationCreate,
		BatchNo:       payload.BatchNo,
		TargetSummary: "创建注册码",
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

func UpdateRegistrationCode(c *gin.Context) {
	statusOnly := c.Query("status_only") != ""
	payload := &model.RegistrationCode{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Id == 0 {
		common.ApiErrorMsg(c, "注册码 ID 不能为空")
		return
	}

	code, err := model.GetRegistrationCodeById(payload.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if statusOnly {
		if payload.Status != common.RegistrationCodeStatusEnabled && payload.Status != common.RegistrationCodeStatusDisabled {
			common.ApiErrorMsg(c, "注册码状态无效")
			return
		}
		code.Status = payload.Status
	} else {
		if payload.Status == 0 {
			payload.Status = code.Status
		}
		payload.Count = 1
		if err := model.ValidateRegistrationCodeAdminPayload(payload); err != nil {
			common.ApiError(c, err)
			return
		}
		code.Name = payload.Name
		code.Status = payload.Status
		code.ProductKey = payload.ProductKey
		code.ExpiresAt = payload.ExpiresAt
		code.MaxUses = payload.MaxUses
		code.BatchNo = payload.BatchNo
		code.CampaignName = payload.CampaignName
		code.Channel = payload.Channel
		code.SourcePlatform = payload.SourcePlatform
		code.ExternalOrderNo = payload.ExternalOrderNo
		code.Notes = payload.Notes
		if err := code.ValidateUpdateConstraints(); err != nil {
			common.ApiError(c, err)
			return
		}
	}

	if err := code.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRegistrationCode,
		OperationType: model.CodeOperationUpdate,
		BatchNo:       code.BatchNo,
		TargetSummary: "id=" + strconv.Itoa(code.Id),
		TotalCount:    1,
		SuccessCount:  1,
		Notes:         code.Name,
	})
	common.ApiSuccess(c, code)
}

func DeleteRegistrationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	code, err := model.GetRegistrationCodeById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteRegistrationCodeById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRegistrationCode,
		OperationType: model.CodeOperationDelete,
		BatchNo:       code.BatchNo,
		TargetSummary: "删除注册码",
		TotalCount:    1,
		SuccessCount:  1,
		Notes:         code.Name,
		ErrorDetails:  marshalLogValue([]string{code.Code}),
	})
	common.ApiSuccess(c, nil)
}

func DeleteRegistrationCodeBatch(c *gin.Context) {
	ids, err := parseCodeBatchPayload(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	count, err := model.BatchDeleteRegistrationCodes(ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRegistrationCode,
		OperationType: model.CodeOperationBatchDelete,
		TargetSummary: summarizeIDs(ids),
		TotalCount:    len(ids),
		SuccessCount:  int(count),
		FailedCount:   len(ids) - int(count),
	})
	common.ApiSuccess(c, count)
}

func UpdateRegistrationCodeBatchStatus(c *gin.Context) {
	ids, status, err := parseCodeBatchStatusPayload(
		c,
		common.RegistrationCodeStatusEnabled,
		common.RegistrationCodeStatusDisabled,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	count, err := model.BatchUpdateRegistrationCodeStatus(ids, status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRegistrationCode,
		OperationType: model.CodeOperationBatchStatus,
		TargetSummary: summarizeIDs(ids),
		TotalCount:    len(ids),
		SuccessCount:  int(count),
		FailedCount:   len(ids) - int(count),
		Notes:         "status=" + strconv.Itoa(status),
	})
	common.ApiSuccess(c, count)
}

func GetRegistrationCodeUsages(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	registrationCodeId := 0
	if rawId := strings.TrimSpace(c.Query("registration_code_id")); rawId != "" {
		parsedId, err := strconv.Atoi(rawId)
		if err != nil || parsedId <= 0 {
			common.ApiErrorMsg(c, "注册码 ID 无效")
			return
		}
		registrationCodeId = parsedId
	}
	usages, total, err := model.GetRegistrationCodeUsages(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), registrationCodeId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(usages)
	common.ApiSuccess(c, pageInfo)
}

func PreviewRegistrationCodeImport(c *gin.Context) {
	payload, err := parseCodeImportPayload(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.PreviewRegistrationCodeCSV(payload.FileName, payload.CsvContent)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRegistrationCode,
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

func ImportRegistrationCode(c *gin.Context) {
	payload, err := parseCodeImportPayload(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.ImportRegistrationCodeCSV(c.GetInt("id"), payload.FileName, payload.CsvContent)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRegistrationCode,
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
