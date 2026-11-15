let enabled = false;

/** Dikirim ke window saat versi baru aplikasi sudah terpasang dan menunggu halaman dimuat ulang. */
export const PWA_UPDATED_EVENT = 'sppg_pwa_updated';

// Dipanggil hanya di route dashboard: pengunjung /absen, /nilai, dan landing tidak perlu mengunduh app shell gudang.
export const enablePwa = () => {
  if (enabled || !import.meta.env.PROD) return;
  enabled = true;

  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = '/manifest.webmanifest';
  document.head.append(manifest);

  if (!('serviceWorker' in navigator)) return;

  // Worker baru langsung mengambil alih (skipWaiting), tetapi halaman yang terbuka masih memakai berkas lama.
  // Halaman tidak dimuat ulang otomatis supaya isian yang sedang diketik tidak hilang; pengguna yang memilih kapan.
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) window.dispatchEvent(new Event(PWA_UPDATED_EVENT));
  });

  navigator.serviceWorker
    .register('/sw.js')
    .then(registration => {
      // Aplikasi terpasang jarang dimuat ulang penuh, jadi versi baru dicek setiap kali aplikasi dibuka kembali
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => undefined);
      });
    })
    .catch(err => console.warn('Service worker gagal didaftarkan', err));
};
