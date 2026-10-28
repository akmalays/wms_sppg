import React, { useEffect, useMemo, useState } from 'react';
import { SppgLogo } from '../SppgLogo';
import { KopText } from '../common/KopText';
import { FIELD_INPUT, FIELD_LABEL } from '../common/FormDialog';
import { warehouseDb, signerName } from '../../db/storage';
import { PurchaseOrderNota } from '../../types/warehouse';
import { isPendingSupplierPo, isMenuPurchaseOrder } from '../../utils/poSupplier';
import { localDateIso } from '../../utils/localDate';
import { buildScanUrl, poReceiveCode } from '../../utils/scanCode';
import { QrSvg } from '../common/QrSvg';

// Form PO harian: semua PO yang barangnya datang di satu tanggal (biasanya untuk menu besok), satu blok per PO.
// Dipegang petugas saat barang datang: supplier pengirim, hasil timbang, pengirim, jam, dan tanda tangan ditulis
// tangan. QR di tiap blok membuka timbang PO itu di Barang Masuk agar hasil timbang langsung diinput.

const BLANK_LINE = <span className="block border-b border-dotted border-slate-400 h-4" />;
// Baris kosong untuk bahan yang ikut datang padahal tidak ada di PO (tambahan mendadak dari dapur)
const EXTRA_ROW_COUNT = 3;
const CELL = 'border border-slate-500 px-1.5 py-1';

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
  // Tegak: blok supplier bertumpuk. Mendatar: info supplier di panel kiri, tabel bahan di kanan.
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const landscape = orientation === 'landscape';

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
        // Urutan mengikuti supplier rencana (tidak dicetak) agar PO supplier yang sama berdekatan
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

  const isReceived = (po: PurchaseOrderNota) => po.status === 'SELESAI';
  const cookDays = [...new Set(menus.map(m => formatLongDate(m.date)))].join(', ');
  const portions = menus.reduce((sum, m) => sum + (m.targetPortions || 0), 0);

  return (
    <div className="space-y-4">
      {/* Tabel per kiriman tidak dipotong di tengah halaman */}
      <style>{`@media print { @page { size: A4 ${orientation}; margin: 8mm; } .po-block { break-inside: avoid; page-break-inside: avoid; } }`}</style>

      <div className="no-print grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <label htmlFor="po-sheet-date" className={FIELD_LABEL}>Tanggal barang datang</label>
          <input id="po-sheet-date" type="date" value={date} onChange={e => setDate(e.target.value || localDateIso())} className={FIELD_INPUT} />
        </div>
        <div>
          <label htmlFor="po-sheet-orientation" className={FIELD_LABEL}>Orientasi kertas</label>
          <select
            id="po-sheet-orientation"
            value={orientation}
            onChange={e => setOrientation(e.target.value as 'portrait' | 'landscape')}
            className={FIELD_INPUT}
          >
            <option value="portrait">Tegak (A4 portrait)</option>
            <option value="landscape">Mendatar (A4 landscape)</option>
          </select>
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
        <div className="bg-white text-slate-900 text-xs space-y-2.5">
          <div className="border-b-2 border-slate-900 pb-1.5 flex items-center gap-3">
            <SppgLogo size="md" variant="color" showText={false} />
            <KopText />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
            <div>
              <h2 className="text-base font-bold">Form PO &amp; Penerimaan Bahan</h2>
              {/* Satu nomor nota untuk semua PO di tanggal yang sama */}
              <p className="text-slate-700">
                <span className="font-mono font-semibold text-slate-900">{pos[0].poNumber.replace(/^NO\.\s*/i, '')}</span>
                {' · '}barang datang {formatLongDate(date)}
              </p>
            </div>
            {menus.length > 0 && (
              <p className="text-[11px] text-slate-700 text-right">
                Untuk menu <span className="font-semibold text-slate-900">{menus.map(m => m.menuTitle).join(', ')}</span>
                <br />
                dimasak {cookDays} · {portions.toLocaleString('id-ID')} porsi
              </p>
            )}
          </div>

          {/* Satu tabel per kiriman, urut atas ke bawah: kedatangan, timbang, serah terima.
              Mendatar: dua tabel berdampingan agar hemat kertas. */}
          <div className={landscape ? 'columns-1 sm:columns-2 print:columns-2 gap-4' : ''}>
            {pos.map((po, poIdx) => {
              const received = isReceived(po);
              return (
                <table key={po.id} className={`po-block w-full border-collapse border border-slate-500 mb-2.5 ${landscape ? 'text-[11px]' : 'text-xs'}`}>
                  <thead>
                    <tr className="bg-slate-100">
                      <th colSpan={5} className={`${CELL} text-left font-normal`}>
                        <div className="flex flex-wrap items-end gap-x-4 gap-y-1.5">
                          <span className="font-bold text-slate-900 shrink-0">
                            Kiriman {poIdx + 1}/{pos.length}
                            <span className="font-normal text-slate-600"> · {po.items.length} bahan</span>
                            {received && <span className="text-slate-900"> · sudah diterima</span>}
                          </span>
                          {/* Supplier ditulis tangan: yang dicatat adalah supplier yang benar-benar mengirim */}
                          <FillLine label="Supplier" grow={3} />
                          <FillLine label="Pengirim" grow={2} />
                          <FillLine label="Jam" />
                        </div>
                      </th>
                    </tr>
                    <tr className="text-[11px] text-slate-700">
                      <th className={`${CELL} w-7 text-center font-semibold`}>No</th>
                      <th className={`${CELL} text-left font-semibold`}>Bahan</th>
                      <th className={`${CELL} w-20 text-right font-semibold`}>Pesan</th>
                      <th className={`${CELL} w-28 text-left font-semibold`}>Timbang</th>
                      <th className={`${CELL} w-[4.5rem] text-left font-semibold`}>Ket.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {po.items.map((it, idx) => (
                      <tr key={it.id}>
                        <td className={`${CELL} text-center text-slate-600 tabular-nums`}>{idx + 1}</td>
                        <td className={`${CELL} font-semibold`}>{it.name}</td>
                        <td className={`${CELL} text-right font-mono whitespace-nowrap`}>
                          {Number(it.quantity).toLocaleString('id-ID')} {it.unit}
                        </td>
                        <td className={`${CELL} text-right text-slate-600`}>{it.unit}</td>
                        <td className={CELL} />
                      </tr>
                    ))}
                    {/* Baris tanda tangan cukup tinggi untuk QR, jadi QR tidak menambah tinggi tabel */}
                    <tr>
                      <td colSpan={2} className={`${CELL} align-top h-14`}>
                        <span className="text-[10px] text-slate-600">TTD supplier / pengirim</span>
                      </td>
                      <td colSpan={2} className={`${CELL} align-top`}>
                        <span className="text-[10px] text-slate-600">TTD penerima (gudang)</span>
                      </td>
                      <td className={`${CELL} text-center align-middle`}>
                        {!received && (
                          <>
                            <QrSvg value={buildScanUrl(poReceiveCode(po.id))} className="w-11 h-11 mx-auto" />
                            <span className="block text-[8px] leading-tight text-slate-700">Input timbang</span>
                          </>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              );
            })}
          </div>

          <table className="po-block w-full border-collapse border border-slate-500 text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th colSpan={5} className={`${CELL} text-left`}>
                  Bahan tambahan di luar PO
                  <span className="font-normal text-slate-600"> · tulis tangan, lalu catat di Barang Masuk</span>
                </th>
              </tr>
              <tr className="text-[11px] text-slate-700">
                <th className={`${CELL} w-7 text-center font-semibold`}>No</th>
                <th className={`${CELL} text-left font-semibold`}>Bahan</th>
                <th className={`${CELL} w-28 text-left font-semibold`}>Jumlah</th>
                <th className={`${CELL} w-40 text-left font-semibold`}>Supplier</th>
                <th className={`${CELL} w-24 text-left font-semibold`}>Paraf</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: EXTRA_ROW_COUNT }, (_, i) => (
                <tr key={i} className="h-7">
                  <td className={`${CELL} text-center text-slate-600`}>{i + 1}</td>
                  <td className={CELL} />
                  <td className={CELL} />
                  <td className={CELL} />
                  <td className={CELL} />
                </tr>
              ))}
            </tbody>
          </table>

          <div className="po-block grid grid-cols-3 gap-6 text-[11px]">
            <div className="space-y-1">
              <p className="font-semibold">Catatan:</p>
              {BLANK_LINE}
              {BLANK_LINE}
            </div>
            <div className="text-center">
              <p>Diperiksa oleh,</p>
              <p className="text-slate-600">Asisten Lapangan</p>
              <div className="h-10" />
              <p className="font-bold underline underline-offset-2">{signerName('ASLAP')}</p>
            </div>
            <div className="text-center">
              <p>Mengetahui,</p>
              <p className="text-slate-600">Kepala SPPG</p>
              <div className="h-10" />
              <p className="font-bold underline underline-offset-2">{signerName('KEPALA_SPPG')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const FillLine: React.FC<{ label: string; grow?: number }> = ({ label, grow = 1 }) => (
  <div className="flex items-end gap-1 min-w-[6rem]" style={{ flexGrow: grow, flexBasis: 0 }}>
    <span className="shrink-0">{label}</span>
    <span className="flex-1 border-b border-slate-500 h-4" />
  </div>
);
