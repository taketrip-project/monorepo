/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // O monorepo mantém um único .env na raiz (ver .env.example) — aponta o
  // Vite para lá em vez de esperar um .env dentro de apps/web.
  envDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: {
    port: 5173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
});
