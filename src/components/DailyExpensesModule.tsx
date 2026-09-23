import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { NonFoodExpense, InventoryTransaction } from '../types/warehouse';
import {
  Calendar,
  Plus,
  Printer,
  Search,
  TrendingDown,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Upload,
  Download,
  Trash2,
  Package,
  TableProperties,
  ClipboardPaste,
  PlusCircle,
  Info
} from 'lucide-react';
import { exportToExcel, parseExcelFile, downloadExcelTemplate } from '../lib/excelExport';

interface BatchRowItem {
  id: string;
  itemName: string;
  qty: string;
  unit: string;
  time: string;
  volunteer: string;
  category: string;
  notes: string;
}

export const DailyExpensesModule: React.FC = () => {
  const { currentUser } = useAuth();

  // Date & Search Filters
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [activeTabFilter, setActiveTabFilter] = useState<'ALL' | 'MANUAL' | 'KITCHEN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [successNotice, setSuccessNotice] = useState<string>('');

  // Modals
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isKitchenModalOpen, setIsKitchenModalOpen] = useState(false);

  // Batch Form State
  const defaultCurrentTime = new Date()
    .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    .replace(':', '.');

  const [batchDate, setBatchDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [batchPic, setBatchPic] = useState<string>(currentUser.name);
  const [batchRows, setBatchRows] = useState<BatchRowItem[]>([
    { id: '1', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Peralatan & Kebersihan', notes: '' },
    { id: '2', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Peralatan & Kebersihan', notes: '' },
    { id: '3', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Peralatan & Kebersihan', notes: '' },
    { id: '4', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Peralatan & Kebersihan', notes: '' },
    { id: '5', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Peralatan & Kebersihan', notes: '' },
  ]);
  const [batchInputMode, setBatchInputMode] = useState<'GRID' | 'PASTE'>('GRID');
  const [pasteRawText, setPasteRawText] = useState('');

  // Single Form State
  const [singleItemName, setSingleItemName] = useState('');
  const [singleCategory, setSingleCategory] = useState('Peralatan & Kebersihan');
  const [singleQty, setSingleQty] = useState('1');
  const [singleUnit, setSingleUnit] = useState('pack');
  const [singleTime, setSingleTime] = useState(defaultCurrentTime);
  const [singleVolunteer, setSingleVolunteer] = useState('');
  const [singlePic, setSinglePic] = useState(currentUser.name);
  const [singleNotes, setSingleNotes] = useState('');
  const [deductStockIfMatch, setDeductStockIfMatch] = useState(false);

  // Kitchen Issue Form State
  const [kitchenItemId, setKitchenItemId] = useState('');
  const [kitchenQty, setKitchenQty] = useState<number>(0);
  const [kitchenDestination, setKitchenDestination] = useState('Dapur Pengolahan Utama SPPG');
  const [kitchenMealSession, setKitchenMealSession] = useState<'Pagi' | 'Siang' | 'Snack'>('Siang');
  const [kitchenNotes, setKitchenNotes] = useState('Pengeluaran rutin persiapan masak');

  // Data sources
  const items = useMemo(() => warehouseDb.getItems(), [successNotice]);
  const transactions = useMemo(() => warehouseDb.getTransactions(), [successNotice]);
  const manualExpenses = useMemo(() => warehouseDb.getNonFoodExpenses(), [successNotice]);

  // Combined daily expense records normalized for display
  interface UnifiedExpense {
    id: string;
    source: 'MANUAL' | 'KITCHEN';
    date: string;
    time?: string;
    itemName: string;
    category: string;
    quantity: string | number;
    unit?: string;
    recipientOrVolunteer?: string;
    picOrUser: string;
    notes?: string;
    balanceAfter?: number;
    referenceNo?: string;
  }

  const combinedExpenses = useMemo<UnifiedExpense[]>(() => {
    const list: UnifiedExpense[] = [];

    // 1. Manual logs (from nonFoodExpenses & Excel sheet rekap pengeluaran peraltan)
    manualExpenses.forEach(exp => {
      list.push({
        id: exp.id,
        source: 'MANUAL',
        date: exp.date,
        time: exp.time || '12.00',
        itemName: exp.itemName,
        category: exp.category,
        quantity: exp.quantity,
        unit: exp.unit || 'Pack',
        recipientOrVolunteer: exp.volunteer || exp.recipient || '-',
        picOrUser: exp.pic || exp.recordedBy || currentUser.name,
        notes: exp.notes,
      });
    });

    // 2. Kitchen stock issues
    transactions
      .filter(tx => tx.transactionType === 'ISSUE_CONSUMPTION')
      .forEach(tx => {
        list.push({
          id: tx.id,
          source: 'KITCHEN',
          date: tx.timestamp.slice(0, 10),
          time: tx.timestamp.slice(11, 16).replace(':', '.'),
          itemName: tx.itemName,
          category: tx.category,
          quantity: Math.abs(tx.quantity),
          unit: tx.unit,
          recipientOrVolunteer: tx.location || 'Dapur Pengolahan SPPG',
          picOrUser: tx.userName,
          notes: tx.notes,
          balanceAfter: tx.balanceAfter,
          referenceNo: tx.referenceDocument || tx.id,
        });
      });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [manualExpenses, transactions, currentUser.name]);

  // Filtered list
  const filteredList = useMemo(() => {
    return combinedExpenses.filter(item => {
      // Source filter
      if (activeTabFilter === 'MANUAL' && item.source !== 'MANUAL') return false;
      if (activeTabFilter === 'KITCHEN' && item.source !== 'KITCHEN') return false;

      // Date filter
      if (selectedDate) {
        const itemDateClean = item.date.toLowerCase();
        const selectedClean = selectedDate.toLowerCase();
        const isMatchDate =
          itemDateClean === selectedClean ||
          itemDateClean.includes(selectedClean) ||
          itemDateClean.includes(selectedDate.replace(/-/g, ' '));
        if (!isMatchDate) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText =
          item.itemName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          (item.recipientOrVolunteer && item.recipientOrVolunteer.toLowerCase().includes(q)) ||
          (item.picOrUser && item.picOrUser.toLowerCase().includes(q)) ||
          (item.notes && item.notes.toLowerCase().includes(q));
        if (!matchText) return false;
      }

      return true;
    });
  }, [combinedExpenses, activeTabFilter, selectedDate, searchQuery]);

  // ==========================================
  // BATCH INPUT LOGIC
  // ==========================================

  const handleAddBatchRows = (count: number = 1) => {
    const newItems: BatchRowItem[] = [];
    for (let i = 0; i < count; i++) {
      newItems.push({
        id: String(Date.now() + Math.random()),
        itemName: '',
        qty: '1',
        unit: 'pack',
        time: defaultCurrentTime,
        volunteer: '',
        category: 'Peralatan & Kebersihan',
        notes: '',
      });
    }
    setBatchRows(prev => [...prev, ...newItems]);
  };

  const handleUpdateBatchRow = (id: string, field: keyof BatchRowItem, value: string) => {
    setBatchRows(prev =>
      prev.map(row => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleRemoveBatchRow = (id: string) => {
    setBatchRows(prev => (prev.length > 1 ? prev.filter(row => row.id !== id) : prev));
  };

  // Convert pasted text (from Excel / Spreadsheet) into rows
  const handleParsePastedText = () => {
    if (!pasteRawText.trim()) {
      alert('Tempelkan teks data dari Excel / Spreadsheet terlebih dahulu.');
      return;
    }

    const lines = pasteRawText.trim().split(/\r?\n/);
    const parsedRows: BatchRowItem[] = [];

    lines.forEach((line, idx) => {
      // Split by tab (Excel copy format) or comma or semicolon
      let cols = line.split('\t');
      if (cols.length === 1 && line.includes(';')) {
        cols = line.split(';');
      } else if (cols.length === 1 && line.includes(',')) {
        cols = line.split(',');
      }

      const col0 = (cols[0] || '').trim();
      const col1 = (cols[1] || '').trim();
      const col2 = (cols[2] || '').trim();
      const col3 = (cols[3] || '').trim();
      const col4 = (cols[4] || '').trim();
      const col5 = (cols[5] || '').trim();

      // Skip header line if detected
      if (
        idx === 0 &&
        (col0.toLowerCase().includes('nama') || col0.toLowerCase().includes('tanggal') || col0.toLowerCase().includes('item'))
      ) {
        return;
      }

      // Check if col0 is date or item name
      let itemName = col0;
      let qty = '1';
      let unit = 'pack';
      let time = defaultCurrentTime;
      let volunteer = '';
      let notes = '';

      if (cols.length >= 4) {
        // Assume format: [Tanggal, Nama Barang, Qty, Jam, Relawan, ...] or [Nama Barang, Qty, Jam, Relawan]
        if (col0.match(/\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/) || col0.toLowerCase().includes('sept') || col0.toLowerCase().includes('okt')) {
          // col0 is date
          itemName = col1;
          qty = col2 || '1';
          time = col3 || defaultCurrentTime;
          volunteer = col4 || '';
          notes = col5 || '';
        } else {
          itemName = col0;
          qty = col1 || '1';
          time = col2 || defaultCurrentTime;
          volunteer = col3 || '';
          notes = col4 || '';
        }
      } else if (cols.length >= 2) {
        itemName = col0;
        qty = col1 || '1';
      }

      if (itemName) {
        // Extract unit from qty if present like "1 pack" or "2 pcs"
        const unitMatch = qty.match(/(pack|pcs|kg|liter|botol|kaplet|dus|roll|ikat)/i);
        if (unitMatch) {
          unit = unitMatch[0].toLowerCase();
        }

        parsedRows.push({
          id: String(Date.now() + Math.random() + idx),
          itemName,
          qty,
          unit,
          time,
          volunteer,
          category: 'Peralatan & Kebersihan',
          notes,
        });
      }
    });

    if (parsedRows.length > 0) {
      setBatchRows(parsedRows);
      setBatchInputMode('GRID');
      setPasteRawText('');
      alert(`Berhasil membaca ${parsedRows.length} baris dari teks yang Anda tempel! Silakan tinjau dan klik "Simpan Semua".`);
    } else {
      alert('Tidak ada baris barang yang terdeteksi dari teks yang ditempel.');
    }
  };

  // Submit All Batch Rows in 1 Click
  const handleSaveAllBatch = (e: React.FormEvent) => {
    e.preventDefault();

    // Filter valid rows having item name
    const validRows = batchRows.filter(r => r.itemName.trim() !== '');

    if (validRows.length === 0) {
      alert('Isi minimal 1 nama barang pada tabel sebelum menyimpan.');
      return;
    }

    const payload = validRows.map(r => ({
      date: batchDate,
      itemName: r.itemName.trim(),
      category: r.category || 'Peralatan & Kebersihan',
      quantity: r.qty.trim() || '1',
      unit: r.unit.trim() || 'pack',
      time: r.time.trim() || defaultCurrentTime,
      volunteer: r.volunteer.trim() || undefined,
      pic: batchPic.trim() || currentUser.name,
      notes: r.notes.trim() || undefined,
    }));

    warehouseDb.recordNonFoodExpensesBatch(payload, currentUser);

    setSuccessNotice(`Berhasil menyimpan ${validRows.length} barang pengeluaran sekaligus ke rekap harian!`);
    setIsBatchModalOpen(false);

    // Reset rows to 5 empty slots for next entry
    setBatchRows([
      { id: '1', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Peralatan & Kebersihan', notes: '' },
      { id: '2', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Peralatan & Kebersihan', notes: '' },
      { id: '3', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Peralatan & Kebersihan', notes: '' },
      { id: '4', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Peralatan & Kebersihan', notes: '' },
      { id: '5', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Peralatan & Kebersihan', notes: '' },
    ]);
    setTimeout(() => setSuccessNotice(''), 5000);
  };

  // ==========================================
  // SINGLE INPUT LOGIC
  // ==========================================

  const handleSaveSingleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleItemName.trim()) {
      alert('Nama barang wajib diisi.');
      return;
    }

    const cleanQty = singleQty.trim() || '1';

    warehouseDb.recordNonFoodExpense(
      {
        date: selectedDate,
        itemName: singleItemName.trim(),
        category: singleCategory,
        quantity: cleanQty,
        unit: singleUnit,
        time: singleTime.trim() || defaultCurrentTime,
        volunteer: singleVolunteer.trim() || undefined,
        pic: singlePic.trim() || currentUser.name,
        notes: singleNotes.trim() || undefined,
      },
      currentUser
    );

    if (deductStockIfMatch) {
      const match = items.find(
        i => i.name.toLowerCase() === singleItemName.trim().toLowerCase()
      );
      if (match) {
        const numQty = parseFloat(cleanQty);
        if (!isNaN(numQty) && numQty > 0) {
          try {
            warehouseDb.recordConsumption(
              match.id,
              numQty,
              'Dapur SPPG',
              currentUser,
              `Pengeluaran manual dicatat oleh ${currentUser.name}: ${singleNotes}`,
              `BON-MAN-${Date.now().toString().slice(-4)}`
            );
          } catch (e) {
            console.warn('Auto stock deduction skipped:', e);
          }
        }
      }
    }

    setSuccessNotice(`Berhasil mencatat pengeluaran barang: "${singleItemName.trim()}" (${cleanQty} ${singleUnit}).`);
    setIsSingleModalOpen(false);
    setSingleItemName('');
    setSingleQty('1');
    setSingleVolunteer('');
    setSingleNotes('');
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  // Kitchen Issue Logic
  const handleRecordKitchenIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitchenItemId || kitchenQty <= 0) {
      alert('Pilih bahan dan tentukan jumlah pengeluaran yang valid.');
      return;
    }

    const item = items.find(i => i.id === kitchenItemId);
    if (!item) {
      alert('Bahan tidak ditemukan.');
      return;
    }

    if (item.currentStock < kitchenQty) {
      alert(`Stok fisik tidak mencukupi! Stok saat ini: ${item.currentStock} ${item.baseUnit}`);
      return;
    }

    try {
      warehouseDb.recordConsumption(
        kitchenItemId,
        kitchenQty,
        kitchenDestination,
        currentUser,
        `Sesi ${kitchenMealSession}: ${kitchenNotes}`,
        `BON-DAPUR-${selectedDate}-${Date.now().toString().slice(-4)}`
      );

      setSuccessNotice(`Berhasil mengeluarkan ${kitchenQty} ${item.baseUnit} ${item.name} ke ${kitchenDestination}.`);
      setIsKitchenModalOpen(false);
      setKitchenQty(0);
      setKitchenItemId('');
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal mencatat pengeluaran dapur.');
    }
  };

  const handleDeleteManual = (id: string, name: string) => {
    if (window.confirm(`Hapus catatan pengeluaran barang "${name}"?`)) {
      warehouseDb.deleteNonFoodExpense(id, currentUser);
      setSuccessNotice(`Catatan pengeluaran "${name}" berhasil dihapus.`);
      setTimeout(() => setSuccessNotice(''), 4000);
    }
  };

  // Export & Print
  const handleExportExcel = () => {
    if (filteredList.length === 0) {
      alert('Tidak ada data pengeluaran untuk diekspor pada filter saat ini.');
      return;
    }
    const exportData = filteredList.map((item, idx) => ({
      'No': idx + 1,
      'Tanggal': item.date,
      'Jam Ambil': item.time || '-',
      'Nama Barang': item.itemName,
      'Kategori': item.category,
      'Jumlah': item.quantity,
      'Satuan': item.unit || 'Pack',
      'Relawan / Pengambil': item.recipientOrVolunteer || '-',
      'PIC Petugas': item.picOrUser || '-',
      'Keterangan / Catatan': item.notes || '-',
      'Tipe Catatan': item.source === 'MANUAL' ? 'Rekap Manual' : 'Bahan Dapur',
    }));

    exportToExcel(
      exportData,
      `Rekap_Pengeluaran_Harian_SPPG_${selectedDate || 'Semua'}.xlsx`,
      'Rekap Pengeluaran'
    );
  };

  const handlePrintDailyReport = () => {
    window.print();
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate(
      [
        { header: 'Tanggal', example: '2026-09-23' },
        { header: 'Nama Barang', example: 'kresek merah' },
        { header: 'Qty', example: '1 pack' },
        { header: 'Jam Ambil', example: '19.55' },
        { header: 'Relawan', example: 'roni' },
        { header: 'PIC', example: 'teguh' },
        { header: 'Catatan', example: 'Pengambilan untuk dapur siang' },
      ],
      'Template_Rekap_Harian_Manual_SPPG'
    );
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawData = await parseExcelFile<any>(file);
      if (!rawData || rawData.length === 0) {
        alert('File Excel kosong atau tidak terbaca.');
        return;
      }

      const rowsToInsert: any[] = [];
      for (const row of rawData) {
        const itemName = row['Nama Barang'] || row['nama'] || row['Nama Bahan'] || row['Nama Bahan Pangan'];
        const qty = row['Qty'] || row['qty '] || row['Jumlah'] || row['Jumlah Keluar'] || '1';
        const date = row['Tanggal'] || row['tanggal'] || selectedDate;
        const time = row['Jam Ambil'] || row['jam ambil'] || defaultCurrentTime;
        const volunteer = row['Relawan'] || row['relawan '] || row['Pengambil'] || '';
        const pic = row['PIC'] || row['pic'] || currentUser.name;
        const notes = row['Catatan'] || row['Keterangan'] || '';

        if (itemName) {
          rowsToInsert.push({
            date: String(date),
            itemName: String(itemName),
            category: 'Peralatan & Logistik',
            quantity: String(qty),
            unit: 'Pack',
            time: String(time),
            volunteer: volunteer ? String(volunteer) : undefined,
            pic: String(pic),
            notes: notes ? String(notes) : undefined,
          });
        }
      }

      if (rowsToInsert.length > 0) {
        warehouseDb.recordNonFoodExpensesBatch(rowsToInsert, currentUser);
        setSuccessNotice(`Berhasil mengimpor ${rowsToInsert.length} baris catatan rekap harian dari file ${file.name}!`);
        setTimeout(() => setSuccessNotice(''), 5000);
      } else {
        alert('Tidak ada baris yang valid untuk diimpor. Pastikan header mencakup "Nama Barang", "Tanggal", "Qty".');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal memproses file Excel.');
    } finally {
      e.target.value = '';
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

      {/* Module Title & Top Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Laporan & Rekap Pengeluaran Harian
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Catatan harian manual pengeluaran barang peralatan, logistik, dan penyaluran bahan dapur SPPG.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Template */}
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Unduh format template Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Format Excel</span>
          </button>

          {/* Import Excel */}
          <label
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            title="Impor rekap dari file Excel"
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

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 shadow-2xs transition-colors cursor-pointer"
            title="Unduh rekap pengeluaran sebagai Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Excel</span>
          </button>

          {/* Print PDF */}
          <button
            onClick={handlePrintDailyReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Cetak PDF</span>
          </button>

          {/* PRIMARY ACTION: Batch / Multi-Row Input */}
          <button
            onClick={() => {
              setBatchDate(selectedDate || new Date().toISOString().slice(0, 10));
              setIsBatchModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer ring-2 ring-emerald-600/20"
            title="Input banyak barang sekaligus dalam satu form tabel cepat"
          >
            <TableProperties className="w-4 h-4" />
            <span>Input Masal (Banyak Barang)</span>
          </button>

          {/* Single Item Input */}
          <button
            onClick={() => setIsSingleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
            title="Input satu barang saja"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Input Satuan</span>
          </button>

          {/* Kitchen Stock Issue */}
          <button
            onClick={() => setIsKitchenModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white shadow-2xs transition-colors cursor-pointer"
          >
            <Package className="w-3.5 h-3.5 text-slate-300" />
            <span>Keluarkan Bahan Dapur</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={() => setSelectedDate('')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              selectedDate === ''
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua Tanggal
          </button>

          {/* Tabs: Source Filter */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTabFilter('ALL')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                activeTabFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({combinedExpenses.length})
            </button>
            <button
              onClick={() => setActiveTabFilter('MANUAL')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                activeTabFilter === 'MANUAL'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rekap Manual ({manualExpenses.length})
            </button>
            <button
              onClick={() => setActiveTabFilter('KITCHEN')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                activeTabFilter === 'KITCHEN'
                  ? 'bg-white text-blue-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bahan Dapur ({transactions.filter(t => t.transactionType === 'ISSUE_CONSUMPTION').length})
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari barang, relawan, PIC..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-56 text-slate-800"
          />
        </div>
      </div>

      {/* Main Expense Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <h2 className="text-xs font-bold text-slate-900">
              Rincian Rekap Pengeluaran Barang Harian
            </h2>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            {filteredList.length} baris tercatat
          </span>
        </div>

        {filteredList.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-700">Belum ada catatan pengeluaran</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Tidak ada data pengeluaran untuk filter yang dipilih. Silakan klik tombol "Input Masal (Banyak Barang)" di atas untuk menambahkan rekap dengan cepat.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-3 text-center w-12">No</th>
                  <th className="py-2.5 px-3">Tanggal & Jam</th>
                  <th className="py-2.5 px-3">Nama Barang</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3 text-right">Jumlah</th>
                  <th className="py-2.5 px-3">Pengambil / Relawan</th>
                  <th className="py-2.5 px-3">PIC Petugas</th>
                  <th className="py-2.5 px-3">Keterangan</th>
                  <th className="py-2.5 px-3 text-center w-16">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((item, idx) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                        <div>{item.date}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          <span>Pukul {item.time}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {item.itemName}
                        {item.source === 'KITCHEN' && item.referenceNo && (
                          <div className="text-[10px] text-slate-400 font-mono font-normal">
                            Ref: {item.referenceNo}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-700 whitespace-nowrap">
                        {item.quantity} {item.unit || ''}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {item.recipientOrVolunteer || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap text-[11px]">
                        {item.picOrUser || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={item.notes}>
                        {item.notes || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.source === 'MANUAL' && (
                          <button
                            onClick={() => handleDeleteManual(item.id, item.itemName)}
                            title="Hapus baris ini"
                            className="text-slate-300 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: INPUT MASAL BANYAK BARANG SEKALIGUS (GRID & PASTE) */}
      {/* ========================================================================= */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TableProperties className="w-5 h-5 text-emerald-600" />
                  Input Masal Rekap Pengeluaran Barang
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi banyak barang sekaligus dalam satu form tabel cepat atau tempel langsung data dari Excel.
                </p>
              </div>

              {/* Mode Switcher Pills */}
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setBatchInputMode('GRID')}
                    className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      batchInputMode === 'GRID' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Tabel Cepat
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchInputMode('PASTE')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      batchInputMode === 'PASTE' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Tempel dari Excel</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsBatchModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 cursor-pointer ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Batch Metadata Header (Tanggal & PIC Default) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Rekap Pengeluaran
                  </label>
                  <input
                    type="date"
                    value={batchDate}
                    onChange={e => setBatchDate(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Tanggal ini berlaku untuk seluruh baris barang yang dimasukkan.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    PIC Petugas Gudang
                  </label>
                  <input
                    type="text"
                    value={batchPic}
                    onChange={e => setBatchPic(e.target.value)}
                    placeholder="Nama PIC (contoh: teguh, ade, akmal)..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Nama petugas yang bertanggung jawab mencatat pengeluaran.
                  </p>
                </div>
              </div>

              {/* MODE 1: GRID TABEL CEPAT */}
              {batchInputMode === 'GRID' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <th className="py-2 px-2 text-center w-8">#</th>
                            <th className="py-2 px-2.5 min-w-[200px]">Nama Barang <span className="text-rose-500">*</span></th>
                            <th className="py-2 px-2 w-24">Jumlah</th>
                            <th className="py-2 px-2 w-24">Satuan</th>
                            <th className="py-2 px-2 w-24">Jam</th>
                            <th className="py-2 px-2 min-w-[140px]">Relawan / Pengambil</th>
                            <th className="py-2 px-2 min-w-[140px]">Catatan</th>
                            <th className="py-2 px-1 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {batchRows.map((row, idx) => (
                            <tr key={row.id} className="hover:bg-slate-50/80">
                              <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* Nama Barang */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.itemName}
                                  onChange={e => handleUpdateBatchRow(row.id, 'itemName', e.target.value)}
                                  placeholder="Nama barang..."
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
                                  list="batch-item-datalist"
                                />
                              </td>

                              {/* Qty */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.qty}
                                  onChange={e => handleUpdateBatchRow(row.id, 'qty', e.target.value)}
                                  placeholder="1"
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-center"
                                />
                              </td>

                              {/* Satuan */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.unit}
                                  onChange={e => handleUpdateBatchRow(row.id, 'unit', e.target.value)}
                                  placeholder="pack"
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                                  list="batch-unit-datalist"
                                />
                              </td>

                              {/* Jam Ambil */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.time}
                                  onChange={e => handleUpdateBatchRow(row.id, 'time', e.target.value)}
                                  placeholder="19.55"
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700 text-center font-mono"
                                />
                              </td>

                              {/* Relawan */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.volunteer}
                                  onChange={e => handleUpdateBatchRow(row.id, 'volunteer', e.target.value)}
                                  placeholder="Contoh: roni..."
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                                />
                              </td>

                              {/* Catatan */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.notes}
                                  onChange={e => handleUpdateBatchRow(row.id, 'notes', e.target.value)}
                                  placeholder="Opsional..."
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                                />
                              </td>

                              {/* Hapus Baris */}
                              <td className="py-1.5 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBatchRow(row.id)}
                                  className="text-slate-300 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                                  title="Hapus baris ini"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add Row Controls */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddBatchRows(1)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah 1 Baris</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddBatchRows(5)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Tambah 5 Baris Sekaligus</span>
                      </button>
                    </div>

                    <span className="text-xs text-slate-500 font-medium">
                      {batchRows.filter(r => r.itemName.trim() !== '').length} barang terisi
                    </span>
                  </div>
                </div>
              )}

              {/* MODE 2: PASTE DARI EXCEL */}
              {batchInputMode === 'PASTE' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-800 mb-1">
                      <Info className="w-4 h-4" />
                      Cara Cepat: Salin & Tempel Data dari Spreadsheet Excel
                    </div>
                    Blok baris-baris pada lembar rekap Excel Anda (misal kolom <strong>Nama Barang, Qty, Jam Ambil, Relawan</strong>), tekan <strong>Ctrl + C</strong> (Copy), lalu paste (<strong>Ctrl + V</strong>) ke dalam kotak di bawah ini.
                  </div>

                  <textarea
                    rows={8}
                    value={pasteRawText}
                    onChange={e => setPasteRawText(e.target.value)}
                    placeholder="Contoh format teks dari Excel:&#10;kresek merah	1 pack	19.55	roni&#10;trashbag 80x10	1 pack	20.30	puspitasari&#10;obat mylanta	1 kaplet	21.37	saiful"
                    className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 bg-white"
                  ></textarea>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleParsePastedText}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <TableProperties className="w-4 h-4" />
                      <span>Konversi ke Tabel Masal</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Total baris siap simpan:{' '}
                <strong className="text-slate-800">
                  {batchRows.filter(r => r.itemName.trim() !== '').length} barang
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllBatch}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Simpan Semua ({batchRows.filter(r => r.itemName.trim() !== '').length} Barang) Sekaligus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INPUT SATUAN */}
      {/* ========================================================================= */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Input Rekap Barang Manual (Satuan)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Catat satu per satu pengeluaran barang ke buku harian.
                </p>
              </div>
              <button
                onClick={() => setIsSingleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingleRecord} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={singleItemName}
                  onChange={e => setSingleItemName(e.target.value)}
                  placeholder="Ketik nama barang (contoh: kresek merah, trashbag 80x10, dll)..."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  list="batch-item-datalist"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Ambil (Waktu)</label>
                  <input
                    type="text"
                    value={singleTime}
                    onChange={e => setSingleTime(e.target.value)}
                    placeholder="Contoh: 19.55"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah (Qty) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={singleQty}
                    onChange={e => setSingleQty(e.target.value)}
                    placeholder="Contoh: 1 atau 1 pack"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={singleUnit}
                    onChange={e => setSingleUnit(e.target.value)}
                    placeholder="Pack, Pcs, Kg, Dus..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    list="batch-unit-datalist"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori Barang</label>
                <select
                  value={singleCategory}
                  onChange={e => setSingleCategory(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="Peralatan & Kebersihan">Peralatan & Kebersihan</option>
                  <option value="Kemasan & Plastik">Kemasan & Plastik</option>
                  <option value="Bahan Pokok & Sembako">Bahan Pokok & Sembako</option>
                  <option value="Bahan Sayur & Buah">Bahan Sayur & Buah</option>
                  <option value="Protein & Daging">Protein & Daging</option>
                  <option value="ATK & Dokumentasi">ATK & Dokumentasi</option>
                  <option value="Lain-lain">Lain-lain</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Relawan / Pengambil
                  </label>
                  <input
                    type="text"
                    value={singleVolunteer}
                    onChange={e => setSingleVolunteer(e.target.value)}
                    placeholder="Contoh: roni, puspitasari..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    PIC Petugas Gudang
                  </label>
                  <input
                    type="text"
                    value={singlePic}
                    onChange={e => setSinglePic(e.target.value)}
                    placeholder="Contoh: teguh, ade, akmal..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={singleNotes}
                  onChange={e => setSingleNotes(e.target.value)}
                  placeholder="Contoh: Keperluan dapur pengolahan siang..."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    checked={deductStockIfMatch}
                    onChange={e => setDeductStockIfMatch(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                  />
                  <span>Potong saldo fisik gudang jika nama barang cocok di master inventaris</span>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: KELUARKAN BAHAN DAPUR */}
      {/* ========================================================================= */}
      {isKitchenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Keluarkan Bahan Pangan ke Dapur</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Memotong stok fisik gudang dan mencatat nomor bon pengeluaran bahan.
                </p>
              </div>
              <button
                onClick={() => setIsKitchenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordKitchenIssue} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Bahan Pangan Gudang <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={kitchenItemId}
                  onChange={e => setKitchenItemId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Pilih bahan dari inventaris --</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category}) — Stok: {item.currentStock} {item.baseUnit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah Pengeluaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    value={kitchenQty || ''}
                    onChange={e => setKitchenQty(parseFloat(e.target.value) || 0)}
                    placeholder="Contoh: 15"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sesi Makan
                  </label>
                  <select
                    value={kitchenMealSession}
                    onChange={e => setKitchenMealSession(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="Pagi">Makan Pagi (Sarapan)</option>
                    <option value="Siang">Makan Siang Utama</option>
                    <option value="Snack">Snack Bergizi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tujuan Penyaluran
                </label>
                <input
                  type="text"
                  value={kitchenDestination}
                  onChange={e => setKitchenDestination(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Menu Dapur
                </label>
                <input
                  type="text"
                  value={kitchenNotes}
                  onChange={e => setKitchenNotes(e.target.value)}
                  placeholder="Contoh: Persiapan 1200 porsi sup ayam..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsKitchenModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Keluarkan & Potong Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Datalists for autocomplete */}
      <datalist id="batch-item-datalist">
        {items.map(i => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>

      <datalist id="batch-unit-datalist">
        <option value="pack" />
        <option value="pcs" />
        <option value="kg" />
        <option value="liter" />
        <option value="botol" />
        <option value="kaplet" />
        <option value="dus" />
        <option value="roll" />
        <option value="ikat" />
      </datalist>
    </div>
  );
};
