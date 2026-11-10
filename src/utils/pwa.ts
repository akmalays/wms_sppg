let enabled = false;

// Dipanggil hanya di route dashboard: pengunjung /absen, /nilai, dan landing tidak perlu mengunduh app shell gudang.
export const enablePwa = () => {
  if (enabled || !import.meta.env.PROD) return;
  enabled = true;

  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = '/manifest.webmanifest';
  document.head.append(manifest);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => console.warn('Service worker gagal didaftarkan', err));
  }
};
