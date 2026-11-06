#!/usr/bin/env node
// kar/page-scan.mjs <page text file> <url>: G3's scan of the live page's own text, on Kar's machine with its lists
// (claims.json G3 measures "the leak gate, every class, over every committed file ... and over the text of the live page").
// The text is the page as a browser shows it with its scripts run (document.body.innerText, saved to a file by any
// browser); <url> is where it was read. Every kind of leak, at the public level, because the page is public. The record
// keeps each match's kind and line, never the matched text, and the SHA-256 of the text scanned, so a later read of the
// served page can be compared with it. It writes the page's fields of local/g3.json and keeps the files' fields
// (kar/measure-local.mjs writes those); measure.mjs counts both.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scan, protocolLines } from '../src/leak.mjs';
import { shaOf } from '../src/seal.mjs';
import { readLists } from './inputs.mjs';
import { textOf } from './text.mjs';

const REPO = join(import.meta.dirname, '..');
const [file, url] = process.argv.slice(2);
if (!file || !/^https?:\/\//.test(url || '')) { console.error('usage: node kar/page-scan.mjs <page text file> <the url it was read from>'); process.exit(2); }
const text = textOf(readFileSync(file)).replace(/\r\n/g, '\n');
const r = scan(text, { ...readLists(), canaries: [] }, 'public', protocolLines());
const path = join(REPO, 'local', 'g3.json');
const g3 = (() => { try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return { claim: 'G3' }; } })();
g3.pageScanned = true;
g3.pageHits = r.hits.length;
g3.pageWhere = r.hits.length ? 'the live page: ' + r.hits.map((h) => h.cls + '@' + h.n).join(',') : '';
g3.page = { url, at: new Date().toISOString().slice(0, 10), chars: [...text].length, scanned: r.scanned, exempt: r.exempt, inSig: r.inSig, sha256: shaOf(text) };
writeFileSync(path, JSON.stringify(g3, null, 1) + '\n');
console.log('the page at ' + url + ': ' + r.hits.length + ' matches' + (r.hits.length ? ' (' + g3.pageWhere.slice('the live page: '.length) + ')' : '') + '; ' + r.scanned + ' lines scanned, ' + r.exempt + ' protocol lines');
