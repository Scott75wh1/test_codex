import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const commands = [
  { name: 'api', command: process.execPath, args: ['--watch', 'server/index.js'] },
  { name: 'vite', command: npmCommand, args: ['--prefix', 'frontend', 'run', 'dev'] }
];

const children = commands.map(({ name, command, args }) => {
  const child = spawn(command, args, { stdio: ['inherit', 'pipe', 'pipe'], shell: false });

  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  child.on('exit', (code, signal) => {
    if (signal) {
      return;
    }

    process.exitCode = code ?? 1;
    shutdown();
  });

  return child;
});

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});

process.on('SIGTERM', () => {
  shutdown();
});
