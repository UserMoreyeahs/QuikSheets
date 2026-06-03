import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sanitizeImportedCellValue, sanitizeMatrix } from '@/lib/security/csvInjection'
import {
  sanitizeCellForExport,
  sanitizeRowForExport,
  sanitizeMatrixForExport,
} from '@/features/grid/utils/sanitizeForExport'
import type { Sheet } from '@fortune-sheet/core'

// ── Test doubles (hoisted by vitest regardless of position) ────────────────
//
// Capture what file-saver would have written to disk so we can assert on the
// real exported bytes for the CSV / XLSX paths.
const savedBlobs: { blob: Blob; name: string }[] = []
vi.mock('file-saver', () => ({
  saveAs: (blob: Blob, name: string) => {
    savedBlobs.push({ blob, name })
  },
}))

// Capture the head/body the PDF export hands to jspdf-autotable so we can
// assert the cell *text* was neutralized without parsing a binary PDF.
const autoTableCalls: { head: string[][] | undefined; body: string[][] | undefined }[] = []
vi.mock('jspdf-autotable', () => ({
  default: (_doc: unknown, opts: { head?: string[][]; body?: string[][] }) => {
    autoTableCalls.push({ head: opts.head, body: opts.body })
  },
}))

// Imported AFTER the mocks above are declared. Vitest hoists vi.mock so these
// modules pick up the stubbed file-saver / jspdf-autotable.
import * as XLSX from 'xlsx'
import {
  exportToCSV,
  exportToExcel,
  exportToExcelFidelity,
  exportToPDF,
} from '@/features/grid/utils/exportUtils'

async function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text()
  return new Promise((resolve) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.readAsText(blob)
  })
}

async function blobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result as ArrayBuffer)
    fr.readAsArrayBuffer(blob)
  })
}

beforeEach(() => {
  savedBlobs.length = 0
  autoTableCalls.length = 0
})

// ───────────────────────────────────────────────────────────────────────────
// IMPORT side (pre-existing — kept as-is). The blocks below it cover EXPORT.
// ───────────────────────────────────────────────────────────────────────────
describe('sanitizeImportedCellValue', () => {
  it.each([
    ['=SUM(A1)', "'=SUM(A1)"],
    ['+1+1', "'+1+1"],
    ['-cmd|/c calc', "'-cmd|/c calc"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['|cat', "'|cat"],
    ['%foo', "'%foo"],
    ['0x41', "'0x41"],
  ])('prefixes %s -> %s', (input, expected) => {
    expect(sanitizeImportedCellValue(input)).toBe(expected)
  })

  it('passes through safe text', () => {
    expect(sanitizeImportedCellValue('Hello world')).toBe('Hello world')
    expect(sanitizeImportedCellValue('Rahul Sharma')).toBe('Rahul Sharma')
    expect(sanitizeImportedCellValue('123')).toBe('123')
  })

  it('passes through non-string values', () => {
    expect(sanitizeImportedCellValue(42)).toBe(42)
    expect(sanitizeImportedCellValue(null)).toBe(null)
    expect(sanitizeImportedCellValue(undefined)).toBe(undefined)
    expect(sanitizeImportedCellValue(true)).toBe(true)
  })

  it('sanitizes a matrix row-by-row', () => {
    const cleaned = sanitizeMatrix([
      ['Name', 'Note'],
      ['Asha', '=cmd'],
      ['Ben', 'plain'],
    ])
    expect(cleaned).toEqual([
      ['Name', 'Note'],
      ['Asha', "'=cmd"],
      ['Ben', 'plain'],
    ])
  })
})

// ───────────────────────────────────────────────────────────────────────────
// EXPORT side — every path that writes user cell *text* into a downloaded
// .csv / .xlsx / .pdf must neutralize a leading =/+/-/@/tab/CR so the file
// can't execute a formula when the victim opens it. We test the shared helper
// exhaustively, then prove the neutralization reaches the bytes on each path.
// ───────────────────────────────────────────────────────────────────────────

describe('sanitizeCellForExport (export helper)', () => {
  it.each([
    ['=SUM(A1)', "'=SUM(A1)"],
    ["=cmd|'/c calc'!A1", "'=cmd|'/c calc'!A1"],
    ['+1+1', "'+1+1"],
    ['-2-3', "'-2-3"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\t=cmd', "'\t=cmd"], // leading TAB — Excel strips it then re-parses =cmd
    ['\r=cmd', "'\r=cmd"], // leading CR
    ['\n=cmd', "'\n=cmd"], // leading LF (defensive)
  ])('prefixes dangerous string %j -> %j', (input, expected) => {
    expect(sanitizeCellForExport(input)).toBe(expected)
  })

  it('passes through safe strings unchanged', () => {
    expect(sanitizeCellForExport('Hello world')).toBe('Hello world')
    expect(sanitizeCellForExport('Rahul Sharma')).toBe('Rahul Sharma')
    expect(sanitizeCellForExport('123')).toBe('123')
    expect(sanitizeCellForExport('a=b')).toBe('a=b') // trigger not in first position
    expect(sanitizeCellForExport('price: -5')).toBe('price: -5')
    expect(sanitizeCellForExport('')).toBe('') // empty string is inert
  })

  it('passes through non-string values unchanged (numbers/booleans/null/undefined)', () => {
    expect(sanitizeCellForExport(42)).toBe(42)
    expect(sanitizeCellForExport(-5)).toBe(-5) // negative NUMBER, not a string
    expect(sanitizeCellForExport(0)).toBe(0)
    expect(sanitizeCellForExport(true)).toBe(true)
    expect(sanitizeCellForExport(false)).toBe(false)
    expect(sanitizeCellForExport(null)).toBe(null)
    expect(sanitizeCellForExport(undefined)).toBe(undefined)
  })

  it('sanitizes a row and a matrix; non-strings stay put', () => {
    expect(sanitizeRowForExport(['ok', '=bad', 7, null])).toEqual(['ok', "'=bad", 7, null])
    expect(
      sanitizeMatrixForExport([
        ['Name', 'Note'],
        ['Asha', '=cmd'],
        ['Ben', 'plain'],
        ['Total', 5],
      ]),
    ).toEqual([
      ['Name', 'Note'],
      ['Asha', "'=cmd"],
      ['Ben', 'plain'],
      ['Total', 5],
    ])
  })
})

describe('exportToCSV — neutralizes formula injection through sheet_to_csv', () => {
  it('prefixes every dangerous cell and leaves safe/numeric cells untouched', async () => {
    exportToCSV(
      {
        name: 'Sheet1',
        data: [
          ['Name', 'Payload'],
          ['eq', '=SUM(A1)'],
          ['plus', '+1+1'],
          ['minus', '-3'],
          ['at', '@cmd'],
          ['safe', 'hello'],
          ['num', 42],
          ['bool', true],
        ],
      },
      'inj',
    )
    expect(savedBlobs).toHaveLength(1)
    const csv = await blobText(savedBlobs[0]!.blob)
    const lines = csv.trim().split(/\r?\n/)
    expect(lines[0]).toBe('Name,Payload')
    expect(lines[1]).toBe("eq,'=SUM(A1)")
    expect(lines[2]).toBe("plus,'+1+1")
    expect(lines[3]).toBe("minus,'-3")
    expect(lines[4]).toBe("at,'@cmd")
    expect(lines[5]).toBe('safe,hello') // safe text untouched
    expect(lines[6]).toBe('num,42') // number untouched
    expect(lines[7]).toBe('bool,TRUE') // boolean untouched
    // No bare formula leader at the start of any field.
    expect(csv).not.toMatch(/(^|,)=SUM/)
    expect(csv).not.toMatch(/(^|,)\+1\+1/)
    expect(csv).not.toMatch(/(^|,)@cmd/)
  })

  it('neutralizes leading TAB / CR payloads', async () => {
    exportToCSV({ name: 'S', data: [['\t=cmd'], ['\r=cmd']] }, 'tabcr')
    const csv = await blobText(savedBlobs[0]!.blob)
    // Each dangerous value now begins with an apostrophe. sheet_to_csv quotes a
    // field that contains a tab/CR, so the apostrophe sits just inside the quote.
    expect(csv).toContain("'\t=cmd")
    expect(csv).toContain("'\r=cmd")
  })
})

describe('exportToExcel (legacy values-only) — neutralizes string cells', () => {
  it('reads back neutralized strings; numbers/booleans preserved', async () => {
    exportToExcel(
      [
        {
          name: 'Sheet1',
          data: [
            ['Name', 'Payload'],
            ['eq', '=1+1'],
            ['at', '@evil'],
            ['safe', 'plain'],
            ['n', 7],
            ['b', false],
          ],
        },
      ],
      'legacy',
    )
    expect(savedBlobs).toHaveLength(1)
    const buf = await blobArrayBuffer(savedBlobs[0]!.blob)
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets['Sheet1']!
    expect((ws['A2'] as { v: unknown }).v).toBe('eq')
    expect((ws['B2'] as { v: unknown }).v).toBe("'=1+1")
    expect((ws['B3'] as { v: unknown }).v).toBe("'@evil")
    expect((ws['B4'] as { v: unknown }).v).toBe('plain')
    expect((ws['B5'] as { v: unknown }).v).toBe(7)
    expect((ws['B5'] as { t: string }).t).toBe('n') // still numeric
    expect((ws['B6'] as { v: unknown }).v).toBe(false)
    expect((ws['B6'] as { t: string }).t).toBe('b') // still boolean
  })
})

describe('exportToExcelFidelity — neutralizes text cells, preserves authored formulas', () => {
  it('prefixes dangerous string values but never touches cell.f formulas or numbers', async () => {
    // FortuneSheet `data` matrix: each cell is { v, f?, ... }.
    const sheets = [
      {
        name: 'Sheet1',
        data: [
          [{ v: 'Name' }, { v: 'Col' }],
          [{ v: 'danger' }, { v: "=cmd|'/c calc'!A1" }], // plain TEXT that looks like a formula
          [{ v: 'plus' }, { v: '+evil()' }],
          [{ v: 'formula' }, { f: '=SUM(A1:A2)', v: 3 }], // REAL authored formula
          [{ v: 'safe' }, { v: 'hello' }],
          [{ v: 'num' }, { v: 99 }],
        ],
      } as unknown as Sheet,
    ]
    await exportToExcelFidelity(sheets, 'fidelity')
    expect(savedBlobs).toHaveLength(1)
    const buf = await blobArrayBuffer(savedBlobs[0]!.blob)
    const wb = XLSX.read(buf, { type: 'array' })
    const ws = wb.Sheets['Sheet1']!

    // Plain-text formula-looking values → neutralized with a leading apostrophe.
    expect((ws['B2'] as { v: unknown }).v).toBe("'=cmd|'/c calc'!A1")
    expect((ws['B3'] as { v: unknown }).v).toBe("'+evil()")

    // Authored formula → preserved as a formula, NOT prefixed.
    const formulaCell = ws['B4'] as { f?: string; v?: unknown }
    expect(formulaCell.f).toBe('SUM(A1:A2)') // leading '=' stripped by exporter, unchanged behavior
    expect(String(formulaCell.f)).not.toContain("'") // no apostrophe injected into the formula

    // Safe + numeric untouched.
    expect((ws['B5'] as { v: unknown }).v).toBe('hello')
    expect((ws['B6'] as { v: unknown }).v).toBe(99)
    expect((ws['B6'] as { t: string }).t).toBe('n')
  })
})

describe('exportToPDF — neutralizes autotable cell text', () => {
  it('prefixes dangerous cells in head and body, leaves safe text alone', () => {
    exportToPDF(
      {
        name: 'Sheet1',
        data: [
          ['Header', '=HEADERINJ'], // first row → autotable head
          ['safe', '=BODYINJ'],
          ['plain', 'ok'],
          ['neg', '-9'],
        ],
      },
      'pdfinj',
    )
    expect(autoTableCalls).toHaveLength(1)
    const { head, body } = autoTableCalls[0]!
    // Head row 0 came from the first data row.
    expect(head?.[0]).toEqual(['Header', "'=HEADERINJ"])
    // Body picks up from row 2 onward.
    expect(body?.[0]).toEqual(['safe', "'=BODYINJ"])
    expect(body?.[1]).toEqual(['plain', 'ok'])
    expect(body?.[2]).toEqual(['neg', "'-9"])
    // No raw formula leader survived into any rendered cell.
    const allCells = [...(head ?? []).flat(), ...(body ?? []).flat()]
    expect(allCells.some((c) => c.startsWith('='))).toBe(false)
    expect(allCells.some((c) => c.startsWith('@'))).toBe(false)
  })
})
