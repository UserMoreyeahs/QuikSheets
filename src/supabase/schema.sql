-- Workbooks table
create table if not exists workbooks (
  id uuid default gen_random_uuid() primary key,
  name text not null default 'Untitled Spreadsheet',
  owner_id uuid references auth.users(id) on delete cascade,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Row Level Security
alter table workbooks enable row level security;

-- Users can only see their own workbooks
create policy "Users see own workbooks"
  on workbooks for select
  using (auth.uid() = owner_id);

-- Users can insert their own workbooks
create policy "Users insert own workbooks"
  on workbooks for insert
  with check (auth.uid() = owner_id);

-- Users can update their own workbooks
create policy "Users update own workbooks"
  on workbooks for update
  using (auth.uid() = owner_id);

-- Users can delete their own workbooks
create policy "Users delete own workbooks"
  on workbooks for delete
  using (auth.uid() = owner_id);

-- Auto-update updated_at on every update
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger workbooks_updated_at
  before update on workbooks
  for each row execute function update_updated_at();

-- Cell history table (for Session 15)
create table if not exists cell_history (
  id uuid default gen_random_uuid() primary key,
  workbook_id uuid references workbooks(id) on delete cascade,
  sheet_id text not null,
  cell_address text not null,
  old_value text,
  new_value text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz default now()
);

alter table cell_history enable row level security;

create policy "Users see own cell history"
  on cell_history for select
  using (
    exists (
      select 1 from workbooks
      where id = cell_history.workbook_id
      and owner_id = auth.uid()
    )
  );

create policy "Users insert cell history"
  on cell_history for insert
  with check (auth.uid() = changed_by);
