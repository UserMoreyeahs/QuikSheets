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
