import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    screens: { sm: '640px', md: '641px', lg: '1025px' },
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] },
      colors: { primary: { DEFAULT: '#1E40AF', hover: '#1D3A9E', light: '#DBEAFE' } },
    },
  },
  plugins: [],
} satisfies Config
