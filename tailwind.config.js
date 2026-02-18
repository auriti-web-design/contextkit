/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/ui/viewer/**/*.{ts,tsx}",
    "./src/ui/viewer.html"
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Palette minimale ContextKit
        background: {
          DEFAULT: "#0a0a0a",
          secondary: "#111111",
          tertiary: "#1a1a1a",
        },
        foreground: {
          DEFAULT: "#fafafa",
          secondary: "#a1a1aa",
          muted: "#71717a",
        },
        accent: {
          DEFAULT: "#d8ff4d",
          hover: "#c5eb45",
          muted: "#d8ff4d20",
          foreground: "#0a0a0a",
        },
        border: {
          DEFAULT: "#27272a",
          hover: "#3f3f46",
        },
        card: {
          DEFAULT: "#111111",
          foreground: "#fafafa",
          hover: "#1a1a1a",
        },
        // shadcn/ui semantic colors
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#fafafa",
        },
        muted: {
          DEFAULT: "#27272a",
          foreground: "#a1a1aa",
        },
        popover: {
          DEFAULT: "#111111",
          foreground: "#fafafa",
        },
        primary: {
          DEFAULT: "#d8ff4d",
          foreground: "#0a0a0a",
          hover: "#c5eb45",
        },
        secondary: {
          DEFAULT: "#27272a",
          foreground: "#fafafa",
        },
        ring: "#d8ff4d",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
