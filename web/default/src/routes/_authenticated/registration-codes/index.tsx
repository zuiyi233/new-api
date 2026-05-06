import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { RegistrationCodes } from '@/features/registration-codes'
import { REGISTRATION_CODE_STATUS_VALUES } from '@/features/registration-codes/constants'

const registrationCodesSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  filter: z.string().optional().catch(''),
  status: z.array(z.enum(REGISTRATION_CODE_STATUS_VALUES)).optional().catch([]),
  product_key: z.array(z.string()).optional().catch([]),
  channel: z.array(z.string()).optional().catch([]),
})

export const Route = createFileRoute('/_authenticated/registration-codes/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: registrationCodesSearchSchema,
  component: RegistrationCodes,
})
