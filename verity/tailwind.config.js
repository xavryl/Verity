/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        verity: {
          500: '#10B981', // Emerald-500 (Trust/Green)
          900: '#064E3B', // Dark Green (Professional)
        }
      }
    },
  },
  plugins: [],
}