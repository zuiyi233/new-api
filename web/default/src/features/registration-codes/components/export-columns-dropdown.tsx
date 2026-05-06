import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  REGISTRATION_CODE_EXPORT_ALL_COLUMNS_ORDER,
  REGISTRATION_CODE_EXPORT_CODE_ONLY_COLUMNS,
  REGISTRATION_CODE_EXPORT_COLUMN_MAP,
  REGISTRATION_CODE_EXPORT_COMMON_COLUMNS,
  type RegistrationCodeExportColumnKey,
} from '../lib'

type ExportColumnsDropdownProps = {
  value: RegistrationCodeExportColumnKey[]
  onChange: (next: RegistrationCodeExportColumnKey[]) => void
}

export function ExportColumnsDropdown({
  value,
  onChange,
}: ExportColumnsDropdownProps) {
  const { t } = useTranslation()

  const selected = new Set(value)

  const toggleColumn = (key: RegistrationCodeExportColumnKey) => {
    if (selected.has(key)) {
      if (selected.size === 1) {
        return
      }
      const next = value.filter((item) => item !== key)
      onChange(next)
      return
    }
    onChange([...value, key])
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='sm'>
          <Download className='h-4 w-4' />
          {t('导出字段')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-72'>
        <DropdownMenuLabel>{t('选择导出内容')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onChange([...REGISTRATION_CODE_EXPORT_CODE_ONLY_COLUMNS])
          }}
        >
          {t('仅导出注册码')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onChange([...REGISTRATION_CODE_EXPORT_COMMON_COLUMNS])
          }}
        >
          {t('常用字段')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            onChange([...REGISTRATION_CODE_EXPORT_ALL_COLUMNS_ORDER])
          }}
        >
          {t('全部字段')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {REGISTRATION_CODE_EXPORT_ALL_COLUMNS_ORDER.map((columnKey) => (
          <DropdownMenuCheckboxItem
            key={columnKey}
            checked={selected.has(columnKey)}
            onCheckedChange={() => toggleColumn(columnKey)}
          >
            {REGISTRATION_CODE_EXPORT_COLUMN_MAP[columnKey].label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

