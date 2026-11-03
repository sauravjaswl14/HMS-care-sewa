import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        box: '#EDF2F4', // x-ray light box
        paper: '#FAFCFC',
        ink: '#0F2A33',
        scrub: '#1F7A6B',
        pulse: '#E5484D',
        band: '#F5D547', // wristband yellow
        graphite: '#52656C',
        rule: '#CBD6DA',
      },
      fontFamily: {
        sans: ['"Public Sans Variable"', 'system-ui', 'sans-serif'],
        display: ['"Bricolage Grotesque Variable"', 'system-ui', 'sans-serif'],
        vitals: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 rgba(15,42,51,.04), 0 18px 40px -18px rgba(15,42,51,.28)',
        pop: '0 24px 60px -20px rgba(15,42,51,.45)',
      },
    },
  },
  plugins: [],
};
export default config;
