import { SubscriptionCodesDeleteDialog } from './subscription-codes-delete-dialog'
import { SubscriptionCodesMutateDrawer } from './subscription-codes-mutate-drawer'
import { CodeCsvImportDrawer } from '@/features/common/components/code-csv-import-drawer'
import { CodeUsageDialog } from '@/features/common/components/code-usage-dialog'
import { CodeBatchSummaryDialog } from '@/features/common/components/code-batch-summary-dialog'
import { useSubscriptionCodes } from './subscription-codes-provider'

export function SubscriptionCodesDialogs() {
  const { open, setOpen, currentRow, triggerRefresh } = useSubscriptionCodes()
  const isUpdate = open === 'update'

  return (
    <>
      <SubscriptionCodesMutateDrawer
        open={open === 'create' || isUpdate}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={isUpdate ? currentRow || undefined : undefined}
      />
      <SubscriptionCodesDeleteDialog />
      <CodeCsvImportDrawer
        open={open === 'import'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        onImported={triggerRefresh}
        apiBasePath='/api/subscription-code'
        templateKey='subscription_code'
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
        apiBasePath='/api/subscription-code'
      />
      <CodeBatchSummaryDialog
        open={open === 'batchSummary'}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        apiBasePath='/api/subscription-code'
        codeType='subscription_code'
      />
    </>
  )
}
