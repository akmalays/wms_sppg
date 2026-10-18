// Satuan berat & volume bisa dikonversi satu sama lain; satuan hitung (Pcs, Botol, Dus, ...) tidak bisa dipecah.

type Dimension = 'mass' | 'volume';

// Faktor ke satuan dasar dimensinya: Kg untuk berat, Liter untuk volume
const MEASURE_UNITS: Record<string, { dim: Dimension; factor: number }> = {
  kg: { dim: 'mass', factor: 1 },
  kilo: { dim: 'mass', factor: 1 },
  kilogram: { dim: 'mass', factor: 1 },
  g: { dim: 'mass', factor: 0.001 },
  gr: { dim: 'mass', factor: 0.001 },
  gram: { dim: 'mass', factor: 0.001 },
  ons: { dim: 'mass', factor: 0.1 },
  kuintal: { dim: 'mass', factor: 100 },
  ton: { dim: 'mass', factor: 1000 },
  l: { dim: 'volume', factor: 1 },
  lt: { dim: 'volume', factor: 1 },
  ltr: { dim: 'volume', factor: 1 },
  liter: { dim: 'volume', factor: 1 },
  litre: { dim: 'volume', factor: 1 },
  ml: { dim: 'volume', factor: 0.001 },
  mililiter: { dim: 'volume', factor: 0.001 },
};

const COUNT_UNITS = new Set([
  'pcs', 'pc', 'buah', 'biji', 'butir', 'ekor', 'botol', 'btl', 'dus', 'ktn', 'karton', 'box',
  'pack', 'pak', 'bks', 'bungkus', 'sachet', 'sak', 'karung', 'ikat', 'pouch', 'jerigen', 'roll',
  'rim', 'krat', 'bal', 'unit', 'set', 'kaleng', 'tray', 'papan', 'lembar', 'sisir', 'tandan',
  'layah', 'galon', 'tabung',
]);

export function unitKey(unit: string | undefined | null): string {
  return String(unit || '').trim().toLowerCase().replace(/\.$/, '');
}

/** Satuan yang dihitung per buah, jadi jumlahnya harus bilangan bulat. */
export function isCountableUnit(unit: string | undefined | null): boolean {
  return COUNT_UNITS.has(unitKey(unit));
}

/** Jumlah pesanan yang masuk akal untuk satuannya: satuan hitung dibulatkan, minimal 1. */
export function normalizeQtyForUnit(qty: number, unit: string | undefined | null): number {
  const n = Number(qty) || 0;
  if (n <= 0) return n;
  if (isCountableUnit(unit)) return Math.max(1, Math.round(n));
  return Math.round(n * 1000) / 1000;
}

/**
 * Konversi jumlah antar satuan (mis. 500 Gram -> 0.5 Kg). Satuan yang sama selalu bisa.
 * Mengembalikan null bila tidak bisa dikonversi (mis. Pcs -> Kg).
 */
export function convertQty(qty: number, fromUnit: string, toUnit: string): number | null {
  const from = unitKey(fromUnit);
  const to = unitKey(toUnit);
  if (from === to || (COUNT_UNITS.has(from) && COUNT_UNITS.has(to) && singularCount(from) === singularCount(to))) {
    return qty;
  }
  const a = MEASURE_UNITS[from];
  const b = MEASURE_UNITS[to];
  if (!a || !b || a.dim !== b.dim) return null;
  return Math.round(((qty * a.factor) / b.factor) * 1000) / 1000;
}

// pc/pcs, btl/botol, ktn/karton/dus dianggap satuan yang sama
function singularCount(u: string): string {
  if (u === 'pc' || u === 'pcs' || u === 'buah' || u === 'biji') return 'pcs';
  if (u === 'btl') return 'botol';
  if (u === 'ktn' || u === 'karton') return 'dus';
  if (u === 'pak') return 'pack';
  if (u === 'bungkus') return 'bks';
  return u;
}
