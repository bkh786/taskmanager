-- Plan pricing matrix: a monthly price and an optional one-time price per plan;
-- quarterly / semi-annual / annual prices are derived from the monthly price
-- using platform-wide discount percentages.
alter table public.plans add column if not exists one_time_price numeric(12,2);

create table if not exists public.billing_settings (
  id integer primary key default 1 check (id = 1),
  discount_quarterly numeric(5,2) not null default 8 check (discount_quarterly between 0 and 100),
  discount_semi_annual numeric(5,2) not null default 12 check (discount_semi_annual between 0 and 100),
  discount_annual numeric(5,2) not null default 20 check (discount_annual between 0 and 100),
  updated_at timestamptz not null default now()
);
insert into public.billing_settings (id) values (1) on conflict do nothing;

alter table public.billing_settings enable row level security;
revoke all on public.billing_settings from anon, authenticated;
grant all on public.billing_settings to service_role;
