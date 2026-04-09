package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

type redeemCodeRequest struct {
	Code string `json:"code"`
	Key  string `json:"key"`
}

func RedeemCode(c *gin.Context) {
	req := &redeemCodeRequest{}
	if err := common.DecodeJson(c.Request.Body, req); err != nil {
		common.ApiError(c, err)
		return
	}
	code := req.Code
	if code == "" {
		code = req.Key
	}
	result, err := service.RedeemUnifiedCode(c.GetInt("id"), code, c.ClientIP())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}
