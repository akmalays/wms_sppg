// Tanggal kalender lokal (WIB di perangkat petugas) dalam format YYYY-MM-DD.
// toISOString() memakai UTC, sehingga sebelum jam 07.00 WIB tanggalnya mundur sehari.
export function localDateIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Stempel waktu lokal "YYYY-MM-DD HH:mm", format timestamp transaksi dan audit log.
export function localTimestamp(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${localDateIso(date)} ${h}:${min}`;
}
