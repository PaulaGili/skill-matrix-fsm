"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toUserMessage } from "@/lib/fsm/errors";
import { useI18n } from "@/lib/i18n/I18nProvider";

interface AsyncData<T> {
  data: T | null;
  failure: { cause: unknown } | null; // kept as thrown, so the text follows the language
  loading: boolean;
}

// Loads data on mount and exposes reload(). Pass a stable function, not an inline arrow.
export function useAsyncData<T>(load: () => Promise<T>) {
  const [state, setState] = useState<AsyncData<T>>({ data: null, failure: null, loading: true });
  const { t } = useI18n();

  const latestRequest = useRef(0);

  // When two reloads overlap, only the result of the latest one is kept.
  const reload = useCallback(async () => {
    const request = ++latestRequest.current;
    setState((current) => ({ ...current, failure: null, loading: true }));
    try {
      const data = await load();
      if (request === latestRequest.current) setState({ data, failure: null, loading: false });
    } catch (cause) {
      if (request === latestRequest.current) setState((current) => ({ ...current, failure: { cause }, loading: false }));
    }
  }, [load]);

  useEffect(() => {
    reload();
  }, [reload]);

  const error = state.failure ? toUserMessage(state.failure.cause, t) : null;
  return { data: state.data, error, loading: state.loading, reload };
}
