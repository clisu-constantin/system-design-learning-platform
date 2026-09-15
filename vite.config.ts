import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  optimizeDeps: {
    // These are only reached through lazily loaded routes and labs. Pre-bundling
    // them keeps Vite from discovering them mid-session, re-optimizing and
    // reloading the page while a dynamic import is in flight.
    include: [
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'framer-motion',
      'lucide-react',
      'recharts',
      'reactflow',
    ],
  },
});
