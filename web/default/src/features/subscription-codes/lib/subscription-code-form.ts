import { z } from 'zod'
import type { TFunction } from 'i18next'
import {
  SUBSCRIPTION_CODE_VALIDATION,
  getSubscriptionCodeFormErrorMessages,
} from '../constants'
import type { SubscriptionCodeFormData, SubscriptionCode } from '../types'

export function getSubscriptionCodeFormSchema(t: TFunction) {
  const msg = getSubscriptionCodeFormErrorMessages(t)
  return z.object({
    name: z
      .string()
      .min(SUBSCRIPTION_CODE_VALIDATION.NAME_MIN_LENGTH, msg.NAME_LENGTH_INVALID)
      .max(SUBSCRIPTION_CODE_VALIDATION.NAME_MAX_LENGTH, msg.NAME_LENGTH_INVALID),
    product_key: z.string().optional(),
    batch_no: z.string().optional(),
    campaign_name: z.string().optional(),
    channel: z.string().optional(),
    source_platform: z.string().optional(),
    external_order_no: z.string().optional(),
    max_uses: z.number().min(0).optional(),
    expires_at: z.date().optional(),
    count: z
      .number()
      .min(SUBSCRIPTION_CODE_VALIDATION.COUNT_MIN, msg.COUNT_INVALID)
      .max(SUBSCRIPTION_CODE_VALIDATION.COUNT_MAX, msg.COUNT_INVALID)
      .optional(),
  })
}

export type SubscriptionCodeFormValues = {
  name: string
  product_key?: string
  batch_no?: string
  campaign_name?: string
  channel?: string
  source_platform?: string
  external_order_no?: string
  max_uses?: number
  expires_at?: Date
  count?: number
}

export const SUBSCRIPTION_CODE_FORM_DEFAULT_VALUES: SubscriptionCodeFormValues =
  {
    name: '',
    product_key: 'novel_product',
    batch_no: '',
    campaign_name: '',
    channel: '',
    source_platform: '',
    external_order_no: '',
    max_uses: 1,
    expires_at: undefined,
    count: 1,
  }

export function transformFormDataToPayload(
  data: SubscriptionCodeFormValues
): SubscriptionCodeFormData {
  return {
    name: data.name,
    product_key: data.product_key || 'novel_product',
    batch_no: data.batch_no || '',
    campaign_name: data.campaign_name || '',
    channel: data.channel || '',
    source_platform: data.source_platform || '',
    external_order_no: data.external_order_no || '',
    max_uses: data.max_uses ?? 1,
    expires_at: data.expires_at
      ? Math.floor(data.expires_at.getTime() / 1000)
      : 0,
    count: data.count ?? 1,
  }
}

export function transformSubscriptionCodeToFormDefaults(
  code: SubscriptionCode
): SubscriptionCodeFormValues {
  return {
    name: code.name,
    product_key: code.product_key || 'novel_product',
    batch_no: code.batch_no || '',
    campaign_name: code.campaign_name || '',
    channel: code.channel || '',
    source_platform: code.source_platform || '',
    external_order_no: code.external_order_no || '',
    max_uses: code.max_uses ?? 1,
    expires_at:
      code.expires_at > 0 ? new Date(code.expires_at * 1000) : undefined,
    count: 1,
  }
}
