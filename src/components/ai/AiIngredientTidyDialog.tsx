import React, { useState } from 'react';
import { FormDialog, FIELD_INPUT } from '../common/FormDialog';
import { Select } from '../common/Select';
import type { IngredientNutritionInfo } from '../../db/websiteConfigStorage';
import type { AiIngredientSuggestion } from '../../utils/aiAssist';

const CATEGORY_LABEL: Record<string, string> = {
  karbohidrat: 'Karbohidrat',
  protein_hewani: 'Protein hewani',
  protein_nabati: 'Protein nabati',
  sayuran: 'Sayuran',
  buah: 'Buah',
  pelengkap: 'Pelengkap',
};

interface Row {
  id: string;
  source: string;
  keep: boolean;
  name: string;
  category: string;
  reason: string;
}

// Usulan AI untuk daftar bahan. Tidak ada yang berubah sebelum petugas menekan Terapkan, dan isi lain tiap bahan tetap.
export const AiIngredientTidyDialog: React.FC<{
  ingredients: IngredientNutritionInfo[];
  suggestions: AiIngredientSuggestion[];
  onApply: (next: IngredientNutritionInfo[]) => void;
  onClose: () => void;
}> = ({ ingredients, suggestions, onApply, onClose }) => {
  const [rows, setRows] = useState<Row[]>(() =>
    ingredients.map(item => {
      const hit = suggestions.find(s => s.source.trim().toLowerCase() === item.name.trim().toLowerCase());
      return {
        id: item.id,
        source: item.name,
        keep: hit ? hit.keep : true,
        name: hit?.name.trim() || item.name,
        // Kategori di luar daftar pilihan tidak dipakai, supaya Select tidak menampilkan isian kosong.
        category: hit && CATEGORY_LABEL[hit.category] ? hit.category : item.category,
        reason: hit?.reason || 'Tidak ada usulan AI',
      };
    })
  );
  const patch = (id: string, change: Partial<Row>) => setRows(prev => prev.map(r => (r.id === id ? { ...r, ...change } : r)));
  const kept = rows.filter(r => r.keep);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const byId = new Map(rows.map(r => [r.id, r]));
    onApply(
      ingredients
        .filter(i => byId.get(i.id)?.keep)
        .map(i => {
          const r = byId.get(i.id)!;
          return { ...i, name: r.name.trim() || i.name, category: r.category as IngredientNutritionInfo['category'] };
        })
    );
  };

  return (
    <FormDialog
      title="Rapikan daftar bahan"
      description="Usulan AI dari data belanja. Periksa dulu; perubahan baru tampil di halaman publik setelah kamu klik Simpan."
      onClose={onClose}
      onSubmit={submit}
      submitLabel={`Terapkan ${kept.length} bahan`}
      submitDisabled={kept.length === 0}
    >
      <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
        {rows.map(r => (
          <li key={r.id} className={`p-3 ${r.keep ? '' : 'bg-slate-50'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex items-center gap-2 min-h-[44px] sm:min-h-[28px] text-xs font-medium text-slate-800 cursor-pointer min-w-0">
                <input type="checkbox" checked={r.keep} onChange={e => patch(r.id, { keep: e.target.checked })} className="w-4 h-4 accent-emerald-700 shrink-0" />
                <span className="truncate">{r.source}</span>
              </label>
              <span className="text-[11px] text-slate-600">{r.reason}</span>
            </div>
            {r.keep ? (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input aria-label={`Nama tampil untuk ${r.source}`} type="text" value={r.name} onChange={e => patch(r.id, { name: e.target.value })} className={FIELD_INPUT} />
                <Select aria-label={`Kategori ${r.source}`} size="sm" value={r.category} onChange={e => patch(r.id, { category: e.target.value })}>
                  {!CATEGORY_LABEL[r.category] && <option value={r.category}>{r.category || 'Belum ada kategori'}</option>}
                  {Object.entries(CATEGORY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </div>
            ) : (
              <p className="mt-1 text-[11px] text-slate-600">Dihapus dari daftar di halaman publik.</p>
            )}
          </li>
        ))}
      </ul>
    </FormDialog>
  );
};
