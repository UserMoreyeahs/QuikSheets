import type { FormField, FormFieldKind } from '../types'

export interface ColumnHeader {
  index: number
  label: string
  inferredKind?: FormFieldKind
}

const HEADER_HINTS: Array<[RegExp, FormFieldKind]> = [
  [/email/i, 'email'],
  [/phone|mobile/i, 'text'],
  [/date|month|year|day/i, 'date'],
  [/amount|price|cost|revenue|salary|currency|inr|usd/i, 'currency'],
  [/qty|quantity|count|number|num|age|score|points/i, 'number'],
  [/status|stage|state/i, 'status'],
  [/active|enabled|done|complete|paid/i, 'checkbox'],
  [/region|category|segment|type/i, 'select'],
]

export function inferFieldKind(label: string): FormFieldKind {
  for (const [regex, kind] of HEADER_HINTS) {
    if (regex.test(label)) return kind
  }
  return 'text'
}

export function buildFieldsFromHeaders(headers: ColumnHeader[]): FormField[] {
  return headers
    .filter((h) => h.label.trim().length > 0)
    .map((h) => {
      const kind = h.inferredKind ?? inferFieldKind(h.label)
      const field: FormField = {
        id: crypto.randomUUID(),
        label: h.label,
        columnIndex: h.index,
        kind,
        required: false,
      }
      if (kind === 'select' || kind === 'status') field.options = []
      return field
    })
}

export function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'form'
  ) + '-' + Math.random().toString(36).slice(2, 8)
}
