import { Plus, Upload, History, BarChart3, FileDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportRowsToCSV } from '@/lib/download'
import type { SubscriptionCode } from '../types'
import { useSubscriptionCodes } from './subscription-codes-provider'

const EXPORT_COLUMNS = [
  { key: 'id' as const, label: 'id' },
  { key: 'name' as const, label: 'name' },
  { key: 'code' as const, label: 'code' },
  { key: 'status' as const, label: 'status' },
  { key: 'product_key' as const, label: 'product_key' },
  { key: 'batch_no' as const, label: 'batch_no' },
  { key: 'campaign_name' as const, label: 'campaign_name' },
  { key: 'channel' as const, label: 'channel' },
  { key: 'source_platform' as const, label: 'source_platform' },
  { key: 'external_order_no' as const, label: 'external_order_no' },
  { key: 'used_count' as const, label: 'used_count' },
  { key: 'max_uses' as const, label: 'max_uses' },
  { key: 'expires_at' as const, label: 'expires_at' },
  { key: 'created_at' as const, label: 'created_at' },
]

export function SubscriptionCodesPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen, currentPageData } = useSubscriptionCodes()

  const handleExportCurrentPage = () => {
    const rows = currentPageData || []
    if (rows.length === 0) {
      toast.error(t('No subscription codes to export'))
      return
    }
    exportRowsToCSV(rows as unknown as SubscriptionCode[], EXPORT_COLUMNS, 'subscription-codes.csv')
    toast.success(t('Subscription codes exported successfully'))
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
    </div>
  )
}
