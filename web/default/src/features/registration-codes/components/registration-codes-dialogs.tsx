import { RegistrationCodesDeleteDialog } from './registration-codes-delete-dialog'
import { RegistrationCodesMutateDrawer } from './registration-codes-mutate-drawer'
import { CodeCsvImportDrawer } from '@/features/common/components/code-csv-import-drawer'
import { CodeUsageDialog } from '@/features/common/components/code-usage-dialog'
import { CodeBatchSummaryDialog } from '@/features/common/components/code-batch-summary-dialog'
import { useRegistrationCodes } from './registration-codes-provider'

export function RegistrationCodesDialogs() {
  const { open, setOpen, currentRow, triggerRefresh } = useRegistrationCodes()
  const isUpdate = open === 'update'

  return (
    <>
      <RegistrationCodesMutateDrawer
        open={open === 'create' || isUpdate}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={isUpdate ? currentRow || undefined : undefined}
      />
      <RegistrationCodesDeleteDialog />
      <CodeCsvImportDrawer
        open={open === 'import'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        onImported={triggerRefresh}
        apiBasePath='/api/registration-code'
        templateKey='registration_code'
      />
      <CodeUsageDialog
        open={open === 'usage'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        record={
          currentRow
            ? {
                id: currentRow.id,
                name: currentRow.name,
                code: currentRow.code,
                product_key: currentRow.product_key,
              }
            : null
        }
        apiBasePath='/api/registration-code'
      />
      <CodeBatchSummaryDialog
        open={open === 'batchSummary'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        apiBasePath='/api/registration-code'
        codeType='registration_code'
      />
    </>
  )
}
