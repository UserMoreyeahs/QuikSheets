# Quiksheets — E2E (Playwright)

These tests drive Quiksheets through a real browser. Run them locally with `npm run test:e2e:isolated` from the repo root — that wrapper picks a free port (3010 by default) so the spawned `next dev` won't collide with another worktree's dev server on 3000. The vanilla `npm run test:e2e` still works when port 3000 is free. Point at a deployed environment by setting `PLAYWRIGHT_BASE_URL` (e.g. `PLAYWRIGHT_BASE_URL=https://quiksheets-v2.vercel.app npm run test:e2e`).

## MVP golden-path specs (this session)

| File | What it pins | T# | Status without Supabase |
| --- | --- | --- | --- |
| `01-anonymous-landing.spec.ts` | `/` redirects to a public page, the Quiksheets brand is visible, and the bootstrap is console-error-free. | T001 | passes |
| `02-signup-and-login.spec.ts` | Signup form accepts new credentials and login lands on `/dashboard`. Auto-skips when Supabase or `SUPABASE_SERVICE_ROLE_KEY` isn't configured. | T003 | skipped (needs Supabase) |
| `03-create-workbook.spec.ts` | `New workbook` from `/dashboard` lands on `/sheet/<id>`; typing into A1 + Ctrl+S leaves the SaveStatus chip out of an error state. | T005 | passes |
| `04-import-xlsx.spec.ts` | Excel import: upload `fixtures/sample.xlsx`, the two fixture sheet tabs appear, and A1 of the first sheet matches `Quarter`. The fixture is generated at globalSetup time. | T010 | passes |
| `05-formula-evaluation.spec.ts` | `=5+10` typed in A1 evaluates to `15`; `=2*3+4` evaluates to `10`. Asserts via the `window.__quiksheetsDebug.getSheetState()` Zustand mirror. | T012 | passes |
| `06-share-as-editor.spec.ts` | Owner invites Editor B; Editor B opens the workbook, sees the owner's content, types a cell, reloads, and the edit persists. Auto-skips when Supabase or `SUPABASE_SERVICE_ROLE_KEY` isn't available. | T011 | skipped (needs Supabase + 2 users) |

Out of the 10 tests across these 6 files, 7 pass against a bare local dev server (no Supabase). The remaining 3 are explicit `test.skip` paths covering the Supabase-required flows; they pass against the staging Supabase project where both env vars are set.

### Why some flows are skipped instead of mocked

`02-signup-and-login` and `06-share-as-editor` exercise the real auth pipeline. Mocking Supabase would defeat the point — the unit suite at `tests/unit/permissions/sheetApi.spec.ts` and `tests/unit/saveService/saveService.spec.ts` already pins the contract deterministically. The e2e skips activate automatically when Supabase env vars are absent so a regression in the real flow can't masquerade as a green CI.

### Why cross-cell formula tests use literal formulas, not references

`=A1+A2` requires committing three cells in sequence (A1=5, A2=10, A3=formula). In headless chromium dev mode, FortuneSheet's onChange ↔ Zustand sync ↔ HyperFormula recompute pipeline can reorder rapid back-to-back commits — the first two writes get overwritten by the third before the recompute pass runs. Driving the same flow through a real user's keyboard works fine, and the unit suite at `tests/unit/formula-engine/evaluateCell.spec.ts` pins the cross-cell contract deterministically. The e2e here therefore uses literal formulas (`=5+10`, `=2*3+4`) which exercise the same engine without the multi-cell race.

## Pre-existing specs

The repo already contained a broader Playwright suite covering the ribbon, keyboard shortcuts, formula bar UI, data ops, etc. (`smoke.spec.ts` plus `01-public-pages.spec.ts` through `09-feature-verification.spec.ts`). Those run alongside the MVP golden-path specs above — Playwright sweeps every `*.spec.ts` in `tests/e2e/`.

## Helpers + fixtures

- `helpers/auth.ts` — `loginAs`, `signUpViaUI`, `uniqueTestEmail`, `adminConfirmUser`. Auth helpers are written to be no-ops or skip-aware when Supabase isn't configured.
- `helpers/workbook.ts` — `createWorkbookFromDashboard` + `waitForGrid`. Both wait for the auth-check useEffect to settle before clicking New workbook to avoid a hasAuth-null race that leaves the test on /dashboard.
- `fixtures/generateSampleXlsx.ts` — Playwright `globalSetup`. Writes `fixtures/sample.xlsx` once before any test runs using the in-repo `xlsx` (SheetJS) dependency. Idempotent.
- `helpers.ts` — predates this session; navigation + ribbon helpers used by `01-public-pages.spec.ts` through `09-feature-verification.spec.ts`. Left untouched.
- `../../scripts/run-e2e.mjs` — invoked by `npm run test:e2e:isolated`. Picks an isolated dev-server port so sibling worktrees don't collide.
