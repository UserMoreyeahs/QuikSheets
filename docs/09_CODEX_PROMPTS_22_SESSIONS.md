# Quiksheets — Codex Prompt Document for 22 Sessions

Use this document exactly. Paste only one session prompt into Codex at a time.

Global instruction for every session:
- Read AGENTS.md first.
- Read relevant docs in /docs.
- Implement only the requested session.
- Do not skip ahead.
- Run quality gates.
- Report files created, files changed, commands run, errors fixed, remaining issues, and suggested commit message.


## Session 1 — Codex Context and Repo Documentation

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 1 — Codex Context and Repo Documentation.

Goal:
Create all durable project context files before implementation.

Scope:
- Create/verify AGENTS.md, README.md, docs folder, .env.example.
- Document Quiksheets naming rule.
- Do not install packages or build UI yet.
- Commit docs only.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 2 — Next.js 15 Foundation

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 2 — Next.js 15 Foundation.

Goal:
Initialize Quiksheets app foundation.

Scope:
- Create Next.js 15.x app with React 19 and TypeScript strict.
- Configure App Router, Tailwind, shadcn base, ESLint, Prettier.
- Create required folder structure.
- Add Zod env validation skeleton.
- Add health route, landing route, protected dashboard placeholder.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 3 — Supabase Auth, Workspace, Schema, RLS

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 3 — Supabase Auth, Workspace, Schema, RLS.

Goal:
Create backend foundation.

Scope:
- Add Supabase client/server helpers.
- Create migrations for profiles, workspaces, workspace_members, workbooks, workbook_members.
- Implement signup/login/logout/reset password pages.
- Add protected routes and unauthorized page.
- Add initial RLS policies.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 4 — Workbook Dashboard and Template Shell

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 4 — Workbook Dashboard and Template Shell.

Goal:
Build dashboard before grid.

Scope:
- List workbooks through TanStack Query.
- Create workbook with default Sheet1.
- Add workspace switcher shell.
- Add template gallery shell with starter categories.
- Persist workbook creation in Supabase.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 5 — Spreadsheet Engine Adapter

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 5 — Spreadsheet Engine Adapter.

Goal:
Integrate spreadsheet engine behind abstraction.

Scope:
- Create SpreadsheetEngineAdapter interface.
- Implement Univer adapter as primary.
- Create fallback FortuneSheet adapter stub only.
- Render workbook page with blank workbook.
- Do not leak Univer calls outside adapter.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 6 — Core Grid Editing and Navigation

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 6 — Core Grid Editing and Navigation.

Goal:
Implement spreadsheet basics.

Scope:
- Cell selection, range selection, keyboard navigation.
- Edit text/number/date/currency cells.
- Add/delete/resize rows and columns.
- Persist changed cells using debounced save.
- Add save status.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 7 — Formula Bar and Formula Engine Adapter

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 7 — Formula Bar and Formula Engine Adapter.

Goal:
Implement formula entry and calculation.

Scope:
- Create FormulaEngineAdapter.
- Use Univer formula capability as primary.
- Add formula bar, address box, fx indicator.
- Validate/evaluate formulas.
- Support formula errors and supported function list.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 8 — Formatting Toolbar and Data Validation

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 8 — Formatting Toolbar and Data Validation.

Goal:
Implement spreadsheet formatting.

Scope:
- Bold, italic, underline, font size, font family.
- Text color, fill color, alignment, wrap, borders.
- Number/date/currency/percentage formats.
- Data validation rules: number range, text length, dropdown, date range, email, URL, custom formula.
- Persist formatting and validation.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 9 — Multi-Sheet Workbooks and Cross-Sheet References

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 9 — Multi-Sheet Workbooks and Cross-Sheet References.

Goal:
Implement workbook sheet management.

Scope:
- Add, rename, duplicate, delete, reorder sheets.
- Sheet color and active sheet state.
- Cross-sheet formula references.
- Persist sheet metadata.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 10 — Undo/Redo, Cell History, Workbook Versions

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 10 — Undo/Redo, Cell History, Workbook Versions.

Goal:
Implement recovery and history.

Scope:
- 100-step undo/redo command stack.
- Cell-level history panel.
- Restore previous cell value.
- Workbook snapshot table and restore flow.
- Audit restore actions.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 11 — Import/Export and Auto-Save Hardening

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 11 — Import/Export and Auto-Save Hardening.

Goal:
Implement data movement and reliability.

Scope:
- CSV import/export.
- XLSX import/export through engine/import service with SheetJS fallback.
- PDF export using jsPDF + autoTable.
- Import/export fidelity tests.
- Offline/retry/conflict save status.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 12 — AI Gateway Foundation and Formula Assistant

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 12 — AI Gateway Foundation and Formula Assistant.

Goal:
Implement first AI feature safely.

Scope:
- Create Groq server-only client.
- Create AI route framework with auth, RLS check, rate-limit hook, Zod validation.
- Implement natural-language formula generation.
- Preview formula before applying.
- Validate formula before insertion.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 13 — AI Formula Explainer and Live Preview

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 13 — AI Formula Explainer and Live Preview.

Goal:
Add formula intelligence.

Scope:
- Explain selected formula in plain English.
- Show referenced cells and calculation structure.
- Implement live formula preview while typing.
- Handle errors and nested formulas.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 14 — Smart Paste and AI Data Cleaning

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 14 — Smart Paste and AI Data Cleaning.

Goal:
Implement AI cleaning safely.

Scope:
- Detect pasted dirty data.
- Preview dedupe, date normalization, phone normalization, casing fixes.
- Accept/reject transformations.
- Add undo/history for accepted transformations.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 15 — Typed Columns, Column DNA, Natural-Language Filters

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 15 — Typed Columns, Column DNA, Natural-Language Filters.

Goal:
Implement AI-assisted data structure.

Scope:
- Infer column types: text, number, date, currency, email, phone, status, checkbox, select.
- Apply validation from type.
- Column DNA panel with completeness, top values, outliers, mixed types, health score.
- Natural-language filters with previewed filter rules.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 16 — Collaboration, Sharing, RBAC, Presence

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 16 — Collaboration, Sharing, RBAC, Presence.

Goal:
Implement multi-user access.

Scope:
- Owner/editor/viewer roles.
- Share dialog.
- Supabase Presence for online users.
- Supabase Broadcast for cursors/selections.
- Prepare Yjs/Univer Pro feature flag for conflict-safe collaboration.
- Verify RLS policies.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 17 — Comments, Mentions, Protected Ranges, Share Links

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 17 — Comments, Mentions, Protected Ranges, Share Links.

Goal:
Implement P1 collaboration controls.

Scope:
- Cell comments and resolve status.
- Mentions with stored mentioned_user_ids.
- Protected ranges with allowed users/roles.
- Share-by-link with expiry and role.
- Audit permission changes.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 18 — Starter Templates and Forms

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 18 — Starter Templates and Forms.

Goal:
Implement templates and form intake.

Scope:
- Starter templates: sales, finance, HR, operations.
- Create workbook from template.
- Create form from sheet columns.
- Public/internal forms.
- Form submission inserts row into sheet.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 19 — Automations and Provider Interfaces

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 19 — Automations and Provider Interfaces.

Goal:
Implement row triggers and actions.

Scope:
- Automation builder.
- Triggers: row created, row updated, status changed.
- Provider interfaces: Email, WhatsApp, Slack, Teams, Task.
- Mock mode for missing credentials.
- Automation run logs and retry/failure state.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 20 — Charts, Conditional Formatting, Dependency Map

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 20 — Charts, Conditional Formatting, Dependency Map.

Goal:
Implement analysis features.

Scope:
- Bar, line, pie charts from selected range.
- Conditional formatting rules.
- Formula dependency map.
- Click dependency node to navigate to cell.
- Persist chart/rule/dependency metadata where needed.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 21 — P2 Feature-Flagged Platform Features

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 21 — P2 Feature-Flagged Platform Features.

Goal:
Add advanced features behind flags.

Scope:
- Pivot table prototype.
- Dashboard builder with KPI widgets and charts.
- Macro/script engine sandbox skeleton.
- External connector interface and mock connector.
- Row-level visibility rules.
- Forecasting/anomaly AI agent preview.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```

## Session 22 — Final QA, Security Hardening, Performance, Deployment

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session 22 — Final QA, Security Hardening, Performance, Deployment.

Goal:
Make project release-ready.

Scope:
- Run full test suite and Playwright flows.
- Security review: RLS, env, API keys, import validation, CSV formula injection prevention.
- Performance pass: lazy load heavy panels, memoization, route-level loading states.
- Dark mode and polish.
- Vercel deployment docs and production checklist.

Rules:
- Implement this session only.
- Do not implement later sessions.

- Do not use Next.js 14.
- Do not upgrade to Next.js 16.
- Do not expose API keys.
- Do not call Groq from client/browser code.
- Do not directly couple spreadsheet or formula engines outside adapters.
- Do not mark placeholder UI as complete.
- Every AI mutation must use preview-before-apply where AI is involved.
- Keep P2 features behind feature flags.

Required quality gates:
- npm run typecheck
- npm run lint
- npm run test when tests exist
- npm run build

At the end, report:
- Files created
- Files changed
- Features completed
- Tests added
- Commands run
- Errors fixed
- Remaining issues
- Suggested git commit message
```
