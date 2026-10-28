import React from 'react';
import { SppgLogo } from '../SppgLogo';
import { KopText } from '../common/KopText';
import { signerName } from '../../db/storage';
import { PurchaseRequest, purchaseRequestTotal } from '../../utils/purchaseRequests';
import { angkaTerbilang } from '../../utils/numberToWords';

const formatLongDate = (iso: string) => {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const CELL = 'border border-slate-500 px-1.5 py-1';

/**
 * Lembar Permintaan Pembelian yang diserahkan gudang ke bagian pembelian. Ditandatangani peminta, pemeriksa
 * (akuntan), dan Kepala SPPG; setelah disetujui baru PO diterbitkan dari aplikasi.
 */
export const PurchaseRequestDoc: React.FC<{ request: PurchaseRequest }> = ({ request }) => {
  const total = purchaseRequestTotal(request);
  return (
    <div className="bg-white text-slate-900 text-xs space-y-3">
      <div className="border-b-2 border-slate-900 pb-1.5 flex items-center gap-3">
        <SppgLogo size="md" variant="color" showText={false} />
        <KopText />
      </div>

      <div className="text-center">
        <h2 className="text-base font-bold">Permintaan Pembelian Barang</h2>
        <p className="font-mono text-slate-700">{request.number}</p>
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[11px]">
        <div className="flex gap-2">
          <dt className="text-slate-600 w-28">Tanggal permintaan</dt>
          <dd className="font-semibold">{formatLongDate(request.date)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-600 w-28">Dibutuhkan tanggal</dt>
          <dd className="font-semibold">{formatLongDate(request.neededDate)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-600 w-28">Diminta oleh</dt>
          <dd className="font-semibold">{request.requestedBy} (Gudang)</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-600 w-28">Keperluan</dt>
          <dd className="font-semibold">Restock barang non-menu di bawah batas minimum</dd>
        </div>
      </dl>

      <table className="w-full border-collapse border border-slate-500 table-print">
        <thead className="bg-slate-100 text-[11px]">
          <tr>
            <th className={`${CELL} w-7 text-center`}>No</th>
            <th className={`${CELL} text-left`}>Nama barang</th>
            <th className={`${CELL} w-24 text-right`}>Stok / min.</th>
            <th className={`${CELL} w-24 text-right`}>Diminta</th>
            <th className={`${CELL} w-24 text-right`}>Perkiraan harga</th>
            <th className={`${CELL} w-28 text-right`}>Subtotal</th>
            <th className={`${CELL} w-32 text-left`}>Supplier usulan</th>
            <th className={`${CELL} w-20 text-center`}>Disetujui</th>
          </tr>
        </thead>
        <tbody>
          {request.items.map((it, idx) => {
            const subtotal = Math.round(it.quantity * it.unitPrice);
            return (
              <tr key={`${it.itemId}-${idx}`}>
                <td className={`${CELL} text-center tabular-nums`}>{idx + 1}</td>
                <td className={CELL}>
                  <span className="font-semibold">{it.name}</span>
                  <span className="text-[10px] text-slate-600"> · {it.category}</span>
                </td>
                <td className={`${CELL} text-right font-mono whitespace-nowrap`}>
                  {it.stockAtRequest.toLocaleString('id-ID')} / {it.minimumStock.toLocaleString('id-ID')}
                </td>
                <td className={`${CELL} text-right font-mono font-semibold whitespace-nowrap`}>
                  {it.quantity.toLocaleString('id-ID')} {it.unit}
                </td>
                <td className={`${CELL} text-right font-mono whitespace-nowrap`}>
                  {it.unitPrice > 0 ? it.unitPrice.toLocaleString('id-ID') : ''}
                </td>
                <td className={`${CELL} text-right font-mono whitespace-nowrap`}>
                  {subtotal > 0 ? subtotal.toLocaleString('id-ID') : ''}
                </td>
                <td className={CELL}>{it.supplier}</td>
                {/* Diisi bagian pembelian: centang, atau tulis jumlah yang disetujui bila berbeda */}
                <td className={CELL} />
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td colSpan={5} className={`${CELL} text-right`}>Perkiraan total</td>
            <td className={`${CELL} text-right font-mono`}>{total > 0 ? `Rp ${total.toLocaleString('id-ID')}` : ''}</td>
            <td colSpan={2} className={CELL} />
          </tr>
        </tfoot>
      </table>
      {total > 0 && <p className="text-[11px] italic text-slate-700">Terbilang: {angkaTerbilang(total)}</p>}

      <div className="text-[11px] space-y-1">
        <p className="font-semibold">Catatan bagian pembelian:</p>
        <span className="block border-b border-dotted border-slate-400 h-4" />
        <span className="block border-b border-dotted border-slate-400 h-4" />
      </div>

      <div className="grid grid-cols-3 gap-6 pt-2 text-center text-[11px] break-inside-avoid">
        {[
          { top: 'Diminta oleh,', role: 'Admin Gudang', name: request.requestedBy },
          { top: 'Diperiksa oleh,', role: 'Akuntan / Pembelian', name: signerName('AKUNTAN') },
          { top: 'Disetujui oleh,', role: 'Kepala SPPG', name: signerName('KEPALA_SPPG') },
        ].map(sg => (
          <div key={sg.role}>
            <p>{sg.top}</p>
            <p className="text-slate-600">{sg.role}</p>
            <div className="h-14" />
            <p className="font-bold underline underline-offset-2">{sg.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
