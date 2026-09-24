import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { ItemMaster, StockStatus, BaseUnit, MainItemCategory, normalizeItemCategory } from '../types/warehouse';
import {
  Search,
  Plus,
  Filter,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowDownRight,
  Edit2,
  TableProperties,
  ClipboardPaste,
  PlusCircle,
  FileSpreadsheet,
  Download,
  Info,
  Package
} from 'lucide-react';
import { exportToExcel, downloadExcelTemplate } from '../lib/excelExport';

interface InventoryModuleProps {
  onRefreshData?: () => void;
}

interface BatchMasterItemRow {
  id: string;
  sku: string;
  name: string;
  category: MainItemCategory;
  baseUnit: BaseUnit;
  initialStock: number;
  minStock: number;
  location: string;
  notes: string;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ onRefreshData }) => {
  const { currentUser, can } = useAuth();

  const [items, setItems] = useState<ItemMaster[]>(() => warehouseDb.getItems());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'ALL' | MainItemCategory>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [successNotice, setSuccessNotice] = useState<string>('');

  // Modals
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [consumingItem, setConsumingItem] = useState<ItemMaster | null>(null);

  // Quick Kitchen Issue Form State
  const [consumeQty, setConsumeQty] = useState<number>(1);
  const [consumeNotes, setConsumeNotes] = useState('Pengeluaran untuk olahan menu dapur gizi siang');
  const [consumeLocation, setConsumeLocation] = useState('Dapur Utama - Pengolahan');

  // Single Item Form State
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<MainItemCategory>('Bahan Kering');
  const [formBaseUnit, setFormBaseUnit] = useState<BaseUnit>('Kg');
  const [formInitialStock, setFormInitialStock] = useState<number>(0);
  const [formMinStock, setFormMinStock] = useState<number>(10);
  const [formLocation, setFormLocation] = useState('Gudang Kering - Rak A');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Batch Master Items Form State
  const [batchMode, setBatchMode] = useState<'GRID' | 'PASTE'>('GRID');
  const [pasteRawText, setPasteRawText] = useState('');
  const [batchRows, setBatchRows] = useState<BatchMasterItemRow[]>([
    { id: '1', sku: 'BKR-001', name: '', category: 'Bahan Kering', baseUnit: 'Kg', initialStock: 0, minStock: 20, location: 'Gudang Kering', notes: '' },
    { id: '2', sku: 'BBS-001', name: '', category: 'Bahan Basah', baseUnit: 'Kg', initialStock: 0, minStock: 15, location: 'Chiller Dapur', notes: '' },
    { id: '3', sku: 'PRL-001', name: '', category: 'Bahan Peralatan', baseUnit: 'Pack', initialStock: 0, minStock: 5, location: 'Gudang Peralatan', notes: '' },
    { id: '4', sku: 'BKR-002', name: '', category: 'Bahan Kering', baseUnit: 'Kg', initialStock: 0, minStock: 20, location: 'Gudang Kering', notes: '' },
    { id: '5', sku: 'BBS-002', name: '', category: 'Bahan Basah', baseUnit: 'Kg', initialStock: 0, minStock: 10, location: 'Chiller Dapur', notes: '' },
  ]);

  const refreshData = () => {
    setItems(warehouseDb.getItems());
    if (onRefreshData) onRefreshData();
  };

  const getItemStockStatus = (item: ItemMaster): StockStatus => {
    if (item.currentStock <= 0) return 'OUT_OF_STOCK';
    if (item.currentStock <= item.minimumStock) return 'LOW';
    return 'NORMAL';
  };

  // Filter Items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = searchQuery.toLowerCase();
      const normCat = normalizeItemCategory(item.category);

      const matchesSearch =
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        normCat.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q);

      const matchesCategory =
        selectedCategoryTab === 'ALL' || normCat === selectedCategoryTab;

      const status = getItemStockStatus(item);
      const matchesStatus = filterStatus === 'ALL' || status === filterStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchQuery, selectedCategoryTab, filterStatus]);

  // Category summary counts
  const categoryCounts = useMemo(() => {
    const counts = { ALL: items.length, 'Bahan Kering': 0, 'Bahan Basah': 0, 'Bahan Peralatan': 0 };
    items.forEach(i => {
      const cat = normalizeItemCategory(i.category);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [items]);

  // ==========================================
  // SINGLE ITEM HANDLERS
  // ==========================================

  const handleOpenNewSingleItem = () => {
    setEditingItem(null);
    setFormSku(`ITM-${Date.now().toString().slice(-4)}`);
    setFormName('');
    setFormCategory('Bahan Kering');
    setFormBaseUnit('Kg');
    setFormInitialStock(0);
    setFormMinStock(20);
    setFormLocation('Gudang Kering');
    setFormNotes('');
    setFormError('');
    setIsSingleModalOpen(true);
  };

  const handleOpenEditItem = (item: ItemMaster) => {
    setEditingItem(item);
    setFormSku(item.id);
    setFormName(item.name);
    setFormCategory(normalizeItemCategory(item.category));
    setFormBaseUnit(item.baseUnit);
    setFormInitialStock(item.currentStock);
    setFormMinStock(item.minimumStock);
    setFormLocation(item.location);
    setFormNotes(item.notes || '');
    setFormError('');
    setIsSingleModalOpen(true);
  };

  const handleSaveSingleItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Nama barang wajib diisi.');
      return;
    }

    try {
      const isNew = !editingItem;
      const itemToSave: ItemMaster = {
        id: formSku.trim() || `ITM-${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        itemType: formCategory === 'Bahan Kering' ? 'FOOD_CARRYING_STOCK' : formCategory === 'Bahan Basah' ? 'FOOD_DAILY_FLOW' : 'OPERATIONAL_CONSUMABLE',
        category: formCategory,
        baseUnit: formBaseUnit,
        minimumStock: Number(formMinStock),
        reorderPoint: Number(formMinStock) * 1.5,
        currentStock: editingItem ? editingItem.currentStock : Number(formInitialStock),
        location: formLocation.trim() || (formCategory === 'Bahan Kering' ? 'Gudang Kering' : formCategory === 'Bahan Basah' ? 'Chiller Dapur' : 'Gudang Peralatan'),
        expiryTrackingEnabled: formCategory !== 'Bahan Peralatan',
        isActive: true,
        notes: formNotes.trim() || undefined,
        lastMovementDate: editingItem?.lastMovementDate,
      };

      warehouseDb.saveItem(itemToSave, currentUser, isNew);
      refreshData();
      setIsSingleModalOpen(false);
      setSuccessNotice(`Berhasil menyimpan data barang: ${itemToSave.name}`);
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data master barang.');
    }
  };

  // ==========================================
  // BATCH MASTER ITEMS HANDLERS
  // ==========================================

  const handleAddBatchRow = (count: number = 1) => {
    const newRows: BatchMasterItemRow[] = [];
    const timestamp = Date.now();
    for (let i = 0; i < count; i++) {
      newRows.push({
        id: String(timestamp + Math.random() + i),
        sku: `ITM-${String(timestamp + i).slice(-4)}`,
        name: '',
        category: 'Bahan Kering',
        baseUnit: 'Kg',
        initialStock: 0,
        minStock: 10,
        location: 'Gudang Kering',
        notes: '',
      });
    }
    setBatchRows(prev => [...prev, ...newRows]);
  };

  const handleUpdateBatchRow = (id: string, field: keyof BatchMasterItemRow, value: any) => {
    setBatchRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        // Auto adjust location and default unit based on category if changed
        if (field === 'category') {
          if (value === 'Bahan Kering') {
            updated.location = 'Gudang Kering';
            updated.baseUnit = 'Kg';
          } else if (value === 'Bahan Basah') {
            updated.location = 'Chiller Dapur';
            updated.baseUnit = 'Kg';
          } else if (value === 'Bahan Peralatan') {
            updated.location = 'Gudang Peralatan';
            updated.baseUnit = 'Pack';
          }
        }
        return updated;
      })
    );
  };

  const handleRemoveBatchRow = (id: string) => {
    setBatchRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : prev));
  };

  // Convert pasted text (from Excel) into batch master item rows
  const handleParsePastedText = () => {
    if (!pasteRawText.trim()) {
      alert('Silakan tempel teks data master barang dari Excel terlebih dahulu.');
      return;
    }

    const lines = pasteRawText.trim().split(/\r?\n/);
    const parsedRows: BatchMasterItemRow[] = [];

    lines.forEach((line, idx) => {
      let cols = line.split('\t');
      if (cols.length === 1 && line.includes(';')) cols = line.split(';');
      else if (cols.length === 1 && line.includes(',')) cols = line.split(',');

      const col0 = (cols[0] || '').trim();
      const col1 = (cols[1] || '').trim();
      const col2 = (cols[2] || '').trim();
      const col3 = (cols[3] || '').trim();
      const col4 = (cols[4] || '').trim();
      const col5 = (cols[5] || '').trim();
      const col6 = (cols[6] || '').trim();

      // Skip header line
      if (idx === 0 && (col0.toLowerCase().includes('kode') || col0.toLowerCase().includes('nama') || col1.toLowerCase().includes('nama'))) {
        return;
      }

      let sku = '';
      let name = '';
      let catStr = 'Bahan Kering';
      let unit: BaseUnit = 'Kg';
      let stock = 0;
      let min = 10;
      let loc = 'Gudang Kering';

      // Pattern A: [Kode, Nama, Kategori, Satuan, Stok, Min, Lokasi]
      if (cols.length >= 4) {
        if (col0.startsWith('ITM-') || col0.startsWith('PRL-') || col0.startsWith('BKR-') || col0.startsWith('BBS-') || col0.length <= 8) {
          sku = col0;
          name = col1;
          catStr = col2;
          unit = (col3 as BaseUnit) || 'Kg';
          stock = parseFloat(col4) || 0;
          min = parseFloat(col5) || 10;
          loc = col6 || '';
        } else {
          name = col0;
          catStr = col1;
          unit = (col2 as BaseUnit) || 'Kg';
          stock = parseFloat(col3) || 0;
          min = parseFloat(col4) || 10;
        }
      } else if (cols.length >= 2) {
        name = col0;
        unit = (col1 as BaseUnit) || 'Kg';
      } else if (col0) {
        name = col0;
      }

      if (name) {
        const normCat = normalizeItemCategory(catStr);
        parsedRows.push({
          id: String(Date.now() + Math.random() + idx),
          sku: sku || `ITM-${Date.now().toString().slice(-4)}-${idx + 1}`,
          name,
          category: normCat,
          baseUnit: unit,
          initialStock: stock,
          minStock: min,
          location: loc || (normCat === 'Bahan Kering' ? 'Gudang Kering' : normCat === 'Bahan Basah' ? 'Chiller Dapur' : 'Gudang Peralatan'),
          notes: '',
        });
      }
    });

    if (parsedRows.length > 0) {
      setBatchRows(parsedRows);
      setBatchMode('GRID');
      setPasteRawText('');
      alert(`Berhasil membaca ${parsedRows.length} item dari teks Excel! Silakan periksa di tabel dan klik "Simpan Semua".`);
    } else {
      alert('Tidak ada item yang dapat dibaca. Pastikan terdapat kolom nama barang.');
    }
  };

  // Submit All Batch Items
  const handleSaveAllBatchItems = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = batchRows.filter(r => r.name.trim() !== '');

    if (validRows.length === 0) {
      alert('Harap isi minimal 1 nama barang sebelum menyimpan.');
      return;
    }

    const payload: ItemMaster[] = validRows.map((r, idx) => {
      const sku = r.sku.trim() || `ITM-${Date.now().toString().slice(-4)}-${idx + 1}`;
      return {
        id: sku,
        name: r.name.trim(),
        itemType: r.category === 'Bahan Kering' ? 'FOOD_CARRYING_STOCK' : r.category === 'Bahan Basah' ? 'FOOD_DAILY_FLOW' : 'OPERATIONAL_CONSUMABLE',
        category: r.category,
        baseUnit: r.baseUnit,
        minimumStock: Math.max(0, Number(r.minStock) || 0),
        reorderPoint: (Number(r.minStock) || 10) * 1.5,
        currentStock: Math.max(0, Number(r.initialStock) || 0),
        location: r.location.trim() || (r.category === 'Bahan Kering' ? 'Gudang Kering' : r.category === 'Bahan Basah' ? 'Chiller Dapur' : 'Gudang Peralatan'),
        expiryTrackingEnabled: r.category !== 'Bahan Peralatan',
        isActive: true,
        notes: r.notes.trim() || undefined,
      };
    });

    warehouseDb.saveItemsBatch(payload, currentUser);
    refreshData();
    setIsBatchModalOpen(false);
    setSuccessNotice(`Berhasil menambahkan ${payload.length} item ke Master Barang sekaligus!`);
    setTimeout(() => setSuccessNotice(''), 5000);
  };

  // ==========================================
  // QUICK CONSUMPTION HANDLER
  // ==========================================

  const handleOpenConsume = (item: ItemMaster) => {
    setConsumingItem(item);
    setConsumeQty(1);
    setConsumeNotes('Pengeluaran untuk olahan menu dapur gizi');
    setConsumeLocation(item.location);
  };

  const handleExecuteConsumption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consumingItem) return;

    if (consumeQty > consumingItem.currentStock) {
      alert(`Stok tidak mencukupi! Stok saat ini: ${consumingItem.currentStock} ${consumingItem.baseUnit}`);
      return;
    }

    try {
      warehouseDb.recordConsumption(
        consumingItem.id,
        consumeQty,
        consumeLocation,
        currentUser,
        consumeNotes
      );
      refreshData();
      setConsumingItem(null);
      setSuccessNotice(`Pengeluaran ${consumeQty} ${consumingItem.baseUnit} ${consumingItem.name} berhasil dicatat.`);
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal mencatat pengeluaran bahan.');
    }
  };

  // Export Master Barang to Excel
  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      alert('Tidak ada data item untuk diekspor.');
      return;
    }

    const exportData = filteredItems.map((item, idx) => ({
      'No': idx + 1,
      'Kode SKU': item.id,
      'Nama Barang': item.name,
      'Kategori': normalizeItemCategory(item.category),
      'Satuan Dasar': item.baseUnit,
      'Stok Saat Ini': item.currentStock,
      'Batas Min Stok': item.minimumStock,
      'Status Stok': getItemStockStatus(item),
      'Lokasi Simpan / Rak': item.location,
      'Keterangan': item.notes || '-',
    }));

    exportToExcel(
      exportData,
      `Master_Barang_SPPG_${selectedCategoryTab}.xlsx`,
      'Master Barang'
    );
  };

  const handleDownloadTemplate = () => {
    downloadExcelTemplate(
      [
        { header: 'Kode SKU', example: 'BKR-001' },
        { header: 'Nama Barang', example: 'Beras Pandan Wangi Premium 25kg' },
        { header: 'Kategori', example: 'Bahan Kering' },
        { header: 'Satuan', example: 'Kg' },
        { header: 'Stok Awal', example: 500 },
        { header: 'Min Stok', example: 100 },
        { header: 'Lokasi Rak', example: 'Gudang Kering - Rak A1' },
      ],
      'Template_Master_Barang_SPPG'
    );
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

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Master Barang & Posisi Stok
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Katalog master persediaan SPPG Jeru Tumpang terbagi dalam 3 kelompok: Bahan Kering, Bahan Basah, dan Bahan Peralatan.
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

          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Excel</span>
          </button>

          {/* PRIMARY: Batch Master Item Input */}
          {can('MANAGE_ITEMS') && (
            <button
              onClick={() => setIsBatchModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer ring-2 ring-emerald-600/20"
              title="Input banyak master barang sekaligus"
            >
              <TableProperties className="w-4 h-4" />
              <span>Input Masal Master Barang</span>
            </button>
          )}

          {/* Single Item Add */}
          {can('MANAGE_ITEMS') && (
            <button
              onClick={handleOpenNewSingleItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Tambah Item Satuan</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Categories Main Tabs & Filters */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        {/* Category Tabs: Exactly 3 Categories Requested */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100">
          <button
            onClick={() => setSelectedCategoryTab('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedCategoryTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Semua Kategori ({categoryCounts.ALL})
          </button>

          <button
            onClick={() => setSelectedCategoryTab('Bahan Kering')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedCategoryTab === 'Bahan Kering'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-amber-800 hover:bg-amber-50 border border-amber-200'
            }`}
          >
            Bahan Kering ({categoryCounts['Bahan Kering']})
          </button>

          <button
            onClick={() => setSelectedCategoryTab('Bahan Basah')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedCategoryTab === 'Bahan Basah'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
            }`}
          >
            Bahan Basah ({categoryCounts['Bahan Basah']})
          </button>

          <button
            onClick={() => setSelectedCategoryTab('Bahan Peralatan')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              selectedCategoryTab === 'Bahan Peralatan'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-blue-800 hover:bg-blue-50 border border-blue-200'
            }`}
          >
            Bahan Peralatan ({categoryCounts['Bahan Peralatan']})
          </button>
        </div>

        {/* Search & Stock Status */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari SKU, nama barang, atau lokasi rak..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Filter className="w-3.5 h-3.5" />
              <span>Status Stok:</span>
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low Stock (Di Bawah Min)</option>
              <option value="OUT_OF_STOCK">Habis (0 Stock)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3.5">Kode SKU</th>
                <th className="py-2.5 px-3.5">Nama Barang</th>
                <th className="py-2.5 px-3.5">Kategori</th>
                <th className="py-2.5 px-3.5 text-right">Stok Fisik</th>
                <th className="py-2.5 px-3.5 text-right">Batas Min</th>
                <th className="py-2.5 px-3.5">Status</th>
                <th className="py-2.5 px-3.5">Lokasi Simpan</th>
                <th className="py-2.5 px-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                    Tidak ada barang yang cocok dengan filter. Klik "Input Masal Master Barang" untuk menambah item.
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const status = getItemStockStatus(item);
                  const normCat = normalizeItemCategory(item.category);

                  const catBadgeClass =
                    normCat === 'Bahan Kering'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : normCat === 'Bahan Basah'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-blue-50 text-blue-800 border-blue-200';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3.5 font-mono text-slate-500 font-semibold">
                        {item.id}
                      </td>
                      <td className="py-2.5 px-3.5 font-bold text-slate-900">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-3.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${catBadgeClass}`}>
                          {normCat}
                        </span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {item.currentStock.toLocaleString('id-ID')}
                        </span>{' '}
                        <span className="text-slate-500 text-[11px] font-medium">{item.baseUnit}</span>
                      </td>
                      <td className="py-2.5 px-3.5 text-right font-mono text-slate-500 text-[11px]">
                        {item.minimumStock} {item.baseUnit}
                      </td>
                      <td className="py-2.5 px-3.5">
                        {status === 'NORMAL' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Normal
                          </span>
                        )}
                        {status === 'LOW' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3 h-3" /> Stok Rendah
                          </span>
                        )}
                        {status === 'OUT_OF_STOCK' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                            <XCircle className="w-3 h-3" /> Habis
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-slate-600 text-[11px]">{item.location}</td>
                      <td className="py-2.5 px-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {can('RECORD_CONSUMPTION') && (
                            <button
                              onClick={() => handleOpenConsume(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded border border-amber-200 transition-colors cursor-pointer"
                              title="Keluarkan bahan untuk kebutuhan dapur"
                            >
                              <ArrowDownRight className="w-3 h-3" />
                              <span>Keluar</span>
                            </button>
                          )}
                          {can('MANAGE_ITEMS') && (
                            <button
                              onClick={() => handleOpenEditItem(item)}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Edit Master Data"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
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

      {/* ========================================================================= */}
      {/* MODAL 1: BATCH INPUT MASTER BARANG */}
      {/* ========================================================================= */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TableProperties className="w-5 h-5 text-emerald-600" />
                  Input Masal Master Barang
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tambahkan banyak barang sekaligus ke dalam 3 kelompok kategori: Bahan Kering, Bahan Basah, dan Bahan Peralatan.
                </p>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setBatchMode('GRID')}
                    className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      batchMode === 'GRID' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Tabel Cepat
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchMode('PASTE')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      batchMode === 'PASTE' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
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

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* MODE 1: GRID TABEL */}
              {batchMode === 'GRID' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <th className="py-2 px-2 text-center w-8">#</th>
                            <th className="py-2 px-2 w-28">Kode SKU</th>
                            <th className="py-2 px-2.5 min-w-[200px]">Nama Barang <span className="text-rose-500">*</span></th>
                            <th className="py-2 px-2 w-36">Kategori</th>
                            <th className="py-2 px-2 w-24">Satuan</th>
                            <th className="py-2 px-2 w-24 text-center">Stok Awal</th>
                            <th className="py-2 px-2 w-24 text-center">Min Stok</th>
                            <th className="py-2 px-2 min-w-[140px]">Lokasi Rak</th>
                            <th className="py-2 px-1 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {batchRows.map((row, idx) => (
                            <tr key={row.id} className="hover:bg-slate-50/80">
                              <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              {/* SKU */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.sku}
                                  onChange={e => handleUpdateBatchRow(row.id, 'sku', e.target.value)}
                                  placeholder="SKU-001"
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700 font-mono text-[11px]"
                                />
                              </td>

                              {/* Nama */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.name}
                                  onChange={e => handleUpdateBatchRow(row.id, 'name', e.target.value)}
                                  placeholder="Nama barang..."
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
                                />
                              </td>

                              {/* Kategori: 3 Kategori Saja */}
                              <td className="py-1.5 px-2">
                                <select
                                  value={row.category}
                                  onChange={e => handleUpdateBatchRow(row.id, 'category', e.target.value as MainItemCategory)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 cursor-pointer font-medium"
                                >
                                  <option value="Bahan Kering">Bahan Kering</option>
                                  <option value="Bahan Basah">Bahan Basah</option>
                                  <option value="Bahan Peralatan">Bahan Peralatan</option>
                                </select>
                              </td>

                              {/* Satuan */}
                              <td className="py-1.5 px-2">
                                <select
                                  value={row.baseUnit}
                                  onChange={e => handleUpdateBatchRow(row.id, 'baseUnit', e.target.value as BaseUnit)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 cursor-pointer"
                                >
                                  <option value="Kg">Kg</option>
                                  <option value="Pcs">Pcs</option>
                                  <option value="Pack">Pack</option>
                                  <option value="Liter">Liter</option>
                                  <option value="Botol">Botol</option>
                                  <option value="Dus">Dus</option>
                                  <option value="Gram">Gram</option>
                                  <option value="Ikat">Ikat</option>
                                  <option value="Roll">Roll</option>
                                </select>
                              </td>

                              {/* Stok Awal */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.initialStock}
                                  onChange={e => handleUpdateBatchRow(row.id, 'initialStock', parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-center font-mono"
                                />
                              </td>

                              {/* Min Stok */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.minStock}
                                  onChange={e => handleUpdateBatchRow(row.id, 'minStock', parseFloat(e.target.value) || 0)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-center font-mono"
                                />
                              </td>

                              {/* Lokasi */}
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.location}
                                  onChange={e => handleUpdateBatchRow(row.id, 'location', e.target.value)}
                                  placeholder="Lokasi rak..."
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                                />
                              </td>

                              {/* Hapus */}
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
                        onClick={() => handleAddBatchRow(1)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah 1 Baris</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddBatchRow(5)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Tambah 5 Baris Sekaligus</span>
                      </button>
                    </div>

                    <span className="text-xs text-slate-500 font-medium">
                      {batchRows.filter(r => r.name.trim() !== '').length} nama barang terisi
                    </span>
                  </div>
                </div>
              )}

              {/* MODE 2: PASTE DARI EXCEL */}
              {batchMode === 'PASTE' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-800 mb-1">
                      <Info className="w-4 h-4" />
                      Salin & Tempel Data Master Barang dari Spreadsheet
                    </div>
                    Blok kolom data pada lembar Excel Master Barang Anda (misal: <strong>Kode Barang, Nama Barang, Kategori, Satuan, Stok Awal, Min Stok, Lokasi</strong>), lalu tekan <strong>Ctrl + C</strong>, dan tempel (<strong>Ctrl + V</strong>) di kotak di bawah.
                  </div>

                  <textarea
                    rows={9}
                    value={pasteRawText}
                    onChange={e => setPasteRawText(e.target.value)}
                    placeholder="Contoh salinan Excel:&#10;BKR-001	Beras Pandan Wangi	Bahan Kering	Kg	500	100	Gudang Kering&#10;BBS-001	Ayam Karkas Segar	Bahan Basah	Kg	150	25	Chiller Dapur&#10;PRL-001	Sunlight Cuci Piring 5L	Bahan Peralatan	Pcs	12	4	Gudang Peralatan"
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

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Total item siap simpan:{' '}
                <strong className="text-slate-800">
                  {batchRows.filter(r => r.name.trim() !== '').length} barang
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
                  onClick={handleSaveAllBatchItems}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Simpan Semua ({batchRows.filter(r => r.name.trim() !== '').length} Barang) ke Master
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: SINGLE ITEM ADD / EDIT */}
      {/* ========================================================================= */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-600" />
                {editingItem ? 'Edit Master Data Item' : 'Tambah Master Item Baru'}
              </h3>
              <button
                onClick={() => setIsSingleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSingleItem} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kode SKU / ID Barang <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingItem}
                    value={formSku}
                    onChange={e => setFormSku(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={e => {
                      const newCat = e.target.value as MainItemCategory;
                      setFormCategory(newCat);
                      if (newCat === 'Bahan Kering') setFormLocation('Gudang Kering');
                      else if (newCat === 'Bahan Basah') setFormLocation('Chiller Dapur');
                      else setFormLocation('Gudang Peralatan');
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium"
                  >
                    <option value="Bahan Kering">Bahan Kering</option>
                    <option value="Bahan Basah">Bahan Basah</option>
                    <option value="Bahan Peralatan">Bahan Peralatan</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Contoh: Beras Pandan Wangi Premium 25kg"
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Satuan Dasar <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formBaseUnit}
                    onChange={e => setFormBaseUnit(e.target.value as BaseUnit)}
                    className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="Kg">Kg</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Pack">Pack</option>
                    <option value="Liter">Liter</option>
                    <option value="Botol">Botol</option>
                    <option value="Dus">Dus</option>
                    <option value="Gram">Gram</option>
                    <option value="Ikat">Ikat</option>
                    <option value="Roll">Roll</option>
                  </select>
                </div>

                {!editingItem && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Stok Awal</label>
                    <input
                      type="number"
                      min="0"
                      value={formInitialStock}
                      onChange={e => setFormInitialStock(parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Batas Min Stok</label>
                  <input
                    type="number"
                    min="0"
                    value={formMinStock}
                    onChange={e => setFormMinStock(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Simpan / Rak</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  placeholder="Contoh: Gudang Kering - Rak A1"
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan / Keterangan</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Keterangan spesifikasi barang..."
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  {editingItem ? 'Simpan Perubahan' : 'Tambah Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: QUICK KITCHEN CONSUMPTION */}
      {/* ========================================================================= */}
      {consumingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-amber-600" />
                Catat Pengeluaran Bahan ke Dapur
              </h3>
              <button
                onClick={() => setConsumingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteConsumption} className="mt-4 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900">
                <div className="font-bold text-sm">{consumingItem.name}</div>
                <div className="flex justify-between mt-1 text-slate-600">
                  <span>Stok Fisik Tersedia:</span>
                  <span className="font-bold text-slate-900">
                    {consumingItem.currentStock} {consumingItem.baseUnit}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah Pengeluaran ({consumingItem.baseUnit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  max={consumingItem.currentStock}
                  required
                  value={consumeQty}
                  onChange={e => setConsumeQty(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tujuan Penyaluran</label>
                <input
                  type="text"
                  value={consumeLocation}
                  onChange={e => setConsumeLocation(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan / Keperluan</label>
                <textarea
                  rows={2}
                  value={consumeNotes}
                  onChange={e => setConsumeNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                ></textarea>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConsumingItem(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Konfirmasi Pengeluaran
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
