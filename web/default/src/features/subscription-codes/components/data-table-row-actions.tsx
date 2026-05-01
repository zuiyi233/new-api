import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { type Row } from '@tanstack/react-table'
import { Trash2, Edit, Power, PowerOff, Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { updateSubscriptionCode } from '../api'
import {
  SUBSCRIPTION_CODE_STATUS,
  SUCCESS_MESSAGES,
} from '../constants'
import { isSubscriptionCodeExpired } from '../lib'
import { subscriptionCodeSchema } from '../types'
import { useSubscriptionCodes } from './subscription-codes-provider'

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const { t } = useTranslation()
  const code = subscriptionCodeSchema.parse(row.original)
  const { setOpen, setCurrentRow, triggerRefresh } = useSubscriptionCodes()
  const isEnabled = code.status === SUBSCRIPTION_CODE_STATUS.ENABLED
  const isExpired = isSubscriptionCodeExpired(code.expires_at, code.status)

  const handleToggleStatus = async () => {
    const newStatus = isEnabled
      ? SUBSCRIPTION_CODE_STATUS.DISABLED
      : SUBSCRIPTION_CODE_STATUS.ENABLED

    const result = await updateSubscriptionCode({
      id: code.id,
      name: code.name,
      status: newStatus,
    })
    if (result.success) {
      const message = isEnabled
        ? t(SUCCESS_MESSAGES.SUBSCRIPTION_CODE_DISABLED)
        : t(SUCCESS_MESSAGES.SUBSCRIPTION_CODE_ENABLED)
      toast.success(message)
      triggerRefresh()
    }
  }

  const canEdit = isEnabled && !isExpired
  const canToggle = !isExpired

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          className='data-[state=open]:bg-muted flex h-8 w-8 p-0'
        >
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>{t('Open menu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[160px]'>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(code)
            setOpen('update')
          }}
          disabled={!canEdit}
        >
          {t('Edit')}
          <DropdownMenuShortcut>
            <Edit size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(code)
            setOpen('usage')
          }}
        >
          {t('View Usage')}
          <DropdownMenuShortcut>
            <Eye size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        {canToggle && (
          <DropdownMenuItem onClick={handleToggleStatus}>
            {isEnabled ? t('Disable') : t('Enable')}
            <DropdownMenuShortcut>
              {isEnabled ? <PowerOff size={16} /> : <Power size={16} />}
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className='text-destructive focus:text-destructive'
          onClick={() => {
            setCurrentRow(code)
            setOpen('delete')
          }}
        >
          {t('Delete')}
          <DropdownMenuShortcut>
            <Trash2 size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
