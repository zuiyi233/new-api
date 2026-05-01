import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { formatTimestampToDate } from '@/lib/format'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { StatusBadge } from '@/components/status-badge'
import {
  REGISTRATION_CODE_STATUSES,
  REGISTRATION_CODE_STATUS,
} from '../constants'
import {
  isRegistrationCodeExpired,
  isRegistrationCodeExhausted,
} from '../lib'
import type { RegistrationCode } from '../types'
import { DataTableRowActions } from './data-table-row-actions'

export function useRegistrationCodesColumns(): ColumnDef<RegistrationCode>[] {
  const { t } = useTranslation()
  return [
    {
      id: 'select',
      meta: { label: t('Select') },
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('Select all')}
          className='translate-y-[2px]'
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t('Select row')}
          className='translate-y-[2px]'
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
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
      accessorKey: 'name',
      meta: { label: t('Name'), mobileTitle: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Name')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[150px] truncate font-medium'>
          {row.getValue('name')}
        </div>
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
            {code ? `${code.slice(0, 8)}...` : '-'}
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
      cell: ({ row }) => {
        const record = row.original
        const statusValue = row.getValue('status') as number

        if (isRegistrationCodeExpired(record.expires_at, statusValue)) {
          return (
            <StatusBadge
              label={t('Expired')}
              variant='warning'
              showDot={true}
              copyable={false}
            />
          )
        }

        if (
          statusValue === REGISTRATION_CODE_STATUS.ENABLED &&
          isRegistrationCodeExhausted(record)
        ) {
          return (
            <StatusBadge
              label={t('Exhausted')}
              variant='neutral'
              showDot={true}
              copyable={false}
            />
          )
        }

        const statusConfig = REGISTRATION_CODE_STATUSES[statusValue]
        if (!statusConfig) return null

        return (
          <StatusBadge
            label={t(statusConfig.labelKey)}
            variant={statusConfig.variant}
            showDot={statusConfig.showDot}
            copyable={false}
          />
        )
      },
      filterFn: (row, id, value) => {
        return value.includes(String(row.getValue(id)))
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
          {row.getValue('product_key') || 'novel_product'}
        </div>
      ),
    },
    {
      accessorKey: 'batch_no',
      meta: { label: t('Batch No'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Batch No')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[100px] truncate'>
          {row.getValue('batch_no') || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'channel',
      meta: { label: t('Channel'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Channel')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[80px] truncate'>
          {row.getValue('channel') || '-'}
        </div>
      ),
    },
    {
      accessorKey: 'source_platform',
      meta: { label: t('Platform'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Platform')} />
      ),
      cell: ({ row }) => (
        <div className='max-w-[80px] truncate'>
          {row.getValue('source_platform') || '-'}
        </div>
      ),
    },
    {
      id: 'usage',
      meta: { label: t('Usage'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Usage')} />
      ),
      cell: ({ row }) => {
        const record = row.original
        const used = Number(record.used_count || 0)
        const max = Number(record.max_uses || 0)
        return (
          <div className='w-[80px]'>
            {max > 0 ? `${used}/${max}` : `${used}/${t('Unlimited')}`}
          </div>
        )
      },
    },
    {
      accessorKey: 'expires_at',
      meta: { label: t('Expires'), mobileHidden: true },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title={t('Expires')} />
      ),
      cell: ({ row }) => {
        const value = row.getValue('expires_at') as number
        return (
          <div className='w-[120px]'>
            {value === 0
              ? t('Never')
              : formatTimestampToDate(value)}
          </div>
        )
      },
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
    {
      id: 'actions',
      meta: { label: t('Actions') },
      cell: ({ row }) => <DataTableRowActions row={row} />,
    },
  ]
}
