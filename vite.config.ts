import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// La app se publica en GitHub Pages bajo https://<usuario>.github.io/ACoupleLife/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/ACoupleLife/',
  plugins: [react(), tailwindcss()],
})
