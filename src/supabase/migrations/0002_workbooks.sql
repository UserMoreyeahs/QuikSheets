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
