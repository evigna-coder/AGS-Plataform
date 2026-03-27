import { useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Navigates back preserving URL search params (filters).
 *
 * Strategy: use real browser history (navigate(-1)) so that search params
 * on the previous page are restored. Falls back to module root when there
 * is no in-app history to go back to.
 *
 * The `from` Link state still takes priority when provided.
 */
export function useNavigateBack() {
  const navigate = useNavigate();
  const { pathname, state, key } = useLocation();

  return useCallback(() => {
    // If the caller passed { from: '/some/path' } via Link state, go back there
    if (state?.from && typeof state.from === 'string') {
      navigate(state.from);
      return;
    }

    // MemoryRouter: key !== 'default' means there's history to go back to
    // (initial entry always has key "default", subsequent navigations get random keys)
    if (key !== 'default') {
      navigate(-1);
      return;
    }

    // Fallback: no history, go to module root deterministically
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return;

    if (segments[0] === 'stock' && segments.length > 2) {
      navigate('/' + segments[0] + '/' + segments[1]);
      return;
    }

    navigate('/' + segments[0]);
  }, [navigate, pathname, state, key]);
}
