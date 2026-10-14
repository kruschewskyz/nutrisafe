/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 400: '#34d399',
          500: '#10b981', 600: '#059669', 700: '#047857', 900: '#064e3b',
        },
      },
    },
  },
  plugins: [],
};
