package common

var smtpUsageStatsPersistor func(string) error

func RegisterSMTPUsageStatsPersistor(persistor func(string) error) {
	smtpUsageStatsPersistor = persistor
}

func persistSMTPUsageStatsOption(statsJSON string) error {
	if smtpUsageStatsPersistor == nil {
		return nil
	}
	return smtpUsageStatsPersistor(statsJSON)
}
