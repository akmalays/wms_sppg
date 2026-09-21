import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { EquipmentCategory, EquipmentCondition, EquipmentItem, EquipmentStatus } from '../types/warehouse';
import { Wrench, CheckCircle2, AlertTriangle, XCircle, Search, Plus, QrCode, Edit3, X, Printer, ShieldCheck } from 'lucide-react';

interface EquipmentModuleProps {
  onRefreshData?: () => void;
}

export const EquipmentModule: React.FC<EquipmentModuleProps> = ({ onRefreshData }) => {
  const { currentUser, can } = useAuth();
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>(() => warehouseDb.getEquipment());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCondition, setFilterCondition] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Modals
  const [updatingItem, setUpdatingItem] = useState<EquipmentItem | null>(null);
  const [newCondition, setNewCondition] = useState<EquipmentCondition>('GOOD');
  const [newStatus, setNewStatus] = useState<EquipmentStatus>('ACTIVE');
  const [conditionNotes, setConditionNotes] = useState('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [labelItem, setLabelItem] = useState<EquipmentItem | null>(null);

  // New Equipment Form State
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<EquipmentCategory>('Kitchen Equipment');
  const [formQty, setFormQty] = useState<number>(1);
  const [formUnit, setFormUnit] = useState('Unit');
  const [formLocation, setFormLocation] = useState('Dapur Utama');
  const [formCondition, setFormCondition] = useState<EquipmentCondition>('GOOD');
  const [formStatus, setFormStatus] = useState<EquipmentStatus>('ACTIVE');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  const refreshData = () => {
    setEquipmentList(warehouseDb.getEquipment());
    if (onRefreshData) onRefreshData();
  };

  const handleOpenUpdate = (eq: EquipmentItem) => {
    setUpdatingItem(eq);
    setNewCondition(eq.condition);
    setNewStatus(eq.status);
    setConditionNotes(eq.notes || '');
  };

  const handleSaveCondition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!updatingItem) return;

    try {
      warehouseDb.updateEquipmentCondition(
        updatingItem.id,
        newCondition,
        newStatus,
        conditionNotes,
        currentUser
      );
      refreshData();
      setUpdatingItem(null);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status alat.');
    }
  };

  const handleOpenAdd = () => {
    setFormId(`EQ-${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormCategory('Kitchen Equipment');
    setFormQty(1);
    setFormUnit('Unit');
    setFormLocation('Dapur Utama');
    setFormCondition('GOOD');
    setFormStatus('ACTIVE');
    setFormNotes('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSaveNewEquipment = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    try {
      const newItem: EquipmentItem = {
        id: formId.trim(),
        name: formName.trim(),
        category: formCategory,
        quantity: Number(formQty),
        unit: formUnit.trim(),
        location: formLocation.trim(),
        condition: formCondition,
        status: formStatus,
        lastInspectedDate: new Date().toISOString().slice(0, 10),
        notes: formNotes.trim() || undefined,
      };

      warehouseDb.saveEquipment(newItem, currentUser, true);
      refreshData();
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menambahkan alat kerja.');
    }
  };

  // Metrics
  const totalItems = equipmentList.length;
  const goodCount = equipmentList.filter(e => e.condition === 'GOOD').length;
  const inspectionCount = equipmentList.filter(e => e.condition === 'NEEDS_INSPECTION').length;
  const damagedCount = equipmentList.filter(e => e.condition === 'DAMAGED').length;

  // Filtered List
  const filtered = equipmentList.filter(e => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      e.id.toLowerCase().includes(q) ||
      e.name.toLowerCase().includes(q) ||
      e.location.toLowerCase().includes(q);

    const matchesCond = filterCondition === 'ALL' || e.condition === filterCondition;
    const matchesCat = filterCategory === 'ALL' || e.category === filterCategory;

    return matchesSearch && matchesCond && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Peralatan Dapur & Alat Kerja (Equipment)</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              Aset Non-Konsumsi
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pelacakan fisik peralatan masak, alat saji gizi, dan sanitasi berdasarkan ID unit, lokasi, dan riwayat kondisi.
          </p>
        </div>

        {can('MANAGE_EQUIPMENT') && (
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Daftarkan Alat Baru
          </button>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500">Total Alat Tercatat</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalItems}</div>
          <span className="text-[10px] text-slate-400">Unit terdaftar di SPPG</span>
        </div>

        <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Kondisi Baik (Good)
          </span>
          <div className="text-2xl font-black text-emerald-900 mt-1">{goodCount}</div>
          <span className="text-[10px] text-emerald-700">Siap operasional masak</span>
        </div>

        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> Perlu Inspeksi
          </span>
          <div className="text-2xl font-black text-amber-900 mt-1">{inspectionCount}</div>
          <span className="text-[10px] text-amber-700">Pemeriksaan teknis terjadwal</span>
        </div>

        <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-rose-800 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> Rusak / Perbaikan
          </span>
          <div className="text-2xl font-black text-rose-900 mt-1">{damagedCount}</div>
          <span className="text-[10px] text-rose-700">Dalam penanganan servis</span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari ID alat, nama perlengkapan, atau lokasi..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="Kitchen Equipment">Kitchen Equipment</option>
            <option value="Cleaning Equipment">Cleaning Equipment</option>
            <option value="Warehouse Equipment">Warehouse Equipment</option>
            <option value="Electronic Equipment">Electronic Equipment</option>
          </select>

          <select
            value={filterCondition}
            onChange={e => setFilterCondition(e.target.value)}
            className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Kondisi</option>
            <option value="GOOD">Baik (Good)</option>
            <option value="NEEDS_INSPECTION">Perlu Inspeksi</option>
            <option value="DAMAGED">Rusak (Damaged)</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Asset ID</th>
                <th className="py-3 px-4">Nama Alat</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-center">Jumlah Unit</th>
                <th className="py-3 px-4">Lokasi Penempatan</th>
                <th className="py-3 px-4">Kondisi Fisik</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Inspeksi Terakhir</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    Tidak ada peralatan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filtered.map(eq => (
                  <tr key={eq.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {eq.id}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{eq.name}</div>
                      {eq.notes && <div className="text-[10px] text-slate-500 italic">{eq.notes}</div>}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{eq.category}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                      {eq.quantity} {eq.unit}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-medium">{eq.location}</td>
                    <td className="py-3 px-4">
                      {eq.condition === 'GOOD' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> GOOD
                        </span>
                      )}
                      {eq.condition === 'NEEDS_INSPECTION' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                          <AlertTriangle className="w-3 h-3" /> NEEDS INSPECTION
                        </span>
                      )}
                      {eq.condition === 'DAMAGED' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                          <XCircle className="w-3 h-3" /> DAMAGED
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {eq.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {eq.lastInspectedDate}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setLabelItem(eq)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                          title="Lihat Label QR Aset"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>
                        {can('MANAGE_EQUIPMENT') && (
                          <button
                            onClick={() => handleOpenUpdate(eq)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition-colors cursor-pointer"
                            title="Update kondisi alat"
                          >
                            <Edit3 className="w-3 h-3" />
                            Update Kondisi
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPDATE CONDITION MODAL */}
      {updatingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                Update Kondisi & Status Alat
              </h3>
              <button
                onClick={() => setUpdatingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCondition} className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-mono text-[11px] font-bold text-slate-500">{updatingItem.id}</div>
                <div className="font-bold text-slate-900 text-sm">{updatingItem.name}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">{updatingItem.location}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kondisi Alat</label>
                <select
                  value={newCondition}
                  onChange={e => setNewCondition(e.target.value as EquipmentCondition)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-800 font-semibold"
                >
                  <option value="GOOD">GOOD (Baik, Siap Digunakan)</option>
                  <option value="NEEDS_INSPECTION">NEEDS_INSPECTION (Perlu Pemeriksaan)</option>
                  <option value="DAMAGED">DAMAGED (Rusak / Kendala Teknis)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Operasional</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as EquipmentStatus)}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-800 font-semibold"
                >
                  <option value="ACTIVE">ACTIVE (Aktif)</option>
                  <option value="IN_REPAIR">IN_REPAIR (Sedang Diservis)</option>
                  <option value="LOST">LOST (Hilang)</option>
                  <option value="RETIRED">RETIRED (Afkir / Dikeluarkan)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Inspeksi / Alasan Perubahan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={conditionNotes}
                  onChange={e => setConditionNotes(e.target.value)}
                  placeholder="Jelaskan kondisi komponen atau tindak lanjut teknis..."
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 text-slate-800 focus:ring-1 focus:ring-amber-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUpdatingItem(null)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  Simpan & Catat di Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSET LABEL / QR PREVIEW MODAL */}
      {labelItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">Pratinjau Label Aset SPPG</span>
              <button onClick={() => setLabelItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="my-5 p-4 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="text-left">
                  <div className="text-[11px] font-bold text-emerald-800">SPPG Gudang & Dapur</div>
                  <div className="text-xs font-black text-slate-800">{labelItem.id}</div>
                </div>
                <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
              </div>

              <div className="text-left">
                <div className="text-sm font-bold text-slate-900 leading-tight">{labelItem.name}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Kategori: <span className="font-semibold text-slate-700">{labelItem.category}</span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Lokasi: <span className="font-semibold text-slate-700">{labelItem.location}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 text-[9px] font-mono text-slate-400">
                PROPERTY OF SATUAN PELAYANAN PEMENUHAN GIZI
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Label Fisik
            </button>
          </div>
        </div>
      )}

      {/* ADD EQUIPMENT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900">Daftarkan Peralatan Kerja Baru</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-2 bg-rose-50 text-rose-800 text-xs rounded border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveNewEquipment} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Asset ID (e.g. EQ-KIT-001)</label>
                  <input
                    type="text"
                    value={formId}
                    onChange={e => setFormId(e.target.value)}
                    className="w-full font-mono font-bold rounded border border-slate-300 p-2 text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as EquipmentCategory)}
                    className="w-full rounded border border-slate-300 p-2 text-slate-800"
                  >
                    <option value="Kitchen Equipment">Kitchen Equipment</option>
                    <option value="Cleaning Equipment">Cleaning Equipment</option>
                    <option value="Warehouse Equipment">Warehouse Equipment</option>
                    <option value="Electronic Equipment">Electronic Equipment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Alat Lengkap</label>
                <input
                  type="text"
                  placeholder="Contoh: Kompor Gas 4 Tungku, Wok Kuali 60cm..."
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full rounded border border-slate-300 p-2 text-slate-900 font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jumlah</label>
                  <input
                    type="number"
                    min="1"
                    value={formQty}
                    onChange={e => setFormQty(parseInt(e.target.value) || 1)}
                    className="w-full font-mono rounded border border-slate-300 p-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    className="w-full rounded border border-slate-300 p-2"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Penempatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Dapur Utama - Jalur Masak 1"
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  className="w-full rounded border border-slate-300 p-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kondisi Awal</label>
                  <select
                    value={formCondition}
                    onChange={e => setFormCondition(e.target.value as EquipmentCondition)}
                    className="w-full rounded border border-slate-300 p-2"
                  >
                    <option value="GOOD">GOOD</option>
                    <option value="NEEDS_INSPECTION">NEEDS_INSPECTION</option>
                    <option value="DAMAGED">DAMAGED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as EquipmentStatus)}
                    className="w-full rounded border border-slate-300 p-2"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="IN_REPAIR">IN_REPAIR</option>
                    <option value="LOST">LOST</option>
                    <option value="RETIRED">RETIRED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  placeholder="Merek, garansi, spesifikasi teknis..."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full rounded border border-slate-300 p-2"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs"
                >
                  Daftarkan Alat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
