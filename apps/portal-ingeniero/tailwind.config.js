/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', '../../packages/shared/src/**/*.{js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Newsreader', 'ui-serif', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        // Microanimaciones de menú (2026-09-29): entradas cortas y con
        // desaceleración; se aplican con `motion-safe:` para respetar la
        // preferencia de menos movimiento del sistema operativo.
        'nav-in': 'navIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fadeIn 0.18s ease-out both',
        'sheet-up': 'sheetUp 0.26s cubic-bezier(0.22, 1, 0.36, 1) both',
        'modal-in': 'modalIn 0.18s cubic-bezier(0.25, 1, 0.5, 1) both',
        'toast-in': 'toastIn 0.28s cubic-bezier(0.34, 1.3, 0.64, 1) both',
        'toast-out': 'toastOut 0.2s ease-in both',
      },
      keyframes: {
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        navIn: {
          '0%': { opacity: '0', transform: 'translateX(-6px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        sheetUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        modalIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateX(28px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        toastOut: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(28px)' },
        },
      },
    },
  },
  plugins: [],
};
