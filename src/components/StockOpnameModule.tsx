import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { ItemMaster, StockOpnameSession, StockOpnameItem } from '../types/warehouse';
import { Plus, CheckCircle, AlertTriangle, ClipboardCheck, ArrowRight, Eye, X, ShieldAlert } from 'lucide-react';

interface StockOpnameModuleProps {
  onRefreshData?: () => void;
}

export const StockOpnameModule: React.FC<StockOpnameModuleProps> = ({ onRefreshData }) => {
  const { currentUser, can } = useAuth();
  const [opnames, setOpnames] = useState<StockOpnameSession[]>(() => warehouseDb.getOpnames());
  const [items] = useState<ItemMaster[]>(() => warehouseDb.getItems().filter(i => i.isActive && i.itemType !== 'EQUIPMENT'));

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewingOpname, setViewingOpname] = useState<StockOpnameSession | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // New Opname Form
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formLocation, setFormLocation] = useState('Gudang Kering - Area Sembako');
  const [formNotes, setFormNotes] = useState('Stock opname berkala SPPG');
  const [formSelectedCategory, setFormSelectedCategory] = useState<string>('ALL');

  // Working count items
  const [countingItems, setCountingItems] = useState<
    { itemId: string; name: string; category: string; unit: string; systemStock: number; physicalCount: number; variance: number; reason: string }[]
  >([]);

  const refreshList = () => {
    setOpnames(warehouseDb.getOpnames());
    if (onRefreshData) onRefreshData();
  };

  const handleOpenCreate = () => {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormLocation('Gudang Kering - Area Sembako');
    setFormNotes('Stock opname berkala SPPG');
    setFormSelectedCategory('ALL');
    setErrorMessage('');
    setSuccessMessage('');

    // Pre-populate items
    initCountingItems('ALL');
    setIsCreateModalOpen(true);
  };

  const initCountingItems = (cat: string) => {
    const pool = cat === 'ALL' ? items : items.filter(i => i.category === cat);
    setCountingItems(
      pool.map(item => ({
        itemId: item.id,
        name: item.name,
        category: item.category,
        unit: item.baseUnit,
        systemStock: item.currentStock,
        physicalCount: item.currentStock, // default to system stock for staff convenience
        variance: 0,
        reason: '',
      }))
    );
  };

  const handleCategoryChange = (cat: string) => {
    setFormSelectedCategory(cat);
    initCountingItems(cat);
  };

  const handlePhysicalCountChange = (index: number, val: string) => {
    const count = parseFloat(val) || 0;
    setCountingItems(prev => {
      const updated = [...prev];
      const diff = Number((count - updated[index].systemStock).toFixed(2));
      updated[index] = {
        ...updated[index],
        physicalCount: count,
        variance: diff,
        reason: diff === 0 ? '' : updated[index].reason,
      };
      return updated;
    });
  };

  const handleReasonChange = (index: number, val: string) => {
    setCountingItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], reason: val };
      return updated;
    });
  };

  const handleSubmitOpname = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // Validate that variances have reasons
    for (const item of countingItems) {
      if (item.variance !== 0 && (!item.reason || item.reason.trim().length === 0)) {
        setErrorMessage(`Item "${item.name}" memiliki selisih (${item.variance > 0 ? '+' : ''}${item.variance} ${item.unit}). Harap isi alasan selisih fisik.`);
        return;
      }
    }

    try {
      const session = warehouseDb.createStockOpname(
        formDate,
        formLocation,
        countingItems.map(c => ({
          itemId: c.itemId,
          physicalCount: c.physicalCount,
          reason: c.reason,
        })),
        currentUser,
        formNotes
      );

      setSuccessMessage(`Sesi Stock Opname #${session.id} berhasil diajukan! Menunggu persetujuan otorisasi.`);
      refreshList();
      setIsCreateModalOpen(false);
      setViewingOpname(session);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal membuat sesi stock opname.');
    }
  };

  const handleApprove = (session: StockOpnameSession) => {
    if (!can('APPROVE_OPNAME')) {
      alert('Anda tidak memiliki peran otorisasi untuk menyetujui Stock Opname (Hanya Manager / Warehouse Manager).');
      return;
    }

    const confirmed = window.confirm(
      `Setujui Stock Opname #${session.id}? Tindakan ini akan langsung memperbarui saldo stok fisik dan mencatat penyesuaian di buku besar mutasi.`
    );
    if (!confirmed) return;

    try {
      const approved = warehouseDb.approveStockOpname(session.id, currentUser);
      setSuccessMessage(`Stock Opname #${session.id} berhasil disetujui & diposting ke stok.`);
      refreshList();
      setViewingOpname(approved);
    } catch (err: any) {
      alert(err.message || 'Gagal menyetujui stock opname.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Stock Opname & Rekonsiliasi Fisik</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
              Audit & Penyesuaian
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencocokan stok fisik vs sistem dengan alur approval bertingkat dan catatan alasan selisih mutlak.
          </p>
        </div>

        {can('CREATE_OPNAME') && (
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Mulai Sesi Stock Opname
          </button>
        )}
      </div>

      {/* Sessions List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">ID Opname</th>
                <th className="py-3 px-4">Tanggal Pelaksanaan</th>
                <th className="py-3 px-4">Lokasi Gudang</th>
                <th className="py-3 px-4">Petugas Pencatat</th>
                <th className="py-3 px-4 text-center">Jumlah Item</th>
                <th className="py-3 px-4">Status Approval</th>
                <th className="py-3 px-4">Penyetuju (Approver)</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {opnames.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 italic">
                    Belum ada sesi stock opname yang tercatat.
                  </td>
                </tr>
              ) : (
                opnames.map(session => {
                  const hasDiscrepancies = session.items.some(i => i.variance !== 0);
                  return (
                    <tr key={session.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                        <ClipboardCheck className="w-3.5 h-3.5 text-purple-600" />
                        {session.id}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{session.date}</td>
                      <td className="py-3 px-4 text-slate-700">{session.location}</td>
                      <td className="py-3 px-4 text-slate-700">{session.createdByName}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-mono font-bold text-slate-800">{session.items.length}</span>
                        {hasDiscrepancies && (
                          <span className="ml-1.5 inline-block text-[10px] text-amber-600 font-semibold">
                            (Ada Selisih)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {session.status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle className="w-3 h-3" /> Disetujui
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Menunggu Approval
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {session.approvedByName ? (
                          <div>
                            <span className="font-medium text-slate-800">{session.approvedByName}</span>
                            <span className="text-[10px] text-slate-400 block">{session.approvedAt}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingOpname(session)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-purple-700 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 rounded-md transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Rincian
                          </button>
                          {session.status === 'PENDING_APPROVAL' && can('APPROVE_OPNAME') && (
                            <button
                              onClick={() => handleApprove(session)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors cursor-pointer"
                            >
                              Setujui
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

      {/* VIEW OPNAME DETAILS MODAL */}
      {viewingOpname && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">Sesi Stock Opname: {viewingOpname.id}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      viewingOpname.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {viewingOpname.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Tanggal: {viewingOpname.date} • Lokasi: {viewingOpname.location} • Pencatat: {viewingOpname.createdByName}
                </p>
              </div>
              <button
                onClick={() => setViewingOpname(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {viewingOpname.notes && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                  <span className="font-semibold">Catatan Sesi:</span> {viewingOpname.notes}
                </div>
              )}

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Nama Item</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                      <th className="py-2.5 px-3 text-right font-bold">Hitung Fisik</th>
                      <th className="py-2.5 px-3 text-right">Selisih (Variance)</th>
                      <th className="py-2.5 px-3">Alasan Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingOpname.items.map(i => {
                      const hasVar = i.variance !== 0;
                      return (
                        <tr key={i.id} className={hasVar ? 'bg-amber-50/40' : ''}>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{i.itemName}</td>
                          <td className="py-2.5 px-3 text-slate-500">{i.category}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {i.systemStock} {i.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {i.physicalCount} {i.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {i.variance === 0 ? (
                              <span className="text-emerald-700">0</span>
                            ) : (
                              <span className={i.variance < 0 ? 'text-rose-600' : 'text-purple-600'}>
                                {i.variance > 0 ? `+${i.variance}` : i.variance} {i.unit}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 italic">{i.reason || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs">
              <span className="text-slate-500">
                {viewingOpname.approvedAt && `Disetujui pada ${viewingOpname.approvedAt} oleh ${viewingOpname.approvedByName}`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewingOpname(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Tutup
                </button>
                {viewingOpname.status === 'PENDING_APPROVAL' && can('APPROVE_OPNAME') && (
                  <button
                    onClick={() => handleApprove(viewingOpname)}
                    className="inline-flex items-center gap-1.5 px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Setujui & Buat Jurnal Penyesuaian
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE OPNAME MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Formulir Pelaksanaan Stock Opname</h3>
                <p className="text-[11px] text-slate-500">
                  Sistem menampilkan stok ekspektasi. Masukkan hasil hitung fisik. Selisih wajib diisi alasan.
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmitOpname} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto space-y-4">
                {/* Meta Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Tanggal Opname</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={e => setFormDate(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white font-medium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lokasi / Area Gudang</label>
                    <input
                      type="text"
                      value={formLocation}
                      onChange={e => setFormLocation(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Filter Kategori Item</label>
                    <select
                      value={formSelectedCategory}
                      onChange={e => handleCategoryChange(e.target.value)}
                      className="w-full text-xs rounded border border-slate-300 p-1.5 bg-white font-medium"
                    >
                      <option value="ALL">Semua Kategori ({items.length} Item)</option>
                      <option value="Sembako">Sembako</option>
                      <option value="Protein">Protein</option>
                      <option value="Sayuran">Sayuran</option>
                      <option value="Buah">Buah</option>
                      <option value="Cleaning">Cleaning</option>
                      <option value="Packaging">Packaging</option>
                      <option value="Hygiene/PPE">Hygiene/PPE</option>
                      <option value="General Operational">General Operational</option>
                    </select>
                  </div>
                </div>

                {/* Counting Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-48">Nama Item</th>
                        <th className="py-2.5 px-3 w-28 text-right">Stok Sistem</th>
                        <th className="py-2.5 px-3 w-36 text-right">Hitung Fisik</th>
                        <th className="py-2.5 px-3 w-28 text-right">Selisih</th>
                        <th className="py-2.5 px-3">Alasan Penjelasan Selisih (Wajib jika != 0)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {countingItems.map((c, idx) => (
                        <tr key={c.itemId} className={c.variance !== 0 ? 'bg-amber-50/50' : 'hover:bg-slate-50'}>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900">{c.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{c.itemId}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600 font-medium">
                            {c.systemStock} {c.unit}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={c.physicalCount ?? ''}
                              onChange={e => handlePhysicalCountChange(idx, e.target.value)}
                              className="w-full text-right text-xs font-mono font-bold rounded border border-slate-300 p-1 text-slate-900 focus:ring-1 focus:ring-purple-500"
                              required
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {c.variance === 0 ? (
                              <span className="text-emerald-600">0</span>
                            ) : (
                              <span className={c.variance < 0 ? 'text-rose-600' : 'text-purple-600'}>
                                {c.variance > 0 ? `+${c.variance}` : c.variance} {c.unit}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder={c.variance !== 0 ? 'Wajib: contoh susut kelembaban, kadaluarsa, dsb.' : 'Sesuai fisik'}
                              value={c.reason}
                              onChange={e => handleReasonChange(idx, e.target.value)}
                              className={`w-full text-xs rounded border p-1 ${
                                c.variance !== 0 && !c.reason
                                  ? 'border-rose-400 bg-rose-50/40 text-rose-900 placeholder:text-rose-400'
                                  : 'border-slate-300 text-slate-800'
                              }`}
                              required={c.variance !== 0}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs cursor-pointer"
                >
                  <CheckCircle className="w-4 h-4" />
                  Ajukan Sesi Stock Opname
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
