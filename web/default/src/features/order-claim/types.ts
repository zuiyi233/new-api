export interface OrderClaim {
  id: number
  user_id: number
  order_no: string
  product_key: string
  code_type: string
  code: string
  status: number
  claimed_at: number
  created_at: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface ClaimOrderParams {
  order_no: string
  product_key: string
  code_type: string
}

export interface GetOrderClaimsParams {
  p?: number
  page_size?: number
  user_id?: number
  status?: string
}
