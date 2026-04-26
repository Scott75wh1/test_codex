import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5188,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4188,
    strictPort: true,
  },
});
