import { createFileRoute, redirect } from '@tanstack/react-router'
import { getStatus } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/lottery')({
  beforeLoad: async () => {
    const status = await getStatus()
    if (!status?.lottery_enabled) {
      throw redirect({ to: '/profile' })
    }
    throw redirect({
      to: '/welfare',
      search: { tab: 'lottery' },
    })
  },
})
