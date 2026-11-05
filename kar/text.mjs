// kar/text.mjs: the command line's one piece of logic of its own: a file's bytes as text, whichever editor or shell
// wrote them, and JSON read with a plain reason when it cannot be.
//
//   textOf(bytes)   → the text: UTF-16 (little- or big-endian) when the bytes open with that byte-order mark, UTF-8
//                     otherwise, the mark itself dropped. Not bytes: ''.
//   jsonOf(text)    → { ok: true, value } or { ok: false, why } (JSON.parse's own reason)
//
// Why: Windows PowerShell's `>` writes a byte-order mark (UTF-16 in Windows PowerShell 5.1 as installed, UTF-8 with the
// mark when a profile sets UTF-8). Following the page's step `node kar/passport.mjs key > keys/kar.json` there, every
// verify then threw on JSON.parse (a cold read as a COO, 5 November 2026). The same reader serves config.json and the
// notes, which Windows editors may also write with a mark.
// Pure and total: never throws.
// Powered by the Konomi architecture, created by Thomas Frumkin.

export function textOf(bytes) {
  if (!(bytes instanceof Uint8Array)) return '';
  const enc = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le' : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : 'utf-8';
  return new TextDecoder(enc).decode(bytes);
}

export function jsonOf(text) {
  try { return { ok: true, value: JSON.parse(text) }; } catch (e) { return { ok: false, why: e.message }; }
}

export default { textOf, jsonOf };
