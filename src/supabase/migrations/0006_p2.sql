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
