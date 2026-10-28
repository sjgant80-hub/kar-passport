#!/usr/bin/env node
// tools/vendor.mjs: the pins of everything under vendor/. Each file is a byte-for-byte copy of a committed blob in its
// source repository; SOURCES.json names the repository, the commit, the path there and the SHA-256.
//   node tools/vendor.mjs --write   (re)write vendor/SOURCES.json from the files on disk
//   node tools/vendor.mjs --check   every file on disk matches its pin, and every pin matches the source at its commit
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const ROOT = join(import.meta.dirname, '..');
const ORIGINS = [
  { dir: 'vendor/symbfer/symbeyond', repo: 'SYMBEYOND/SYMB-FER', commit: '7370e7debfba410dd21f99f046dbdcc93070175d', prefix: '' },
  { dir: 'vendor/symbfer/teslasolar', repo: 'teslasolar/SYMB-FER', commit: '67054648fb642cf76c0cbf656a1244899658ce44', prefix: '' },
  { dir: 'vendor/fall-kit-core', repo: 'sjgant80-hub/fall-kit', commit: '9244d6128c7be0094c9d800acac0a9ee70ecdd97', prefix: 'core/' },
];
const sha = (b) => createHash('sha256').update(b).digest('hex');
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

function current() {
  const files = [];
  for (const o of ORIGINS) for (const p of walk(join(ROOT, o.dir)).sort()) {
    const local = relative(ROOT, p).split(sep).join('/');
    files.push({ local, repo: o.repo, commit: o.commit, path: o.prefix + local.slice(o.dir.length + 1), sha256: sha(readFileSync(p)) });
  }
  return files;
}

const mode = process.argv[2];
if (mode === '--write') {
  const files = current();
  writeFileSync(join(ROOT, 'vendor', 'SOURCES.json'), JSON.stringify({ kind: 'kar-passport.vendor', note: 'Byte-for-byte copies of committed blobs. Never edit; re-vendor and re-pin.', files }, null, 1) + '\n');
  console.log('pinned ' + files.length + ' files');
} else if (mode === '--check') {
  const pins = JSON.parse(readFileSync(join(ROOT, 'vendor', 'SOURCES.json'), 'utf8')).files;
  const disk = new Map(current().map((f) => [f.local, f.sha256]));
  let bad = 0;
  if (disk.size !== pins.length) { console.error('vendor/ holds ' + disk.size + ' files, SOURCES.json pins ' + pins.length); bad++; }
  for (const f of pins) {
    if (disk.get(f.local) !== f.sha256) { console.error('DIFFERS on disk: ' + f.local); bad++; continue; }
    const r = await fetch('https://raw.githubusercontent.com/' + f.repo + '/' + f.commit + '/' + f.path.split('/').map(encodeURIComponent).join('/'));
    const got = r.ok ? sha(Buffer.from(await r.arrayBuffer())) : 'HTTP ' + r.status;
    if (got !== f.sha256) { console.error('DIFFERS from ' + f.repo + '@' + f.commit.slice(0, 7) + ':' + f.path + ' (' + got + ')'); bad++; }
  }
  if (bad) process.exit(1);
  console.log('vendor: ' + pins.length + ' files match their pins and their sources');
} else { console.error('usage: node tools/vendor.mjs --write | --check'); process.exit(2); }
