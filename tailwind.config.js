// tailwind.config.js
module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: 'class', // Enable dark mode via class
  theme: {
    extend: {
      fontSize: {
        '2xs': '0.625rem',  // 10px
        '3xs': '0.5rem',    // 8px
        '4xs': '0.375rem',  // 6px
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
};