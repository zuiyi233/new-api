import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
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
import { DateTimePicker } from '@/components/datetime-picker'
import { getOperationHistory } from '../api'
import type { CodeOperationLog } from '../types'

const OPERATION_TYPE_OPTIONS = [
  'create',
  'update',
  'delete',
  'batch_status',
  'batch_delete',
  'import_preview',
  'import',
  'export',
] as const

const RESULT_OPTIONS = ['success', 'failed', 'partial'] as const

interface OperationHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  codeType: string
}

export function OperationHistoryDialog(
  props: OperationHistoryDialogProps
) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<CodeOperationLog[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [detailRecord, setDetailRecord] = useState<CodeOperationLog | null>(
    null
  )

  const [keyword, setKeyword] = useState('')
  const [operationType, setOperationType] = useState('')
  const [result, setResult] = useState('')
  const [batchNo, setBatchNo] = useState('')
  const [operatorId, setOperatorId] = useState('')
  const [createdFrom, setCreatedFrom] = useState<Date | undefined>(undefined)
  const [createdTo, setCreatedTo] = useState<Date | undefined>(undefined)

  const loadHistory = async (p = page) => {
    if (!props.codeType) return
    setLoading(true)
    try {
      const res = await getOperationHistory({
        p,
        page_size: pageSize,
        code_type: props.codeType,
        keyword: keyword.trim() || undefined,
        operation_type: operationType || undefined,
        result: result || undefined,
        batch_no: batchNo.trim() || undefined,
        operator_id: operatorId.trim() || undefined,
        created_from: createdFrom
          ? Math.floor(createdFrom.getTime() / 1000)
          : undefined,
        created_to: createdTo
          ? Math.floor(createdTo.getTime() / 1000)
          : undefined,
      })
      if (res.success && res.data) {
        setLogs(res.data.items || [])
        setTotal(res.data.total || 0)
        setPage(res.data.page || p)
      }
    } catch {
      toast.error(t('Failed to load operation history'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (props.open) {
      setPage(1)
      loadHistory(1)
    } else {
      setDetailRecord(null)
    }
  }, [props.open, props.codeType])

  const resetFilters = () => {
    setKeyword('')
    setOperationType('')
    setResult('')
    setBatchNo('')
    setOperatorId('')
    setCreatedFrom(undefined)
    setCreatedTo(undefined)
    setPage(1)
    setTimeout(() => loadHistory(1), 0)
  }

  const exportCSV = () => {
    if (!logs.length) {
      toast.error(t('No operation history to export'))
      return
    }
    const headers = [
      'operation_type',
      'result',
      'file_name',
      'batch_no',
      'target_summary',
      'total_count',
      'success_count',
      'failed_count',
      'operator_name',
      'operator_id',
      'created_at',
      'notes',
    ]
    const csvCell = (v: unknown) =>
      `"${String(v ?? '').replaceAll('"', '""')}"`
    const rows = logs.map((item) =>
      [
        item.operation_type,
        getResultKey(item),
        item.file_name,
        item.batch_no,
        item.target_summary,
        item.total_count,
        item.success_count,
        item.failed_count,
        item.operator_name || '',
        item.operator_id,
        item.created_at
          ? new Date(item.created_at * 1000).toISOString()
          : '',
        item.notes,
      ]
        .map(csvCell)
        .join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${props.codeType}-operation-history.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('Operation history exported'))
  }

  const getResultKey = (record: CodeOperationLog) => {
    if (record.success_count > 0 && record.failed_count > 0) return 'partial'
    if (record.failed_count > 0) return 'failed'
    return 'success'
  }

  const getOperationBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      create: 'default',
      update: 'secondary',
      delete: 'destructive',
      batch_status: 'outline',
      batch_delete: 'destructive',
      import_preview: 'outline',
      import: 'default',
      export: 'secondary',
    }
    return (
      <Badge variant={variants[type] || 'secondary'}>
        {t(type)}
      </Badge>
    )
  }

  const getResultBadge = (record: CodeOperationLog) => {
    const key = getResultKey(record)
    const variants: Record<string, 'default' | 'destructive' | 'outline'> = {
      success: 'default',
      failed: 'destructive',
      partial: 'outline',
    }
    return (
      <Badge variant={variants[key]}>
        {t(key === 'partial' ? 'Partial' : key === 'failed' ? 'Failed' : 'Success')}
      </Badge>
    )
  }

  const formatDetailText = (value: string) => {
    if (!value?.trim()) return '-'
    try {
      return JSON.stringify(JSON.parse(value), null, 2)
    } catch {
      return value
    }
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className='max-w-4xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{t('Operation History')}</DialogTitle>
          </DialogHeader>

          <div className='space-y-4'>
            <div className='flex flex-wrap items-end gap-2'>
              <div className='w-full md:w-48 space-y-1'>
                <Label className='text-xs'>{t('Keyword')}</Label>
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder={t('File / Summary / Notes')}
                />
              </div>
              <div className='w-full md:w-36 space-y-1'>
                <Label className='text-xs'>{t('Operation Type')}</Label>
                <Select
                  value={operationType}
                  onValueChange={setOperationType}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('All')} />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATION_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {t(opt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='w-full md:w-32 space-y-1'>
                <Label className='text-xs'>{t('Result')}</Label>
                <Select value={result} onValueChange={setResult}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('All')} />
                  </SelectTrigger>
                  <SelectContent>
                    {RESULT_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {t(opt === 'partial' ? 'Partial' : opt === 'failed' ? 'Failed' : 'Success')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='w-full md:w-36 space-y-1'>
                <Label className='text-xs'>{t('Batch No')}</Label>
                <Input
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  placeholder={t('Batch number')}
                />
              </div>
              <div className='w-full md:w-28 space-y-1'>
                <Label className='text-xs'>{t('Operator ID')}</Label>
                <Input
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  placeholder='1'
                />
              </div>
              <div className='w-full md:w-40 space-y-1'>
                <Label className='text-xs'>{t('From')}</Label>
                <DateTimePicker
                  value={createdFrom}
                  onChange={setCreatedFrom}
                  placeholder={t('Start date')}
                />
              </div>
              <div className='w-full md:w-40 space-y-1'>
                <Label className='text-xs'>{t('To')}</Label>
                <DateTimePicker
                  value={createdTo}
                  onChange={setCreatedTo}
                  placeholder={t('End date')}
                />
              </div>
              <div className='flex gap-1'>
                <Button
                  size='sm'
                  onClick={() => {
                    setPage(1)
                    loadHistory(1)
                  }}
                  disabled={loading}
                >
                  {t('Search')}
                </Button>
                <Button size='sm' variant='outline' onClick={resetFilters}>
                  {t('Reset')}
                </Button>
                <Button size='sm' variant='outline' onClick={exportCSV}>
                  {t('Export CSV')}
                </Button>
              </div>
            </div>

            {loading ? (
              <div className='py-8 text-center text-muted-foreground'>
                {t('Loading...')}
              </div>
            ) : logs.length === 0 ? (
              <div className='py-8 text-center text-muted-foreground'>
                {t('No operation history')}
              </div>
            ) : (
              <div className='space-y-2'>
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className='flex items-center justify-between rounded-lg border p-3'
                  >
                    <div className='flex flex-wrap items-center gap-2'>
                      {getOperationBadge(log.operation_type)}
                      {getResultBadge(log)}
                      <span className='text-sm'>
                        {log.success_count}/{log.total_count}
                        {log.failed_count > 0 &&
                          ` (${t('Failed')} ${log.failed_count})`}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        {log.operator_name
                          ? `${log.operator_name} (#${log.operator_id})`
                          : `#${log.operator_id}`}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        {log.created_at
                          ? new Date(
                              log.created_at * 1000
                            ).toLocaleString()
                          : '-'}
                      </span>
                    </div>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setDetailRecord(log)}
                    >
                      {t('Details')}
                    </Button>
                  </div>
                ))}

                {totalPages > 1 && (
                  <div className='flex items-center justify-between pt-2'>
                    <span className='text-muted-foreground text-sm'>
                      {t('Total')}: {total}
                    </span>
                    <div className='flex gap-1'>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={page <= 1}
                        onClick={() => {
                          const p = page - 1
                          setPage(p)
                          loadHistory(p)
                        }}
                      >
                        {t('Previous')}
                      </Button>
                      <span className='flex items-center px-2 text-sm'>
                        {page} / {totalPages}
                      </span>
                      <Button
                        variant='outline'
                        size='sm'
                        disabled={page >= totalPages}
                        onClick={() => {
                          const p = page + 1
                          setPage(p)
                          loadHistory(p)
                        }}
                      >
                        {t('Next')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
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

      <Dialog
        open={!!detailRecord}
        onOpenChange={(open) => !open && setDetailRecord(null)}
      >
        <DialogContent className='max-w-2xl max-h-[85vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>{t('Operation Details')}</DialogTitle>
          </DialogHeader>
          {detailRecord && (
            <div className='space-y-4'>
              <div className='flex flex-wrap gap-2'>
                {getOperationBadge(detailRecord.operation_type)}
                {getResultBadge(detailRecord)}
                {detailRecord.batch_no && (
                  <Badge variant='outline'>
                    {t('Batch No')}: {detailRecord.batch_no}
                  </Badge>
                )}
              </div>

              <div className='grid gap-2 md:grid-cols-2 text-sm'>
                <div>
                  <strong>{t('File Name')}:</strong>{' '}
                  {detailRecord.file_name || '-'}
                </div>
                <div>
                  <strong>{t('Target Summary')}:</strong>{' '}
                  {detailRecord.target_summary || '-'}
                </div>
                <div>
                  <strong>{t('Operator')}:</strong>{' '}
                  {detailRecord.operator_name
                    ? `${detailRecord.operator_name} (#${detailRecord.operator_id})`
                    : `#${detailRecord.operator_id}`}
                </div>
                <div>
                  <strong>{t('Time')}:</strong>{' '}
                  {detailRecord.created_at
                    ? new Date(
                        detailRecord.created_at * 1000
                      ).toLocaleString()
                    : '-'}
                </div>
                <div>
                  <strong>
                    {t('Total / Success / Failed')}:
                  </strong>{' '}
                  {`${detailRecord.total_count} / ${detailRecord.success_count} / ${detailRecord.failed_count}`}
                </div>
                <div>
                  <strong>{t('Notes')}:</strong>{' '}
                  {detailRecord.notes || '-'}
                </div>
              </div>

              {detailRecord.filters && (
                <div>
                  <Label className='text-sm font-medium'>
                    {t('Filter Snapshot')}
                  </Label>
                  <pre className='mt-1 rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap break-all'>
                    {formatDetailText(detailRecord.filters)}
                  </pre>
                </div>
              )}

              {detailRecord.error_details && (
                <div>
                  <Label className='text-sm font-medium'>
                    {t('Error Details')}
                  </Label>
                  <pre className='mt-1 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap break-all'>
                    {formatDetailText(detailRecord.error_details)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
