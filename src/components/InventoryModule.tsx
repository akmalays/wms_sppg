import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  ItemMaster,
  StockStatus,
  BaseUnit,
  StockOpnameSession,
  StockOpnameItem,
  UserRole
} from '../types/warehouse';
import {
  Boxes,
  Package,
  ClipboardCheck,
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
  Printer,
  ChevronRight,
  Eye,
  X,
  ShieldAlert,
  Check,
  RefreshCw,
  ShoppingBag,
  Store,
  Layers,
  Minus
} from 'lucide-react';
import { SppgLogo } from './SppgLogo';
import { exportToExcel, downloadExcelTemplate } from '../lib/excelExport';

interface InventoryModuleProps {
  onRefreshData?: () => void;
  initialTab?: 'stock' | 'opname';
}

export const SPPG_STOCK_CATEGORIES = [
  'Semua Kategori',
  'Bahan Basah',
  'Bahan Kering',
  'ATK & Administrasi',
  'Alat Kebersihan',
  'Perlengkapan & APD',
  'Operasional & Keperluan Lain',
] as const;

export type SppgCategory = typeof SPPG_STOCK_CATEGORIES[number];

// Helper to categorize items cleanly
export function getDetailedItemCategory(item: { name: string; category?: string; subcategory?: string }): SppgCategory {
  const cat = (item.category || '').toLowerCase();
  const sub = (item.subcategory || '').toLowerCase();
  const name = (item.name || '').toLowerCase();

  if (
    cat.includes('protein') || cat.includes('unggas') || cat.includes('telur') || cat.includes('ikan') ||
    cat.includes('sayur') || cat.includes('buah') || cat.includes('basah') ||
    name.includes('ayam') || name.includes('daging') || name.includes('telur') || name.includes('ikan') ||
    name.includes('sayur') || name.includes('bayam') || name.includes('kangkung') || name.includes('wortel') ||
    name.includes('buah') || name.includes('pisang') || name.includes('semangka') || name.includes('pepaya') ||
    name.includes('tahu') || name.includes('tempe') || name.includes('melon') || name.includes('labu')
  ) {
    return 'Bahan Basah';
  }

  if (
    cat.includes('sembako') || cat.includes('beras') || cat.includes('minyak') || cat.includes('pemanis') ||
    cat.includes('tepung') || cat.includes('bumbu') || cat.includes('rempah') || cat.includes('kering') ||
    name.includes('beras') || name.includes('minyak') || name.includes('gula') || name.includes('tepung') ||
    name.includes('garam') || name.includes('kecap') || name.includes('saus') || name.includes('bawang') ||
    name.includes('merica') || name.includes('racik') || name.includes('mie') || name.includes('bihun')
  ) {
    return 'Bahan Kering';
  }

  if (
    cat.includes('atk') || cat.includes('kantor') || cat.includes('administrasi') ||
    name.includes('hvs') || name.includes('kertas') || name.includes('pulpen') || name.includes('spidol') ||
    name.includes('buku') || name.includes('ordner') || name.includes('map') || name.includes('printer') ||
    name.includes('tinta') || name.includes('staples') || name.includes('lakban')
  ) {
    return 'ATK & Administrasi';
  }

  if (
    cat.includes('cleaning') || cat.includes('deterjen') || cat.includes('kebersihan') || cat.includes('sanitasi') ||
    name.includes('sunlight') || name.includes('karbol') || name.includes('wipol') || name.includes('sabun') ||
    name.includes('spons') || name.includes('lap') || name.includes('kanebo') || name.includes('trash') ||
    name.includes('sampah') || name.includes('sapu') || name.includes('pel') || name.includes('mop')
  ) {
    return 'Alat Kebersihan';
  }

  if (
    cat.includes('packaging') || cat.includes('hygiene') || cat.includes('ppe') || cat.includes('pelindung') ||
    name.includes('sarung tangan') || name.includes('masker') || name.includes('nurse cap') || name.includes('celemek') ||
    name.includes('apron') || name.includes('mika') || name.includes('thinwall') || name.includes('kresek') ||
    name.includes('plastik') || name.includes('pisau') || name.includes('spatula')
  ) {
    return 'Perlengkapan & APD';
  }

  if (
    cat.includes('operational') || cat.includes('utilitas') ||
    name.includes('gas') || name.includes('elpiji') || name.includes('galon') || name.includes('es batu') ||
    name.includes('listrik') || name.includes('token') || name.includes('air')
  ) {
    return 'Operasional & Keperluan Lain';
  }

  return 'Bahan Kering';
}

// Realistic unit price reference for inventory asset value
const DEFAULT_PRICE_MAP: Record<string, number> = {
  ayam: 38000,
  daging: 120000,
  telur: 28000,
  ikan: 35000,
  bayam: 3500,
  kangkung: 3000,
  wortel: 12000,
  labu: 9000,
  pisang: 16000,
  semangka: 8500,
  pepaya: 7500,
  tahu: 1000,
  tempe: 4000,
  beras: 14500,
  minyak: 18000,
  gula: 17500,
  tepung: 12000,
  garam: 4000,
  kecap: 24000,
  saus: 18000,
  bawang: 38000,
  bumbu: 3000,
  hvs: 48000,
  buku: 18000,
  pulpen: 25000,
  spidol: 9000,
  map: 26000,
  tinta: 85000,
  sunlight: 18500,
  karbol: 16000,
  wipol: 16000,
  spons: 14000,
  kanebo: 15000,
  trash: 28000,
  sapu: 35000,
  pel: 85000,
  kresek: 15000,
  mika: 135000,
  'sarung tangan': 14000,
  masker: 25000,
  'nurse cap': 32000,
  gas: 215000,
  galon: 20000,
  es: 15000,
};

function getItemEstimatedUnitPrice(name: string, category: string): number {
  const lower = name.toLowerCase();
  for (const key of Object.keys(DEFAULT_PRICE_MAP)) {
    if (lower.includes(key)) return DEFAULT_PRICE_MAP[key];
  }
  if (category.includes('Basah')) return 25000;
  if (category.includes('Kering')) return 15000;
  if (category.includes('ATK')) return 20000;
  if (category.includes('Kebersihan')) return 18000;
  return 15000;
}

interface BatchMasterItemRow {
  id: string;
  sku: string;
  name: string;
  category: SppgCategory;
  baseUnit: BaseUnit;
  initialStock: number;
  minStock: number;
  location: string;
  notes: string;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ onRefreshData, initialTab = 'stock' }) => {
  const { currentUser, can } = useAuth();

  // Top level active tab: 'stock' (Data Stok Keseluruhan) vs 'opname' (Stok Opname Fisik)
  const [activeMainTab, setActiveMainTab] = useState<'stock' | 'opname'>(initialTab);

  useEffect(() => {
    if (initialTab) setActiveMainTab(initialTab);
  }, [initialTab]);

  // Data states
  const [dataVersion, setDataVersion] = useState(0);
  const items = useMemo(() => warehouseDb.getItems(), [dataVersion]);
  const opnames = useMemo(() => warehouseDb.getOpnames(), [dataVersion]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<SppgCategory>('Semua Kategori');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [successNotice, setSuccessNotice] = useState<string>('');

  // ----------------------------------------------------
  // Stock Tab Modals
  // ----------------------------------------------------
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<ItemMaster | null>(null);
  const [adjustQtyDelta, setAdjustQtyDelta] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'ADD' | 'SUBTRACT' | 'SET'>('ADD');
  const [adjustReason, setAdjustReason] = useState('Koreksi stok fisik');

  // Single Item Form State
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<SppgCategory>('Bahan Kering');
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
    { id: '1', sku: 'BBS-001', name: '', category: 'Bahan Basah', baseUnit: 'Kg', initialStock: 0, minStock: 15, location: 'Chiller Dapur', notes: '' },
    { id: '2', sku: 'BKR-001', name: '', category: 'Bahan Kering', baseUnit: 'Kg', initialStock: 0, minStock: 20, location: 'Gudang Kering', notes: '' },
    { id: '3', sku: 'ATK-001', name: '', category: 'ATK & Administrasi', baseUnit: 'Rim', initialStock: 0, minStock: 5, location: 'Ruang Kantor', notes: '' },
    { id: '4', sku: 'CLN-001', name: '', category: 'Alat Kebersihan', baseUnit: 'Pouch', initialStock: 0, minStock: 10, location: 'Gudang Kebersihan', notes: '' },
    { id: '5', sku: 'PRL-001', name: '', category: 'Perlengkapan & APD', baseUnit: 'Pack', initialStock: 0, minStock: 10, location: 'Gudang Kemasan', notes: '' },
  ]);

  // ----------------------------------------------------
  // Opname Tab States
  // ----------------------------------------------------
  const [isCreateOpnameModalOpen, setIsCreateOpnameModalOpen] = useState(false);
  const [viewingOpname, setViewingOpname] = useState<StockOpnameSession | null>(null);
  const [opnameCategoryFilter, setOpnameCategoryFilter] = useState<SppgCategory>('Semua Kategori');
  const [opnameFormDate, setOpnameFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [opnameFormLocation, setOpnameFormLocation] = useState('Gudang SPPG Jeru Tumpang');
  const [opnameFormNotes, setOpnameFormNotes] = useState('');
  const [opnameStatusFilter, setOpnameStatusFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED'>('ALL');
  const [opnameSearchQuery, setOpnameSearchQuery] = useState('');
  const [countingItems, setCountingItems] = useState<
    { itemId: string; name: string; category: SppgCategory; unit: string; systemStock: number; physicalCount: number; variance: number; reason: string }[]
  >([]);

  const refreshData = () => {
    setDataVersion(v => v + 1);
    if (onRefreshData) onRefreshData();
  };

  const showToast = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(''), 4500);
  };

  const getItemStockStatus = (item: ItemMaster): StockStatus => {
    if (item.currentStock <= 0) return 'OUT_OF_STOCK';
    if (item.currentStock <= item.minimumStock) return 'LOW';
    return 'NORMAL';
  };

  // Filtered Items for Stock Tab
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const q = searchQuery.toLowerCase();
      const detailedCat = getDetailedItemCategory(item);

      const matchesSearch =
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        detailedCat.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q);

      const matchesCategory =
        selectedCategoryTab === 'Semua Kategori' || detailedCat === selectedCategoryTab;

      const status = getItemStockStatus(item);
      let matchesStatus = true;
      if (filterStatus === 'NORMAL') matchesStatus = status === 'NORMAL';
      else if (filterStatus === 'LOW') matchesStatus = status === 'LOW';
      else if (filterStatus === 'OUT_OF_STOCK') matchesStatus = status === 'OUT_OF_STOCK';

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [items, searchQuery, selectedCategoryTab, filterStatus]);

  // Overall KPI Metrics for Stock Tab
  const stockMetrics = useMemo(() => {
    let totalAssetValue = 0;
    let normalCount = 0;
    let lowCount = 0;
    let outCount = 0;

    const categoryItemCounts: Record<SppgCategory, number> = {
      'Semua Kategori': items.length,
      'Bahan Basah': 0,
      'Bahan Kering': 0,
      'ATK & Administrasi': 0,
      'Alat Kebersihan': 0,
      'Perlengkapan & APD': 0,
      'Operasional & Keperluan Lain': 0,
    };

    items.forEach(i => {
      const cat = getDetailedItemCategory(i);
      if (categoryItemCounts[cat] !== undefined) {
        categoryItemCounts[cat]++;
      }
      const price = getItemEstimatedUnitPrice(i.name, cat);
      totalAssetValue += Math.max(0, i.currentStock) * price;

      const status = getItemStockStatus(i);
      if (status === 'NORMAL') normalCount++;
      else if (status === 'LOW') lowCount++;
      else outCount++;
    });

    return {
      totalItems: items.length,
      totalAssetValue,
      normalCount,
      lowCount,
      outCount,
      categoryItemCounts,
    };
  }, [items]);

  // ----------------------------------------------------
  // Opname Logic & Handlers
  // ----------------------------------------------------
  const handleOpenCreateOpname = (presetCategory?: SppgCategory) => {
    const chosenCat = presetCategory || (selectedCategoryTab !== 'Semua Kategori' ? selectedCategoryTab : 'Semua Kategori');
    setOpnameCategoryFilter(chosenCat);
    setOpnameFormDate(new Date().toISOString().slice(0, 10));
    setOpnameFormLocation(
      chosenCat === 'Bahan Basah'
        ? 'Chiller & Dapur Pengolahan'
        : chosenCat === 'Bahan Kering'
        ? 'Gudang Kering & Sembako'
        : chosenCat === 'ATK & Administrasi'
        ? 'Ruang Kantor & Administrasi'
        : chosenCat === 'Alat Kebersihan'
        ? 'Gudang Sanitasi & Kebersihan'
        : 'Gudang Utama SPPG Jeru Tumpang'
    );
    setOpnameFormNotes(`Stock Opname Berkala [${chosenCat}] SPPG Jeru Tumpang`);
    initOpnameItems(chosenCat);
    setIsCreateOpnameModalOpen(true);
  };

  const initOpnameItems = (cat: SppgCategory) => {
    const pool = cat === 'Semua Kategori'
      ? items
      : items.filter(i => getDetailedItemCategory(i) === cat);

    setCountingItems(
      pool.map(item => ({
        itemId: item.id,
        name: item.name,
        category: getDetailedItemCategory(item),
        unit: item.baseUnit,
        systemStock: item.currentStock,
        physicalCount: item.currentStock, // default to system stock for convenience
        variance: 0,
        reason: '',
      }))
    );
  };

  const handleOpnameCategoryChange = (cat: SppgCategory) => {
    setOpnameCategoryFilter(cat);
    setOpnameFormNotes(`Stock Opname Berkala [${cat}] SPPG Jeru Tumpang`);
    initOpnameItems(cat);
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
        reason: diff === 0 ? '' : updated[index].reason || 'Susut alami / penimbangan',
      };
      return updated;
    });
  };

  const handleOpnameStep = (index: number, delta: number) => {
    setCountingItems(prev => {
      const updated = [...prev];
      const nextCount = Math.max(0, Number((updated[index].physicalCount + delta).toFixed(2)));
      const diff = Number((nextCount - updated[index].systemStock).toFixed(2));
      updated[index] = {
        ...updated[index],
        physicalCount: nextCount,
        variance: diff,
        reason: diff === 0 ? '' : updated[index].reason || 'Susut alami / penimbangan',
      };
      return updated;
    });
  };

  const handleOpnameMatch = (index: number) => {
    setCountingItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        physicalCount: updated[index].systemStock,
        variance: 0,
        reason: '',
      };
      return updated;
    });
  };

  const handleOpnameReasonChange = (index: number, val: string) => {
    setCountingItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], reason: val };
      return updated;
    });
  };

  const handleSubmitOpnameSession = (directApprove: boolean = false) => {
    if (countingItems.length === 0) {
      alert('Tidak ada item dalam kategori yang dipilih untuk di-opname.');
      return;
    }

    // Validate variances
    for (const item of countingItems) {
      if (item.variance !== 0 && (!item.reason || item.reason.trim().length === 0)) {
        alert(`Item "${item.name}" memiliki selisih (${item.variance > 0 ? '+' : ''}${item.variance} ${item.unit}). Harap isi alasan selisih fisik.`);
        return;
      }
    }

    try {
      const session = warehouseDb.createStockOpname(
        opnameFormDate,
        opnameFormLocation,
        countingItems.map(c => ({
          itemId: c.itemId,
          physicalCount: c.physicalCount,
          reason: c.reason,
        })),
        currentUser,
        `[Kategori: ${opnameCategoryFilter}] ${opnameFormNotes}`.trim()
      );

      if (directApprove && can('APPROVE_OPNAME')) {
        warehouseDb.approveStockOpname(session.id, currentUser);
        showToast(`Stock Opname #${session.id} (${opnameCategoryFilter}) berhasil dibuat & langsung disetujui! Stok fisik telah diperbarui.`);
      } else {
        showToast(`Sesi Stock Opname #${session.id} (${opnameCategoryFilter}) berhasil diajukan! Menunggu otorisasi manager.`);
      }

      setIsCreateOpnameModalOpen(false);
      refreshData();
    } catch (err: any) {
      alert(err.message || 'Gagal membuat sesi stock opname.');
    }
  };

  const handleApproveOpname = (session: StockOpnameSession) => {
    if (!can('APPROVE_OPNAME')) {
      alert('Anda tidak memiliki peran otorisasi untuk menyetujui Stock Opname (Hanya Manager / Superadmin).');
      return;
    }

    if (window.confirm(`Setujui Stock Opname #${session.id}? Saldo stok fisik sistem akan langsung disesuaikan dengan hasil hitung fisik.`)) {
      try {
        warehouseDb.approveStockOpname(session.id, currentUser);
        showToast(`Stock Opname #${session.id} berhasil disetujui! Saldo stok gudang telah diperbarui.`);
        refreshData();
        setViewingOpname(null);
      } catch (err: any) {
        alert(err.message || 'Gagal menyetujui stock opname.');
      }
    }
  };

  // Filtered Opname History List
  const filteredOpnames = useMemo(() => {
    return opnames.filter(s => {
      const q = opnameSearchQuery.toLowerCase();
      const matchSearch =
        s.id.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.createdByName.toLowerCase().includes(q) ||
        (s.notes || '').toLowerCase().includes(q);

      const matchStatus = opnameStatusFilter === 'ALL' || s.status === opnameStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [opnames, opnameSearchQuery, opnameStatusFilter]);

  // ----------------------------------------------------
  // Quick Stock Adjustment Handler
  // ----------------------------------------------------
  const handleOpenAdjust = (item: ItemMaster) => {
    setAdjustingItem(item);
    setAdjustQtyDelta(1);
    setAdjustType('ADD');
    setAdjustReason('Penyesuaian stok fisik');
  };

  const handleSaveAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    try {
      let targetStock = adjustingItem.currentStock;
      if (adjustType === 'ADD') targetStock = adjustingItem.currentStock + adjustQtyDelta;
      else if (adjustType === 'SUBTRACT') targetStock = Math.max(0, adjustingItem.currentStock - adjustQtyDelta);
      else if (adjustType === 'SET') targetStock = Math.max(0, adjustQtyDelta);

      warehouseDb.saveItem({
        ...adjustingItem,
        currentStock: targetStock,
        notes: `${adjustingItem.notes ? adjustingItem.notes + ' • ' : ''}[Penyesuaian: ${adjustReason}]`
      }, currentUser, false);

      showToast(`Stok ${adjustingItem.name} berhasil disesuaikan menjadi ${targetStock} ${adjustingItem.baseUnit}!`);
      setAdjustingItem(null);
      refreshData();
    } catch (err: any) {
      alert(err.message || 'Gagal menyesuaikan stok.');
    }
  };

  // ----------------------------------------------------
  // Single Item Master Modal Handlers
  // ----------------------------------------------------
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
    setFormCategory(getDetailedItemCategory(item));
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
        itemType: formCategory === 'Bahan Kering'
          ? 'FOOD_CARRYING_STOCK'
          : formCategory === 'Bahan Basah'
          ? 'FOOD_DAILY_FLOW'
          : 'OPERATIONAL_CONSUMABLE',
        category: formCategory,
        baseUnit: formBaseUnit,
        minimumStock: Number(formMinStock),
        reorderPoint: Number(formMinStock) * 1.5,
        currentStock: editingItem ? editingItem.currentStock : Number(formInitialStock),
        location: formLocation.trim() || 'Gudang Utama',
        expiryTrackingEnabled: formCategory === 'Bahan Basah' || formCategory === 'Bahan Kering',
        isActive: true,
        notes: formNotes.trim() || undefined,
        lastMovementDate: editingItem?.lastMovementDate,
      };

      warehouseDb.saveItem(itemToSave, currentUser, isNew);
      refreshData();
      setIsSingleModalOpen(false);
      showToast(`Berhasil menyimpan data barang: ${itemToSave.name}`);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan data barang.');
    }
  };

  // ----------------------------------------------------
  // Batch Master Items Handlers
  // ----------------------------------------------------
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
        if (field === 'category') {
          if (value === 'Bahan Kering') {
            updated.location = 'Gudang Kering';
            updated.baseUnit = 'Kg';
          } else if (value === 'Bahan Basah') {
            updated.location = 'Chiller Dapur';
            updated.baseUnit = 'Kg';
          } else if (value === 'ATK & Administrasi') {
            updated.location = 'Ruang Kantor';
            updated.baseUnit = 'Rim';
          } else if (value === 'Alat Kebersihan') {
            updated.location = 'Gudang Kebersihan';
            updated.baseUnit = 'Pouch';
          } else {
            updated.location = 'Gudang Utama';
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

      const c0 = (cols[0] || '').trim();
      const c1 = (cols[1] || '').trim();
      const c2 = (cols[2] || '').trim();
      const c3 = (cols[3] || '').trim();
      const c4 = (cols[4] || '').trim();

      if (idx === 0 && (c0.toLowerCase().includes('sku') || c0.toLowerCase().includes('nama'))) return;

      let name = c0;
      let cat: SppgCategory = 'Bahan Kering';
      let unit: BaseUnit = 'Kg';
      let stock = 0;
      let minStock = 10;

      if (cols.length >= 3) {
        name = c0;
        unit = (c1 || 'Kg') as BaseUnit;
        stock = parseFloat(c2) || 0;
        minStock = parseFloat(c3) || 10;
      }

      if (name) {
        cat = getDetailedItemCategory({ name });
        parsedRows.push({
          id: String(Date.now() + Math.random() + idx),
          sku: `ITM-${Date.now().toString().slice(-4)}-${idx + 1}`,
          name,
          category: cat,
          baseUnit: unit,
          initialStock: stock,
          minStock,
          location: cat === 'Bahan Basah' ? 'Chiller Dapur' : 'Gudang Utama',
          notes: c4 || '',
        });
      }
    });

    if (parsedRows.length > 0) {
      setBatchRows(parsedRows);
      setBatchMode('GRID');
      setPasteRawText('');
      alert(`Berhasil membaca ${parsedRows.length} baris barang dari Excel! Periksa dan simpan.`);
    } else {
      alert('Tidak ada baris barang yang terdeteksi.');
    }
  };

  const handleSaveAllBatchMaster = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = batchRows.filter(r => r.name.trim() !== '');
    if (validRows.length === 0) {
      alert('Harap isi minimal 1 nama barang pada tabel.');
      return;
    }

    try {
      const itemsToSave: ItemMaster[] = validRows.map(r => ({
        id: r.sku.trim() || `ITM-${Date.now().toString().slice(-4)}`,
        name: r.name.trim(),
        itemType: r.category === 'Bahan Basah'
          ? 'FOOD_DAILY_FLOW'
          : r.category === 'Bahan Kering'
          ? 'FOOD_CARRYING_STOCK'
          : 'OPERATIONAL_CONSUMABLE',
        category: r.category,
        baseUnit: r.baseUnit,
        minimumStock: Number(r.minStock) || 10,
        reorderPoint: (Number(r.minStock) || 10) * 1.5,
        currentStock: Number(r.initialStock) || 0,
        location: r.location.trim() || 'Gudang Utama',
        expiryTrackingEnabled: r.category === 'Bahan Basah' || r.category === 'Bahan Kering',
        isActive: true,
        notes: r.notes.trim() || undefined,
      }));

      warehouseDb.saveItemsBatch(itemsToSave, currentUser);
      refreshData();
      setIsBatchModalOpen(false);
      showToast(`Berhasil menyimpan ${validRows.length} master barang baru sekaligus!`);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan batch barang.');
    }
  };

  // Export Stock Data to Excel
  const handleExportStockExcel = () => {
    if (filteredItems.length === 0) {
      alert('Tidak ada data stok untuk diekspor.');
      return;
    }

    const rows = filteredItems.map((item, idx) => {
      const cat = getDetailedItemCategory(item);
      const price = getItemEstimatedUnitPrice(item.name, cat);
      return {
        No: idx + 1,
        'Kode SKU': item.id,
        'Nama Barang': item.name,
        Kategori: cat,
        'Lokasi Gudang': item.location,
        'Stok Fisik': item.currentStock,
        Satuan: item.baseUnit,
        'Status Stok': getItemStockStatus(item) === 'NORMAL' ? 'Aman' : getItemStockStatus(item) === 'LOW' ? 'Menipis' : 'Habis',
        'Min. Stok': item.minimumStock,
        'Titik Pesan (ROP)': item.reorderPoint,
        'Estimasi Harga Satuan (Rp)': price,
        'Estimasi Nilai Total (Rp)': item.currentStock * price,
        Keterangan: item.notes || '-',
      };
    });

    exportToExcel(
      rows,
      `Data_Stok_Barang_SPPG_Jeru_Tumpang_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Stok Barang'
    );
  };

  return (
    <div className="space-y-5">
      {/* Toast Alert Notice */}
      {successNotice && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODULE HEADER BAR */}
      {/* ========================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <SppgLogo size="md" variant="color" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Stok Barang & Stock Opname SPPG Jeru Tumpang
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoring saldo stok fisik real-time per kategori, status restock, penyesuaian cepat, serta pelaksanaan audit fisik (stock opname) berkala.
            </p>
          </div>
        </div>

        {/* Sub-Tab Navigation Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveMainTab('stock')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'stock'
                ? 'bg-white text-emerald-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-4 h-4 text-emerald-600" />
            <span>Data Stok Keseluruhan</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('opname')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeMainTab === 'opname'
                ? 'bg-white text-emerald-800 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
            <span>Stok Opname Fisik (Per Kategori)</span>
            {opnames.filter(o => o.status === 'PENDING_APPROVAL').length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {opnames.filter(o => o.status === 'PENDING_APPROVAL').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: DATA STOK KESELURUHAN BARANG */}
      {/* ========================================================================= */}
      {activeMainTab === 'stock' && (
        <div className="space-y-5">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Total Items */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Total Macam Barang</span>
                <Boxes className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {stockMetrics.totalItems} <span className="text-xs font-normal text-slate-500">jenis</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Aktif di sistem inventaris</p>
            </div>

            {/* Total Asset Value */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Nilai Aset Fisik</span>
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-700 font-mono">
                Rp {stockMetrics.totalAssetValue.toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Estimasi nilai total stok</p>
            </div>

            {/* Stock Normal */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Stok Aman</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-800">
                {stockMetrics.normalCount} <span className="text-xs font-normal text-slate-500">jenis</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Di atas batas minimum</p>
            </div>

            {/* Stock Low */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Stok Menipis</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-amber-700">
                {stockMetrics.lowCount} <span className="text-xs font-normal text-slate-500">jenis</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Perlu segera di-reorder</p>
            </div>

            {/* Stock Out */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Stok Habis</span>
                <XCircle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-xl font-bold text-rose-700">
                {stockMetrics.outCount} <span className="text-xs font-normal text-slate-500">jenis</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Saldo stok 0 (kritis)</p>
            </div>
          </div>

          {/* Action Header & Fast Opname Launch */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              {can('MANAGE_ITEMS') && (
                <button
                  type="button"
                  onClick={handleOpenNewSingleItem}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Barang Baru</span>
                </button>
              )}

              {can('MANAGE_ITEMS') && (
                <button
                  type="button"
                  onClick={() => {
                    setBatchMode('GRID');
                    setPasteRawText('');
                    setIsBatchModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <TableProperties className="w-4 h-4" />
                  <span>Input Masal Master Barang</span>
                </button>
              )}

              {/* Fast Launch Opname for Active Category */}
              <button
                type="button"
                onClick={() => {
                  setActiveMainTab('opname');
                  handleOpenCreateOpname(selectedCategoryTab !== 'Semua Kategori' ? selectedCategoryTab : undefined);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                title="Lakukan audit fisik stok untuk kategori ini"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>Opname Kategori Ini</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportStockExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ekspor Excel</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Cetak Rekap</span>
              </button>
            </div>
          </div>

          {/* Main Table Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Category Filter Tabs */}
            <div className="px-5 pt-4 pb-3 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {SPPG_STOCK_CATEGORIES.map(cat => {
                  const count = stockMetrics.categoryItemCounts[cat] || 0;
                  const isSelected = selectedCategoryTab === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategoryTab(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Status and Search Filter */}
              <div className="flex items-center gap-2">
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="NORMAL">Stok Aman (Normal)</option>
                  <option value="LOW">Stok Menipis (Warning)</option>
                  <option value="OUT_OF_STOCK">Stok Habis (0)</option>
                </select>

                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari barang / lokasi..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">#</th>
                    <th className="py-3 px-3 w-28">Kode SKU</th>
                    <th className="py-3 px-3 min-w-[200px]">Nama Barang & Lokasi Simpan</th>
                    <th className="py-3 px-3 w-36">Kategori</th>
                    <th className="py-3 px-3 w-32 text-right">Saldo Stok Fisik</th>
                    <th className="py-3 px-3 w-28 text-center">Status</th>
                    <th className="py-3 px-3 w-28 text-right">Min. Stok</th>
                    <th className="py-3 px-3 w-32 text-right">Estimasi Aset</th>
                    <th className="py-3 px-3 w-24 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                        Tidak ada data barang yang sesuai dengan filter kategori & pencarian saat ini.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const cat = getDetailedItemCategory(item);
                      const status = getItemStockStatus(item);
                      const unitPrice = getItemEstimatedUnitPrice(item.name, cat);
                      const assetValue = Math.max(0, item.currentStock) * unitPrice;

                      let statusBadge = (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" /> Aman
                        </span>
                      );
                      if (status === 'LOW') {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <AlertTriangle className="w-3 h-3" /> Menipis
                          </span>
                        );
                      } else if (status === 'OUT_OF_STOCK') {
                        statusBadge = (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <XCircle className="w-3 h-3" /> Habis
                          </span>
                        );
                      }

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-400 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                            {item.id}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Store className="w-3 h-3" />
                              <span>{item.location}</span>
                              {item.notes && <span className="italic">• {item.notes}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-slate-50 border-slate-200 text-slate-700">
                              {cat}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {item.currentStock.toLocaleString('id-ID')}
                            </span>{' '}
                            <span className="text-slate-500 font-normal">{item.baseUnit}</span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {statusBadge}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {item.minimumStock} {item.baseUnit}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="font-mono font-bold text-slate-900">
                              Rp {assetValue.toLocaleString('id-ID')}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              @ Rp {unitPrice.toLocaleString('id-ID')}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenAdjust(item)}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                                title="Penyesuaian cepat stok"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              {can('MANAGE_ITEMS') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditItem(item)}
                                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                  title="Edit data master barang"
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: STOK OPNAME FISIK (PER KATEGORI) */}
      {/* ========================================================================= */}
      {activeMainTab === 'opname' && (
        <div className="space-y-5">
          {/* Header Action Card for Opname */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                Audit Fisik Stok Opname SPPG
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Lakukan pencocokan stok fisik di gudang dengan data sistem. Anda dapat membuat sesi opname spesifik per kategori (misal: Bahan Basah saja, Bahan Kering saja, dll.) atau seluruh gudang.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenCreateOpname()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Mulai Sesi Stock Opname Baru</span>
              </button>
            </div>
          </div>

          {/* Opname Category Quick Launch Pills */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pilih Kategori untuk Audit Fisik Cepat:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {SPPG_STOCK_CATEGORIES.map(cat => {
                const count = stockMetrics.categoryItemCounts[cat] || 0;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleOpenCreateOpname(cat)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 transition-colors cursor-pointer"
                  >
                    <span>{cat}</span>
                    <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opname History Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">Riwayat Sesi Stock Opname</span>
                <select
                  value={opnameStatusFilter}
                  onChange={e => setOpnameStatusFilter(e.target.value as any)}
                  className="text-xs border border-slate-300 rounded-lg p-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="PENDING_APPROVAL">Menunggu Otorisasi (Pending)</option>
                  <option value="APPROVED">Telah Disetujui (Approved)</option>
                </select>
              </div>

              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari no sesi, area, atau pemeriksa..."
                  value={opnameSearchQuery}
                  onChange={e => setOpnameSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">No. Sesi Opname</th>
                    <th className="py-3 px-4">Tanggal Pelaksanaan</th>
                    <th className="py-3 px-4">Kategori & Lokasi Gudang</th>
                    <th className="py-3 px-4">Pemeriksa (PIC)</th>
                    <th className="py-3 px-4 text-center">Ringkasan Item</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredOpnames.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                        Belum ada riwayat sesi stock opname yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredOpnames.map(session => {
                      const totalCounted = session.items.length;
                      const varianceItems = session.items.filter(i => i.variance !== 0);
                      const hasVariance = varianceItems.length > 0;

                      // Extract category from notes if present
                      const catMatch = session.notes?.match(/\[Kategori:\s*([^\]]+)\]/);
                      const sessionCat = catMatch ? catMatch[1] : 'Semua Kategori';

                      return (
                        <tr key={session.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-emerald-800 flex items-center gap-1.5">
                            <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                            {session.id}
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <div className="font-semibold text-slate-900">{session.date}</div>
                            <div className="text-[10px] text-slate-400">
                              Dibuat: {session.createdAt.slice(0, 16).replace('T', ' ')}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-0.5">
                              {sessionCat}
                            </span>
                            <div className="text-slate-600 text-[11px] truncate max-w-xs">{session.location}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <div className="font-semibold text-slate-900">{session.createdByName}</div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="text-slate-800 font-semibold">{totalCounted} item</div>
                            {hasVariance ? (
                              <span className="text-[10px] font-bold text-amber-700">
                                {varianceItems.length} item ada selisih
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-700">
                                100% cocok (0 selisih)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {session.status === 'APPROVED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> Disetujui
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-3 h-3" /> Menunggu Otorisasi
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingOpname(session)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Berita Acara
                              </button>
                              {session.status === 'PENDING_APPROVAL' && can('APPROVE_OPNAME') && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveOpname(session)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FORMULIR PELAKSANAAN STOCK OPNAME BARU (BISA PER KATEGORI) */}
      {/* ========================================================================= */}
      {isCreateOpnameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                  Formulir Pelaksanaan Stock Opname Fisik
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pilih kategori spesifik yang ingin di-audit. Masukkan hasil hitung fisik nyata di gudang.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpnameModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Opname Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                {/* Kategori Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Kategori Yang Di-Opname <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={opnameCategoryFilter}
                    onChange={e => handleOpnameCategoryChange(e.target.value as SppgCategory)}
                    className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {SPPG_STOCK_CATEGORIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Tanggal Opname */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tanggal Pelaksanaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={opnameFormDate}
                    onChange={e => setOpnameFormDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Lokasi Gudang */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Lokasi / Area Gudang <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={opnameFormLocation}
                    onChange={e => setOpnameFormLocation(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Pemeriksa */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Petugas Pemeriksa (PIC)
                  </label>
                  <div className="w-full border border-slate-200 rounded-lg p-2 bg-slate-100 text-slate-700 font-semibold truncate">
                    {currentUser.name} ({currentUser.role})
                  </div>
                </div>

                {/* Keterangan */}
                <div className="sm:col-span-2 lg:col-span-4">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Catatan Sesi Opname
                  </label>
                  <input
                    type="text"
                    value={opnameFormNotes}
                    onChange={e => setOpnameFormNotes(e.target.value)}
                    placeholder="Contoh: Audit fisik rutin mingguan bahan basah dapur..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Items Counting Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-800">
                    Daftar Barang Untuk Dihitung Fisik ({countingItems.length} Item pada Kategori: {opnameCategoryFilter})
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Tekan tombol <strong>Samakan</strong> jika stok fisik sama dengan stok sistem
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Nama Barang & Kode</th>
                        <th className="py-2.5 px-3 w-28 text-right">Stok Sistem</th>
                        <th className="py-2.5 px-3 w-44 text-center">Hitung Fisik Nyata</th>
                        <th className="py-2.5 px-3 w-28 text-center">Selisih</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Alasan Selisih Fisik</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {countingItems.map((item, idx) => {
                        const hasVariance = item.variance !== 0;

                        return (
                          <tr key={item.itemId} className={hasVariance ? 'bg-amber-50/40' : 'hover:bg-slate-50/70'}>
                            <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{item.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{item.itemId} • {item.category}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-mono font-bold text-slate-700 text-sm">
                                {item.systemStock}
                              </span>{' '}
                              <span className="text-slate-500 font-normal">{item.unit}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpnameStep(idx, -1)}
                                  className="w-7 h-7 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  step="any"
                                  value={item.physicalCount}
                                  onChange={e => handlePhysicalCountChange(idx, e.target.value)}
                                  className="w-20 text-xs border border-slate-300 rounded px-2 py-1 text-center font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleOpnameStep(idx, 1)}
                                  className="w-7 h-7 rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs cursor-pointer"
                                >
                                  +
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpnameMatch(idx)}
                                  className="px-2 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                                  title="Samakan dengan stok sistem"
                                >
                                  Samakan
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {item.variance === 0 ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  0 (Cocok)
                                </span>
                              ) : item.variance < 0 ? (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 font-mono">
                                  {item.variance} {item.unit}
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 font-mono">
                                  +{item.variance} {item.unit}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {hasVariance ? (
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    value={item.reason}
                                    onChange={e => handleOpnameReasonChange(idx, e.target.value)}
                                    placeholder="Tulis alasan selisih..."
                                    required
                                    className="w-full text-xs border border-amber-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900"
                                  />
                                  <div className="flex flex-wrap gap-1">
                                    {['Susut alami', 'Rusak / kadaluarsa', 'Terpakai belum tercatat'].map(preset => (
                                      <button
                                        key={preset}
                                        type="button"
                                        onClick={() => handleOpnameReasonChange(idx, preset)}
                                        className="text-[9px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 cursor-pointer"
                                      >
                                        {preset}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">Sesuai fisik</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer Summary & Buttons */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 text-slate-600">
                <span>Total Item: <strong>{countingItems.length}</strong></span>
                <span className="text-emerald-700">Cocok: <strong>{countingItems.filter(i => i.variance === 0).length}</strong></span>
                <span className="text-amber-700">Selisih: <strong>{countingItems.filter(i => i.variance !== 0).length}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpnameModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmitOpnameSession(false)}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  Simpan Sesi (Pending)
                </button>

                {can('APPROVE_OPNAME') && (
                  <button
                    type="button"
                    onClick={() => handleSubmitOpnameSession(true)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    Simpan & Langsung Setujui (Update Stok)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BERITA ACARA STOCK OPNAME RESMI */}
      {/* ========================================================================= */}
      {viewingOpname && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Berita Acara Hasil Stock Opname: {viewingOpname.id}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    viewingOpname.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {viewingOpname.status === 'APPROVED' ? 'DISETUJUI & TERCATAT' : 'MENUNGGU OTORISASI'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingOpname(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">Tanggal Opname</span>
                  <span className="font-bold text-slate-800">{viewingOpname.date}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Lokasi Gudang</span>
                  <span className="font-bold text-slate-800">{viewingOpname.location}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Pencatat Fisik</span>
                  <span className="font-bold text-slate-800">{viewingOpname.createdByName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Otorisasi / Approval</span>
                  <span className="font-bold text-slate-800">{viewingOpname.approvedByName || 'Belum Disetujui'}</span>
                </div>
              </div>

              {viewingOpname.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <span className="font-bold">Keterangan Sesi:</span> {viewingOpname.notes}
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Nama Barang</th>
                      <th className="py-2.5 px-3 text-right">Stok Sistem</th>
                      <th className="py-2.5 px-3 text-right font-bold">Hitung Fisik</th>
                      <th className="py-2.5 px-3 text-center">Selisih</th>
                      <th className="py-2.5 px-3">Alasan Selisih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {viewingOpname.items.map(i => {
                      const hasVar = i.variance !== 0;
                      return (
                        <tr key={i.id} className={hasVar ? 'bg-amber-50/40' : ''}>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{i.itemName}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {i.systemStock} {i.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {i.physicalCount} {i.unit}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold">
                            {i.variance === 0 ? (
                              <span className="text-emerald-700">0</span>
                            ) : (
                              <span className={i.variance < 0 ? 'text-rose-600' : 'text-blue-600'}>
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

            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 text-xs">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Cetak Berita Acara
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingOpname(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Tutup
                </button>
                {viewingOpname.status === 'PENDING_APPROVAL' && can('APPROVE_OPNAME') && (
                  <button
                    type="button"
                    onClick={() => handleApproveOpname(viewingOpname)}
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Setujui & Terapkan Saldo Stok Fisik
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PENYESUAIAN STOK CEPAT (QUICK ADJUSTMENT) */}
      {/* ========================================================================= */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Penyesuaian Stok Cepat</h3>
                <p className="text-[11px] text-slate-500">{adjustingItem.name} ({adjustingItem.id})</p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <span className="text-slate-500">Stok Saat Ini:</span>
                <span className="font-mono font-bold text-base text-slate-900">
                  {adjustingItem.currentStock} {adjustingItem.baseUnit}
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Penyesuaian</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('ADD')}
                    className={`py-1.5 px-2 rounded-lg font-semibold text-center border cursor-pointer ${
                      adjustType === 'ADD' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    + Tambah
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('SUBTRACT')}
                    className={`py-1.5 px-2 rounded-lg font-semibold text-center border cursor-pointer ${
                      adjustType === 'SUBTRACT' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    - Kurangi
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('SET')}
                    className={`py-1.5 px-2 rounded-lg font-semibold text-center border cursor-pointer ${
                      adjustType === 'SET' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Set Total
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jumlah ({adjustingItem.baseUnit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  value={adjustQtyDelta}
                  onChange={e => setAdjustQtyDelta(parseFloat(e.target.value) || 0)}
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-bold font-mono text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Penyesuaian</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Koreksi fisik, susut, dsb..."
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-2xs cursor-pointer"
                >
                  Simpan Penyesuaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / EDIT MASTER BARANG SATUAN */}
      {/* ========================================================================= */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingItem ? 'Edit Data Master Barang' : 'Tambah Master Barang Baru'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Daftarkan barang baru ke master inventaris gudang SPPG.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSingleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingleItem} className="p-6 space-y-3.5 text-xs">
              {formError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode SKU</label>
                  <input
                    type="text"
                    value={formSku}
                    onChange={e => setFormSku(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as SppgCategory)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-900 font-medium"
                  >
                    {SPPG_STOCK_CATEGORIES.filter(c => c !== 'Semua Kategori').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Contoh: Beras Ramos, Daging Ayam, Kertas HVS..."
                  required
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={formBaseUnit}
                    onChange={e => setFormBaseUnit(e.target.value as BaseUnit)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {editingItem ? 'Stok Terkini' : 'Stok Awal'}
                  </label>
                  <input
                    type="number"
                    value={formInitialStock}
                    onChange={e => setFormInitialStock(parseFloat(e.target.value) || 0)}
                    disabled={!!editingItem}
                    className="w-full border border-slate-300 rounded-lg p-2 text-right font-mono text-slate-900 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Min. Stok</label>
                  <input
                    type="number"
                    value={formMinStock}
                    onChange={e => setFormMinStock(parseFloat(e.target.value) || 0)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-right font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Penyimpanan</label>
                <input
                  type="text"
                  value={formLocation}
                  onChange={e => setFormLocation(e.target.value)}
                  placeholder="Gudang Kering, Chiller Dapur, dsb..."
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Keterangan tambahan..."
                  className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-2xs cursor-pointer"
                >
                  Simpan Barang
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INPUT MASAL MASTER BARANG */}
      {/* ========================================================================= */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TableProperties className="w-5 h-5 text-emerald-700" />
                  Input Masal Master Barang Baru
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tambahkan banyak barang sekaligus menggunakan tabel atau tempel langsung data dari Excel.
                </p>
              </div>

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
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {batchMode === 'GRID' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-2 text-center w-8">#</th>
                          <th className="py-2.5 px-2 w-28">Kode SKU</th>
                          <th className="py-2.5 px-2 min-w-[180px]">Nama Barang <span className="text-rose-500">*</span></th>
                          <th className="py-2.5 px-2 w-36">Kategori</th>
                          <th className="py-2.5 px-2 w-20">Satuan</th>
                          <th className="py-2.5 px-2 w-24 text-right">Stok Awal</th>
                          <th className="py-2.5 px-2 w-24 text-right">Min. Stok</th>
                          <th className="py-2.5 px-2 min-w-[120px]">Lokasi</th>
                          <th className="py-2.5 px-1 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batchRows.map((row, index) => (
                          <tr key={row.id} className="hover:bg-slate-50/80">
                            <td className="py-1.5 px-2 text-center text-slate-400 text-[11px]">{index + 1}</td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={row.sku}
                                onChange={e => handleUpdateBatchRow(row.id, 'sku', e.target.value)}
                                className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 font-mono"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={row.name}
                                onChange={e => handleUpdateBatchRow(row.id, 'name', e.target.value)}
                                placeholder="Nama barang..."
                                className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <select
                                value={row.category}
                                onChange={e => handleUpdateBatchRow(row.id, 'category', e.target.value as SppgCategory)}
                                className="w-full text-[11px] border border-slate-200 rounded px-1 py-1 bg-white text-slate-800"
                              >
                                {SPPG_STOCK_CATEGORIES.filter(c => c !== 'Semua Kategori').map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={row.baseUnit}
                                onChange={e => handleUpdateBatchRow(row.id, 'baseUnit', e.target.value)}
                                className="w-full text-xs border border-slate-200 rounded px-1 py-1"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <input
                                type="number"
                                value={row.initialStock}
                                onChange={e => handleUpdateBatchRow(row.id, 'initialStock', Number(e.target.value))}
                                className="w-full text-xs border border-slate-200 rounded px-1 py-1 text-right font-mono"
                              />
                            </td>
                            <td className="py-1.5 px-2 text-right">
                              <input
                                type="number"
                                value={row.minStock}
                                onChange={e => handleUpdateBatchRow(row.id, 'minStock', Number(e.target.value))}
                                className="w-full text-xs border border-slate-200 rounded px-1 py-1 text-right font-mono"
                              />
                            </td>
                            <td className="py-1.5 px-2">
                              <input
                                type="text"
                                value={row.location}
                                onChange={e => handleUpdateBatchRow(row.id, 'location', e.target.value)}
                                className="w-full text-xs border border-slate-200 rounded px-1.5 py-1"
                              />
                            </td>
                            <td className="py-1.5 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveBatchRow(row.id)}
                                disabled={batchRows.length <= 1}
                                className="text-slate-300 hover:text-rose-500 disabled:opacity-20 p-1 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddBatchRow(1)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah 1 Baris</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddBatchRow(5)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>+5 Baris</span>
                      </button>
                    </div>

                    <span className="text-xs text-slate-500">
                      Total baris: <strong>{batchRows.length}</strong> (terisi: {batchRows.filter(r => r.name.trim() !== '').length})
                    </span>
                  </div>
                </div>
              )}

              {batchMode === 'PASTE' && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold mb-0.5">Format Tempel dari Excel / Google Sheet:</p>
                      <p className="text-[11px] text-emerald-900">
                        Salin (Ctrl+C) data kolom dari Excel lalu tempel (Ctrl+V) ke kotak teks di bawah:
                        <br />
                        <code className="bg-emerald-100 px-1 rounded font-mono text-[10px]">
                          [Nama Barang] [Tab] [Satuan] [Tab] [Stok Awal] [Tab] [Min Stok]
                        </code>.
                      </p>
                    </div>
                  </div>

                  <textarea
                    rows={8}
                    value={pasteRawText}
                    onChange={e => setPasteRawText(e.target.value)}
                    placeholder="Tempel teks Excel di sini...&#10;Contoh:&#10;Beras Ramos&#9;Kg&#9;50&#9;20&#10;Daging Ayam Karkas&#9;Kg&#9;25&#9;15&#10;Kertas HVS A4&#9;Rim&#9;10&#9;5&#10;Sunlight 750ml&#9;Pouch&#9;8&#9;4"
                    className="w-full text-xs font-mono border border-slate-300 rounded-xl p-3 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={handleParsePastedText}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      <ClipboardPaste className="w-4 h-4" />
                      <span>Ekstrak Data ke Tabel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveAllBatchMaster}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer"
              >
                Simpan Semua Master Barang
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
