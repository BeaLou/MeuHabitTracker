import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' deixa o build funcionar em qualquer subcaminho (GitHub Pages, Netlify, etc.)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
