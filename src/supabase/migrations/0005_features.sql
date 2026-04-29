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
