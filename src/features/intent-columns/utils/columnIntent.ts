import type { NumberFormat, ValidationConfig } from '@/types/sheet.types'

export type ColumnIntentType =
  | 'email'
  | 'phone'
  | 'date'
  | 'currency'
  | 'percentage'
  | 'url'
  | 'list'
  | 'id'

export interface ColumnIntent {
  type: ColumnIntentType
  format: NumberFormat
  validation?: ValidationConfig
  suggestion: string
  options?: string[]
}

export const HEADER_INTENT_MAP: Record<string, ColumnIntent> = {
  email: {
    type: 'email',
    format: 'text',
    validation: {
      rule: { type: 'email' },
      errorMessage: 'Enter a valid email address.',
      showDropdown: false,
    },
    suggestion: 'Email',
  },
  'e-mail': {
    type: 'email',
    format: 'text',
    validation: {
      rule: { type: 'email' },
      errorMessage: 'Enter a valid email address.',
      showDropdown: false,
    },
    suggestion: 'Email',
  },
  phone: { type: 'phone', format: 'text', suggestion: 'Phone' },
  mobile: { type: 'phone', format: 'text', suggestion: 'Phone' },
  tel: { type: 'phone', format: 'text', suggestion: 'Phone' },
  date: { type: 'date', format: 'date_short', suggestion: 'Date' },
  dob: { type: 'date', format: 'date_short', suggestion: 'Date' },
  deadline: { type: 'date', format: 'date_short', suggestion: 'Date' },
  birthday: { type: 'date', format: 'date_short', suggestion: 'Date' },
  revenue: { type: 'currency', format: 'currency', suggestion: 'Currency' },
  price: { type: 'currency', format: 'currency', suggestion: 'Currency' },
  cost: { type: 'currency', format: 'currency', suggestion: 'Currency' },
  amount: { type: 'currency', format: 'currency', suggestion: 'Currency' },
  salary: { type: 'currency', format: 'currency', suggestion: 'Currency' },
  budget: { type: 'currency', format: 'currency', suggestion: 'Currency' },
  rate: { type: 'percentage', format: 'percentage', suggestion: 'Percentage' },
  growth: { type: 'percentage', format: 'percentage', suggestion: 'Percentage' },
  percentage: { type: 'percentage', format: 'percentage', suggestion: 'Percentage' },
  '%': { type: 'percentage', format: 'percentage', suggestion: 'Percentage' },
  url: { type: 'url', format: 'text', suggestion: 'URL' },
  website: { type: 'url', format: 'text', suggestion: 'URL' },
  link: { type: 'url', format: 'text', suggestion: 'URL' },
  href: { type: 'url', format: 'text', suggestion: 'URL' },
  status: {
    type: 'list',
    format: 'text',
    validation: {
      rule: { type: 'list', options: ['Active', 'Inactive', 'Pending'] },
      errorMessage: 'Choose Active, Inactive, or Pending.',
      showDropdown: true,
    },
    suggestion: 'Status',
    options: ['Active', 'Inactive', 'Pending'],
  },
  state: {
    type: 'list',
    format: 'text',
    validation: {
      rule: { type: 'list', options: ['Active', 'Inactive', 'Pending'] },
      errorMessage: 'Choose Active, Inactive, or Pending.',
      showDropdown: true,
    },
    suggestion: 'Status',
    options: ['Active', 'Inactive', 'Pending'],
  },
  stage: {
    type: 'list',
    format: 'text',
    validation: {
      rule: { type: 'list', options: ['Active', 'Inactive', 'Pending'] },
      errorMessage: 'Choose Active, Inactive, or Pending.',
      showDropdown: true,
    },
    suggestion: 'Status',
    options: ['Active', 'Inactive', 'Pending'],
  },
  id: { type: 'id', format: 'text', suggestion: 'ID' },
  code: { type: 'id', format: 'text', suggestion: 'ID' },
  sku: { type: 'id', format: 'text', suggestion: 'ID' },
  ref: { type: 'id', format: 'text', suggestion: 'ID' },
}

export function detectColumnIntent(header: string): ColumnIntent | null {
  const normalized = header.toLowerCase().trim()
  if (!normalized) return null

  for (const [key, intent] of Object.entries(HEADER_INTENT_MAP)) {
    if (normalized === key || normalized.includes(key)) {
      return intent
    }
  }

  return null
}
