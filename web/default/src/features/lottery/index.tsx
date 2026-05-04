import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  CircleDot,
  Eraser,
  Egg,
  Smartphone,
  Lock,
  Trophy,
  History,
  Info,
  Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getLotteryStatus } from './api'
import type { LotteryTypeInfo } from './api'
import { LuckyWheel } from './components/lucky-wheel'
import { ScratchCard } from './components/scratch-card'
import { SmashEgg } from './components/smash-egg'
import { ShakeWin } from './components/shake-win'
import {
  localizeLotteryPrizeName,
  localizeLotteryTypeDescription,
  localizeLotteryTypeName,
} from './lib/i18n'
import { getCheckinTierLabel } from './lib/result'

const TYPE_ICONS: Record<string, React.ElementType> = {
  wheel: CircleDot,
  scratch: Eraser,
  egg: Egg,
  shake: Smartphone,
}

export default function LotteryPage() {
  const { t } = useTranslation()
  const [activeType, setActiveType] = useState<string>('wheel')
  const [rulesOpen, setRulesOpen] = useState(false)

  const {
    data: statusData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['lottery-status'],
    queryFn: async () => {
      const res = await getLotteryStatus()
      if (res.success && res.data) return res.data
      throw new Error(res.message || t('Failed to fetch lottery status'))
    },
    staleTime: 15000,
  })

  const handlePlayComplete = useCallback(() => {
    refetch()
  }, [refetch])

  const activeTypeInfo = statusData?.types?.find((t) => t.type === activeType)

  const renderGame = () => {
    if (!activeTypeInfo) return null
    if (!activeTypeInfo.is_unlocked) {
      return (
        <LockedGameCard
          typeInfo={activeTypeInfo}
          onUnlockInfo={() => setRulesOpen(true)}
        />
      )
    }

    switch (activeType) {
      case 'wheel':
        return <LuckyWheel typeInfo={activeTypeInfo} turnstileEnabled={false} turnstileSiteKey="" onPlayComplete={handlePlayComplete} />
      case 'scratch':
        return <ScratchCard typeInfo={activeTypeInfo} onPlayComplete={handlePlayComplete} />
      case 'egg':
        return <SmashEgg typeInfo={activeTypeInfo} onPlayComplete={handlePlayComplete} />
      case 'shake':
        return <ShakeWin typeInfo={activeTypeInfo} onPlayComplete={handlePlayComplete} />
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          >
            <Sparkles className="h-8 w-8 text-amber-500" />
          </motion.div>
          <p className="text-muted-foreground text-sm">{t('Loading lottery...')}</p>
        </div>
      </div>
    )
  }

  if (!statusData?.enabled) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Sparkles className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">{t('Lottery Not Available')}</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              {t('The lottery feature is currently not enabled. Please check back later.')}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {t('Lucky Lottery')}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {t('Try your luck and win amazing prizes!')}
            </p>
            {statusData?.checkin_tier && (
              <p className="text-muted-foreground mt-1 text-xs">
                {t('Current reward tier')}: {getCheckinTierLabel(t, statusData.checkin_tier)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setRulesOpen(true)}>
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
        <StatCard
          label={t('Total Plays')}
          value={String(statusData.total_plays || 0)}
          icon={History}
        />
        <StatCard
          label={t('Total Won')}
          value={formatQuotaWithCurrency(statusData.total_quota || 0, {
            digitsLarge: 4,
            digitsSmall: 6,
            minimumNonZero: 0.000001,
          })}
          icon={Trophy}
        />
        <StatCard
          label={t('Games Available')}
          value={String(statusData.types?.filter((t) => t.enabled).length || 0)}
          icon={Sparkles}
        />
      </div>

      <Card className="border-dashed border-amber-300/70 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="space-y-1 p-3">
          <p className="text-xs font-medium">
            {t('Prize display note')}: {t('The wheel sectors and draw result both follow your current check-in tier prize pool.')}
          </p>
          <p className="text-muted-foreground text-xs">
            {t('Actual reward note')}: {t('The amount shown with a plus sign is your actual reward this time; configured range shows the possible interval for that prize.')}
          </p>
          <p className="text-muted-foreground text-xs">
            {t('Total won note')}: {t('Total won is the sum of all historical awarded amounts, shown in the currently selected currency display mode.')}
          </p>
        </CardContent>
      </Card>

      <Tabs value={activeType} onValueChange={setActiveType}>
        <TabsList className="h-auto w-full flex-wrap gap-1 bg-muted/50 p-1.5">
          {statusData.types?.map((typeInfo) => {
            const Icon = TYPE_ICONS[typeInfo.type] || Sparkles
            return (
              <TabsTrigger
                key={typeInfo.type}
                value={typeInfo.type}
                disabled={!typeInfo.enabled}
                className={cn(
                  'gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm',
                  !typeInfo.is_unlocked && 'opacity-60'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs sm:text-sm">{localizeLotteryTypeName(t, typeInfo)}</span>
                {!typeInfo.is_unlocked && <Lock className="h-3 w-3 text-amber-500" />}
                {typeInfo.is_unlocked && typeInfo.remaining >= 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                    {typeInfo.remaining}
                  </Badge>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeType}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="overflow-hidden border-0 bg-gradient-to-b from-card to-card/50 shadow-lg">
            <CardHeader className="border-b bg-gradient-to-r from-amber-50/50 to-orange-50/50 pb-3 dark:from-amber-950/20 dark:to-orange-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = TYPE_ICONS[activeType] || Sparkles
                    return <Icon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  })()}
                  <CardTitle className="text-base font-semibold">
                    {activeTypeInfo ? localizeLotteryTypeName(t, activeTypeInfo) : ''}
                  </CardTitle>
                </div>
                {activeTypeInfo?.is_time_limited && (
                  <Badge variant="outline" className="border-amber-300 text-amber-600 dark:text-amber-400">
                    {t('Limited Time')}
                  </Badge>
                )}
              </div>
              {activeTypeInfo?.description && (
                <p className="text-muted-foreground text-sm">
                  {localizeLotteryTypeDescription(t, activeTypeInfo)}
                </p>
              )}
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {renderGame()}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>

      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              {t('Lottery Rules')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {statusData.types?.map((typeInfo) => {
              const Icon = TYPE_ICONS[typeInfo.type] || Sparkles
              return (
                <div key={typeInfo.type} className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <Icon className="h-4 w-4" />
                    {localizeLotteryTypeName(t, typeInfo)}
                    {!typeInfo.is_unlocked && (
                      <Badge variant="outline" className="border-amber-300 text-amber-600">
                        <Lock className="mr-1 h-3 w-3" />
                        {t('Locked')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground pl-6">
                    {localizeLotteryTypeDescription(t, typeInfo)}
                  </p>
                  <div className="text-muted-foreground pl-6 text-xs">
                    {typeInfo.daily_limit > 0 && (
                      <p>• {t('Daily limit')}: {typeInfo.daily_limit} {t('plays')}</p>
                    )}
                    {typeInfo.unlock_mode !== 'none' && (
                      <p>• {t('Unlock requirement')}: {
                        typeInfo.unlock_mode === 'balance_quota'
                          ? t('Account balance reaches {{amount}}', { amount: formatQuotaWithCurrency(typeInfo.unlock_value, {
                              digitsLarge: 4,
                              digitsSmall: 6,
                              minimumNonZero: 0.000001,
                            }) })
                          : 
                        typeInfo.unlock_mode === 'total_checkins'
                          ? t('{{count}} total check-ins', { count: typeInfo.unlock_value })
                          : t('Not configured')
                      }</p>
                    )}
                    <p>
                      • {t('Prizes')}:{' '}
                      {typeInfo.prizes.map((p) => localizeLotteryPrizeName(t, p)).join(', ')}
                    </p>
                  </div>
                </div>
              )
            })}
            <div className="border-t pt-3">
              <p className="text-muted-foreground text-xs">
                {t('All prizes are randomly awarded based on configured probabilities. Results are final and cannot be changed.')}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <Card className="border-0 bg-gradient-to-br from-card to-card/80 shadow-sm">
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
          <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tabular-nums sm:text-base">{value}</p>
          <p className="text-muted-foreground text-[10px] sm:text-xs">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function LockedGameCard({ typeInfo, onUnlockInfo }: { typeInfo: LotteryTypeInfo; onUnlockInfo: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30"
      >
        <Lock className="h-8 w-8 text-amber-500" />
      </motion.div>
      <div className="text-center">
        <h3 className="text-lg font-semibold">{t('Game Locked')}</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          {typeInfo.unlock_mode === 'balance_quota'
            ? t('Reach account balance {{amount}} to unlock', {
                amount: formatQuotaWithCurrency(typeInfo.unlock_value, {
                  digitsLarge: 4,
                  digitsSmall: 6,
                  minimumNonZero: 0.000001,
                }),
              })
            : typeInfo.unlock_mode === 'total_checkins'
            ? t('Complete {{count}} check-ins to unlock', { count: typeInfo.unlock_value })
            : t('This game is not available yet')}
        </p>
      </div>
      <Button variant="outline" size="sm" className="rounded-full" onClick={onUnlockInfo}>
        {t('View Requirements')}
      </Button>
    </div>
  )
}
