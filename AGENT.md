# Quiksheets Agent Context (legacy)

> The canonical agent contract is now [`AGENTS.md`](AGENTS.md) (plural). This file is preserved as legacy context.

## Product

Quiksheets is a spreadsheet web app built as a custom Excel/Google Sheets-like experience with AI helpers. The app owns its own toolbar, formula bar, sheet tabs, import/export, validation, sorting, filtering, and AI surfaces while using FortuneSheet only for the grid canvas/editor (target: behind SpreadsheetEngineAdapter, with Univer as primary engine — see R3).

## Stack

- Next.js App Router, TypeScript strict
- React client components for the sheet workspace
- FortuneSheet via `@fortune-sheet/react` and `@fortune-sheet/core`
- Zustand for global app state
- Tailwind CSS and shadcn-style UI primitives
- SheetJS for spreadsheet import/export
- jsPDF and jspdf-autotable for PDF export
- Supabase client with localStorage fallback when env/auth is unavailable
- Groq for AI features
- Groq model currently used for formulas: `llama-3.3-70b-versatile`

## Session State

Completed:

- Session 1: Foundation Setup
- Session 2: Core Grid
- Session 3: Formula Bar + Cell Editing + Undo/Redo
- Session 4: Formula Engine + Autocomplete Dropdown
- Session 5: Cell Formatting Toolbar
- Session 6: Sort, Filter, Find/Replace, Data Validation
- Session 7: Multiple Sheets Management
- Session 8: Import, Export, Auto-Save
- Fix: Wire all toolbar/panel features to the actual grid
- Session 9: AI Formula Assistant

Next:

- Session 10 prompt is pending from the user.

## Current Session 9 Implementation

Session 9 is complete.

AI formula trigger:

```text
=?
```

When the user types exactly `=?` into the formula bar, the AI formula prompt opens.

Files:

- `src/app/api/ai/formula/route.ts`
- `src/features/ai-cell/components/AICellPrompt.tsx`
- `src/features/ai-cell/hooks/useAIFormula.ts`
- `src/features/ai-cell/index.ts`
- `src/features/formula-bar/components/FormulaBar.tsx`

API contract:

```ts
POST /api/ai/formula
{
  instruction: string
  cellAddress: string
  sheetContext: string
}
```

Response:

```ts
{
  formula: string
  explanation: string
}
```

Behavior:

- First Groq call generates only a formula beginning with `=`.
- Second Groq call explains the formula in plain English.
- `AICellPrompt` is a 380px floating panel positioned near the selected cell.
- Generate button shows a loading spinner and shimmer.
- Errors are shown inside the panel.
- Tab accepts the generated formula into the active cell.
- Escape cancels and closes the prompt.

Important: AI generation needs `GROQ_API_KEY` in `.env.local`.

## Key Architecture

### Stores

`src/store/sheetStore.ts`

Owns the real spreadsheet data and UI state:

- `gridSheets: Sheet[]`
- `gridInstance`
- selected cell/range
- formula bar value
- formatting state
- sort/filter state
- validation rules
- find/replace results
- save state

`src/store/workbookStore.ts`

Owns sheet tab metadata:

- tab IDs
- tab names
- active sheet ID
- hidden state
- color
- order

### Grid

`src/features/grid/components/SpreadsheetGrid.tsx`

This is the FortuneSheet bridge. It dynamically imports `Workbook` from `@fortune-sheet/react` because FortuneSheet needs browser APIs.

Important behavior:

- FortuneSheet toolbar/formula bar/sheet tabs are disabled.
- App-owned toolbar/formula bar/sheet tabs are rendered outside FortuneSheet.
- `gridSheets` lives in Zustand, not local state.
- `SpreadsheetGrid` syncs workbook tab metadata into FortuneSheet sheet data.
- Selection changes update selected cell, selected range, formula bar value, and active formatting.
- Data validation runs through `beforeUpdateCell`.

Recent important fix:

- A loop around `instance.updateSheet(syncData)` caused `Maximum update depth exceeded`.
- The grid now guards identical tab-derived sheet updates and suppresses FortuneSheet `onChange` echoes during imperative sync.

### Formula Bar

`src/features/formula-bar/components/FormulaBar.tsx`

Responsibilities:

- Shows active cell address.
- Lets user type values/formulas.
- Pressing Enter commits formula/value to FortuneSheet.
- Supports undo/redo buttons and shortcuts.
- Shows local FormulaAutocomplete for queries like `=SUM`.
- Shows AI Formula Assistant when value is exactly `=?`.

Autocomplete rules:

- Formula autocomplete appears for function-name queries like `=SUM`.
- It hides after `(` or Escape.
- Selecting an autocomplete inserts `=FUNCTION(`.

### Toolbar

`src/features/toolbar/components/FormattingToolbar.tsx`

Formatting is real, not UI-only:

- `applyFormatToSelection` writes FortuneSheet cell style keys into `gridSheets`.
- The toolbar reads active cell formatting on selection change.

Important style key mapping:

- `bl`: bold
- `it`: italic
- `un`: underline
- `cl`: strikethrough
- `fs`: font size
- `ff`: font family
- `fc`: text color
- `bg`: background color
- `ht`: horizontal align
- `vt`: vertical align
- `tb`: wrap text
- `ct`: number format

### Sheet Tabs

Files:

- `src/features/sheets/components/SheetTabsBar.tsx`
- `src/features/sheets/components/SheetTab.tsx`
- `src/features/sheets/components/SheetContextMenu.tsx`
- `src/features/sheets/components/SheetColorPicker.tsx`

Behavior:

- Bottom tab bar is app-owned.
- Shift+F11 adds a sheet.
- Drag and drop reorders sheets.
- Double-click tab renames.
- Context menu handles rename, duplicate, delete, hide, color, move left/right.
- Duplicating a sheet copies the FortuneSheet grid data.

### Import/Export/Save

Files:

- `src/features/grid/components/ImportModal.tsx`
- `src/features/grid/components/ExportMenu.tsx`
- `src/features/grid/components/SaveStatus.tsx`
- `src/features/grid/utils/importUtils.ts`
- `src/features/grid/utils/exportUtils.ts`
- `src/lib/saveService.ts`

Behavior:

- Import supports preview before applying.
- Export supports XLSX, CSV, PDF.
- Save service falls back to localStorage if Supabase is unavailable or user is unauthenticated.
- Auto-save is debounced at 30 seconds.
- Ctrl+S triggers save.

### Sort, Filter, Find/Replace, Validation

Files:

- `src/features/grid/components/SortPanel.tsx`
- `src/features/grid/components/FilterPanel.tsx`
- `src/features/grid/components/FindReplace.tsx`
- `src/features/grid/components/DataValidation.tsx`
- `src/features/grid/utils/sortUtils.ts`
- `src/features/grid/utils/filterUtils.ts`
- `src/lib/validation.ts`

Important:

- Sort actually reorders `gridSheets`.
- Filter writes `config.rowhidden` to the active FortuneSheet sheet.
- Find/replace reads and mutates real grid data.
- Validation rules are keyed by:

```text
sheetId:row:col
```

## Important Files

- App page: `src/app/sheet/[id]/page.tsx`
- Grid: `src/features/grid/components/SpreadsheetGrid.tsx`
- Sheet store: `src/store/sheetStore.ts`
- Workbook store: `src/store/workbookStore.ts`
- Formula bar: `src/features/formula-bar/components/FormulaBar.tsx`
- AI formula route: `src/app/api/ai/formula/route.ts`
- AI formula prompt: `src/features/ai-cell/components/AICellPrompt.tsx`
- AI formula hook: `src/features/ai-cell/hooks/useAIFormula.ts`
- Groq client: `src/lib/groq.ts`
- FortuneSheet helpers: `src/lib/fortuneSheet.ts`
- Default sheet/workbook: `src/lib/defaultSheet.ts`
- Cell notation helpers: `src/lib/cellAddress.ts`
- Constants: `src/lib/constants.ts`
- Main project memory: `CLAUDE.md`

## Development Commands

Run from the project root. Commands:

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
npx.cmd tsc --noEmit
```

Known verification:

- `npx.cmd tsc --noEmit` passes after Session 9.
- `npm.cmd run lint` passes after Session 9.
- `npm.cmd run build` passes after Session 9.

If running `tsc` and `next build` in parallel, `.next/types` can race and produce missing generated-file errors. Run `tsc` by itself for a meaningful result.

## Working Rules

- Read `CLAUDE.md` and this file before starting a new session.
- Trust previous completed sessions unless local code clearly contradicts them.
- Do not reorganize folder structure.
- Do not enable FortuneSheet built-in toolbar, formula bar, or sheet tabs.
- Keep `gridSheets` in Zustand. Do not move real grid data into component-local state.
- Keep changes scoped to the requested session prompt.
- Do not modify stable save/export/import features unless the prompt explicitly asks.
- If touching grid sync, be careful around `instance.updateSheet`; it can create update loops.
- Preserve user changes in the dirty git tree. This repo has many untracked app files because the nested app was created after the initial parent scaffold.

## Environment

`.env.local` may contain:

- Supabase values
- `GROQ_API_KEY`

If `GROQ_API_KEY` is missing, AI routes should return a clean 503 instead of crashing.

## UI Direction

This is a productivity spreadsheet app, not a marketing site.

Use:

- Dense, practical UI
- Small controls
- Familiar spreadsheet metaphors
- Clear keyboard behavior
- Fixed-position dropdowns/panels where toolbar overflow would clip absolute children

Avoid:

- Landing page patterns inside the actual app
- Decorative hero sections
- Large ornamental cards
- One-off redesigns that do not match the existing quiet spreadsheet UI

## Current Known Notes

- The app header currently showed `Session 9`; after Session 9, future work should update that if the user provides a Session 10 prompt.
- `CLAUDE.md` is now marked with Session 9 complete and Session 10 awaiting prompt.
- Playwright is not installed as a project dependency, though a `.playwright-verify.spec.ts` exists.
- Browser/manual verification of AI formula generation requires a valid Groq key.
