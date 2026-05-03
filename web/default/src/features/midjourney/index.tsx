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
import { useIsAdmin } from '@/hooks/use-admin'
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
  DataTableColumnHeader,
} from '@/components/data-table'
import { PageFooterPortal, SectionPageLayout } from '@/components/layout'
import { formatTimestampToDate } from '@/lib/format'
import { getMjLogs } from './api'
import type { GetMjLogsParams, MjLog } from './types'

const route = getRouteApi('/_authenticated/midjourney/')

function useMjLogsColumns(isAdmin: boolean): ColumnDef<MjLog>[] {
  const { t } = useTranslation()

  const columns: ColumnDef<MjLog>[] = [
    {
      accessorKey: 'id',
      meta: { label: t('ID'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('ID')} />
      ),
      cell: ({ row }) => <div className='w-[60px]'>#{row.original.id}</div>,
    },
  ]

  if (isAdmin) {
    columns.push({
      accessorKey: 'user_name',
      meta: { label: t('User'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('User')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[120px] truncate font-medium'>
          {row.original.user_name || `#${row.original.user_id}`}
        </div>
      ),
    })
  } else {
    columns.push({
      accessorKey: 'mj_id',
      meta: { label: t('Task ID'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Task ID')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[160px] truncate font-medium'>
          {row.original.mj_id || '-'}
        </div>
      ),
    })
  }

  columns.push(
    {
      accessorKey: 'status',
      meta: { label: t('Status'), mobileBadge: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Status')} />
      ),
      cell: ({ row }) => <span>{row.original.status || '-'}</span>,
    },
    {
      accessorKey: 'action',
      meta: { label: t('Action'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Action')} />
      ),
      cell: ({ row }) => <span>{row.original.action || '-'}</span>,
    },
    {
      accessorKey: 'channel_id',
      meta: { label: t('Channel'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Channel')} />
      ),
      cell: ({ row }) => (
        <span>
          {row.original.channel_name || row.original.channel_id || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'mj_id_detail',
      meta: { label: t('Task ID'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Task ID')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[160px] truncate font-mono text-xs'>
          {row.original.mj_id || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'prompt',
      meta: { label: t('Prompt'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Prompt')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[260px] truncate text-xs'>
          {row.original.prompt || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'quota',
      meta: { label: t('Quota'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Quota')} />
      ),
      cell: ({ row }) => <span>{row.original.quota || 0}</span>,
    },
    {
      accessorKey: 'submit_time',
      meta: { label: t('Submit Time'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Submit Time')} />
      ),
      cell: ({ row }) => (
        <span>
          {row.original.submit_time ? formatTimestampToDate(row.original.submit_time) : '-'}
        </span>
      ),
    }
  )

  return columns
}

export function Midjourney() {
  const { t } = useTranslation()
  const isAdmin = useIsAdmin()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const columns = useMjLogsColumns(isAdmin)
  const search = route.useSearch()

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

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

  const { data, isLoading } = useQuery({
    queryKey: ['mj-logs', isAdmin, pagination.pageIndex + 1, pagination.pageSize, globalFilter],
    queryFn: async () => {
      const params: GetMjLogsParams = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
      }
      const filter = globalFilter?.trim() || ''
      if (filter) {
        params.mj_id = filter
      }
      const result = await getMjLogs(isAdmin, params)
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

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Midjourney Logs')}</SectionPageLayout.Title>
      <SectionPageLayout.Description>
        {isAdmin
          ? t('Admin view for all Midjourney tasks')
          : t('Your Midjourney task history')}
      </SectionPageLayout.Description>
      <SectionPageLayout.Content>
        <div className='flex flex-1 flex-col gap-3 sm:gap-4'>
          <DataTableToolbar
            table={table}
            searchPlaceholder={t('Filter by Task ID...')}
          />

          {isMobile ? (
            <MobileCardList
              table={table}
              isLoading={isLoading}
              emptyTitle={t('No Midjourney logs found')}
              emptyDescription={t('No Midjourney image generation logs yet.')}
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
                    <TableSkeleton table={table} keyPrefix='midjourney-skeleton' />
                  ) : table.getRowModel().rows.length === 0 ? (
                    <TableEmpty
                      colSpan={columns.length}
                      title={t('No Midjourney logs found')}
                      description={t('No Midjourney image generation logs yet.')}
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
    </SectionPageLayout>
  )
}
