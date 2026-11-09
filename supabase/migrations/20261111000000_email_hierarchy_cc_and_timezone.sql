-- Per-notification Cc/Bcc of the recipient's reporting managers, and an org timezone.

alter table public.org_email_templates
  add column if not exists cc_l1  boolean not null default false,
  add column if not exists cc_l2  boolean not null default false,
  add column if not exists bcc_l1 boolean not null default false,
  add column if not exists bcc_l2 boolean not null default false;

alter table public.organizations
  add column if not exists timezone text not null default 'Asia/Kolkata';

-- Column-level read access is granted explicitly on organizations (SMTP credentials stay hidden).
grant select (timezone) on public.organizations to authenticated;
