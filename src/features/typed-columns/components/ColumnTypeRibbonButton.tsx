'use client'

/**
 * ColumnTypeRibbonButton — drop-in ribbon entry that opens the
 * ColumnTypePicker for the column currently containing the selection.
 *
 * Renders as a standard RibbonLargeButton ("Column Type") that toggles
 * a dropdown anchored beneath it.  When no cell is selected, the button
 * is disabled with a tooltip explaining the requirement.
 *
 * Lives in the Data ribbon tab — see OtherTabs.tsx.
 */

import { Columns3 } from 'lucide-react'
import { toast } from 'sonner'
import { RibbonLargeButton } from '@/features/ribbon/components/RibbonPrimitives'
import { useSheetStore } from '@/store/sheetStore'
import { useWorkbookStore } from '@/store/workbookStore'
import { useColumnTypesStore } from '../store/columnTypesStore'
import { ColumnTypePicker } from './ColumnTypePicker'
import { useMemo, useState } from 'react'

export function ColumnTypeRibbonButton() {
  const selectedCell = useSheetStore((s) => s.selectedCell)
  const activeSheetId = useWorkbookStore((s) => s.activeSheetId)
  const byWorkbook = useColumnTypesStore((s) => s.byWorkbook)
  const setColumnType = useColumnTypesStore((s) => s.setColumnType)
  const clearColumnType = useColumnTypesStore((s) => s.clearColumnType)

  const [pickerOpen, setPickerOpen] = useState(false)

  const colIndex = selectedCell?.col ?? null
  const meta = useMemo(() => {
    if (!activeSheetId || colIndex == null) return undefined
    return byWorkbook[activeSheetId]?.[String(colIndex)]
  }, [byWorkbook, activeSheetId, colIndex])

  function handlePickerChange(next: Parameters<typeof setColumnType>[2] | null) {
    if (!activeSheetId || colIndex == null) return
    if (next === null) {
      clearColumnType(activeSheetId, colIndex)
      toast.success(`Column ${columnLetter(colIndex)} reset to plain text`)
    } else {
      setColumnType(activeSheetId, colIndex, next)
      toast.success(`Column ${columnLetter(colIndex)} set to ${next.type}`)
    }
    setPickerOpen(false)
  }

  return (
    <div className="relative inline-block">
      <RibbonLargeButton
        label="Column Type"
        icon={<Columns3 className="text-indigo-500" />}
        showCaret
        onClick={() => {
          if (colIndex == null) {
            toast('Select a cell first', { description: 'Column type applies to the entire column of the active cell.' })
            return
          }
          setPickerOpen((v) => !v)
        }}
      />
      {pickerOpen && colIndex != null && (
        <div className="absolute left-0 top-full z-50 mt-1">
          {/* Re-use the picker chip so the dropdown content is identical
              to the column-header experience. The chip auto-renders the
              menu open immediately because <DropdownMenu> tracks its own
              state — we rely on onChange to dismiss our wrapper. */}
          <ColumnTypePicker meta={meta} onChange={handlePickerChange} />
        </div>
      )}
    </div>
  )
}

/** A,B,…,Z,AA,AB,… */
function columnLetter(index: number): string {
  let n = index + 1
  let result = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    result = String.fromCharCode(65 + rem) + result
    n = Math.floor((n - 1) / 26)
  }
  return result
}
