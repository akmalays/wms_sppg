import React, { useEffect, useMemo, useRef, useState } from 'react';
import { warehouseDb } from '../db/storage';
import { ReceivingDocument } from '../types/warehouse';
import { Camera, ImagePlus, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { compressImageToWebP, deleteDocumentationPhoto, uploadDocumentationPhoto } from '../utils/imageCompressor';
import { DialogShell, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST } from './common/FormDialog';
import { isExtraCostExpense } from '../utils/extraCosts';

interface ReceivingDetailModalProps {
  document: ReceivingDocument | null;
  onClose: () => void;
  /** Membuka BA Penerimaan di Cetak Form untuk dokumen ini; tombol cetak disembunyikan bila tidak diisi. */
  onPrint?: (receivingId: string) => void;
}

const longDate = (iso: string) => {
  const [y, m, d] = (iso || '').slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return iso || '-';
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// "07:37:00" atau "07.37" menjadi "07.37", penulisan jam yang dipakai di dokumen SPPG.
const clock = (time?: string) => (time ? time.slice(0, 5).replace(':', '.') : '-');

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] text-slate-600">{label}</dt>
    <dd className="text-xs font-semibold text-slate-900 mt-0.5 break-words">{children}</dd>
  </div>
);

const MAX_PHOTOS = 6;

// Foto nota supplier sebagai cadangan bila kertasnya hilang. Foto dikompres ke WebP di HP sebelum diunggah,
// dan yang dihapus ikut dibuang dari storage, karena kuota Supabase gratis terbatas.
const ReceivingPhotos: React.FC<{ document: ReceivingDocument }> = ({ document }) => {
  const { currentUser, can } = useAuth();
  const toast = useToast();
  const askConfirm = useConfirm();
  const canEdit = can('RECEIVE_GOODS');
  const [photos, setPhotos] = useState<string[]>(document.documentationPhotos || []);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPhotos(document.documentationPhotos || []);
    setError('');
  }, [document.id]);

  const save = (next: string[]) => {
    warehouseDb.updateReceivingPhotos(document.id, next, currentUser);
    setPhotos(next);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    const picked = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    const uploaded: string[] = [];
    let totalKb = 0;
    const failed: string[] = [];
    for (const [i, file] of picked.entries()) {
      setProgress(`Mengunggah foto ${i + 1} dari ${picked.length}...`);
      try {
        // 1600 px di sisi terpanjang masih cukup untuk membaca angka kecil di nota
        const compressed = await compressImageToWebP(file, { maxDimension: 1600, quality: 0.7 });
        const res = await uploadDocumentationPhoto(compressed.blob, 'receiving');
        // Fallback base64 akan masuk ke baris database dan memakan kuota, jadi ditolak bila Supabase aktif
        if (res.isLocalFallback && isSupabaseConfigured()) throw new Error(res.error || 'penyimpanan foto belum siap');
        uploaded.push(res.url);
        totalKb += compressed.compressedSizeKb;
      } catch (err: any) {
        failed.push(`${file.name}: ${err?.message || 'gagal diproses'}`);
      }
    }
    setProgress('');
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';

    if (uploaded.length > 0) {
      try {
        save([...photos, ...uploaded]);
        toast.success(`${uploaded.length} foto tersimpan, total ${totalKb.toLocaleString('id-ID')} KB.`, 'Foto nota');
      } catch (err: any) {
        failed.push(err?.message || 'Gagal menyimpan foto ke dokumen.');
      }
    }
    if (failed.length > 0) setError(`Foto tidak tersimpan. ${failed.join('. ')}`);
  };

  const handleRemove = async (index: number) => {
    const ok = await askConfirm({
      title: `Hapus foto ${index + 1}?`,
      message: 'Foto dihapus dari dokumen dan dari penyimpanan, jadi tidak bisa dikembalikan.',
      confirmText: 'Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    const url = photos[index];
    try {
      save(photos.filter((_, i) => i !== index));
      void deleteDocumentationPhoto(url);
    } catch (err: any) {
      setError(err?.message || 'Gagal menghapus foto.');
    }
  };

  if (!canEdit && photos.length === 0) return null;
  const busy = progress !== '';

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-slate-800">
          Foto nota dan penerimaan <span className="font-normal text-slate-600">({photos.length}/{MAX_PHOTOS})</span>
        </h3>
        {canEdit && photos.length < MAX_PHOTOS && (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className={BTN_SECONDARY}>
              <Camera className="w-3.5 h-3.5" />
              Ambil foto
            </button>
            <button type="button" disabled={busy} onClick={() => galleryRef.current?.click()} className={BTN_SECONDARY}>
              <ImagePlus className="w-3.5 h-3.5" />
              Pilih dari galeri
            </button>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFiles(e.target.files)} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
          </div>
        )}
      </div>

      <p aria-live="polite" className={busy ? 'text-[11px] text-slate-700 mb-2' : 'sr-only'}>
        {progress}
      </p>
      {error && (
        <p role="alert" className="text-[11px] text-rose-700 bg-rose-50 rounded-lg px-3 py-2 mb-2">
          {error}
        </p>
      )}

      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {photos.map((url, i) => (
            <li key={url} className="rounded-lg border border-slate-200 overflow-hidden bg-white">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Buka foto ${i + 1} ukuran penuh`}
                className="block bg-slate-100 aspect-4/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
              >
                <img src={url} alt={`Foto penerimaan ${i + 1}`} loading="lazy" className="w-full h-full object-cover" />
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleRemove(i)}
                  disabled={busy}
                  className="w-full min-h-[44px] sm:min-h-[30px] border-t border-slate-200 text-[11px] font-medium text-slate-700 hover:text-rose-700 hover:bg-rose-50 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                >
                  Hapus foto {i + 1}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-slate-600">Belum ada foto. Simpan foto nota supplier di sini untuk jaga-jaga bila kertasnya hilang.</p>
      )}
    </section>
  );
};

// Bukti barang sudah diterima dan masuk stok: dicocokkan dengan nota supplier dan dicetak sebagai BA penerimaan.
export const ReceivingDetailModal: React.FC<ReceivingDetailModalProps> = ({ document, onClose, onPrint }) => {
  // Harga tersimpan di catatan belanja bertanda [GR: id] (penerimaan menyimpan jumlah saja).
  const linked = useMemo(
    () => (document ? warehouseDb.getNonFoodExpenses().filter(e => e.notes?.includes(`[GR: ${document.id}]`)) : []),
    [document]
  );
  const sourcePo = useMemo(
    () => (document ? warehouseDb.getPurchaseOrders().find(p => p.relatedReceivingId === document.id) : undefined),
    [document]
  );

  if (!document) return null;

  const priceOf = (line: { itemId: string; itemName: string }) =>
    linked.find(e => !isExtraCostExpense(e) && ((e.itemId && e.itemId === line.itemId) || e.itemName === line.itemName));
  const linkedTotal = linked.reduce((sum, e) => sum + (e.totalCost || 0), 0);
  // Catatan otomatis dari penerimaan PO sudah tergambar di baris "Dari nota pesanan".
  const customNotes = document.notes && !document.notes.startsWith('Penerimaan & penimbangan fisik dari PO') ? document.notes : '';
  const signatures = [
    { label: 'Pengirim', name: document.supplierName, image: document.supplierSignature },
    { label: 'Penerima', name: document.receiverName, image: document.receiverSignature },
  ].filter(s => s.image?.startsWith('data:image'));

  return (
    <DialogShell
      title={`Penerimaan ${document.id}`}
      description="Bukti barang sudah diterima dan masuk stok. Dipakai untuk mencocokkan nota supplier dan mencetak BA penerimaan."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
            Tutup
          </button>
          {onPrint && (
            <button type="button" onClick={() => onPrint(document.id)} className={BTN_PRIMARY}>
              <Printer className="w-3.5 h-3.5" />
              Cetak BA penerimaan
            </button>
          )}
        </>
      }
    >
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        <Fact label="Tanggal">{longDate(document.date)}</Fact>
        <Fact label="Jam tiba">{clock(document.arrivalTime)}</Fact>
        <Fact label="Supplier">{document.supplierName || '-'}</Fact>
        <Fact label="Diterima oleh">{document.receiverName || '-'}</Fact>
        <Fact label="No. surat jalan">
          <span className="font-mono">{document.deliveryNoteNo || '-'}</span>
        </Fact>
        <Fact label="Dari nota pesanan">
          <span className="font-mono">{sourcePo?.poNumber.replace(/^NO\.\s*/, '') || '-'}</span>
        </Fact>
      </dl>

      {customNotes && (
        <p className="text-xs text-slate-800">
          <span className="text-slate-600">Catatan: </span>
          {customNotes}
        </p>
      )}

      <section>
        <h3 className="text-sm font-semibold text-slate-800 mb-2">Barang diterima ({document.lines.length})</h3>
        <div className="rounded-lg border border-slate-200 overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2 px-3">Barang</th>
                <th className="py-2 px-3 text-right">Jumlah</th>
                <th className="py-2 px-3 text-right">Harga satuan</th>
                <th className="py-2 px-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {document.lines.map(line => {
                const price = priceOf(line);
                return (
                  <tr key={line.id} className="align-top">
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900">{line.itemName}</div>
                      {(line.conditionNote || line.batchNumber) && (
                        <div className="text-[11px] text-slate-600 mt-0.5">{line.conditionNote || `Batch ${line.batchNumber}`}</div>
                      )}
                      {line.expiryDate && (
                        <div className="text-[11px] text-slate-600 mt-0.5">
                          Kedaluwarsa <span className="font-mono">{line.expiryDate.split('-').reverse().join('/')}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {line.quantity.toLocaleString('id-ID', { maximumFractionDigits: 2 })} {line.unit}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {price?.unitPrice ? rupiah(price.unitPrice) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {price?.totalCost ? rupiah(price.totalCost) : '-'}
                    </td>
                  </tr>
                );
              })}
              {linked
                .filter(e => isExtraCostExpense(e) || !document.lines.some(l => (e.itemId && e.itemId === l.itemId) || e.itemName === l.itemName))
                .map(exp => (
                  <tr key={exp.id} className="align-top bg-amber-50/20">
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900">{exp.itemName}</div>
                      <div className="text-[11px] text-amber-800 mt-0.5">{isExtraCostExpense(exp) ? 'Biaya tambahan supplier' : 'Belanja tertaut'}</div>
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {exp.quantity} {exp.unit || 'Paket'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {rupiah(exp.unitPrice || exp.totalCost || 0)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {rupiah(exp.totalCost || 0)}
                    </td>
                  </tr>
                ))}
            </tbody>
            {linkedTotal > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right font-semibold text-slate-800">Total belanja (termasuk biaya tambahan)</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900 whitespace-nowrap">{rupiah(linkedTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {linkedTotal === 0 && (
          <p className="text-[11px] text-slate-600 mt-1.5">Harga belum tercatat di Pengeluaran Harian untuk penerimaan ini.</p>
        )}
      </section>

      <ReceivingPhotos document={document} />

      {/* Tanda tangan hanya tampil bila memang direkam di aplikasi; selain itu ditandatangani di BA cetak. */}
      {signatures.length > 0 ? (
        <section className="grid grid-cols-2 gap-3">
          {signatures.map(s => (
            <div key={s.label} className="rounded-lg border border-slate-200 p-3 text-center">
              <p className="text-[11px] text-slate-600">{s.label}</p>
              <img src={s.image} alt={`Tanda tangan ${s.label.toLowerCase()}`} className="h-14 mx-auto object-contain" />
              <p className="text-xs font-semibold text-slate-900 border-t border-slate-200 pt-1">{s.name}</p>
            </div>
          ))}
        </section>
      ) : (
        <p className="text-[11px] text-slate-600">Tanda tangan supplier dan penerima dibubuhkan di BA penerimaan yang dicetak.</p>
      )}
    </DialogShell>
  );
};
