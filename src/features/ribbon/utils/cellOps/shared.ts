/**
 * Shared helpers used by cellOps.ts and its sub-modules.
 *
 * Keep this file dependency-free (no React, no Zustand) so any cellOps/*
 * module can import from here without circular-import risk.
 */

/** Convert a 0-based column index to its Excel-style letters (A, B, …, AA). */
export function colIndexToLetter(index: number): string {
  let s = ''
  let n = index + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}
