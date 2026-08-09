#!/usr/bin/env node
/**
 * Watch-build background (LavaMoat), popup UI, and content/inpage bundles in parallel.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, NODE_ENV: 'development' };

function run(config) {
  const child = spawn(
    'npx',
    ['webpack', '--config', config, '--watch'],
    { cwd: root, env, stdio: 'inherit' },
  );
  child.on('exit', (code) => {
    if (code && code !== 0) process.exit(code ?? 1);
  });
  return child;
}

run('webpack.config.cjs');
run('webpack.ui.config.cjs');
run('webpack.content.config.cjs');
