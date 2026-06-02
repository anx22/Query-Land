import { spawn } from 'node:child_process';

const commands = [
  ['npm', ['--workspace', '@seo-tool/api', 'start']],
  ['npm', ['--workspace', '@seo-tool/web', 'run', 'dev']]
];

const children = commands.map(([cmd, args]) => {
  const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  child.on('exit', (code) => {
    if (code && code !== 0) {
      children.forEach((other) => other !== child && other.kill('SIGTERM'));
      process.exit(code);
    }
  });
  return child;
});

process.on('SIGINT', () => {
  children.forEach((child) => child.kill('SIGINT'));
  process.exit(0);
});
