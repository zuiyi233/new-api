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
import { getRegistrationCodes, searchRegistrationCodes } from '../api'
import {
  REGISTRATION_CODE_STATUS,
  getRegistrationCodeStatusOptions,
} from '../constants'
import {
  isRegistrationCodeExpired,
  isRegistrationCodeExhausted,
} from '../lib'
import type { RegistrationCode } from '../types'
import { DataTableBulkActions } from './data-table-bulk-actions'
import { useRegistrationCodesColumns } from './registration-codes-columns'
import { useRegistrationCodes } from './registration-codes-provider'

const route = getRouteApi('/_authenticated/registration-codes/')

function isDisabledRow(code: RegistrationCode) {
  return (
    code.status !== REGISTRATION_CODE_STATUS.ENABLED ||
    isRegistrationCodeExpired(code.expires_at, code.status) ||
    isRegistrationCodeExhausted(code)
  )
}

export function RegistrationCodesTable() {
  const { t } = useTranslation()
  const columns = useRegistrationCodesColumns()
  const { refreshTrigger, setCurrentPageData } = useRegistrationCodes()
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

  const { data, isLoading } = useQuery({
    queryKey: [
      'registration-codes',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      columnFilters,
      refreshTrigger,
    ],
    queryFn: async () => {
      const filterText = globalFilter ?? ''
      const hasFilter = filterText.trim()
      const params: Record<string, string | number> = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }

      for (const filter of columnFilters) {
        if (filter.value == null) continue
        const values = Array.isArray(filter.value) ? filter.value : [filter.value]
        const joined = values.join(',')
        if (joined) {
          params[filter.id] = joined
        }
      }

      const result = hasFilter
        ? await searchRegistrationCodes(
            filterText,
            pagination.pageIndex + 1,
            pagination.pageSize
          )
        : await getRegistrationCodes(params)

      return {
        items: (result.data?.items || []) as RegistrationCode[],
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

  const statusOptions = getRegistrationCodeStatusOptions(t)
  const productOptions = [
    { label: 'novel_product', value: 'novel_product' },
  ]
  return (
    <div className='flex flex-1 flex-col gap-3 sm:gap-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder={t('Filter registration codes...')}
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

      {isMobile ? (
        <MobileCardList
          table={table}
          isLoading={isLoading}
          emptyTitle={t('No registration codes found')}
          emptyDescription={t(
            'Create your first registration code to get started.'
          )}
          getRowClassName={(row) =>
            isDisabledRow(row.original) ? DISABLED_ROW_MOBILE : undefined
          }
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
                  keyPrefix='registration-codes-skeleton'
                />
              ) : table.getRowModel().rows?.length ? (
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
                <TableEmpty
                  colSpan={columns.length}
                  title={t('No registration codes found')}
                  description={t(
                    'Create your first registration code to get started.'
                  )}
                />
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <PageFooterPortal>
        <DataTablePagination
          table={table}
        />
      </PageFooterPortal>
    </div>
  )
}
