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
    if (state?.from && typeof state.from === 'string') {
      navigate(state.from);
      return;
    }

    // BrowserRouter: key !== 'default' means there's in-app history to pop
    if (key !== 'default') {
      navigate(-1);
      return;
    }

    // Fallback: derive module root from current pathname
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length <= 1) return;
    navigate('/' + segments[0]);
  }, [navigate, pathname, state, key]);
}
