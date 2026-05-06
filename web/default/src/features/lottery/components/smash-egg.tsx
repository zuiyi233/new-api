import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import type { LotteryPrize, LotteryTypeInfo } from '../api'
import { playLottery } from '../api'
import { localizeLotteryPrizeName } from '../lib/i18n'
import {
  getPrizeOutcomeSummary,
  getPrizeRangeLabel,
  getPrizeResultTitle,
} from '../lib/result'

interface SmashEggProps {
  typeInfo: LotteryTypeInfo
  onPlayComplete: () => void
}

const EGG_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32', '#45B7D1', '#96CEB4']

export function SmashEgg({ typeInfo, onPlayComplete }: SmashEggProps) {
  const { t } = useTranslation()
  const [selectedEgg, setSelectedEgg] = useState<number | null>(null)
  const [smashing, setSmashing] = useState(false)
  const [smashed, setSmashed] = useState(false)
  const [result, setResult] = useState<LotteryPrize | null>(null)
  const [quotaAwarded, setQuotaAwarded] = useState(0)
  const [showResult, setShowResult] = useState(false)

  const eggs = typeInfo.prizes.slice(0, 5).map((prize, i) => ({
    id: i,
    color: EGG_COLORS[i % EGG_COLORS.length],
    prize,
  }))

  const handleSelectEgg = useCallback(
    async (eggIndex: number) => {
      if (smashing || smashed) return
      if (!typeInfo.is_unlocked) {
        toast.error(t('This game is locked. Complete the requirements to unlock.'))
        return
      }
      if (typeInfo.remaining === 0) {
        toast.error(t('No remaining plays today'))
        return
      }

      setSelectedEgg(eggIndex)
      setSmashing(true)

      try {
        const res = await playLottery(typeInfo.type)
        if (res.success && res.data?.prize) {
          setResult(res.data.prize)
          setQuotaAwarded(res.data.quota_awarded)
          setTimeout(() => {
            setSmashed(true)
            setSmashing(false)
            setShowResult(true)
            onPlayComplete()
          }, 800)
        } else {
          setSmashing(false)
          setSelectedEgg(null)
          toast.error(res.message || t('Lottery play failed'))
        }
      } catch {
        setSmashing(false)
        setSelectedEgg(null)
        toast.error(t('Lottery play failed'))
      }
    },
    [smashing, smashed, typeInfo, onPlayComplete, t]
  )

  const handleReset = useCallback(() => {
    setSelectedEgg(null)
    setSmashing(false)
    setSmashed(false)
    setResult(null)
    setShowResult(false)
  }, [])

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
        {eggs.map((egg, index) => {
          const isSelected = selectedEgg === index
          const isSmashedEgg = isSelected && smashed

          return (
            <motion.button
              key={egg.id}
              onClick={() => handleSelectEgg(index)}
              disabled={smashing || smashed}
              className="group relative flex flex-col items-center"
              whileHover={!smashing && !smashed ? { scale: 1.1, y: -5 } : {}}
              whileTap={!smashing && !smashed ? { scale: 0.95 } : {}}
            >
              <motion.div
                animate={
                  isSelected && smashing
                    ? {
                        scale: [1, 1.2, 0.8, 1.1, 0],
                        rotate: [0, -10, 10, -5, 15],
                      }
                    : isSelected && smashed
                      ? { scale: 0, opacity: 0 }
                      : {}
                }
                transition={{ duration: 0.8 }}
                className="relative"
              >
                <div
                  className="flex h-20 w-16 items-center justify-center rounded-b-[50%] rounded-t-[40%] shadow-lg sm:h-24 sm:w-20"
                  style={{
                    background: `linear-gradient(135deg, ${egg.color}CC, ${egg.color})`,
                  }}
                >
                  <div className="absolute left-1 top-2 h-3 w-5 rounded-full bg-white/30" />
                  <div className="flex h-8 w-6 items-center justify-center rounded-full bg-white/20">
                    <span className="text-lg">🥚</span>
                  </div>
                </div>
              </motion.div>

              {isSmashedEgg && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.5, 1] }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <div className="text-2xl">💥</div>
                </motion.div>
              )}

              <motion.div
                className="mt-1 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100"
                style={{ color: egg.color }}
              >
                {localizeLotteryPrizeName(t, egg.prize)}
              </motion.div>
            </motion.button>
          )
        })}
      </div>

      <div className="flex flex-col items-center gap-2">
        {!smashed && (
          <p className="text-muted-foreground text-sm">
            {smashing ? t('Smashing...') : t('Tap an egg to smash it!')}
          </p>
        )}
        {typeInfo.daily_limit > 0 && (
          <p className="text-muted-foreground text-sm">
            {t('Remaining today')}: {Math.max(typeInfo.remaining, 0)}/{typeInfo.daily_limit}
          </p>
        )}
      </div>

      <AnimatePresence>
        {showResult && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-amber-400/50 bg-gradient-to-b from-amber-50 to-orange-50 p-6 shadow-xl dark:from-amber-950/30 dark:to-orange-950/30"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: 2 }}
            >
              <Sparkles className="h-8 w-8 text-amber-500" />
            </motion.div>
            <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400">
              {getPrizeResultTitle(t, result)}
            </h3>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-300">
              +{formatQuotaWithCurrency(quotaAwarded, {
                digitsLarge: 4,
                digitsSmall: 6,
                minimumNonZero: 0.000001,
              })}
            </p>
            <p className="text-muted-foreground text-sm">
              {getPrizeOutcomeSummary(t, result)}
            </p>
            <p className="text-muted-foreground text-xs">
              {t('Configured range')}: {getPrizeRangeLabel(t, result)}
            </p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={handleReset}>
              {t('Play Again')}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
