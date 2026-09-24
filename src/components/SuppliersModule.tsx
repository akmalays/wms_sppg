import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { Supplier } from '../types/warehouse';
import { Building2, Search, Plus, Phone, MapPin, User, CheckCircle2, XCircle, Edit2, X } from 'lucide-react';

interface SuppliersModuleProps {
  onRefreshData?: () => void;
}

export const SuppliersModule: React.FC<SuppliersModuleProps> = ({ onRefreshData }) => {
  const { currentUser, can } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => warehouseDb.getSuppliers());
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  // Form State
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formSupplyCategory, setFormSupplyCategory] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  const refreshList = () => {
    setSuppliers(warehouseDb.getSuppliers());
    if (onRefreshData) onRefreshData();
  };

  const handleOpenNew = () => {
    setEditingSupplier(null);
    setFormId(`SUP-${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormContactPerson('');
    setFormPhone('');
    setFormAddress('');
    setFormSupplyCategory('Sembako & Beras');
    setFormIsActive(true);
    setFormNotes('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormId(sup.id);
    setFormName(sup.name);
    setFormContactPerson(sup.contactPerson);
    setFormPhone(sup.phone);
    setFormAddress(sup.address);
    setFormSupplyCategory(sup.supplyCategory);
    setFormIsActive(sup.isActive);
    setFormNotes(sup.notes || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    try {
      const isNew = !editingSupplier;
      const supplierToSave: Supplier = {
        id: formId.trim(),
        name: formName.trim(),
        contactPerson: formContactPerson.trim(),
        phone: formPhone.trim(),
        address: formAddress.trim(),
        supplyCategory: formSupplyCategory.trim(),
        isActive: formIsActive,
        notes: formNotes.trim() || undefined,
      };

      warehouseDb.saveSupplier(supplierToSave, currentUser, isNew);
      refreshList();
      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data supplier.');
    }
  };

  const filtered = suppliers.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.id.toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.contactPerson.toLowerCase().includes(q) ||
      s.supplyCategory.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Master Data Supplier / Pemasok</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              Mitra Pangan SPPG Jeru Tumpang
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar distributor sembako, sayur segar, protein hewani, dan rekanan logistik gizi.
          </p>
        </div>

        {can('MANAGE_SUPPLIERS') && (
          <button
            onClick={handleOpenNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Tambah Supplier Baru
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari ID supplier, nama perusahaan, kontak, atau kategori..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="text-xs text-slate-500 flex items-center">
          Total Rekanan: <span className="font-bold text-slate-800 ml-1">{suppliers.length}</span>
        </div>
      </div>

      {/* Supplier Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 italic bg-white rounded-xl border border-slate-200">
            Tidak ada supplier yang sesuai dengan pencarian.
          </div>
        ) : (
          filtered.map(sup => (
            <div
              key={sup.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">{sup.name}</h3>
                      <span className="text-[10px] font-mono text-slate-400">{sup.id}</span>
                    </div>
                  </div>
                  {sup.isActive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      <XCircle className="w-3 h-3" /> Nonaktif
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-600">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800">{sup.contactPerson}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono text-slate-700">{sup.phone}</span>
                  </div>
                  <div className="flex items-start gap-2 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-slate-600 line-clamp-2">{sup.address}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-xs font-medium text-slate-500 block mb-1">
                    Kategori Pasokan
                  </span>
                  <span className="inline-block px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                    {sup.supplyCategory}
                  </span>
                </div>
              </div>

              {can('MANAGE_SUPPLIERS') && (
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                  <button
                    onClick={() => handleOpenEdit(sup)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 p-1 rounded hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit Data
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* MODAL ADD / EDIT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">
                {editingSupplier ? 'Edit Data Supplier' : 'Tambah Supplier Baru'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2 bg-rose-50 text-rose-800 text-xs rounded border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveSupplier} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Supplier</label>
                  <input
                    type="text"
                    value={formId}
                    disabled={!!editingSupplier}
                    onChange={e => setFormId(e.target.value)}
                    className="w-full font-mono rounded border border-slate-300 p-2 text-slate-900 disabled:bg-slate-100 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formIsActive ? '1' : '0'}
                    onChange={e => setFormIsActive(e.target.value === '1')}
                    className="w-full rounded border border-slate-300 p-2 text-slate-800"
                  >
                    <option value="1">Aktif</option>
                    <option value="0">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Perusahaan / Toko</label>
                <input
                  type="text"
                  placeholder="Contoh: PT ABC Food Lestari"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full rounded border border-slate-300 p-2 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contact Person (PIC)</label>
                  <input
                    type="text"
                    placeholder="Nama staf sales"
                    value={formContactPerson}
                    onChange={e => setFormContactPerson(e.target.value)}
                    className="w-full rounded border border-slate-300 p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">No. Telepon / WhatsApp</label>
                  <input
                    type="text"
                    placeholder="0812-xxxx-xxxx"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    className="w-full rounded border border-slate-300 p-2 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori Pasokan Utama</label>
                <input
                  type="text"
                  placeholder="Contoh: Daging Ayam Segar, Sayur Mayur Organik..."
                  value={formSupplyCategory}
                  onChange={e => setFormSupplyCategory(e.target.value)}
                  className="w-full rounded border border-slate-300 p-2"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Gudang / Kantor</label>
                <textarea
                  rows={2}
                  placeholder="Alamat lengkap supplier..."
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  className="w-full rounded border border-slate-300 p-2"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  Simpan Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
