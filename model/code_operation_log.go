package model

import (
	"errors"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

const (
	CodeTypeRedemption       = "redemption"
	CodeTypeRegistrationCode = "registration_code"
	CodeTypeSubscriptionCode = "subscription_code"
)

const (
	CodeOperationCreate        = "create"
	CodeOperationUpdate        = "update"
	CodeOperationDelete        = "delete"
	CodeOperationBatchStatus   = "batch_status"
	CodeOperationBatchDelete   = "batch_delete"
	CodeOperationImport        = "import"
	CodeOperationExport        = "export"
	CodeOperationImportPreview = "import_preview"
)

type CodeOperationLog struct {
	Id            int            `json:"id"`
	CodeType      string         `json:"code_type" gorm:"type:varchar(32);index"`
	OperationType string         `json:"operation_type" gorm:"type:varchar(32);index"`
	OperatorId    int            `json:"operator_id" gorm:"index"`
	FileName      string         `json:"file_name" gorm:"type:varchar(255)"`
	BatchNo       string         `json:"batch_no" gorm:"type:varchar(128);index"`
	TargetSummary string         `json:"target_summary" gorm:"type:text"`
	Filters       string         `json:"filters" gorm:"type:text"`
	TotalCount    int            `json:"total_count"`
	SuccessCount  int            `json:"success_count"`
	FailedCount   int            `json:"failed_count"`
	Notes         string         `json:"notes" gorm:"type:text"`
	ErrorDetails  string         `json:"error_details" gorm:"type:text"`
	CreatedAt     int64          `json:"created_at" gorm:"bigint;index"`
	DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
}

type CodeOperationLogView struct {
	Id            int    `json:"id"`
	CodeType      string `json:"code_type"`
	OperationType string `json:"operation_type"`
	OperatorId    int    `json:"operator_id"`
	OperatorName  string `json:"operator_name"`
	FileName      string `json:"file_name"`
	BatchNo       string `json:"batch_no"`
	TargetSummary string `json:"target_summary"`
	Filters       string `json:"filters"`
	TotalCount    int    `json:"total_count"`
	SuccessCount  int    `json:"success_count"`
	FailedCount   int    `json:"failed_count"`
	Notes         string `json:"notes"`
	ErrorDetails  string `json:"error_details"`
	CreatedAt     int64  `json:"created_at"`
}

type CodeOperationLogQuery struct {
	CodeType      string
	OperationType string
	Keyword       string
	BatchNo       string
	Result        string
	OperatorId    int
	CreatedFrom   int64
	CreatedTo     int64
}

func (log *CodeOperationLog) BeforeCreate(tx *gorm.DB) error {
	if log.CreatedAt == 0 {
		log.CreatedAt = common.GetTimestamp()
	}
	log.CodeType = strings.TrimSpace(log.CodeType)
	log.OperationType = strings.TrimSpace(log.OperationType)
	log.FileName = strings.TrimSpace(log.FileName)
	log.BatchNo = strings.TrimSpace(log.BatchNo)
	log.TargetSummary = strings.TrimSpace(log.TargetSummary)
	log.Filters = strings.TrimSpace(log.Filters)
	log.Notes = strings.TrimSpace(log.Notes)
	log.ErrorDetails = strings.TrimSpace(log.ErrorDetails)
	return nil
}

func CreateCodeOperationLog(log *CodeOperationLog) error {
	if log == nil {
		return nil
	}
	return DB.Create(log).Error
}

func GetCodeOperationLogs(startIdx int, num int, filters CodeOperationLogQuery) (logs []*CodeOperationLogView, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Table("code_operation_logs AS col").
		Joins("LEFT JOIN users u ON u.id = col.operator_id")

	if codeType := strings.TrimSpace(filters.CodeType); codeType != "" {
		query = query.Where("col.code_type = ?", codeType)
	}
	if operationType := strings.TrimSpace(filters.OperationType); operationType != "" {
		query = query.Where("col.operation_type = ?", operationType)
	}
	if batchNo := strings.TrimSpace(filters.BatchNo); batchNo != "" {
		query = query.Where("col.batch_no LIKE ?", "%"+batchNo+"%")
	}
	if filters.OperatorId > 0 {
		query = query.Where("col.operator_id = ?", filters.OperatorId)
	}
	if filters.CreatedFrom > 0 {
		query = query.Where("col.created_at >= ?", filters.CreatedFrom)
	}
	if filters.CreatedTo > 0 {
		query = query.Where("col.created_at <= ?", filters.CreatedTo)
	}
	switch strings.ToLower(strings.TrimSpace(filters.Result)) {
	case "":
	case "success":
		query = query.Where("col.failed_count = 0")
	case "failed":
		query = query.Where("col.failed_count > 0")
	case "partial":
		query = query.Where("col.success_count > 0 AND col.failed_count > 0")
	default:
		return nil, 0, errors.New("操作结果筛选无效")
	}
	if keyword := strings.TrimSpace(filters.Keyword); keyword != "" {
		if operatorId, convErr := strconv.Atoi(keyword); convErr == nil {
			query = query.Where(
				"col.operator_id = ? OR col.file_name LIKE ? OR col.batch_no LIKE ? OR col.target_summary LIKE ? OR col.notes LIKE ? OR u.username LIKE ?",
				operatorId,
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
			)
		} else {
			query = query.Where(
				"col.file_name LIKE ? OR col.batch_no LIKE ? OR col.target_summary LIKE ? OR col.notes LIKE ? OR u.username LIKE ?",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
				"%"+keyword+"%",
			)
		}
	}

	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = query.Select("col.id, col.code_type, col.operation_type, col.operator_id, u.username AS operator_name, col.file_name, col.batch_no, col.target_summary, col.filters, col.total_count, col.success_count, col.failed_count, col.notes, col.error_details, col.created_at").
		Order("col.id desc").
		Limit(num).
		Offset(startIdx).
		Scan(&logs).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return logs, total, nil
}
