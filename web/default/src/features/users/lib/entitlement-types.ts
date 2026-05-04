import { z } from 'zod'

export const entitlementSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_key: z.string(),
  status: z.number(),
  source_type: z.string(),
  source_id: z.number(),
  granted_at: z.number(),
  expires_at: z.number(),
  notes: z.string(),
  updated_at: z.number(),
})

export type Entitlement = z.infer<typeof entitlementSchema>

export const ENTITLEMENT_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
} as const

export interface GetEntitlementsResponse {
  success: boolean
  message?: string
  data?: {
    user_id: number
    items: Entitlement[]
  }
}

export interface AddEntitlementPayload {
  product_key: string
  status: number
  expires_at: number
  notes: string
}

export interface UpdateEntitlementPayload {
  id: number
  status: number
  expires_at: number
  notes: string
}
