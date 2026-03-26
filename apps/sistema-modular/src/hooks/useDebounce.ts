import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Returns a debounced version of `value`.
 * The returned value only updates after `delay` ms of inactivity.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

/**
 * Pair of [inputValue, debouncedValue] with a setter.
 * Use `inputValue` for the <input>, `debouncedValue` for filtering/queries.
 */
export function useDebouncedSearch(initial = '', delay = 300) {
  const [value, setValue] = useState(initial);
  const debounced = useDebounce(value, delay);
  return [value, debounced, setValue] as const;
}

/**
 * Returns a debounced callback that only fires after `delay` ms of inactivity.
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay = 300,
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    ((...args: any[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay);
    }) as T,
    [delay],
  );
}
