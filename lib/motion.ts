// Motion utilities shared by chart primitives and tiles.
"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Animate a number from 0 (or the previous value) to `target` with an ease-out
 * curve. Returns the in-flight value. Respects prefers-reduced-motion by
 * snapping straight to the target.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? target : 0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs, reduce]);

  return value;
}

/**
 * Random digit-scramble: returns `target` with its digit characters rapidly
 * cycling random 0-9, settling left-to-right to the real string over
 * `durationMs`. Non-digit chars (commas, dots, spaces, units) are preserved.
 * Re-runs fully on every mount (no persisted ref) so it survives React
 * StrictMode's dev double-mount. Snaps to `target` under reduced-motion.
 */
export function useScramble(target: string, durationMs = 1200): string {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    if (reduce) {
      setDisplay(target);
      return;
    }
    const chars = target.split("");
    const digitIdx: number[] = [];
    chars.forEach((c, i) => {
      if (c >= "0" && c <= "9") digitIdx.push(i);
    });
    if (digitIdx.length === 0) {
      setDisplay(target);
      return;
    }

    const randomized = (lockUntil: number) => {
      const out = chars.slice();
      digitIdx.forEach((idx, k) => {
        if (k >= lockUntil) out[idx] = String(Math.floor(Math.random() * 10));
      });
      return out.join("");
    };

    let raf = 0;
    let last = 0;
    let start = 0;
    const tick = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / durationMs);
      if (now - last >= 45 || t >= 1) {
        last = now;
        setDisplay(randomized(Math.floor(t * digitIdx.length)));
      }
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(target);
    };

    setDisplay(randomized(0)); // start fully scrambled
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, reduce]);

  return display;
}
