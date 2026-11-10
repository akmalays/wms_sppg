// Tanggal kalender lokal (WIB di perangkat petugas) dalam format YYYY-MM-DD.
// toISOString() memakai UTC, sehingga sebelum jam 07.00 WIB tanggalnya mundur sehari.
export function localDateIso(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MONTHS_ID = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];

// Tanggal dari teks seperti "Rabu, 14 Oktober 2026"; null bila teksnya tidak memuat tanggal.
export function parseIndonesianDate(text: string): Date | null {
  const match = text.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!match) return null;
  const month = MONTHS_ID.indexOf(match[2]);
  if (month < 0) return null;
  return new Date(Number(match[3]), month, Number(match[1]));
}

// Stempel waktu lokal "YYYY-MM-DD HH:mm", format timestamp transaksi dan audit log.
export function localTimestamp(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${localDateIso(date)} ${h}:${min}`;
}
