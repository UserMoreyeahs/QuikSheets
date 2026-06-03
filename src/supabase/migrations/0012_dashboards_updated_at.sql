-- 0012 — Repair two live schema/code mismatches that silently broke cloud sync.
--
-- Both features' client code is already Supabase-first with a localStorage
-- fallback, but the LIVE tables were created without a column the client
-- references. A SELECT/INSERT against a missing column returns 42703, the
-- client treats it as an error, and falls back to localStorage — so the
-- feature *looks* fine on one device but never syncs. This makes the live
-- schema match the code.
--
-- Idempotent: safe to run more than once.

-- ── dashboards.updated_at (USER-FACING BUG) ──────────────────────────────────
-- src/lib/dashboardsApi.ts loadDashboards() SELECTs `updated_at` and
-- rowToDashboard() requires it (Dashboard.updatedAt is non-optional). The live
-- `dashboards` table only had created_at, so EVERY cloud load 400'd → the
-- "Dashboard" ribbon button silently ran localStorage-only. Add the column with
-- a default (saveDashboard/migrate omit it from their payloads, so the default
-- covers inserts) plus a BEFORE UPDATE trigger to keep it fresh on upserts.
alter table public.dashboards
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.quiksheets_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dashboards_updated_at on public.dashboards;
create trigger dashboards_updated_at
  before update on public.dashboards
  for each row execute function public.quiksheets_set_updated_at();

-- ── protected_ranges.description (future-proofing, not user-facing) ───────────
-- The protected-ranges UI is localStorage-only today and the server actions
-- that reference `description` are dead (never imported), so this is NOT a live
-- bug. But the LocalProtectedRange model carries `description`, and the dead
-- createProtectedRangeAction/listProtectedRangesAction SELECT it — adding the
-- nullable column makes the schema honest and lets protected-ranges be wired to
-- Supabase later without another migration. The live enforcement path
-- (findBlockingProtectedRange → range_ref/allowed_user_ids/allowed_roles) is
-- unaffected.
alter table public.protected_ranges
  add column if not exists description text;
