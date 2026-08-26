import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Privy's sponsored-tx path and the p2pkit encryption step expect Node globals
    // (Buffer, process, crypto) in the browser.
    nodePolyfills({ globals: { Buffer: true, process: true, global: true } }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: process.env.VITE_API_URL ?? 'http://localhost:4000', changeOrigin: true },
    },
  },
});
