# Quiksheets — Technical Architecture

## 1. Architecture Objective
Build Quiksheets as a modular spreadsheet SaaS app that can survive dependency changes. Spreadsheet engines, formula engines, AI providers, and automation providers must be replaceable.

## 2. High-Level Architecture

Client:
- Next.js App Router pages
- Spreadsheet canvas
- Toolbar, formula bar, side panels
- AI preview panels
- Collaboration presence

Server:
- Next.js server actions / route handlers
- Supabase client/server helpers
- AI gateway
- Automation service
- Import/export service
- Permission service

Database:
- Supabase PostgreSQL
- RLS on every user/workspace/workbook table
- Workbook, sheet, cell, member, comment, automation, version, form, chart, audit data

Realtime:
- Supabase Broadcast for cursor, selection, lightweight events
- Supabase Presence for online users
- Yjs or Univer Pro for conflict-safe concurrent editing if collaboration becomes true multiplayer

AI:
- Client sends intent and selected range metadata
- Server validates and rate-limits
- Server calls Groq
- Server validates response schema
- Client previews output
- User accepts
- Mutation is applied with undo/history logging

## 3. Required Folder Structure

```txt
src/
  app/
    (auth)/
    dashboard/
    workbook/[id]/
    templates/
    forms/[id]/
    api/
      ai/
      workbooks/
      sheets/
      forms/
      automations/
      export/
  components/
    ui/
    layout/
    common/
  features/
    auth/
    workspace/
    dashboard/
    workbook/
    spreadsheet/
      engine/
      adapters/
      components/
      hooks/
      utils/
    formula/
      engine/
      components/
      utils/
    toolbar/
    formatting/
    import-export/
    ai/
      formula/
      explainer/
      smart-paste/
      summarize/
      nl-filter/
      column-dna/
      anomaly/
    collaboration/
    comments/
    charts/
    templates/
    forms/
    automation/
    protected-ranges/
    scratchpad/
    version-history/
    pivot/
    dashboards/
    macros/
    connectors/
    audit/
  lib/
    supabase/
    groq/
    env/
    validation/
    rate-limit/
    errors/
    logger/
    utils/
  store/
  types/
  tests/
```

## 4. Adapter Interfaces

### SpreadsheetEngineAdapter
Required methods:
- initialize(container, workbookData)
- destroy()
- getWorkbook()
- setWorkbook(data)
- getActiveSheet()
- setActiveSheet(sheetId)
- getSelection()
- setSelection(range)
- getRangeValues(range)
- setRangeValues(range, values)
- applyFormatting(range, format)
- applyValidation(range, rules)
- insertRows(index, count)
- deleteRows(index, count)
- insertColumns(index, count)
- deleteColumns(index, count)
- mergeCells(range)
- unmergeCells(range)
- onCellChange(callback)
- onSelectionChange(callback)

### FormulaEngineAdapter
Required methods:
- evaluateFormula(formula, context)
- validateFormula(formula)
- getDependencies(cellAddress)
- recalculateWorkbook(workbook)
- explainFormulaStructure(formula)
- getSupportedFunctions()

## 5. State Rules
Use Zustand only for:
- active workbook metadata
- selected panel
- modal state
- toolbar state
- user preferences
- AI preview state

Do not store entire cell matrices in Zustand.

Use TanStack Query for:
- dashboard workbooks
- templates
- members
- comments
- audit logs
- automation runs
- form submissions
- share links

## 6. AI Gateway Rules
Every AI endpoint must:
- authenticate user
- verify workbook access
- rate-limit
- validate request with Zod
- call Groq server-side only
- validate AI response
- return preview data, not direct mutations
- log accepted actions

## 7. Build Order
1. Foundation
2. Backend schema + RLS
3. Workbook dashboard
4. Spreadsheet engine adapter
5. Core editing
6. Formulas
7. Formatting and validation
8. Import/export
9. AI P0
10. Collaboration/security
11. P1 features
12. P2 feature-flagged features
