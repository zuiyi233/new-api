import { z } from 'zod'

export const subscriptionCodeSchema = z.object({
  id: z.number(),
  name: z.string(),
  code: z.string(),
  status: z.number(),
  product_key: z.string(),
  batch_no: z.string(),
  campaign_name: z.string(),
  channel: z.string(),
  source_platform: z.string(),
  external_order_no: z.string(),
  max_uses: z.number(),
  used_count: z.number(),
  expires_at: z.number(),
  created_at: z.number(),
  created_by: z.number(),
})

export type SubscriptionCode = z.infer<typeof subscriptionCodeSchema>

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetSubscriptionCodesParams {
  p?: number
  page_size?: number
  keyword?: string
  status?: string
  product_key?: string
  availability?: string
  batch_no?: string
  campaign_name?: string
  channel?: string
  source_platform?: string
  external_order_no?: string
  created_by?: string
  created_from?: number
  created_to?: number
}

export interface GetSubscriptionCodesResponse {
  success: boolean
  message?: string
  data?: {
    items: SubscriptionCode[]
    total: number
    page: number
    page_size: number
  }
}

export interface SubscriptionCodeFormData {
  id?: number
  name: string
  code?: string
  status?: number
  product_key?: string
  batch_no?: string
  campaign_name?: string
  channel?: string
  source_platform?: string
  external_order_no?: string
  max_uses?: number
  expires_at?: number
  count?: number
}

export interface SubscriptionCodeBatchSummary {
  batch_no: string
  campaign_name: string
  channel: string
  source_platform: string
  external_order_no: string
  total_count: number
  used_count: number
  enabled_count: number
  disabled_count: number
  expired_count: number
  created_at: number
}

export interface SubscriptionCodeUsage {
  id: number
  code_id: number
  code: string
  user_id: number
  used_at: number
}

export type SubscriptionCodesDialogType =
  | 'create'
  | 'update'
  | 'delete'
  | 'view'
  | 'import'
  | 'history'
  | 'batchSummary'
  | 'usage'
