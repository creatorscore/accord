/** @type {import('tailwindcss').Config} */
const { hairlineWidth, platformSelect } = require('nativewind/theme');

module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // ============================================
      // COLOR SYSTEM - Modern, Minimal, Lavender Accent
      // ============================================
      colors: {
        // Lavender - Primary Accent Color
        lavender: {
          50:  '#F6F3FA',  // Lightest tint - subtle backgrounds
          100: '#EBE6F2',  // Light backgrounds, hover states
          200: '#CDC2E5',  // Borders, dividers, Accent Border ⭐
          300: '#BBA8D0',  // Secondary buttons, tags
          400: '#AE99C4',  // Links, icons
          500: '#A08AB7',  // Primary buttons, CTAs, Primary Brand ⭐
          600: '#8A74A2',  // Pressed/active states
          700: '#745F8D',  // Dark mode primary, Deep Lavender ⭐
          800: '#593A69',  // Dark accents
          900: '#3E1444',  // Darkest - text on light, Charcoal ⭐
        },

        // Semantic Colors (mapped to lavender)
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          foreground: 'rgb(var(--color-secondary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--color-muted) / <alpha-value>)',
          foreground: 'rgb(var(--color-muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          foreground: 'rgb(var(--color-accent-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--color-destructive) / <alpha-value>)',
          foreground: 'rgb(var(--color-destructive-foreground) / <alpha-value>)',
        },

        // Background & Foreground
        background: 'rgb(var(--color-background) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground) / <alpha-value>)',

        // Card
        card: {
          DEFAULT: 'rgb(var(--color-card) / <alpha-value>)',
          foreground: 'rgb(var(--color-card-foreground) / <alpha-value>)',
        },

        // Popover
        popover: {
          DEFAULT: 'rgb(var(--color-popover) / <alpha-value>)',
          foreground: 'rgb(var(--color-popover-foreground) / <alpha-value>)',
        },

        // UI Elements
        border: 'rgb(var(--color-border) / <alpha-value>)',
        input: 'rgb(var(--color-input) / <alpha-value>)',
        ring: 'rgb(var(--color-ring) / <alpha-value>)',
      },

      // ============================================
      // TYPOGRAPHY
      // ============================================
      fontFamily: {
        // Headers - Plus Jakarta Sans (geometric, modern, friendly)
        display: ['PlusJakartaSans', 'system-ui', 'sans-serif'],
        'display-bold': ['PlusJakartaSans-Bold', 'system-ui', 'sans-serif'],
        'display-semibold': ['PlusJakartaSans-SemiBold', 'system-ui', 'sans-serif'],
        'display-medium': ['PlusJakartaSans-Medium', 'system-ui', 'sans-serif'],

        // Body - Inter (excellent legibility)
        sans: ['Inter', 'system-ui', 'sans-serif'],
        'sans-medium': ['Inter-Medium', 'system-ui', 'sans-serif'],
        'sans-semibold': ['Inter-SemiBold', 'system-ui', 'sans-serif'],
        'sans-bold': ['Inter-Bold', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // Body text - minimum 16px for comfort
        'body-sm': ['14px', { lineHeight: '20px', letterSpacing: '0.01em' }],
        'body': ['16px', { lineHeight: '24px', letterSpacing: '0' }],
        'body-lg': ['17px', { lineHeight: '26px', letterSpacing: '-0.01em' }],

        // Headers - Plus Jakarta Sans
        'heading-sm': ['18px', { lineHeight: '24px', letterSpacing: '-0.01em' }],
        'heading': ['20px', { lineHeight: '28px', letterSpacing: '-0.02em' }],
        'heading-lg': ['24px', { lineHeight: '32px', letterSpacing: '-0.02em' }],
        'heading-xl': ['28px', { lineHeight: '36px', letterSpacing: '-0.02em' }],
        'heading-2xl': ['32px', { lineHeight: '40px', letterSpacing: '-0.03em' }],
        'display': ['40px', { lineHeight: '48px', letterSpacing: '-0.03em' }],
      },

      // Line height for readability
      lineHeight: {
        'relaxed': '1.6',
        'comfortable': '1.5',
      },

      // Letter spacing
      letterSpacing: {
        'tight': '-0.02em',
        'normal': '0',
        'wide': '0.01em',
      },

      // ============================================
      // SPACING & SIZING
      // ============================================
      borderRadius: {
        'none': '0',
        'sm': '8px',
        'DEFAULT': '12px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        'full': '9999px',
      },

      borderWidth: {
        hairline: hairlineWidth(),
        DEFAULT: '1px',
      },

      // ============================================
      // SHADOWS (subtle, modern)
      // ============================================
      boxShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.04)',
        'DEFAULT': '0 2px 8px rgba(0, 0, 0, 0.06)',
        'md': '0 4px 16px rgba(0, 0, 0, 0.08)',
        'lg': '0 8px 32px rgba(0, 0, 0, 0.10)',
        'xl': '0 16px 48px rgba(0, 0, 0, 0.12)',
      },

      // ============================================
      // ANIMATIONS
      // ============================================
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-out': 'fadeOut 0.2s ease-in',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
