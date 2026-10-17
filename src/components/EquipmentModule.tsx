import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { EquipmentCategory, EquipmentCondition, EquipmentItem, EquipmentStatus } from '../types/warehouse';
import { localDateIso } from '../utils/localDate';
import { Plus, Search } from 'lucide-react';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  FIELD_INPUT,
  FIELD_LABEL,
  FOCUS_RING,
  Feedback,
  FormDialog,
} from './common/FormDialog';

interface EquipmentModuleProps {
  onPrintLabel?: (assetId: string) => void;
}

// Nilai disimpan dalam kode bahasa Inggris (sesuai database); tampilan memakai label ini.
const CATEGORY_LABEL: Record<EquipmentCategory, string> = {
  'Kitchen Equipment': 'Alat masak',
  'Cleaning Equipment': 'Alat kebersihan',
  'Warehouse Equipment': 'Alat gudang',
  'Electronic Equipment': 'Elektronik',
};

const CONDITION_LABEL: Record<EquipmentCondition, string> = {
  GOOD: 'Baik',
  NEEDS_INSPECTION: 'Perlu dicek',
  DAMAGED: 'Rusak',
};

const CONDITION_BADGE: Record<EquipmentCondition, string> = {
  GOOD: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  NEEDS_INSPECTION: 'bg-amber-50 text-amber-800 border-amber-200',
  DAMAGED: 'bg-rose-50 text-rose-800 border-rose-200',
};

const STATUS_LABEL: Record<EquipmentStatus, string> = {
  ACTIVE: 'Dipakai',
  IN_REPAIR: 'Diservis',
  LOST: 'Hilang',
  RETIRED: 'Tidak dipakai lagi',
};

const daysSince = (iso: string) => {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const [ty, tm, td] = localDateIso().split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86400000);
};

const formatDate = (iso: string) => {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return '–';
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

type FormState = {
  id: string;
  name: string;
  category: EquipmentCategory;
  quantity: string;
  unit: string;
  location: string;
  condition: EquipmentCondition;
  notes: string;
};

export const EquipmentModule: React.FC<EquipmentModuleProps> = ({ onPrintLabel }) => {
  const { currentUser, can } = useAuth();
  const canManage = can('MANAGE_EQUIPMENT');
  const [version, setVersion] = useState(0);
  const equipment = useMemo(() => warehouseDb.getEquipment(), [version]);
  const [query, setQuery] = useState('');
  const [conditionFilter, setConditionFilter] = useState<'ALL' | EquipmentCondition>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | EquipmentCategory>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dialog cek kondisi
  const [checking, setChecking] = useState<EquipmentItem | null>(null);
  const [checkCondition, setCheckCondition] = useState<EquipmentCondition>('GOOD');
  const [checkStatus, setCheckStatus] = useState<EquipmentStatus>('ACTIVE');
  const [checkNote, setCheckNote] = useState('');
  const [checkError, setCheckError] = useState('');

  // Dialog tambah / ubah data
  const [editing, setEditing] = useState<{ isNew: boolean; original?: EquipmentItem } | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const onSync = () => setVersion(v => v + 1);
    window.addEventListener('sppg_storage_items_changed', onSync);
    window.addEventListener('sppg_warehouse_sync', onSync);
    return () => {
      window.removeEventListener('sppg_storage_items_changed', onSync);
      window.removeEventListener('sppg_warehouse_sync', onSync);
    };
  }, []);

  const counts = useMemo(
    () => ({
      ALL: equipment.length,
      GOOD: equipment.filter(e => e.condition === 'GOOD').length,
      NEEDS_INSPECTION: equipment.filter(e => e.condition === 'NEEDS_INSPECTION').length,
      DAMAGED: equipment.filter(e => e.condition === 'DAMAGED').length,
    }),
    [equipment]
  );

  const locations = useMemo(() => Array.from(new Set(equipment.map(e => e.location).filter(Boolean))).sort(), [equipment]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rank: Record<EquipmentCondition, number> = { DAMAGED: 0, NEEDS_INSPECTION: 1, GOOD: 2 };
    return equipment
      .filter(e => conditionFilter === 'ALL' || e.condition === conditionFilter)
      .filter(e => categoryFilter === 'ALL' || e.category === categoryFilter)
      .filter(e => !q || [e.id, e.name, e.location, e.notes || ''].some(v => v.toLowerCase().includes(q)))
      // Yang perlu tindakan (rusak, perlu dicek) di atas.
      .sort((a, b) => rank[a.condition] - rank[b.condition] || a.name.localeCompare(b.name, 'id'));
  }, [equipment, query, conditionFilter, categoryFilter]);

  const openCheck = (eq: EquipmentItem) => {
    setChecking(eq);
    setCheckCondition(eq.condition);
    setCheckStatus(eq.status);
    setCheckNote('');
    setCheckError('');
  };

  const saveCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checking) return;
    if (!checkNote.trim()) {
      setCheckError('Tulis hasil pemeriksaan singkat, misalnya "Api stabil, selang aman".');
      return;
    }
    try {
      warehouseDb.updateEquipmentCondition(checking.id, checkCondition, checkStatus, checkNote.trim(), currentUser);
      setFeedback({ type: 'success', text: `Hasil cek ${checking.name} tersimpan.` });
      setChecking(null);
      setVersion(v => v + 1);
    } catch (err: any) {
      setCheckError(err?.message || 'Gagal menyimpan hasil cek.');
    }
  };

  const openNew = () => {
    setEditing({ isNew: true });
    setForm({
      id: `EQ-${Date.now().toString().slice(-5)}`,
      name: '',
      category: 'Kitchen Equipment',
      quantity: '1',
      unit: 'Unit',
      location: '',
      condition: 'GOOD',
      notes: '',
    });
    setFormError('');
  };

  const openEdit = (eq: EquipmentItem) => {
    setEditing({ isNew: false, original: eq });
    setForm({
      id: eq.id,
      name: eq.name,
      category: eq.category,
      quantity: String(eq.quantity),
      unit: eq.unit,
      location: eq.location,
      condition: eq.condition,
      notes: eq.notes || '',
    });
    setFormError('');
  };

  const saveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !editing) return;
    const qty = Number(form.quantity);
    if (!form.name.trim() || !form.location.trim() || !form.unit.trim()) {
      setFormError('Nama, lokasi, dan satuan wajib diisi.');
      return;
    }
    if (!Number.isInteger(qty) || qty < 1) {
      setFormError('Jumlah harus bilangan bulat minimal 1.');
      return;
    }
    const base = editing.original;
    const item: EquipmentItem = {
      id: form.id.trim(),
      name: form.name.trim(),
      category: form.category,
      quantity: qty,
      unit: form.unit.trim(),
      location: form.location.trim(),
      condition: base ? base.condition : form.condition,
      status: base ? base.status : 'ACTIVE',
      assignedTo: base?.assignedTo,
      lastInspectedDate: base ? base.lastInspectedDate : localDateIso(),
      notes: form.notes.trim() || undefined,
    };
    try {
      warehouseDb.saveEquipment(item, currentUser, editing.isNew);
      setFeedback({ type: 'success', text: editing.isNew ? `${item.name} ditambahkan.` : `Data ${item.name} diperbarui.` });
      setEditing(null);
      setForm(null);
      setVersion(v => v + 1);
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan aset.');
    }
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));

  const conditionChips: { id: 'ALL' | EquipmentCondition; label: string }[] = [
    { id: 'ALL', label: 'Semua' },
    { id: 'DAMAGED', label: 'Rusak' },
    { id: 'NEEDS_INSPECTION', label: 'Perlu dicek' },
    { id: 'GOOD', label: 'Baik' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Aset Dapur</h1>
          <p className="text-xs text-slate-600 mt-0.5">Peralatan masak, kebersihan, dan gudang beserta kondisi dan lokasinya.</p>
        </div>
        {canManage && (
          <button type="button" onClick={openNew} className={BTN_PRIMARY}>
            <Plus className="w-4 h-4" />
            Tambah aset
          </button>
        )}
      </div>

      {feedback && <Feedback type={feedback.type} text={feedback.text} onClose={() => setFeedback(null)} />}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div role="tablist" aria-label="Kondisi" className="inline-flex p-1 rounded-lg bg-slate-200/70 text-xs self-start overflow-x-auto max-w-full">
          {conditionChips.map(c => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={conditionFilter === c.id}
              onClick={() => setConditionFilter(c.id)}
              className={`px-3 min-h-[44px] sm:min-h-[30px] rounded-md whitespace-nowrap cursor-pointer ${FOCUS_RING} ${
                conditionFilter === c.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-700 hover:text-slate-900 font-medium'
              }`}
            >
              {c.label} <span className="text-slate-500 font-normal">{counts[c.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            aria-label="Kategori"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value as 'ALL' | EquipmentCategory)}
            className={`${FIELD_INPUT} sm:w-44`}
          >
            <option value="ALL">Semua kategori</option>
            {(Object.keys(CATEGORY_LABEL) as EquipmentCategory[]).map(c => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <div className="relative sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Cari aset"
              placeholder="Cari nama, kode, atau lokasi"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className={`${FIELD_INPUT} pl-8`}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Aset</th>
                <th className="py-2.5 px-3 font-semibold">Lokasi</th>
                <th className="py-2.5 px-3 font-semibold text-right">Jumlah</th>
                <th className="py-2.5 px-3 font-semibold">Kondisi</th>
                <th className="py-2.5 px-3 font-semibold">Dicek terakhir</th>
                <th className="py-2.5 px-4 font-semibold text-right">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {equipment.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-600">
                    Belum ada aset terdaftar.{canManage && ' Tekan "Tambah aset" untuk mulai.'}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-600">
                    Tidak ada aset yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filtered.map(eq => {
                  const age = daysSince(eq.lastInspectedDate);
                  return (
                    <tr key={eq.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{eq.name}</div>
                        <div className="text-[11px] text-slate-600">
                          {CATEGORY_LABEL[eq.category] || eq.category} · <span className="font-mono">{eq.id}</span>
                          {eq.notes && <> · {eq.notes}</>}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">{eq.location}</td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span className="font-mono font-semibold text-slate-900">{eq.quantity}</span>{' '}
                        <span className="text-slate-600">{eq.unit}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-md border text-[11px] font-semibold ${CONDITION_BADGE[eq.condition]}`}>
                          {CONDITION_LABEL[eq.condition]}
                        </span>
                        {eq.status !== 'ACTIVE' && (
                          <div className="text-[11px] text-slate-600 mt-0.5">{STATUS_LABEL[eq.status]}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                        {formatDate(eq.lastInspectedDate)}
                        {age !== null && age > 0 && <div className="text-[11px] text-slate-600">{age} hari lalu</div>}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage && (
                            <button type="button" onClick={() => openCheck(eq)} className={BTN_SECONDARY}>
                              Cek kondisi
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => openEdit(eq)}
                              aria-label={`Ubah data ${eq.name}`}
                              className={`${BTN_SECONDARY} border-transparent bg-transparent hover:bg-slate-100`}
                            >
                              Ubah
                            </button>
                          )}
                          {onPrintLabel && (
                            <button
                              type="button"
                              onClick={() => onPrintLabel(eq.id)}
                              aria-label={`Cetak label ${eq.name}`}
                              className={`${BTN_SECONDARY} border-transparent bg-transparent hover:bg-slate-100`}
                            >
                              Label
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {checking && (
        <FormDialog
          title={`Cek kondisi: ${checking.name}`}
          description={`${checking.location} · terakhir dicek ${formatDate(checking.lastInspectedDate)}`}
          onClose={() => setChecking(null)}
          onSubmit={saveCheck}
          submitLabel="Simpan hasil cek"
          error={checkError}
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="chk-cond" className={FIELD_LABEL}>Kondisi</label>
              <select id="chk-cond" value={checkCondition} onChange={e => setCheckCondition(e.target.value as EquipmentCondition)} className={FIELD_INPUT}>
                {(Object.keys(CONDITION_LABEL) as EquipmentCondition[]).map(c => (
                  <option key={c} value={c}>{CONDITION_LABEL[c]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="chk-status" className={FIELD_LABEL}>Status</label>
              <select id="chk-status" value={checkStatus} onChange={e => setCheckStatus(e.target.value as EquipmentStatus)} className={FIELD_INPUT}>
                {(Object.keys(STATUS_LABEL) as EquipmentStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="chk-note" className={FIELD_LABEL}>Hasil pemeriksaan</label>
            <textarea
              id="chk-note"
              rows={3}
              value={checkNote}
              onChange={e => setCheckNote(e.target.value)}
              placeholder="Contoh: api stabil, selang gas aman"
              className={`${FIELD_INPUT} py-2`}
            />
            <p className="text-[11px] text-slate-600 mt-1">Tersimpan di Riwayat Aktivitas. Tanggal cek diperbarui ke hari ini.</p>
          </div>
        </FormDialog>
      )}

      {editing && form && (
        <FormDialog
          title={editing.isNew ? 'Tambah aset' : `Ubah data: ${editing.original?.name}`}
          description={editing.isNew ? undefined : 'Kondisi dan status diubah lewat "Cek kondisi".'}
          onClose={() => setEditing(null)}
          onSubmit={saveForm}
          submitLabel={editing.isNew ? 'Tambah aset' : 'Simpan perubahan'}
          error={formError}
        >
          <div>
            <label htmlFor="eq-name" className={FIELD_LABEL}>Nama aset</label>
            <input id="eq-name" type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Contoh: Kompor gas 2 tungku" className={FIELD_INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="eq-id" className={FIELD_LABEL}>Kode</label>
              <input id="eq-id" type="text" value={form.id} disabled={!editing.isNew} onChange={e => setField('id', e.target.value)} className={`${FIELD_INPUT} font-mono`} />
            </div>
            <div>
              <label htmlFor="eq-cat" className={FIELD_LABEL}>Kategori</label>
              <select id="eq-cat" value={form.category} onChange={e => setField('category', e.target.value as EquipmentCategory)} className={FIELD_INPUT}>
                {(Object.keys(CATEGORY_LABEL) as EquipmentCategory[]).map(c => (
                  <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="eq-qty" className={FIELD_LABEL}>Jumlah</label>
              <input id="eq-qty" type="number" min="1" step="1" inputMode="numeric" value={form.quantity} onChange={e => setField('quantity', e.target.value)} className={`${FIELD_INPUT} font-mono`} />
            </div>
            <div>
              <label htmlFor="eq-unit" className={FIELD_LABEL}>Satuan</label>
              <input id="eq-unit" type="text" value={form.unit} onChange={e => setField('unit', e.target.value)} className={FIELD_INPUT} />
            </div>
          </div>
          <div>
            <label htmlFor="eq-loc" className={FIELD_LABEL}>Lokasi</label>
            <input id="eq-loc" type="text" list="eq-locations" value={form.location} onChange={e => setField('location', e.target.value)} placeholder="Contoh: Dapur utama" className={FIELD_INPUT} />
            <datalist id="eq-locations">
              {locations.map(l => <option key={l} value={l} />)}
            </datalist>
          </div>
          {editing.isNew && (
            <div>
              <label htmlFor="eq-cond" className={FIELD_LABEL}>Kondisi awal</label>
              <select id="eq-cond" value={form.condition} onChange={e => setField('condition', e.target.value as EquipmentCondition)} className={FIELD_INPUT}>
                {(Object.keys(CONDITION_LABEL) as EquipmentCondition[]).map(c => (
                  <option key={c} value={c}>{CONDITION_LABEL[c]}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="eq-notes" className={FIELD_LABEL}>Catatan (opsional)</label>
            <input id="eq-notes" type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Merek, ukuran, garansi" className={FIELD_INPUT} />
          </div>
        </FormDialog>
      )}
    </div>
  );
};
