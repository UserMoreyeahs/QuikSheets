# Quiksheets — Testing and Quality Gates

## 1. Required Commands
Every session must end with:
```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

If tests do not exist yet, document that explicitly and create tests in the first session where a testable unit exists.

## 2. Test Stack
- Vitest for unit tests
- React Testing Library for components
- Playwright for end-to-end workflows
- Supabase local test strategy for RLS policies where feasible

## 3. Core Acceptance Tests
|Test ID|Priority|Module|Test Scenario|Input / Dummy Data|Expected Result|
|---|---|---|---|---|---|
|T001|P0|Workbook|Create new workbook|Workbook Name: Q1 Sales Ops|Workbook created with Sheet1|
|T002|P0|Workbook|Add second sheet|Sheet Name: Expenses|Sheet added successfully|
|T003|P0|Grid|Edit text/number/date cells|A1=Client Name, B1=Amount, C1=01-04-2026|Values save and display correctly|
|T004|P0|Grid|Sort by amount descending|Rows: Rahul/12000, Priya/5500, Amit/23000|Amit row appears first|
|T005|P0|Formatting|Apply currency format|B2:B4 = 12000, 5500, 23000|Cells display ₹ format|
|T006|P0|Formula Engine|SUM formula|0|Result = 40500|
|T007|P0|Formula Engine|IF formula|High|B2 returns High|
|T008|P0|Formula Engine|VLOOKUP / LOOKUP|Lookup LeadID L-1002|Returns matching customer name|
|T009|P0|Import/Export|Import CSV|lead_name,deal_size,stage|Rows imported with headers|
|T010|P0|Import/Export|Export XLSX|Workbook: Sales Pipeline|Downloaded .xlsx opens in Excel|
|T011|P0|Collaboration|Share as editor|User: ops@demo.com|Second user can edit|
|T012|P0|Collaboration|Auto-save|Edit A2 from Rahul to Rahul Sharma|Saved without manual action|
|T013|P0|Schema|Validate typed column|Enter text 'abc' in Amount|Validation blocks or warns|
|T014|P0|Templates|Use expense tracker template|Select Expense Tracker|Workbook created with predefined columns|
|T015|P0|AI Copilot|Generate formula via prompt|Prompt: Calculate 18% GST for Amount|AI inserts valid formula like =B2*18%|
|T016|P0|AI Copilot|Explain formula|Cell formula =SUM(B2:B10)|AI explains total of selected range|
|T017|P0|AI Copilot|Clean phone numbers|98765 43210 / +91-9876543210|Normalized to consistent format|
|T018|P0|AI Copilot|Summarize selected rows|10 rows of deal data|AI returns top insights|
|T019|P0|Forms|Submit form creates row|Lead Name=Neha, Deal=15000, Stage=New|New row added to sheet|
|T020|P0|Automation|Trigger on status change|Status changes to Overdue|WhatsApp reminder action fired|
|T021|P1|Formatting|Conditional formatting rule|If Amount > 10000 highlight|Matching cells highlighted|
|T022|P1|Comments|Add cell comment|Comment on C3: Follow up tomorrow|Comment visible to collaborators|
|T023|P1|Charts|Create bar chart|Months Jan-Mar, Revenue 50k/70k/65k|Chart renders correctly|
|T024|P1|References|Cross-sheet formula|#VALUE!|Value mirrors Sheet2 B2|
|T025|P1|Audit|Restore version|Restore version from 10:15 AM|Older state restored|
|T026|P2|Analytics|Create pivot table|Region, Sales Rep, Revenue|Pivot groups and totals correctly|
|T027|P2|Data|External DB connector|Postgres sales table|Rows sync into QuikSheets|
|T028|P2|Security|Row-level security|Sales rep logs in|User sees only own rows|
|T029|P2|AI Agents|Forecasting agent|12 months revenue data|AI gives forecast + confidence|


## 4. Critical E2E Workflows
1. Sign up, log in, create workspace.
2. Create workbook.
3. Edit cells and auto-save.
4. Add/rename/delete sheet.
5. Use formulas.
6. Apply formatting.
7. Import/export CSV/XLSX.
8. Use AI formula generation with preview.
9. Use AI data cleaning with preview.
10. Share workbook as viewer/editor.
11. Protected range blocks unauthorized edit.
12. Create form from sheet and submit response.
13. Create row-change automation and record run.
14. Create chart from range.
15. Restore workbook version.

## 5. No Fake Completion Rule
A button does not count as a feature. A feature is complete only when its data path, error path, persistence path, and acceptance criteria are implemented.
