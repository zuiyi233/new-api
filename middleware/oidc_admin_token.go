package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// OIDCAdminTokenAuth allows session admin auth first, then falls back to X-Admin-Token.
func OIDCAdminTokenAuth() func(c *gin.Context) {
	return func(c *gin.Context) {
		toInt := func(value any) (int, bool) {
			switch v := value.(type) {
			case int:
				return v, true
			case int32:
				return int(v), true
			case int64:
				return int(v), true
			case uint:
				return int(v), true
			case uint32:
				return int(v), true
			case uint64:
				return int(v), true
			case float64:
				return int(v), true
			default:
				return 0, false
			}
		}

		session := sessions.Default(c)
		if sessionID, ok := toInt(session.Get("id")); ok && sessionID > 0 {
			sessionRole, roleOK := toInt(session.Get("role"))
			sessionStatus, statusOK := toInt(session.Get("status"))
			if roleOK && statusOK {
				if sessionStatus != common.UserStatusEnabled {
					c.JSON(http.StatusForbidden, gin.H{
						"success": false,
						"message": "user is disabled",
					})
					c.Abort()
					return
				}
				if sessionRole < common.RoleAdminUser {
					c.JSON(http.StatusForbidden, gin.H{
						"success": false,
						"message": "insufficient privileges",
					})
					c.Abort()
					return
				}
				username, _ := session.Get("username").(string)
				c.Set("oidc_admin_user_id", sessionID)
				c.Set("oidc_admin_role", sessionRole)
				c.Set("oidc_admin_username", username)
				c.Next()
				return
			}
		}

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
