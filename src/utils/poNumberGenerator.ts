/**
 * Generator dan Formatter Nomor Nota Pesanan (PO) SPPG
 * Format standar resmi Badan Gizi Nasional:
 * NO. NP/SPPG/{nomor}/{bulan_romawi}/{tahun}
 * Contoh: NO. NP/SPPG/144/IX/2026
 * Start sequence default: 134
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

export const DEFAULT_PO_START_NUMBER = 134;

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
 * Generate nomor PO berikutnya secara otomatis berurutan dari 134 dst.
 * - Mengekstrak nomor urut tertinggi dari purchase orders yang sudah ada
 * - Jika belum ada atau tertinggi < 134, mulai dari 134
 * - Jika sudah ada, nomor berikutnya adalah (max + 1)
 * - Bulan otomatis dikonversi ke Romawi (contoh September = IX, Oktober = X)
 * - Tahun otomatis diambil 4 digit
 */
export function generateNextPoNumber(
  existingOrders: { poNumber?: string }[] = [],
  targetDate?: Date | string
): string {
  let maxSeq = 0;

  for (const order of existingOrders) {
    const seq = extractPoSequenceNumber(order.poNumber);
    if (seq !== null && seq > maxSeq) {
      maxSeq = seq;
    }
  }

  const nextSeq = maxSeq < DEFAULT_PO_START_NUMBER ? DEFAULT_PO_START_NUMBER : maxSeq + 1;
  const romanMonth = getRomanMonth(targetDate);
  const year = getYearFromDate(targetDate);

  return formatPoNumber(nextSeq, romanMonth, year, true);
}

/**
 * Sinkronisasi bulan Romawi dan tahun pada nomor PO saat tanggal nota diubah oleh pengguna.
 * Jika format nomor PO adalah standar NP/SPPG/{no}/{bulan}/{tahun}, bulan & tahun otomatis diperbarui.
 */
export function syncPoNumberWithDate(poNumber: string, newDate: Date | string): string {
  if (!poNumber) return poNumber;
  const match = poNumber.match(/^(\s*(?:NO\.\s*)?NP\/SPPG\/)(\d+)(?:\/([IVXLCDM]+))?(?:\/(\d{4}))?(\s*)$/i);
  if (!match) return poNumber;

  const prefix = match[1];
  const seqNum = match[2];
  const newRoman = getRomanMonth(newDate);
  const newYear = getYearFromDate(newDate);

  const cleanPrefix = prefix.toUpperCase().includes('NO.') ? 'NO. NP/SPPG/' : 'NO. NP/SPPG/';
  return `${cleanPrefix}${seqNum}/${newRoman}/${newYear}`;
}
