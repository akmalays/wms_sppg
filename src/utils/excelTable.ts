import * as XLSX from 'xlsx';
import { norm, formatDateId } from './excelCells';

// Membaca tabel dari file Excel untuk cetak massal. Baris judul kolom dicari otomatis; kolom dikenali dari
// judulnya lewat aturan per form, dan bisa ditimpa manual bila judul kolom di file berbeda.

export interface SheetGrid {
  name: string;
  grid: unknown[][];
}

export interface ColumnRule<F extends string> {
  key: F;
  label: string;
  required?: boolean;
  /** Bobot untuk memilih baris judul dan lembar terbaik. */
  weight?: number;
  test: (header: string) => boolean;
  /** Judul yang lebih tepat, mis. "Nominal" polos, menggantikan kolom yang sudah cocok lebih dulu. */
  prefer?: (header: string) => boolean;
}

export type ColumnMap<F extends string> = Partial<Record<F, number>>;
/** null = sengaja dikosongkan pengguna (kolom tidak dipakai). */
export type ColumnOverrides<F extends string> = Partial<Record<F, number | null>>;

export interface DetectedTable<F extends string> {
  headerRow: number;
  cols: ColumnMap<F>;
  score: number;
}

// Nilai sel apa adanya (angka, tanggal, teks) supaya tanggal Excel asli dan angka tidak bergantung format sel
export function readGrids(data: ArrayBuffer): SheetGrid[] {
  const wb = XLSX.read(data, { type: 'array', cellDates: true });
  return wb.SheetNames.map(name => ({
    name,
    grid: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '' }),
  }));
}

/** Teks sel: tanggal Excel jadi "12 Januari 2026", angka jadi teks tanpa pemisah. */
export function cellText(v: unknown): string {
  if (v instanceof Date) return formatDateId(v);
  if (typeof v === 'number') return String(v);
  return norm(v);
}

export function detectColumns<F extends string>(grid: unknown[][], rules: ColumnRule<F>[]): DetectedTable<F> {
  let best: DetectedTable<F> = { headerRow: -1, cols: {}, score: 0 };
  grid.slice(0, 15).forEach((row, r) => {
    const cols: ColumnMap<F> = {};
    row.forEach((cell, c) => {
      const h = cellText(cell).toLowerCase();
      if (!h) return;
      // Satu kolom hanya untuk satu isian: aturan pertama yang cocok dan belum terisi
      for (const rule of rules) {
        if (!rule.test(h)) continue;
        if (cols[rule.key] === undefined) {
          cols[rule.key] = c;
          return;
        }
        if (rule.prefer?.(h)) {
          cols[rule.key] = c;
          return;
        }
      }
    });
    const score = rules.reduce((sum, rule) => sum + (cols[rule.key] !== undefined ? rule.weight ?? 1 : 0), 0);
    if (score > best.score) best = { headerRow: r, cols, score };
  });
  if (best.headerRow >= 0) return best;
  // Tidak ada judul yang dikenali: anggap baris terisi paling banyak sebagai judul, kolom dipilih manual
  let fallback = 0;
  grid.slice(0, 15).forEach((row, r) => {
    if (row.filter(v => cellText(v)).length > (grid[fallback] || []).filter(v => cellText(v)).length) fallback = r;
  });
  return { headerRow: grid.length ? fallback : -1, cols: {}, score: 0 };
}

export function applyOverrides<F extends string>(cols: ColumnMap<F>, overrides: ColumnOverrides<F>): ColumnMap<F> {
  const merged: ColumnMap<F> = { ...cols };
  (Object.keys(overrides) as F[]).forEach(k => {
    const v = overrides[k];
    if (v === null) delete merged[k];
    else if (v !== undefined) merged[k] = v;
  });
  return merged;
}

export const columnLetter = (i: number): string => XLSX.utils.encode_col(i);

/** Pilihan kolom untuk dipetakan manual: "D · Nominal". */
export function headerOptions(grid: unknown[][], headerRow: number): { index: number; label: string }[] {
  const header = grid[headerRow] || [];
  const width = Math.max(header.length, ...grid.slice(headerRow + 1, headerRow + 20).map(r => r.length));
  return Array.from({ length: width }, (_, i) => {
    const text = cellText(header[i]);
    return { index: i, label: `${columnLetter(i)} · ${text || '(tanpa judul)'}` };
  });
}

/** Unduh file Excel kosong dengan judul kolom yang pasti dikenali, ditambah satu baris contoh. */
export function downloadTemplate(fileName: string, headers: string[], example: (string | number)[]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(14, h.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, fileName);
}
