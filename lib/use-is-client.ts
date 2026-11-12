"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False while prerendering on the server, true in the browser.
 * Use it for UI that depends on the current date or other browser-only values,
 * so the static HTML never disagrees with what the browser renders.
 */
export function useIsClient() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
