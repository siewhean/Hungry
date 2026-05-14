import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Ported from src/theme/tokens.ts — single source of truth
        hungry: {
          orange: "#E8531E",
          "orange-dark": "#CD0302",
          "orange-light": "#FFF1E6",
          amber: "#F5A623",
          "amber-light": "#FFF3DB",
          navy: "#1A2E44",
          teal: "#14B8A6",
          bg: "#FFFFFF",
          "bg-soft": "#F8EFE4",
          surface: "#FFFFFF",
          text: "#1A2E44",
          "text-secondary": "#41566F",
          "text-muted": "#6F7D8D",
          border: "#E7DED4",
        },
        "hungry-dark": {
          bg: "#0D0F14",
          "bg-soft": "#1D2430",
          surface: "#1A202C",
          text: "#F7FAFC",
          "text-secondary": "#A0AEC0",
          "text-muted": "#718096",
          border: "#2D3748",
          orange: "#F97316",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body: ["Nunito", "system-ui", "sans-serif"],
        mono: ["DM Mono", "monospace"],
      },
      borderRadius: {
        pill: "9999px",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      backgroundImage: {
        "gradient-orange": "linear-gradient(135deg, #E8531E 0%, #F5A623 100%)",
        "gradient-orange-soft": "linear-gradient(135deg, #FFF1E6 0%, #FFF3DB 100%)",
        "gradient-dark": "linear-gradient(135deg, #0D0F14 0%, #1A2E44 100%)",
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease-out forwards",
        "fade-in": "fadeIn 0.4s ease-out forwards",
        float: "float 3s ease-in-out infinite",
        pulse: "pulse 2s ease-in-out infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
