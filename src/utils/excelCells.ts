// Pembaca sel Excel untuk cetak massal dari file (kuitansi PIC dan kuitansi pengeluaran).
// File dibaca di browser; fungsi di sini hanya merapikan teks, angka rupiah, dan tanggal Indonesia.

export const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export const norm = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
export const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s(–-])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());

// Angka di Excel bisa berupa "Rp600,000", "600.000", atau angka biasa
export function parseAmount(raw: unknown): number {
  if (typeof raw === 'number') return Math.round(raw);
  const digits = norm(raw).replace(/,00$|\.00$/, '').replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

export function formatDateId(raw: unknown): string {
  if (raw instanceof Date && !isNaN(raw.getTime())) return `${raw.getDate()} ${MONTHS_ID[raw.getMonth()]} ${raw.getFullYear()}`;
  return titleCase(norm(raw));
}

export function monthIndexOf(text: string): number | null {
  const lower = text.toLowerCase();
  const idx = MONTHS_ID.findIndex(m => lower.includes(m.toLowerCase()));
  return idx >= 0 ? idx : null;
}
