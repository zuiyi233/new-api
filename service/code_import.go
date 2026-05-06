package service

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type CodeImportRowError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

type CodeImportPreviewResult struct {
	CodeType    string               `json:"code_type"`
	FileName    string               `json:"file_name"`
	BatchNo     string               `json:"batch_no"`
	Headers     []string             `json:"headers"`
	PreviewRows []map[string]string  `json:"preview_rows"`
	TotalRows   int                  `json:"total_rows"`
	ValidRows   int                  `json:"valid_rows"`
	InvalidRows int                  `json:"invalid_rows"`
	Errors      []CodeImportRowError `json:"errors"`
}

type CodeImportCommitResult struct {
	CodeType     string               `json:"code_type"`
	FileName     string               `json:"file_name"`
	BatchNo      string               `json:"batch_no"`
	TotalRows    int                  `json:"total_rows"`
	SuccessCount int                  `json:"success_count"`
	FailedCount  int                  `json:"failed_count"`
	Errors       []CodeImportRowError `json:"errors"`
	CreatedCodes []string             `json:"created_codes"`
}

type redemptionImportRow struct {
	Key             string
	Name            string
	Quota           int
	Status          int
	ExpiredTime     int64
	BatchNo         string
	CampaignName    string
	Channel         string
	SourcePlatform  string
	ExternalOrderNo string
	Notes           string
}

type registrationImportRow struct {
	Code            string
	Name            string
	Status          int
	ProductKey      string
	ExpiresAt       int64
	MaxUses         int
	BatchNo         string
	CampaignName    string
	Channel         string
	SourcePlatform  string
	ExternalOrderNo string
	Notes           string
}

type subscriptionImportRow struct {
	Code            string
	Name            string
	Status          int
	PlanId          int
	ExpiresAt       int64
	MaxUses         int
	BatchNo         string
	CampaignName    string
	Channel         string
	SourcePlatform  string
	ExternalOrderNo string
	Notes           string
}

func PreviewRedemptionCSV(fileName string, csvContent string) (*CodeImportPreviewResult, error) {
	headers, rows, err := parseCodeCSV(csvContent)
	if err != nil {
		return nil, err
	}
	result := &CodeImportPreviewResult{
		CodeType: model.CodeTypeRedemption,
		FileName: strings.TrimSpace(fileName),
		BatchNo:  summarizeCSVBatchNo(rows),
		Headers:  headers,
		Errors:   make([]CodeImportRowError, 0),
	}
	for idx, row := range rows {
		result.TotalRows++
		if _, err := validateRedemptionImportRow(row); err != nil {
			result.InvalidRows++
			result.Errors = append(result.Errors, CodeImportRowError{
				Row:     idx + 2,
				Message: err.Error(),
			})
			continue
		}
		result.ValidRows++
		if len(result.PreviewRows) < 20 {
			result.PreviewRows = append(result.PreviewRows, sanitizeImportPreviewRow(row))
		}
	}
	return result, nil
}

func PreviewRegistrationCodeCSV(fileName string, csvContent string) (*CodeImportPreviewResult, error) {
	headers, rows, err := parseCodeCSV(csvContent)
	if err != nil {
		return nil, err
	}
	result := &CodeImportPreviewResult{
		CodeType: model.CodeTypeRegistrationCode,
		FileName: strings.TrimSpace(fileName),
		BatchNo:  summarizeCSVBatchNo(rows),
		Headers:  headers,
		Errors:   make([]CodeImportRowError, 0),
	}
	for idx, row := range rows {
		result.TotalRows++
		if _, err := validateRegistrationImportRow(row); err != nil {
			result.InvalidRows++
			result.Errors = append(result.Errors, CodeImportRowError{
				Row:     idx + 2,
				Message: err.Error(),
			})
			continue
		}
		result.ValidRows++
		if len(result.PreviewRows) < 20 {
			result.PreviewRows = append(result.PreviewRows, sanitizeImportPreviewRow(row))
		}
	}
	return result, nil
}

func PreviewSubscriptionCodeCSV(fileName string, csvContent string) (*CodeImportPreviewResult, error) {
	headers, rows, err := parseCodeCSV(csvContent)
	if err != nil {
		return nil, err
	}
	result := &CodeImportPreviewResult{
		CodeType: model.CodeTypeSubscriptionCode,
		FileName: strings.TrimSpace(fileName),
		BatchNo:  summarizeCSVBatchNo(rows),
		Headers:  headers,
		Errors:   make([]CodeImportRowError, 0),
	}
	for idx, row := range rows {
		result.TotalRows++
		if _, err := validateSubscriptionImportRow(row); err != nil {
			result.InvalidRows++
			result.Errors = append(result.Errors, CodeImportRowError{
				Row:     idx + 2,
				Message: err.Error(),
			})
			continue
		}
		result.ValidRows++
		if len(result.PreviewRows) < 20 {
			result.PreviewRows = append(result.PreviewRows, sanitizeImportPreviewRow(row))
		}
	}
	return result, nil
}

func ImportRedemptionCSV(operatorId int, fileName string, csvContent string) (*CodeImportCommitResult, error) {
	_, rows, err := parseCodeCSV(csvContent)
	if err != nil {
		return nil, err
	}
	result := &CodeImportCommitResult{
		CodeType: model.CodeTypeRedemption,
		FileName: strings.TrimSpace(fileName),
		BatchNo:  summarizeCSVBatchNo(rows),
		Errors:   make([]CodeImportRowError, 0),
	}
	for idx, row := range rows {
		result.TotalRows++
		normalized, err := validateRedemptionImportRow(row)
		if err != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, CodeImportRowError{
				Row:     idx + 2,
				Message: err.Error(),
			})
			continue
		}
		redemption := &model.Redemption{
			UserId:          operatorId,
			Key:             normalized.Key,
			Name:            normalized.Name,
			Status:          normalized.Status,
			Quota:           normalized.Quota,
			CreatedTime:     common.GetTimestamp(),
			ExpiredTime:     normalized.ExpiredTime,
			BatchNo:         normalized.BatchNo,
			CampaignName:    normalized.CampaignName,
			Channel:         normalized.Channel,
			SourcePlatform:  normalized.SourcePlatform,
			ExternalOrderNo: normalized.ExternalOrderNo,
			Notes:           normalized.Notes,
		}
		if err = redemption.Insert(); err != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, CodeImportRowError{
				Row:     idx + 2,
				Message: err.Error(),
			})
			continue
		}
		result.SuccessCount++
		result.CreatedCodes = append(result.CreatedCodes, redemption.Key)
	}
	return result, nil
}

func ImportRegistrationCodeCSV(operatorId int, fileName string, csvContent string) (*CodeImportCommitResult, error) {
	_, rows, err := parseCodeCSV(csvContent)
	if err != nil {
		return nil, err
	}
	result := &CodeImportCommitResult{
		CodeType: model.CodeTypeRegistrationCode,
		FileName: strings.TrimSpace(fileName),
		BatchNo:  summarizeCSVBatchNo(rows),
		Errors:   make([]CodeImportRowError, 0),
	}
	for idx, row := range rows {
		result.TotalRows++
		normalized, err := validateRegistrationImportRow(row)
		if err != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, CodeImportRowError{
				Row:     idx + 2,
				Message: err.Error(),
			})
			continue
		}
		registrationCode := &model.RegistrationCode{
			Code:            normalized.Code,
			Name:            normalized.Name,
			Status:          normalized.Status,
			ProductKey:      normalized.ProductKey,
			ExpiresAt:       normalized.ExpiresAt,
			MaxUses:         normalized.MaxUses,
			CreatedBy:       operatorId,
			BatchNo:         normalized.BatchNo,
			CampaignName:    normalized.CampaignName,
			Channel:         normalized.Channel,
			SourcePlatform:  normalized.SourcePlatform,
			ExternalOrderNo: normalized.ExternalOrderNo,
			Notes:           normalized.Notes,
		}
		if err = registrationCode.Insert(); err != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, CodeImportRowError{
				Row:     idx + 2,
				Message: err.Error(),
			})
			continue
		}
		result.SuccessCount++
		result.CreatedCodes = append(result.CreatedCodes, registrationCode.Code)
	}
	return result, nil
}

func ImportSubscriptionCodeCSV(operatorId int, fileName string, csvContent string) (*CodeImportCommitResult, error) {
	_, rows, err := parseCodeCSV(csvContent)
	if err != nil {
		return nil, err
	}
	result := &CodeImportCommitResult{
		CodeType: model.CodeTypeSubscriptionCode,
		FileName: strings.TrimSpace(fileName),
		BatchNo:  summarizeCSVBatchNo(rows),
		Errors:   make([]CodeImportRowError, 0),
	}
	for idx, row := range rows {
		result.TotalRows++
		normalized, err := validateSubscriptionImportRow(row)
		if err != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, CodeImportRowError{
				Row:     idx + 2,
				Message: err.Error(),
			})
			continue
		}
		subscriptionCode := &model.SubscriptionCode{
			Code:            normalized.Code,
			Name:            normalized.Name,
			Status:          normalized.Status,
			PlanId:          normalized.PlanId,
			ExpiresAt:       normalized.ExpiresAt,
			MaxUses:         normalized.MaxUses,
			CreatedBy:       operatorId,
			BatchNo:         normalized.BatchNo,
			CampaignName:    normalized.CampaignName,
			Channel:         normalized.Channel,
			SourcePlatform:  normalized.SourcePlatform,
			ExternalOrderNo: normalized.ExternalOrderNo,
			Notes:           normalized.Notes,
		}
		if err = subscriptionCode.Insert(); err != nil {
			result.FailedCount++
			result.Errors = append(result.Errors, CodeImportRowError{
				Row:     idx + 2,
				Message: err.Error(),
			})
			continue
		}
		result.SuccessCount++
		result.CreatedCodes = append(result.CreatedCodes, subscriptionCode.Code)
	}
	return result, nil
}

func parseCodeCSV(content string) ([]string, []map[string]string, error) {
	trimmed := strings.TrimSpace(strings.TrimPrefix(content, "\ufeff"))
	if trimmed == "" {
		return nil, nil, errors.New("CSV 内容不能为空")
	}
	reader := csv.NewReader(bytes.NewBufferString(trimmed))
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1
	records, err := reader.ReadAll()
	if err != nil {
		return nil, nil, err
	}
	if len(records) < 2 {
		return nil, nil, errors.New("CSV 至少需要表头和一行数据")
	}

	headers := make([]string, 0, len(records[0]))
	headerKeys := make([]string, 0, len(records[0]))
	for _, item := range records[0] {
		header := strings.TrimSpace(strings.TrimPrefix(item, "\ufeff"))
		if header == "" {
			continue
		}
		headers = append(headers, header)
		headerKeys = append(headerKeys, normalizeCSVHeader(header))
	}
	if len(headerKeys) == 0 {
		return nil, nil, errors.New("CSV 表头不能为空")
	}

	rows := make([]map[string]string, 0, len(records)-1)
	for _, record := range records[1:] {
		row := make(map[string]string, len(headerKeys))
		empty := true
		for i, headerKey := range headerKeys {
			value := ""
			if i < len(record) {
				value = strings.TrimSpace(record[i])
			}
			if value != "" {
				empty = false
			}
			row[headerKey] = value
		}
		if empty {
			continue
		}
		rows = append(rows, row)
	}
	if len(rows) == 0 {
		return nil, nil, errors.New("CSV 没有可导入的数据行")
	}
	return headers, rows, nil
}

func sanitizeImportPreviewRow(row map[string]string) map[string]string {
	preview := make(map[string]string, len(row))
	for key, value := range row {
		preview[key] = strings.TrimSpace(value)
	}
	return preview
}

func summarizeCSVBatchNo(rows []map[string]string) string {
	if len(rows) == 0 {
		return ""
	}
	values := make([]string, 0, len(rows))
	seen := make(map[string]struct{}, len(rows))
	for _, row := range rows {
		batchNo := strings.TrimSpace(getCSVValue(row, "batch_no", "批次号"))
		if batchNo == "" {
			continue
		}
		if _, ok := seen[batchNo]; ok {
			continue
		}
		seen[batchNo] = struct{}{}
		values = append(values, batchNo)
	}
	if len(values) == 0 {
		return ""
	}
	if len(values) == 1 {
		return values[0]
	}
	return fmt.Sprintf("%s +%d", values[0], len(values)-1)
}

func normalizeCSVHeader(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	normalized = strings.ReplaceAll(normalized, "-", "_")
	normalized = strings.ReplaceAll(normalized, " ", "_")
	return normalized
}

func getCSVValue(row map[string]string, keys ...string) string {
	for _, key := range keys {
		if value, ok := row[normalizeCSVHeader(key)]; ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func parseOptionalStatus(raw string, enabledValue int, disabledValue int) (int, error) {
	value := strings.TrimSpace(strings.ToLower(raw))
	if value == "" {
		return enabledValue, nil
	}
	switch value {
	case "1", "enabled", "enable", "active", "可用", "启用", "已启用", "未使用":
		return enabledValue, nil
	case "2", "disabled", "disable", "inactive", "禁用", "已禁用":
		return disabledValue, nil
	case "3", "used", "已使用", "used_up":
		return 3, nil
	default:
		return 0, errors.New("状态字段无效")
	}
}

func parseOptionalInt(raw string, defaultValue int) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return defaultValue, nil
	}
	value, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return 0, errors.New("数值字段无效")
	}
	return value, nil
}

func parseOptionalTimestamp(raw string) (int64, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, nil
	}
	if ts, err := strconv.ParseInt(value, 10, 64); err == nil {
		if ts < 0 {
			return 0, errors.New("时间字段无效")
		}
		return ts, nil
	}
	layouts := []string{
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"2006-01-02",
		time.RFC3339,
	}
	for _, layout := range layouts {
		if parsed, err := time.ParseInLocation(layout, value, time.Local); err == nil {
			return parsed.Unix(), nil
		}
	}
	return 0, errors.New("时间字段无效")
}

func validateRedemptionImportRow(row map[string]string) (*redemptionImportRow, error) {
	name := getCSVValue(row, "name", "名称")
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("名称不能为空")
	}
	quota, err := parseOptionalInt(getCSVValue(row, "quota", "额度"), 0)
	if err != nil || quota <= 0 {
		return nil, errors.New("额度必须是大于 0 的整数")
	}
	status, err := parseOptionalStatus(getCSVValue(row, "status", "状态"), common.RedemptionCodeStatusEnabled, common.RedemptionCodeStatusDisabled)
	if err != nil {
		return nil, err
	}
	if status == common.RedemptionCodeStatusUsed {
		return nil, errors.New("导入兑换码时不支持 used 状态")
	}
	expiredTime, err := parseOptionalTimestamp(getCSVValue(row, "expired_time", "expires_at", "过期时间"))
	if err != nil {
		return nil, err
	}
	if expiredTime != 0 && expiredTime < common.GetTimestamp() {
		return nil, errors.New("过期时间不能早于当前时间")
	}
	key := strings.ToUpper(strings.TrimSpace(getCSVValue(row, "key", "code", "兑换码")))
	if key == "" {
		key = strings.ToUpper(common.GetUUID())
	}
	if len([]rune(key)) > 64 {
		return nil, errors.New("兑换码长度不能超过 64 个字符")
	}
	return &redemptionImportRow{
		Key:             key,
		Name:            strings.TrimSpace(name),
		Quota:           quota,
		Status:          status,
		ExpiredTime:     expiredTime,
		BatchNo:         strings.TrimSpace(getCSVValue(row, "batch_no", "批次号")),
		CampaignName:    strings.TrimSpace(getCSVValue(row, "campaign_name", "活动名称")),
		Channel:         strings.TrimSpace(getCSVValue(row, "channel", "渠道")),
		SourcePlatform:  strings.TrimSpace(getCSVValue(row, "source_platform", "来源平台")),
		ExternalOrderNo: strings.TrimSpace(getCSVValue(row, "external_order_no", "外部订单号")),
		Notes:           strings.TrimSpace(getCSVValue(row, "notes", "备注")),
	}, nil
}

func validateRegistrationImportRow(row map[string]string) (*registrationImportRow, error) {
	name := strings.TrimSpace(getCSVValue(row, "name", "名称"))
	if name == "" {
		return nil, errors.New("名称不能为空")
	}
	status, err := parseOptionalStatus(getCSVValue(row, "status", "状态"), common.RegistrationCodeStatusEnabled, common.RegistrationCodeStatusDisabled)
	if err != nil {
		return nil, err
	}
	if status == 3 {
		return nil, errors.New("导入注册码时不支持 used 状态")
	}
	expiresAt, err := parseOptionalTimestamp(getCSVValue(row, "expires_at", "过期时间"))
	if err != nil {
		return nil, err
	}
	maxUses, err := parseOptionalInt(getCSVValue(row, "max_uses", "最大使用次数"), 1)
	if err != nil || maxUses < 0 {
		return nil, errors.New("最大使用次数不能小于 0")
	}
	productKey := strings.TrimSpace(getCSVValue(row, "product_key", "产品资格"))
	if productKey == "" {
		productKey = common.ProductKeyNovel
	}
	registrationCode := strings.ToUpper(strings.TrimSpace(getCSVValue(row, "code", "注册码")))
	if registrationCode == "" {
		registrationCode = strings.ToUpper(common.GetUUID())
	}
	candidate := &model.RegistrationCode{
		Code:            registrationCode,
		Name:            name,
		Status:          status,
		ProductKey:      productKey,
		ExpiresAt:       expiresAt,
		MaxUses:         maxUses,
		BatchNo:         strings.TrimSpace(getCSVValue(row, "batch_no", "批次号")),
		CampaignName:    strings.TrimSpace(getCSVValue(row, "campaign_name", "活动名称")),
		Channel:         strings.TrimSpace(getCSVValue(row, "channel", "渠道")),
		SourcePlatform:  strings.TrimSpace(getCSVValue(row, "source_platform", "来源平台")),
		ExternalOrderNo: strings.TrimSpace(getCSVValue(row, "external_order_no", "外部订单号")),
		Notes:           strings.TrimSpace(getCSVValue(row, "notes", "备注")),
	}
	if err = model.ValidateRegistrationCodeAdminPayload(candidate); err != nil {
		return nil, err
	}
	return &registrationImportRow{
		Code:            candidate.Code,
		Name:            candidate.Name,
		Status:          candidate.Status,
		ProductKey:      candidate.ProductKey,
		ExpiresAt:       candidate.ExpiresAt,
		MaxUses:         candidate.MaxUses,
		BatchNo:         candidate.BatchNo,
		CampaignName:    candidate.CampaignName,
		Channel:         candidate.Channel,
		SourcePlatform:  candidate.SourcePlatform,
		ExternalOrderNo: candidate.ExternalOrderNo,
		Notes:           candidate.Notes,
	}, nil
}

func validateSubscriptionImportRow(row map[string]string) (*subscriptionImportRow, error) {
	name := strings.TrimSpace(getCSVValue(row, "name", "名称"))
	if name == "" {
		return nil, errors.New("名称不能为空")
	}
	status, err := parseOptionalStatus(getCSVValue(row, "status", "状态"), common.SubscriptionCodeStatusEnabled, common.SubscriptionCodeStatusDisabled)
	if err != nil {
		return nil, err
	}
	if status == common.SubscriptionCodeStatusUsed {
		return nil, errors.New("导入订阅码时不支持 used 状态")
	}
	expiresAt, err := parseOptionalTimestamp(getCSVValue(row, "expires_at", "过期时间"))
	if err != nil {
		return nil, err
	}
	maxUses, err := parseOptionalInt(getCSVValue(row, "max_uses", "最大使用次数"), 1)
	if err != nil || maxUses < 0 {
		return nil, errors.New("最大使用次数不能小于 0")
	}
	planId, err := parseOptionalInt(getCSVValue(row, "plan_id", "套餐ID"), 0)
	if err != nil || planId <= 0 {
		return nil, errors.New("套餐 ID 不能为空")
	}
	if _, err = model.GetSubscriptionPlanById(planId); err != nil {
		return nil, fmt.Errorf("套餐不存在: %d", planId)
	}
	code := strings.ToUpper(strings.TrimSpace(getCSVValue(row, "code", "订阅码")))
	if code == "" {
		code = strings.ToUpper(common.GetUUID())
	}
	candidate := &model.SubscriptionCode{
		Code:            code,
		Name:            name,
		Status:          status,
		PlanId:          planId,
		ExpiresAt:       expiresAt,
		MaxUses:         maxUses,
		BatchNo:         strings.TrimSpace(getCSVValue(row, "batch_no", "批次号")),
		CampaignName:    strings.TrimSpace(getCSVValue(row, "campaign_name", "活动名称")),
		Channel:         strings.TrimSpace(getCSVValue(row, "channel", "渠道")),
		SourcePlatform:  strings.TrimSpace(getCSVValue(row, "source_platform", "来源平台")),
		ExternalOrderNo: strings.TrimSpace(getCSVValue(row, "external_order_no", "外部订单号")),
		Notes:           strings.TrimSpace(getCSVValue(row, "notes", "备注")),
	}
	if err = model.ValidateSubscriptionCodeAdminPayload(candidate); err != nil {
		return nil, err
	}
	return &subscriptionImportRow{
		Code:            candidate.Code,
		Name:            candidate.Name,
		Status:          candidate.Status,
		PlanId:          candidate.PlanId,
		ExpiresAt:       candidate.ExpiresAt,
		MaxUses:         candidate.MaxUses,
		BatchNo:         candidate.BatchNo,
		CampaignName:    candidate.CampaignName,
		Channel:         candidate.Channel,
		SourcePlatform:  candidate.SourcePlatform,
		ExternalOrderNo: candidate.ExternalOrderNo,
		Notes:           candidate.Notes,
	}, nil
}
