import { api } from '@/lib/api'
import type {
  OrderClaimAdmin,
  ApiResponse,
  GetOrderClaimsAdminParams,
  ReviewClaimPayload,
  OrderClaimReviewResult,
  SubscriptionPlanDTO,
} from './types'

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
  return getAllClaims({
    keyword,
    p,
    page_size,
  })
}

export async function getClaimById(
  id: number
): Promise<ApiResponse<OrderClaimAdmin>> {
  const res = await api.get(`/api/order-claim/admin/${id}`)
  return res.data
}

export async function reviewClaim(
  id: number,
  payload: ReviewClaimPayload
): Promise<ApiResponse<OrderClaimReviewResult>> {
  const res = await api.post(`/api/order-claim/admin/${id}/review`, payload)
  return res.data
}

export async function getAdminSubscriptionPlans(): Promise<
  ApiResponse<SubscriptionPlanDTO[]>
> {
  const res = await api.get('/api/subscription/admin/plans')
  return res.data
}
