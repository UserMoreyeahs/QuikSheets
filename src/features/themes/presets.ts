/**
 * Built-in theme presets — picked from common Excel / Google Sheets
 * palette pairs. Each theme uses readable, accessible defaults
 * (text-vs-bg contrast > 4.5:1 for the primary colour).
 */

import type { Theme } from './types'

export const THEME_PRESETS: ReadonlyArray<Theme> = [
  {
    id: 'office',
    name: 'Office',
    description: 'Quiksheets default — blue accents, Inter font.',
    colors: {
      primary: '#2563eb', // blue-600
      accent:  '#dbeafe', // blue-100
      success: '#16a34a',
      warning: '#f59e0b',
      danger:  '#dc2626',
      surface: '#ffffff',
    },
    headingFont: 'Inter',
    bodyFont:    'Inter',
  },
  {
    id: 'slate',
    name: 'Slate',
    description: 'Neutral greys and a teal accent — pairs with reports.',
    colors: {
      primary: '#475569', // slate-600
      accent:  '#cbd5e1', // slate-300
      success: '#0d9488',
      warning: '#d97706',
      danger:  '#b91c1c',
      surface: '#f8fafc',
    },
    headingFont: 'Inter',
    bodyFont:    'Inter',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Indigo + violet — feels SaaS-y, dashboards / KPIs.',
    colors: {
      primary: '#6366f1', // indigo-500
      accent:  '#e0e7ff', // indigo-100
      success: '#10b981',
      warning: '#f97316',
      danger:  '#ef4444',
      surface: '#ffffff',
    },
    headingFont: 'Inter',
    bodyFont:    'Inter',
  },
  {
    id: 'vintage',
    name: 'Vintage',
    description: 'Warm browns + cream — pairs with literary content.',
    colors: {
      primary: '#92400e', // amber-800
      accent:  '#fef3c7', // amber-100
      success: '#65a30d',
      warning: '#ea580c',
      danger:  '#991b1b',
      surface: '#fffbeb',
    },
    headingFont: 'Georgia',
    bodyFont:    'Georgia',
  },
  {
    id: 'vibrant',
    name: 'Vibrant',
    description: 'Pink + emerald — marketing decks, social KPIs.',
    colors: {
      primary: '#db2777', // pink-600
      accent:  '#fce7f3', // pink-100
      success: '#059669',
      warning: '#facc15',
      danger:  '#e11d48',
      surface: '#ffffff',
    },
    headingFont: 'Inter',
    bodyFont:    'Inter',
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Pure black + white — accessible, print-friendly.',
    colors: {
      primary: '#111827', // gray-900
      accent:  '#e5e7eb', // gray-200
      success: '#374151',
      warning: '#6b7280',
      danger:  '#000000',
      surface: '#ffffff',
    },
    headingFont: 'Inter',
    bodyFont:    'Inter',
  },
]

export const DEFAULT_THEME_ID = 'office'

export function getThemeById(id: string): Theme {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0]!
}
