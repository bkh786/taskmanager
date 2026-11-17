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
import { createClient } from "@/lib/supabase/client";
import { NOTIF_COLUMNS, type NotificationRow } from "@/lib/notification-shared";
import { pageInFront, playChime, showSystemNotification } from "@/lib/alerts";
import { claimDevice, usePwa } from "@/components/pwa/pwa-state";

type Ctx = {
  ready: boolean;
  items: NotificationRow[];
  unread: number;
  /** Critical alerts nobody has acknowledged yet, newest first. */
  openCritical: NotificationRow[];
  toast: NotificationRow | null;
  dismissToast: () => void;
  markRead: (ids: string[]) => void;
  markAllRead: () => void;
  acknowledge: (id: string) => void;
  remove: (ids: string[]) => void;
  loadOlder: () => Promise<boolean>;
};

const NotificationContext = createContext<Ctx | null>(null);

export function useNotifications(): Ctx {
  const v = useContext(NotificationContext);
  if (!v) throw new Error("useNotifications must be used inside NotificationProvider");
  return v;
}
export function useNotificationsOptional(): Ctx | null {
  return useContext(NotificationContext);
}

const PAGE = 50;

/** Platform owners have no notifications of their own (userId null): nothing is mounted for them. */
export function NotificationProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  if (!userId) return <>{children}</>;
  return <NotificationProviderInner userId={userId}>{children}</NotificationProviderInner>;
}

function NotificationProviderInner({ userId, children }: { userId: string; children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const pwa = usePwa();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [toast, setToast] = useState<NotificationRow | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    subscribedRef.current = pwa.subscribed && pwa.permission === "granted";
  }, [pwa.subscribed, pwa.permission]);

  // A browser keeps its push registration after sign-out; attach it to whoever is signed in now.
  useEffect(() => {
    if (pwa.subscribed) void claimDevice();
  }, [pwa.subscribed, userId]);

  const merge = useCallback((list: NotificationRow[]) => {
    setItems((prev) => {
      const map = new Map(prev.map((n) => [n.id, n]));
      for (const n of list) map.set(n.id, { ...map.get(n.id), ...n });
      return [...map.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("notifications")
        .select(NOTIF_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(PAGE * 2);
      if (cancelled) return;
      merge((data ?? []) as NotificationRow[]);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, merge]);

  const arrive = useCallback((n: NotificationRow) => {
    if (pageInFront()) {
      playChime();
      if (n.level === "critical") setTimeout(playChime, 500);
      setToast(n);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), n.level === "critical" ? 9000 : 6000);
    } else if (!subscribedRef.current) {
      // No push on this device: fall back to a system notification while the tab is open in the background.
      const shown = showSystemNotification(n.title, n.body ?? "", { tag: n.id, sticky: n.level === "critical" });
      if (!shown) playChime();
    }
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (p) => {
          const n = p.new as NotificationRow;
          merge([n]);
          arrive(n);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        (p) => merge([p.new as NotificationRow])
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId, merge, arrive]);

  const markRead = useCallback(
    (ids: string[]) => {
      const now = new Date().toISOString();
      const todo = ids.filter((id) => items.find((n) => n.id === id && !n.read_at));
      if (todo.length === 0) return;
      setItems((prev) => prev.map((n) => (todo.includes(n.id) ? { ...n, read_at: now } : n)));
      void (async () => {
        await supabase.from("notifications").update({ read_at: now }).in("id", todo);
      })();
    },
    [supabase, items]
  );

  const markAllRead = useCallback(() => {
    const ids = items.filter((n) => !n.read_at && n.level !== "critical").map((n) => n.id);
    // Critical alerts need an explicit acknowledgement, so "mark all" leaves them.
    markRead(ids);
  }, [items, markRead]);

  const acknowledge = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now, acknowledged_at: now } : n)));
      setToast((t) => (t?.id === id ? null : t));
      void (async () => {
        await supabase.from("notifications").update({ read_at: now, acknowledged_at: now }).eq("id", id);
      })();
    },
    [supabase]
  );

  const remove = useCallback(
    (ids: string[]) => {
      setItems((prev) => prev.filter((n) => !ids.includes(n.id)));
      void (async () => {
        await supabase.from("notifications").delete().in("id", ids);
      })();
    },
    [supabase]
  );

  const loadOlder = useCallback(async () => {
    const oldest = items[items.length - 1]?.created_at;
    if (!oldest) return false;
    const { data } = await supabase
      .from("notifications")
      .select(NOTIF_COLUMNS)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    merge((data ?? []) as NotificationRow[]);
    return (data?.length ?? 0) === PAGE;
  }, [supabase, items, merge]);

  const unread = items.filter((n) => !n.read_at).length;
  const openCritical = items.filter((n) => n.level === "critical" && !n.acknowledged_at);

  const value: Ctx = {
    ready,
    items,
    unread,
    openCritical,
    toast,
    dismissToast: () => setToast(null),
    markRead,
    markAllRead,
    acknowledge,
    remove,
    loadOlder,
  };
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
