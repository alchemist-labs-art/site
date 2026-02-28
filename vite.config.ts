import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  root: '.',
  server: {
    port: 8329,
  },
  build: {
    outDir: 'dist',
  },
})
