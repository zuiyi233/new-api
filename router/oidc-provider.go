package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetOIDCProviderRouter(router *gin.Engine) {
	router.GET("/.well-known/openid-configuration", middleware.RouteTag("oidc_provider"), controller.GetOIDCDiscoveryConfiguration)
	router.GET("/.well-known/jwks.json", middleware.RouteTag("oidc_provider"), controller.GetOIDCJWKS)

	oauthRoute := router.Group("/oauth")
	oauthRoute.Use(middleware.RouteTag("oidc_provider"))
	{
		oauthRoute.GET("/authorize", middleware.CriticalRateLimit(), controller.OIDCAuthorize)
		oauthRoute.POST("/token", middleware.CriticalRateLimit(), controller.OIDCToken)
		oauthRoute.GET("/userinfo", middleware.CriticalRateLimit(), controller.OIDCUserInfo)
		oauthRoute.POST("/revoke", middleware.CriticalRateLimit(), controller.OIDCRevokeToken)
	}
}
