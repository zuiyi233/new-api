export function downloadTextAsFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportRowsToCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; label: string }[],
  filename: string
) {
  const headerRow = columns.map((col) => `"${col.label}"`).join(',')
  const dataRows = rows.map((row) =>
    columns
      .map((col) => `"${String(row[col.key] ?? '').replaceAll('"', '""')}"`)
      .join(',')
  )
  const csvContent = [headerRow, ...dataRows].join('\n')
  downloadTextAsFile(csvContent, filename)
}
