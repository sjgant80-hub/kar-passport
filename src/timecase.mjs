// ════════════════════════════════════════════════════════════════
// src/timecase.mjs — the time case on Kar's passport page (claims-timecase.json): what re-briefing a fresh AI by hand
// costs a team, in hours and in staff cost, against pasting a passport instead.
//
//   briefOf(stateToken)              → { ok, lines, chars }: the lines of memory a STATE-tier passport carries (its list
//                                      items, without the two-character list mark, and its vocabulary lines), taken from
//                                      the text before its seal and counted in characters (code points)
//   figures(basis, typing)           → the six sourced numbers the case reads, or null when one is missing or unreadable
//   timeCase(basis, typing, input)   → { ok, inputs, minutesPerBrief, hoursPerYear, valuePerYear, valueOver, ownHourly }
//   over(perYear, cpi, years)        → a yearly figure carried over `years`, rising by CPI each year after the first
//   sourcesOf(basis, typing)         → where each figure came from, for the page to list beside the numbers
//
// Every external figure is read from a sourced basis: the estate's (vendor/basis/basis.json, byte for byte: the UK median
// hourly wage and CPI) and data/typing-basis.json (the typing speed and the five-character word it is counted in; the
// statutory leave and the weeks in a year it is set against). The people, the chats, the weeks, the hourly cost and the
// years are the reader's own. Floors, never top ends: a transcription speed (writing a brief from scratch is slower),
// the median wage with on-costs left out, and only the lines of memory the smallest tier that carries state holds.
// Pure, total, deterministic: garbage in gives { ok: false, why }, never a throw.
// Powered by the Konomi architecture, created by Thomas Frumkin.
// ════════════════════════════════════════════════════════════════

export const DEFAULTS = Object.freeze({ people: 10, chatsPerWeek: 10, years: 3 });
export const BASIS_KEYS = Object.freeze(['wageMedianHourly', 'cpi']);
export const TYPING_KEYS = Object.freeze(['wordsPerMinute', 'charsPerWord', 'leaveWeeks', 'weeksInYear']);

const SIG = '\n§SIG·BEGIN';
const isNum = (x) => typeof x === 'number' && Number.isFinite(x) && x >= 0;
const r2 = (x) => Math.round(x * 100) / 100;
const given = (x) => x !== undefined && x !== null && x !== '';

export function briefOf(text) {
  if (typeof text !== 'string') return { ok: false, why: 'a STATE-tier passport, as text', lines: 0, chars: 0 };
  const at = text.lastIndexOf(SIG);
  const body = at < 0 ? text : text.slice(0, at);
  let lines = 0, chars = 0;
  for (const line of body.split('\n')) {
    const item = line.startsWith('- ') ? line.slice(2) : line.includes(' :: ') ? line : '';
    if (item === '') continue;
    lines++;
    chars += [...item].length;
  }
  return lines ? { ok: true, lines, chars } : { ok: false, why: 'no list items or vocabulary lines before the seal', lines, chars };
}

export function figures(basis, typing) {
  try {
    const f = {
      wage: basis.wageMedianHourly.value, cpi: basis.cpi.value,
      wpm: typing.wordsPerMinute.value, perWord: typing.charsPerWord.value, leave: typing.leaveWeeks.value, year: typing.weeksInYear.value,
    };
    if (!Object.values(f).every(isNum)) return null;
    if (!(f.wpm > 0) || !(f.perWord > 0) || f.leave > f.year) return null;
    return f;
  } catch { return null; }
}

export function over(perYear, cpi, years) {
  if (!isNum(perYear) || !isNum(cpi) || !Number.isInteger(years)) return 0;
  let total = 0, factor = 1;
  for (let y = 0; y < years; y++) { total += perYear * factor; factor *= 1 + cpi; }
  return r2(total);
}

export function sourcesOf(basis, typing) {
  try {
    return [
      ...BASIS_KEYS.map((k) => ({ key: k, value: basis[k].value, what: basis[k].what, source: basis[k].source })),
      ...TYPING_KEYS.map((k) => ({ key: k, value: typing[k].value, what: typing[k].what, source: typing[k].source })),
    ];
  } catch { return []; }
}

/** input (each optional but chars): chars (the brief, from briefOf), people, chatsPerWeek, weeks, hourly, years */
export function timeCase(basis, typing, input) {
  try {
    const f = figures(basis, typing);
    if (!f) return { ok: false, why: 'a sourced basis with every figure the case reads' };
    const own = input !== null && typeof input === 'object' ? input : {};
    const pick = (k, d) => (given(own[k]) ? own[k] : d);
    const i = {
      chars: own.chars, people: pick('people', DEFAULTS.people), chatsPerWeek: pick('chatsPerWeek', DEFAULTS.chatsPerWeek),
      weeks: pick('weeks', r2(f.year - f.leave)), hourly: pick('hourly', f.wage), years: pick('years', DEFAULTS.years),
    };
    if (!isNum(i.chars) || i.chars === 0) return { ok: false, why: 'the brief: its characters, more than none' };
    if (!isNum(i.people)) return { ok: false, why: 'people: a number, none or more' };
    if (!isNum(i.chatsPerWeek)) return { ok: false, why: 'new chats a week: a number, none or more' };
    if (!isNum(i.weeks) || i.weeks > f.year) return { ok: false, why: 'working weeks: none up to the weeks in a year' };
    if (!isNum(i.hourly)) return { ok: false, why: 'the hourly cost: a number, none or more' };
    if (!Number.isInteger(i.years) || i.years < 1 || i.years > 10) return { ok: false, why: 'years: a whole number from 1 to 10' };
    const minutes = i.chars / f.perWord / f.wpm;                                       // one re-brief, typed by hand
    const hours = i.people * i.chatsPerWeek * i.weeks * minutes / 60;                  // a year of them
    const value = hours * i.hourly;                                                    // at the reader's cost, or the median wage
    if (!isNum(value)) return { ok: false, why: 'too large to count' };
    return {
      ok: true, inputs: i, ownHourly: given(own.hourly), minutesPerBrief: r2(minutes), hoursPerYear: r2(hours),
      valuePerYear: r2(value), valueOver: over(value, f.cpi, i.years),
    };
  } catch { return { ok: false, why: 'the inputs could not be read' }; }
}

export default { DEFAULTS, BASIS_KEYS, TYPING_KEYS, briefOf, figures, over, sourcesOf, timeCase };
