# Quiksheets — Product Requirements Document

Version: 1.0  
Date: 2026-04-26  
Status: Codex-ready planning package

## 1. Product Name
The application name is **Quiksheets**. All files, components, routes, database slugs, package names, READMEs, AGENTS files, and UI strings use this name.

## 2. Product Goal
Build a browser-based spreadsheet application that feels familiar like Google Sheets or Excel but adds AI-native workflows for formulas, data cleaning, selected-row summarization, natural-language filtering, column typing, column health, dependency mapping, forms, automations, templates, collaboration, and dashboards.

## 3. Primary Users
- Business users
- Analysts
- Founders
- Finance teams
- Operations teams
- Students
- Freelancers
- SMB teams

## 4. Product Principles
1. Spreadsheet first. AI must enhance spreadsheet work, not replace it.
2. Preview before mutation. No AI action may directly alter sheet data without user confirmation.
3. P0 first. Do not build P2 features before P0 and P1 are stable.
4. Replaceable engines. Spreadsheet and formula engines must be abstracted.
5. Security from day one. Supabase RLS must not be postponed.
6. Codex session discipline. One session, one bounded deliverable, one commit.

## 5. P0/P1/P2 Feature Scope

|Priority|Module|Feature|Description|Acceptance Criteria|Owner Suggestion|Notes|
|---|---|---|---|---|---|---|
|P0|Workbook|Create workbook|User can create a new workbook|Workbook created with default Sheet1|Product + Backend|Core MVP|
|P0|Workbook|Multiple sheets|Add, rename, duplicate, delete sheets|User can manage multiple sheets in one workbook|Frontend + Backend|Core MVP|
|P0|Grid|Basic cell editing|Edit text/number/date/currency cells|Cells save and render correctly|Frontend|Core MVP|
|P0|Grid|Row/column operations|Add/delete/resize rows and columns|Grid updates without reload|Frontend + Backend|Core MVP|
|P0|Grid|Sort / filter / search|Basic data operations|Rows sort/filter/search correctly|Frontend + Backend|Core MVP|
|P0|Formatting|Basic formatting|Bold, italic, text/bg color, alignment, number/date formats|Formatting persists after save/reload|Frontend|Keep lightweight|
|P0|Formula Engine|Top 25–40 formulas|Support core arithmetic, logical, text, lookup, date formulas|Formula results calculate correctly|Backend|Must feel credible|
|P0|Import/Export|CSV import/export|Import and export CSV files|Rows/columns map correctly|Backend|Mandatory for adoption|
|P0|Import/Export|Basic XLSX import/export|Import/export .xlsx with basic fidelity|Headers, values, basic formatting preserved|Backend|MVP-safe|
|P0|Collaboration|Share workbook|Owner/editor/viewer roles|Users can access based on role|Backend|Simple RBAC|
|P0|Collaboration|Auto-save + presence|Near real-time save and active editor indicator|Changes auto-save and show active users|Frontend + Realtime|Trust factor|
|P0|Schema|Typed columns|Text, number, date, select, checkbox, status, currency|Column validation enforced|Backend|Airtable-lite layer|
|P0|Templates|Starter templates|Sales, finance, HR, ops templates|User can create workbook from template|Product + Frontend|Activation lever|
|P0|AI Copilot|AI formula generation|Natural language to formula|AI returns valid formula in selected cell|AI Service|Key differentiator|
|P0|AI Copilot|Explain formula|Explain selected formula in plain English|User gets correct explanation|AI Service|Trust builder|
|P0|AI Copilot|Data cleaning|Deduplicate, standardize dates/phones/case|Selected rows transformed safely|AI Service|High-value ops use case|
|P0|AI Copilot|Summarize selected rows|Generate insights from selected data|Summary reflects selected range|AI Service|Exec-friendly|
|P0|Forms|Create form from sheet|Generate public/internal form from columns|Submissions create rows in sheet|Frontend + Backend|Strong SMB use case|
|P0|Automation|Row triggers|Trigger on create/update/status change|Events fire reliably|Backend|Workflow foundation|
|P0|Automation|Basic actions|Send email/WhatsApp/Slack/Teams/create task|Action executes after trigger|Backend + Integrations|Huge differentiation|
|P1|Grid|Merge cells|Allow merging cells|Merged cells render and persist|Frontend|Usability|
|P1|Grid|Find & replace|Search and replace values|Replace works across range/sheet|Frontend + Backend|Power user|
|P1|Formatting|Conditional formatting|Rule-based highlighting|Rules apply dynamically|Frontend + Backend|High value|
|P1|Comments|Cell comments + mentions|Collaborative comments on cells|Users can comment and tag teammates|Frontend + Backend|Collaboration depth|
|P1|Formula Engine|Advanced formulas|SUMIF/SUMIFS/COUNTIF/COUNTIFS/UNIQUE/FILTER|Results match expected output|Backend|Competitive depth|
|P1|Charts|Basic charts|Bar/line/pie charts|Chart renders from selected range|Frontend|Reporting|
|P1|References|Cross-sheet references|Use formulas across sheets|Cross-sheet formulas recalc correctly|Backend|Expected by users|
|P1|Security|Protected ranges|Lock specific cells/ranges|Unauthorized edits blocked|Backend + Frontend|Important for finance|
|P1|Audit|Version history|Track and restore prior versions|User can restore prior snapshot|Backend|Ops + finance confidence|
|P1|Permissions|Share by link|Link sharing with expiry|Access controlled by link policy|Backend|Ease of sharing|
|P2|Analytics|Pivot tables|Summarize large data sets|Pivot results generate correctly|Backend + Frontend|Power feature|
|P2|Analytics|Advanced dashboards|KPI widgets and multi-chart dashboards|Dashboard saves and refreshes|Frontend|Executive layer|
|P2|Scripting|Macros / script engine|Automate repetitive tasks|User scripts execute safely|Backend|Not MVP|
|P2|Data|External connectors|Connect DBs/APIs/Google Sheets/Excel cloud|Data sync succeeds with mapping|Backend + Integrations|Platform moat|
|P2|Security|Row-level security|Restrict row visibility by user/role|Users see only allowed rows|Backend|Enterprise-ready|
|P2|AI Agents|Forecasting & anomaly agent|Detect trends, anomalies, and forecasts|AI outputs usable recommendations|AI Service|Advanced intelligence|


## 6. Bonus Legacy-Session Features To Preserve
These features were identified as built outside the original requirement sheet and must be preserved in the Quiksheets rebuild:
1. Undo/redo
2. Data validation
3. Live formula preview
4. Dependency map
5. Natural-language filters
6. Column DNA / data health panel
7. Private scratchpad
8. Performance hardening and polish

## 7. Known Coverage Gaps To Close
The old session coverage showed that the biggest missing areas were:
- Share workbook / RBAC
- Starter templates
- AI summarize selected rows
- Forms from sheet
- Automation row triggers and actions
- Charts
- Conditional formatting
- Cell comments and mentions
- Protected ranges
- Share by link
- P2 features: pivot tables, dashboards, macros, connectors, row-level security, forecasting/anomaly agent

## 8. Acceptance Test Data
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


## 9. Definition of Done
A feature is complete only when:
- UI exists.
- State handling exists.
- Persistence exists when required.
- Security/RLS exists when required.
- Loading/error states exist.
- Acceptance criteria pass.
- Tests exist for critical flows.
- `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` pass where applicable.
