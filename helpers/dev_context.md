# 🛠️ Dev Context

### module.json
```json
{"id":"sr5-marketplace","title":"Shadowrun 5e Marketplace","description":"A module to enhance the Shadowrun 5e system with a marketplace feature.","version":"#{VERSION}#","library":false,"compatibility":{"minimum":13,"verified":13,"maximum":13},"authors":[{"name":"Shadow","url":"https://github.com/shadows-eye/sr5-marketplace","discord":"shadows_plays"}],"relationships":{"systems":[{"id":"shadowrun5e","compatibility":{"minimum":"0.30.0"}}]},"socket":true,"styles":["styles/marketplace.css"],"esmodules":["scripts/marketHooks.js"],"languages":[{"lang":"en","name":"English","path":"languages/en.json"},{"lang":"de","name":"Deutsch","path":"languages/de.json"}],"documentTypes":{"Item":{"basket":{}},"Actor":{"shop":{}}},"url":"#{URL}#","manifest":"#{MANIFEST}#","download":"#{DOWNLOAD}#","license":"LICENSE","readme":"README.md","media":[{"type":"icon","url":"https://avatars2.githubusercontent.com/u/71292812?s=400&u=ccdb4eeb7abf551ca8f314e5a9bfd0479a4d3d41&v=4"}]}
```

### package.json
```json
{"devDependencies":{"autoprefixer":"^10.4.27","ignore":"^7.0.5","postcss":"^8.5.8","tailwindcss":"^4.2.2","vite":"^8.0.3","vite-plugin-static-copy":"^4.0.0"},"scripts":{"dev":"vite","build":"vite build","gen-ctx":"node helpers/generate-context.cjs"}}
```

### vite.config.js
```js
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
export default defineConfig({
 build: {
 outDir: 'dist',
 emptyOutDir: true,
 lib: {
 entry: path.resolve(__dirname, 'scripts/marketHooks.js'),
 formats: ['es'],
 fileName: () => 'scripts/marketHooks.js'
 },
 rollupOptions: {
 output: {
 entryFileNames: 'scripts/[name].js',
 chunkFileNames: 'scripts/[name]-[hash].js',
 assetFileNames: (assetInfo) => {
 if (assetInfo.names === 'style.css') return 'styles/marketplace.css';
 return '[name].[ext]';
 },
 },
 },
 },
 plugins: [
 viteStaticCopy({
 targets: [
 { src: 'module.json', dest: '.' },
 { src: 'languages', dest: '.' },
 { src: 'templates', dest: '.' },
 { src: 'assets', dest: '.' },
 { src: 'styles', dest: '.' }
 ]
 })
 ]
});
```

