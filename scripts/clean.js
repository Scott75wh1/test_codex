import { rmSync } from 'node:fs';

const pathsToClean = [
  'dist',
  'build',
  'node_modules/.vite',
  'tsconfig.app.tsbuildinfo',
  'tsconfig.node.tsbuildinfo',
  'vite.config.js',
  'vite.config.d.ts'
];

for (const targetPath of pathsToClean) {
  rmSync(targetPath, { force: true, recursive: true });
}

console.log('Pulizia cache/build locali completata.');
