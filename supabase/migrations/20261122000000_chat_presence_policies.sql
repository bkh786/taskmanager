-- Re-creates the "who is online" permissions on the Realtime schema.
-- These were part of 20261114000000_chat.sql, but policies on the realtime
-- schema are not carried over when a project is restored from a dump, so on the
-- new project everyone showed as offline (and so call buttons stayed disabled).
-- Safe to run more than once.

drop policy if exists chat_presence_read on realtime.messages;
create policy chat_presence_read on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'presence'
    and (select realtime.topic()) = 'presence:' || (select private.current_org_id())::text
  );

drop policy if exists chat_presence_write on realtime.messages;
create policy chat_presence_write on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and (select realtime.topic()) = 'presence:' || (select private.current_org_id())::text
  );
