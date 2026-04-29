# Quiksheets — Codex Operating Guide

## 1. Correct Workflow
1. Open the Quiksheets repository in Codex.
2. Make sure AGENTS.md exists.
3. Paste one session prompt from `docs/09_CODEX_PROMPTS_22_SESSIONS.md`.
4. Let Codex edit the repository.
5. Review the diff.
6. Run or verify quality gates.
7. Commit.
8. Paste the next session only.

## 2. Do Not Use One Giant Prompt
A full app prompt causes skipped persistence, fake UI, weak tests, and architecture drift. Use the 22-session prompt document.

## 3. How To Review Codex Output
Check:
- Did it follow AGENTS.md?
- Did it use Quiksheets, not SheetForge?
- Did it avoid deprecated stack choices?
- Did it update docs if architecture changed?
- Did tests/build pass?
- Did it avoid implementing future sessions?

## 4. Common Failure Corrections
If Codex adds direct engine calls outside adapters, instruct:
"Refactor direct engine usage behind SpreadsheetEngineAdapter/FormulaEngineAdapter."

If Codex calls Groq from client, instruct:
"Move Groq call into a server route and expose a typed client request wrapper."

If Codex creates fake buttons, instruct:
"Remove placeholder completion status. Implement full data path or mark as incomplete."

If RLS is missing, instruct:
"Add RLS policies before proceeding."
