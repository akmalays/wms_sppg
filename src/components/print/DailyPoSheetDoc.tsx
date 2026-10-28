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
      {/* Satu kolom lebar penuh agar mudah dibaca; blok PO tidak dipotong di tengah halaman */}
      <style>{`@media print { @page { size: A4 ${orientation}; margin: ${landscape ? '8mm' : '10mm'}; } .po-block { break-inside: avoid; page-break-inside: avoid; } }`}</style>

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
        <div className="bg-white text-slate-900 text-xs space-y-4">
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

          {pos.map(po => {
            const received = isReceived(po);
            const status = (
              <span className="text-[11px] text-slate-600">
                {po.items.length} bahan{received && <span className="font-semibold text-slate-900"> · sudah diterima</span>}
              </span>
            );

            if (landscape) {
              return (
                // Mendatar: panel kiri berisi semua isian tulis tangan, kanan tabel bahan selebar sisa kertas
                <section key={po.id} className="po-block grid grid-cols-1 sm:grid-cols-[17rem_1fr] print:grid-cols-[17rem_1fr] gap-x-6 gap-y-3 border-t-2 border-slate-800 pt-2">
                  <div className="space-y-2.5">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-end gap-2">
                          <span className="text-sm font-bold shrink-0">Supplier</span>
                          <span className="flex-1 border-b border-slate-500 h-6" />
                        </div>
                        {status}
                      </div>
                      {!received && <PoQr poId={po.id} />}
                    </div>
                    <div className="space-y-2 text-[11px] text-slate-600">
                      <FillLine label="Pengirim" />
                      <div className="flex gap-3">
                        <FillLine label="Jam" />
                        <FillLine label="Penerima" grow={2} />
                      </div>
                    </div>
                    <div className="text-center text-[11px] text-slate-600">
                      <span className="block border-b border-slate-500 h-10" />
                      <span>TTD supplier</span>
                    </div>
                  </div>
                  <ItemsTable po={po} />
                </section>
              );
            }

            return (
              <section key={po.id} className="po-block space-y-1.5">
                {/* Supplier ditulis tangan oleh petugas: yang dicatat adalah supplier yang benar-benar mengirim */}
                <div className="flex items-end gap-3">
                  <div className="flex-1 min-w-0 flex items-end gap-2">
                    <span className="text-sm font-bold shrink-0">Supplier</span>
                    <span className="flex-1 border-b border-slate-500 h-6" />
                    <span className="shrink-0">{status}</span>
                  </div>
                  {!received && <PoQr poId={po.id} />}
                </div>

                <ItemsTable po={po} />

                {/* Satu baris isian; TTD supplier di ujung kanan dengan ruang tanda tangan */}
                <div className="flex flex-wrap items-end gap-x-4 gap-y-2 pt-1 text-[11px] text-slate-600">
                  <FillLine label="Pengirim" grow={2} />
                  <FillLine label="Jam" />
                  <FillLine label="Penerima" grow={2} />
                  <div className="shrink-0 w-40 text-center">
                    <span className="block border-b border-slate-500 h-9" />
                    <span>TTD supplier</span>
                  </div>
                </div>
              </section>
            );
          })}

          <section className="po-block border-t-2 border-slate-800 pt-2 space-y-1.5">
            <p className="font-semibold">
              Bahan tambahan di luar PO
              <span className="font-normal text-slate-600"> · tulis tangan, lalu catat di Barang Masuk</span>
            </p>
            {Array.from({ length: EXTRA_ROW_COUNT }, (_, i) => (
              <div key={i} className="flex items-end gap-2 text-[11px] text-slate-600">
                <span className="w-4 text-right">{i + 1}.</span>
                <span className="flex-[3] border-b border-slate-400 h-5" />
                <span>jumlah</span>
                <span className="flex-1 border-b border-slate-400 h-5" />
                <span>supplier</span>
                <span className="flex-[2] border-b border-slate-400 h-5" />
              </div>
            ))}
          </section>

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

const PoQr: React.FC<{ poId: string }> = ({ poId }) => (
  <div className="flex items-center gap-1.5 shrink-0">
    <span className="text-[9px] font-semibold leading-tight text-right">
      Pindai untuk
      <br />
      input timbang
    </span>
    <QrSvg value={buildScanUrl(poReceiveCode(poId))} className="w-14 h-14" />
  </div>
);

/** Hanya garis mendatar: mata mengikuti baris dari nama bahan ke garis timbang. */
const ItemsTable: React.FC<{ po: PurchaseOrderNota }> = ({ po }) => (
  <table className="w-full self-start border-collapse">
    <thead>
      <tr className="border-b-2 border-slate-800 text-[11px] text-slate-600">
        <th className="w-7 py-1 text-right font-semibold">#</th>
        <th className="py-1 pl-3 text-left font-semibold">Bahan</th>
        <th className="w-24 py-1 text-right font-semibold">Pesan</th>
        <th className="w-36 py-1 pl-6 text-left font-semibold">Timbang</th>
      </tr>
    </thead>
    <tbody>
      {po.items.map((it, idx) => (
        <tr key={it.id} className="border-b border-slate-300">
          <td className="py-1.5 text-right text-slate-500 tabular-nums">{idx + 1}</td>
          <td className="py-1.5 pl-3 font-semibold">{it.name}</td>
          <td className="py-1.5 text-right font-mono whitespace-nowrap">
            {Number(it.quantity).toLocaleString('id-ID')} {it.unit}
          </td>
          <td className="py-1.5 pl-6">
            <span className="flex items-end gap-1">
              <span className="flex-1 border-b border-dotted border-slate-500 h-4" />
              <span className="text-slate-600">{it.unit}</span>
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

const FillLine: React.FC<{ label: string; grow?: number }> = ({ label, grow = 1 }) => (
  <div className="flex items-end gap-1 min-w-[6rem]" style={{ flexGrow: grow, flexBasis: 0 }}>
    <span className="shrink-0">{label}</span>
    <span className="flex-1 border-b border-slate-500 h-4" />
  </div>
);
