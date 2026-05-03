import { api } from '@/lib/api'
import type { OrderClaim, ApiResponse, ClaimOrderParams, GetOrderClaimsParams } from './types'

export async function claimOrder(
  params: ClaimOrderParams
): Promise<ApiResponse<OrderClaim>> {
  const res = await api.post('/api/order-claim/self', params)
  return res.data
}

export async function getMyClaims(
  params: GetOrderClaimsParams = {}
): Promise<ApiResponse<{ items: OrderClaim[]; total: number }>> {
  const { p = 1, page_size = 10, ...filters } = params
  const searchParams = new URLSearchParams()
  searchParams.set('p', String(p))
  searchParams.set('page_size', String(page_size))

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== null) {
      searchParams.set(key, String(value))
    }
  })

  const res = await api.get(`/api/order-claim/self?${searchParams.toString()}`)
  return res.data
}
