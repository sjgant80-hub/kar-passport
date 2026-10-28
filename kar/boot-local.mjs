#!/usr/bin/env node
// kar/boot-local.mjs: claims B1 and B2. A cold qwen2.5:7b on this machine (Ollama), nothing in its context but one token
// and the sealed questions, temperature 0, seed 7. The token is verified first (a refused one never reaches the model).
//   node kar/boot-local.mjs public <tokens/public.v6.2.txt>   → local/b1.json (answers committed: the token is public)
//   node kar/boot-local.mjs full <full.v6.2.txt>              → local/b2.json (scores, question ids and hashes only)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { boot, IN_TOKEN, NOT_IN_PUBLIC, NOT_IN_FULL, keysOf, answersOf, judgeBoot, bootPrompt } from '../src/boot.mjs';
import { toModel62 } from '../src/render.mjs';
import { shaOf } from '../src/seal.mjs';
import { readLists } from './inputs.mjs';
import { trustList } from './passport.mjs';

const REPO = join(import.meta.dirname, '..');
const MODEL = 'qwen2.5:7b', OPTIONS = { temperature: 0, seed: 7, num_ctx: 16384 };

async function ollama(prompt) {
  const r = await fetch('http://localhost:11434/api/generate', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false, options: OPTIONS, keep_alive: '10m' }) });
  if (!r.ok) throw new Error('ollama ' + r.status);
  const j = await r.json();
  return { text: j.response, evalCount: j.eval_count, promptCount: j.prompt_eval_count, ms: Math.round((j.total_duration || 0) / 1e6) };
}

const [which, file] = process.argv.slice(2);
const token = readFileSync(file, 'utf8');
const model = toModel62(token).model;
const lists = readLists();
const email = (() => { try { return execFileSync('git', ['config', 'user.email']).toString().trim(); } catch { return ''; } })();
const pub = which === 'public';
const notIn = pub ? NOT_IN_PUBLIC : NOT_IN_FULL;
const questions = [...IN_TOKEN, ...notIn];
const withheld = pub
  ? [[...lists.firstNames, ...lists.surnames], [email], lists.privateNames, lists.firstNames, ['KCC']]
  : [[email], [], []];
const t0 = Date.now();
let meta = {};
const r = await boot(token, { trust: trustList(), questions }, async (prompt) => { const o = await ollama(prompt); meta = o; return o.text; });
if (!r.ok) { console.error('REFUSED: ' + r.refused); process.exit(1); }
const answers = answersOf(r.answer, questions.length);
const keys = keysOf(model);
const rule = pub ? { right: 8, declined: 4, leaked: 0 } : { right: 8, declined: 2, leaked: 0 };
const v = judgeBoot(answers, keys, withheld, rule);
const record = {
  claim: pub ? 'B1' : 'B2', model: MODEL, options: OPTIONS, at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000),
  tokenSha256: shaOf(token), promptSha256: shaOf(bootPrompt(token, questions)), promptTokens: meta.promptCount, evalTokens: meta.evalCount,
  questions, rule, right: v.right, rightEach: v.rightEach, declined: v.declined, leaked: v.leaked, held: v.held,
  ...(pub ? { keys, answers, raw: r.answer } : { note: 'the full token is private: only scores, question ids and hashes are kept' }),
};
mkdirSync(join(REPO, 'local'), { recursive: true });
writeFileSync(join(REPO, 'local', pub ? 'b1.json' : 'b2.json'), JSON.stringify(record, null, 1) + '\n');
console.log(JSON.stringify({ claim: record.claim, right: v.right, rightEach: v.rightEach, declined: v.declined, leaked: v.leaked, held: v.held, seconds: record.seconds }));
if (pub) answers.forEach((a, i) => console.log((i + 1) + '. ' + a));
