import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog'
import type { SubscriptionCode, SubscriptionCodesDialogType } from '../types'

type SubscriptionCodesContextType = {
  open: SubscriptionCodesDialogType | null
  setOpen: (str: SubscriptionCodesDialogType | null) => void
  currentRow: SubscriptionCode | null
  setCurrentRow: React.Dispatch<React.SetStateAction<SubscriptionCode | null>>
  refreshTrigger: number
  triggerRefresh: () => void
}

const SubscriptionCodesContext =
  React.createContext<SubscriptionCodesContextType | null>(null)

export function SubscriptionCodesProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [open, setOpen] =
    useDialogState<SubscriptionCodesDialogType>(null)
  const [currentRow, setCurrentRow] = useState<SubscriptionCode | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1)

  return (
    <SubscriptionCodesContext
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
    </SubscriptionCodesContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSubscriptionCodes = () => {
  const context = React.useContext(SubscriptionCodesContext)

  if (!context) {
    throw new Error(
      'useSubscriptionCodes has to be used within <SubscriptionCodesProvider>'
    )
  }

  return context
}
