import type { FormField, FormFieldKind } from '../types'

export interface ColumnHeader {
  index: number
  label: string
  inferredKind?: FormFieldKind
}

// Order matters: more specific patterns first, since the first match wins.
// Generic numeric hints (units, total, sales, profit) live in the broad
// 'number' regex so common business headers don't fall through to 'text'
// (Quiksheets MVP polish: previously "Units", "Total", "Sales", "Discount"
// were all misdetected as text and rendered as plain text inputs in public
// form embeds, breaking validation downstream).
const HEADER_HINTS: Array<[RegExp, FormFieldKind]> = [
  [/email|e-mail/i, 'email'],
  [/phone|mobile|tel\b|fax/i, 'text'],
  [/date|month|year|day|when|created|updated|dob|birthday/i, 'date'],
  [/amount|price|cost|revenue|salary|currency|inr|usd|eur|gbp|fee|wage|invoice|paid|due|balance|charge|tax|discount/i, 'currency'],
  [/\bqty\b|quantity|count\b|number|num\b|\bage\b|score|points|\bunits?\b|total|sales|profit|margin|stock|inventory|hits|views|orders|sessions|clicks|impressions/i, 'number'],
  [/status|stage|state\b|phase/i, 'status'],
  [/active|enabled|done|complete|completed|approved|signed|verified|valid/i, 'checkbox'],
  [/region|category|segment|type\b|department|team|tier|plan|country|industry/i, 'select'],
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
