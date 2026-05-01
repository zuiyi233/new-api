import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { OrderClaim } from '@/features/order-claim'

export const Route = createFileRoute('/_authenticated/order-claim/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.USER) {
      throw redirect({
        to: '/403',
      })
    }
  },
  component: OrderClaim,
})
