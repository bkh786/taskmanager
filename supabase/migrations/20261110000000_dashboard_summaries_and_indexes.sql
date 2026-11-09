-- Dashboard summaries computed in the database, plus supporting indexes.
--
-- The dashboard used to download every task instance (through an API that
-- silently caps each response at 1,000 rows) and count them in the app.
-- These functions return only what each screen shows. They are SECURITY
-- INVOKER, so row-level security still applies; p_assignee_ids narrows the
-- scope (NULL = everyone the caller's RLS lets them see in their org).
--
-- Bucket rules mirror bucketOf() in src/lib/task-status.ts:
--   completed | delayed (due < today) | today | week (today+1 .. today+6) | upcoming

create or replace function public.dashboard_task_rows(p_assignee_ids uuid[])
returns table (
  id uuid, task_id uuid, due_date date, status public.instance_status,
  completed_at timestamptz, comment text, attachment_url text,
  assignee_id uuid, original_assignee_id uuid,
  task_name text, description text, is_recurring boolean,
  recurrence_kind public.recurrence_kind, reminder_enabled boolean,
  assignee_name text, assignee_role public.system_role,
  assignee_manager_name text, project_name text, instance_count integer
)
language sql stable security invoker set search_path = public
as $$
  -- One row per task: its earliest still-open occurrence, or (if every
  -- occurrence is done) the most recently completed one.
  with scoped as (
    select ti.*, count(*) over (partition by ti.task_id) as n
    from public.task_instances ti
    where ti.removed = false
      and (p_assignee_ids is null or ti.assignee_id = any (p_assignee_ids))
  ), rep as (
    select distinct on (s.task_id) s.*
    from scoped s
    order by s.task_id,
             (coalesce(s.status::text, '') = 'completed'),
             case when coalesce(s.status::text, '') <> 'completed' then s.due_date end asc nulls last,
             case when coalesce(s.status::text, '') = 'completed'
                  then coalesce(s.completed_at, s.due_date::timestamptz) end desc nulls last
  )
  select r.id, r.task_id, r.due_date, r.status, r.completed_at, r.comment, r.attachment_url,
         r.assignee_id, r.original_assignee_id,
         t.task_name, t.description, coalesce(t.is_recurring, false),
         coalesce(t.recurrence_kind, 'one_time'::public.recurrence_kind),
         coalesce(t.reminder_enabled, false),
         a.full_name, a.system_role, m.full_name, p.name, r.n::int
  from rep r
  join public.tasks t on t.id = r.task_id
  join public.app_users a on a.id = r.assignee_id
  left join public.app_users m on m.id = a.reports_to
  left join public.projects p on p.id = a.project_id
  order by r.due_date asc, r.id
$$;

create or replace function public.dashboard_kpis(p_assignee_ids uuid[], p_today date)
returns table (
  total_instances integer, due_today integer, due_week integer,
  delayed integer, completed integer, unique_tasks integer
)
language sql stable security invoker set search_path = public
as $$
  select
    count(*)::int,
    (count(*) filter (where coalesce(ti.status::text, '') <> 'completed' and ti.due_date = p_today))::int,
    (count(*) filter (where coalesce(ti.status::text, '') <> 'completed'
                      and ti.due_date > p_today and ti.due_date <= p_today + 6))::int,
    (count(*) filter (where coalesce(ti.status::text, '') <> 'completed' and ti.due_date < p_today))::int,
    (count(*) filter (where coalesce(ti.status::text, '') = 'completed'))::int,
    count(distinct ti.task_id)::int
  from public.task_instances ti
  where ti.removed = false
    and (p_assignee_ids is null or ti.assignee_id = any (p_assignee_ids))
$$;

create or replace function public.dashboard_breakdown(p_assignee_ids uuid[], p_today date, p_mode text)
returns table (label text, total integer, completed integer, delayed integer)
language sql stable security invoker set search_path = public
as $$
  select g.label, count(*)::int,
         (count(*) filter (where g.done))::int,
         (count(*) filter (where not g.done and g.due_date < p_today))::int
  from (
    select
      case p_mode
        when 'project'  then coalesce(p.name, 'No project')
        when 'employee' then a.full_name
        when 'manager'  then coalesce(m.full_name, 'No manager')
        else case a.system_role
               when 'platform_owner'    then 'Platform Owner'
               when 'master_admin'      then 'Org Admin'
               when 'reporting_manager' then 'Reporting Manager'
               else 'Employee' end
      end as label,
      (coalesce(ti.status::text, '') = 'completed') as done,
      ti.due_date
    from public.task_instances ti
    join public.app_users a on a.id = ti.assignee_id
    left join public.app_users m on m.id = a.reports_to
    left join public.projects p on p.id = a.project_id
    where ti.removed = false
      and (p_assignee_ids is null or ti.assignee_id = any (p_assignee_ids))
  ) g
  group by g.label
  order by count(*) desc, g.label
$$;

-- Calendar: at most 4 entries per day (that is all the grid shows).
create or replace function public.dashboard_calendar(p_assignee_ids uuid[], p_from date, p_to date)
returns table (id uuid, due_date date, status public.instance_status, task_name text)
language sql stable security invoker set search_path = public
as $$
  select x.id, x.due_date, x.status, x.task_name
  from (
    select ti.id, ti.due_date, ti.status, t.task_name,
           row_number() over (partition by ti.due_date order by t.task_name, ti.id) as rn
    from public.task_instances ti
    join public.tasks t on t.id = ti.task_id
    where ti.removed = false
      and ti.due_date between p_from and p_to
      and (p_assignee_ids is null or ti.assignee_id = any (p_assignee_ids))
  ) x
  where x.rn <= 4
  order by x.due_date, x.rn
$$;

-- New functions default to being callable by anonymous visitors; keep them to signed-in users.
revoke all on function public.dashboard_task_rows(uuid[]) from public, anon;
revoke all on function public.dashboard_kpis(uuid[], date) from public, anon;
revoke all on function public.dashboard_breakdown(uuid[], date, text) from public, anon;
revoke all on function public.dashboard_calendar(uuid[], date, date) from public, anon;
grant execute on function public.dashboard_task_rows(uuid[]) to authenticated, service_role;
grant execute on function public.dashboard_kpis(uuid[], date) to authenticated, service_role;
grant execute on function public.dashboard_breakdown(uuid[], date, text) to authenticated, service_role;
grant execute on function public.dashboard_calendar(uuid[], date, date) to authenticated, service_role;

-- ---------------------------------------------------------------- indexes
-- notification_log (20k+ rows) had only its primary key; the reminder job and
-- password-reset throttle both filter it by type/recipient and time.
create index if not exists notification_log_org_type_sent_idx
  on public.notification_log (org_id, notif_type, sent_at desc);
create index if not exists notification_log_task_instance_idx
  on public.notification_log (task_instance_id);
create index if not exists notification_log_recipient_idx
  on public.notification_log (recipient_email, notif_type, sent_at desc);

-- Reports and the calendar filter by due date across the whole org.
create index if not exists task_instances_due_date_idx
  on public.task_instances (due_date);
