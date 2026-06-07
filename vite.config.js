import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { mergeLocales } from './merge-locales.js';


export default defineConfig({
  esbuild: {
    keepNames: true
  },
  // Resolve absolute Foundry paths to your local project root
  resolve: {
    alias: {
      '/modules/sr5-marketplace': path.resolve(__dirname, '.')
    }
  },
  build: {
    minify: false,
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'scripts/marketHooks.js'),
      formats: ['es'],
      // Standardizes the main entry filename
      fileName: () => 'scripts/marketHooks'
    },
    rollupOptions: {
      output: {
        entryFileNames: 'scripts/[name].js',
        chunkFileNames: 'scripts/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          // Safely extract the filename whether it's a string (old Vite) or an array (Vite 8+)
          const assetName = assetInfo.name || (assetInfo.names && assetInfo.names[0]);

          // Forces the Tailwind-processed CSS into the specific styles folder
          if (assetName && assetName.endsWith('.css')) {
            return 'styles/marketplace.css';
          }
          return 'assets/[name].[ext]';
        },
      },
    },
  },
  plugins: [
    tailwindcss(), // Tailwind v4 Vite integration
    {
      name: 'merge-locales-plugin',
      buildStart() {
        mergeLocales();
      },
      handleHotUpdate({ file, server }) {
        if (file.includes('/languages/en/') || file.includes('/languages/de/')) {
          console.log(`\nLocale file changed: ${file}. Re-merging...`);
          mergeLocales();
          server.ws.send({ type: 'full-reload' });
        }
      }
    },
    viteStaticCopy({
      targets: [
        { src: 'module.json', dest: '.' },
        { src: 'languages/en.json', dest: '.' },
        { src: 'languages/de.json', dest: '.' },
        { src: 'templates', dest: '.' },
        { src: 'assets', dest: '.' }
        // 'styles' is excluded here because Tailwind now compiles 
        // the CSS directly through the import in your JS.
      ]
    })
  ]
});