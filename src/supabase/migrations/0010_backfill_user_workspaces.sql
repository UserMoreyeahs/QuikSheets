-- 0010 — Backfill a personal workspace + owner membership for existing users.
--
-- The 0007 signup trigger (quiksheets_bootstrap_user) only creates a workspace
-- for NEW auth.users. Accounts created before the trigger was applied (or for
-- which it didn't fire) have no workspace → the dashboard's pickPrimaryWorkspaceId
-- returns null → new workbooks silently fall back to LOCAL (localStorage) instead
-- of Supabase. (This was compounded by the RLS recursion fixed in 0008/0009.)
--
-- This backfill mirrors the trigger's workspace creation for any user missing a
-- membership. Idempotent: re-running creates nothing once everyone has one.

insert into public.workspaces (name, slug, owner_id)
select
  coalesce(nullif(split_part(u.email, '@', 1), ''), 'My') || '''s workspace',
  lower(regexp_replace(coalesce(nullif(split_part(u.email, '@', 1), ''), 'workspace'), '[^a-z0-9]+', '-', 'g'))
    || '-' || substring(replace(u.id::text, '-', ''), 1, 8),
  u.id
from auth.users u
where not exists (select 1 from public.workspace_members m where m.user_id = u.id)
on conflict do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
where not exists (
  select 1 from public.workspace_members m
  where m.workspace_id = w.id and m.user_id = w.owner_id
)
on conflict (workspace_id, user_id) do nothing;
