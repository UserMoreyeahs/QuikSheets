-- Quiksheets — column_types table
--
-- Stores per-column type metadata (text / number / currency / date /
-- select / checkbox / status) that was previously kept only in localStorage
-- under `quiksheets_column_types:<workbookId>`.
--
-- Design decisions:
--   - `workbook_id`   references public.workbooks(id) with cascade delete.
--   - `sheet_id`      is a FortuneSheet string id (e.g. "sheet_abc123"),
--                     NOT a UUID — matches the pattern in comments_table.sql.
--   - `column_index`  is a zero-based integer matching colIndex from the grid.
--   - `type`          is the ColumnType string enum.
--   - `config`        is a JSONB payload for the optional meta fields
--                     (options, currencySymbol, decimals, dateFormat).
--   - UNIQUE(workbook_id, sheet_id, column_index) — one type per column.
--
-- RLS mirrors the comments table pattern:
--   - Workbook members (owners + invited editors/viewers) may SELECT.
--   - Owners and editors may INSERT / UPDATE / DELETE.
--
-- Idempotent: every step is guarded so the migration can be re-run safely.

create extension if not exists pgcrypto;

-- 1. Create the table if it does not exist yet.
create table if not exists public.column_types (
  id            uuid        primary key default gen_random_uuid(),
  workbook_id   uuid        not null references public.workbooks(id) on delete cascade,
  sheet_id      text        not null,
  column_index  integer     not null,
  type          text        not null,
  config        jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint column_types_uniq unique (workbook_id, sheet_id, column_index)
);

-- 2. Indexes for the two hot paths:
--    a. "load all types for a workbook" (page mount)
--    b. "load all types for a single sheet" (sheet switch)
create index if not exists column_types_workbook_idx
  on public.column_types (workbook_id);
create index if not exists column_types_sheet_idx
  on public.column_types (workbook_id, sheet_id);

-- 3. updated_at trigger — reuse (or create) the shared helper.
create or replace function public.quiksheets_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists column_types_updated_at on public.column_types;
create trigger column_types_updated_at
  before update on public.column_types
  for each row execute function public.quiksheets_set_updated_at();

-- 4. RLS — enable and drop-recreate so a re-run always lands on the
-- canonical policy text.
alter table public.column_types enable row level security;

-- 4a. Read: any workbook member (owner or invited).
drop policy if exists "column_types read" on public.column_types;
create policy "column_types read" on public.column_types
  for select using (
    workbook_id in (
      select id   from public.workbooks        where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members where user_id = auth.uid()
    )
  );

-- 4b. Insert: owners and editors only.
drop policy if exists "column_types insert" on public.column_types;
create policy "column_types insert" on public.column_types
  for insert with check (
    workbook_id in (
      select id from public.workbooks where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members
        where user_id = auth.uid() and role in ('owner', 'editor')
    )
  );

-- 4c. Update: owners and editors only.
drop policy if exists "column_types update" on public.column_types;
create policy "column_types update" on public.column_types
  for update using (
    workbook_id in (
      select id from public.workbooks where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members
        where user_id = auth.uid() and role in ('owner', 'editor')
    )
  );

-- 4d. Delete: owners and editors only.
drop policy if exists "column_types delete" on public.column_types;
create policy "column_types delete" on public.column_types
  for delete using (
    workbook_id in (
      select id from public.workbooks where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members
        where user_id = auth.uid() and role in ('owner', 'editor')
    )
  );
