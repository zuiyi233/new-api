import { api } from '@/lib/api'
import type { OrderClaimAdmin, ApiResponse, GetOrderClaimsAdminParams } from './types'

export async function getAllClaims(
  params: GetOrderClaimsAdminParams = {}
): Promise<ApiResponse<{ items: OrderClaimAdmin[]; total: number }>> {
  const { p = 1, page_size = 10, ...filters } = params
  const searchParams = new URLSearchParams()
  searchParams.set('p', String(p))
  searchParams.set('page_size', String(page_size))

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      searchParams.set(key, String(value))
    }
  })

  const res = await api.get(`/api/order-claim/admin?${searchParams.toString()}`)
  return res.data
}

export async function searchAllClaims(
  keyword: string,
  p = 1,
  page_size = 10
): Promise<ApiResponse<{ items: OrderClaimAdmin[]; total: number }>> {
  const res = await api.get(
    `/api/order-claim/admin/search?keyword=${encodeURIComponent(keyword)}&p=${p}&page_size=${page_size}`
  )
  return res.data
}
