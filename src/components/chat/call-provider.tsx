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
import { useChatOptional } from "./chat-provider";
import { pageInFront, showSystemNotification, startRingtone, unlockAudio } from "@/lib/alerts";

export type CallKind = "voice" | "video";
export type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active";

type CallRow = {
  id: string;
  caller_id: string;
  callee_id: string;
  kind: string;
  status: string;
  created_at: string;
};

export type CallState = {
  phase: CallPhase;
  peerId: string | null;
  kind: CallKind;
  muted: boolean;
  cameraOff: boolean;
  /** When the call connected (ms), for the timer. */
  connectedAt: number | null;
  /** A short message about how the last call ended, or why one could not start. */
  notice: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** Whether the other side is actually sending video (they may have the camera off). */
  remoteVideo: boolean;
};

const IDLE: CallState = {
  phase: "idle",
  peerId: null,
  kind: "voice",
  muted: false,
  cameraOff: false,
  connectedAt: null,
  notice: null,
  localStream: null,
  remoteStream: null,
  remoteVideo: false,
};

type CallContextValue = {
  call: CallState;
  /** Whether a call to this person can be started right now, and why not. */
  canCall: (peerId: string) => { ok: boolean; reason: string | null };
  startCall: (peerId: string, kind: CallKind) => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangUp: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  dismissNotice: () => void;
};

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const v = useContext(CallContext);
  if (!v) throw new Error("useCall must be used inside CallProvider");
  return v;
}
export function useCallOptional(): CallContextValue | null {
  return useContext(CallContext);
}

const RING_MS = 45_000; // how long a call rings before it counts as missed
const CONNECT_MS = 30_000; // how long to wait for the media path after answering
const DROP_GRACE_MS = 8_000; // a dropped connection gets this long to recover
const FALLBACK_ICE: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/** Mounted for everyone who has chat. Others (the platform owner) get no calling. */
export function CallProvider({ children }: { children: ReactNode }) {
  const chat = useChatOptional();
  if (!chat) return <>{children}</>;
  return <CallProviderInner>{children}</CallProviderInner>;
}

function CallProviderInner({ children }: { children: ReactNode }) {
  const chat = useChatOptional()!;
  const { me, people, statusOf, ready, send } = chat;
  const supabase = useMemo(() => createClient(), []);
  const [call, setCall] = useState<CallState>(IDLE);

  // Queries only run once they are awaited, so status changes go through here.
  const setStatus = useCallback(
    (id: string, status: "accepted" | "declined" | "cancelled" | "missed" | "ended") => {
      void (async () => {
        await supabase.from("chat_calls").update({ status }).eq("id", id);
      })();
    },
    [supabase]
  );

  // The live machinery lives in refs so event handlers never see stale values.
  const m = useRef({
    callId: null as string | null,
    peerId: null as string | null,
    role: null as "caller" | "callee" | null,
    kind: "voice" as CallKind,
    pc: null as RTCPeerConnection | null,
    local: null as MediaStream | null,
    channel: null as RealtimeChannel | null,
    iceServers: FALLBACK_ICE as RTCIceServer[],
    pendingIce: [] as RTCIceCandidateInit[],
    stopRing: null as (() => void) | null,
    ringTimer: null as ReturnType<typeof setTimeout> | null,
    connectTimer: null as ReturnType<typeof setTimeout> | null,
    dropTimer: null as ReturnType<typeof setTimeout> | null,
    noticeTimer: null as ReturnType<typeof setTimeout> | null,
    offered: false,
    phase: "idle" as CallPhase,
  });
  const peopleRef = useRef(people);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  const nameOf = useCallback(
    (id: string | null) => peopleRef.current.find((p) => p.id === id)?.full_name ?? "Someone",
    []
  );

  const setPhase = useCallback((phase: CallPhase, patch: Partial<CallState> = {}) => {
    m.current.phase = phase;
    setCall((c) => ({ ...c, phase, ...patch }));
  }, []);

  // ---------------------------------------------------------------- teardown
  const clearTimers = useCallback(() => {
    const s = m.current;
    for (const k of ["ringTimer", "connectTimer", "dropTimer"] as const) {
      if (s[k]) clearTimeout(s[k]!);
      s[k] = null;
    }
    s.stopRing?.();
    s.stopRing = null;
  }, []);

  const teardown = useCallback(
    (notice: string | null) => {
      const s = m.current;
      clearTimers();
      s.pc?.close();
      s.pc = null;
      s.local?.getTracks().forEach((t) => t.stop());
      s.local = null;
      if (s.channel) {
        void supabase.removeChannel(s.channel);
        s.channel = null;
      }
      s.callId = null;
      s.peerId = null;
      s.role = null;
      s.pendingIce = [];
      s.offered = false;
      s.phase = "idle";
      setCall({ ...IDLE, notice });
      if (s.noticeTimer) clearTimeout(s.noticeTimer);
      if (notice) s.noticeTimer = setTimeout(() => setCall((c) => (c.phase === "idle" ? { ...c, notice: null } : c)), 5000);
    },
    [clearTimers, supabase]
  );

  // ---------------------------------------------------------------- signaling
  const signal = useCallback((event: string, payload: Record<string, unknown>) => {
    const ch = m.current.channel;
    if (!ch) return;
    void ch.send({ type: "broadcast", event, payload });
  }, []);

  const flushIce = useCallback(async () => {
    const pc = m.current.pc;
    if (!pc || !pc.remoteDescription) return;
    const queued = m.current.pendingIce;
    m.current.pendingIce = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* a stale candidate is harmless */
      }
    }
  }, []);

  const finish = useCallback(
    (status: "ended" | "cancelled" | "declined" | "missed", notice: string | null, tell = true) => {
      const id = m.current.callId;
      if (id) {
        if (tell) signal("bye", {});
        setStatus(id, status);
      }
      teardown(notice);
    },
    [signal, setStatus, teardown]
  );

  const makePeer = useCallback(() => {
    const s = m.current;
    const pc = new RTCPeerConnection({ iceServers: s.iceServers });
    s.pc = pc;
    s.local?.getTracks().forEach((t) => pc.addTrack(t, s.local!));
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      const hasVideo = () => stream.getVideoTracks().some((t) => t.readyState === "live");
      setCall((c) => ({ ...c, remoteStream: stream, remoteVideo: hasVideo() }));
      e.track.onended = () => setCall((c) => ({ ...c, remoteVideo: hasVideo() }));
    };
    pc.onicecandidate = (e) => {
      if (e.candidate) signal("ice", { candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === "connected") {
        if (s.connectTimer) clearTimeout(s.connectTimer);
        if (s.dropTimer) clearTimeout(s.dropTimer);
        s.connectTimer = null;
        s.dropTimer = null;
        setCall((c) => (c.phase === "active" ? c : { ...c, phase: "active", connectedAt: Date.now() }));
        s.phase = "active";
      } else if (st === "disconnected") {
        if (s.dropTimer) clearTimeout(s.dropTimer);
        s.dropTimer = setTimeout(() => finish("ended", "The connection was lost."), DROP_GRACE_MS);
      } else if (st === "failed") {
        finish(
          "ended",
          "Couldn't connect the call. A strict firewall or network may be blocking direct calls."
        );
      }
    };
    return pc;
  }, [finish, signal]);

  /** Opens the call's private channel and waits until it is live. */
  const openSignal = useCallback(
    (callId: string) =>
      new Promise<void>((resolve, reject) => {
        const ch = supabase.channel(`call:${callId}`, {
          config: { private: true, broadcast: { self: false } },
        });
        m.current.channel = ch;
        ch.on("broadcast", { event: "offer" }, async ({ payload }) => {
          const s = m.current;
          if (s.role !== "callee" || !s.pc || s.callId !== callId) return;
          const sdp = payload?.sdp as RTCSessionDescriptionInit | undefined;
          if (!sdp || sdp.type !== "offer" || typeof sdp.sdp !== "string") return;
          try {
            await s.pc.setRemoteDescription(sdp);
            await flushIce();
            const answer = await s.pc.createAnswer();
            await s.pc.setLocalDescription(answer);
            signal("answer", { sdp: s.pc.localDescription?.toJSON() });
          } catch {
            finish("ended", "Couldn't set up the call.");
          }
        })
          .on("broadcast", { event: "answer" }, async ({ payload }) => {
            const s = m.current;
            if (s.role !== "caller" || !s.pc || s.callId !== callId) return;
            const sdp = payload?.sdp as RTCSessionDescriptionInit | undefined;
            if (!sdp || sdp.type !== "answer" || typeof sdp.sdp !== "string") return;
            if (s.pc.signalingState !== "have-local-offer") return;
            try {
              await s.pc.setRemoteDescription(sdp);
              await flushIce();
            } catch {
              finish("ended", "Couldn't set up the call.");
            }
          })
          .on("broadcast", { event: "ice" }, async ({ payload }) => {
            const s = m.current;
            if (s.callId !== callId) return;
            const cand = payload?.candidate as RTCIceCandidateInit | undefined;
            if (!cand) return;
            if (s.pc?.remoteDescription) {
              try {
                await s.pc.addIceCandidate(cand);
              } catch {
                /* ignore */
              }
            } else {
              s.pendingIce.push(cand);
            }
          })
          .on("broadcast", { event: "bye" }, () => {
            if (m.current.callId === callId) teardown("Call ended.");
          })
          .subscribe((status) => {
            if (status === "SUBSCRIBED") resolve();
            else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
              reject(new Error("signal"));
            }
          });
      }),
    [supabase, flushIce, signal, finish, teardown]
  );

  const loadIce = useCallback(async () => {
    try {
      const res = await fetch("/api/call/ice", { cache: "no-store" });
      if (res.ok) {
        const j = (await res.json()) as { iceServers?: RTCIceServer[] };
        if (j.iceServers?.length) m.current.iceServers = j.iceServers;
      }
    } catch {
      m.current.iceServers = FALLBACK_ICE;
    }
  }, []);

  async function getMedia(kind: CallKind): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser can't make calls (it needs a secure https connection).");
    }
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: kind === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
      });
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        throw new Error(
          kind === "video"
            ? "Camera or microphone access is blocked. Allow it in the browser's address bar and try again."
            : "Microphone access is blocked. Allow it in the browser's address bar and try again."
        );
      }
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        throw new Error(kind === "video" ? "No camera or microphone was found." : "No microphone was found.");
      }
      throw new Error("Couldn't start the microphone or camera.");
    }
  }

  // ---------------------------------------------------------------- outgoing
  const canCall = useCallback(
    (peerId: string) => {
      if (!ready) return { ok: false, reason: "Chat is still loading." };
      if (typeof RTCPeerConnection === "undefined") return { ok: false, reason: "This browser can't make calls." };
      if (m.current.phase !== "idle" || call.phase !== "idle") return { ok: false, reason: "You're already in a call." };
      if (statusOf(peerId) === "offline") {
        return { ok: false, reason: "Calls are available only when the person is online or away." };
      }
      return { ok: true, reason: null };
    },
    [ready, statusOf, call.phase]
  );

  const startCall = useCallback(
    async (peerId: string, kind: CallKind) => {
      const s = m.current;
      unlockAudio();
      const check = canCall(peerId);
      if (!check.ok) {
        setCall((c) => ({ ...c, notice: check.reason }));
        return;
      }
      s.phase = "outgoing"; // claim the line immediately
      s.peerId = peerId;
      s.role = "caller";
      s.kind = kind;
      setCall({ ...IDLE, phase: "outgoing", peerId, kind });
      try {
        s.local = await getMedia(kind);
        setCall((c) => ({ ...c, localStream: s.local }));
        await loadIce();
        const { data, error } = await supabase
          .from("chat_calls")
          .insert({ org_id: me.orgId, caller_id: me.id, callee_id: peerId, kind })
          .select("id")
          .single();
        if (error || !data) {
          throw new Error(/Too many calls/i.test(error?.message ?? "") ? "Too many calls — try again in a minute." : "Couldn't place the call.");
        }
        s.callId = data.id;
        await openSignal(data.id);
        makePeer();
        s.stopRing = startRingtone("outgoing");
        s.ringTimer = setTimeout(() => {
          const name = nameOf(peerId);
          finish("missed", `${name} didn't answer.`);
          void send(peerId, kind === "video" ? "📞 Missed video call" : "📞 Missed voice call");
        }, RING_MS);
      } catch (e) {
        const id = s.callId;
        if (id) setStatus(id, "cancelled");
        teardown(e instanceof Error ? e.message : "Couldn't place the call.");
      }
    },
    [canCall, loadIce, supabase, me.orgId, me.id, openSignal, makePeer, nameOf, finish, send, teardown, setStatus]
  );

  /** The callee picked up: build the offer and send it. */
  const beginNegotiation = useCallback(async () => {
    const s = m.current;
    if (!s.pc || s.offered) return;
    s.offered = true;
    s.stopRing?.();
    s.stopRing = null;
    if (s.ringTimer) clearTimeout(s.ringTimer);
    s.ringTimer = null;
    setPhase("connecting");
    s.connectTimer = setTimeout(() => finish("ended", "Couldn't connect the call."), CONNECT_MS);
    try {
      const offer = await s.pc.createOffer();
      await s.pc.setLocalDescription(offer);
      signal("offer", { sdp: s.pc.localDescription?.toJSON() });
    } catch {
      finish("ended", "Couldn't set up the call.");
    }
  }, [finish, setPhase, signal]);

  // ---------------------------------------------------------------- incoming
  const onIncoming = useCallback(
    (row: CallRow) => {
      const s = m.current;
      if (row.status !== "ringing") return;
      if (Date.now() - new Date(row.created_at).getTime() > RING_MS + 5000) return; // already stale
      if (s.phase !== "idle" || s.callId) {
        if (s.callId !== row.id) setStatus(row.id, "declined");
        return;
      }
      const kind: CallKind = row.kind === "video" ? "video" : "voice";
      s.callId = row.id;
      s.peerId = row.caller_id;
      s.role = "callee";
      s.kind = kind;
      s.phase = "incoming";
      setCall({ ...IDLE, phase: "incoming", peerId: row.caller_id, kind });
      s.stopRing = startRingtone("incoming");
      s.ringTimer = setTimeout(() => teardown(null), RING_MS);
      if (!pageInFront()) {
        showSystemNotification(
          `${nameOf(row.caller_id)} is calling`,
          kind === "video" ? "Incoming video call" : "Incoming voice call",
          { tag: `call-${row.id}`, sticky: true }
        );
      }
    },
    [setStatus, nameOf, teardown]
  );

  const accept = useCallback(async () => {
    const s = m.current;
    const id = s.callId;
    if (!id || s.phase !== "incoming") return;
    unlockAudio();
    s.stopRing?.();
    s.stopRing = null;
    if (s.ringTimer) clearTimeout(s.ringTimer);
    s.ringTimer = null;
    setPhase("connecting");
    try {
      s.local = await getMedia(s.kind);
      setCall((c) => ({ ...c, localStream: s.local }));
      await loadIce();
      await openSignal(id);
      makePeer();
      s.connectTimer = setTimeout(() => finish("ended", "Couldn't connect the call."), CONNECT_MS);
      const { data, error } = await supabase
        .from("chat_calls")
        .update({ status: "accepted" })
        .eq("id", id)
        .eq("status", "ringing")
        .select("id");
      if (error || !data || data.length === 0) {
        teardown("The call was cancelled.");
      }
    } catch (e) {
      setStatus(id, "declined");
      teardown(e instanceof Error ? e.message : "Couldn't join the call.");
    }
  }, [loadIce, makePeer, openSignal, setPhase, supabase, finish, teardown, setStatus]);

  const decline = useCallback(() => {
    if (m.current.phase === "incoming") finish("declined", null, false);
  }, [finish]);

  const hangUp = useCallback(() => {
    const s = m.current;
    if (s.phase === "outgoing") finish("cancelled", null);
    else if (s.phase === "incoming") finish("declined", null, false);
    else if (s.phase !== "idle") finish("ended", "Call ended.");
  }, [finish]);

  // ---------------------------------------------------------------- live updates from the database
  useEffect(() => {
    if (!ready) return;
    const onRow = (row: CallRow) => {
      const s = m.current;
      if (row.id !== s.callId) return;
      if (s.role === "caller") {
        if (row.status === "accepted") void beginNegotiation();
        else if (row.status === "declined") teardown(`${nameOf(row.callee_id)} declined the call.`);
        else if (row.status === "ended") teardown("Call ended.");
      } else if (s.role === "callee") {
        if (row.status === "cancelled" || row.status === "missed") {
          const was = s.phase === "incoming";
          teardown(was ? `Missed call from ${nameOf(row.caller_id)}.` : null);
        } else if (row.status === "ended") teardown("Call ended.");
      }
    };
    const channel = supabase
      .channel(`calls-${me.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_calls", filter: `callee_id=eq.${me.id}` },
        (p) => onIncoming(p.new as CallRow)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_calls", filter: `callee_id=eq.${me.id}` },
        (p) => onRow(p.new as CallRow)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_calls", filter: `caller_id=eq.${me.id}` },
        (p) => onRow(p.new as CallRow)
      )
      .subscribe(async (st) => {
        if (st !== "SUBSCRIBED") return;
        // A call that started a moment before this page connected is still ringing.
        const since = new Date(Date.now() - RING_MS).toISOString();
        const { data } = await supabase
          .from("chat_calls")
          .select("id, caller_id, callee_id, kind, status, created_at")
          .eq("callee_id", me.id)
          .eq("status", "ringing")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1);
        if (data?.[0]) onIncoming(data[0] as CallRow);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, me.id, ready, onIncoming, beginNegotiation, teardown, nameOf]);

  // Leaving the page ends the call for the other person straight away.
  useEffect(() => {
    const bye = () => {
      const s = m.current;
      if (s.callId && s.phase !== "idle") {
        signal("bye", {});
        setStatus(s.callId, s.phase === "outgoing" ? "cancelled" : s.phase === "incoming" ? "declined" : "ended");
      }
    };
    window.addEventListener("pagehide", bye);
    return () => {
      window.removeEventListener("pagehide", bye);
    };
  }, [signal, setStatus]);

  // Unmounting (sign-out) must release the camera and microphone.
  useEffect(
    () => () => {
      const s = m.current;
      clearTimers();
      s.pc?.close();
      s.local?.getTracks().forEach((t) => t.stop());
    },
    [clearTimers]
  );

  const toggleMute = useCallback(() => {
    const s = m.current;
    setCall((c) => {
      const muted = !c.muted;
      s.local?.getAudioTracks().forEach((t) => (t.enabled = !muted));
      return { ...c, muted };
    });
  }, []);

  const toggleCamera = useCallback(() => {
    const s = m.current;
    setCall((c) => {
      const cameraOff = !c.cameraOff;
      s.local?.getVideoTracks().forEach((t) => (t.enabled = !cameraOff));
      return { ...c, cameraOff };
    });
  }, []);

  const dismissNotice = useCallback(() => setCall((c) => ({ ...c, notice: null })), []);

  const value: CallContextValue = {
    call,
    canCall,
    startCall,
    accept,
    decline,
    hangUp,
    toggleMute,
    toggleCamera,
    dismissNotice,
  };
  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
