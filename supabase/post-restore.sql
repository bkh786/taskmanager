-- Everything the schema/data dumps don't carry. Run by scripts/replicate-to-new-project.sh
-- inside the restore transaction; psql variables: new_url, service_key, cron_secret, app_url.
select pg_catalog.set_config('search_path', 'public, extensions', false);

-- Public bucket for org logos (task proof files live in Backblaze B2, so no
-- task-attachments bucket is created).
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

create policy org_logos_select on storage.objects for select using (
  bucket_id = 'org-logos' and (
    private."current_role"() = 'platform_owner'::system_role
    or (private."current_role"() = 'master_admin'::system_role
        and (storage.foldername(name))[1] = (private.current_org_id())::text)
  )
);
create policy org_logos_insert on storage.objects for insert with check (
  bucket_id = 'org-logos' and (
    private."current_role"() = 'platform_owner'::system_role
    or (private."current_role"() = 'master_admin'::system_role
        and (storage.foldername(name))[1] = (private.current_org_id())::text)
  )
);
create policy org_logos_update on storage.objects for update using (
  bucket_id = 'org-logos' and (
    private."current_role"() = 'platform_owner'::system_role
    or (private."current_role"() = 'master_admin'::system_role
        and (storage.foldername(name))[1] = (private.current_org_id())::text)
  )
);
create policy org_logos_delete on storage.objects for delete using (
  bucket_id = 'org-logos' and (
    private."current_role"() = 'platform_owner'::system_role
    or (private."current_role"() = 'master_admin'::system_role
        and (storage.foldername(name))[1] = (private.current_org_id())::text)
  )
);

-- Secrets the reminder cron job reads. service_role_key is the NEW project's;
-- cron_secret is copied from the old project's vault so it keeps matching the
-- CRON_SECRET env var in Vercel.
select vault.create_secret(:'service_key', 'service_role_key', 'read by the send-reminders cron job');
select vault.create_secret(:'cron_secret', 'cron_secret', 'read by the send-reminders cron job');

select cron.schedule(
  'refresh-task-instances-nightly',
  '17 2 * * *',
  'select refresh_all_task_instances();'
);

select cron.schedule(
  'send-reminders-every-15-min',
  '*/15 * * * *',
  format($cmd$
    select net.http_post(
      url := %L || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'service_role_key'
        )
      ),
      body := jsonb_build_object(
        'app_url', %L,
        'cron_secret', (
          select decrypted_secret from vault.decrypted_secrets
          where name = 'cron_secret'
        )
      ),
      timeout_milliseconds := 55000
    );
  $cmd$, :'new_url', :'app_url')
);

-- Re-apply the function lockdown from the old project's security migrations.
-- The new project's default privileges grant EXECUTE to anon/authenticated on
-- every new function, which the dump doesn't undo.
revoke all on function public.current_app_user() from public, anon, authenticated;
revoke all on function public.refresh_all_task_instances() from public, anon, authenticated;
revoke all on function public.generate_task_instances(uuid, date) from public, anon;
