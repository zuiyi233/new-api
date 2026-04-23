package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// OIDCAdminTokenAuth validates X-Admin-Token and allows admin/root users to access OIDC client management APIs.
func OIDCAdminTokenAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		token := strings.TrimSpace(c.GetHeader("X-Admin-Token"))
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "missing X-Admin-Token",
			})
			c.Abort()
			return
		}

		user, err := model.ValidateAccessToken(token)
		if err != nil {
			statusCode := http.StatusUnauthorized
			message := "invalid X-Admin-Token"
			if errors.Is(err, model.ErrDatabase) {
				statusCode = http.StatusInternalServerError
				message = "database error"
			}
			c.JSON(statusCode, gin.H{
				"success": false,
				"message": message,
			})
			c.Abort()
			return
		}
		if user == nil || user.Id <= 0 {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "invalid X-Admin-Token",
			})
			c.Abort()
			return
		}
		if user.Status != common.UserStatusEnabled {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "user is disabled",
			})
			c.Abort()
			return
		}
		if user.Role < common.RoleAdminUser {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "insufficient privileges",
			})
			c.Abort()
			return
		}

		c.Set("oidc_admin_user_id", user.Id)
		c.Set("oidc_admin_role", user.Role)
		c.Set("oidc_admin_username", user.Username)
		c.Next()
	}
}
