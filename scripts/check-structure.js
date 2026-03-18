const fs = require('fs');

const required = [
  'package.json',
  'src/main/main.ts',
  'src/main/preload.ts',
  'src/renderer/App.tsx',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.electron.json'
];

const missing = required.filter((f) => !fs.existsSync(f));
if (missing.length) {
  console.error('Missing required files:', missing.join(', '));
  process.exit(1);
}

console.log('Structure check passed. Required files are present.');
