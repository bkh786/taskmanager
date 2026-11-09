"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "available" | "away" | "offline";
type Person = { id: string; full_name: string; email: string };
type Msg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

const DOT: Record<Status, string> = {
  available: "#22a06b",
  away: "#f59e0b",
  offline: "#9ca3af",
};
const LABEL: Record<Status, string> = { available: "Available", away: "Away", offline: "Offline" };
const IDLE_MS = 5 * 60 * 1000;
const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😅", "😉", "🙂",
  "🙏", "👍", "👎", "👏", "🙌", "💪", "🎉", "🔥", "✅", "❌", "⭐", "❤️",
  "😢", "😭", "😡", "😴", "🤝", "👀", "💡", "📌", "⏰", "☕", "🚀", "👋",
];

function initialsOf(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  return ((p[0][0] ?? "") + (p.length > 1 ? (p[p.length - 1][0] ?? "") : (p[0][1] ?? ""))).toUpperCase();
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Dot({ status, ring }: { status: Status; ring?: boolean }) {
  return (
    <span
      title={LABEL[status]}
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: DOT[status], boxShadow: ring ? "0 0 0 2px var(--panel-bg)" : undefined }}
    />
  );
}

/**
 * Gmail-style chat dock: a collapsed pill bottom-right that opens into a chat
 * window (and can be enlarged). Text only, one-to-one, inside the user's own
 * organization -- enforced by row-level security, not just by this screen.
 */
export function ChatDock({ me }: { me: { id: string; orgId: string } }) {
  const supabase = useMemo(() => createClient(), []);

  const [ready, setReady] = useState<"loading" | "ok" | "unavailable">("loading");
  const [open, setOpen] = useState(false);
  const [large, setLarge] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Record<string, Msg>>({});
  const [presence, setPresence] = useState<Record<string, Status>>({});
  const [peerId, setPeerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [myStatus, setMyStatus] = useState<Status>("available");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const addMessages = useCallback((list: Msg[]) => {
    setMessages((prev) => {
      const next = { ...prev };
      for (const m of list) next[m.id] = { ...next[m.id], ...m };
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
        supabase
          .from("chat_messages")
          .select("id, sender_id, recipient_id, body, created_at, read_at")
          .order("created_at", { ascending: false })
          .limit(400),
      ]);
      if (cancelled) return;
      if (uErr || mErr) {
        setReady("unavailable");
        return;
      }
      setPeople(users ?? []);
      addMessages((recent ?? []) as Msg[]);
      setReady("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, me.id, me.orgId, addMessages]);

  // ---- live messages (row-level security decides who receives what)
  useEffect(() => {
    if (ready !== "ok") return;
    const channel = supabase
      .channel(`chat-${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `recipient_id=eq.${me.id}` },
        (payload) => addMessages([payload.new as Msg])
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `sender_id=eq.${me.id}` },
        (payload) => addMessages([payload.new as Msg])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `sender_id=eq.${me.id}` },
        (payload) => addMessages([payload.new as Msg])
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, me.id, ready, addMessages]);

  // ---- presence: Available / Away / Offline
  useEffect(() => {
    if (ready !== "ok") return;
    let lastActive = Date.now();
    let current: Status = "available";
    const channel = supabase.channel(`presence:${me.orgId}`, {
      config: { private: true, presence: { key: me.id } },
    });

    const computeStatus = (): Status =>
      document.visibilityState === "visible" && Date.now() - lastActive < IDLE_MS ? "available" : "away";

    const publish = () => {
      const next = computeStatus();
      if (next !== current) {
        current = next;
        setMyStatus(next);
        void channel.track({ status: next });
      }
    };
    const markActive = () => {
      lastActive = Date.now();
      publish();
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, { status?: Status }[]>;
        const out: Record<string, Status> = {};
        for (const [uid, metas] of Object.entries(state)) {
          out[uid] = metas.some((m) => m.status === "available") ? "available" : "away";
        }
        setPresence(out);
      })
      .subscribe((st) => {
        if (st === "SUBSCRIBED") void channel.track({ status: current });
      });

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
    const timer = setInterval(publish, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", markActive);
      clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [supabase, me.id, me.orgId, ready]);

  // ---- open a conversation: fetch its history
  useEffect(() => {
    if (!peerId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, sender_id, recipient_id, body, created_at, read_at")
        .or(
          `and(sender_id.eq.${me.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${me.id})`
        )
        .order("created_at", { ascending: false })
        .limit(150);
      if (!cancelled && data) addMessages(data as Msg[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, me.id, peerId, addMessages]);

  const conversation = useMemo(() => {
    if (!peerId) return [];
    return Object.values(messages)
      .filter(
        (m) =>
          (m.sender_id === me.id && m.recipient_id === peerId) ||
          (m.sender_id === peerId && m.recipient_id === me.id)
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }, [messages, peerId, me.id]);

  const unreadFrom = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of Object.values(messages)) {
      if (m.recipient_id === me.id && !m.read_at) out[m.sender_id] = (out[m.sender_id] ?? 0) + 1;
    }
    return out;
  }, [messages, me.id]);
  const totalUnread = Object.values(unreadFrom).reduce((a, b) => a + b, 0);

  // ---- mark the open conversation as read while it is on screen
  const unreadOpen = peerId ? (unreadFrom[peerId] ?? 0) : 0;
  useEffect(() => {
    if (!open || !peerId || unreadOpen === 0) return;
    const ids = Object.values(messages)
      .filter((m) => m.sender_id === peerId && m.recipient_id === me.id && !m.read_at)
      .map((m) => m.id);
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    void supabase
      .from("chat_messages")
      .update({ read_at: now })
      .in("id", ids)
      .then(({ error }) => {
        if (!error) {
          setMessages((prev) => {
            const next = { ...prev };
            for (const id of ids) if (next[id]) next[id] = { ...next[id], read_at: now };
            return next;
          });
        }
      });
  }, [open, peerId, unreadOpen, messages, me.id, supabase]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [conversation.length, peerId, open, large]);

  const statusOf = (id: string): Status => presence[id] ?? "offline";

  const peerMeta = useMemo(() => {
    const last: Record<string, Msg> = {};
    for (const m of Object.values(messages)) {
      const other = m.sender_id === me.id ? m.recipient_id : m.sender_id;
      if (!last[other] || m.created_at > last[other].created_at) last[other] = m;
    }
    return last;
  }, [messages, me.id]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rank = (s: Status) => (s === "available" ? 0 : s === "away" ? 1 : 2);
    return people
      .filter((p) => !q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .sort((a, b) => {
        const la = peerMeta[a.id]?.created_at ?? "";
        const lb = peerMeta[b.id]?.created_at ?? "";
        if (la !== lb) return lb.localeCompare(la); // recent conversations first
        const ra = rank(statusOf(a.id));
        const rb = rank(statusOf(b.id));
        if (ra !== rb) return ra - rb;
        return a.full_name.localeCompare(b.full_name);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, search, peerMeta, presence]);

  const peer = people.find((p) => p.id === peerId) ?? null;
  const onlineCount = people.filter((p) => statusOf(p.id) !== "offline").length;

  async function send() {
    const body = draft.trim();
    if (!body || !peerId) return;
    if (body.length > 2000) {
      setSendError("Messages can be up to 2,000 characters.");
      return;
    }
    setSendError(null);
    setDraft("");
    const { data, error } = await supabase
      .from("chat_messages")
      .insert({ org_id: me.orgId, sender_id: me.id, recipient_id: peerId, body })
      .select("id, sender_id, recipient_id, body, created_at, read_at")
      .single();
    if (error || !data) {
      setDraft(body);
      setSendError("Couldn't send that message. Please try again.");
      return;
    }
    addMessages([data as Msg]);
  }

  function addEmoji(e: string) {
    setDraft((d) => d + e);
    setEmojiOpen(false);
    inputRef.current?.focus();
  }

  if (ready === "unavailable") return null;
  if (ready === "loading") return null;

  // ---------------------------------------------------------------- collapsed
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2.5 pl-4 pr-3.5 py-2.5 rounded-full bg-accent text-white shadow-lg border-none cursor-pointer text-[13.5px] font-semibold"
        aria-label="Open chat"
      >
        <span aria-hidden="true">💬</span>
        Chat
        <Dot status={myStatus} ring />
        {totalUnread > 0 ? (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-danger text-white text-[11px] font-bold flex items-center justify-center">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        ) : null}
      </button>
    );
  }

  // ---------------------------------------------------------------- panes
  const showList = large || !peerId;
  const showConversation = large || !!peerId;

  const listPane = (
    <div className={`flex flex-col min-h-0 ${large ? "w-[270px] border-r border-panel-border" : "flex-1"}`}>
      <div className="p-2.5 border-b border-panel-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people by name or email"
          className="w-full px-3 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
        />
        <div className="text-[11px] text-text-faint mt-1.5">
          {onlineCount} online · {people.length} in your organization
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.length === 0 ? (
          <div className="p-4 text-[12.5px] text-text-faint">No one matches your search.</div>
        ) : (
          list.map((p) => {
            const last = peerMeta[p.id];
            const unread = unreadFrom[p.id] ?? 0;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeerId(p.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-none cursor-pointer"
                style={{ background: peerId === p.id ? "var(--accent-soft)" : "transparent" }}
              >
                <span className="relative shrink-0">
                  <span className="w-8 h-8 rounded-full bg-chip-bg text-text-body flex items-center justify-center text-[11px] font-bold">
                    {initialsOf(p.full_name)}
                  </span>
                  <span className="absolute -right-0.5 -bottom-0.5">
                    <Dot status={statusOf(p.id)} ring />
                  </span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-text-main truncate">{p.full_name}</span>
                    {last ? (
                      <span className="text-[10.5px] text-text-faint shrink-0">{timeLabel(last.created_at)}</span>
                    ) : null}
                  </span>
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-text-sub truncate">
                      {last ? `${last.sender_id === me.id ? "You: " : ""}${last.body}` : p.email}
                    </span>
                    {unread > 0 ? (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-white text-[10.5px] font-bold flex items-center justify-center shrink-0">
                        {unread}
                      </span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  const conversationPane = (
    <div className="flex-1 flex flex-col min-h-0 min-w-0">
      {peer ? (
        <>
          <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-panel-border">
            {!large ? (
              <button
                type="button"
                onClick={() => setPeerId(null)}
                aria-label="Back to people"
                className="border-none bg-transparent text-text-sub cursor-pointer text-[16px] px-1"
              >
                ←
              </button>
            ) : null}
            <span className="w-8 h-8 rounded-full bg-chip-bg text-text-body flex items-center justify-center text-[11px] font-bold shrink-0">
              {initialsOf(peer.full_name)}
            </span>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-text-main truncate">{peer.full_name}</div>
              <div className="flex items-center gap-1.5 text-[11.5px] text-text-sub">
                <Dot status={statusOf(peer.id)} />
                {LABEL[statusOf(peer.id)]}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 bg-body-bg">
            {conversation.length === 0 ? (
              <div className="m-auto text-[12.5px] text-text-faint text-center px-6">
                No messages yet. Say hello to {peer.full_name.split(" ")[0]} 👋
              </div>
            ) : (
              conversation.map((m) => {
                const mine = m.sender_id === me.id;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[78%] px-3 py-2 rounded-2xl text-[13px] whitespace-pre-wrap break-words"
                      style={{
                        background: mine ? "var(--accent)" : "var(--panel-bg)",
                        color: mine ? "#fff" : "var(--text-main)",
                        border: mine ? "none" : "1px solid var(--panel-border)",
                      }}
                    >
                      {m.body}
                      <div className="text-[10px] mt-0.5 text-right" style={{ opacity: 0.7 }}>
                        {timeLabel(m.created_at)}
                        {mine && m.read_at ? " · Seen" : ""}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
          <div className="relative border-t border-panel-border p-2.5">
            {emojiOpen ? (
              <div className="absolute bottom-full left-2.5 mb-1.5 w-[250px] grid grid-cols-8 gap-0.5 p-2 bg-panel-bg border border-panel-border rounded-lg shadow-lg">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => addEmoji(e)}
                    className="text-[17px] p-0.5 rounded hover:bg-chip-bg border-none bg-transparent cursor-pointer"
                  >
                    {e}
                  </button>
                ))}
              </div>
            ) : null}
            {sendError ? <div className="text-[11.5px] text-danger mb-1">{sendError}</div> : null}
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setEmojiOpen((o) => !o)}
                aria-label="Add emoji"
                className="text-[18px] border-none bg-transparent cursor-pointer pb-1.5"
              >
                🙂
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                value={draft}
                maxLength={2000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Type a message"
                className="flex-1 resize-none max-h-[90px] px-3 py-2 border border-panel-border rounded-xl text-[13px] bg-panel-bg text-text-main"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={!draft.trim()}
                className="border-none bg-accent text-white px-3.5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="m-auto text-[13px] text-text-faint text-center px-8">
          Pick someone from your organization to start chatting.
        </div>
      )}
    </div>
  );

  return (
    <div
      className="fixed bottom-4 right-4 z-40 flex flex-col bg-panel-bg border border-panel-border rounded-xl shadow-2xl overflow-hidden"
      style={{
        width: large ? "min(780px, calc(100vw - 32px))" : "min(350px, calc(100vw - 32px))",
        height: large ? "min(600px, calc(100vh - 32px))" : "min(480px, calc(100vh - 32px))",
      }}
    >
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-accent text-white">
        <div className="flex items-center gap-2 text-[13.5px] font-semibold">
          💬 Chat
          <span className="flex items-center gap-1.5 text-[11.5px] font-normal opacity-90">
            <Dot status={myStatus} ring /> {LABEL[myStatus]}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setLarge((l) => !l)}
            aria-label={large ? "Make chat smaller" : "Enlarge chat"}
            title={large ? "Smaller" : "Enlarge"}
            className="border-none bg-transparent text-white cursor-pointer text-[15px] px-1.5"
          >
            {large ? "⤡" : "⤢"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Collapse chat"
            title="Collapse"
            className="border-none bg-transparent text-white cursor-pointer text-[18px] px-1.5 leading-none"
          >
            ▾
          </button>
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        {showList ? listPane : null}
        {showConversation ? conversationPane : null}
      </div>
    </div>
  );
}
