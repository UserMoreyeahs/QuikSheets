/**
 * Excel-style date auto-detection for free-form cell entry.
 *
 * Excel converts a date typed into a *General* cell (e.g. "01-04-2026") into a
 * date serial, right-aligns it, and displays it formatted — so it sorts and
 * calculates as a real date. QuikSheets stored such input as literal text.
 *
 * `detectExcelDate` is a PURE, conservative detector: it returns the Excel
 * serial + a display mask only for strings that STRICTLY match a full date
 * pattern with a 4-digit year. Everything else (plain numbers, codes, partial
 * dates, text) returns null, so it never hijacks normal entry.
 *
 * Locale: ambiguous numeric dates are read **day-first** (DD-MM-YYYY) to match
 * en-IN — the app's default locale (see columnTypeFormatters / parseLooseDate).
 *
 * The serial→display mapping is verified against FortuneSheet's own render
 * engine in detectExcelDate.spec.ts.
 */

export interface DetectedDate {
  /** Excel/Lotus serial (days since 1899-12-30) — stored as the cell value. */
  serial: number
  /** FortuneSheet `ct.fa` number-format mask for the cell. */
  mask: string
  /** Pre-rendered display string (matches what the mask produces). */
  display: string
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function toSerial(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - EXCEL_EPOCH) / 86400000)
}

/** True only if (y,m,d) is a real calendar date (rejects 31-02, 31-04, etc.). */
function isRealDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

const pad = (n: number) => String(n).padStart(2, '0')

export function detectExcelDate(raw: unknown): DetectedDate | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  if (!s) return null

  // ISO: YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const y = +m[1]!, mo = +m[2]!, d = +m[3]!
    if (!isRealDate(y, mo, d)) return null
    return { serial: toSerial(y, mo, d), mask: 'yyyy-mm-dd', display: `${y}-${pad(mo)}-${pad(d)}` }
  }

  // DD-MMM-YYYY (e.g. 01-Apr-2026)
  m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/)
  if (m) {
    const d = +m[1]!, mon = MONTHS.indexOf(m[2]!.toLowerCase()) + 1, y = +m[3]!
    if (mon === 0 || !isRealDate(y, mon, d)) return null
    const mmm = m[2]![0]!.toUpperCase() + m[2]!.slice(1, 3).toLowerCase()
    return { serial: toSerial(y, mon, d), mask: 'dd-mmm-yyyy', display: `${pad(d)}-${mmm}-${y}` }
  }

  // DD-MM-YYYY or DD/MM/YYYY (day-first, consistent separator, 4-digit year)
  m = s.match(/^(\d{1,2})([/-])(\d{1,2})\2(\d{4})$/)
  if (m) {
    const d = +m[1]!, sep = m[2]!, mo = +m[3]!, y = +m[4]!
    if (!isRealDate(y, mo, d)) return null
    const mask = sep === '/' ? 'dd/mm/yyyy' : 'dd-mm-yyyy'
    return { serial: toSerial(y, mo, d), mask, display: `${pad(d)}${sep}${pad(mo)}${sep}${y}` }
  }

  return null
}
