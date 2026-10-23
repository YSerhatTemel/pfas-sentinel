/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        xylem: {
          navy: '#061320',
          panel: '#0B1D30',
          card: '#10263F',
          border: '#1E3A5F',
          blue: '#0085AD',
          cyan: '#00B4D8',
          accent: '#38BDF8',
          emerald: '#10B981',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      }
    },
  },
  plugins: [],
}
