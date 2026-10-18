import { SchoolBeneficiaryAllocation, User } from '../types/warehouse';
import { warehouseDb } from '../db/storage';

// Rekap harian jumlah penerima manfaat per sekolah. Disimpan terpisah dari menu agar angka harian
// tetap tercatat walau menu hari itu belum diinput, dan bisa ditarik lagi bertahun-tahun kemudian.
// Penyimpanan: tabel app_settings, satu baris per bulan (kunci beneficiary_recap_YYYY_MM) berisi
// rekap per tanggal. Ikut tersinkron ke semua perangkat lewat mekanisme app_settings.

export type SkipReason = 'LIBUR' | 'UJIAN' | 'KEGIATAN' | 'LAINNYA';

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  LIBUR: 'Libur',
  UJIAN: 'Ujian',
  KEGIATAN: 'Kegiatan sekolah',
  LAINNYA: 'Lainnya',
};

export interface BeneficiaryRecapEntry {
  schoolId: string;
  schoolName: string;
  category: string;
  /** Porsi yang dikirim hari itu; 0 bila tidak dikirim. */
  count: number;
  /** Diisi bila sekolah tidak dikirim hari itu. */
  skipReason?: SkipReason;
  /** Porsi biasanya, disimpan saat tidak dikirim agar hari berikutnya tidak perlu diketik ulang. */
  usualCount?: number;
}

export interface DailyBeneficiaryRecap {
  date: string; // YYYY-MM-DD
  entries: BeneficiaryRecapEntry[];
  total: number;
  /** TOTAL yang tertulis di laporan asli (bila ditempel), untuk dicocokkan dengan jumlah per sekolah. */
  reportedTotal?: number;
  updatedBy?: string;
  updatedAt: string;
}

type MonthRecaps = Record<string, DailyBeneficiaryRecap>;

const monthKey = (date: string) => `beneficiary_recap_${date.slice(0, 4)}_${date.slice(5, 7)}`;

export function getBeneficiaryRecap(date: string): DailyBeneficiaryRecap | undefined {
  return warehouseDb.getAppSetting<MonthRecaps>(monthKey(date), {})[date];
}

export function saveBeneficiaryRecap(
  date: string,
  entries: BeneficiaryRecapEntry[],
  user?: User,
  reportedTotal?: number
): DailyBeneficiaryRecap {
  const recap: DailyBeneficiaryRecap = {
    date,
    entries,
    total: entries.reduce((sum, e) => sum + (Number(e.count) || 0), 0),
    reportedTotal,
    updatedBy: user?.name,
    updatedAt: new Date().toISOString(),
  };
  const key = monthKey(date);
  const month = warehouseDb.getAppSetting<MonthRecaps>(key, {});
  warehouseDb.saveAppSetting(key, { ...month, [date]: recap }, user);
  return recap;
}

/** Rekap terakhir sebelum tanggal ini (maks. 60 hari ke belakang), sebagai angka awal hari baru. */
export function getLastBeneficiaryRecapBefore(date: string): DailyBeneficiaryRecap | undefined {
  const [y, m, d] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d - 60);
  const startIso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  const prev = new Date(y, m - 1, d - 1);
  const prevIso = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
  const list = getBeneficiaryRecapsInRange(startIso, prevIso);
  return list[list.length - 1];
}

/** Semua rekap dalam rentang tanggal (inklusif), urut tanggal. */
export function getBeneficiaryRecapsInRange(start: string, end: string): DailyBeneficiaryRecap[] {
  if (!start || !end || start > end) return [];
  const result: DailyBeneficiaryRecap[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  const endY = Number(end.slice(0, 4));
  const endM = Number(end.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    const month = warehouseDb.getAppSetting<MonthRecaps>(`beneficiary_recap_${y}_${String(m).padStart(2, '0')}`, {});
    Object.values(month).forEach(r => {
      if (r.date >= start && r.date <= end) result.push(r);
    });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/** Tanggal yang punya rekap tersimpan (untuk daftar periode "semua"). */
export function getAllBeneficiaryRecapDates(): string[] {
  // app_settings tidak bisa didaftar per awalan, jadi telusuri dari 2025 sampai tahun depan.
  const now = new Date();
  return getBeneficiaryRecapsInRange('2025-01-01', `${now.getFullYear() + 1}-12-31`).map(r => r.date);
}

// ---------------------------------------------------------------------------
// Membaca teks rekap dari WhatsApp/Excel, contoh:
//   Penerima Manfaat
//    •   KB AISYIAH 17 :
//   - TK DWP MALANGSUKO : 70
//   - 3B
//   - Balita : 143
//   TOTAL: 2653
// ---------------------------------------------------------------------------

const normalizeName = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(t => (/^\d+$/.test(t) ? String(Number(t)) : t)) // "04" sama dengan "4"
    .join(' ');

export interface ParsedRecapLine {
  line: string;
  name: string;
  count: number; // kosong dianggap 0 (tidak ada pengiriman)
  schoolId?: string;
}

export interface ParsedRecap {
  matched: ParsedRecapLine[];
  unmatched: ParsedRecapLine[];
  reportedTotal?: number;
}

export function parseBeneficiaryRecapText(text: string, schools: SchoolBeneficiaryAllocation[]): ParsedRecap {
  const byName = new Map(schools.map(s => [normalizeName(s.schoolName), s]));
  const matched: ParsedRecapLine[] = [];
  const unmatched: ParsedRecapLine[] = [];
  let reportedTotal: number | undefined;

  text.split(/\r?\n/).forEach(raw => {
    const line = raw.replace(/^[\s•\-*·–]+/, '').trim();
    if (!line) return;
    const m = line.match(/^(.+?)\s*[:=]\s*([\d.,]*)\s*$/) || line.match(/^(.+?)\s+([\d.,]+)$/);
    if (!m) return; // judul seperti "Penerima Manfaat" atau "3B"
    const name = m[1].trim();
    const count = Number((m[2] || '').replace(/[.,]/g, '')) || 0;
    if (/^total\b/i.test(name)) {
      reportedTotal = count || undefined;
      return;
    }
    const key = normalizeName(name);
    let school = byName.get(key);
    if (!school) {
      // Cocokkan sebagian: nama di teks memuat nama master atau sebaliknya
      school = schools.find(s => {
        // Batas kata dijaga (diapit spasi) agar "TK DWP 1" tidak cocok dengan "TK DWP 12"
        const k = ` ${normalizeName(s.schoolName)} `;
        const q = ` ${key} `;
        return k.includes(q) || q.includes(k);
      });
    }
    const parsed: ParsedRecapLine = { line: raw.trim(), name, count, schoolId: school?.id };
    (school ? matched : unmatched).push(parsed);
  });

  return { matched, unmatched, reportedTotal };
}
