import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const base = env.VITE_BASE_PATH || '/'

  return {
    base,
    plugins: [
      react(),
      legacy({
        targets: ['defaults', 'not IE 11'],
      }),
    ],
    build: {
      target: 'es2018',
      assetsInlineLimit: 4096,
    },
    define: {
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    },
  }
})
