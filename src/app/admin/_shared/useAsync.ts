'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  /** Re-runs the loader (keeps the last data on screen until the new data lands). */
  reload: () => void;
  /** Local mutation — used for optimistic list updates. */
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Fetch-on-mount with reload, guarded against setting state after unmount and
 * against a slow first response overwriting a faster second one.
 *
 * `deps` is a plain array the caller controls (filter values, ids). The loader
 * itself is read through a ref so an inline arrow function does not re-trigger.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const runId = useRef(0);

  useEffect(() => {
    const id = runId.current + 1;
    runId.current = id;
    let alive = true;
    setLoading(true);

    loaderRef.current()
      .then((result) => {
        if (!alive || runId.current !== id) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!alive || runId.current !== id) return;
        setError(err);
      })
      .finally(() => {
        if (alive && runId.current === id) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload, setData };
}
