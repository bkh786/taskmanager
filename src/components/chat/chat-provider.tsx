"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { pageInFront, playChime, showSystemNotification, unlockAudio } from "@/lib/alerts";

export type Status = "available" | "away" | "offline";
export type Person = { id: string; full_name: string; email: string };
export type ChatMsg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  delivered_at: string | null;
  reply_to_id: string | null;
  forwarded: boolean;
  /** Local only: a message that hasn't reached the server yet, or failed to. */
  local?: "sending" | "failed";
};

const COLS = "id, sender_id, recipient_id, body, created_at, read_at, delivered_at, reply_to_id, forwarded";
const IDLE_MS = 5 * 60 * 1000;

type ChatContextValue = {
  me: { id: string; orgId: string };
  ready: boolean;
  people: Person[];
  myStatus: Status;
  statusOf: (id: string) => Status;
  messages: Record<string, ChatMsg>;
  conversationWith: (peerId: string) => ChatMsg[];
  lastByPeer: Record<string, ChatMsg>;
  unreadFrom: Record<string, number>;
  totalUnread: number;
  /** True for a few seconds after a message arrives that the user isn't looking at. */
  flash: boolean;
  send: (peerId: string, body: string, opts?: { replyToId?: string | null; forwarded?: boolean }) => Promise<boolean>;
  retry: (tempId: string) => Promise<void>;
  /** Tell the provider which conversation is on screen (it marks it read). */
  setFocus: (peerId: string | null) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const v = useContext(ChatContext);
  if (!v) throw new Error("useChat must be used inside ChatProvider");
  return v;
}
/** For components (like the sidebar) that render for every role. */
export function useChatOptional(): ChatContextValue | null {
  return useContext(ChatContext);
}

/**
 * Everything chat needs in one place, so the quick-chat window and the Team
 * Chat page share a single live connection: people, messages, presence
 * (Available / Away / Offline), delivery receipts and new-message alerts.
 */
export function ChatProvider({
  me,
  children,
}: {
  me: { id: string; orgId: string } | null;
  children: ReactNode;
}) {
  if (!me) return <>{children}</>;
  return <ChatProviderInner me={me}>{children}</ChatProviderInner>;
}

function ChatProviderInner({
  me,
  children,
}: {
  me: { id: string; orgId: string };
  children: ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Record<string, ChatMsg>>({});
  const [presence, setPresence] = useState<Record<string, Status>>({});
  const [myStatus, setMyStatus] = useState<Status>("available");
  const [focusPeer, setFocus] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [flash, setFlash] = useState(false);
  const focusRef = useRef<string | null>(null);
  const visibleRef = useRef(true);
  const delivering = useRef<Set<string>>(new Set());
  const fetchedParents = useRef<Set<string>>(new Set());

  useEffect(() => {
    focusRef.current = focusPeer;
  }, [focusPeer]);

  const peopleRef = useRef<Person[]>([]);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  // Sound can only start after the person has used the page once.
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const addMessages = useCallback((list: ChatMsg[]) => {
    setMessages((prev) => {
      const next = { ...prev };
      for (const m of list) next[m.id] = { ...next[m.id], ...m, local: undefined };
      return next;
    });
  }, []);

  // ---- initial load: the org's people + my recent messages
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: users, error: uErr }, { data: recent, error: mErr }] = await Promise.all([
        supabase
          .from("app_users")
          .select("id, full_name, email")
          .eq("org_id", me.orgId)
          .eq("is_active", true)
          .neq("id", me.id)
          .order("full_name"),
        supabase.from("chat_messages").select(COLS).order("created_at", { ascending: false }).limit(400),
      ]);
      if (cancelled || uErr || mErr) return;
      setPeople(users ?? []);
      addMessages((recent ?? []) as ChatMsg[]);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, me.id, me.orgId, addMessages]);

  // ---- attention: flash for a few seconds when something new arrives unseen
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alert = useCallback(() => {
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 7000);
  }, []);

  // ---- live messages and receipts (row-level security decides who gets what)
  useEffect(() => {
    if (!ready) return;
    const channel = supabase
      .channel(`chat-${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `recipient_id=eq.${me.id}` },
        (payload) => {
          const m = payload.new as ChatMsg;
          addMessages([m]);
          const watching = focusRef.current === m.sender_id && visibleRef.current && document.hasFocus();
          if (!watching) {
            alert();
            // Away from the page: a system notification (the computer plays its own tone).
            // Looking at the page: a short chime. Either way, once.
            const who = peopleRef.current.find((p) => p.id === m.sender_id)?.full_name ?? "New message";
            const shown =
              !pageInFront() &&
              showSystemNotification(who, m.body.length > 120 ? `${m.body.slice(0, 117)}…` : m.body, {
                tag: `chat-${m.sender_id}`,
              });
            if (!shown) playChime();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `sender_id=eq.${me.id}` },
        (payload) => addMessages([payload.new as ChatMsg])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `sender_id=eq.${me.id}` },
        (payload) => addMessages([payload.new as ChatMsg])
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, me.id, ready, addMessages, alert]);

  // ---- presence: Available / Away / Offline (kept fresh without any reload)
  useEffect(() => {
    if (!ready) return;
    let disposed = false;
    let lastActive = Date.now();
    let current: Status = "available";
    let channel: RealtimeChannel | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const computeStatus = (): Status =>
      document.visibilityState === "visible" && Date.now() - lastActive < IDLE_MS ? "available" : "away";
    const announce = () => {
      if (channel && channel.state === "joined") void channel.track({ status: current, at: Date.now() });
    };
    const publish = () => {
      const next = computeStatus();
      if (next !== current) {
        current = next;
        setMyStatus(next);
        announce();
      }
    };
    const markActive = () => {
      lastActive = Date.now();
      publish();
    };

    const connect = () => {
      if (disposed) return;
      let dead = false;
      const ch = supabase.channel(`presence:${me.orgId}`, {
        config: { private: true, presence: { key: me.id } },
      });
      channel = ch;
      ch.on("presence", { event: "sync" }, () => {
        const state = ch.presenceState() as Record<string, { status?: Status }[]>;
        const out: Record<string, Status> = {};
        for (const [uid, metas] of Object.entries(state)) {
          out[uid] = metas.some((m) => m.status === "available") ? "available" : "away";
        }
        setPresence(out);
      }).subscribe((st) => {
        if (dead) return;
        if (st === "SUBSCRIBED") {
          current = computeStatus();
          setMyStatus(current);
          void ch.track({ status: current, at: Date.now() });
        } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") {
          dead = true;
          retryTimer = setTimeout(() => {
            void supabase.removeChannel(ch);
            connect();
          }, 4000);
        }
      });
    };
    connect();

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    let throttle = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - throttle > 2000) {
        throttle = now;
        markActive();
      }
    };
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", markActive);
    window.addEventListener("online", announce);
    const statusTimer = setInterval(publish, 30_000);
    const heartbeat = setInterval(announce, 25_000);
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", markActive);
      window.removeEventListener("online", announce);
      clearInterval(statusTimer);
      clearInterval(heartbeat);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, me.id, me.orgId, ready]);

  // ---- pick up newly added people without a reload
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("app_users")
        .select("id, full_name, email")
        .eq("org_id", me.orgId)
        .eq("is_active", true)
        .neq("id", me.id)
        .order("full_name");
      if (data) setPeople(data);
    }, 5 * 60_000);
    return () => clearInterval(timer);
  }, [supabase, me.id, me.orgId, ready]);

  // ---- page visibility (for read receipts / alerts)
  useEffect(() => {
    const update = () => {
      const v = document.visibilityState === "visible";
      visibleRef.current = v;
      setVisible(v);
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  // ---- the conversation on screen: fetch its history
  useEffect(() => {
    if (!focusPeer) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select(COLS)
        .or(
          `and(sender_id.eq.${me.id},recipient_id.eq.${focusPeer}),and(sender_id.eq.${focusPeer},recipient_id.eq.${me.id})`
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (!cancelled && data) addMessages(data as ChatMsg[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, me.id, focusPeer, addMessages]);

  // ---- quoted messages that weren't loaded yet
  useEffect(() => {
    const missing = Object.values(messages)
      .map((m) => m.reply_to_id)
      .filter((id): id is string => !!id && !messages[id] && !fetchedParents.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => fetchedParents.current.add(id));
    void supabase
      .from("chat_messages")
      .select(COLS)
      .in("id", missing)
      .then(({ data }) => {
        if (data) addMessages(data as ChatMsg[]);
      });
  }, [messages, supabase, addMessages]);

  // ---- tell senders their message was delivered to this device
  useEffect(() => {
    const ids = Object.values(messages)
      .filter((m) => m.recipient_id === me.id && !m.delivered_at && !m.local && !delivering.current.has(m.id))
      .map((m) => m.id);
    if (ids.length === 0) return;
    ids.forEach((id) => delivering.current.add(id));
    const now = new Date().toISOString();
    void supabase
      .from("chat_messages")
      .update({ delivered_at: now })
      .in("id", ids)
      .then(({ error }) => {
        if (error) {
          ids.forEach((id) => delivering.current.delete(id));
          return;
        }
        setMessages((prev) => {
          const next = { ...prev };
          for (const id of ids) if (next[id]) next[id] = { ...next[id], delivered_at: now };
          return next;
        });
      });
  }, [messages, me.id, supabase]);

  // ---- mark the on-screen conversation as read
  const unreadFrom = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of Object.values(messages)) {
      if (m.recipient_id === me.id && !m.read_at) out[m.sender_id] = (out[m.sender_id] ?? 0) + 1;
    }
    return out;
  }, [messages, me.id]);
  const totalUnread = Object.values(unreadFrom).reduce((a, b) => a + b, 0);

  const unreadFocused = focusPeer ? (unreadFrom[focusPeer] ?? 0) : 0;
  useEffect(() => {
    if (!focusPeer || !visible || unreadFocused === 0) return;
    const ids = Object.values(messages)
      .filter((m) => m.sender_id === focusPeer && m.recipient_id === me.id && !m.read_at && !m.local)
      .map((m) => m.id);
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    void supabase
      .from("chat_messages")
      .update({ read_at: now, delivered_at: now })
      .in("id", ids)
      .then(({ error }) => {
        if (!error) {
          setMessages((prev) => {
            const next = { ...prev };
            for (const id of ids) if (next[id]) next[id] = { ...next[id], read_at: now, delivered_at: next[id].delivered_at ?? now };
            return next;
          });
        }
      });
  }, [focusPeer, visible, unreadFocused, messages, me.id, supabase]);

  // ---- new-message alert: blink the browser tab title while unread and not looking
  useEffect(() => {
    if (totalUnread === 0) return;
    const base = document.title;
    let on = false;
    const timer = setInterval(() => {
      const looking = document.visibilityState === "visible" && document.hasFocus();
      if (looking) {
        document.title = base;
        on = false;
        return;
      }
      on = !on;
      document.title = on ? `💬 (${totalUnread}) New message` : base;
    }, 1000);
    return () => {
      clearInterval(timer);
      document.title = base;
    };
  }, [totalUnread]);

  // ---- sending
  const send = useCallback(
    async (peerId: string, body: string, opts?: { replyToId?: string | null; forwarded?: boolean }) => {
      const text = body.trim();
      if (!text || text.length > 2000) return false;
      const tempId = `tmp-${crypto.randomUUID()}`;
      const temp: ChatMsg = {
        id: tempId,
        sender_id: me.id,
        recipient_id: peerId,
        body: text,
        created_at: new Date().toISOString(),
        read_at: null,
        delivered_at: null,
        reply_to_id: opts?.replyToId ?? null,
        forwarded: !!opts?.forwarded,
        local: "sending",
      };
      setMessages((prev) => ({ ...prev, [tempId]: temp }));
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          org_id: me.orgId,
          sender_id: me.id,
          recipient_id: peerId,
          body: text,
          reply_to_id: opts?.replyToId ?? null,
          forwarded: !!opts?.forwarded,
        })
        .select(COLS)
        .single();
      if (error || !data) {
        setMessages((prev) => (prev[tempId] ? { ...prev, [tempId]: { ...prev[tempId], local: "failed" } } : prev));
        return false;
      }
      setMessages((prev) => {
        const next = { ...prev };
        delete next[tempId];
        next[(data as ChatMsg).id] = data as ChatMsg;
        return next;
      });
      return true;
    },
    [supabase, me.id, me.orgId]
  );

  const retry = useCallback(
    async (tempId: string) => {
      const m = messages[tempId];
      if (!m) return;
      setMessages((prev) => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
      await send(m.recipient_id, m.body, { replyToId: m.reply_to_id, forwarded: m.forwarded });
    },
    [messages, send]
  );

  const conversationWith = useCallback(
    (peerId: string) =>
      Object.values(messages)
        .filter(
          (m) =>
            (m.sender_id === me.id && m.recipient_id === peerId) ||
            (m.sender_id === peerId && m.recipient_id === me.id)
        )
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [messages, me.id]
  );

  const lastByPeer = useMemo(() => {
    const last: Record<string, ChatMsg> = {};
    for (const m of Object.values(messages)) {
      const other = m.sender_id === me.id ? m.recipient_id : m.sender_id;
      if (!last[other] || m.created_at > last[other].created_at) last[other] = m;
    }
    return last;
  }, [messages, me.id]);

  const value: ChatContextValue = {
    me,
    ready,
    people,
    myStatus,
    statusOf: (id) => presence[id] ?? "offline",
    messages,
    conversationWith,
    lastByPeer,
    unreadFrom,
    totalUnread,
    flash,
    send,
    retry,
    setFocus,
  };
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
