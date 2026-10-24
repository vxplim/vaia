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
  // Preloads: index (VAIA's own windows), and in web pages: passwords (spots logins) and
  // links (Shift+hover a link to Peek it).
  preload: {
    build: {
      externalizeDeps: { exclude: ['electron-chrome-extensions'] },
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          passwords: resolve(__dirname, 'src/preload/passwords.ts'),
          links: resolve(__dirname, 'src/preload/links.ts')
        }
      }
    }
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
