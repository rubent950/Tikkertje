// Naam van de cache
const CACHE_NAME = 'tikkertje-pwa-cache-v1';

// Bestanden die gecached moeten worden bij installatie
const urlsToCache = [
  '/',
  '/index.html',
  // Voeg hier andere statische assets toe die je wilt cachen,
  // zoals CSS, JS bundles, afbeeldingen, etc.
  // In een echte build-setup worden deze paden vaak dynamisch gegenereerd.
  // Bijvoorbeeld: '/static/js/bundle.js', '/static/css/main.css'
];

// Installatie van de Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('Failed to cache during install:', error);
      })
  );
});

// Activering van de Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Zorg ervoor dat de service worker onmiddellijk de controle over de pagina overneemt
  self.clients.claim();
});

// Fetch-gebeurtenis: Intercepteer netwerkverzoeken
self.addEventListener('fetch', (event) => {
  // Controleer of het verzoek een API-aanroep naar Firebase is
  const isFirebaseApi = event.request.url.includes('googleapis.com/google.firestore');
  const isAuthApi = event.request.url.includes('identitytoolkit.googleapis.com');

  if (isFirebaseApi || isAuthApi) {
    // Voor Firebase API-aanroepen: ga altijd naar het netwerk (Network First)
    // Dit zorgt ervoor dat de app altijd de meest recente gegevens van Firestore krijgt.
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          // Cache de respons voor offline gebruik, maar geef de netwerkrespons terug
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
          return response;
        })
        .catch((error) => {
          console.error('Network request failed for Firebase API:', error);
          // Optioneel: probeer uit de cache te halen bij netwerkfout, maar voor API's is dit vaak niet gewenst
          return caches.match(event.request);
        })
    );
  } else {
    // Voor alle andere verzoeken (statische assets, etc.): Cache First, dan Network
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          // Cache hit - geef de gecachete respons terug
          if (response) {
            return response;
          }
          // Geen cache hit - ga naar het netwerk
          return fetch(event.request).then(
            (response) => {
              // Controleer of we een geldige respons hebben ontvangen
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }

              // Clone de respons omdat deze een stream is en slechts één keer kan worden gelezen
              const responseToCache = response.clone();

              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });

              return response;
            }
          );
        })
        .catch((error) => {
          console.error('Fetch failed for:', event.request.url, error);
          // Optioneel: Geef een offline fallback pagina terug
          // return caches.match('/offline.html');
        })
    );
  }
});