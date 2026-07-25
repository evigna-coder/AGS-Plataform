/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/shared/src/**/*.{js,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Editorial Teal — portal cliente (fresh external)
        teal: {
          50: '#E9F5F5',
          100: '#D5ECEC',
          500: '#17A2A2',
          600: '#128585',
          700: '#0D6E6E',
          800: '#0A5A5A',
          900: '#074A4A',
        },
        app: '#F4F7F7',
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#EDF3F3',
          dark: '#0C2A2A',
        },
        ink: {
          DEFAULT: '#0E2222',
          soft: '#5A6E6E',
          faint: '#8AA0A0',
          inv: '#EAF4F4',
        },
        line: {
          DEFAULT: '#E1EAEA',
          strong: '#C9D8D8',
        },
        success: { DEFAULT: '#2E9E6B', bg: '#E3F3EB' },
        warn: { DEFAULT: '#D98A1F', bg: '#FBEED6' },
        danger: { DEFAULT: '#D2554A', bg: '#FADEDB' },
        info: { DEFAULT: '#3B7DD8', bg: '#DEE9FA' },
      },
      borderRadius: {
        xl: '14px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
};
