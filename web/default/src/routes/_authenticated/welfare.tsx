import { z } from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Welfare } from '@/features/welfare'
import { getStatus } from '@/lib/api'

const welfareSearchSchema = z.object({
  tab: z.enum(['checkin', 'lottery']).optional(),
})

export const Route = createFileRoute('/_authenticated/welfare')({
  validateSearch: welfareSearchSchema,
  beforeLoad: async () => {
    const status = await getStatus()
    const checkinEnabled = status?.checkin_enabled === true
    const lotteryEnabled = status?.lottery_enabled === true
    if (!checkinEnabled && !lotteryEnabled) {
      throw redirect({ to: '/profile' })
    }
  },
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()
  return <Welfare defaultTab={search.tab} />
}
