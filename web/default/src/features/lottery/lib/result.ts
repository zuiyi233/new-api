import type { TFunction } from 'i18next'
import { formatQuotaWithCurrency } from '@/lib/currency'
import type { LotteryPrize } from '../api'
import { localizeLotteryPrizeName } from './i18n'

export type CheckinTierLabel = 'basic' | 'medium' | 'advanced' | 'unknown'

function normalizeTier(tier: string | undefined): CheckinTierLabel {
  switch ((tier || '').toLowerCase()) {
    case 'basic':
      return 'basic'
    case 'medium':
      return 'medium'
    case 'advanced':
      return 'advanced'
    default:
      return 'unknown'
  }
}

export function getCheckinTierLabel(
  t: TFunction<'translation', undefined>,
  tier: string | undefined
): string {
  const normalizedTier = normalizeTier(tier)
  switch (normalizedTier) {
    case 'basic':
      return t('Low tier')
    case 'medium':
      return t('Mid tier')
    case 'advanced':
      return t('High tier')
    default:
      return t('Unknown tier')
  }
}

export function getPrizeGradeLabel(
  t: TFunction<'translation', undefined>,
  prize: LotteryPrize | null | undefined
): string {
  if (!prize) return t('Prize')
  return prize.is_grand_prize ? t('Grand Prize') : t('Regular Prize')
}

export function getPrizeResultTitle(
  t: TFunction<'translation', undefined>,
  prize: LotteryPrize | null | undefined
): string {
  if (!prize) return t('🎊 You Won!')
  return prize.is_grand_prize ? t('🎉 Grand Prize!') : t('🎊 You Won!')
}

export function getPrizeRangeLabel(
  t: TFunction<'translation', undefined>,
  prize: LotteryPrize | null | undefined
): string {
  if (!prize) return '-'
  const min = formatQuotaWithCurrency(prize.min_quota, {
    digitsLarge: 4,
    digitsSmall: 6,
    minimumNonZero: 0.000001,
  })
  const max = formatQuotaWithCurrency(prize.max_quota, {
    digitsLarge: 4,
    digitsSmall: 6,
    minimumNonZero: 0.000001,
  })
  return t('{{min}} ~ {{max}}', { min, max })
}

export function getPrizeOutcomeSummary(
  t: TFunction<'translation', undefined>,
  prize: LotteryPrize | null | undefined
): string {
  if (!prize) return '-'
  return t('{{grade}} · {{name}}', {
    grade: getPrizeGradeLabel(t, prize),
    name: localizeLotteryPrizeName(t, prize),
  })
}

