package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

var (
	redisAcquireConcurrencyScript = redis.NewScript(`
local key = KEYS[1]
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local request_id = ARGV[4]

if limit <= 0 then
  return {1, 0}
end

redis.call('ZREMRANGEBYSCORE', key, '-inf', now - ttl)
local existing = redis.call('ZSCORE', key, request_id)
if existing then
  redis.call('PEXPIRE', key, ttl)
  return {1, redis.call('ZCARD', key)}
end

local current = redis.call('ZCARD', key)
if current >= limit then
  redis.call('PEXPIRE', key, ttl)
  return {0, current}
end

redis.call('ZADD', key, now, request_id)
redis.call('PEXPIRE', key, ttl)
return {1, current + 1}
`)
	redisReleaseConcurrencyScript = redis.NewScript(`
local key = KEYS[1]
local request_id = ARGV[1]

redis.call('ZREM', key, request_id)
if redis.call('ZCARD', key) == 0 then
  redis.call('DEL', key)
end
return 1
`)
	redisHeartbeatConcurrencyScript = redis.NewScript(`
local key = KEYS[1]
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local request_id = ARGV[3]

if redis.call('ZSCORE', key, request_id) then
  redis.call('ZADD', key, now, request_id)
  redis.call('PEXPIRE', key, ttl)
  return 1
end
return 0
`)
)

type inMemoryConcurrencyLimiter struct {
	mu    sync.Mutex
	slots map[int]map[string]int64
}

func newInMemoryConcurrencyLimiter() *inMemoryConcurrencyLimiter {
	return &inMemoryConcurrencyLimiter{
		slots: make(map[int]map[string]int64),
	}
}

func (m *inMemoryConcurrencyLimiter) acquire(userID int, requestID string, limit int, ttlMs int64) (bool, int64) {
	nowMs := time.Now().UnixMilli()
	m.mu.Lock()
	defer m.mu.Unlock()

	userSlots, ok := m.slots[userID]
	if !ok {
		userSlots = make(map[string]int64)
		m.slots[userID] = userSlots
	}
	for key, expiresAt := range userSlots {
		if expiresAt <= nowMs {
			delete(userSlots, key)
		}
	}
	if _, exists := userSlots[requestID]; exists {
		userSlots[requestID] = nowMs + ttlMs
		return true, int64(len(userSlots))
	}
	if len(userSlots) >= limit {
		return false, int64(len(userSlots))
	}
	userSlots[requestID] = nowMs + ttlMs
	return true, int64(len(userSlots))
}

func (m *inMemoryConcurrencyLimiter) release(userID int, requestID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	userSlots, ok := m.slots[userID]
	if !ok {
		return
	}
	delete(userSlots, requestID)
	if len(userSlots) == 0 {
		delete(m.slots, userID)
	}
}

func (m *inMemoryConcurrencyLimiter) heartbeat(userID int, requestID string, ttlMs int64) {
	nowMs := time.Now().UnixMilli()
	m.mu.Lock()
	defer m.mu.Unlock()
	userSlots, ok := m.slots[userID]
	if !ok {
		return
	}
	if _, exists := userSlots[requestID]; !exists {
		return
	}
	userSlots[requestID] = nowMs + ttlMs
}

var memoryConcurrencyLimiter = newInMemoryConcurrencyLimiter()

func UserConcurrencyLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !setting.RelayConcurrencyEnabled {
			c.Next()
			return
		}

		userID := c.GetInt("id")
		if userID <= 0 {
			c.Next()
			return
		}

		snapshot, err := service.GetUserConcurrencySnapshot(userID)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "concurrency_limit_resolve_failed")
			return
		}
		limit := snapshot.EffectiveLimit
		if limit <= 0 {
			limit = 1
		}

		requestID := c.GetString(common.RequestIdKey)
		if requestID == "" {
			requestID = common.GetUUID()
		}

		ttlMs := int64(setting.ConcurrencyCounterTtlSeconds) * int64(time.Second/time.Millisecond)
		if ttlMs <= 0 {
			ttlMs = 600 * int64(time.Second/time.Millisecond)
		}

		acquired, inflight, err := acquireConcurrencySlot(c.Request.Context(), userID, requestID, limit, ttlMs)
		if err != nil {
			abortWithOpenAiMessage(c, http.StatusInternalServerError, "concurrency_acquire_failed")
			return
		}
		if !acquired {
			abortWithOpenAiMessage(c, http.StatusTooManyRequests, fmt.Sprintf("当前并发已达上限（%d）", limit))
			return
		}

		c.Header("X-Concurrency-Limit", strconv.Itoa(limit))
		c.Header("X-Concurrency-Inflight", strconv.FormatInt(inflight, 10))

		stopHeartbeat := make(chan struct{})
		if common.RedisEnabled {
			go startConcurrencyHeartbeat(c.Request.Context(), stopHeartbeat, userID, requestID, ttlMs)
		}
		defer close(stopHeartbeat)
		defer releaseConcurrencySlot(c.Request.Context(), userID, requestID)

		c.Next()
	}
}

func startConcurrencyHeartbeat(ctx context.Context, stop <-chan struct{}, userID int, requestID string, ttlMs int64) {
	interval := ttlMs / 3
	if interval < int64(5*time.Second/time.Millisecond) {
		interval = int64(5 * time.Second / time.Millisecond)
	}
	ticker := time.NewTicker(time.Duration(interval) * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ctx.Done():
			return
		case <-ticker.C:
			if common.RedisEnabled {
				_ = heartbeatConcurrencySlot(context.Background(), userID, requestID, ttlMs)
			} else {
				memoryConcurrencyLimiter.heartbeat(userID, requestID, ttlMs)
			}
		}
	}
}

func acquireConcurrencySlot(ctx context.Context, userID int, requestID string, limit int, ttlMs int64) (bool, int64, error) {
	if !common.RedisEnabled {
		acquired, inflight := memoryConcurrencyLimiter.acquire(userID, requestID, limit, ttlMs)
		return acquired, inflight, nil
	}
	key := fmt.Sprintf("concurrency:user:%d", userID)
	nowMs := time.Now().UnixMilli()
	raw, err := redisAcquireConcurrencyScript.Run(ctx, common.RDB, []string{key}, nowMs, ttlMs, limit, requestID).Result()
	if err != nil {
		return false, 0, err
	}
	return parseConcurrencyScriptResult(raw)
}

func releaseConcurrencySlot(ctx context.Context, userID int, requestID string) {
	if !common.RedisEnabled {
		memoryConcurrencyLimiter.release(userID, requestID)
		return
	}
	key := fmt.Sprintf("concurrency:user:%d", userID)
	_, _ = redisReleaseConcurrencyScript.Run(ctx, common.RDB, []string{key}, requestID).Result()
}

func heartbeatConcurrencySlot(ctx context.Context, userID int, requestID string, ttlMs int64) error {
	key := fmt.Sprintf("concurrency:user:%d", userID)
	nowMs := time.Now().UnixMilli()
	_, err := redisHeartbeatConcurrencyScript.Run(ctx, common.RDB, []string{key}, nowMs, ttlMs, requestID).Result()
	return err
}

func parseConcurrencyScriptResult(raw any) (bool, int64, error) {
	items, ok := raw.([]any)
	if !ok || len(items) < 2 {
		return false, 0, fmt.Errorf("invalid redis script result")
	}
	allowed, err := toInt64(items[0])
	if err != nil {
		return false, 0, err
	}
	current, err := toInt64(items[1])
	if err != nil {
		return false, 0, err
	}
	return allowed == 1, current, nil
}

func toInt64(value any) (int64, error) {
	switch v := value.(type) {
	case int64:
		return v, nil
	case int:
		return int64(v), nil
	case string:
		return strconv.ParseInt(v, 10, 64)
	default:
		return 0, fmt.Errorf("unsupported numeric type %T", value)
	}
}
