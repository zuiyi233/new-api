package common

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
)

const (
	DefaultSMTPMonthlyLimit                  = 3000
	DefaultSMTPProviderWeight                = 1
	DefaultSMTPProviderFailureCooldownSecond = 60
)

type SMTPProvider struct {
	Name           string `json:"name"`
	Server         string `json:"server"`
	Port           int    `json:"port"`
	SSLEnabled     bool   `json:"ssl_enabled"`
	ForceAuthLogin bool   `json:"force_auth_login"`
	Account        string `json:"account"`
	From           string `json:"from"`
	Token          string `json:"token"`
	MonthlyLimit   int    `json:"monthly_limit"`
	Weight         int    `json:"weight"`
	CooldownSecond int    `json:"cooldown_second"`
}

type SMTPProviderUsageStats map[string]int

var SMTPProviders []SMTPProvider
var SMTPProvidersRWMutex sync.RWMutex
var SMTPMonthlyLimit = DefaultSMTPMonthlyLimit
var SMTPProviderUsageStatsOptionKey = "SMTPProviderUsageStats"

func sanitizeSMTPProvider(provider SMTPProvider) SMTPProvider {
	sanitized := provider
	sanitized.Token = ""
	return sanitized
}

func sanitizeSMTPProviders(providers []SMTPProvider) []SMTPProvider {
	if len(providers) == 0 {
		return nil
	}
	sanitized := make([]SMTPProvider, len(providers))
	for i := range providers {
		sanitized[i] = sanitizeSMTPProvider(providers[i])
	}
	return sanitized
}

func SanitizeSMTPProvidersForStorage(providers []SMTPProvider) []SMTPProvider {
	return sanitizeSMTPProviders(providers)
}

func SanitizeSMTPProvidersForDisplay(providers []SMTPProvider) []SMTPProvider {
	return sanitizeSMTPProviders(providers)
}

func normalizeProviderIdentity(provider SMTPProvider) string {
	server := strings.ToLower(strings.TrimSpace(provider.Server))
	account := strings.ToLower(strings.TrimSpace(provider.Account))
	from := strings.ToLower(strings.TrimSpace(provider.From))
	port := provider.Port
	return fmt.Sprintf("%s|%d|%s|%s", server, port, account, from)
}

func normalizeUsageStatsFromRaw(raw map[string]int) SMTPProviderUsageStats {
	if len(raw) == 0 {
		return SMTPProviderUsageStats{}
	}
	stats := make(SMTPProviderUsageStats, len(raw))
	for key, value := range raw {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" || value < 0 {
			continue
		}
		stats[trimmedKey] = value
	}
	return stats
}

func ParseSMTPProviderUsageStatsFromJSONString(raw string) (SMTPProviderUsageStats, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return SMTPProviderUsageStats{}, nil
	}
	var parsed map[string]int
	if err := UnmarshalJsonStr(raw, &parsed); err != nil {
		return nil, err
	}
	return normalizeUsageStatsFromRaw(parsed), nil
}

func EncodeSMTPProviderUsageStats(stats SMTPProviderUsageStats) string {
	if len(stats) == 0 {
		return "{}"
	}
	keys := make([]string, 0, len(stats))
	for key := range stats {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var builder strings.Builder
	builder.WriteString("{")
	for i, key := range keys {
		if i > 0 {
			builder.WriteString(",")
		}
		quotedKey, _ := Marshal(key)
		builder.Write(quotedKey)
		builder.WriteString(":")
		builder.WriteString(strconv.Itoa(stats[key]))
	}
	builder.WriteString("}")
	return builder.String()
}

func normalizeSMTPMonthlyLimit(limit int) int {
	if limit <= 0 {
		return DefaultSMTPMonthlyLimit
	}
	return limit
}

func normalizeSMTPProviderWeight(weight int) int {
	if weight <= 0 {
		return DefaultSMTPProviderWeight
	}
	return weight
}

func normalizeSMTPProviderCooldownSecond(seconds int) int {
	if seconds <= 0 {
		return DefaultSMTPProviderFailureCooldownSecond
	}
	return seconds
}

func normalizeSMTPProvider(provider SMTPProvider) (SMTPProvider, error) {
	provider.Name = strings.TrimSpace(provider.Name)
	provider.Server = strings.TrimSpace(provider.Server)
	provider.Account = strings.TrimSpace(provider.Account)
	provider.From = strings.TrimSpace(provider.From)
	provider.Token = strings.TrimSpace(provider.Token)

	if provider.Server == "" {
		return SMTPProvider{}, fmt.Errorf("SMTP server is required")
	}
	if provider.Account == "" {
		return SMTPProvider{}, fmt.Errorf("SMTP account is required")
	}
	if provider.Port <= 0 {
		provider.Port = 587
	}
	if provider.MonthlyLimit < 0 {
		return SMTPProvider{}, fmt.Errorf("SMTP monthly_limit cannot be negative")
	}
	if provider.Weight < 0 {
		return SMTPProvider{}, fmt.Errorf("SMTP weight cannot be negative")
	}
	if provider.CooldownSecond < 0 {
		return SMTPProvider{}, fmt.Errorf("SMTP cooldown_second cannot be negative")
	}
	provider.Weight = normalizeSMTPProviderWeight(provider.Weight)
	provider.CooldownSecond = normalizeSMTPProviderCooldownSecond(provider.CooldownSecond)
	if provider.From == "" {
		provider.From = provider.Account
	}
	return provider, nil
}

func ParseSMTPProvidersFromJSONString(raw string) ([]SMTPProvider, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, nil
	}

	var providers []SMTPProvider
	if err := UnmarshalJsonStr(raw, &providers); err != nil {
		return nil, err
	}

	if len(providers) == 0 {
		return nil, nil
	}

	normalized := make([]SMTPProvider, 0, len(providers))
	for i := range providers {
		provider, err := normalizeSMTPProvider(providers[i])
		if err != nil {
			return nil, fmt.Errorf("invalid SMTP provider at index %d: %w", i, err)
		}
		normalized = append(normalized, provider)
	}
	return normalized, nil
}

func SetSMTPProviders(providers []SMTPProvider) {
	if len(providers) == 0 {
		SMTPProvidersRWMutex.Lock()
		SMTPProviders = nil
		SMTPProvidersRWMutex.Unlock()
		return
	}
	next := make([]SMTPProvider, len(providers))
	copy(next, providers)
	SMTPProvidersRWMutex.Lock()
	SMTPProviders = next
	SMTPProvidersRWMutex.Unlock()
}

func GetSMTPProvidersSnapshot() []SMTPProvider {
	SMTPProvidersRWMutex.RLock()
	defer SMTPProvidersRWMutex.RUnlock()
	if len(SMTPProviders) == 0 {
		return nil
	}
	copyProviders := make([]SMTPProvider, len(SMTPProviders))
	copy(copyProviders, SMTPProviders)
	return copyProviders
}

func UpdateSMTPProvidersFromJSONString(raw string) error {
	providers, err := ParseSMTPProvidersFromJSONString(raw)
	if err != nil {
		return err
	}
	SetSMTPProviders(providers)
	return nil
}

func UpdateSMTPMonthlyLimit(limit int) {
	SMTPMonthlyLimit = normalizeSMTPMonthlyLimit(limit)
}

func ResolveSMTPProvidersForUpdate(newProviders []SMTPProvider, currentProviders []SMTPProvider) []SMTPProvider {
	if len(newProviders) == 0 {
		return nil
	}

	currentByIdentity := make(map[string]SMTPProvider, len(currentProviders))
	for i := range currentProviders {
		current := normalizeSMTPProviderForSending(currentProviders[i])
		currentByIdentity[normalizeProviderIdentity(current)] = current
	}

	resolved := make([]SMTPProvider, 0, len(newProviders))
	for i := range newProviders {
		next := normalizeSMTPProviderForSending(newProviders[i])
		if strings.TrimSpace(next.Token) == "" {
			identity := normalizeProviderIdentity(next)
			if existing, ok := currentByIdentity[identity]; ok && strings.TrimSpace(existing.Token) != "" {
				next.Token = existing.Token
			}
		}
		resolved = append(resolved, next)
	}
	return resolved
}
