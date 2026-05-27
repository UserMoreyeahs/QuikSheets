-- Quiksheets — conditional_format_rules table
--
-- Stores per-workbook/per-sheet CF rules so that rules survive page reloads
-- and are visible to all members of the workbook (not just the author's
-- localStorage).  Previously rules were persisted at
-- `quiksheets_cf_rules:<workbookId>` in localStorage.
--
-- Migration strategy:
--   cfRulesApi.ts performs a one-shot per-workbook upload of existing
--   localStorage rules on the first authenticated page load (gated by
--   `quiksheets_cf_migrated_to_supabase:<wbId>` in localStorage).
--
-- Idempotent: every statement is guarded with IF NOT EXISTS / OR REPLACE
-- so the script can be re-run against any project state.

-- 1. pgcrypto for gen_random_uuid().
create extension if not exists pgcrypto;

-- 2. Main table — one row per CF rule per sheet.
create table if not exists public.conditional_format_rules (
  id           uuid        primary key default gen_random_uuid(),
  workbook_id  uuid        not null references public.workbooks(id) on delete cascade,
  sheet_id     text        not null,
  -- A1-notation range the rule applies to, e.g. "A1:D100".
  range_ref    text        not null,
  -- Full CFRule object (id, name, condition, format, priority, kind, …)
  -- stored as JSONB so schema changes to CFRule don't require a migration.
  rule_json    jsonb       not null,
  created_by   uuid        references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 3. Indexes for the queries we actually make.
create index if not exists cfr_workbook_sheet_idx
  on public.conditional_format_rules(workbook_id, sheet_id);

-- 4. RLS — workbook members read; editors/owners write.
alter table public.conditional_format_rules enable row level security;

-- 4a. SELECT — any workbook member (owner or invited member).
drop policy if exists "cfr read" on public.conditional_format_rules;
create policy "cfr read" on public.conditional_format_rules
  for select using (
    workbook_id in (
      select id from public.workbooks where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members where user_id = auth.uid()
    )
  );

-- 4b. INSERT — editors and owners only; created_by must equal the caller.
drop policy if exists "cfr insert" on public.conditional_format_rules;
create policy "cfr insert" on public.conditional_format_rules
  for insert with check (
    created_by = auth.uid()
    and workbook_id in (
      select id from public.workbooks where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members
        where user_id = auth.uid() and role in ('owner', 'editor')
    )
  );

-- 4c. UPDATE — editors and owners only.
drop policy if exists "cfr update" on public.conditional_format_rules;
create policy "cfr update" on public.conditional_format_rules
  for update using (
    workbook_id in (
      select id from public.workbooks where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members
        where user_id = auth.uid() and role in ('owner', 'editor')
    )
  );

-- 4d. DELETE — editors and owners only.
drop policy if exists "cfr delete" on public.conditional_format_rules;
create policy "cfr delete" on public.conditional_format_rules
  for delete using (
    workbook_id in (
      select id from public.workbooks where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members
        where user_id = auth.uid() and role in ('owner', 'editor')
    )
  );

-- 5. updated_at trigger — reuse the shared helper created by earlier
-- migrations; create it here so this script is self-contained for
-- fresh projects that haven't run the full schema yet.
create or replace function public.quiksheets_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cfr_updated_at on public.conditional_format_rules;
create trigger cfr_updated_at
  before update on public.conditional_format_rules
  for each row execute function public.quiksheets_set_updated_at();
