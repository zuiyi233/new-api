package middleware

import (
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func abortWithProductAccessDenied(c *gin.Context, productKey string) {
	message := "当前账号未开通小说产品资格，请先使用有效注册码注册或联系管理员授权"
	if strings.TrimSpace(productKey) != "" && productKey != common.ProductKeyNovel {
		message = "当前账号缺少所需产品资格，请联系管理员授权后再试"
	}

	if routeTag, _ := c.Get(RouteTagKey); routeTag == "relay" {
		abortWithOpenAiMessage(c, http.StatusForbidden, message, types.ErrorCodeAccessDenied)
		return
	}

	c.JSON(http.StatusForbidden, gin.H{
		"success": false,
		"message": message,
	})
	c.Abort()
}

func RequireProductEntitlement(productKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		normalizedProductKey := strings.TrimSpace(productKey)
		if normalizedProductKey == "" {
			normalizedProductKey = common.ProductKeyNovel
		}

		if normalizedProductKey == common.ProductKeyNovel && !common.NovelProductEnabled {
			c.Next()
			return
		}

		userId := c.GetInt("id")
		if userId == 0 {
			abortWithProductAccessDenied(c, normalizedProductKey)
			return
		}

		if role := c.GetInt("role"); role >= common.RoleAdminUser {
			c.Next()
			return
		}

		if model.IsAdmin(userId) {
			c.Next()
			return
		}

		hasEntitlement, err := model.HasActiveProductEntitlement(userId, normalizedProductKey)
		if err != nil {
			if routeTag, _ := c.Get(RouteTagKey); routeTag == "relay" {
				abortWithOpenAiMessage(c, http.StatusInternalServerError, err.Error())
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": err.Error(),
			})
			c.Abort()
			return
		}
		if !hasEntitlement {
			abortWithProductAccessDenied(c, normalizedProductKey)
			return
		}

		c.Next()
	}
}
