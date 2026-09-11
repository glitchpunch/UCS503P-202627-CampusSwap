// Theme copied from reference 4 (explore rooms). The reference sets no fontFamily
// in its config (the page's own <style> sets Plus Jakarta Sans); mono is added so
// tracking IDs use JetBrains Mono like the other pages.
module.exports = {
  content: ["./public/rooms.html", "./public/js/rooms.js", "./public/js/ui.js", "./public/js/nav.js"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "airbnb-coral": "#FF385C",
        "airbnb-coral-dark": "#E00B41",
        "airbnb-coral-subtle": "#FFF0F2",
        "airbnb-amber": "#FFB800",
        "airbnb-emerald": "#008A05",
        "surface-canvas": "#FFFFFF",
        "surface-subtle": "#F8F8FA",
        "surface-card": "#FFFFFF",
        "surface-container": "#F0EDED",
        "border-hairline": "#EBEBEF",
        "text-main": "#1B1C1C",
        "text-muted": "#6E6F74",
        "text-light": "#94969C",
        "badge-ganga": "#FFF4EC",
        "badge-tagore": "#EEF7FF",
        "badge-west": "#F3E8FF",
        "badge-shakti": "#E8FFF3",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/container-queries")],
};
