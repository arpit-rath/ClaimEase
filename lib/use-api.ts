"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiFailure, ApiResult } from "@/lib/api-client";

export type ApiQueryState<T> =
  | { status: "loading" }
  | { status: "error"; failure: ApiFailure }
  | { status: "success"; data: T };

/**
 * Loads data once on mount (and again when the page becomes visible after
 * navigating back), with a reload() for Retry buttons.
 * `refreshOn` is an optional window event name that also triggers a reload.
 */
export function useApiQuery<T>(fetcher: () => Promise<ApiResult<T>>, refreshOn?: string) {
  const [state, setState] = useState<ApiQueryState<T>>({ status: "loading" });
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetcher().then((result) => {
      if (cancelled) return;
      setState(result.ok ? { status: "success", data: result.data } : { status: "error", failure: result.failure });
    });
    return () => {
      cancelled = true;
    };
  }, [fetcher, version]);

  useEffect(() => {
    if (!refreshOn) return;
    const onChange = () => setVersion((v) => v + 1);
    window.addEventListener(refreshOn, onChange);
    return () => window.removeEventListener(refreshOn, onChange);
  }, [refreshOn]);

  return { state, reload };
}

/** A short, user-facing explanation of a failed request. */
export function describeFailure(failure: ApiFailure): string {
  switch (failure.kind) {
    case "network":
      return "Couldn't reach the server. Check your connection and try again.";
    case "api":
      return failure.message;
    case "unexpected":
      return `The server sent an unexpected response (HTTP ${failure.status}).`;
  }
}
