// Service worker da app Despacho: recebe as notificações e, ao tocar numa, abre a app no ecrã certo.
// Também guarda a "casca" da app (páginas, código, letra, ícones) para abrir sem rede.
// Os dados vêm do Supabase e não passam por aqui (a app guarda a última cópia por conta própria).
const CACHE = 'despacho-v5';
const SHELL = '/Despacho/app/';
// Ficheiros com o conteúdo no nome (o código em _expo/static, assets): nunca mudam, por isso, uma vez guardados,
// abrem do aparelho sem perguntar à rede (13/11/2026; antes voltavam a ser descarregados em cada abertura).
const FOREVER = /^\/Despacho\/app\/(_expo\/static\/|assets\/)/;
// Página: espera pela rede no máximo isto; depois abre a guardada (rede fraca não pode prender a app no arranque).
const NAV_WAIT_MS = 1200;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

// Tira do aparelho o código de versões antigas que a página nova já não cita (o que faltar volta da rede).
async function prune(c, html) {
  const keep = new Set(html.match(/\/Despacho\/app\/_expo\/static\/[^"']+/g) || []);
  if (keep.size < 3) return;
  for (const req of await c.keys()) {
    const path = new URL(req.url).pathname;
    if (path.startsWith('/Despacho/app/_expo/static/js/') && !keep.has(path)) await c.delete(req);
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith('/Despacho/app')) return;
  if (req.mode === 'navigate') {
    // página: a da rede se chegar depressa (versão nova); senão a guardada, e a da rede fica guardada para a próxima
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const net = fetch(req).then(async (r) => {
        if (r.ok) { const txt = await r.clone().text(); await c.put(SHELL, r.clone()); prune(c, txt).catch(() => {}); }
        return r;
      });
      const cached = await c.match(SHELL);
      if (!cached) return net.catch(() => Response.error());
      const slow = new Promise((res) => setTimeout(() => res(cached), NAV_WAIT_MS));
      e.waitUntil(net.catch(() => {}));
      return Promise.race([net.catch(() => cached), slow]);
    })());
    return;
  }
  if (FOREVER.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const r = await fetch(req);
      if (r.ok) c.put(req, r.clone());
      return r;
    }));
    return;
  }
  // letra, ícones, logótipos: usa o guardado e atualiza por trás
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
    // avisos de alarme ("Acorde!") ficam no ecrã até tocar e vibram; os restantes comportam-se como sempre
    requireInteraction: /^(nag-|lembrete-|wake1-)/.test(d.tag || ''),
    vibrate: /^nag-/.test(d.tag || '') ? [400, 150, 400, 150, 600] : [120],
    data: { url: d.url || '/Despacho/app/' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/Despacho/app/';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (c.url.includes('/Despacho/app')) {
        await c.focus();
        // a app aberta navega sozinha (sem recarregar); se não responder em 700 ms (versão antiga), recarrega no endereço
        const ok = await new Promise((res) => {
          const ch = new MessageChannel();
          ch.port1.onmessage = () => res(true);
          setTimeout(() => res(false), 700);
          c.postMessage({ type: 'open', url }, [ch.port2]);
        });
        if (!ok && 'navigate' in c) return c.navigate(url);
        return;
      }
    }
    return self.clients.openWindow(url);
  })());
});
