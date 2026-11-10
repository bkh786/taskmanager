-- Fix: inside the sub-select, an unqualified reply_to_id referred to the quoted
-- message's own column instead of the row being inserted, so every reply was refused.
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and org_id = private.current_org_id()
    and exists (
      select 1 from public.app_users r
      where r.id = chat_messages.recipient_id and r.org_id = chat_messages.org_id and r.is_active
    )
    and (
      chat_messages.reply_to_id is null
      or exists (
        select 1 from public.chat_messages p
        where p.id = chat_messages.reply_to_id
          and (p.sender_id = auth.uid() or p.recipient_id = auth.uid())
      )
    )
  );
