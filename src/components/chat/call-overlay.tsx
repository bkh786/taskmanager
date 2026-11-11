"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "./chat-provider";
import { useCallOptional } from "./call-provider";
import { initialsOf } from "./chat-ui";

function Timer({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return null;
  const s = Math.max(0, Math.floor((now - since) / 1000));
  return (
    <span>
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </span>
  );
}

function Stream({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

const round = "w-12 h-12 rounded-full border-none cursor-pointer flex items-center justify-center text-[19px] text-white";

/** Incoming-call card, and the call window while ringing / connected. */
export function CallOverlay() {
  const ctx = useCallOptional();
  const { people } = useChat();
  if (!ctx) return null;
  const { call, accept, decline, hangUp, toggleMute, toggleCamera, dismissNotice } = ctx;
  const peer = people.find((p) => p.id === call.peerId);
  const name = peer?.full_name ?? "Someone";
  const video = call.kind === "video";

  if (call.phase === "idle") {
    return call.notice ? (
      <div
        role="status"
        className="fixed bottom-14 left-1/2 -translate-x-1/2 z-[70] max-w-[calc(100vw-24px)] flex items-center gap-3 bg-text-main text-white text-[13px] px-4 py-2.5 rounded-lg shadow-xl"
      >
        <span>{call.notice}</span>
        <button type="button" onClick={dismissNotice} aria-label="Dismiss" className="border-none bg-transparent text-white/70 cursor-pointer text-[16px] leading-none">
          ×
        </button>
      </div>
    ) : null;
  }

  if (call.phase === "incoming") {
    return (
      <div
        role="alertdialog"
        aria-label={`Incoming ${call.kind} call from ${name}`}
        className="fixed top-5 left-1/2 -translate-x-1/2 z-[70] w-[min(360px,calc(100vw-24px))] bg-panel-bg border border-panel-border rounded-2xl shadow-2xl px-5 py-4 flex flex-col items-center gap-3 tm-flash"
      >
        <div className="w-16 h-16 rounded-full bg-chip-bg text-text-body flex items-center justify-center text-[22px] font-bold">
          {initialsOf(name)}
        </div>
        <div className="text-center">
          <div className="text-[16px] font-bold text-text-main">{name}</div>
          <div className="text-[12.5px] text-text-sub">Incoming {video ? "video" : "voice"} call…</div>
        </div>
        <div className="flex gap-6">
          <button type="button" onClick={decline} aria-label="Decline" title="Decline" className={round} style={{ background: "#d92d20" }}>
            ✕
          </button>
          <button type="button" onClick={() => void accept()} aria-label="Accept" title="Accept" className={round} style={{ background: "#22a06b" }}>
            {video ? "🎥" : "📞"}
          </button>
        </div>
      </div>
    );
  }

  // outgoing / connecting / active
  const status =
    call.phase === "outgoing" ? `Calling ${name}…` : call.phase === "connecting" ? "Connecting…" : null;
  const showVideo = video && call.phase !== "outgoing" && call.remoteVideo;

  return (
    <div
      className="fixed bottom-14 right-4 z-[70] bg-[#0f1115] text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      style={{ width: video ? "min(560px, calc(100vw - 32px))" : "min(320px, calc(100vw - 32px))" }}
      role="dialog"
      aria-label={`${video ? "Video" : "Voice"} call with ${name}`}
    >
      <div className="relative" style={{ aspectRatio: video ? "16 / 10" : undefined, minHeight: video ? undefined : 190 }}>
        {/* The remote side always plays (it carries the other person's voice). */}
        <Stream
          stream={call.remoteStream}
          className={showVideo ? "absolute inset-0 w-full h-full object-cover bg-black" : "absolute w-px h-px opacity-0"}
        />
        {!showVideo ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-[26px] font-bold">
              {initialsOf(name)}
            </div>
            <div className="text-[15px] font-semibold">{name}</div>
          </div>
        ) : null}
        {video && call.localStream ? (
          <Stream
            stream={call.localStream}
            muted
            className="absolute right-2.5 bottom-2.5 w-[28%] min-w-[84px] aspect-[4/3] object-cover rounded-lg border border-white/25 bg-black"
          />
        ) : null}
        <div className="absolute top-2.5 left-3 right-3 flex justify-between text-[12px] text-white/80">
          <span>{status ?? (call.phase === "active" ? "In call" : "")}</span>
          <Timer since={call.connectedAt} />
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 py-3.5 bg-[#171a21]">
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={call.muted}
          aria-label={call.muted ? "Unmute microphone" : "Mute microphone"}
          title={call.muted ? "Unmute" : "Mute"}
          className={round}
          style={{ background: call.muted ? "#d92d20" : "rgba(255,255,255,0.14)" }}
        >
          {call.muted ? "🔇" : "🎤"}
        </button>
        {video ? (
          <button
            type="button"
            onClick={toggleCamera}
            aria-pressed={call.cameraOff}
            aria-label={call.cameraOff ? "Turn camera on" : "Turn camera off"}
            title={call.cameraOff ? "Camera on" : "Camera off"}
            className={round}
            style={{ background: call.cameraOff ? "#d92d20" : "rgba(255,255,255,0.14)" }}
          >
            {call.cameraOff ? "🚫" : "📷"}
          </button>
        ) : null}
        <button type="button" onClick={hangUp} aria-label="End call" title="End call" className={round} style={{ background: "#d92d20" }}>
          ✕
        </button>
      </div>
    </div>
  );
}
