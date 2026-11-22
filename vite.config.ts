import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Vite "limpo": sem o plugin ziteId(), sem o script de runtime da Zite injetado no <head>,
// e sem os aliases para zitejs/db, zitejs/api, zitejs/auth, etc. — já não existem.
export default defineConfig({
  build: { target: 'esnext', sourcemap: false },
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
