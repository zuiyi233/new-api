import { api } from '@/lib/api'
import type {
  CodeCenterStats,
  ApiResponse,
  GetOperationHistoryParams,
  OperationHistoryPage,
} from './types'

export async function getCodeCenterStats(): Promise<ApiResponse<CodeCenterStats>> {
  const res = await api.get('/api/code-center/stats')
  return res.data
}

export async function getOperationHistory(
  params: GetOperationHistoryParams
): Promise<ApiResponse<OperationHistoryPage>> {
  const searchParams = new URLSearchParams()
  if (params.p) searchParams.set('p', String(params.p))
  if (params.page_size) searchParams.set('page_size', String(params.page_size))
  if (params.code_type) searchParams.set('code_type', params.code_type)
  if (params.keyword) searchParams.set('keyword', params.keyword)
  if (params.operation_type)
    searchParams.set('operation_type', params.operation_type)
  if (params.result) searchParams.set('result', params.result)
  if (params.batch_no) searchParams.set('batch_no', params.batch_no)
  if (params.operator_id) searchParams.set('operator_id', params.operator_id)
  if (params.created_from)
    searchParams.set('created_from', String(params.created_from))
  if (params.created_to)
    searchParams.set('created_to', String(params.created_to))
  const res = await api.get(`/api/code-center/history?${searchParams.toString()}`)
  return res.data
}
