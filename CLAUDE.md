# Quiksheets — AI Session State

> Renamed from SheetForge during R1 of `docs/REMEDIATION_CODEX_PROMPTS.md`. The legacy session notes below still describe what is on disk; new work follows the Quiksheets target stack documented in `AGENTS.md` and `docs/02_TECH_STACK_AND_DEPENDENCIES.md`.

## Stack (legacy — being migrated; new code must follow AGENTS.md)
- Next.js 14 → **target Next.js 15.x** (R2)
- TypeScript strict, App Router
- FortuneSheet (grid) — **target: behind SpreadsheetEngineAdapter, Univer primary** (R3)
- HyperFormula (formulas) — **target: behind FormulaEngineAdapter, Univer formula primary** (R3)
- Supabase (DB + Auth), Groq API (AI — free)
- Zustand (state), Tailwind + shadcn/ui (styling)
- ECharts (charts), SheetJS (import/export)

## Completed Sessions
- [x] Session 1: Foundation Setup
- [x] Session 2: Core Grid
- [x] Session 3: Formula Bar + Cell Editing + Undo/Redo
- [x] Session 4: Formula Engine + Autocomplete Dropdown
- [x] Session 5: Cell Formatting Toolbar
- [x] Session 6: Sort, Filter, Find/Replace, Data Validation
- [x] Session 7: Multiple Sheets Management
- [x] Session 8: Import, Export, Auto-Save
- [x] Fix: Wire all toolbar/panel features to the actual grid
- [x] Session 9: AI Formula Assistant
- [x] Session 10: Formula Explainer
- [x] Session 11: Smart Paste Intelligence
- [x] Session 12: Live Formula Preview While Typing
- [x] Session 13: Intent-Based Smart Column Typing
- [x] Session 14: Cell Dependency Map
- [x] Session 15: Cell-Level History
- [x] Session 16: Natural Language Filters
- [x] Session 17: Column DNA Data Health Panel
- [x] Session 18: Private Scratchpad
- [x] Session 19: Final Polish, Dark Mode, Command Palette, Deployment Prep
- [x] Session 20: AI Row Summarizer + Fully Wired Merge Cells
- [x] Session 21: Starter Templates + Conditional Formatting

## Current Session
- None - Quiksheets MVP completion session complete (May 2026)

## Next Session
- Session 22+: Optional follow-ups — Timeline slicer rendering, Live Formula Preview verification, Cell History full Supabase path

## Quiksheets MVP completion session — patterns + bugs fixed
Highlights from the 59-task verification + feature-build sweep. The patterns
below are non-obvious and have already caused multiple bugs — keep them in
mind when writing or reviewing code that touches the grid.

### Pattern: `data` + `celldata` must update in lockstep
FortuneSheet renders from the 2-D `data` matrix when the workbook hydrates
via the `data` prop. Operations that only mutate `celldata` (the sparse
{r,c,v}[] format) leave duplicate/sorted/dedupe rows visible on screen
even though the underlying state thinks they're gone. Always use
`cloneSheetWithData(sheet, nextMatrix)` from `@/lib/fortuneSheet` — it
deletes `celldata` and rebuilds `data`. Bugs caused by violating this:
- Remove Duplicates toasted success but rows stayed visible (fixed)
- Chart "No numeric data" with seeded values (caused by `__qsSeed` only
  writing celldata; also fixed)
- Anything that filters/compacts rows is suspect

### Pattern: Row 0 is always the header
Sort, Filter, and similar row-iterating utilities default to treating
row 0 as a header. `SortConfig.hasHeader` defaults to true at the
Quick Sort call site. `computeHiddenRows` starts iteration at row 1.
Don't add a row-iteration that starts at 0 without thinking about
whether that's a header.

### Pattern: ECharts 6 lifecycle
- `import * as echarts from 'echarts/core'` + explicit `echarts.use([...])`
  for the chart kinds you need. The umbrella `import 'echarts'` re-imports
  on HMR with an empty registry → "Unknown series [object Object]".
- echarts-for-react 3.0.6 calls setOption inside componentDidUpdate which
  trips ECharts 6's "setOption should not be called during main process"
  guard. Roll your own thin wrapper that owns init/setOption/dispose
  via refs (see `ChartRenderer`).
- zrender clone explodes on React fiber refs that leak into options
  (e.g. when an event handler is mistakenly passed as a config value).
  ChartRenderer deep-strips DOM/Fiber via `stripNonSerializable`.

### Pattern: Store actions called as event handlers leak the event
`onClick={openBuilder}` calls `openBuilder(reactEvent)` — if `openBuilder`
accepts an optional first arg, the event becomes that arg. Cost us R8.3:
`useChartPanelStore.openBuilder(initialKind?)` started accepting events
as `initialKind`, which leaked the event into `config.kind`, which made
ECharts log "Unknown series [object Object]". Guard with a typeof check
or always wrap in an arrow function: `onClick={() => openBuilder()}`.

### Pattern: Typed-columns enforcement must revert on clear
`useTypedColumnsEnforcement` short-circuited when a sheet had no type
map, leaving previously-typed cells stuck on the formatter output
(☑/☐ for checkbox) forever after the type was cleared. Walk every
column on every sheet and revert cells whose `m` matches a known
formatter output but whose column is no longer typed.

### Bugs fixed (11 total)
1. R8.3 — `openBuilder` treated React click events as `ChartKind`
2. ECharts 6 + echarts-for-react incompatibility (setOption guard)
3. zrender clone recursion through React FiberNode refs
4. HMR-stale chart-type registry (`import * as echarts from 'echarts'`)
5. `__qsSeed` only wrote celldata, not the `data` matrix
6. `__qsSeed` didn't sync the React store mirror
7. Remove Duplicates toasted success but `data` matrix stayed unchanged
8. Sort A→Z sorted the header row into the data
9. Filter hid the header row (row 0)
10. Typed-columns persistence: cleared columns kept ☑/☐ display
11. Build-time: dev helpers used `require()` (ESLint blocks in prod)

### Features built this session (7)
- Insert > Symbol — Unicode picker dialog
- Insert > Pictures > This Device — file upload + floating image overlay
- Data > Text to Columns — delimiter wizard with live preview
- Review > Workbook Statistics — sheets/cells/formulas count
- Insert > Slicer — pivot-attached filter dialog (was a stub)
- Insert > Sparklines — Line / Column / Win-Loss tiny in-cell charts
- Insert > Recommended PivotTables — auto-analyse + 2-4 suggestions

### Dev helpers exposed in non-prod
Under `process.env.NODE_ENV !== 'production'` guard in `src/app/sheet/[id]/page.tsx`:
- `window.__qsGrid` — live WorkbookInstance reference
- `window.__qsSeed(rows)` — 2-D array → seed both `data` and `celldata`
- `window.__qsSetColType(sheetId, col, type)` — set column type
- `window.__qsClearColType(sheetId, col)` — clear column type
- `window.__qsAddName(name, range)` — define named range
- `window.__qsListNames()` — read named ranges
- `window.__qsAddFilter(col, op, value)` / `__qsClearFilters()` — filter ops
- `window.__qsAddCFGreaterThan(sheetId, range, threshold, bg)` — CF rule
- `window.__qsListPivots()` — pivot IDs + names
- `window.__qsAddSlicer(pivotId, columnIndex, label, allValues)` — slicer
- `window.__qsParseClipboard(text)` — Smart Paste parser

Each helper goes through the real store/action — no shadow state.

## Key File Locations
- Supabase client: src/lib/supabase.ts
- Groq client: src/lib/groq.ts
- HyperFormula: src/lib/hyperformula.ts
- Global types: src/types/
- Sheet store: src/store/sheetStore.ts
- Workbook store: src/store/workbookStore.ts
- Constants: src/lib/constants.ts
- Grid component: src/features/grid/components/SpreadsheetGrid.tsx
- Default sheet: src/lib/defaultSheet.ts
- Sheet page: src/app/sheet/[id]/page.tsx
- Formula bar: src/features/formula-bar/components/FormulaBar.tsx
- Cell address utils: src/lib/cellAddress.ts
- Formula engine: src/features/formula-engine/formulaEngine.ts
- Formula list (50 formulas): src/features/formula-engine/formulaList.ts
- Autocomplete component: src/features/formula-engine/components/FormulaAutocomplete.tsx
- Toolbar: src/features/toolbar/components/FormattingToolbar.tsx
- Color picker: src/features/toolbar/components/ColorPicker.tsx
- Font size: src/features/toolbar/components/FontSizeSelector.tsx
- Font family: src/features/toolbar/components/FontFamilySelector.tsx
- Number format: src/features/toolbar/components/NumberFormatSelector.tsx
- Formatting shortcuts: src/features/toolbar/hooks/useFormattingShortcuts.ts
- Sort panel: src/features/grid/components/SortPanel.tsx
- Filter panel: src/features/grid/components/FilterPanel.tsx
- Find replace: src/features/grid/components/FindReplace.tsx
- Data validation: src/features/grid/components/DataValidation.tsx
- Sort utils: src/features/grid/utils/sortUtils.ts
- Filter utils: src/features/grid/utils/filterUtils.ts
- Sheet tabs bar: src/features/sheets/components/SheetTabsBar.tsx
- Sheet tab: src/features/sheets/components/SheetTab.tsx
- Sheet context menu: src/features/sheets/components/SheetContextMenu.tsx
- Sheet color picker: src/features/sheets/components/SheetColorPicker.tsx
- Sheets barrel: src/features/sheets/index.ts
- Save service: src/lib/saveService.ts
- Import utils: src/features/grid/utils/importUtils.ts
- Export utils: src/features/grid/utils/exportUtils.ts
- Import modal: src/features/grid/components/ImportModal.tsx
- Export menu: src/features/grid/components/ExportMenu.tsx
- Save status: src/features/grid/components/SaveStatus.tsx
- AI formula assistant: src/features/ai-cell/components/AICellPrompt.tsx
- AI formula hook: src/features/ai-cell/hooks/useAIFormula.ts
- AI formula route: src/app/api/ai/formula/route.ts
- Formula explainer route: src/app/api/ai/explain/route.ts
- Formula explainer hook: src/features/formula-explainer/hooks/useFormulaExplainer.ts
- Formula explainer tooltip: src/features/formula-explainer/components/FormulaTooltip.tsx
- Formula parser: src/features/formula-explainer/utils/formulaParser.ts
- Smart paste route: src/app/api/ai/paste/route.ts
- Smart paste hook: src/features/smart-paste/hooks/useSmartPaste.ts
- Smart paste banner: src/features/smart-paste/components/SmartPasteBanner.tsx
- Clipboard parser: src/features/smart-paste/utils/clipboardParser.ts
- Live preview hook: src/features/live-preview/hooks/useLivePreview.ts
- Live preview overlay: src/features/live-preview/components/PreviewOverlay.tsx
- Live preview range highlight: src/features/live-preview/components/RangeHighlight.tsx
- Live preview result badge: src/features/live-preview/components/ResultBadge.tsx
- Column intent hook: src/features/intent-columns/hooks/useColumnIntent.ts
- Column intent banner: src/features/intent-columns/components/ColumnIntentBanner.tsx
- Column intent detector: src/features/intent-columns/utils/columnIntent.ts
- Dependency map: src/features/dependency-map/components/DependencyMap.tsx
- Dependency map node: src/features/dependency-map/components/MapNode.tsx
- Dependency graph builder: src/features/dependency-map/utils/graphBuilder.ts
- Dependency map hook: src/features/dependency-map/hooks/useDependencyMap.ts
- Cell history service: src/features/cell-history/services/historyService.ts
- Cell history panel: src/features/cell-history/components/CellHistoryPanel.tsx
- Cell history entry: src/features/cell-history/components/HistoryEntry.tsx
- Cell history hook: src/features/cell-history/hooks/useCellHistory.ts
- Natural language filter route: src/app/api/ai/filter/route.ts
- Natural language filter bar: src/features/nl-filter/components/NLFilterBar.tsx
- Natural language filter hook: src/features/nl-filter/hooks/useNLFilter.ts
- Column DNA analyzer: src/features/column-dna/utils/columnAnalyzer.ts
- Column DNA panel: src/features/column-dna/components/ColumnDNAPanel.tsx
- Column DNA chart: src/features/column-dna/components/DistributionChart.tsx
- Column DNA metrics: src/features/column-dna/components/HealthMetrics.tsx
- Column DNA anomalies: src/features/column-dna/components/AnomalySection.tsx
- Column DNA hook: src/features/column-dna/hooks/useColumnDNA.ts
- Scratchpad storage: src/features/scratchpad/utils/scratchpadStorage.ts
- Scratchpad cross-reference utils: src/features/scratchpad/utils/crossReference.ts
- Scratchpad grid: src/features/scratchpad/components/ScratchpadGrid.tsx
- Scratchpad panel: src/features/scratchpad/components/ScratchpadPanel.tsx
- Scratchpad toggle: src/features/scratchpad/components/ScratchpadToggle.tsx
- Scratchpad hook: src/features/scratchpad/hooks/useScratchpad.ts
- Theme provider: src/components/ThemeProvider.tsx
- Theme toggle: src/components/ThemeToggle.tsx
- Command palette: src/components/CommandPalette.tsx
- Keyboard shortcuts modal: src/components/KeyboardShortcuts.tsx
- Templates: src/lib/templates/index.ts
- CF types: src/features/conditional-formatting/types.ts
- CF evaluator: src/features/conditional-formatting/utils/cfEvaluator.ts
- CF store: src/features/conditional-formatting/store/cfStore.ts
- CF dialog: src/features/conditional-formatting/components/ConditionalFormatting.tsx
- AI row summarizer route: src/app/api/ai/summarize/route.ts
- AI row summarizer component: src/features/row-summarizer/components/RowSummarizer.tsx
- AI row summarizer hook: src/features/row-summarizer/hooks/useRowSummarizer.ts
- Row summary stats utility: src/features/row-summarizer/utils/rowStats.ts
- Session tracker: SESSION_TRACKER.md
- Production env template: .env.production
- Vercel config: vercel.json
- DB schema: src/supabase/schema.sql

## Decisions Made
- Using Groq (free) instead of Anthropic API
- TypeScript strict mode enabled
- Feature-based folder structure (not type-based)
- Zustand with devtools for all global state
- FortuneSheet npm packages are @fortune-sheet/react + @fortune-sheet/core (not "fortunesheet" — that name doesn't exist on npm)
- shadcn v4 was used (npx shadcn@latest); its CSS was incompatible with Tailwind v3 — globals.css was rewritten to use HSL CSS variables, tailwind.config.ts updated with full shadcn color token map
- ESLint uses no-unused-vars with { "args": "none" } to avoid false-positives on TypeScript interface parameter names in type positions
- FortuneSheet imported dynamically (SSR disabled) — uses browser APIs
- Grid skeleton shown while FortuneSheet loads
- showToolbar and showFormulaBar set to false — we build our own
- showSheetTabs set to false — we build our own (SheetTabsBar) at the bottom of the page
- Formula bar built as custom component (not FortuneSheet built-in)
- Undo/redo uses command pattern (HistoryEntry) stored in Zustand undoStack/redoStack
- Undo limit is 100 steps (UNDO_HISTORY_LIMIT in constants.ts)
- Formula bar turns blue (bg-blue-50) when focused
- Cell selection tracked via hooks.afterSelectionChange — NOT afterCellMouseDown. afterCellMouseDown fires inside FortuneSheet's Immer draft and calling Zustand there revokes the proxy ("Cannot perform 'get' on a proxy that has been revoked"). afterSelectionChange fires after the Immer transaction commits.
- Workbook component does not accept a style prop — sizing handled by wrapper div
- Toolbar sits above formula bar in layout order
- Sheet page uses 'use client' because of useFormattingShortcuts hook
- Formatting state lives in Zustand activeFormatting object
- Color picker has 30 presets plus custom hex input
- Borders and merge cells are UI-only placeholders — not wired yet
- All toolbar dropdowns use position:fixed + getBoundingClientRect() — overflow-x-auto on the toolbar clips absolute-positioned children, so fixed positioning is mandatory
- Sort and filter open as modal panels not inline dropdowns
- Find/Replace opens as floating panel top-right (not modal) at fixed right-4 top-[130px]
- Ctrl+F opens Find, Ctrl+H opens Replace (both handled in FindReplace component's own useEffect)
- Data validation rules stored in Zustand validationRules map keyed by "row:col"
- Filter state stored in Zustand activeFilters array; filter button turns blue when activeFilters.length > 0
- exactOptionalPropertyTypes: never assign `T | undefined` to optional prop — use conditional spread `...(val ? { prop: val } : {})`
- Two separate Zustand stores: sheetStore (cells/formatting/data ops) + workbookStore (sheet tab metadata)
- workbookStore manages: sheets: SheetTab[], activeSheetId; initial sheet must be { id: 'sheet1', name: 'Sheet1' } to match createDefaultWorkbook()
- FortuneSheet active sheet controlled by status: 1 in Sheet[] data; SpreadsheetGrid syncs sheetData via useEffect watching [tabSheets, activeSheetId] from workbookStore
- Sheet sync strategy: preserve celldata of existing FortuneSheet sheets; add new default sheets for new tabs; remove stale sheets; always update status field
- Sheet tabs live at the bottom of the page (SheetTabsBar), between the grid and no footer
- SheetTabsBar has Shift+F11 shortcut (add sheet), scrollable tab list (scrollbar-width: none), + button
- SheetTab uses HTML5 native drag-and-drop for reordering (no external DnD library)
- SheetTab double-click → inline rename input; Escape cancels, Enter commits
- SheetContextMenu uses window.prompt() for rename, window.confirm() for delete — avoids complex modal
- SheetColorPicker has 16 preset colors + no-color (✕) option; embedded inside SheetContextMenu
- Context menu positioned via fixed + clientX/clientY from right-click event
- CRITICAL ARCHITECTURE: gridSheets: Sheet[] (FortuneSheet data) lives in sheetStore — NOT in SpreadsheetGrid local state. This is mandatory so toolbar, sort, filter, and find/replace can all read and write real cell data.
- applyFormatToSelection(Partial<ActiveFormatting>) updates BOTH activeFormatting (toolbar display) AND the actual cell v object in gridSheets. Never call setActiveFormatting for user-initiated formatting — only call it when reading a cell's existing format on selection change.
- FCellStyle maps our ActiveFormatting to FortuneSheet's internal v object keys: bl=bold, it=italic, un=underline, cl=strikethrough, fs=fontSize, ff=fontFamily, fc=textColor, bg=backgroundColor, ht=h-align(1/2/3), vt=v-align(1/2/3), tb=wrap(0=no,2=yes), n.format=numberFormat
- FortuneSheet's CellStyle.tb is typed as string internally — always cast FCellStyle through 'unknown' before assigning to typeof existing.v
- afterSelectionChange reads the clicked cell's v object and calls setActiveFormatting to update the toolbar to show the actual cell formatting (not stale toolbar state)
- applySort reorders celldata rows in gridSheets using existing sortRows util — does NOT just store config in state
- addFilter/removeFilter/clearFilters recompute hidden rows via computeHiddenRows and write config.rowhidden to the active sheet in gridSheets — does NOT just store filter state
- findInGrid searches celldata values and stores FoundCell[] in findResults state; replaceInGrid modifies matching cells in gridSheets and returns count
- clearFormatOnSelection strips all style keys from the cell v object, preserving only v (value), f (formula), m (display)
- Auto-save debounced at 30 seconds using inline debounce in saveService (not shared util — async return type clash)
- Ctrl+S triggers immediate manual save
- If Supabase is not configured (env vars absent) — supabase.ts exports null; saveService falls back to localStorage silently, no crash
- If user is not authenticated — same localStorage fallback
- Export uses SheetJS for .xlsx and .csv, jsPDF + jspdf-autotable for .pdf
- Import shows 10-row preview before user confirms; first row highlighted in blue-50 (treated as header)
- Workbook name is editable by clicking it in the header (turns into an input)
- ExportMenu dropdown closes on click-outside via mousedown listener
- SaveStatus shows: saved (green ✓), saving (spinning ⟳), unsaved (grey ●), error (red ✕)
- SaveStatus skips marking unsaved on first render (isFirstRender ref guard)
- Session 9 AI formula assistant trigger is exactly `=?` in the formula bar.
- `/api/ai/formula` accepts `{ instruction, cellAddress, sheetContext }` and returns `{ formula, explanation }`.
- AI formula generation uses Groq model `llama-3.3-70b-versatile`; the first call returns only a formula starting with `=`, the second call explains it in plain English.
- AICellPrompt is a 380px floating panel positioned near the selected cell; Tab accepts the generated formula into the active cell, Escape cancels.
- Session 10 formula explainer appears after hovering a formula cell for 800ms.
- `/api/ai/explain` accepts `{ formula, referencedValues }` and returns `{ explanation, dependencies, sensitivityNote }`.
- Formula explanations are cached by formula hash on the client.
- FormulaTooltip is a rich floating card with formula preview, explanation, dependency chips, sensitivity note, and pin toggle.
- SpreadsheetGrid owns formula hover detection and dependency highlight overlays.
- Session 11 smart paste listens for grid paste events and shows a non-blocking banner for structured pasted data.
- `/api/ai/paste` accepts `{ rawText, pastePosition }` and returns `{ columns, detectedStructure }`.
- Client-side `parseClipboardText` detects table, csv, paragraph, and mixed paste shapes before AI analysis.
- SmartPasteBanner appears above the grid, auto-dismisses after 8 seconds, and offers Yes Format It, Keep Raw, and Edit Detection actions.
- Confirming smart paste applies per-column formatting to the pasted area.
- Session 12 live formula preview watches formulaBarValue while editingCell is set.
- Live preview debounces formula evaluation by 150ms and uses HyperFormula.
- Referenced cells/ranges are extracted with extractCellReferences and highlighted in color overlays.
- PreviewOverlay renders a faded italic ghost value over the active cell.
- ResultBadge shows the current valid result near the formula bar.
- Session 13 intent column typing detects row 0/header edits and maps headers like Revenue, Email, Date, Status, URL, and SKU to column intents.
- ColumnIntentBanner appears below the detected header with Keep, Change, and dismiss actions.
- Confirming a detected intent applies formatting to the entire column and validation where applicable.
- Session 14 dependency map uses React Flow via @xyflow/react.
- Dependency map opens with the Map View button or Ctrl+M and overlays the grid area.
- Dependency graph nodes are formula/input cells; formula nodes are green, circular formulas yellow, #REF!/missing-sheet formulas red, and input nodes grey.
- Dependency graph edges are solid for same-sheet references and dashed for cross-sheet references.
- Clicking a dependency map node exits the map and selects that cell in FortuneSheet.
- Session 15 cell history uses the existing Supabase cell_history table.
- Cell history opens from the grid right-click context menu via View Cell History.
- CellHistoryPanel is a fixed 320px slide-in panel with date filtering, timeline entries, and restore actions.
- Cell changes are detected from FortuneSheet onChange, routed through sheetStore.updateCell, and persisted with recordCellChange when a valid workbook UUID and Supabase user are available.
- Restoring a history entry updates the workbook data in Supabase, records a new history row, and mirrors the restored value into local grid state.
- Session 16 natural language filters use `/api/ai/filter` with Groq when needed and a deterministic parser for common filters like "status is Active".
- NLFilterBar renders inline above the grid, debounces input by 800ms, shows active filter chips, and exposes the AI interpretation.
- NL filters call setActiveFilters; setActiveFilters now recomputes hidden rows for the active sheet.
- Filter operators now include date_this_month, date_last_n_days, and top_n for natural language filter output.
- Session 17 Column DNA is fully client-side and uses pure column analysis utilities, no API.
- Column DNA opens from a chart icon shown over a hovered column header.
- ColumnDNAPanel is a fixed 320px right slide-in panel with distribution chart, health metrics, type analysis, anomalies, and text top values.
- DistributionChart uses echarts-for-react for number histograms, text bars, and date density scatter plots.
- Session 18 Private Scratchpad is localStorage-only and is not included in import/export flows.
- Scratchpad data is keyed per active sheet using `quiksheets_scratchpad:<sheetId>`.
- Scratchpad opens from the floating bottom-right button or Ctrl+`.
- Scratchpad uses a mini FortuneSheet workbook with 100 rows x 20 columns, toolbar off, formula bar on, and sheet tabs off.
- Scratchpad MAIN! references like `=MAIN!A1` resolve against the active main sheet when entered and store the resolved value.
- Session 19 added next-themes dark mode, a header theme toggle, Command Palette via Ctrl+K, and Keyboard Shortcuts via ?.
- Session 19 removed the visible session badge from the sheet header and replaced the hardcoded workbook name with local workbook-name state.
- Next.js version verified as 16.2.4.
- Final local checks pass: `npm run build`, `npx tsc --noEmit`, and `npx eslint src/ --max-warnings 0`.
- Vercel deployment URL is pending because `npx vercel --prod --yes` failed with an invalid token.
- The attached master QuikSheets prompt files reference Univer, but this repo remains locked to FortuneSheet per the stack section above.
- Session 20 row summarizer opens from multi-row row-header selections, right-click on selected rows, and Alt+S.
- Session 20 `/api/ai/summarize` uses Groq when configured and falls back to deterministic stats-based output when AI is unavailable.
- Session 20 summary insertion adds a merged, centered, italic summary row below the selection with stored FortuneSheet merge metadata.
- Session 20 merge cells are wired through FortuneSheet `mergeCells` / `cancelMerge` for Merge all, Merge horizontally, Merge vertically, and Unmerge.
- Ctrl+Shift+M merges the selected range; Ctrl+Shift+U unmerges the active merged cell.
- Session 21 templates are hardcoded in `src/lib/templates/index.ts`; no Supabase required.
- Session 21 template load: data stored at `quiksheets_template_data:<id>` in localStorage; sheet page reads + deletes it on first mount.
- Session 21 CF rules stored at `quiksheets_cf_rules:<workbookId>` in localStorage, keyed by sheetId.
- Session 21 CF styles applied directly to FortuneSheet gridSheets via `cloneSheetWithData`; backups tracked per cell.
- Session 21 CF re-applied on sheet page load after 500ms delay to allow grid hydration.
- Dashboard redesigned as client component with My Workbooks + Templates tabs.

## DO NOT TOUCH (stable, finalized)
- src/types/ — only extend, never rename existing types
- src/lib/constants.ts — only add, never remove
- Folder structure — do not reorganize

## Warnings for Next Session
- Session 21 prompt is pending from the user.
- Production deployment still needs a valid Vercel token or fresh `vercel login`.
- Deployed-site verification is pending until Vercel deployment succeeds.
- AI features need GROQ_API_KEY in .env.local.
- AI features use Groq API (free) not Anthropic.
- Formula autocomplete shows when localValue starts with '=' and has no '(' yet; hides on '(' typed or Escape
- All toolbar dropdowns use position:fixed + getBoundingClientRect() — never use absolute inside overflow-x-auto
- FormulaAutocomplete uses fixed positioning anchored to the input's getBoundingClientRect
- Tab/Enter in autocomplete inserts `=FNAME(` and re-focuses input; arrow keys navigate list
- HyperFormula singleton is in src/lib/hyperformula.ts; destroyHyperFormulaInstance() available for cleanup
- Set spread `[...new Set()]` requires downlevelIteration — use Array.from(new Set()) instead
- Do not enable FortuneSheet's built-in formula bar, toolbar, or sheet tabs — we own all three
- afterSelectionChange hook reads cell value via sheetDataRef (ref pattern avoids stale closures)
- BailoutToCSR errors in dev console are normal for ssr:false dynamic imports — not real errors
- noUncheckedIndexedAccess: after splice/array access, result is T | undefined — guard before use
