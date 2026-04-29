# RLS Tests

These tests assert that Supabase Row-Level Security policies declared in
`src/supabase/migrations/0001_*.sql` through `0007_*.sql` behave correctly.

They require a running Supabase instance (local CLI or test project). They
are excluded from the default `npm run test` because they cannot run in CI
without Supabase credentials.

## Local setup

1. `supabase start` (Supabase CLI) or point `SUPABASE_TEST_URL` and
   `SUPABASE_TEST_SERVICE_ROLE_KEY` at a dedicated test project.
2. Run all migrations against that project:
   ```bash
   for f in src/supabase/migrations/*.sql; do
     PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -f "$f"
   done
   ```
3. Run RLS tests:
   ```bash
   npx vitest run tests/rls --pool=forks
   ```

## Required scenarios

Each test must verify a positive case AND a negative case:

- **viewer cannot UPDATE cells** (T011 viewer)
- **editor can UPDATE cells** (T011 editor)
- **non-member SELECT returns 0 rows** (workbook isolation)
- **expired share_link denies access** (R7/R11)
- **protected_range blocks editor write** (R11)
- **scratchpad isolated per user** (privacy)
- **public form allows anonymous submission insert** (R9)
- **audit_logs cannot be inserted by non-service role** (append-only)

These tests are tracked under R14 (Final QA). Until then, the RLS coverage
is verified by reading the migration SQL during code review.
