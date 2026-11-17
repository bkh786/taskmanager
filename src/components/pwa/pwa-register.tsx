"use client";

import { useEffect } from "react";
import { startPwa } from "./pwa-state";

/** Registers the service worker once per page load. Renders nothing. */
export function PwaRegister() {
  useEffect(() => {
    startPwa();
  }, []);
  return null;
}
