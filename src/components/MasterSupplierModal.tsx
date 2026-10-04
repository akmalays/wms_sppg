import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Search,
  Plus,
  Edit2,
  X,
  Phone,
  MapPin,
  User as UserIcon,
  CheckCircle2,
  XCircle,
  CreditCard,
  FileText,
  Check,
  AlertCircle,
  ArrowUpDown,
  Tag,
  Store
} from 'lucide-react';
import { Supplier, User } from '../types/warehouse';
import { warehouseDb } from '../db/storage';

export interface MasterSupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuppliersUpdated?: () => void;
  currentUser: User;
}

const COMMON_SUPPLY_CATEGORIES = [
  'Sayuran Segar',
  'Protein & Unggas',
  'Sembako & Beras',
  'Buah Segar',
  'Ikan & Seafood',
  'Bumbu & Rempah',
  'Hygiene & Cleaning',
  'Peralatan & Kemasan',
  'Lain-lain',
];

export const MasterSupplierModal: React.FC<MasterSupplierModalProps> = ({
  isOpen,
  onClose,
  onSuppliersUpdated,
  currentUser,
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Sayuran Segar');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formBankInfo, setFormBankInfo] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const [formError, setFormError] = useState('');
  const [feedbackToast, setFeedbackToast] = useState('');

  // Load suppliers on open
  const loadSuppliers = () => {
    const list = warehouseDb.getSuppliers();
    setSuppliers(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadSuppliers();
      setIsFormOpen(false);
      setEditingSupplier(null);
      setFormError('');
    }
  }, [isOpen]);

  const showNotification = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(''), 3500);
  };

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    // Generate next supplier ID based on max existing numeric suffix
    const currentList = warehouseDb.getSuppliers();
    let nextNum = currentList.length + 1;
    let newId = `SUP-${String(nextNum).padStart(3, '0')}`;
    while (currentList.some(s => s.id.toLowerCase() === newId.toLowerCase())) {
      nextNum++;
      newId = `SUP-${String(nextNum).padStart(3, '0')}`;
    }

    setFormId(newId);
    setFormName('');
    setFormCategory('Sayuran Segar');
    setFormCustomCategory('');
    setFormContactPerson('');
    setFormPhone('');
    setFormAddress('');
    setFormBankInfo('');
    setFormNotes('');
    setFormIsActive(true);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormId(sup.id);
    setFormName(sup.name);

    if (COMMON_SUPPLY_CATEGORIES.includes(sup.supplyCategory)) {
      setFormCategory(sup.supplyCategory);
      setFormCustomCategory('');
    } else {
      setFormCategory('Lain-lain');
      setFormCustomCategory(sup.supplyCategory);
    }

    setFormContactPerson(sup.contactPerson || '');
    setFormPhone(sup.phone || '');
    setFormAddress(sup.address || '');

    // Extract bank info if saved in notes format
    let cleanNotes = sup.notes || '';
    let bankInfo = '';
    const rekMatch = cleanNotes.match(/Rek:\s*([^|]+)/i);
    if (rekMatch) {
      bankInfo = rekMatch[1].trim();
      cleanNotes = cleanNotes.replace(/\|\s*Rek:[^|]+/i, '').replace(/Rek:[^|]+/i, '').trim();
    }

    setFormBankInfo(bankInfo);
    setFormNotes(cleanNotes);
    setFormIsActive(sup.isActive);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Nama rekanan / supplier wajib diisi.');
      return;
    }
    if (!formId.trim()) {
      setFormError('Kode supplier wajib diisi.');
      return;
    }

    const finalCategory =
      formCategory === 'Lain-lain' && formCustomCategory.trim()
        ? formCustomCategory.trim()
        : formCategory;

    let combinedNotes = formNotes.trim();
    if (formBankInfo.trim()) {
      combinedNotes = combinedNotes
        ? `${combinedNotes} | Rek: ${formBankInfo.trim()}`
        : `Rek: ${formBankInfo.trim()}`;
    }

    const isNew = !editingSupplier;
    const payload: Supplier = {
      id: formId.trim(),
      name: formName.trim(),
      contactPerson: formContactPerson.trim() || 'Bagian Penjualan',
      phone: formPhone.trim() || '-',
      address: formAddress.trim() || '-',
      supplyCategory: finalCategory || 'Umum',
      isActive: formIsActive,
      notes: combinedNotes || undefined,
    };

    try {
      warehouseDb.saveSupplier(payload, currentUser, isNew);
      loadSuppliers();
      setIsFormOpen(false);
      showNotification(
        isNew
          ? `Supplier "${payload.name}" berhasil ditambahkan ke database master.`
          : `Data supplier "${payload.name}" berhasil diperbarui.`
      );
      if (onSuppliersUpdated) {
        onSuppliersUpdated();
      }
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data supplier.');
    }
  };

  const handleToggleStatus = (sup: Supplier) => {
    const updated: Supplier = {
      ...sup,
      isActive: !sup.isActive,
    };
    try {
      warehouseDb.saveSupplier(updated, currentUser, false);
      loadSuppliers();
      showNotification(
        `Status supplier "${sup.name}" diubah menjadi ${updated.isActive ? 'Aktif' : 'Nonaktif'}.`
      );
      if (onSuppliersUpdated) onSuppliersUpdated();
    } catch (err: any) {
      showNotification(`Gagal mengubah status: ${err.message}`);
    }
  };


  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter(s => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.supplyCategory.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        (s.notes && s.notes.toLowerCase().includes(q));

      const matchCategory =
        categoryFilter === 'ALL' ||
        s.supplyCategory.toLowerCase() === categoryFilter.toLowerCase();

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && s.isActive) ||
        (statusFilter === 'INACTIVE' && !s.isActive);

      return matchQuery && matchCategory && matchStatus;
    });
  }, [suppliers, searchQuery, categoryFilter, statusFilter]);

  // Unique categories list
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach(s => {
      if (s.supplyCategory) set.add(s.supplyCategory);
    });
    return Array.from(set);
  }, [suppliers]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 shadow-2xs">
              <Building2 className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  Master Data Supplier & Rekanan
                </h2>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {suppliers.length} Terdaftar
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola direktori mitra supplier pangan, kontak PIC, dan kategori pasokan gudang SPPG
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notification */}
        {feedbackToast && (
          <div className="mx-5 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in shrink-0">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {/* Modal Main Content Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Action Bar & Filters (hidden when form is open, or kept compact) */}
          {!isFormOpen && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari ID, nama toko, PIC, telp, alamat..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">Semua Kategori ({suppliers.length})</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <div className="flex items-center bg-white border border-slate-300 rounded-lg p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-2 py-1 rounded font-medium transition-colors ${
                      statusFilter === 'ALL'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('ACTIVE')}
                    className={`px-2 py-1 rounded font-medium transition-colors ${
                      statusFilter === 'ACTIVE'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Aktif
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatusFilter('INACTIVE')}
                    className={`px-2 py-1 rounded font-medium transition-colors ${
                      statusFilter === 'INACTIVE'
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Nonaktif
                  </button>
                </div>
              </div>

              {/* Add Supplier Button */}
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Supplier Baru</span>
              </button>
            </div>
          )}

          {/* ADD / EDIT FORM VIEW */}
          {isFormOpen && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-xs animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                    {editingSupplier ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {editingSupplier
                        ? `Edit Data Supplier (${editingSupplier.id})`
                        : 'Tambah Rekanan / Supplier Baru'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {editingSupplier
                        ? 'Perbarui informasi kontak, alamat, atau rekening supplier rekanan'
                        : 'Daftarkan mitra penyedia bahan pangan ke master database gudang SPPG'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
                {/* Row 1: ID, Nama, Status */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Kode Supplier
                    </label>
                    <input
                      type="text"
                      value={formId}
                      disabled={!!editingSupplier}
                      onChange={e => setFormId(e.target.value)}
                      placeholder="SUP-001"
                      className="w-full font-mono font-bold px-3 py-2 rounded-lg border border-slate-300 text-slate-900 disabled:bg-slate-200/70 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nama Perusahaan / Toko / Kelompok Tani <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="Contoh: CV Berkah Pangan Mandiri / Toko Subur Makmur"
                      className="w-full font-semibold px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block font-semibold text-slate-700 mb-1">
                      Status Rekanan
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formIsActive}
                          onChange={e => setFormIsActive(e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-bold text-slate-800">
                          {formIsActive ? 'Aktif (Bisa Dipilih)' : 'Nonaktif'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Row 2: Kategori Pasokan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Kategori Pasokan Utama <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {COMMON_SUPPLY_CATEGORIES.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formCategory === 'Lain-lain' && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Tentukan Kategori Kustom
                      </label>
                      <input
                        type="text"
                        value={formCustomCategory}
                        onChange={e => setFormCustomCategory(e.target.value)}
                        placeholder="Ketik kategori pasokan..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        required
                      />
                    </div>
                  )}

                  <div className={formCategory === 'Lain-lain' ? 'sm:col-span-2' : ''}>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nama Contact Person (PIC)
                    </label>
                    <input
                      type="text"
                      value={formContactPerson}
                      onChange={e => setFormContactPerson(e.target.value)}
                      placeholder="Nama staf sales / pemilik / penanggung jawab"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Row 3: No Telp & Rekening Bank */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nomor Telepon / WhatsApp
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={e => setFormPhone(e.target.value)}
                      placeholder="Contoh: 0812-3456-7890"
                      className="w-full font-mono px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Informasi Rekening Bank (Untuk Pembayaran / BKK)
                    </label>
                    <input
                      type="text"
                      value={formBankInfo}
                      onChange={e => setFormBankInfo(e.target.value)}
                      placeholder="Contoh: BCA 1234567890 a/n CV Berkah Pangan"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Row 4: Alamat */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Alamat Lengkap Toko / Gudang
                  </label>
                  <textarea
                    rows={2}
                    value={formAddress}
                    onChange={e => setFormAddress(e.target.value)}
                    placeholder="Alamat kantor, nomor kios, atau lokasi gudang pemasok..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Row 5: Catatan Tambahan */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Catatan Kerjasama & Ketentuan Pengiriman
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Contoh: Jadwal kirim tiap jam 05.00 pagi, toleransi tempo 7 hari..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Form Buttons */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-700 font-semibold hover:bg-slate-200/70 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    {editingSupplier ? 'Simpan Perubahan' : 'Tambah Supplier Baru'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUPPLIERS TABLE & CARD LIST */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>
                Menampilkan{' '}
                <strong className="text-slate-800">{filteredSuppliers.length}</strong> dari{' '}
                {suppliers.length} supplier rekanan
              </span>
            </div>

            {filteredSuppliers.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-3">
                <Store className="w-10 h-10 text-slate-400 mx-auto" />
                <div className="text-sm font-bold text-slate-700">
                  Tidak Ada Supplier yang Sesuai
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Silakan sesuaikan kata kunci pencarian atau tambah rekanan baru dengan tombol di atas.
                </p>
                {!isFormOpen && (
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Supplier Baru
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredSuppliers.map(sup => (
                  <div
                    key={sup.id}
                    className={`bg-white border rounded-xl p-4 shadow-2xs transition-all flex flex-col justify-between ${
                      sup.isActive
                        ? 'border-slate-200 hover:border-slate-300'
                        : 'border-slate-200/80 bg-slate-50/50 opacity-75'
                    }`}
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                              sup.isActive
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-xs text-slate-900 leading-snug">
                                {sup.name}
                              </h3>
                              <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                {sup.id}
                              </span>
                            </div>
                            <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                              {sup.supplyCategory}
                            </span>
                          </div>
                        </div>

                        {/* Status Toggle Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(sup)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full transition-colors cursor-pointer shrink-0 ${
                            sup.isActive
                              ? 'bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200/70'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                          title="Klik untuk beralih status Aktif / Nonaktif"
                        >
                          {sup.isActive ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              <span>Aktif</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-slate-500" />
                              <span>Nonaktif</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Contact & Address Details */}
                      <div className="mt-3 space-y-1.5 text-xs">
                        <div className="flex items-center gap-2 text-slate-600">
                          <UserIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium text-slate-800 truncate">
                            {sup.contactPerson || '-'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-slate-700">
                            {sup.phone || '-'}
                          </span>
                        </div>
                        <div className="flex items-start gap-2 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="text-slate-600 line-clamp-1">
                            {sup.address || '-'}
                          </span>
                        </div>
                        {sup.notes && (
                          <div className="flex items-start gap-2 text-slate-500 pt-1 border-t border-slate-100 text-[11px]">
                            <FileText className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                            <span className="line-clamp-1 italic">{sup.notes}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(sup)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit data rekanan ini"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit Data</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            Data master supplier digunakan otomatis pada formulir penerimaan barang dan nota pesanan.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 font-semibold text-slate-800 transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
