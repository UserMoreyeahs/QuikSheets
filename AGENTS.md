# AGENTS.md — Quiksheets

## Project
Quiksheets is a production-grade browser spreadsheet application with AI-native workflows.

Legacy files may mention SheetForge. Treat SheetForge as old source context only. All new code, docs, UI, env names, package names, database names, and commit messages must use Quiksheets.

## Stack
- Next.js 15.x
- React 19
- TypeScript strict
- App Router
- Tailwind CSS
- shadcn/ui
- Supabase PostgreSQL/Auth/Storage/Realtime/RLS
- Supabase Broadcast + Presence
- Primary spreadsheet engine: Univer Sheets
- Fallback spreadsheet engine: FortuneSheet
- Required abstraction: SpreadsheetEngineAdapter
- Primary formula engine: Univer formula engine
- Optional fallback formula engine: HyperFormula through FormulaEngineAdapter only
- Zustand for UI/app state only
- TanStack Query for server state
- Groq SDK server-side only
- Groq model inside app: llama-3.3-70b-versatile
- Apache ECharts for dashboard/custom analytics
- SheetJS/xlsx for import/export fallback
- jsPDF + autoTable for PDF reports
- Vitest, React Testing Library, Playwright
- Vercel deployment

## Critical Rules
- Do not use SheetForge as the new app name.
- Do not use Next.js 14.
- Do not upgrade to Next.js 16 unless a separate compatibility spike proves it safe.
- Do not call Groq from client/browser code.
- Do not expose API keys.
- Do not directly couple Univer, FortuneSheet, or HyperFormula outside adapters.
- Do not store every spreadsheet cell in Zustand.
- Do not implement P2 before P0 and P1 are stable.
- Do not create placeholder UI and mark it complete.
- Every AI mutation must use preview-before-apply.
- Supabase RLS must exist from the first backend session.
- P2 and experimental AI features must be behind feature flags.

## Required Commands
Before marking work complete, run:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

## Session Completion Report
At the end of each task, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message

## Commit Format
Use:
- feat(scope): description
- fix(scope): description
- chore(scope): description
- docs(scope): description

## Working Rule
Implement one session at a time. Do not skip ahead.

## Session Index
- Original 22 sessions: see [docs/09_CODEX_PROMPTS_22_SESSIONS.md](docs/09_CODEX_PROMPTS_22_SESSIONS.md).
- Remediation pack (R1–R14) for the legacy SheetForge → Quiksheets bridge: see [docs/REMEDIATION_CODEX_PROMPTS.md](docs/REMEDIATION_CODEX_PROMPTS.md).
