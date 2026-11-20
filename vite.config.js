import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Writes the offline precache list into the built service worker,
// so the whole app (code, fonts-free styles, icons) works with no signal.
function precacheServiceWorker() {
  let outDir = 'dist';
  return {
    name: 'trippin-precache-sw',
    apply: 'build',
    configResolved(cfg) { outDir = cfg.build.outDir; },
    closeBundle() {
      const files = [];
      const walk = (dir) => {
        for (const name of readdirSync(dir)) {
          const p = join(dir, name);
          if (statSync(p).isDirectory()) walk(p);
          else files.push('./' + relative(outDir, p).split('\\').join('/'));
        }
      };
      walk(outDir);
      const list = files.filter((f) => f !== './sw.js' && !f.endsWith('.map'));
      const version = Date.now().toString(36);
      const swPath = join(outDir, 'sw.js');
      const sw = readFileSync(swPath, 'utf8')
        .replace('__PRECACHE__', JSON.stringify(['./', ...list]))
        .replace('__VERSION__', version);
      writeFileSync(swPath, sw);
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), precacheServiceWorker()],
  build: { target: 'es2020', chunkSizeWarningLimit: 2000 }
});
