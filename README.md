# Task Manager

Multi-tenant task management app. Next.js (App Router) + Supabase (Postgres, Auth, Storage, Edge Functions) + Vercel.

## Roles

- **platform_owner** — creates/manages tenants (organizations), nothing else.
- **master_admin** — full control within their own org (settings, users, SMTP config).
- **reporting_manager** — creates/manages users and tasks within their reporting chain; bulk upload/copy; reports.
- **user** — sees only their own assigned tasks; marks complete; requests date changes.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase Project Settings → API.
   - `SUPABASE_SERVICE_ROLE_KEY` — same page, **secret**, server-only. Needed for creating Supabase Auth users (manager/admin user-creation flows) and the reminder cron.
   - `NEXT_PUBLIC_APP_URL` — used to build links in emails and reports.
3. `npm run dev`, open http://localhost:3000.

### Seeding dev accounts

`node scripts/seed-dev-users.mjs` creates one account per role (platform_owner, master_admin, reporting_manager, user) under a demo "Acme Corporation" org, all with password `DevPass123!`. Reads Supabase config from `.env.local`. Safe to re-run.

## Database

Schema, RLS policies, the recurrence engine (`generate_task_instances`), and the reporting-chain helper all live in Supabase as SQL migrations (see the Supabase dashboard's Migrations tab, or `supabase db pull` if you have the CLI linked). Notable pieces:

- `private.current_org_id()` / `private.current_role()` — non-recursive helpers RLS policies use to resolve "my org / my role" (a raw self-referencing subquery on `app_users` doesn't work under RLS — it can't read its own row without already knowing the answer).
- `generate_task_instances(task_id, horizon_date)` — materializes `task_instances` for a task up to `horizon_date` (default: 60 days out). Idempotent. Called after every task create/bulk-upload/bulk-copy, and nightly via `pg_cron` (`refresh_all_task_instances()`) to keep the rolling window full for existing recurring tasks.
- `reporting_chain(manager_id)` — direct + indirect reportees, used to scope what a reporting_manager can see/assign.

## Email

Task-assigned / task-completed / date-change-request emails send immediately from Next.js server actions via each org's own SMTP config (Organization Settings page), using Nodemailer. A send failure is logged to `notification_log` and never blocks the underlying action.

Scheduled reminders (upcoming/delayed/missed, only for `reminder_enabled` tasks) run as the `send-reminders` Supabase Edge Function (`supabase/functions/send-reminders`), invoked by `pg_cron` every 15 minutes. It checks each active org's `reminder_time` and sends at most one batch per org per day.

## Deploying

- **Vercel**: import this repo, set the same env vars as `.env.local` (service role key included — it's only used in server actions/route handlers, never sent to the client).
- **Supabase Edge Function**: already deployed via the Supabase MCP during development; redeploy with `supabase functions deploy send-reminders` if you change it locally.
