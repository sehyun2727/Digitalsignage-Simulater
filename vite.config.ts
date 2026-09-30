import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
// base is intentionally NOT set here — hard-coding a subpath breaks the Render root deploy.
// The hull-inc.jp/oitemiru/ manual upload uses `npm run build:oitemiru` which passes
// `--base=/oitemiru/` on the CLI; the default `build` script keeps base='/' for Render.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: true,
  },
});
