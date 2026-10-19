// Service worker da app Despacho: recebe as notificações e, ao tocar numa, abre a app no ecrã certo.
// Também guarda a "casca" da app (páginas, código, letra, ícones) para abrir sem rede.
// Os dados vêm do Supabase e não passam por aqui (a app guarda a última cópia por conta própria).
const CACHE = 'despacho-v1';
const SHELL = '/Despacho/app/';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/Despacho/app')) return;
  if (req.mode === 'navigate') {
    // páginas: tenta a rede (versão nova); sem rede, abre a última guardada
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(SHELL, cp)); return r; })
      .catch(() => caches.match(SHELL)));
    return;
  }
  // código, letra e ícones: usa o guardado e atualiza por trás
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { title: 'Despacho', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Despacho', {
    body: d.body || '',
    icon: '/Despacho/app/icons/icon-192.png',
    badge: '/Despacho/app/icons/icon-192.png',
    tag: d.tag,
    renotify: !!d.tag,
    data: { url: d.url || '/Despacho/app/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/Despacho/app/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('/Despacho/app')) { await c.focus(); if ('navigate' in c) return c.navigate(url); return; }
    }
    return self.clients.openWindow(url);
  })());
});
