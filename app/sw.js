// Service worker da app Despacho: recebe as notificações e, ao tocar numa, abre a app no ecrã certo.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

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
