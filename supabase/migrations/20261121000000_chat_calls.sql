-- Voice / video calls between people of the same organization.
-- The audio and video travel peer-to-peer (WebRTC, encrypted by default). This table
-- is the authenticated "ring" and the call history; the call's connection details
-- are exchanged over a private Realtime channel only its two participants can join.

create table if not exists public.chat_calls (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  caller_id   uuid not null references public.app_users(id) on delete cascade,
  callee_id   uuid not null references public.app_users(id) on delete cascade,
  kind        text not null check (kind in ('voice', 'video')),
  status      text not null default 'ringing'
              check (status in ('ringing', 'accepted', 'declined', 'cancelled', 'missed', 'ended')),
  created_at  timestamptz not null default now(),
  answered_at timestamptz,
  ended_at    timestamptz,
  check (caller_id <> callee_id)
);

create index if not exists chat_calls_callee_idx on public.chat_calls (callee_id, created_at desc);
create index if not exists chat_calls_caller_idx on public.chat_calls (caller_id, created_at desc);
-- One ringing call per pair at a time.
create unique index if not exists chat_calls_one_ringing
  on public.chat_calls (caller_id, callee_id) where status = 'ringing';

alter table public.chat_calls enable row level security;

-- Only the two people on a call can see it.
drop policy if exists chat_calls_select on public.chat_calls;
create policy chat_calls_select on public.chat_calls
  for select to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid());

-- Call as yourself, inside your own organization, an active member of it.
drop policy if exists chat_calls_insert on public.chat_calls;
create policy chat_calls_insert on public.chat_calls
  for insert to authenticated
  with check (
    caller_id = auth.uid()
    and status = 'ringing'
    and org_id = private.current_org_id()
    and exists (
      select 1 from public.app_users r
      where r.id = callee_id and r.org_id = chat_calls.org_id and r.is_active
    )
  );

drop policy if exists chat_calls_update on public.chat_calls;
create policy chat_calls_update on public.chat_calls
  for update to authenticated
  using (caller_id = auth.uid() or callee_id = auth.uid())
  with check (caller_id = auth.uid() or callee_id = auth.uid());

revoke all on public.chat_calls from anon, authenticated;
grant select, insert on public.chat_calls to authenticated;
grant update (status, answered_at, ended_at) on public.chat_calls to authenticated;
grant all on public.chat_calls to service_role;

-- Who may move a call to which state, and anti-spam on new calls.
create or replace function private.chat_calls_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    -- A ring nobody answered (e.g. the caller closed the tab) must not block the next call.
    update public.chat_calls
       set status = 'missed', ended_at = now()
     where caller_id = new.caller_id and callee_id = new.callee_id
       and status = 'ringing' and created_at < now() - interval '60 seconds';
    -- No more than 10 new calls a minute from one person.
    if (select count(*) from public.chat_calls
         where caller_id = new.caller_id and created_at > now() - interval '1 minute') >= 10 then
      raise exception 'Too many calls, try again in a minute.';
    end if;
    return new;
  end if;

  -- UPDATE (service role / dashboard has no auth.uid() and is not restricted)
  if me is null then
    return new;
  end if;
  if new.status = old.status then
    return new;
  end if;
  if old.status = 'ringing' then
    if new.status in ('accepted', 'declined') and me = old.callee_id then
      -- ok
    elsif new.status in ('cancelled', 'missed') and me = old.caller_id then
      -- ok
    else
      raise exception 'That change to the call is not allowed.';
    end if;
  elsif old.status = 'accepted' and new.status = 'ended' then
    -- either person may hang up
  else
    raise exception 'That call has already finished.';
  end if;
  if new.status = 'accepted' then
    new.answered_at := now();
  else
    new.ended_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists chat_calls_guard_trg on public.chat_calls;
create trigger chat_calls_guard_trg
  before insert or update on public.chat_calls
  for each row execute function private.chat_calls_guard();

-- Realtime: ring the callee, and tell both sides when the status changes.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_calls'
  ) then
    alter publication supabase_realtime add table public.chat_calls;
  end if;
end $$;

-- The connection details (offer / answer / network candidates) go over a private
-- channel per call: only its two participants may listen or send, and only while
-- the call is ringing or live.
drop policy if exists chat_call_signal_read on realtime.messages;
create policy chat_call_signal_read on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1 from public.chat_calls c
      where 'call:' || c.id::text = (select realtime.topic())
        and auth.uid() in (c.caller_id, c.callee_id)
        and c.status in ('ringing', 'accepted')
    )
  );

drop policy if exists chat_call_signal_write on realtime.messages;
create policy chat_call_signal_write on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'broadcast'
    and exists (
      select 1 from public.chat_calls c
      where 'call:' || c.id::text = (select realtime.topic())
        and auth.uid() in (c.caller_id, c.callee_id)
        and c.status in ('ringing', 'accepted')
    )
  );
