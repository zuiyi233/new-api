package common

import (
	"fmt"
	"strings"
	"testing"
)

type mockSMTPSender struct {
	calls    []string
	failures map[string]error
}

func (m *mockSMTPSender) Send(provider SMTPProvider, sender string, receiver string, mail []byte) error {
	callKey := fmt.Sprintf("%s|%s|%s", provider.Server, provider.Account, sender)
	m.calls = append(m.calls, callKey)
	if m.failures == nil {
		return nil
	}
	if err, ok := m.failures[provider.Account]; ok {
		return err
	}
	return nil
}

func buildTestProvider(server string, account string, limit int) SMTPProvider {
	return SMTPProvider{
		Server:         server,
		Port:           465,
		SSLEnabled:     true,
		ForceAuthLogin: true,
		Account:        account,
		From:           account,
		Token:          "token-" + account,
		MonthlyLimit:   limit,
		Weight:         1,
		CooldownSecond: 1,
	}
}

func TestSendEmail_RoundRobinAcrossProviders(t *testing.T) {
	resetSMTPProviderRuntimeState()
	UpdateSMTPMonthlyLimit(DefaultSMTPMonthlyLimit)
	SetSMTPProviders([]SMTPProvider{
		buildTestProvider("smtp.qq.com", "user1@qq.com", 3000),
		buildTestProvider("smtp.qq.com", "user2@qq.com", 3000),
	})
	defer func() {
		SetSMTPProviders(nil)
		SetSMTPSenderForTest(nil)
	}()

	mockSender := &mockSMTPSender{}
	SetSMTPSenderForTest(mockSender)

	if err := SendEmail("subject-a", "to@example.com", "<p>a</p>"); err != nil {
		t.Fatalf("first send failed: %v", err)
	}
	if err := SendEmail("subject-b", "to@example.com", "<p>b</p>"); err != nil {
		t.Fatalf("second send failed: %v", err)
	}
	if err := SendEmail("subject-c", "to@example.com", "<p>c</p>"); err != nil {
		t.Fatalf("third send failed: %v", err)
	}

	if len(mockSender.calls) != 3 {
		t.Fatalf("expected 3 send calls, got %d", len(mockSender.calls))
	}
	if !strings.Contains(mockSender.calls[0], "user1@qq.com") {
		t.Fatalf("first call should use provider user1, got %s", mockSender.calls[0])
	}
	if !strings.Contains(mockSender.calls[1], "user2@qq.com") {
		t.Fatalf("second call should use provider user2, got %s", mockSender.calls[1])
	}
	if !strings.Contains(mockSender.calls[2], "user1@qq.com") {
		t.Fatalf("third call should rotate back to provider user1, got %s", mockSender.calls[2])
	}
}

func TestSendEmail_FallbackToNextProviderOnFailure(t *testing.T) {
	resetSMTPProviderRuntimeState()
	UpdateSMTPMonthlyLimit(DefaultSMTPMonthlyLimit)
	SetSMTPProviders([]SMTPProvider{
		buildTestProvider("smtp.qq.com", "user1@qq.com", 3000),
		buildTestProvider("smtp.qq.com", "user2@qq.com", 3000),
	})
	defer func() {
		SetSMTPProviders(nil)
		SetSMTPSenderForTest(nil)
	}()

	mockSender := &mockSMTPSender{
		failures: map[string]error{
			"user1@qq.com": fmt.Errorf("provider1 temporary error"),
		},
	}
	SetSMTPSenderForTest(mockSender)

	err := SendEmail("subject-fallback", "to@example.com", "<p>fallback</p>")
	if err != nil {
		t.Fatalf("send with fallback should succeed, got err: %v", err)
	}
	if len(mockSender.calls) != 2 {
		t.Fatalf("expected 2 send attempts (first fail then fallback), got %d", len(mockSender.calls))
	}
	if !strings.Contains(mockSender.calls[0], "user1@qq.com") {
		t.Fatalf("first attempt should use failed provider user1, got %s", mockSender.calls[0])
	}
	if !strings.Contains(mockSender.calls[1], "user2@qq.com") {
		t.Fatalf("second attempt should fallback to user2, got %s", mockSender.calls[1])
	}
}

func TestSendEmail_MonthlyQuotaLimit(t *testing.T) {
	resetSMTPProviderRuntimeState()
	UpdateSMTPMonthlyLimit(DefaultSMTPMonthlyLimit)
	SetSMTPProviders([]SMTPProvider{
		buildTestProvider("smtp.qq.com", "user1@qq.com", 1),
		buildTestProvider("smtp.qq.com", "user2@qq.com", 1),
	})
	defer func() {
		SetSMTPProviders(nil)
		SetSMTPSenderForTest(nil)
	}()

	mockSender := &mockSMTPSender{}
	SetSMTPSenderForTest(mockSender)

	if err := SendEmail("subject-1", "to@example.com", "<p>1</p>"); err != nil {
		t.Fatalf("first send failed: %v", err)
	}
	if err := SendEmail("subject-2", "to@example.com", "<p>2</p>"); err != nil {
		t.Fatalf("second send failed: %v", err)
	}
	err := SendEmail("subject-3", "to@example.com", "<p>3</p>")
	if err == nil {
		t.Fatalf("third send should fail due to monthly quota exhaustion")
	}
	if !strings.Contains(err.Error(), "monthly quota exhausted") {
		t.Fatalf("expected quota exhaustion error, got: %v", err)
	}
}

func TestSendEmail_FallbackToLegacyWhenProvidersEmpty(t *testing.T) {
	originalServer := SMTPServer
	originalPort := SMTPPort
	originalSSL := SMTPSSLEnabled
	originalForceAuth := SMTPForceAuthLogin
	originalAccount := SMTPAccount
	originalFrom := SMTPFrom
	originalToken := SMTPToken

	resetSMTPProviderRuntimeState()
	SetSMTPProviders(nil)
	UpdateSMTPMonthlyLimit(DefaultSMTPMonthlyLimit)

	SMTPServer = "smtp.qq.com"
	SMTPPort = 465
	SMTPSSLEnabled = true
	SMTPForceAuthLogin = true
	SMTPAccount = "legacy@qq.com"
	SMTPFrom = "legacy@qq.com"
	SMTPToken = "legacy-token"

	defer func() {
		SMTPServer = originalServer
		SMTPPort = originalPort
		SMTPSSLEnabled = originalSSL
		SMTPForceAuthLogin = originalForceAuth
		SMTPAccount = originalAccount
		SMTPFrom = originalFrom
		SMTPToken = originalToken
		SetSMTPSenderForTest(nil)
	}()

	mockSender := &mockSMTPSender{}
	SetSMTPSenderForTest(mockSender)

	if err := SendEmail("legacy", "to@example.com", "<p>legacy</p>"); err != nil {
		t.Fatalf("legacy send should succeed, got err: %v", err)
	}
	if len(mockSender.calls) != 1 {
		t.Fatalf("expected exactly one send call, got %d", len(mockSender.calls))
	}
	if !strings.Contains(mockSender.calls[0], "legacy@qq.com") {
		t.Fatalf("legacy call should use legacy account, got %s", mockSender.calls[0])
	}
}

func TestResolveSMTPProvidersForUpdate_KeepExistingTokenWhenBlank(t *testing.T) {
	currentProviders := []SMTPProvider{
		{
			Name:           "qq-1",
			Server:         "smtp.qq.com",
			Port:           465,
			SSLEnabled:     true,
			ForceAuthLogin: true,
			Account:        "zuiyi233@qq.com",
			From:           "zuiyi233@qq.com",
			Token:          "legacy-token",
			MonthlyLimit:   3000,
		},
	}
	newProviders := []SMTPProvider{
		{
			Name:           "qq-1",
			Server:         "smtp.qq.com",
			Port:           465,
			SSLEnabled:     true,
			ForceAuthLogin: true,
			Account:        "zuiyi233@qq.com",
			From:           "zuiyi233@qq.com",
			Token:          "",
			MonthlyLimit:   3000,
		},
	}

	resolved := ResolveSMTPProvidersForUpdate(newProviders, currentProviders)
	if len(resolved) != 1 {
		t.Fatalf("expected one provider after resolve, got %d", len(resolved))
	}
	if resolved[0].Token != "legacy-token" {
		t.Fatalf("expected token to be preserved, got %q", resolved[0].Token)
	}
}

func TestSendEmail_PersistAndReloadSMTPUsageStats(t *testing.T) {
	resetSMTPProviderRuntimeState()
	UpdateSMTPMonthlyLimit(DefaultSMTPMonthlyLimit)
	SetSMTPProviders([]SMTPProvider{
		buildTestProvider("smtp.qq.com", "quota-user@qq.com", 1),
	})

	originalSMTPUsageStatsJSON := SMTPProviderUsageStatsJSON
	defer func() {
		SetSMTPProviders(nil)
		SetSMTPSenderForTest(nil)
		SMTPProviderUsageStatsJSON = originalSMTPUsageStatsJSON
		RegisterSMTPUsageStatsPersistor(nil)
	}()

	mockSender := &mockSMTPSender{}
	SetSMTPSenderForTest(mockSender)

	var persistedStatsJSON string
	var persistCalls int
	RegisterSMTPUsageStatsPersistor(func(statsJSON string) error {
		persistCalls++
		persistedStatsJSON = statsJSON
		return nil
	})

	if err := SendEmail("subject-persist-1", "to@example.com", "<p>1</p>"); err != nil {
		t.Fatalf("first send failed: %v", err)
	}
	if persistCalls != 1 {
		t.Fatalf("expected one persist call after first send, got %d", persistCalls)
	}
	if strings.TrimSpace(persistedStatsJSON) == "" {
		t.Fatal("expected persisted stats payload to be non-empty")
	}

	stats, err := ParseSMTPProviderUsageStatsFromJSONString(persistedStatsJSON)
	if err != nil {
		t.Fatalf("failed to parse persisted stats: %v", err)
	}
	if len(stats) != 1 {
		t.Fatalf("expected one usage entry in persisted stats, got %d", len(stats))
	}

	resetSMTPProviderRuntimeState()
	LoadSMTPUsageStats(stats)

	err = SendEmail("subject-persist-2", "to@example.com", "<p>2</p>")
	if err == nil {
		t.Fatal("second send should fail after reload because monthly quota is exhausted")
	}
	if !strings.Contains(err.Error(), "monthly quota exhausted") {
		t.Fatalf("expected quota exhaustion after reload, got: %v", err)
	}
}

func TestSendEmail_WeightedRoundRobin(t *testing.T) {
	resetSMTPProviderRuntimeState()
	UpdateSMTPMonthlyLimit(DefaultSMTPMonthlyLimit)
	SetSMTPProviders([]SMTPProvider{
		{
			Server:         "smtp.qq.com",
			Port:           465,
			SSLEnabled:     true,
			ForceAuthLogin: true,
			Account:        "w3@qq.com",
			From:           "w3@qq.com",
			Token:          "token-w3",
			MonthlyLimit:   3000,
			Weight:         3,
			CooldownSecond: 1,
		},
		{
			Server:         "smtp.qq.com",
			Port:           465,
			SSLEnabled:     true,
			ForceAuthLogin: true,
			Account:        "w1@qq.com",
			From:           "w1@qq.com",
			Token:          "token-w1",
			MonthlyLimit:   3000,
			Weight:         1,
			CooldownSecond: 1,
		},
	})
	defer func() {
		SetSMTPProviders(nil)
		SetSMTPSenderForTest(nil)
	}()

	mockSender := &mockSMTPSender{}
	SetSMTPSenderForTest(mockSender)

	for i := 0; i < 8; i++ {
		if err := SendEmail(fmt.Sprintf("weighted-%d", i), "to@example.com", "<p>x</p>"); err != nil {
			t.Fatalf("weighted send %d failed: %v", i, err)
		}
	}

	if len(mockSender.calls) != 8 {
		t.Fatalf("expected 8 send calls, got %d", len(mockSender.calls))
	}
	countW3 := 0
	countW1 := 0
	for _, call := range mockSender.calls {
		if strings.Contains(call, "w3@qq.com") {
			countW3++
		}
		if strings.Contains(call, "w1@qq.com") {
			countW1++
		}
	}
	if countW3 <= countW1 {
		t.Fatalf("weighted provider should be selected more frequently, got w3=%d w1=%d", countW3, countW1)
	}
}

func TestSendEmail_ProviderCooldownAfterFailure(t *testing.T) {
	resetSMTPProviderRuntimeState()
	UpdateSMTPMonthlyLimit(DefaultSMTPMonthlyLimit)
	SetSMTPProviders([]SMTPProvider{
		{
			Server:         "smtp.qq.com",
			Port:           465,
			SSLEnabled:     true,
			ForceAuthLogin: true,
			Account:        "fail@qq.com",
			From:           "fail@qq.com",
			Token:          "token-fail",
			MonthlyLimit:   3000,
			Weight:         1,
			CooldownSecond: 3,
		},
		{
			Server:         "smtp.qq.com",
			Port:           465,
			SSLEnabled:     true,
			ForceAuthLogin: true,
			Account:        "ok@qq.com",
			From:           "ok@qq.com",
			Token:          "token-ok",
			MonthlyLimit:   3000,
			Weight:         1,
			CooldownSecond: 1,
		},
	})
	defer func() {
		SetSMTPProviders(nil)
		SetSMTPSenderForTest(nil)
	}()

	mockSender := &mockSMTPSender{
		failures: map[string]error{
			"fail@qq.com": fmt.Errorf("simulated failure"),
		},
	}
	SetSMTPSenderForTest(mockSender)

	if err := SendEmail("first", "to@example.com", "<p>1</p>"); err != nil {
		t.Fatalf("first send should fallback and succeed: %v", err)
	}
	if len(mockSender.calls) != 2 {
		t.Fatalf("expected 2 attempts on first send, got %d", len(mockSender.calls))
	}
	if !strings.Contains(mockSender.calls[0], "fail@qq.com") || !strings.Contains(mockSender.calls[1], "ok@qq.com") {
		t.Fatalf("expected fail->ok order, got %v", mockSender.calls)
	}

	beforeSecond := len(mockSender.calls)
	if err := SendEmail("second", "to@example.com", "<p>2</p>"); err != nil {
		t.Fatalf("second send should use healthy provider: %v", err)
	}
	if len(mockSender.calls) != beforeSecond+1 {
		t.Fatalf("second send should only call one provider during cooldown, calls=%v", mockSender.calls)
	}
	if !strings.Contains(mockSender.calls[len(mockSender.calls)-1], "ok@qq.com") {
		t.Fatalf("second send should hit ok@qq.com during cooldown, got %s", mockSender.calls[len(mockSender.calls)-1])
	}
}
