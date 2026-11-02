/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#effaf7',
          100: '#d3f3ea',
          500: '#14a38b',
          600: '#0d8a76',
          700: '#0b6e5f',
          900: '#0a3d36',
        },
      },
    },
  },
  plugins: [],
};
