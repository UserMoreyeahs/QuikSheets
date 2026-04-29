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
