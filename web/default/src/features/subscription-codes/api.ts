import { api } from '@/lib/api'
import type {
  SubscriptionCode,
  ApiResponse,
  GetSubscriptionCodesParams,
  GetSubscriptionCodesResponse,
  SubscriptionCodeFormData,
  SubscriptionCodeBatchSummary,
  SubscriptionCodeUsage,
} from './types'

export async function getSubscriptionCodes(
  params: GetSubscriptionCodesParams = {}
): Promise<GetSubscriptionCodesResponse> {
  const { p = 1, page_size = 10, ...filters } = params
  const searchParams = new URLSearchParams()
  searchParams.set('p', String(p))
  searchParams.set('page_size', String(page_size))

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      searchParams.set(key, String(value))
    }
  })

  const res = await api.get(`/api/subscription-code/?${searchParams.toString()}`)
  return res.data
}

export async function searchSubscriptionCodes(
  keyword: string,
  p = 1,
  page_size = 10
): Promise<GetSubscriptionCodesResponse> {
  const res = await api.get(
    `/api/subscription-code/search?keyword=${encodeURIComponent(keyword)}&p=${p}&page_size=${page_size}`
  )
  return res.data
}

export async function getSubscriptionCode(
  id: number
): Promise<ApiResponse<SubscriptionCode>> {
  const res = await api.get(`/api/subscription-code/${id}`)
  return res.data
}

export async function createSubscriptionCode(
  data: SubscriptionCodeFormData
): Promise<ApiResponse<string[]>> {
  const res = await api.post('/api/subscription-code/', data)
  return res.data
}

export async function updateSubscriptionCode(
  data: SubscriptionCodeFormData & { id: number }
): Promise<ApiResponse<SubscriptionCode>> {
  const res = await api.put('/api/subscription-code/', data)
  return res.data
}

export async function deleteSubscriptionCode(
  id: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/subscription-code/${id}`)
  return res.data
}

export async function batchDeleteSubscriptionCodes(
  ids: number[]
): Promise<ApiResponse> {
  const res = await api.post('/api/subscription-code/batch/delete', { ids })
  return res.data
}

export async function batchUpdateSubscriptionCodeStatus(
  ids: number[],
  status: number
): Promise<ApiResponse> {
  const res = await api.post('/api/subscription-code/batch/status', {
    ids,
    status,
  })
  return res.data
}

export async function getSubscriptionCodeBatches(): Promise<
  ApiResponse<SubscriptionCodeBatchSummary[]>
> {
  const res = await api.get('/api/subscription-code/batches')
  return res.data
}

export async function getSubscriptionCodeUsages(
  codeId: number
): Promise<ApiResponse<SubscriptionCodeUsage[]>> {
  const res = await api.get(
    `/api/subscription-code/usage?code_id=${codeId}`
  )
  return res.data
}

export async function previewSubscriptionCodeImport(
  data: FormData
): Promise<ApiResponse> {
  const res = await api.post('/api/subscription-code/import/preview', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function importSubscriptionCodes(
  data: FormData
): Promise<ApiResponse> {
  const res = await api.post('/api/subscription-code/import', data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}
