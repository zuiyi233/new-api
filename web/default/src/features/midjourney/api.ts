import { api } from '@/lib/api'
import type { MjLog, ApiResponse, GetMjLogsParams } from './types'

export async function getMjLogs(
  isAdmin: boolean,
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

  const path = isAdmin ? '/api/mj/' : '/api/mj/self'
  const res = await api.get(`${path}?${searchParams.toString()}`)
  return res.data
}
