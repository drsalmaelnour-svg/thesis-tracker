import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/thesis-tracker/',
  build: {
    // Add content hash to all filenames — forces browser to load new files
    rollupOptions: {
      output: {
        entryFileNames:   'assets/[name]-[hash].js',
        chunkFileNames:   'assets/[name]-[hash].js',
        assetFileNames:   'assets/[name]-[hash].[ext]',
      }
    }
  }
})
