/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sage: {
          DEFAULT: '#8F9E8B',
          light: '#B5C4B1',
          dark: '#6B7A67',
        },
        mineral: {
          DEFAULT: '#D1D7D3',
          light: '#E8ECEB',
          dark: '#A8B0AC',
        },
        'surface-dark': '#1A1F1C',
        'surface-light': '#F4F6F4',
        'card-dark': '#232A26',
        'card-light': '#FFFFFF',
      },
      transitionDuration: {
        4000: '4000ms',
      },
    },
  },
  plugins: [],
}
