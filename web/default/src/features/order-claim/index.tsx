import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionPageLayout } from '@/components/layout'
import { formatTimestampToDate } from '@/lib/format'
import { claimOrder, getMyClaims } from './api'

const claimFormSchema = z.object({
  order_no: z.string().min(1, 'Order number is required'),
  product_key: z.string().min(1, 'Product is required'),
  code_type: z.string().min(1, 'Code type is required'),
})

type ClaimFormValues = z.infer<typeof claimFormSchema>

export function OrderClaim() {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ClaimFormValues>({
    resolver: zodResolver(claimFormSchema),
    defaultValues: {
      order_no: '',
      product_key: 'novel_product',
      code_type: 'registration',
    },
  })

  const { data: claimsData, refetch } = useQuery({
    queryKey: ['my-claims'],
    queryFn: async () => {
      const result = await getMyClaims({ page_size: 50 })
      return result.data
    },
  })

  const onSubmit = async (data: ClaimFormValues) => {
    setIsSubmitting(true)
    try {
      const result = await claimOrder(data)
      if (result.success) {
        toast.success(t('Code claimed successfully!'))
        form.reset()
        refetch()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const claims = claimsData?.items || []

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Order Claim')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Claim your registration or subscription code using your order number')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='space-y-8'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Claim Code')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className='space-y-4'
                >
                  <FormField
                    control={form.control}
                    name='order_no'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Order Number')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('Enter your order number')}
                            {...field}
                          />
                        </FormControl>
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
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='novel_product'>
                              novel_product
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='code_type'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Code Type')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='registration'>
                              {t('Registration Code')}
                            </SelectItem>
                            <SelectItem value='subscription'>
                              {t('Subscription Code')}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type='submit' disabled={isSubmitting}>
                    {isSubmitting ? t('Claiming...') : t('Claim Code')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('My Claims')}</CardTitle>
            </CardHeader>
            <CardContent>
              {claims.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                  {t('No claims yet.')}
                </p>
              ) : (
                <div className='space-y-2'>
                  {claims.map((claim) => (
                    <div
                      key={claim.id}
                      className='flex items-center justify-between rounded-md border p-3'
                    >
                      <div>
                        <p className='font-medium'>{claim.order_no}</p>
                        <p className='text-muted-foreground text-xs'>
                          {claim.code_type} - {claim.product_key}
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='font-mono text-sm'>{claim.code}</p>
                        <p className='text-muted-foreground text-xs'>
                          {formatTimestampToDate(claim.claimed_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
