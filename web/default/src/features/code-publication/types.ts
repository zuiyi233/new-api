export interface CodePublication {
  id: number
  last_delivery_status?: string
  last_delivery_at?: number
  publication_status: string
  publication_channel: string
  source_platform: string
  external_order_no: string
  claimed_product: string
  code_type: string
  code_id: number
  code_value: string
  target_user_id: number
  target_contact: string
  order_claim_id: number
  notes: string
  created_at: number
  published_at: number
}

export interface CodeDelivery {
  id: number
  publication_id: number
  order_claim_id: number
  attempt_no: number
  parent_delivery_id: number
  operation_type: string
  delivery_status: string
  delivery_channel: string
  target_user_id: number
  target_contact: string
  source_platform: string
  external_order_no: string
  claimed_product: string
  delivered_by: number
  delivered_at: number
  claimed_by_user_id: number
  claimed_at: number
  used_at: number
  revoked_at: number
  revoke_reason: string
  notes: string
  created_at: number
}

export interface CodeDeliveryOperationLog {
  id: number
  publication_id: number
  delivery_id: number
  operation_type: string
  from_status: string
  to_status: string
  operator_id: number
  operator_name?: string
  delivery_channel: string
  revoke_reason: string
  notes: string
  meta_json?: string
  created_at: number
}

export interface CodeObjectSummary {
  code_type: string
  object_id: number
  code_value: string
  name?: string
  status?: string
  status_text?: string
  product_key?: string
  plan_id?: number
  plan_title?: string
  quota?: number
  max_uses?: number
  used_count?: number
  expires_at?: number
  created_by?: number
  batch_no?: string
  campaign_name?: string
  channel?: string
  source_platform?: string
  external_order_no?: string
  notes?: string
  granted_subscription_id?: number
  subscription_status?: string
  subscription_start_time?: number
  subscription_end_time?: number
}

export interface CodePublicationDetail {
  publication: CodePublication
  order_claim?: {
    id: number
    claim_status: string
    source_platform: string
    external_order_no: string
    claimed_product: string
    buyer_contact: string
    review_note?: string
    granted_code?: string
  }
  code_object?: CodeObjectSummary
  deliveries: CodeDelivery[]
  operation_logs: CodeDeliveryOperationLog[]
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface PublishCodesParams {
  publication_id: number
  action: 'reissue' | 'revoke' | 'rollback'
  delivery_channel?: string
  revoke_reason?: string
  notes?: string
}
