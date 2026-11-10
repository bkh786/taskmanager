"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "./chat-provider";
import { ConversationView, Dot, PeopleList } from "./chat-ui";

/**
 * Gmail-style quick chat: a collapsed pill bottom-right that opens into a chat
 * window (and can be enlarged). It steps aside on the Team Chat page, which
 * shows the same conversations full-size.
 */
export function ChatDock() {
  const { ready, people, myStatus, statusOf, totalUnread, flash, setFocus } = useChat();
  const pathname = usePathname();
  const hidden = pathname.startsWith("/team-chat");

  const [open, setOpen] = useState(false);
  const [large, setLarge] = useState(false);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // The provider marks the on-screen conversation as read.
  useEffect(() => {
    if (hidden) return;
    setFocus(open && peerId ? peerId : null);
    return () => setFocus(null);
  }, [hidden, open, peerId, setFocus]);

  if (!ready || hidden) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed bottom-14 right-4 z-40 flex items-center gap-2.5 pl-4 pr-3.5 py-2.5 rounded-full bg-accent text-white shadow-lg border-none cursor-pointer text-[13.5px] font-semibold ${totalUnread > 0 ? "tm-blink" : ""}`}
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

  const onlineCount = people.filter((p) => statusOf(p.id) !== "offline").length;
  const showList = large || !peerId;
  const showConversation = large || !!peerId;

  return (
    <div
      className="fixed bottom-14 right-4 z-40 flex flex-col bg-panel-bg border border-panel-border rounded-xl shadow-2xl overflow-hidden"
      style={{
        width: large ? "min(780px, calc(100vw - 32px))" : "min(350px, calc(100vw - 32px))",
        height: large ? "min(600px, calc(100dvh - 96px))" : "min(480px, calc(100dvh - 96px))",
      }}
    >
      <div className={`flex items-center justify-between px-3.5 py-2.5 bg-accent text-white ${flash ? "tm-flash" : ""}`}>
        <div className="flex items-center gap-2 text-[13.5px] font-semibold">
          💬 Chat
          <span className="flex items-center gap-1.5 text-[11.5px] font-normal opacity-90">
            <Dot status={myStatus} ring /> {myStatus === "available" ? "Available" : "Away"}
          </span>
          {totalUnread > 0 ? (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10.5px] font-bold flex items-center justify-center">
              {totalUnread}
            </span>
          ) : null}
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
            aria-label="Minimize chat"
            title="Minimize"
            className="border-none bg-transparent text-white cursor-pointer text-[18px] px-1.5 leading-none"
          >
            −
          </button>
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        {showList ? (
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
              <PeopleList selectedId={peerId} onSelect={setPeerId} search={search} />
            </div>
          </div>
        ) : null}
        {showConversation ? (
          peerId ? (
            <ConversationView peerId={peerId} onBack={large ? undefined : () => setPeerId(null)} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[13px] text-text-faint text-center px-8">
              Pick someone from your organization to start chatting.
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
