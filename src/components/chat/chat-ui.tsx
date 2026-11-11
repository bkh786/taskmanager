"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat, type ChatMsg, type Person, type Status } from "./chat-provider";
import { useCallOptional } from "./call-provider";
import { alertPermission, requestAlertPermission, unlockAudio, type AlertPermission } from "@/lib/alerts";

export const DOT: Record<Status, string> = {
  available: "#22a06b",
  away: "#f59e0b",
  offline: "#9ca3af",
};
export const LABEL: Record<Status, string> = { available: "Available", away: "Away", offline: "Offline" };

const EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😅", "😉", "🙂",
  "🙏", "👍", "👎", "👏", "🙌", "💪", "🎉", "🔥", "✅", "❌", "⭐", "❤️",
  "😢", "😭", "😡", "😴", "🤝", "👀", "💡", "📌", "⏰", "☕", "🚀", "👋",
];

export function initialsOf(name: string) {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  return ((p[0][0] ?? "") + (p.length > 1 ? (p[p.length - 1][0] ?? "") : (p[0][1] ?? ""))).toUpperCase();
}

export function timeLabel(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function dayHeading(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function Dot({ status, ring }: { status: Status; ring?: boolean }) {
  return (
    <span
      title={LABEL[status]}
      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
      style={{ background: DOT[status], boxShadow: ring ? "0 0 0 2px var(--panel-bg)" : undefined }}
    />
  );
}

export function Avatar({ person, size = 32 }: { person: Person; size?: number }) {
  const { statusOf } = useChat();
  return (
    <span className="relative shrink-0" style={{ width: size, height: size }}>
      <span
        className="rounded-full bg-chip-bg text-text-body flex items-center justify-center font-bold"
        style={{ width: size, height: size, fontSize: size * 0.34 }}
      >
        {initialsOf(person.full_name)}
      </span>
      <span className="absolute -right-0.5 -bottom-0.5">
        <Dot status={statusOf(person.id)} ring />
      </span>
    </span>
  );
}

/** People you can chat with: recent chats first, then online, then A–Z. */
export function PeopleList({
  selectedId,
  onSelect,
  filter = "all",
  search,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter?: "all" | "unread" | "online";
  search: string;
}) {
  const { people, statusOf, lastByPeer, unreadFrom, me } = useChat();
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rank = (s: Status) => (s === "available" ? 0 : s === "away" ? 1 : 2);
    return people
      .filter((p) => !q || p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .filter((p) => (filter === "unread" ? (unreadFrom[p.id] ?? 0) > 0 : filter === "online" ? statusOf(p.id) !== "offline" : true))
      .sort((a, b) => {
        const la = lastByPeer[a.id]?.created_at ?? "";
        const lb = lastByPeer[b.id]?.created_at ?? "";
        if (la !== lb) return lb.localeCompare(la);
        const ra = rank(statusOf(a.id));
        const rb = rank(statusOf(b.id));
        return ra !== rb ? ra - rb : a.full_name.localeCompare(b.full_name);
      });
  }, [people, search, filter, lastByPeer, unreadFrom, statusOf]);

  if (list.length === 0) {
    return <div className="p-4 text-[12.5px] text-text-faint">No one matches.</div>;
  }
  return (
    <>
      {list.map((p) => {
        const last = lastByPeer[p.id];
        const unread = unreadFrom[p.id] ?? 0;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelect(p.id)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left border-none cursor-pointer"
            style={{ background: selectedId === p.id ? "var(--accent-soft)" : "transparent" }}
          >
            <Avatar person={p} />
            <span className="flex-1 min-w-0">
              <span className="flex items-center justify-between gap-2">
                <span className={`text-[13px] text-text-main truncate ${unread ? "font-bold" : "font-semibold"}`}>
                  {p.full_name}
                </span>
                {last ? <span className="text-[10.5px] text-text-faint shrink-0">{timeLabel(last.created_at)}</span> : null}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className={`text-[12px] truncate ${unread ? "text-text-main" : "text-text-sub"}`}>
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
      })}
    </>
  );
}

function receipt(m: ChatMsg): { text: string; failed?: boolean } {
  if (m.local === "sending") return { text: "Sending…" };
  if (m.local === "failed") return { text: "Not sent", failed: true };
  if (m.read_at) return { text: "Seen" };
  if (m.delivered_at) return { text: "Delivered" };
  return { text: "Sent" };
}

function ForwardPicker({
  onPick,
  onClose,
}: {
  onPick: (p: Person) => void;
  onClose: () => void;
}) {
  const { people } = useChat();
  const [q, setQ] = useState("");
  const list = people.filter(
    (p) => !q.trim() || p.full_name.toLowerCase().includes(q.toLowerCase()) || p.email.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="absolute inset-0 z-20 bg-panel-bg flex flex-col">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-panel-border">
        <div className="text-[13.5px] font-semibold text-text-main">Forward to…</div>
        <button type="button" onClick={onClose} aria-label="Cancel forward" className="border-none bg-transparent text-text-faint text-[20px] leading-none cursor-pointer">
          ×
        </button>
      </div>
      <div className="p-2.5">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people"
          className="w-full px-3 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p)}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left border-none bg-transparent cursor-pointer hover:bg-table-head-bg"
          >
            <Avatar person={p} size={28} />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-text-main truncate">{p.full_name}</span>
              <span className="block text-[11.5px] text-text-faint truncate">{p.email}</span>
            </span>
          </button>
        ))}
        {list.length === 0 ? <div className="p-4 text-[12.5px] text-text-faint">No one matches.</div> : null}
      </div>
    </div>
  );
}

/** Asks (once) to show system alerts, which is what lets the computer's own notification tone play. */
export function AlertsPrompt() {
  const [perm, setPerm] = useState<AlertPermission>("granted");
  useEffect(() => {
    // Reading the browser's permission needs the client, so it is set after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPerm(alertPermission());
  }, []);
  if (perm !== "default") return null;
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-accent-soft text-[12px] text-text-body border-b border-panel-border">
      <span>Get an alert with your system&apos;s sound for new messages and calls.</span>
      <button
        type="button"
        onClick={async () => {
          unlockAudio();
          setPerm(await requestAlertPermission());
        }}
        className="border-none bg-accent text-white px-2.5 py-1 rounded-md text-[12px] font-semibold cursor-pointer whitespace-nowrap"
      >
        Turn on
      </button>
    </div>
  );
}

/** One open chat: header, messages (with reply / forward), and the composer. */
export function ConversationView({ peerId, onBack }: { peerId: string; onBack?: () => void }) {
  const { me, people, statusOf, conversationWith, messages, send, retry } = useChat();
  const calls = useCallOptional();
  const peer = people.find((p) => p.id === peerId) ?? null;
  const convo = conversationWith(peerId);

  const [draft, setDraft] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
  const [forwarding, setForwarding] = useState<ChatMsg | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [convo.length, peerId]);

  function grow() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function submit() {
    const body = draft.trim();
    if (!body) return;
    const reply = replyTo;
    setDraft("");
    setReplyTo(null);
    requestAnimationFrame(grow);
    await send(peerId, body, { replyToId: reply?.id ?? null });
  }

  async function forwardTo(p: Person) {
    const m = forwarding;
    setForwarding(null);
    if (!m) return;
    const ok = await send(p.id, m.body, { forwarded: true });
    setNotice(ok ? `Forwarded to ${p.full_name}` : `Couldn't forward to ${p.full_name}`);
    setTimeout(() => setNotice(null), 3500);
  }

  if (!peer) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-text-faint text-center px-8">
        Pick someone from your organization to start chatting.
      </div>
    );
  }

  const nameOf = (id: string) => (id === me.id ? "You" : (people.find((p) => p.id === id)?.full_name ?? "Someone"));
  let lastDay = "";

  return (
    <div className="relative flex-1 flex flex-col min-h-0 min-w-0">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-panel-border bg-panel-bg">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Back to people" className="border-none bg-transparent text-text-sub cursor-pointer text-[16px] px-1">
            ←
          </button>
        ) : null}
        <Avatar person={peer} size={34} />
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-text-main truncate">{peer.full_name}</div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-text-sub">
            <Dot status={statusOf(peer.id)} />
            {LABEL[statusOf(peer.id)]}
          </div>
        </div>
        {calls ? (
          <div className="ml-auto flex items-center gap-1.5">
            {(["voice", "video"] as const).map((kind) => {
              const can = calls.canCall(peer.id);
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={!can.ok}
                  onClick={() => void calls.startCall(peer.id, kind)}
                  aria-label={kind === "voice" ? `Voice call ${peer.full_name}` : `Video call ${peer.full_name}`}
                  title={can.ok ? (kind === "voice" ? "Voice call" : "Video call") : (can.reason ?? "")}
                  className="w-9 h-9 rounded-full border border-panel-border bg-panel-bg text-[16px] cursor-pointer flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed enabled:hover:bg-accent-soft"
                >
                  {kind === "voice" ? "📞" : "🎥"}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-1 bg-body-bg">
        {convo.length === 0 ? (
          <div className="m-auto text-[12.5px] text-text-faint text-center px-6">
            No messages yet. Say hello to {peer.full_name.split(" ")[0]} 👋
          </div>
        ) : (
          convo.map((m) => {
            const mine = m.sender_id === me.id;
            const day = new Date(m.created_at).toDateString();
            const showDay = day !== lastDay;
            lastDay = day;
            const rc = mine ? receipt(m) : null;
            const quoted = m.reply_to_id ? messages[m.reply_to_id] : undefined;
            return (
              <div key={m.id}>
                {showDay ? (
                  <div className="text-center text-[11px] text-text-faint my-2">{dayHeading(m.created_at)}</div>
                ) : null}
                <div className={`group flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
                  {mine ? <MessageActions m={m} onReply={setReplyTo} onForward={setForwarding} /> : null}
                  <div
                    className="max-w-[78%] px-3 py-2 rounded-2xl text-[13px] whitespace-pre-wrap break-words"
                    style={{
                      background: mine ? "var(--accent)" : "var(--panel-bg)",
                      color: mine ? "#fff" : "var(--text-main)",
                      border: mine ? "none" : "1px solid var(--panel-border)",
                    }}
                  >
                    {m.forwarded ? <div className="text-[10.5px] opacity-80 mb-0.5">↪ Forwarded</div> : null}
                    {m.reply_to_id ? (
                      <div
                        className="mb-1.5 px-2 py-1 rounded-md text-[11.5px] border-l-[3px]"
                        style={{
                          background: mine ? "rgba(255,255,255,0.16)" : "var(--chip-bg)",
                          borderColor: mine ? "rgba(255,255,255,0.7)" : "var(--accent)",
                        }}
                      >
                        <div className="font-semibold opacity-90">{quoted ? nameOf(quoted.sender_id) : "Message"}</div>
                        <div className="opacity-85 line-clamp-2">{quoted ? quoted.body : "Original message not available"}</div>
                      </div>
                    ) : null}
                    {m.body}
                    <div className="text-[10px] mt-0.5 text-right flex items-center justify-end gap-1.5" style={{ opacity: rc?.failed ? 1 : 0.8 }}>
                      {clock(m.created_at)}
                      {rc ? (
                        rc.failed ? (
                          <>
                            <span className="font-semibold" style={{ color: "#ffd5d5" }}>· Not sent</span>
                            <button
                              type="button"
                              onClick={() => void retry(m.id)}
                              className="border-none bg-transparent underline cursor-pointer text-[10px] p-0"
                              style={{ color: "#ffd5d5" }}
                            >
                              Retry
                            </button>
                          </>
                        ) : (
                          <span className={rc.text === "Seen" ? "font-bold" : ""}>
                            · {rc.text === "Seen" ? "✓✓ " : rc.text === "Delivered" ? "✓✓ " : rc.text === "Sent" ? "✓ " : ""}
                            {rc.text}
                          </span>
                        )
                      ) : null}
                    </div>
                  </div>
                  {!mine ? <MessageActions m={m} onReply={setReplyTo} onForward={setForwarding} /> : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="relative border-t border-panel-border p-2.5 bg-panel-bg">
        {notice ? <div className="text-[11.5px] text-success mb-1.5">{notice}</div> : null}
        {replyTo ? (
          <div className="flex items-start justify-between gap-2 mb-2 px-2.5 py-1.5 rounded-md bg-chip-bg border-l-[3px] border-accent">
            <div className="min-w-0 text-[12px]">
              <div className="font-semibold text-text-main">Replying to {nameOf(replyTo.sender_id)}</div>
              <div className="text-text-sub truncate">{replyTo.body}</div>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="border-none bg-transparent text-text-faint text-[16px] leading-none cursor-pointer">
              ×
            </button>
          </div>
        ) : null}
        {emojiOpen ? (
          <div className="absolute bottom-full left-2.5 mb-1.5 w-[250px] grid grid-cols-8 gap-0.5 p-2 bg-panel-bg border border-panel-border rounded-lg shadow-lg z-10">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  setDraft((d) => d + e);
                  setEmojiOpen(false);
                  inputRef.current?.focus();
                }}
                className="text-[17px] p-0.5 rounded hover:bg-chip-bg border-none bg-transparent cursor-pointer"
              >
                {e}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <button type="button" onClick={() => setEmojiOpen((o) => !o)} aria-label="Add emoji" className="text-[18px] border-none bg-transparent cursor-pointer pb-1.5">
            🙂
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            maxLength={2000}
            onChange={(e) => {
              setDraft(e.target.value);
              grow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Type a message"
            className="flex-1 resize-none overflow-y-auto px-3 py-2 border border-panel-border rounded-xl text-[13px] leading-[1.4] bg-panel-bg text-text-main"
            style={{ maxHeight: 160 }}
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!draft.trim()}
            className="border-none bg-accent text-white px-3.5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>

      {forwarding ? <ForwardPicker onPick={(p) => void forwardTo(p)} onClose={() => setForwarding(null)} /> : null}
    </div>
  );
}

function MessageActions({
  m,
  onReply,
  onForward,
}: {
  m: ChatMsg;
  onReply: (m: ChatMsg) => void;
  onForward: (m: ChatMsg) => void;
}) {
  if (m.local) return null;
  return (
    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity mb-1">
      <button
        type="button"
        title="Reply"
        aria-label="Reply to this message"
        onClick={() => onReply(m)}
        className="w-6 h-6 rounded-md border border-panel-border bg-panel-bg text-text-sub text-[12px] cursor-pointer"
      >
        ↩
      </button>
      <button
        type="button"
        title="Forward"
        aria-label="Forward this message"
        onClick={() => onForward(m)}
        className="w-6 h-6 rounded-md border border-panel-border bg-panel-bg text-text-sub text-[12px] cursor-pointer"
      >
        ↪
      </button>
    </div>
  );
}
