-- Org-scoped 1:1 text chat (no attachments), with Realtime delivery and presence.

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations(id) on delete cascade,
  sender_id    uuid not null references public.app_users(id) on delete cascade,
  recipient_id uuid not null references public.app_users(id) on delete cascade,
  body         text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  check (sender_id <> recipient_id)
);

create index if not exists chat_messages_pair_idx
  on public.chat_messages (org_id, sender_id, recipient_id, created_at desc);
create index if not exists chat_messages_recipient_idx
  on public.chat_messages (recipient_id, created_at desc);

alter table public.chat_messages enable row level security;

-- You only ever see conversations you are part of.
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Send as yourself, inside your own organization, to an active member of it.
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and org_id = private.current_org_id()
    and exists (
      select 1 from public.app_users r
      where r.id = recipient_id and r.org_id = chat_messages.org_id and r.is_active
    )
  );

-- Only the recipient may mark a message read (and nothing else is updatable).
drop policy if exists chat_messages_mark_read on public.chat_messages;
create policy chat_messages_mark_read on public.chat_messages
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

revoke all on public.chat_messages from anon, authenticated;
grant select, insert on public.chat_messages to authenticated;
grant update (read_at) on public.chat_messages to authenticated;

-- Realtime: push new rows to the people allowed to read them.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

-- Presence ("who is online") runs on a private channel per organization; only
-- members of that organization may join it.
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
