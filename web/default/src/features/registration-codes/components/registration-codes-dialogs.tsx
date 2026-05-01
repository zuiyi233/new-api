import { RegistrationCodesDeleteDialog } from './registration-codes-delete-dialog'
import { RegistrationCodesMutateDrawer } from './registration-codes-mutate-drawer'
import { useRegistrationCodes } from './registration-codes-provider'

export function RegistrationCodesDialogs() {
  const { open, setOpen, currentRow } = useRegistrationCodes()
  const isUpdate = open === 'update'

  return (
    <>
      <RegistrationCodesMutateDrawer
        open={open === 'create' || isUpdate}
        onOpenChange={(isOpen) => !isOpen && setOpen(null)}
        currentRow={isUpdate ? currentRow || undefined : undefined}
      />
      <RegistrationCodesDeleteDialog />
    </>
  )
}
