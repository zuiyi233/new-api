package controller

import (
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

var numericMailboxPattern = regexp.MustCompile(`^[0-9]+$`)

func validateRestrictedEmail(email string) (bool, string) {
	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return false, "无效的邮箱地址"
	}
	localPart := parts[0]
	domainPart := parts[1]

	if common.EmailDomainRestrictionEnabled {
		allowed := false
		for _, domain := range common.EmailDomainWhitelist {
			if domainPart == strings.TrimSpace(domain) {
				allowed = true
				break
			}
		}
		if !allowed {
			return false, "管理员已启用邮箱域名白名单，当前邮箱域名不在允许列表中。"
		}
	}

	if common.EmailAliasRestrictionEnabled {
		containsSpecialSymbols := strings.Contains(localPart, "+") || strings.Contains(localPart, ".")
		if containsSpecialSymbols {
			return false, "管理员已启用邮箱地址别名限制，您的邮箱地址由于包含特殊符号而被拒绝。"
		}
	}

	if common.QQNumericMailboxOnlyEnabled && strings.EqualFold(domainPart, "qq.com") {
		if !numericMailboxPattern.MatchString(localPart) {
			return false, "管理员已启用纯数字 QQ 邮箱限制，仅允许类似 123456@qq.com 的邮箱地址。"
		}
	}

	return true, ""
}
