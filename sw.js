// sw.js: offline from the first visit. On install it caches every file the page needs (SHELL: the page, its modules and
// the records it reads; page.test.mjs fails if the page needs a file that is not here). Network first, so a new version
// is picked up; the cache answers when offline. Only this site's own files are ever handled or cached.
const CACHE = 'kar-passport-v2';
const SHELL = ['./', 'manifest.json', 'icon.svg', 'style.css', 'boot-note.js', 'page.mjs',
  'src/symbfer.mjs', 'src/render.mjs', 'src/template62.mjs', 'src/seal.mjs', 'src/leak.mjs', 'src/slice.mjs', 'src/drift.mjs', 'src/timecase.mjs', 'src/boot.mjs',
  'vendor/fall-kit-core/vendor/light/sha256.mjs', 'vendor/fall-kit-core/identity.mjs',
  'fixtures/synthetic-model.mjs', 'fixtures/drift-cases.mjs', 'fixtures/memory-fixture.mjs', 'fixtures/leak-fixture.mjs',
  'claims.json', 'keys/kar.json', 'receipts/passport.json', 'receipts/timecase.json', 'receipts/notes.json', 'receipts/trust.json',
  'vendor/basis/basis.json', 'data/typing-basis.json',
  'local/k1.json', 'local/b1.json', 'local/personas-answered.json', 'local/walk-2026-11-04.json', 'local/walk-2026-11-05.json', 'local/walk-2026-11-05b.json', 'local/walk-2026-11-06.json',
  'tokens/public.v6.2.txt', 'tokens/public.v3.0.txt', 'tokens/public.nano.txt', 'tokens/public.core.txt', 'tokens/public.state.txt'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const page = e.request.mode === 'navigate';
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((k) => k.put(page ? './' : e.request, c)); }
    return r;
  }).catch(() => caches.match(page ? './' : e.request, { ignoreSearch: true })));
});
