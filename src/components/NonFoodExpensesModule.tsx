import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { NonFoodExpense, NonFoodCategory, NonFoodDepartment } from '../types/warehouse';
import {
  Plus,
  Printer,
  Search,
  Filter,
  Receipt,
  Wrench,
  FileText,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Upload,
  Download
} from 'lucide-react';
import { exportToExcel, parseExcelFile, downloadExcelTemplate } from '../lib/excelExport';

export const NonFoodExpensesModule: React.FC = () => {
  const { currentUser, can } = useAuth();
  const [expenses, setExpenses] = useState<NonFoodExpense[]>(() => warehouseDb.getNonFoodExpenses());
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState('');

  // Form states
  const [formCategory, setFormCategory] = useState<NonFoodCategory>('Peralatan Dapur');
  const [formItemName, setFormItemName] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formUnit, setFormUnit] = useState('Pcs');
  const [formUnitPrice, setFormUnitPrice] = useState<number>(0);
  const [formDepartment, setFormDepartment] = useState<NonFoodDepartment>('Dapur Pengolahan Utama');
  const [formRecipient, setFormRecipient] = useState('');
  const [formReceiptRef, setFormReceiptRef] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const refreshExpenses = () => {
    setExpenses(warehouseDb.getNonFoodExpenses());
  };

  const categories: ('ALL' | NonFoodCategory)[] = [
    'ALL',
    'Peralatan Dapur',
    'ATK & Dokumentasi',
    'Bahan Pembersih & Sanitasi',
    'Perlengkapan Kebersihan & APD',
    'Pemeliharaan & Utilitas',
  ];

  const departments: ('ALL' | NonFoodDepartment)[] = [
    'ALL',
    'Dapur Pengolahan Utama',
    'Area Cuci & Sanitasi',
    'Administrasi & Kantor',
    'Gudang Kering & Basah',
    'Distribusi & Kemasan',
  ];

  const filteredExpenses = useMemo(() => {
    return expenses.filter(item => {
      const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchDept = selectedDepartment === 'ALL' || item.department === selectedDepartment;
      const matchSearch =
        item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.receiptRef && item.receiptRef.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.recipient && item.recipient.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchDept && matchSearch;
    });
  }, [expenses, selectedCategory, selectedDepartment, searchQuery]);

  // Financial statistics
  const stats = useMemo(() => {
    let totalAll = 0;
    let totalEquipment = 0;
    let totalCleaning = 0;
    let totalStationery = 0;
    let totalApd = 0;

    expenses.forEach(e => {
      const cost = e.totalCost || 0;
      totalAll += cost;
      if (e.category === 'Peralatan Dapur') totalEquipment += cost;
      else if (e.category === 'Bahan Pembersih & Sanitasi') totalCleaning += cost;
      else if (e.category === 'ATK & Dokumentasi') totalStationery += cost;
      else if (e.category === 'Perlengkapan Kebersihan & APD') totalApd += cost;
    });

    return { totalAll, totalEquipment, totalCleaning, totalStationery, totalApd };
  }, [expenses]);

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemName.trim() || formQuantity <= 0 || formUnitPrice <= 0) {
      alert('Nama barang, kuantitas, dan harga satuan wajib diisi.');
      return;
    }

    try {
      const total = formQuantity * formUnitPrice;
      warehouseDb.recordNonFoodExpense(
        {
          date: new Date().toISOString().slice(0, 10),
          category: formCategory,
          itemName: formItemName.trim(),
          quantity: formQuantity,
          unit: formUnit,
          unitPrice: formUnitPrice,
          totalCost: total,
          department: formDepartment,
          recipient: formRecipient.trim() || currentUser.name,
          recordedBy: currentUser.name,
          receiptRef: formReceiptRef.trim() || `STR-${Date.now().toString().slice(-4)}`,
          notes: formNotes.trim(),
        },
        currentUser
      );

      setSuccessNotice(`Berhasil mencatat pengeluaran: ${formItemName} (Rp ${total.toLocaleString('id-ID')}).`);
      refreshExpenses();
      setIsModalOpen(false);

      // Reset form
      setFormItemName('');
      setFormQuantity(1);
      setFormUnitPrice(0);
      setFormRecipient('');
      setFormReceiptRef('');
      setFormNotes('');
      setTimeout(() => setSuccessNotice(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan pengeluaran non-food.');
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      alert('Tidak ada data pengeluaran non-food untuk diekspor.');
      return;
    }
    const exportData = filteredExpenses.map((e, idx) => ({
      'No': idx + 1,
      'Tanggal': e.date,
      'Nomor Struk / ID': e.receiptRef || e.id,
      'Nama Barang / Aset': e.itemName,
      'Kategori': e.category,
      'Jumlah': e.quantity,
      'Satuan': e.unit,
      'Harga Satuan (Rp)': e.unitPrice,
      'Total Biaya (Rp)': e.totalCost || 0,
      'Unit / Departemen': e.department,
      'Nama Penerima': e.recipient,
      'Petugas Pencatat': e.recordedBy,
      'Catatan / Keperluan': e.notes || '',
    }));
    exportToExcel(exportData, `Rekap_Pengeluaran_NonFood_SPPG_${new Date().toISOString().slice(0, 10)}`);
  };

  // Import from Excel
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await parseExcelFile<any>(file);
      if (!rawData || rawData.length === 0) {
        alert('File Excel kosong atau tidak terbaca.');
        return;
      }

      let count = 0;
      for (const row of rawData) {
        const itemName = row['Nama Barang / Aset'] || row['Nama Barang'] || row['Nama'] || row['item_name'];
        const qty = parseFloat(row['Jumlah'] || row['quantity'] || 1);
        const price = parseFloat(row['Harga Satuan (Rp)'] || row['Harga Satuan'] || row['unit_price'] || 0);

        if (itemName && qty > 0) {
          const total = row['Total Biaya (Rp)'] ? parseFloat(row['Total Biaya (Rp)']) : qty * price;
          warehouseDb.recordNonFoodExpense(
            {
              date: row['Tanggal'] || new Date().toISOString().slice(0, 10),
              category: (row['Kategori'] as NonFoodCategory) || 'Peralatan Dapur',
              itemName: String(itemName).trim(),
              quantity: qty,
              unit: row['Satuan'] || 'Pcs',
              unitPrice: price > 0 ? price : Math.round(total / qty),
              totalCost: total > 0 ? total : qty * price,
              department: (row['Unit / Departemen'] as NonFoodDepartment) || 'Dapur Pengolahan Utama',
              recipient: row['Nama Penerima'] || currentUser.name,
              recordedBy: currentUser.name,
              receiptRef: row['Nomor Struk / ID'] || `STR-IMP-${Date.now().toString().slice(-4)}`,
              notes: row['Catatan / Keperluan'] || `Impor dari file Excel: ${file.name}`,
            },
            currentUser
          );
          count++;
        }
      }

      if (count > 0) {
        refreshExpenses();
        setSuccessNotice(`Berhasil mengimpor ${count} transaksi non-food dari file ${file.name}!`);
        setTimeout(() => setSuccessNotice(''), 5000);
      } else {
        alert('Tidak ada baris data valid yang dapat diimpor. Gunakan tombol "Format Excel" untuk melihat contoh susunan kolom.');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memproses file Excel.');
    } finally {
      e.target.value = '';
    }
  };

  // Download template Excel
  const handleDownloadTemplate = () => {
    downloadExcelTemplate(
      [
        { header: 'Tanggal', example: '2026-09-23' },
        { header: 'Nama Barang / Aset', example: 'Pisau Dapur Stainless Chef 8 Inch' },
        { header: 'Kategori', example: 'Peralatan Dapur' },
        { header: 'Jumlah', example: 2 },
        { header: 'Satuan', example: 'Set' },
        { header: 'Harga Satuan (Rp)', example: 185000 },
        { header: 'Total Biaya (Rp)', example: 370000 },
        { header: 'Unit / Departemen', example: 'Dapur Pengolahan Utama' },
        { header: 'Nama Penerima', example: 'Chef Joko Santoso' },
        { header: 'Nomor Struk / ID', example: 'STR-2026-001' },
        { header: 'Catatan / Keperluan', example: 'Penggantian pisau fillet tumpul' },
      ],
      'Template_Rekap_Pengeluaran_NonFood_SPPG'
    );
  };

  const getCategoryBadgeClass = (category: NonFoodCategory) => {
    switch (category) {
      case 'Peralatan Dapur':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Bahan Pembersih & Sanitasi':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'ATK & Dokumentasi':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Perlengkapan Kebersihan & APD':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'Pemeliharaan & Utilitas':
        return 'bg-slate-100 text-slate-800 border-slate-300';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
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
            Rekap Pengeluaran Non-Food
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Pencatatan biaya peralatan dapur, ATK, pembersih sanitasi, APD, dan operasional SPPG.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Template */}
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Unduh format template Excel kosong"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Format Excel</span>
          </button>

          {/* Import Excel */}
          {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.role === 'KA_SPPG') && (
            <label
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
              title="Lampirkan dan impor data dari file Excel (.xlsx / .csv)"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-700" />
              <span>Impor Excel</span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportExcel}
              />
            </label>
          )}

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 shadow-2xs transition-colors cursor-pointer"
            title="Unduh seluruh rekap non-food sebagai file Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Cetak PDF</span>
          </button>

          {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.role === 'KA_SPPG' || currentUser.role === 'ASLAP') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Catat Pengeluaran</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial Overview Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="p-3.5 rounded-xl bg-slate-900 text-white shadow-2xs">
          <div className="text-[11px] font-medium text-slate-300">Total Pengeluaran Non-Food</div>
          <div className="text-lg font-bold mt-1 tracking-tight">
            Rp {stats.totalAll.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{expenses.length} transaksi tercatat</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Peralatan Dapur</div>
          <div className="text-lg font-bold text-slate-900 mt-1">
            Rp {stats.totalEquipment.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Pisau, panci, wadah saji</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Bahan Pembersih & Sanitasi</div>
          <div className="text-lg font-bold text-teal-700 mt-1">
            Rp {stats.totalCleaning.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Sabun foodgrade, karbol</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">ATK & Dokumentasi</div>
          <div className="text-lg font-bold text-amber-700 mt-1">
            Rp {stats.totalStationery.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Kertas form, binder HACCP</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs col-span-2 lg:col-span-1">
          <div className="text-[11px] font-medium text-slate-500">Perlengkapan & APD</div>
          <div className="text-lg font-bold text-indigo-700 mt-1">
            Rp {stats.totalApd.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Apron, hairnet, sarung tangan</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {categories.map(c => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'Semua Kategori Non-Food' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Department Dropdown */}
          <select
            value={selectedDepartment}
            onChange={e => setSelectedDepartment(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {departments.map(d => (
              <option key={d} value={d}>
                {d === 'ALL' ? 'Semua Unit / Departemen' : d}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari barang / struk / penerima..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-56 text-slate-800"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-700" />
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">
              Daftar Bukti Pengeluaran Non-Food
            </h3>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            {filteredExpenses.length} item ditampilkan
          </span>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-700">Belum ada data pengeluaran non-food</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Tidak ada catatan yang sesuai dengan filter. Klik "Catat Pengeluaran Baru" untuk menambahkan transaksi.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-3.5">Tanggal</th>
                  <th className="py-2.5 px-3.5">Nama Barang</th>
                  <th className="py-2.5 px-3.5 text-center">Qty</th>
                  <th className="py-2.5 px-3.5">Jam Ambil</th>
                  <th className="py-2.5 px-3.5">Relawan</th>
                  <th className="py-2.5 px-3.5">PIC</th>
                  <th className="py-2.5 px-3.5">Kategori</th>
                  <th className="py-2.5 px-3.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3.5 font-medium text-slate-700 whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-2.5 px-3.5 font-semibold text-slate-900">
                      {item.itemName}
                      {item.receiptRef && (
                        <span className="block text-[10px] font-mono text-slate-400 font-normal">{item.receiptRef}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center font-bold text-slate-800 whitespace-nowrap">
                      {item.quantity} {item.unit && !String(item.quantity).includes('pack') && !String(item.quantity).includes('pcs') && !String(item.quantity).includes('biji') ? item.unit : ''}
                    </td>
                    <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                      {item.time || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-800 font-medium whitespace-nowrap">
                      {item.volunteer || item.recipient || '-'}
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap text-[11px]">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 font-semibold text-slate-800">
                        {item.pic || item.recordedBy || '-'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium border ${getCategoryBadgeClass(item.category as any)}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3.5 text-slate-500 max-w-xs truncate" title={item.notes}>
                      {item.notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Catat Pengeluaran Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Catat Pengeluaran Non-Food</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Input pengadaan/pengeluaran peralatan dapur, ATK, bahan sanitasi, dan APD.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Pengeluaran <span className="text-rose-500">*</span>
                </label>
                <select
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value as NonFoodCategory)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Peralatan Dapur">Peralatan Dapur (Pisau, Panci, Baskom, dsb)</option>
                  <option value="Bahan Pembersih & Sanitasi">Bahan Pembersih & Sanitasi (Sabun, Karbol, dsb)</option>
                  <option value="ATK & Dokumentasi">ATK & Dokumentasi (Kertas, Binder, Spidol, dsb)</option>
                  <option value="Perlengkapan Kebersihan & APD">Perlengkapan Kebersihan & APD (Apron, Sarung Tangan, dsb)</option>
                  <option value="Pemeliharaan & Utilitas">Pemeliharaan & Utilitas (Regulator, Selang, Lampu, dsb)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Barang / Deskripsi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formItemName}
                  onChange={e => setFormItemName(e.target.value)}
                  placeholder="Misal: Pisau Chef Stainless 8 Inch atau Sabun Cuci 5L"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jumlah <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formQuantity}
                    onChange={e => setFormQuantity(parseInt(e.target.value) || 1)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Satuan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    placeholder="Pcs / Set / Jerigen"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Harga Satuan (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formUnitPrice || ''}
                    onChange={e => setFormUnitPrice(parseFloat(e.target.value) || 0)}
                    placeholder="150000"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Perkiraan Total Biaya:</span>
                <span className="font-bold text-slate-900 text-sm">
                  Rp {(formQuantity * formUnitPrice).toLocaleString('id-ID')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Unit Pemohon / Departemen
                  </label>
                  <select
                    value={formDepartment}
                    onChange={e => setFormDepartment(e.target.value as NonFoodDepartment)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Dapur Pengolahan Utama">Dapur Pengolahan Utama</option>
                    <option value="Area Cuci & Sanitasi">Area Cuci & Sanitasi</option>
                    <option value="Administrasi & Kantor">Administrasi & Kantor</option>
                    <option value="Gudang Kering & Basah">Gudang Kering & Basah</option>
                    <option value="Distribusi & Kemasan">Distribusi & Kemasan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Penerima Fisik
                  </label>
                  <input
                    type="text"
                    value={formRecipient}
                    onChange={e => setFormRecipient(e.target.value)}
                    placeholder="Nama staf penerima"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Bukti / No. Struk
                  </label>
                  <input
                    type="text"
                    value={formReceiptRef}
                    onChange={e => setFormReceiptRef(e.target.value)}
                    placeholder="Contoh: STR-2026-0923"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan / Keperluan
                  </label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Keperluan operasional"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
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
                  Simpan Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
