import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from 'path'

// Worker entry points are declared explicitly here so Rollup can:
//   1. Name output files predictably (workers/[name].[hash].js)
//   2. Extract shared dependencies (d3-force, utils) into shared chunks
//      rather than duplicating them across the main bundle and worker bundles
//
// ADR-001: Decision 5 — Explicit Rollup entry points
// To add a new worker: add one line here + create src/workers/<name>.worker.ts
const WORKER_ENTRIES = {
  'worker-constellation': path.resolve(__dirname, 'src/workers/constellation.worker.ts'),
  'worker-ml':            path.resolve(__dirname, 'src/workers/ml.worker.ts'),   // S2
  'worker-risk':          path.resolve(__dirname, 'src/workers/risk.worker.ts'),  // S3
}

export default defineConfig({
  plugins: [
    react(),
    babel({
      include: /\.[jt]sx?$/,
      exclude: /node_modules/,
      presets: [reactCompilerPreset({ target: '18' })],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Worker bundling: Vite transforms new URL('./x.worker.ts', import.meta.url)
  // at build time, replacing it with the correct hashed output URL.
  worker: {
    format: 'es',
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        ...WORKER_ENTRIES,
      },
      output: {
        // Route worker entry points to a dedicated subdirectory
        entryFileNames: (chunk) =>
          chunk.name.startsWith('worker-')
            ? 'workers/[name].[hash].js'
            : '[name].[hash].js',
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
          // d3-force is shared between the main bundle and the constellation
          // worker — extract it into a shared chunk to avoid duplication
          if (id.includes('node_modules/d3-force') || id.includes('node_modules/d3-dispatch') || id.includes('node_modules/d3-quadtree') || id.includes('node_modules/d3-timer')) {
            return 'workers-shared'
          }
        },
      },
    },
  },
})
