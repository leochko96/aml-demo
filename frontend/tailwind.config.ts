import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0f1f3d',
        'navy-light': '#1a3358',
        surface: '#f8f9fc',
        'action-green': '#0d9f6e',
        'action-amber': '#d97706',
        'action-red': '#dc2626',
      },
      fontFamily: {
        sans: ['var(--font-ibm-sans)', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['var(--font-ibm-mono)', '"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
