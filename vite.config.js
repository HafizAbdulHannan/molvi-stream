import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Ye app ko network par access karne deta hai
    allowedHosts: true, // Ye ngrok ke random URL ko accept karega
    port: 5173, // Default Vite port
  }
})