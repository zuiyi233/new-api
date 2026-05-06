package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

type EmailVerificationRegistrationBinding struct {
	Id                 int    `json:"id"`
	Email              string `json:"email" gorm:"type:varchar(255);uniqueIndex"`
	RegistrationCodeId int    `json:"registration_code_id" gorm:"index"`
	RegistrationCode   string `json:"registration_code" gorm:"type:varchar(64);index"`
	CreatedAt          int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt          int64  `json:"updated_at" gorm:"bigint"`
}

func normalizeBindingEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func normalizeBindingRegistrationCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func GetEmailVerificationRegistrationBindingByEmailTx(tx *gorm.DB, email string) (*EmailVerificationRegistrationBinding, error) {
	normalizedEmail := normalizeBindingEmail(email)
	if normalizedEmail == "" {
		return nil, errors.New("邮箱不能为空")
	}
	binding := &EmailVerificationRegistrationBinding{}
	err := tx.Where("email = ?", normalizedEmail).First(binding).Error
	if err != nil {
		return nil, err
	}
	return binding, nil
}

func BindEmailToRegistrationCodeTx(
	tx *gorm.DB,
	email string,
	registrationCode *RegistrationCode,
) (*EmailVerificationRegistrationBinding, error) {
	if registrationCode == nil || registrationCode.Id == 0 {
		return nil, errors.New("注册码无效")
	}
	normalizedEmail := normalizeBindingEmail(email)
	if normalizedEmail == "" {
		return nil, errors.New("邮箱不能为空")
	}
	now := common.GetTimestamp()
	binding := &EmailVerificationRegistrationBinding{
		Email:              normalizedEmail,
		RegistrationCodeId: registrationCode.Id,
		RegistrationCode:   normalizeBindingRegistrationCode(registrationCode.Code),
		CreatedAt:          now,
		UpdatedAt:          now,
	}
	if err := tx.Create(binding).Error; err != nil {
		return nil, err
	}
	return binding, nil
}
