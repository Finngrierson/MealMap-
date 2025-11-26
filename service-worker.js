const CACHE_NAME = "mealmap-cache-v4";


const ASSETS_TO_CACHE = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "data/recipes.json"
  
  // "assets/icons/icon-192.png",
  // "assets/icons/icon-512.png"
];

// Install: pre-cache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// Fetch: cache-first for our assets
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only GET requests
  if (request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).catch(() => {
        
        return caches.match("index.html");
      });
    })
  );
});

