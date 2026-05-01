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
import { getPublications, publishCodes } from './api'

const publishFormSchema = z.object({
  batch_no: z.string().min(1, 'Batch number is required'),
  campaign_name: z.string().min(1, 'Campaign name is required'),
  channel: z.string().min(1, 'Channel is required'),
  source_platform: z.string().min(1, 'Source platform is required'),
  external_order_no: z.string().min(1, 'External order number is required'),
  product_key: z.string().min(1, 'Product is required'),
  code_type: z.string().min(1, 'Code type is required'),
  count: z.number().min(1).max(1000),
})

type PublishFormValues = z.infer<typeof publishFormSchema>

export function CodePublication() {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<PublishFormValues>({
    resolver: zodResolver(publishFormSchema),
    defaultValues: {
      batch_no: '',
      campaign_name: '',
      channel: '',
      source_platform: '',
      external_order_no: '',
      product_key: 'novel_product',
      code_type: 'registration',
      count: 10,
    },
  })

  const { data: pubData, refetch } = useQuery({
    queryKey: ['code-publications'],
    queryFn: async () => {
      const result = await getPublications(1, 50)
      return result.data
    },
  })

  const onSubmit = async (data: PublishFormValues) => {
    setIsSubmitting(true)
    try {
      const result = await publishCodes(data)
      if (result.success) {
        toast.success(t('Codes published successfully!'))
        form.reset()
        refetch()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const publications = pubData?.items || []

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Code Publication Center')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Publish registration and subscription codes in batches')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='space-y-8'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Publish Codes')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className='space-y-4'
                >
                  <div className='grid gap-4 md:grid-cols-2'>
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
                              {...field}
                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type='submit' disabled={isSubmitting}>
                    {isSubmitting ? t('Publishing...') : t('Publish Codes')}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Publication History')}</CardTitle>
            </CardHeader>
            <CardContent>
              {publications.length === 0 ? (
                <p className='text-muted-foreground text-sm'>
                  {t('No publications yet.')}
                </p>
              ) : (
                <div className='space-y-2'>
                  {publications.map((pub) => (
                    <div
                      key={pub.id}
                      className='flex items-center justify-between rounded-md border p-3'
                    >
                      <div>
                        <p className='font-medium'>
                          {pub.campaign_name} ({pub.batch_no})
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {pub.code_type} - {pub.channel} /{' '}
                          {pub.source_platform}
                        </p>
                      </div>
                      <div className='text-right'>
                        <p className='text-sm'>
                          {pub.published_count}/{pub.total_count}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {formatTimestampToDate(pub.created_at)}
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
