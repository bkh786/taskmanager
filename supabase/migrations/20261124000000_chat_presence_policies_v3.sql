-- Presence ("who is online") permissions, v3.
-- Current Realtime versions check read access for BOTH message types ('presence'
-- and 'broadcast') when someone joins a private channel, so the organization's
-- presence channel needs to allow both to be read. Only presence may be sent.
-- Safe to run more than once.

drop policy if exists chat_presence_read on realtime.messages;
create policy chat_presence_read on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('presence', 'broadcast')
    and (select realtime.topic()) = 'presence:' || (
      select u.org_id::text from public.app_users u where u.id = (select auth.uid())
    )
  );

drop policy if exists chat_presence_write on realtime.messages;
create policy chat_presence_write on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and (select realtime.topic()) = 'presence:' || (
      select u.org_id::text from public.app_users u where u.id = (select auth.uid())
    )
  );
