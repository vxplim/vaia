import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

// electron-vite builds three separate pieces of the app:
//   main     -> the "brain" (Node.js) that creates windows and manages tabs
//   preload  -> a tiny, safe bridge between the brain and the UI
//   renderer -> the UI you see (React: sidebar, command bar, settings)
export default defineConfig({
  main: {},
  // The preload runs in a sandbox, so the extensions toolbar code must be bundled into it.
  preload: {
    build: { externalizeDeps: { exclude: ['electron-chrome-extensions'] } }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    },
    plugins: [react()]
  }
})
