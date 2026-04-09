package controller

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

type codeBatchPayload struct {
	Ids []int `json:"ids"`
}

type codeBatchStatusPayload struct {
	Ids    []int `json:"ids"`
	Status int   `json:"status"`
}

func normalizePositiveIDs(ids []int) []int {
	if len(ids) == 0 {
		return nil
	}
	result := make([]int, 0, len(ids))
	seen := make(map[int]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func parseCodeBatchPayload(c *gin.Context) ([]int, error) {
	payload := &codeBatchPayload{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		return nil, err
	}
	ids := normalizePositiveIDs(payload.Ids)
	if len(ids) == 0 {
		return nil, errors.New("请选择至少一条记录")
	}
	return ids, nil
}

func parseCodeBatchStatusPayload(c *gin.Context, allowedStatuses ...int) ([]int, int, error) {
	payload := &codeBatchStatusPayload{}
	if err := common.DecodeJson(c.Request.Body, payload); err != nil {
		return nil, 0, err
	}
	ids := normalizePositiveIDs(payload.Ids)
	if len(ids) == 0 {
		return nil, 0, errors.New("请选择至少一条记录")
	}
	statusAllowed := false
	for _, status := range allowedStatuses {
		if payload.Status == status {
			statusAllowed = true
			break
		}
	}
	if !statusAllowed {
		return nil, 0, errors.New("状态参数无效")
	}
	return ids, payload.Status, nil
}
