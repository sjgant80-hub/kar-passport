# Kar's passport

**Live: https://sjgant80-hub.github.io/kar-passport/**

Kar's memory holds the estate's context. The passport carries a slice of it to a fresh AI session (a new Kar, Grok,
a collaborator's AI, any model) as a pasteable [SYMB-FER](https://github.com/SYMBEYOND/SYMB-FER) v6.2 token. It is sealed
(SHA-256 and Ed25519) and verified before anything reads it. It comes in three slices (full, shareable, public), and a
leak gate keeps private things out of the two that leave. When a session hands back an updated token, the drift check
enforces the protocol's own rules, and the hand-over merges into memory through a reviewed plan that can be undone.
It reads Kar's own memory (`generate`) or a team's own notes folder in the layout Claude Code's memory uses (`notes`).

SYMB-FER is SYMBEYOND AI LLC's open protocol (MIT): *SYMB-FER, SYMBEYOND AI LLC, 2026.* The v3.0 shape matches
teslasolar's fork (teslasolar/SYMB-FER, forked before v6.0). Powered by the Konomi architecture, created by Thomas Frumkin.

## Proof

- `claims.json` was sealed in the first commit, before any code. `receipts/passport.json` holds the facts and verdicts.
  `node measure.mjs --check` re-derives them in CI on every push.
- The judges are SYMBEYOND's and teslasolar's own Python (`vendor/symbfer/`, pinned by SHA-256 to their commits;
  `tools/oracle.py` runs it unchanged).
- Mutation gate: witness v0.6 on every module of `src/`, on GitHub's runner on every push; nothing baselined.
- The page's time case has its own claims, `claims-timecase.json`, sealed before its code; `receipts/timecase.json`,
  re-derived in CI by `node tools/timecase-measure.mjs --check`.
- A team's own notes have theirs, `claims-notes.json`, sealed before their code: the page's own steps, run as written
  with the command line on a made-up team's notes (`fixtures/team-notes/`) in a fresh copy of the repository (N1), and
  the organ witness-clean (N2); `receipts/notes.json`, re-derived in CI by `node tools/notes-measure.mjs --check`.

## Layout

| | |
|---|---|
| `src/symbfer.mjs` | v6.2 and v3.0 readers (ports of the protocol's own Python), the tier writer, the seal's shape |
| `src/render.mjs` | v6.2 and v3.0 writers from the template's own lines, and their readers |
| `src/seal.mjs` | seal, verify, verify-before-parse |
| `src/leak.mjs` | the leak gate (eight classes) |
| `src/slice.mjs` | Kar's memory → the full, shareable or public content model |
| `src/drift.mjs` | the drift check and the ingest plan |
| `src/boot.mjs` | booting a cold model from a token, and judging it |
| `src/judge.mjs` | the sealed rules |
| `src/notes.mjs` | a team's own notes folder → the full, shareable or public content model (every value that leaves through the leak gate) |
| `src/timecase.mjs` | the page's time case: what re-typing a brief by hand costs a team, from sourced figures and the reader's own |
| `vendor/basis/basis.json` | the estate's sourced basis, byte for byte (pinned in `vendor/SOURCES.json`) |
| `data/typing-basis.json` | the typing speed, the word it is counted in, and the UK statutory leave, each with its source |
| `kar/` | the CLI and the I/O on Kar's machine (paths come from `~/.kar-passport/config.json`, never committed) |
| `tokens/` | Kar's public slice, in five shapes, sealed |
| `local/` | the records measured on Kar's machine (counts and hashes only), and the buyer walkthroughs |

## Use

`~/.kar-passport/config.json` names the notes folder: `{ "memory": "/path/to/notes", "about": { "name": "...", "org": "...",
"site": "..." }, "private": ["names that must never leave"] }` (only `memory` is required).

```
node kar/passport.mjs key > keys/kar.json       # once: your passport key, its public half pinned (the seed stays on the machine)
node kar/passport.mjs notes                     # a team's notes: every slice in every shape, sealed, into ~/.kar-passport/tokens/
node kar/passport.mjs generate                  # the same from Kar's own memory
node kar/passport.mjs verify <token>            # verify-before-parse against keys/kar.json
node kar/passport.mjs in <sent> <returned>      # drift check + ingest plan (nothing written)
node kar/passport.mjs apply <id>                # write the reviewed plan; node kar/passport.mjs undo <id> puts it back
```

Filled tokens holding private state are never committed or published. Only the public slice is in `tokens/`.
