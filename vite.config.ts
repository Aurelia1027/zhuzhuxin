import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dialoguePlugin } from './server/viteDialoguePlugin.ts'

export default defineConfig({
  plugins: [react(), dialoguePlugin()],
  server: {
    // Keep Vite's default private-file deny patterns and protect all internal authoring files.
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/docs/**', '**/server/**', '**/assets/**'] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-engine': ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
        },
      },
    },
  },
})
