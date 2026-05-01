export interface CodePublication {
  id: number
  batch_no: string
  campaign_name: string
  channel: string
  source_platform: string
  external_order_no: string
  product_key: string
  code_type: string
  total_count: number
  published_count: number
  status: number
  created_at: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface PublishCodesParams {
  batch_no: string
  campaign_name: string
  channel: string
  source_platform: string
  external_order_no: string
  product_key: string
  code_type: string
  count: number
}
