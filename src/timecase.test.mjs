// src/timecase.test.mjs: the time case kernel (claims-timecase.json T1, T2). The arithmetic is pinned on made-up bases
// with round numbers, so every operator is checked by an exact value; the real bases are read only for their shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { briefOf, figures, over, sourcesOf, timeCase, DEFAULTS, BASIS_KEYS, TYPING_KEYS } from './timecase.mjs';

const ROOT = join(import.meta.dirname, '..');
const B = { wageMedianHourly: { value: 20, what: 'w', source: 'https://example.com/w' }, cpi: { value: 0.1, what: 'c', source: 'https://example.com/c' } };
const T = { wordsPerMinute: { value: 40, what: 'speed', source: 'https://example.com/s' }, charsPerWord: { value: 5, what: 'word', source: 'https://example.com/s' },
  leaveWeeks: { value: 2, what: 'leave', source: 'https://example.com/l' }, weeksInYear: { value: 52, what: 'year', source: 'https://example.com/y' } };
const withT = (k, v) => ({ ...T, [k]: { ...T[k], value: v } });
const withB = (k, v) => ({ ...B, [k]: { ...B[k], value: v } });

test('briefOf counts the list items without their mark and the vocabulary lines, before the seal only', () => {
  const t = 'HEADER\n- abc\n- de\nnot counted\nx :: y\n-no space\n\n§SIG·BEGIN\n- after the seal\n§SIG·END';
  assert.deepEqual(briefOf(t), { ok: true, lines: 3, chars: 3 + 2 + 6 });
  assert.deepEqual(briefOf('- abc'), { ok: true, lines: 1, chars: 3 }, 'no seal: the whole text');
  assert.deepEqual(briefOf('- 𝔸b'), { ok: true, lines: 1, chars: 2 }, 'code points, not UTF-16 units');
  assert.deepEqual(briefOf('a\n- b\n§SIG·BEGIN\n- c\n§SIG·BEGIN\n- d'), { ok: true, lines: 2, chars: 2 }, 'up to the LAST seal');
  const none = briefOf('\n§SIG·BEGIN\n- only after');
  assert.equal(none.ok, false, 'a seal at the very start leaves nothing before it');
  assert.equal(none.lines, 0);
  assert.equal(briefOf('plain\ntext').ok, false);
  assert.match(briefOf('plain').why, /no list items/);
  for (const g of [null, undefined, 3, {}, []]) assert.deepEqual(briefOf(g), { ok: false, why: 'a STATE-tier passport, as text', lines: 0, chars: 0 });
});

test('briefOf on the committed public STATE passport', () => {
  const r = briefOf(readFileSync(join(ROOT, 'tokens', 'public.state.txt'), 'utf8'));
  assert.equal(r.ok, true);
  assert.ok(r.lines > 0 && r.chars > r.lines);
});

test('figures reads the six numbers, and refuses a basis that is missing one or cannot be read', () => {
  assert.deepEqual(figures(B, T), { wage: 20, cpi: 0.1, wpm: 40, perWord: 5, leave: 2, year: 52 });
  assert.equal(figures(null, T), null);
  assert.equal(figures(B, undefined), null);
  assert.equal(figures({ cpi: B.cpi }, T), null);
  assert.equal(figures(B, withT('wordsPerMinute', 0)), null, 'no speed');
  assert.equal(figures(B, withT('charsPerWord', 0)), null, 'no word length');
  assert.equal(figures(B, withT('leaveWeeks', 53)), null, 'more leave than weeks');
  assert.deepEqual(figures(B, withT('leaveWeeks', 52)).leave, 52, 'leave equal to the year is still a basis');
  assert.equal(figures(withB('wageMedianHourly', -1), T), null);
  assert.equal(figures(withB('cpi', NaN), T), null);
  assert.equal(figures(withB('cpi', '0.1'), T), null);
  assert.deepEqual(figures(withB('cpi', 0), T).cpi, 0);
  const toxic = { get wageMedianHourly() { throw new Error('x'); }, cpi: B.cpi };
  assert.equal(figures(toxic, T), null);
});

test('over carries a yearly figure across the years, rising by CPI after the first', () => {
  assert.equal(over(100, 0.1, 1), 100);
  assert.equal(over(100, 0.1, 3), 331);
  assert.equal(over(100, 0, 3), 300);
  assert.equal(over(100, 0.1, 0), 0);
  assert.equal(over(1 / 3, 0, 1), 0.33);
  assert.equal(over(NaN, 0.1, 2), 0);
  assert.equal(over(100, -0.1, 2), 0);
  assert.equal(over(100, 0.1, 2.5), 0);
  assert.equal(over(100, 0.1, '2'), 0);
});

test('the case, pinned: 1,000 characters, 2 people, 3 chats a week, the default weeks', () => {
  const r = timeCase(B, T, { chars: 1000, people: 2, chatsPerWeek: 3 });
  // 1,000 / 5 = 200 words; 200 / 40 = 5 minutes; 2 x 3 x 50 weeks x 5 / 60 = 25 hours; x 20 = 500; 3 years at 10%: 500 + 550 + 605
  assert.deepEqual(r, { ok: true, inputs: { chars: 1000, people: 2, chatsPerWeek: 3, weeks: 50, hourly: 20, years: 3 }, ownHourly: false,
    minutesPerBrief: 5, hoursPerYear: 25, valuePerYear: 500, valueOver: 1655 });
});

test('the reader\'s own figures replace every default', () => {
  const r = timeCase(B, T, { chars: 600, people: 4, chatsPerWeek: 5, weeks: 40, hourly: 30, years: 2 });
  // 600 / 5 / 40 = 3 minutes; 4 x 5 x 40 x 3 / 60 = 40 hours; x 30 = 1,200; then 1,320
  assert.deepEqual(r, { ok: true, inputs: { chars: 600, people: 4, chatsPerWeek: 5, weeks: 40, hourly: 30, years: 2 }, ownHourly: true,
    minutesPerBrief: 3, hoursPerYear: 40, valuePerYear: 1200, valueOver: 2520 });
  assert.equal(timeCase(B, T, { chars: 1000, hourly: 0 }).valuePerYear, 0, 'an hourly cost of none is the reader\'s own');
  assert.equal(timeCase(B, T, { chars: 1000, hourly: 0 }).ownHourly, true);
  for (const blank of ['', null, undefined]) {
    const b = timeCase(B, T, { chars: 1000, hourly: blank, people: blank, chatsPerWeek: blank, weeks: blank, years: blank });
    assert.equal(b.ownHourly, false);
    assert.deepEqual(b.inputs, { chars: 1000, people: DEFAULTS.people, chatsPerWeek: DEFAULTS.chatsPerWeek, weeks: 50, hourly: 20, years: DEFAULTS.years });
  }
  assert.equal(timeCase(B, T, { chars: 7, people: 0 }).hoursPerYear, 0, 'nobody: no hours');
  assert.equal(timeCase(B, T, { chars: 7, chatsPerWeek: 0 }).ok, true);
  assert.equal(timeCase(B, T, { chars: 7, weeks: 0 }).ok, true);
  assert.equal(timeCase(B, T, { chars: 1 }).minutesPerBrief, 0.01);
  assert.equal(timeCase(B, T, { chars: 2 }).minutesPerBrief, 0.01);
  assert.equal(timeCase(B, T, { chars: 1000, people: 1, chatsPerWeek: 1, weeks: 1 }).hoursPerYear, 0.08);
  assert.equal(timeCase(B, T, { chars: 1000, people: 1, chatsPerWeek: 1, weeks: 1, hourly: 1 }).valuePerYear, 0.08);
});

test('every input is checked, at its edges', () => {
  const ok = (x) => timeCase(B, T, { chars: 100, ...x }).ok;
  assert.equal(ok({ chars: 0 }), false);
  assert.equal(ok({ chars: undefined }), false);
  assert.equal(ok({ chars: -5 }), false);
  assert.equal(ok({ chars: '100' }), false);
  assert.equal(ok({ people: -1 }), false);
  assert.equal(ok({ people: 'ten' }), false);
  assert.equal(ok({ chatsPerWeek: -1 }), false);
  assert.equal(ok({ chatsPerWeek: Infinity }), false);
  assert.equal(ok({ weeks: 52 }), true, 'every week of the year');
  assert.equal(ok({ weeks: 52.5 }), false);
  assert.equal(ok({ weeks: -1 }), false);
  assert.equal(ok({ hourly: -1 }), false);
  assert.equal(ok({ hourly: 'x' }), false);
  assert.equal(ok({ years: 1 }), true);
  assert.equal(ok({ years: 10 }), true);
  assert.equal(ok({ years: 0 }), false);
  assert.equal(ok({ years: 11 }), false);
  assert.equal(ok({ years: 2.5 }), false);
  assert.equal(ok({ people: 1e308, chatsPerWeek: 1e308 }), false, 'too large to count');
  assert.match(timeCase(B, T, { chars: 100, people: 1e308, chatsPerWeek: 1e308 }).why, /too large/);
  assert.match(timeCase(B, T, { chars: 100, years: 0 }).why, /years/);
  assert.match(timeCase(B, T, { chars: 100, weeks: 60 }).why, /working weeks/);
  assert.match(timeCase(B, T, { chars: 100, hourly: -2 }).why, /hourly/);
  assert.match(timeCase(B, T, { chars: 100, people: -2 }).why, /people/);
  assert.match(timeCase(B, T, { chars: 100, chatsPerWeek: -2 }).why, /chats/);
  assert.match(timeCase(B, T, {}).why, /brief/);
  assert.match(timeCase(null, T, { chars: 100 }).why, /sourced basis/);
  assert.deepEqual(timeCase(B, T, null), { ok: false, why: 'the brief: its characters, more than none' });
  assert.deepEqual(timeCase(B, T, 'x'), { ok: false, why: 'the brief: its characters, more than none' });
  const toxic = { get chars() { throw new Error('x'); } };
  assert.deepEqual(timeCase(B, T, toxic), { ok: false, why: 'the inputs could not be read' });
});

test('each sourced figure moves the result (none is hard-coded)', () => {
  const base = timeCase(B, T, { chars: 1000 });
  assert.notEqual(timeCase(withB('wageMedianHourly', 21), T, { chars: 1000 }).valuePerYear, base.valuePerYear);
  assert.notEqual(timeCase(withB('cpi', 0.2), T, { chars: 1000 }).valueOver, base.valueOver);
  assert.notEqual(timeCase(B, withT('wordsPerMinute', 50), { chars: 1000 }).hoursPerYear, base.hoursPerYear);
  assert.notEqual(timeCase(B, withT('charsPerWord', 6), { chars: 1000 }).hoursPerYear, base.hoursPerYear);
  assert.notEqual(timeCase(B, withT('leaveWeeks', 3), { chars: 1000 }).inputs.weeks, base.inputs.weeks);
  assert.notEqual(timeCase(B, withT('weeksInYear', 53), { chars: 1000 }).inputs.weeks, base.inputs.weeks);
});

test('sourcesOf lists each figure with its source; the real bases carry every one', () => {
  assert.deepEqual(sourcesOf(B, T).map((s) => s.key), [...BASIS_KEYS, ...TYPING_KEYS]);
  assert.deepEqual(sourcesOf(B, T)[0], { key: 'wageMedianHourly', value: 20, what: 'w', source: 'https://example.com/w' });
  assert.deepEqual(sourcesOf(B, T)[5], { key: 'weeksInYear', value: 52, what: 'year', source: 'https://example.com/y' });
  assert.deepEqual(sourcesOf(null, T), []);
  assert.deepEqual(sourcesOf(B, {}), []);
  const basis = JSON.parse(readFileSync(join(ROOT, 'vendor', 'basis', 'basis.json'), 'utf8'));
  const typing = JSON.parse(readFileSync(join(ROOT, 'data', 'typing-basis.json'), 'utf8'));
  assert.ok(figures(basis, typing));
  for (const s of sourcesOf(basis, typing)) assert.match(s.source, /^https:\/\//, s.key);
  assert.equal(timeCase(basis, typing, { chars: 100 }).ok, true);
});
