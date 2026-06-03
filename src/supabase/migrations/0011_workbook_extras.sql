-- 0011 — workbook_extras: cloud persistence for visualization objects.
--
-- Charts, pivots, sparklines, slicers, images, and overlays live in their own
-- Zustand stores. 0010-era work persisted them to localStorage (survives reload
-- on the SAME device). This table lets them sync across devices/collaborators,
-- exactly like cell data — one JSONB blob per workbook (the blob is the output
-- of collectWorkbookExtras()).
--
-- Idempotent. RLS reuses the non-recursive SECURITY DEFINER helpers from
-- 0008/0009 (is_workbook_member / is_workbook_owner) so there is no recursion.

create table if not exists public.workbook_extras (
  workbook_id uuid primary key references public.workbooks(id) on delete cascade,
  extras_json jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create or replace function public.quiksheets_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workbook_extras_updated_at on public.workbook_extras;
create trigger workbook_extras_updated_at
  before update on public.workbook_extras
  for each row execute function public.quiksheets_set_updated_at();

alter table public.workbook_extras enable row level security;

-- Anyone who can READ the workbook can read its extras.
drop policy if exists "workbook_extras read" on public.workbook_extras;
create policy "workbook_extras read" on public.workbook_extras
  for select using (
    public.is_workbook_owner(workbook_id, auth.uid())
    or public.is_workbook_member(workbook_id, auth.uid())
  );

-- Owners + editors can write. (Editor check via membership row; viewers can't.)
drop policy if exists "workbook_extras write" on public.workbook_extras;
create policy "workbook_extras write" on public.workbook_extras
  for all using (
    public.is_workbook_owner(workbook_id, auth.uid())
    or exists (
      select 1 from public.workbook_members m
      where m.workbook_id = workbook_extras.workbook_id
        and m.user_id = auth.uid()
        and m.role = 'editor'
    )
  )
  with check (
    public.is_workbook_owner(workbook_id, auth.uid())
    or exists (
      select 1 from public.workbook_members m
      where m.workbook_id = workbook_extras.workbook_id
        and m.user_id = auth.uid()
        and m.role = 'editor'
    )
  );
