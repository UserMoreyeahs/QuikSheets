# PARITY_LOG.md — QuikSheets ↔ Excel Parity

> Single source of truth for the Excel-Parity Master Prompt. Excel ground truth = `QuikSheets_MVP_P0_P1_P2_with_Testing_Data.xlsx` Phase-7 expected results + standard Excel behavior. QuikSheets = `quiksheets-v2.vercel.app` (prod).
>
> **Verification legend:** `LIVE` (observed in running app) · `TEST` (pinned by unit test) · `CODE` (confirmed by reading source) · `BLOCKED`/`UNTESTED` (could not confirm — reason given). Per the anti-hallucination law, a verdict is **PASS** only with LIVE/TEST/CODE evidence cited.

## Method notes (tooling reality)
- Excel Online is **not drivable** by Claude-for-Chrome — BOTH `*.sharepoint.com` AND `excel.cloud.microsoft` return "Navigation to this domain is not allowed" (re-verified 2026-06-08). The "Claude for Excel" add-in is a chat panel the user drives; it exposes no callable tools. Excel ground truth therefore = the Phase-7 expected results + standard Excel semantics. Desktop Commander can read a `.xlsx` cell-by-cell if the file is placed in the repo.
- One connected browser → loop runs **sequentially**, not as 7 parallel live sessions. The CODE/TEST audit, however, was run as **7 parallel code-audit agents** (one per module cluster).
- Grid is a `<canvas>` behind a persistent realtime WS, so `screenshot`/`executeScript` time out. **Most reliable channels:** Supabase `execute_sql` (cell DATA in `workbooks.data`), unit tests (logic), chart SVG DOM, production build. Used those; Claude-in-Chrome only for opportunistic spot-checks.

## Summary
PASSED: 25 · PARTIAL: 2 (T003 date-detect, T015 NL-needs-key) · FLAGGED: 2 (T027/T028 — P2, flag-OFF by default).
**Fixed this pass: T005, T016, T019, T025** (+ currency-separator pre-fix). Verified by 580-green unit suite + clean tsc/eslint + Supabase DB. Audit = 7 parallel code-audit agents; every fix re-verified against source.

## Phase 0
✅ `CODEBASE_MAP.md` complete — every MVP subsystem located + status-marked. App is largely IMPLEMENTED; parity work = Gap list + Known Defects, not green-field.

## Known Defects to Hunt (prompt Phase 14) — status
| # | Defect | Excel truth | Status |
|---|--------|-------------|--------|
| 1 | A formula cell shows `#ERROR!` | should return a value | RESOLVED for clean data — live `=C2*D2`=1198.8, SUM/VLOOKUP confirmed. `#ERROR!` only on garbage/text-operand cells from manual scribbles (same as Excel `#VALUE!`). |
| 2 | Cell shows raw float `3.368421053` | Revenue = Units×Unit Price | FIXED. `3.36…`=64/19, a stale wrong formula — reseeded to 64×19=1216 (`13ec421`); hydration heals old workbooks (`3c35fae`). **Live DB-verified 2026-06-08**: new workbook E2:E5 = 1198.8/1232.5/1522.5/1216, SUM=5169.8/479. |
| 3 | Revenue calc inconsistent across rows | all rows = Units×Unit Price | FIXED + **live DB-verified** (every row `=C{n}*D{n}` with cached value). |
| ✚ | ₹ currency format throws / no thousands separator | Excel groups thousands; en-IN shows ₹ | **FIXED this pass.** Toolbar Currency mask `$0.00`→`$#,##0.00`; Accounting ₹ mask `₹#,##,##0.00` (lakh) threw in SSF → `₹#,##0.00`. |

## Test Case Tracker (T001–T029)
| Test | Module | Excel expected | Verdict | Evidence |
|------|--------|----------------|---------|----------|
| T001 | Workbook create | Workbook + Sheet1 | PASS (CODE/TEST) | defaultSheet.ts, sampleWorkbook.spec.ts |
| T002 | Add 2nd sheet | Sheet added | PASS (CODE) | workbookStore.ts addSheet/ensureUniqueSheetName |
| T003 | Edit text/number/date | values save/display | PARTIAL | text/number PASS; **date NOT auto-detected** — `01-04-2026` stored as text (deferred, see D3) |
| T004 | Sort by amount desc | Amit (23000) first | PASS (TEST) | sheetStore.applySort + getCellSortValue, sort spec |
| T005 | Currency format | ₹ display, grouped | **PASS — FIXED** | numberFormatString `$#,##0.00`, AccountingDropdown ₹ mask, numberFormat.spec.ts |
| T006 | SUM(B2:B4) | 40500 | PASS (TEST) | evaluateCell.spec.ts, HyperFormulaAdapter.spec.ts |
| T007 | IF(B2>10000,…) | High | PASS (TEST) | evaluateCell.spec.ts |
| T008 | VLOOKUP exact | matching name / #N/A | PASS (TEST) | booleanLiterals.spec.ts; minor: bare TRUE/FALSE on HF-adapter path uses 0/1 (deferred) |
| T009 | CSV import | rows+headers | PASS (CODE) | importUtils.ts; note: import-side injection guard not wired (deferred, export guards) |
| T010 | XLSX export | opens in Excel | PASS (TEST) | exportUtils.ts, csvInjection.spec.ts (formula `f` preserved, text neutralized) |
| T011 | Share as editor | 2nd user edits | PASS (TEST) | sheetApi.spec.ts (owner/editor/viewer/stranger × load/save) |
| T012 | Auto-save | saved, no manual | PASS (TEST) | saveService.spec.ts (200/no-session/403/network + 409 self-heal) |
| T013 | Typed column validate | blocks text in currency | PASS (TEST) | columnTypeFormatters.validateForEdit, formatters.spec.ts |
| T014 | Template | predefined columns | PASS (CODE) | templates/index.ts ("Monthly Budget"; no literal "Expense Tracker" — naming only) |
| T015 | AI formula gen | =B2*18% valid | PARTIAL | needs GROQ_API_KEY (prod has it); offline fallback only does A+B+C (deferred, see D7) |
| T016 | Explain formula | correct explanation | **PASS — FIXED** | explain/route.ts now serves fallbackExplanation offline (was 503) |
| T017 | Clean phones | normalized | PASS (CODE) | data-cleaning/cleaners.ts normalizePhone (offline, both inputs → +91-9876543210) |
| T018 | Summarize rows | insights | PASS (CODE) | rowStats.ts + summarize route fallback (HTTP 200) |
| T019 | Form → row | new row added | **PASS — FIXED** | useFormSubmissionMergeOnMount.ts now writes numeric cells for number/currency |
| T020 | Trigger on status | action fires | PASS (TEST) | dispatcher.spec.ts, triggerConditions.spec.ts; WhatsApp mock-by-default w/o Twilio env |
| T021 | Conditional format | >10000 highlighted | PASS (TEST) | cfEvaluator.ts, cfEvaluatorParity.spec.ts |
| T022 | Cell comment | visible to collab | PASS (TEST) | commentsApi/notificationsApi specs; not live via Realtime (refetch on open) |
| T023 | Bar chart | renders Jan-Mar 50/70/65k | PASS (TEST) | toEChartsOption.spec.ts (8/8) — categories/series/layout |
| T024 | Cross-sheet ref | =Sheet2!B2 mirrors | PASS (TEST) | evaluateCell.spec.ts; quoted-name `'My Sheet'!B5` eval untested (evidence gap) |
| T025 | Restore version | older state restored | **PASS (workbook) — cell-restore FIXED** | versionsApi.spec.ts; dead per-cell Restore button now disabled (was silent no-op) |
| T026 | Pivot table | groups+totals | PASS (TEST) | pivotAggregator.spec.ts; flag NEXT_PUBLIC_FF_PIVOT (off by default) |
| T027 | External DB connector | rows sync | FLAGGED | needs `pg` pkg + POSTGRES_CONNECTOR_ENABLED + FF flag (deployment, see D8) |
| T028 | Row-level security | own rows only | FLAGGED | **client-side only + apply-hook not mounted** — not server-enforced security (deferred, see D8) |
| T029 | Forecasting agent | forecast+confidence | PASS (TEST) | forecast/route.ts OLS regression, forecast.spec.ts; flag NEXT_PUBLIC_FF_FORECAST |

## Feature deltas (appended as found)

### D1 / D2 — New + pre-existing workbooks rendered Revenue/Total BLANK — FIXED + LIVE-VERIFIED
Seed stored `f:'=C2*D2'` (leading `=` FortuneSheet can't parse) with no cached value → blank. Fixed seed (`13ec421`/`931e404`) + hydration self-heal for old workbooks (`b334ef6`/`3c35fae`). **DB-verified 2026-06-08** on a fresh prod workbook: all formula cells store `f` without `=` and carry correct computed `v`/`m`.

### D3 — No auto date-detection on free-form cell entry (T003) — DEFERRED (risk)
`beforeUpdateCell`/`createCell` store `01-04-2026` as literal text (left-aligned), not a date serial; Excel auto-converts a General cell. Breaks date sort/math on hand-typed dates. Fix: in `SpreadsheetGrid.beforeUpdateCell`, when the column is untyped and the string matches a date pattern (`parseLooseDate`), commit a date cell. Deferred — the edit hot-path is risky to change without live canvas testing.

### D4 — ₹ Indian-Rupee currency format threw (T005) — FIXED
`AccountingDropdown` INR mask `₹#,##,##0.00` (Indian lakh grouping) is rejected by FortuneSheet's bundled SSF 0.11.2 (`unsupported format |#,##,##0|`), no try/catch → cell left unformatted + error toast. The user's locale-default currency. Fixed to `₹#,##0.00;[Red]-₹#,##0.00` (Western grouping renders `₹12,000.00`). True lakh grouping needs a post-format pass on `m` (out of scope; only matters ≥ 1 lakh). `AccountingDropdown.tsx`.

### D5 — Cell-history "Restore" was a silent no-op (T025) — FIXED
`restoreCell()` is a stub returning `null` (pending R6.x cells-table migration), yet the Cell History panel showed a Restore button that popped a confirm dialog then did nothing — a hallucinated action. Disabled the button with an explanatory tooltip; history viewing still works. `HistoryEntry.tsx`. (Workbook-level version restore is fully functional.)

### D6 — Explain-formula 503'd offline despite a ready fallback (T016) — FIXED
`/api/ai/explain` returned 503 when `GROQ_API_KEY` was unset even though a correct `fallbackExplanation` (with parsed dependencies) existed. Now serves the fallback at 200, matching `/api/ai/summarize`. `explain/route.ts`.

### D7 — Form submissions merged as text (T019) — FIXED
`useFormSubmissionMergeOnMount` wrote `String(raw)` for every field, so Deal=15000 became text "15000" (won't SUM/sort). Now coerces `number`/`currency` fields to numeric cells (stripping currency punctuation). `useFormSubmissionMergeOnMount.ts`.

### D8 — DEFERRED / FLAGGED (real, but lower priority or deployment-gated)
- **NL→formula (T015):** only the literal "add columns A,B,C" works without a GROQ key; GST/% etc. 503 offline. Prod has the key, so live it works — but add a deterministic %-of-column template for offline parity. `ai/formula/route.ts`.
- **CSV import injection (T009):** `sanitizeImportedCellValue` exists+tested but isn't called on import (export already guards the real Excel-execution vector). Wire it into `importUtils.ts` as defense-in-depth.
- **Formula semantics:** `LET` returns only its last arg (not the evaluated body); `SORT` ignores `sort_index`/`by_col`; `SORTBY` is single-key. `formulajsPatches.ts:207,222,300`.
- **Row-Level Security (T028):** client-side row hiding only — full data ships to the browser; role/identity come from client state; the apply-hook isn't even mounted. Flag-OFF by default. Needs server-side enforcement before it's "security". `row-rls/**`.
- **Postgres connector (T027):** needs `pg` package + `POSTGRES_CONNECTOR_ENABLED=true` + `NEXT_PUBLIC_FF_CONNECTORS=true`; 503 otherwise (by design). Deployment prerequisite, proxy itself is correct/secure.
- **date_short mask** is US `MM/DD/YYYY` (typed-columns already uses en-IN `DD-MMM-YYYY`) — locale nuance, not a crash.
