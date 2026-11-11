-- Month filter: only months that actually have tasks in scope.
create or replace function public.dashboard_task_months(p_assignee_ids uuid[])
returns table (month text)
language sql stable security invoker set search_path = public
as $$
  select distinct to_char(ti.due_date, 'YYYY-MM')
  from public.task_instances ti
  where ti.removed = false
    and (p_assignee_ids is null or ti.assignee_id = any (p_assignee_ids))
  order by 1 desc
$$;
revoke all on function public.dashboard_task_months(uuid[]) from public, anon;
grant execute on function public.dashboard_task_months(uuid[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Plan Master, tenant billing, invoices, platform email (SMTP + templates)
-- ---------------------------------------------------------------------------

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  price numeric(12,2) not null default 0,
  currency text not null default 'INR',
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly','quarterly','semi_annual','annual','one_time')),
  included_users integer,
  extra_user_price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.organizations
  add column if not exists plan_id uuid references public.plans(id) on delete set null,
  add column if not exists billing_cycle text
    check (billing_cycle in ('monthly','quarterly','semi_annual','annual','one_time')),
  add column if not exists billing_start_date date,
  add column if not exists next_billing_date date,
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('trial','pending','paid','overdue','cancelled')),
  add column if not exists price_override numeric(12,2),
  add column if not exists billing_email text,
  add column if not exists billing_notes text;

create sequence if not exists public.invoice_number_seq start 1001;

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  invoice_number text not null unique
    default ('INV-' || to_char(now(), 'YYYY') || '-' || nextval('public.invoice_number_seq')),
  plan_name text,
  billing_cycle text,
  period_start date not null,
  period_end date,
  amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  status text not null default 'pending'
    check (status in ('pending','paid','overdue','void')),
  issued_on date not null default current_date,
  due_on date not null default current_date,
  paid_on date,
  payment_method text,
  payment_reference text,
  notes text,
  emailed_at timestamptz,
  overdue_notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, period_start)
);
create index if not exists invoices_org_idx on public.invoices (org_id, period_start desc);
create index if not exists invoices_status_idx on public.invoices (status, due_on);

-- One row of platform-level (Digi Presence -> tenants) mail settings.
create table if not exists public.platform_email_settings (
  id integer primary key default 1 check (id = 1),
  smtp_host text,
  smtp_port integer,
  smtp_username text,
  smtp_password text,
  smtp_secure text not null default 'auto',
  smtp_from_email text,
  smtp_from_name text,
  reply_to text,
  email_signature text,
  billing_cc text,
  updated_at timestamptz not null default now()
);
insert into public.platform_email_settings (id) values (1) on conflict do nothing;

create table if not exists public.platform_email_templates (
  event text primary key,
  enabled boolean not null default true,
  subject text,
  body text,
  updated_at timestamptz not null default now()
);

-- Service role only: these hold billing data and mail credentials.
alter table public.plans enable row level security;
alter table public.invoices enable row level security;
alter table public.platform_email_settings enable row level security;
alter table public.platform_email_templates enable row level security;
revoke all on public.plans, public.invoices, public.platform_email_settings, public.platform_email_templates from anon, authenticated;
grant all on public.plans, public.invoices, public.platform_email_settings, public.platform_email_templates to service_role;
grant usage on sequence public.invoice_number_seq to service_role;

-- Starter plans (edit or replace in Plan Master).
insert into public.plans (name, description, price, billing_cycle, included_users, extra_user_price) values
  ('Starter', 'Small teams getting started', 4999, 'monthly', 25, 150),
  ('Business', 'Growing organizations', 12999, 'monthly', 100, 120),
  ('Enterprise', 'Large organizations, custom needs', 99999, 'annual', 500, 100)
on conflict (name) do nothing;

-- Existing tenants: link the old free-text plan to the new plan rows.
update public.organizations o
set plan_id = p.id,
    billing_cycle = coalesce(o.billing_cycle, p.billing_cycle),
    payment_status = case lower(o.billing_status)
      when 'paid' then 'paid' when 'trial' then 'trial'
      when 'overdue' then 'overdue' when 'cancelled' then 'cancelled' else 'pending' end
from public.plans p
where o.plan_id is null and lower(o.plan) = lower(p.name);
