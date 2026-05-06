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

interface ScratchCardProps {
  typeInfo: LotteryTypeInfo
  onPlayComplete: () => void
}

export function ScratchCard({ typeInfo, onPlayComplete }: ScratchCardProps) {
  const { t } = useTranslation()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isScratching, setIsScratching] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [result, setResult] = useState<LotteryPrize | null>(null)
  const [quotaAwarded, setQuotaAwarded] = useState(0)
  const [isDrawing, setIsDrawing] = useState(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  const drawCover = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = Math.min(canvas.parentElement?.clientWidth || 320, 360)
    const height = 200
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, '#C0C0C0')
    gradient.addColorStop(0.3, '#D8D8D8')
    gradient.addColorStop(0.5, '#E8E8E8')
    gradient.addColorStop(0.7, '#D8D8D8')
    gradient.addColorStop(1, '#C0C0C0')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(180,180,180,${Math.random() * 0.3})`
      ctx.fillRect(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 3,
        Math.random() * 3
      )
    }

    ctx.fillStyle = '#888'
    ctx.font = 'bold 18px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(t('Scratch here!'), width / 2, height / 2)
  }, [t])

  useEffect(() => {
    if (!revealed) {
      drawCover()
    }
  }, [drawCover, revealed])

  const getScratchPercent = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const ctx = canvas.getContext('2d')
    if (!ctx) return 0
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = imageData.data
    let transparent = 0
    const total = pixels.length / 4
    for (let i = 3; i < pixels.length; i += 4) {
      if (pixels[i] === 0) transparent++
    }
    return (transparent / total) * 100
  }, [])

  const scratch = useCallback((x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()

    if (lastPosRef.current) {
      ctx.lineWidth = 40
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
      ctx.lineTo(x, y)
      ctx.stroke()
    } else {
      ctx.arc(x, y, 20, 0, Math.PI * 2)
      ctx.fill()
    }

    lastPosRef.current = { x, y }
    ctx.globalCompositeOperation = 'source-over'

    const percent = getScratchPercent()

    if (percent > 50 && !revealed) {
      setRevealed(true)
    }
  }, [getScratchPercent, revealed])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (revealed || isDrawing) return
    setIsScratching(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const x = (e.clientX - rect.left) * dpr
    const y = (e.clientY - rect.top) * dpr
    lastPosRef.current = null
    scratch(x / dpr, y / dpr)
  }, [revealed, isDrawing, scratch])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScratching || revealed || isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const x = (e.clientX - rect.left) * dpr
    const y = (e.clientY - rect.top) * dpr
    scratch(x / dpr, y / dpr)
  }, [isScratching, revealed, isDrawing, scratch])

  const handlePointerUp = useCallback(() => {
    setIsScratching(false)
    lastPosRef.current = null
  }, [])

  const handleDraw = useCallback(async () => {
    if (isDrawing || revealed) return
    if (!typeInfo.is_unlocked) {
      toast.error(t('This game is locked. Complete the requirements to unlock.'))
      return
    }
    if (typeInfo.remaining === 0) {
      toast.error(t('No remaining plays today'))
      return
    }

    setIsDrawing(true)

    try {
      const res = await playLottery(typeInfo.type)
      if (res.success && res.data?.prize) {
        setResult(res.data.prize)
        setQuotaAwarded(res.data.quota_awarded)
        onPlayComplete()
      } else {
        toast.error(res.message || t('Lottery play failed'))
        setIsDrawing(false)
      }
    } catch {
      toast.error(t('Lottery play failed'))
      setIsDrawing(false)
    }
  }, [isDrawing, revealed, typeInfo, onPlayComplete, t])

  const handleReset = useCallback(() => {
    setResult(null)
    setRevealed(false)
    setIsDrawing(false)
    lastPosRef.current = null
    drawCover()
  }, [drawCover])

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-full max-w-[360px]">
        <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-amber-950/20 dark:via-orange-950/20 dark:to-yellow-950/20">
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex h-[200px] flex-col items-center justify-center gap-2 p-6"
              >
                <motion.div
                  animate={revealed ? { rotate: [0, -15, 15, -15, 0], scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.5 }}
                >
                  <Sparkles className="h-8 w-8 text-amber-500" />
                </motion.div>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400">
                  {localizeLotteryPrizeName(t, result)}
                </p>
                <p className="text-3xl font-black text-amber-600 dark:text-amber-300">
                  +{formatQuotaWithCurrency(quotaAwarded, {
                    digitsLarge: 4,
                    digitsSmall: 6,
                    minimumNonZero: 0.000001,
                  })}
                </p>
                <motion.p
                  animate={result.is_grand_prize ? { scale: [1, 1.1, 1] } : {}}
                  transition={result.is_grand_prize ? { repeat: Infinity, duration: 0.8 } : {}}
                  className="text-sm font-bold text-red-500"
                >
                  {getPrizeResultTitle(t, result)}
                </motion.p>
                <p className="text-muted-foreground text-xs">
                  {getPrizeOutcomeSummary(t, result)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t('Configured range')}: {getPrizeRangeLabel(t, result)}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!revealed && (
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 z-10 ${isDrawing ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              onPointerDown={isDrawing ? handlePointerDown : undefined}
              onPointerMove={isDrawing ? handlePointerMove : undefined}
              onPointerUp={isDrawing ? handlePointerUp : undefined}
              onPointerLeave={isDrawing ? handlePointerUp : undefined}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        {!isDrawing && !revealed && (
          <Button
            onClick={handleDraw}
            disabled={!typeInfo.is_unlocked || typeInfo.remaining === 0}
            size="lg"
            className="rounded-full px-8 text-base font-bold shadow-lg"
          >
            {t('Get Scratch Card')}
          </Button>
        )}
        {isDrawing && !revealed && (
          <p className="text-muted-foreground animate-pulse text-sm">
            👆 {t('Scratch the card to reveal your prize!')}
          </p>
        )}
        {revealed && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={handleReset}>
            {t('Play Again')}
          </Button>
        )}
        {typeInfo.daily_limit > 0 && (
          <p className="text-muted-foreground text-sm">
            {t('Remaining today')}: {Math.max(typeInfo.remaining, 0)}/{typeInfo.daily_limit}
          </p>
        )}
      </div>
    </div>
  )
}
