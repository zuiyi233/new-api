import type { RegistrationCode } from '../types'

export const REGISTRATION_CODE_EXPORT_COLUMN_MAP = {
  id: { key: 'id', label: 'id' },
  name: { key: 'name', label: 'name' },
  code: { key: 'code', label: 'code' },
  status: { key: 'status', label: 'status' },
  product_key: { key: 'product_key', label: 'product_key' },
  batch_no: { key: 'batch_no', label: 'batch_no' },
  campaign_name: { key: 'campaign_name', label: 'campaign_name' },
  channel: { key: 'channel', label: 'channel' },
  source_platform: { key: 'source_platform', label: 'source_platform' },
  external_order_no: { key: 'external_order_no', label: 'external_order_no' },
  used_count: { key: 'used_count', label: 'used_count' },
  max_uses: { key: 'max_uses', label: 'max_uses' },
  expires_at: { key: 'expires_at', label: 'expires_at' },
  created_at: { key: 'created_at', label: 'created_at' },
} as const satisfies Record<
  RegistrationCodeExportColumnKey,
  {
    key: keyof RegistrationCode
    label: string
  }
>

export type RegistrationCodeExportColumnKey =
  keyof typeof REGISTRATION_CODE_EXPORT_COLUMN_MAP

export const REGISTRATION_CODE_EXPORT_ALL_COLUMNS_ORDER: RegistrationCodeExportColumnKey[] =
  [
    'id',
    'name',
    'code',
    'status',
    'product_key',
    'batch_no',
    'campaign_name',
    'channel',
    'source_platform',
    'external_order_no',
    'used_count',
    'max_uses',
    'expires_at',
    'created_at',
  ]

export const REGISTRATION_CODE_EXPORT_COMMON_COLUMNS: RegistrationCodeExportColumnKey[] =
  ['name', 'code', 'status', 'batch_no', 'used_count', 'max_uses', 'expires_at']

export const REGISTRATION_CODE_EXPORT_CODE_ONLY_COLUMNS: RegistrationCodeExportColumnKey[] =
  ['code']

export function buildRegistrationCodeExportColumns(
  keys: RegistrationCodeExportColumnKey[]
): Array<{ key: keyof RegistrationCode; label: string }> {
  const uniqueKeys = Array.from(new Set(keys))
  return uniqueKeys.map((key) => REGISTRATION_CODE_EXPORT_COLUMN_MAP[key])
}

