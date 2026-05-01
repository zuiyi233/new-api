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
import { getMjLogs, searchMjLogs } from './api'
import type { MjLog } from './types'

const route = getRouteApi('/_authenticated/midjourney/')

function useMjLogsColumns(): ColumnDef<MjLog>[] {
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
      accessorKey: 'user_name',
      meta: { label: t('User'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('User')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[100px] truncate font-medium'>
          {row.getValue('user_name') || `#${row.original.user_id}`}
        </div>
      ),
    },
    {
      accessorKey: 'action',
      meta: { label: t('Action'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Action')} />
      ),
      cell: ({ row }) => (
        <div className='w-[80px]'>{row.getValue('action')}</div>
      ),
    },
    {
      accessorKey: 'model_name',
      meta: { label: t('Model'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Model')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[100px] truncate'>
          {row.getValue('model_name') || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'prompt',
      meta: { label: t('Prompt'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Prompt')} />
      ),
      cell: ({ row }) => {
        const prompt = row.getValue('prompt') as string
        return (
          <div className='max-w-[200px] truncate text-xs'>
            {prompt || '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      meta: { label: t('Status'), mobileBadge: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status')} />
      ),
      cell: ({ row }) => (
        <div className='w-[80px]'>{row.getValue('status')}</div>
      ),
    },
    {
      accessorKey: 'quota_used',
      meta: { label: t('Quota'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Quota')} />
      ),
      cell: ({ row }) => (
        <div className='w-[80px]'>{row.getValue('quota_used') || 0}</div>
      ),
    },
    {
      accessorKey: 'created_at',
      meta: { label: t('Created'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Created')} />
      ),
      cell: ({ row }) => {
        const value = row.getValue('created_at') as number
        return (
          <div className='w-[120px]'>
            {formatTimestampToDate(value)}
          </div>
        )
      },
    },
  ]
}

export function Midjourney() {
  const { t } = useTranslation()
  const columns = useMjLogsColumns()
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
      'mj-logs',
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
        ? await searchMjLogs(
            globalFilter,
            pagination.pageIndex + 1,
            pagination.pageSize
          )
        : await getMjLogs(params)

      return {
        items: (result.data?.items || []) as MjLog[],
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
        {t('Midjourney Logs')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {t('View Midjourney image generation logs')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-1 flex-col gap-3 sm:gap-4'>
          <DataTableToolbar
            table={table}
            globalFilter={globalFilter}
            onGlobalFilterChange={onGlobalFilterChange}
            globalFilterPlaceholder={t('Filter logs...')}
          />

          {isLoading ? (
            <TableSkeleton columns={6} rows={isMobile ? 5 : 10} />
          ) : tableData.length === 0 ? (
            <TableEmpty
              title={t('No Midjourney logs found')}
              description={t('No Midjourney image generation logs yet.')}
            />
          ) : isMobile ? (
            <MobileCardList
              table={table}
              renderCard={(row) => {
                const log = row.original
                return (
                  <div className='flex flex-col gap-1.5'>
                    <div className='flex items-center justify-between'>
                      <span className='font-medium'>
                        {log.user_name || `#${log.user_id}`}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        {log.action}
                      </span>
                    </div>
                    <div className='text-muted-foreground text-xs truncate'>
                      {log.prompt || t('No prompt')}
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
