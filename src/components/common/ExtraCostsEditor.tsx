import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { BTN_SECONDARY, TABLE_INPUT } from './FormDialog';
import { EXTRA_COST_SUGGESTIONS, ExtraCost, newExtraCost, sumExtraCosts } from '../../utils/extraCosts';

interface ExtraCostsEditorProps {
  idPrefix: string;
  rows: ExtraCost[];
  onChange: (rows: ExtraCost[]) => void;
  /** Supplier yang bisa menagih. Kolom supplier hanya tampil bila lebih dari satu. */
  supplierOptions?: string[];
  defaultSupplier?: string;
}

// Nominal diketik bebas: "5000", "5.000", "Rp 5.000"
const parseAmount = (raw: string) => Number(raw.replace(/\D/g, '')) || 0;

export const ExtraCostsEditor: React.FC<ExtraCostsEditorProps> = ({ idPrefix, rows, onChange, supplierOptions = [], defaultSupplier }) => {
  const showSupplier = supplierOptions.length > 1;
  const total = sumExtraCosts(rows);
  const update = (id: string, patch: Partial<ExtraCost>) => onChange(rows.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const listId = `${idPrefix}-cost-suggestions`;
  const gridCols = showSupplier ? 'sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_9rem_2rem]' : 'sm:grid-cols-[minmax(0,1fr)_9rem_2rem]';

  // Baris baru langsung difokuskan: nominal bila keterangan sudah dipilih dari saran, keterangan bila belum
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(focusId)?.focus();
    setFocusId(null);
  }, [focusId]);

  const addRow = (label = '') => {
    const row = { ...newExtraCost(defaultSupplier), label };
    onChange([...rows, row]);
    setFocusId(`${idPrefix}-cost-${label ? 'amount' : 'label'}-${row.id}`);
  };

  // Saran yang belum dipakai, agar tombol cepat tidak menambah baris ganda tanpa sengaja
  const used = new Set(rows.map(r => r.label.trim().toLowerCase()));
  const quickLabels = EXTRA_COST_SUGGESTIONS.filter(s => !used.has(s.toLowerCase()));

  return (
    <section className="space-y-2" aria-labelledby={`${idPrefix}-cost-title`}>
      <div className="min-w-0">
        <h3 id={`${idPrefix}-cost-title`} className="text-sm font-semibold text-slate-800">
          Biaya tambahan <span className="font-normal text-slate-500">(opsional)</span>
        </h3>
        <p className="text-[11px] text-slate-600">
          Ongkos dari supplier di luar bahan, mis. selep atau kresek. Tidak masuk stok, tetapi ikut di nota dan laporan pengeluaran.
          {supplierOptions.length === 1 && <> Ditagih oleh {supplierOptions[0]}.</>}
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tambah biaya tambahan">
        {quickLabels.map(label => (
          <button key={label} type="button" onClick={() => addRow(label)} className={BTN_SECONDARY}>
            <Plus className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
            {label}
          </button>
        ))}
        <button type="button" onClick={() => addRow()} className={BTN_SECONDARY}>
          <Plus className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
          Biaya lain
        </button>
      </div>

      {rows.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className={`hidden sm:grid ${gridCols} gap-2 px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 text-[11px] font-medium text-slate-600`}>
            <span>Keterangan</span>
            {showSupplier && <span>Ditagih oleh</span>}
            <span className="text-right">Nominal</span>
            <span className="sr-only">Aksi</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {rows.map((r, idx) => {
              const label = r.label.trim() || `biaya ${idx + 1}`;
              // Supplier yang tersimpan tapi sudah tidak mengirim bahan dianggap belum dipilih
              const supplierValue = r.supplierName && supplierOptions.includes(r.supplierName) ? r.supplierName : '';
              const missingAmount = r.amount <= 0 && r.label.trim() !== '';
              const missingSupplier = showSupplier && r.amount > 0 && !supplierValue;
              const hintId = `${idPrefix}-cost-hint-${r.id}`;
              return (
                <li key={r.id} className="p-2.5 space-y-1">
                  <div className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:items-center ${gridCols}`}>
                    <input
                      id={`${idPrefix}-cost-label-${r.id}`}
                      type="text"
                      list={listId}
                      value={r.label}
                      onChange={e => update(r.id, { label: e.target.value })}
                      placeholder="Mis. selep"
                      aria-label={`Keterangan biaya tambahan ${idx + 1}`}
                      className={`${TABLE_INPUT} col-span-2 sm:col-span-1`}
                    />
                    {showSupplier && (
                      <select
                        value={supplierValue}
                        onChange={e => update(r.id, { supplierName: e.target.value })}
                        aria-label={`Supplier yang menagih ${label}`}
                        aria-invalid={missingSupplier || undefined}
                        aria-describedby={missingSupplier ? hintId : undefined}
                        className={`${TABLE_INPUT} col-span-2 sm:col-span-1 cursor-pointer ${missingSupplier ? 'border-amber-500!' : ''}`}
                      >
                        <option value="">Pilih supplier</option>
                        {supplierOptions.map(name => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">Rp</span>
                      <input
                        id={`${idPrefix}-cost-amount-${r.id}`}
                        type="text"
                        inputMode="numeric"
                        value={r.amount ? r.amount.toLocaleString('id-ID') : ''}
                        onChange={e => update(r.id, { amount: parseAmount(e.target.value) })}
                        placeholder="0"
                        aria-label={`Nominal ${label}`}
                        aria-invalid={missingAmount || undefined}
                        aria-describedby={missingAmount ? hintId : undefined}
                        className={`${TABLE_INPUT} pl-7 text-right font-mono tabular-nums ${missingAmount ? 'border-amber-500!' : ''}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onChange(rows.filter(x => x.id !== r.id))}
                      aria-label={`Hapus ${label}`}
                      title="Hapus biaya"
                      className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[30px] sm:min-h-[30px] text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {(missingAmount || missingSupplier) && (
                    <p id={hintId} className="text-[11px] text-amber-800">
                      {missingAmount ? 'Isi nominalnya. Baris tanpa nominal tidak ikut disimpan.' : 'Pilih supplier yang menagih biaya ini.'}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between gap-4 px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs">
            <span className="text-slate-700">Jumlah biaya tambahan</span>
            <span className="font-mono font-semibold tabular-nums text-slate-900">Rp {total.toLocaleString('id-ID')}</span>
          </div>
        </div>
      )}
      <datalist id={listId}>
        {EXTRA_COST_SUGGESTIONS.map(s => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </section>
  );
};
