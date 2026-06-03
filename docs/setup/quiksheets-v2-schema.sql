-- Quiksheets — workspace-level tables.
-- Per docs/04_DATABASE_SCHEMA_AND_RLS.md §1.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_id uuid not null references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','member','viewer')),
  created_at timestamptz default now(),
  unique(workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on workspace_members(user_id);

-- RLS
alter table profiles enable row level security;
alter table workspaces enable row level security;
alter table workspace_members enable row level security;

-- profiles: a user can read/write only their own row.
drop policy if exists "profiles self select" on profiles;
create policy "profiles self select" on profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles self upsert" on profiles;
create policy "profiles self upsert" on profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles self update" on profiles;
create policy "profiles self update" on profiles
  for update using (auth.uid() = id);

-- workspaces: members can read; owners/admins can mutate.
drop policy if exists "workspaces member select" on workspaces;
create policy "workspaces member select" on workspaces
  for select using (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = workspaces.id and m.user_id = auth.uid()
    )
  );
drop policy if exists "workspaces owner manage" on workspaces;
create policy "workspaces owner manage" on workspaces
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- workspace_members: members of the workspace can see the roster; owner manages.
drop policy if exists "workspace_members member select" on workspace_members;
create policy "workspace_members member select" on workspace_members
  for select using (
    exists (
      select 1 from workspace_members m
      where m.workspace_id = workspace_members.workspace_id and m.user_id = auth.uid()
    )
  );
drop policy if exists "workspace_members owner manage" on workspace_members;
create policy "workspace_members owner manage" on workspace_members
  for all using (
    exists (
      select 1 from workspaces w
      where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workspaces w
      where w.id = workspace_members.workspace_id and w.owner_id = auth.uid()
    )
  );
-- Quiksheets — workbook + sheet + cell tables.
-- Replaces the legacy workbooks(data jsonb) shape with a normalized model.
-- Per docs/04_DATABASE_SCHEMA_AND_RLS.md §1.

-- Drop legacy schema if it exists from an earlier iteration. Safe because the
-- only user data lived in localStorage at that point; the legacy `workbooks`
-- table was empty in dev. If you have prod data on the legacy table, run
-- a manual migration first.
drop table if exists cell_history cascade;
drop table if exists workbooks cascade;

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

create index workbook_members_user_idx on workbook_members(user_id);

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

create index sheets_workbook_idx on sheets(workbook_id);

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

create index cells_sheet_idx on cells(sheet_id, row_index, column_index);
create index cells_workbook_idx on cells(workbook_id);

-- RLS
alter table workbooks enable row level security;
alter table workbook_members enable row level security;
alter table sheets enable row level security;
alter table cells enable row level security;

-- Helper: a user has access if owner OR member.
-- Policies are written inline rather than using a function so RLS planner can
-- inline them directly.

-- workbooks: members read; owner manages.
drop policy if exists "workbooks read" on workbooks;
create policy "workbooks read" on workbooks
  for select using (
    owner_id = auth.uid()
    or exists (
      select 1 from workbook_members m
      where m.workbook_id = workbooks.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "workbooks owner manage" on workbooks;
create policy "workbooks owner manage" on workbooks
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- workbook_members: workbook owner manages; members can see the roster.
drop policy if exists "workbook_members read" on workbook_members;
create policy "workbook_members read" on workbook_members
  for select using (
    exists (
      select 1 from workbook_members m
      where m.workbook_id = workbook_members.workbook_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "workbook_members owner manage" on workbook_members;
create policy "workbook_members owner manage" on workbook_members
  for all using (
    exists (
      select 1 from workbooks w
      where w.id = workbook_members.workbook_id and w.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workbooks w
      where w.id = workbook_members.workbook_id and w.owner_id = auth.uid()
    )
  );

-- sheets: same access as parent workbook; viewer cannot mutate.
drop policy if exists "sheets read" on sheets;
create policy "sheets read" on sheets
  for select using (
    exists (
      select 1 from workbooks w
      where w.id = sheets.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

drop policy if exists "sheets editor write" on sheets;
create policy "sheets editor write" on sheets
  for all using (
    exists (
      select 1 from workbooks w
      where w.id = sheets.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  )
  with check (
    exists (
      select 1 from workbooks w
      where w.id = sheets.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  );

-- cells: same access as parent sheet via workbook.
drop policy if exists "cells read" on cells;
create policy "cells read" on cells
  for select using (
    exists (
      select 1 from workbooks w
      where w.id = cells.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

drop policy if exists "cells editor write" on cells;
create policy "cells editor write" on cells
  for all using (
    exists (
      select 1 from workbooks w
      where w.id = cells.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  )
  with check (
    exists (
      select 1 from workbooks w
      where w.id = cells.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  );

-- Auto-update updated_at on every update.
create or replace function quiksheets_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists workbooks_updated_at on workbooks;
create trigger workbooks_updated_at before update on workbooks
  for each row execute function quiksheets_set_updated_at();

drop trigger if exists sheets_updated_at on sheets;
create trigger sheets_updated_at before update on sheets
  for each row execute function quiksheets_set_updated_at();

drop trigger if exists cells_updated_at on cells;
create trigger cells_updated_at before update on cells
  for each row execute function quiksheets_set_updated_at();
-- Quiksheets — collaboration tables: share_links, comments, protected_ranges.
-- Per docs/04_DATABASE_SCHEMA_AND_RLS.md §2.

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  token text unique not null,
  role text not null check (role in ('viewer','editor')),
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists share_links_workbook_idx on share_links(workbook_id);

create table if not exists comments (
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

create index if not exists comments_workbook_idx on comments(workbook_id);
create index if not exists comments_sheet_cell_idx on comments(sheet_id, cell_address);

create table if not exists protected_ranges (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  sheet_id uuid not null references sheets(id) on delete cascade,
  range_ref text not null,
  allowed_user_ids uuid[] default '{}',
  allowed_roles text[] default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- RLS
alter table share_links enable row level security;
alter table comments enable row level security;
alter table protected_ranges enable row level security;

-- share_links: workbook owner manages; nobody else can SELECT (the public
-- /s/[token] route reads via the service role).
drop policy if exists "share_links owner manage" on share_links;
create policy "share_links owner manage" on share_links
  for all using (
    exists (select 1 from workbooks w where w.id = share_links.workbook_id and w.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from workbooks w where w.id = share_links.workbook_id and w.owner_id = auth.uid())
  );

-- comments: workbook members read; editors+ write.
drop policy if exists "comments read" on comments;
create policy "comments read" on comments
  for select using (
    exists (
      select 1 from workbooks w
      where w.id = comments.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

drop policy if exists "comments author write" on comments;
create policy "comments author write" on comments
  for insert with check (
    author_id = auth.uid()
    and exists (
      select 1 from workbooks w
      where w.id = comments.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  );

drop policy if exists "comments author update" on comments;
create policy "comments author update" on comments
  for update using (author_id = auth.uid())
  with check (author_id = auth.uid());

drop policy if exists "comments author delete" on comments;
create policy "comments author delete" on comments
  for delete using (author_id = auth.uid());

-- protected_ranges: workbook owner manages.
drop policy if exists "protected_ranges read" on protected_ranges;
create policy "protected_ranges read" on protected_ranges
  for select using (
    exists (
      select 1 from workbooks w
      where w.id = protected_ranges.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

drop policy if exists "protected_ranges owner manage" on protected_ranges;
create policy "protected_ranges owner manage" on protected_ranges
  for all using (
    exists (select 1 from workbooks w where w.id = protected_ranges.workbook_id and w.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from workbooks w where w.id = protected_ranges.workbook_id and w.owner_id = auth.uid())
  );

drop trigger if exists comments_updated_at on comments;
create trigger comments_updated_at before update on comments
  for each row execute function quiksheets_set_updated_at();
-- Quiksheets — history tables: cell_history, workbook_versions.
-- Per docs/04_DATABASE_SCHEMA_AND_RLS.md §3.

create table if not exists cell_history (
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

create index if not exists cell_history_workbook_idx on cell_history(workbook_id);
create index if not exists cell_history_sheet_cell_idx on cell_history(sheet_id, cell_address);

create table if not exists workbook_versions (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  snapshot_json jsonb not null,
  label text,
  restore_note text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create index if not exists workbook_versions_workbook_idx on workbook_versions(workbook_id, created_at desc);

-- RLS
alter table cell_history enable row level security;
alter table workbook_versions enable row level security;

drop policy if exists "cell_history read" on cell_history;
create policy "cell_history read" on cell_history
  for select using (
    exists (
      select 1 from workbooks w
      where w.id = cell_history.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

drop policy if exists "cell_history insert by editor" on cell_history;
create policy "cell_history insert by editor" on cell_history
  for insert with check (
    changed_by = auth.uid()
    and exists (
      select 1 from workbooks w
      where w.id = cell_history.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  );

drop policy if exists "workbook_versions read" on workbook_versions;
create policy "workbook_versions read" on workbook_versions
  for select using (
    exists (
      select 1 from workbooks w
      where w.id = workbook_versions.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

drop policy if exists "workbook_versions owner manage" on workbook_versions;
create policy "workbook_versions owner manage" on workbook_versions
  for all using (
    exists (select 1 from workbooks w where w.id = workbook_versions.workbook_id and w.owner_id = auth.uid())
  )
  with check (
    exists (select 1 from workbooks w where w.id = workbook_versions.workbook_id and w.owner_id = auth.uid())
  );
-- Quiksheets — feature tables: templates, forms, form_submissions,
-- automations, automation_runs, scratchpads, charts.
-- Per docs/04_DATABASE_SCHEMA_AND_RLS.md §4.

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  description text,
  preview_image_url text,
  workbook_json jsonb not null,
  created_at timestamptz default now()
);

create table if not exists forms (
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

create index if not exists forms_workbook_idx on forms(workbook_id);

create table if not exists form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  row_id text,
  submission_json jsonb not null,
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz default now()
);

create index if not exists form_submissions_form_idx on form_submissions(form_id, submitted_at desc);

create table if not exists automations (
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

create index if not exists automations_workbook_idx on automations(workbook_id);

create table if not exists automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references automations(id) on delete cascade,
  status text not null,
  input_json jsonb default '{}'::jsonb,
  output_json jsonb default '{}'::jsonb,
  error_message text,
  created_at timestamptz default now()
);

create index if not exists automation_runs_automation_idx on automation_runs(automation_id, created_at desc);

create table if not exists scratchpads (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  content text default '',
  updated_at timestamptz default now(),
  unique(workbook_id, user_id)
);

create table if not exists charts (
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

-- RLS
alter table templates enable row level security;
alter table forms enable row level security;
alter table form_submissions enable row level security;
alter table automations enable row level security;
alter table automation_runs enable row level security;
alter table scratchpads enable row level security;
alter table charts enable row level security;

-- templates: read for everyone (gallery); insert restricted to service role
-- (templates are seeded, not user-created).
drop policy if exists "templates public read" on templates;
create policy "templates public read" on templates
  for select using (true);

-- forms: workbook members manage; public forms allow public reads.
drop policy if exists "forms member read" on forms;
create policy "forms member read" on forms
  for select using (
    is_public
    or exists (
      select 1 from workbooks w
      where w.id = forms.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

drop policy if exists "forms editor manage" on forms;
create policy "forms editor manage" on forms
  for all using (
    exists (
      select 1 from workbooks w
      where w.id = forms.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  )
  with check (
    exists (
      select 1 from workbooks w
      where w.id = forms.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  );

-- form_submissions: anyone can submit to public forms; workbook members
-- can read all submissions.
drop policy if exists "form_submissions public insert" on form_submissions;
create policy "form_submissions public insert" on form_submissions
  for insert with check (
    exists (select 1 from forms f where f.id = form_submissions.form_id and f.is_public)
    or exists (
      select 1 from forms f, workbooks w
      where f.id = form_submissions.form_id
        and f.workbook_id = w.id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

drop policy if exists "form_submissions member read" on form_submissions;
create policy "form_submissions member read" on form_submissions
  for select using (
    exists (
      select 1 from forms f, workbooks w
      where f.id = form_submissions.form_id
        and f.workbook_id = w.id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

-- automations + runs: workbook editors manage; runs visible to members.
drop policy if exists "automations editor manage" on automations;
create policy "automations editor manage" on automations
  for all using (
    exists (
      select 1 from workbooks w
      where w.id = automations.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  )
  with check (
    exists (
      select 1 from workbooks w
      where w.id = automations.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  );

drop policy if exists "automation_runs read" on automation_runs;
create policy "automation_runs read" on automation_runs
  for select using (
    exists (
      select 1 from automations a, workbooks w
      where a.id = automation_runs.automation_id
        and a.workbook_id = w.id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

-- scratchpads: strictly private per (workbook_id, user_id).
drop policy if exists "scratchpads self all" on scratchpads;
create policy "scratchpads self all" on scratchpads
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- charts: workbook editors manage; members read.
drop policy if exists "charts read" on charts;
create policy "charts read" on charts
  for select using (
    exists (
      select 1 from workbooks w
      where w.id = charts.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

drop policy if exists "charts editor manage" on charts;
create policy "charts editor manage" on charts
  for all using (
    exists (
      select 1 from workbooks w
      where w.id = charts.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  )
  with check (
    exists (
      select 1 from workbooks w
      where w.id = charts.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  );
-- Quiksheets — P2 platform tables.
-- Per docs/04_DATABASE_SCHEMA_AND_RLS.md §4 (P2 portion).

create table if not exists pivot_tables (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  sheet_id uuid not null references sheets(id) on delete cascade,
  source_range text not null,
  config_json jsonb not null default '{}'::jsonb,
  output_range text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists dashboards (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references workbooks(id) on delete cascade,
  name text not null,
  layout_json jsonb not null default '{}'::jsonb,
  widgets_json jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  workbook_id uuid references workbooks(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text,
  target_id text,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists audit_logs_workbook_idx on audit_logs(workbook_id, created_at desc);

-- RLS
alter table pivot_tables enable row level security;
alter table dashboards enable row level security;
alter table audit_logs enable row level security;

drop policy if exists "pivot_tables editor manage" on pivot_tables;
create policy "pivot_tables editor manage" on pivot_tables
  for all using (
    exists (
      select 1 from workbooks w
      where w.id = pivot_tables.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  )
  with check (
    exists (
      select 1 from workbooks w
      where w.id = pivot_tables.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  );

drop policy if exists "dashboards editor manage" on dashboards;
create policy "dashboards editor manage" on dashboards
  for all using (
    exists (
      select 1 from workbooks w
      where w.id = dashboards.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  )
  with check (
    exists (
      select 1 from workbooks w
      where w.id = dashboards.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid() and m.role in ('owner','editor')
             ))
    )
  );

-- audit_logs are append-only via security-definer functions; no direct
-- writes allowed. Workbook members can read.
drop policy if exists "audit_logs read" on audit_logs;
create policy "audit_logs read" on audit_logs
  for select using (
    workbook_id is null
    or exists (
      select 1 from workbooks w
      where w.id = audit_logs.workbook_id
        and (w.owner_id = auth.uid()
             or exists (
               select 1 from workbook_members m
               where m.workbook_id = w.id and m.user_id = auth.uid()
             ))
    )
  );

-- No insert/update/delete policies — only the service role (server actions)
-- can write audit rows. This is the append-only guarantee from
-- docs/04 §5 line 277.
-- Quiksheets — automatic profile + default workspace creation on signup.
-- Triggered AFTER INSERT ON auth.users. Idempotent.

create or replace function quiksheets_bootstrap_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
  workspace_slug text;
begin
  -- profiles.id is the user's auth.users.id
  insert into profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  -- Generate a slug like 'jane-1a2b3c4d'
  workspace_slug := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), 'workspace'), '[^a-z0-9]+', '-', 'g'))
                  || '-' || substring(replace(new.id::text, '-', ''), 1, 8);

  insert into workspaces (name, slug, owner_id)
  values (
    coalesce(split_part(new.email, '@', 1), 'My workspace') || '''s workspace',
    workspace_slug,
    new.id
  )
  returning id into ws_id;

  insert into workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function quiksheets_bootstrap_user();
