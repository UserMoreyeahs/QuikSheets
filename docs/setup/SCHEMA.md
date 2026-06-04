# Database schema — source of truth & drift protection

## TL;DR

- **Canonical column reference:** [`src/supabase/schema.live.generated.sql`](../../src/supabase/schema.live.generated.sql) — **generated from the live database**, never hand-edited.
- **Authoritative DDL** (RLS policies, functions, triggers, the columns themselves): the numbered migrations [`src/supabase/migrations/0001…0013`](../../src/supabase/migrations/), applied **in order**.
- **Drift guard:** `npm run db:check-drift` fails if the live DB is missing any column the app depends on.
- **Deprecated, do NOT use:** `src/supabase/schema.sql`, `src/supabase/migrations.consolidated.sql`, `docs/setup/quiksheets-v2-schema.sql`. None matched production; they're kept only for history.

## Why this exists

The repo previously carried **four divergent, hand-written schema files and none matched production.** Concretely, the "canonical" `quiksheets-v2-schema.sql` *dropped* `workbooks.data` (the app saves cells there), declared `forms.fields_json`/`is_public` (live + code use `fields`/`accepts_submissions`), and omitted ~8 tables the code requires. A fresh `apply-migration` from the repo produced a database that **couldn't save a single cell**.

This drift was not theoretical — it is the exact mechanism that silently broke **forms**, **dashboards** (`updated_at`), and **cloud cell-data persistence** (`workbooks.data`): the client SELECTed a column the live table lacked → PostgREST returned `42703` → the app's `try/catch` fell back to localStorage with no log, so a feature "worked" on one device but never synced.

## How it works now

### The live DB is the source of truth
The committed schema is **generated from production**, so it can never silently drift from it again:

```bash
npm run db:schema:generate     # rewrites src/supabase/schema.live.generated.sql from live
```

It reads the live table/column inventory from the PostgREST OpenAPI spec (`GET /rest/v1/`), which works over plain HTTPS even when the Postgres pooler / MCP DB connection is unreachable. RLS, functions, triggers, indexes, and defaults are **not** in the generated file — those live in the numbered migrations.

### Drift is caught automatically
```bash
npm run db:check-drift         # exit 1 if the live DB is missing a column the app needs
```
The check compares a curated **column contract** (`REQUIRED` in `scripts/check-schema-drift.mjs`, derived from `src/lib/*Api.ts` + `sheetApi.ts`) against the live schema. **Run it in CI after build** — it would have caught every drift bug above before it shipped. When a feature starts depending on a new column, add it to `REQUIRED`.

Both scripts need `NEXT_PUBLIC_SUPABASE_URL` + a Supabase key (`SUPABASE_SERVICE_ROLE_KEY` preferred, else the publishable/anon key) in the environment or `.env.local`.

## Migrations

Apply migrations **in numeric order**. The MCP DB connection and the Postgres pooler are currently unreachable for this project, so migrations are applied by **pasting them into the Supabase dashboard → SQL Editor** (project `mrvzwwfnimqufendjfhj`). They are written to be idempotent.

| # | What |
|---|---|
| 0001–0007 | Base tables + initial RLS (historical) |
| 0008–0009 | Fix infinite-recursion in member-table RLS (SECURITY DEFINER helpers) |
| 0010 | Backfill workspaces/memberships for existing users |
| 0011 | `workbook_extras` (cloud sync for charts/pivots/images/overlays) |
| 0012 | `dashboards.updated_at` + `protected_ranges.description` |
| 0013 | `workbooks.data` — restore the cell-data column the app saves to |

After applying the latest migration, `npm run db:check-drift` should pass clean.

## Future: closing the loop fully

Ideal end-state once the Postgres connection is reachable from CI: replace the OpenAPI-based generator with `supabase db pull` (full `pg_dump` incl. RLS/functions/indexes) and gate PRs on `supabase db diff`. The OpenAPI approach is the pragmatic version that works today with only HTTPS access.
