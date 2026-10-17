import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { Supplier } from '../types/warehouse';
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

interface SuppliersModuleProps {
  onNavigateToExpense?: (supplierId: string) => void;
}

type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

type FormState = Omit<Supplier, 'notes'> & { notes: string };

// Nomor lokal (08xx) diubah ke format internasional untuk tautan WhatsApp.
const toWhatsApp = (phone: string): string | null => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return null;
};

const formatDate = (iso: string) => {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const SuppliersModule: React.FC<SuppliersModuleProps> = ({ onNavigateToExpense }) => {
  const { currentUser, can } = useAuth();
  const canManage = can('MANAGE_SUPPLIERS');
  const [version, setVersion] = useState(0);
  const suppliers = useMemo(() => warehouseDb.getSuppliers(), [version]);
  const receivings = useMemo(() => warehouseDb.getReceivings(), [version]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editing, setEditing] = useState<{ isNew: boolean } | null>(null);
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

  // Riwayat pengiriman nyata dari dokumen penerimaan barang.
  const deliveryStats = useMemo(() => {
    const stats: Record<string, { count: number; last: string }> = {};
    suppliers.forEach(s => {
      const docs = receivings.filter(r => r.supplierId === s.id || r.supplierName.toLowerCase() === s.name.toLowerCase());
      stats[s.id] = {
        count: docs.length,
        last: docs.reduce((max, r) => (r.date > max ? r.date : max), ''),
      };
    });
    return stats;
  }, [suppliers, receivings]);

  const categories = useMemo(
    () => Array.from(new Set(suppliers.map(s => s.supplyCategory).filter(Boolean))).sort(),
    [suppliers]
  );

  const counts = {
    ACTIVE: suppliers.filter(s => s.isActive).length,
    INACTIVE: suppliers.filter(s => !s.isActive).length,
    ALL: suppliers.length,
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return suppliers
      .filter(s => statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? s.isActive : !s.isActive))
      .filter(s => !q || [s.id, s.name, s.contactPerson, s.phone, s.supplyCategory, s.address].some(v => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, 'id'));
  }, [suppliers, query, statusFilter]);

  const openNew = () => {
    setEditing({ isNew: true });
    setForm({
      id: `SUP-${Date.now().toString().slice(-5)}`,
      name: '',
      contactPerson: '',
      phone: '',
      address: '',
      supplyCategory: '',
      isActive: true,
      notes: '',
    });
    setFormError('');
  };

  const openEdit = (s: Supplier) => {
    setEditing({ isNew: false });
    setForm({ ...s, notes: s.notes || '' });
    setFormError('');
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => (prev ? { ...prev, [key]: value } : prev));

  const saveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !editing) return;
    const name = form.name.trim();
    // Banyak supplier lama belum punya kontak/alamat; hanya nama dan jenis pasokan yang wajib.
    if (!name || !form.supplyCategory.trim()) {
      setFormError('Nama usaha dan jenis pasokan wajib diisi.');
      return;
    }
    const duplicate = suppliers.find(s => s.id !== form.id && s.name.trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      setFormError(`Nama "${name}" sudah dipakai supplier ${duplicate.id}.`);
      return;
    }
    const supplier: Supplier = {
      id: form.id.trim(),
      name,
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      supplyCategory: form.supplyCategory.trim(),
      isActive: form.isActive,
      notes: form.notes.trim() || undefined,
    };
    try {
      warehouseDb.saveSupplier(supplier, currentUser, editing.isNew);
      setFeedback({ type: 'success', text: editing.isNew ? `${name} ditambahkan.` : `Data ${name} diperbarui.` });
      setEditing(null);
      setForm(null);
      setVersion(v => v + 1);
    } catch (err: any) {
      setFormError(err?.message || 'Gagal menyimpan supplier.');
    }
  };

  const statusTabs: { id: StatusFilter; label: string }[] = [
    { id: 'ACTIVE', label: 'Aktif' },
    { id: 'INACTIVE', label: 'Nonaktif' },
    { id: 'ALL', label: 'Semua' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Supplier</h1>
          <p className="text-xs text-slate-600 mt-0.5">Pemasok bahan pangan dan perlengkapan, beserta riwayat pengirimannya.</p>
        </div>
        {canManage && (
          <button type="button" onClick={openNew} className={BTN_PRIMARY}>
            <Plus className="w-4 h-4" />
            Tambah supplier
          </button>
        )}
      </div>

      {feedback && <Feedback type={feedback.type} text={feedback.text} onClose={() => setFeedback(null)} />}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div role="tablist" aria-label="Status supplier" className="inline-flex p-1 rounded-lg bg-slate-200/70 text-xs self-start">
          {statusTabs.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={statusFilter === t.id}
              onClick={() => setStatusFilter(t.id)}
              className={`px-3 min-h-[44px] sm:min-h-[30px] rounded-md whitespace-nowrap cursor-pointer ${FOCUS_RING} ${
                statusFilter === t.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-700 hover:text-slate-900 font-medium'
              }`}
            >
              {t.label} <span className="text-slate-500 font-normal">{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Cari supplier"
            placeholder="Cari nama, kontak, kategori, atau alamat"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={`${FIELD_INPUT} pl-8`}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Supplier</th>
                <th className="py-2.5 px-3 font-semibold">Kontak</th>
                <th className="py-2.5 px-3 font-semibold">Alamat</th>
                <th className="py-2.5 px-3 font-semibold">Pengiriman</th>
                <th className="py-2.5 px-4 font-semibold text-right">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-600">
                    Belum ada supplier terdaftar.{canManage && ' Tekan "Tambah supplier" untuk mulai.'}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-600">
                    Tidak ada supplier yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filtered.map(s => {
                  const wa = toWhatsApp(s.phone);
                  const stat = deliveryStats[s.id];
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50 ${s.isActive ? '' : 'text-slate-600'}`}>
                      <td className="py-2.5 px-4 align-top">
                        <div className="font-semibold text-slate-900">
                          {s.name}
                          {!s.isActive && (
                            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded-md border border-slate-300 bg-slate-100 text-[10px] font-medium text-slate-700 align-middle">
                              Nonaktif
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {s.supplyCategory} · <span className="font-mono">{s.id}</span>
                        </div>
                        {s.notes && <div className="text-[11px] text-slate-600 mt-0.5">{s.notes}</div>}
                      </td>
                      <td className="py-2.5 px-3 align-top">
                        {!s.contactPerson && !s.phone && <span className="text-slate-600">Belum diisi</span>}
                        {s.contactPerson && <div className="text-slate-900">{s.contactPerson}</div>}
                        {wa ? (
                          <a
                            href={`https://wa.me/${wa}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`font-mono text-emerald-800 underline underline-offset-2 hover:text-emerald-900 rounded ${FOCUS_RING}`}
                            aria-label={`WhatsApp ${s.contactPerson} ${s.phone}`}
                          >
                            {s.phone}
                          </a>
                        ) : (
                          s.phone && <span className="font-mono text-slate-700">{s.phone}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 align-top text-slate-800 max-w-[220px]">
                        {s.address ? <span className="line-clamp-2">{s.address}</span> : <span className="text-slate-600">Belum diisi</span>}
                      </td>
                      <td className="py-2.5 px-3 align-top whitespace-nowrap">
                        {stat && stat.count > 0 ? (
                          <>
                            <div className="text-slate-900">{stat.count} kali</div>
                            <div className="text-[11px] text-slate-600">Terakhir {formatDate(stat.last)}</div>
                          </>
                        ) : (
                          <span className="text-slate-600">Belum ada</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 align-top">
                        <div className="flex items-center justify-end gap-1.5">
                          {onNavigateToExpense && (
                            <button type="button" onClick={() => onNavigateToExpense(s.id)} className={BTN_SECONDARY}>
                              Nota kas keluar
                            </button>
                          )}
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => openEdit(s)}
                              aria-label={`Ubah data ${s.name}`}
                              className={`${BTN_SECONDARY} border-transparent bg-transparent hover:bg-slate-100`}
                            >
                              Ubah
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

      {editing && form && (
        <FormDialog
          title={editing.isNew ? 'Tambah supplier' : `Ubah data: ${form.name || form.id}`}
          onClose={() => setEditing(null)}
          onSubmit={saveForm}
          submitLabel={editing.isNew ? 'Tambah supplier' : 'Simpan perubahan'}
          error={formError}
        >
          <div>
            <label htmlFor="sup-name" className={FIELD_LABEL}>Nama usaha</label>
            <input id="sup-name" type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Contoh: UD Sumber Rejeki" className={FIELD_INPUT} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="sup-id" className={FIELD_LABEL}>Kode</label>
              <input id="sup-id" type="text" value={form.id} disabled={!editing.isNew} onChange={e => setField('id', e.target.value)} className={`${FIELD_INPUT} font-mono`} />
            </div>
            <div>
              <label htmlFor="sup-status" className={FIELD_LABEL}>Status</label>
              <select id="sup-status" value={form.isActive ? '1' : '0'} onChange={e => setField('isActive', e.target.value === '1')} className={FIELD_INPUT}>
                <option value="1">Aktif</option>
                <option value="0">Nonaktif</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="sup-cat" className={FIELD_LABEL}>Jenis pasokan</label>
            <input id="sup-cat" type="text" list="sup-categories" value={form.supplyCategory} onChange={e => setField('supplyCategory', e.target.value)} placeholder="Contoh: Sayur, Ayam, Sembako" className={FIELD_INPUT} />
            <datalist id="sup-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="sup-pic" className={FIELD_LABEL}>Nama kontak (opsional)</label>
              <input id="sup-pic" type="text" value={form.contactPerson} onChange={e => setField('contactPerson', e.target.value)} className={FIELD_INPUT} />
            </div>
            <div>
              <label htmlFor="sup-phone" className={FIELD_LABEL}>No. HP / WA (opsional)</label>
              <input id="sup-phone" type="tel" inputMode="tel" value={form.phone} onChange={e => setField('phone', e.target.value)} placeholder="08xx-xxxx-xxxx" className={`${FIELD_INPUT} font-mono`} />
            </div>
          </div>
          <div>
            <label htmlFor="sup-addr" className={FIELD_LABEL}>Alamat (opsional)</label>
            <textarea id="sup-addr" rows={2} value={form.address} onChange={e => setField('address', e.target.value)} className={`${FIELD_INPUT} py-2`} />
          </div>
          <div>
            <label htmlFor="sup-notes" className={FIELD_LABEL}>Catatan (opsional)</label>
            <input id="sup-notes" type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Jadwal kirim, syarat bayar, dll." className={FIELD_INPUT} />
          </div>
        </FormDialog>
      )}
    </div>
  );
};
