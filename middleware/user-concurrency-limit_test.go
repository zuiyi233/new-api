package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

func requireEventually(t *testing.T, timeout, interval time.Duration, fn func() (bool, error), failureMessage string) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		ok, err := fn()
		if err != nil {
			lastErr = err
		}
		if ok {
			return
		}
		time.Sleep(interval)
	}
	if lastErr != nil {
		t.Fatalf("%s (last err: %v)", failureMessage, lastErr)
	}
	t.Fatalf("%s", failureMessage)
}

func TestCalculateHeartbeatInterval(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		ttlMs int64
	}{
		{name: "tiny ttl", ttlMs: 80},
		{name: "small ttl", ttlMs: 300},
		{name: "normal ttl", ttlMs: 3000},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			interval := calculateHeartbeatInterval(tc.ttlMs)
			if interval <= 0 {
				t.Fatalf("interval must be positive, got %v", interval)
			}
			if tc.ttlMs > 1 && interval >= time.Duration(tc.ttlMs)*time.Millisecond {
				t.Fatalf("interval must be less than ttl, got interval=%v ttl=%dms", interval, tc.ttlMs)
			}
		})
	}
}

func TestStartConcurrencyHeartbeatRenewsInMemorySlot(t *testing.T) {
	origRedisEnabled := common.RedisEnabled
	origLimiter := memoryConcurrencyLimiter
	t.Cleanup(func() {
		common.RedisEnabled = origRedisEnabled
		memoryConcurrencyLimiter = origLimiter
	})

	common.RedisEnabled = false
	memoryConcurrencyLimiter = newInMemoryConcurrencyLimiter()

	const (
		userID       = 123
		limit        = 1
		ttlMs  int64 = 150
	)

	requestID := "req-1"
	acquired, _, err := acquireConcurrencySlot(context.Background(), userID, requestID, limit, ttlMs)
	if err != nil {
		t.Fatalf("acquire first slot failed: %v", err)
	}
	if !acquired {
		t.Fatalf("first acquire should succeed")
	}

	stop := make(chan struct{})
	go startConcurrencyHeartbeat(context.Background(), stop, userID, requestID, ttlMs)

	startAt := time.Now()
	requireEventually(
		t,
		2*time.Second,
		25*time.Millisecond,
		func() (bool, error) {
			if time.Since(startAt) < 2*time.Duration(ttlMs)*time.Millisecond {
				return false, nil
			}
			acquired2, _, acquireErr := acquireConcurrencySlot(
				context.Background(),
				userID,
				"req-2",
				limit,
				ttlMs,
			)
			if acquireErr != nil {
				return false, acquireErr
			}
			return !acquired2, nil
		},
		"second acquire should be blocked when heartbeat keeps first slot alive",
	)

	close(stop)

	requireEventually(
		t,
		2*time.Second,
		25*time.Millisecond,
		func() (bool, error) {
			acquired3, _, acquireErr := acquireConcurrencySlot(
				context.Background(),
				userID,
				"req-3",
				limit,
				ttlMs,
			)
			if acquireErr != nil {
				return false, acquireErr
			}
			return acquired3, nil
		},
		"third acquire should succeed after heartbeat stops and ttl expires",
	)
}

func buildConcurrencyTestRouter(enterFirstTwo chan<- struct{}, releaseSignal <-chan struct{}) *gin.Engine {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("id", 9527)
		c.Set(common.RequestIdKey, c.GetHeader("X-Test-Req-Id"))
		c.Next()
	})
	router.Use(UserConcurrencyLimit())
	router.GET("/relay", func(c *gin.Context) {
		if enterFirstTwo != nil {
			select {
			case enterFirstTwo <- struct{}{}:
			default:
			}
		}
		if releaseSignal != nil {
			select {
			case <-releaseSignal:
			case <-c.Request.Context().Done():
			}
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return router
}

func doConcurrencyTestRequest(router *gin.Engine, requestID string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/relay", nil)
	req.Header.Set("X-Test-Req-Id", requestID)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestUserConcurrencyLimitQueueThenSuccess(t *testing.T) {
	origRedisEnabled := common.RedisEnabled
	origLimiter := memoryConcurrencyLimiter
	origEnabled := setting.RelayConcurrencyEnabled
	origGlobalDefault := setting.GlobalDefaultConcurrency
	origTTL := setting.ConcurrencyCounterTtlSeconds
	origQueueWaitMs := setting.ConcurrencyQueueWaitMs
	origSnapshotGetter := getUserConcurrencySnapshot
	t.Cleanup(func() {
		common.RedisEnabled = origRedisEnabled
		memoryConcurrencyLimiter = origLimiter
		setting.RelayConcurrencyEnabled = origEnabled
		setting.GlobalDefaultConcurrency = origGlobalDefault
		setting.ConcurrencyCounterTtlSeconds = origTTL
		setting.ConcurrencyQueueWaitMs = origQueueWaitMs
		getUserConcurrencySnapshot = origSnapshotGetter
	})

	common.RedisEnabled = false
	memoryConcurrencyLimiter = newInMemoryConcurrencyLimiter()
	setting.RelayConcurrencyEnabled = true
	setting.GlobalDefaultConcurrency = 2
	setting.ConcurrencyCounterTtlSeconds = 5
	setting.ConcurrencyQueueWaitMs = 1200
	getUserConcurrencySnapshot = func(userId int) (*service.UserConcurrencySnapshot, error) {
		return &service.UserConcurrencySnapshot{
			UserId:         userId,
			GlobalDefault:  2,
			EffectiveLimit: 2,
		}, nil
	}

	firstTwoEntered := make(chan struct{}, 2)
	releaseSignal := make(chan struct{})
	router := buildConcurrencyTestRouter(firstTwoEntered, releaseSignal)

	var wg sync.WaitGroup
	wg.Add(2)
	for i := 0; i < 2; i++ {
		idx := i
		go func() {
			defer wg.Done()
			rec := doConcurrencyTestRequest(router, "hold-"+strconv.Itoa(idx+1))
			if rec.Code != http.StatusOK {
				t.Errorf("holder request %d expected 200, got %d body=%s", idx+1, rec.Code, rec.Body.String())
			}
		}()
	}

	for i := 0; i < 2; i++ {
		select {
		case <-firstTwoEntered:
		case <-time.After(2 * time.Second):
			t.Fatalf("timeout waiting first two requests to acquire slots")
		}
	}

	thirdDone := make(chan *httptest.ResponseRecorder, 1)
	thirdStart := time.Now()
	go func() {
		thirdDone <- doConcurrencyTestRequest(router, "queued-3")
	}()

	time.Sleep(220 * time.Millisecond)
	close(releaseSignal)
	wg.Wait()

	select {
	case thirdRec := <-thirdDone:
		if thirdRec.Code != http.StatusOK {
			t.Fatalf("queued request expected 200, got %d body=%s", thirdRec.Code, thirdRec.Body.String())
		}
		if waited := time.Since(thirdStart); waited < 180*time.Millisecond {
			t.Fatalf("expected queued request to wait, got %v", waited)
		}
	case <-time.After(2 * time.Second):
		t.Fatalf("queued request did not finish in time")
	}
}

func TestUserConcurrencyLimitQueueThen429(t *testing.T) {
	origRedisEnabled := common.RedisEnabled
	origLimiter := memoryConcurrencyLimiter
	origEnabled := setting.RelayConcurrencyEnabled
	origGlobalDefault := setting.GlobalDefaultConcurrency
	origTTL := setting.ConcurrencyCounterTtlSeconds
	origQueueWaitMs := setting.ConcurrencyQueueWaitMs
	origSnapshotGetter := getUserConcurrencySnapshot
	t.Cleanup(func() {
		common.RedisEnabled = origRedisEnabled
		memoryConcurrencyLimiter = origLimiter
		setting.RelayConcurrencyEnabled = origEnabled
		setting.GlobalDefaultConcurrency = origGlobalDefault
		setting.ConcurrencyCounterTtlSeconds = origTTL
		setting.ConcurrencyQueueWaitMs = origQueueWaitMs
		getUserConcurrencySnapshot = origSnapshotGetter
	})

	common.RedisEnabled = false
	memoryConcurrencyLimiter = newInMemoryConcurrencyLimiter()
	setting.RelayConcurrencyEnabled = true
	setting.GlobalDefaultConcurrency = 2
	setting.ConcurrencyCounterTtlSeconds = 5
	setting.ConcurrencyQueueWaitMs = 300
	getUserConcurrencySnapshot = func(userId int) (*service.UserConcurrencySnapshot, error) {
		return &service.UserConcurrencySnapshot{
			UserId:         userId,
			GlobalDefault:  2,
			EffectiveLimit: 2,
		}, nil
	}

	firstTwoEntered := make(chan struct{}, 2)
	releaseSignal := make(chan struct{})
	router := buildConcurrencyTestRouter(firstTwoEntered, releaseSignal)

	var wg sync.WaitGroup
	wg.Add(2)
	for i := 0; i < 2; i++ {
		idx := i
		go func() {
			defer wg.Done()
			rec := doConcurrencyTestRequest(router, "hold429-"+strconv.Itoa(idx+1))
			if rec.Code != http.StatusOK {
				t.Errorf("holder request %d expected 200, got %d body=%s", idx+1, rec.Code, rec.Body.String())
			}
		}()
	}
	for i := 0; i < 2; i++ {
		select {
		case <-firstTwoEntered:
		case <-time.After(2 * time.Second):
			t.Fatalf("timeout waiting first two requests to acquire slots")
		}
	}

	startAt := time.Now()
	thirdRec := doConcurrencyTestRequest(router, "queued429-3")
	if thirdRec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429, got %d body=%s", thirdRec.Code, thirdRec.Body.String())
	}
	if elapsed := time.Since(startAt); elapsed < 250*time.Millisecond {
		t.Fatalf("expected queued wait before 429, got %v", elapsed)
	}
	if !strings.Contains(thirdRec.Body.String(), "达到并发上限") {
		t.Fatalf("expected response body contains 达到并发上限, got %s", thirdRec.Body.String())
	}

	close(releaseSignal)
	wg.Wait()
}
