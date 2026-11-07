import { warehouseDb } from '../db/storage';
import { normalizeToStandardCategory } from './categoryStandards';
import type { AiDataset, AiGroupBy, AiMetric, AiQuerySpec } from './aiAssist';

// Mesin hitung untuk "Tanya data". AI hanya mengirim spesifikasi; angka dihitung di sini dari data yang sama dengan
// layar aplikasi. Isi data tidak pernah dikirim ke AI, dan data karyawan tidak termasuk sumbernya.

export interface QueryRow {
  date: string;
  item: string;
  category: string;
  supplier: string;
  qty: number;
  unit: string;
  nominal: number | null;
  kg: number | null;
  portions: number;
  low: boolean;
}

export interface QueryResultRow {
  label: string;
  value: number;
  unit: string;
}

export interface QueryResult {
  rows: QueryResultRow[];
  /** Jumlah semua baris sebelum dipotong limit, per satuan */
  totals: QueryResultRow[];
  format: 'rupiah' | 'angka';
  recordCount: number;
  /** Catatan yang tidak ikut dihitung, mis. tanpa harga atau satuan bukan berat */
  skippedCount: number;
  truncated: boolean;
  sourceLabel: string;
  metricLabel: string;
  periodLabel: string;
  filterLabels: string[];
}

export const DATASET_LABEL: Record<AiDataset, string> = {
  belanja: 'Pengeluaran (uang keluar tercatat)',
  pesanan: 'Nota pesanan ke supplier',
  stok: 'Stok gudang saat ini',
  barang_keluar: 'Pemakaian bahan oleh dapur',
  limbah: 'Rekap limbah',
  menu: 'Rencana menu',
};

const METRIC_LABEL: Record<AiMetric, string> = {
  total_nominal: 'Total nominal',
  total_jumlah: 'Total jumlah',
  total_kg: 'Total berat',
  jumlah_catatan: 'Jumlah catatan',
  total_porsi: 'Total porsi',
};

const METRICS_OF: Record<AiDataset, AiMetric[]> = {
  belanja: ['total_nominal', 'total_jumlah', 'jumlah_catatan'],
  pesanan: ['total_nominal', 'total_jumlah', 'jumlah_catatan'],
  stok: ['total_jumlah', 'jumlah_catatan'],
  barang_keluar: ['total_jumlah', 'jumlah_catatan'],
  limbah: ['total_kg', 'jumlah_catatan'],
  menu: ['total_porsi', 'jumlah_catatan'],
};

const parseQty = (qty: string | number | undefined): number => {
  if (typeof qty === 'number') return qty;
  const match = String(qty ?? '').replace(',', '.').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05', jun: '06', jul: '07',
  agu: '08', ags: '08', aug: '08', sep: '09', okt: '10', oct: '10', nov: '11', des: '12', dec: '12',
};

// Tanggal lama di Pengeluaran bisa berbentuk "20 sept 2026".
export function toIsoDate(raw: string | undefined): string {
  const clean = (raw || '').toLowerCase().trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
  const m = clean.match(/(\d{1,2})\s+([a-z]{3,})\s+(\d{4})/);
  const month = m && MONTHS[m[2].slice(0, 3)];
  return m && month ? `${m[3]}-${month}-${m[1].padStart(2, '0')}` : '';
}

export function wasteKg(unit: string | undefined, quantity: number): number | null {
  const u = (unit || '').toLowerCase();
  if (u === 'kg') return quantity;
  if (u === 'gram') return quantity / 1000;
  return null;
}

const empty = (): Omit<QueryRow, 'item'> => ({ date: '', category: '', supplier: '', qty: 0, unit: '', nominal: null, kg: null, portions: 0, low: false });

export function loadDataset(dataset: AiDataset): QueryRow[] {
  switch (dataset) {
    case 'belanja':
      // Aturan sama dengan layar Pengeluaran: uang keluar hanya catatan yang punya harga.
      return warehouseDb.getNonFoodExpenses().map(e => {
        const qty = parseQty(e.quantity);
        const total = e.totalCost && e.totalCost > 0 ? e.totalCost : e.unitPrice && e.unitPrice > 0 && qty > 0 ? e.unitPrice * qty : 0;
        return { ...empty(), date: toIsoDate(e.date), item: e.itemName, category: normalizeToStandardCategory(e.category, e.itemName), qty, unit: e.unit || '', nominal: total > 0 ? total : null };
      });
    case 'pesanan':
      return warehouseDb.getPurchaseOrders()
        .filter(po => po.status !== 'DRAFT')
        .flatMap(po => po.items.map(it => ({ ...empty(), date: toIsoDate(po.date), item: it.name, category: normalizeToStandardCategory(it.category, it.name), supplier: po.supplierName, qty: it.quantity, unit: it.unit, nominal: it.subtotal || null })));
    case 'stok':
      return warehouseDb.getItems()
        .filter(it => it.isActive)
        .map(it => ({ ...empty(), item: it.name, category: normalizeToStandardCategory(it.category, it.name), qty: it.currentStock, unit: it.baseUnit, low: it.currentStock <= it.minimumStock }));
    case 'barang_keluar':
      // Pemakaian tercatat negatif; koreksi positif dan mengurangi total, sama seperti Pengeluaran.
      return warehouseDb.getTransactions()
        .filter(tx => tx.transactionType === 'ISSUE_CONSUMPTION')
        .map(tx => ({ ...empty(), date: toIsoDate(tx.timestamp), item: tx.itemName, category: normalizeToStandardCategory(tx.category, tx.itemName), qty: -tx.quantity, unit: tx.unit }));
    case 'limbah':
      return warehouseDb.getWasteLogs().map(l => ({ ...empty(), date: toIsoDate(l.date), item: l.itemName || l.wasteCategory, category: l.wasteCategory, qty: l.quantity, unit: l.unit, kg: wasteKg(l.unit, l.quantity) }));
    case 'menu':
      return warehouseDb.getMenuOrders()
        .filter(o => o.status !== 'CANCELLED')
        .map(o => ({ ...empty(), date: toIsoDate(o.date), item: o.menuTitle, portions: o.targetPortions || 0 }));
  }
}

const has = (hay: string, needle: string) => !needle.trim() || hay.toLowerCase().includes(needle.trim().toLowerCase());

const groupLabel = (row: QueryRow, groupBy: AiGroupBy): string => {
  switch (groupBy) {
    case 'barang': return row.item || 'Tanpa nama';
    case 'kategori': return row.category || 'Tanpa kategori';
    case 'supplier': return row.supplier || 'Tanpa supplier';
    case 'tanggal': return row.date || 'Tanpa tanggal';
    case 'bulan': return row.date.slice(0, 7) || 'Tanpa tanggal';
    default: return 'Total';
  }
};

const validDate = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

/** Hitung spesifikasi dari AI. Melempar pesan yang bisa dibaca petugas bila spesifikasinya tidak masuk akal. */
export function runQuery(spec: AiQuerySpec, source?: QueryRow[]): QueryResult {
  if (!DATASET_LABEL[spec.dataset]) throw new Error('Sumber data dari AI tidak dikenal. Coba tulis ulang pertanyaannya.');
  if (!METRICS_OF[spec.dataset].includes(spec.metric)) throw new Error(`${METRIC_LABEL[spec.metric] || 'Metrik itu'} tidak tersedia untuk ${DATASET_LABEL[spec.dataset]}. Coba tulis ulang pertanyaannya.`);
  const groupBy: AiGroupBy = ['barang', 'kategori', 'supplier', 'tanggal', 'bulan'].includes(spec.groupBy) ? spec.groupBy : 'none';
  if (groupBy === 'supplier' && spec.dataset !== 'pesanan') throw new Error('Pengelompokan per supplier hanya tersedia untuk nota pesanan.');

  const from = spec.dataset === 'stok' ? '' : validDate(spec.from);
  const to = spec.dataset === 'stok' ? '' : validDate(spec.to);
  const filtered = (source ?? loadDataset(spec.dataset)).filter(r => {
    if (from && (!r.date || r.date < from)) return false;
    if (to && (!r.date || r.date > to)) return false;
    if (!has(r.item, spec.itemContains) || !has(r.category, spec.categoryContains) || !has(r.supplier, spec.supplierContains)) return false;
    if (spec.lowStockOnly && !r.low) return false;
    return true;
  });

  // Jumlah barang beda satuan tidak boleh dijumlah jadi satu angka, jadi satuan ikut jadi kunci kelompok.
  const valueOf = (r: QueryRow): { value: number; unit: string } | null => {
    switch (spec.metric) {
      case 'total_nominal': return r.nominal === null ? null : { value: r.nominal, unit: '' };
      case 'total_kg': return r.kg === null ? null : { value: r.kg, unit: 'kg' };
      case 'total_porsi': return { value: r.portions, unit: 'porsi' };
      case 'total_jumlah': return { value: r.qty, unit: (r.unit || '').trim() };
      default: return { value: 1, unit: 'catatan' };
    }
  };

  const groups = new Map<string, QueryResultRow & { lastDate: string }>();
  const totals = new Map<string, QueryResultRow>();
  let skipped = 0;
  filtered.forEach(r => {
    const v = valueOf(r);
    if (!v) {
      skipped += 1;
      return;
    }
    const label = groupLabel(r, groupBy);
    const unitKey = v.unit.toLowerCase();
    const key = `${label.toLowerCase()}|${unitKey}`;
    const g = groups.get(key) ?? { label, value: 0, unit: v.unit, lastDate: '' };
    g.value += v.value;
    if (r.date > g.lastDate) g.lastDate = r.date;
    groups.set(key, g);
    const t = totals.get(unitKey) ?? { label: 'Total', value: 0, unit: v.unit };
    t.value += v.value;
    totals.set(unitKey, t);
  });

  const all = [...groups.values()];
  if (spec.sort === 'terbaru' || groupBy === 'tanggal' || groupBy === 'bulan') {
    all.sort((a, b) => (spec.sort === 'terendah' ? a.value - b.value : spec.sort === 'tertinggi' ? b.value - a.value : b.lastDate.localeCompare(a.lastDate) || b.label.localeCompare(a.label)));
  } else {
    all.sort((a, b) => (spec.sort === 'terendah' ? a.value - b.value : b.value - a.value));
  }
  const limit = Math.min(30, Math.max(1, Math.round(spec.limit) || 10));

  const filterLabels: string[] = [];
  if (spec.itemContains?.trim()) filterLabels.push(`barang memuat "${spec.itemContains.trim()}"`);
  if (spec.categoryContains?.trim()) filterLabels.push(`kategori memuat "${spec.categoryContains.trim()}"`);
  if (spec.supplierContains?.trim()) filterLabels.push(`supplier memuat "${spec.supplierContains.trim()}"`);
  if (spec.lowStockOnly) filterLabels.push('stok di bawah batas minimum');

  return {
    rows: all.slice(0, limit).map(({ label, value, unit }) => ({ label, value, unit })),
    totals: [...totals.values()],
    format: spec.metric === 'total_nominal' ? 'rupiah' : 'angka',
    recordCount: filtered.length,
    skippedCount: skipped,
    truncated: all.length > limit,
    sourceLabel: DATASET_LABEL[spec.dataset],
    metricLabel: METRIC_LABEL[spec.metric],
    periodLabel: spec.dataset === 'stok' ? 'Saat ini' : from || to ? `${from || 'awal data'} s/d ${to || 'hari ini'}` : 'Semua tanggal',
    filterLabels,
  };
}

export const formatQueryValue = (row: { value: number; unit: string }, format: QueryResult['format']): string =>
  format === 'rupiah'
    ? `Rp ${Math.round(row.value).toLocaleString('id-ID')}`
    : `${row.value.toLocaleString('id-ID', { maximumFractionDigits: 2 })}${row.unit ? ` ${row.unit}` : ''}`;
