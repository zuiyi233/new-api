export interface OrderClaim {
  id: number
  user_id: number
  source_platform: string
  external_order_no: string
  buyer_contact: string
  claimed_product: string
  claim_note: string
  claim_status: string
  proof_images?: string[]
  reviewer_id: number
  review_note: string
  reviewed_at: number
  grant_type: string
  granted_code: string
  granted_subscription_id: number
  created_at: number
  updated_at: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface ClaimOrderParams {
  source_platform: string
  external_order_no: string
  buyer_contact: string
  claimed_product: string
  proof_images?: string[]
  claim_note?: string
}

export interface GetOrderClaimsParams {
  p?: number
  page_size?: number
  keyword?: string
  claim_status?: string
  source_platform?: string
  claimed_product?: string
  user_id?: number
  reviewer_id?: number
}
