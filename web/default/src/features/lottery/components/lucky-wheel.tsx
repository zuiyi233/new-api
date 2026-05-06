import { useRef, useEffect, useState, useCallback } from 'react'
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

interface WheelProps {
  typeInfo: LotteryTypeInfo
  turnstileEnabled: boolean
  turnstileSiteKey: string
  onPlayComplete: () => void
}

const SEGMENT_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
]

export function LuckyWheel({ typeInfo, onPlayComplete }: WheelProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [result, setResult] = useState<LotteryPrize | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [quotaAwarded, setQuotaAwarded] = useState(0)
  const animFrameRef = useRef<number>(0)
  const prizes = typeInfo.prizes

  const drawWheel = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || prizes.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = Math.min(canvas.parentElement?.clientWidth || 340, 380)
    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`
    ctx.scale(dpr, dpr)

    const centerX = size / 2
    const centerY = size / 2
    const radius = size / 2 - 12
    const segmentAngle = (2 * Math.PI) / prizes.length

    ctx.clearRect(0, 0, size, size)

    ctx.save()
    ctx.translate(centerX, centerY)
    ctx.rotate((rotation * Math.PI) / 180)

    for (let i = 0; i < prizes.length; i++) {
      const startAngle = i * segmentAngle - Math.PI / 2
      const endAngle = startAngle + segmentAngle

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, radius, startAngle, endAngle)
      ctx.closePath()

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
      const color = prizes[i].color || SEGMENT_COLORS[i % SEGMENT_COLORS.length]
      gradient.addColorStop(0, color + '40')
      gradient.addColorStop(0.5, color + 'CC')
      gradient.addColorStop(1, color)
      ctx.fillStyle = gradient
      ctx.fill()

      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      ctx.save()
      ctx.rotate(startAngle + segmentAngle / 2)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 3

      const textRadius = radius * 0.65
      const localizedPrizeName = localizeLotteryPrizeName(t, prizes[i])
      const name = localizedPrizeName.length > 8
        ? localizedPrizeName.slice(0, 8) + '…'
        : localizedPrizeName
      ctx.font = `bold ${Math.max(11, size / 30)}px system-ui, sans-serif`
      ctx.fillText(name, textRadius, -4)

      const quotaText = formatQuotaWithCurrency(prizes[i].min_quota, { digitsLarge: 0 })
      ctx.font = `${Math.max(9, size / 38)}px system-ui, sans-serif`
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillText(quotaText, textRadius, 12)

      ctx.restore()
    }

    ctx.restore()

    ctx.beginPath()
    ctx.arc(centerX, centerY, 28, 0, 2 * Math.PI)
    const centerGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 28)
    centerGrad.addColorStop(0, '#fff')
    centerGrad.addColorStop(1, '#f0f0f0')
    ctx.fillStyle = centerGrad
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#333'
    ctx.font = `bold ${14}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('GO', centerX, centerY)

    ctx.beginPath()
    ctx.moveTo(centerX, 6)
    ctx.lineTo(centerX - 10, 0)
    ctx.lineTo(centerX + 10, 0)
    ctx.closePath()
    ctx.fillStyle = '#FF6B6B'
    ctx.fill()
  }, [prizes, rotation, t])

  useEffect(() => {
    drawWheel()
    const handleResize = () => drawWheel()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [drawWheel])

  const spinWheel = useCallback(
    async (targetPrizeIndex: number) => {
      const segmentAngle = 360 / prizes.length
      const targetAngle = 360 - (targetPrizeIndex * segmentAngle + segmentAngle / 2)
      const spins = 5 + Math.floor(Math.random() * 3)
      const totalRotation = spins * 360 + targetAngle
      const startRotation = rotation
      const duration = 4000
      const startTime = performance.now()

      const animate = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = 1 - Math.pow(1 - progress, 4)
        const currentRotation = startRotation + totalRotation * eased

        setRotation(currentRotation)

        if (progress < 1) {
          animFrameRef.current = requestAnimationFrame(animate)
        } else {
          setSpinning(false)
          setShowResult(true)
        }
      }

      animFrameRef.current = requestAnimationFrame(animate)
    },
    [prizes.length, rotation]
  )

  const handlePlay = useCallback(async () => {
    if (spinning) return
    if (!typeInfo.is_unlocked) {
      toast.error(t('This game is locked. Complete the requirements to unlock.'))
      return
    }
    if (typeInfo.remaining === 0) {
      toast.error(t('No remaining plays today'))
      return
    }

    setSpinning(true)
    setShowResult(false)
    setResult(null)

    try {
      const res = await playLottery(typeInfo.type)
      if (res.success && res.data?.prize) {
        setResult(res.data.prize)
        setQuotaAwarded(res.data.quota_awarded)
        const prizeIndex = prizes.findIndex((p) => p.id === res.data!.prize!.id)
        spinWheel(prizeIndex >= 0 ? prizeIndex : 0)
        onPlayComplete()
      } else {
        setSpinning(false)
        toast.error(res.message || t('Lottery play failed'))
      }
    } catch {
      setSpinning(false)
      toast.error(t('Lottery play failed'))
    }
  }, [spinning, typeInfo, prizes, spinWheel, onPlayComplete, t])

  useEffect(() => {
    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-full max-w-[380px]">
        <canvas ref={canvasRef} className="mx-auto cursor-pointer" onClick={handlePlay} />
        <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/10 to-transparent" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={handlePlay}
          disabled={spinning || !typeInfo.is_unlocked || typeInfo.remaining === 0}
          size="lg"
          className="rounded-full px-8 text-base font-bold shadow-lg"
        >
          {spinning ? t('Spinning...') : t('Spin the Wheel!')}
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
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
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
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => setShowResult(false)}
            >
              {t('Close')}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
