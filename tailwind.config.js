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
        // Primary: Soft Lavender Purple (subtle, sophisticated)
        primary: {
          50: '#FAF9FC',
          100: '#F3F1F9',
          200: '#E8E4F3',
          300: '#D5CCEC',
          400: '#B8A9DD',
          500: '#9B87CE', // Soft Lavender
          600: '#7E6AB8',
          700: '#6654A0',
          800: '#524485',
          900: '#3E3460',
        },
        // Almost Black (modern, clean)
        dark: {
          50: '#F7F7F8',
          100: '#E3E4E6',
          200: '#C7C9CD',
          300: '#9DA1A9',
          400: '#6B7280',
          500: '#4B5563',
          600: '#374151',
          700: '#1F2937',
          800: '#111827',
          900: '#0A0A0B', // Almost black
        },
        // Soft accent colors (for highlights only)
        accent: {
          lavender: '#B8A9DD',
          slate: '#64748B',
        },
        // Cream (soft backgrounds)
        cream: '#FAFAF9',
        // Charcoal (replaced with dark-800)
        charcoal: '#111827',
      },
    },
  },
  plugins: [],
};
