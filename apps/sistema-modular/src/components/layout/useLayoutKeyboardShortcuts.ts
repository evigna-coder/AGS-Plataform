import { useEffect } from 'react';
import { useTabs } from '../../contexts/TabsContext';
import { MODULE_ROOTS } from './navigation';

/**
 * Global keyboard shortcuts for the Layout:
 * - Escape: go back (state.from → navigate(-1) → module-root fallback). Same
 *   behavior as the header arrow button. Previously this navigated to a computed
 *   "parent path" which jumped to the listing instead of returning to the actual
 *   referrer (e.g. cliente → establecimiento → Escape landed on /establecimientos
 *   instead of the cliente). It also dropped URL search params, resetting list
 *   filters.
 * - Ctrl+Tab / Ctrl+Shift+Tab: cycle through tabs
 * - Ctrl+1-9: jump to tab by position
 */
export function useLayoutKeyboardShortcuts() {
  const { tabs, activeTabId, activeTabPath, switchTab, goBackInActiveTab } = useTabs();

  const pathname = activeTabPath.split('?')[0];

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

      // ── Escape → go back ──
      if (e.key !== 'Escape') return;
      // If user is in an input, blur it first — second Escape will navigate
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        (e.target as HTMLElement).blur();
        e.preventDefault();
        return;
      }
      if (document.querySelector('[role="dialog"], .modal-overlay, [data-modal]')) return;
      if (MODULE_ROOTS.has(pathname)) return; // at module root, nothing to go back to
      e.preventDefault();
      goBackInActiveTab();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pathname, tabs, activeTabId, switchTab, goBackInActiveTab]);
}
