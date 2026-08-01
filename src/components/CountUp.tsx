'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Animates a number from its previous value to `value` (ease-out cubic,
 * ~0.9s). Renders plain text — wrap it in whatever Typography the caller
 * wants. Static under prefers-reduced-motion. Always `tabular-nums` so the
 * layout never jitters while counting.
 */
export default function CountUp({
  value,
  format,
  duration = 900,
}: {
  value: number;
  /** Defaults to en-IN grouping (1,23,456 style like the rest of the app). */
  format?: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return undefined;
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      fromRef.current = value;
      setShown(value);
      return undefined;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (value - from) * eased);
      setShown(current);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const text = format ? format(shown) : shown.toLocaleString('en-IN');
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{text}</span>;
}
