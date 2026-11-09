-- Configurable email: SMTP details, per-event templates, per-task options.
-- Also closes two pre-existing security gaps found while building it (see bottom).

-- ---------------------------------------------------------------- SMTP settings
alter table public.organizations
  add column if not exists smtp_secure text not null default 'auto'
    check (smtp_secure in ('auto', 'starttls', 'ssl', 'none')),
  add column if not exists smtp_from_name text,
  add column if not exists smtp_cc_enabled boolean not null default false,
  add column if not exists smtp_cc text,
  add column if not exists smtp_bcc_enabled boolean not null default false,
  add column if not exists smtp_bcc text,
  add column if not exists email_signature text;

-- ---------------------------------------------------------------- per-task options
alter table public.tasks
  add column if not exists notify_on_complete boolean not null default true,
  add column if not exists notification_cc text;

-- ---------------------------------------------------------------- templates
create table if not exists public.org_email_templates (
  org_id uuid not null references public.organizations(id) on delete cascade,
  event text not null,
  enabled boolean not null default true,
  subject text,   -- null = use the built-in default
  body text,      -- null = use the built-in default
  updated_at timestamptz not null default now(),
  primary key (org_id, event)
);

alter table public.org_email_templates enable row level security;

drop policy if exists org_email_templates_select on public.org_email_templates;
create policy org_email_templates_select on public.org_email_templates
  for select using (org_id = private.current_org_id());

drop policy if exists org_email_templates_write on public.org_email_templates;
create policy org_email_templates_write on public.org_email_templates
  for all
  using (org_id = private.current_org_id() and private."current_role"() = 'master_admin'::system_role)
  with check (org_id = private.current_org_id() and private."current_role"() = 'master_admin'::system_role);

revoke all on public.org_email_templates from anon;

-- ---------------------------------------------------------------- security fix 1
-- SMTP credentials were readable by EVERY logged-in user of an org (the org-row
-- read policy has no role check). Make them write-only for the API; the server
-- reads them with the service role.
revoke select on public.organizations from authenticated;
revoke select on public.organizations from anon;
grant select (
  id, name, slug, plan, max_users, billing_status, is_active, auto_deactivate_date,
  created_at, reminder_time, logo_url, custom_login_domain,
  smtp_host, smtp_port, smtp_from_email, smtp_secure, smtp_from_name,
  smtp_cc_enabled, smtp_cc, smtp_bcc_enabled, smtp_bcc, email_signature
) on public.organizations to authenticated;

-- ---------------------------------------------------------------- security fix 2
-- org_branding is a plain updatable view owned by a role that bypasses RLS, and
-- anon had INSERT/UPDATE/DELETE on it: anyone with the public key could rename
-- or delete organizations (deletes cascade to users and tasks). Read-only now;
-- the login page only needs SELECT.
revoke all on public.org_branding from anon, authenticated;
grant select on public.org_branding to anon, authenticated;
