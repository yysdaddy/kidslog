/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF6FC',
          100: '#D8EAF7',
          200: '#B4D6EF',
          300: '#8BBFE5',
          400: '#6FAEDC',
          500: '#5B9BD5',
          600: '#4785BF',
          700: '#3A6E9F',
          800: '#2E577D',
          900: '#24445F'
        },
        mint: {
          50: '#EFFAF5',
          100: '#D6F2E5',
          200: '#AEE5CD',
          300: '#7EC8A9',
          400: '#5DB492',
          500: '#469C7A',
          600: '#367D61'
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem'
      },
      boxShadow: {
        soft: '0 2px 12px rgba(35, 68, 95, 0.06)',
        lift: '0 8px 24px rgba(35, 68, 95, 0.12)'
      }
    }
  },
  plugins: []
}
