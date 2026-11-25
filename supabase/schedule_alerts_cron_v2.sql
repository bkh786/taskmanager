-- Lighter alert schedule (replaces the every-10-minutes job).
--
-- Overdue reminders are counted in whole days, so they only need to be checked a few
-- times a day. Scheduled announcements are only called when one is actually due, so on
-- most days that part costs no server time at all.
--
-- Run once in the Supabase SQL editor. Change the URL if the app lives elsewhere.
select cron.unschedule(jobname) from cron.job
where jobname in ('app-alerts-every-10-min', 'app-alerts-overdue', 'app-alerts-announcements');

-- 1) Overdue escalation: 4 times a day (04:00, 08:00, 12:00, 16:00 UTC = 09:30, 13:30, 17:30, 21:30 IST).
select cron.schedule(
  'app-alerts-overdue',
  '0 4,8,12,16 * * *',
  $cmd$
    select net.http_post(
      url := 'https://task.digipresence.in/api/cron/alerts?only=overdue',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cmd$
);

-- 2) Scheduled announcements: checked every 10 minutes inside the database,
--    and the app is only called when one is due.
select cron.schedule(
  'app-alerts-announcements',
  '*/10 * * * *',
  $cmd$
    select net.http_post(
      url := 'https://task.digipresence.in/api/cron/alerts?only=announcements',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    )
    where exists (
      select 1 from public.announcements
      where status = 'scheduled' and publish_at <= now()
    );
  $cmd$
);
