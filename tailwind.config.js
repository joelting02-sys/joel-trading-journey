/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        bg: {
          DEFAULT: "var(--color-bg)",
          elevated: "var(--color-bg-elevated)",
          surface: "var(--color-bg-surface)",
          hover: "var(--color-bg-hover)",
        },
        border: {
          DEFAULT: "var(--color-border)",
          subtle: "var(--color-border-subtle)",
        },
        text: {
          DEFAULT: "var(--color-text)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
        primary: {
          DEFAULT: "var(--color-primary)",
          dim: "var(--color-primary-dim)",
          ghost: "var(--color-primary-ghost)",
        },
        loss: {
          DEFAULT: "var(--color-loss)",
          dim: "var(--color-loss-dim)",
          ghost: "var(--color-loss-ghost)",
        },
        warning: "var(--color-warning)",
        info: "var(--color-info)",
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "monospace"],
        body: ["Inter", "sans-serif"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        static: "var(--shadow-static)",
        float: "var(--shadow-float)",
      },
    },
  },
  plugins: [],
};
