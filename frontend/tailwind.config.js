/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          black:  '#130D09',
          dark:   '#1B130D',
          card:   '#241A12',
          border: '#3C2C1E',
          red:    '#8B1A1A',
          'red-light': '#B22222',
          'red-hover': '#A01F1F',
          gold:   '#C9A84C',
          'gold-light': '#E8C96A',
          'gold-muted': '#8A6F2E',
          white:  '#F5F0E8',
          muted:  '#9A8A7A',
          success:'#2E7D32',
          warning:'#E65100',
          info:   '#1565C0',
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        'gold': '0 0 0 1px rgba(201,168,76,0.3)',
        'gold-lg': '0 4px 24px rgba(201,168,76,0.15)',
        'card': '0 2px 12px rgba(0,0,0,0.4)',
        'modal': '0 20px 60px rgba(0,0,0,0.7)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-gold': 'pulseGold 2s infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideIn: { from: { opacity: 0, transform: 'translateY(-8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        pulseGold: { '0%,100%': { boxShadow: '0 0 0 0 rgba(201,168,76,0.4)' }, '50%': { boxShadow: '0 0 0 8px rgba(201,168,76,0)' } },
      }
    },
  },
  plugins: [],
}
