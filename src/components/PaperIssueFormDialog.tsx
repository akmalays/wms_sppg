import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { warehouseDb } from '../db/storage';
import { ItemMaster } from '../types/warehouse';
import { localDateIso } from '../utils/localDate';
import { SearchPicker, PickerOption } from './common/SearchPicker';
import { DialogShell, FIELD_INPUT, FIELD_LABEL, TABLE_INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, FOCUS_RING } from './common/FormDialog';

/** Penanda transaksi yang disalin dari Form Pengambilan Non-Food (kertas). */
export const PAPER_FORM_REF_PREFIX = 'FORM-';
export const PAPER_FORM_NOTE = 'dari form kertas';

interface PaperRow {
  itemId: string;
  qty: string;
  volunteer: string;
  pic: string;
}

const emptyRow = (pic = ''): PaperRow => ({ itemId: '', qty: '', volunteer: '', pic });

const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

/**
 * Menyalin satu lembar Form Pengambilan Non-Food ke aplikasi. Kolomnya sama dengan kertas
 * (barang, qty, relawan, PIC), bisa diisi dengan keyboard saja, dan tanggalnya mengikuti kertas.
 */
export const PaperIssueFormDialog: React.FC<{
  items: ItemMaster[];
  itemOptions: PickerOption[];
  defaultDate: string;
  onClose: () => void;
  onSaved: (message: string, date: string) => void;
}> = ({ items, itemOptions, defaultDate, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const askConfirm = useConfirm();
  const today = localDateIso();
  const [date, setDate] = useState(defaultDate);
  const [rows, setRows] = useState<PaperRow[]>([emptyRow(currentUser?.name || '')]);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  // PIC bisa siapa saja yang bertugas di gudang hari itu, jadi daftar karyawan aktif ditambah teks bebas.
  const picOptions = useMemo(
    () =>
      warehouseDb
        .getEmployees()
        .filter(e => e.status === 'AKTIF')
        .map(e => ({ value: e.name, label: e.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    []
  );

  const itemById = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const filledRows = rows.filter(r => r.itemId || r.qty.trim() || r.volunteer.trim());

  // Stok dicek per barang, bukan per baris: dua baris tisu dijumlah dulu.
  const usedByItem = new Map<string, number>();
  filledRows.forEach(r => {
    const q = parseFloat(r.qty.replace(',', '.'));
    if (r.itemId && q > 0) usedByItem.set(r.itemId, (usedByItem.get(r.itemId) || 0) + q);
  });

  const rowProblem = (r: PaperRow): string => {
    if (!r.itemId) return 'Pilih barang';
    const q = parseFloat(r.qty.replace(',', '.'));
    if (!(q > 0)) return 'Isi qty';
    const item = itemById.get(r.itemId);
    if (item && (usedByItem.get(r.itemId) || 0) > item.currentStock) return `Stok tinggal ${fmt(item.currentStock)} ${item.baseUnit}`;
    if (!r.volunteer.trim()) return 'Isi nama relawan';
    if (!r.pic.trim()) return 'Isi PIC';
    return '';
  };

  const problems = filledRows.map(rowProblem).filter(Boolean);

  const updateRow = (idx: number, patch: Partial<PaperRow>) => setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const focusItem = (idx: number) => {
    // Tunggu baris baru dirender sebelum memindahkan fokus.
    requestAnimationFrame(() => document.getElementById(`paper-item-${idx}`)?.focus());
  };

  const addRow = () => {
    setRows(prev => [...prev, emptyRow(prev[prev.length - 1]?.pic || '')]);
    focusItem(rows.length);
  };

  // Enter pindah ke kolom berikutnya; Enter di relawan baris terakhir menambah baris baru.
  const onFieldKey = (e: React.KeyboardEvent, idx: number, field: 'qty' | 'volunteer') => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (field === 'qty') {
      document.getElementById(`paper-volunteer-${idx}`)?.focus();
    } else if (idx === rows.length - 1) {
      addRow();
    } else {
      focusItem(idx + 1);
    }
  };

  const handleClose = async () => {
    if (
      filledRows.length > 0 &&
      !(await askConfirm({
        title: 'Tutup tanpa menyimpan?',
        message: `${filledRows.length} baris yang sudah diketik akan hilang.`,
        confirmText: 'Tutup',
        variant: 'danger',
      }))
    )
      return;
    onClose();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setError('');
    if (!currentUser) return;
    if (filledRows.length === 0) return setError('Belum ada baris yang diisi.');
    if (problems.length > 0) return setError(`${problems.length} baris perlu dilengkapi.`);
    if (!date || date > today) return setError('Tanggal tidak boleh setelah hari ini.');

    const [y, m, d] = date.split('-').map(Number);
    // Jam pengambilan tidak ada di kertas; tengah hari dipakai agar tanggal tidak bergeser karena zona waktu.
    const occurredAt = new Date(y, m - 1, d, 12, 0, 0);
    const refBase = `${PAPER_FORM_REF_PREFIX}${date.replace(/-/g, '')}`;
    try {
      filledRows.forEach((r, i) => {
        warehouseDb.recordConsumption(
          r.itemId,
          parseFloat(r.qty.replace(',', '.')),
          r.volunteer.trim(),
          currentUser,
          `PIC: ${r.pic.trim()} · ${PAPER_FORM_NOTE}`,
          `${refBase}-${String(i + 1).padStart(2, '0')}`,
          occurredAt
        );
      });
      onSaved(`${filledRows.length} pengambilan dari form kertas tanggal ${date.split('-').reverse().join('/')} tersimpan.`, date);
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan. Sebagian baris mungkin sudah tersimpan, cek riwayat sebelum mengulang.');
    }
  };

  return (
    <DialogShell
      size="xl"
      title="Input dari form kertas"
      description="Salin Form Pengambilan Non-Food baris demi baris. Tab atau Enter untuk pindah kolom, Enter di kolom relawan baris terakhir untuk menambah baris."
      onClose={handleClose}
      onSubmit={handleSave}
      footer={
        <>
          <span className="mr-auto text-slate-700">
            {error ? <span className="text-rose-700 font-medium">{error}</span> : `${filledRows.length} baris terisi`}
          </span>
          <button type="button" onClick={handleClose} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
            Batal
          </button>
          <button type="submit" className={BTN_PRIMARY} disabled={filledRows.length === 0}>
            Simpan {filledRows.length > 0 ? `${filledRows.length} catatan` : ''}
          </button>
        </>
      }>
      <div className="sm:w-48">
        <label htmlFor="paper-date" className={FIELD_LABEL}>Tanggal di kertas</label>
        <input id="paper-date" type="date" value={date} max={today} onChange={e => setDate(e.target.value || today)} className={FIELD_INPUT} />
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="hidden sm:grid grid-cols-[2rem_1fr_7rem_10rem_10rem_2.25rem] gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600" aria-hidden="true">
          <span className="text-center">No</span>
          <span>Barang</span>
          <span>Qty</span>
          <span>Nama relawan</span>
          <span>PIC</span>
        </div>
        <ol className="divide-y divide-slate-100">
          {rows.map((r, idx) => {
            const item = itemById.get(r.itemId);
            const isFilled = !!(r.itemId || r.qty.trim() || r.volunteer.trim());
            const problem = submitted && isFilled ? rowProblem(r) : '';
            return (
              <li key={idx} className="grid grid-cols-[2rem_1fr_2.75rem] sm:grid-cols-[2rem_1fr_7rem_10rem_10rem_2.25rem] gap-2 px-3 py-2 items-start">
                <span className="pt-3 sm:pt-2 text-center font-mono text-slate-500">{idx + 1}</span>
                <div className="min-w-0">
                  <SearchPicker
                    id={`paper-item-${idx}`}
                    size="sm"
                    value={r.itemId}
                    options={itemOptions}
                    placeholder="Pilih barang"
                    searchPlaceholder="Ketik nama barang..."
                    ariaLabel={`Barang baris ${idx + 1}`}
                    noun="barang"
                    invalid={!!problem && !r.itemId}
                    onSelect={opt => {
                      if (!opt) return;
                      updateRow(idx, { itemId: opt.value });
                      requestAnimationFrame(() => document.getElementById(`paper-qty-${idx}`)?.focus());
                    }}
                  />
                  {problem && <p className="mt-1 text-[11px] text-rose-700">{problem}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setRows(prev => (prev.length === 1 ? [emptyRow(prev[0].pic)] : prev.filter((_, i) => i !== idx)))}
                  aria-label={`Hapus baris ${idx + 1}`}
                  title="Hapus baris"
                  className={`sm:order-last inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[30px] sm:min-h-[30px] rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer ${FOCUS_RING}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="col-start-2 col-span-2 sm:col-start-auto sm:col-span-1 flex items-center gap-1.5">
                  <input
                    id={`paper-qty-${idx}`}
                    type="text"
                    inputMode="decimal"
                    value={r.qty}
                    placeholder="0"
                    onChange={e => updateRow(idx, { qty: e.target.value })}
                    onKeyDown={e => onFieldKey(e, idx, 'qty')}
                    aria-label={`Qty baris ${idx + 1}`}
                    className={`${TABLE_INPUT} text-right font-mono tabular-nums`}
                  />
                  <span className="w-12 shrink-0 text-[11px] text-slate-600 truncate">{item?.baseUnit || ''}</span>
                </div>
                <input
                  id={`paper-volunteer-${idx}`}
                  type="text"
                  value={r.volunteer}
                  placeholder="Nama relawan"
                  onChange={e => updateRow(idx, { volunteer: e.target.value })}
                  onKeyDown={e => onFieldKey(e, idx, 'volunteer')}
                  aria-label={`Nama relawan baris ${idx + 1}`}
                  className={`${TABLE_INPUT} col-start-2 col-span-2 sm:col-start-auto sm:col-span-1`}
                />
                <div className="col-start-2 col-span-2 sm:col-start-auto sm:col-span-1">
                  <SearchPicker
                    size="sm"
                    allowCustom
                    noun="PIC"
                    value={r.pic}
                    options={picOptions}
                    placeholder="PIC"
                    searchPlaceholder="Cari nama PIC..."
                    ariaLabel={`PIC baris ${idx + 1}`}
                    onSelect={(opt, text) => updateRow(idx, { pic: opt ? opt.value : text })}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        <div className="px-3 py-2 border-t border-slate-100">
          <button type="button" onClick={addRow} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
            <Plus className="w-4 h-4 text-slate-500" />
            Tambah baris
          </button>
        </div>
      </div>
    </DialogShell>
  );
};
