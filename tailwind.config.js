/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      spacing: {
        18: "4.5rem",
      },
      colors: {
        fair: {
          dark: "#1b1e09",
          green: "#9ffb50",
          white: "#ffffff",
          "dark-light": "#2a2e14",
          "green-dim": "#7cc940",
          muted: "#6b7280",
          border: "#3a3f1e",
        },
      },
      fontFamily: {
        sans: ["System"],
      },
    },
  },
  plugins: [],
};
