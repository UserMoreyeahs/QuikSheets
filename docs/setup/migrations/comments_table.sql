-- Quiksheets — migrate the `comments` table to support the FortuneSheet
-- sheet-id model (string, not UUID), threading, and string mentions.
--
-- Background:
-- The legacy `comments` table (shipped in quiksheets-v2-schema.sql §2) was
-- designed when sheets were rows in a `sheets` table with their own UUIDs.
-- The actual runtime however uses FortuneSheet, where each sheet has a
-- short string id like "sheet_abc123" that lives only in the workbook JSON.
-- As a result `sheet_id uuid references sheets(id)` was wrong for every
-- real workbook — every comment insert against a non-UUID sheet id would
-- have failed.
--
-- We also need `mentions text[]` for the raw @handle strings the UI
-- already parses (mentioned_user_ids was supposed to be the resolved
-- form, but the UI never resolves them), and a `parent_id` for future
-- threaded replies (data model only; reply UI is out of scope for this
-- migration).
--
-- Idempotent: every step is guarded so the migration can be re-run.

-- 1. Make sure pgcrypto's gen_random_uuid is available (the v2 schema
-- assumes it; older Supabase projects may not have it on yet).
create extension if not exists pgcrypto;

-- 2. If the legacy table exists, drop its FK on `sheet_id` so we can
-- relax the type from uuid to text. We do this BEFORE altering the
-- column type because Postgres won't let us alter the type while a FK
-- references a column of a different type.
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_schema = 'public'
      and table_name   = 'comments'
      and constraint_name = 'comments_sheet_id_fkey'
  ) then
    alter table public.comments drop constraint comments_sheet_id_fkey;
  end if;
end$$;

-- 3. Create the table if missing (fresh installs); otherwise it already
-- exists from quiksheets-v2-schema.sql and the ALTERs below adapt it.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.workbooks(id) on delete cascade,
  sheet_id text not null,
  cell_address text not null,
  body text not null,
  author_id uuid not null references auth.users(id),
  author_display_name text,
  mentions text[] not null default '{}'::text[],
  mentioned_user_ids uuid[] default '{}'::uuid[],
  parent_id uuid references public.comments(id) on delete cascade,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Bring legacy installs up to the new shape. Each ALTER is guarded
-- against re-runs (IF NOT EXISTS / DO blocks).

-- 4a. sheet_id: convert uuid → text. Existing rows (if any) are cast.
do $$
declare
  current_type text;
begin
  select data_type into current_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'comments' and column_name = 'sheet_id';
  if current_type = 'uuid' then
    alter table public.comments alter column sheet_id type text using sheet_id::text;
  end if;
end$$;

-- 4b. author_display_name
alter table public.comments add column if not exists author_display_name text;

-- 4c. mentions text[] (raw @handles)
alter table public.comments add column if not exists mentions text[] not null default '{}'::text[];

-- 4d. parent_id (threading data model only)
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;

-- 4e. resolved defaults — make sure NOT NULL with default false
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'comments' and column_name = 'resolved' and is_nullable = 'YES'
  ) then
    update public.comments set resolved = false where resolved is null;
    alter table public.comments alter column resolved set not null;
    alter table public.comments alter column resolved set default false;
  end if;
end$$;

-- 5. Indexes for the lookups we actually make from listComments() /
-- getCellCommentCounts().
create index if not exists comments_workbook_sheet_idx
  on public.comments(workbook_id, sheet_id);
create index if not exists comments_sheet_cell_idx
  on public.comments(sheet_id, cell_address);

-- 6. RLS — keep the existing pattern from the v2 schema (workbook
-- members read, editors write, authors mutate). We DROP-and-recreate
-- so a re-run lands on the canonical text.
alter table public.comments enable row level security;

drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments
  for select using (
    workbook_id in (
      select id from public.workbooks where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members where user_id = auth.uid()
    )
  );

-- Note: the v2 schema had separate policies. We collapse to the four
-- canonical actions and pin author_id = auth.uid() for inserts so a
-- malicious editor can't impersonate another user.
drop policy if exists "comments author write" on public.comments;
drop policy if exists "members write comments" on public.comments;
create policy "members write comments" on public.comments for insert
  with check (
    author_id = auth.uid()
    and workbook_id in (
      select id from public.workbooks where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members
        where user_id = auth.uid() and role in ('owner','editor')
    )
  );

drop policy if exists "comments author update" on public.comments;
drop policy if exists "authors update own comments" on public.comments;
create policy "authors update own comments" on public.comments for update
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "comments author delete" on public.comments;
drop policy if exists "authors delete own comments" on public.comments;
create policy "authors delete own comments" on public.comments for delete
  using (author_id = auth.uid());

-- 7. updated_at trigger — reuse the helper from the v2 schema; create
-- it if missing so this migration works against a brand-new project
-- that hasn't run the v2 schema yet.
create or replace function public.quiksheets_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at before update on public.comments
  for each row execute function public.quiksheets_set_updated_at();
