# CODEBASE_MAP.md — QuikSheets (Excel-Parity Phase 0)

> Produced by Phase 0 of the Excel-Parity Master Prompt. Status verified against the **actual code** (parallel source exploration), not session memory. Legend: **IMPLEMENTED** · **PARTIAL** (works but with a real gap) · **STUB** (placeholder/mock) · **MISSING**.
>
> Last mapped: 2026-06-08. Repo: Next.js 15 App Router · TypeScript strict · Supabase (@supabase/ssr) · @fortune-sheet/react (canvas grid) · HyperFormula + @formulajs/formulajs · ECharts 6 · SheetJS · Zustand · Tailwind.

## Build / Test / Run (verified working)
- Dev server: `npm run dev`
- Production build: `npm run build` (compiles clean; `/sheet/[id]` ≈ 839 kB)
- Unit tests: `npx vitest run` — **622 passing / 55 files** (as of 2026-06-09)
- Typecheck: `npx tsc --noEmit` (note: there is **no** `npm run typecheck` script)
- Lint: `npx eslint src/ --max-warnings 0`
- Deploy: work on `develop`; merge `develop → main` → Vercel auto-deploys `quiksheets-v2`.

---

## Grid Rendering & Virtualization
Location: src/features/grid/components/SpreadsheetGrid.tsx, src/features/grid/hooks/useGridScroll.ts, src/features/grid/hooks/useInlineEditSync.ts, src/lib/fortuneSheet.ts, src/app/sheet/[id]/page.tsx
Status: **IMPLEMENTED**
Notes: Rendering + viewport windowing fully delegated to @fortune-sheet/react (canvas). No custom virtualization layer. SpreadsheetGrid wraps the Workbook, manages selection/editing/clipboard/context-menus and syncs via the FortuneSheet instance API.

## Cell / Data Model & State Management
Location: src/store/sheetStore.ts, src/store/workbookStore.ts, src/lib/fortuneSheet.ts, src/lib/defaultSheet.ts
Status: **IMPLEMENTED**
Notes: Dual-store: `useSheetStore` (grid data, selection, sort/filter/validation/find) + `useWorkbookStore` (sheet tabs). Data held twice — sparse `celldata` + 2-D `data` matrix — which must move in lockstep via `cloneSheetWithData`/`getSheetMatrix`. `hydrationVersion` forces remount only on wholesale replacements (import/template/paste/dedupe), not keystrokes.

## Formula Engine — Parser / Evaluator / Dependency Graph / Recalc
Location: @fortune-sheet/formula-parser (in-grid), src/lib/formulaParserPatches.ts, src/lib/formulajsPatches.ts, src/features/formula/adapters/HyperFormulaAdapter.ts, src/lib/hyperformula.ts, src/features/dependency-map/utils/graphBuilder.ts
Status: **IMPLEMENTED** (recalc path: **PARTIAL**)
Notes: Hybrid engine. FortuneSheet's parser (backed by @formulajs/formulajs) evaluates **in-grid** formulas and self-recalculates on edit. A separate **HyperFormula adapter** powers validation, autocomplete, live-preview and the explainer. Patches add modern Excel fns (XLOOKUP/XMATCH/FILTER/SORT/UNIQUE/SEQUENCE/TEXTJOIN/LET/IFS) and fix bare TRUE/FALSE→#NAME?. **Gap:** `HyperFormulaAdapter.recalculateWorkbook` is orphaned (never called post-edit) — fine because the grid recalcs itself, but the adapter is not the source of truth. `LET` returns a pre-computed value only (true fix needs lazy parser-level eval). `SORT`/`SORTBY` were FIXED in `59594cd` — sort honors sort_index/sort_order/by_col on 2-D ranges, sortby is multi-key (formulajsPatches.ts `sort`/`sortby`, pinned by sortFunctions.spec.ts).

## Cross-Sheet References
Location: src/features/formula-engine/formulaEngine.ts, src/features/live-preview/hooks/useLivePreview.ts, src/features/drag-fill/utils/offsetFormula.ts, src/features/dependency-map/utils/graphBuilder.ts
Status: **IMPLEMENTED**
Notes: `Sheet2!A1` and `'My Sheet'!B5:D20` extracted, range-expanded, evaluated across sheets; sheet prefixes preserved on drag-fill. Quoted names + `$` locks handled.

## Formatting Layer — Styles / Number Formats / Conditional Formatting
Location: src/store/sheetStore.ts (FCellStyle, toFCellStyle, pushFormatToGrid, numberFormatString), src/features/toolbar/**, src/features/ribbon/components/HomeTab.tsx, src/features/conditional-formatting/**
Status: **IMPLEMENTED** (default number formatting: see gap)
Notes: Bold/italic/underline/strike/font/size/color/align/wrap + currency/accounting/percent/date/scientific/custom (e.g. `₹#,##0.00` — NOTE: lakh grouping `#,##,##0` THROWS in FortuneSheet's bundled SSF, never use it; pinned by currencyMask.spec.ts), increase/decrease-decimal. CF supports 13 condition types × {standard, data-bar, color-scale, icon-set} with per-cell style backup. **Gap (Excel parity):** a cell with **no explicit format shows the raw float** (e.g. `3.368421053`) — Excel-standard (value≠format), but QuikSheets never applies a *sensible default* format, which is the source of the "raw float" complaint in Known Defects.

## Charts
Location: src/features/charts/components/ChartRenderer.tsx, src/features/charts/utils/toEChartsOption.ts, src/features/charts/store/chartPanelStore.ts
Status: **IMPLEMENTED**
Notes: 14 kinds via ECharts 6 SVG renderer. `toEChartsOption` is a pure function (unit-tested). **Just fixed (this session):** title/legend/axis/plot now occupy separate regions with `containLabel`/`hideOverlap`/`avoidLabelOverlap` so values stop overlapping. Chart definitions persist only in-session (chartPanelStore) — **not** to DB.

## Persistence & Auto-save
Location: src/lib/saveService.ts, src/app/api/sheet/route.ts, src/lib/sheetApi.ts, src/features/grid/components/SaveStatus.tsx
Status: **IMPLEMENTED**
Notes: Debounced save → Supabase POST `/api/sheet`, localStorage fallback on 401/403/network. Optimistic concurrency via `baseUpdatedAt`; 409 → retry-once self-heal. SaveStatus reflects saved/saving/unsaved/conflict (fixed this session).

## Import / Export — CSV, XLSX, PDF
Location: src/features/grid/utils/importUtils.ts, src/features/grid/utils/exportUtils.ts, src/features/grid/utils/exportUtils/pdf.ts, ImportModal.tsx, ExportMenu.tsx, src/features/grid/utils/sanitizeForExport.ts
Status: **IMPLEMENTED**
Notes: Import keeps fidelity (formulas, number formats, merges, col/row sizes) + 10-row preview. Export (xlsx-js-style) preserves styles/named-ranges/validation/CF; CSV + PDF too. Formula-injection payloads sanitized on export.

## Collaboration & Sharing — roles / auto-save / presence
Location: src/lib/permissions.ts, src/lib/sheetApi.ts, src/features/collab/** (useRealtimeCollab, useWorkbookChannel, presenceStore, RemoteCursors), src/lib/shareLinksApi.ts, src/app/s/[token]/page.tsx
Status: **IMPLEMENTED**
Notes: owner/editor/viewer enforced at save (server) + share-link role; **real-time presence** via Supabase Realtime broadcast (remote cursors + avatar strip, stale-pruned at 30s), not just auto-save. Share-by-link with expiry/active flags.

## Schema / Typed Columns
Location: src/features/typed-columns/**, src/lib/columnTypesApi.ts, src/features/intent-columns/**
Status: **IMPLEMENTED**
Notes: 7 types (text/number/currency/date/select/checkbox/status) + validation; Supabase + localStorage; header→type intent detection.

## Templates
Location: src/lib/templates/index.ts
Status: **IMPLEMENTED**
Notes: 8 starter templates (Sales/Budget/HR/Project/Invoice/Content/OKR/Personal) with headers, sample data, formulas, colored status cells.

## Forms (submission → row)
Location: src/features/forms/**, src/app/form/[id]/page.tsx, src/app/forms/[slug]/page.tsx
Status: **IMPLEMENTED**
Notes: Two routes — localStorage-backed `/form/[id]` and Supabase-backed `/forms/[slug]`. Submissions insert to `form_submissions` (anon RLS when accepting). FormBuilder is editor-only; **no public form-creation UI**.

## Automation / Triggers / Actions
Location: src/features/automation/**, src/app/api/automation/dispatch/route.ts
Status: **IMPLEMENTED** (task action: **STUB**)
Notes: Triggers row_created/row_updated/status_changed → actions email (Resend) / WhatsApp (Twilio) / Slack / Teams (webhooks), `{{column}}` templating, runs logged, per-user rate limit. Providers fall back to **MockProvider** when env unset. **`task` action is mock-only** (no internal task store).

## Comments + @mentions
Location: src/features/comments/**, src/lib/commentsApi.ts, src/lib/notificationsApi.ts
Status: **IMPLEMENTED**
Notes: Cell-anchored comments, `@mention` parse → resolve via workbook_members→profiles → `notifications` rows; audit-logged; thread replies via parentId. Supabase + localStorage.

## AI Copilot (NL→formula, explain, clean, summarize, paste, filter, flash-fill)
Location: src/app/api/ai/** , src/features/ai-cell/**, src/features/row-summarizer/**, src/features/smart-paste/**, src/lib/groq.ts
Status: **IMPLEMENTED** (needs `GROQ_API_KEY`)
Notes: 7 Groq endpoints (model llama-3.3-70b). Without the key: `/api/ai/explain` and `/api/ai/summarize` serve deterministic fallbacks at 200, and the formula route's simple column-addition template runs pre-guard (offlineFallbacks.spec.ts); the remaining AI routes return 503 (forecast is deterministic, no key needed).

## Version History & Audit
Location: src/features/version-history/storage/localVersionStore.ts, src/lib/versionsApi.ts, src/features/cell-history/services/historyService.ts
Status: **IMPLEMENTED** (cell-level restore: **STUB**)
Notes: Workbook snapshots (≤30, oldest pruned) snapshot/restore with a pre-restore safety snapshot — works. **Cell-level `restoreCell` returns null** (legacy; pending schema migration); non-UUID sheet IDs skip cell logging.

## Pivot Tables
Location: src/features/pivot/pivotAggregator.ts, src/features/pivot/store/**, src/features/pivot/utils/recommendPivots.ts
Status: **IMPLEMENTED** (flag `NEXT_PUBLIC_FF_PIVOT`)
Notes: rows/cols/values/filters + sum/avg/count/min/max + calculated fields; recommended-pivots analyzer.

## Analytics / Dashboards
Location: src/features/dashboards/store/dashboardStore.ts, src/features/dashboards/types.ts
Status: **PARTIAL** (flag `NEXT_PUBLIC_FF_DASHBOARDS`)
Notes: Dashboard/widget CRUD + drag-layout, Supabase-persisted. **Shell only** — no pre-built KPI/metric widget library; widget content is caller-defined.

## External Connectors
Location: src/app/api/data/fetch/route.ts, src/app/api/data/connectors/postgres/route.ts, src/features/connectors/connectors/** (csvUrl, jsonUrl, googleSheetsPublic, postgres, restApi)
Status: **IMPLEMENTED** (flag `NEXT_PUBLIC_FF_CONNECTORS`)
Notes: CSV/JSON/REST/Google-Sheets-public fetch via SSRF-guarded proxy (5 MB / 8 s cap). Postgres proxy runs READ-ONLY, caps 10k rows, encrypts conn string — but **requires the `pg` package + `POSTGRES_CONNECTOR_ENABLED=true`** (503 otherwise).

## Row-Level Security
Location: src/features/row-rls/**, src/lib/rowRlsApi.ts
Status: **IMPLEMENTED — client-side only** (flag `NEXT_PUBLIC_FF_ROW_RLS`)
Notes: Predicate rules filter rows in the client after fetch. **Not a server-side data-access control** — suitable for UI filtering, not security isolation.

## Forecasting & Anomaly
Location: src/app/api/ai/forecast/route.ts, src/features/forecasting/store/forecastStore.ts, src/features/column-dna/**
Status: **IMPLEMENTED** (flag `NEXT_PUBLIC_FF_FORECAST`)
Notes: Deterministic linear-regression forecast + confidence + >2σ anomalies (no LLM). Column-DNA does client-side IQR outlier/mixed-type detection.

---

## Architecture summary
- **Rendering:** FortuneSheet owns the canvas grid + in-grid formula evaluation. Everything custom (toolbar, ribbon, formula bar, sheet tabs, charts, panels) is React/Zustand layered around it.
- **State:** Zustand — `sheetStore` (grid/data/format/sort/filter) + `workbookStore` (tabs) + many feature-scoped stores. Grid data lives in `sheetStore.gridSheets` so toolbar/sort/filter/CF can all read/write real cells.
- **Persistence:** Supabase Postgres via `/api/sheet`, optimistic concurrency, localStorage fallback. Application code (not RLS) is the access-truth (owner fast-path + service-role membership check).
- **AI:** Groq (free) behind `/api/ai/*` with deterministic fallbacks where feasible.
- **Feature flags:** advanced P2 (pivot/dashboards/connectors/row-rls/forecast) gated behind `NEXT_PUBLIC_FF_*`.

## Gap list (what to watch for Excel parity)
1. **No default number formatting** — raw floats show until a format is applied (Known-Defect #2 root). *Excel applies sensible defaults; QuikSheets does not.*
2. **Cell-level history restore is a stub** (workbook-version restore works).
3. **Automation `task` action is mock-only.**
4. **Dashboards lack a prebuilt widget library** (shell).
5. **Row-Level Security is client-side only** (not server-enforced).
6. **HyperFormula `recalculateWorkbook` orphaned** (grid self-recalcs; adapter not source of truth).
7. **`LET` / multi-key `SORT`/`SORTBY`** are simplified.
8. **Postgres connector needs `pg` + env flag.**
9. **Chart definitions don't persist to DB** (in-session only).

## Phase-0 gate
✅ Every MVP subsystem in the prompt's template is located and status-marked above → **Phase 3 (test→compare→fix) is unblocked.** Nothing is MISSING; the realistic parity work is the **Gap list** + the **Known Defects** below, not green-field building.
