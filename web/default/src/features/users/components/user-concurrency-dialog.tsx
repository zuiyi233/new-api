import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adjustUserConcurrency } from '../api'
import type { ConcurrencyOverrideMode } from '../types'

interface UserConcurrencyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  currentOverride: number | null | undefined
  onSuccess: () => void
}

export function UserConcurrencyDialog(props: UserConcurrencyDialogProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<ConcurrencyOverrideMode>('set')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (mode === 'set') {
      const numVal = parseInt(value)
      if (!numVal || numVal <= 0) {
        toast.error(t('Concurrency override value must be greater than 0'))
        return
      }
    }

    setLoading(true)
    try {
      const result = await adjustUserConcurrency({
        id: props.userId,
        action: 'set_concurrency_override',
        mode,
        value: mode === 'set' ? parseInt(value) : 0,
      })
      if (result.success) {
        toast.success(
          mode === 'set'
            ? t('Concurrency override saved successfully')
            : t('Concurrency override cleared')
        )
        setValue('')
        setMode('set')
        props.onOpenChange(false)
        props.onSuccess()
      } else {
        toast.error(
          result.message || t('Failed to update concurrency override')
        )
      }
    } catch (e: unknown) {
      toast.error(
        e instanceof Error
          ? e.message
          : t('Failed to update concurrency override')
      )
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setValue('')
    setMode('set')
    props.onOpenChange(false)
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Concurrency Override')}</DialogTitle>
          <DialogDescription>
            {t(
              'Set or clear the concurrency limit override for this user. When set, it takes priority over the global default.'
            )}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='text-muted-foreground text-sm'>
            {t('Current override')}:{' '}
            {props.currentOverride && props.currentOverride > 0
              ? props.currentOverride
              : t('Not set (using global default)')}
          </div>

          <div className='space-y-2'>
            <Label>{t('Mode')}</Label>
            <div className='flex gap-1'>
              {(['set', 'clear'] as const).map((m) => (
                <Button
                  key={m}
                  type='button'
                  variant='outline'
                  size='sm'
                  className={
                    mode === m
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      : ''
                  }
                  onClick={() => {
                    setMode(m)
                    setValue('')
                  }}
                >
                  {m === 'set' ? t('Set Override') : t('Clear Override')}
                </Button>
              ))}
            </div>
          </div>

          {mode === 'set' && (
            <div className='space-y-2'>
              <Label>{t('Concurrency limit')}</Label>
              <Input
                type='number'
                min={1}
                step={1}
                placeholder={t('Enter concurrency override value')}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm()
                }}
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={handleCancel}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? t('Processing...') : t('Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
