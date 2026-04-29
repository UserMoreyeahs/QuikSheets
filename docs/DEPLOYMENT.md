# Quiksheets — Deployment & Operations

## Production checklist

### 1. Supabase project
1. Create a Supabase project (region close to most users).
2. Run the migrations in order:
   ```bash
   for f in src/supabase/migrations/*.sql; do
     PGPASSWORD=$SUPABASE_DB_PASSWORD psql \
       -h db.<project>.supabase.co -p 5432 -U postgres -d postgres -f "$f"
   done
   ```
3. Verify RLS is enabled on every table:
   ```sql
   select relname, relrowsecurity from pg_class
   where relname in ('workbooks','sheets','cells','workbook_members',
     'comments','protected_ranges','share_links','workbook_versions',
     'forms','form_submissions','automations','automation_runs',
     'scratchpads','charts','pivot_tables','dashboards','audit_logs')
   order by relname;
   ```
   Every row must have `relrowsecurity = true`.
4. Confirm the `on_auth_user_created` trigger exists (`select tgname from pg_trigger where tgname='on_auth_user_created';`).

### 2. Vercel project
1. Import the repo in Vercel.
2. Set environment variables (see `.env.example`):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (sensitive — Production scope only)
   - `GROQ_API_KEY`, `GROQ_MODEL`
   - `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`
   - `NEXT_PUBLIC_ENGINE=fortune`
   - All `NEXT_PUBLIC_FF_*` flags default `false`
   - `*_PROVIDER` defaults `mock`
3. Build Command: `npm run build`. Install Command: `npm install`.
4. Confirm the Production deployment passes the post-deploy smoke (next section).

### 3. Post-deploy smoke
Run from CI or locally pointing at the deployed URL:
```bash
PLAYWRIGHT_BASE_URL=https://<your-domain> npx playwright test tests/e2e/smoke.spec.ts
```

### 4. Rollback
Vercel → Deployments → previous Production → Promote.
If a database migration is at fault, write a forward-fix migration.
Never `git push --force` to main.

## Operational runbook

### Common errors
- **"Supabase service role not configured"** in server actions → check
  `SUPABASE_SERVICE_ROLE_KEY` is set in Production scope.
- **"Forbidden"** from server actions for known users → check
  `workbook_members` membership and the `on_auth_user_created` trigger.
- **AI route returns 429** → bump `AI_RATE_LIMIT_PER_USER` or scale to a
  shared rate-limit backend (Upstash) for multi-instance.

### Performance
The heavy panels (DependencyMap, ColumnDNA, ConditionalFormatting,
AICellPrompt, RowSummarizer) are dynamic-imported with `ssr:false` so the
sheet route's first paint stays under 1MB JS. The grid bundle itself is
the largest cost; optimizing it is part of the Univer engine migration.

### Security review (R14)
- RLS policies — verified by `tests/rls/*` (manual run; see README).
- CSV/XLSX import — sanitized via `src/lib/security/csvInjection.ts`,
  unit-tested in `tests/unit/security/csvInjection.spec.ts`.
- Server actions — every Zod-validated; reject unexpected fields.
- API keys — `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` are read only
  from `src/lib/env.ts` and `src/lib/supabase/server.ts`.
- AI routes — rate-limited via `src/lib/rateLimit.ts`.
