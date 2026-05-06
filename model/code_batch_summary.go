package model

type CodeBatchSummary struct {
	BatchNo         string `json:"batch_no"`
	TotalCount      int64  `json:"total_count"`
	AvailableCount  int64  `json:"available_count"`
	EnabledCount    int64  `json:"enabled_count"`
	DisabledCount   int64  `json:"disabled_count"`
	UsedCount       int64  `json:"used_count"`
	ExhaustedCount  int64  `json:"exhausted_count"`
	ExpiredCount    int64  `json:"expired_count"`
	LatestCreatedAt int64  `json:"latest_created_at"`
}
