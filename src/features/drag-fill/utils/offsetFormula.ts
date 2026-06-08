/**
 * Shift the RELATIVE cell references in a formula by (dRow, dCol).
 *
 * This is the core of Excel-style fill: dragging `=P1*2` down one row must
 * yield `=P2*2`, not a copy of the computed value. Absolute parts (`$P`, `$1`,
 * `$P$1`) are preserved. References inside double-quoted string literals are
 * left untouched. A shift that pushes a row/column negative becomes `#REF!`
 * (matching Excel).
 *
 * Used by the fill handle (drag-fill) so formulas propagate instead of being
 * flattened to their displayed value.
 */

/** A1-style column letters → 0-based column index. */
function colLettersToIndex(letters: string): number {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

/** 0-based column index → A1-style column letters. */
function indexToColLetters(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

// A cell reference: optional $ + 1-3 letters + optional $ + digits. The
// lookbehind keeps us from matching inside a longer identifier (function name,
// named range) or a number; the lookahead skips function calls (`SUM(`). A
// leading sheet qualifier ("Sheet1!") is allowed before the ref, so
// cross-sheet refs still shift.
const CELL_REF = /(?<![A-Za-z0-9_$.])(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![A-Za-z0-9_(])/g

function shiftRefsInSegment(segment: string, dRow: number, dCol: number): string {
  return segment.replace(CELL_REF, (_match, colAbs: string, colLetters: string, rowAbs: string, rowDigits: string) => {
    let col = colLettersToIndex(colLetters)
    let row = parseInt(rowDigits, 10) - 1 // 0-based
    if (!colAbs) col += dCol
    if (!rowAbs) row += dRow
    if (col < 0 || row < 0) return '#REF!'
    return `${colAbs}${indexToColLetters(col)}${rowAbs}${row + 1}`
  })
}

export function offsetFormula(formula: string, dRow: number, dCol: number): string {
  if (!formula || (dRow === 0 && dCol === 0)) return formula

  let out = ''
  let buffer = ''
  let inString = false
  const flush = () => {
    out += shiftRefsInSegment(buffer, dRow, dCol)
    buffer = ''
  }

  for (let i = 0; i < formula.length; i += 1) {
    const ch = formula[i]
    if (inString) {
      out += ch
      if (ch === '"') {
        if (formula[i + 1] === '"') {
          out += '"' // escaped quote inside a string literal
          i += 1
          continue
        }
        inString = false
      }
      continue
    }
    if (ch === '"') {
      flush()
      out += ch
      inString = true
      continue
    }
    buffer += ch
  }
  flush()
  return out
}
