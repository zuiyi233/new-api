import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bookmark, ChevronDown, ListX, Plus, RotateCcw, Settings2, Trash2, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { FilterView } from '@/hooks/use-filter-views'

interface FilterViewsBarProps<T extends Record<string, unknown>> {
  views: FilterView<T>[]
  recentViewName: string | null
  defaultView: FilterView<T> | null
  onSaveView: (name: string) => void
  onApplyView: (name: string) => void
  onApplyDefault: () => void
  onApplyRecent: () => void
  onSetDefault: (name: string) => void
  onDeleteView: (name: string) => void
  onResetFilters: () => void
  hasActiveFilters?: boolean
}

export function FilterViewsBar<T extends Record<string, unknown>>(
  props: FilterViewsBarProps<T>
) {
  const { t } = useTranslation()
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [manageDialogOpen, setManageDialogOpen] = useState(false)
  const [newViewName, setNewViewName] = useState('')

  const handleSave = () => {
    const name = newViewName.trim()
    if (!name) return
    props.onSaveView(name)
    setNewViewName('')
    setSaveDialogOpen(false)
  }

  return (
    <div className='flex items-center gap-1.5'>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant='outline' size='sm'>
            <Bookmark className='mr-1 h-3.5 w-3.5' />
            {t('Views')}
            <ChevronDown className='ml-1 h-3.5 w-3.5' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start'>
          {props.defaultView && (
            <DropdownMenuItem onClick={props.onApplyDefault}>
              <Star className='mr-2 h-3.5 w-3.5' />
              {t('Default')}: {props.defaultView.name}
            </DropdownMenuItem>
          )}
          {props.recentViewName && (
            <DropdownMenuItem onClick={props.onApplyRecent}>
              <Bookmark className='mr-2 h-3.5 w-3.5' />
              {t('Recent')}: {props.recentViewName}
            </DropdownMenuItem>
          )}
          {(props.defaultView || props.recentViewName) && (
            <DropdownMenuSeparator />
          )}
          {props.views.length > 0 && (
            <>
              {props.views.map((view) => (
                <DropdownMenuItem
                  key={view.name}
                  onClick={() => props.onApplyView(view.name)}
                >
                  {view.isDefault && (
                    <Star className='mr-2 h-3 w-3 text-yellow-500' />
                  )}
                  {!view.isDefault && (
                    <Bookmark className='mr-2 h-3 w-3' />
                  )}
                  {view.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}>
            <Plus className='mr-2 h-3.5 w-3.5' />
            {t('Save Current View')}
          </DropdownMenuItem>
          {props.views.length > 0 && (
            <DropdownMenuItem onClick={() => setManageDialogOpen(true)}>
              <Settings2 className='mr-2 h-3.5 w-3.5' />
              {t('Manage Views')}
            </DropdownMenuItem>
          )}
          {props.hasActiveFilters && (
            <DropdownMenuSeparator />
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {props.hasActiveFilters && (
        <Button
          variant='ghost'
          size='sm'
          onClick={props.onResetFilters}
        >
          <ListX className='mr-1 h-3.5 w-3.5' />
          {t('Clear Filters')}
        </Button>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('Save Current View')}</DialogTitle>
          </DialogHeader>
          <div className='space-y-2'>
            <Label>{t('View Name')}</Label>
            <Input
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder={t('Enter a name for this view')}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setSaveDialogOpen(false)}
            >
              {t('Cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={!newViewName.trim()}
            >
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{t('Manage Views')}</DialogTitle>
          </DialogHeader>
          {props.views.length === 0 ? (
            <div className='text-muted-foreground py-4 text-center text-sm'>
              {t('No saved views')}
            </div>
          ) : (
            <div className='space-y-2'>
              {props.views.map((view) => (
                <div
                  key={view.name}
                  className='flex items-center justify-between rounded-lg border p-2'
                >
                  <div className='flex items-center gap-2'>
                    {view.isDefault && (
                      <Star className='h-4 w-4 text-yellow-500' />
                    )}
                    <span className='text-sm font-medium'>
                      {view.name}
                    </span>
                  </div>
                  <div className='flex items-center gap-1'>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => props.onApplyView(view.name)}
                    >
                      {t('Apply')}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => props.onSetDefault(view.name)}
                    >
                      {view.isDefault ? t('Unset Default') : t('Set Default')}
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => props.onDeleteView(view.name)}
                    >
                      <Trash2 className='h-3.5 w-3.5 text-destructive' />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setManageDialogOpen(false)}
            >
              {t('Close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
