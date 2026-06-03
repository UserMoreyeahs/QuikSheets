-- Quiksheets — ensure `workbook_versions` table has the shape
-- expected by src/lib/versionsApi.ts (Supabase-first version history).
--
-- The table was originally created in src/supabase/migrations/0004_history.sql
-- using the column `snapshot_json`. This migration:
--   • Creates the table if it does not yet exist (fresh project).
--   • Adds `snapshot` jsonb column as an alias / fallback if the existing
--     table only has `snapshot_json` (idempotent ADD COLUMN IF NOT EXISTS).
--   • Ensures the RLS policies allow editors — not just owners — to INSERT
--     new snapshots (the original policy was owners-only, which silently
--     blocked collaborators).
--
-- Safe to re-run: every DDL statement is guarded.

create extension if not exists pgcrypto;

-- 1. Create if the table does not exist yet.
create table if not exists public.workbook_versions (
  id          uuid primary key default gen_random_uuid(),
  workbook_id uuid    not null references public.workbooks(id) on delete cascade,
  snapshot    jsonb   not null default '{}',
  label       text,
  created_by  uuid    references auth.users(id),
  created_at  timestamptz not null default now()
);

-- 2. For installs that already have the table with `snapshot_json`,
--    add the canonical `snapshot` column (versionsApi uses `snapshot`).
alter table public.workbook_versions
  add column if not exists snapshot jsonb not null default '{}';

-- 3. `label` and `created_by` — ensure they exist on legacy installs.
alter table public.workbook_versions
  add column if not exists label text;
alter table public.workbook_versions
  add column if not exists created_by uuid references auth.users(id);

-- 4. Index for the list query (workbook_id + newest-first).
create index if not exists workbook_versions_workbook_idx
  on public.workbook_versions(workbook_id, created_at desc);

-- 5. RLS.
alter table public.workbook_versions enable row level security;

-- 5a. SELECT — any member of the workbook can read.
drop policy if exists "workbook_versions read" on public.workbook_versions;
create policy "workbook_versions read" on public.workbook_versions
  for select using (
    exists (
      select 1 from public.workbooks w
      where w.id = workbook_versions.workbook_id
        and (
          w.owner_id = auth.uid()
          or exists (
            select 1 from public.workbook_members m
            where m.workbook_id = w.id and m.user_id = auth.uid()
          )
        )
    )
  );

-- 5b. INSERT — owners and editors may snapshot.
drop policy if exists "workbook_versions owner manage" on public.workbook_versions;
drop policy if exists "workbook_versions editor insert" on public.workbook_versions;
create policy "workbook_versions editor insert" on public.workbook_versions
  for insert with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.workbooks w
      where w.id = workbook_versions.workbook_id
        and (
          w.owner_id = auth.uid()
          or exists (
            select 1 from public.workbook_members m
            where m.workbook_id = w.id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'editor')
          )
        )
    )
  );

-- 5c. UPDATE — owners and editors may rename labels.
drop policy if exists "workbook_versions editor update" on public.workbook_versions;
create policy "workbook_versions editor update" on public.workbook_versions
  for update
  using (
    exists (
      select 1 from public.workbooks w
      where w.id = workbook_versions.workbook_id
        and (
          w.owner_id = auth.uid()
          or exists (
            select 1 from public.workbook_members m
            where m.workbook_id = w.id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'editor')
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.workbooks w
      where w.id = workbook_versions.workbook_id
        and (
          w.owner_id = auth.uid()
          or exists (
            select 1 from public.workbook_members m
            where m.workbook_id = w.id
              and m.user_id = auth.uid()
              and m.role in ('owner', 'editor')
          )
        )
    )
  );

-- 5d. DELETE — owners only (to prevent accidental history purge by editors).
drop policy if exists "workbook_versions owner delete" on public.workbook_versions;
create policy "workbook_versions owner delete" on public.workbook_versions
  for delete using (
    exists (
      select 1 from public.workbooks w
      where w.id = workbook_versions.workbook_id
        and w.owner_id = auth.uid()
    )
  );
