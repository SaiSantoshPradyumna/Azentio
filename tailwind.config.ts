import type { Config } from "tailwindcss";

const channel = (name: string) =>
  `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/site-content.ts"],
  theme: {
    extend: {
      colors: {
        surface: channel("c-surface"),
        "surface-raised": channel("c-surface-raised"),
        "surface-sunken": channel("c-surface-sunken"),
        content: channel("c-content"),
        "content-muted": channel("c-content-muted"),
        line: channel("c-line"),
        accent: channel("c-accent"),
        "accent-strong": channel("c-accent-strong"),
        "accent-content": channel("c-accent-content"),
        state: channel("c-state"),
        warning: channel("c-warning"),
        success: channel("c-success"),
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      spacing: {
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        "2xl": "var(--space-2xl)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        chip: "var(--radius-chip)",
      },
      maxWidth: {
        page: "var(--container-max)",
      },
    },
  },
  plugins: [],
};

export default config;
