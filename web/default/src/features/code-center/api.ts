import { api } from '@/lib/api'
import type { CodeCenterStats, ApiResponse } from './types'

export async function getCodeCenterStats(): Promise<ApiResponse<CodeCenterStats>> {
  const res = await api.get('/api/code-center/stats')
  return res.data
}
