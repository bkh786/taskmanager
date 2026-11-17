"use client";

import { useSyncExternalStore } from "react";

export type PwaState = {
  ready: boolean;
  /** The browser can do service workers and push. */
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  /** This device is registered for push. */
  subscribed: boolean;
  /** The browser offered an install prompt we can trigger. */
  canInstall: boolean;
  /** Already running as an installed app. */
  installed: boolean;
  ios: boolean;
  busy: boolean;
  error: string | null;
};

const INITIAL: PwaState = {
  ready: false,
  supported: false,
  permission: "unsupported",
  subscribed: false,
  canInstall: false,
  installed: false,
  ios: false,
  busy: false,
  error: null,
};

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let state: PwaState = INITIAL;
let deferredPrompt: InstallPromptEvent | null = null;
let started = false;
const listeners = new Set<() => void>();

function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Registers the service worker and reads this device's current state. Safe to call more than once. */
export function startPwa() {
  if (started || typeof window === "undefined") return;
  started = true;

  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac; an Android user agent is never iOS.
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1 && !/Android/.test(ua));
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  set({
    ios,
    installed: standalone,
    supported,
    permission: "Notification" in window ? Notification.permission : "unsupported",
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    set({ canInstall: false, installed: true });
  });

  if (!("serviceWorker" in navigator)) {
    set({ ready: true });
    return;
  }
  void (async () => {
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const reg = await registration();
      const sub = await reg?.pushManager?.getSubscription();
      set({ ready: true, subscribed: !!sub, permission: "Notification" in window ? Notification.permission : "unsupported" });
    } catch {
      set({ ready: true });
    }
  })();
}

export async function promptInstall(): Promise<void> {
  if (!deferredPrompt) return;
  const p = deferredPrompt;
  deferredPrompt = null;
  set({ canInstall: false });
  await p.prompt();
  await p.userChoice.catch(() => undefined);
}

export async function enablePush(): Promise<boolean> {
  set({ busy: true, error: null });
  try {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!state.supported) throw new Error("This browser doesn't support push notifications.");
    if (!key) throw new Error("Push isn't set up on the server yet.");
    const permission = await Notification.requestPermission();
    set({ permission });
    if (permission !== "granted") {
      throw new Error("Notifications are blocked. Allow them in the browser's address bar or site settings, then try again.");
    }
    const reg = await registration();
    if (!reg) throw new Error("The app isn't ready yet. Reload and try again.");
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
    const json = sub.toJSON();
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
    });
    if (!res.ok) throw new Error("Couldn't register this device.");
    set({ subscribed: true, busy: false });
    return true;
  } catch (e) {
    set({ busy: false, error: e instanceof Error ? e.message : "Couldn't turn on notifications." });
    return false;
  }
}

export async function disablePush(): Promise<void> {
  set({ busy: true, error: null });
  try {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => undefined);
      await sub.unsubscribe();
    }
    set({ subscribed: false, busy: false });
  } catch {
    set({ busy: false, error: "Couldn't turn notifications off." });
  }
}

/** Re-attaches this device's existing push registration to whoever is signed in now. */
export async function claimDevice(): Promise<void> {
  try {
    const reg = await registration();
    const sub = await reg?.pushManager?.getSubscription();
    if (!sub) return;
    const json = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent }),
    });
  } catch {
    /* best effort */
  }
}

/** Forget this device's push registration (used on sign-out). */
export async function releasePushOnSignOut(): Promise<void> {
  try {
    const reg = await registration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    /* best effort */
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** True when this device is registered for push (so a push, not the open tab, raises system alerts). */
export function isPushActive(): boolean {
  return state.subscribed && state.permission === "granted";
}

export function usePwa(): PwaState {
  return useSyncExternalStore(subscribe, () => state, () => INITIAL);
}
