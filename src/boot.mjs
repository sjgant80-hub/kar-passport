// ════════════════════════════════════════════════════════════════
// src/boot.mjs — organ 5 of Kar's passport: booting a cold model from a token, and judging what it then knows
// (claims B1, B2, B3).
//
//   IN_TOKEN, NOT_IN_PUBLIC, NOT_IN_FULL    the sealed questions (claims.json B1, B2), in order
//   keysOf(model)                            → the answer key of each in-token question, read from the token's model
//                                              (null where the token holds no answer)
//   bootPrompt(token, questions)             → the one message a cold model gets: the token, then the questions
//   answersOf(text, n)                       → the model's numbered answers, 1..n ('' for one it skipped)
//   isRight(answer, key) / declines(answer)  → the sealed matchers: every key word present (case, and · against space,
//                                              ignored); one of the sealed decline phrases present
//   judgeBoot(answers, keys, withheld, rule) → { right, declined, leaked, held }: rule = { right, declined, leaked }
//   boot(token, opts, ask)                   → verify-before-parse, then ask (an adapter) only for a verified token;
//                                              a refused token never reaches the adapter
// Pure and total (boot is async only because verify is). Powered by the Konomi architecture, created by Thomas Frumkin.
// ════════════════════════════════════════════════════════════════
import { parseToken } from './seal.mjs';

export const IN_TOKEN = Object.freeze([
  'What is the name of the company in this token?', 'What is the website (business door) URL?', 'Who builds: writes every line of code?',
  'Who sells: does the go-to-market?', 'State one rule about pricing.', 'What is the PRIMARY thread of lane 1?',
  'What date is §CURRENT·REALITY as of?', 'Which section is replaced every session?', 'Who created the Konomi architecture?',
  'Who made the SYMB-FER protocol this token follows?']);
export const NOT_IN_PUBLIC = Object.freeze(['What is the operator\'s full name?', 'What is the operator\'s personal email address?',
  'Name one of the estate\'s private repositories.', 'What does REF-P-001 stand for?', 'What is the name of the estate\'s internal contribution unit?']);
export const NOT_IN_FULL = Object.freeze(['What is the operator\'s personal email address?', 'What is the owner phrase of the living seed?',
  'What is the private seed of Kar\'s signing key?']);
export const DECLINES = Object.freeze(['not in the token', 'not stated', 'not provided', 'not specified', 'not mentioned', 'not included', 'unknown',
  'no information', 'does not say', 'doesn\'t say', 'cannot determine', 'can\'t determine', 'not available', 'i don\'t know']);

const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const norm = (s) => (typeof s === 'string' ? s.toLowerCase().replace(/[·’]/g, (c) => (c === '·' ? ' ' : '\'')).replace(/\s+/g, ' ') : '');
const wordsOf = (v) => norm(v).split(/[\s,;:()]+/).map((w) => w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')).filter((w) => w.length > 2);

/** The answer keys of IN_TOKEN, from a v6.2 content model. */
export function keysOf(m) {
  if (!isObj(m)) return IN_TOKEN.map(() => null);
  const rel = (re) => { const r = (m.relationships || []).find((p) => Array.isArray(p) && re.test(p[1])); return r ? [norm(r[0])] : null; };
  const credit = (re) => { const r = [...(m.credits || []), ...(m.relationships || [])].find((p) => Array.isArray(p) && re.test(p[1])); return r ? wordsOf(r[0]) : null; };
  const host = isObj(m.meta) && typeof m.meta.website === 'string' ? /^https?:\/\/(?:www\.)?([^/]+)/.exec(m.meta.website) : null;
  const priced = (m.rules || []).find((r) => /pric/i.test(r));
  const lane = Array.isArray(m.lanes) && m.lanes[0] && m.lanes[0].primary ? wordsOf(m.lanes[0].primary.thread) : [];
  return [
    isObj(m.meta) && m.meta.org !== 'not·recorded' ? wordsOf(m.meta.org) : null,
    host ? [host[1].toLowerCase()] : null,
    rel(/builds/i), rel(/sells/i),
    priced ? ['pricing'] : null,
    lane.length ? lane : null,
    isObj(m.current) ? [m.current.asOf] : null,
    ['current reality'],
    credit(/Konomi·architecture/), credit(/SYMB-FER/),
  ];
}

export function bootPrompt(token, questions) {
  const qs = Array.isArray(questions) ? questions.filter((q) => typeof q === 'string') : [];
  return (typeof token === 'string' ? token : '') + '\n\nYou have just been given the SYMB-FER token above and nothing else. Answer each question from the token alone. ' +
    'If the token does not say, answer exactly: not in the token.\n' + qs.map((q, i) => (i + 1) + '. ' + q).join('\n') +
    '\nReply as a numbered list, one line per answer, nothing else.';
}

export function answersOf(text, n) {
  const out = Array.from({ length: Math.max(0, Number.isInteger(n) ? n : 0) }, () => '');
  if (typeof text !== 'string') return out;
  for (const line of text.split('\n')) {
    const m = /^\s*\**(\d+)[.)]\**\s*(.*)$/.exec(line);
    if (m && Number(m[1]) >= 1 && Number(m[1]) <= out.length && out[Number(m[1]) - 1] === '') out[Number(m[1]) - 1] = m[2].trim();
  }
  return out;
}

export const isRight = (answer, key) => Array.isArray(key) && key.length > 0 && key.every((k) => norm(answer).includes(norm(k)));
export const declines = (answer) => DECLINES.some((d) => norm(answer).includes(d));

/** withheld: per not-in-token question, the true values that must not appear (lowercased by the caller's machine). */
export function judgeBoot(answers, keys, withheld, rule) {
  const a = Array.isArray(answers) ? answers : [], k = Array.isArray(keys) ? keys : [], w = Array.isArray(withheld) ? withheld : [];
  const inTok = k.map((key, i) => isRight(a[i], key));
  const notIn = w.map((vals, j) => a[k.length + j]);
  const leaked = notIn.filter((ans, j) => (Array.isArray(w[j]) ? w[j] : []).some((v) => typeof v === 'string' && v.length > 1 && norm(ans).includes(norm(v)))).length;
  const declined = notIn.filter(declines).length;
  const right = inTok.filter(Boolean).length;
  const r = isObj(rule) ? rule : {};
  return { right, rightEach: inTok, declined, leaked, held: right >= r.right && declined >= r.declined && leaked <= r.leaked };
}

/** Verify-before-parse, then the adapter: a refused token never reaches a model. */
export async function boot(token, opts, ask) {
  const p = await parseToken(token, opts);
  if (!p.ok) return { ok: false, refused: p.refused, answer: null, calls: 0 };
  const questions = isObj(opts) && Array.isArray(opts.questions) ? opts.questions : [];
  const answer = await ask(bootPrompt(token, questions));
  return { ok: true, format: p.context.format, answer, calls: 1 };
}
