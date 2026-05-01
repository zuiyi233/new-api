import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { FileDown } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatTimestampToDate } from '@/lib/format'
import { downloadTextAsFile } from '@/lib/download'
import { api } from '@/lib/api'

type UsageRecord = {
  user_id: number
  username: string
  used_at: number
  ip: string
  notes: string
}

type CodeUsageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: {
    id: number
    name: string
    code: string
    product_key: string
  } | null
  apiBasePath: string
}

export function CodeUsageDialog({
  open,
  onOpenChange,
  record,
  apiBasePath,
}: CodeUsageDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [usages, setUsages] = useState<UsageRecord[]>([])

  useEffect(() => {
    if (!open || !record?.id) return
    setLoading(true)
    api
      .get(
        `${apiBasePath}/usage?code_id=${record.id}&p=1&page_size=100`
      )
      .then((res) => {
        const { success, data } = res.data
        if (success) {
          const items = Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data)
              ? data
              : []
          setUsages(items)
        }
      })
      .catch(() => toast.error(t('Failed to load usage records')))
      .finally(() => setLoading(false))
  }, [open, record?.id, apiBasePath, t])

  const handleExport = () => {
    if (!usages.length) {
      toast.error(t('No usage records to export'))
      return
    }
    const rows = [
      ['user_id', 'username', 'used_at', 'ip', 'notes'].join(','),
      ...usages.map((item) =>
        ['user_id', 'username', 'used_at', 'ip', 'notes']
          .map((key) => {
            const val =
              key === 'used_at'
                ? formatTimestampToDate(item[key as keyof UsageRecord] as number)
                : (item[key as keyof UsageRecord] ?? '')
            return `"${String(val).replaceAll('"', '""')}"`
          })
          .join(',')
      ),
    ]
    downloadTextAsFile(rows.join('\n'), `${apiBasePath.replaceAll('/', '-')}-usage.csv`)
    toast.success(t('Usage records exported'))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>{t('Usage Records')}</DialogTitle>
        </DialogHeader>

        <div className='flex flex-wrap items-center gap-2'>
          <Badge variant='secondary'>{record?.name || '-'}</Badge>
          <Badge variant='outline'>{record?.product_key || '-'}</Badge>
          <Badge variant='outline' className='font-mono'>
            {record?.code ? `${String(record.code).slice(0, 12)}...` : '-'}
          </Badge>
          <Button
            variant='ghost'
            size='sm'
            onClick={handleExport}
            disabled={!usages.length}
          >
            <FileDown className='mr-1 h-3 w-3' />
            {t('Export CSV')}
          </Button>
        </div>

        {loading ? (
          <div className='space-y-2'>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className='h-8 w-full' />
            ))}
          </div>
        ) : usages.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center text-sm'>
            {t('No usage records')}
          </p>
        ) : (
          <div className='max-h-[400px] overflow-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('User ID')}</TableHead>
                  <TableHead>{t('Username')}</TableHead>
                  <TableHead>{t('Used At')}</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>{t('Notes')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usages.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{item.user_id}</TableCell>
                    <TableCell>{item.username || '-'}</TableCell>
                    <TableCell>
                      {item.used_at
                        ? formatTimestampToDate(item.used_at)
                        : '-'}
                    </TableCell>
                    <TableCell className='font-mono text-xs'>
                      {item.ip || '-'}
                    </TableCell>
                    <TableCell className='max-w-[150px] truncate text-xs'>
                      {item.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
