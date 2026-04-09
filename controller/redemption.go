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

func buildRedemptionQuery(c *gin.Context, keyword string) (model.RedemptionQuery, error) {
	filters := model.RedemptionQuery{
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
			return filters, errors.New("兑换码状态无效")
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

func GetAllRedemptions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	filters, err := buildRedemptionQuery(c, c.Query("keyword"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	redemptions, total, err := model.GetAllRedemptions(pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(redemptions)
	common.ApiSuccess(c, pageInfo)
}

func SearchRedemptions(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	keyword := c.Query("keyword")
	filters, err := buildRedemptionQuery(c, keyword)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	redemptions, total, err := model.SearchRedemptions(keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), filters)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(redemptions)
	common.ApiSuccess(c, pageInfo)
}

func GetRedemptionBatchSummaries(c *gin.Context) {
	filters, err := buildRedemptionQuery(c, c.Query("keyword"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	limit, err := parsePositiveIntQuery(c.Query("limit"), "limit")
	if err != nil {
		common.ApiError(c, err)
		return
	}
	summaries, err := model.GetRedemptionBatchSummaries(filters, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, summaries)
}

func GetRedemption(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	redemption, err := model.GetRedemptionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    redemption,
	})
}

func AddRedemption(c *gin.Context) {
	payload := &model.Redemption{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Count <= 0 {
		payload.Count = 1
	}
	if err := model.ValidateRedemptionAdminPayload(payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Count > 1 && strings.TrimSpace(payload.Key) != "" {
		common.ApiErrorMsg(c, "批量创建时不能指定固定兑换码")
		return
	}

	operatorId := c.GetInt("id")
	createdKeys := make([]string, 0, payload.Count)
	for i := 0; i < payload.Count; i++ {
		keyValue := strings.TrimSpace(payload.Key)
		if keyValue == "" || payload.Count > 1 {
			keyValue = common.GetUUID()
		}
		redemption := &model.Redemption{
			UserId:          operatorId,
			Key:             keyValue,
			Status:          payload.Status,
			Name:            payload.Name,
			Quota:           payload.Quota,
			BatchNo:         payload.BatchNo,
			CampaignName:    payload.CampaignName,
			Channel:         payload.Channel,
			SourcePlatform:  payload.SourcePlatform,
			ExternalOrderNo: payload.ExternalOrderNo,
			Notes:           payload.Notes,
			CreatedTime:     common.GetTimestamp(),
			ExpiredTime:     payload.ExpiredTime,
		}
		if err := redemption.Insert(); err != nil {
			common.ApiError(c, err)
			return
		}
		createdKeys = append(createdKeys, redemption.Key)
	}

	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRedemption,
		OperationType: model.CodeOperationCreate,
		BatchNo:       payload.BatchNo,
		TargetSummary: "创建兑换码",
		TotalCount:    payload.Count,
		SuccessCount:  len(createdKeys),
		Notes:         payload.Name,
		ErrorDetails:  marshalLogValue(createdKeys),
	})

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    createdKeys,
	})
}

func DeleteRedemption(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	redemption, err := model.GetRedemptionById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err = model.DeleteRedemptionById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRedemption,
		OperationType: model.CodeOperationDelete,
		BatchNo:       redemption.BatchNo,
		TargetSummary: "删除兑换码",
		TotalCount:    1,
		SuccessCount:  1,
		Notes:         redemption.Name,
		ErrorDetails:  marshalLogValue([]string{redemption.Key}),
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func DeleteRedemptionBatch(c *gin.Context) {
	ids, err := parseCodeBatchPayload(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	count, err := model.BatchDeleteRedemptions(ids)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRedemption,
		OperationType: model.CodeOperationBatchDelete,
		TargetSummary: summarizeIDs(ids),
		TotalCount:    len(ids),
		SuccessCount:  int(count),
		FailedCount:   len(ids) - int(count),
	})
	common.ApiSuccess(c, count)
}

func UpdateRedemptionBatchStatus(c *gin.Context) {
	ids, status, err := parseCodeBatchStatusPayload(
		c,
		common.RedemptionCodeStatusEnabled,
		common.RedemptionCodeStatusDisabled,
	)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	count, err := model.BatchUpdateRedemptionStatus(ids, status)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRedemption,
		OperationType: model.CodeOperationBatchStatus,
		TargetSummary: summarizeIDs(ids),
		TotalCount:    len(ids),
		SuccessCount:  int(count),
		FailedCount:   len(ids) - int(count),
		Notes:         "status=" + strconv.Itoa(status),
	})
	common.ApiSuccess(c, count)
}

func UpdateRedemption(c *gin.Context) {
	statusOnly := c.Query("status_only") != ""
	payload := &model.Redemption{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		common.ApiError(c, err)
		return
	}
	if payload.Id == 0 {
		common.ApiErrorMsg(c, "兑换码 ID 不能为空")
		return
	}
	redemption, err := model.GetRedemptionById(payload.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if statusOnly {
		if payload.Status != common.RedemptionCodeStatusEnabled && payload.Status != common.RedemptionCodeStatusDisabled {
			common.ApiErrorMsg(c, "兑换码状态无效")
			return
		}
		redemption.Status = payload.Status
	} else {
		if payload.Status == 0 {
			payload.Status = redemption.Status
		}
		payload.Count = 1
		if err := model.ValidateRedemptionAdminPayload(payload); err != nil {
			common.ApiError(c, err)
			return
		}
		redemption.Name = payload.Name
		redemption.Status = payload.Status
		redemption.Quota = payload.Quota
		redemption.BatchNo = payload.BatchNo
		redemption.CampaignName = payload.CampaignName
		redemption.Channel = payload.Channel
		redemption.SourcePlatform = payload.SourcePlatform
		redemption.ExternalOrderNo = payload.ExternalOrderNo
		redemption.Notes = payload.Notes
		redemption.ExpiredTime = payload.ExpiredTime
	}
	if err = redemption.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRedemption,
		OperationType: model.CodeOperationUpdate,
		BatchNo:       redemption.BatchNo,
		TargetSummary: "id=" + strconv.Itoa(redemption.Id),
		TotalCount:    1,
		SuccessCount:  1,
		Notes:         redemption.Name,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    redemption,
	})
}

func DeleteInvalidRedemption(c *gin.Context) {
	rows, err := model.DeleteInvalidRedemptions()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRedemption,
		OperationType: model.CodeOperationBatchDelete,
		TargetSummary: "delete_invalid_redemptions",
		TotalCount:    int(rows),
		SuccessCount:  int(rows),
		Notes:         "清理失效兑换码",
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    rows,
	})
}

func PreviewRedemptionImport(c *gin.Context) {
	payload, err := parseCodeImportPayload(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.PreviewRedemptionCSV(payload.FileName, payload.CsvContent)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRedemption,
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

func ImportRedemption(c *gin.Context) {
	payload, err := parseCodeImportPayload(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	result, err := service.ImportRedemptionCSV(c.GetInt("id"), payload.FileName, payload.CsvContent)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	recordCodeOperationLog(c, &model.CodeOperationLog{
		CodeType:      model.CodeTypeRedemption,
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
