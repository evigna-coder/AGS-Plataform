import { useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTabs } from '../../contexts/TabsContext';
import { MODULE_ROOTS } from './navigation';

/**
 * Global keyboard shortcuts for the Layout:
 * - Escape: navigate to parent route (blur input first if focused)
 * - Ctrl+Tab / Ctrl+Shift+Tab: cycle through tabs
 * - Ctrl+1-9: jump to tab by position
 */
export function useLayoutKeyboardShortcuts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { tabs, activeTabId, switchTab } = useTabs();

  // Compute parent path by stripping the last segment, but never go past a module root
  const getParentPath = useCallback((pathname: string): string | null => {
    if (MODULE_ROOTS.has(pathname)) return null; // already at root
    const segments = pathname.split('/').filter(Boolean);
    // Try removing last segment
    while (segments.length > 1) {
      segments.pop();
      const candidate = '/' + segments.join('/');
      // If this is a valid module root or a route above it, return it
      return candidate;
    }
    return '/' + segments[0]; // fallback to top-level module
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ── Ctrl+1-9 → jump to tab by position ──
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (idx < tabs.length) {
          e.preventDefault();
          switchTab(tabs[idx].id);
        }
        return;
      }

      // ── Ctrl+Tab / Ctrl+Shift+Tab → cycle tabs ──
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Tab' || e.key === 'PageDown' || e.key === 'PageUp')) {
        if (tabs.length <= 1) return;
        e.preventDefault();
        const currentIdx = tabs.findIndex(t => t.id === activeTabId);
        const forward = e.key === 'Tab' ? !e.shiftKey : e.key === 'PageDown';
        const nextIdx = forward
          ? (currentIdx + 1) % tabs.length
          : (currentIdx - 1 + tabs.length) % tabs.length;
        switchTab(tabs[nextIdx].id);
        return;
      }

      // ── Escape → navigate to parent ──
      if (e.key !== 'Escape') return;
      // If user is in an input, blur it first — second Escape will navigate
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        (e.target as HTMLElement).blur();
        e.preventDefault();
        return;
      }
      if (document.querySelector('[role="dialog"], .modal-overlay, [data-modal]')) return;

      // Prefer navigation memory (state.from) over parent path
      const stateFrom = (location.state as any)?.from;
      if (stateFrom && typeof stateFrom === 'string') {
        e.preventDefault();
        navigate(stateFrom);
        return;
      }

      const parent = getParentPath(location.pathname);
      if (!parent) return; // at module root, don't navigate
      e.preventDefault();
      // Use real browser back to preserve search params (filters) on the previous page
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate(parent);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, location.pathname, location.state, getParentPath, tabs, activeTabId, switchTab]);
}
