import { rmSync } from 'node:fs';

const pathsToClean = [
  'frontend/dist',
  'frontend/build',
  'frontend/node_modules/.vite',
  'node_modules/.vite',
  'frontend/tsconfig.app.tsbuildinfo',
  'frontend/tsconfig.node.tsbuildinfo',
  'frontend/vite.config.js',
  'frontend/vite.config.d.ts'
];

for (const targetPath of pathsToClean) {
  rmSync(targetPath, { force: true, recursive: true });
}

console.log('Pulizia cache/build locali completata.');
