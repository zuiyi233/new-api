import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { FileDown, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

type BatchSummary = {
  batch_no: string
  total_count: number
  available_count: number
  enabled_count: number
  disabled_count: number
  used_count: number
  exhausted_count: number
  expired_count: number
  latest_created_at: number
}

type CodeBatchSummaryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  apiBasePath: string
  codeType: 'registration_code' | 'subscription_code' | 'redemption'
}

export function CodeBatchSummaryDialog({
  open,
  onOpenChange,
  apiBasePath,
  codeType,
}: CodeBatchSummaryDialogProps) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<BatchSummary[]>([])

  const loadSummaries = async () => {
    if (!apiBasePath) return
    setLoading(true)
    try {
      const res = await api.get(`${apiBasePath}/batches?limit=100`)
      const { success, data } = res.data
      if (success) {
        const items = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data)
            ? data
            : []
        setRows(items)
      }
    } catch {
      toast.error(t('Failed to load batch summary'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadSummaries()
    else setRows([])
  }, [open])

  const handleCopyBatchNo = async (batchNo: string) => {
    try {
      await navigator.clipboard.writeText(batchNo)
      toast.success(t('Batch number copied to clipboard'))
    } catch {
      toast.error(t('Failed to copy batch number'))
    }
  }

  const handleExport = () => {
    if (!rows.length) {
      toast.error(t('No batch summary to export'))
      return
    }
    const headers = [
      'batch_no',
      'total_count',
      'available_count',
      'enabled_count',
      'disabled_count',
      'used_count',
      'exhausted_count',
      'expired_count',
      'latest_created_at',
    ]
    const csvRows = [
      headers.join(','),
      ...rows.map((item) =>
        headers
          .map((key) => {
            if (key === 'latest_created_at' && item[key as keyof BatchSummary]) {
              return `"${formatTimestampToDate(item[key as keyof BatchSummary] as number).replaceAll('"', '""')}"`
            }
            const val = item[key as keyof BatchSummary] ?? ''
            return `"${String(val).replaceAll('"', '""')}"`
          })
          .join(',')
      ),
    ]
    downloadTextAsFile(csvRows.join('\n'), `${codeType}-batch-summaries.csv`)
    toast.success(t('Batch summary exported'))
  }

  const columns = useMemo(() => {
    const baseColumns = [
      {
        key: 'batch_no',
        label: t('Batch No'),
        render: (val: string) =>
          val ? (
            <Button
              variant='link'
              size='sm'
              className='h-auto p-0'
              onClick={() => handleCopyBatchNo(val)}
            >
              {val}
            </Button>
          ) : (
            '-'
          ),
      },
      { key: 'total_count', label: t('Total') },
      { key: 'available_count', label: t('Available') },
      { key: 'enabled_count', label: t('Enabled') },
      { key: 'disabled_count', label: t('Disabled') },
    ] as const

    const optionalColumns = []

    if (codeType !== 'registration_code') {
      optionalColumns.push({ key: 'used_count', label: t('Used') })
    }

    if (codeType !== 'redemption') {
      optionalColumns.push({ key: 'exhausted_count', label: t('Exhausted') })
    }

    const trailingColumns = [
      { key: 'expired_count', label: t('Expired') },
      {
        key: 'latest_created_at',
        label: t('Latest Created'),
        render: (val: number) => (val ? formatTimestampToDate(val) : '-'),
      },
    ]

    return [...baseColumns, ...optionalColumns, ...trailingColumns]
  }, [codeType, t])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl'>
        <DialogHeader>
          <DialogTitle>{t('Batch Summary')}</DialogTitle>
          <DialogDescription>
            {t('Overview of recent batches by current filter criteria. Click batch number to copy.')}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className='space-y-2'>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className='h-8 w-full' />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className='text-muted-foreground py-8 text-center'>
            {t('No batch data')}
          </p>
        ) : (
          <div className='max-h-[400px] overflow-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col) => (
                    <TableHead key={col.key}>{col.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        {'render' in col
                          ? col.render(row[col.key as keyof BatchSummary] as never)
                          : String(row[col.key as keyof BatchSummary] ?? '-')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant='ghost' size='sm' onClick={handleExport} disabled={!rows.length}>
            <FileDown className='mr-1 h-3 w-3' />
            {t('Export CSV')}
          </Button>
          <Button variant='ghost' size='sm' onClick={loadSummaries} disabled={loading}>
            <RefreshCw className='mr-1 h-3 w-3' />
            {t('Refresh')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
