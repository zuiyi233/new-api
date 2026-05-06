import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import {
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { CheckCircle2, Eye } from 'lucide-react'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { copyToClipboard } from '@/lib/copy-to-clipboard'
import { formatTimestampToDate } from '@/lib/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DataTablePagination,
  DataTableToolbar,
  TableSkeleton,
  TableEmpty,
  MobileCardList,
  DataTableColumnHeader,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { PageFooterPortal, SectionPageLayout } from '@/components/layout'
import {
  getAllClaims,
  getAdminSubscriptionPlans,
  getClaimById,
  reviewClaim,
} from './api'
import type {
  GetOrderClaimsAdminParams,
  OrderClaimAction,
  OrderClaimAdmin,
  OrderClaimGrantType,
  ReviewClaimPayload,
} from './types'

const route = getRouteApi('/_authenticated/order-claim-admin/')

type ReviewFormState = {
  action: OrderClaimAction
  review_note: string
  grant_type: OrderClaimGrantType
  plan_id: string
  product_key: string
  quota: string
  expires_at: string
  max_uses: string
  grant_name: string
  grant_note: string
}

const DEFAULT_REVIEW_FORM: ReviewFormState = {
  action: 'approve',
  review_note: '',
  grant_type: 'subscription',
  plan_id: '',
  product_key: 'novel_product',
  quota: '500000',
  expires_at: '',
  max_uses: '1',
  grant_name: '',
  grant_note: '',
}

function inputDateTimeToTimestamp(value: string): number {
  if (!value) return 0
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  return Math.floor(date.getTime() / 1000)
}

function parsePositiveInt(value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.floor(parsed)
}

function renderClaimStatusBadge(status?: string) {
  if (status === 'approved') {
    return <Badge className='bg-emerald-600'>{status}</Badge>
  }
  if (status === 'rejected') {
    return <Badge variant='destructive'>{status}</Badge>
  }
  return <Badge variant='secondary'>{status || 'pending_review'}</Badge>
}

function renderGrantTypeText(grantType?: string): string {
  switch (grantType) {
    case 'subscription':
      return 'subscription'
    case 'subscription_code':
      return 'subscription_code'
    case 'registration_code':
      return 'registration_code'
    case 'redemption':
      return 'redemption'
    default:
      return '-'
  }
}

function buildReviewPayload(values: ReviewFormState): ReviewClaimPayload {
  const payload: ReviewClaimPayload = {
    action: values.action,
    review_note: values.review_note.trim(),
  }

  if (values.action === 'reject') {
    payload.grant_type = ''
    return payload
  }

  payload.grant_type = values.grant_type
  payload.plan_id = parsePositiveInt(values.plan_id)
  payload.product_key = values.product_key.trim()
  payload.quota = parsePositiveInt(values.quota)
  payload.expires_at = inputDateTimeToTimestamp(values.expires_at)
  payload.max_uses = values.max_uses === '' ? 0 : Math.max(0, Number(values.max_uses) || 0)
  payload.grant_name = values.grant_name.trim()
  payload.grant_note = values.grant_note.trim()

  return payload
}

function useOrderClaimsAdminColumns(
  t: (key: string, options?: Record<string, unknown>) => string,
  onReview: (claim: OrderClaimAdmin) => void,
  onCopyCode: (code?: string) => void
): ColumnDef<OrderClaimAdmin>[] {
  return [
    {
      accessorKey: 'id',
      meta: { label: t('ID'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('ID')} />
      ),
      cell: ({ row }) => <div className='w-[64px]'>#{row.original.id}</div>,
    },
    {
      accessorKey: 'external_order_no',
      meta: { label: t('External Order No'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('External Order No')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[180px] truncate font-medium'>
          {row.original.external_order_no || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'claimed_product',
      meta: { label: t('Claimed Product'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Claimed Product')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[160px] truncate'>
          {row.original.claimed_product || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'claim_status',
      meta: { label: t('Status'), mobileBadge: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status')} />
      ),
      cell: ({ row }) => renderClaimStatusBadge(row.original.claim_status),
    },
    {
      accessorKey: 'grant_type',
      meta: { label: t('Grant Type'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Grant Type')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[150px] truncate text-xs'>
          {renderGrantTypeText(row.original.grant_type)}
        </div>
      ),
    },
    {
      accessorKey: 'granted_code',
      meta: { label: t('Granted Code'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Granted Code')} />
      ),
      cell: ({ row }) => {
        const code = row.original.granted_code
        if (!code) return <span>-</span>
        return (
          <button
            type='button'
            className='font-mono text-xs hover:underline'
            onClick={() => onCopyCode(code)}
            title={code}
          >
            {code}
          </button>
        )
      },
    },
    {
      accessorKey: 'created_at',
      meta: { label: t('Created At'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Created At')} />
      ),
      cell: ({ row }) => (
        <div className='w-[140px]'>
          {formatTimestampToDate(row.original.created_at)}
        </div>
      ),
    },
    {
      id: 'actions',
      meta: { label: t('Actions') },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Actions')} />
      ),
      cell: ({ row }) => {
        const pendingReview = row.original.claim_status === 'pending_review'
        return (
          <Button
            type='button'
            size='sm'
            variant='ghost'
            onClick={() => onReview(row.original)}
          >
            {pendingReview ? (
              <CheckCircle2 className='size-4' />
            ) : (
              <Eye className='size-4' />
            )}
            {pendingReview ? t('Review') : t('View')}
          </Button>
        )
      },
    },
  ]
}

export function OrderClaimAdmin() {
  const { t } = useTranslation()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const queryClient = useQueryClient()

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [reviewOpen, setReviewOpen] = useState(false)
  const [currentClaimId, setCurrentClaimId] = useState<number | null>(null)
  const [reviewForm, setReviewForm] = useState<ReviewFormState>(DEFAULT_REVIEW_FORM)

  const search = route.useSearch()

  const {
    globalFilter,
    onGlobalFilterChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search,
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
  })

  const searchRecord = search as Record<string, unknown>
  const claimIdFromUrl = Number(searchRecord.claimId || 0)
  const claimIdLegacy = Number(searchRecord.claim_id || 0)
  const claimIdFromSearch = claimIdFromUrl > 0 ? claimIdFromUrl : claimIdLegacy
  const autoOpenRaw = searchRecord.autoOpen ?? searchRecord.auto_open
  const autoOpenFromUrl =
    autoOpenRaw === true ||
    autoOpenRaw === 1 ||
    autoOpenRaw === '1' ||
    autoOpenRaw === 'true'

  const { data, isLoading } = useQuery({
    queryKey: [
      'order-claims-admin',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
    ],
    queryFn: async () => {
      const params: GetOrderClaimsAdminParams = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }
      const keyword = globalFilter?.trim()
      if (keyword) {
        params.keyword = keyword
      }
      const result = await getAllClaims(params)
      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (prev) => prev,
  })

  const tableData = useMemo(() => data?.items || [], [data?.items])
  const totalCount = data?.total || 0

  useEffect(() => {
    ensurePageInRange(Math.ceil(totalCount / pagination.pageSize))
  }, [ensurePageInRange, pagination.pageSize, totalCount])

  const { data: claimDetail, isLoading: claimDetailLoading } = useQuery({
    queryKey: ['order-claim-admin-detail', currentClaimId],
    queryFn: async () => {
      if (!currentClaimId) return null
      const res = await getClaimById(currentClaimId)
      return res.data || null
    },
    enabled: reviewOpen && currentClaimId != null,
  })

  const { data: planResp } = useQuery({
    queryKey: ['order-claim-admin-subscription-plans'],
    queryFn: getAdminSubscriptionPlans,
  })

  const plans = planResp?.data || []

  useEffect(() => {
    if (!autoOpenFromUrl || claimIdFromSearch <= 0) return
    setCurrentClaimId(claimIdFromSearch)
    setReviewOpen(true)
  }, [autoOpenFromUrl, claimIdFromSearch])

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!currentClaimId) {
        throw new Error('claim id is empty')
      }
      return reviewClaim(currentClaimId, buildReviewPayload(reviewForm))
    },
    onSuccess: async (res) => {
      if (!res.success) return

      const resultMessage = res.data?.message || res.message || t('Review submitted')
      toast.success(resultMessage)

      const generatedCode = res.data?.generated_code
      if (generatedCode) {
        const copied = await copyToClipboard(generatedCode)
        if (copied) {
          toast.success(t('Generated code copied to clipboard'))
        } else {
          toast.error(t('Generated code copy failed'))
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['order-claims-admin'] })
      setReviewOpen(false)
      setCurrentClaimId(null)
      setReviewForm(DEFAULT_REVIEW_FORM)
    },
  })

  const onCopyCode = async (code?: string) => {
    if (!code) return
    const copied = await copyToClipboard(code)
    if (copied) {
      toast.success(t('Copied'))
    } else {
      toast.error(t('Copy failed'))
    }
  }

  const openReview = (claim: OrderClaimAdmin) => {
    setCurrentClaimId(claim.id)
    setReviewForm(DEFAULT_REVIEW_FORM)
    setReviewOpen(true)
  }

  const columns = useMemo(
    () => useOrderClaimsAdminColumns(t, openReview, onCopyCode),
    [t]
  )

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      pagination,
    },
    pageCount: Math.max(1, Math.ceil(totalCount / pagination.pageSize)),
    manualPagination: true,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  const currentClaim = claimDetail
  const pendingReview = currentClaim?.claim_status === 'pending_review'

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Order Claims Management')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('Review external order claims and grant subscription, registration, or redemption assets')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-1 flex-col gap-3 sm:gap-4'>
          <DataTableToolbar
            table={table}
            searchPlaceholder={t('Filter claims...')}
          />

          {isMobile ? (
            <MobileCardList
              table={table}
              isLoading={isLoading}
              emptyTitle={t('No claims found')}
              emptyDescription={t('No order claims have been made yet.')}
            />
          ) : (
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableSkeleton
                      table={table}
                      keyPrefix='order-claim-admin-skeleton'
                    />
                  ) : table.getRowModel().rows.length === 0 ? (
                    <TableEmpty
                      colSpan={columns.length}
                      title={t('No claims found')}
                      description={t('No order claims have been made yet.')}
                    />
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <PageFooterPortal>
            <DataTablePagination table={table} />
          </PageFooterPortal>
        </div>
      </SectionPageLayout.Content>

      <Dialog
        open={reviewOpen}
        onOpenChange={(open) => {
          setReviewOpen(open)
          if (!open) {
            setCurrentClaimId(null)
            setReviewForm(DEFAULT_REVIEW_FORM)
          }
        }}
      >
        <DialogContent className='max-h-[90vh] max-w-2xl overflow-auto'>
          <DialogHeader>
            <DialogTitle>
              {pendingReview ? t('Review Order Claim') : t('View Order Claim')}
            </DialogTitle>
            <DialogDescription>
              {t('Claim details, proof references, and review action form')}
            </DialogDescription>
          </DialogHeader>

          {claimDetailLoading || !currentClaim ? (
            <div className='space-y-2'>
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className='bg-muted h-9 w-full animate-pulse rounded' />
              ))}
            </div>
          ) : (
            <div className='space-y-4'>
              <div className='grid gap-3 rounded-md border p-3 text-sm sm:grid-cols-2'>
                <div>
                  <span className='text-muted-foreground'>{t('Claim ID')}:</span> #{currentClaim.id}
                </div>
                <div>
                  <span className='text-muted-foreground'>{t('Status')}:</span>{' '}
                  {renderClaimStatusBadge(currentClaim.claim_status)}
                </div>
                <div>
                  <span className='text-muted-foreground'>{t('User ID')}:</span> {currentClaim.user_id}
                </div>
                <div>
                  <span className='text-muted-foreground'>{t('Reviewer ID')}:</span>{' '}
                  {currentClaim.reviewer_id || '-'}
                </div>
                <div className='sm:col-span-2'>
                  <span className='text-muted-foreground'>{t('Source Platform')}:</span>{' '}
                  {currentClaim.source_platform || '-'}
                </div>
                <div className='sm:col-span-2'>
                  <span className='text-muted-foreground'>{t('External Order No')}:</span>{' '}
                  {currentClaim.external_order_no || '-'}
                </div>
                <div className='sm:col-span-2'>
                  <span className='text-muted-foreground'>{t('Claimed Product')}:</span>{' '}
                  {currentClaim.claimed_product || '-'}
                </div>
                <div className='sm:col-span-2'>
                  <span className='text-muted-foreground'>{t('Buyer Contact')}:</span>{' '}
                  {currentClaim.buyer_contact || '-'}
                </div>
                <div className='sm:col-span-2'>
                  <span className='text-muted-foreground'>{t('Claim Note')}:</span>{' '}
                  {currentClaim.claim_note || '-'}
                </div>
                <div>
                  <span className='text-muted-foreground'>{t('Created At')}:</span>{' '}
                  {formatTimestampToDate(currentClaim.created_at)}
                </div>
                <div>
                  <span className='text-muted-foreground'>{t('Reviewed At')}:</span>{' '}
                  {currentClaim.reviewed_at ? formatTimestampToDate(currentClaim.reviewed_at) : '-'}
                </div>
                <div className='sm:col-span-2'>
                  <span className='text-muted-foreground'>{t('Review Note')}:</span>{' '}
                  {currentClaim.review_note || '-'}
                </div>
                <div className='sm:col-span-2'>
                  <span className='text-muted-foreground'>{t('Proof Images')}:</span>
                  <div className='mt-1 flex flex-wrap gap-2'>
                    {(currentClaim.proof_images || []).length === 0 ? (
                      <span>-</span>
                    ) : (
                      currentClaim.proof_images?.map((url, index) => (
                        <Button
                          key={`${url}-${index}`}
                          type='button'
                          size='sm'
                          variant='outline'
                          onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                        >
                          {t('Proof {{index}}', { index: index + 1 })}
                        </Button>
                      ))
                    )}
                  </div>
                </div>
                <div className='sm:col-span-2'>
                  <span className='text-muted-foreground'>{t('Grant Type')}:</span>{' '}
                  {renderGrantTypeText(currentClaim.grant_type)}
                </div>
                <div className='sm:col-span-2'>
                  <span className='text-muted-foreground'>{t('Granted Code')}:</span>{' '}
                  {currentClaim.granted_code ? (
                    <button
                      type='button'
                      className='font-mono hover:underline'
                      onClick={() => onCopyCode(currentClaim.granted_code)}
                    >
                      {currentClaim.granted_code}
                    </button>
                  ) : (
                    '-'
                  )}
                </div>
              </div>

              {pendingReview ? (
                <div className='space-y-4 rounded-md border p-3'>
                  <div className='space-y-2'>
                    <Label>{t('Action')}</Label>
                    <RadioGroup
                      value={reviewForm.action}
                      onValueChange={(value) =>
                        setReviewForm((prev) => ({
                          ...prev,
                          action: value as OrderClaimAction,
                        }))
                      }
                      className='grid grid-cols-2 gap-2'
                    >
                      <label className='flex items-center gap-2 rounded-md border p-2 text-sm'>
                        <RadioGroupItem value='approve' />
                        <span>{t('Approve')}</span>
                      </label>
                      <label className='flex items-center gap-2 rounded-md border p-2 text-sm'>
                        <RadioGroupItem value='reject' />
                        <span>{t('Reject')}</span>
                      </label>
                    </RadioGroup>
                  </div>

                  <div className='space-y-2'>
                    <Label htmlFor='review_note'>{t('Review Note')}</Label>
                    <Textarea
                      id='review_note'
                      value={reviewForm.review_note}
                      onChange={(e) =>
                        setReviewForm((prev) => ({
                          ...prev,
                          review_note: e.target.value,
                        }))
                      }
                      placeholder={t('Optional review note')}
                      rows={3}
                    />
                  </div>

                  {reviewForm.action === 'approve' ? (
                    <>
                      <div className='space-y-2'>
                        <Label>{t('Grant Type')}</Label>
                        <RadioGroup
                          value={reviewForm.grant_type}
                          onValueChange={(value) =>
                            setReviewForm((prev) => ({
                              ...prev,
                              grant_type: value as OrderClaimGrantType,
                            }))
                          }
                          className='grid gap-2 sm:grid-cols-2'
                        >
                          <label className='flex items-center gap-2 rounded-md border p-2 text-sm'>
                            <RadioGroupItem value='subscription' />
                            <span>{t('Subscription')}</span>
                          </label>
                          <label className='flex items-center gap-2 rounded-md border p-2 text-sm'>
                            <RadioGroupItem value='subscription_code' />
                            <span>{t('Subscription Code')}</span>
                          </label>
                          <label className='flex items-center gap-2 rounded-md border p-2 text-sm'>
                            <RadioGroupItem value='registration_code' />
                            <span>{t('Registration Code')}</span>
                          </label>
                          <label className='flex items-center gap-2 rounded-md border p-2 text-sm'>
                            <RadioGroupItem value='redemption' />
                            <span>{t('Redemption')}</span>
                          </label>
                        </RadioGroup>
                      </div>

                      {(reviewForm.grant_type === 'subscription' ||
                        reviewForm.grant_type === 'subscription_code') && (
                        <div className='space-y-2'>
                          <Label htmlFor='plan_id'>{t('Plan')}</Label>
                          <select
                            id='plan_id'
                            className='border-input bg-background w-full rounded-md border px-3 py-2 text-sm'
                            value={reviewForm.plan_id}
                            onChange={(e) =>
                              setReviewForm((prev) => ({
                                ...prev,
                                plan_id: e.target.value,
                              }))
                            }
                          >
                            <option value=''>{t('Select plan')}</option>
                            {plans.map((item) => (
                              <option key={item.plan.id} value={String(item.plan.id)}>
                                {item.plan.title}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {reviewForm.grant_type === 'registration_code' && (
                        <div className='space-y-2'>
                          <Label htmlFor='product_key'>{t('Product Key')}</Label>
                          <Input
                            id='product_key'
                            value={reviewForm.product_key}
                            onChange={(e) =>
                              setReviewForm((prev) => ({
                                ...prev,
                                product_key: e.target.value,
                              }))
                            }
                            placeholder='novel_product'
                          />
                        </div>
                      )}

                      {reviewForm.grant_type === 'redemption' && (
                        <div className='space-y-2'>
                          <Label htmlFor='quota'>{t('Quota')}</Label>
                          <Input
                            id='quota'
                            type='number'
                            min={1}
                            value={reviewForm.quota}
                            onChange={(e) =>
                              setReviewForm((prev) => ({
                                ...prev,
                                quota: e.target.value,
                              }))
                            }
                          />
                        </div>
                      )}

                      {(reviewForm.grant_type === 'subscription_code' ||
                        reviewForm.grant_type === 'registration_code') && (
                        <div className='space-y-2'>
                          <Label htmlFor='max_uses'>{t('Max Uses')}</Label>
                          <Input
                            id='max_uses'
                            type='number'
                            min={0}
                            value={reviewForm.max_uses}
                            onChange={(e) =>
                              setReviewForm((prev) => ({
                                ...prev,
                                max_uses: e.target.value,
                              }))
                            }
                          />
                        </div>
                      )}

                      <div className='grid gap-3 sm:grid-cols-2'>
                        <div className='space-y-2'>
                          <Label htmlFor='grant_name'>{t('Grant Name')}</Label>
                          <Input
                            id='grant_name'
                            value={reviewForm.grant_name}
                            onChange={(e) =>
                              setReviewForm((prev) => ({
                                ...prev,
                                grant_name: e.target.value,
                              }))
                            }
                            placeholder={t('Optional grant name')}
                          />
                        </div>
                        <div className='space-y-2'>
                          <Label htmlFor='expires_at'>{t('Expires At')}</Label>
                          <Input
                            id='expires_at'
                            type='datetime-local'
                            value={reviewForm.expires_at}
                            onChange={(e) =>
                              setReviewForm((prev) => ({
                                ...prev,
                                expires_at: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className='space-y-2'>
                        <Label htmlFor='grant_note'>{t('Grant Note')}</Label>
                        <Textarea
                          id='grant_note'
                          value={reviewForm.grant_note}
                          onChange={(e) =>
                            setReviewForm((prev) => ({
                              ...prev,
                              grant_note: e.target.value,
                            }))
                          }
                          placeholder={t('Optional grant note')}
                          rows={3}
                        />
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setReviewOpen(false)
                setCurrentClaimId(null)
                setReviewForm(DEFAULT_REVIEW_FORM)
              }}
            >
              {t('Close')}
            </Button>
            {pendingReview ? (
              <Button
                type='button'
                onClick={() => reviewMutation.mutate()}
                disabled={reviewMutation.isPending}
              >
                {reviewMutation.isPending ? t('Submitting...') : t('Submit Review')}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionPageLayout>
  )
}
