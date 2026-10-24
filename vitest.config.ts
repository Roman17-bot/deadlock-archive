import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
