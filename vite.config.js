import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  // Resolve absolute Foundry paths to your local project root
  resolve: {
    alias: {
      '/modules/sr5-marketplace': path.resolve(__dirname, '.')
    }
  },
  build: {
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
    viteStaticCopy({
      targets: [
        { src: 'module.json', dest: '.' },
        { src: 'languages', dest: '.' },
        { src: 'templates', dest: '.' },
        { src: 'assets', dest: '.' }
        // 'styles' is excluded here because Tailwind now compiles 
        // the CSS directly through the import in your JS.
      ]
    })
  ]
});