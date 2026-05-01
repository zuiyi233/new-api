import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { addTimeToDate } from '@/lib/time'
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { DateTimePicker } from '@/components/datetime-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createSubscriptionCode, updateSubscriptionCode, getSubscriptionCode } from '../api'
import { SUCCESS_MESSAGES, SUBSCRIPTION_CODE_PRODUCT_OPTIONS } from '../constants'
import {
  getSubscriptionCodeFormSchema,
  type SubscriptionCodeFormValues,
  SUBSCRIPTION_CODE_FORM_DEFAULT_VALUES,
  transformFormDataToPayload,
  transformSubscriptionCodeToFormDefaults,
} from '../lib'
import type { SubscriptionCode } from '../types'
import { useSubscriptionCodes } from './subscription-codes-provider'

type SubscriptionCodesMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: SubscriptionCode
}

export function SubscriptionCodesMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: SubscriptionCodesMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useSubscriptionCodes()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SubscriptionCodeFormValues>({
    resolver: zodResolver(getSubscriptionCodeFormSchema(t)),
    defaultValues: SUBSCRIPTION_CODE_FORM_DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open && isUpdate && currentRow) {
      getSubscriptionCode(currentRow.id).then((result) => {
        if (result.success && result.data) {
          form.reset(transformSubscriptionCodeToFormDefaults(result.data))
        }
      })
    } else if (open && !isUpdate) {
      form.reset(SUBSCRIPTION_CODE_FORM_DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: SubscriptionCodeFormValues) => {
    setIsSubmitting(true)
    try {
      const basePayload = transformFormDataToPayload(data)

      if (isUpdate && currentRow) {
        const result = await updateSubscriptionCode({
          ...basePayload,
          id: currentRow.id,
        })
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.SUBSCRIPTION_CODE_UPDATED))
          onOpenChange(false)
          triggerRefresh()
        }
      } else {
        const result = await createSubscriptionCode(basePayload)
        if (result.success) {
          const count = result.data?.length || 0
          toast.success(
            count > 1
              ? t('Successfully created {{count}} subscription codes', {
                  count,
                })
              : t(SUCCESS_MESSAGES.SUBSCRIPTION_CODE_CREATED)
          )
          onOpenChange(false)
          triggerRefresh()
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSetExpiry = (months: number, days: number, hours: number) => {
    const newDate = addTimeToDate(months, days, hours)
    form.setValue('expires_at', newDate)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) {
          form.reset()
        }
      }}
    >
      <SheetContent className='flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]'>
        <SheetHeader className='border-b px-4 py-3 text-start sm:px-6 sm:py-4'>
          <SheetTitle>
            {isUpdate
              ? t('Update Subscription Code')
              : t('Create Subscription Code')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update the subscription code by providing necessary info.')
              : t(
                  'Add new subscription code(s) by providing necessary info.'
                )}{' '}
            {t("Click save when you're done.")}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto px-4 py-4 sm:px-6'>
          <Form {...form}>
            <form
              id='subscription-code-form'
              onSubmit={form.handleSubmit(onSubmit)}
              className='space-y-6'
            >
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Name')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Enter code name')}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('A descriptive name for this subscription code.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='product_key'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Product')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select product')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SUBSCRIPTION_CODE_PRODUCT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t('The product this code grants access to.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='max_uses'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Max Uses')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        placeholder={t('Enter max uses')}
                        {...field}
                        onChange={(e) =>
                          field.onChange(Number(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Maximum number of times this code can be used. 0 for unlimited.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='batch_no'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Batch No')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Enter batch number')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='campaign_name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Campaign Name')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Enter campaign name')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='channel'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Channel')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Enter channel')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='source_platform'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Source Platform')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Enter source platform')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='external_order_no'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('External Order No')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('Enter external order number')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='expires_at'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Expiration Date')}</FormLabel>
                    <FormControl>
                      <DateTimePicker
                        date={field.value}
                        onDateChange={field.onChange}
                        placeholder={t('Pick an expiration date')}
                      />
                    </FormControl>
                    <FormDescription>
                      <span className='flex flex-wrap gap-1'>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => handleSetExpiry(1, 0, 0)}
                        >
                          {t('1 Month')}
                        </Button>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => handleSetExpiry(3, 0, 0)}
                        >
                          {t('3 Months')}
                        </Button>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => handleSetExpiry(6, 0, 0)}
                        >
                          {t('6 Months')}
                        </Button>
                        <Button
                          type='button'
                          variant='outline'
                          size='sm'
                          onClick={() => handleSetExpiry(12, 0, 0)}
                        >
                          {t('1 Year')}
                        </Button>
                      </span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isUpdate && (
                <FormField
                  control={form.control}
                  name='count'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Count')}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          max={1000}
                          placeholder={t('Enter count')}
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Number of codes to generate in this batch.')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </form>
          </Form>
        </div>

        <SheetFooter className='border-t px-4 py-3 sm:px-6'>
          <SheetClose asChild>
            <Button variant='outline'>{t('Cancel')}</Button>
          </SheetClose>
          <Button
            type='submit'
            form='subscription-code-form'
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t('Saving...')
              : isUpdate
                ? t('Update')
                : t('Create')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
