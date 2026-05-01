import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionPageLayout } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { getCodeCenterStats } from './api'

function StatCard({
  title,
  value,
  isLoading,
}: {
  title: string
  value: number
  isLoading: boolean
}) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className='h-8 w-20' />
        ) : (
          <div className='text-2xl font-bold'>{value}</div>
        )}
      </CardContent>
    </Card>
  )
}

export function CodeCenter() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['code-center-stats'],
    queryFn: async () => {
      const result = await getCodeCenterStats()
      return result.data
    },
  })

  const regStats = data?.registration_codes
  const subStats = data?.subscription_codes

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Code Center')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Overview of all registration and subscription codes')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='space-y-8'>
          <div>
            <h3 className='mb-4 text-lg font-semibold'>
              {t('Registration Codes')}
            </h3>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-5'>
              <StatCard
                title={t('Total')}
                value={regStats?.total || 0}
                isLoading={isLoading}
              />
              <StatCard
                title={t('Enabled')}
                value={regStats?.enabled || 0}
                isLoading={isLoading}
              />
              <StatCard
                title={t('Disabled')}
                value={regStats?.disabled || 0}
                isLoading={isLoading}
              />
              <StatCard
                title={t('Used')}
                value={regStats?.used || 0}
                isLoading={isLoading}
              />
              <StatCard
                title={t('Expired')}
                value={regStats?.expired || 0}
                isLoading={isLoading}
              />
            </div>
          </div>

          <div>
            <h3 className='mb-4 text-lg font-semibold'>
              {t('Subscription Codes')}
            </h3>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-5'>
              <StatCard
                title={t('Total')}
                value={subStats?.total || 0}
                isLoading={isLoading}
              />
              <StatCard
                title={t('Enabled')}
                value={subStats?.enabled || 0}
                isLoading={isLoading}
              />
              <StatCard
                title={t('Disabled')}
                value={subStats?.disabled || 0}
                isLoading={isLoading}
              />
              <StatCard
                title={t('Used')}
                value={subStats?.used || 0}
                isLoading={isLoading}
              />
              <StatCard
                title={t('Expired')}
                value={subStats?.expired || 0}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
