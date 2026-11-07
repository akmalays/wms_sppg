import { invokeDraft } from './menuAiDraft';

// Permintaan ke Edge Function menu-ai-draft untuk fitur operasional. Semua hasilnya draf: tidak ada yang tersimpan
// tanpa diperiksa petugas, dan angka laporan tetap dihitung aplikasi.

export interface AiIngredientSuggestion {
  source: string;
  keep: boolean;
  name: string;
  category: string;
  reason: string;
}

export interface AiTrayResult {
  items: { text: string; found: boolean; x: number; y: number }[];
  seenFoods: string[];
}

export interface AiReceipt {
  supplierName: string;
  date: string;
  documentNo: string;
  items: { name: string; quantity: number; unit: string; unitPrice: number; lineTotal: number }[];
  grandTotal: number;
  unreadable: string[];
}

export interface AiInsights {
  summary: string;
  findings: { title: string; detail: string }[];
  suggestions: string[];
  caveats: string[];
}

export interface AiReport {
  title: string;
  sections: { heading: string; body: string }[];
}

export type AiDataset = 'belanja' | 'pesanan' | 'stok' | 'barang_keluar' | 'limbah' | 'menu';
export type AiMetric = 'total_nominal' | 'total_jumlah' | 'total_kg' | 'jumlah_catatan' | 'total_porsi';
export type AiGroupBy = 'none' | 'barang' | 'kategori' | 'supplier' | 'tanggal' | 'bulan';

export interface AiQuerySpec {
  answerable: boolean;
  reason: string;
  interpretation: string;
  dataset: AiDataset;
  metric: AiMetric;
  from: string;
  to: string;
  itemContains: string;
  categoryContains: string;
  supplierContains: string;
  lowStockOnly: boolean;
  groupBy: AiGroupBy;
  sort: 'tertinggi' | 'terendah' | 'terbaru';
  limit: number;
}

const isArr = (v: unknown) => Array.isArray(v);
const incomplete = () => new Error('Jawaban AI tidak lengkap, coba lagi.');

export async function requestIngredientTidy(menuTitle: string, names: string[]): Promise<AiIngredientSuggestion[]> {
  const data = await invokeDraft<{ items: AiIngredientSuggestion[] }>({ mode: 'ingredients', menuTitle, ingredients: names.map(name => ({ name })) });
  if (!isArr(data.items)) throw incomplete();
  return data.items;
}

export async function requestTrayLabels(image: { mimeType: string; data: string }, texts: string[]): Promise<AiTrayResult> {
  const data = await invokeDraft<AiTrayResult>({ mode: 'tray_labels', image, texts });
  if (!isArr(data.items) || !isArr(data.seenFoods)) throw incomplete();
  return data;
}

export async function requestReceipt(image: { mimeType: string; data: string }): Promise<AiReceipt> {
  const data = await invokeDraft<AiReceipt>({ mode: 'receipt', image });
  if (!isArr(data.items)) throw incomplete();
  return data;
}

export async function requestInsights(topic: 'limbah' | 'hedonik', periodLabel: string, stats: unknown): Promise<AiInsights> {
  const data = await invokeDraft<AiInsights>({ mode: 'insights', topic, periodLabel, stats });
  if (typeof data.summary !== 'string' || !isArr(data.findings)) throw incomplete();
  return data;
}

export async function requestQuerySpec(question: string, today: string): Promise<AiQuerySpec> {
  const data = await invokeDraft<AiQuerySpec>({ mode: 'query', question, today });
  if (typeof data.answerable !== 'boolean') throw incomplete();
  return data;
}

export async function requestReport(periodLabel: string, stats: unknown): Promise<AiReport> {
  const data = await invokeDraft<AiReport>({ mode: 'report', periodLabel, stats });
  if (!isArr(data.sections)) throw incomplete();
  return data;
}

/** Foto menjadi JPEG base64 untuk dikirim ke AI. Bagian transparan jadi putih, supaya potongan nampan tetap terbaca. */
export async function imageToAiPayload(source: string | Blob, maxDimension = 1400): Promise<{ mimeType: string; data: string; width: number; height: number }> {
  let bitmap: ImageBitmap;
  if (typeof source === 'string') {
    const res = await fetch(source);
    bitmap = await createImageBitmap(await res.blob());
  } else {
    bitmap = await createImageBitmap(source);
  }
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Browser tidak bisa memproses foto.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return { mimeType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1), width: bitmap.width, height: bitmap.height };
}

/** Terima "1.250.000", "12,5", "685"; kembalikan angkanya. */
function parseIdNumber(raw: string): number {
  const clean = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(raw) ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '.');
  return parseFloat(clean);
}

/**
 * Angka di teks AI yang tidak ada di data sumber, untuk diperiksa petugas sebelum dipakai. Bilangan kecil dilewati
 * karena biasanya hitungan biasa ("3 menu"), bukan angka laporan.
 */
export function findUnverifiedNumbers(text: string, stats: unknown): string[] {
  const known: number[] = [];
  const walk = (v: unknown) => {
    if (typeof v === 'number') known.push(v);
    else if (typeof v === 'string') (v.match(/\d[\d.,]*\d|\d/g) || []).forEach(m => known.push(parseIdNumber(m), parseFloat(m)));
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(stats);
  const matches = (n: number) => known.some(k => Math.abs(k - n) <= Math.max(0.05, Math.abs(k) * 0.005));
  const out = new Set<string>();
  (text.match(/\d[\d.,]*\d|\d/g) || []).forEach(raw => {
    const n = parseIdNumber(raw);
    if (!Number.isFinite(n) || (Number.isInteger(n) && n <= 10)) return;
    if (!matches(n)) out.add(raw);
  });
  return [...out];
}
