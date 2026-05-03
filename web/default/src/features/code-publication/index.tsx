import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { formatTimestampToDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SectionPageLayout } from '@/components/layout'
import {
  getPublicationDetail,
  getPublications,
  publishCodes,
} from './api'
import type {
  CodeDelivery,
  CodeDeliveryOperationLog,
  CodePublication,
} from './types'

type ActionType = 'reissue' | 'revoke' | 'rollback'

type ActionFormState = {
  action: ActionType
  delivery_channel: string
  revoke_reason: string
  notes: string
}

const DEFAULT_ACTION_FORM: ActionFormState = {
  action: 'reissue',
  delivery_channel: '',
  revoke_reason: '',
  notes: '',
}

function statusTone(status?: string): string {
  switch (status) {
    case 'revoked':
      return 'text-red-600'
    case 'used':
      return 'text-lime-600'
    case 'claimed':
      return 'text-emerald-600'
    case 'delivered':
      return 'text-cyan-600'
    case 'published':
      return 'text-blue-600'
    default:
      return 'text-muted-foreground'
  }
}

function displayOperationType(type?: string): string {
  switch (type) {
    case 'publish':
      return 'publish'
    case 'mark_pending_delivery':
      return 'mark_pending_delivery'
    case 'mark_delivered':
      return 'mark_delivered'
    case 'mark_claimed':
      return 'mark_claimed'
    case 'mark_used':
      return 'mark_used'
    case 'mark_revoked':
      return 'mark_revoked'
    case 'reissue':
      return 'reissue'
    case 'rollback':
      return 'rollback'
    default:
      return type || '-'
  }
}

export function CodePublication() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const PAGE_SIZE = 20
  const [selectedPublicationId, setSelectedPublicationId] = useState<number | null>(null)
  const [actionForm, setActionForm] = useState<ActionFormState>(DEFAULT_ACTION_FORM)
  const [detailOpen, setDetailOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const { data: listData, isLoading } = useQuery({
    queryKey: ['code-publications', currentPage, PAGE_SIZE],
    queryFn: async () => {
      const result = await getPublications(currentPage, PAGE_SIZE)
      return result.data
    },
  })

  const publications = listData?.items || []
  const totalCount = listData?.total || 0
  const hasMore = currentPage * PAGE_SIZE < totalCount

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['code-publication-detail', selectedPublicationId],
    queryFn: async () => {
      if (!selectedPublicationId) return null
      const res = await getPublicationDetail(selectedPublicationId)
      return res.data || null
    },
    enabled: detailOpen && selectedPublicationId != null,
  })

  const selectedPublication = useMemo(
    () => publications.find((item) => item.id === selectedPublicationId) || null,
    [publications, selectedPublicationId]
  )

  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPublicationId) {
        throw new Error('publication_id is required')
      }
      if (actionForm.action === 'revoke' && !actionForm.revoke_reason.trim()) {
        throw new Error(t('Revoke reason is required'))
      }
      return publishCodes({
        publication_id: selectedPublicationId,
        action: actionForm.action,
        delivery_channel: actionForm.delivery_channel.trim(),
        revoke_reason: actionForm.revoke_reason.trim(),
        notes: actionForm.notes.trim(),
      })
    },
    onSuccess: async (res) => {
      if (!res.success) return
      toast.success(res.message || t('Action applied successfully'))
      await queryClient.invalidateQueries({ queryKey: ['code-publications'] })
      if (selectedPublicationId) {
        await queryClient.invalidateQueries({
          queryKey: ['code-publication-detail', selectedPublicationId],
        })
      }
      setActionForm(DEFAULT_ACTION_FORM)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : t('Action failed')
      toast.error(message)
    },
  })

  const copyGrantedCode = async () => {
    const value = detailData?.publication?.code_value
    if (!value) return
    const copied = await copyToClipboard(value)
    if (copied) {
      toast.success(t('Copied'))
    } else {
      toast.error(t('Copy failed'))
    }
  }

  const renderDelivery = (delivery: CodeDelivery) => (
    <div
      key={delivery.id}
      className='rounded-md border p-3 text-xs'
    >
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='font-medium'>
          #{delivery.id} / attempt {delivery.attempt_no}
        </span>
        <span className={statusTone(delivery.delivery_status)}>
          {delivery.delivery_status}
        </span>
      </div>
      <div className='text-muted-foreground mt-1 grid gap-1'>
        <span>operation: {displayOperationType(delivery.operation_type)}</span>
        <span>channel: {delivery.delivery_channel || '-'}</span>
        <span>revoke_reason: {delivery.revoke_reason || '-'}</span>
        <span>created_at: {formatTimestampToDate(delivery.created_at)}</span>
      </div>
    </div>
  )

  const renderLog = (log: CodeDeliveryOperationLog) => (
    <div key={log.id} className='rounded-md border p-3 text-xs'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <span className='font-medium'>#{log.id}</span>
        <span>{formatTimestampToDate(log.created_at)}</span>
      </div>
      <div className='text-muted-foreground mt-1 grid gap-1'>
        <span>operation: {displayOperationType(log.operation_type)}</span>
        <span>
          transition: {log.from_status || '-'} → {log.to_status || '-'}
        </span>
        <span>operator: {log.operator_name || `#${log.operator_id || 0}`}</span>
        <span>delivery_channel: {log.delivery_channel || '-'}</span>
        <span>revoke_reason: {log.revoke_reason || '-'}</span>
        <span>notes: {log.notes || '-'}</span>
      </div>
    </div>
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Code Publication')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Manage publication records and apply reissue, revoke, and rollback actions')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Publication List')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {isLoading ? (
                <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
              ) : publications.length === 0 ? (
                <p className='text-muted-foreground text-sm'>{t('No publications yet.')}</p>
              ) : (
                publications.map((publication) => {
                  const active = publication.id === selectedPublicationId
                  return (
                    <div
                      key={publication.id}
                      className={`rounded-md border p-3 ${active ? 'border-primary' : ''}`}
                    >
                      <div className='flex flex-wrap items-center justify-between gap-2'>
                        <div>
                          <p className='font-medium'>
                            #{publication.id} · {publication.code_type}
                          </p>
                          <p className='text-muted-foreground text-xs'>
                            {publication.external_order_no || '-'} / {publication.claimed_product || '-'}
                          </p>
                        </div>
                        <div className='flex items-center gap-2'>
                          <span className={`text-xs ${statusTone(publication.publication_status)}`}>
                            {publication.publication_status}
                          </span>
                          <Button
                            type='button'
                            size='sm'
                            variant='outline'
                            onClick={() => setSelectedPublicationId(publication.id)}
                          >
                            {active ? t('Selected') : t('Select')}
                          </Button>
                          <Button
                            type='button'
                            size='sm'
                            variant='ghost'
                            onClick={() => {
                              setSelectedPublicationId(publication.id)
                              setDetailOpen(true)
                            }}
                          >
                            <Eye className='size-4' />
                            {t('Detail')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              {totalCount > 0 && (
                <div className='flex items-center justify-between pt-2'>
                  <span className='text-muted-foreground text-xs'>
                    {t('Showing {{count}} of {{total}}', { count: publications.length, total: totalCount })}
                  </span>
                  <div className='flex gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      {t('Previous')}
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      disabled={!hasMore}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      {t('Next')}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('Publication Action')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='text-muted-foreground text-sm'>
                {selectedPublication
                  ? t('Selected publication #{{id}}', { id: selectedPublication.id })
                  : t('Select a publication from the list first')}
              </div>

              <div className='grid gap-3 sm:grid-cols-2'>
                <div className='space-y-2'>
                  <Label htmlFor='action'>{t('Action')}</Label>
                  <select
                    id='action'
                    className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm'
                    value={actionForm.action}
                    onChange={(e) =>
                      setActionForm((prev) => ({
                        ...prev,
                        action: e.target.value as ActionType,
                      }))
                    }
                  >
                    <option value='reissue'>{t('Reissue')}</option>
                    <option value='revoke'>{t('Revoke')}</option>
                    <option value='rollback'>{t('Rollback')}</option>
                  </select>
                </div>

                <div className='space-y-2'>
                  <Label htmlFor='delivery_channel'>{t('Delivery Channel')}</Label>
                  <Input
                    id='delivery_channel'
                    value={actionForm.delivery_channel}
                    onChange={(e) =>
                      setActionForm((prev) => ({
                        ...prev,
                        delivery_channel: e.target.value,
                      }))
                    }
                    placeholder={t('Optional delivery channel')}
                  />
                </div>
              </div>

              {actionForm.action === 'revoke' ? (
                <div className='space-y-2'>
                  <Label htmlFor='revoke_reason'>{t('Revoke Reason')}</Label>
                  <Input
                    id='revoke_reason'
                    value={actionForm.revoke_reason}
                    onChange={(e) =>
                      setActionForm((prev) => ({
                        ...prev,
                        revoke_reason: e.target.value,
                      }))
                    }
                    placeholder={t('Required for revoke action')}
                  />
                </div>
              ) : null}

              <div className='space-y-2'>
                <Label htmlFor='notes'>{t('Notes')}</Label>
                <Textarea
                  id='notes'
                  value={actionForm.notes}
                  onChange={(e) =>
                    setActionForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder={t('Optional notes')}
                  rows={3}
                />
              </div>

              <Button
                type='button'
                onClick={() => actionMutation.mutate()}
                disabled={!selectedPublicationId || actionMutation.isPending}
              >
                {actionMutation.isPending ? t('Applying...') : t('Apply Action')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
        }}
      >
        <DialogContent className='max-h-[90vh] max-w-4xl overflow-auto'>
          <DialogHeader>
            <DialogTitle>{t('Publication Detail')}</DialogTitle>
            <DialogDescription>
              {t('Deliveries and operation logs for selected publication')}
            </DialogDescription>
          </DialogHeader>

          {!selectedPublicationId ? (
            <p className='text-muted-foreground text-sm'>
              {t('Select a publication first.')}
            </p>
          ) : detailLoading || !detailData ? (
            <p className='text-muted-foreground text-sm'>{t('Loading detail...')}</p>
          ) : (
            <div className='space-y-4'>
              <div className='grid gap-2 rounded-md border p-3 text-sm sm:grid-cols-2'>
                <div>
                  <span className='text-muted-foreground'>ID:</span> #{detailData.publication.id}
                </div>
                <div>
                  <span className='text-muted-foreground'>status:</span>{' '}
                  <span className={statusTone(detailData.publication.publication_status)}>
                    {detailData.publication.publication_status}
                  </span>
                </div>
                <div>
                  <span className='text-muted-foreground'>code_type:</span>{' '}
                  {detailData.publication.code_type}
                </div>
                <div>
                  <span className='text-muted-foreground'>code_id:</span>{' '}
                  {detailData.publication.code_id}
                </div>
                <div className='sm:col-span-2'>
                  <span className='text-muted-foreground'>code_value:</span>{' '}
                  {detailData.publication.code_value ? (
                    <button
                      type='button'
                      className='font-mono text-xs hover:underline'
                      onClick={copyGrantedCode}
                    >
                      {detailData.publication.code_value}
                    </button>
                  ) : (
                    '-'
                  )}
                </div>
                <div>
                  <span className='text-muted-foreground'>target_user_id:</span>{' '}
                  {detailData.publication.target_user_id || '-'}
                </div>
                <div>
                  <span className='text-muted-foreground'>target_contact:</span>{' '}
                  {detailData.publication.target_contact || '-'}
                </div>
                <div>
                  <span className='text-muted-foreground'>order_claim_id:</span>{' '}
                  {detailData.publication.order_claim_id || '-'}
                </div>
                <div>
                  <span className='text-muted-foreground'>publication_channel:</span>{' '}
                  {detailData.publication.publication_channel || '-'}
                </div>
                <div>
                  <span className='text-muted-foreground'>created_at:</span>{' '}
                  {formatTimestampToDate(detailData.publication.created_at)}
                </div>
                <div>
                  <span className='text-muted-foreground'>published_at:</span>{' '}
                  {formatTimestampToDate(detailData.publication.published_at)}
                </div>
              </div>

              {detailData.order_claim ? (
                <div className='rounded-md border p-3 text-sm'>
                  <p className='mb-1 font-medium'>order_claim</p>
                  <div className='text-muted-foreground grid gap-1'>
                    <span>
                      #{detailData.order_claim.id} · {detailData.order_claim.claim_status}
                    </span>
                    <span>
                      {detailData.order_claim.source_platform || '-'} / {detailData.order_claim.external_order_no || '-'}
                    </span>
                    <span>{detailData.order_claim.claimed_product || '-'}</span>
                    <span>{detailData.order_claim.buyer_contact || '-'}</span>
                  </div>
                </div>
              ) : null}

              {detailData.code_object ? (
                <div className='rounded-md border p-3 text-sm'>
                  <p className='mb-1 font-medium'>code_object</p>
                  <div className='text-muted-foreground grid gap-1'>
                    <span>
                      type: {detailData.code_object.code_type} / object_id: {detailData.code_object.object_id}
                    </span>
                    <span>name: {detailData.code_object.name || '-'}</span>
                    <span>status: {detailData.code_object.status_text || detailData.code_object.status || '-'}</span>
                    <span>plan_title: {detailData.code_object.plan_title || '-'}</span>
                    <span>product_key: {detailData.code_object.product_key || '-'}</span>
                  </div>
                </div>
              ) : null}

              <div className='space-y-2'>
                <p className='font-medium'>deliveries ({detailData.deliveries.length})</p>
                {detailData.deliveries.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>-</p>
                ) : (
                  <div className='grid gap-2'>{detailData.deliveries.map(renderDelivery)}</div>
                )}
              </div>

              <div className='space-y-2'>
                <p className='font-medium'>operation_logs ({detailData.operation_logs.length})</p>
                {detailData.operation_logs.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>-</p>
                ) : (
                  <div className='grid gap-2'>{detailData.operation_logs.map(renderLog)}</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SectionPageLayout>
  )
}
