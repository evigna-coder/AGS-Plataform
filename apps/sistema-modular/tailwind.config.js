/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/shared/src/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        teal: {
          700: '#0D6E6E',
          800: '#0A5A5A',
          900: '#074A4A',
        },
      },
      animation: {
        'slide-in': 'slideIn 0.3s ease-out',
        // Microanimaciones de menú (2026-09-29): entradas cortas y con
        // desaceleración; se aplican con `motion-safe:` para respetar la
        // preferencia de menos movimiento del sistema operativo.
        'nav-in': 'navIn 0.22s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fadeIn 0.18s ease-out both',
        'sheet-up': 'sheetUp 0.26s cubic-bezier(0.22, 1, 0.36, 1) both',
        // Modal: escala 0.96 → 1 con fundido, sin resorte (2026-09-29).
        'modal-in': 'modalIn 0.18s cubic-bezier(0.25, 1, 0.5, 1) both',
        // Toasts: entran desde la derecha con un freno apenas elástico; salen desvaneciéndose a la derecha.
        'toast-in': 'toastIn 0.28s cubic-bezier(0.34, 1.3, 0.64, 1) both',
        'toast-out': 'toastOut 0.2s ease-in both',
        // Esqueleto: brillo que recorre las barras (shimmer).
        'shimmer': 'shimmer 1.4s linear infinite',
        // Fila que acaba de cambiar en una lista en vivo: destello teal que se apaga.
        'fila-cambio': 'filaCambio 1.5s ease-out both',
        // Celda de agenda que cambió: anillo teal que se apaga (el fondo es el color del estado).
        'celda-cambio': 'celdaCambio 1.5s ease-out both',
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
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        filaCambio: {
          '0%': { backgroundColor: 'rgb(204 251 241)' },
          '100%': { backgroundColor: 'transparent' },
        },
        celdaCambio: {
          '0%': { boxShadow: 'inset 0 0 0 3px rgb(20 184 166)' },
          '100%': { boxShadow: 'inset 0 0 0 0 rgb(20 184 166 / 0)' },
        },
      },
    },
  },
  plugins: [],
}
