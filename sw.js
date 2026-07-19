/* =========================================================
   SOFT SPACE · SERVICE WORKER
   Makes the app installable and available offline. Uses a
   stale-while-revalidate strategy for same-origin GETs: serve from cache
   instantly, then refresh the cache in the background. External CDN assets
   (fonts/icons) are left to the browser's HTTP cache.
   Bump CACHE when shipping changes so old assets are cleared.
   ========================================================= */

const CACHE = "softspace-v2";
const SHELL = [
  "./",
  "index.html", "auth.html", "planner.html", "journal.html", "studyhub.html",
  "habits.html", "goals.html", "finance.html", "settings.html",
  "manifest.webmanifest",
  "assets/css/style.css",
  "assets/js/core.js", "assets/js/db.js", "assets/js/ai.js", "assets/js/auth.js",
  "assets/js/music.js", "assets/js/reminders.js", "assets/js/layout.js", "assets/js/dashboard.js",
  "assets/js/planner.js", "assets/js/journal.js", "assets/js/studyhub.js",
  "assets/js/habits.js", "assets/js/goals.js", "assets/js/finance.js", "assets/js/settings.js",
  "assets/icons/icon-192.png", "assets/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  // Precache the app shell; don't fail install if one optional asset is missing.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // let CDN/API requests pass through

  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
        .catch(() => cached); // offline: fall back to whatever we have
      return cached || network;
    })
  );
});
