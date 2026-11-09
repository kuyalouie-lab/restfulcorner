import type { Config } from 'tailwindcss';
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: { extend: { colors: { brand: { 50: '#f2f7f4', 100: '#dcebe2', 500: '#3f7d5c', 600: '#2f6649', 700: '#245039', 900: '#14301f' }, sand: '#f6f1e9' } } },
  plugins: [],
} satisfies Config;
