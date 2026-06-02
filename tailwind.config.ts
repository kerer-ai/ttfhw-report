import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        partial: '#FBBF24',
      },
    },
  },
  plugins: [],
}
export default config