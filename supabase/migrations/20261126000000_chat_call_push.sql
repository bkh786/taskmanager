-- Push notifications for chat messages and incoming calls.
-- pushed_at marks that a push was already handled for the row, so a message or call
-- can never be pushed twice (the app can't set it; only the server does).
alter table public.chat_messages add column if not exists pushed_at timestamptz;
alter table public.chat_calls    add column if not exists pushed_at timestamptz;

-- Per-person switch for chat and call pushes (on by default).
alter table public.notification_prefs add column if not exists push_chat boolean not null default true;
