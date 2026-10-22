import React, { useMemo } from 'react';
import { warehouseDb } from '../db/storage';
import { ReceivingDocument } from '../types/warehouse';
import { Printer } from 'lucide-react';
import { DialogShell, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST } from './common/FormDialog';

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
    linked.find(e => (e.itemId && e.itemId === line.itemId) || e.itemName === line.itemName);
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
            </tbody>
            {linkedTotal > 0 && (
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={3} className="py-2 px-3 text-right font-semibold text-slate-800">Total belanja</td>
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

      {document.documentationPhotos && document.documentationPhotos.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Foto penerimaan ({document.documentationPhotos.length})</h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {document.documentationPhotos.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Buka foto ${i + 1}`}
                className="block rounded-lg border border-slate-200 overflow-hidden bg-slate-100 aspect-4/3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <img src={url} alt={`Foto penerimaan ${i + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

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
