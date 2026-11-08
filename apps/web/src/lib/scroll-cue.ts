'use client';

/**
 * @file scroll-cue.ts
 * @description A strip that scrolls sideways with its scrollbar hidden (the settings tabs) says so: `data-more-left` and `data-more-right` mark the edges that
 * hide more, and `.scroll-cue` in globals.css fades those edges. Physical sides, because the fade is drawn on the screen; in RTL the strip starts on the right.
 * Nothing moves or resizes, so the layout stays as it was (review M2).
 */
import { type DependencyList, type RefObject, useEffect } from 'react';

/** Which physical edges hide more of a strip, from its scroll position. `scrollLeft` is 0 at the start and negative toward the end in RTL. */
export function scrollEdges(
  strip: { scrollLeft: number; scrollWidth: number; clientWidth: number },
  rtl: boolean,
): { left: boolean; right: boolean } {
  const max = strip.scrollWidth - strip.clientWidth;
  if (max <= 1) return { left: false, right: false };
  const fromStart = Math.abs(strip.scrollLeft);
  const start = fromStart > 1;
  const end = fromStart < max - 1;
  return rtl ? { left: end, right: start } : { left: start, right: end };
}

export function useScrollCue(ref: RefObject<HTMLElement | null>, deps: DependencyList = []) {
  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const update = () => {
      const edges = scrollEdges(strip, getComputedStyle(strip).direction === 'rtl');
      strip.toggleAttribute('data-more-left', edges.left);
      strip.toggleAttribute('data-more-right', edges.right);
    };
    update();
    strip.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(strip);
    return () => {
      strip.removeEventListener('scroll', update);
      observer?.disconnect();
    };
    // The caller names what changes the strip's content, such as the number of tabs.
  }, [ref, ...deps]);
}
