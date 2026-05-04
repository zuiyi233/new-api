import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export type CopyFormat = 'name_key' | 'key_only'

interface CopyKeysFormatDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (format: CopyFormat) => void
}

export function CopyKeysFormatDialog(props: CopyKeysFormatDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('Copy Keys Format')}</DialogTitle>
          <DialogDescription>
            {t('Choose the format for copying selected keys')}
          </DialogDescription>
        </DialogHeader>
        <div className='grid gap-3'>
          <Button
            variant='outline'
            className='h-auto py-3 justify-start text-left'
            onClick={() => {
              props.onConfirm('name_key')
              props.onOpenChange(false)
            }}
          >
            <div>
              <div className='font-medium'>{t('Name + Key')}</div>
              <div className='text-muted-foreground text-xs mt-0.5'>
                {t('Format: name<TAB>key')}
              </div>
            </div>
          </Button>
          <Button
            variant='outline'
            className='h-auto py-3 justify-start text-left'
            onClick={() => {
              props.onConfirm('key_only')
              props.onOpenChange(false)
            }}
          >
            <div>
              <div className='font-medium'>{t('Key Only')}</div>
              <div className='text-muted-foreground text-xs mt-0.5'>
                {t('Format: key only, one per line')}
              </div>
            </div>
          </Button>
        </div>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
