export interface OrderClaimAdmin {
  id: number
  user_id: number
  source_platform: string
  external_order_no: string
  buyer_contact: string
  claimed_product: string
  claim_note?: string
  claim_status: 'pending_review' | 'approved' | 'rejected' | string
  review_note?: string
  reviewed_at?: number
  grant_type?: 'subscription' | 'subscription_code' | 'registration_code' | 'redemption' | string
  granted_code?: string
  granted_plan_id?: number
  granted_product_key?: string
  granted_quota?: number
  granted_redemption_id?: number
  granted_registration_code_id?: number
  granted_subscription_code_id?: number
  granted_subscription_id?: number
  proof_images?: string[]
  created_at: number
  updated_at?: number
  reviewer_id?: number
  user_name?: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetOrderClaimsAdminParams {
  p?: number
  page_size?: number
  keyword?: string
  claim_status?: string
  source_platform?: string
  claimed_product?: string
  user_id?: number
  reviewer_id?: number
}

export type OrderClaimAction = 'approve' | 'reject'
export type OrderClaimGrantType =
  | 'subscription'
  | 'subscription_code'
  | 'registration_code'
  | 'redemption'

export interface ReviewClaimPayload {
  action: OrderClaimAction
  review_note?: string
  grant_type?: OrderClaimGrantType | ''
  plan_id?: number
  product_key?: string
  quota?: number
  expires_at?: number
  max_uses?: number
  grant_name?: string
  grant_note?: string
}

export interface OrderClaimReviewResult {
  claim: OrderClaimAdmin
  message: string
  generated_code?: string
  generated_code_type?: string
  subscription?: {
    subscription_id: number
    plan_id: number
    plan_title: string
    start_time: number
    end_time: number
    status: string
    source: string
  }
}

export interface SubscriptionPlanDTO {
  plan: {
    id: number
    title: string
    enabled: boolean
  }
}
