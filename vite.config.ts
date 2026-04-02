import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  let componentTagger: null | (() => unknown) = null;
  if (mode === 'development') {
    const mod = await import('lovable-tagger');
    componentTagger = mod.componentTagger;
  }
  return {
    server: {
      host: '::',
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: ['favicon.ico', 'angels-logo.png'],
        manifest: {
          name: 'Hatosfera CRM',
          short_name: 'Hatosfera',
          description: 'CRM for property, clients, deals, notes, and presentations.',
          theme_color: '#111827',
          background_color: '#111827',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/angels-logo.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/angels-logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
      }),
      componentTagger && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        external: ['dompurify'],
      },
    },
  };
});
