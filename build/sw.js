const APP_BASE_PATH = (() => {
  try {
    const scopePath = new URL(self.registration.scope).pathname;
    return scopePath.endsWith('/') ? scopePath.slice(0, -1) : scopePath;
  } catch {
    return '';
  }
})();

const withBase = (path) => `${APP_BASE_PATH}${path}`;

const APP_SHELL_CACHE = 'weather-app-shell-v3';
const STATIC_CACHE = 'weather-static-v3';
const API_CACHE = 'weather-api-v3';

const HOME_URL = withBase('/');
const INDEX_URL = withBase('/index.html');
const MANIFEST_URL = withBase('/manifest.json');
const FAVICON_URL = withBase('/favicon.ico');
const LOGO_192_URL = withBase('/logo192.png');
const LOGO_512_URL = withBase('/logo512.png');
const OFFLINE_URL = withBase('/offline.html');

const APP_SHELL_ASSETS = [
  HOME_URL,
  INDEX_URL,
  MANIFEST_URL,
  FAVICON_URL,
  LOGO_192_URL,
  LOGO_512_URL,
  OFFLINE_URL,
];

const cacheResponseIfOk = async (cacheName, request, response) => {
  if (!response || response.status !== 200) {
    return;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
};

const networkFirst = async (request, cacheName) => {
  try {
    const networkResponse = await fetch(request);
    await cacheResponseIfOk(cacheName, request, networkResponse);
    return networkResponse;
  } catch (networkError) {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw networkError;
  }
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (networkResponse) => {
      await cacheResponseIfOk(cacheName, request, networkResponse);
      return networkResponse;
    })
    .catch(() => null);

  return cachedResponse || networkPromise || Response.error();
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => ![APP_SHELL_CACHE, STATIC_CACHE, API_CACHE].includes(cacheName))
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  const isApiRequest =
    requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.startsWith(withBase('/api/'));

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          await cacheResponseIfOk(APP_SHELL_CACHE, INDEX_URL, networkResponse);
          return networkResponse;
        } catch (navigationError) {
          const cache = await caches.open(APP_SHELL_CACHE);
          return (
            (await cache.match(INDEX_URL)) ||
            (await cache.match(OFFLINE_URL)) ||
            Response.error()
          );
        }
      })()
    );
    return;
  }

  if (isApiRequest) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (
    requestUrl.origin === self.location.origin &&
    ['script', 'style', 'image', 'font'].includes(request.destination)
  ) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch (error) {
    payload = { title: 'Weather tomorrow', body: event.data.text() };
  }

  const title = payload.title || 'Weather tomorrow';
  const body = payload.body || 'A new weather notification is available.';
  const options = {
    body,
    icon: FAVICON_URL,
    badge: FAVICON_URL,
    tag: payload.tag || 'weather-push-alert',
    renotify: true,
    data: {
      url: HOME_URL,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || HOME_URL;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return Promise.resolve();
    })
  );
});