"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { promptInstall, usePwa } from "./pwa-state";

const INSTALLED_KEY = "tm-pwa-installed";
const SNOOZE_KEY = "tm-install-snooze";
const SNOOZE_MS = 12 * 60 * 60 * 1000; // asks again twice a day until the app is installed

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Asks each device to install the app, on every page, until it is installed. "Not now"
 * only pauses it for half a day. Once the app has been opened as an installed app on this
 * device (or the browser reports an install), it stops for good.
 */
export function InstallBanner() {
  const pwa = usePwa();
  const [mounted, setMounted] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const [installedFlag, setInstalledFlag] = useState(false);
  const [help, setHelp] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    // Browser-only facts (storage, device type) can only be read after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    setInstalledFlag(read(INSTALLED_KEY) === "1");
    setSnoozed(Date.now() < Number(read(SNOOZE_KEY) ?? 0));
    setMobile(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia?.("(pointer: coarse)").matches && window.innerWidth < 900));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (pwa.installed) write(INSTALLED_KEY, "1");
  }, [pwa.installed]);

  if (!mounted || pwa.installed || installedFlag || snoozed) return null;
  // Desktop browsers without an install prompt have nothing useful to offer here.
  if (!pwa.canInstall && !mobile) return null;

  return (
    <div role="region" aria-label="Install the app" className="mb-3 rounded-lg px-3.5 py-2.5 flex flex-col gap-2" style={{ background: "var(--accent-soft)", border: "1px solid var(--panel-border)" }}>
      <div className="flex items-center gap-3">
        <Image src="/icons/icon-192.png" alt="" width={36} height={36} unoptimized className="rounded-lg shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-text-main leading-tight">Install Task Manager</div>
          <div className="text-[12px] text-text-sub leading-snug">Open it like an app and get alerts even when the browser is closed.</div>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={() => {
            write(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
            setSnoozed(true);
          }}
          className="border-none bg-transparent text-text-sub text-[12.5px] font-semibold cursor-pointer px-2 py-1.5"
        >
          Not now
        </button>
        {pwa.canInstall ? (
          <button type="button" onClick={() => void promptInstall()} className="border-none bg-accent text-white px-4 py-2 rounded-md text-[13px] font-bold cursor-pointer">
            Install
          </button>
        ) : (
          <button type="button" onClick={() => setHelp((h) => !h)} className="border-none bg-accent text-white px-4 py-2 rounded-md text-[13px] font-bold cursor-pointer">
            {help ? "Hide steps" : "How to install"}
          </button>
        )}
      </div>
      {help && !pwa.canInstall ? (
        <ol className="m-0 pl-5 text-[12.5px] text-text-body leading-relaxed list-decimal">
          {pwa.ios ? (
            <>
              <li>Tap the <b>Share</b> button in Safari (the square with an arrow).</li>
              <li>Choose <b>Add to Home Screen</b>, then <b>Add</b>.</li>
              <li>Open Task Manager from your home screen.</li>
            </>
          ) : (
            <>
              <li>Open your browser&apos;s menu (the <b>⋮</b> or <b>≡</b> button).</li>
              <li>Tap <b>Install app</b> (or <b>Add to Home screen</b>).</li>
              <li>Open Task Manager from your home screen.</li>
            </>
          )}
        </ol>
      ) : null}
    </div>
  );
}
