/**
 * Fix: bare `TRUE` / `FALSE` boolean literals evaluate to `#NAME?` in the
 * FortuneSheet formula parser — e.g. `=VLOOKUP(x, range, col, FALSE)` (the most
 * common lookup form) or a bare `=TRUE`.
 *
 * Root cause: `@fortune-sheet/formula-parser` tokenises a bare `TRUE`/`FALSE`
 * as a variable reference, and in `@fortune-sheet/core`'s wiring that resolves
 * to `#NAME?`. The *function* forms `TRUE()` / `FALSE()` evaluate correctly
 * (they are real functions in `@formulajs/formulajs`), and so do `0` / `1`.
 *
 * Fix: normalise bare `TRUE`/`FALSE` → `TRUE()`/`FALSE()` at the parser
 * boundary. We wrap `Parser.prototype.parse` — `@fortune-sheet/core` imports
 * the *same* `Parser` class from this package (it does `new Parser()` and does
 * not bundle its own copy), so patching the shared prototype fixes both
 * in-grid editing and the formula bar.
 *
 * The rewrite skips text inside string literals (so `"FALSE"` and
 * `IF(x,"TRUE","FALSE")` are untouched) and tokens already followed by `(`
 * (so existing `TRUE()`/`FALSE()` calls are left alone). Word boundaries keep
 * identifiers like `TRUENORTH` safe.
 *
 * Must be imported before the FortuneSheet bundle initialises (i.e. at the top
 * of the sheet page), mirroring `formulajsPatches`.
 */

// @ts-expect-error — no types ship with @fortune-sheet/formula-parser
import { Parser } from '@fortune-sheet/formula-parser'

// Bare TRUE/FALSE word, not immediately followed by '(' (already a call).
const BARE_BOOLEAN = /\b(true|false)\b(?!\s*\()/gi

/**
 * Replace bare TRUE/FALSE with TRUE()/FALSE() everywhere except inside
 * double-quoted string literals. Exported for unit testing.
 */
export function normalizeBooleanLiterals(expression: string): string {
  if (typeof expression !== 'string') return expression
  // Cheap bail-out: nothing to do when no bare boolean word is present.
  if (!/true|false/i.test(expression)) return expression

  let result = ''
  let buffer = ''
  let inString = false

  const flush = () => {
    result += buffer.replace(BARE_BOOLEAN, (m) => `${m.toUpperCase()}()`)
    buffer = ''
  }

  for (let i = 0; i < expression.length; i += 1) {
    const ch = expression[i]
    if (inString) {
      result += ch
      if (ch === '"') {
        // `""` is an escaped quote inside a string literal — stay in-string.
        if (expression[i + 1] === '"') {
          result += '"'
          i += 1
          continue
        }
        inString = false
      }
      continue
    }
    if (ch === '"') {
      flush()
      result += ch
      inString = true
      continue
    }
    buffer += ch
  }
  flush()
  return result
}

type ParserProto = {
  parse: (expression: string, options?: unknown) => unknown
  __qsBooleanPatch?: boolean
}

const proto = (Parser as unknown as { prototype: ParserProto }).prototype

if (!proto.__qsBooleanPatch) {
  const original = proto.parse
  proto.parse = function patchedParse(this: unknown, expression: string, options?: unknown) {
    return original.call(this, normalizeBooleanLiterals(expression), options)
  }
  proto.__qsBooleanPatch = true
}

export {}
