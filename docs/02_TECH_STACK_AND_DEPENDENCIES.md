# Quiksheets — Verified Technology Stack and Dependency Decisions

## Final Stack

| Layer | Decision |
|---|---|
| Product name | Quiksheets |
| Frontend | Next.js 15.x, React 19, TypeScript strict, App Router |
| UI | Tailwind CSS, shadcn/ui, Radix only through shadcn, lucide-react |
| Spreadsheet engine | Primary: Univer Sheets; fallback: FortuneSheet behind adapter |
| Formula engine | Primary: Univer formula engine; fallback: HyperFormula behind FormulaEngineAdapter only |
| Backend | Supabase PostgreSQL, Auth, Storage, Realtime, RLS |
| Realtime | Supabase Broadcast + Presence for lightweight collaboration; Yjs or Univer Pro for conflict-safe concurrent editing |
| AI | Groq SDK through server routes only; model: llama-3.3-70b-versatile |
| App state | Zustand for UI/app state only |
| Server state | TanStack Query for workbook lists, templates, comments, members, audit logs, automations |
| Charts | Univer chart capability where possible; Apache ECharts for dashboard/custom analytics |
| Import/export | Univer import/export where suitable; SheetJS fallback; jsPDF + autoTable for reports |
| Validation | Zod for env and API schemas |
| Testing | Vitest, React Testing Library, Playwright |
| Deployment | Vercel + Supabase hosted project |

## Key Corrections From Legacy Context

Earlier iterations referenced Next.js 14, FortuneSheet as primary, HyperFormula as mandatory, and Groq `llama3-70b-8192`. Override all of that.

Use:
- Quiksheets as the application name.
- Next.js 15.x.
- Univer Sheets as primary spreadsheet engine.
- FortuneSheet only as fallback through `SpreadsheetEngineAdapter`.
- Univer formulas first.
- HyperFormula only as fallback through `FormulaEngineAdapter`, after license review.
- Groq model `llama-3.3-70b-versatile`.
- Supabase Broadcast + Presence; add Yjs/Univer Pro for true conflict-safe collaboration.

## Mandatory Dependency Guardrails

1. Do not bind the application directly to Univer, FortuneSheet, or HyperFormula.
2. Keep the spreadsheet engine replaceable through `src/features/spreadsheet/engine/SpreadsheetEngineAdapter.ts`.
3. Keep formula calculation replaceable through `src/features/formula/FormulaEngineAdapter.ts`.
4. Keep Groq access server-side only.
5. Keep large cell state inside the spreadsheet engine/persistence layer, not Zustand.
6. Do not implement P2 features before P0 and P1 acceptance tests pass.
