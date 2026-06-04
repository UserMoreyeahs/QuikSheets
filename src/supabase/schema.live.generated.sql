-- schema.live.generated.sql — CANONICAL table/column reference.
--
-- GENERATED FROM THE LIVE DATABASE by scripts/generate-live-schema.mjs.
-- Do NOT hand-edit. Regenerate with:  npm run db:schema:generate
--
-- This file is the single source of truth for WHICH TABLES AND COLUMNS exist
-- in production. RLS policies, triggers, functions, indexes, defaults, and
-- foreign keys are NOT represented here — those live in the numbered
-- migrations src/supabase/migrations/0001..0012 (applied in order). The three
-- legacy artifacts (schema.sql, migrations.consolidated.sql,
-- docs/setup/quiksheets-v2-schema.sql) are DEPRECATED and must not be trusted.
--
-- Generated: 2026-06-04 (live project mrvzwwfnimqufendjfhj)
-- Tables: 28

create table if not exists public.audit_logs (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  actor_id uuid,
  action text,
  target_type text,
  target_id text,
  metadata_json jsonb,
  created_at timestamptz
);

create table if not exists public.automation_runs (
  id uuid,                                -- PK
  automation_id uuid,                     -- FK -> automations.id
  status text,
  input_json jsonb,
  output_json jsonb,
  error_message text,
  created_at timestamptz
);

create table if not exists public.automations (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  name text,
  trigger_type text,
  trigger_config_json jsonb,
  action_type text,
  action_config_json jsonb,
  enabled boolean,
  created_by uuid,
  created_at timestamptz
);

create table if not exists public.cell_history (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id uuid,                          -- FK -> sheets.id
  cell_address text,
  old_value text,
  new_value text,
  old_formula text,
  new_formula text,
  changed_by uuid,
  changed_at timestamptz
);

create table if not exists public.cells (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id uuid,                          -- FK -> sheets.id
  row_index integer,
  column_index integer,
  address text,
  raw_value text,
  computed_value text,
  formula text,
  data_type text,
  format_json jsonb,
  validation_json jsonb,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.charts (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id uuid,                          -- FK -> sheets.id
  name text,
  chart_type text,
  source_range text,
  config_json jsonb,
  created_by uuid,
  created_at timestamptz
);

create table if not exists public.column_types (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id text,
  column_index integer,
  type text,
  config jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.comments (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id text,
  cell_address text,
  body text,
  author_id uuid,
  mentioned_user_ids uuid[],
  resolved boolean,
  created_at timestamptz,
  updated_at timestamptz,
  author_display_name text,
  mentions text[],
  parent_id uuid                          -- FK -> comments.id
);

create table if not exists public.conditional_format_rules (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id text,
  range_ref text,
  rule_json jsonb,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.connector_connections (
  id text,                                -- PK
  workbook_id uuid,
  sheet_id text,
  connector_kind text,
  config_json jsonb,
  mapping_json jsonb,
  schedule text,
  last_synced_at timestamptz,
  created_by uuid,
  created_at timestamptz
);

create table if not exists public.dashboards (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  name text,
  layout_json jsonb,
  widgets_json jsonb,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.form_submissions (
  id uuid,                                -- PK
  form_id uuid,                           -- FK -> forms.id
  row_id text,
  values jsonb,
  submitted_by uuid,
  submitted_at timestamptz,
  submitter_email text
);

create table if not exists public.forms (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id text,
  name text,
  slug text,
  fields jsonb,
  accepts_submissions boolean,
  created_by uuid,
  created_at timestamptz,
  description text,
  updated_at timestamptz
);

create table if not exists public.notifications (
  id uuid,                                -- PK
  user_id uuid,
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id text,
  comment_id uuid,                        -- FK -> comments.id
  actor_id uuid,
  type text,
  body text,
  read boolean,
  created_at timestamptz
);

create table if not exists public.pivot_tables (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id uuid,                          -- FK -> sheets.id
  source_range text,
  config_json jsonb,
  output_range text,
  created_by uuid,
  created_at timestamptz
);

create table if not exists public.profiles (
  id uuid,                                -- PK
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.protected_ranges (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id uuid,                          -- FK -> sheets.id
  range_ref text,
  allowed_user_ids uuid[],
  allowed_roles text[],
  created_by uuid,
  created_at timestamptz,
  description text
);

create table if not exists public.row_visibility_rules (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  sheet_id text,
  name text,
  predicate_json jsonb,
  scope_json jsonb,
  enabled boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.scratchpads (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  user_id uuid,
  content text,
  updated_at timestamptz
);

create table if not exists public.share_links (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  token text,
  role text,
  expires_at timestamptz,
  created_by uuid,
  active boolean,
  created_at timestamptz
);

create table if not exists public.sheets (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  name text,
  index_order integer,
  color text,
  row_count integer,
  column_count integer,
  frozen_rows integer,
  frozen_columns integer,
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.templates (
  id uuid,                                -- PK
  name text,
  category text,
  description text,
  preview_image_url text,
  workbook_json jsonb,
  created_at timestamptz
);

create table if not exists public.workbook_extras (
  workbook_id uuid,                       -- PK
  extras_json jsonb,
  updated_at timestamptz
);

create table if not exists public.workbook_members (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  user_id uuid,
  role text,
  invited_by uuid,
  created_at timestamptz
);

create table if not exists public.workbook_versions (
  id uuid,                                -- PK
  workbook_id uuid,                       -- FK -> workbooks.id
  snapshot_json jsonb,
  label text,
  restore_note text,
  created_by uuid,
  created_at timestamptz,
  snapshot jsonb
);

create table if not exists public.workbooks (
  id uuid,                                -- PK
  workspace_id uuid,                      -- FK -> workspaces.id
  owner_id uuid,
  name text,
  description text,
  template_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  last_opened_at timestamptz
);

create table if not exists public.workspace_members (
  id uuid,                                -- PK
  workspace_id uuid,                      -- FK -> workspaces.id
  user_id uuid,
  role text,
  created_at timestamptz
);

create table if not exists public.workspaces (
  id uuid,                                -- PK
  name text,
  slug text,
  owner_id uuid,
  created_at timestamptz,
  updated_at timestamptz
);

