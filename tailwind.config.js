/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Primary: Lavender Purple (our namesake)
        primary: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA', // Lavender Purple
          500: '#8B5CF6',
          600: '#7C3AED', // Deep Purple
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        // Accent: Hot Pink (bold, queer, impossible to ignore)
        accent: {
          50: '#FDF2F8',
          100: '#FCE7F3',
          200: '#FBCFE8',
          300: '#F9A8D4',
          400: '#F472B6',
          500: '#EC4899', // Hot Pink
          600: '#DB2777',
          700: '#BE185D',
          800: '#9D174D',
          900: '#831843',
        },
        // Sunset Orange (warmth, community)
        orange: {
          500: '#FB923C',
        },
        // Electric Blue (trust, safety, verification)
        blue: {
          500: '#3B82F6',
        },
        // Cream (soft backgrounds)
        cream: '#FFFBEB',
        // Charcoal (text, sophistication)
        charcoal: '#1F2937',
      },
    },
  },
  plugins: [],
};
