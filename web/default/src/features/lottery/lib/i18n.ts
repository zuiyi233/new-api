import type { TFunction } from 'i18next'
import type { LotteryPrize, LotteryTypeInfo } from '../api'

const DEFAULT_TYPE_NAMES: Record<string, string> = {
  wheel: 'Lucky Wheel',
  scratch: 'Scratch Card',
  egg: 'Smash the Egg',
  shake: 'Shake & Win',
}

const DEFAULT_TYPE_DESCRIPTIONS: Record<string, string> = {
  wheel: 'Spin the wheel and win big prizes!',
  scratch: 'Scratch to reveal your hidden prize!',
  egg: 'Smash golden eggs for amazing rewards!',
  shake: 'Shake your device to win lucky prizes!',
}

function localizeText(
  t: TFunction<'translation', undefined>,
  value: string | undefined,
  fallback = ''
): string {
  if (!value) return fallback
  return t(value, { defaultValue: value })
}

export function localizeLotteryTypeName(
  t: TFunction<'translation', undefined>,
  typeInfo: LotteryTypeInfo
): string {
  const fallback = DEFAULT_TYPE_NAMES[typeInfo.type] ?? typeInfo.type
  return localizeText(t, typeInfo.name, t(fallback, { defaultValue: fallback }))
}

export function localizeLotteryTypeDescription(
  t: TFunction<'translation', undefined>,
  typeInfo: LotteryTypeInfo
): string {
  const fallback = DEFAULT_TYPE_DESCRIPTIONS[typeInfo.type] ?? ''
  return localizeText(
    t,
    typeInfo.description,
    fallback ? t(fallback, { defaultValue: fallback }) : ''
  )
}

export function localizeLotteryPrizeName(
  t: TFunction<'translation', undefined>,
  prize: LotteryPrize
): string {
  return localizeText(t, prize.name, prize.id)
}
