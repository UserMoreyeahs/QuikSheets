-- 0009 — Finish fixing RLS infinite recursion (42P17).
--
-- 0008 fixed the SELF-referential member *read* policies via SECURITY DEFINER
-- helpers (confirmed working: the helper bypasses RLS). But a SECOND,
-- CROSS-TABLE cycle remained:
--
--   workbook_members "owner manage" (FOR ALL → also covers SELECT)
--     → reads `workbooks`  → "workbooks read" policy
--       → reads `workbook_members` → "owner manage" again → ∞
--
-- (same shape for workspace_members ↔ workspaces). Postgres reported it on
-- "workbooks"/"workspaces" after 0008.
--
-- FIX: route EVERY cross-table membership/ownership check in the core
-- workspace/workbook/member policies through SECURITY DEFINER helpers, which
-- bypass RLS and therefore can't re-enter a policy. Idempotent.

-- ── Ownership helpers (bypass RLS) ───────────────────────────────────────────
create or replace function public.is_workspace_owner(ws uuid, uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.workspaces where id = ws and owner_id = uid)
$$;

create or replace function public.is_workbook_owner(wb uuid, uid uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.workbooks where id = wb and owner_id = uid)
$$;

grant execute on function public.is_workspace_owner(uuid, uuid) to anon, authenticated, service_role;
grant execute on function public.is_workbook_owner(uuid, uuid) to anon, authenticated, service_role;

-- ── Break the cross-table cycle: member "owner manage" via helper ────────────
drop policy if exists "workspace_members owner manage" on public.workspace_members;
create policy "workspace_members owner manage" on public.workspace_members
  for all
  using (public.is_workspace_owner(workspace_id, auth.uid()))
  with check (public.is_workspace_owner(workspace_id, auth.uid()));

drop policy if exists "workbook_members owner manage" on public.workbook_members;
create policy "workbook_members owner manage" on public.workbook_members
  for all
  using (public.is_workbook_owner(workbook_id, auth.uid()))
  with check (public.is_workbook_owner(workbook_id, auth.uid()));

-- ── Parent read policies also via helpers (clean, non-cyclic) ────────────────
drop policy if exists "workspaces member select" on public.workspaces;
create policy "workspaces member select" on public.workspaces
  for select using (
    owner_id = auth.uid()
    or public.is_workspace_member(id, auth.uid())
  );

drop policy if exists "workbooks read" on public.workbooks;
create policy "workbooks read" on public.workbooks
  for select using (
    owner_id = auth.uid()
    or public.is_workbook_member(id, auth.uid())
  );
