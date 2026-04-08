package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

type registrationCodeValidatePayload struct {
	Code             string `json:"code"`
	RegistrationCode string `json:"registration_code"`
}

func buildRegistrationCodeQuery(c *gin.Context, keyword string) (model.RegistrationCodeQuery, error) {
	filters := model.RegistrationCodeQuery{
		Keyword:      strings.TrimSpace(keyword),
		ProductKey:   strings.TrimSpace(c.Query("product_key")),
		Availability: strings.TrimSpace(c.Query("availability")),
	}
	if rawStatus := strings.TrimSpace(c.Query("status")); rawStatus != "" {
		status, err := strconv.Atoi(rawStatus)
		if err != nil {
			return filters, errors.New("注册码状态无效")
		}
		filters.Status = status
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

	if err := validateRegistrationCodePayload(payload, false); err != nil {
		common.ApiError(c, err)
		return
	}

	count := payload.Count
	if count <= 0 {
		count = 1
	}
	if count > 100 {
		common.ApiErrorMsg(c, "一次最多创建 100 个注册码")
		return
	}
	if count > 1 && strings.TrimSpace(payload.Code) != "" {
		common.ApiErrorMsg(c, "批量创建时不能指定固定注册码")
		return
	}

	now := common.GetTimestamp()
	createdCodes := make([]string, 0, count)
	for i := 0; i < count; i++ {
		codeValue := strings.TrimSpace(payload.Code)
		if codeValue == "" || count > 1 {
			codeValue = strings.ToUpper(common.GetUUID())
		}
		maxUses := payload.MaxUses
		if maxUses == 0 {
			maxUses = 1
		}
		code := &model.RegistrationCode{
			Code:       codeValue,
			Name:       strings.TrimSpace(payload.Name),
			Status:     common.RegistrationCodeStatusEnabled,
			ProductKey: strings.TrimSpace(payload.ProductKey),
			ExpiresAt:  payload.ExpiresAt,
			MaxUses:    maxUses,
			CreatedBy:  c.GetInt("id"),
			Notes:      strings.TrimSpace(payload.Notes),
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if code.ProductKey == "" {
			code.ProductKey = common.ProductKeyNovel
		}
		if err := code.Insert(); err != nil {
			common.ApiError(c, err)
			return
		}
		createdCodes = append(createdCodes, code.Code)
	}

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
		if err := validateRegistrationCodePayload(payload, true); err != nil {
			common.ApiError(c, err)
			return
		}
		if payload.Status == 0 {
			payload.Status = code.Status
		}
		code.Name = strings.TrimSpace(payload.Name)
		code.Status = payload.Status
		code.ProductKey = strings.TrimSpace(payload.ProductKey)
		if code.ProductKey == "" {
			code.ProductKey = common.ProductKeyNovel
		}
		code.ExpiresAt = payload.ExpiresAt
		code.MaxUses = payload.MaxUses
		code.Notes = strings.TrimSpace(payload.Notes)
		if err := code.ValidateUpdateConstraints(); err != nil {
			common.ApiError(c, err)
			return
		}
	}

	if err := code.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, code)
}

func DeleteRegistrationCode(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteRegistrationCodeById(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
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

func validateRegistrationCodePayload(payload *model.RegistrationCode, isEdit bool) error {
	payload.Name = strings.TrimSpace(payload.Name)
	payload.ProductKey = strings.TrimSpace(payload.ProductKey)
	if payload.ProductKey == "" {
		payload.ProductKey = common.ProductKeyNovel
	}
	if !isEdit && payload.Status == 0 {
		payload.Status = common.RegistrationCodeStatusEnabled
	}
	if utf8.RuneCountInString(payload.Name) == 0 || utf8.RuneCountInString(payload.Name) > 64 {
		return errors.New("注册码名称长度需在 1 到 64 个字符之间")
	}
	if code := strings.TrimSpace(payload.Code); code != "" && utf8.RuneCountInString(code) > 64 {
		return errors.New("注册码长度不能超过 64 个字符")
	}
	if payload.ExpiresAt != 0 && payload.ExpiresAt < common.GetTimestamp() {
		return errors.New("过期时间不能早于当前时间")
	}
	if payload.MaxUses < 0 {
		return errors.New("最大使用次数不能小于 0")
	}
	if isEdit && payload.Status != 0 && payload.Status != common.RegistrationCodeStatusEnabled && payload.Status != common.RegistrationCodeStatusDisabled {
		return errors.New("注册码状态无效")
	}
	if payload.MaxUses > 0 && payload.UsedCount > payload.MaxUses {
		return errors.New("最大使用次数不能小于已使用次数")
	}
	return nil
}
