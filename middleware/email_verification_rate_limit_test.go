package middleware

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func buildEmailVerificationTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/verification", EmailVerificationRateLimit(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
		})
	})
	return router
}

func doEmailVerificationRequest(router *gin.Engine, email string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/api/verification?email="+url.QueryEscape(email), nil)
	req.RemoteAddr = "198.51.100.10:23456"
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func prepareEmailVerificationRateLimitTest(t *testing.T) {
	t.Helper()
	origRedisEnabled := common.RedisEnabled
	t.Cleanup(func() {
		common.RedisEnabled = origRedisEnabled
	})
	common.RedisEnabled = false
}

func TestEmailVerificationRateLimitByIP(t *testing.T) {
	prepareEmailVerificationRateLimitTest(t)

	origIPEnable := common.EmailVerificationIPRateLimitEnable
	origIPNum := common.EmailVerificationIPRateLimitNum
	origIPDuration := common.EmailVerificationIPRateLimitDuration
	origCooldown := common.EmailVerificationEmailCooldownSeconds
	origDailyEnable := common.EmailVerificationDailyLimitEnable
	origDailyLimit := common.EmailVerificationDailyLimit
	t.Cleanup(func() {
		common.EmailVerificationIPRateLimitEnable = origIPEnable
		common.EmailVerificationIPRateLimitNum = origIPNum
		common.EmailVerificationIPRateLimitDuration = origIPDuration
		common.EmailVerificationEmailCooldownSeconds = origCooldown
		common.EmailVerificationDailyLimitEnable = origDailyEnable
		common.EmailVerificationDailyLimit = origDailyLimit
	})

	common.EmailVerificationIPRateLimitEnable = true
	common.EmailVerificationIPRateLimitNum = 1
	common.EmailVerificationIPRateLimitDuration = 120
	common.EmailVerificationEmailCooldownSeconds = 0
	common.EmailVerificationDailyLimitEnable = false
	common.EmailVerificationDailyLimit = 0

	router := buildEmailVerificationTestRouter()
	first := doEmailVerificationRequest(router, "first@example.com")
	if first.Code != http.StatusOK {
		t.Fatalf("first request expected 200, got %d body=%s", first.Code, first.Body.String())
	}

	second := doEmailVerificationRequest(router, "second@example.com")
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("second request expected 429, got %d body=%s", second.Code, second.Body.String())
	}
	if !strings.Contains(second.Body.String(), "发送过于频繁") {
		t.Fatalf("expected IP rate limit message, got %s", second.Body.String())
	}
}

func TestEmailVerificationRateLimitByEmailCooldown(t *testing.T) {
	prepareEmailVerificationRateLimitTest(t)

	origIPEnable := common.EmailVerificationIPRateLimitEnable
	origIPNum := common.EmailVerificationIPRateLimitNum
	origIPDuration := common.EmailVerificationIPRateLimitDuration
	origCooldown := common.EmailVerificationEmailCooldownSeconds
	origDailyEnable := common.EmailVerificationDailyLimitEnable
	origDailyLimit := common.EmailVerificationDailyLimit
	t.Cleanup(func() {
		common.EmailVerificationIPRateLimitEnable = origIPEnable
		common.EmailVerificationIPRateLimitNum = origIPNum
		common.EmailVerificationIPRateLimitDuration = origIPDuration
		common.EmailVerificationEmailCooldownSeconds = origCooldown
		common.EmailVerificationDailyLimitEnable = origDailyEnable
		common.EmailVerificationDailyLimit = origDailyLimit
	})

	common.EmailVerificationIPRateLimitEnable = false
	common.EmailVerificationIPRateLimitNum = 0
	common.EmailVerificationIPRateLimitDuration = 0
	common.EmailVerificationEmailCooldownSeconds = 120
	common.EmailVerificationDailyLimitEnable = false
	common.EmailVerificationDailyLimit = 0

	router := buildEmailVerificationTestRouter()
	first := doEmailVerificationRequest(router, "cooldown@example.com")
	if first.Code != http.StatusOK {
		t.Fatalf("first request expected 200, got %d body=%s", first.Code, first.Body.String())
	}

	second := doEmailVerificationRequest(router, "cooldown@example.com")
	if second.Code != http.StatusTooManyRequests {
		t.Fatalf("second request expected 429, got %d body=%s", second.Code, second.Body.String())
	}
	if !strings.Contains(second.Body.String(), "该邮箱请求过于频繁") {
		t.Fatalf("expected email cooldown message, got %s", second.Body.String())
	}

	third := doEmailVerificationRequest(router, "another@example.com")
	if third.Code != http.StatusOK {
		t.Fatalf("third request with another email expected 200, got %d body=%s", third.Code, third.Body.String())
	}
}

func TestEmailVerificationRateLimitByDailyBudget(t *testing.T) {
	prepareEmailVerificationRateLimitTest(t)

	origIPEnable := common.EmailVerificationIPRateLimitEnable
	origIPNum := common.EmailVerificationIPRateLimitNum
	origIPDuration := common.EmailVerificationIPRateLimitDuration
	origCooldown := common.EmailVerificationEmailCooldownSeconds
	origDailyEnable := common.EmailVerificationDailyLimitEnable
	origDailyLimit := common.EmailVerificationDailyLimit
	origNowFunc := nowFunc
	t.Cleanup(func() {
		common.EmailVerificationIPRateLimitEnable = origIPEnable
		common.EmailVerificationIPRateLimitNum = origIPNum
		common.EmailVerificationIPRateLimitDuration = origIPDuration
		common.EmailVerificationEmailCooldownSeconds = origCooldown
		common.EmailVerificationDailyLimitEnable = origDailyEnable
		common.EmailVerificationDailyLimit = origDailyLimit
		nowFunc = origNowFunc
	})

	common.EmailVerificationIPRateLimitEnable = false
	common.EmailVerificationIPRateLimitNum = 0
	common.EmailVerificationIPRateLimitDuration = 0
	common.EmailVerificationEmailCooldownSeconds = 0
	common.EmailVerificationDailyLimitEnable = true
	common.EmailVerificationDailyLimit = 2
	nowFunc = func() time.Time {
		return time.Date(2026, 5, 6, 12, 0, 0, 0, time.Local)
	}

	router := buildEmailVerificationTestRouter()
	first := doEmailVerificationRequest(router, "daily1@example.com")
	if first.Code != http.StatusOK {
		t.Fatalf("first request expected 200, got %d body=%s", first.Code, first.Body.String())
	}
	second := doEmailVerificationRequest(router, "daily2@example.com")
	if second.Code != http.StatusOK {
		t.Fatalf("second request expected 200, got %d body=%s", second.Code, second.Body.String())
	}

	third := doEmailVerificationRequest(router, "daily3@example.com")
	if third.Code != http.StatusTooManyRequests {
		t.Fatalf("third request expected 429, got %d body=%s", third.Code, third.Body.String())
	}
	if !strings.Contains(third.Body.String(), "今日验证码发送额度已达上限") {
		t.Fatalf("expected daily budget limit message, got %s", third.Body.String())
	}

	nowFunc = func() time.Time {
		return time.Date(2026, 5, 7, 12, 0, 0, 0, time.Local)
	}
	fourth := doEmailVerificationRequest(router, "daily4@example.com")
	if fourth.Code != http.StatusOK {
		t.Fatalf("new day request expected 200, got %d body=%s", fourth.Code, fourth.Body.String())
	}
}
