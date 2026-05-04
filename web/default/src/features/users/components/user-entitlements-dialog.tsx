import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DateTimePicker } from '@/components/datetime-picker'
import {
  getUserEntitlements,
  addUserEntitlement,
  updateUserEntitlement,
} from '../api'
import { ENTITLEMENT_STATUS } from '../lib/entitlement-types'
import type { Entitlement } from '../lib/entitlement-types'

interface UserEntitlementsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  username: string
  onSuccess: () => void
}

export function UserEntitlementsDialog(
  props: UserEntitlementsDialogProps
) {
  const { t } = useTranslation()
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  const [productKey, setProductKey] = useState('novel_product')
  const [status, setStatus] = useState(String(ENTITLEMENT_STATUS.ENABLED))
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined)
  const [notes, setNotes] = useState('')

  const loadEntitlements = async () => {
    if (!props.userId) return
    setLoading(true)
    try {
      const result = await getUserEntitlements(props.userId)
      if (result.success && result.data) {
        setEntitlements(result.data.items || [])
      }
    } catch {
      toast.error(t('Failed to load entitlements'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (props.open) {
      loadEntitlements()
      resetForm()
    }
  }, [props.open, props.userId])

  const resetForm = (entitlement?: Entitlement) => {
    if (entitlement) {
      setEditingId(entitlement.id)
      setProductKey(entitlement.product_key || 'novel_product')
      setStatus(String(entitlement.status))
      setExpiresAt(
        entitlement.expires_at > 0
          ? new Date(entitlement.expires_at * 1000)
          : undefined
      )
      setNotes(entitlement.notes || '')
    } else {
      setEditingId(null)
      setProductKey('novel_product')
      setStatus(String(ENTITLEMENT_STATUS.ENABLED))
      setExpiresAt(undefined)
      setNotes('')
    }
  }

  const handleSubmit = async () => {
    if (!props.userId) return

    const expiresAtTs = expiresAt
      ? Math.floor(expiresAt.getTime() / 1000)
      : 0

    setSubmitting(true)
    try {
      if (editingId) {
        const result = await updateUserEntitlement(props.userId, {
          id: editingId,
          status: Number(status),
          expires_at: expiresAtTs,
          notes: notes.trim(),
        })
        if (result.success) {
          toast.success(t('Entitlement updated successfully'))
        } else {
          toast.error(result.message || t('Failed to update entitlement'))
          return
        }
      } else {
        const result = await addUserEntitlement(props.userId, {
          product_key: productKey.trim() || 'novel_product',
          status: Number(status),
          expires_at: expiresAtTs,
          notes: notes.trim(),
        })
        if (result.success) {
          toast.success(t('Entitlement granted successfully'))
        } else {
          toast.error(result.message || t('Failed to grant entitlement'))
          return
        }
      }
      resetForm()
      await loadEntitlements()
      props.onSuccess()
    } catch {
      toast.error(t('Failed to save entitlement'))
    } finally {
      setSubmitting(false)
    }
  }

  const getEntitlementStatusBadge = (item: Entitlement) => {
    const isExpired =
      item.expires_at > 0 && item.expires_at < Math.floor(Date.now() / 1000)
    if (isExpired) return <Badge variant='outline'>{t('Expired')}</Badge>
    if (item.status === ENTITLEMENT_STATUS.DISABLED)
      return <Badge variant='secondary'>{t('Disabled')}</Badge>
    return <Badge variant='default'>{t('Enabled')}</Badge>
  }

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>{t('User Product Entitlements')}</DialogTitle>
          <DialogDescription>
            {t('Manage product entitlements for {{username}} (ID: {{id}})', {
              username: props.username,
              id: props.userId,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='rounded-lg border p-4 space-y-3'>
            <div className='flex items-center justify-between'>
              <Label className='text-base font-medium'>
                {editingId
                  ? t('Edit Entitlement')
                  : t('Grant New Entitlement')}
              </Label>
              {editingId && (
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => resetForm()}
                >
                  {t('Switch to Add')}
                </Button>
              )}
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label>{t('Product Key')}</Label>
                <Input
                  value={productKey}
                  onChange={(e) => setProductKey(e.target.value)}
                  placeholder='novel_product'
                  disabled={!!editingId}
                />
              </div>

              <div className='space-y-1.5'>
                <Label>{t('Status')}</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value={String(ENTITLEMENT_STATUS.ENABLED)}
                    >
                      {t('Enabled')}
                    </SelectItem>
                    <SelectItem
                      value={String(ENTITLEMENT_STATUS.DISABLED)}
                    >
                      {t('Disabled')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1.5'>
                <Label>{t('Expires At')}</Label>
                <DateTimePicker
                  value={expiresAt}
                  onChange={setExpiresAt}
                  placeholder={t('Never expires')}
                />
              </div>

              <div className='space-y-1.5'>
                <Label>{t('Notes')}</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('Optional notes')}
                />
              </div>
            </div>

            <div className='flex justify-end'>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? t('Processing...')
                  : editingId
                    ? t('Save Update')
                    : t('Grant Entitlement')}
              </Button>
            </div>
          </div>

          <div className='space-y-2'>
            <Label className='text-base font-medium'>
              {t('Current Entitlements')}
            </Label>
            {loading ? (
              <div className='text-muted-foreground text-sm py-4 text-center'>
                {t('Loading...')}
              </div>
            ) : entitlements.length === 0 ? (
              <div className='text-muted-foreground text-sm py-4 text-center'>
                {t('No entitlements found')}
              </div>
            ) : (
              <div className='space-y-2'>
                {entitlements.map((item) => (
                  <div
                    key={item.id}
                    className='flex items-center justify-between rounded-lg border p-3'
                  >
                    <div className='flex items-center gap-3'>
                      <Badge variant='outline'>{item.product_key}</Badge>
                      {getEntitlementStatusBadge(item)}
                      <span className='text-muted-foreground text-xs'>
                        {item.source_type || '-'}
                      </span>
                      {item.expires_at > 0 && (
                        <span className='text-muted-foreground text-xs'>
                          {t('Expires')}:{' '}
                          {new Date(
                            item.expires_at * 1000
                          ).toLocaleDateString()}
                        </span>
                      )}
                      {item.notes && (
                        <span className='text-muted-foreground text-xs'>
                          {item.notes}
                        </span>
                      )}
                    </div>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => resetForm(item)}
                    >
                      {t('Edit')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
