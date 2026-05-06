import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Markdown } from '@/components/ui/markdown'

export interface RiskChecklistItem {
  id: string
  label: string
}

export interface RiskAcknowledgementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  description?: string
  markdownContent?: string
  detailItems?: { label: string; value: string }[]
  checklist?: RiskChecklistItem[]
  requiredText?: string
  inputPlaceholder?: string
  mismatchText?: string
  cancelText?: string
  confirmText?: string
  onConfirm: () => void
  onCancel?: () => void
}

export function RiskAcknowledgementDialog(
  props: RiskAcknowledgementDialogProps
) {
  const { t } = useTranslation()
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [inputValue, setInputValue] = useState('')

  const allChecked =
    !props.checklist ||
    props.checklist.length === 0 ||
    props.checklist.every((item) => checkedItems[item.id])

  const inputMatches =
    !props.requiredText || inputValue === props.requiredText

  const canConfirm = allChecked && inputMatches

  const handleCheckedChange = (id: string, checked: boolean) => {
    setCheckedItems((prev) => ({ ...prev, [id]: checked }))
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setCheckedItems({})
      setInputValue('')
    }
    props.onOpenChange(open)
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    setCheckedItems({})
    setInputValue('')
    props.onConfirm()
  }

  return (
    <Dialog open={props.open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <AlertTriangle className='h-5 w-5 text-destructive' />
            {props.title || t('Risk Acknowledgement')}
          </DialogTitle>
          {(props.description || props.markdownContent) && (
            <DialogDescription>
              {props.markdownContent ? (
                <div className='text-sm'>
                  <Markdown>{props.markdownContent}</Markdown>
                </div>
              ) : (
                props.description
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className='space-y-4'>
          {props.detailItems && props.detailItems.length > 0 && (
            <div className='space-y-1.5'>
              {props.detailItems.map((item, idx) => (
                <div
                  key={idx}
                  className='flex items-center justify-between rounded-md bg-muted px-3 py-1.5 text-sm'
                >
                  <span className='text-muted-foreground'>
                    {item.label}
                  </span>
                  <span className='font-medium'>{item.value}</span>
                </div>
              ))}
            </div>
          )}

          {props.checklist && props.checklist.length > 0 && (
            <div className='space-y-2'>
              {props.checklist.map((item) => (
                <div
                  key={item.id}
                  className='flex items-start gap-2'
                >
                  <Checkbox
                    id={`risk-check-${item.id}`}
                    checked={checkedItems[item.id] || false}
                    onCheckedChange={(checked) =>
                      handleCheckedChange(item.id, !!checked)
                    }
                  />
                  <label
                    htmlFor={`risk-check-${item.id}`}
                    className='text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'
                  >
                    {item.label}
                  </label>
                </div>
              ))}
            </div>
          )}

          {props.requiredText && (
            <div className='space-y-1.5'>
              <p className='text-sm'>
                {t(
                  'Please type "{{requiredText}}" to confirm',
                  { requiredText: props.requiredText }
                )}
              </p>
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={
                  props.inputPlaceholder ||
                  t('Type "{{requiredText}}" to confirm', {
                    requiredText: props.requiredText,
                  })
                }
              />
              {inputValue && !inputMatches && (
                <p className='text-destructive text-xs'>
                  {props.mismatchText ||
                    t('Input does not match required text')}
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => {
              props.onCancel?.()
              handleOpenChange(false)
            }}
          >
            {props.cancelText || t('Cancel')}
          </Button>
          <Button
            variant='destructive'
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {props.confirmText || t('I Understand the Risk, Confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
