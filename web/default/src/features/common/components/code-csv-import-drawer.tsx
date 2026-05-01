import { useRef, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { downloadTextAsFile } from '@/lib/download'
import { api } from '@/lib/api'
import {
  CODE_IMPORT_TEMPLATES,
  type CodeImportTemplateKey,
} from '../lib/code-import-template'

type CodeCsvImportDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
  apiBasePath: string
  templateKey: CodeImportTemplateKey
}

export function CodeCsvImportDrawer({
  open,
  onOpenChange,
  onImported,
  apiBasePath,
  templateKey,
}: CodeCsvImportDrawerProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [csvContent, setCsvContent] = useState('')
  const [previewResult, setPreviewResult] = useState<Record<
    string,
    unknown
  > | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)

  const template = CODE_IMPORT_TEMPLATES[templateKey]

  const resetState = () => {
    setFileName('')
    setCsvContent('')
    setPreviewResult(null)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleClose = () => {
    resetState()
    onOpenChange(false)
  }

  const handleSelectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event?.target?.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setFileName(file.name || '')
      setCsvContent(text || '')
      setPreviewResult(null)
    } catch {
      toast.error(t('Failed to read CSV file'))
    }
  }

  const handlePreview = async () => {
    if (!csvContent.trim()) {
      toast.error(t('Please select a CSV file first'))
      return
    }
    setPreviewLoading(true)
    try {
      const res = await api.post(`${apiBasePath}/import/preview`, {
        file_name: fileName,
        csv_content: csvContent,
      })
      const { success, message, data } = res.data
      if (!success) {
        toast.error(message)
        return
      }
      setPreviewResult(data)
      toast.success(t('Preview validation completed'))
    } catch (error: unknown) {
      const err = error as { message?: string }
      toast.error(err?.message || t('Preview validation failed'))
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleImport = async () => {
    if (!previewResult) {
      toast.error(t('Please run preview validation first'))
      return
    }
    if (Number(previewResult.valid_rows || 0) <= 0) {
      toast.error(t('No valid data to import'))
      return
    }
    setImportLoading(true)
    try {
      const res = await api.post(`${apiBasePath}/import`, {
        file_name: fileName,
        csv_content: csvContent,
      })
      const { success, message, data } = res.data
      if (!success) {
        toast.error(message)
        return
      }
      toast.success(
        t('Import completed: {{success}} succeeded, {{failed}} failed', {
          success: Number(data?.success_count || 0),
          failed: Number(data?.failed_count || 0),
        })
      )
      onImported()
      handleClose()
    } catch (error: unknown) {
      const err = error as { message?: string }
      toast.error(err?.message || t('Import failed'))
    } finally {
      setImportLoading(false)
    }
  }

  const handleDownloadTemplate = () => {
    if (!template.columns.length) {
      toast.error(t('No CSV template configured'))
      return
    }
    const csvRows: string[] = []
    const headerRow = template.columns
      .map((col) => `"${String(col).replaceAll('"', '""')}"`)
      .join(',')
    csvRows.push(headerRow)

    template.rows.forEach((row) => {
      const dataRow = template.columns
        .map((col) => {
          const val = (row as Record<string, unknown>)[col] ?? ''
          return `"${String(val).replaceAll('"', '""')}"`
        })
        .join(',')
      csvRows.push(dataRow)
    })

    downloadTextAsFile(csvRows.join('\n'), template.fileName)
    toast.success(t('CSV template downloaded'))
  }

  const previewHeaders = useMemo(() => {
    const headers = Array.isArray(previewResult?.headers)
      ? (previewResult.headers as string[])
      : []
    return headers
  }, [previewResult?.headers])

  const previewRows = useMemo(() => {
    const rows = Array.isArray(previewResult?.preview_rows)
      ? (previewResult.preview_rows as Record<string, unknown>[])
      : Array.isArray((previewResult as Record<string, unknown>)?.items)
        ? ((previewResult as Record<string, unknown>).items as Record<string, unknown>[])
        : []
    return rows
  }, [previewResult])

  const errorRows = useMemo(() => {
    const errors = Array.isArray(previewResult?.errors)
      ? (previewResult.errors as Record<string, unknown>[])
      : []
    return errors
  }, [previewResult?.errors])

  const templateHeaderText = useMemo(() => {
    if (!Array.isArray(template.columns) || template.columns.length === 0) {
      return ''
    }
    return template.columns.join(', ')
  }, [template.columns])

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent className='flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[900px]'>
        <SheetHeader className='border-b px-4 py-3 text-start sm:px-6 sm:py-4'>
          <SheetTitle>{t('Import CSV')}</SheetTitle>
          <SheetDescription>
            {t(
              'Select a local CSV file, run preview validation, then confirm import.'
            )}
          </SheetDescription>
        </SheetHeader>

        <div className='flex-1 overflow-y-auto px-4 py-4 sm:px-6'>
          <div className='flex flex-col gap-4'>
            <input
              ref={inputRef}
              type='file'
              accept='.csv,text/csv'
              className='hidden'
              onChange={handleSelectFile}
            />

            <div className='flex flex-wrap items-center gap-2'>
              <Button
                variant='outline'
                onClick={() => inputRef.current?.click()}
              >
                {t('Select CSV File')}
              </Button>
              <Button variant='ghost' onClick={handleDownloadTemplate}>
                {t('Download Template')}
              </Button>
              {fileName ? (
                <Badge variant='secondary'>{fileName}</Badge>
              ) : (
                <span className='text-muted-foreground text-sm'>
                  {t('No file selected')}
                </span>
              )}
            </div>

            <div className='rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300'>
              <div className='mb-1 font-medium'>{t('Import Instructions')}</div>
              <div>
                {t(
                  'Select a local CSV file, then run preview validation. The system will auto-detect headers and validate importable rows. Confirm import after verification.'
                )}
              </div>
              {templateHeaderText ? (
                <div className='mt-2 break-all'>
                  <strong>{t('Recommended Headers')}</strong>:{' '}
                  {templateHeaderText}
                </div>
              ) : null}
            </div>

            {previewResult ? (
              <>
                <div className='flex flex-wrap gap-2'>
                  {previewResult.batch_no ? (
                    <Badge variant='secondary'>
                      {t('Batch')}: {String(previewResult.batch_no)}
                    </Badge>
                  ) : null}
                  <Badge variant='outline'>
                    {t('Total Rows')}: {Number(previewResult.total_rows || 0)}
                  </Badge>
                  <Badge className='border-green-500 text-green-600'>
                    {t('Valid Rows')}: {Number(previewResult.valid_rows || 0)}
                  </Badge>
                  <Badge variant='destructive'>
                    {t('Invalid Rows')}: {Number(previewResult.invalid_rows || 0)}
                  </Badge>
                </div>

                <div>
                  <h4 className='mb-2 text-sm font-semibold'>
                    {t('Preview (first 20 rows)')}
                  </h4>
                  {previewRows.length === 0 ? (
                    <p className='text-muted-foreground text-sm'>
                      {t('No preview data available')}
                    </p>
                  ) : (
                    <div className='rounded-md border'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {previewHeaders.map((header) => (
                              <TableHead key={header}>{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewRows.slice(0, 20).map((row, idx) => (
                              <TableRow key={idx}>
                                {previewHeaders.map((header) => (
                                  <TableCell key={header}>
                                    {String(row[header] ?? '-')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className='mb-2 text-sm font-semibold'>
                    {t('Validation Errors')}
                  </h4>
                  {errorRows.length === 0 ? (
                    <p className='text-sm text-green-600'>
                      {t('Preview validation passed, no errors')}
                    </p>
                  ) : (
                    <div className='rounded-md border'>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className='w-[100px]'>
                              {t('Row')}
                            </TableHead>
                            <TableHead>{t('Error Message')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {errorRows.map((err, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{String(err.row ?? '-')}</TableCell>
                              <TableCell className='text-red-600'>
                                {String(err.message ?? '-')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className='flex flex-col items-center justify-center py-8 text-muted-foreground'>
                <p>{t('Please select a CSV file and run preview validation')}</p>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className='border-t px-4 py-3 sm:px-6'>
          <SheetClose asChild>
            <Button variant='outline'>{t('Cancel')}</Button>
          </SheetClose>
          <Button
            variant='outline'
            onClick={handlePreview}
            disabled={previewLoading || !csvContent}
          >
            {previewLoading ? t('Validating...') : t('Preview')}
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              importLoading ||
              !previewResult ||
              Number(previewResult?.valid_rows || 0) <= 0
            }
          >
            {importLoading ? t('Importing...') : t('Confirm Import')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
