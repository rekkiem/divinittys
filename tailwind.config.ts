/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // Brand scales via CSS variables (invert in .dark)
        primary: {
          DEFAULT: '#C9956A',
          50: 'rgb(var(--c-primary-50) / <alpha-value>)',
          100: 'rgb(var(--c-primary-100) / <alpha-value>)',
          200: 'rgb(var(--c-primary-200) / <alpha-value>)',
          300: '#E0B78B',
          400: '#D6A074',
          500: '#C9956A',
          600: '#B07A52',
          700: '#8A5F3E',
          800: '#65462D',
          900: '#3F2B1C',
        },
        rose: {
          DEFAULT: '#E8B4B8',
          50: '#FDF6F7',
          100: '#FBEDEE',
          200: '#F5D3D6',
          300: '#EFC0C4',
          400: '#E8B4B8',
          500: '#DF9EA3',
          600: '#D4808A',
          700: '#C45E6A',
          800: '#A33A48',
          900: '#7A2A35',
        },
        champagne: {
          DEFAULT: 'rgb(var(--c-champagne-400) / <alpha-value>)',
          50: 'rgb(var(--c-champagne-50) / <alpha-value>)',
          100: 'rgb(var(--c-champagne-100) / <alpha-value>)',
          200: 'rgb(var(--c-champagne-200) / <alpha-value>)',
          300: 'rgb(var(--c-champagne-300) / <alpha-value>)',
          400: 'rgb(var(--c-champagne-400) / <alpha-value>)',
          500: '#EECEA8',
          600: '#E6B580',
          700: '#D9955A',
        },
        charcoal: {
          DEFAULT: 'rgb(var(--c-charcoal-600) / <alpha-value>)',
          50: 'rgb(var(--c-charcoal-50) / <alpha-value>)',
          100: 'rgb(var(--c-charcoal-100) / <alpha-value>)',
          200: 'rgb(var(--c-charcoal-200) / <alpha-value>)',
          300: 'rgb(var(--c-charcoal-300) / <alpha-value>)',
          400: 'rgb(var(--c-charcoal-400) / <alpha-value>)',
          500: 'rgb(var(--c-charcoal-500) / <alpha-value>)',
          600: 'rgb(var(--c-charcoal-600) / <alpha-value>)',
          700: 'rgb(var(--c-charcoal-700) / <alpha-value>)',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        display: ['var(--font-cormorant)', 'serif'],
        sans: ['var(--font-plus-jakarta)', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 2s infinite linear',
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        float: 'float 3s ease-in-out infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'champagne-gradient': 'linear-gradient(135deg, #F5E6D3 0%, #E8B4B8 50%, #C9956A 100%)',
        'luxury-gradient': 'linear-gradient(180deg, #FBF5EF 0%, #FFFFFF 100%)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
