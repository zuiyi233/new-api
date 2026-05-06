export const SUBSCRIPTION_CODE_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
} as const

export const SUBSCRIPTION_CODE_STATUS_VALUES = Object.values(
  SUBSCRIPTION_CODE_STATUS
).map((value) => String(value)) as `${number}`[]

export const SUBSCRIPTION_CODE_STATUSES: Record<
  number,
  {
    labelKey: string
    value: number
    variant: 'success' | 'red' | 'warning' | 'neutral'
    showDot: boolean
  }
> = {
  [SUBSCRIPTION_CODE_STATUS.ENABLED]: {
    labelKey: 'Enabled',
    variant: 'success',
    value: SUBSCRIPTION_CODE_STATUS.ENABLED,
    showDot: true,
  },
  [SUBSCRIPTION_CODE_STATUS.DISABLED]: {
    labelKey: 'Disabled',
    variant: 'red',
    value: SUBSCRIPTION_CODE_STATUS.DISABLED,
    showDot: true,
  },
} as const

export const SUBSCRIPTION_CODE_FILTER_AVAILABILITY = {
  AVAILABLE: 'available',
  EXHAUSTED: 'exhausted',
  EXPIRED: 'expired',
  DISABLED: 'disabled',
} as const

export const SUBSCRIPTION_CODE_PRODUCT_OPTIONS = [
  { label: 'novel_product', value: 'novel_product' },
]

export const SUBSCRIPTION_CODE_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 50,
  COUNT_MIN: 1,
  COUNT_MAX: 1000,
} as const

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load subscription codes',
  SEARCH_FAILED: 'Failed to search subscription codes',
  CREATE_FAILED: 'Failed to create subscription code',
  UPDATE_FAILED: 'Failed to update subscription code',
  DELETE_FAILED: 'Failed to delete subscription code',
  BATCH_DELETE_FAILED: 'Failed to batch delete subscription codes',
  BATCH_STATUS_FAILED: 'Failed to batch update subscription code status',
  IMPORT_FAILED: 'Failed to import subscription codes',
  NAME_LENGTH_INVALID: 'Name must be between {{min}} and {{max}} characters',
  COUNT_INVALID: 'Count must be between {{min}} and {{max}}',
} as const

export const SUCCESS_MESSAGES = {
  SUBSCRIPTION_CODE_CREATED: 'Subscription code created successfully',
  SUBSCRIPTION_CODE_UPDATED: 'Subscription code updated successfully',
  SUBSCRIPTION_CODE_DELETED: 'Subscription code deleted successfully',
  SUBSCRIPTION_CODE_ENABLED: 'Subscription code enabled successfully',
  SUBSCRIPTION_CODE_DISABLED: 'Subscription code disabled successfully',
  BATCH_DELETED: 'Selected subscription codes deleted successfully',
  BATCH_STATUS_UPDATED: 'Batch status updated successfully',
  IMPORT_SUCCESS: 'Subscription codes imported successfully',
} as const

import type { TFunction } from 'i18next'

export function getSubscriptionCodeStatusOptions(t: TFunction) {
  return Object.values(SUBSCRIPTION_CODE_STATUSES).map((config) => ({
    label: t(config.labelKey),
    value: String(config.value),
  }))
}

export function getSubscriptionCodeFormErrorMessages(t: TFunction) {
  return {
    NAME_LENGTH_INVALID: t(ERROR_MESSAGES.NAME_LENGTH_INVALID, {
      min: SUBSCRIPTION_CODE_VALIDATION.NAME_MIN_LENGTH,
      max: SUBSCRIPTION_CODE_VALIDATION.NAME_MAX_LENGTH,
    }),
    COUNT_INVALID: t(ERROR_MESSAGES.COUNT_INVALID, {
      min: SUBSCRIPTION_CODE_VALIDATION.COUNT_MIN,
      max: SUBSCRIPTION_CODE_VALIDATION.COUNT_MAX,
    }),
  }
}
