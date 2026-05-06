package controller

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

type codeImportPayload struct {
	FileName   string `json:"file_name"`
	CsvContent string `json:"csv_content"`
}

type codeOperationExportPayload struct {
	CodeType      string `json:"code_type"`
	FileName      string `json:"file_name"`
	BatchNo       string `json:"batch_no"`
	TotalCount    int    `json:"total_count"`
	SuccessCount  int    `json:"success_count"`
	FailedCount   int    `json:"failed_count"`
	TargetSummary string `json:"target_summary"`
	Filters       string `json:"filters"`
	Notes         string `json:"notes"`
}

func isSupportedCodeType(codeType string) bool {
	switch strings.TrimSpace(codeType) {
	case model.CodeTypeRedemption, model.CodeTypeRegistrationCode, model.CodeTypeSubscriptionCode:
		return true
	default:
		return false
	}
}

func parsePositiveIntQuery(raw string, fieldName string) (int, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed < 0 {
		return 0, errors.New(fieldName + "无效")
	}
	return parsed, nil
}

func parseTimestampQuery(raw string, fieldName string) (int64, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, nil
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil || parsed < 0 {
		return 0, errors.New(fieldName + "无效")
	}
	return parsed, nil
}

func summarizeIDs(ids []int) string {
	if len(ids) == 0 {
		return ""
	}
	parts := make([]string, 0, len(ids))
	for _, id := range ids {
		if id <= 0 {
			continue
		}
		parts = append(parts, strconv.Itoa(id))
	}
	return "ids=" + strings.Join(parts, ",")
}

func marshalLogValue(data any) string {
	if data == nil {
		return ""
	}
	bytes, err := common.Marshal(data)
	if err != nil {
		common.SysError("failed to marshal code operation log data: " + err.Error())
		return ""
	}
	return string(bytes)
}

func recordCodeOperationLog(c *gin.Context, log *model.CodeOperationLog) {
	if log == nil {
		return
	}
	if log.OperatorId == 0 {
		log.OperatorId = c.GetInt("id")
	}
	if err := model.CreateCodeOperationLog(log); err != nil {
		common.SysError("failed to create code operation log: " + err.Error())
	}
}

func parseCodeImportPayload(c *gin.Context) (*codeImportPayload, error) {
	payload := &codeImportPayload{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		return nil, err
	}
	payload.FileName = strings.TrimSpace(payload.FileName)
	payload.CsvContent = strings.TrimSpace(payload.CsvContent)
	if payload.CsvContent == "" {
		return nil, errors.New("CSV 内容不能为空")
	}
	return payload, nil
}

func buildCodeOperationLogQuery(c *gin.Context) (model.CodeOperationLogQuery, error) {
	filters := model.CodeOperationLogQuery{
		CodeType:      strings.TrimSpace(c.Query("code_type")),
		OperationType: strings.TrimSpace(c.Query("operation_type")),
		Keyword:       strings.TrimSpace(c.Query("keyword")),
		BatchNo:       strings.TrimSpace(c.Query("batch_no")),
		Result:        strings.TrimSpace(c.Query("result")),
	}
	var err error
	if filters.CodeType != "" && !isSupportedCodeType(filters.CodeType) {
		return filters, errors.New("码类型无效")
	}
	if filters.OperatorId, err = parsePositiveIntQuery(c.Query("operator_id"), "操作人"); err != nil {
		return filters, err
	}
	if filters.CreatedFrom, err = parseTimestampQuery(c.Query("created_from"), "开始时间"); err != nil {
		return filters, err
	}
	if filters.CreatedTo, err = parseTimestampQuery(c.Query("created_to"), "结束时间"); err != nil {
		return filters, err
	}
	return filters, nil
}

func GetCodeOperationHistory(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	filters, err := buildCodeOperationLogQuery(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	logs, total, err := model.GetCodeOperationLogs(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
}

func CreateCodeOperationHistoryExportLog(c *gin.Context) {
	payload := &codeOperationExportPayload{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	payload.CodeType = strings.TrimSpace(payload.CodeType)
	payload.FileName = strings.TrimSpace(payload.FileName)
	payload.BatchNo = strings.TrimSpace(payload.BatchNo)
	payload.TargetSummary = strings.TrimSpace(payload.TargetSummary)
	payload.Filters = strings.TrimSpace(payload.Filters)
	payload.Notes = strings.TrimSpace(payload.Notes)

	if !isSupportedCodeType(payload.CodeType) {
		common.ApiErrorMsg(c, "码类型无效")
		return
	}

	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      payload.CodeType,
		OperationType: model.CodeOperationExport,
		FileName:      payload.FileName,
		BatchNo:       payload.BatchNo,
		TargetSummary: payload.TargetSummary,
		Filters:       payload.Filters,
		TotalCount:    payload.TotalCount,
		SuccessCount:  payload.SuccessCount,
		FailedCount:   payload.FailedCount,
		Notes:         payload.Notes,
	})
	common.ApiSuccess(c, nil)
}
