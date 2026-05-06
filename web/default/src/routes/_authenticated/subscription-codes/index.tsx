import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { SubscriptionCodes } from '@/features/subscription-codes'
import { SUBSCRIPTION_CODE_STATUS_VALUES } from '@/features/subscription-codes/constants'

const subscriptionCodesSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  filter: z.string().optional().catch(''),
  status: z.array(z.enum(SUBSCRIPTION_CODE_STATUS_VALUES)).optional().catch([]),
  product_key: z.array(z.string()).optional().catch([]),
  channel: z.array(z.string()).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/subscription-codes/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: subscriptionCodesSearchSchema,
  component: SubscriptionCodes,
})
