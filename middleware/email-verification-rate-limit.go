package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

const (
	EmailVerificationRateLimitMark = "EV"
)

type emailVerificationLimitResult struct {
	blocked bool
	message string
}

var nowFunc = time.Now

func normalizeEmailFromQuery(c *gin.Context) string {
	return strings.ToLower(strings.TrimSpace(c.Query("email")))
}

func limitByIPRedis(c *gin.Context) emailVerificationLimitResult {
	if !common.EmailVerificationIPRateLimitEnable || common.EmailVerificationIPRateLimitNum <= 0 || common.EmailVerificationIPRateLimitDuration <= 0 {
		return emailVerificationLimitResult{}
	}

	ctx := context.Background()
	rdb := common.RDB
	key := "emailVerification:" + EmailVerificationRateLimitMark + ":" + c.ClientIP()

	count, err := rdb.Incr(ctx, key).Result()
	if err != nil {
		return emailVerificationLimitResult{
			blocked: true,
			message: "系统繁忙，请稍后再试",
		}
	}

	// 第一次设置键时设置过期时间
	if count == 1 {
		_ = rdb.Expire(ctx, key, time.Duration(common.EmailVerificationIPRateLimitDuration)*time.Second).Err()
	}

	// 检查是否超出限制
	if count <= int64(common.EmailVerificationIPRateLimitNum) {
		return emailVerificationLimitResult{}
	}

	// 获取剩余等待时间
	ttl, err := rdb.TTL(ctx, key).Result()
	waitSeconds := common.EmailVerificationIPRateLimitDuration
	if err == nil && ttl > 0 {
		waitSeconds = int64(ttl.Seconds())
	}

	return emailVerificationLimitResult{
		blocked: true,
		message: fmt.Sprintf("发送过于频繁，请等待 %d 秒后再试", waitSeconds),
	}
}

func limitByIPMemory(c *gin.Context) emailVerificationLimitResult {
	if !common.EmailVerificationIPRateLimitEnable || common.EmailVerificationIPRateLimitNum <= 0 || common.EmailVerificationIPRateLimitDuration <= 0 {
		return emailVerificationLimitResult{}
	}

	key := EmailVerificationRateLimitMark + ":" + c.ClientIP()

	if !inMemoryRateLimiter.Request(key, common.EmailVerificationIPRateLimitNum, common.EmailVerificationIPRateLimitDuration) {
		return emailVerificationLimitResult{
			blocked: true,
			message: "发送过于频繁，请稍后再试",
		}
	}
	return emailVerificationLimitResult{}
}

func normalizeRegistrationCodeFromQuery(c *gin.Context) string {
	return strings.ToUpper(strings.TrimSpace(c.Query("registration_code")))
}

func limitByRegistrationCodeRedis(registrationCode string) emailVerificationLimitResult {
	if !common.EmailVerificationRegistrationCodeRateLimitEnable ||
		common.EmailVerificationRegistrationCodeRateLimitNum <= 0 ||
		common.EmailVerificationRegistrationCodeRateLimitDuration <= 0 ||
		registrationCode == "" {
		return emailVerificationLimitResult{}
	}

	ctx := context.Background()
	rdb := common.RDB
	key := "emailVerification:registration_code:" + registrationCode

	count, err := rdb.Incr(ctx, key).Result()
	if err != nil {
		return emailVerificationLimitResult{
			blocked: true,
			message: "系统繁忙，请稍后再试",
		}
	}
	if count == 1 {
		_ = rdb.Expire(
			ctx,
			key,
			time.Duration(common.EmailVerificationRegistrationCodeRateLimitDuration)*time.Second,
		).Err()
	}
	if count <= int64(common.EmailVerificationRegistrationCodeRateLimitNum) {
		return emailVerificationLimitResult{}
	}

	ttl, err := rdb.TTL(ctx, key).Result()
	waitSeconds := common.EmailVerificationRegistrationCodeRateLimitDuration
	if err == nil && ttl > 0 {
		waitSeconds = int64(ttl.Seconds())
	}
	return emailVerificationLimitResult{
		blocked: true,
		message: fmt.Sprintf("该注册码请求过于频繁，请等待 %d 秒后再试", waitSeconds),
	}
}

func limitByRegistrationCodeMemory(registrationCode string) emailVerificationLimitResult {
	if !common.EmailVerificationRegistrationCodeRateLimitEnable ||
		common.EmailVerificationRegistrationCodeRateLimitNum <= 0 ||
		common.EmailVerificationRegistrationCodeRateLimitDuration <= 0 ||
		registrationCode == "" {
		return emailVerificationLimitResult{}
	}

	key := EmailVerificationRateLimitMark + ":registration_code:" + registrationCode
	if !inMemoryRateLimiter.Request(
		key,
		common.EmailVerificationRegistrationCodeRateLimitNum,
		common.EmailVerificationRegistrationCodeRateLimitDuration,
	) {
		return emailVerificationLimitResult{
			blocked: true,
			message: "该注册码请求过于频繁，请稍后再试",
		}
	}
	return emailVerificationLimitResult{}
}

func limitByEmailCooldownRedis(c *gin.Context, email string) emailVerificationLimitResult {
	if common.EmailVerificationEmailCooldownSeconds <= 0 || email == "" {
		return emailVerificationLimitResult{}
	}

	ctx := context.Background()
	rdb := common.RDB
	key := "emailVerification:cooldown:" + email
	ok, err := rdb.SetNX(ctx, key, "1", time.Duration(common.EmailVerificationEmailCooldownSeconds)*time.Second).Result()
	if err != nil {
		return emailVerificationLimitResult{
			blocked: true,
			message: "系统繁忙，请稍后再试",
		}
	}

	if ok {
		return emailVerificationLimitResult{}
	}

	ttl, err := rdb.TTL(ctx, key).Result()
	waitSeconds := common.EmailVerificationEmailCooldownSeconds
	if err == nil && ttl > 0 {
		waitSeconds = int64(ttl.Seconds())
	}

	return emailVerificationLimitResult{
		blocked: true,
		message: fmt.Sprintf("该邮箱请求过于频繁，请等待 %d 秒后再试", waitSeconds),
	}
}

func limitByEmailCooldownMemory(email string) emailVerificationLimitResult {
	if common.EmailVerificationEmailCooldownSeconds <= 0 || email == "" {
		return emailVerificationLimitResult{}
	}

	key := EmailVerificationRateLimitMark + ":email:" + email
	if !inMemoryRateLimiter.Request(key, 1, common.EmailVerificationEmailCooldownSeconds) {
		return emailVerificationLimitResult{
			blocked: true,
			message: fmt.Sprintf("该邮箱请求过于频繁，请等待 %d 秒后再试", common.EmailVerificationEmailCooldownSeconds),
		}
	}
	return emailVerificationLimitResult{}
}

func todayKey(now time.Time) string {
	return now.Format("20060102")
}

func limitByDailyBudgetRedis() emailVerificationLimitResult {
	if !common.EmailVerificationDailyLimitEnable || common.EmailVerificationDailyLimit <= 0 {
		return emailVerificationLimitResult{}
	}

	ctx := context.Background()
	rdb := common.RDB
	key := "emailVerification:daily:" + todayKey(nowFunc())
	count, err := rdb.Incr(ctx, key).Result()
	if err != nil {
		return emailVerificationLimitResult{
			blocked: true,
			message: "系统繁忙，请稍后再试",
		}
	}
	if count == 1 {
		_ = rdb.Expire(ctx, key, 48*time.Hour).Err()
	}
	if count > int64(common.EmailVerificationDailyLimit) {
		return emailVerificationLimitResult{
			blocked: true,
			message: "今日验证码发送额度已达上限，请明日再试",
		}
	}
	return emailVerificationLimitResult{}
}

func limitByDailyBudgetMemory() emailVerificationLimitResult {
	if !common.EmailVerificationDailyLimitEnable || common.EmailVerificationDailyLimit <= 0 {
		return emailVerificationLimitResult{}
	}

	key := EmailVerificationRateLimitMark + ":daily:" + todayKey(nowFunc())
	if !inMemoryRateLimiter.Request(key, common.EmailVerificationDailyLimit, 24*60*60) {
		return emailVerificationLimitResult{
			blocked: true,
			message: "今日验证码发送额度已达上限，请明日再试",
		}
	}
	return emailVerificationLimitResult{}
}

func applyEmailVerificationRateLimit(c *gin.Context, useRedis bool) emailVerificationLimitResult {
	email := normalizeEmailFromQuery(c)
	registrationCode := normalizeRegistrationCodeFromQuery(c)

	steps := []func() emailVerificationLimitResult{
		func() emailVerificationLimitResult {
			if useRedis {
				return limitByIPRedis(c)
			}
			return limitByIPMemory(c)
		},
		func() emailVerificationLimitResult {
			if useRedis {
				return limitByRegistrationCodeRedis(registrationCode)
			}
			return limitByRegistrationCodeMemory(registrationCode)
		},
		func() emailVerificationLimitResult {
			if useRedis {
				return limitByEmailCooldownRedis(c, email)
			}
			return limitByEmailCooldownMemory(email)
		},
		func() emailVerificationLimitResult {
			if useRedis {
				return limitByDailyBudgetRedis()
			}
			return limitByDailyBudgetMemory()
		},
	}

	for _, step := range steps {
		result := step()
		if result.blocked {
			return result
		}
	}
	return emailVerificationLimitResult{}
}

func EmailVerificationRateLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		useRedis := common.RedisEnabled && common.RDB != nil
		if !useRedis {
			// It's safe to call multi times.
			inMemoryRateLimiter.Init(common.RateLimitKeyExpirationDuration)
		}

		result := applyEmailVerificationRateLimit(c, useRedis)
		if result.blocked {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"success": false,
				"message": result.message,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
