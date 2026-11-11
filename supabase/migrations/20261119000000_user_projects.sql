-- A user can belong to more than one project / department.
-- app_users.project_id stays as the user's primary (first) project so everything
-- that already reads it keeps working; this table holds the full set.
create table if not exists public.user_projects (
  user_id    uuid not null references public.app_users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

create index if not exists user_projects_project_idx on public.user_projects (project_id);

-- Everyone already mapped to a project keeps it.
insert into public.user_projects (user_id, project_id)
select id, project_id from public.app_users where project_id is not null
on conflict do nothing;

alter table public.user_projects enable row level security;

-- Readable by people in the same organization; changes go through the app's
-- server actions (service role) after the role checks.
drop policy if exists user_projects_select on public.user_projects;
create policy user_projects_select on public.user_projects
  for select to authenticated
  using (
    exists (
      select 1 from public.app_users u
      where u.id = user_projects.user_id and u.org_id = private.current_org_id()
    )
  );

grant select on public.user_projects to authenticated;
grant all on public.user_projects to service_role;
