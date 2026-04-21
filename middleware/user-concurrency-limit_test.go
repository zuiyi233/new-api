package middleware

import (
	"context"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
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
