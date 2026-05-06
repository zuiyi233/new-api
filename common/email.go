package common

import (
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net"
	"net/smtp"
	"slices"
	"sort"
	"strings"
	"sync"
	"time"
)

type smtpSender interface {
	Send(provider SMTPProvider, sender string, receiver string, mail []byte) error
}

type defaultSMTPSender struct{}

type smtpProviderRuntimeState struct {
	sync.Mutex
	lastProviderIndex int
	monthlySent       map[string]int
	weightsLeft       map[string]int
	cooldownUntil     map[string]int64
	pendingFlush      bool
}

var providerRuntimeState = smtpProviderRuntimeState{
	lastProviderIndex: -1,
	monthlySent:       make(map[string]int),
	weightsLeft:       make(map[string]int),
	cooldownUntil:     make(map[string]int64),
}

var activeSMTPSender smtpSender = defaultSMTPSender{}

func resetSMTPProviderRuntimeState() {
	providerRuntimeState.Lock()
	providerRuntimeState.lastProviderIndex = -1
	providerRuntimeState.monthlySent = make(map[string]int)
	providerRuntimeState.weightsLeft = make(map[string]int)
	providerRuntimeState.cooldownUntil = make(map[string]int64)
	providerRuntimeState.pendingFlush = false
	providerRuntimeState.Unlock()
}

func SetSMTPSenderForTest(sender smtpSender) {
	if sender == nil {
		activeSMTPSender = defaultSMTPSender{}
		return
	}
	activeSMTPSender = sender
}

func getProviderMonthlyLimit(provider SMTPProvider) int {
	if provider.MonthlyLimit > 0 {
		return provider.MonthlyLimit
	}
	return normalizeSMTPMonthlyLimit(SMTPMonthlyLimit)
}

func buildProviderUsageKey(provider SMTPProvider, monthKey string) string {
	account := strings.TrimSpace(provider.Account)
	if account == "" {
		account = strings.TrimSpace(provider.From)
	}
	server := strings.TrimSpace(provider.Server)
	port := provider.Port
	if port <= 0 {
		port = 587
	}
	normalized := normalizeProviderIdentity(SMTPProvider{
		Server:  server,
		Port:    port,
		Account: account,
		From:    provider.From,
	})
	return fmt.Sprintf("%s|%s", normalized, monthKey)
}

func buildProviderRuntimeIdentity(provider SMTPProvider) string {
	account := strings.TrimSpace(provider.Account)
	if account == "" {
		account = strings.TrimSpace(provider.From)
	}
	server := strings.TrimSpace(provider.Server)
	port := provider.Port
	if port <= 0 {
		port = 587
	}
	normalized := normalizeProviderIdentity(SMTPProvider{
		Server:  server,
		Port:    port,
		Account: account,
		From:    provider.From,
	})
	return normalized
}

func getProviderCooldownSecond(provider SMTPProvider) int {
	return normalizeSMTPProviderCooldownSecond(provider.CooldownSecond)
}

func currentMonthKey() string {
	return time.Now().UTC().Format("2006-01")
}

func normalizeSMTPProviderForSending(provider SMTPProvider) SMTPProvider {
	if provider.Port <= 0 {
		provider.Port = 587
	}
	provider.Server = strings.TrimSpace(provider.Server)
	provider.Account = strings.TrimSpace(provider.Account)
	provider.From = strings.TrimSpace(provider.From)
	provider.Token = strings.TrimSpace(provider.Token)
	provider.Weight = normalizeSMTPProviderWeight(provider.Weight)
	provider.CooldownSecond = normalizeSMTPProviderCooldownSecond(provider.CooldownSecond)
	if provider.From == "" {
		provider.From = provider.Account
	}
	return provider
}

func isSMTPProviderConfigured(provider SMTPProvider) bool {
	return provider.Server != "" && provider.Account != ""
}

func buildLegacySMTPProvider() SMTPProvider {
	provider := SMTPProvider{
		Name:           "legacy",
		Server:         strings.TrimSpace(SMTPServer),
		Port:           SMTPPort,
		SSLEnabled:     SMTPSSLEnabled,
		ForceAuthLogin: SMTPForceAuthLogin,
		Account:        strings.TrimSpace(SMTPAccount),
		From:           strings.TrimSpace(SMTPFrom),
		Token:          strings.TrimSpace(SMTPToken),
		Weight:         DefaultSMTPProviderWeight,
		CooldownSecond: DefaultSMTPProviderFailureCooldownSecond,
	}
	if provider.From == "" {
		provider.From = provider.Account
	}
	if provider.Port <= 0 {
		provider.Port = 587
	}
	return provider
}

func getConfiguredSMTPProviders() []SMTPProvider {
	providers := GetSMTPProvidersSnapshot()
	if len(providers) == 0 {
		legacyProvider := buildLegacySMTPProvider()
		if isSMTPProviderConfigured(legacyProvider) {
			return []SMTPProvider{legacyProvider}
		}
		return nil
	}
	normalized := make([]SMTPProvider, 0, len(providers))
	for i := range providers {
		provider := normalizeSMTPProviderForSending(providers[i])
		if !isSMTPProviderConfigured(provider) {
			continue
		}
		normalized = append(normalized, provider)
	}
	return normalized
}

func isProviderCoolingDown(provider SMTPProvider) (bool, int64) {
	providerRuntimeState.Lock()
	defer providerRuntimeState.Unlock()
	nowUnix := time.Now().Unix()
	identity := buildProviderRuntimeIdentity(provider)
	until, ok := providerRuntimeState.cooldownUntil[identity]
	if !ok || until <= nowUnix {
		if ok {
			delete(providerRuntimeState.cooldownUntil, identity)
		}
		return false, 0
	}
	return true, until - nowUnix
}

func getProviderWeightLeft(provider SMTPProvider) int {
	identity := buildProviderRuntimeIdentity(provider)
	weight := normalizeSMTPProviderWeight(provider.Weight)
	left, ok := providerRuntimeState.weightsLeft[identity]
	if !ok || left < 0 || left > weight {
		left = weight
	}
	return left
}

func setProviderWeightLeft(provider SMTPProvider, left int) {
	identity := buildProviderRuntimeIdentity(provider)
	weight := normalizeSMTPProviderWeight(provider.Weight)
	if left < 0 {
		left = weight
	}
	if left > weight {
		left = weight
	}
	providerRuntimeState.weightsLeft[identity] = left
}

func isProviderCoolingDownLocked(provider SMTPProvider, nowUnix int64) bool {
	identity := buildProviderRuntimeIdentity(provider)
	until, ok := providerRuntimeState.cooldownUntil[identity]
	if !ok || until <= nowUnix {
		if ok {
			delete(providerRuntimeState.cooldownUntil, identity)
		}
		return false
	}
	return true
}

func markProviderFailure(provider SMTPProvider) {
	cooldownSecond := getProviderCooldownSecond(provider)
	if cooldownSecond <= 0 {
		return
	}
	providerRuntimeState.Lock()
	defer providerRuntimeState.Unlock()
	identity := buildProviderRuntimeIdentity(provider)
	providerRuntimeState.cooldownUntil[identity] = time.Now().Unix() + int64(cooldownSecond)
}

func extractMessageIDDomain(from string, fallbackHost string) (string, error) {
	split := strings.Split(from, "@")
	if len(split) >= 2 {
		domain := strings.TrimSpace(split[len(split)-1])
		if domain != "" {
			return domain, nil
		}
	}

	host := strings.TrimSpace(fallbackHost)
	if host == "" {
		return "", fmt.Errorf("invalid SMTP account and empty SMTP host")
	}
	if strings.Contains(host, ":") {
		parsedHost, _, err := net.SplitHostPort(host)
		if err == nil {
			host = parsedHost
		}
	}
	host = strings.TrimPrefix(host, "[")
	host = strings.TrimSuffix(host, "]")
	if host == "" {
		return "", fmt.Errorf("invalid SMTP fallback host")
	}
	return host, nil
}

func generateMessageID(from string, fallbackHost string) (string, error) {
	domain, err := extractMessageIDDomain(from, fallbackHost)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("<%d.%s@%s>", time.Now().UnixNano(), GetRandomString(12), domain), nil
}

func shouldUseSMTPLoginAuth(provider SMTPProvider) bool {
	if provider.ForceAuthLogin {
		return true
	}
	return isOutlookServer(provider.Account) || slices.Contains(EmailLoginAuthServerList, provider.Server)
}

func getSMTPAuth(provider SMTPProvider) smtp.Auth {
	if shouldUseSMTPLoginAuth(provider) {
		return LoginAuth(provider.Account, provider.Token)
	}
	return smtp.PlainAuth("", provider.Account, provider.Token, provider.Server)
}

func buildEmailMessage(subject string, receiver string, content string, sender string, provider SMTPProvider) ([]byte, error) {
	id, err := generateMessageID(sender, provider.Server)
	if err != nil {
		return nil, err
	}

	encodedSubject := fmt.Sprintf("=?UTF-8?B?%s?=", base64.StdEncoding.EncodeToString([]byte(subject)))
	mail := []byte(fmt.Sprintf("To: %s\r\n"+
		"From: %s <%s>\r\n"+
		"Subject: %s\r\n"+
		"Date: %s\r\n"+
		"Message-ID: %s\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n\r\n%s\r\n",
		receiver, SystemName, sender, encodedSubject, time.Now().Format(time.RFC1123Z), id, content))
	return mail, nil
}

func selectProviderIndexes(providers []SMTPProvider, monthKey string) []int {
	if len(providers) == 0 {
		return nil
	}

	providerRuntimeState.Lock()
	defer providerRuntimeState.Unlock()

	ready := make([]int, 0, len(providers))
	quotaExhausted := make([]int, 0, len(providers))
	coolingDown := make([]int, 0, len(providers))
	nowUnix := time.Now().Unix()
	start := (providerRuntimeState.lastProviderIndex + 1 + len(providers)) % len(providers)
	for offset := 0; offset < len(providers); offset++ {
		idx := (start + offset) % len(providers)
		provider := providers[idx]
		key := buildProviderUsageKey(provider, monthKey)
		sent := providerRuntimeState.monthlySent[key]
		limit := getProviderMonthlyLimit(provider)
		if isProviderCoolingDownLocked(provider, nowUnix) {
			coolingDown = append(coolingDown, idx)
			continue
		}
		if sent < limit {
			ready = append(ready, idx)
		} else {
			quotaExhausted = append(quotaExhausted, idx)
		}
	}

	weightedReady := make([]int, len(ready))
	copy(weightedReady, ready)
	sort.SliceStable(weightedReady, func(i, j int) bool {
		leftI := getProviderWeightLeft(providers[weightedReady[i]])
		leftJ := getProviderWeightLeft(providers[weightedReady[j]])
		return leftI > leftJ
	})
	for _, idx := range weightedReady {
		left := getProviderWeightLeft(providers[idx])
		setProviderWeightLeft(providers[idx], left-1)
	}

	result := make([]int, 0, len(weightedReady)+len(coolingDown)+len(quotaExhausted))
	result = append(result, weightedReady...)
	result = append(result, coolingDown...)
	result = append(result, quotaExhausted...)
	return result
}

func markProviderSendSuccess(provider SMTPProvider, providerIndex int, monthKey string) {
	providerRuntimeState.Lock()
	defer func() {
		shouldFlush := providerRuntimeState.pendingFlush
		providerRuntimeState.Unlock()
		if shouldFlush {
			flushSMTPUsageStatsToOption()
		}
	}()
	key := buildProviderUsageKey(provider, monthKey)
	providerRuntimeState.monthlySent[key]++
	providerRuntimeState.lastProviderIndex = providerIndex
	providerRuntimeState.pendingFlush = true
}

func setSMTPUsageStats(stats SMTPProviderUsageStats) {
	normalized := make(map[string]int, len(stats))
	for key, value := range stats {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" || value < 0 {
			continue
		}
		normalized[trimmedKey] = value
	}
	providerRuntimeState.Lock()
	providerRuntimeState.monthlySent = normalized
	providerRuntimeState.pendingFlush = false
	providerRuntimeState.Unlock()
}

func LoadSMTPUsageStats(stats SMTPProviderUsageStats) {
	setSMTPUsageStats(stats)
}

func getSMTPUsageStatsSnapshot() SMTPProviderUsageStats {
	providerRuntimeState.Lock()
	defer providerRuntimeState.Unlock()
	snapshot := make(SMTPProviderUsageStats, len(providerRuntimeState.monthlySent))
	for key, value := range providerRuntimeState.monthlySent {
		snapshot[key] = value
	}
	return snapshot
}

func flushSMTPUsageStatsToOption() {
	stats := getSMTPUsageStatsSnapshot()
	statsJSON := EncodeSMTPProviderUsageStats(stats)
	SMTPProviderUsageStatsJSON = statsJSON
	if err := persistSMTPUsageStatsOption(statsJSON); err != nil {
		SysError(fmt.Sprintf("failed to persist SMTP provider usage stats: %v", err))
		return
	}
	providerRuntimeState.Lock()
	providerRuntimeState.pendingFlush = false
	providerRuntimeState.Unlock()
}

func defaultSMTPDialSend(provider SMTPProvider, sender string, receiver string, mail []byte) error {
	auth := getSMTPAuth(provider)
	addr := fmt.Sprintf("%s:%d", provider.Server, provider.Port)
	to := strings.Split(receiver, ";")
	var err error
	if provider.Port == 465 || provider.SSLEnabled {
		tlsConfig := &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         provider.Server,
		}
		conn, err := tls.Dial("tcp", fmt.Sprintf("%s:%d", provider.Server, provider.Port), tlsConfig)
		if err != nil {
			return err
		}
		client, err := smtp.NewClient(conn, provider.Server)
		if err != nil {
			return err
		}
		defer client.Close()
		if err = client.Auth(auth); err != nil {
			return err
		}
		if err = client.Mail(sender); err != nil {
			return err
		}
		receiverEmails := strings.Split(receiver, ";")
		for _, receiver := range receiverEmails {
			if err = client.Rcpt(receiver); err != nil {
				return err
			}
		}
		w, err := client.Data()
		if err != nil {
			return err
		}
		_, err = w.Write(mail)
		if err != nil {
			return err
		}
		err = w.Close()
		if err != nil {
			return err
		}
	} else {
		err = smtp.SendMail(addr, auth, sender, to, mail)
	}
	return err
}

func (s defaultSMTPSender) Send(provider SMTPProvider, sender string, receiver string, mail []byte) error {
	return defaultSMTPDialSend(provider, sender, receiver, mail)
}

func sendEmailWithProvider(provider SMTPProvider, sender string, receiver string, subject string, content string) error {
	mail, err := buildEmailMessage(subject, receiver, content, sender, provider)
	if err != nil {
		return err
	}
	return activeSMTPSender.Send(provider, sender, receiver, mail)
}

func SendEmail(subject string, receiver string, content string) error {
	providers := getConfiguredSMTPProviders()
	if len(providers) == 0 {
		return fmt.Errorf("SMTP 服务器未配置")
	}

	monthKey := currentMonthKey()
	indexes := selectProviderIndexes(providers, monthKey)
	if len(indexes) == 0 {
		return fmt.Errorf("SMTP 服务器未配置")
	}

	errorsByIndex := make(map[int]string)
	for _, providerIndex := range indexes {
		provider := providers[providerIndex]
		sender := provider.From
		limit := getProviderMonthlyLimit(provider)
		usageKey := buildProviderUsageKey(provider, monthKey)
		if coolingDown, remaining := isProviderCoolingDown(provider); coolingDown {
			errorsByIndex[providerIndex] = fmt.Sprintf("provider %d (%s) cooling down (%ds)", providerIndex, provider.Account, remaining)
			continue
		}

		providerRuntimeState.Lock()
		sent := providerRuntimeState.monthlySent[usageKey]
		providerRuntimeState.Unlock()
		if sent >= limit {
			errorsByIndex[providerIndex] = fmt.Sprintf("provider %d monthly quota exhausted (%d/%d)", providerIndex, sent, limit)
			continue
		}

		err := sendEmailWithProvider(provider, sender, receiver, subject, content)
		if err != nil {
			SysError(fmt.Sprintf("failed to send email to %s via provider[%d] %s: %v", receiver, providerIndex, provider.Account, err))
			markProviderFailure(provider)
			errorsByIndex[providerIndex] = fmt.Sprintf("provider %d (%s): %v", providerIndex, provider.Account, err)
			continue
		}
		markProviderSendSuccess(provider, providerIndex, monthKey)
		return nil
	}

	if len(errorsByIndex) == 0 {
		return fmt.Errorf("SMTP 邮件发送失败")
	}

	keys := make([]int, 0, len(errorsByIndex))
	for idx := range errorsByIndex {
		keys = append(keys, idx)
	}
	sort.Ints(keys)
	details := make([]string, 0, len(keys))
	for _, idx := range keys {
		details = append(details, errorsByIndex[idx])
	}
	return fmt.Errorf("SMTP 邮件发送失败: %s", strings.Join(details, "; "))
}
