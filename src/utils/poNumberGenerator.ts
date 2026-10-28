/**
 * Generator dan Formatter Nomor Nota Pesanan (PO) SPPG
 * Format standar resmi Badan Gizi Nasional:
 * NO. NP/SPPG/{nomor}/{bulan_romawi}/{tahun}
 * Contoh: NO. NP/SPPG/168/X/2026
 * Satu nomor per tanggal nota (lihat PO_NUMBER_ANCHOR).
 */

export const ROMAN_MONTHS: readonly string[] = [
  'I',    // Januari (1)
  'II',   // Februari (2)
  'III',  // Maret (3)
  'IV',   // April (4)
  'V',    // Mei (5)
  'VI',   // Juni (6)
  'VII',  // Juli (7)
  'VIII', // Agustus (8)
  'IX',   // September (9)
  'X',    // Oktober (10)
  'XI',   // November (11)
  'XII',  // Desember (12)
];

/**
 * Mengubah angka bulan (1-12) atau objek Date / ISO string tanggal menjadi angka romawi.
 * Contoh: 9 -> 'IX', 10 -> 'X'
 */
export function getRomanMonth(dateOrMonth: number | Date | string = new Date()): string {
  let monthIndex = 0; // 0-based
  if (typeof dateOrMonth === 'number') {
    monthIndex = Math.max(0, Math.min(11, Math.floor(dateOrMonth) - 1));
  } else {
    const d = typeof dateOrMonth === 'string' ? new Date(dateOrMonth) : dateOrMonth;
    monthIndex = isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth();
  }
  return ROMAN_MONTHS[monthIndex] || 'IX';
}

/**
 * Mengambil tahun 4 digit dari Date atau string tanggal
 */
export function getYearFromDate(dateOrYear?: number | Date | string): number {
  if (!dateOrYear) return new Date().getFullYear();
  if (typeof dateOrYear === 'number') return dateOrYear;
  const d = typeof dateOrYear === 'string' ? new Date(dateOrYear) : dateOrYear;
  return isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
}

/**
 * Format string nomor PO lengkap sesuai format resmi BGN:
 * NO. NP/SPPG/{seqNumber}/{romanMonth}/{year}
 */
export function formatPoNumber(
  seqNumber: number,
  romanMonth: string,
  year: number | string,
  includePrefix: boolean = true
): string {
  const prefix = includePrefix ? 'NO. ' : '';
  return `${prefix}NP/SPPG/${seqNumber}/${romanMonth}/${year}`;
}

/**
 * Ekstrak sequence number numerik dari string nomor PO.
 * Contoh: "NO. NP/SPPG/144/IX/2026" -> 144
 *         "NP/SPPG/134/IX/2026" -> 134
 */
export function extractPoSequenceNumber(poNumber?: string): number | null {
  if (!poNumber) return null;
  const match = poNumber.match(/(?:NP\/SPPG\/)(\d+)/i);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return null;
}

/**
 * Satu nomor untuk semua nota di tanggal yang sama. Patokan: 28 Oktober 2026 = 168.
 * Nomor naik/turun satu per tanggal yang punya nota; tanggal tanpa nota dilewati.
 */
export const PO_NUMBER_ANCHOR = { date: '2026-10-28', seq: 168 } as const;

const isoDay = (date?: Date | string): string => {
  if (!date) return localIsoDay(new Date());
  if (typeof date === 'string') return /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 10) : localIsoDay(new Date(date));
  return localIsoDay(date);
};

const localIsoDay = (d: Date): string =>
  isNaN(d.getTime()) ? localIsoDay(new Date()) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Nomor urut untuk tanggal itu, dihitung dari daftar tanggal yang punya nota. */
export function poSequenceForDate(date: Date | string, notaDates: Iterable<string>): number {
  const day = isoDay(date);
  const days = [...new Set([...Array.from(notaDates, d => isoDay(d)), day, PO_NUMBER_ANCHOR.date])].sort();
  return PO_NUMBER_ANCHOR.seq + days.indexOf(day) - days.indexOf(PO_NUMBER_ANCHOR.date);
}

/** Nomor nota lengkap untuk tanggal itu, mis. NO. NP/SPPG/168/X/2026. */
export function poNumberForDate(date: Date | string, notaDates: Iterable<string>): string {
  const day = isoDay(date);
  const [year, month] = day.split('-').map(Number);
  return formatPoNumber(poSequenceForDate(day, notaDates), getRomanMonth(month), year, true);
}

/** Nomor untuk nota baru di targetDate; nota yang sudah ada di tanggal itu memakai nomor yang sama. */
export function generateNextPoNumber(
  existingOrders: { date?: string }[] = [],
  targetDate?: Date | string
): string {
  return poNumberForDate(targetDate || new Date(), existingOrders.map(o => o.date || '').filter(Boolean));
}
