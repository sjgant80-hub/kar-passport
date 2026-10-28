// tools/fuzz.mjs: the seeded mutator behind claims P2 and P3. Same seed, same bytes, on any machine: each mutant is
// rebuilt from its base file and seed, so the corpus is never committed, only its expected verdicts and byte hashes.
const enc = new TextEncoder(), dec = new TextDecoder('utf-8');
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const BREAKS = ['\r', '\r\n', '\x0b', '\x0c', '\x1c', '\x85', ' ', '\x1f'];
const VERSIONS = [['v6.2', 'v6.20'], ['v6.2', 'v6.1'], ['v6.2', 'v6·2'], ['v3.0', 'v3.1'], ['SHA256:', 'SHA256: '], ['SHA256:', 'SHA256 :'], ['·BEGIN', '·Begin'], ['·END', '·END '], ['§', '']];
/** One mutant of base (Uint8Array): 1 to 3 edits chosen by the seed. */
export function mutate(base, seed) {
  const r = rng(seed), pick = (n) => Math.floor(r() * n);
  let bytes = base;
  const edits = 1 + pick(3);
  for (let e = 0; e < edits; e++) {
    const kind = pick(7);
    if (kind === 0) { const b = bytes.slice(); if (b.length) b[pick(b.length)] ^= 1; bytes = b; continue; }
    const lines = dec.decode(bytes).split('\n');
    const i = pick(lines.length), j = pick(lines.length);
    if (kind === 1) lines.splice(i, 1);
    else if (kind === 2) lines.splice(i, 0, lines[i]);
    else if (kind === 3) { const t = lines[i]; lines[i] = lines[j]; lines[j] = t; }
    else if (kind === 4) { const [a, b] = VERSIONS[pick(VERSIONS.length)]; const at = lines.findIndex((l, k) => k >= i && l.includes(a)); if (at >= 0) lines[at] = lines[at].replace(a, b); }
    else if (kind === 5) { const l = lines[i] || ''; const p = pick(l.length + 1); lines[i] = l.slice(0, p) + BREAKS[pick(BREAKS.length)] + l.slice(p); }
    else { const l = lines[i] || ''; lines[i] = pick(2) ? '  ' + l + ' \t' : l.toLowerCase(); }
    bytes = enc.encode(lines.join('\n'));
  }
  return bytes;
}
