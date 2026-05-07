#!/usr/bin/env node
const { execSync } = require('child_process');
const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');

const PKG_PATH = join(__dirname, '..', 'package.json');
const TAG_PREFIX = 'sistema-modular-v';

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', encoding: 'utf-8', ...opts });
}

function capture(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

function bumpVersion(current, kind) {
  const [maj, min, pat] = current.split('.').map(Number);
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  if (kind === 'patch') return `${maj}.${min}.${pat + 1}`;
  throw new Error(`Unknown kind: ${kind}`);
}

const kind = process.argv[2];
if (!['patch', 'minor', 'major'].includes(kind)) {
  console.error('Usage: release.cjs <patch|minor|major>');
  process.exit(1);
}

const repoRoot = capture('git rev-parse --show-toplevel');

const status = capture(`git -C "${repoRoot}" status --porcelain`);
if (status) {
  console.error('Working tree is not clean. Commit or stash changes first.');
  console.error(status);
  process.exit(1);
}

const branch = capture(`git -C "${repoRoot}" rev-parse --abbrev-ref HEAD`);
if (branch !== 'main') {
  console.error(`Releases must be cut from 'main'. Current branch: '${branch}'`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
const oldVersion = pkg.version;
const newVersion = bumpVersion(oldVersion, kind);
const tag = `${TAG_PREFIX}${newVersion}`;

console.log(`\nBumping ${oldVersion} -> ${newVersion}`);
console.log(`Tag: ${tag}\n`);

pkg.version = newVersion;
writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + '\n');

run(`git -C "${repoRoot}" add apps/sistema-modular/package.json`);
run(`git -C "${repoRoot}" commit -m "release(sistema-modular): v${newVersion}"`);
run(`git -C "${repoRoot}" tag ${tag}`);

console.log(`\nReady to push. Run:\n  git push origin main && git push origin ${tag}\n`);
console.log('Or push everything at once:');
console.log(`  git push --follow-tags origin main\n`);
