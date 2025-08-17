import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Configuration for building the web version
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-web',
    minify: false, // Disable minification for better error messages
    sourcemap: true, // Enable source maps for debugging
    rollupOptions: {
      input: {
        'web-app': path.resolve(__dirname, 'src/web-main.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})