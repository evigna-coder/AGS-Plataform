import { useCallback, useState } from 'react';

const EXPANDED_KEY = 'protocol-accordion-expanded';
const COMPLETED_KEY = 'protocol-accordion-completed';

function readSet(key: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

function writeSet(key: string, s: Set<string>) {
  try {
    sessionStorage.setItem(key, JSON.stringify([...s]));
  } catch {
    // sessionStorage puede estar deshabilitado (Safari privado); estado en memoria suficiente
  }
}

/**
 * Accordion state for mobile/tablet protocol cards.
 * Persists expanded + completed ids in sessionStorage so state survives step navigation within the wizard.
 */
export function useAccordionCard(id: string) {
  const [expanded, setExpanded] = useState<boolean>(() => readSet(EXPANDED_KEY).has(id));
  const [completed, setCompleted] = useState<boolean>(() => readSet(COMPLETED_KEY).has(id));

  const toggle = useCallback(() => {
    setExpanded(prev => {
      const s = readSet(EXPANDED_KEY);
      if (prev) s.delete(id);
      else s.add(id);
      writeSet(EXPANDED_KEY, s);
      return !prev;
    });
  }, [id]);

  const close = useCallback(() => {
    setExpanded(false);
    const s = readSet(EXPANDED_KEY);
    s.delete(id);
    writeSet(EXPANDED_KEY, s);
  }, [id]);

  const markCompleted = useCallback(() => {
    setExpanded(false);
    setCompleted(true);
    const exp = readSet(EXPANDED_KEY);
    exp.delete(id);
    writeSet(EXPANDED_KEY, exp);
    const comp = readSet(COMPLETED_KEY);
    comp.add(id);
    writeSet(COMPLETED_KEY, comp);
  }, [id]);

  const clearCompleted = useCallback(() => {
    setCompleted(false);
    const comp = readSet(COMPLETED_KEY);
    comp.delete(id);
    writeSet(COMPLETED_KEY, comp);
  }, [id]);

  return { expanded, toggle, close, completed, markCompleted, clearCompleted };
}
