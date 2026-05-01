import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog'
import type { RegistrationCode, RegistrationCodesDialogType } from '../types'

type RegistrationCodesContextType = {
  open: RegistrationCodesDialogType | null
  setOpen: (str: RegistrationCodesDialogType | null) => void
  currentRow: RegistrationCode | null
  setCurrentRow: React.Dispatch<React.SetStateAction<RegistrationCode | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const RegistrationCodesContext =
  React.createContext<RegistrationCodesContextType | null>(null)

export function RegistrationCodesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] =
    useDialogState<RegistrationCodesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<RegistrationCode | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <RegistrationCodesContext
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      {children}
    </RegistrationCodesContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useRegistrationCodes = () => {
  const context = React.useContext(RegistrationCodesContext)

  if (!context) {
    throw new Error(
      'useRegistrationCodes has to be used within <RegistrationCodesProvider>'
    )
  }

  return context
}
