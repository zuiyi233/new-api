import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { History } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SectionPageLayout } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { getCodeCenterStats } from './api'
import { OperationHistoryDialog } from './components/operation-history-dialog'

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
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyCodeType, setHistoryCodeType] = useState('redemption')

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
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='text-lg font-semibold'>
                {t('Registration Codes')}
              </h3>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setHistoryCodeType('redemption')
                  setHistoryOpen(true)
                }}
              >
                <History className='mr-1 h-4 w-4' />
                {t('Operation History')}
              </Button>
            </div>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
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
            </div>
          </div>

          <div>
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='text-lg font-semibold'>
                {t('Subscription Codes')}
              </h3>
              <Button
                variant='outline'
                size='sm'
                onClick={() => {
                  setHistoryCodeType('subscription_code')
                  setHistoryOpen(true)
                }}
              >
                <History className='mr-1 h-4 w-4' />
                {t('Operation History')}
              </Button>
            </div>
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
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
            </div>
          </div>
        </div>
      </SectionPageLayout.Content>

      <OperationHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        codeType={historyCodeType}
      />
    </SectionPageLayout>
  )
}
