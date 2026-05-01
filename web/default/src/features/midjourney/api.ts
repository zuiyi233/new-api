import { api } from '@/lib/api'
import type { MjLog, ApiResponse, GetMjLogsParams } from './types'

export async function getMjLogs(
  params: GetMjLogsParams = {}
): Promise<ApiResponse<{ items: MjLog[]; total: number }>> {
  const { p = 1, page_size = 10, ...filters } = params
  const searchParams = new URLSearchParams()
  searchParams.set('p', String(p))
  searchParams.set('page_size', String(page_size))

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      searchParams.set(key, String(value))
    }
  })

  const res = await api.get(`/api/mj/?${searchParams.toString()}`)
  return res.data
}

export async function searchMjLogs(
  keyword: string,
  p = 1,
  page_size = 10
): Promise<ApiResponse<{ items: MjLog[]; total: number }>> {
  const res = await api.get(
    `/api/mj/search?keyword=${encodeURIComponent(keyword)}&p=${p}&page_size=${page_size}`
  )
  return res.data
}
