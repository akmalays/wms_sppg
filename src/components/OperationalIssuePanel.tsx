import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, X, PackageMinus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { localDateIso } from '../utils/localDate';
import { SearchPicker } from './common/SearchPicker';
import { ScanButton } from './common/QrScannerDialog';
import { ScanTarget } from '../utils/scanCode';
import { FIELD_INPUT, FIELD_LABEL, BTN_PRIMARY, BTN_SECONDARY } from './common/FormDialog';
import { PaperIssueFormDialog, PAPER_FORM_REF_PREFIX } from './PaperIssueFormDialog';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';

const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

/**
 * Barang keluar untuk barang operasional (tisu, sabun, ATK, gas, kemasan): bukan bahan masak,
 * jadi tidak masuk hitungan Pemakaian Dapur. Dicatat sebagai ISSUE_CONSUMPTION agar stok berkurang
 * dan ikut di Laporan Pengeluaran; kolom lokasi berisi "dipakai untuk".
 */
/** Tanggal diatur dari header Barang Keluar agar sama dengan tab Bahan dapur. */
export const OperationalIssuePanel: React.FC<{ selectedDate: string; onSelectDate: (date: string) => void }> = ({
  selectedDate,
  onSelectDate,
}) => {
  const { currentUser, can } = useAuth();
  const today = localDateIso();
  const [dataVersion, setDataVersion] = useState(0);
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('');
  const [usedFor, setUsedFor] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isPaperOpen, setIsPaperOpen] = useState(false);

  useEffect(() => {
    const onSync = () => setDataVersion(v => v + 1);
    window.addEventListener('sppg_storage_items_changed', onSync);
    window.addEventListener('sppg_warehouse_sync', onSync);
    return () => {
      window.removeEventListener('sppg_storage_items_changed', onSync);
      window.removeEventListener('sppg_warehouse_sync', onSync);
    };
  }, []);

  const items = useMemo(
    () => warehouseDb.getItems().filter(i => i.isActive && i.itemType === 'OPERATIONAL_CONSUMABLE'),
    [dataVersion]
  );
  const itemIds = useMemo(() => new Set(items.map(i => i.id)), [items]);

  const issued = useMemo(
    () =>
      warehouseDb
        .getTransactions()
        .filter(tx => tx.transactionType === 'ISSUE_CONSUMPTION' && tx.quantity < 0 && itemIds.has(tx.itemId) && tx.timestamp.startsWith(selectedDate))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [dataVersion, itemIds, selectedDate]
  );

  const options = useMemo(
    () =>
      [...items]
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
        .map(i => ({ value: i.id, label: i.name, group: i.category, hint: `Stok ${fmt(i.currentStock)} ${i.baseUnit}` })),
    [items]
  );

  const selected = items.find(i => i.id === itemId);
  const lowStock = items.filter(i => i.currentStock <= i.minimumStock);
  // Sama dengan bahan dapur: catatan baru selalu bertanggal hari ini, jadi form hanya muncul saat melihat hari ini.
  const canRecord = can('RECORD_CONSUMPTION') && selectedDate === today;

  const handleScan = ({ code }: ScanTarget) => {
    setError('');
    setFeedback('');
    const found = items.find(i => i.id.toUpperCase() === code.toUpperCase());
    if (found) return setItemId(found.id);
    const other = warehouseDb.getItems().find(i => i.id.toUpperCase() === code.toUpperCase());
    setError(
      other
        ? `${other.name} adalah bahan makanan. Catat di tab Bahan dapur.`
        : `Kode ${code} bukan barang operasional di Master Barang.`
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFeedback('');
    const amount = parseFloat(qty.replace(',', '.'));
    if (!selected) return setError('Pilih barangnya dulu.');
    if (!(amount > 0)) return setError('Jumlah harus lebih dari 0.');
    if (amount > selected.currentStock) {
      return setError(`Stok ${selected.name} tinggal ${fmt(selected.currentStock)} ${selected.baseUnit}. Periksa jumlahnya atau catat barang masuk dulu.`);
    }
    if (!usedFor.trim()) return setError('Isi barang ini dipakai untuk apa atau oleh siapa.');
    try {
      warehouseDb.recordConsumption(selected.id, amount, usedFor.trim(), currentUser, notes.trim() || 'Barang keluar operasional');
      setFeedback(`${fmt(amount)} ${selected.baseUnit} ${selected.name} keluar untuk ${usedFor.trim()}.`);
      setItemId('');
      setQty('');
      setNotes('');
      setDataVersion(v => v + 1);
    } catch (err: any) {
      setError(err?.message || 'Gagal mencatat barang keluar.');
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <p role="status" className="flex items-start gap-2 px-3 py-2 rounded-lg border bg-emerald-50 border-emerald-200 text-emerald-900 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
          <span className="flex-1">{feedback}</span>
          <button type="button" onClick={() => setFeedback('')} aria-label="Tutup pesan" className={`-m-1 p-1 rounded cursor-pointer ${FOCUS}`}>
            <X className="w-4 h-4" />
          </button>
        </p>
      )}
      {canRecord && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Catat barang keluar</h2>
            <p className="text-[11px] text-slate-600 mt-0.5">Tisu, sabun, ATK, gas, kemasan, dan barang operasional lain. Stok gudang langsung berkurang.</p>
          </div>

          {error && (
            <p role="alert" className="flex items-start gap-2 px-3 py-2 rounded-lg border bg-rose-50 border-rose-200 text-rose-900 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span>{error}</span>
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
            <div className="sm:col-span-5">
              <label htmlFor="op-item" className={FIELD_LABEL}>Barang</label>
              <div className="flex gap-2">
              <div className="flex-1 min-w-0">
              <SearchPicker
                id="op-item"
                value={itemId}
                options={options}
                onSelect={opt => opt && setItemId(opt.value)}
                placeholder={items.length === 0 ? 'Belum ada barang operasional di Master Barang' : 'Pilih barang'}
                searchPlaceholder="Cari tisu, sabun, HVS..."
                noun="barang"
              />
              </div>
              <ScanButton onResult={handleScan} hint="Arahkan ke QR label barang." />
              </div>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="op-qty" className={FIELD_LABEL}>Jumlah{selected ? ` (${selected.baseUnit})` : ''}</label>
              <input id="op-qty" type="number" min="0" step="any" inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} className={`${FIELD_INPUT} text-right font-mono tabular-nums`} />
            </div>
            <div className="sm:col-span-5">
              <label htmlFor="op-for" className={FIELD_LABEL}>Dipakai untuk / oleh</label>
              <input id="op-for" value={usedFor} onChange={e => setUsedFor(e.target.value)} placeholder="Contoh: Kantor, Area cuci, Pak Budi" className={FIELD_INPUT} />
            </div>
            <div className="sm:col-span-9">
              <label htmlFor="op-notes" className={FIELD_LABEL}>Catatan (opsional)</label>
              <input id="op-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: ganti tisu toilet" className={FIELD_INPUT} />
            </div>
            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                disabled={items.length === 0}
                className={`${BTN_PRIMARY} w-full`}
              >
                <PackageMinus className="w-4 h-4" />
                Catat keluar
              </button>
            </div>
          </div>
          {selected && (
            <p className="text-[11px] text-slate-600">
              Stok sekarang <span className="font-mono tabular-nums font-semibold text-slate-900">{fmt(selected.currentStock)} {selected.baseUnit}</span>
              {selected.currentStock <= selected.minimumStock && <span className="text-amber-800"> · sudah di bawah batas minimum</span>}
            </p>
          )}
        </form>
      )}

      {lowStock.length > 0 && (
        <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Stok menipis: {lowStock.map(i => `${i.name} (${fmt(i.currentStock)} ${i.baseUnit})`).join(', ')}.
        </p>
      )}

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Riwayat barang keluar</h2>
            <p className="text-[11px] text-slate-600 mt-0.5">{issued.length} catatan pada tanggal ini.</p>
          </div>
          {can('RECORD_CONSUMPTION') && (
            <button
              type="button"
              onClick={() => setIsPaperOpen(true)}
              disabled={items.length === 0}
              className={`${BTN_SECONDARY} self-start sm:self-auto`}
              title="Salin Form Pengambilan Non-Food (kertas) ke aplikasi">
              Input dari form kertas
            </button>
          )}
        </div>
        {issued.length === 0 ? (
          <p className="px-5 py-10 text-center text-xs text-slate-600">Belum ada barang operasional yang keluar pada tanggal ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 w-20">Jam</th>
                  <th className="py-2.5 px-4">Barang</th>
                  <th className="py-2.5 px-4 w-28 text-right">Jumlah</th>
                  <th className="py-2.5 px-4">Dipakai untuk</th>
                  <th className="py-2.5 px-4">Dicatat oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {issued.map(tx => (
                  <tr key={tx.id}>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-700">
                      {/* Kertas tidak mencatat jam, jadi jam buatan tidak ditampilkan. */}
                      {tx.referenceDocument?.startsWith(PAPER_FORM_REF_PREFIX) ? <span className="font-sans text-slate-600">Form</span> : tx.timestamp.slice(11, 16)}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{tx.itemName}</div>
                      {tx.notes && tx.notes !== 'Barang keluar operasional' && <div className="text-[11px] text-slate-600">{tx.notes}</div>}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {fmt(Math.abs(tx.quantity))} {tx.unit}
                    </td>
                    <td className="py-2.5 px-4 text-slate-800">{tx.location}</td>
                    <td className="py-2.5 px-4 text-slate-700">{tx.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isPaperOpen && (
        <PaperIssueFormDialog
          items={items}
          itemOptions={options}
          defaultDate={selectedDate}
          onClose={() => setIsPaperOpen(false)}
          onSaved={(message, date) => {
            setIsPaperOpen(false);
            setError('');
            setFeedback(message);
            onSelectDate(date);
            setDataVersion(v => v + 1);
          }}
        />
      )}
    </div>
  );
};
