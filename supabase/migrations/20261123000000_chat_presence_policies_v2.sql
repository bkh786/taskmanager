-- Presence ("who is online") permissions, v2.
-- The previous version compared the channel name with private.current_org_id(),
-- which Realtime's permission check does not evaluate the same way as a table
-- policy. This one reads the person's organization straight from their profile.
-- Safe to run more than once.

drop policy if exists chat_presence_read on realtime.messages;
create policy chat_presence_read on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'presence'
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

-- Shows what is in place, so a problem is easy to see.
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'realtime' and tablename = 'messages'
order by policyname;
