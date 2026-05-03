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
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionPageLayout } from '@/components/layout'
import { formatTimestampToDate } from '@/lib/format'
import { claimOrder, getMyClaims } from './api'

const claimFormSchema = z.object({
  source_platform: z.string().min(1, 'Source platform is required'),
  external_order_no: z.string().min(1, 'External order number is required'),
  buyer_contact: z.string().min(1, 'Buyer contact is required'),
  claimed_product: z.string().min(1, 'Claimed product is required'),
  proof_images_text: z.string().optional(),
  claim_note: z.string().optional(),
})

type ClaimFormValues = z.infer<typeof claimFormSchema>

export function OrderClaim() {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const splitProofImages = (value?: string): string[] =>
    String(value || '')
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)

  const renderClaimStatusBadge = (status?: string) => {
    if (status === 'approved') {
      return <Badge className='bg-emerald-600'>{status}</Badge>
    }
    if (status === 'rejected') {
      return <Badge variant='destructive'>{status}</Badge>
    }
    return <Badge variant='secondary'>{status || 'pending_review'}</Badge>
  }

  const form = useForm<ClaimFormValues>({
    resolver: zodResolver(claimFormSchema),
    defaultValues: {
      source_platform: '',
      external_order_no: '',
      buyer_contact: '',
      claimed_product: 'novel_product',
      proof_images_text: '',
      claim_note: '',
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
      const result = await claimOrder({
        source_platform: data.source_platform.trim(),
        external_order_no: data.external_order_no.trim(),
        buyer_contact: data.buyer_contact.trim(),
        claimed_product: data.claimed_product.trim(),
        proof_images: splitProofImages(data.proof_images_text),
        claim_note: data.claim_note?.trim() || '',
      })
      if (result.success) {
        toast.success(t('Order claim submitted successfully!'))
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
        {t('Submit your external order information for manual claim review')}
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
                        <FormLabel>{t('External Order Number')}</FormLabel>
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
                    name='buyer_contact'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Buyer Contact')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('Enter buyer contact')}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='claimed_product'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Claimed Product')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('Enter claimed product')}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='claim_note'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Claim Note')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('Optional claim note')}
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='proof_images_text'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Proof Image URLs')}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('One URL per line')}
                            rows={4}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type='submit' disabled={isSubmitting}>
                    {isSubmitting ? t('Submitting...') : t('Submit Claim')}
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
                      className='space-y-2 rounded-md border p-3'
                    >
                      <div className='flex items-center justify-between gap-2'>
                        <p className='font-medium'>
                          #{claim.id} · {claim.external_order_no}
                        </p>
                        {renderClaimStatusBadge(claim.claim_status)}
                      </div>
                      <div className='grid gap-1 text-xs'>
                        <p className='text-muted-foreground text-xs'>
                          {claim.source_platform} - {claim.claimed_product}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {t('Grant Type')}: {claim.grant_type || '-'}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {t('Review Note')}: {claim.review_note || '-'}
                        </p>
                        {Array.isArray(claim.proof_images) &&
                        claim.proof_images.length > 0 ? (
                          <div className='flex flex-wrap gap-2'>
                            {claim.proof_images.map((url, index) => (
                              <a
                                key={`${url}-${index}`}
                                className='text-primary text-xs underline'
                                href={url}
                                target='_blank'
                                rel='noreferrer'
                              >
                                {t('Proof {{index}}', { index: index + 1 })}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className='text-right text-xs'>
                        <p className='font-mono text-sm'>
                          {claim.granted_code || '-'}
                        </p>
                        <p className='text-muted-foreground text-xs'>
                          {formatTimestampToDate(claim.created_at)}
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
