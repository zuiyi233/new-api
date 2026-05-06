package common

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	sendflareAPIBaseURLDefault = "https://api.sendflare.com"
)

var (
	sendflareAPIBaseURL = sendflareAPIBaseURLDefault
	sendflareAPIClient  = &http.Client{Timeout: 10 * time.Second}
)

type sendflareSendEmailRequest struct {
	From    string `json:"from"`
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

type sendflareCommonResponse struct {
	RequestID string `json:"requestId"`
	Code      int    `json:"code"`
	Success   bool   `json:"success"`
	Message   string `json:"message"`
}

func shouldUseSendflareAPIProvider(provider SMTPProvider) bool {
	server := strings.ToLower(strings.TrimSpace(provider.Server))
	if !strings.HasSuffix(server, "sendflare.com") {
		return false
	}
	token := strings.ToLower(strings.TrimSpace(provider.Token))
	if strings.HasPrefix(token, "live_") || strings.HasPrefix(token, "test_") {
		return true
	}
	account := strings.ToLower(strings.TrimSpace(provider.Account))
	return account == "sendflare"
}

func splitEmailRecipients(receiver string) []string {
	parts := strings.Split(receiver, ";")
	recipients := make([]string, 0, len(parts))
	for _, part := range parts {
		recipient := strings.TrimSpace(part)
		if recipient == "" {
			continue
		}
		recipients = append(recipients, recipient)
	}
	return recipients
}

func sendEmailViaSendflareAPI(provider SMTPProvider, sender string, receiver string, subject string, content string) error {
	token := strings.TrimSpace(provider.Token)
	if token == "" {
		return fmt.Errorf("missing Sendflare API token")
	}
	sender = strings.TrimSpace(sender)
	if sender == "" {
		return fmt.Errorf("missing sender email address")
	}
	recipients := splitEmailRecipients(receiver)
	if len(recipients) == 0 {
		return fmt.Errorf("missing receiver email address")
	}

	for i := range recipients {
		if err := sendSingleEmailViaSendflareAPI(token, sender, recipients[i], subject, content); err != nil {
			return fmt.Errorf("recipient %s: %w", recipients[i], err)
		}
	}
	return nil
}

func sendSingleEmailViaSendflareAPI(token string, sender string, receiver string, subject string, content string) error {
	payload := sendflareSendEmailRequest{
		From:    sender,
		To:      receiver,
		Subject: subject,
		Body:    content,
	}
	payloadBytes, err := Marshal(payload)
	if err != nil {
		return err
	}

	baseURL := strings.TrimRight(strings.TrimSpace(sendflareAPIBaseURL), "/")
	if baseURL == "" {
		baseURL = sendflareAPIBaseURLDefault
	}
	url := baseURL + "/v1/send"
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payloadBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := sendflareAPIClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	var apiResp sendflareCommonResponse
	if err = DecodeJson(resp.Body, &apiResp); err != nil {
		if resp.StatusCode >= http.StatusBadRequest {
			return fmt.Errorf("Sendflare API status=%d and invalid response body", resp.StatusCode)
		}
		return fmt.Errorf("failed to decode Sendflare API response: %w", err)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("Sendflare API status=%d code=%d success=%t message=%s requestId=%s", resp.StatusCode, apiResp.Code, apiResp.Success, apiResp.Message, apiResp.RequestID)
	}
	if apiResp.Code != 0 || !apiResp.Success {
		return fmt.Errorf("Sendflare API code=%d success=%t message=%s requestId=%s", apiResp.Code, apiResp.Success, apiResp.Message, apiResp.RequestID)
	}
	return nil
}
