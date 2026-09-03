#!/usr/bin/env node
/** Copy repo git hooks into .git/hooks. Skips CI. Does not change git config. */
import { chmodSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hooksSrc = path.join(root, 'scripts', 'git-hooks');
const hooksDest = path.join(root, '.git', 'hooks');

if (process.env.CI) {
  console.log('1337: skip git hook install in CI.');
  process.exit(0);
}
if (!existsSync(path.join(root, '.git'))) {
  process.exit(0);
}

mkdirSync(hooksDest, { recursive: true });
for (const name of ['post-commit', 'pre-push']) {
  const from = path.join(hooksSrc, name);
  const to = path.join(hooksDest, name);
  if (!existsSync(from)) continue;
  copyFileSync(from, to);
  chmodSync(to, 0o755);
}
console.log('1337: installed post-commit and pre-push hooks (rebuild unpacked extension).');
