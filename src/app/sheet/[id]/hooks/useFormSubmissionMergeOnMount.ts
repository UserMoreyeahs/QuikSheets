'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { useSheetStore } from '@/store/sheetStore'

/**
 * Merge pending form submissions into the workbook on mount.
 *
 * Order of operations:
 *   1. Run the one-time localStorage → Supabase migration so any
 *      legacy form definitions land in the proper store.
 *   2. Load forms for this workbook.
 *   3. For each form, drain its pending submissions queue and append
 *      the rows to the sheet's body (writing at the first empty row).
 *   4. If anything changed: replaceGridSheets + IMMEDIATELY persist via
 *      saveService (MVP T019 fix — don't rely on the 30s debounce; if
 *      the user refreshes right after submitting, we lose the rows).
 *
 * Heavy deps (formsApi, fortuneSheet, saveService) are imported
 * dynamically inside the effect so they don't bloat the initial
 * /sheet/[id] bundle.
 *
 * Extracted from src/app/sheet/[id]/page.tsx as part of the Wave 4
 * god-component split. Behaviour preserved verbatim.
 */
export function useFormSubmissionMergeOnMount(
  workbookId: string,
  workbookName: string,
): void {
  useEffect(() => {
    void (async () => {
      const { loadForms, takePendingSubmissions, migrateLocalFormsToSupabase } = await import(
        '@/lib/formsApi'
      )
      const { cloneSheetWithData, getSheetMatrix } = await import('@/lib/fortuneSheet')
      await migrateLocalFormsToSupabase()
      const forms = await loadForms(workbookId)
      if (forms.length === 0) return

      const state = useSheetStore.getState()
      let nextSheets = state.gridSheets
      let didChange = false

      for (const form of forms) {
        if (!form.id) continue
        const subs = takePendingSubmissions(form.id)
        if (subs.length === 0) continue
        const sheetIdx = nextSheets.findIndex((s) => s.id === form.sheetId)
        if (sheetIdx < 0) continue
        const sheet = nextSheets[sheetIdx]
        if (!sheet) continue
        const matrix = getSheetMatrix(sheet)
        const next = matrix.map((row) => [...(row ?? [])])
        // start writing at the first empty row at the bottom
        let writeRow = next.length
        for (const sub of subs) {
          let row = next[writeRow]
          if (!row) {
            row = []
            next[writeRow] = row
          }
          for (const field of form.fields) {
            const raw = sub.values[field.id]
            if (raw === undefined || raw === null || raw === '') {
              row[field.columnIndex] = { v: '', m: '' }
              continue
            }
            // Number/currency fields must land as NUMERIC cells. Writing
            // String(raw) stored "15000" as text, which won't SUM or sort
            // numerically (the T019 fidelity gap). Coerce, stripping any
            // currency punctuation the submitter included.
            if (field.kind === 'number' || field.kind === 'currency') {
              const n =
                typeof raw === 'number' ? raw : Number(String(raw).replace(/[₹$€£,\s]/g, ''))
              if (Number.isFinite(n)) {
                row[field.columnIndex] = { v: n, m: String(n) }
                continue
              }
            }
            const display = String(raw)
            row[field.columnIndex] = { v: display, m: display }
          }
          writeRow++
        }
        nextSheets = nextSheets.map((s, i) =>
          i === sheetIdx ? cloneSheetWithData(s, next) : s
        )
        didChange = true
      }

      if (didChange) {
        useSheetStore.getState().replaceGridSheets(nextSheets)
        // MVP T019 fix: persist the merged rows IMMEDIATELY instead of
        // relying on the 30-second auto-save debounce. If the user
        // refreshes right after a form submission, we lose the rows
        // otherwise — they appear in the grid, disappear on reload.
        const { saveWorkbook } = await import('@/lib/saveService')
        void saveWorkbook({ id: workbookId, name: workbookName, data: nextSheets })
        toast.success('Form submissions added to the sheet.')
      }
    })()
    // Single-shot on mount — workbookId/workbookName captured by closure
    // intentionally (original behaviour).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
