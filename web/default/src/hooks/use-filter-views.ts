import { useCallback, useState } from 'react'

export interface FilterView<T = Record<string, unknown>> {
  name: string
  filters: T
  isDefault?: boolean
  createdAt: number
}

interface UseFilterViewsOptions<T> {
  storageKey: string
  currentFilters: T
  onApply: (filters: T) => void
  onReset: () => void
}

export function useFilterViews<T extends Record<string, unknown>>({
  storageKey,
  currentFilters,
  onApply,
  onReset,
}: UseFilterViewsOptions<T>) {
  const [manageOpen, setManageOpen] = useState(false)

  const loadViews = useCallback((): FilterView<T>[] => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return []
      return JSON.parse(raw) as FilterView<T>[]
    } catch {
      return []
    }
  }, [storageKey])

  const saveViews = useCallback(
    (views: FilterView<T>[]) => {
      localStorage.setItem(storageKey, JSON.stringify(views))
    },
    [storageKey]
  )

  const saveCurrentView = useCallback(
    (name: string) => {
      const views = loadViews()
      const existing = views.findIndex((v) => v.name === name)
      const newView: FilterView<T> = {
        name,
        filters: { ...currentFilters },
        isDefault: false,
        createdAt: Date.now(),
      }
      if (existing >= 0) {
        newView.isDefault = views[existing].isDefault
        views[existing] = newView
      } else {
        views.push(newView)
      }
      saveViews(views)
    },
    [loadViews, saveViews, currentFilters]
  )

  const applyView = useCallback(
    (name: string) => {
      const views = loadViews()
      const view = views.find((v) => v.name === name)
      if (view) {
        onApply(view.filters)
        localStorage.setItem(`${storageKey}:recent`, name)
      }
    },
    [loadViews, onApply, storageKey]
  )

  const applyDefaultView = useCallback(() => {
    const views = loadViews()
    const defaultView = views.find((v) => v.isDefault)
    if (defaultView) {
      onApply(defaultView.filters)
    }
  }, [loadViews, onApply])

  const applyRecentView = useCallback(() => {
    const recentName = localStorage.getItem(`${storageKey}:recent`)
    if (recentName) {
      applyView(recentName)
    }
  }, [applyView, storageKey])

  const setDefaultView = useCallback(
    (name: string) => {
      const views = loadViews()
      views.forEach((v) => {
        v.isDefault = v.name === name
      })
      saveViews(views)
    },
    [loadViews, saveViews]
  )

  const deleteView = useCallback(
    (name: string) => {
      const views = loadViews().filter((v) => v.name !== name)
      saveViews(views)
    },
    [loadViews, saveViews]
  )

  const getViews = useCallback(() => loadViews(), [loadViews])

  const getDefaultView = useCallback(() => {
    const views = loadViews()
    return views.find((v) => v.isDefault) || null
  }, [loadViews])

  const getRecentViewName = useCallback(() => {
    return localStorage.getItem(`${storageKey}:recent`) || null
  }, [storageKey])

  return {
    manageOpen,
    setManageOpen,
    saveCurrentView,
    applyView,
    applyDefaultView,
    applyRecentView,
    setDefaultView,
    deleteView,
    getViews,
    getDefaultView,
    getRecentViewName,
    resetFilters: onReset,
  }
}
