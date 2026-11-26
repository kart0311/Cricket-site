// Keeps the site working with a weak signal. The page itself is always fetched fresh when online
// (so the daily update shows up); photos and icons are kept after the first visit.
const V = 'crx-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
    const r = e.request; if (r.method !== 'GET') return;
    const u = new URL(r.url); if (u.origin !== location.origin) return;
    const keep = (res) => { if (res && res.ok) { const c = res.clone(); caches.open(V).then((x) => x.put(r, c)); } return res; };
    if (r.mode === 'navigate' || u.pathname.endsWith('/index.html')) {
        e.respondWith(fetch(r).then(keep).catch(() => caches.match(r).then((m) => m || caches.match('./'))));
    } else {
        e.respondWith(caches.match(r).then((m) => m || fetch(r).then(keep)));
    }
});
