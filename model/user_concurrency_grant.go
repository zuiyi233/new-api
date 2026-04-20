package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"gorm.io/gorm"
)

const (
	ConcurrencyGrantModeStack    = "stack"
	ConcurrencyGrantModeOverride = "override"

	ConcurrencyGrantStatusActive  = "active"
	ConcurrencyGrantStatusRevoked = "revoked"
	ConcurrencyGrantStatusExpired = "expired"

	ConcurrencyGrantSourceRedemption = "redemption"
)

type UserConcurrencyGrant struct {
	Id         int    `json:"id"`
	UserId     int    `json:"user_id" gorm:"index"`
	SourceType string `json:"source_type" gorm:"type:varchar(32);index"`
	SourceId   int    `json:"source_id" gorm:"index"`
	Mode       string `json:"mode" gorm:"type:varchar(16);index"`
	Value      int    `json:"value" gorm:"type:int;default:0"`
	Status     string `json:"status" gorm:"type:varchar(16);index"`
	StartsAt   int64  `json:"starts_at" gorm:"bigint"`
	ExpiresAt  int64  `json:"expires_at" gorm:"bigint;default:0"`
	Notes      string `json:"notes" gorm:"type:text"`
	CreatedAt  int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt  int64  `json:"updated_at" gorm:"bigint"`
}

func normalizeConcurrencyGrantMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case ConcurrencyGrantModeOverride:
		return ConcurrencyGrantModeOverride
	default:
		return ConcurrencyGrantModeStack
	}
}

func normalizeConcurrencyGrantStatus(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case ConcurrencyGrantStatusRevoked:
		return ConcurrencyGrantStatusRevoked
	case ConcurrencyGrantStatusExpired:
		return ConcurrencyGrantStatusExpired
	default:
		return ConcurrencyGrantStatusActive
	}
}

func ValidateUserConcurrencyGrant(grant *UserConcurrencyGrant) error {
	if grant == nil {
		return errors.New("并发权益参数不能为空")
	}
	if grant.UserId <= 0 {
		return errors.New("并发权益 user_id 无效")
	}
	if grant.Value <= 0 {
		return errors.New("并发权益值必须大于 0")
	}
	grant.Mode = normalizeConcurrencyGrantMode(grant.Mode)
	grant.Status = normalizeConcurrencyGrantStatus(grant.Status)
	if grant.StartsAt <= 0 {
		grant.StartsAt = common.GetTimestamp()
	}
	if grant.ExpiresAt > 0 && grant.ExpiresAt < grant.StartsAt {
		return errors.New("并发权益过期时间不能早于生效时间")
	}
	return nil
}

func CreateUserConcurrencyGrantTx(tx *gorm.DB, grant *UserConcurrencyGrant) error {
	if tx == nil {
		return errors.New("并发权益事务不能为空")
	}
	if err := ValidateUserConcurrencyGrant(grant); err != nil {
		return err
	}
	now := common.GetTimestamp()
	if grant.CreatedAt <= 0 {
		grant.CreatedAt = now
	}
	grant.UpdatedAt = now
	return tx.Create(grant).Error
}

func GetActiveUserConcurrencyGrants(userId int, now int64) ([]*UserConcurrencyGrant, error) {
	if userId <= 0 {
		return nil, errors.New("无效的 user id")
	}
	if now <= 0 {
		now = common.GetTimestamp()
	}
	grants := make([]*UserConcurrencyGrant, 0)
	err := DB.Where("user_id = ?", userId).
		Where("status = ?", ConcurrencyGrantStatusActive).
		Where("starts_at <= ?", now).
		Where("(expires_at = 0 OR expires_at >= ?)", now).
		Order("created_at desc, id desc").
		Find(&grants).Error
	return grants, err
}

func ComputeUserConcurrencyBenefit(userId int, overridePolicy string, now int64) (stackSum int, overrideValue int, err error) {
	grants, err := GetActiveUserConcurrencyGrants(userId, now)
	if err != nil {
		return 0, 0, err
	}
	policy := setting.NormalizeConcurrencyCodeOverridePolicy(overridePolicy)
	for _, grant := range grants {
		if grant == nil || grant.Value <= 0 {
			continue
		}
		switch normalizeConcurrencyGrantMode(grant.Mode) {
		case ConcurrencyGrantModeOverride:
			if policy == setting.ConcurrencyCodeOverridePolicyLatest {
				if overrideValue == 0 {
					overrideValue = grant.Value
				}
			} else if grant.Value > overrideValue {
				overrideValue = grant.Value
			}
		default:
			stackSum += grant.Value
		}
	}
	return stackSum, overrideValue, nil
}
