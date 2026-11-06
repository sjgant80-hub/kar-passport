// kar/trust.mjs: the keys a clone's checks accept (claims-trust.json). Your own, pinned in keys/kar.json, and each
// colleague's you pinned with `node kar/passport.mjs trust <their key file> <name>`, kept as keys/trusted/<name>.json.
//
//   keyOf(text)          → { ok: true, id } or { ok: false, why }: the public key a key file pins, its "id" of 64
//                          lowercase hexadecimal characters (the JSON `node kar/passport.mjs key` prints)
//   nameOk(name)         → true for a name a colleague's key may be pinned under: a plain file name of letters, digits
//                          and . _ - (a letter or digit first), at most 64 characters, and not one Windows reserves
//   trustOf(own, others) → { ids, names, skipped }: the keys to accept, your own first, then each colleague's in the
//                          order given (others: [[name, text]]). A key given twice, a name that is not a plain file name
//                          and a file that is not a key file are left out, each with its reason in skipped. names maps
//                          each accepted key to 'you' or to the name it was pinned under.
//
// Why: a cold read of the served page as a COO (6 November 2026) followed the roll-out's handover between two people.
// The command line trusted one key, the receiver's own, so every passport a colleague sealed was refused.
// Pure and total: garbage in gives a reason, never a throw.
// Powered by the Konomi architecture, created by Thomas Frumkin.
import { jsonOf } from './text.mjs';

const HEX64 = /^[0-9a-f]{64}$/;
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const RESERVED = /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i;
const NOT_KEY = 'not a key file: it has no "id" of 64 lowercase hexadecimal characters';

export function keyOf(text) {
  const j = jsonOf(text);
  if (!j.ok) return { ok: false, why: 'not a key file: ' + j.why };
  const id = j.value?.id;
  return typeof id === 'string' && HEX64.test(id) ? { ok: true, id } : { ok: false, why: NOT_KEY };
}

export const nameOk = (name) => typeof name === 'string' && NAME.test(name) && !RESERVED.test(name);

export function trustOf(own, others) {
  const ids = [], names = {}, skipped = [];
  const add = (name, text) => {
    const k = keyOf(text);
    if (!k.ok) skipped.push({ name, why: k.why });
    else if (Object.hasOwn(names, k.id)) skipped.push({ name, why: 'the same key as ' + names[k.id] });
    else { ids.push(k.id); names[k.id] = name; }
  };
  try {
    add('you', own);
    for (const pair of Array.isArray(others) ? others : []) {
      const name = Array.isArray(pair) ? pair[0] : undefined;
      if (nameOk(name)) add(name, pair[1]);
      else skipped.push({ name: typeof name === 'string' ? name : typeof name, why: 'not a plain file name' });
    }
  } catch { skipped.push({ name: '', why: 'the pinned keys could not be read' }); }
  return { ids, names, skipped };
}

export default { keyOf, nameOk, trustOf };
