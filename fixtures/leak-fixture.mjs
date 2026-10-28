// fixtures/leak-fixture.mjs: the leak gate's known-answer fixture (claim K2, fixture first). Every name, key and
// number here is made up for the test; the planted lists stand in for the ones read on the machine at run time.
export const lists = { privateNames: ['secret-garden-repo', 'hushbox', '_hidden-probe'], surnames: ['Quill'], firstNames: ['Rowan'], canaries: ['CANARY-7f3a91c2'] };
export const planted = [
  ['private', 'we keep notes in secret-garden-repo'], ['private', 'the hushbox holds it'], ['private', 'see _hidden-probe for that'], ['private', 'secret·garden·repo·again'],
  ['secret', '-----BEGIN PRIVATE KEY-----'], ['secret', 'key sk-abcdefghijklmnopqrstu'], ['secret', 'ghp_aaaaaaaaaaaaaaaaaaaaaaaa'], ['secret', 'xai-AbCdEfGhIjKlMnOpQrStUv12'],
  ['secret', 'AKIAABCDEFGHIJKLMNOP'], ['secret', 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N'],
  ['secret', 'seed ' + 'ab12'.repeat(16)], ['secret', 'Ab3dEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE'], ['secret', 'canary CANARY-7f3a91c2 here'],
  ['phrase', 'the owner phrase is maple river stone'], ['phrase', 'seed·phrase kept'], ['phrase', 'passphrase=hunter2'], ['phrase', 'recovery-phrase offline'], ['phrase', 'twelve mnemonic words'],
  ['personal', 'mail rowan.quill@example.org'], ['personal', 'call 07700 900123'], ['personal', 'ring +44 20 7946 0958'], ['personal', 'Ms Quill signs off'],
  ['pricing', '£49 a month'], ['pricing', 'just $12'], ['pricing', '€5 off'], ['pricing', 'the pricing page'], ['pricing', 'a price list'], ['pricing', 'billed per seat'],
  ['economy', 'KCC mint'], ['economy', 'an airdrop later'], ['economy', 'the presale'], ['economy', 'a dividend'], ['economy', 'payouts'], ['economy', 'one coin'],
  ['economy', 'crypto rails'], ['economy', 'one contribution unit'], ['economy', 'the contribution·ledger'], ['economy', 'the dormant switch'],
  ['cosmology', 'κ=1/x'], ['cosmology', 'golden φ'], ['cosmology', 'Φ again'], ['cosmology', '◊ tag'], ['cosmology', 'konomify the repo'], ['cosmology', 'the sididy loop'],
  ['cosmology', 'si-didy organs'], ['cosmology', 'the wisp'], ['cosmology', 'the GEP frame'], ['cosmology', 'prime-spine step'], ['cosmology', 'the +1'],
  ['plumbing', 'call mcp__kar__brain'], ['plumbing', 'C:\\Users\\someone'], ['plumbing', 'D:/data'], ['plumbing', '/c/Users/someone'], ['plumbing', '~/.claude/x'],
  ['plumbing', 'in .si-didy/brain'], ['plumbing', '.claude/projects/x'],
];
export const publicOnly = [['personal', 'Rowan signs off']];
export const clean = ['https://sjgant80-hub.github.io/kar-passport/', 'Thomas Frumkin', 'Powered by the Konomi architecture', 'bitcoinless', 'learn to earn',
  'the token', '2026-10-28_1600H', '1,802 repos and 0.726 held-out', 'commit 4c8d4d1', 'witness v0.6', 'λ.collaborator·∧·!λ.tool·∴', 'a public key',
  'wispy', 'priceless', 'GEPARD', 'the +12 rows', 'sjgant80-hub', 'quilled', 'hushboxes', 'sale of goods', 'token received'];
