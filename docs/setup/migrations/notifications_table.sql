-- Quiksheets — create the `notifications` table for @-mention alerts.
--
-- Each row represents one in-app notification for one recipient user.
-- Currently produced when a comment containing @mentions is inserted;
-- future work may add other notification types (e.g. "sheet shared",
-- "version restored").
--
-- Idempotent: every step is guarded so the migration can be re-run
-- safely on any Quiksheets project (fresh or existing).

-- 1. Create the table if it doesn't exist.
create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  -- Who receives the notification.
  user_id     uuid        not null references auth.users(id) on delete cascade,
  -- Scope — allows efficient per-workbook queries and badge counts.
  workbook_id uuid        not null references public.workbooks(id) on delete cascade,
  sheet_id    text        not null default '',
  -- The comment that triggered the notification (nullable so other types
  -- can reuse this table in future without a comment reference).
  comment_id  uuid        references public.comments(id) on delete cascade,
  -- Who did the action (e.g. who wrote the comment containing the mention).
  actor_id    uuid        references auth.users(id) on delete set null,
  -- Notification category. 'mention' is the only type today.
  type        text        not null default 'mention',
  -- Human-readable body rendered in the bell dropdown.
  body        text        not null default '',
  -- False = unread (badge-worthy), true = dismissed/read.
  read        boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- 2. Indexes for the two queries we issue: per-user unread count + full list.
create index if not exists notifications_user_read_idx
  on public.notifications(user_id, read);

create index if not exists notifications_workbook_idx
  on public.notifications(workbook_id);

-- 3. Row-Level Security — a user can only see and manage their own rows.
alter table public.notifications enable row level security;

-- SELECT: only the recipient can read their notifications.
drop policy if exists "notifications self select" on public.notifications;
create policy "notifications self select" on public.notifications
  for select using (user_id = auth.uid());

-- UPDATE: only the recipient can mark notifications read.
drop policy if exists "notifications self update" on public.notifications;
create policy "notifications self update" on public.notifications
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INSERT: any authenticated workbook member may insert a notification
-- row (i.e. the comment author inserting on behalf of the mentioned
-- user). We rely on application code to set user_id correctly; the
-- actor must be a member of the workbook.
drop policy if exists "notifications member insert" on public.notifications;
create policy "notifications member insert" on public.notifications
  for insert with check (
    -- The acting user must be a member of (or owner of) the workbook.
    workbook_id in (
      select id from public.workbooks where owner_id = auth.uid()
      union
      select workbook_id from public.workbook_members where user_id = auth.uid()
    )
  );

-- DELETE: allow the recipient to delete their own notifications (optional
-- future "clear all" button). Not strictly required for the current UI.
drop policy if exists "notifications self delete" on public.notifications;
create policy "notifications self delete" on public.notifications
  for delete using (user_id = auth.uid());
