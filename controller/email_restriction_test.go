package controller

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
)

func TestValidateRestrictedEmail_QQNumericOnly(t *testing.T) {
	origDomainRestriction := common.EmailDomainRestrictionEnabled
	origAliasRestriction := common.EmailAliasRestrictionEnabled
	origQQNumericOnly := common.QQNumericMailboxOnlyEnabled
	origWhitelist := append([]string(nil), common.EmailDomainWhitelist...)
	t.Cleanup(func() {
		common.EmailDomainRestrictionEnabled = origDomainRestriction
		common.EmailAliasRestrictionEnabled = origAliasRestriction
		common.QQNumericMailboxOnlyEnabled = origQQNumericOnly
		common.EmailDomainWhitelist = origWhitelist
	})

	common.EmailDomainRestrictionEnabled = true
	common.EmailAliasRestrictionEnabled = true
	common.QQNumericMailboxOnlyEnabled = true
	common.EmailDomainWhitelist = []string{"qq.com"}

	tests := []struct {
		name        string
		email       string
		allowed     bool
		wantMessage string
	}{
		{
			name:    "numeric qq is allowed",
			email:   "123456@qq.com",
			allowed: true,
		},
		{
			name:        "alphanumeric qq rejected",
			email:       "miaoji22@qq.com",
			allowed:     false,
			wantMessage: "纯数字 QQ 邮箱限制",
		},
		{
			name:        "alpha qq rejected",
			email:       "abc@qq.com",
			allowed:     false,
			wantMessage: "纯数字 QQ 邮箱限制",
		},
		{
			name:        "non-whitelisted domain rejected",
			email:       "123456@gmail.com",
			allowed:     false,
			wantMessage: "邮箱域名白名单",
		},
		{
			name:        "alias rejected",
			email:       "123.456@qq.com",
			allowed:     false,
			wantMessage: "别名限制",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ok, message := validateRestrictedEmail(tt.email)
			if ok != tt.allowed {
				t.Fatalf("expected allowed=%v, got allowed=%v, message=%q", tt.allowed, ok, message)
			}
			if tt.wantMessage != "" && !strings.Contains(message, tt.wantMessage) {
				t.Fatalf("expected message to contain %q, got %q", tt.wantMessage, message)
			}
		})
	}
}
