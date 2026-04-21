import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

/** Mobile phones + tablets en portrait (<1024px). Para UIs que priorizan touch. */
const COMPACT_BREAKPOINT = 1024;

export function useIsCompact(): boolean {
  const [isCompact, setIsCompact] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < COMPACT_BREAKPOINT
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsCompact(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isCompact;
}
