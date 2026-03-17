/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      colors: {
        navy: {
          50:  '#eef2f9',
          100: '#dce5f3',
          200: '#b9cbe7',
          300: '#8aaad5',
          400: '#5c88c0',
          500: '#3d6daa',
          600: '#2d568f',
          700: '#254474',
          800: '#1e3a5f',
          900: '#162b48',
          950: '#0f1f36',
        },
        gold: {
          300: '#f0d080',
          400: '#e8bf5a',
          500: '#d4a843',
          600: '#b88c32',
          700: '#9a7228',
        },
        cream: '#f9f3e8',
      },
    },
  },
  plugins: [],
}
