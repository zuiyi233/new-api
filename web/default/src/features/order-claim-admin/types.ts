export interface OrderClaimAdmin {
  id: number
  user_id: number
  order_no: string
  product_key: string
  code_type: string
  code: string
  status: number
  claimed_at: number
  created_at: number
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
  status?: string
  code_type?: string
  product_key?: string
}
