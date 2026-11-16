import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { defineConfig } from 'vite';

function collectFiles(dir, baseDir = dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      collectFiles(fullPath, baseDir, acc);
    } else {
      const rel = relative(baseDir, fullPath).split(sep).join(posix.sep);
      if (rel !== 'sw.js' && rel !== '_headers' && !rel.startsWith('voice-pack/')) {
        acc.push({ rel, fullPath });
      }
    }
  }
  return acc;
}

function injectServiceWorkerManifest() {
  let outDir = 'dist';
  return {
    name: 'pet-comm-sw-manifest',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const swPath = join(outDir, 'sw.js');
      const files = collectFiles(outDir).sort((a, b) => a.rel.localeCompare(b.rel));
      const hash = createHash('sha256');
      const urls = ['/'];

      for (const file of files) {
        urls.push(`/${file.rel}`);
        hash.update(file.rel);
        hash.update(readFileSync(file.fullPath));
      }

      const version = `pet-comm-${hash.digest('hex').slice(0, 10)}`;
      const rawSw = readFileSync(swPath, 'utf8');
      const updatedSw = rawSw
        .replace('__CACHE_VERSION__', version)
        .replace("/*__PRECACHE_MANIFEST__*/ ['/', '/index.html']", JSON.stringify(urls));

      writeFileSync(swPath, updatedSw, 'utf8');
    },
  };
}

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  plugins: [injectServiceWorkerManifest()],
  test: {
    pool: 'vmThreads',
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      reporter: ['text', 'html'],
    },
  },
});
