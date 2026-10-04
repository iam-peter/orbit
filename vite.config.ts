import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [
    react(),
    {
      name: 'embed-dev-route',
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url?.split('?')[0] === '/orbit-embed.js') request.url = '/src/embed.ts'
          next()
        })
      },
    },
  ],
  build: {
    rollupOptions: {
      input: { app: 'index.html', 'orbit-embed': 'src/embed.ts' },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'orbit-embed' ? 'orbit-embed.js' : 'assets/[name]-[hash].js',
      },
    },
  },
})
