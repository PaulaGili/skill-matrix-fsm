"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toUserMessage } from "@/lib/fsm/errors";

interface AsyncData<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

// Loads data on mount and exposes reload(). Pass a stable function, not an inline arrow.
export function useAsyncData<T>(load: () => Promise<T>) {
  const [state, setState] = useState<AsyncData<T>>({ data: null, error: null, loading: true });

  const latestRequest = useRef(0);

  // When two reloads overlap, only the result of the latest one is kept.
  const reload = useCallback(async () => {
    const request = ++latestRequest.current;
    setState((current) => ({ ...current, error: null, loading: true }));
    try {
      const data = await load();
      if (request === latestRequest.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (request === latestRequest.current) setState((current) => ({ ...current, error: toUserMessage(error), loading: false }));
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...state, reload };
}
