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
} from '@tanstack/react-table'
import { useMediaQuery } from '@/hooks'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
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
  DISABLED_ROW_DESKTOP,
  DISABLED_ROW_MOBILE,
  DataTablePagination,
  DataTableToolbar,
  TableSkeleton,
  TableEmpty,
  MobileCardList,
} from '@/components/data-table'
import { PageFooterPortal } from '@/components/layout'
import { getSubscriptionCodes, searchSubscriptionCodes } from '../api'
import {
  SUBSCRIPTION_CODE_STATUS,
  getSubscriptionCodeStatusOptions,
} from '../constants'
import {
  isSubscriptionCodeExpired,
  isSubscriptionCodeExhausted,
} from '../lib'
import type { SubscriptionCode } from '../types'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { useSubscriptionCodesColumns } from './subscription-codes-columns'
import { useSubscriptionCodes } from './subscription-codes-provider'

const route = getRouteApi('/_authenticated/subscription-codes/')

function isDisabledRow(code: SubscriptionCode) {
  return (
    code.status !== SUBSCRIPTION_CODE_STATUS.ENABLED ||
    isSubscriptionCodeExpired(code.expires_at, code.status) ||
    isSubscriptionCodeExhausted(code)
  )
}

export function SubscriptionCodesTable() {
  const { t } = useTranslation()
  const columns = useSubscriptionCodesColumns()
  const { refreshTrigger, setCurrentPageData } = useSubscriptionCodes()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [rowSelection, setRowSelection] = useState({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'filter' },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
      { columnId: 'product_key', searchKey: 'product_key', type: 'array' },
      { columnId: 'channel', searchKey: 'channel', type: 'array' },
    ],
  })

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'subscription-codes',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      const hasFilter = globalFilter?.trim()
      const params = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }

      const result = hasFilter
        ? await searchSubscriptionCodes(
            globalFilter,
            pagination.pageIndex + 1,
            pagination.pageSize
          )
        : await getSubscriptionCodes(params)

      return {
        items: (result.data?.items || []) as SubscriptionCode[],
        total: result.data?.total || 0,
      }
    },
  })

  const tableData = useMemo(() => data?.items || [], [data?.items])
  const totalCount = data?.total || 0

  useEffect(() => {
    setCurrentPageData(tableData)
  }, [tableData, setCurrentPageData])

  useEffect(() => {
    ensurePageInRange(totalCount)
  }, [totalCount, ensurePageInRange])

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      globalFilter,
      columnFilters,
      pagination,
    },
    pageCount: Math.ceil(totalCount / pagination.pageSize),
    manualPagination: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: onColumnFiltersChange,
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

  const statusOptions = getSubscriptionCodeStatusOptions(t)
  const productOptions = [
    { label: 'novel_product', value: 'novel_product' },
  ]

  return (
    <div className='flex flex-1 flex-col gap-3 sm:gap-4'>
      <DataTableToolbar
        table={table}
        globalFilter={globalFilter}
        onGlobalFilterChange={onGlobalFilterChange}
        globalFilterPlaceholder={t('Filter subscription codes...')}
        filters={[
          {
            columnId: 'status',
            title: t('Status'),
            options: statusOptions,
          },
          {
            columnId: 'product_key',
            title: t('Product'),
            options: productOptions,
          },
        ]}
      />

      <DataTableBulkActions table={table} />

      {isLoading ? (
        <TableSkeleton columns={6} rows={isMobile ? 5 : 10} />
      ) : tableData.length === 0 ? (
        <TableEmpty
          title={t('No subscription codes found')}
          description={t(
            'Create your first subscription code to get started.'
          )}
        />
      ) : isMobile ? (
        <MobileCardList
          table={table}
          renderCard={(row) => {
            const code = row.original
            const isDisabled = isDisabledRow(code)
            return (
              <div
                className={cn(
                  'flex flex-col gap-1.5',
                  isDisabled && DISABLED_ROW_MOBILE
                )}
              >
                <div className='flex items-center justify-between'>
                  <span className='font-medium'>{code.name}</span>
                  <span className='text-muted-foreground text-xs'>
                    #{code.id}
                  </span>
                </div>
                <div className='text-muted-foreground text-xs'>
                  {code.code
                    ? `${code.code.slice(0, 12)}...`
                    : t('No code')}
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
                table.getRowModel().rows.map((row) => {
                  const isDisabled = isDisabledRow(row.original)
                  return (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && 'selected'}
                      className={cn(isDisabled && DISABLED_ROW_DESKTOP)}
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
                  )
                })
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
  )
}
