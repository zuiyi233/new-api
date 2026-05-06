export const REGISTRATION_CODE_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
} as const

export const REGISTRATION_CODE_STATUS_VALUES = Object.values(
  REGISTRATION_CODE_STATUS
).map((value) => String(value)) as `${number}`[]

export const REGISTRATION_CODE_STATUSES: Record<
  number,
  {
    labelKey: string
    value: number
    variant: 'success' | 'red' | 'warning' | 'neutral'
    showDot: boolean
  }
> = {
  [REGISTRATION_CODE_STATUS.ENABLED]: {
    labelKey: 'Enabled',
    variant: 'success',
    value: REGISTRATION_CODE_STATUS.ENABLED,
    showDot: true,
  },
  [REGISTRATION_CODE_STATUS.DISABLED]: {
    labelKey: 'Disabled',
    variant: 'red',
    value: REGISTRATION_CODE_STATUS.DISABLED,
    showDot: true,
  },
} as const

export const REGISTRATION_CODE_FILTER_AVAILABILITY = {
  AVAILABLE: 'available',
  EXHAUSTED: 'exhausted',
  EXPIRED: 'expired',
  DISABLED: 'disabled',
} as const

export const REGISTRATION_CODE_PRODUCT_OPTIONS = [
  { label: 'novel_product', value: 'novel_product' },
]

export const REGISTRATION_CODE_VALIDATION = {
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 50,
  COUNT_MIN: 1,
  COUNT_MAX: 1000,
} as const

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load registration codes',
  SEARCH_FAILED: 'Failed to search registration codes',
  CREATE_FAILED: 'Failed to create registration code',
  UPDATE_FAILED: 'Failed to update registration code',
  DELETE_FAILED: 'Failed to delete registration code',
  BATCH_DELETE_FAILED: 'Failed to batch delete registration codes',
  BATCH_STATUS_FAILED: 'Failed to batch update registration code status',
  IMPORT_FAILED: 'Failed to import registration codes',
  NAME_LENGTH_INVALID: 'Name must be between {{min}} and {{max}} characters',
  COUNT_INVALID: 'Count must be between {{min}} and {{max}}',
} as const

export const SUCCESS_MESSAGES = {
  REGISTRATION_CODE_CREATED: 'Registration code created successfully',
  REGISTRATION_CODE_UPDATED: 'Registration code updated successfully',
  REGISTRATION_CODE_DELETED: 'Registration code deleted successfully',
  REGISTRATION_CODE_ENABLED: 'Registration code enabled successfully',
  REGISTRATION_CODE_DISABLED: 'Registration code disabled successfully',
  BATCH_DELETED: 'Selected registration codes deleted successfully',
  BATCH_STATUS_UPDATED: 'Batch status updated successfully',
  IMPORT_SUCCESS: 'Registration codes imported successfully',
} as const

import type { TFunction } from 'i18next'

export function getRegistrationCodeStatusOptions(t: TFunction) {
  return Object.values(REGISTRATION_CODE_STATUSES).map((config) => ({
    label: t(config.labelKey),
    value: String(config.value),
  }))
}

export function getRegistrationCodeFormErrorMessages(t: TFunction) {
  return {
    NAME_LENGTH_INVALID: t(ERROR_MESSAGES.NAME_LENGTH_INVALID, {
      min: REGISTRATION_CODE_VALIDATION.NAME_MIN_LENGTH,
      max: REGISTRATION_CODE_VALIDATION.NAME_MAX_LENGTH,
    }),
    COUNT_INVALID: t(ERROR_MESSAGES.COUNT_INVALID, {
      min: REGISTRATION_CODE_VALIDATION.COUNT_MIN,
      max: REGISTRATION_CODE_VALIDATION.COUNT_MAX,
    }),
  }
}
