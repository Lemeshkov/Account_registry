// import { defineConfig } from 'vite'
// import react from '@vitejs/plugin-react'

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     port: 3000
//   }
// })


import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  
  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true, // Важно для работы в контейнере
      watch: {
        usePolling: true, // Для hot-reload в Docker
      },
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://backend:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/ws': {
          target: env.VITE_WS_URL || 'ws://backend:8000',
          ws: true,
        }
      }
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
    }
  }
})