import { useMemo, useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2, Power, PowerOff, FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CopyButton } from '@/components/copy-button'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import {
  batchDeleteRegistrationCodes,
  batchUpdateRegistrationCodeStatus,
} from '../api'
import {
  REGISTRATION_CODE_STATUS,
  SUCCESS_MESSAGES,
} from '../constants'
import type { RegistrationCode } from '../types'
import { exportRowsToCSV } from '@/lib/download'
import { useRegistrationCodes } from './registration-codes-provider'
import {
  REGISTRATION_CODE_EXPORT_COMMON_COLUMNS,
  buildRegistrationCodeExportColumns,
  type RegistrationCodeExportColumnKey,
} from '../lib'
import { ExportColumnsDropdown } from './export-columns-dropdown'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const { t } = useTranslation()
  const { triggerRefresh } = useRegistrationCodes()
  const [exportColumnKeys, setExportColumnKeys] =
    useState<RegistrationCodeExportColumnKey[]>(
      REGISTRATION_CODE_EXPORT_COMMON_COLUMNS
    )
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const selectedIds = useMemo(() => {
    return selectedRows.map((row) => {
      const code = row.original as RegistrationCode
      return code.id
    })
  }, [selectedRows])

  const contentToCopy = useMemo(() => {
    return selectedRows
      .map((row) => {
        const code = row.original as RegistrationCode
        return `${code.name}\t${code.code}`
      })
      .join('\n')
  }, [selectedRows])

  const handleBatchEnable = async () => {
    const result = await batchUpdateRegistrationCodeStatus(
      selectedIds,
      REGISTRATION_CODE_STATUS.ENABLED
    )
    if (result.success) {
      toast.success(t(SUCCESS_MESSAGES.BATCH_STATUS_UPDATED))
      table.resetRowSelection()
      triggerRefresh()
    }
  }

  const handleBatchDisable = async () => {
    const result = await batchUpdateRegistrationCodeStatus(
      selectedIds,
      REGISTRATION_CODE_STATUS.DISABLED
    )
    if (result.success) {
      toast.success(t(SUCCESS_MESSAGES.BATCH_STATUS_UPDATED))
      table.resetRowSelection()
      triggerRefresh()
    }
  }

  const handleBatchDelete = async () => {
    const result = await batchDeleteRegistrationCodes(selectedIds)
    if (result.success) {
      toast.success(t(SUCCESS_MESSAGES.BATCH_DELETED))
      table.resetRowSelection()
      triggerRefresh()
    }
  }

  const handleExportSelected = () => {
    const rows = selectedRows.map((row) => row.original as RegistrationCode)
    if (rows.length === 0) {
      toast.error(t('No registration codes selected'))
      return
    }
    exportRowsToCSV(
      rows,
      buildRegistrationCodeExportColumns(exportColumnKeys),
      'registration-codes-selected.csv'
    )
    toast.success(t('Selected registration codes exported successfully'))
  }

  return (
    <BulkActionsToolbar table={table} entityName={t('registration code')}>
      <CopyButton
        value={contentToCopy}
        variant='outline'
        size='icon'
        className='size-8'
        tooltip={t('Copy selected codes')}
        successTooltip={t('Codes copied!')}
        aria-label={t('Copy selected codes')}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='outline'
            size='icon'
            className='size-8'
            onClick={handleBatchEnable}
          >
            <Power className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('Enable selected')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='outline'
            size='icon'
            className='size-8'
            onClick={handleBatchDisable}
          >
            <PowerOff className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('Disable selected')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='destructive'
            size='icon'
            className='size-8'
            onClick={handleBatchDelete}
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('Delete selected')}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='outline'
            size='icon'
            className='size-8'
            onClick={handleExportSelected}
          >
            <FileDown className='h-4 w-4' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('Export selected')}</TooltipContent>
      </Tooltip>

      <ExportColumnsDropdown
        value={exportColumnKeys}
        onChange={setExportColumnKeys}
      />
    </BulkActionsToolbar>
  )
}
