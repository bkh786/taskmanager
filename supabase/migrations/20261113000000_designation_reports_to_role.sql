-- A designation can report to a system role (e.g. Org Admin) as well as to another designation.
alter table public.designations
  add column if not exists reports_to_role text
    check (reports_to_role in ('master_admin', 'reporting_manager'));
