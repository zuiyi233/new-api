import { useState } from 'react'
import { Plus, Upload, History, BarChart3, FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportRowsToCSV } from '@/lib/download'
import type { RegistrationCode } from '../types'
import { useRegistrationCodes } from './registration-codes-provider'
import {
  REGISTRATION_CODE_EXPORT_COMMON_COLUMNS,
  buildRegistrationCodeExportColumns,
  type RegistrationCodeExportColumnKey,
} from '../lib'
import { ExportColumnsDropdown } from './export-columns-dropdown'

export function RegistrationCodesPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, currentPageData } = useRegistrationCodes()
  const [exportColumnKeys, setExportColumnKeys] =
    useState<RegistrationCodeExportColumnKey[]>(
      REGISTRATION_CODE_EXPORT_COMMON_COLUMNS
    )

  const handleExportCurrentPage = () => {
    const rows = currentPageData || []
    if (rows.length === 0) {
      toast.error(t('No registration codes to export'))
      return
    }
    exportRowsToCSV(
      rows as unknown as RegistrationCode[],
      buildRegistrationCodeExportColumns(exportColumnKeys),
      'registration-codes.csv'
    )
    toast.success(t('Registration codes exported successfully'))
  }

  return (
    <div className='flex gap-2'>
      <Button size='sm' onClick={() => setOpen('create')}>
        <Plus className='h-4 w-4' />
        {t('Create Code')}
      </Button>
      <Button size='sm' variant='outline' onClick={() => setOpen('import')}>
        <Upload className='h-4 w-4' />
        {t('Import CSV')}
      </Button>
      <Button size='sm' variant='outline' onClick={() => setOpen('history')}>
        <History className='h-4 w-4' />
        {t('History')}
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={() => setOpen('batchSummary')}
      >
        <BarChart3 className='h-4 w-4' />
        {t('Batch Summary')}
      </Button>
      <Button
        size='sm'
        variant='outline'
        onClick={handleExportCurrentPage}
      >
        <FileDown className='h-4 w-4' />
        {t('Export current page')}
      </Button>
      <ExportColumnsDropdown
        value={exportColumnKeys}
        onChange={setExportColumnKeys}
      />
    </div>
  )
}
