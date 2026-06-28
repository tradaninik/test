import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefcf6',
          100: '#d6f7e8',
          200: '#b0efd3',
          300: '#7ae0b7',
          400: '#3fcb93',
          500: '#16b077',
          600: '#0a8e5f',
          700: '#09724e',
          800: '#0a5b40',
          900: '#094b36',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
