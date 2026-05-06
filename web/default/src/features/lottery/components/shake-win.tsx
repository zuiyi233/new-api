import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Sparkles, Smartphone } from 'lucide-react'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import type { LotteryPrize, LotteryTypeInfo } from '../api'
import { playLottery } from '../api'
import {
  getPrizeOutcomeSummary,
  getPrizeRangeLabel,
  getPrizeResultTitle,
} from '../lib/result'

interface ShakeWinProps {
  typeInfo: LotteryTypeInfo
  onPlayComplete: () => void
}

export function ShakeWin({ typeInfo, onPlayComplete }: ShakeWinProps) {
  const { t } = useTranslation()
  const [shaking, setShaking] = useState(false)
  const [result, setResult] = useState<LotteryPrize | null>(null)
  const [quotaAwarded, setQuotaAwarded] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const shakeCountRef = useRef(0)
  const lastShakeTimeRef = useRef(0)

  useEffect(() => {
    let mounted = true

    const handleMotion = (event: DeviceMotionEvent) => {
      if (!mounted || shaking || isDrawing) return
      const acc = event.accelerationIncludingGravity
      if (!acc || acc.x === null || acc.y === null || acc.z === null) return

      const total = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z)
      const now = Date.now()

      if (total > 25 && now - lastShakeTimeRef.current > 300) {
        lastShakeTimeRef.current = now
        shakeCountRef.current += 1

        if (shakeCountRef.current >= 3) {
          shakeCountRef.current = 0
          handleShake()
        }
      }
    }

    window.addEventListener('devicemotion', handleMotion)
    return () => {
      mounted = false
      window.removeEventListener('devicemotion', handleMotion)
    }
  }, [shaking, isDrawing])

  const handleShake = useCallback(async () => {
    if (shaking || isDrawing) return
    if (!typeInfo.is_unlocked) {
      toast.error(t('This game is locked. Complete the requirements to unlock.'))
      return
    }
    if (typeInfo.remaining === 0) {
      toast.error(t('No remaining plays today'))
      return
    }

    setShaking(true)
    setIsDrawing(true)

    try {
      const res = await playLottery(typeInfo.type)
      if (res.success && res.data?.prize) {
        setResult(res.data.prize)
        setQuotaAwarded(res.data.quota_awarded)
        setTimeout(() => {
          setShaking(false)
          setShowResult(true)
          setIsDrawing(false)
          onPlayComplete()
        }, 1500)
      } else {
        setShaking(false)
        setIsDrawing(false)
        toast.error(res.message || t('Lottery play failed'))
      }
    } catch {
      setShaking(false)
      setIsDrawing(false)
      toast.error(t('Lottery play failed'))
    }
  }, [shaking, isDrawing, typeInfo, onPlayComplete, t])

  const handleReset = useCallback(() => {
    setResult(null)
    setShowResult(false)
    setShaking(false)
    setIsDrawing(false)
    shakeCountRef.current = 0
  }, [])

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={
            shaking
              ? {
                  x: [0, -12, 12, -8, 8, -4, 4, 0],
                  y: [0, -4, 4, -2, 2, -1, 1, 0],
                  rotate: [0, -5, 5, -3, 3, -1, 1, 0],
                }
              : {}
          }
          transition={
            shaking
              ? { duration: 0.6, repeat: Infinity, repeatType: 'loop' }
              : {}
          }
          className="relative"
        >
          <motion.div
            animate={shaking ? { scale: [1, 1.05, 0.95, 1.02, 1] } : {}}
            transition={{ duration: 0.4, repeat: Infinity }}
            className="flex h-40 w-40 flex-col items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500 shadow-2xl sm:h-48 sm:w-48"
          >
            <Smartphone className="mb-2 h-12 w-12 text-white/90 sm:h-14 sm:w-14" />
            <span className="text-lg font-bold text-white sm:text-xl">
              {shaking ? t('Shaking...') : t('Shake!')}
            </span>
          </motion.div>

          {shaking && (
            <>
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 1, scale: 0 }}
                  animate={{
                    opacity: 0,
                    scale: 2,
                    x: Math.cos((i * Math.PI) / 4) * 80,
                    y: Math.sin((i * Math.PI) / 4) * 80,
                  }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }}
                  className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    background: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1'][i % 4],
                  }}
                />
              ))}
            </>
          )}
        </motion.div>

        <div className="text-center">
          <p className="text-muted-foreground text-sm">
            {shaking
              ? t('Shake it harder!')
              : t('Click the button or shake your device!')}
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={handleShake}
          disabled={shaking || !typeInfo.is_unlocked || typeInfo.remaining === 0}
          size="lg"
          className="rounded-full px-8 text-base font-bold shadow-lg"
        >
          {shaking ? t('Shaking...') : t('Shake & Win!')}
        </Button>
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
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-purple-400/50 bg-gradient-to-b from-violet-50 to-fuchsia-50 p-6 shadow-xl dark:from-violet-950/30 dark:to-fuchsia-950/30"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6, repeat: 2 }}
            >
              <Sparkles className="h-8 w-8 text-purple-500" />
            </motion.div>
            <h3 className="text-lg font-bold text-purple-700 dark:text-purple-400">
              {getPrizeResultTitle(t, result)}
            </h3>
            <p className="text-2xl font-black text-purple-600 dark:text-purple-300">
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
