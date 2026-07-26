// TrasaPro — Service Worker
// Cachuje tylko "powłokę" apki (HTML/manifest/ikony), żeby po utracie zasięgu
// apka się nie wywalała na biały ekran. NIE cachuje danych z Firestore/OCR/API —
// te zawsze idą do sieci, żeby trasa zawsze była aktualna gdy jest zasięg.

const CACHE_NAME = 'trasapro-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Tylko GET, tylko żądania nawigacji (otwarcie strony) oraz pliki z SHELL_FILES.
  // Wszystko inne (Firestore, Google API, Leaflet z CDN, OCR) idzie normalnie do sieci —
  // nie chcemy podsuwać nieaktualnych danych trasy ani blokować synchronizacji.
  if(req.method !== 'GET') return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isShellFile = isSameOrigin && SHELL_FILES.some(f => url.pathname.endsWith(f.replace('./', '')) || (f === './' && url.pathname === self.registration.scope.replace(self.location.origin, '')));

  if(req.mode === 'navigate' || isShellFile){
    event.respondWith(
      fetch(req)
        .then(res => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
    );
  }
});
