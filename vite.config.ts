import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5181,
    host: true,
    proxy: {
      // Laravel dev sunucusu (php artisan serve) — CORS'suz local geliştirme.
      '/api': { target: 'http://127.0.0.1:8100', changeOrigin: true },
      '/storage': { target: 'http://127.0.0.1:8100', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        /**
         * Ağır bağımlılıkları ayrı parçalara böler — vitrin, panel
         * kütüphanelerini (tablo/grafik/editör) indirmek zorunda kalmaz.
         *
         * Not: Buraya yalnız KODDA GERÇEKTEN import edilen paketler yazılır;
         * kullanılmayan bir paket adı Rollup'ta "failed to resolve entry"
         * hatası verir.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'react';
          }
          if (id.includes('@tanstack')) return 'query';
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor';
          if (id.includes('xlsx')) return 'xlsx';
        },
      },
    },
  },
});
