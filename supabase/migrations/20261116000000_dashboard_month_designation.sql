-- Dashboard: month-windowed task rows, and a Designation breakdown (replacing Role).

-- Same as dashboard_task_rows, but only occurrences due inside [p_from, p_to].
create or replace function public.dashboard_task_rows_window(
  p_assignee_ids uuid[], p_from date, p_to date
)
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
  with scoped as (
    select ti.*, count(*) over (partition by ti.task_id) as n
    from public.task_instances ti
    where ti.removed = false
      and ti.due_date between p_from and p_to
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

revoke all on function public.dashboard_task_rows_window(uuid[], date, date) from public, anon;
grant execute on function public.dashboard_task_rows_window(uuid[], date, date) to authenticated, service_role;

-- Breakdown now groups by designation instead of system role.
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
        when 'project'     then coalesce(p.name, 'No project')
        when 'employee'    then a.full_name
        when 'manager'     then coalesce(m.full_name, 'No manager')
        when 'designation' then coalesce(d.name, 'No designation')
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
    left join public.designations d on d.id = a.designation_id
    where ti.removed = false
      and (p_assignee_ids is null or ti.assignee_id = any (p_assignee_ids))
  ) g
  group by g.label
  order by count(*) desc, g.label
$$;
