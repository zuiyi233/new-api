import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { useTableUrlState } from '@/hooks/use-table-url-state'
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
} from '@/components/data-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { PageFooterPortal } from '@/components/layout'
import { SectionPageLayout } from '@/components/layout'
import { formatTimestampToDate } from '@/lib/format'
import { getAllClaims, searchAllClaims } from './api'
import type { OrderClaimAdmin } from './types'

const route = getRouteApi('/_authenticated/order-claim-admin/')

function useOrderClaimsAdminColumns(): ColumnDef<OrderClaimAdmin>[] {
  const { t } = useTranslation()
  return [
    {
      accessorKey: 'id',
      meta: { label: t('ID'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('ID')} />
      ),
      cell: ({ row }) => (
        <div className='w-[60px]'>{row.getValue('id')}</div>
      ),
    },
    {
      accessorKey: 'order_no',
      meta: { label: t('Order No'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Order No')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[150px] truncate font-medium'>
          {row.getValue('order_no')}
        </div>
      ),
    },
    {
      accessorKey: 'user_name',
      meta: { label: t('User'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('User')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[100px] truncate'>
          {row.getValue('user_name') || `#${row.original.user_id}`}
        </div>
      ),
    },
    {
      accessorKey: 'code_type',
      meta: { label: t('Type'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Type')} />
      ),
      cell: ({ row }) => (
        <div className='w-[100px]'>{row.getValue('code_type')}</div>
      ),
    },
    {
      accessorKey: 'code',
      meta: { label: t('Code'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Code')} />
      ),
      cell: ({ row }) => {
        const code = row.getValue('code') as string
        return (
          <div className='max-w-[120px] truncate font-mono text-xs'>
            {code || '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'product_key',
      meta: { label: t('Product'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Product')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[100px] truncate text-xs'>
          {row.getValue('product_key') || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'claimed_at',
      meta: { label: t('Claimed At'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Claimed At')} />
      ),
      cell: ({ row }) => {
        const value = row.getValue('claimed_at') as number
        return (
          <div className='w-[120px]'>
            {value ? formatTimestampToDate(value) : '-'}
          </div>
        )
      },
    },
  ]
}

export function OrderClaimAdmin() {
  const { t } = useTranslation()
  const columns = useOrderClaimsAdminColumns()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const {
    globalFilter,
    onGlobalFilterChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'order-claims-admin',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
    ],
    queryFn: async () => {
      const hasFilter = globalFilter?.trim()
      const params = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }

      const result = hasFilter
        ? await searchAllClaims(
            globalFilter,
            pagination.pageIndex + 1,
            pagination.pageSize
          )
        : await getAllClaims(params)

      return {
        items: (result.data?.items || []) as OrderClaimAdmin[],
        total: result.data?.total || 0,
      }
    },
  })

  const tableData = useMemo(() => data?.items || [], [data?.items])
  const totalCount = data?.total || 0

  useEffect(() => {
    ensurePageInRange(totalCount)
  }, [totalCount, ensurePageInRange])

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnVisibility,
      globalFilter,
      pagination,
    },
    pageCount: Math.ceil(totalCount / pagination.pageSize),
    manualPagination: true,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: onGlobalFilterChange,
    onPaginationChange: onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('Order Claims Management')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('View all order claims across users')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-1 flex-col gap-3 sm:gap-4'>
          <DataTableToolbar
            table={table}
            globalFilter={globalFilter}
            onGlobalFilterChange={onGlobalFilterChange}
            globalFilterPlaceholder={t('Filter claims...')}
          />

          {isLoading ? (
            <TableSkeleton columns={6} rows={isMobile ? 5 : 10} />
          ) : tableData.length === 0 ? (
            <TableEmpty
              title={t('No claims found')}
              description={t('No order claims have been made yet.')}
            />
          ) : isMobile ? (
            <MobileCardList
              table={table}
              renderCard={(row) => {
                const claim = row.original
                return (
                  <div className='flex flex-col gap-1.5'>
                    <div className='flex items-center justify-between'>
                      <span className='font-medium'>{claim.order_no}</span>
                      <span className='text-muted-foreground text-xs'>
                        #{claim.id}
                      </span>
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {claim.code} - {claim.code_type}
                    </div>
                  </div>
                )
              }}
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
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && 'selected'}
                      >
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
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className='h-24 text-center'
                      >
                        {t('No results.')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <PageFooterPortal>
            <DataTablePagination
              table={table}
              totalCount={totalCount}
              isFetching={isFetching}
            />
          </PageFooterPortal>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
