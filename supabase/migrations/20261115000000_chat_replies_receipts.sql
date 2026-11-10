-- Chat: quoted replies, forwarding, and delivery receipts.
alter table public.chat_messages
  add column if not exists reply_to_id  uuid references public.chat_messages(id) on delete set null,
  add column if not exists forwarded    boolean not null default false,
  add column if not exists delivered_at timestamptz;

-- A reply may only quote a message from a conversation you are part of.
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
    and (
      reply_to_id is null
      or exists (
        select 1 from public.chat_messages p
        where p.id = reply_to_id and (p.sender_id = auth.uid() or p.recipient_id = auth.uid())
      )
    )
  );

-- The recipient reports "delivered" and "read"; nothing else is updatable.
revoke update on public.chat_messages from authenticated;
grant update (read_at, delivered_at) on public.chat_messages to authenticated;
