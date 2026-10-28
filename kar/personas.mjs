#!/usr/bin/env node
// kar/personas.mjs: the prospective-client walkthrough, on the local model (sovereign-first). Each buyer persona reads the
// LIVE page's text cold and lists what it could not understand, could not find, or would not believe. Written to
// local/personas.json; every gap is answered on the page or in the notes before the build is called done.
//   node kar/personas.mjs https://sjgant80-hub.github.io/kar-passport/
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import http from 'node:http';

const REPO = join(import.meta.dirname, '..');
const url = process.argv[2];
const PERSONAS = [
  ['CFO', 'the finance director of a 60-person professional-services firm, deciding whether this is worth anyone\'s time'],
  ['CTO/CISO', 'the head of IT and security at a regulated UK firm, looking for anything that would leak data or cannot be audited'],
  ['COO', 'the operations director, asking how it would actually be rolled out and what changes for staff'],
  ['Owner-manager', 'the owner of a 12-person business who has never heard of SYMB-FER and has ten minutes'],
  ['Procurement', 'a procurement lead who needs the supplier, licence, support terms and risks before anything goes further'],
];

const html = await (await fetch(url + '?nc=' + Date.now())).text();
const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, '\n').replace(/&[a-z#0-9]+;/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

function ask(prompt) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 11434, path: '/api/generate', method: 'POST', headers: { 'content-type': 'application/json' } }, (res) => {
      let buf = '', out = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim()) out += JSON.parse(l).response || ''; } });
      res.on('end', () => resolve(out)); res.on('error', reject);
    });
    req.setTimeout(0); req.on('error', reject);
    req.end(JSON.stringify({ model: 'qwen2.5:7b', prompt, stream: true, options: { temperature: 0.2, seed: 7, num_ctx: 16384 }, keep_alive: '30m' }));
  });
}

const walks = [];
for (const [role, who] of PERSONAS) {
  const t0 = Date.now();
  const answer = await ask('You are ' + who + '. You have opened this product page cold. Its text follows.\n\n---\n' + text + '\n---\n\n' +
    'As that buyer, list every gap: anything you could not understand, could not find, did not believe, or would need answered before going further. ' +
    'Be specific and brief, one line each, at most 8 lines. Then one line starting VERDICT: with whether you would take it to the next step and why.');
  walks.push({ role, seconds: Math.round((Date.now() - t0) / 1000), answer });
  console.log('== ' + role + '\n' + answer + '\n');
}
mkdirSync(join(REPO, 'local'), { recursive: true });
writeFileSync(join(REPO, 'local', 'personas.json'), JSON.stringify({ url, model: 'qwen2.5:7b', at: new Date().toISOString(), pageChars: text.length, walks }, null, 1) + '\n');
