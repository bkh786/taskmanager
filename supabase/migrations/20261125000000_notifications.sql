-- In-app notifications (general + critical), automatic alert rules, announcements,
-- and Web Push device subscriptions.

-- ------------------------------------------------------------------ notifications
-- One row per person per message. Written by the server only; each person can read
-- their own, mark them read / acknowledged, and clear them.
create table if not exists public.notifications (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references public.organizations(id) on delete cascade,
  user_id         uuid not null references public.app_users(id) on delete cascade,
  level           text not null default 'info' check (level in ('info', 'critical')),
  kind            text not null default 'custom',
  title           text not null check (char_length(btrim(title)) between 1 and 200),
  body            text,
  link            text,
  source          text not null default 'system' check (source in ('rule', 'announcement', 'platform', 'system')),
  ref_id          uuid,
  -- Makes a message idempotent: the same event never notifies the same person twice.
  dedupe_key      text not null default gen_random_uuid()::text,
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  acknowledged_at timestamptz,
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
create index if not exists notifications_ref_idx on public.notifications (ref_id);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at, acknowledged_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ------------------------------------------------------------------ automatic alert rules (per organization)
create table if not exists public.notification_rules (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  kind        text not null check (kind in ('task_completed', 'task_assigned', 'task_overdue')),
  name        text not null default '',
  enabled     boolean not null default true,
  level       text not null default 'info' check (level in ('info', 'critical')),
  -- Overdue rules only: how many days after the due date this step fires.
  after_days  integer not null default 0 check (after_days between 0 and 365),
  to_assignee boolean not null default false,
  to_creator  boolean not null default false,
  to_l1       boolean not null default false,
  to_l2       boolean not null default false,
  to_admins   boolean not null default false,
  send_push   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists notification_rules_org_idx on public.notification_rules (org_id, kind);
alter table public.notification_rules enable row level security;
revoke all on public.notification_rules from anon, authenticated;
grant all on public.notification_rules to service_role;

-- ------------------------------------------------------------------ announcements
-- org_id null = a platform announcement (from the platform owner, e.g. a feature update).
create table if not exists public.announcements (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references public.organizations(id) on delete cascade,
  created_by      uuid references public.app_users(id) on delete set null,
  level           text not null default 'info' check (level in ('info', 'critical')),
  title           text not null check (char_length(btrim(title)) between 1 and 200),
  body            text,
  link            text,
  -- {"scope":"all"} | {"scope":"roles","roles":[..]} | {"scope":"projects","project_ids":[..]}
  -- | {"scope":"users","user_ids":[..]}; platform ones also carry "org_ids" and "admins_only".
  audience        jsonb not null default '{"scope":"all"}'::jsonb,
  send_push       boolean not null default true,
  publish_at      timestamptz,
  status          text not null default 'sent' check (status in ('scheduled', 'sent', 'cancelled', 'withdrawn')),
  sent_at         timestamptz,
  recipient_count integer not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists announcements_org_idx on public.announcements (org_id, created_at desc);
create index if not exists announcements_due_idx on public.announcements (publish_at) where status = 'scheduled';
alter table public.announcements enable row level security;
revoke all on public.announcements from anon, authenticated;
grant all on public.announcements to service_role;

-- ------------------------------------------------------------------ push devices
create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.app_users(id) on delete cascade,
  org_id       uuid references public.organizations(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant all on public.push_subscriptions to service_role;

-- Per-person push preferences (a device is opted in by subscribing; these choose what is pushed).
create table if not exists public.notification_prefs (
  user_id       uuid primary key references public.app_users(id) on delete cascade,
  push_info     boolean not null default true,
  push_critical boolean not null default true
);
alter table public.notification_prefs enable row level security;

drop policy if exists notification_prefs_select on public.notification_prefs;
create policy notification_prefs_select on public.notification_prefs
  for select to authenticated using (user_id = auth.uid());
drop policy if exists notification_prefs_write on public.notification_prefs;
create policy notification_prefs_write on public.notification_prefs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.notification_prefs from anon, authenticated;
grant select, insert, update on public.notification_prefs to authenticated;
grant all on public.notification_prefs to service_role;

-- ------------------------------------------------------------------ starting rules for every organization
-- A task completion tells the task's creator; an assignment tells the assignee; and an
-- overdue task escalates: day 1 the assignee, day 3 also their manager, day 7 also the
-- manager's manager and the org admins. Admins can change all of this in Notification Center.
insert into public.notification_rules (org_id, kind, name, level, after_days, to_assignee, to_creator, to_l1, to_l2, to_admins, send_push)
select o.id, r.kind, r.name, r.level, r.after_days, r.to_assignee, r.to_creator, r.to_l1, r.to_l2, r.to_admins, true
from public.organizations o
cross join (values
  ('task_completed', 'Task completed',            'info',     0, false, true,  false, false, false),
  ('task_assigned',  'Task assigned',             'info',     0, true,  false, false, false, false),
  ('task_overdue',   'Overdue — first reminder',  'critical', 1, true,  false, false, false, false),
  ('task_overdue',   'Overdue — escalate to manager', 'critical', 3, true, false, true, false, false),
  ('task_overdue',   'Overdue — escalate further', 'critical', 7, true,  false, true,  true,  true)
) as r(kind, name, level, after_days, to_assignee, to_creator, to_l1, to_l2, to_admins)
where not exists (select 1 from public.notification_rules x where x.org_id = o.id);
