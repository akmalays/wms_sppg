import React from 'react';
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

  return (
    <section className="space-y-2" aria-labelledby={`${idPrefix}-cost-title`}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`${idPrefix}-cost-title`} className="text-sm font-semibold text-slate-800">
            Biaya tambahan <span className="font-normal text-slate-500">(opsional)</span>
          </h3>
          <p className="text-[11px] text-slate-600">
            Mis. selep, kresek, ongkos kirim dari supplier. Tidak masuk stok, tetapi tercatat sebagai pengeluaran dan ikut di nota.
          </p>
        </div>
        <button type="button" onClick={() => onChange([...rows, newExtraCost(defaultSupplier)])} className={`${BTN_SECONDARY} shrink-0`}>
          <Plus className="w-3.5 h-3.5 text-slate-500" />
          Tambah biaya
        </button>
      </div>

      {rows.length > 0 && (
        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
          {rows.map((r, idx) => {
            const label = r.label.trim() || `biaya ${idx + 1}`;
            return (
              <div
                key={r.id}
                className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 p-2.5 sm:items-center ${
                  showSupplier ? 'sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_9rem_auto]' : 'sm:grid-cols-[minmax(0,1fr)_9rem_auto]'
                }`}
              >
                <input
                  type="text"
                  list={listId}
                  value={r.label}
                  onChange={e => update(r.id, { label: e.target.value })}
                  placeholder="Keterangan, mis. Selep"
                  aria-label={`Keterangan biaya tambahan ${idx + 1}`}
                  className={`${TABLE_INPUT} col-span-2 sm:col-span-1`}
                />
                {showSupplier && (
                  <select
                    value={r.supplierName || ''}
                    onChange={e => update(r.id, { supplierName: e.target.value })}
                    aria-label={`Supplier yang menagih ${label}`}
                    aria-invalid={(r.amount > 0 && !r.supplierName) || undefined}
                    className={`${TABLE_INPUT} col-span-2 sm:col-span-1 cursor-pointer ${r.amount > 0 && !r.supplierName ? 'border-amber-400' : ''}`}
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
                    type="text"
                    inputMode="numeric"
                    value={r.amount ? r.amount.toLocaleString('id-ID') : ''}
                    onChange={e => update(r.id, { amount: parseAmount(e.target.value) })}
                    placeholder="0"
                    aria-label={`Nominal ${label}`}
                    className={`${TABLE_INPUT} pl-7 text-right font-mono tabular-nums`}
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
            );
          })}
          <div className="flex items-center justify-between gap-4 px-3 py-2 bg-slate-50 rounded-b-xl text-xs">
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
