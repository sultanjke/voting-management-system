import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        canvas: "#f4f5f7",
        panel: "#ffffff",
        accent: "#0ea5e9",
        accentStrong: "#0369a1",
        amber: "#f59e0b",
        lime: "#65a30d",
        rose: "#e11d48"
      },
      borderRadius: {
        xl2: "1.25rem"
      },
      boxShadow: {
        glow: "0 20px 50px -25px rgba(14,165,233,0.35)"
      }
    }
  },
  plugins: []
};

export default config;
