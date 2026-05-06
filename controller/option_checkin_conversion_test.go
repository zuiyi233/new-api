package controller

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
)

func TestConvertCheckinOptionValueNumericRoundTrip(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() {
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	storageValue, err := convertCheckinOptionValueToStorage("checkin_setting.min_quota", "0.05")
	if err != nil {
		t.Fatalf("convert to storage failed: %v", err)
	}
	if storageValue != "25000" {
		t.Fatalf("expected storage value 25000, got %s", storageValue)
	}

	displayValue, err := convertCheckinOptionValueForDisplay("checkin_setting.min_quota", storageValue)
	if err != nil {
		t.Fatalf("convert to display failed: %v", err)
	}
	if displayValue != "0.05" {
		t.Fatalf("expected display value 0.05, got %s", displayValue)
	}

	entryStorage, err := convertCheckinOptionValueToStorage("checkin_setting.entry_min_quota", "0.01")
	if err != nil {
		t.Fatalf("convert entry min quota to storage failed: %v", err)
	}
	if entryStorage != "5000" {
		t.Fatalf("expected entry storage value 5000, got %s", entryStorage)
	}
}

func TestConvertCheckinOptionValueBandsRoundTrip(t *testing.T) {
	originalQuotaPerUnit := common.QuotaPerUnit
	common.QuotaPerUnit = 500000
	t.Cleanup(func() {
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	input := `[{"min_quota":0.05,"max_quota":0.2,"weight":70},{"min_quota":0.2,"max_quota":0.6,"weight":25}]`
	storageValue, err := convertCheckinOptionValueToStorage("checkin_setting.basic_reward_bands", input)
	if err != nil {
		t.Fatalf("convert bands to storage failed: %v", err)
	}

	var storageBands []operation_setting.CheckinRewardBand
	if err = common.UnmarshalJsonStr(storageValue, &storageBands); err != nil {
		t.Fatalf("unmarshal storage bands failed: %v", err)
	}
	if len(storageBands) != 2 {
		t.Fatalf("expected 2 storage bands, got %d", len(storageBands))
	}
	if storageBands[0].MinQuota != 25000 || storageBands[0].MaxQuota != 100000 {
		t.Fatalf("unexpected storage band[0]: %+v", storageBands[0])
	}

	displayValue, err := convertCheckinOptionValueForDisplay("checkin_setting.basic_reward_bands", storageValue)
	if err != nil {
		t.Fatalf("convert bands to display failed: %v", err)
	}

	var displayBands []checkinRewardBandAmount
	if err = common.UnmarshalJsonStr(displayValue, &displayBands); err != nil {
		t.Fatalf("unmarshal display bands failed: %v", err)
	}
	if len(displayBands) != 2 {
		t.Fatalf("expected 2 display bands, got %d", len(displayBands))
	}
	if math.Abs(displayBands[0].MinQuota-0.05) > 0.000001 || math.Abs(displayBands[0].MaxQuota-0.2) > 0.000001 {
		t.Fatalf("unexpected display band[0]: %+v", displayBands[0])
	}

	entryInput := `[{"min_quota":0.01,"max_quota":0.05,"weight":72}]`
	entryStorage, err := convertCheckinOptionValueToStorage("checkin_setting.entry_reward_bands", entryInput)
	if err != nil {
		t.Fatalf("convert entry bands to storage failed: %v", err)
	}
	entryDisplay, err := convertCheckinOptionValueForDisplay("checkin_setting.entry_reward_bands", entryStorage)
	if err != nil {
		t.Fatalf("convert entry bands to display failed: %v", err)
	}

	var entryBands []checkinRewardBandAmount
	if err = common.UnmarshalJsonStr(entryDisplay, &entryBands); err != nil {
		t.Fatalf("unmarshal entry display bands failed: %v", err)
	}
	if len(entryBands) != 1 {
		t.Fatalf("expected 1 entry display band, got %d", len(entryBands))
	}
	if math.Abs(entryBands[0].MinQuota-0.01) > 0.000001 || math.Abs(entryBands[0].MaxQuota-0.05) > 0.000001 {
		t.Fatalf("unexpected entry display band: %+v", entryBands[0])
	}
}

func TestConvertCheckinOptionValueLegacyQuotaCompatibility(t *testing.T) {
	legacyValue := "25000000"
	storageValue, err := convertCheckinOptionValueToStorage("checkin_setting.basic_min_balance_quota", legacyValue)
	if err != nil {
		t.Fatalf("convert legacy value failed: %v", err)
	}
	if storageValue != legacyValue {
		t.Fatalf("expected legacy value unchanged, got %s", storageValue)
	}
}
