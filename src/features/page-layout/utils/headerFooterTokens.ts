/**
 * Header/footer token substitution — shared by the dialog preview and
 * the PDF exporter so both render identical text.
 *
 * Supported tokens (Excel parity, just bracket-syntax instead of &P/&D):
 *   &[Page]    current page number
 *   &[Pages]   total page count
 *   &[Date]    today's date (locale-formatted)
 *   &[Time]    current time (locale-formatted)
 *   &[Sheet]   active sheet name
 *   &[File]    workbook name
 *
 * Tokens are case-sensitive on purpose — matches Excel's behaviour and
 * avoids accidentally matching "&[page]" inside a user's literal text.
 */

export interface TokenContext {
  page: number
  pages: number
  sheet: string
  file: string
  /** Optional override for testing/snapshotting. Defaults to `new Date()`. */
  now?: Date
}

export function substituteHeaderFooterTokens(template: string, ctx: TokenContext): string {
  if (!template) return ''
  const now = ctx.now ?? new Date()
  return template
    .replace(/&\[Page\]/g, String(ctx.page))
    .replace(/&\[Pages\]/g, String(ctx.pages))
    .replace(/&\[Date\]/g, now.toLocaleDateString())
    .replace(/&\[Time\]/g, now.toLocaleTimeString())
    .replace(/&\[Sheet\]/g, ctx.sheet)
    .replace(/&\[File\]/g, ctx.file)
}

export const HEADER_FOOTER_TOKENS: ReadonlyArray<{ token: string; label: string }> = [
  { token: '&[Page]',  label: 'Page #' },
  { token: '&[Pages]', label: 'Total pages' },
  { token: '&[Date]',  label: 'Date' },
  { token: '&[Time]',  label: 'Time' },
  { token: '&[Sheet]', label: 'Sheet name' },
  { token: '&[File]',  label: 'File name' },
]
