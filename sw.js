// 離線快取：主程式採「網路優先、離線用快取」，確保有網路時永遠拿到最新版
const CACHE = 'skincare-crm-v9';
const CORE = ['./', './index.html', './manifest.webmanifest', './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 頁面：網路優先，失敗時改用快取（離線也能開）
  // 銷售頁等其他頁面：直接走網路，不寫入 App 快取
  const isApp = url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname) && new URL('./', self.location).pathname === url.pathname.replace(/index\.html$/, '');
  if (req.mode === 'navigate' && !isApp) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, {cache:'no-store'})
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Google Fonts：先用快取、背景更新（離線時仍保留字體）
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open(CACHE).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
    return;
  }

  // 同網域的圖示與設定檔：快取優先
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
  }
});
