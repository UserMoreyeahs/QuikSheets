# Quiksheets Remediation — Codex Prompt Pack (R1–R14)

Use this document like `docs/09_CODEX_PROMPTS_22_SESSIONS.md`. Paste **one** session block into Codex at a time. Do not skip ahead.

Each prompt repeats the same global `Rules`, `Required quality gates`, and `At the end, report` blocks for safety, exactly as the original 22-session pack does.

---

## Session R1 — Repo Identity and Codex Documentation

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R1 — Repo Identity and Codex Documentation.

Goal:
Make the repository match the Quiksheets Codex documentation pack so that every later session can rely on a stable, correctly-named, well-documented base.

Scope:
- Create AGENTS.md at repo root using the operating contract in docs/10_CODEX_OPERATING_GUIDE.md.
- Create /docs at repo root and copy in 01_PRODUCT_REQUIREMENTS.md, 02_TECH_STACK_AND_DEPENDENCIES.md, 03_ARCHITECTURE.md, 04_DATABASE_SCHEMA_AND_RLS.md, 05_TESTING_AND_QUALITY_GATES.md, 06_RISK_REGISTER.md, 07_DEPLOYMENT_AND_OPERATIONS.md, 08_SESSION_ROADMAP.md, 09_CODEX_PROMPTS_22_SESSIONS.md, 10_CODEX_OPERATING_GUIDE.md, 11_VERIFICATION_NOTES.md, plus this remediation pack.
- Create .env.example listing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, and any feature flags referenced by docs.
- Confirm the product name is Quiksheets everywhere: package.json name, README, dashboard header, login page, CLAUDE.md, comments, and any UI strings.
- Add a one-time localStorage migration shim in src/lib/legacyStorageMigration.ts that, on app boot, copies any keys with a legacy prefix into the current `quiksheets_` prefix and deletes the originals; call it once from src/app/layout.tsx (client boundary).
- Update CLAUDE.md so it states the new product name, the new doc locations, and links the remediation pack.

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

---

## Session R2 — Next.js 15.x Pin and Test/Validation Tooling

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R2 — Next.js 15.x Pin and Test/Validation Tooling.

Goal:
Bring the framework version into compliance with the docs and install the required quality-gate tooling.

Scope:
- Downgrade next and eslint-config-next to the latest 15.x line. Verify next.config.mjs flags still apply (drop --webpack if it relied on Next 16 changes).
- Verify React 19 is still compatible; pin matching @types/react and @types/react-dom.
- Add npm scripts: "typecheck": "tsc --noEmit", "test": "vitest run", "test:watch": "vitest", "test:e2e": "playwright test", "format": "prettier --write .".
- Install dev dependencies: vitest, @vitest/ui, @testing-library/react, @testing-library/jest-dom, jsdom, @playwright/test, zod.
- Add vitest.config.ts (jsdom env, setup file enabling @testing-library/jest-dom).
- Add playwright.config.ts targeting baseURL http://localhost:3000.
- Add src/lib/env.ts: a Zod schema validating NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, GROQ_API_KEY, and feature-flag NEXT_PUBLIC_* values; export typed env objects (server-only and public).
- Add src/lib/env.client.ts that only re-exports the safe public subset, so client bundles cannot import server keys.
- Add a smoke test tests/smoke/env.spec.ts that imports env.ts with valid mock values and asserts parse success.
- Update CLAUDE.md and .env.example to match.

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

---

## Session R3 — Spreadsheet and Formula Engine Adapters

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R3 — Spreadsheet and Formula Engine Adapters.

Goal:
Decouple the application from FortuneSheet and HyperFormula by introducing the SpreadsheetEngineAdapter and FormulaEngineAdapter required by docs/03_ARCHITECTURE.md §4.

Scope:
- Create src/features/spreadsheet/engine/SpreadsheetEngineAdapter.ts exporting an interface with: initialize, destroy, getWorkbook, setWorkbook, getActiveSheet, setActiveSheet, getSelection, setSelection, getRangeValues, setRangeValues, applyFormatting, applyValidation, insertRows, deleteRows, insertColumns, deleteColumns, mergeCells, unmergeCells, onCellChange, onSelectionChange.
- Create src/features/spreadsheet/adapters/FortuneSheetAdapter.ts that implements that interface, wrapping the current FortuneSheet usage already in SpreadsheetGrid.
- Create src/features/spreadsheet/adapters/UniverAdapter.ts as a stub: implements the interface, throws NotImplementedError, gated behind feature flag NEXT_PUBLIC_ENGINE=univer.
- Create src/features/spreadsheet/engine/getEngine.ts that returns the active adapter based on the env flag and is the only place that imports concrete adapters.
- Create src/features/formula/FormulaEngineAdapter.ts with: evaluateFormula, validateFormula, getDependencies, recalculateWorkbook, explainFormulaStructure, getSupportedFunctions.
- Create src/features/formula/adapters/HyperFormulaAdapter.ts implementing the interface using the existing src/lib/hyperformula.ts singleton.
- Refactor every consumer of FortuneSheet/HyperFormula to call adapters: SpreadsheetGrid, FormulaBar, formula-engine, dependency-map, conditional-formatting, smart-paste, live-preview, intent-columns, column-dna, row-summarizer, scratchpad. Direct imports from @fortune-sheet/* and hyperformula must remain only inside the adapter files.
- Move cell matrices out of Zustand: keep only activeWorkbookId, selection, activeSheetId, panel, formatting, aiPreview, validationRules in stores. The grid/cell data must flow through the adapter, not gridSheets.
- Add Vitest tests covering: HyperFormulaAdapter.evaluateFormula for SUM, IF, VLOOKUP; FortuneSheetAdapter.applyFormatting smoke; getEngine returns FortuneSheet when flag absent.

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

---

## Session R4 — Supabase Schema and RLS Migrations

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R4 — Supabase Schema and RLS Migrations.

Goal:
Implement the full database schema and Row-Level Security policies described in docs/04_DATABASE_SCHEMA_AND_RLS.md.

Scope:
- Replace the current src/supabase/schema.sql with versioned migrations under src/supabase/migrations/:
  - 0001_workspaces.sql: profiles, workspaces, workspace_members.
  - 0002_workbooks.sql: workbooks, workbook_members, sheets, cells.
  - 0003_collaboration.sql: share_links, comments, protected_ranges.
  - 0004_history.sql: cell_history (replace legacy table), workbook_versions.
  - 0005_features.sql: templates, forms, form_submissions, automations, automation_runs, scratchpads, charts.
  - 0006_p2.sql: pivot_tables, dashboards, audit_logs.
- Each migration enables RLS and writes policies per doc 04 §5: workspace owners/admins manage settings; workbook owners full control; editors can mutate sheet/cell/comment/chart/automation but cannot remove owner; viewers read-only; share_links scope by token + active + expiry; protected_ranges block edits unless allowed; scratchpads private by user_id; public form submissions allow anon insert; audit_logs append-only via security-definer functions.
- Add src/lib/supabase/server.ts (cookies-aware server client + service-role client) and src/lib/supabase/client.ts (browser client). Replace any existing imports of src/lib/supabase.ts to use the new modules; keep a thin re-export for back-compat or delete and update consumers.
- Add tests/rls/*.spec.ts running against a local Supabase or pgTAP-style script that asserts: viewer cannot UPDATE cells; editor can UPDATE cells; non-member SELECT returns 0 rows; expired share_link denies access; protected range blocks editor write.
- Update CLAUDE.md to record the new schema location and migration runner command.

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

---

## Session R5 — Real Auth and Workspace Bootstrap

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R5 — Real Auth and Workspace Bootstrap.

Goal:
Replace the placeholder login page with a real Supabase Auth flow and ensure every authenticated user has a profile, a default workspace, and an owner membership row.

Scope:
- Pages: src/app/(auth)/login/page.tsx (real form with email+password), signup/page.tsx, reset/page.tsx, confirm/page.tsx, unauthorized/page.tsx.
- Server actions for login, signup, logout, requestPasswordReset, completePasswordReset using src/lib/supabase/server.ts and src/lib/env.ts.
- src/middleware.ts protects /dashboard, /workbook/[id], /forms/[id]/edit. Public: /, /(auth)/*, /forms/[slug] (public submission), /s/[token].
- Database trigger via migration 0007_auth_bootstrap.sql: AFTER INSERT ON auth.users → create profile row, default workspace, workspace_members(role=owner). Idempotent.
- Replace dashboard localStorage workbook list with TanStack Query reading workbooks via Supabase.
- Add a QueryClientProvider in src/app/providers.tsx wrapping children.
- Tests: Vitest unit for server actions (mocked Supabase); Playwright E2E "signup → land on /dashboard with empty workbook list".

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

---

## Session R6 — Server-Side Workbook Persistence

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R6 — Server-Side Workbook Persistence.

Goal:
Stop using localStorage as the primary workbook store. All cell, sheet, scratchpad, conditional-formatting, and version data must persist through Supabase.

Scope:
- Create server actions in src/app/api/workbooks/ and src/app/api/sheets/: createWorkbook, renameWorkbook, deleteWorkbook, addSheet, renameSheet, reorderSheets, deleteSheet, upsertCells (batch).
- Wire SpreadsheetEngineAdapter.onCellChange into a debounced (500ms) batched upsertCells call. Show save status: saving, saved, error, offline.
- Move scratchpad storage to a server action that reads/writes scratchpads(workbook_id, user_id, content); keep localStorage only as offline cache, synced on reconnect.
- Move conditional-formatting rules: add migration 0008_cf_rules.sql defining conditional_format_rules(id, workbook_id, sheet_id, range_ref, rule_json, created_by, created_at) with editor-RLS; rewrite cfStore to read/write through TanStack Query.
- Add workbook snapshot endpoint POST /api/workbooks/:id/versions writing to workbook_versions; restore endpoint POST /api/workbooks/:id/versions/:vid/restore writing a new version + audit_logs entry.
- Update src/features/cell-history/services/historyService.ts to use the normalized sheet_id (uuid) from the new cells table.
- Replace dashboard localStorage list with the server-action TanStack Query path created in R5; remove or archive any legacy-prefixed localStorage code that is now dead.
- Add Playwright E2E: edit a cell → reload page → cell persists; delete browser localStorage → cell still present.

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

---

## Session R7 — RBAC and Share Dialog

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R7 — RBAC and Share Dialog.

Goal:
Implement workbook-level role-based access control with owner/editor/viewer and a Share dialog UI, gated by Supabase RLS and a server-side permission service.

Scope:
- Create src/lib/permissions.ts: assertCanRead, assertCanEdit, assertCanManage, getRole(workbookId, userId). Every server action must call one of these before any DB mutation.
- Server actions in src/app/api/workbooks/[id]/members/: invite (by email), updateRole, removeMember. Look up users by email via profiles; if not found, store pending invite row.
- UI src/features/collaboration/components/ShareDialog.tsx: invite input, role select, member list with role + remove. Triggered from a Share button in the workbook header.
- All role changes append audit_logs(action='member.*').
- Viewer UI: editor toolbar buttons disabled, formula bar read-only, AI preview can compute but Apply button hidden.
- Tests: Vitest for permissions service; Playwright E2E "owner shares as editor → second user can edit; owner shares as viewer → second user cannot edit".

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

---

## Session R8 — Presence and Broadcast Collaboration

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R8 — Presence and Broadcast Collaboration.

Goal:
Add lightweight realtime collaboration using Supabase Presence and Broadcast, plus a feature-flag boundary for future Yjs/Univer Pro CRDT upgrade.

Scope:
- src/features/collaboration/hooks/usePresence.ts: subscribes to a Supabase channel keyed by workbook_id, tracks {user_id, display_name, avatar_url, color}, emits a presence list to the workbook header avatar stack.
- src/features/collaboration/hooks/useBroadcast.ts: publishes/consumes cursor + selection events; throttled to 30Hz.
- src/features/collaboration/components/AvatarStack.tsx: shows up to 5 avatars + overflow chip.
- src/features/collaboration/components/RemoteCursors.tsx: renders other users' selections as colored outlines on the grid via SpreadsheetEngineAdapter overlay API; if the adapter does not yet support overlays, add a getOverlayContainer method to the adapter interface and implement in FortuneSheetAdapter only.
- Feature flag NEXT_PUBLIC_REALTIME_CRDT: when true, dynamically import a stub src/features/collaboration/crdt/YjsEngine.ts that exposes start/stop/applyUpdate (no-ops). Do not implement Yjs logic in this session.
- Tests: Vitest unit for the presence reducer; Playwright E2E "two browser contexts on same workbook → both avatars appear; cursor moves visible across".

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

---

## Session R9 — Forms From Sheet

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R9 — Forms From Sheet.

Goal:
Let users generate a public or internal form from a sheet's columns, capture submissions, and append them as new rows.

Scope:
- src/features/forms/utils/formBuilder.ts: derive default fields from a sheet's column intents (text, number, email, date, select, currency, status).
- src/features/forms/components/FormBuilder.tsx: step UI to pick source sheet, edit field labels/required/help, choose public vs internal, generate slug, save form.
- Server actions in src/app/api/forms/: createForm, updateForm, deleteForm, listForms, submitForm (public route).
- Public submission page src/app/forms/[slug]/page.tsx with a simple, branded form; shows success message; prevents bot spam via a basic honeypot field.
- Submission inserts a new row into the linked sheet via server action that calls SpreadsheetEngineAdapter (or the persistence service from R6) and writes to form_submissions for audit.
- Internal forms: gated by middleware against workbook_members.
- Tests: Vitest for formBuilder mapping; Playwright E2E "create form from a sheet → submit anonymously → new row appears".

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

---

## Session R10 — Automations and Provider Interfaces

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R10 — Automations and Provider Interfaces.

Goal:
Implement row-level triggers (created/updated/status changed) and a pluggable provider system for actions: Email, WhatsApp, Slack, Teams, Task. Use mock providers when credentials are missing.

Scope:
- src/features/automation/types.ts: TriggerType, ActionType, AutomationConfig, TriggerEvent, ActionResult.
- src/features/automation/triggers/: dispatcher hooked into the cell-save pipeline from R6. On every persisted change, evaluate enabled automations and fire actions.
- src/features/automation/providers/: EmailProvider, WhatsAppProvider, SlackProvider, TeamsProvider, TaskProvider, MockProvider. Each implements Provider.send(config, payload) and returns { ok, runId, error? }. Real providers gated on env vars; otherwise fall back to MockProvider with a console + DB run log entry.
- src/features/automation/components/AutomationBuilder.tsx: form to pick trigger, configure conditions, pick action + provider, test send, save.
- src/features/automation/components/AutomationRunsPanel.tsx: list automation_runs with status, retry button, error message.
- Server actions in src/app/api/automations/: createAutomation, updateAutomation, deleteAutomation, listRuns, retryRun.
- Tests: Vitest for the dispatcher (status_changed predicate, idempotency); Vitest for MockProvider; Playwright E2E "set automation on column 'Status' = Overdue → edit cell → run logged in panel".

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

---

## Session R11 — Comments, Mentions, Protected Ranges, Share Links

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R11 — Comments, Mentions, Protected Ranges, Share Links.

Goal:
Close the P1 collaboration controls described in docs/01_PRODUCT_REQUIREMENTS.md and docs/08_SESSION_ROADMAP.md session 17.

Scope:
- src/features/comments/: CommentThread component anchored to a cell, resolve toggle, delete, edit. @mention autocomplete sourced from workbook_members. Server actions create/update/delete/list. Stores mentioned_user_ids on the row. Send a notification audit entry.
- src/features/protected-ranges/: range editor UI accessible from the toolbar; allowed_user_ids and allowed_roles config; server-side enforcement: upsertCells validates range against protected_ranges and returns 403 for unauthorized writers.
- src/features/share-links/: dialog to create a share link with role and expiry; public page src/app/s/[token]/page.tsx mounts a read-only or editor view depending on the link's role; expired/inactive links redirect to /unauthorized.
- All operations append to audit_logs.
- Tests: Vitest unit for the protected-range guard; Playwright E2E for "comment + mention → mentioned user sees notification" and "expired share link blocks access".

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

---

## Session R12 — Charts From Range and Workbook Version Restore UI

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R12 — Charts From Range and Workbook Version Restore UI.

Goal:
Implement bar/line/pie charts built from a selected range and a UI for restoring workbook versions captured in R6.

Scope:
- src/features/charts/: ChartBuilder dialog (pick chart type, range, axis labels, legend), ChartRenderer (ECharts), ChartList per workbook. Persist to the charts table.
- Charts render inline on a sheet at a stored anchor cell with movable/resizable behaviour through SpreadsheetEngineAdapter overlay APIs.
- src/features/version-history/: VersionHistoryPanel listing workbook_versions, with preview, restore, and label edit.
- Restore action: POST /api/workbooks/:id/versions/:vid/restore creates a new version (so restore itself is undoable) and applies via the persistence path from R6.
- Tests: Vitest for chart config to ECharts option mapping; Playwright E2E "select range → create bar chart → reload → chart still renders" and "edit cell → snapshot version → restore → cell value reverts".

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

---

## Session R13 — P2 Feature-Flagged Platform Prototypes

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R13 — P2 Feature-Flagged Platform Prototypes.

Goal:
Add prototypes of pivot tables, dashboards, macros, connectors, row-level security, and forecasting/anomaly agent. All gated behind feature flags and OFF in production.

Scope:
- Pivot: src/features/pivot/ with simple group-by + aggregate UI (sum/avg/count/min/max). Persist to pivot_tables. Flag NEXT_PUBLIC_FF_PIVOT.
- Dashboards: src/features/dashboards/ with a layout grid (react-grid-layout if needed), KPI widget, chart embed via R12. Persist to dashboards. Flag NEXT_PUBLIC_FF_DASHBOARDS.
- Macros: src/features/macros/ with a Web Worker boundary that accepts a script string and returns no-op success; do not execute arbitrary code in this session. Flag NEXT_PUBLIC_FF_MACROS.
- Connectors: src/features/connectors/ defining Connector interface { name, configSchema, fetch(config) }; ship a MockConnector returning fixture rows; mapping UI imports rows into a sheet. Flag NEXT_PUBLIC_FF_CONNECTORS.
- Row-level visibility: src/features/row-rls/ allowing rules like "viewer sees only rows where Owner = current user". Stored in a new table row_visibility_rules and enforced in upsertCells/listCells server actions. Flag NEXT_PUBLIC_FF_ROW_RLS.
- Forecasting/anomaly: server route src/app/api/ai/forecast/route.ts that accepts a numeric series and returns { forecast, confidence, anomalies } via Groq + deterministic fallback. Preview UI in src/features/forecast/. Flag NEXT_PUBLIC_FF_FORECAST.
- Update src/lib/env.ts with all six flags. Flags default false in production.
- Tests: Vitest for pivot aggregator math and forecast deterministic fallback; one Playwright smoke per flag enabled in test env.

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

---

## Session R14 — Final QA, Security Hardening, Performance, Deployment

### Paste this prompt into Codex

```txt
You are working in the Quiksheets repository.

Read AGENTS.md first.
Read all relevant files in /docs before editing.

Task: Session R14 — Final QA, Security Hardening, Performance, Deployment.

Goal:
Ship Quiksheets to production with all P0 and P1 acceptance tests green, security review complete, and performance pass merged.

Scope:
- Playwright E2E coverage for every workflow listed in docs/05_TESTING_AND_QUALITY_GATES.md §4 (15 flows). Add CI workflow .github/workflows/ci.yml running typecheck, lint, vitest, build, and Playwright on PRs.
- Security pass:
  - Verify RLS policies for every table by running tests/rls/* against staging.
  - CSV/XLSX import: sanitize cell values starting with =, +, -, @, |, %, 0x by prefixing with apostrophe in import path; covered by a Vitest test with malicious fixtures.
  - Validate every server action input with Zod; reject unexpected fields.
  - Confirm SUPABASE_SERVICE_ROLE_KEY and GROQ_API_KEY are never imported from client modules; add an ESLint rule banning these env reads outside src/lib/env.ts and src/lib/supabase/server.ts.
  - Add rate limiting (token bucket via Supabase edge function or in-memory for single instance) on all /api/ai/* routes.
- Performance:
  - Convert DependencyMap, ColumnDNAPanel, ConditionalFormatting modal, AICellPrompt, RowSummarizer to next/dynamic with ssr:false.
  - Add React.memo on hot grid sub-components; memoize CF evaluation; ensure heavy hooks unsubscribe on unmount.
  - Add route-level loading.tsx for /dashboard and /workbook/[id].
- Deployment:
  - Update vercel.json with edge/region settings.
  - Document the production checklist in docs/DEPLOYMENT.md: env var list, Supabase project linking, migration runner, Playwright smoke after deploy, rollback note.
  - Verify a real Vercel production deploy succeeds; replace the legacy CLAUDE.md note about pending Vercel auth.
- Update CLAUDE.md and SESSION_TRACKER.md to reflect the final state.

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
- npm run test:e2e

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
