# Quiksheets — Verification Notes

## Technology verification summary
- Univer Sheets is selected as the primary spreadsheet engine because it is built as a spreadsheet component for browser/Node use and includes spreadsheet capabilities such as formulas, formatting, validation, filtering, collaboration-related capabilities, print, and import/export in its ecosystem.
- FortuneSheet is retained only as fallback behind `SpreadsheetEngineAdapter`.
- Groq `llama3-70b-8192` is not used because Groq deprecated it in favor of `llama-3.3-70b-versatile`.
- Supabase Realtime Broadcast and Presence are used for lightweight realtime activity.
- Yjs or Univer Pro is reserved for conflict-safe collaborative editing.
- Next.js 15.x remains the safer target than jumping to Next.js 16 for this spreadsheet-heavy build.

## Official/source URLs checked
- https://docs.univer.ai/guides/sheets
- https://docs.univer.ai/guides/sheets/getting-started/integrations/react
- https://docs.univer.ai/guides/sheets/features/import-export
- https://github.com/dream-num/univer
- https://console.groq.com/docs/deprecations
- https://console.groq.com/docs/models
- https://supabase.com/docs/guides/realtime
- https://supabase.com/docs/guides/realtime/broadcast
- https://supabase.com/docs/guides/realtime/presence
- https://nextjs.org/blog/next-15
- https://nextjs.org/blog/next-15-1
- https://ui.shadcn.com/docs/react-19
