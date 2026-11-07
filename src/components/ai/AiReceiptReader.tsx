import React, { useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { BTN_SECONDARY, FOCUS_RING } from '../common/FormDialog';
import { compressImageToWebP, uploadDocumentationPhoto } from '../../utils/imageCompressor';
import { imageToAiPayload, requestReceipt, type AiReceipt } from '../../utils/aiAssist';
import type { ItemMaster, ReceivingLine, Supplier } from '../../types/warehouse';

export type DraftLine = Omit<ReceivingLine, 'id'>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// Cocokkan nama di nota ke data barang. Lebih dari satu kandidat berarti tidak yakin: petugas yang memilih.
export function matchByName<T extends { name: string }>(raw: string, list: T[]): T | null {
  const q = norm(raw);
  if (!q) return null;
  const exact = list.filter(x => norm(x.name) === q);
  if (exact.length === 1) return exact[0];
  const partial = list.filter(x => {
    const n = norm(x.name);
    return n && (n.includes(q) || q.includes(n));
  });
  return partial.length === 1 ? partial[0] : null;
}

const WEIGHT: Record<string, { base: string; factor: number }> = {
  kg: { base: 'kg', factor: 1 }, kilo: { base: 'kg', factor: 1 }, kilogram: { base: 'kg', factor: 1 },
  g: { base: 'kg', factor: 0.001 }, gr: { base: 'kg', factor: 0.001 }, gram: { base: 'kg', factor: 0.001 },
  l: { base: 'l', factor: 1 }, lt: { base: 'l', factor: 1 }, ltr: { base: 'l', factor: 1 }, liter: { base: 'l', factor: 1 },
  ml: { base: 'l', factor: 0.001 },
};

/** Jumlah dan harga per satuan nota, diubah ke satuan barang. Null bila satuannya tidak bisa disamakan. */
export function convertToItemUnit(quantity: number, unitPrice: number, fromUnit: string, toUnit: string): { quantity: number; unitPrice: number } | null {
  const from = norm(fromUnit);
  const to = norm(toUnit);
  if (from === to) return { quantity, unitPrice };
  const a = WEIGHT[from];
  const b = WEIGHT[to];
  if (!a || !b || a.base !== b.base) return null;
  const ratio = a.factor / b.factor;
  return { quantity: Number((quantity * ratio).toFixed(3)), unitPrice: unitPrice > 0 ? Math.round(unitPrice / ratio) : 0 };
}

export function receiptToLines(receipt: AiReceipt, items: ItemMaster[]): { lines: DraftLine[]; unmatched: number; unitIssues: number } {
  let unmatched = 0;
  let unitIssues = 0;
  const lines = receipt.items.map((row): DraftLine => {
    const unitPrice = row.unitPrice > 0 ? row.unitPrice : row.quantity > 0 && row.lineTotal > 0 ? Math.round(row.lineTotal / row.quantity) : 0;
    const asWritten = `Di nota: ${row.name} ${row.quantity} ${row.unit}${unitPrice ? `, Rp ${unitPrice.toLocaleString('id-ID')}` : ''}`;
    const item = matchByName(row.name, items);
    if (!item) {
      unmatched += 1;
      return { itemId: '', itemName: '', category: '', quantity: row.quantity, unit: '', conditionNote: asWritten, batchNumber: '', unitPrice };
    }
    const converted = convertToItemUnit(row.quantity, unitPrice, row.unit, item.baseUnit);
    if (!converted) {
      unitIssues += 1;
      return { itemId: item.id, itemName: item.name, category: item.category, quantity: 0, unit: item.baseUnit, conditionNote: `${asWritten}. Satuan beda, isi jumlahnya.`, batchNumber: '', unitPrice: 0 };
    }
    return { itemId: item.id, itemName: item.name, category: item.category, quantity: converted.quantity, unit: item.baseUnit, conditionNote: '', batchNumber: '', unitPrice: converted.unitPrice };
  });
  return { lines, unmatched, unitIssues };
}

interface Summary {
  filled: number;
  unmatched: number;
  unitIssues: number;
  sumLines: number;
  grandTotal: number;
  supplierName: string;
  supplierMatched: boolean;
  date: string;
  unreadable: string[];
}

// Baca foto nota lalu isi form penerimaan. Baris yang sudah terisi tidak ditimpa, dan tidak ada yang tersimpan sebelum petugas menyimpan form.
export const AiReceiptReader: React.FC<{
  items: ItemMaster[];
  suppliers: Supplier[];
  onApply: (result: { lines: DraftLine[]; supplierId?: string; documentNo?: string; photoUrl?: string }) => void;
}> = ({ items, suppliers, onApply }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    setSummary(null);
    try {
      const compressed = await compressImageToWebP(file, { maxDimension: 1600, quality: 0.8 });
      const payload = await imageToAiPayload(compressed.blob, 1600);
      const receipt = await requestReceipt({ mimeType: payload.mimeType, data: payload.data });
      if (receipt.items.length === 0) {
        setError('Tidak ada baris barang yang terbaca. Coba foto lebih dekat dan terang, atau isi manual.');
        return;
      }
      // Foto nota ikut jadi dokumentasi; gagal unggah tidak membatalkan hasil baca.
      const photoUrl = await uploadDocumentationPhoto(compressed.blob, 'receiving').then(r => r.url).catch(() => undefined);
      const { lines, unmatched, unitIssues } = receiptToLines(receipt, items);
      const supplier = matchByName(receipt.supplierName, suppliers);
      onApply({ lines, supplierId: supplier?.id, documentNo: receipt.documentNo.trim() || undefined, photoUrl });
      setSummary({
        filled: lines.length,
        unmatched,
        unitIssues,
        sumLines: receipt.items.reduce((sum, r) => sum + (r.lineTotal > 0 ? r.lineTotal : r.quantity * r.unitPrice), 0),
        grandTotal: receipt.grandTotal,
        supplierName: receipt.supplierName,
        supplierMatched: Boolean(supplier),
        date: receipt.date,
        unreadable: receipt.unreadable || [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nota gagal dibaca. Coba lagi atau isi manual.');
    } finally {
      setBusy(false);
    }
  };

  const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
  const totalDiffers = summary && summary.grandTotal > 0 && Math.abs(summary.grandTotal - summary.sumLines) > 1;

  return (
    <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-700 min-w-0">Punya nota atau surat jalan? Foto bisa dibaca AI untuk mengisi baris barang, lalu periksa sebelum disimpan.</p>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className={`${BTN_SECONDARY} disabled:opacity-50 disabled:cursor-wait`}>
          {busy && <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden="true" />}
          {busy ? 'Membaca nota...' : 'Baca foto nota'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" tabIndex={-1} aria-hidden="true" />
      </div>
      <div aria-live="polite">
        {error && <p role="alert" className="mt-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        {summary && (
          <div className="mt-2 relative rounded-lg border border-slate-200 bg-white p-3 pr-11 text-xs text-slate-700 space-y-1">
            <button type="button" onClick={() => setSummary(null)} aria-label="Tutup ringkasan nota" className={`absolute top-1 right-1 w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCUS_RING}`}>
              <X className="w-4 h-4" />
            </button>
            <p className="font-semibold text-slate-900">{summary.filled} baris dari nota masuk ke form. Periksa satu per satu sebelum disimpan.</p>
            {summary.unmatched > 0 && <p className="text-amber-800">{summary.unmatched} baris belum cocok dengan data barang: pilih barangnya. Isi nota ada di kolom catatan.</p>}
            {summary.unitIssues > 0 && <p className="text-amber-800">{summary.unitIssues} baris satuannya beda dengan data barang: isi jumlah dan harganya.</p>}
            {summary.supplierName && !summary.supplierMatched && <p className="text-amber-800">Supplier "{summary.supplierName}" belum cocok dengan data, pilih manual.</p>}
            {summary.date && <p>Tanggal di nota: {summary.date}. Tanggal terima di form tidak diubah.</p>}
            {totalDiffers && (
              <p className="flex items-start gap-1.5 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                Total nota {rupiah(summary.grandTotal)}, jumlah baris terbaca {rupiah(summary.sumLines)}. Bisa karena biaya tambahan atau salah baca.
              </p>
            )}
            {summary.unreadable.length > 0 && <p className="text-amber-800">Tidak terbaca jelas: {summary.unreadable.join(', ')}</p>}
          </div>
        )}
      </div>
    </div>
  );
};
