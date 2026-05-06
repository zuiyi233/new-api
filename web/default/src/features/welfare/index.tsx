import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift, Trophy } from 'lucide-react'
import { SectionPageLayout } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useStatus } from '@/hooks/use-status'
import LotteryPage from '@/features/lottery'
import { CheckinCalendarCard } from '@/features/profile/components/checkin-calendar-card'

interface WelfareProps {
  defaultTab?: 'checkin' | 'lottery'
}

function resolvePreferredTab(
  preferred: 'checkin' | 'lottery',
  checkinEnabled: boolean,
  lotteryEnabled: boolean
): 'checkin' | 'lottery' {
  if (preferred === 'lottery') {
    return lotteryEnabled ? 'lottery' : 'checkin'
  }
  return checkinEnabled ? 'checkin' : 'lottery'
}

export function Welfare({ defaultTab = 'checkin' }: WelfareProps) {
  const { t } = useTranslation()
  const { status } = useStatus()

  const checkinEnabled = status?.checkin_enabled === true
  const lotteryEnabled = status?.lottery_enabled === true
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''

  const [activeTab, setActiveTab] = useState<'checkin' | 'lottery'>('checkin')

  useEffect(() => {
    setActiveTab(resolvePreferredTab(defaultTab, checkinEnabled, lotteryEnabled))
  }, [defaultTab, checkinEnabled, lotteryEnabled])

  const canShowCheckinTab = checkinEnabled
  const canShowLotteryTab = lotteryEnabled

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Welfare Activities')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Complete daily check-ins and lottery draws to claim your rewards.')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'checkin' | 'lottery')}
        >
          <TabsList className='mb-4 h-auto w-full justify-start gap-1 bg-muted/40 p-1'>
            {canShowCheckinTab && (
              <TabsTrigger value='checkin' className='gap-1.5'>
                <Gift className='h-4 w-4' />
                {t('Daily Check-in')}
              </TabsTrigger>
            )}
            {canShowLotteryTab && (
              <TabsTrigger value='lottery' className='gap-1.5'>
                <Trophy className='h-4 w-4' />
                {t('Lottery')}
              </TabsTrigger>
            )}
          </TabsList>

          {canShowCheckinTab ? (
            <TabsContent value='checkin' className='mt-0'>
              <CheckinCalendarCard
                checkinEnabled
                turnstileEnabled={turnstileEnabled}
                turnstileSiteKey={turnstileSiteKey}
              />
            </TabsContent>
          ) : null}

          {canShowLotteryTab ? (
            <TabsContent value='lottery' className='mt-0'>
              <LotteryPage />
            </TabsContent>
          ) : null}
        </Tabs>

        {!checkinEnabled && !lotteryEnabled ? (
          <Card>
            <CardContent className='p-8 text-center'>
              <p className='text-muted-foreground text-sm'>
                {t('Welfare activities are currently unavailable.')}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
