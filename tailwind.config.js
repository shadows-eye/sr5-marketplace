/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: 'tw-',
  important: '.sr5-marketplace', // Ensures we beat Foundry's specificity
  content: ["./templates/**/*.html"],
  theme: {
    extend: {
      colors: {
        'sr5-red-darkest': '#2b0000',
        'sr5-red-deep': '#5d142b', 
        'sr5-gold': '#b9a913', 
        'sr5-yellow': '#e7c93e', 
      },
      backgroundImage: {
        'header-gradient': 'linear-gradient(to right, #5d142b 30%, rgba(85, 16, 30, 0) 100%)',
      }
    },
  },
}