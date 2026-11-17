-- Runs the alert job every 10 minutes: overdue escalation steps and scheduled
-- announcements. Uses the same shared secret (vault: cron_secret) as the reminder job.
-- Run once in the Supabase SQL editor. Change the URL if the app lives elsewhere.
select cron.unschedule('app-alerts-every-10-min')
where exists (select 1 from cron.job where jobname = 'app-alerts-every-10-min');

select cron.schedule(
  'app-alerts-every-10-min',
  '*/10 * * * *',
  $cmd$
    select net.http_post(
      url := 'https://task.digipresence.in/api/cron/alerts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cmd$
);
