/**
 * Macro/script sandbox skeleton — gated by NEXT_PUBLIC_FF_MACROS.
 *
 * The eventual implementation runs user scripts inside a Web Worker with a
 * frozen API surface (read-only spreadsheet adapter). For now the sandbox
 * accepts a script string and returns a no-op success result, so the
 * boundary exists without exposing any execution surface.
 */

export interface MacroResult {
  ok: boolean
  output?: unknown
  error?: string
}

export async function runMacro(_script: string): Promise<MacroResult> {
  return { ok: true, output: null }
}
