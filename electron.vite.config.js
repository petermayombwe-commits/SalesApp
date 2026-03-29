import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        // ALL packages used in the main process must be external
        // Native addons (better-sqlite3) CANNOT be bundled by Vite
        external: [
          'electron',
          'better-sqlite3',
          'bcryptjs',
          'uuid',
          'path',
          'fs',
          'os',
          'crypto',
          'events',
          'stream',
          'util'
        ]
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        external: ['electron']
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
