import type { Config } from 'tailwindcss'
import plugin from 'tailwindcss/plugin'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
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
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Platform layer colors for direct use in className
        'pmo-blue': '#58a6ff',
        'pmo-green': '#3fb950',
        'pmo-violet': '#bc8cff',
        'pmo-amber': '#d29922',
        'pmo-red': '#f85149',
        'pmo-cyan': '#39c5cf',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--accordion-content-height)' },
          to: { height: '0' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'pulse-dot': 'pulse-dot 2.4s ease-in-out infinite',
        'fade-in': 'fade-in 0.3s ease-out',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),

    // ── D-052: content-visibility utilities ───────────────────────────────────
    // content-visibility: auto lets the browser skip rendering of offscreen
    // elements entirely. Applied to KanbanCards, this is the single biggest
    // performance win for the 22K+ item dataset — equivalent to free virtual
    // scrolling with zero library overhead.
    //
    // contain-intrinsic-size: gives the browser a size hint so the scroll bar
    // stays accurate even when items are skipped. 96px ≈ average card height.
    //
    // Baseline: content-visibility — Chrome 85+ (2020), Firefox 125+ (2024),
    //           Safari 18+ (2024). Enterprise Edge/Chrome: fully supported.
    plugin(({ addUtilities }) => {
      addUtilities({
        '.cv-auto': {
          'content-visibility': 'auto',
        },
        '.cv-hidden': {
          'content-visibility': 'hidden',
        },
        '.cv-visible': {
          'content-visibility': 'visible',
        },
        // Kanban card size hint — keeps scrollbar accurate when cards are skipped
        '.cis-card': {
          'contain-intrinsic-size': 'auto 96px',
        },
        // Work item row size hint (for future list views)
        '.cis-row': {
          'contain-intrinsic-size': 'auto 48px',
        },
      })
    }),
  ],
}

export default config
