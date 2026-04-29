# Quiksheets — Database Schema and RLS Plan

## 1. Core Tables

```sql
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz default now(),
  unique(workspace_id, user_id)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table workbooks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  name text not null,
  description text,
  template_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_opened_at timestamptz
);

create table workbook_members (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','editor','viewer')),
  invited_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(workbook_id, user_id)
);

create table sheets (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  name text not null,
  index_order int not null default 0,
  color text,
  row_count int not null default 1000,
  column_count int not null default 26,
  frozen_rows int default 0,
  frozen_columns int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table cells (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  sheet_id uuid not null references sheets(id) on delete cascade,
  row_index int not null,
  column_index int not null,
  address text not null,
  raw_value text,
  computed_value text,
  formula text,
  data_type text,
  format_json jsonb default '{}'::jsonb,
  validation_json jsonb default '{}'::jsonb,
  updated_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(sheet_id, row_index, column_index)
);
```

## 2. Collaboration and Security Tables

```sql
create table share_links (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  token text unique not null,
  role text not null check (role in ('viewer','editor')),
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  sheet_id uuid not null references sheets(id) on delete cascade,
  cell_address text not null,
  body text not null,
  author_id uuid not null references auth.users(id),
  mentioned_user_ids uuid[] default '{}',
  resolved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table protected_ranges (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  sheet_id uuid not null references sheets(id) on delete cascade,
  range_ref text not null,
  allowed_user_ids uuid[] default '{}',
  allowed_roles text[] default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
```

## 3. History and Versioning

```sql
create table cell_history (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  sheet_id uuid not null references sheets(id) on delete cascade,
  cell_address text not null,
  old_value text,
  new_value text,
  old_formula text,
  new_formula text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz default now()
);

create table workbook_versions (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  snapshot_json jsonb not null,
  label text,
  restore_note text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);
```

## 4. Product Feature Tables

```sql
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  preview_image_url text,
  workbook_json jsonb not null,
  created_at timestamptz default now()
);

create table forms (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  sheet_id uuid not null references sheets(id) on delete cascade,
  name text not null,
  slug text unique not null,
  fields_json jsonb not null,
  is_public boolean default false,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  row_id text,
  submission_json jsonb not null,
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz default now()
);

create table automations (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  name text not null,
  trigger_type text not null,
  trigger_config_json jsonb not null default '{}'::jsonb,
  action_type text not null,
  action_config_json jsonb not null default '{}'::jsonb,
  enabled boolean default true,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations(id) on delete cascade,
  status text not null,
  input_json jsonb default '{}'::jsonb,
  output_json jsonb default '{}'::jsonb,
  error_message text,
  created_at timestamptz default now()
);

create table scratchpads (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  content text default '',
  updated_at timestamptz default now(),
  unique(workbook_id, user_id)
);

create table charts (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  sheet_id uuid not null references sheets(id) on delete cascade,
  name text not null,
  chart_type text not null,
  source_range text not null,
  config_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table pivot_tables (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  sheet_id uuid not null references sheets(id) on delete cascade,
  source_range text not null,
  config_json jsonb not null default '{}'::jsonb,
  output_range text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table dashboards (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  name text not null,
  layout_json jsonb not null default '{}'::jsonb,
  widgets_json jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid references workbooks(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text,
  target_id text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
```

## 5. RLS Policy Rules
Implement policies so:
- Workspace owners/admins can manage workspace settings.
- Workbook owners can manage everything in a workbook.
- Editors can change sheet/cell/form/comment/chart/automation data but cannot remove owner.
- Viewers can read only.
- Share links provide scoped read/edit access only if active and unexpired.
- Protected ranges block unauthorized cell edits.
- Scratchpads are private by workbook_id + user_id.
- Public forms allow inserts only to form_submissions for public forms.
- Audit logs are append-only through server-side functions.
