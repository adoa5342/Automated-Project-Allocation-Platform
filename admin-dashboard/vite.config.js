import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      '@components': resolve(__dirname, './components'),
      '@pages': resolve(__dirname, './pages'),
      '@styles': resolve(__dirname, './styles')
    }
  }
})