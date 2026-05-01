import { Plus, Upload, History, BarChart3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useRegistrationCodes } from './registration-codes-provider'

export function RegistrationCodesPrimaryButtons() {
  const { t } = useTranslation()
  const { setOpen } = useRegistrationCodes()
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
    </div>
  )
}
