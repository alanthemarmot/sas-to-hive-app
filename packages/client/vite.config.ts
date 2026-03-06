import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load .env from the workspace root (two levels up from packages/client/)
  const env = loadEnv(mode, '../../', '');
  const clientPort = parseInt(env.VITE_PORT || '5173', 10);
  const serverPort = parseInt(env.PORT || '3001', 10);

  return {
    plugins: [react()],
    server: {
      port: clientPort,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
