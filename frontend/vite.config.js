import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward all /api requests to the Express backend, so the frontend
      // can use a relative "/api" base without CORS/preflight issues and
      // without ever hitting the Vite dev server with a 404/HTML fallback.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        // Disable buffering for streaming responses (file downloads, etc.)
        // http-proxy buffers responses by default, which breaks large file
        // streaming and causes memory issues. buffer: false streams directly.
        buffer: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router'],
          'vendor-motion': ['framer-motion'],
          'vendor-icons': ['lucide-react'],
          'vendor-utils': ['axios', 'socket.io-client', 'zustand'],
        },
      },
    },
  },
})
