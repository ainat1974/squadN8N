/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base':     '#0f172a',
        'bg-card':     '#1e293b',
        'bg-elevated': '#334155',
        'border-subtle': '#475569',
        'accent':      '#38bdf8',
        'success':     '#22c55e',
        'warning':     '#f59e0b',
        'danger':      '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
