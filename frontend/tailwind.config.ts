import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // SmallPDF 風格的多彩色系
        'pdf-red': '#E5322D',
        'pdf-orange': '#F5A623',
        'pdf-yellow': '#F8E71C',
        'pdf-green': '#7ED321',
        'pdf-teal': '#50E3C2',
        'pdf-blue': '#4A90E2',
        'pdf-purple': '#9B59B6',
        'pdf-pink': '#E91E63',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans TC', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
