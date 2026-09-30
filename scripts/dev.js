const { spawn } = require('node:child_process');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

const backend = spawn(process.execPath, ['server/index.js'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
});

const frontend = isWindows
  ? spawn('cmd.exe', ['/c', 'npm.cmd', 'run', 'dev:client'], {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    })
  : spawn('npm', ['run', 'dev:client'], {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    });

const children = [backend, frontend];

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      process.exit(code || 1);
    }

    if (signal) {
      process.exit(1);
    }
  });
}

for (const child of children) {
  child.on('error', (error) => {
    console.error('Failed to start dev process:', error.message);
    process.exit(1);
  });
}

process.on('SIGINT', () => {
  for (const child of children) {
    if (!child.killed) child.kill('SIGINT');
  }
  process.exit(0);
});
