import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    screens: { sm: '640px', md: '641px', lg: '1025px' },
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] },
      colors: {
        primary: { DEFAULT: '#1749C7', hover: '#123CAD', light: '#E8EEFB' },
        ink: { DEFAULT: '#18243A', muted: '#5C6B82' },
        canvas: '#F5F8FC',
        line: '#E4EBF3',
      },
      boxShadow: {
        card: '0 1px 2px rgba(24, 36, 58, 0.04)',
        pop: '0 12px 32px rgba(24, 36, 58, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config
