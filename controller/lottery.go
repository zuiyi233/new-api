package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

func GetLotteryStatus(c *gin.Context) {
	setting := operation_setting.GetNormalizedLotterySetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "lottery feature is not enabled")
		return
	}

	userId := c.GetInt("id")
	status, err := model.GetLotteryStatus(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
}

func DoLotteryPlay(c *gin.Context) {
	setting := operation_setting.GetNormalizedLotterySetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "lottery feature is not enabled")
		return
	}

	userId := c.GetInt("id")
	lotteryType := c.Param("type")
	if lotteryType == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "lottery type is required",
		})
		return
	}

	result, err := model.UserLotteryPlay(userId, lotteryType)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "lottery play successful",
		"data":    result,
	})
}

func GetLotteryHistory(c *gin.Context) {
	setting := operation_setting.GetNormalizedLotterySetting()
	if !setting.Enabled {
		common.ApiErrorMsg(c, "lottery feature is not enabled")
		return
	}

	userId := c.GetInt("id")
	lotteryType := c.Query("type")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	records, total, err := model.GetLotteryHistory(userId, lotteryType, page, pageSize)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "failed to fetch lottery history",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"records":   records,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}
