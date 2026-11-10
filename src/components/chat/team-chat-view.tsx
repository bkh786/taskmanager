"use client";

import { useEffect, useState } from "react";
import { useChat } from "./chat-provider";
import { ConversationView, Dot, PeopleList } from "./chat-ui";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "online", label: "Online" },
] as const;

/** Full-page chat: people list on the left, the open conversation on the right. */
export function TeamChatView() {
  const { ready, people, statusOf, myStatus, totalUnread, setFocus } = useChat();
  const [peerId, setPeerId] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setFocus(peerId);
    return () => setFocus(null);
  }, [peerId, setFocus]);

  if (!ready) {
    return <div className="text-[13px] text-text-faint">Loading chat…</div>;
  }

  const onlineCount = people.filter((p) => statusOf(p.id) !== "offline").length;

  return (
    <div className="flex h-[calc(100dvh-170px)] min-h-[460px] bg-panel-bg border border-panel-border rounded-[10px] overflow-hidden">
      <div className={`${peerId ? "hidden md:flex" : "flex"} flex-col w-full md:w-[340px] md:shrink-0 border-r border-panel-border min-h-0`}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="text-[18px] font-bold text-text-main">Team Chat</div>
          <span className="flex items-center gap-1.5 text-[11.5px] text-text-sub">
            <Dot status={myStatus} /> {myStatus === "available" ? "Available" : "Away"}
          </span>
        </div>
        <div className="px-3 pb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people by name or email"
            className="w-full px-3 py-2 border border-panel-border rounded-md text-[13px] bg-panel-bg text-text-main"
          />
          <div className="flex gap-1.5 mt-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className="border px-3 py-1 rounded-full text-[12px] font-semibold cursor-pointer"
                style={{
                  borderColor: filter === f.id ? "var(--accent)" : "var(--panel-border)",
                  background: filter === f.id ? "var(--accent-soft)" : "transparent",
                  color: filter === f.id ? "var(--accent)" : "var(--text-body)",
                }}
              >
                {f.label}
                {f.id === "unread" && totalUnread > 0 ? ` (${totalUnread})` : ""}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-text-faint mt-2">
            {onlineCount} online · {people.length} in your organization
          </div>
        </div>
        <div className="flex-1 overflow-y-auto border-t border-panel-border">
          <PeopleList selectedId={peerId} onSelect={setPeerId} filter={filter} search={search} />
        </div>
      </div>

      <div className={`${peerId ? "flex" : "hidden md:flex"} flex-1 min-w-0`}>
        {peerId ? (
          <ConversationView peerId={peerId} onBack={() => setPeerId(null)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-text-faint px-8 gap-2">
            <div className="text-[34px]">💬</div>
            <div className="text-[14px] font-semibold text-text-sub">Select a conversation</div>
            <div className="text-[12.5px]">Pick someone from the list to start chatting.</div>
          </div>
        )}
      </div>
    </div>
  );
}
