#!/usr/bin/env node
/**
 * Regenerate LavaMoat policies and fail if the working tree has uncommitted policy diffs.
 * Use in CI: npm run lavamoat:check
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status ?? 1);
  }
  return result;
}

console.log('Regenerating LavaMoat policies…');
run('npm', ['run', 'build:policy']);

const status = spawnSync(
  'git',
  ['status', '--porcelain', '--', 'lavamoat/'],
  { cwd: root, encoding: 'utf8' },
);
if (status.status !== 0) {
  process.stderr.write(status.stderr || 'git status failed\n');
  process.exit(status.status ?? 1);
}

const dirty = (status.stdout || '').trim();
if (dirty) {
  console.error('LavaMoat policy files are stale or uncommitted:\n');
  console.error(dirty);
  console.error('\nRun `npm run build:policy`, review the diff, and commit lavamoat/.');
  process.exit(1);
}

console.log('LavaMoat policies are up to date.');
