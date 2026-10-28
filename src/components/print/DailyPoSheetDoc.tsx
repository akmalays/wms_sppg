import React, { useEffect, useMemo, useState } from 'react';
import { SppgLogo } from '../SppgLogo';
import { KopText } from '../common/KopText';
import { FIELD_INPUT, FIELD_LABEL } from '../common/FormDialog';
import { warehouseDb, signerName } from '../../db/storage';
import { PurchaseOrderNota } from '../../types/warehouse';
import { isPendingSupplierPo, isMenuPurchaseOrder } from '../../utils/poSupplier';
import { localDateIso } from '../../utils/localDate';

// Form PO harian: satu lembar berisi semua bahan PO yang datang di satu tanggal (biasanya untuk menu besok),
// dikelompokkan per supplier. Dipegang petugas saat barang datang: hasil timbang, nama pengantar, serta
// tanda tangan supplier dan penerima ditulis tangan, lalu disalin ke Terima bahan PO di Barang Masuk.

const BLANK_LINE = <span className="block border-b border-dotted border-slate-400 h-4" />;
const COLUMN_COUNT = 9;
// Baris kosong untuk bahan yang ikut datang padahal tidak ada di PO (tambahan mendadak dari dapur)
const EXTRA_ROW_COUNT = 4;

const formatLongDate = (iso: string) => {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

interface DailyPoSheetDocProps {
  initialDate?: string;
  onCountChange: (count: number) => void;
}

export const DailyPoSheetDoc: React.FC<DailyPoSheetDocProps> = ({ initialDate, onCountChange }) => {
  const [date, setDate] = useState(initialDate || localDateIso());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (initialDate) setDate(initialDate);
  }, [initialDate]);

  // PO bisa berubah dari perangkat lain atau dari Barang Masuk
  useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    window.addEventListener('sppg_warehouse_sync', bump);
    return () => window.removeEventListener('sppg_warehouse_sync', bump);
  }, []);

  const pos = useMemo(
    () =>
      warehouseDb
        .getPurchaseOrders()
        .filter(po => (po.deliveryDate || po.date) === date)
        // Hanya pesanan dari menu (juga yang sudah diterima). Nota yang dibuat dari penerimaan atau belanja
        // yang sudah terjadi bukan pesanan, jadi tidak ikut.
        .filter(isMenuPurchaseOrder)
        // Supplier yang sudah pasti di atas, "Supplier menyusul" paling bawah untuk diisi saat datang
        .sort((a, b) => Number(isPendingSupplierPo(a)) - Number(isPendingSupplierPo(b)) || a.supplierName.localeCompare(b.supplierName, 'id')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [date, version]
  );

  const menus = useMemo(() => {
    const ids = new Set(pos.map(p => p.relatedMenuOrderId).filter(Boolean));
    return warehouseDb.getMenuOrders().filter(m => ids.has(m.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, version]);

  const itemCount = pos.reduce((sum, po) => sum + po.items.length, 0);

  useEffect(() => {
    onCountChange(pos.length > 0 ? 1 : 0);
  }, [pos.length, onCountChange]);

  // Supplier di PO hanya rencana: dicetak kecil, garis di bawahnya untuk supplier yang benar-benar mengirim.
  // PO yang sudah diterima mencatat supplier pengirimnya, jadi dicetak apa adanya.
  const isReceived = (po: PurchaseOrderNota) => po.status === 'SELESAI';
  const renderSupplierCell = (po: PurchaseOrderNota) =>
    isReceived(po) ? (
      <span className="font-semibold">{po.supplierName}</span>
    ) : isPendingSupplierPo(po) ? (
      BLANK_LINE
    ) : (
      <>
        <span className="block text-[10px] text-slate-600">Rencana: {po.supplierName}</span>
        {BLANK_LINE}
      </>
    );

  let rowNo = 0;

  return (
    <div className="space-y-4">
      {/* Tabel lebar (8 kolom): dicetak mendatar */}
      <style>{'@media print { @page { size: A4 landscape; margin: 8mm; } .po-sheet-table tr { break-inside: avoid; page-break-inside: avoid; } }'}</style>

      <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div>
          <label htmlFor="po-sheet-date" className={FIELD_LABEL}>Tanggal barang datang</label>
          <input id="po-sheet-date" type="date" value={date} onChange={e => setDate(e.target.value || localDateIso())} className={FIELD_INPUT} />
        </div>
        <p className="sm:col-span-2 sm:pt-5 text-slate-700">
          {pos.length > 0 ? (
            <>
              <span className="font-semibold text-slate-900">{pos.length} PO</span>, {itemCount} bahan
              {menus.length > 0 && <> untuk menu {menus.map(m => `${m.menuTitle} (${formatLongDate(m.date)})`).join(', ')}</>}.
            </>
          ) : (
            'Belum ada PO yang barangnya datang di tanggal ini. PO dibuat dari Perencanaan Menu → Buat PO → Terbitkan PO; tanggalnya H-1 dari tanggal menu.'
          )}
        </p>
      </div>

      {pos.length > 0 && (
        <div className="bg-white text-slate-900 text-xs space-y-3">
          <div className="border-b-2 border-slate-900 pb-2 flex items-center gap-3">
            <SppgLogo size="lg" variant="color" showText={false} />
            <KopText />
          </div>

          <div className="text-center">
            <h2 className="text-sm font-bold uppercase tracking-wide">Form PO &amp; Penerimaan Bahan</h2>
            <p className="text-xs text-slate-700">Barang datang {formatLongDate(date)}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-[11px]">
            <p className="col-span-2">
              <span className="text-slate-600">No. PO: </span>
              {pos.map(p => p.poNumber.replace(/^NO\.\s*/i, '')).join(', ')}
            </p>
            <p>
              <span className="text-slate-600">Untuk menu: </span>
              <span className="font-semibold">{menus.length ? menus.map(m => m.menuTitle).join(', ') : '-'}</span>
            </p>
            <p>
              <span className="text-slate-600">Dimasak: </span>
              <span className="font-semibold">
                {menus.length ? [...new Set(menus.map(m => formatLongDate(m.date)))].join(', ') : '-'}
                {menus.length > 0 && ` · ${menus.reduce((s, m) => s + (m.targetPortions || 0), 0).toLocaleString('id-ID')} porsi`}
              </span>
            </p>
          </div>

          <table className="po-sheet-table w-full border-collapse border border-slate-500 table-print text-[11px]">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-500 p-1.5 w-8">No</th>
                <th className="border border-slate-500 p-1.5 text-left whitespace-nowrap">Nama bahan</th>
                <th className="border border-slate-500 p-1.5 w-[9%] whitespace-nowrap">Dipesan</th>
                <th className="border border-slate-500 p-1.5 w-[11%] whitespace-nowrap">Hasil timbang</th>
                <th className="border border-slate-500 p-1.5 text-left w-[13%] whitespace-nowrap">Supplier</th>
                <th className="border border-slate-500 p-1.5 text-left w-[12%] whitespace-nowrap">Nama pengantar</th>
                <th className="border border-slate-500 p-1.5 w-[9%] whitespace-nowrap">TTD supplier</th>
                <th className="border border-slate-500 p-1.5 text-left w-[11%] whitespace-nowrap">Penerima</th>
                <th className="border border-slate-500 p-1.5 w-[9%] whitespace-nowrap">TTD penerima</th>
              </tr>
            </thead>
            <tbody>
              {pos.map(po => (
                <React.Fragment key={po.id}>
                  {/* Judul kelompok per supplier: supplier menyusul ditulis tangan per baris */}
                  <tr className="bg-slate-50">
                    <td colSpan={COLUMN_COUNT} className="border border-slate-500 px-1.5 py-1 font-semibold">
                      {isReceived(po)
                        ? `${po.supplierName} (sudah diterima)`
                        : isPendingSupplierPo(po)
                          ? 'Supplier menyusul (tulis supplier tiap bahan saat datang)'
                          : `Rencana: ${po.supplierName} (tulis supplier lain bila yang mengirim berbeda)`}
                      <span className="font-normal text-slate-600"> · {po.poNumber.replace(/^NO\.\s*/i, '')}</span>
                    </td>
                  </tr>
                  {po.items.map(it => {
                    rowNo += 1;
                    return (
                      <tr key={it.id} className="align-middle">
                        <td className="border border-slate-500 p-1.5 text-center">{rowNo}</td>
                        <td className="border border-slate-500 p-1.5 font-semibold">{it.name}</td>
                        <td className="border border-slate-500 p-1.5 text-center whitespace-nowrap font-mono">
                          {Number(it.quantity).toLocaleString('id-ID')} {it.unit}
                        </td>
                        <td className="border border-slate-500 p-1.5">
                          <div className="flex items-end gap-1">
                            <span className="flex-1 border-b border-dotted border-slate-400 h-5" />
                            <span className="text-slate-600">{it.unit}</span>
                          </div>
                        </td>
                        <td className="border border-slate-500 p-1.5">{renderSupplierCell(po)}</td>
                        <td className="border border-slate-500 p-1.5">{BLANK_LINE}</td>
                        <td className="border border-slate-500 p-1.5 h-9" />
                        <td className="border border-slate-500 p-1.5">{BLANK_LINE}</td>
                        <td className="border border-slate-500 p-1.5 h-9" />
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
              <tr className="bg-slate-50">
                <td colSpan={COLUMN_COUNT} className="border border-slate-500 px-1.5 py-1 font-semibold">
                  Bahan tambahan di luar PO
                  <span className="font-normal text-slate-600"> · tulis tangan, lalu catat di Barang Masuk</span>
                </td>
              </tr>
              {Array.from({ length: EXTRA_ROW_COUNT }, (_, i) => (
                <tr key={`extra-${i}`} className="align-middle">
                  <td className="border border-slate-500 p-1.5 text-center">{rowNo + i + 1}</td>
                  {Array.from({ length: COLUMN_COUNT - 1 }, (_, c) => (
                    <td key={c} className="border border-slate-500 p-1.5 h-9" />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-3 gap-6 pt-2 text-[11px]">
            <div className="space-y-1">
              <p className="font-semibold">Catatan:</p>
              {BLANK_LINE}
              {BLANK_LINE}
            </div>
            <div className="text-center">
              <p>Diperiksa oleh,</p>
              <p className="text-slate-600">Asisten Lapangan</p>
              <div className="h-14" />
              <p className="font-bold underline underline-offset-2">{signerName('ASLAP')}</p>
            </div>
            <div className="text-center">
              <p>Mengetahui,</p>
              <p className="text-slate-600">Kepala SPPG</p>
              <div className="h-14" />
              <p className="font-bold underline underline-offset-2">{signerName('KEPALA_SPPG')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
