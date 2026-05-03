import { useEffect, useMemo } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const checkinRewardRuleOptions = [
  {
    value: 'highest_eligible',
    labelKey: 'Highest eligible tier',
  },
  {
    value: 'lowest_eligible',
    labelKey: 'Lowest eligible tier',
  },
] as const

type CheckinRewardRule = (typeof checkinRewardRuleOptions)[number]['value']

type RewardBand = {
  min_quota: number
  max_quota: number
  weight: number
}

const schema = z
  .object({
    enabled: z.boolean(),

    entryMinBalanceQuota: z.coerce.number().min(0),
    entryMaxBalanceQuota: z.coerce.number().min(0),
    entryMinQuota: z.coerce.number().min(0),
    entryMaxQuota: z.coerce.number().min(0),
    entryRewardBands: z
      .array(
        z.object({
          min_quota: z.coerce.number().min(0),
          max_quota: z.coerce.number().min(0),
          weight: z.coerce.number().int().min(1),
        })
      )
      .min(1)
      .max(20),

    minQuota: z.coerce.number().min(0),
    maxQuota: z.coerce.number().min(0),
    basicMinBalanceQuota: z.coerce.number().min(0),
    basicMaxBalanceQuota: z.coerce.number().min(0),
    basicRewardBands: z
      .array(
        z.object({
          min_quota: z.coerce.number().min(0),
          max_quota: z.coerce.number().min(0),
          weight: z.coerce.number().int().min(1),
        })
      )
      .min(1)
      .max(20),

    advancedEnabled: z.boolean(),
    advancedMinBalanceQuota: z.coerce.number().min(0),
    advancedMaxBalanceQuota: z.coerce.number().min(0),
    advancedMinQuota: z.coerce.number().min(0),
    advancedMaxQuota: z.coerce.number().min(0),
    advancedRewardBands: z
      .array(
        z.object({
          min_quota: z.coerce.number().min(0),
          max_quota: z.coerce.number().min(0),
          weight: z.coerce.number().int().min(1),
        })
      )
      .min(1)
      .max(20),

    minIntervalHours: z.coerce.number().int().min(0),
    weeklyRewardCapQuota: z.coerce.number().min(0),
    rewardRule: z.enum(['highest_eligible', 'lowest_eligible']),
  })
  .superRefine((values, ctx) => {
    for (const rule of tierValidationRules) {
      if (!rule.check(values)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: rule.message,
          path: rule.path,
        })
      }
    }
  })

type Values = z.infer<typeof schema>

type TierValidationRule = {
  check: (values: Values) => boolean
  message: string
  path: [string]
}

function createRewardRangeRule(
  tierLabel: string,
  minKey: keyof Values,
  maxKey: keyof Values,
  enabledKey?: keyof Values
): TierValidationRule {
  return {
    check: (values) => {
      if (enabledKey && !values[enabledKey]) return true
      return (values[maxKey] as number) >= (values[minKey] as number)
    },
    message: `${tierLabel} tier max reward must be greater than or equal to min reward`,
    path: [maxKey as string],
  }
}

function createBalanceRangeRule(
  tierLabel: string,
  minKey: keyof Values,
  maxKey: keyof Values,
  enabledKey?: keyof Values
): TierValidationRule {
  return {
    check: (values) => {
      if (enabledKey && !values[enabledKey]) return true
      const max = values[maxKey] as number
      return max === 0 || max >= (values[minKey] as number)
    },
    message: `${tierLabel} tier max balance must be greater than or equal to min balance (or 0 for unlimited)`,
    path: [maxKey as string],
  }
}

function createBalanceOrderRule(
  tierLabel: string,
  lowerTierLabel: string,
  tierMinKey: keyof Values,
  lowerMinKey: keyof Values,
  enabledKey?: keyof Values
): TierValidationRule {
  return {
    check: (values) => {
      if (enabledKey && !values[enabledKey]) return true
      return (values[tierMinKey] as number) >= (values[lowerMinKey] as number)
    },
    message: `${tierLabel} tier minimum balance should not be lower than ${lowerTierLabel} tier minimum balance`,
    path: [tierMinKey as string],
  }
}

const tierValidationRules: TierValidationRule[] = [
  createRewardRangeRule('Entry', 'entryMinQuota', 'entryMaxQuota'),
  createBalanceRangeRule('Entry', 'entryMinBalanceQuota', 'entryMaxBalanceQuota'),
  createRewardRangeRule('Basic', 'minQuota', 'maxQuota'),
  createBalanceRangeRule('Basic', 'basicMinBalanceQuota', 'basicMaxBalanceQuota'),
  createBalanceOrderRule('Basic', 'entry', 'basicMinBalanceQuota', 'entryMinBalanceQuota'),
  createRewardRangeRule('Advanced', 'advancedMinQuota', 'advancedMaxQuota', 'advancedEnabled'),
  createBalanceRangeRule('Advanced', 'advancedMinBalanceQuota', 'advancedMaxBalanceQuota', 'advancedEnabled'),
  createBalanceOrderRule('Advanced', 'basic', 'advancedMinBalanceQuota', 'basicMinBalanceQuota', 'advancedEnabled'),
]

type CheckinDefaultValues = {
  enabled: boolean
  entryMinBalanceQuota: number
  entryMaxBalanceQuota: number
  entryMinQuota: number
  entryMaxQuota: number
  entryRewardBands: string
  minQuota: number
  maxQuota: number
  basicMinBalanceQuota: number
  basicMaxBalanceQuota: number
  basicRewardBands: string
  advancedEnabled: boolean
  advancedMinBalanceQuota: number
  advancedMaxBalanceQuota: number
  advancedMinQuota: number
  advancedMaxQuota: number
  advancedRewardBands: string
  minIntervalHours: number
  weeklyRewardCapQuota: number
  rewardRule: string
}

const DEFAULT_ENTRY_BANDS: RewardBand[] = [
  { min_quota: 0.01, max_quota: 0.05, weight: 72 },
  { min_quota: 0.05, max_quota: 0.12, weight: 23 },
  { min_quota: 0.12, max_quota: 0.2, weight: 5 },
]

const DEFAULT_BASIC_BANDS: RewardBand[] = [
  { min_quota: 0.05, max_quota: 0.2, weight: 70 },
  { min_quota: 0.2, max_quota: 0.6, weight: 25 },
  { min_quota: 0.6, max_quota: 1, weight: 5 },
]

const DEFAULT_ADVANCED_BANDS: RewardBand[] = [
  { min_quota: 0.5, max_quota: 1.5, weight: 65 },
  { min_quota: 1.5, max_quota: 3, weight: 30 },
  { min_quota: 3, max_quota: 5, weight: 5 },
]

function normalizeRewardRule(value: string): CheckinRewardRule {
  if (value === 'lowest_eligible') {
    return 'lowest_eligible'
  }
  return 'highest_eligible'
}

function toAmount(value: unknown, fallback = 0): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  if (numeric < 0) return 0
  return Math.round(numeric * 10000) / 10000
}

function toInt(value: unknown, fallback = 0): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  if (numeric < 0) return 0
  return Math.floor(numeric)
}

function normalizeBandRows(rows: unknown, fallbackRows: RewardBand[]): RewardBand[] {
  if (!Array.isArray(rows)) {
    return structuredClone(fallbackRows)
  }
  const normalized = rows
    .map((row) => {
      const record = (row ?? {}) as Record<string, unknown>
      const minQuota = toAmount(record.min_quota, 0)
      const maxQuotaRaw = toAmount(record.max_quota, minQuota)
      const weightRaw = toInt(record.weight, 1)
      const maxQuota = maxQuotaRaw < minQuota ? minQuota : maxQuotaRaw
      const weight = weightRaw <= 0 ? 1 : weightRaw
      return {
        min_quota: minQuota,
        max_quota: maxQuota,
        weight,
      }
    })
    .slice(0, 20)

  if (!normalized.length) {
    return structuredClone(fallbackRows)
  }
  return normalized
}

function parseBandRows(raw: string, fallbackRows: RewardBand[]): RewardBand[] {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return structuredClone(fallbackRows)
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    return normalizeBandRows(parsed, fallbackRows)
  } catch {
    return structuredClone(fallbackRows)
  }
}

function stringifyBandRows(rows: RewardBand[]): string {
  return JSON.stringify(rows)
}

function formatAmount(value: unknown): string {
  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return '0'
  }
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  })
}

function getProbabilityTag(percent: number): string {
  if (percent >= 50) return 'High'
  if (percent >= 20) return 'Common'
  if (percent >= 8) return 'Medium'
  if (percent >= 3) return 'Rare'
  return 'Very Rare'
}

function getProbabilityCountHint(
  percent: number,
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const count100 = Math.round(percent)
  if (count100 <= 0) return t('Less than 1 per 100 check-ins')
  return t('About {{count}} per 100 check-ins', { count: count100 })
}

function asStringNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0'
  }
  return String(value)
}

function RewardBandEditor({
  title,
  tierKey,
  bands,
  disabled,
  colorClassName,
  onChange,
  t,
}: {
  title: string
  tierKey: 'entry' | 'basic' | 'advanced'
  bands: RewardBand[]
  disabled: boolean
  colorClassName: string
  onChange: (rows: RewardBand[]) => void
  t: (key: string, options?: Record<string, unknown>) => string
}) {
  const totalWeight = bands.reduce((sum, row) => sum + (Number(row.weight) || 0), 0)

  const updateRow = (
    index: number,
    field: 'min_quota' | 'max_quota' | 'weight',
    value: string
  ) => {
    const nextRows = bands.map((row) => ({ ...row }))
    if (!nextRows[index]) return
    if (field === 'weight') {
      nextRows[index][field] = toInt(value, nextRows[index][field])
    } else {
      nextRows[index][field] = toAmount(value, nextRows[index][field])
    }
    if (nextRows[index].max_quota < nextRows[index].min_quota) {
      nextRows[index].max_quota = nextRows[index].min_quota
    }
    onChange(nextRows)
  }

  const addRow = () => {
    if (bands.length >= 20) {
      toast.warning(t('A maximum of 20 reward bands is allowed'))
      return
    }
    const lastRow = bands[bands.length - 1] ?? {
      min_quota: 0,
      max_quota: 0,
      weight: 1,
    }
    onChange([
      ...bands,
      {
        min_quota: lastRow.min_quota,
        max_quota: lastRow.max_quota,
        weight: 1,
      },
    ])
  }

  const removeRow = (index: number) => {
    if (bands.length <= 1) {
      toast.warning(t('At least one reward band is required'))
      return
    }
    onChange(bands.filter((_, i) => i !== index))
  }

  return (
    <div className='space-y-3 rounded-lg border p-4'>
      <div className='flex items-center justify-between gap-3'>
        <h4 className='text-sm font-semibold'>{title}</h4>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={addRow}
          disabled={disabled}
        >
          <PlusIcon className='mr-2 h-4 w-4' />
          {t('Add reward band')}
        </Button>
      </div>

      <div className='bg-muted/30 space-y-3 rounded-lg border p-3'>
        <div className='text-sm font-medium'>
          {t('Visual probability preview (estimated over 100 check-ins)')}
        </div>

        <div className='space-y-2'>
          {bands.map((row, index) => {
            const weight = Number(row.weight) || 0
            const percent = totalWeight > 0 ? (weight * 100) / totalWeight : 0
            const itemColorClassName =
              tierKey === 'entry'
                ? 'text-sky-500'
                : tierKey === 'basic'
                  ? 'text-emerald-500'
                  : 'text-violet-500'
            return (
              <div key={`${tierKey}-preview-${index}`} className='space-y-1.5'>
                <div className='flex items-center justify-between text-xs'>
                  <div className='flex items-center gap-2'>
                    <span className={itemColorClassName}>●</span>
                    <span>
                      {t('Band {{index}}', { index: index + 1 })}:{' '}
                      {formatAmount(row.min_quota)} ~ {formatAmount(row.max_quota)}
                    </span>
                  </div>
                  <span className='text-muted-foreground'>
                    {percent.toFixed(2)}%
                  </span>
                </div>
                <Progress value={Math.max(0, Math.min(100, percent))} />
                <div className='text-muted-foreground flex items-center justify-between text-xs'>
                  <span>{t(getProbabilityTag(percent))}</span>
                  <span>{getProbabilityCountHint(percent, t)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className='space-y-3'>
        {bands.map((row, index) => {
          const weight = Number(row.weight) || 0
          const percent = totalWeight > 0 ? (weight * 100) / totalWeight : 0
          return (
            <div key={`${tierKey}-row-${index}`} className='space-y-3 rounded-lg border p-3'>
              <div className='grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]'>
                <FormItem>
                  <FormLabel>{t('Minimum reward')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step='0.01'
                      value={asStringNumber(row.min_quota)}
                      disabled={disabled}
                      onChange={(event) =>
                        updateRow(index, 'min_quota', event.target.value)
                      }
                    />
                  </FormControl>
                </FormItem>

                <FormItem>
                  <FormLabel>{t('Maximum reward')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      step='0.01'
                      value={asStringNumber(row.max_quota)}
                      disabled={disabled}
                      onChange={(event) =>
                        updateRow(index, 'max_quota', event.target.value)
                      }
                    />
                  </FormControl>
                </FormItem>

                <FormItem>
                  <FormLabel>{t('Weight')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      step='1'
                      value={asStringNumber(row.weight)}
                      disabled={disabled}
                      onChange={(event) =>
                        updateRow(index, 'weight', event.target.value)
                      }
                    />
                  </FormControl>
                </FormItem>

                <div className='flex items-end'>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => removeRow(index)}
                    disabled={disabled}
                    aria-label={t('Delete')}
                  >
                    <Trash2Icon className='text-destructive h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='space-y-1'>
                <div className='text-muted-foreground flex items-center justify-between text-xs'>
                  <span>
                    {t('Reward range')}: {formatAmount(row.min_quota)} ~{' '}
                    {formatAmount(row.max_quota)}
                  </span>
                  <span>
                    {t('Probability')}: {percent.toFixed(2)}%
                  </span>
                </div>
                <Progress
                  className={colorClassName}
                  value={Math.max(2, Math.min(100, percent))}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className='text-muted-foreground text-xs'>
        {t('Total weight')}: {totalWeight}
      </div>
    </div>
  )
}

export function CheckinSettingsSection({
  defaultValues,
}: {
  defaultValues: CheckinDefaultValues
}) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const normalizedDefaults = useMemo<Values>(
    () => ({
      enabled: defaultValues.enabled,
      entryMinBalanceQuota: toAmount(defaultValues.entryMinBalanceQuota, 0),
      entryMaxBalanceQuota: toAmount(defaultValues.entryMaxBalanceQuota, 0),
      entryMinQuota: toAmount(defaultValues.entryMinQuota, 0),
      entryMaxQuota: toAmount(defaultValues.entryMaxQuota, 0),
      entryRewardBands: parseBandRows(
        defaultValues.entryRewardBands,
        DEFAULT_ENTRY_BANDS
      ),
      minQuota: toAmount(defaultValues.minQuota, 0),
      maxQuota: toAmount(defaultValues.maxQuota, 0),
      basicMinBalanceQuota: toAmount(defaultValues.basicMinBalanceQuota, 0),
      basicMaxBalanceQuota: toAmount(defaultValues.basicMaxBalanceQuota, 0),
      basicRewardBands: parseBandRows(
        defaultValues.basicRewardBands,
        DEFAULT_BASIC_BANDS
      ),
      advancedEnabled: defaultValues.advancedEnabled,
      advancedMinBalanceQuota: toAmount(defaultValues.advancedMinBalanceQuota, 0),
      advancedMaxBalanceQuota: toAmount(defaultValues.advancedMaxBalanceQuota, 0),
      advancedMinQuota: toAmount(defaultValues.advancedMinQuota, 0),
      advancedMaxQuota: toAmount(defaultValues.advancedMaxQuota, 0),
      advancedRewardBands: parseBandRows(
        defaultValues.advancedRewardBands,
        DEFAULT_ADVANCED_BANDS
      ),
      minIntervalHours: toInt(defaultValues.minIntervalHours, 24),
      weeklyRewardCapQuota: toAmount(defaultValues.weeklyRewardCapQuota, 0),
      rewardRule: normalizeRewardRule(defaultValues.rewardRule),
    }),
    [defaultValues]
  )

  const form = useForm<Values>({
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
    defaultValues: normalizedDefaults,
  })

  useEffect(() => {
    form.reset(normalizedDefaults)
  }, [form, normalizedDefaults])

  const { isDirty, isSubmitting } = form.formState
  const enabled = form.watch('enabled')
  const advancedEnabled = form.watch('advancedEnabled')
  const entryBands = form.watch('entryRewardBands')
  const basicBands = form.watch('basicRewardBands')
  const advancedBands = form.watch('advancedRewardBands')

  const setBands = (
    field: 'entryRewardBands' | 'basicRewardBands' | 'advancedRewardBands',
    rows: RewardBand[]
  ) => {
    const fallbackRows =
      field === 'entryRewardBands'
        ? DEFAULT_ENTRY_BANDS
        : field === 'basicRewardBands'
          ? DEFAULT_BASIC_BANDS
          : DEFAULT_ADVANCED_BANDS
    form.setValue(field, normalizeBandRows(rows, fallbackRows), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    })
  }

  async function onSubmit(values: Values) {
    const normalizedValues: Values = {
      ...values,
      entryRewardBands: normalizeBandRows(values.entryRewardBands, DEFAULT_ENTRY_BANDS),
      basicRewardBands: normalizeBandRows(values.basicRewardBands, DEFAULT_BASIC_BANDS),
      advancedRewardBands: normalizeBandRows(
        values.advancedRewardBands,
        DEFAULT_ADVANCED_BANDS
      ),
      rewardRule: normalizeRewardRule(values.rewardRule),
    }

    const updates = [
      { key: 'checkin_setting.enabled', value: normalizedValues.enabled },
      {
        key: 'checkin_setting.entry_min_balance_quota',
        value: normalizedValues.entryMinBalanceQuota,
      },
      {
        key: 'checkin_setting.entry_max_balance_quota',
        value: normalizedValues.entryMaxBalanceQuota,
      },
      { key: 'checkin_setting.entry_min_quota', value: normalizedValues.entryMinQuota },
      { key: 'checkin_setting.entry_max_quota', value: normalizedValues.entryMaxQuota },
      {
        key: 'checkin_setting.entry_reward_bands',
        value: stringifyBandRows(normalizedValues.entryRewardBands),
      },
      { key: 'checkin_setting.min_quota', value: normalizedValues.minQuota },
      { key: 'checkin_setting.max_quota', value: normalizedValues.maxQuota },
      {
        key: 'checkin_setting.basic_min_balance_quota',
        value: normalizedValues.basicMinBalanceQuota,
      },
      {
        key: 'checkin_setting.basic_max_balance_quota',
        value: normalizedValues.basicMaxBalanceQuota,
      },
      {
        key: 'checkin_setting.basic_reward_bands',
        value: stringifyBandRows(normalizedValues.basicRewardBands),
      },
      {
        key: 'checkin_setting.advanced_enabled',
        value: normalizedValues.advancedEnabled,
      },
      {
        key: 'checkin_setting.advanced_min_balance_quota',
        value: normalizedValues.advancedMinBalanceQuota,
      },
      {
        key: 'checkin_setting.advanced_max_balance_quota',
        value: normalizedValues.advancedMaxBalanceQuota,
      },
      {
        key: 'checkin_setting.advanced_min_quota',
        value: normalizedValues.advancedMinQuota,
      },
      {
        key: 'checkin_setting.advanced_max_quota',
        value: normalizedValues.advancedMaxQuota,
      },
      {
        key: 'checkin_setting.advanced_reward_bands',
        value: stringifyBandRows(normalizedValues.advancedRewardBands),
      },
      {
        key: 'checkin_setting.min_interval_hours',
        value: normalizedValues.minIntervalHours,
      },
      {
        key: 'checkin_setting.weekly_reward_cap_quota',
        value: normalizedValues.weeklyRewardCapQuota,
      },
      { key: 'checkin_setting.reward_rule', value: normalizedValues.rewardRule },
    ]

    const changedUpdates = updates.filter((update) => {
      const defaultValue = (() => {
        switch (update.key) {
          case 'checkin_setting.enabled':
            return normalizedDefaults.enabled
          case 'checkin_setting.entry_min_balance_quota':
            return normalizedDefaults.entryMinBalanceQuota
          case 'checkin_setting.entry_max_balance_quota':
            return normalizedDefaults.entryMaxBalanceQuota
          case 'checkin_setting.entry_min_quota':
            return normalizedDefaults.entryMinQuota
          case 'checkin_setting.entry_max_quota':
            return normalizedDefaults.entryMaxQuota
          case 'checkin_setting.entry_reward_bands':
            return stringifyBandRows(normalizedDefaults.entryRewardBands)
          case 'checkin_setting.min_quota':
            return normalizedDefaults.minQuota
          case 'checkin_setting.max_quota':
            return normalizedDefaults.maxQuota
          case 'checkin_setting.basic_min_balance_quota':
            return normalizedDefaults.basicMinBalanceQuota
          case 'checkin_setting.basic_max_balance_quota':
            return normalizedDefaults.basicMaxBalanceQuota
          case 'checkin_setting.basic_reward_bands':
            return stringifyBandRows(normalizedDefaults.basicRewardBands)
          case 'checkin_setting.advanced_enabled':
            return normalizedDefaults.advancedEnabled
          case 'checkin_setting.advanced_min_balance_quota':
            return normalizedDefaults.advancedMinBalanceQuota
          case 'checkin_setting.advanced_max_balance_quota':
            return normalizedDefaults.advancedMaxBalanceQuota
          case 'checkin_setting.advanced_min_quota':
            return normalizedDefaults.advancedMinQuota
          case 'checkin_setting.advanced_max_quota':
            return normalizedDefaults.advancedMaxQuota
          case 'checkin_setting.advanced_reward_bands':
            return stringifyBandRows(normalizedDefaults.advancedRewardBands)
          case 'checkin_setting.min_interval_hours':
            return normalizedDefaults.minIntervalHours
          case 'checkin_setting.weekly_reward_cap_quota':
            return normalizedDefaults.weeklyRewardCapQuota
          case 'checkin_setting.reward_rule':
            return normalizedDefaults.rewardRule
          default:
            return undefined
        }
      })()
      return update.value !== defaultValue
    })

    if (changedUpdates.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const update of changedUpdates) {
      await updateOption.mutateAsync(update)
    }

    form.reset(normalizedValues)
  }

  return (
    <SettingsSection
      title={t('Check-in Settings')}
      description={t('Configure daily check-in rewards for users')}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          autoComplete='off'
          className='space-y-6'
        >
          <FormField
            control={form.control}
            name='enabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    {t('Enable check-in feature')}
                  </FormLabel>
                  <FormDescription>
                    {t('Allow users to check in daily for random quota rewards')}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={updateOption.isPending || isSubmitting}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {enabled && (
            <>
              <div className='grid gap-6 md:grid-cols-3'>
                <FormField
                  control={form.control}
                  name='minIntervalHours'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Check-in cooldown hours')}</FormLabel>
                      <FormControl>
                        <Input type='number' min={0} step='1' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='weeklyRewardCapQuota'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('Weekly reward cap quota (0 means unlimited)')}
                      </FormLabel>
                      <FormControl>
                        <Input type='number' min={0} step='0.01' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='rewardRule'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Reward rule')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value: CheckinRewardRule) =>
                          field.onChange(value)
                        }
                      >
                        <FormControl>
                          <SelectTrigger className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {checkinRewardRuleOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {t(option.labelKey)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              <div className='space-y-4 rounded-lg border p-4'>
                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='entryMinBalanceQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Entry tier minimum balance')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={0} step='1' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='entryMaxBalanceQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('Entry tier maximum balance (0 means unlimited)')}
                        </FormLabel>
                        <FormControl>
                          <Input type='number' min={0} step='1' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='entryMinQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Entry tier minimum reward')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={0} step='0.01' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='entryMaxQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Entry tier maximum reward')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={0} step='0.01' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <RewardBandEditor
                  title={t('Entry tier probability distribution')}
                  tierKey='entry'
                  bands={entryBands}
                  disabled={!enabled}
                  colorClassName='[&_[data-slot=progress-indicator]]:bg-sky-500'
                  onChange={(rows) => setBands('entryRewardBands', rows)}
                  t={t}
                />
              </div>

              <div className='space-y-4 rounded-lg border p-4'>
                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='basicMinBalanceQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Basic tier minimum balance')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={0} step='1' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='basicMaxBalanceQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('Basic tier maximum balance (0 means unlimited)')}
                        </FormLabel>
                        <FormControl>
                          <Input type='number' min={0} step='1' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='minQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Basic tier minimum reward')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={0} step='0.01' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='maxQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Basic tier maximum reward')}</FormLabel>
                        <FormControl>
                          <Input type='number' min={0} step='0.01' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <RewardBandEditor
                  title={t('Basic tier probability distribution')}
                  tierKey='basic'
                  bands={basicBands}
                  disabled={!enabled}
                  colorClassName='[&_[data-slot=progress-indicator]]:bg-emerald-500'
                  onChange={(rows) => setBands('basicRewardBands', rows)}
                  t={t}
                />
              </div>

              <FormField
                control={form.control}
                name='advancedEnabled'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                    <div className='space-y-0.5'>
                      <FormLabel className='text-base'>
                        {t('Enable advanced check-in')}
                      </FormLabel>
                      <FormDescription>
                        {t('Enable higher-tier check-in rewards')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className='space-y-4 rounded-lg border p-4'>
                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='advancedMinBalanceQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Advanced tier minimum balance')}</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0}
                            step='1'
                            disabled={!enabled || !advancedEnabled}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='advancedMaxBalanceQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('Advanced tier maximum balance (0 means unlimited)')}
                        </FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0}
                            step='1'
                            disabled={!enabled || !advancedEnabled}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className='grid gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='advancedMinQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Advanced tier minimum reward')}</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0}
                            step='0.01'
                            disabled={!enabled || !advancedEnabled}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='advancedMaxQuota'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Advanced tier maximum reward')}</FormLabel>
                        <FormControl>
                          <Input
                            type='number'
                            min={0}
                            step='0.01'
                            disabled={!enabled || !advancedEnabled}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <RewardBandEditor
                  title={t('Advanced tier probability distribution')}
                  tierKey='advanced'
                  bands={advancedBands}
                  disabled={!enabled || !advancedEnabled}
                  colorClassName='[&_[data-slot=progress-indicator]]:bg-violet-500'
                  onChange={(rows) => setBands('advancedRewardBands', rows)}
                  t={t}
                />
              </div>
            </>
          )}

          <Button
            type='submit'
            disabled={!isDirty || updateOption.isPending || isSubmitting}
          >
            {updateOption.isPending || isSubmitting
              ? t('Saving...')
              : t('Save check-in settings')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
