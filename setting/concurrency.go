package setting

import (
	"fmt"
	"math"
	"strconv"
	"strings"
)

const (
	ConcurrencyCodeOverridePolicyMax    = "max"
	ConcurrencyCodeOverridePolicyLatest = "latest"
)

var (
	RelayConcurrencyEnabled       = false
	GlobalDefaultConcurrency      = 3
	ConcurrencyCodeOverridePolicy = ConcurrencyCodeOverridePolicyMax
	ConcurrencyCounterTtlSeconds  = 600
)

func NormalizeConcurrencyCodeOverridePolicy(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case ConcurrencyCodeOverridePolicyLatest:
		return ConcurrencyCodeOverridePolicyLatest
	default:
		return ConcurrencyCodeOverridePolicyMax
	}
}

func ValidateGlobalDefaultConcurrency(raw string) error {
	value, err := parsePositiveInt(raw)
	if err != nil {
		return fmt.Errorf("全局默认并发必须是正整数")
	}
	if value > math.MaxInt32 {
		return fmt.Errorf("全局默认并发不能超过 2147483647")
	}
	return nil
}

func ValidateConcurrencyCounterTtlSeconds(raw string) error {
	value, err := parsePositiveInt(raw)
	if err != nil {
		return fmt.Errorf("并发计数 TTL 必须是正整数秒")
	}
	if value > 24*60*60 {
		return fmt.Errorf("并发计数 TTL 不能超过 86400 秒")
	}
	return nil
}

func ValidateConcurrencyCodeOverridePolicy(raw string) error {
	policy := NormalizeConcurrencyCodeOverridePolicy(raw)
	if policy != strings.ToLower(strings.TrimSpace(raw)) {
		return fmt.Errorf("并发覆盖策略仅支持 max 或 latest")
	}
	return nil
}

func parsePositiveInt(raw string) (int, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, fmt.Errorf("empty")
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, err
	}
	if value <= 0 {
		return 0, fmt.Errorf("must be positive")
	}
	return value, nil
}
