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
