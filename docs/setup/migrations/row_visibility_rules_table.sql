-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: row_visibility_rules table
--
-- Idempotent — safe to run multiple times.
--
-- Purpose:
--   Stores per-sheet Row RLS rules. Each rule defines a predicate (column +
--   operator + value) and a scope (who the rule applies to). The application
--   layer evaluates these at runtime to compute which rows are hidden for each
--   user. Workbook owners always see all rows regardless of any rules.
--
-- RLS policy:
--   - Workbook owners can INSERT, UPDATE, DELETE, SELECT.
--   - Members (editor/viewer) can SELECT only — they need to read rules to
--     know which rows they are allowed to see.
--   - Unauthenticated users have no access.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Table ───────────────────────────────────────────────────────────────────

create table if not exists public.row_visibility_rules (
  id            uuid primary key default gen_random_uuid(),
  workbook_id   uuid not null references public.workbooks(id) on delete cascade,
  sheet_id      text not null,
  name          text not null default '',
  predicate_json jsonb not null,
  scope_json    jsonb not null,
  enabled       boolean not null default true,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Index for fast per-workbook loads (the most common query pattern).
create index if not exists idx_row_visibility_rules_workbook_id
  on public.row_visibility_rules (workbook_id);

-- Index for per-sheet queries.
create index if not exists idx_row_visibility_rules_sheet
  on public.row_visibility_rules (workbook_id, sheet_id);

-- 2. updated_at trigger ──────────────────────────────────────────────────────

-- Reuse the generic moddatetime extension if available; otherwise create a
-- bespoke trigger function scoped to this table.
do $$
begin
  -- Try to enable moddatetime (a standard Supabase extension).
  begin
    create extension if not exists moddatetime schema extensions;
  exception when others then
    null; -- extension may not be available in all environments
  end;
end;
$$;

-- Bespoke fallback trigger (no-op if moddatetime handles it instead).
create or replace function public.row_visibility_rules_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_row_visibility_rules_updated_at on public.row_visibility_rules;

create trigger trg_row_visibility_rules_updated_at
  before update on public.row_visibility_rules
  for each row execute function public.row_visibility_rules_set_updated_at();

-- 3. Row Level Security ──────────────────────────────────────────────────────

alter table public.row_visibility_rules enable row level security;

-- Helper: is the current user the owner of this workbook?
-- We check workbooks.owner_id because workbook_members may not have a row
-- for the owner if they were never explicitly added as a member.
create or replace function public.is_workbook_owner(p_workbook_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.workbooks
    where id = p_workbook_id
      and owner_id = auth.uid()
  );
$$;

-- Helper: is the current user a member of this workbook?
create or replace function public.is_workbook_member(p_workbook_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.workbook_members
    where workbook_id = p_workbook_id
      and user_id = auth.uid()
  )
  or public.is_workbook_owner(p_workbook_id);
$$;

-- Policy: owners can manage (all operations).
drop policy if exists "row_rls_owner_manage" on public.row_visibility_rules;
create policy "row_rls_owner_manage"
  on public.row_visibility_rules
  for all
  using (public.is_workbook_owner(workbook_id))
  with check (public.is_workbook_owner(workbook_id));

-- Policy: members can read (SELECT only — needed to evaluate their own hidden rows).
drop policy if exists "row_rls_member_select" on public.row_visibility_rules;
create policy "row_rls_member_select"
  on public.row_visibility_rules
  for select
  using (public.is_workbook_member(workbook_id));

-- 4. Grants ──────────────────────────────────────────────────────────────────

grant select, insert, update, delete
  on public.row_visibility_rules
  to authenticated;

grant select
  on public.row_visibility_rules
  to anon;
