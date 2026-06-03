-- 0008 — Fix infinite recursion (Postgres 42P17) in members-table RLS policies.
--
-- ROOT CAUSE: the SELECT policies on `workspace_members` and `workbook_members`
-- each queried their OWN table inside the policy:
--
--   create policy "workbook_members read" on workbook_members for select using (
--     exists (select 1 from workbook_members m where m.workbook_id = workbook_members.workbook_id
--             and m.user_id = auth.uid()))
--
-- Evaluating the policy re-reads the table, which re-applies the policy → infinite
-- recursion. Postgres aborts with "42P17 infinite recursion detected in policy".
-- Because almost every other policy (workbooks read, sheets, cells, comments,
-- protected_ranges, cell_history, …) checks membership by reading these tables,
-- the recursion cascaded and broke ALL Supabase reads — which silently pushed the
-- app onto its localStorage fallback ("Local" workbooks, no cloud sync, sharing
-- broken).
--
-- FIX: resolve membership through SECURITY DEFINER helper functions. A SECURITY
-- DEFINER function runs as its owner (postgres), for whom RLS is not enforced, so
-- the membership lookup no longer re-triggers the policy. The member tables' own
-- read policies become: "you can always see your own rows, plus co-members via the
-- helper" — non-recursive, and preserving the original roster semantics.
--
-- Idempotent: safe to run more than once.

-- ── SECURITY DEFINER membership helpers (bypass RLS → no recursion) ──────────
create or replace function public.is_workspace_member(ws uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws and user_id = uid
  )
$$;

create or replace function public.is_workbook_member(wb uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workbook_members
    where workbook_id = wb and user_id = uid
  )
$$;

-- Keep these callable by the API roles.
grant execute on function public.is_workspace_member(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.is_workbook_member(uuid, uuid) to anon, authenticated, service_role;

-- ── workspace_members: own rows + co-members (non-recursive) ─────────────────
drop policy if exists "workspace_members member select" on public.workspace_members;
create policy "workspace_members member select" on public.workspace_members
  for select using (
    user_id = auth.uid()
    or public.is_workspace_member(workspace_id, auth.uid())
  );

-- ── workbook_members: own rows + co-members (non-recursive) ──────────────────
drop policy if exists "workbook_members read" on public.workbook_members;
create policy "workbook_members read" on public.workbook_members
  for select using (
    user_id = auth.uid()
    or public.is_workbook_member(workbook_id, auth.uid())
  );
