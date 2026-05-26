/**
 * Generate `sample.xlsx` for the Excel-import e2e test.
 *
 * Used as Playwright globalSetup — runs once before any test executes
 * so the fixture is guaranteed to exist on disk by the time
 * `04-import-xlsx.spec.ts` reads it.
 *
 * The workbook has two sheets:
 *   - "Revenue":  4 rows × 3 cols (header + 3 data rows)
 *   - "Expenses": 5 rows × 3 cols (header + 4 data rows)
 *
 * A1 of the first sheet is the literal string "Quarter" — tests assert
 * that this value appears in the grid after import.
 */
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

export const SAMPLE_FIXTURE_A1 = 'Quarter'
export const SAMPLE_FIXTURE_SHEETS = ['Revenue', 'Expenses'] as const

export default async function generateSampleXlsx(): Promise<void> {
  const out = path.resolve(__dirname, 'sample.xlsx')
  if (fs.existsSync(out)) return // already built — skip on repeated runs

  const wb = XLSX.utils.book_new()

  const revenue: (string | number)[][] = [
    ['Quarter', 'Region', 'Revenue'],
    ['Q1', 'North', 1200],
    ['Q2', 'South', 1500],
    ['Q3', 'East', 1700],
  ]
  const expenses: (string | number)[][] = [
    ['Quarter', 'Category', 'Amount'],
    ['Q1', 'Salaries', 800],
    ['Q1', 'Hosting', 50],
    ['Q2', 'Salaries', 850],
    ['Q2', 'Hosting', 55],
  ]

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(revenue), 'Revenue')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(expenses), 'Expenses')

  XLSX.writeFile(wb, out)
}
