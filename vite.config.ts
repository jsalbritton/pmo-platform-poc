import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/scheduler')) {
            return 'vendor'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'supabase'
          }
          if (id.includes('node_modules/@xyflow') || id.includes('node_modules/framer-motion')) {
            return 'viz'
          }
          if (id.includes('node_modules/@tanstack')) {
            return 'tanstack'
          }
          if (id.includes('node_modules/@phosphor-icons')) {
            return 'icons'
          }
        },
      },
    },
  },
})
