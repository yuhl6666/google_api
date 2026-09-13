/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        phase1: '#0ea5e9',
        phase2: '#8b5cf6',
        phase3: '#f59e0b',
      },
    },
  },
  plugins: [],
};
