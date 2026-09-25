import plugin from 'tailwindcss/plugin';

/** @type {import('tailwindcss').Config} */
const withVar = (name) => ({ opacityValue }) =>
  opacityValue === undefined
    ? `rgb(var(${name}))`
    : `rgb(var(${name}) / ${opacityValue})`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: withVar('--c-canvas'),
        surface: withVar('--c-surface'),
        elevated: withVar('--c-elevated'),
        line: withVar('--c-line'),
        ink: withVar('--c-ink'),
        muted: withVar('--c-muted'),
        faint: withVar('--c-faint'),
        brand: withVar('--c-brand'),
        ok: withVar('--c-ok'),
        warn: withVar('--c-warn'),
        danger: withVar('--c-danger'),
        info: withVar('--c-info'),
        violet: withVar('--c-violet'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(2 6 23 / 0.06), 0 8px 24px -12px rgb(2 6 23 / 0.25)',
        node: '0 2px 6px rgb(2 6 23 / 0.10), 0 12px 28px -18px rgb(2 6 23 / 0.45)',
        glow: '0 0 0 1px rgb(var(--c-brand) / 0.35), 0 0 22px -4px rgb(var(--c-brand) / 0.45)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: 0.7 },
          '70%': { transform: 'scale(1.6)', opacity: 0 },
          '100%': { transform: 'scale(1.6)', opacity: 0 },
        },
        dash: { to: { strokeDashoffset: -24 } },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'pulse-ring': 'pulse-ring 1.6s ease-out infinite',
        dash: 'dash 1s linear infinite',
      },
    },
  },
  plugins: [
    // `coarse:` applies on a touch screen (primary pointer is a finger). See the
    // touch-target rule in src/styles/index.css.
    plugin(({ addVariant }) => {
      addVariant('coarse', '@media (pointer: coarse)');
      // `short:` applies on a screen too short to pin anything, such as a phone held sideways.
      addVariant('short', '@media (max-height: 639px)');
    }),
  ],
};
