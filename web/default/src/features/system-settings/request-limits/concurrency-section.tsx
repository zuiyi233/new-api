import { useEffect } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const createConcurrencySchema = (_t: (key: string) => string) =>
  z.object({
    RelayConcurrencyEnabled: z.boolean(),
    GlobalDefaultConcurrency: z.number().min(1).max(2147483647),
    ConcurrencyCodeOverridePolicy: z.string(),
    ConcurrencyCounterTtlSeconds: z.number().min(1).max(86400),
  })

type ConcurrencyFormValues = z.infer<ReturnType<typeof createConcurrencySchema>>

type ConcurrencySectionProps = {
  defaultValues: ConcurrencyFormValues
}

export function ConcurrencySection({ defaultValues }: ConcurrencySectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const concurrencySchema = createConcurrencySchema(t)

  const form = useForm<ConcurrencyFormValues>({
    resolver: zodResolver(concurrencySchema),
    mode: 'onChange',
    defaultValues,
  })

  useEffect(() => {
    form.reset(defaultValues)
  }, [defaultValues, form])

  const onSubmit = async (values: ConcurrencyFormValues) => {
    const updates = Object.entries(values).filter(
      ([key, value]) =>
        value !== defaultValues[key as keyof ConcurrencyFormValues]
    )

    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key, value: value ?? '' })
    }
  }

  return (
    <SettingsSection
      title={t('User Concurrency Limit')}
      description={t(
        'Configure per-user concurrent request limits to manage system load.'
      )}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='RelayConcurrencyEnabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    {t('Enable user concurrency limit')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Limit the number of concurrent requests per user'
                    )}
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

          <div className='grid gap-4 md:grid-cols-3'>
            <FormField
              control={form.control}
              name='GlobalDefaultConcurrency'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Global default concurrency')}</FormLabel>
                  <FormControl>
                    <div className='flex items-center gap-2'>
                      <Input
                        type='number'
                        min={1}
                        max={2147483647}
                        step={1}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                      <span className='text-muted-foreground text-sm'>
                        {t('slots')}
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Default concurrency limit when no user override is set'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='ConcurrencyCodeOverridePolicy'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Redemption code override policy')}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='max'>
                        {t('Take maximum (max)')}
                      </SelectItem>
                      <SelectItem value='latest'>
                        {t('Take latest (latest)')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t(
                      'Policy when a user has multiple override-type concurrency codes'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='ConcurrencyCounterTtlSeconds'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Concurrency counter TTL')}</FormLabel>
                  <FormControl>
                    <div className='flex items-center gap-2'>
                      <Input
                        type='number'
                        min={1}
                        max={86400}
                        step={1}
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                      <span className='text-muted-foreground text-sm'>
                        {t('seconds')}
                      </span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Keep-alive duration for concurrency slots (recommended: 60–600s)'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending
              ? t('Saving...')
              : t('Save concurrency settings')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
