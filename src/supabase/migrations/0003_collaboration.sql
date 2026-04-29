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
