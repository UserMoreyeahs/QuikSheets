# Quiksheets — Architecture Review & Staged Refactor Plan

> **Status:** Plan only. No production behavior is changed by this document.
> Every recommendation below is **behavior-preserving** and gated on the existing
> test suite (547 unit + e2e in real Chromium). Sequenced so each stage ships
> independently and can be reverted in isolation.
>
> **Author:** senior-architecture audit pass (4 parallel deep-dives:
> data layer · state · components · performance), June 2026.
> **Scope:** `src/` (64,115 LOC; 76% in `features/`).
>
> **Validation note:** all findings below were re-checked against the **live
> `develop` branch** (the deployed tree). The audit's broad sweep also touched a
> stale local worktree (57 commits behind), which produced two findings that are
> **already resolved on `develop`** — they are struck through and retained for
> transparency: *(a)* the `FormattingToolbar`/`QuickToolbar` dead code was already
> removed; *(b)* `ImportModal`/`xlsx` is already `dynamic()`-split. Every P0 and
> the remaining P1/P2 items are confirmed present on `develop`.

---

## 0. Executive summary

Quiksheets is a feature-rich Excel replica (Next.js 15 App Router, FortuneSheet
grid, HyperFormula, Supabase, 41 Zustand stores, ~300 feature files). It is
**functionally broad and, in several places, genuinely well-engineered** — the
cold-start/bundle story (aggressive `dynamic()` splitting), the HyperFormula
live-preview path, the hand-rolled `ChartRenderer` lifecycle, and the
optimistic-concurrency save path are all above-average work. The problems are
**not** "it's all bad"; they are a handful of **systemic, high-leverage issues**
that explain most of the bugs seen this cycle (silent localStorage fallbacks,
cross-workbook state leaks, type-flicker) and that cap scalability.

**The five things that matter most:**

| # | Issue | Why it's the root of multiple symptoms | Sev |
|---|---|---|---|
| 1 | **Schema drift** — no committed SQL reproduces the live DB | The forms & dashboards "silently localStorage-only" bugs were *this*. The repo cannot rebuild prod. | **P0** |
| 2 | **No reset-on-workbook-switch** for ~7 stores; mount-load hooks have empty deps | Opening workbook B can show A's filters/undo/watches/print-settings and may not load B's cells. The charts-leak we already fixed is one instance of a general class. | **P0** |
| 3 | **Per-keystroke O(workbook) work** — 4× full clone + 3× full `JSON.stringify` + full-matrix diff, then the whole blob re-serialized for autosave | Sets the data-volume ceiling (~10–20k cells smooth; lag by 50k). The "type-flicker" history lives here. | **P0 (scale)** |
| 4 | **Persistence boilerplate** — 11 near-identical `*Api.ts` modules (54 `getBrowserSupabase()` calls, 76 fallback branches) with **silent `catch {}`** | ~700–800 LOC of duplication and, worse, every failure is an *invisible* downgrade to localStorage — the mechanism that hid #1. | **P1** |
| 5 | **God-modules** — sheet page (1514), `sheetStore` (1132), `SpreadsheetGrid` (1128), ribbon `OtherTabs` (1098) + a 62-field prop-drilled handler object | Maintainability tax on every change; couples unrelated concerns into single 1000+ LOC files. | **P1** |

**Headline posture:** the architecture is salvageable without a rewrite. The plan
is a sequence of small, reversible refactors that (a) make failures *observable*,
(b) make workbook-scoped state *leak-proof by construction*, (c) collapse the
per-keystroke cost, and (d) decompose the four god-modules — each behind the
existing green test gate.

---

## 1. Reverse-engineered current architecture

### 1.1 Layers (as-built)

```
┌───────────────────────────────────────────────────────────────────────┐
│  Next.js App Router (ALL 'use client' — no Server Components in use)    │
│                                                                         │
│  app/sheet/[id]/page.tsx  ◄── GOD ORCHESTRATOR (1515 LOC)               │
│   • 44 dynamic() imports   • 42 <ErrorBoundary>   • 19 store subs       │
│   • ~16 useXxxOnMount hooks • ~44 dialogs rendered inline               │
│   • handleImport(137) handleDedupe(68) export plumbing, cmd palette     │
│        │                                                                │
│        ├── Ribbon ──► 9 tab components (OtherTabs 1098, HomeTab 503…)   │
│        │     ▲ 62-field RibbonHandlers object prop-drilled down         │
│        │                                                                │
│        ├── SpreadsheetGrid (1128) ──► FortuneSheet (dynamic, ssr:false) │
│        │     • 6-ref bidirectional store↔grid sync machine             │
│        │     • handleChange(139) — automation trigger embedded inside   │
│        │     • hover/dependency/CF/chart/image/overlay layers           │
│        │                                                                │
│        └── ~44 dialogs / panels (mostly dynamic-imported)               │
│                                                                         │
├───────────────────────────────────────────────────────────────────────┤
│  STATE — 41 Zustand stores (global module singletons)                   │
│   • sheetStore (1132): grid data + selection + formatting + sort/filter │
│        + find/replace + validation + undo/redo + save flags (god-store) │
│   • workbookStore (205): sheet-tab metadata                             │
│   • 6 viz stores (charts/pivot/sparkline/slicer/image/overlay)          │
│   • 7 workbook-config stores (cf/columnTypes/namedRanges/rowRls/        │
│        dashboard/connectors/automation)                                 │
│   • 3 workbook-scoped, NO reset (watchWindow/advancedFilter/outline)    │
│   • 19 feature-UI (modal open/close) + 2 session (presence/theme)       │
├───────────────────────────────────────────────────────────────────────┤
│  PERSISTENCE — 11 *Api.ts (Supabase-first + localStorage fallback)      │
│   • Each re-implements the same 5-step dance (54 getBrowserSupabase())  │
│   • cell data: saveService → POST /api/sheet → sheetApi (own path)      │
│   • viz objects: workbookExtras → workbook_extras (own path)            │
│   • 3 different session-resolution styles; 3 different migration-flag    │
│        conventions; only 1 module UUID-gates                            │
├───────────────────────────────────────────────────────────────────────┤
│  DATA — Supabase Postgres + RLS (SECURITY DEFINER helpers, post-0008)   │
│   • LIVE schema ≠ any committed SQL (4 competing/stale artifacts)       │
└───────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core data flow (cell edit → persisted)

```
keystroke ─► FortuneSheet onChange
  └► SpreadsheetGrid.handleChange  [clone #1 + 2× JSON.stringify equality + full-matrix history diff
                                    + embedded automation trigger firing]
       └► sheetStore.setGridSheets  [clone #2]   (no longer bumps hydrationVersion — type-flicker fix)
            └► sync effect           [clone #3 + stringify]   (push store → grid; echo-guarded)
       └► SaveStatus(workbookData=gridSheets)
            └► debouncedSave(2s) ─► JSON.stringify(full workbook) ─► POST /api/sheet
                 └► sheetApi.saveWorkbookRecord  [owner conditional-update on updated_at → 409 guard
                                                  → service-role editor fallback]
```

Bulk ops (import, template, paste-table, dedupe, CF re-apply, undo-bulk,
forecast, collab, version-restore, text-to-columns, typed-columns) go through
`replaceGridSheets`, which **does** bump `hydrationVersion` → **remounts the
entire FortuneSheet** via `key={workbookStructureKey}`.

### 1.3 What's already good (do **not** "fix" these)

- **Bundle/code-split**: FortuneSheet + ~40 heavy panels (`@xyflow/react`, all
  ECharts layers, jsPDF, `xlsx-js-style` export, pivots, forms) are
  `dynamic()`-split correctly.
- **HyperFormula**: singleton, *not* rebuilt per eval; live-preview builds a
  **minimal referenced-cells matrix**, 150ms debounce, destroys after. Exemplary.
- **`ChartRenderer`**: correct init/setOption/dispose; strips non-serializable refs.
- **Formula-explainer**: client LRU (200), 800ms debounce, AbortController.
- **`useGridScroll`**: single rAF-throttled listener via `useSyncExternalStore`.
- **Save 409 path** (`sheetApi`): optimistic concurrency is carefully built — leave it.
- **RLS recursion**: fixed via SECURITY DEFINER helpers (0008–0010). Solid.

---

## 2. Consolidated findings (deduplicated, prioritized)

> Severity: **P0** = correctness / can't-rebuild-prod / scale cliff · **P1** = real
> risk or large maintainability tax · **P2** = polish. Effort S/M/L. All fixes are
> behavior-preserving unless explicitly flagged.

### P0 — address first

**P0-A · Schema drift: no committed SQL reproduces production**
*Data layer.* Four competing artifacts (`schema.sql`, `migrations/0001-0007`,
`migrations.consolidated.sql` (truncated), `docs/setup/quiksheets-v2-schema.sql`)
and **none** matches the code: the "canonical" file *drops* `workbooks.data`
(but `sheetApi` reads/writes it), says `forms.fields_json`/`is_public` (code uses
`fields`/`accepts_submissions`/`description`), `comments.mentioned_user_ids` (code
uses `mentions`/`author_display_name`/`parent_id`), `share_links.is_active` (code
uses `active`), and **omits 8 tables the code requires** (`column_types`,
`conditional_format_rules`, `row_visibility_rules`, `workbook_extras`,
`connector_connections`, `notifications`, …). No migration ledger; `apply-migration.js`
applies one blob and records nothing. **A fresh project built from the repo cannot
save a single cell.** This is the mechanism behind the forms/dashboards silent
breakage. *Fix:* regenerate one canonical `schema.sql` from the live DB
(`supabase db pull` / `pg_dump --schema-only`), delete the 3 stale artifacts, add
a `supabase db diff` CI drift-check, adopt the migration ledger. **Effort M · Risk
high (process change, not code) · does not touch the live DB.**

**P0-B · Workbook-scoped state leaks across workbook switches**
*State.* Navigating `/sheet/A → /sheet/B` is a client-side `router.push`
(`WorkbookSidebar.tsx:113,134`) on the *same* route segment → the page does **not**
remount → all 41 module-singleton stores survive. The **only** reset anywhere is
`applyWorkbookExtras(null)` (the charts fix). So `watchWindow`, `advancedFilter`
(keyed by sheetId → collides across workbooks that share `sheet1`), `outline`,
`printSettings`, `theme`, and `sheetStore`'s undo/filters/validation **leak A→B**.
`sheetStore.reset()`, `outlineStore.reset()`, `printSettings.reset()` exist but are
**never called**. *Fix:* a single `resetWorkbookScope()` registry fired on
`workbookId` change before the load hooks (Stage 2). **Effort M · Risk med.**
*(Verify live: open two cloud workbooks, set a filter in A, switch to B.)*

**P0-C · Mount-load hooks have empty deps → don't re-run on switch**
*State.* `useLoadWorkbookDataOnMount.ts:91` (`}, []`) and `useApplyCFOnMount.ts:24`
are mount-once. With no remount on switch (P0-B), **B's saved cells and CF rules
never load** — the grid keeps showing A. Sibling hooks (`useWorkbookExtrasPersistence`,
`useLoadP2FeaturesOnMount`, automations) *are* `[workbookId]`-keyed, so hydration is
inconsistent. *Fix:* after P0-B's reset lands, key these on `[workbookId]`. **Effort
S · Risk med (the pristine-default guard must run after reset).**

**P0-D · Per-keystroke O(workbook) cost (typing-latency cliff)**
*Performance.* One committed edit triggers: `cloneFortuneData` ×3
(`SpreadsheetGrid.tsx:286`, `:246`, `sheetStore.ts:521`) + `JSON.stringify(whole
workbook)` ×2 for an equality check (`:287-288`) + a **full R×C matrix diff** for
history (`:325`), and then (P0-E) the whole blob is re-serialized for autosave. At
the 100×26 default this is invisible; at ~50k cells it's multi-MB on the main
thread per keystroke → input lag. *Fix:* clone once and pass ownership; replace the
stringify-equality with a cheap dirty/ref check; derive history from FortuneSheet's
own change delta instead of a full-matrix walk. **Effort M (per item) · Risk med
(handleChange has delicate hydration/echo guards — gate on the 132 grid tests +
manual type-without-flicker).**

**P0-E · Autosave re-serializes & re-uploads the entire workbook every save**
*Performance/network.* `SaveStatus` passes raw `gridSheets` (new ref each keystroke)
→ `debouncedSave` → `JSON.stringify(full workbook)` → POST. No diffing; payload
scales with workbook size. *Fix (min):* skip the POST when the serialized payload is
byte-identical to the last successful save; serialize once (shared with P0-D).
*Fix (later):* cell-delta patch protocol. **Effort S (skip-if-unchanged) · Risk low.**

### P1 — high value

**P1-A · Persistence boilerplate + silent failures**
*Data layer.* The 5-step Supabase-first/localStorage dance is copy-pasted across 11
modules (`readLocal`/`writeLocal`/`clearLocal` re-declared even though
`makeLocalStore` exists). Worse: **7 bare `catch {}` in `formsApi.ts`** (`:202,224,
252,307,345,371,429`, no logger anywhere in the file) and the uniform
`if (error || !data) return readLocal(...)` conflate "schema mismatch" / "RLS deny"
/ "offline" into one **invisible** downgrade — the exact thing that hid P0-A.
*Fix:* (1) make every fallback observable with `logger.warn` (Stage 1 — tiny, do it
first); (2) extract `createSupabaseResource<TDomain,TRow>(config)` and collapse the 5
collection modules (cf/rowRls/dashboards/columnTypes/connectors) onto it (~700–800
LOC removed, one place to own fallback semantics). **Effort S then L · Risk
low/med.**

**P1-B · Inconsistent persistence primitives**
*Data layer.* Session resolution split 3 ways (`getClientSession` ×8 / inline
`auth.getSession()` in connectors / inline `auth.getUser()` in forms+sheetApi —
a real semantic difference: validated vs not); migration flags done 3 ways
(`createMigrationFlag` vs hand-rolled string sentinels); **only `workbookExtras`
UUID-gates** so every other module fires doomed queries for local workbooks. *Fix:*
route all through `getClientSession` + `createMigrationFlag`; decide the UUID-gate
policy once (folds into P1-A's factory for free). **Effort M · Risk low.**

**P1-C · `sheetStore` god-store (1132 LOC, 11 responsibilities)**
*State.* Grid data + grid-instance handle + legacy `workbook` model + selection +
undo/redo + formatting (~250 LOC) + sort + filter (basic/advanced/outline, ~200) +
find/replace + validation + save flags. *Fix:* convert to the **Zustand slices
pattern** (the existing `formattingStore`/`filterSortStore` wrappers already
foreshadow the end state) — split the *creator* into slices but keep the single
`useSheetStore` hook so all ~30 consumers stay byte-identical. **Effort L · Risk med.**

**P1-D · Orphan `workbook` model + inert undo/redo (~150 dead LOC)**
*State.* `updateCell`/`undo`/`redo` (`sheetStore.ts:573-651`) mutate
`workbook.sheets[].cells` — a model **separate** from `gridSheets` (the real source
of truth). `workbook` is never populated on the live path, so undo/redo early-return
and FortuneSheet's own undo does the real work. ~150 LOC of misleading state. *Fix:*
confirm inert via cell-history tests, then quarantine + remove. **Effort M · Risk
high (touches undo semantics — needs the history tests as a guard).**

**P1-E · 9 components subscribe to the entire `sheetStore` (re-render storm)**
*State/perf.* `SpreadsheetGrid.tsx:101-115` (12 fields, no selector), plus
`FormattingToolbar`*, `QuickToolbar`*, `HomeTab:105`, `AppMenuBar:28`,
`FindReplace:9`, `CleanDataPanel:77`, `ForecastPanel:100`, `TextToColumnsDialog:64`.
Each re-renders on **every** keystroke (undo push, formatting, findResults, isSaving…).
The page itself already uses `useShallow` (`page.tsx:353-370`) — pattern is known,
just not applied here. *Fix:* wrap each in `useShallow((s)=>({…usedFields}))`.
Mechanical. **Effort M (9 sites) · Risk low.** *(\* two of these are dead — see P1-G.)*

**P1-F · Sheet page god-orchestrator (1515 LOC) + 62-field prop-drilled ribbon**
*Components.* The page mounts ~16 `useXxxOnMount` hooks, 19 store subs, 42
ErrorBoundaries, ~44 inline dialogs, a 137-LOC `handleImport`, a 68-LOC
`handleDedupe`, and the command palette. `RibbonHandlers` is a **62-field** object
(48 `onXxx?`) drilled page → `Ribbon` → 9 tabs; `OtherTabs.tsx` (1098) packs 8 tabs
with 38 inline `getState()` calls. *Fix:* decompose into `<WorkbookProviders>`
(mount hooks), `<WorkbookHeader>`, `<WorkbookModals>` (dialog registry),
`<WorkbookOverlays>`; replace prop-drilling with a **command registry**
(`useRibbonCommand(id)`), collapsing "add a command" from a 3-file change to 1.
**Effort L · Risk med (pure structure; gate on e2e).**

**~~P1-G · ~1082 LOC of dead code~~ — ALREADY RESOLVED on `develop`**
*Components.* The audit (reading a stale worktree) flagged `QuickToolbar.tsx` (527)
and `FormattingToolbar.tsx` (555) as dead. On live `develop` **both files no longer
exist** (removed in a prior commit; `toolbar/index.ts` exports only
`useFormattingShortcuts`; the sole remaining reference is a stale comment at
`SpreadsheetGrid.tsx:1094`). No action needed beyond optionally tidying that comment.

**P1-H · `SpreadsheetGrid` owns 7+ concerns incl. automation trigger-firing**
*Components.* Beyond rendering: the 6-ref store↔grid sync machine, a 139-LOC
`handleChange` with **automation trigger logic embedded**, pointer geometry,
context-menu + 18 handlers, 6 overlay families. *Fix:* extract `useGridStoreSync`,
`useGridChangeRouter` (incl. automation), `useGridContextMenu`, and an overlays
aggregator — behavior-preserving hook extraction. **Effort L · Risk med.**

**P1-I · Grid remount key too broad**
*Performance.* `key={workbookStructureKey}` (`SpreadsheetGrid.tsx:191-194`) includes
sheet `name`/`order`/`hide`, so **rename / reorder / hide-show each tear down and
rebuild the entire canvas** — even though those are already synced imperatively. Plus
all 18 `replaceGridSheets` callers remount. *Fix:* narrow the key to
`hydrationVersion` + the sheet-*id set* (add/remove); drop name/order/hide. **Effort
M · Risk med (verify add/remove still hydrate; gate on sheet-mgmt tests).**

### P2 — polish (opportunistic)

- **P2-A · Three inconsistent persistence patterns** (subscribe-debounce vs
  write-through-in-action vs separate cell/extras paths) — unify the
  "UUID→Supabase else localStorage" branch into one `persistWorkbookResource`
  helper. *Data/state. M.*
- **~~P2-B · `xlsx` static in the /sheet bundle~~ — ALREADY RESOLVED on `develop`.**
  The audit (stale worktree) flagged a static `ImportModal` import. On live
  `develop` `ImportModal` is already `dynamic()`-imported (`page.tsx:70`, with a
  comment noting it pulls in SheetJS), so `xlsx` is already code-split out of the
  initial route bundle. No action needed.
- **P2-C · No `experimental.optimizePackageImports`** in `next.config.mjs` for
  `lucide-react` / `@radix-ui/*` / `framer-motion`. *Bundle. S.*
- **P2-D · Custom-formula validation rebuilds the whole workbook in HF per edit**
  (`validation.ts:118-141`) — mirror live-preview's minimal matrix. *Scale. M.*
- **P2-E · `echarts-for-react` still in `DistributionChart` + `ForecastPanel`** —
  route through `ChartRenderer` (the documented fix). *Perf. M.*
- **P2-F · Chart matrix recomputed every render; drag re-renders all panels**
  (`ChartsLayer.tsx:112,129`) — memoize + ref/transform the drag. *Perf. M.*
- **P2-G · `cellOps.ts` (881) grab-bag** — a `cellOps/` split pattern already
  exists (8 modules + barrel); move the ~12 inline groups to follow it. *Maint. M.*
- **P2-H · `flushPendingSave` network save never lands on unload** (async
  `getAuthContext` can't finish during `pagehide`) — use `navigator.sendBeacon`.
  *Network. S.*
- **P2-I · Module-level counters never reset** (`nextOffset`/`colorIndex` in
  chart/image/overlay/presence) — fold into the P0-B registry. *Cosmetic. S.*
- **P2-J · AI rate limiter is in-memory per serverless instance**
  (`aiRoute.ts:70`) — back with a shared store if Groq cost control matters. *M.*
- **P2-K · Entire app is `'use client'`** — the sheet route and dashboard can be
  thin Server Component shells wrapping client islands. *Larger; opportunistic.*
- **P2-L · Data-volume ceiling ~10–20k cells** (dense in-memory matrix, no sparse
  fallback) — architectural; flag, don't fix in a behavior-preserving pass.

---

## 3. Target ("clean") architecture

### 3.1 Data layer — one repository, one schema source of truth

```ts
// src/lib/persistence/createSupabaseResource.ts
interface SupabaseResourceConfig<TDomain, TRow> {
  table: string
  columns: string                 // exact select() projection (matches live schema)
  scopeColumn: string             // 'workbook_id'
  conflictTarget: string          // upsert onConflict, e.g. 'id'
  localStore: LocalJsonStore<TDomain[]>      // makeLocalStore(...)
  migrationPrefix: string                    // createMigrationFlag(...)
  rowToDomain: (row: TRow) => TDomain
  domainToRow: (d: TDomain, ctx: { userId: string; scopeId: string }) => Record<string, unknown>
  idOf: (d: TDomain) => string
}

function createSupabaseResource<TDomain, TRow>(cfg): {
  load(scopeId): Promise<TDomain[]>
  upsert(scopeId, item): Promise<void>
  remove(scopeId, id): Promise<void>
}
// Owns the 5-step skeleton ONCE: getBrowserSupabase → getClientSession →
// UUID gate → try remote → on (error||!data) logger.warn + readLocal.
```

`dashboardsApi` (~206 LOC) collapses to ~30:

```ts
const repo = createSupabaseResource<Dashboard, DbDashboardRow>({
  table: 'dashboards',
  columns: 'id, workbook_id, name, widgets_json, created_by, created_at, updated_at',
  scopeColumn: 'workbook_id', conflictTarget: 'id',
  localStore: makeLocalStore<Dashboard[]>('quiksheets_dashboards'),
  migrationPrefix: 'quiksheets_dashboards_migrated',
  rowToDomain: rowToDashboard,
  domainToRow: (d, { userId }) => ({ id: d.id, workbook_id: d.workbookId, name: d.name, widgets_json: d.widgets, created_by: userId }),
  idOf: (d) => d.id,
})
export const loadDashboards = (wb: string) => repo.load(wb)
export const saveDashboard  = (wb: string, d: Dashboard) => repo.upsert(wb, d)
export const deleteDashboard = (wb: string, id: string) => repo.remove(wb, id)
```

Schema: **one** `schema.sql` regenerated from the live DB, enforced by
`supabase db diff` in CI, changed only through the tracked migration ledger.

### 3.2 State — leak-proof-by-construction

A single registry, fired on `workbookId` change **before** the load hooks:

```ts
// src/lib/workbookScope.ts
const RESETTERS: Array<() => void> = [
  () => useSheetStore.getState().reset(),
  () => useOutlineStore.getState().reset(),
  () => usePrintSettingsStore.getState().reset(),
  () => useWatchWindowStore.getState().clear(),
  () => useAdvancedFilterStore.setState({ criteriaBySheet: {} }),
  () => applyWorkbookExtras(null),
  () => useDashboardStore.setState({ dashboards: [], activeDashboardId: null }),
  () => useConnectorsStore.setState({ connections: [] }),
  () => useRowRlsStore.setState({ rules: {} }),
  // cf/columnTypes/namedRanges already replace-on-load
]
export function resetWorkbookScope() { RESETTERS.forEach(fn => fn()) }
```
```ts
// runs FIRST, keyed on the id
useEffect(() => { resetWorkbookScope() }, [workbookId])
```
New workbook-scoped stores **register here** — one discoverable list instead of 41
scattered decisions. End-state hardening: `key={workbookId}` on the workspace
subtree (full remount) once FortuneSheet remount cost is verified acceptable.

`sheetStore` becomes slices (data: gridData/formatting/filterSort/findReplace/
validation; ui: selection/save), single hook preserved; the dead `workbook`/undo/redo
slice removed after the history tests confirm it's inert.

### 3.3 Components — orchestrator → composition

```
src/app/sheet/[id]/
  page.tsx                      // thin: params → <WorkbookWorkspace workbookId>
  components/
    WorkbookWorkspace.tsx       // layout; key={workbookId} (end-state)
    WorkbookProviders.tsx       // mounts the ~16 useXxxOnMount hooks (+ reset)
    WorkbookHeader.tsx          // name, save status, share, theme
    WorkbookModals.tsx          // dialog registry (replaces ~44 inline dialogs)
    WorkbookOverlays.tsx        // CF/chart/image/overlay/dependency layers
  hooks/                        // (already exists) the mount hooks
  commands/
    registry.ts                 // id → handler; useRibbonCommand(id)
```

Ribbon tabs consume `useRibbonCommand('home.bold')` instead of receiving 62 props.
`SpreadsheetGrid` keeps only render + the FortuneSheet handle; sync/change-routing/
context-menu/overlays extract to hooks. Dialogs use **one** open-state mechanism
(the modal registry), not the current three.

---

## 4. Staged refactor roadmap

> Each stage is independently shippable, behavior-preserving, and gated on
> **`typecheck` + `eslint --max-warnings 0` + `vitest run` (547) + the e2e grid
> suite**. Stages are ordered by *value ÷ risk*, with hard dependencies noted.

| Stage | Theme | Contains | Depends on | Effort | Risk |
|---|---|---|---|---|---|
| **0** | **Quick wins** | ✅ P2-C `optimizePackageImports` (done); P2-H `sendBeacon` deferred (beacon can't set the auth header — needs body/cookie auth). *P1-G dead-code & P2-B xlsx-split already resolved on `develop`.* | — | S | ~none |
| **1** | **Make failures visible** | ✅ DONE — `logger.warn` on every silent fallback across all 10 persistence modules (formsApi/cfRules/columnTypes/rowRls/dashboards/comments/connectors/shareLinks/versions/notifications); killed the bare `catch {}` in formsApi; captured discarded write-results (incl. the security-adjacent silent share-link revoke). Logging-only, behavior-preserving. | — | S | low |
| **2** | **Stop state leaks** | P0-B `resetWorkbookScope()` registry; P0-C key load hooks on `[workbookId]`; P1-3 demo reset; P2-I counters | 1 (for logs) | M | med |
| **3** | **Kill the re-render storm** | P1-E `useShallow` on the 9 whole-store subscribers | — | M | low |
| **4** | **Collapse typing cost** | P0-D clone-once + cheap dirty check + delta-history; P0-E skip-if-unchanged autosave; P1-I narrow remount key | 3 | M–L | med |
| **5** | **Repository factory** | P1-A(2) `createSupabaseResource`; P1-B unify session/flags/UUID-gate; migrate 5 collection modules | 1 | L | med |
| **6** | **Schema truth** | P0-A regenerate `schema.sql` from live, delete stale artifacts, `db diff` CI, migration ledger | — | M | high* |
| **7** | **Decompose sheetStore** | P1-C slices; P1-D remove orphan `workbook`/undo-redo (after history tests) | 3 | L | med–high |
| **8** | **Decompose components** | P1-F page → providers/header/modals/overlays + command registry; P1-H SpreadsheetGrid hook-extraction; P2-G cellOps split | 2,3 | L | med |
| **9** | **Perf polish** | P2-D minimal-matrix validation; P2-E ChartRenderer migration; P2-F chart memo; P2-J AI limiter; P2-K RSC shells | 4 | M | low–med |

\* Stage 6 is "high risk" only as a *process* change (it does not modify the live
DB or app code); it's the most important for long-term safety and could be pulled
earlier if a fresh-environment rebuild is needed.

**Recommended first sprint:** Stages **0 → 1 → 2 → 3**. They are low-risk, remove
dead weight, make the next silent breakage *impossible to miss*, **eliminate the
cross-workbook leak class** (the highest-impact correctness win), and kill the
keystroke re-render storm — all behind the green gate, no product behavior change.

---

## 5. Verification strategy (per stage)

1. **Static gate:** `npx tsc --noEmit` · `npx eslint src/ tests/ --max-warnings 0`.
2. **Unit gate:** `npx vitest run` — 547 passing must stay 547 (add tests for new
   units: the resource factory, `resetWorkbookScope`, the dirty-check).
3. **Grid gate (real Chromium):** the `10-data-entry` / `11-persistence` e2e —
   the only reliable FortuneSheet verification (headless preview cannot render the
   canvas). Add a `12-workbook-switch` e2e for Stage 2 (set filter in A → switch to
   B → assert no leak + B's data present).
4. **Manual smoke (live, post-deploy):** type-without-flicker; dashboard sync on two
   devices; workbook A→B switch.
5. **Deploy discipline:** work on `develop`; merge `develop → main` to ship; Vercel
   auto-deploys `main`. One stage per PR for clean revert.

---

## 6. Appendix — metrics

- **Total `src`:** 64,115 LOC · `features` 48,845 (301 files) · `lib` 6,347 (38) ·
  `app` 5,420 (41) · `components` 1,734 (20) · `store` 1,469 (5).
- **Stores:** 41 Zustand · only **1** resets on workbook switch.
- **Persistence:** 11 `*Api.ts` · 54 `getBrowserSupabase()` · 76 fallback branches ·
  7 bare `catch {}` in `formsApi` · 1 module UUID-gates.
- **God-files:** page 1515 · sheetStore 1132 · SpreadsheetGrid 1128 · OtherTabs 1098
  · cellOps 881 · PivotBuilder 788.
- **Dead code:** QuickToolbar 527 + FormattingToolbar 555 = 1082 LOC — **already
  removed on `develop`** (present only in the stale audit worktree).
- **Schema artifacts:** 4, none matching the live DB.
- **Data-volume ceiling:** ~10–20k cells smooth · lag ~50k · unusable ~100k+ (one sheet).

---

*End of plan. No code in the application has been modified. Recommended next action:
approve Stage 0–3 for the first sprint, or pick individual findings to action.*
