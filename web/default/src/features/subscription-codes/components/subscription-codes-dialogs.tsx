import { SubscriptionCodesDeleteDialog } from './subscription-codes-delete-dialog'
import { SubscriptionCodesMutateDrawer } from './subscription-codes-mutate-drawer'
import { useSubscriptionCodes } from './subscription-codes-provider'

export function SubscriptionCodesDialogs() {
  const { open, setOpen, currentRow } = useSubscriptionCodes()
  const isUpdate = open === 'update'

  return (
    <>
      <SubscriptionCodesMutateDrawer
        open={open === 'create' || isUpdate}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={isUpdate ? currentRow || undefined : undefined}
      />
      <SubscriptionCodesDeleteDialog />
    </>
  )
}
