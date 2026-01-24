/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // <--- ADD THIS LINE
  theme: {
    extend: {
      colors: {
        // Optional: Add official Verity brand colors if you haven't
        verity: {
          50: '#f0f9ff', // Light Blue/Green mix hint
          900: '#0f172a', // Deep Blue Dark Mode
        }
      }
    },
  },
  plugins: [],
}