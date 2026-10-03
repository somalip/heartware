// Network-first service worker with Web Push & Dosing Notification support
const CACHE = 'heartware-v4';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(['/', '/manifest.json', '/logo.png', '/apple-touch-icon.png'])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/')))
  );
});

// Handle incoming messages from the client app (e.g. dosing alarms)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    event.waitUntil(
      self.registration.showNotification(title, {
        icon: '/logo.png',
        badge: '/favicon.png',
        ...options,
      })
    );
  }
});

// Handle Web Push events (sent from server / push service)
self.addEventListener('push', (event) => {
  let data = { title: 'Heartware Medication Reminder', body: 'Time for your scheduled dose.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'Heartware', body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo.png',
      badge: '/favicon.png',
      tag: data.tag || 'heartware-dose',
      renotify: true,
      data: data.url || '/',
      ...data.options,
    })
  );
});

// Handle notification tap / click to focus or launch the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
