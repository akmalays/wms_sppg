// Tanggal kalender lokal (WIB di perangkat petugas) dalam format YYYY-MM-DD.
// toISOString() memakai UTC, sehingga sebelum jam 07.00 WIB tanggalnya mundur sehari.
export function localDateIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
