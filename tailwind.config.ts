import { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: {
          light: '#ffffff',
          dark: '#1f2937',
        },
        text: {
          light: '#111827',
          dark: '#f9fafb',
        },
      },
    },
  },
  plugins: [],
};

export default config;
