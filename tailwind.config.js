/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: 'rgb(var(--color-bg) / <alpha-value>)',
          subtle: 'rgb(var(--color-bg-subtle) / <alpha-value>)',
        },
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          hover: 'rgb(var(--color-surface-hover) / <alpha-value>)',
        },
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
          strong: 'rgb(var(--color-border-strong) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--color-text) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          disabled: 'rgb(var(--color-text-disabled) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          light: 'rgb(var(--color-accent-light) / <alpha-value>)',
          deep: 'rgb(var(--color-accent-deep) / <alpha-value>)',
        },
        action: {
          raise: 'rgb(var(--color-action-raise) / <alpha-value>)',
          threebet: 'rgb(var(--color-action-threebet) / <alpha-value>)',
          allin: 'rgb(var(--color-action-allin) / <alpha-value>)',
          call: 'rgb(var(--color-action-call) / <alpha-value>)',
          fold: 'rgb(var(--color-action-fold) / <alpha-value>)',
        },
        cell: {
          empty: {
            pair: 'rgb(var(--color-cell-empty-pair) / <alpha-value>)',
            suited: 'rgb(var(--color-cell-empty-suited) / <alpha-value>)',
            offsuit: 'rgb(var(--color-cell-empty-offsuit) / <alpha-value>)',
          },
        },
        success: 'rgb(var(--color-success) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        'accent-glow': '0 0 0 1px rgb(var(--color-accent) / 0.4), 0 8px 24px rgb(var(--color-accent) / 0.15)',
        'surface': '0 1px 2px rgb(0 0 0 / 0.2), 0 4px 12px rgb(0 0 0 / 0.08)',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
