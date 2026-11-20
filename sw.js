/* Bus Trans Sarbagita © 2026 Yoga Purnama. All rights reserved. ID: sgt-yg-fd69d51a */
/* Service worker Bus Trans Sarbagita.
   Naikkan angka VERSION setiap kali file app diubah, supaya pengguna mendapat versi baru. */
var VERSION = "sarbagita-v199";
var CORE = [
  "./", "index.html", "peta.html", "manifest.webmanifest", "manifest-classic.webmanifest",
  "theme-config.js", "vice-city-theme.css",
  "image/neon-gta-vi-bus-bali-sunset.webp",
  "icons/Lightning%20Bolt%20Bus%20Icon.png",
  "icons/neon-vice-bus-marker.png",
  "icons/gta-vi-logo-transparent-v2.png",
  "icons/neon-icon-32.png", "icons/neon-icon-64.png", "icons/neon-apple-touch-icon.png",
  "icons/neon-icon-192.png", "icons/neon-icon-512.png", "icons/neon-icon-maskable-512.png",
  "icons/icon-32.png?v=2", "icons/icon-64.png?v=2", "icons/icon-192.png?v=2",
  "icons/icon-512.png?v=2", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png?v=2"
];
/* Leaflet disimpan sejak awal (kalau gagal, pemasangan tetap lanjut). */
var EXTRA = [
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css"
];
/* Pustaka dan font dari luar: disimpan saat pertama kali dipakai. */
var LIBS = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com", "res.cloudinary.com"];
/* Ubin peta: hanya ubin yang PERNAH DILIHAT pengguna yang disimpan (bukan unduh massal,
   sesuai aturan pemakaian tile OpenStreetMap). Disimpan terpisah agar tidak hilang saat update. */
var TILES = "sarbagita-tiles";
var TILE_HOSTS = ["tile.openstreetmap.org"];
var TILE_MAX = 600; /* kira-kira 6-10 MB */
var TIMEOUT = 4000; /* ms: jaringan lambat -> pakai simpanan */

/* Hosting seperti Cloudflare Pages mengalihkan peta.html -> /peta. Jawaban hasil pengalihan
   tidak boleh dipakai untuk membuka halaman, jadi dibungkus ulang sebelum disimpan. */
function clean(res) {
  if (!res || !res.redirected) return Promise.resolve(res);
  return res.blob().then(function (b) {
    return new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers });
  });
}

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return Promise.all(CORE.map(function (u) {
      return fetch(u, { cache: "reload" }).then(function (res) {
        if (!res.ok) throw new Error("Gagal mengambil " + u);
        return clean(res).then(function (r) { return c.put(u, r); });
      });
    })).then(function () {
      return Promise.all(EXTRA.map(function (u) { return c.add(u).catch(function () {}); }));
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== TILES; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function put(req, res) {
  if (res && (res.ok || res.type === "opaque")) {
    var copy = res.clone();
    clean(copy).then(function (r) { return caches.open(VERSION).then(function (c) { return c.put(req, r); }); }).catch(function () {});
  }
  return res;
}

/* Simpanan untuk permintaan ini; untuk halaman, jatuh ke peta.html atau index.html. */
function saved(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) {
    if (r || req.mode !== "navigate") return r;
    return caches.match(/peta/.test(new URL(req.url).pathname) ? "peta.html" : "index.html");
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request; if (req.method !== "GET") return;
  var url = new URL(req.url);
  /* Jangan simpan potongan video Cloudinary di cache app shell; media sering diminta dengan Range. */
  if (url.hostname === "res.cloudinary.com" && /\.(mp4|webm)$/i.test(url.pathname)) return;
  if (url.origin === location.origin) {
    /* File app: jaringan dulu supaya selalu terbaru; simpanan saat offline atau jaringan lambat. */
    e.respondWith(new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        saved(req).then(function (r) { if (r && !done) { done = true; resolve(r); } });
      }, TIMEOUT);
      fetch(req).then(function (res) {
        clearTimeout(timer); put(req, res);
        if (!done) { done = true; resolve(res); }
      }, function () {
        clearTimeout(timer); if (done) return;
        saved(req).then(function (r) { done = true; if (r) resolve(r); else reject(new TypeError("offline")); });
      });
    }));
  } else if (LIBS.indexOf(url.hostname) >= 0) {
    /* Leaflet dan font: pakai simpanan dulu. */
    e.respondWith(caches.match(req, { ignoreVary: true }).then(function (r) { return r || fetch(req).then(function (res) { return put(req, res); }); }));
  }
  else if (TILE_HOSTS.indexOf(url.hostname) >= 0) {
    /* Ubin peta: jaringan dulu (selalu terbaru), simpanan dipakai saat offline/lambat. */
    e.respondWith(new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        caches.match(req, { cacheName: TILES }).then(function (r) { if (r && !done) { done = true; resolve(r); } });
      }, TIMEOUT);
      fetch(req).then(function (res) {
        clearTimeout(timer);
        if (res && res.ok) { /* hanya respons CORS; respons "opaque" memakan kuota besar */
          var copy = res.clone();
          caches.open(TILES).then(function (c) { return c.put(req, copy).then(function () { return trim(c); }); }).catch(function () {});
        }
        if (!done) { done = true; resolve(res); }
      }, function () {
        clearTimeout(timer); if (done) return;
        caches.match(req, { cacheName: TILES }).then(function (r) { done = true; if (r) resolve(r); else reject(new TypeError("offline")); });
      });
    }));
  }
});

/* Batasi jumlah ubin: yang paling lama disimpan dibuang lebih dulu. */
var trimming = false;
function trim(c) {
  if (trimming) return Promise.resolve();
  trimming = true;
  return c.keys().then(function (k) {
    var extra = k.length - TILE_MAX;
    return Promise.all(k.slice(0, Math.max(0, extra)).map(function (r) { return c.delete(r); }));
  }).then(function () { trimming = false; }, function () { trimming = false; });
}
