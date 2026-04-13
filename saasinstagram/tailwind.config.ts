import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--c-bg) / <alpha-value>)',
        sidebar:    'rgb(var(--c-sidebar) / <alpha-value>)',
        card:       'rgb(var(--c-card) / <alpha-value>)',
        surface:    'rgb(var(--c-surface) / <alpha-value>)',
        border:     'rgb(var(--c-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--c-border-strong) / <alpha-value>)',
        muted:      'rgb(var(--c-muted) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          hover:   'rgb(var(--c-accent-hover) / <alpha-value>)',
          light:   'rgb(var(--c-accent-light) / <alpha-value>)',
          subtle:  'rgb(var(--c-accent-subtle) / <alpha-value>)',
          border:  'rgb(var(--c-accent-border) / <alpha-value>)',
        },
        text: {
          primary:   'rgb(var(--c-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--c-text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--c-text-muted) / <alpha-value>)',
        },
        success: '#059669',
        warning: '#d97706',
        danger:  '#dc2626',
        info:    '#2563eb',
        instagram: '#E1306C',
        facebook:  '#1877F2',
        whatsapp:  '#25D366',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
        modal: '0 16px 48px rgba(0,0,0,0.14)',
        dropdown: '0 4px 16px rgba(0,0,0,0.10)',
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-in-out',
        'slide-in': 'slideIn 0.18s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-6px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
