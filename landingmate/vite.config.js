import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = import.meta.dirname;

export default defineConfig({
  // Rutas relativas: el build funciona servido desde cualquier subcarpeta (p. ej. GitHub Pages)
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        checkout: resolve(root, 'checkout.html')
      }
    }
  },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true }
});
