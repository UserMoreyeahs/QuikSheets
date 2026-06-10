import type { Cell } from '@fortune-sheet/core'
import type { FormFieldKind } from '../types'

/**
 * Convert one submitted form value into the grid cell written by the
 * form-submission merge (useFormSubmissionMergeOnMount).
 *
 * number/currency fields MUST land as NUMERIC cells — writing String(raw)
 * stored "15000" as text, which won't SUM or sort numerically (the T019
 * fidelity gap). Currency punctuation the submitter typed ("₹15,000") is
 * stripped before coercion. Anything non-coercible falls back to text.
 */
export function submissionValueToCell(
  kind: FormFieldKind,
  raw: string | number | boolean | null | undefined,
): Cell {
  if (raw === undefined || raw === null || raw === '') {
    return { v: '', m: '' }
  }
  if (kind === 'number' || kind === 'currency') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[₹$€£,\s]/g, ''))
    if (Number.isFinite(n)) {
      return { v: n, m: String(n) }
    }
  }
  const display = String(raw)
  return { v: display, m: display }
}
