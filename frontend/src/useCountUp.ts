import { useEffect, useRef, useState } from "react";

/**
 * A number that counts to its new value instead of jumping there — the showreel's page counter
 * (DESIGN.md E-29). Presentation only: the value it returns is for the eye, and whatever reads
 * the real number (the progress bar's `aria-valuenow`) keeps reading the prop.
 *
 * The first paint counts up from zero; every later change counts from where the last one
 * stopped, so saving 142 → 214 reads as 72 pages and not as a restart. Under
 * `prefers-reduced-motion` it returns the target at once (E-26).
 */
export function useCountUp(target: number, duration = 1100): number {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? target : 0));
  const from = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion()) {
      from.current = target;
      setShown(target);
      return;
    }

    const start = from.current;
    const began = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      // power3.out, the showreel's counting curve
      const eased = 1 - (1 - t) ** 3;
      const value = Math.round(start + (target - start) * eased);
      from.current = value;
      setShown(value);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return shown;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}
