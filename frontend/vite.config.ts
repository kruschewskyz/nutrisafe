import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Em desenvolvimento, o Vite encaminha /api para o backend. Assim navegador e API ficam na
// MESMA origem (localhost:5173), o cookie de refresh SameSite=Strict funciona e não há CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: false } },
  },
  build: { sourcemap: false }, // não publica o código-fonte original
});
