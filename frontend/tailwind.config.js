/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:    '#1E2B1A',
        sage:    '#3D6B64',
        coral: {
          DEFAULT: '#C4875A',
          dark:    '#8B4C2E',
          light:   '#F5EFE6',
        },
        cream: {
          DEFAULT: '#F5EFE6',
          dark:    '#EDE0D4',
        },
        brand: {
          black:     '#000000',
          navy:      '#1E2B1A',
          sage:      '#3D6B64',
          taupe:     '#6B5E50',
          charcoal:  '#464545',
          coral:     '#C4875A',
          'coral-dark': '#8B4C2E',
          salmon:    '#D4876B',
          white:     '#ffffff',
          'off-white': '#F5EFE6',
          cream:     '#EDE0D4',
          border:    '#EDE0D4',
          body:      '#6B5E50',
          muted:     '#a89c90',
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
