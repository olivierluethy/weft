import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:4000', changeOrigin: true },
      '/collab': { target: 'ws://127.0.0.1:4000', ws: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ['@blocknote/core', '@blocknote/react', '@blocknote/mantine'],
          graph: ['react-force-graph-2d'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
