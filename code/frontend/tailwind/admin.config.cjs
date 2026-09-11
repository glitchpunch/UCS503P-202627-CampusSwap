// Theme copied from reference 3 (admin portal).
module.exports = {
  content: ["./public/admin.html", "./public/js/admin.js", "./public/js/ui.js", "./public/js/nav.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        coral: { DEFAULT: "#FF385C", hover: "#E00B41", subtle: "#FFF0F2", border: "#FFD2D9" },
        teal: { DEFAULT: "#0D9488", vibrant: "#06B6D4", subtle: "#ECFEFF", border: "#A5F3FC" },
        amber: { DEFAULT: "#F59E0B", warm: "#D97706", subtle: "#FFFBEB", border: "#FDE68A" },
        emerald: { DEFAULT: "#10B981", subtle: "#ECFDF5", border: "#A7F3D0" },
        indigo: { DEFAULT: "#6366F1", subtle: "#EEF2FF", border: "#C7D2FE" },
        surface: { canvas: "#FAF9F8", card: "#FFFFFF", subtle: "#F4F3F1" },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};
