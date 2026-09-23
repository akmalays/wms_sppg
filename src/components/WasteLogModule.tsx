import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { WasteLog, WasteCategory, DisposalMethod } from '../types/warehouse';
import {
  Trash2,
  Plus,
  Printer,
  Search,
  Filter,
  Leaf,
  Recycle,
  AlertTriangle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const WasteLogModule: React.FC = () => {
  const { currentUser, can } = useAuth();
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>(() => warehouseDb.getWasteLogs());
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDisposal, setSelectedDisposal] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState('');

  // Form states for new waste entry
  const [formCategory, setFormCategory] = useState<WasteCategory>('Limbah Olahan Dapur');
  const [formItemName, setFormItemName] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(0);
  const [formUnit, setFormUnit] = useState<'Kg' | 'Liter' | 'Gram' | 'Pcs'>('Kg');
  const [formSourceArea, setFormSourceArea] = useState('Ruang Preparasi Sayuran');
  const [formReason, setFormReason] = useState('Sisa trimming dan kupasan bahan sebelum pengolahan');
  const [formDisposal, setFormDisposal] = useState<DisposalMethod>('Kompos Organik');
  const [formNotes, setFormNotes] = useState('');

  const refreshLogs = () => {
    setWasteLogs(warehouseDb.getWasteLogs());
  };

  const categories: ('ALL' | WasteCategory)[] = [
    'ALL',
    'Limbah Olahan Dapur',
    'Bahan Rusak / Kadaluarsa',
    'Sisa Makanan Distribusi',
    'Kemasan & Non-Organik',
  ];

  const disposalMethods: ('ALL' | DisposalMethod)[] = [
    'ALL',
    'Kompos Organik',
    'Pakan Maggot / Ternak',
    'Bank Sampah / Daur Ulang',
    'TPS Terpadu',
  ];

  const filteredLogs = useMemo(() => {
    return wasteLogs.filter(log => {
      const matchCat = selectedCategory === 'ALL' || log.wasteCategory === selectedCategory;
      const matchDisp = selectedDisposal === 'ALL' || log.disposalMethod === selectedDisposal;
      const matchSearch =
        log.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.sourceArea.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchDisp && matchSearch;
    });
  }, [wasteLogs, selectedCategory, selectedDisposal, searchQuery]);

  // Waste analytics
  const stats = useMemo(() => {
    let totalKg = 0;
    let divertedKg = 0; // compost, maggot, recycling (diverted from TPS)
    let damagedKg = 0;
    let prepScrapKg = 0;

    wasteLogs.forEach(w => {
      const kg = w.unit === 'Gram' ? w.quantity / 1000 : w.quantity;
      totalKg += kg;

      if (w.disposalMethod !== 'TPS Terpadu') {
        divertedKg += kg;
      }
      if (w.wasteCategory === 'Bahan Rusak / Kadaluarsa') {
        damagedKg += kg;
      }
      if (w.wasteCategory === 'Limbah Olahan Dapur') {
        prepScrapKg += kg;
      }
    });

    const circularRate = totalKg > 0 ? Math.round((divertedKg / totalKg) * 100) : 0;
    return { totalKg, divertedKg, damagedKg, prepScrapKg, circularRate };
  }, [wasteLogs]);

  const handleRecordWaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemName.trim() || formQuantity <= 0) {
      alert('Nama bahan/limbah dan bobot wajib diisi.');
      return;
    }

    try {
      warehouseDb.recordWasteLog(
        {
          date: new Date().toISOString().slice(0, 10),
          wasteCategory: formCategory,
          itemName: formItemName.trim(),
          quantity: formQuantity,
          unit: formUnit,
          sourceArea: formSourceArea.trim(),
          reason: formReason.trim(),
          disposalMethod: formDisposal,
          recordedBy: currentUser.name,
          notes: formNotes.trim(),
        },
        currentUser
      );

      setSuccessNotice(`Berhasil mencatat log limbah: ${formItemName} (${formQuantity} ${formUnit}).`);
      refreshLogs();
      setIsModalOpen(false);

      // Reset
      setFormItemName('');
      setFormQuantity(0);
      setFormNotes('');
      setTimeout(() => setSuccessNotice(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan catatan limbah.');
    }
  };

  const getDisposalBadgeClass = (method: DisposalMethod) => {
    switch (method) {
      case 'Kompos Organik':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'Pakan Maggot / Ternak':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'Bank Sampah / Daur Ulang':
        return 'bg-blue-50 text-blue-800 border-blue-300';
      case 'TPS Terpadu':
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  return (
    <div className="space-y-5">
      {/* Alert Notice */}
      {successNotice && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Rekap Limbah Tercatat
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Pencatatan limbah preparasi dapur, bahan rusak/expired, dan pengalihan ke kompos/pakan maggot.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Cetak Log Limbah</span>
          </button>

          {can('ASLAP') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Catat Limbah Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Total Akumulasi Limbah</div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {stats.totalKg.toFixed(1)} <span className="text-xs font-normal text-slate-500">Kg</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{wasteLogs.length} insiden tercatat</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Tingkat Daur Ulang / Pakan</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            {stats.circularRate}%
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Dialihkan dari TPS ke kompos/maggot</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Sisa Olahan / Kulit Dapur</div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {stats.prepScrapKg.toFixed(1)} <span className="text-xs font-normal text-slate-500">Kg</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Trimming dan kupasan sayuran</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Bahan Rusak / Kadaluarsa</div>
          <div className="text-xl font-bold text-rose-700 mt-1">
            {stats.damagedKg.toFixed(1)} <span className="text-xs font-normal text-rose-800">Kg</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Penyusutan sortasi & penerimaan</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'Semua Kategori Limbah' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Disposal Filter */}
          <select
            value={selectedDisposal}
            onChange={e => setSelectedDisposal(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {disposalMethods.map(d => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'Semua Jalur Penanganan' : d}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari jenis limbah / alasan / area..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-56 text-slate-800"
          />
        </div>
      </div>

      {/* Main Waste Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">
              Buku Catatan Limbah & Daur Ulang
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            {filteredLogs.length} catatan ditampilkan
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-700">Tidak ada data limbah tercatat</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Tidak ada data yang sesuai filter. Klik "Catat Limbah Baru" untuk mencatat limbah harian.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-3.5">Tanggal</th>
                  <th className="py-2.5 px-3.5">Kode Log</th>
                  <th className="py-2.5 px-3.5">Jenis Bahan / Limbah</th>
                  <th className="py-2.5 px-3.5">Kategori</th>
                  <th className="py-2.5 px-3.5 text-right">Bobot</th>
                  <th className="py-2.5 px-3.5">Sumber Area</th>
                  <th className="py-2.5 px-3.5">Alasan / Kondisi</th>
                  <th className="py-2.5 px-3.5">Metode Penanganan</th>
                  <th className="py-2.5 px-3.5">Petugas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 font-medium text-slate-600 whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-[11px] font-semibold text-slate-800 whitespace-nowrap">
                      {item.id}
                    </td>
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                      {item.itemName}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${
                        item.wasteCategory === 'Bahan Rusak / Kadaluarsa'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : item.wasteCategory === 'Limbah Olahan Dapur'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}>
                        {item.wasteCategory}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap">
                      {item.sourceArea}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 max-w-xs truncate" title={item.reason}>
                      {item.reason}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${getDisposalBadgeClass(item.disposalMethod)}`}>
                        {item.disposalMethod}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap text-[11px]">
                      {item.recordedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Catat Limbah Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Catat Limbah / Sisa Olahan</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Dokumentasi akuntabilitas bahan sisa dan kepatuhan ramah lingkungan.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordWaste} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Limbah <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value as WasteCategory)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Limbah Olahan Dapur">Limbah Olahan Dapur (Kulit, Bonggol, Sisa Trimming)</option>
                  <option value="Bahan Rusak / Kadaluarsa">Bahan Rusak / Kadaluarsa (Busuk, Memar, Rusak Simpan)</option>
                  <option value="Sisa Makanan Distribusi">Sisa Makanan Distribusi (Sisa Kuah/Nasi Tak Habis Terdistribusi)</option>
                  <option value="Kemasan & Non-Organik">Kemasan & Non-Organik (Kardus, Karung, Plastik Wrap)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Bahan / Deskripsi Limbah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formItemName}
                  onChange={e => setFormItemName(e.target.value)}
                  placeholder="Misal: Kulit Wortel & Kentang Kupas"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bobot / Kuantitas <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    value={formQuantity || ''}
                    onChange={e => setFormQuantity(parseFloat(e.target.value) || 0)}
                    placeholder="Contoh: 8.5"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satuan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Kg">Kg (Kilogram)</option>
                    <option value="Gram">Gram</option>
                    <option value="Liter">Liter</option>
                    <option value="Pcs">Pcs / Lembar</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Area Sumber Limbah
                  </label>
                  <input
                    type="text"
                    value={formSourceArea}
                    onChange={e => setFormSourceArea(e.target.value)}
                    placeholder="Ruang Preparasi Sayuran"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Metode Penanganan / Daur Ulang <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formDisposal}
                    onChange={e => setFormDisposal(e.target.value as DisposalMethod)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Kompos Organik">Kompos Organik (Biopori / Kebun)</option>
                    <option value="Pakan Maggot / Ternak">Pakan Maggot BSF / Ternak Lokal</option>
                    <option value="Bank Sampah / Daur Ulang">Bank Sampah / Daur Ulang Non-Organik</option>
                    <option value="TPS Terpadu">TPS Terpadu (Pembuangan Akhir)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Penyebab / Alasan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formReason}
                  onChange={e => setFormReason(e.target.value)}
                  placeholder="Misal: Sisa trimming kupasan bahan sebelum olah"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Tambahan
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Mitra penerima atau detail tambahan"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs"
                >
                  Simpan Log Limbah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
