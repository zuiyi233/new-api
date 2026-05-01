import { api } from '@/lib/api'
import type { CodePublication, ApiResponse, PublishCodesParams } from './types'

export async function getPublications(
  p = 1,
  page_size = 10
): Promise<ApiResponse<{ items: CodePublication[]; total: number }>> {
  const res = await api.get(
    `/api/code-publication/?p=${p}&page_size=${page_size}`
  )
  return res.data
}

export async function publishCodes(
  params: PublishCodesParams
): Promise<ApiResponse<CodePublication>> {
  const res = await api.post('/api/code-publication/publish', params)
  return res.data
}
