/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:    '#1E2B1A',
        coral: {
          DEFAULT: '#C4875A',
          dark:    '#A86E45',
          light:   '#f5ede6',
        },
        brand: {
          black:     '#000000',
          navy:      '#1E2B1A',
          charcoal:  '#464545',
          coral:     '#C4875A',
          'coral-dark': '#A86E45',
          white:     '#ffffff',
          'off-white': '#f5f3f0',
          border:    '#e5e0d8',
          body:      '#2c2c2c',
          muted:     '#888580',
        },
      },
      fontFamily: {
        head: ['Poppins', 'sans-serif'],
        body: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.08)',
        'card-lg': '0 8px 40px rgba(0,0,0,0.12)',
      },
      borderRadius: {
        brand: '16px',
      },
    },
  },
  plugins: [],
}
