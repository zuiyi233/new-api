import { z } from 'zod'
import type { TFunction } from 'i18next'
import { parseQuotaFromDollars, quotaUnitsToDollars } from '@/lib/format'
import {
  REDEMPTION_VALIDATION,
  getRedemptionFormErrorMessages,
} from '../constants'
import { type RedemptionFormData, type Redemption } from '../types'

// ============================================================================
// Form Schema (use getRedemptionFormSchema(t) in components for i18n messages)
// ============================================================================

export function getRedemptionFormSchema(t: TFunction) {
  const msg = getRedemptionFormErrorMessages(t)
  return z.object({
    name: z
      .string()
      .min(REDEMPTION_VALIDATION.NAME_MIN_LENGTH, msg.NAME_LENGTH_INVALID)
      .max(REDEMPTION_VALIDATION.NAME_MAX_LENGTH, msg.NAME_LENGTH_INVALID),
    quota_dollars: z.number().min(0, t('Quota must be a positive number')),
    expired_time: z.date().optional(),
    count: z
      .number()
      .min(REDEMPTION_VALIDATION.COUNT_MIN, msg.COUNT_INVALID)
      .max(REDEMPTION_VALIDATION.COUNT_MAX, msg.COUNT_INVALID)
      .optional(),
    benefit_type: z.string().default('quota'),
    concurrency_mode: z.string().default('stack'),
    concurrency_value: z.number().min(0).default(0),
    benefit_expires_at: z.date().optional(),
  })
}

export type RedemptionFormValues = {
  name: string
  quota_dollars: number
  expired_time?: Date
  count?: number
  benefit_type: string
  concurrency_mode: string
  concurrency_value: number
  benefit_expires_at?: Date
}

// ============================================================================
// Form Defaults
// ============================================================================

export const REDEMPTION_FORM_DEFAULT_VALUES: RedemptionFormValues = {
  name: '',
  quota_dollars: 10,
  expired_time: undefined,
  count: 1,
  benefit_type: 'quota',
  concurrency_mode: 'stack',
  concurrency_value: 0,
  benefit_expires_at: undefined,
}

// ============================================================================
// Form Data Transformation
// ============================================================================

/**
 * Transform form data to API payload
 */
export function transformFormDataToPayload(
  data: RedemptionFormValues
): RedemptionFormData {
  const includesConcurrency =
    data.benefit_type === 'concurrency_stack' ||
    data.benefit_type === 'concurrency_override' ||
    data.benefit_type === 'mixed'

  return {
    name: data.name,
    quota: parseQuotaFromDollars(data.quota_dollars),
    expired_time: data.expired_time
      ? Math.floor(data.expired_time.getTime() / 1000)
      : 0,
    count: data.count || 1,
    benefit_type: data.benefit_type,
    concurrency_mode: includesConcurrency ? data.concurrency_mode : undefined,
    concurrency_value: includesConcurrency ? data.concurrency_value : 0,
    benefit_expires_at:
      includesConcurrency && data.benefit_expires_at
        ? Math.floor(data.benefit_expires_at.getTime() / 1000)
        : 0,
  }
}

/**
 * Transform redemption data to form defaults
 */
export function transformRedemptionToFormDefaults(
  redemption: Redemption
): RedemptionFormValues {
  return {
    name: redemption.name,
    quota_dollars: quotaUnitsToDollars(redemption.quota),
    expired_time:
      redemption.expired_time > 0
        ? new Date(redemption.expired_time * 1000)
        : undefined,
    count: 1,
    benefit_type: redemption.benefit_type || 'quota',
    concurrency_mode: redemption.concurrency_mode || 'stack',
    concurrency_value: redemption.concurrency_value || 0,
    benefit_expires_at:
      redemption.benefit_expires_at && redemption.benefit_expires_at > 0
        ? new Date(redemption.benefit_expires_at * 1000)
        : undefined,
  }
}
