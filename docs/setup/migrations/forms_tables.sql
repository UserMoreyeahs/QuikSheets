-- Quiksheets — forms + form_submissions migration to Supabase.
-- Migrates the localStorage-backed forms feature to a proper persisted store
-- so forms are durable, public-shareable, and visible across devices.
--
-- This migration is IDEMPOTENT and SAFE TO RE-RUN. It assumes a fresh DB
-- as well as a DB where the v2 consolidated schema already created `forms`
-- and `form_submissions` with the OLD shape (sheet_id uuid, fields_json,
-- is_public, submission_json). It normalises both shapes onto the new shape
-- documented in CLAUDE.md.
--
-- New shape:
--   forms             ( …, sheet_id text, fields jsonb, accepts_submissions bool, updated_at )
--   form_submissions  ( …, values jsonb, submitter_email text )
--
-- The `sheet_id` is intentionally `text`, not a FK to `sheets(id)`. Quiksheets
-- stores sheets inside `workbooks.data` (FortuneSheet JSON) — the normalised
-- `sheets` table is empty for current users, so a FK would always violate.
--
-- Apply with:
--   node docs/setup/apply-migration.js docs/setup/migrations/forms_tables.sql

-- ─────────────────────────────────────────────────────────────────────────
-- 1. forms — create or normalise
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.workbooks(id) on delete cascade,
  sheet_id text not null,
  slug text not null unique,
  name text not null,
  description text,
  fields jsonb not null default '[]'::jsonb,
  accepts_submissions boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Normalise the legacy v2 shape onto the new shape ────────────────────
-- Old column → new column.

-- (a) sheet_id: uuid → text. Convert in-place so existing rows keep their
--      data (cast uuid to text). The cast is no-op for new rows.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'forms'
      and column_name  = 'sheet_id'
      and data_type    = 'uuid'
  ) then
    -- Drop the FK to sheets(id) if it exists — sheet_id is no longer a uuid.
    if exists (
      select 1 from information_schema.table_constraints
      where table_schema = 'public'
        and table_name   = 'forms'
        and constraint_name = 'forms_sheet_id_fkey'
    ) then
      alter table public.forms drop constraint forms_sheet_id_fkey;
    end if;
    alter table public.forms alter column sheet_id type text using sheet_id::text;
  end if;
end $$;

-- (b) fields_json → fields.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'forms' and column_name = 'fields_json'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'forms' and column_name = 'fields'
    ) then
      alter table public.forms rename column fields_json to fields;
    else
      -- Both exist: copy old → new, then drop old.
      update public.forms set fields = fields_json where fields_json is not null and (fields is null or fields = '[]'::jsonb);
      alter table public.forms drop column fields_json;
    end if;
  end if;
end $$;

-- (c) is_public → accepts_submissions (semantic shift but same intent: the
--     flag that opens the form to the public submit endpoint).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'forms' and column_name = 'is_public'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'forms' and column_name = 'accepts_submissions'
    ) then
      alter table public.forms rename column is_public to accepts_submissions;
    else
      update public.forms set accepts_submissions = is_public where is_public is not null;
      alter table public.forms drop column is_public;
    end if;
  end if;
end $$;

-- (d) Add columns that might be missing on the legacy shape.
alter table public.forms add column if not exists description text;
alter table public.forms add column if not exists fields jsonb not null default '[]'::jsonb;
alter table public.forms add column if not exists accepts_submissions boolean not null default true;
alter table public.forms add column if not exists updated_at timestamptz not null default now();
alter table public.forms add column if not exists created_by uuid references auth.users(id);

create index if not exists forms_workbook_idx on public.forms(workbook_id);
create index if not exists forms_slug_idx on public.forms(slug);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. form_submissions — create or normalise
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  values jsonb not null default '{}'::jsonb,
  submitter_email text,
  submitted_at timestamptz not null default now()
);

-- (a) submission_json → values.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'form_submissions' and column_name = 'submission_json'
  ) then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'form_submissions' and column_name = 'values'
    ) then
      alter table public.form_submissions rename column submission_json to values;
    else
      update public.form_submissions set values = submission_json where submission_json is not null and (values is null or values = '{}'::jsonb);
      alter table public.form_submissions drop column submission_json;
    end if;
  end if;
end $$;

-- (b) Add new columns that may be missing.
alter table public.form_submissions add column if not exists values jsonb not null default '{}'::jsonb;
alter table public.form_submissions add column if not exists submitter_email text;

create index if not exists form_submissions_form_idx
  on public.form_submissions(form_id, submitted_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table public.forms enable row level security;
alter table public.form_submissions enable row level security;

-- Drop legacy v2 policies so the new policies are the authoritative ones.
drop policy if exists "forms member read"         on public.forms;
drop policy if exists "forms editor manage"       on public.forms;
drop policy if exists "members manage forms"      on public.forms;
drop policy if exists "public read by slug"       on public.forms;

drop policy if exists "form_submissions public insert" on public.form_submissions;
drop policy if exists "form_submissions member read"   on public.form_submissions;
drop policy if exists "anyone can submit"              on public.form_submissions;
drop policy if exists "members read submissions"       on public.form_submissions;

-- forms: workbook members (owners + invited members) manage their forms.
create policy "members manage forms" on public.forms
  for all
  using (
    workbook_id in (
      select w.id from public.workbooks w where w.owner_id = auth.uid()
      union
      select m.workbook_id from public.workbook_members m where m.user_id = auth.uid()
    )
  )
  with check (
    workbook_id in (
      select w.id from public.workbooks w where w.owner_id = auth.uid()
      union
      select m.workbook_id from public.workbook_members m where m.user_id = auth.uid()
    )
  );

-- forms: anyone (incl. anon) can SELECT a form that accepts submissions,
-- so the public /form/[slug] page renders without a session.
create policy "public read by slug" on public.forms
  for select
  using (accepts_submissions = true);

-- form_submissions: anyone (incl. anon) can INSERT to a form that accepts
-- submissions. The check joins through forms to enforce the flag.
create policy "anyone can submit" on public.form_submissions
  for insert
  with check (
    form_id in (
      select id from public.forms where accepts_submissions = true
    )
  );

-- form_submissions: only workbook members can read submissions back.
create policy "members read submissions" on public.form_submissions
  for select
  using (
    form_id in (
      select f.id from public.forms f
      where f.workbook_id in (
        select w.id from public.workbooks w where w.owner_id = auth.uid()
        union
        select m.workbook_id from public.workbook_members m where m.user_id = auth.uid()
      )
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 4. updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────
-- Reuse quiksheets_set_updated_at() if it exists (created in v2 schema);
-- otherwise define it.

create or replace function public.quiksheets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists forms_updated_at on public.forms;
create trigger forms_updated_at before update on public.forms
  for each row execute function public.quiksheets_set_updated_at();
