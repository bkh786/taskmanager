"use client";

/**
 * Sound and system alerts for the chat.
 *
 * A web page cannot play the operating system's own notification tone directly.
 * What it can do is raise a system notification: the OS then plays its default
 * notification sound (as it does for any other app). When the page is open and in
 * front, or notifications are not allowed, a short built-in chime plays instead.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

/** Browsers only allow sound after the person has used the page; call this on any interaction. */
export function unlockAudio() {
  const c = audio();
  if (c && c.state === "suspended") void c.resume().catch(() => undefined);
}

function tone(freq: number, start: number, length: number, volume = 0.16) {
  const c = audio();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(c.destination);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

/** A short two-note chime for a new message. */
export function playChime() {
  const c = audio();
  if (!c) return;
  void c.resume().catch(() => undefined);
  const t = c.currentTime;
  tone(880, t, 0.28);
  tone(1320, t + 0.16, 0.4);
}

/** A repeating ring. `incoming` rings for the person being called; `outgoing` is the soft tone the caller hears. Returns a stop function. */
export function startRingtone(kind: "incoming" | "outgoing"): () => void {
  const c = audio();
  if (!c) return () => undefined;
  void c.resume().catch(() => undefined);
  const burst = () => {
    const t = c.currentTime;
    if (kind === "incoming") {
      for (const o of [0, 0.5]) {
        tone(659, t + o, 0.18, 0.2);
        tone(784, t + o + 0.2, 0.18, 0.2);
      }
    } else {
      tone(425, t, 0.9, 0.07);
    }
  };
  burst();
  const timer = setInterval(burst, kind === "incoming" ? 2600 : 3200);
  return () => clearInterval(timer);
}

export type AlertPermission = NotificationPermission | "unsupported";

export function alertPermission(): AlertPermission {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestAlertPermission(): Promise<AlertPermission> {
  if (typeof Notification === "undefined") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** Raises a system notification (the OS plays its default tone). Returns false if it could not. */
export function showSystemNotification(
  title: string,
  body: string,
  opts: { tag?: string; sticky?: boolean; onClick?: () => void } = {}
): boolean {
  if (alertPermission() !== "granted") return false;
  try {
    const n = new Notification(title, {
      body,
      tag: opts.tag,
      silent: false,
      requireInteraction: !!opts.sticky,
    });
    n.onclick = () => {
      window.focus();
      opts.onClick?.();
      n.close();
    };
    return true;
  } catch {
    return false;
  }
}

/** True when the person is looking at this page. */
export function pageInFront(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}
