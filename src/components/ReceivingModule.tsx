import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Select } from './common/Select';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  ItemMaster,
  ReceivingDocument,
  ReceivingLine,
  Supplier,
  NonFoodExpense,
  NonFoodDepartment,
  normalizeItemCategory,
  PurchaseOrderNota,
  PurchaseOrderItem,
  PaymentMethod,
  PurchaseOrderStatus,
} from '../types/warehouse';
import {
  Trash2,
  CheckCircle,
  Search,
  FileText,
  AlertCircle,
  Eye,
  ArrowLeft,
  TableProperties,
  ClipboardPaste,
  PlusCircle,
  ShoppingBag,
  DollarSign,
  Tag,
  Filter,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  X,
  CalendarRange,
  Receipt,
  Printer,
  Building2,
  FileCheck,
  FilePlus,
  Layers,
  CheckSquare,
  Square,
  LayoutGrid,
  Check,
  RotateCcw,
  Edit3,
  Scale,
  Pencil,
} from 'lucide-react';
import { SignaturePad } from './SignaturePad';
import { SearchPicker, PickerOption } from './common/SearchPicker';
import { FormDialog, FIELD_INPUT, FIELD_LABEL, BTN_PRIMARY, BTN_SECONDARY } from './common/FormDialog';
import { generateAutoSku, WarehouseSkuType, WAREHOUSE_SKU_DEFINITIONS } from '../utils/skuGenerator';
import { buildItemReference, describePriceSource } from '../utils/itemReference';
import { ReceivingDetailModal } from './ReceivingDetailModal';
import { PhotoUploadCompressor } from './PhotoUploadCompressor';
import { exportToExcel } from '../lib/excelExport';
import { NotaPesananModal } from './NotaPesananModal';
import { BatchPrintNotaModal } from './BatchPrintNotaModal';
import { PoReceivingWeighingModal } from './PoReceivingWeighingModal';
import { PoEditModal } from './PoEditModal';
import { useToast } from '../context/ToastContext';
import { ConfirmationModal, ConfirmationItemSummary } from './common/ConfirmationModal';
import { LoadingOverlay } from './common/LoadingOverlay';
import { ActionDropdown } from './common/ActionDropdown';
import { angkaTerbilang } from './ToolsPrintModule';
import { generateNextPoNumber } from '../utils/poNumberGenerator';
import { isAwaitingDelivery, isMenuPurchaseOrder } from '../utils/poSupplier';
import { useConfirm } from '../context/ConfirmContext';
import { localDateIso } from '../utils/localDate';
import { isCountableUnit, normalizeQtyForUnit } from '../utils/unitConversion';
import { suggestDryLocation } from '../utils/warehouseRacks';

// Jumlah dari belanja bisa berupa teks ("2 pack"); angka ditampilkan dengan koma desimal
const formatRecordQty = (qty: string | number): string => {
  const n = typeof qty === 'number' ? qty : Number(qty);
  return Number.isFinite(n) ? n.toLocaleString('id-ID', { maximumFractionDigits: 3 }) : String(qty);
};
import {
  getPrintPoolIds,
  addToPrintPool,
  removeFromPrintPool,
  clearPrintPool,
} from '../utils/poPrintPool';
import {
  STANDARD_CATEGORIES,
  StandardCategory,
  normalizeToStandardCategory,
  isMedicineItem,
  getItemSubcategory,
  getSubcategoryOrder,
} from '../utils/categoryStandards';

interface ReceivingModuleProps {
  onRefreshData?: () => void;
  onNavigate?: (tab: string) => void;
  onPrintReceiving?: (receivingId: string) => void;
}

export const INPUT_CATEGORIES = STANDARD_CATEGORIES;

export type InputCategoryType = StandardCategory;

function autoDetectCategory(itemName: string): InputCategoryType {
  return normalizeToStandardCategory(undefined, itemName);
}

const PACKAGING_NAME_PATTERN = /plastik|kresek|mika|thinwall|kemasan|kantong|kotak makan|styrofoam|klip|cling|wrap|tisu|tissue/i;
const PPE_NAME_PATTERN = /masker|sarung tangan|glove|apd|celemek|apron|nurse cap|hairnet|penutup kepala|sepatu boot|face shield/i;

// Unit pemakai di laporan pengeluaran, mengikuti kategori standar barang.
function expenseDepartmentFor(category: InputCategoryType, itemName: string): NonFoodDepartment {
  if (category === 'ATK & Administrasi' || category === 'P3K & Obat-obatan') return 'Administrasi & Kantor';
  if (category === 'Sanitasi, Kemasan & APD') {
    return PACKAGING_NAME_PATTERN.test(itemName) ? 'Distribusi & Kemasan' : 'Area Cuci & Sanitasi';
  }
  return 'Dapur Pengolahan Utama';
}

// Rak gudang untuk barang baru, sama dengan pembagian rak di Gudang Non-Food.
function suggestQuickItemLocation(category: InputCategoryType, itemName: string): string | undefined {
  const racks = WAREHOUSE_SKU_DEFINITIONS.GUDANG_NONFOOD.suggestedLocations;
  if (category === 'P3K & Obat-obatan') return racks[3];
  if (category === 'Sanitasi, Kemasan & APD') {
    if (PPE_NAME_PATTERN.test(itemName)) return racks[2];
    if (PACKAGING_NAME_PATTERN.test(itemName)) return racks[1];
    return racks[0];
  }
  if (category === 'Operasional & Keperluan Lain') return 'Area Logistik Operasional';
  return undefined;
}


export interface UnifiedRecord {
  id: string;
  source: 'EXPENSE_INPUT' | 'DELIVERY_ORDER';
  date: string;
  parsedDate: Date | null;
  time: string;
  category: string;
  displayCategory: InputCategoryType | string;
  itemName: string;
  quantity: string | number;
  unit: string;
  unitPrice: number;
  nominal: number;
  supplierOrStore: string;
  picOrUser: string;
  volunteer?: string;
  notes?: string;
  rawDoc?: ReceivingDocument;
  /** Baris penerimaan & belanja tertautnya, untuk menghapus catatan yang salah */
  lineId?: string;
  linkedExpenseId?: string;
}

type PeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

function formatIndonesianDateWithDay(dateStr?: string): string {
  if (!dateStr || dateStr === 'Tanpa Tanggal') return 'Tanpa Tanggal';
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, monthIdx, day);
      const dayName = days[d.getDay()];
      if (monthIdx >= 0 && monthIdx < 12 && dayName) {
        return `${dayName}, ${day} ${months[monthIdx]} ${year}`;
      }
    }
  } catch {
    // fallback
  }
  return dateStr;
}

function parseExpenseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.toLowerCase().trim();

  // If ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.slice(0, 10).split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  // If DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(clean)) {
    const parts = clean.split(/[\/\-]/);
    const day = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const year = Number(parts[2]);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3,
    mei: 4, jun: 5, jul: 6, agu: 7, ags: 7,
    sep: 8, okt: 9, nov: 10, des: 11,
  };

  const match = clean.match(/(\d{1,2})\s+([a-z]{3,4})\s+(\d{4})/i);
  if (match) {
    const day = Number(match[1]);
    const monthKey = match[2].slice(0, 3).toLowerCase();
    const month = monthMap[monthKey] !== undefined ? monthMap[monthKey] : 8;
    const year = Number(match[3]);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export const ReceivingModule: React.FC<ReceivingModuleProps> = ({ onNavigate, onPrintReceiving }) => {
  const { currentUser, can } = useAuth();
  const canDeleteRecords = can('RECEIVE_GOODS');
  const toast = useToast();

  // Confirmation Modal & Action Loading states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'primary' | 'danger' | 'warning' | 'info';
    icon?: React.ReactNode;
    itemsSummary?: ConfirmationItemSummary;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [actionLoading, setActionLoading] = useState<{
    isLoading: boolean;
    message?: string;
    submessage?: string;
  }>({
    isLoading: false,
  });

  // Data states
  const [dataVersion, setDataVersion] = useState(0);
  const receivings = useMemo(() => warehouseDb.getReceivings(), [dataVersion]);
  const expenses = useMemo(() => warehouseDb.getNonFoodExpenses(), [dataVersion]);
  const items = useMemo(
    () => warehouseDb.getItems().filter(i => i.isActive && i.itemType !== 'EQUIPMENT'),
    [dataVersion]
  );
  const suppliers = useMemo(
    () => warehouseDb.getSuppliers().filter(s => s.isActive),
    [dataVersion]
  );
  // Satuan dan harga acuan hanya dari Master Barang dan riwayat belanja, bukan katalog di kode.
  const getItemReference = useMemo(() => buildItemReference(items, expenses), [items, expenses]);
  const purchaseOrders = useMemo(() => warehouseDb.getPurchaseOrders(), [dataVersion]);

  // Sinkronisasi realtime otomatis saat ada perubahan di database Supabase Cloud
  useEffect(() => {
    const handleSync = () => {
      setDataVersion(v => v + 1);
    };
    window.addEventListener('sppg_storage_items_changed', handleSync);
    window.addEventListener('sppg_warehouse_sync', handleSync);
    return () => {
      window.removeEventListener('sppg_storage_items_changed', handleSync);
      window.removeEventListener('sppg_warehouse_sync', handleSync);
    };
  }, []);

  // Post-input CTA prompt state
  const [justSavedPrompt, setJustSavedPrompt] = useState<{
    title: string;
    subtitle: string;
    supplierName: string;
    supplierId?: string;
    items: PurchaseOrderItem[];
    refId?: string;
    refIds?: string[];
  } | null>(null);

  // Supplier filter, View Mode, and Multi-select states
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'TABLE' | 'SUPPLIER_GROUPS'>('TABLE');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [supplierNotaPrompt, setSupplierNotaPrompt] = useState<{
    supplierName: string;
    clickedRecord: UnifiedRecord;
    siblingRecords: UnifiedRecord[];
  } | null>(null);

  // Nota Pesanan Modal state
  const [isNotaModalOpen, setIsNotaModalOpen] = useState(false);
  const [activeNota, setActiveNota] = useState<PurchaseOrderNota | null>(null);

  // PO Physical Receiving & Weighing state (1-Flow Supply Chain)
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [poBeingEdited, setPoBeingEdited] = useState<PurchaseOrderNota | null>(null);
  const [selectedPoForWeighing, setSelectedPoForWeighing] = useState<PurchaseOrderNota | null>(null);
  const [showAllPoQueue, setShowAllPoQueue] = useState(false);

  // Nota yang dibuat dari penerimaan barang (relatedReceivingId) stoknya sudah masuk,
  // jadi tidak ikut antrean timbang supaya stok tidak bertambah dua kali.
  // Antrean hanya berisi pesanan dari menu. Nota yang dibuat dari penerimaan atau belanja yang sudah terjadi
  // bukan barang yang ditunggu, jadi tidak boleh muncul sebagai "Terlambat".
  const menuPOs = useMemo(() => purchaseOrders.filter(isMenuPurchaseOrder), [purchaseOrders]);
  const pendingPOs = useMemo(() => purchaseOrders.filter(isAwaitingDelivery), [purchaseOrders]);
  const askConfirm = useConfirm();

  const latePOs = useMemo(() => {
    const todayIso = localDateIso();
    return pendingPOs.filter(po => {
      const d = (po.deliveryDate || po.date || '').slice(0, 10);
      return d !== '' && d < todayIso;
    });
  }, [pendingPOs]);

  const handleClosePos = async (pos: PurchaseOrderNota[]) => {
    if (pos.length === 0) return;
    const ok = await askConfirm({
      title: pos.length === 1 ? `Tutup PO ${pos[0].poNumber}?` : `Tutup ${pos.length} PO yang lewat jadwal?`,
      message:
        'Pakai ini bila barangnya sudah dicatat lewat Terima Barang atau belanja langsung, atau memang tidak jadi datang. ' +
        'PO ditandai selesai tanpa menambah stok dan pengeluaran, dan tidak lagi muncul di antrean.' +
        (pos.length > 1 ? `\n\n${pos.map(p => `- ${p.poNumber} · ${p.supplierName}`).join('\n')}` : ''),
      confirmText: 'Tutup PO',
      variant: 'warning',
    });
    if (!ok) return;
    const closed = warehouseDb.closePurchaseOrdersWithoutReceiving(
      pos.map(p => p.id),
      'barang sudah dicatat lewat jalur lain atau tidak jadi datang',
      currentUser
    );
    refreshAll();
    toast.success(`${closed} PO ditutup dan tidak lagi ditunggu.`, 'PO Ditutup');
  };

  const handleOpenWeighModal = (po: PurchaseOrderNota) => {
    setSelectedPoForWeighing(po);
    setIsWeighModalOpen(true);
  };

  // Pool Antrean Cetak Nota (Batch Print) state
  const [isBatchPrintModalOpen, setIsBatchPrintModalOpen] = useState(false);
  const [poolNotaIds, setPoolNotaIds] = useState<string[]>(() => getPrintPoolIds());

  const handleAddToPool = (id: string) => {
    const updated = addToPrintPool(id);
    setPoolNotaIds(updated);
    refreshAll();
    toast.success('Nota berhasil dimasukkan ke antrean cetak!', 'Antrean Cetak');
    setSuccessMessage('Nota berhasil dimasukkan ke antrean cetak!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleRemoveFromPool = (id: string) => {
    const updated = removeFromPrintPool(id);
    setPoolNotaIds(updated);
    refreshAll();
    toast.info('Nota dihapus dari antrean cetak.', 'Antrean Cetak');
  };

  const handleClearPool = () => {
    clearPrintPool();
    setPoolNotaIds([]);
    refreshAll();
    toast.info('Antrean pool cetak nota berhasil dikosongkan.', 'Antrean Cetak');
    setSuccessMessage('Antrean pool cetak nota berhasil dikosongkan.');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleTogglePool = (id: string) => {
    if (activeNota && (activeNota.id === id || activeNota.poNumber === id)) {
      warehouseDb.savePurchaseOrder(activeNota, currentUser);
    }
    if (poolNotaIds.includes(id)) {
      handleRemoveFromPool(id);
    } else {
      handleAddToPool(id);
    }
  };

  // Active views & modals
  const [isCreatingDeliveryOrder, setIsCreatingDeliveryOrder] = useState(false);
  const [selectedDocForDetail, setSelectedDocForDetail] = useState<ReceivingDocument | null>(null);

  // Period & Filter States (Standardized Filter System)
  const [periodType, setPeriodType] = useState<PeriodType>('WEEKLY');
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(
    localDateIso()
  );

  // Range for Weekly / Custom (Default to last 7 days)
  const defaultWeekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return localDateIso(d);
  }, []);
  const [startDate, setStartDate] = useState<string>(defaultWeekStart);
  const [endDate, setEndDate] = useState<string>(
    localDateIso()
  );

  // Selected Month (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    localDateIso().slice(0, 7)
  );

  // Filter kategori memakai kategori yang sama dengan Master Barang, plus sub-kategori dan sumber catatan
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'ALL' | StandardCategory>('ALL');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | UnifiedRecord['source']>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Quick weekly helpers
  const handleSetThisWeek = () => {
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    setStartDate(localDateIso(start));
    setEndDate(localDateIso(end));
    setPeriodType('WEEKLY');
  };

  const handleSetLastWeek = () => {
    const end = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    setStartDate(localDateIso(start));
    setEndDate(localDateIso(end));
    setPeriodType('WEEKLY');
  };

  // Effective Date Range based on periodType
  const effectiveDateRange = useMemo(() => {
    if (periodType === 'DAILY') {
      const target = parseExpenseDate(selectedDailyDate);
      return { start: target, end: target, label: `Harian: ${selectedDailyDate}` };
    }

    if (periodType === 'WEEKLY') {
      const s = parseExpenseDate(startDate);
      const e = parseExpenseDate(endDate);
      return { start: s, end: e, label: `Mingguan: ${startDate} s/d ${endDate}` };
    }

    if (periodType === 'MONTHLY') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return {
        start: startOfMonth,
        end: endOfMonth,
        label: `Bulan ${monthNames[month - 1] || ''} ${year}`,
      };
    }

    // CUSTOM
    const s = parseExpenseDate(startDate);
    const e = parseExpenseDate(endDate);
    return { start: s, end: e, label: `${startDate} s/d ${endDate}` };
  }, [periodType, selectedDailyDate, startDate, endDate, selectedMonth]);

  const today = localDateIso();
  const defaultCurrentTime = new Date()
    .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    .replace(':', '.');

  const supplierOptions = useMemo<PickerOption[]>(
    () =>
      [...suppliers]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(s => ({ value: s.id, label: s.name, hint: s.contactPerson || undefined })),
    [suppliers]
  );

  // Pilihan barang Terima Barang: hanya barang gudang, dikelompokkan per kategori.
  const receivingItemOptions = useMemo<PickerOption[]>(
    () =>
      [...items]
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
        .map(it => ({ value: it.id, label: it.name, group: it.category, hint: `Stok ${it.currentStock} ${it.baseUnit}` })),
    [items]
  );

  // ----------------------------------------------------
  // Delivery Order / Surat Jalan Form State
  // ----------------------------------------------------
  const [formSupplierId, setFormSupplierId] = useState('');
  const [formDate, setFormDate] = useState(today);
  const [formTime, setFormTime] = useState(new Date().toTimeString().slice(0, 5));
  const [formDeliveryNote, setFormDeliveryNote] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formSupplierSign, setFormSupplierSign] = useState('');
  const [formReceiverSign, setFormReceiverSign] = useState('');
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  // Baris dimulai kosong agar petugas memilih barangnya sendiri, bukan barang pertama di daftar.
  const emptyLine = (): Omit<ReceivingLine, 'id'> => ({ itemId: '', itemName: '', category: '', quantity: 0, unit: '', conditionNote: '', batchNumber: '', unitPrice: 0 });
  const [lines, setLines] = useState<Omit<ReceivingLine, 'id'>[]>(() => [emptyLine()]);

  // Reload only this module's data. Calling the app-level refresh remounts the whole page
  // (App keys the content on dataVersion), which wiped the post-save prompt and open modals.
  const refreshAll = () => {
    setDataVersion(v => v + 1);
  };

  const showToast = (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    toast.showToast(msg, type);
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4500);
  };

  // ----------------------------------------------------
  // Handlers for Delivery Order (Penerimaan Supplier Resmi)
  // ----------------------------------------------------
  const handleOpenDeliveryOrder = () => {
    setFormSupplierId('');
    setFormDate(localDateIso());
    setFormTime(new Date().toTimeString().slice(0, 5));
    setFormDeliveryNote('');
    setFormNotes('');
    setFormSupplierSign('');
    setFormReceiverSign('');
    setFormPhotos([]);
    setErrorMessage('');

    setLines([emptyLine()]);
    setIsCreatingDeliveryOrder(true);
  };

  // ----------------------------------------------------
  // Barang baru: daftar ke Master Barang langsung dari form Terima Barang
  // ----------------------------------------------------
  // categoryTouched: kategori dipilih sendiri, jadi tidak lagi ditebak dari nama barang.
  const [quickItem, setQuickItem] = useState<{ lineIndex: number | null; name: string; category: InputCategoryType; unit: string; categoryTouched: boolean } | null>(null);
  const [quickItemError, setQuickItemError] = useState('');

  // Barang menu masuk lewat PO, jadi barang baru di sini biasanya non-food.
  const openQuickItem = (lineIndex: number | null) => {
    setQuickItemError('');
    setQuickItem({ lineIndex, name: '', category: 'Sanitasi, Kemasan & APD', unit: 'Pcs', categoryTouched: false });
  };

  const handleQuickItemNameChange = (name: string) => {
    setQuickItem(q => {
      if (!q) return q;
      if (q.categoryTouched || name.trim().length < 3) return { ...q, name };
      return { ...q, name, category: autoDetectCategory(name) };
    });
  };

  // Kategori input menentukan gudang (awalan SKU) dan jenis barang, sama dengan aturan di Master Barang.
  const QUICK_ITEM_WAREHOUSE: Record<string, WarehouseSkuType> = {
    'Bahan Basah': 'GUDANG_BASAH',
    'Bahan Kering': 'GUDANG_KERING',
    'ATK & Administrasi': 'OPERASIONAL_ATK',
    'Operasional & Keperluan Lain': 'OPERASIONAL_ATK',
  };

  const handleSaveQuickItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickItem) return;
    const name = quickItem.name.trim();
    const unit = quickItem.unit.trim();
    if (!name || !unit) {
      setQuickItemError('Nama barang dan satuan wajib diisi.');
      return;
    }
    const allItems = warehouseDb.getItems();
    const dup = allItems.find(i => i.name.trim().toLowerCase() === name.toLowerCase());
    if (dup) {
      setQuickItemError(`"${dup.name}" sudah ada di Master Barang. Pilih dari daftar barang.`);
      return;
    }
    const warehouse = QUICK_ITEM_WAREHOUSE[quickItem.category] || 'GUDANG_NONFOOD';
    const now = new Date().toISOString();
    const newItem: ItemMaster = {
      id: generateAutoSku(warehouse, allItems),
      name,
      itemType:
        quickItem.category === 'Bahan Kering'
          ? 'FOOD_CARRYING_STOCK'
          : quickItem.category === 'Bahan Basah'
          ? 'FOOD_DAILY_FLOW'
          : 'OPERATIONAL_CONSUMABLE',
      category: quickItem.category,
      baseUnit: unit,
      minimumStock: 0,
      reorderPoint: 0,
      currentStock: 0,
      location:
        (warehouse === 'GUDANG_KERING' ? suggestDryLocation(name) : suggestQuickItemLocation(quickItem.category, name)) ||
        WAREHOUSE_SKU_DEFINITIONS[warehouse]?.defaultLocation ||
        'Gudang Utama',
      expiryTrackingEnabled:
        quickItem.category === 'Bahan Basah' || quickItem.category === 'Bahan Kering' || quickItem.category === 'P3K & Obat-obatan',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    try {
      warehouseDb.saveItem(newItem, currentUser, true);
    } catch (err: any) {
      setQuickItemError(err?.message || 'Gagal mendaftarkan barang.');
      return;
    }
    refreshAll();
    // Langsung dipakai di baris yang kosong (atau baris baru) tanpa menunggu daftar barang dimuat ulang.
    const fresh = [...items, newItem];
    const target = quickItem.lineIndex ?? lines.findIndex(l => !l.itemId);
    if (target >= 0) {
      handleLineItemChange(target, newItem.id, fresh);
    } else {
      setLines(prev => [...prev, emptyLine()]);
      handleLineItemChange(lines.length, newItem.id, fresh);
    }
    toast.success(`"${newItem.name}" terdaftar di Master Barang (${newItem.id}).`, 'Barang Baru');
    setQuickItem(null);
  };

  const handleLineItemChange = (index: number, itemId: string, source: ItemMaster[] = items) => {
    const selectedItem = source.find(i => i.id === itemId);
    if (!selectedItem) return;
    const ref = getItemReference(selectedItem.name);

    setLines(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        category: selectedItem.category,
        unit: selectedItem.baseUnit,
        // Harga acuan hanya mengisi kolom kosong; harga dari nota tetap yang dipakai.
        unitPrice: updated[index].unitPrice || selectedItem.estimatedPrice || ref?.price || 0,
      };
      return updated;
    });
  };

  const handleLinePriceChange = (index: number, raw: string) => {
    const price = Number(raw.replace(/\D/g, '')) || 0;
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, unitPrice: price } : l)));
  };

  const handleLineQtyChange = (index: number, val: string) => {
    const num = parseFloat(val) || 0;
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], quantity: num };
      return updated;
    });
  };

  const handleLineExpiryChange = (index: number, val: string) => {
    setLines(prev => prev.map((l, i) => (i === index ? { ...l, expiryDate: val || undefined } : l)));
  };

  const handleLineNoteChange = (index: number, val: string) => {
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], conditionNote: val };
      return updated;
    });
  };

  const addLine = () => setLines(prev => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      setErrorMessage('Penerimaan harus memiliki minimal 1 baris item.');
      return;
    }
    setLines(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmitDeliveryOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const supplierText = formSupplierId.trim();
    if (!supplierText) {
      const msg = 'Pilih supplier, atau ketik nama toko tempat membeli.';
      setErrorMessage(msg);
      toast.error(msg, 'Validasi Gagal');
      return;
    }

    for (const [idx, line] of lines.entries()) {
      if (!line.itemId) {
        const msg = `Baris ${idx + 1}: pilih barangnya dulu.`;
        setErrorMessage(msg);
        toast.error(msg, 'Validasi Gagal');
        return;
      }
      if (!((line.unitPrice || 0) > 0)) {
        const msg = `Baris ${idx + 1} (${line.itemName}): isi harga satuan sesuai nota.`;
        setErrorMessage(msg);
        toast.error(msg, 'Validasi Gagal');
        return;
      }
      if (line.quantity <= 0) {
        const msg = `Baris ${idx + 1} (${line.itemName}): isi jumlah yang diterima.`;
        setErrorMessage(msg);
        toast.error(msg, 'Validasi Gagal');
        return;
      }
      if (isCountableUnit(line.unit) && !Number.isInteger(line.quantity)) {
        const msg = `Baris ${idx + 1} (${line.itemName}): satuan ${line.unit} harus bilangan bulat, bukan ${line.quantity}.`;
        setErrorMessage(msg);
        toast.error(msg, 'Validasi Gagal');
        return;
      }
    }

    try {
      // Belanja non-menu (plastik, obat, APD) sering dari minimarket atau apotek yang belum ada di
      // Master Supplier. Nama yang diketik didaftarkan dulu agar dokumen penerimaan tetap punya supplier.
      const registerStore = (): Supplier => {
        const existing = warehouseDb.getSuppliers();
        let nextNum = existing.length + 1;
        let newId = `SUP-${String(nextNum).padStart(3, '0')}`;
        while (existing.some(s => s.id.toLowerCase() === newId.toLowerCase())) {
          nextNum++;
          newId = `SUP-${String(nextNum).padStart(3, '0')}`;
        }
        return warehouseDb.saveSupplier(
          {
            id: newId,
            name: supplierText,
            contactPerson: '',
            phone: '',
            address: '',
            supplyCategory: 'Toko / Belanja Langsung',
            isActive: true,
            notes: 'Didaftarkan dari Terima Barang (tanpa PO).',
          },
          currentUser,
          true
        );
      };
      const selectedSupplier =
        suppliers.find(s => s.id === supplierText) ||
        suppliers.find(s => s.name.trim().toLowerCase() === supplierText.toLowerCase()) ||
        registerStore();

      const newDoc = warehouseDb.postReceiving(
        {
          date: formDate,
          arrivalTime: formTime,
          supplierId: selectedSupplier.id,
          supplierName: selectedSupplier.name,
          deliveryNoteNo: formDeliveryNote || undefined,
          receiverId: currentUser.id,
          receiverName: currentUser.name,
          receiverRole: currentUser.role,
          notes: formNotes || undefined,
          lines: lines as any,
          supplierSignature: formSupplierSign || undefined,
          receiverSignature: formReceiverSign || `Diterima oleh ${currentUser.name} (${currentUser.role})`,
          documentationPhotos: formPhotos.length > 0 ? formPhotos : undefined,
        },
        currentUser
      );

      // Belanja dari nota ikut tercatat di laporan pengeluaran. Penanda [GR: id] menautkannya ke
      // dokumen penerimaan ini, jadi riwayat menampilkan satu baris per barang (lihat unifiedRecords).
      const timeLabel = formTime.replace(':', '.');
      const grandTotal = lines.reduce((sum, l) => sum + l.quantity * (l.unitPrice || 0), 0);
      warehouseDb.recordNonFoodExpensesBatch(
        lines.map(l => {
          const category = normalizeToStandardCategory(l.category, l.itemName);
          return {
            date: formDate,
            time: timeLabel,
            itemId: l.itemId,
            itemName: l.itemName,
            category,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.unitPrice || 0,
            totalCost: Math.round(l.quantity * (l.unitPrice || 0)),
            pic: currentUser.name,
            recipient: selectedSupplier.name,
            receiptRef: formDeliveryNote.trim() || newDoc.id,
            department: expenseDepartmentFor(category, l.itemName),
            notes: `[GR: ${newDoc.id}] [Toko/Supplier: ${selectedSupplier.name}]${l.conditionNote ? ` ${l.conditionNote}` : ''}`,
          };
        }),
        currentUser
      );

      const savedMsg = `${lines.length} barang dari ${selectedSupplier.name} masuk stok (Rp ${grandTotal.toLocaleString('id-ID')}).`;
      toast.success(savedMsg, 'Barang Masuk Tersimpan');
      showToast(savedMsg);
      setIsCreatingDeliveryOrder(false);
      setSelectedDocForDetail(newDoc);
      refreshAll();

      // Tawarkan cetak nota dengan harga dari nota supplier.
      const doItems: PurchaseOrderItem[] = lines.map((l, i) => {
        const price = l.unitPrice || 0;
        return {
          id: `POI-${Date.now()}-${i}`,
          name: l.itemName,
          category: l.category,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: price,
          subtotal: l.quantity * price,
          notes: l.conditionNote || undefined,
        };
      });
      setJustSavedPrompt({
        title: 'Barang Masuk Stok',
        subtitle: `Penerimaan #${formDeliveryNote || newDoc.id} dari ${selectedSupplier.name} masuk stok gudang dan laporan pengeluaran.`,
        supplierName: selectedSupplier.name,
        supplierId: selectedSupplier.id,
        items: doItems,
        refId: newDoc.id,
      });
    } catch (err: any) {
      const msg = err.message || 'Terjadi kesalahan saat memposting penerimaan.';
      setErrorMessage(msg);
      toast.error(msg, 'Gagal Memposting');
    }
  };

  // Hapus catatan yang salah: penerimaan mengurangi lagi stoknya, belanja langsung hanya dihapus.
  const handleDeleteRecord = (r: UnifiedRecord) => {
    const isStock = r.source === 'DELIVERY_ORDER';
    const qty = `${formatRecordQty(r.quantity)} ${r.unit}`;
    const nota = getMatchingNotaForRecord(r);
    setConfirmDialog({
      isOpen: true,
      title: `Hapus ${r.itemName}?`,
      message:
        (isStock
          ? `Stok ${r.itemName} akan dikurangi ${qty}, dan catatan pembatalannya masuk Buku Mutasi.${r.linkedExpenseId ? ' Catatan belanjanya ikut dihapus.' : ''}`
          : `Catatan belanja ${r.itemName} (${qty}) akan dihapus. Stok tidak berubah.`) +
        (nota ? ` Nota ${nota.poNumber} masih mencantumkan barang ini, jadi edit notanya setelah ini.` : ''),
      confirmText: 'Hapus',
      cancelText: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          if (isStock) {
            if (!r.rawDoc || !r.lineId) throw new Error('Baris penerimaan ini tidak bisa dihapus.');
            warehouseDb.deleteReceivingLine(r.rawDoc.id, r.lineId, currentUser, r.linkedExpenseId);
          } else {
            warehouseDb.deleteNonFoodExpense(r.id, currentUser);
          }
          setSelectedRecordIds(prev => prev.filter(id => id !== r.id));
          toast.success(`${r.itemName} dihapus.`, 'Catatan dihapus');
          refreshAll();
        } catch (err: any) {
          toast.error(err?.message || 'Gagal menghapus catatan.', 'Gagal menghapus');
        }
      },
    });
  };

  // ----------------------------------------------------
  // Helpers for Nota Pesanan / Purchase Order
  // ----------------------------------------------------
  const getMatchingNotaForRecord = (r: UnifiedRecord): PurchaseOrderNota | undefined => {
    return purchaseOrders.find(po => {
      // 1. Direct match by receiving document ID
      if (r.source === 'DELIVERY_ORDER' && r.rawDoc && po.relatedReceivingId === r.rawDoc.id) {
        return true;
      }
      // 2. Direct match by non-food expense ID
      if (r.source === 'EXPENSE_INPUT' && po.relatedExpenseIds && po.relatedExpenseIds.includes(r.id)) {
        return true;
      }
      // 3. Fallback match by supplier, date, and item name
      // Date MUST match to prevent same items bought on different days from falsely matching an earlier PO!
      const poDate = po.date ? po.date.slice(0, 10) : '';
      const poDelivery = po.deliveryDate ? po.deliveryDate.slice(0, 10) : '';
      const rDate = r.date ? r.date.slice(0, 10) : '';
      const isDateMatch = !rDate || poDate === rDate || poDelivery === rDate;
      if (!isDateMatch) return false;

      const poSupplier = (po.supplierName || '').toLowerCase().trim();
      const rSupplier = (r.supplierOrStore || '').toLowerCase().trim();
      if (poSupplier && rSupplier && rSupplier !== '-' && (poSupplier.includes(rSupplier) || rSupplier.includes(poSupplier))) {
        const hasItem = po.items.some(it => it.name.toLowerCase().trim() === r.itemName.toLowerCase().trim());
        if (hasItem) return true;
      }
      return false;
    });
  };

  const handleOpenExistingNota = (nota: PurchaseOrderNota) => {
    setActiveNota(nota);
    setIsNotaModalOpen(true);
  };

  const handleCreateNotaFromRecord = (r: UnifiedRecord) => {
    // Check if there are other records from the same supplier ON THE SAME DATE
    const suppName = r.supplierOrStore && r.supplierOrStore !== '-' ? r.supplierOrStore : '';
    if (suppName) {
      const siblings = periodRecords.filter(item => 
        item.id !== r.id &&
        item.date === r.date &&
        item.supplierOrStore &&
        item.supplierOrStore.toLowerCase().trim() === suppName.toLowerCase().trim()
      );

      if (siblings.length > 0) {
        // Offer smart prompt: Combine all items from this supplier on this date vs this item only
        setSupplierNotaPrompt({
          supplierName: suppName,
          clickedRecord: r,
          siblingRecords: siblings,
        });
        return;
      }
    }

    // Otherwise, generate single item Nota as normal
    handleCreateSingleItemNota(r);
  };

  const handleCreateSingleItemNota = (r: UnifiedRecord) => {
    const targetDate = r.date || localDateIso();
    const nextPoNum = generateNextPoNumber(purchaseOrders, targetDate);
    const suppObj = suppliers.find(s => s.name.toLowerCase() === r.supplierOrStore.toLowerCase());
    const numQty = normalizeQtyForUnit(parseFloat(String(r.quantity).replace(',', '.')) || 1, r.unit || 'Pcs');
    const unitPrice = r.unitPrice > 0 ? r.unitPrice : Math.round(r.nominal / numQty);

    const initialItem: PurchaseOrderItem = {
      id: `POI-${Date.now()}`,
      name: r.itemName,
      category: r.displayCategory || r.category,
      quantity: numQty,
      unit: r.unit || 'Pcs',
      unitPrice: unitPrice,
      subtotal: r.nominal,
      notes: r.notes,
    };

    const newNota: PurchaseOrderNota = {
      id: `PO-${Date.now()}`,
      poNumber: nextPoNum,
      date: r.date || localDateIso(),
      deliveryDate: r.date || localDateIso(),
      supplierId: suppObj?.id,
      supplierName: r.supplierOrStore !== '-' ? r.supplierOrStore : (suppObj?.name || 'Toko / Rekanan'),
      supplierContact: suppObj?.phone ? `${suppObj.phone} (${suppObj.contactPerson})` : '',
      supplierAddress: suppObj?.address || '',
      paymentMethod: 'TRANSFER',
      bankInfo: suppObj ? `Transfer Bank Rekening Resmi ${suppObj.name}` : '',
      status: 'DISETUJUI',
      items: [initialItem],
      subtotal: r.nominal,
      discount: 0,
      tax: 0,
      grandTotal: r.nominal,
      terbilang: angkaTerbilang(r.nominal),
      notes: 'Barang harus dalam keadaan segar, higienis, dan sesuai standar pemenuhan gizi SPPG.',
      deliveryTerms: 'Pengiriman langsung ke Satuan Pelayanan Pemenuhan Gizi (SPPG) MLG TUMPANG JERU.',
      createdBy: currentUser.name,
      createdByRole: currentUser.role === 'ADMIN' ? 'Admin Logistik' : currentUser.role,
      approvedBy: warehouseDb.getSppgHeadName(),
      approvedByRole: 'Kepala SPPG',
      supplierPic: suppObj?.contactPerson || 'Pihak Rekanan',
      relatedExpenseIds: r.source === 'EXPENSE_INPUT' ? [r.id] : undefined,
      relatedReceivingId: r.source === 'DELIVERY_ORDER' && r.rawDoc ? r.rawDoc.id : undefined,
      createdAt: new Date().toISOString(),
    };

    setActiveNota(newNota);
    setIsNotaModalOpen(true);
    setSupplierNotaPrompt(null);
  };

  const handleCreateCombinedNotaForSupplier = (
    supplierName: string, 
    recordsToInclude?: UnifiedRecord[],
    targetDateOverride?: string
  ) => {
    const rawRecords = recordsToInclude && recordsToInclude.length > 0
      ? recordsToInclude
      : periodRecords.filter(r => {
          const suppName = r.supplierOrStore && r.supplierOrStore !== '-' ? r.supplierOrStore : 'Belanja Rutin';
          return suppName.toLowerCase().trim() === supplierName.toLowerCase().trim();
        });

    if (rawRecords.length === 0) {
      toast.warning(`Tidak ada barang ditemukan untuk supplier "${supplierName}".`, 'Data Kosong');
      return;
    }

    const suppObj = suppliers.find(s => s.name.toLowerCase().trim() === supplierName.toLowerCase().trim());
    const targetDate = targetDateOverride || rawRecords[0].date || localDateIso();
    const nextPoNum = generateNextPoNumber(purchaseOrders, targetDate);

    const poItems: PurchaseOrderItem[] = rawRecords.map((r, i) => {
      const numQty = normalizeQtyForUnit(parseFloat(String(r.quantity).replace(',', '.')) || 1, r.unit || 'Pcs');
      const unitPrice = r.unitPrice > 0 ? r.unitPrice : Math.round(r.nominal / numQty);
      return {
        id: `POI-${Date.now()}-${i}`,
        name: r.itemName,
        category: r.displayCategory || r.category,
        quantity: numQty,
        unit: r.unit || 'Pcs',
        unitPrice: unitPrice,
        subtotal: r.nominal,
        notes: r.notes,
      };
    });

    const subtotal = poItems.reduce((acc, it) => acc + (it.subtotal || it.quantity * it.unitPrice), 0);
    const expenseIds = rawRecords
      .filter(r => r.source === 'EXPENSE_INPUT')
      .map(r => r.id);

    const receivingDocId = rawRecords.find(r => r.source === 'DELIVERY_ORDER' && r.rawDoc)?.rawDoc?.id;

    const newNota: PurchaseOrderNota = {
      id: `PO-${Date.now()}`,
      poNumber: nextPoNum,
      date: targetDate,
      deliveryDate: targetDate,
      supplierId: suppObj?.id,
      supplierName: supplierName !== 'Belanja Rutin' && supplierName !== '-' ? supplierName : (suppObj?.name || 'Toko / Rekanan'),
      supplierContact: suppObj?.phone ? `${suppObj.phone} (${suppObj.contactPerson})` : '',
      supplierAddress: suppObj?.address || '',
      paymentMethod: 'TRANSFER',
      bankInfo: suppObj ? `Transfer Bank Rekening Resmi ${suppObj.name}` : '',
      status: 'DISETUJUI',
      items: poItems,
      subtotal: subtotal,
      discount: 0,
      tax: 0,
      grandTotal: subtotal,
      terbilang: angkaTerbilang(subtotal),
      notes: 'Barang harus dalam keadaan segar, higienis, dan sesuai standar pemenuhan gizi SPPG.',
      deliveryTerms: 'Pengiriman langsung ke Satuan Pelayanan Pemenuhan Gizi (SPPG) MLG TUMPANG JERU.',
      createdBy: currentUser.name,
      createdByRole: currentUser.role === 'ADMIN' ? 'Admin Logistik' : currentUser.role,
      approvedBy: warehouseDb.getSppgHeadName(),
      approvedByRole: 'Kepala SPPG',
      supplierPic: suppObj?.contactPerson || 'Pihak Rekanan',
      relatedExpenseIds: expenseIds.length > 0 ? expenseIds : undefined,
      relatedReceivingId: receivingDocId,
      createdAt: new Date().toISOString(),
    };

    setActiveNota(newNota);
    setIsNotaModalOpen(true);
    setSupplierNotaPrompt(null);
  };

  const handleCreateNotaFromSelected = () => {
    const selectedRecords = periodRecords.filter(r => selectedRecordIds.includes(r.id) && !getMatchingNotaForRecord(r));
    if (selectedRecords.length === 0) {
      toast.info('Barang yang dipilih sudah punya nota.', 'Nota Sudah Ada');
      setSelectedRecordIds([]);
      return;
    }

    // Detect supplier: use the first valid supplier name or 'Supplier Gabungan'
    const firstSupplier = selectedRecords.find(r => r.supplierOrStore && r.supplierOrStore !== '-')?.supplierOrStore || 'Supplier Gabungan';
    const firstDate = selectedRecords[0]?.date;
    handleCreateCombinedNotaForSupplier(firstSupplier, selectedRecords, firstDate);
    setSelectedRecordIds([]);
  };

  const handleStartNotaFromPrompt = () => {
    if (!justSavedPrompt) return;
    const info = justSavedPrompt;
    const targetDate = localDateIso();
    const nextPoNum = generateNextPoNumber(purchaseOrders, targetDate);
    const suppObj = suppliers.find(s => s.name.toLowerCase() === info.supplierName.toLowerCase() || s.id === info.supplierId);
    const subtotal = info.items.reduce((sum, it) => sum + (it.subtotal || it.quantity * it.unitPrice), 0);

    const relatedIds = info.refIds && info.refIds.length > 0
      ? info.refIds
      : (info.refId && info.refId.startsWith('NFE') ? [info.refId] : undefined);

    const newNota: PurchaseOrderNota = {
      id: `PO-${Date.now()}`,
      poNumber: nextPoNum,
      date: localDateIso(),
      deliveryDate: localDateIso(),
      supplierId: suppObj?.id,
      supplierName: suppObj?.name || info.supplierName,
      supplierContact: suppObj?.phone ? `${suppObj.phone} (${suppObj.contactPerson})` : '',
      supplierAddress: suppObj?.address || '',
      paymentMethod: 'TRANSFER',
      bankInfo: suppObj ? `Transfer Bank Rekening Resmi ${suppObj.name}` : '',
      status: 'DISETUJUI',
      items: info.items,
      subtotal: subtotal,
      discount: 0,
      tax: 0,
      grandTotal: subtotal,
      terbilang: angkaTerbilang(subtotal),
      notes: 'Barang harus dalam keadaan segar, higienis, dan sesuai standar pemenuhan gizi SPPG.',
      deliveryTerms: 'Pengiriman langsung ke Satuan Pelayanan Pemenuhan Gizi (SPPG) MLG TUMPANG JERU.',
      createdBy: currentUser.name,
      createdByRole: currentUser.role === 'ADMIN' ? 'Admin Logistik' : currentUser.role,
      approvedBy: warehouseDb.getSppgHeadName(),
      approvedByRole: 'Kepala SPPG',
      supplierPic: suppObj?.contactPerson || 'Pihak Rekanan',
      relatedExpenseIds: relatedIds,
      relatedReceivingId: info.refId && !info.refId.startsWith('NFE') ? info.refId : undefined,
      createdAt: new Date().toISOString(),
    };

    setActiveNota(newNota);
    setIsNotaModalOpen(true);
    setJustSavedPrompt(null);
  };

  const handleSaveNotaFromModal = (updatedNota: PurchaseOrderNota) => {
    try {
      warehouseDb.savePurchaseOrder(updatedNota, currentUser);
      setActiveNota(updatedNota);
      refreshAll();
      toast.success(`Nota PO ${updatedNota.poNumber} berhasil diperbarui.`, 'Nota Disimpan');
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menyimpan pembaruan Nota PO.', 'Gagal Menyimpan');
    }
  };

  const handleDeleteNota = (nota: PurchaseOrderNota) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Hapus Nota PO?',
      message: `Apakah Anda yakin ingin menghapus Nota PO "${nota.poNumber}" (${nota.supplierName})? Dokumen PO akan dihapus dari sistem. Catatan barang tetap tersimpan dan dapat diterbitkan PO kembali kapan saja.`,
      confirmText: 'Ya, Hapus PO',
      cancelText: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setActionLoading({
          isLoading: true,
          message: 'Menghapus Nota PO...',
        });
        await new Promise(r => setTimeout(r, 200));
        warehouseDb.deletePurchaseOrder(nota.id, currentUser);
        handleRemoveFromPool(nota.id);
        handleRemoveFromPool(nota.poNumber);
        if (activeNota && (activeNota.id === nota.id || activeNota.poNumber === nota.poNumber)) {
          setIsNotaModalOpen(false);
          setActiveNota(null);
        }
        setActionLoading({ isLoading: false });
        toast.success(`Nota PO ${nota.poNumber} berhasil dihapus.`, 'PO Dihapus');
        refreshAll();
      },
    });
  };

  // ----------------------------------------------------
  // Summary Metrics & Unified Table Data
  // ----------------------------------------------------
  const unifiedRecords = useMemo(() => {
    const list: UnifiedRecord[] = [];

    // Belanja yang tercatat dari penerimaan barang tertaut ke dokumennya: lewat penanda [GR: id]
    // (penerimaan baru) atau nomor PO di catatan dokumen (data lama). Belanja itu tidak ditampilkan
    // terpisah; harganya dipakai di baris penerimaan, agar satu barang tidak muncul dan terhitung dua kali.
    const receivingIds = new Set(receivings.map(r => r.id));
    const linkedByDoc = new Map<string, NonFoodExpense[]>();
    const linkTarget = (exp: NonFoodExpense): string | undefined => {
      const tag = exp.notes?.match(/\[GR:\s*([^\]]+)\]/)?.[1]?.trim();
      if (tag && receivingIds.has(tag)) return tag;
      if (exp.receiptRef) {
        return receivings.find(r => r.notes?.includes(`PO ${exp.receiptRef}`))?.id;
      }
      return undefined;
    };

    expenses.forEach(exp => {
      const docId = linkTarget(exp);
      if (docId) {
        linkedByDoc.set(docId, [...(linkedByDoc.get(docId) || []), exp]);
        return;
      }
      const cat = exp.category;
      const numQty = typeof exp.quantity === 'number' ? exp.quantity : parseFloat(String(exp.quantity)) || 0;
      const price = exp.unitPrice || 0;
      const total = exp.totalCost || numQty * price;

      list.push({
        id: exp.id,
        source: 'EXPENSE_INPUT',
        date: exp.date,
        parsedDate: parseExpenseDate(exp.date),
        time: exp.time || '12.00',
        category: cat,
        displayCategory: cat,
        itemName: exp.itemName,
        quantity: exp.quantity,
        unit: exp.unit || 'Pcs',
        unitPrice: price,
        nominal: total,
        supplierOrStore:
          exp.notes?.match(/\[(?:Toko\/Supplier|Toko|Supplier):\s*([^\]]+)\]/i)?.[1] || exp.recipient || '-',
        picOrUser: exp.pic || exp.recordedBy || currentUser.name,
        volunteer: exp.volunteer,
        notes: exp.notes,
      });
    });

    // Add Delivery Orders
    receivings.forEach(rec => {
      const linked = [...(linkedByDoc.get(rec.id) || [])];
      rec.lines.forEach((l, idx) => {
        const cat = autoDetectCategory(l.itemName);
        const matchIdx = linked.findIndex(e => (e.itemId && e.itemId === l.itemId) || e.itemName === l.itemName);
        const priced = matchIdx >= 0 ? linked.splice(matchIdx, 1)[0] : undefined;
        const unitPrice = priced?.unitPrice || 0;

        list.push({
          id: `${rec.id}-${idx}`,
          source: 'DELIVERY_ORDER',
          lineId: l.id,
          linkedExpenseId: priced?.id,
          date: rec.date,
          parsedDate: parseExpenseDate(rec.date),
          time: rec.arrivalTime,
          category: 'Surat Jalan Supplier',
          displayCategory: cat,
          itemName: l.itemName,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice,
          nominal: priced?.totalCost ?? Math.round(l.quantity * unitPrice),
          supplierOrStore: rec.supplierName,
          picOrUser: rec.receiverName,
          volunteer: undefined,
          notes: rec.deliveryNoteNo ? `SJ: ${rec.deliveryNoteNo}` : rec.notes,
          rawDoc: rec,
        });
      });
      // Belanja tertaut yang tidak cocok dengan baris mana pun tetap ditampilkan agar nominalnya tidak hilang.
      linked.forEach(exp => {
        list.push({
          id: exp.id,
          source: 'EXPENSE_INPUT',
          date: exp.date,
          parsedDate: parseExpenseDate(exp.date),
          time: exp.time || '12.00',
          category: exp.category,
          displayCategory: exp.category,
          itemName: exp.itemName,
          quantity: exp.quantity,
          unit: exp.unit || 'Pcs',
          unitPrice: exp.unitPrice || 0,
          nominal: exp.totalCost || 0,
          supplierOrStore: rec.supplierName,
          picOrUser: exp.pic || exp.recordedBy || currentUser.name,
          volunteer: exp.volunteer,
          notes: exp.notes,
        });
      });
    });

    return list.sort((a, b) => {
      const timeA = a.parsedDate ? a.parsedDate.getTime() : 0;
      const timeB = b.parsedDate ? b.parsedDate.getTime() : 0;
      return timeB - timeA;
    });
  }, [expenses, receivings, currentUser.name]);

  // Filtered by Period Date Range
  const periodRecords = useMemo(() => {
    return unifiedRecords.filter(r => {
      if (r.parsedDate && effectiveDateRange.start && effectiveDateRange.end) {
        const itemTime = new Date(r.parsedDate.getFullYear(), r.parsedDate.getMonth(), r.parsedDate.getDate()).getTime();
        const startTime = new Date(effectiveDateRange.start.getFullYear(), effectiveDateRange.start.getMonth(), effectiveDateRange.start.getDate()).getTime();
        const endTime = new Date(effectiveDateRange.end.getFullYear(), effectiveDateRange.end.getMonth(), effectiveDateRange.end.getDate()).getTime();
        if (itemTime < startTime || itemTime > endTime) {
          return false;
        }
      }
      return true;
    });
  }, [unifiedRecords, effectiveDateRange]);

  // Kategori & sub-kategori tiap catatan, dihitung sekali per periode
  const recordCategory = (r: UnifiedRecord): StandardCategory =>
    normalizeToStandardCategory(r.displayCategory || r.category, r.itemName);

  const sourceRecords = useMemo(
    () => (sourceFilter === 'ALL' ? periodRecords : periodRecords.filter(r => r.source === sourceFilter)),
    [periodRecords, sourceFilter]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    sourceRecords.forEach(r => {
      const cat = recordCategory(r);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [sourceRecords]);

  const subcategoryCounts = useMemo(() => {
    if (selectedCategoryTab === 'ALL') return [];
    const counts: Record<string, number> = {};
    sourceRecords.forEach(r => {
      if (recordCategory(r) !== selectedCategoryTab) return;
      const sub = getItemSubcategory(selectedCategoryTab, r.itemName);
      counts[sub] = (counts[sub] || 0) + 1;
    });
    return getSubcategoryOrder(selectedCategoryTab)
      .filter(label => counts[label])
      .map(label => ({ label, count: counts[label] }));
  }, [sourceRecords, selectedCategoryTab]);

  const matchesCategoryFilters = (r: UnifiedRecord): boolean => {
    if (sourceFilter !== 'ALL' && r.source !== sourceFilter) return false;
    if (selectedCategoryTab === 'ALL') return true;
    if (recordCategory(r) !== selectedCategoryTab) return false;
    return selectedSubcategory === 'ALL' || getItemSubcategory(selectedCategoryTab, r.itemName) === selectedSubcategory;
  };

  // Metrics for Current Period
  const metrics = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let wetCost = 0;
    let dryCost = 0;
    let opCost = 0;

    periodRecords.forEach(r => {
      totalItems += 1;
      totalCost += r.nominal;
      const normalized = normalizeItemCategory(r.displayCategory || r.category, r.itemName);
      if (normalized === 'Bahan Basah') wetCost += r.nominal;
      else if (normalized === 'Bahan Kering') dryCost += r.nominal;
      else opCost += r.nominal;
    });

    return { totalItems, totalCost, wetCost, dryCost, opCost };
  }, [periodRecords]);

  // Derived Unique Suppliers in Period with item count and total cost
  const uniqueSuppliers = useMemo(() => {
    const map = new Map<string, {
      name: string;
      count: number;
      totalCost: number;
      records: UnifiedRecord[];
    }>();

    periodRecords.forEach(r => {
      const suppName = r.supplierOrStore && r.supplierOrStore !== '-' ? r.supplierOrStore : 'Belanja Rutin';
      const existing = map.get(suppName) || { name: suppName, count: 0, totalCost: 0, records: [] };
      existing.count += 1;
      existing.totalCost += r.nominal;
      existing.records.push(r);
      map.set(suppName, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [periodRecords]);

  // Filtered List based on Category, Supplier & Search
  const filteredRecords = useMemo(() => {
    return periodRecords.filter(r => {
      if (!matchesCategoryFilters(r)) return false;

      // Supplier filter
      if (selectedSupplierFilter !== 'ALL') {
        const suppName = r.supplierOrStore && r.supplierOrStore !== '-' ? r.supplierOrStore : 'Belanja Rutin';
        if (suppName !== selectedSupplierFilter) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = r.itemName.toLowerCase().includes(q);
        const matchSupplier = r.supplierOrStore.toLowerCase().includes(q);
        const matchPic = r.picOrUser.toLowerCase().includes(q);
        const matchNotes = (r.notes || '').toLowerCase().includes(q);
        const matchCategory = (r.category || '').toLowerCase().includes(q);
        if (!matchName && !matchSupplier && !matchPic && !matchNotes && !matchCategory) {
          return false;
        }
      }

      return true;
    });
  }, [periodRecords, selectedCategoryTab, selectedSubcategory, sourceFilter, selectedSupplierFilter, searchQuery]);

  // Tampilan per supplier memakai hasil filter yang sama dengan tabel, dikelompokkan per supplier lalu per tanggal
  const supplierGroups = useMemo(() => {
    const map = new Map<string, { name: string; total: number; byDate: Map<string, UnifiedRecord[]> }>();
    filteredRecords.forEach(r => {
      const name = r.supplierOrStore && r.supplierOrStore !== '-' ? r.supplierOrStore : 'Belanja Rutin';
      const group = map.get(name) || { name, total: 0, byDate: new Map<string, UnifiedRecord[]>() };
      group.total += r.nominal;
      const date = r.date || 'Tanpa tanggal';
      group.byDate.set(date, [...(group.byDate.get(date) || []), r]);
      map.set(name, group);
    });
    return Array.from(map.values())
      .map(g => ({
        name: g.name,
        total: g.total,
        count: Array.from(g.byDate.values()).reduce((sum, list) => sum + list.length, 0),
        dates: Array.from(g.byDate.entries()).sort(([a], [b]) => b.localeCompare(a)),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredRecords]);

  // Supplier terpilih yang tidak ada lagi di periode ini (mis. periode diganti) dikembalikan ke semua supplier
  useEffect(() => {
    if (selectedSupplierFilter !== 'ALL' && !uniqueSuppliers.some(s => s.name === selectedSupplierFilter)) {
      setSelectedSupplierFilter('ALL');
    }
  }, [uniqueSuppliers, selectedSupplierFilter]);

  // Baris yang sudah punya nota tidak bisa dipilih lagi, supaya tidak terbit nota ganda
  const selectableRecords = filteredRecords.filter(r => !getMatchingNotaForRecord(r));
  const allFilteredSelected = selectableRecords.length > 0 && selectableRecords.every(r => selectedRecordIds.includes(r.id));
  const someFilteredSelected = selectableRecords.some(r => selectedRecordIds.includes(r.id));
  const selectedTotal = periodRecords
    .filter(r => selectedRecordIds.includes(r.id))
    .reduce((sum, r) => sum + r.nominal, 0);

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(selectableRecords.map(r => r.id));
    }
  };

  const handleToggleSelectRecord = (id: string) => {
    setSelectedRecordIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedSupplierObj = suppliers.find(s => s.id === formSupplierId);

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredRecords.length === 0) {
      toast.warning('Tidak ada data belanja atau barang masuk untuk diekspor.', 'Data Kosong');
      return;
    }

    const rows = filteredRecords.map((r, i) => ({
      No: i + 1,
      Tanggal: r.date,
      Jam: r.time,
      Kategori: r.displayCategory,
      'Nama Barang': r.itemName,
      Jumlah: r.quantity,
      Satuan: r.unit,
      'Estimasi Harga Satuan (Rp)': r.unitPrice,
      'Total Nominal (Rp)': r.nominal,
      'Toko / Supplier': r.supplierOrStore,
      'PIC Penerima': r.picOrUser,
      'Relawan / Petugas': r.volunteer || '-',
      Keterangan: r.notes || '-',
    }));

    exportToExcel(
      rows,
      `Rekap_Input_Barang_SPPG_MLG_TUMPANG_JERU_${today}.xlsx`,
      'Input Barang & Belanja'
    );
    toast.success('Rekap belanja berhasil diekspor ke Excel.', 'Ekspor Sukses');
  };

  return (
    <div className="space-y-5">
      {/* Detail Modal for Delivery Orders */}
      <ReceivingDetailModal
        document={selectedDocForDetail}
        onClose={() => setSelectedDocForDetail(null)}
        onPrint={onPrintReceiving}
      />

      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* HEADER: satu pintu masuk barang */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Barang Masuk</h1>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
              Semua barang yang dibeli masuk stok gudang, dan belanjanya tercatat di laporan pengeluaran.
            </p>
          </div>

          {!isCreatingDeliveryOrder && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {can('RECEIVE_GOODS') && (
                <button
                  type="button"
                  onClick={handleOpenDeliveryOrder}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                >
                  Terima Barang
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsBatchPrintModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                title="Kumpulkan nota untuk dicetak 2 nota per lembar A4"
              >
                Antrean Cetak
                {poolNotaIds.length > 0 && (
                  <span className="px-1.5 rounded-md bg-emerald-700 text-white text-[11px] font-semibold font-mono">
                    {poolNotaIds.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                title="Unduh riwayat sesuai filter ke Excel"
              >
                Ekspor Excel
              </button>
            </div>
          )}
        </div>

        {/* Urutan kerja barang masuk, sama untuk barang dari PO maupun tanpa PO. */}
        {!isCreatingDeliveryOrder && (
          <ol className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
            {[
              ['Timbang', 'Timbang atau hitung barang yang datang.'],
              ['Cocokkan nota', 'Samakan jumlah dan harga dengan nota supplier.'],
              ['Simpan', 'Stok gudang bertambah, belanja masuk laporan.'],
              ['Cetak nota', 'Cetak nota pesanan untuk arsip dan tanda tangan.'],
            ].map(([title, desc], i) => (
              <li key={title} className="flex gap-2 p-2.5 rounded-lg bg-slate-50">
                <span className="w-5 h-5 shrink-0 rounded-md bg-emerald-700 text-white font-mono font-semibold flex items-center justify-center">{i + 1}</span>
                <span>
                  <span className="block font-semibold text-slate-800">{title}</span>
                  <span className="text-slate-600">{desc}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* PO MENUNGGU DITERIMA: the main morning task, shown even when empty */}
      {!isCreatingDeliveryOrder && (
        <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                PO Menunggu Diterima <span className="font-mono text-slate-500">({pendingPOs.length})</span>
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Timbang bahan saat datang. Stok gudang dan laporan pengeluaran terisi otomatis.
              </p>
            </div>
            {menuPOs.length > pendingPOs.length && (
              <button
                type="button"
                onClick={() => setShowAllPoQueue(prev => !prev)}
                aria-pressed={showAllPoQueue}
                className="self-start sm:self-auto text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer rounded-md min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                {showAllPoQueue
                  ? 'Sembunyikan PO yang sudah diterima'
                  : `Tampilkan juga PO yang sudah diterima (${menuPOs.length - pendingPOs.length})`}
              </button>
            )}
          </div>

          <div className="p-4 sm:p-5">
            {(() => {
              const displayedQueue = [...(showAllPoQueue ? menuPOs : pendingPOs)].sort((a, b) => {
                const aDone = isAwaitingDelivery(a) ? 0 : 1;
                const bDone = isAwaitingDelivery(b) ? 0 : 1;
                if (aDone !== bDone) return aDone - bDone;
                return (a.deliveryDate || a.date).localeCompare(b.deliveryDate || b.date);
              });

              if (menuPOs.length === 0) {
                return (
                  <div className="py-8 text-center">
                    <p className="text-xs font-semibold text-slate-800">Belum ada PO.</p>
                    <p className="text-[11px] text-slate-600 mt-1 max-w-md mx-auto">
                      PO dibuat dari rencana menu. Barang tanpa PO tetap bisa dicatat lewat Terima Barang.
                    </p>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => onNavigate('menu_orders')}
                        className="mt-3 inline-flex items-center px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      >
                        Buat PO di halaman Menu
                      </button>
                    )}
                  </div>
                );
              }

              if (displayedQueue.length === 0) {
                return (
                  <div className="py-8 text-center">
                    <p className="text-xs font-semibold text-slate-800">Semua PO sudah diterima.</p>
                    <p className="text-[11px] text-slate-600 mt-1">Tidak ada bahan yang sedang ditunggu dari supplier.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                {latePOs.length > 1 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
                    <p>
                      <span className="font-semibold">{latePOs.length} PO sudah lewat jadwal kirim.</span> Bila barangnya sudah dicatat
                      lewat Terima Barang atau tidak jadi datang, tutup supaya tidak ditunggu lagi.
                    </p>
                    <button type="button" onClick={() => handleClosePos(latePOs)} className={`${BTN_SECONDARY} shrink-0`}>
                      Tutup {latePOs.length} PO lewat jadwal
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {displayedQueue.map(po => {
                    const isFinished = !isAwaitingDelivery(po);
                    const targetDeliveryDate = (po.deliveryDate || po.date || '').slice(0, 10);
                    const isToday = targetDeliveryDate === today;
                    const isLate = !isFinished && targetDeliveryDate !== '' && targetDeliveryDate < today;
                    const lateDays = isLate
                      ? Math.round((new Date(today).getTime() - new Date(targetDeliveryDate).getTime()) / 86400000)
                      : 0;
                    // Only PO generated from a menu plan carries the menu name in its notes
                    // Baris pertama catatan berisi nama menu; baris berikutnya bisa berupa catatan revisi
                    const menuMatch = po.notes?.match(/^PO dibuat otomatis dari Perencanaan Menu:[ \t]*(.+)/i);
                    const cleanMenuName = menuMatch ? menuMatch[1].trim() : '';
                    const revisionCount = po.notes?.match(/^Revisi \d+/gm)?.length || 0;

                    return (
                      <div
                        key={po.id}
                        className={`rounded-xl border p-4 flex flex-col justify-between ${
                          isFinished
                            ? 'bg-slate-50 border-slate-200'
                            : isToday
                            ? 'bg-white border-emerald-300'
                            : isLate
                            ? 'bg-white border-amber-300'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-slate-900 text-sm truncate" title={po.supplierName}>
                                {po.supplierName}
                              </h3>
                              <p className="text-[11px] font-mono text-slate-600 mt-0.5">{po.poNumber}</p>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 ${
                                isFinished
                                  ? 'bg-slate-200 text-slate-700'
                                  : isToday
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : isLate
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {isFinished ? 'Sudah diterima' : isToday ? 'Datang hari ini' : isLate ? `Lewat ${lateDays} hari` : 'Dijadwalkan'}
                            </span>
                          </div>

                          <div className="text-xs text-slate-600 space-y-1">
                            <p>
                              Jadwal kirim:{' '}
                              <strong className="text-slate-900 font-medium">{formatIndonesianDateWithDay(targetDeliveryDate)}</strong>
                            </p>
                            {cleanMenuName && (
                              <p className="text-[11px] truncate" title={cleanMenuName}>
                                Menu: {cleanMenuName}
                              </p>
                            )}
                            {revisionCount > 0 && (
                              <p className="text-[11px] text-amber-800">
                                Direvisi {revisionCount} kali. Pastikan supplier memegang PO terbaru.
                              </p>
                            )}
                          </div>

                          <ul className="rounded-lg p-2.5 bg-slate-50 border border-slate-200 space-y-1">
                            {po.items.slice(0, 3).map((it, idx) => (
                              <li key={idx} className="flex items-center justify-between text-xs gap-2">
                                <span className="text-slate-700 truncate">{it.name}</span>
                                <span className="font-mono font-semibold text-slate-900 shrink-0 tabular-nums">
                                  {normalizeQtyForUnit(Number(it.quantity) || 0, it.unit).toLocaleString('id-ID', { maximumFractionDigits: 2 })} {it.unit}
                                </span>
                              </li>
                            ))}
                            {po.items.length > 3 && (
                              <li className="text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                                +{po.items.length - 3} bahan lainnya
                              </li>
                            )}
                          </ul>
                        </div>

                        <div className="pt-3 mt-3 border-t border-slate-200 space-y-2.5">
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span>Nilai PO</span>
                            {po.grandTotal > 0 ? (
                              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                                Rp {po.grandTotal.toLocaleString('id-ID')}
                              </span>
                            ) : (
                              <span className="font-semibold text-amber-700">Harga belum diisi</span>
                            )}
                          </div>
                          {/* Aksi utama satu baris penuh; aksi pendukung di baris bawahnya supaya label tidak terlipat */}
                          {!isFinished && (
                            <button
                              type="button"
                              onClick={() => handleOpenWeighModal(po)}
                              className={`${BTN_PRIMARY} w-full`}
                            >
                              <Scale className="w-4 h-4" />
                              Timbang & terima
                            </button>
                          )}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenExistingNota(po)}
                              className={`${BTN_SECONDARY} flex-1`}
                            >
                              <FileText className="w-4 h-4 text-slate-500" />
                              Lihat nota
                            </button>
                            {!isFinished && (
                              <button
                                type="button"
                                onClick={() => setPoBeingEdited(po)}
                                title="Ubah jumlah, bahan, harga, atau supplier sebelum barang datang"
                                className={`${BTN_SECONDARY} flex-1`}
                              >
                                <Pencil className="w-4 h-4 text-slate-500" />
                                Ubah
                              </button>
                            )}
                            {isLate && (
                              <button
                                type="button"
                                onClick={() => handleClosePos([po])}
                                title="Barang sudah dicatat lewat jalur lain atau tidak jadi datang"
                                className={`${BTN_SECONDARY} flex-1`}
                              >
                                Tutup
                              </button>
                            )}
                            {/* Hapus dibuat ikon saja agar tidak bersaing dengan aksi utama; label tetap ada untuk pembaca layar */}
                            {!isFinished && (
                              <button
                                type="button"
                                onClick={() => handleDeleteNota(po)}
                                aria-label={`Hapus PO ${po.poNumber}`}
                                title="Batalkan dan hapus PO ini"
                                className={`${BTN_SECONDARY} border-transparent bg-transparent hover:bg-rose-50 text-rose-700 px-2.5 min-w-[44px] sm:min-w-[34px]`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              );
            })()}
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* FORM MODE: DELIVERY ORDER (SURAT JALAN SUPPLIER RESMI) */}
      {/* ========================================================================= */}
      {isCreatingDeliveryOrder ? (
        <form onSubmit={handleSubmitDeliveryOrder} className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50/70">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setIsCreatingDeliveryOrder(false)}
                aria-label="Kembali ke daftar"
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-md transition-colors cursor-pointer min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Terima Barang (tanpa PO)</h2>
                <p className="text-[11px] text-slate-600 max-w-2xl">
                  Untuk barang di luar menu: plastik dan kemasan, obat, APD, sabun, gas, ATK. Stok gudang bertambah dan
                  belanjanya masuk laporan pengeluaran. Bahan menu yang sudah ada PO-nya diterima lewat daftar PO.
                </p>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div role="alert" className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-4 sm:p-6 space-y-6">
            {/* Header Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              {/* Supplier Searchable Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier / toko <span className="text-rose-500">*</span>
                </label>
                <SearchPicker
                  value={formSupplierId}
                  options={supplierOptions}
                  onSelect={(opt, text) => setFormSupplierId(opt ? opt.value : text.trim())}
                  placeholder="Pilih atau ketik nama toko"
                  searchPlaceholder="Cari supplier, atau ketik nama toko/apotek..."
                  ariaLabel="Supplier atau toko"
                  noun="supplier"
                  allowCustom
                />
                {selectedSupplierObj ? (
                  selectedSupplierObj.address && (
                    <p className="text-[11px] text-slate-600 mt-1 truncate">{selectedSupplierObj.address}</p>
                  )
                ) : formSupplierId.trim() ? (
                  <p className="text-[11px] text-slate-600 mt-1">Toko baru, disimpan ke Master Supplier saat penerimaan disimpan.</p>
                ) : (
                  <p className="text-[11px] text-slate-600 mt-1">Belum terdaftar? Ketik nama toko, minimarket, atau apotek.</p>
                )}
              </div>

              {/* Tanggal */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Masuk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  required
                />
              </div>

              {/* Waktu Tiba */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Waktu Kedatangan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="time"
                  value={formTime}
                  onChange={e => setFormTime(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none cursor-pointer"
                  required
                />
              </div>

              {/* Penerima (PIC) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Penerima (PIC Gudang)</label>
                <div className="w-full text-xs rounded-lg border border-slate-200 bg-slate-100/80 px-3 py-2 text-slate-700 font-semibold truncate">
                  {currentUser.name} ({currentUser.role})
                </div>
              </div>

              {/* No Surat Jalan */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">No. Nota / Surat Jalan</label>
                <input
                  type="text"
                  placeholder="Contoh: NT-0812 atau SJ-2026/09/8821"
                  value={formDeliveryNote}
                  onChange={e => setFormDeliveryNote(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              {/* Catatan / Keterangan */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  placeholder="Contoh: stok APD untuk bulan November"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Item Lines Section */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-xs font-semibold text-slate-800">
                    Barang diterima <span className="font-mono text-slate-500">({lines.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Jumlah dalam satuan stok gudang. Barang yang belum ada di daftar didaftarkan lewat "Barang baru".
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {can('MANAGE_ITEMS') && (
                    <button
                      type="button"
                      onClick={() => openQuickItem(null)}
                      className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[32px] px-3 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      Barang baru
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={addLine}
                    className="inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[32px] px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    Tambah baris
                  </button>
                </div>
              </div>

              {/* Satu markup untuk semua layar: kartu bertumpuk di HP, baris tabel di layar lebar. */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="hidden lg:grid grid-cols-[2rem_minmax(0,2.2fr)_7rem_minmax(0,1.1fr)_7rem_minmax(0,1.6fr)_2.75rem] gap-3 px-3 py-2.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-700">
                  <span className="text-center">#</span>
                  <span>Barang <span className="text-rose-600">*</span></span>
                  <span>Jumlah <span className="text-rose-600">*</span></span>
                  <span>Harga satuan (nota) <span className="text-rose-600">*</span></span>
                  <span className="text-right">Subtotal</span>
                  <span>Kondisi & catatan</span>
                  <span className="sr-only">Hapus</span>
                </div>

                <ul className="divide-y divide-slate-200">
                  {lines.map((line, idx) => {
                    const isMedicine = !!line.itemId && isMedicineItem(line.category, line.itemName);
                    const subtotal = line.quantity * (line.unitPrice || 0);
                    return (
                      <li
                        key={idx}
                        className="grid grid-cols-2 lg:grid-cols-[2rem_minmax(0,2.2fr)_7rem_minmax(0,1.1fr)_7rem_minmax(0,1.6fr)_2.75rem] gap-x-3 gap-y-2.5 p-3 lg:items-start"
                      >
                        <div className="col-span-2 lg:col-span-1 flex items-center justify-between lg:justify-center lg:pt-2.5">
                          <span className="text-xs font-semibold text-slate-700 lg:font-mono lg:font-normal lg:text-slate-500">
                            <span className="lg:hidden">Barang </span>{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length === 1}
                            aria-label={`Hapus baris ${idx + 1}`}
                            className="lg:hidden inline-flex items-center justify-center min-h-[44px] min-w-[44px] -my-2 -mr-2 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="col-span-2 lg:col-span-1 min-w-0">
                          <span className="lg:hidden block text-[11px] font-medium text-slate-600 mb-1">Barang</span>
                          <SearchPicker
                            value={line.itemId}
                            options={receivingItemOptions}
                            onSelect={opt => opt && handleLineItemChange(idx, opt.value)}
                            placeholder="Pilih barang gudang"
                            searchPlaceholder="Cari nama barang..."
                            ariaLabel={`Barang baris ${idx + 1}`}
                            noun="barang"
                            size="sm"
                          />
                          {line.category && (
                            <span className="inline-block mt-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">{line.category}</span>
                          )}
                        </div>

                        <label className="block min-w-0">
                          <span className="lg:hidden block text-[11px] font-medium text-slate-600 mb-1">Jumlah</span>
                          <span className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-emerald-600">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={isCountableUnit(line.unit) ? 1 : 0}
                              step={isCountableUnit(line.unit) ? 1 : 'any'}
                              value={line.quantity || ''}
                              onChange={e => handleLineQtyChange(idx, e.target.value)}
                              aria-label={`Jumlah baris ${idx + 1}`}
                              className="w-full min-w-0 min-h-[44px] lg:min-h-[34px] bg-transparent rounded-lg px-2 text-xs font-mono font-semibold tabular-nums text-slate-900 text-right focus:outline-none"
                              required
                            />
                            <span className="shrink-0 pr-2 text-[11px] font-medium text-slate-600">{line.unit || 'satuan'}</span>
                          </span>
                        </label>

                        <label className="block min-w-0">
                          <span className="lg:hidden block text-[11px] font-medium text-slate-600 mb-1">Harga satuan (nota)</span>
                          <span className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:ring-2 focus-within:ring-emerald-600">
                            <span className="shrink-0 pl-2 text-xs font-semibold text-slate-600">Rp</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`Harga satuan baris ${idx + 1}`}
                              value={line.unitPrice ? line.unitPrice.toLocaleString('id-ID') : ''}
                              onChange={e => handleLinePriceChange(idx, e.target.value)}
                              placeholder="0"
                              className="w-full min-w-0 min-h-[44px] lg:min-h-[34px] bg-transparent rounded-lg px-2 text-xs font-mono tabular-nums text-slate-900 text-right focus:outline-none"
                            />
                          </span>
                        </label>

                        <div className="col-span-2 lg:col-span-1 flex items-center justify-between lg:block lg:pt-2.5 lg:text-right">
                          <span className="lg:hidden text-[11px] font-medium text-slate-600">Subtotal</span>
                          <span className="text-xs font-mono tabular-nums font-semibold text-slate-900">Rp {subtotal.toLocaleString('id-ID')}</span>
                        </div>

                        <div className="col-span-2 lg:col-span-1 min-w-0 space-y-2">
                          <label className="block">
                            <span className="lg:hidden block text-[11px] font-medium text-slate-600 mb-1">Kondisi & catatan</span>
                            <input
                              type="text"
                              placeholder="Contoh: kemasan utuh, segel rapat"
                              value={line.conditionNote || ''}
                              onChange={e => handleLineNoteChange(idx, e.target.value)}
                              aria-label={`Kondisi baris ${idx + 1}`}
                              className="w-full min-h-[44px] lg:min-h-[34px] text-xs rounded-lg border border-slate-300 px-2 text-slate-800 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            />
                          </label>
                          {isMedicine && (
                            <label className="block">
                              <span className="block text-[11px] font-medium text-slate-600 mb-1">Kedaluwarsa (lihat kemasan)</span>
                              <input
                                type="date"
                                value={line.expiryDate || ''}
                                min={formDate}
                                onChange={e => handleLineExpiryChange(idx, e.target.value)}
                                className="w-full min-h-[44px] lg:min-h-[34px] text-xs rounded-lg border border-slate-300 px-2 font-mono text-slate-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                              />
                            </label>
                          )}
                        </div>

                        <div className="hidden lg:flex justify-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={lines.length === 1}
                            aria-label={`Hapus baris ${idx + 1}`}
                            title="Hapus baris"
                            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex items-center justify-between lg:justify-end gap-4 px-3 py-3 bg-slate-50 border-t border-slate-200">
                  <span className="text-xs font-semibold text-slate-700">Total nota</span>
                  <span className="text-sm font-mono tabular-nums font-bold text-slate-900">
                    Rp {lines.reduce((sum, l) => sum + l.quantity * (l.unitPrice || 0), 0).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* Photo Documentation Section */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60">
              <PhotoUploadCompressor
                photos={formPhotos}
                onChange={setFormPhotos}
                maxPhotos={6}
                folder="receiving"
                label="Foto Kedatangan"
                description="Foto nota atau struk, kemasan, dan tanggal kedaluwarsa obat. Ukuran foto otomatis dikecilkan sebelum diunggah."
              />
            </div>

            {/* Signature Section */}
            <div>
              <h3 className="text-xs font-semibold text-slate-800">Tanda tangan</h3>
              <p className="text-[11px] text-slate-600 mt-0.5 mb-2">Boleh dilewati bila belanja di toko tanpa pengantar barang.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SignaturePad
                  label="Pengirim / supplier"
                  signatoryName={
                    selectedSupplierObj
                      ? selectedSupplierObj.contactPerson
                        ? `${selectedSupplierObj.contactPerson} (${selectedSupplierObj.name})`
                        : selectedSupplierObj.name
                      : formSupplierId.trim() || 'Pemasok'
                  }
                  initialValue={formSupplierSign}
                  onSave={val => setFormSupplierSign(val)}
                />
                <SignaturePad
                  label="Penerima / PIC gudang"
                  signatoryName={`${currentUser.name} (${currentUser.role})`}
                  initialValue={formReceiverSign}
                  onSave={val => setFormReceiverSign(val)}
                />
              </div>
            </div>
          </div>

          {/* Footer controls */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 px-4 sm:px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={() => setIsCreatingDeliveryOrder(false)}
              className="min-h-[44px] sm:min-h-[36px] px-4 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] sm:min-h-[36px] px-5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              Simpan dan tambah ke stok
            </button>
          </div>
        </form>
      ) : (
        /* ========================================================================= */
        /* MAIN LIST VIEW WITH STANDARD FILTER BAR */
        /* ========================================================================= */
        <div className="space-y-4">
          {/* Filter Control Box: Period (Minggu, Bulan, Hari) & Categories */}
          <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
            {/* Row 1: Period Mode Selector & Date Controls */}
            <div className="px-4 py-3 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="hidden sm:flex text-xs font-medium text-slate-600 items-center gap-1.5 shrink-0">
                  <CalendarRange className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Periode</span>
                </span>

                {/* Period Segmented Control */}
                <div className="inline-flex bg-slate-100/80 p-0.5 rounded-lg border border-slate-200/50 text-xs">
                  <button
                    type="button"
                    onClick={() => setPeriodType('DAILY')}
                    className={`h-7 px-2.5 rounded-md text-xs transition-all cursor-pointer ${
                      periodType === 'DAILY' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    Harian
                  </button>

                  <button
                    type="button"
                    onClick={handleSetThisWeek}
                    className={`h-7 px-2.5 rounded-md text-xs transition-all cursor-pointer ${
                      periodType === 'WEEKLY' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    Mingguan
                  </button>

                  <button
                    type="button"
                    onClick={() => setPeriodType('MONTHLY')}
                    className={`h-7 px-2.5 rounded-md text-xs transition-all cursor-pointer ${
                      periodType === 'MONTHLY' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    Bulanan
                  </button>

                  <button
                    type="button"
                    onClick={() => setPeriodType('CUSTOM')}
                    className={`h-7 px-2.5 rounded-md text-xs transition-all cursor-pointer ${
                      periodType === 'CUSTOM' ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    Kustom
                  </button>
                </div>
              </div>

              {/* Date Range Inputs */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {periodType === 'DAILY' && (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-8">
                    <span className="text-slate-500 text-[11px]">Tanggal:</span>
                    <input
                      type="date"
                      value={selectedDailyDate}
                      onChange={e => setSelectedDailyDate(e.target.value)}
                      className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>
                )}

                {(periodType === 'WEEKLY' || periodType === 'CUSTOM') && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-8">
                      <span className="text-slate-500 text-[11px]">Dari</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                      />
                      <span className="text-slate-500">s/d</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                      />
                    </div>

                    {periodType === 'WEEKLY' && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={handleSetThisWeek}
                          className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                        >
                          Minggu Ini
                        </button>
                        <button
                          type="button"
                          onClick={handleSetLastWeek}
                          className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                        >
                          Minggu Lalu
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {periodType === 'MONTHLY' && (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 h-8">
                    <span className="text-slate-500 text-[11px]">Bulan:</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={e => setSelectedMonth(e.target.value)}
                      className="text-xs font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Unified Category Tabs, Supplier Select, Search, & View Toggle */}
            <div className="p-3.5 bg-slate-50/50 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
              {/* Filter kategori (sama dengan Master Barang) + sub-kategori */}
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-1">
                  {[
                    { id: 'ALL', label: 'Semua kategori', count: sourceRecords.length },
                    ...STANDARD_CATEGORIES.map(cat => ({ id: cat, label: cat, count: categoryCounts[cat] || 0 })),
                  ]
                    .filter(tab => tab.id === 'ALL' || tab.count > 0 || tab.id === selectedCategoryTab)
                    .map(tab => {
                      const isActive = selectedCategoryTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => {
                            setSelectedCategoryTab(tab.id as 'ALL' | StandardCategory);
                            setSelectedSubcategory('ALL');
                          }}
                          className={`h-8 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
                            isActive
                              ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/70'
                          }`}
                        >
                          <span>{tab.label}</span>
                          {tab.count > 0 && (
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                                isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {tab.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>

                {subcategoryCounts.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Sub-kategori ${selectedCategoryTab}`}>
                    <span className="text-[11px] text-slate-500 mr-1">Sub-kategori:</span>
                    {[{ label: 'ALL', count: 0 }, ...subcategoryCounts].map(sub => {
                      const isActive = selectedSubcategory === sub.label;
                      return (
                        <button
                          key={sub.label}
                          type="button"
                          aria-pressed={isActive}
                          onClick={() => setSelectedSubcategory(sub.label)}
                          className={`h-7 px-2.5 rounded-md text-[11px] font-medium cursor-pointer flex items-center gap-1 border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
                            isActive
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                          }`}
                        >
                          <span>{sub.label === 'ALL' ? 'Semua' : sub.label}</span>
                          {sub.label !== 'ALL' && <span className="font-mono text-[10px] text-slate-500">{sub.count}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Side: View Mode Toggle, Supplier Select, & Search Box */}
              <div className="flex flex-wrap items-center gap-2">
                {/* View Mode Toggle: Tabel vs Per Supplier */}
                <div role="group" aria-label="Tampilan" className="inline-flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs shrink-0">
                  {([
                    { mode: 'TABLE', label: 'Tabel', icon: TableProperties, title: 'Tampilan tabel biasa' },
                    { mode: 'SUPPLIER_GROUPS', label: 'Per supplier', icon: LayoutGrid, title: 'Kelompokkan barang per supplier lalu per tanggal' },
                  ] as const).map(({ mode, label, icon: Icon, title }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      aria-pressed={viewMode === mode}
                      title={title}
                      className={`min-h-[44px] sm:min-h-[28px] px-2.5 rounded-md flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                        viewMode === mode ? 'bg-white text-slate-900 font-semibold shadow-2xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>

                {/* Sumber catatan: surat jalan/PO yang menambah stok vs belanja yang dicatat langsung */}
                <Select
                  size="sm"
                  className="w-full sm:w-44"
                  aria-label="Filter sumber catatan"
                  value={sourceFilter}
                  onChange={e => setSourceFilter(e.target.value as 'ALL' | UnifiedRecord['source'])}
                >
                  <option value="ALL">Semua sumber</option>
                  <option value="DELIVERY_ORDER">Masuk stok (surat jalan)</option>
                  <option value="EXPENSE_INPUT">Belanja langsung</option>
                </Select>

                {/* Supplier Filter Dropdown */}
                <div className="w-full sm:w-52">
                  <SearchPicker
                    value={selectedSupplierFilter}
                    options={[
                      { value: 'ALL', label: `Semua supplier${uniqueSuppliers.length > 0 ? ` (${uniqueSuppliers.length})` : ''}` },
                      ...uniqueSuppliers.map(s => ({ value: s.name, label: s.name, hint: `${s.count} catatan` })),
                    ]}
                    onSelect={opt => opt && setSelectedSupplierFilter(opt.value)}
                    searchPlaceholder="Cari supplier..."
                    ariaLabel="Filter supplier"
                    noun="supplier"
                    size="sm"
                  />
                </div>

                {/* Search Box */}
                <div className="relative w-full sm:w-52">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari barang, supplier, PIC"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-7 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 placeholder:text-slate-500 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-600 transition-colors shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      title="Hapus pencarian"
                      aria-label="Hapus pencarian"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* VIEW: Kelompokkan Per Supplier & Per Tanggal */}
          {viewMode === 'SUPPLIER_GROUPS' ? (
            supplierGroups.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 py-12 px-4 text-center">
                <h4 className="text-xs font-semibold text-slate-800">
                  {searchQuery || selectedCategoryTab !== 'ALL' || sourceFilter !== 'ALL' || selectedSupplierFilter !== 'ALL'
                    ? 'Tidak ada catatan yang cocok dengan filter.'
                    : 'Belum ada barang masuk di periode ini.'}
                </h4>
                <p className="text-[11px] text-slate-600 mt-1">Ubah periode atau filter, atau terima barang baru.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {supplierGroups.map(supplier => {
                    const supplierKey = supplier.name.toLowerCase().trim();

                    return (
                      <section key={supplier.name} aria-label={`Supplier ${supplier.name}`} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="text-sm font-semibold text-slate-900">{supplier.name}</h3>
                          <p className="text-xs text-slate-600">
                            {supplier.count} barang · {supplier.dates.length} tanggal ·{' '}
                            <span className="font-mono font-semibold text-slate-900 tabular-nums">Rp {supplier.total.toLocaleString('id-ID')}</span>
                          </p>
                        </div>

                        <div className="divide-y divide-slate-200">
                          {supplier.dates.map(([dateKey, dateRecords]) => {
                            const dateSubtotal = dateRecords.reduce((sum, r) => sum + r.nominal, 0);

                            // Nota untuk barang di tanggal ini: yang tertaut ke barisnya, ditambah nota lain atas nama
                            // supplier yang sama di tanggal itu. PO yang barangnya belum datang bukan nota, jadi tidak ikut.
                            const dateMatchingNotas: PurchaseOrderNota[] = [];
                            const seenPoIds = new Set<string>();
                            dateRecords.forEach(r => {
                              const nota = getMatchingNotaForRecord(r);
                              if (nota && !seenPoIds.has(nota.id)) {
                                seenPoIds.add(nota.id);
                                dateMatchingNotas.push(nota);
                              }
                            });
                            purchaseOrders.forEach(po => {
                              if (seenPoIds.has(po.id) || isAwaitingDelivery(po)) return;
                              const isDateMatch = (po.date || '').slice(0, 10) === dateKey || (po.deliveryDate || '').slice(0, 10) === dateKey;
                              if (isDateMatch && (po.supplierName || '').toLowerCase().trim() === supplierKey) {
                                seenPoIds.add(po.id);
                                dateMatchingNotas.push(po);
                              }
                            });

                            const unassignedRecords = dateRecords.filter(r => !getMatchingNotaForRecord(r));

                            return (
                              <div key={dateKey}>
                                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                  <p className="text-xs text-slate-600">
                                    <span className="font-semibold text-slate-900">
                                      {dateKey === 'Tanpa tanggal' ? dateKey : formatIndonesianDateWithDay(dateKey)}
                                    </span>
                                    {' · '}
                                    {dateRecords.length} barang ·{' '}
                                    <span className="font-mono text-slate-900 tabular-nums">Rp {dateSubtotal.toLocaleString('id-ID')}</span>
                                  </p>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {dateMatchingNotas.map(nota => {
                                      const inPool = poolNotaIds.includes(nota.id) || poolNotaIds.includes(nota.poNumber);
                                      return (
                                        <div key={nota.id} role="group" aria-label={`Nota ${nota.poNumber}`} className="flex flex-wrap items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleOpenExistingNota(nota)}
                                            className={BTN_SECONDARY}
                                            title={`Lihat dan cetak nota ${nota.poNumber}`}
                                          >
                                            <Receipt className="w-3.5 h-3.5 text-slate-500" />
                                            Lihat nota{dateMatchingNotas.length > 1 ? ` ${nota.poNumber}` : ''}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleTogglePool(nota.id)}
                                            aria-pressed={inPool}
                                            className={`inline-flex whitespace-nowrap items-center justify-center gap-1.5 px-3 min-h-[44px] sm:min-h-[32px] rounded-lg border text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
                                              inPool
                                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                                            }`}
                                            title={inPool ? 'Keluarkan dari antrean cetak' : 'Masukkan ke antrean cetak (2 nota per lembar A4)'}
                                          >
                                            <Layers className="w-3.5 h-3.5" />
                                            {inPool ? 'Di antrean cetak' : 'Antrean cetak'}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteNota(nota)}
                                            aria-label={`Hapus nota ${nota.poNumber}`}
                                            title={`Hapus nota ${nota.poNumber}`}
                                            className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] rounded-lg text-rose-700 hover:bg-rose-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      );
                                    })}

                                    {dateMatchingNotas.length === 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => handleCreateCombinedNotaForSupplier(supplier.name, dateRecords, dateKey)}
                                        className={BTN_PRIMARY}
                                        title="Buat nota gabungan untuk barang pada tanggal ini. Nota bisa diedit sebelum dicetak."
                                      >
                                        <FilePlus className="w-3.5 h-3.5" />
                                        Buat nota
                                      </button>
                                    ) : unassignedRecords.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => handleCreateCombinedNotaForSupplier(supplier.name, unassignedRecords, dateKey)}
                                        className={BTN_PRIMARY}
                                        title="Buat nota untuk barang yang belum masuk nota pada tanggal ini"
                                      >
                                        <FilePlus className="w-3.5 h-3.5" />
                                        Buat nota ({unassignedRecords.length} belum ada nota)
                                      </button>
                                    ) : null}
                                  </div>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs">
                                    <thead className="text-slate-700 font-semibold border-b border-slate-200">
                                      <tr>
                                        <th className="py-2 px-4 w-20">Jam</th>
                                        <th className="py-2 px-3 min-w-[200px]">Barang</th>
                                        <th className="py-2 px-3 w-28 text-right">Jumlah</th>
                                        <th className="py-2 px-3 w-32 text-right">Nilai</th>
                                        <th className="py-2 px-3 w-32">Petugas</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {dateRecords.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50 align-top">
                                          <td className="py-2.5 px-4 text-slate-600 font-mono tabular-nums whitespace-nowrap">{r.time || '-'}</td>
                                          <td className="py-2.5 px-3">
                                            <div className="font-semibold text-slate-900">{r.itemName}</div>
                                            <div className="text-[11px] text-slate-600">
                                              {r.source === 'DELIVERY_ORDER' ? 'Masuk stok' : 'Belanja'} · {r.displayCategory || r.category}
                                            </div>
                                            {r.notes && <div className="text-[11px] text-slate-600 line-clamp-1">{r.notes}</div>}
                                          </td>
                                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                                            {formatRecordQty(r.quantity)} {r.unit}
                                          </td>
                                          <td className="py-2.5 px-3 text-right">
                                            {/* Penerimaan lama tanpa belanja tertaut tidak punya harga. */}
                                            {r.nominal <= 0 ? (
                                              <span className="text-slate-600" title="Harga belum tercatat">-</span>
                                            ) : (
                                              <>
                                                <div className="font-mono font-semibold text-slate-900">Rp {r.nominal.toLocaleString('id-ID')}</div>
                                                {r.unitPrice > 0 && (
                                                  <div className="text-[11px] text-slate-600 font-mono">@ Rp {r.unitPrice.toLocaleString('id-ID')}</div>
                                                )}
                                              </>
                                            )}
                                          </td>
                                          <td className="py-2.5 px-3 text-slate-700">
                                            <div className="truncate max-w-[120px]">{r.picOrUser}</div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
              </div>
            )
          ) : (
            /* VIEW: Riwayat (tabel di layar lebar, kartu di HP) */
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden relative">
              {filteredRecords.length === 0 ? (
                <div className="py-12 px-4 text-center max-w-sm mx-auto">
                  <h4 className="text-xs font-semibold text-slate-800">
                    {searchQuery || selectedCategoryTab !== 'ALL' || sourceFilter !== 'ALL' || selectedSupplierFilter !== 'ALL'
                      ? 'Tidak ada catatan yang cocok dengan filter.'
                      : 'Belum ada barang masuk di periode ini.'}
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Ubah periode atau filter, atau terima barang baru.
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {can('RECEIVE_GOODS') && (
                      <button
                        type="button"
                        onClick={handleOpenDeliveryOrder}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer min-h-[44px] sm:min-h-[36px]"
                      >
                        Terima Barang
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Layar lebar: tabel */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-3 px-3 w-12 text-center">
                            <input
                              type="checkbox"
                              checked={allFilteredSelected}
                              disabled={selectableRecords.length === 0}
                              title={selectableRecords.length === 0 ? 'Semua baris sudah punya nota' : 'Pilih untuk dibuatkan nota gabungan'}
                              ref={el => {
                                if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected;
                              }}
                              onChange={handleToggleSelectAll}
                              aria-label="Pilih semua baris"
                              className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer w-3.5 h-3.5"
                            />
                          </th>
                          <th className="py-3 px-3 w-28">Tanggal</th>
                          <th className="py-3 px-3 w-32">Jenis</th>
                          <th className="py-3 px-3 min-w-[200px]">Barang</th>
                          <th className="py-3 px-3 w-28 text-right">Jumlah</th>
                          <th className="py-3 px-3 w-32 text-right">Nilai</th>
                          <th className="py-3 px-3 min-w-[140px]">Supplier / Toko</th>
                          <th className="py-3 px-3 w-32">Petugas</th>
                          <th className="py-3 px-2 w-28 text-center">Nota</th>
                          <th className="py-3 px-2 text-center w-16"><span className="sr-only">Aksi</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRecords.map(r => {
                          const isStock = r.source === 'DELIVERY_ORDER';
                          const matchingNota = getMatchingNotaForRecord(r);
                          return (
                            <tr key={r.id} className={`hover:bg-slate-50 ${selectedRecordIds.includes(r.id) ? 'bg-emerald-50/50' : ''}`}>
                              <td className="py-3 px-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={selectedRecordIds.includes(r.id)}
                                  onChange={() => handleToggleSelectRecord(r.id)}
                                  disabled={!!matchingNota}
                                  title={matchingNota ? `Sudah ada nota ${matchingNota.poNumber}` : 'Pilih untuk dibuatkan nota gabungan'}
                                  aria-label={`Pilih ${r.itemName}`}
                                  className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer w-3.5 h-3.5 disabled:opacity-30 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{r.date}</div>
                                <div className="text-[11px] text-slate-600">{r.time} WIB</div>
                              </td>
                              <td className="py-3 px-3">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                    isStock ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {isStock ? 'Masuk stok' : 'Belanja'}
                                </span>
                                <div className="text-[11px] text-slate-600 mt-1">{r.displayCategory || r.category}</div>
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-semibold text-slate-900">{r.itemName}</div>
                                {r.notes && <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">{r.notes}</div>}
                                {r.volunteer && (
                                  <div className="text-[11px] text-slate-600">Dibelanjakan oleh {r.volunteer}</div>
                                )}
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                                {formatRecordQty(r.quantity)} {r.unit}
                              </td>
                              <td className="py-3 px-3 text-right">
                                {/* Penerimaan lama tanpa belanja tertaut tidak punya harga. */}
                                {r.nominal <= 0 ? (
                                  <span className="text-slate-600" title="Harga belum tercatat">-</span>
                                ) : (
                                  <>
                                    <div className="font-mono font-semibold text-slate-900">Rp {r.nominal.toLocaleString('id-ID')}</div>
                                    {r.unitPrice > 0 && (
                                      <div className="text-[11px] text-slate-600 font-mono">@ Rp {r.unitPrice.toLocaleString('id-ID')}</div>
                                    )}
                                  </>
                                )}
                              </td>
                              <td className="py-3 px-3 text-slate-700">
                                <div className="font-medium truncate max-w-[160px]">
                                  {r.supplierOrStore !== '-' ? r.supplierOrStore : <span className="text-slate-500">Tidak diisi</span>}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-slate-700">
                                <div className="truncate max-w-[120px]">{r.picOrUser}</div>
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                {matchingNota ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenExistingNota(matchingNota)}
                                    className="px-2 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                                    title={`Nota ${matchingNota.poNumber}`}
                                  >
                                    Lihat nota
                                  </button>
                                ) : (
                                  <span className="text-[11px] text-slate-600">Belum ada</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="flex items-center justify-center gap-1">
                                  {isStock && r.rawDoc ? (
                                    <button
                                      type="button"
                                      onClick={() => r.rawDoc && setSelectedDocForDetail(r.rawDoc)}
                                      className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer"
                                    >
                                      Detail
                                    </button>
                                  ) : null}
                                  {canDeleteRecords && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRecord(r)}
                                      aria-label={`Hapus ${r.itemName}`}
                                      title="Hapus catatan ini"
                                      className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* HP: kartu */}
                  <ul className="md:hidden divide-y divide-slate-100">
                    {filteredRecords.map(r => {
                      const isStock = r.source === 'DELIVERY_ORDER';
                      const matchingNota = getMatchingNotaForRecord(r);
                      const isSelected = selectedRecordIds.includes(r.id);
                      return (
                        <li key={r.id} className={`p-4 ${isSelected ? 'bg-emerald-50/50' : ''}`}>
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectRecord(r.id)}
                              disabled={!!matchingNota}
                              aria-label={`Pilih ${r.itemName}`}
                              className="mt-0.5 disabled:opacity-30 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4 shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-sm font-semibold text-slate-900 leading-snug">{r.itemName}</h4>
                                <span className="font-mono text-xs font-semibold text-slate-900 shrink-0">
                                  {formatRecordQty(r.quantity)} {r.unit}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                                <span
                                  className={`px-1.5 py-0.5 rounded-md font-semibold ${
                                    isStock ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {isStock ? 'Masuk stok' : 'Belanja'}
                                </span>
                                <span>{r.date} · {r.time} WIB</span>
                              </div>
                              <p className="mt-1 text-[11px] text-slate-600 truncate">
                                {r.supplierOrStore !== '-' ? r.supplierOrStore : 'Supplier tidak diisi'} · {r.picOrUser}
                              </p>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <span className="font-mono text-xs font-semibold text-slate-900">
                                  {r.nominal > 0 ? `Rp ${r.nominal.toLocaleString('id-ID')}` : ''}
                                </span>
                                <div className="flex items-center gap-1">
                                  {matchingNota && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenExistingNota(matchingNota)}
                                      className="px-2.5 rounded-lg text-[11px] font-semibold text-emerald-800 bg-emerald-50 cursor-pointer min-h-[44px]"
                                    >
                                      Lihat nota
                                    </button>
                                  )}
                                  {isStock && r.rawDoc && (
                                    <button
                                      type="button"
                                      onClick={() => r.rawDoc && setSelectedDocForDetail(r.rawDoc)}
                                      className="px-2.5 rounded-lg text-[11px] font-semibold text-slate-700 border border-slate-300 cursor-pointer min-h-[44px]"
                                    >
                                      Detail
                                    </button>
                                  )}
                                  {canDeleteRecords && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteRecord(r)}
                                      aria-label={`Hapus ${r.itemName}`}
                                      className="w-11 min-h-[44px] rounded-lg flex items-center justify-center text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Ruang kosong agar bar mengambang tidak menutupi baris terakhir */}
          {selectedRecordIds.length > 0 && viewMode === 'TABLE' && <div className="h-20" aria-hidden="true" />}

          {/* Floating Action Bar for Selected Rows */}
          {selectedRecordIds.length > 0 && viewMode === 'TABLE' && (
            <div
              role="region"
              aria-label="Barang dipilih"
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] sm:w-auto bg-slate-900 text-white pl-4 pr-2 py-2 rounded-xl shadow-lg flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
            >
              <div className="flex items-center gap-2 text-xs">
                <CheckSquare className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold">{selectedRecordIds.length} barang dipilih</span>
                {selectedTotal > 0 ? (
                  <span className="text-emerald-300 font-mono font-semibold">· Rp {selectedTotal.toLocaleString('id-ID')}</span>
                ) : (
                  <span className="text-slate-300">· harga belum tercatat</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCreateNotaFromSelected}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-all cursor-pointer "
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Buat Nota Gabungan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRecordIds([])}
                  className="text-slate-300 hover:text-white hover:bg-slate-800 text-xs px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
    )}

      {/* ========================================================================= */}
      {/* MODAL: POST-INPUT NOTA PESANAN PROMPT (CTA TAMBAHAN)                     */}
      {/* ========================================================================= */}
      {quickItem && (
        <FormDialog
          title="Daftarkan barang baru"
          description="Barang masuk ke Master Barang lalu langsung dipakai di form ini. Stok awal 0; stok bertambah saat penerimaan disimpan."
          onClose={() => setQuickItem(null)}
          onSubmit={handleSaveQuickItem}
          submitLabel="Daftarkan"
          error={quickItemError}
        >
          <div className="space-y-3">
            <div>
              <label htmlFor="qi-name" className={FIELD_LABEL}>Nama barang</label>
              <input
                id="qi-name"
                autoFocus
                value={quickItem.name}
                onChange={e => handleQuickItemNameChange(e.target.value)}
                placeholder="Contoh: Sarung Tangan Plastik, Paracetamol 500 mg"
                className={FIELD_INPUT}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="qi-cat" className={FIELD_LABEL}>Kategori</label>
                <Select
                  id="qi-cat"
                  className="w-full"
                  value={quickItem.category}
                  onChange={e => setQuickItem(q => (q ? { ...q, category: e.target.value as InputCategoryType, categoryTouched: true } : q))}
                >
                  {INPUT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
                {!quickItem.categoryTouched && quickItem.name.trim().length >= 3 && (
                  <p className="text-[11px] text-slate-600 mt-1">Ditebak dari nama. Ganti bila kurang tepat.</p>
                )}
              </div>
              <div>
                <label htmlFor="qi-unit" className={FIELD_LABEL}>Satuan</label>
                <input
                  id="qi-unit"
                  value={quickItem.unit}
                  onChange={e => setQuickItem(q => (q ? { ...q, unit: e.target.value } : q))}
                  placeholder="Kg, Pcs, Pack, Roll..."
                  className={FIELD_INPUT}
                />
              </div>
            </div>
          </div>
        </FormDialog>
      )}

      {justSavedPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow-lg border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="p-5 sm:p-6">
              <h3 className="text-base font-bold text-slate-900">{justSavedPrompt.title}</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{justSavedPrompt.subtitle}</p>

              <dl className="mt-4 rounded-lg border border-slate-200 divide-y divide-slate-200 text-xs">
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-slate-600">Toko / supplier</dt>
                  <dd className="font-semibold text-slate-900 truncate">{justSavedPrompt.supplierName}</dd>
                </div>
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-slate-600">Jumlah barang</dt>
                  <dd className="font-mono tabular-nums text-slate-900">{justSavedPrompt.items.length}</dd>
                </div>
                <div className="flex justify-between gap-3 px-3 py-2">
                  <dt className="text-slate-600">Total belanja</dt>
                  <dd className="font-mono tabular-nums font-bold text-slate-900">
                    Rp {justSavedPrompt.items.reduce((s, it) => s + (it.subtotal || it.quantity * it.unitPrice), 0).toLocaleString('id-ID')}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 text-xs text-slate-700">Cetak nota pesanan sekarang untuk arsip dan tanda tangan?</p>

              <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setJustSavedPrompt(null)}
                  className="min-h-[44px] sm:min-h-[36px] px-4 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  Nanti saja
                </button>
                <button
                  type="button"
                  onClick={handleStartNotaFromPrompt}
                  className="min-h-[44px] sm:min-h-[36px] px-4 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                >
                  Cetak nota
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SMART SUPPLIER NOTA PO COMBINE PROMPT                              */}
      {/* ========================================================================= */}
      {supplierNotaPrompt && (() => {
        const allSupplierRecords = [supplierNotaPrompt.clickedRecord, ...supplierNotaPrompt.siblingRecords];
        const combinedTotal = allSupplierRecords.reduce((sum, r) => sum + r.nominal, 0);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Cetak Nota PO - {supplierNotaPrompt.supplierName} ({supplierNotaPrompt.clickedRecord.date})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Terdeteksi beberapa barang dari supplier yang sama pada tanggal {supplierNotaPrompt.clickedRecord.date}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSupplierNotaPrompt(null)}
                  className="text-slate-500 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/80 text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">
                      Terdapat {allSupplierRecords.length} macam barang dari {supplierNotaPrompt.supplierName} (Tanggal {supplierNotaPrompt.clickedRecord.date})
                    </div>
                    <div className="text-[11px] text-emerald-800 mt-0.5">
                      Anda dapat menggabungkan semuanya ke dalam 1 lembar Nota Pesanan (PO) resmi untuk tanggal ini atau membuat nota khusus untuk item yang diklik saja.
                    </div>
                  </div>
                </div>

                {/* Items List in this Supplier */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 font-semibold text-slate-700 text-[11px] flex justify-between items-center">
                    <span>Daftar Barang ({allSupplierRecords.length} Macam)</span>
                    <span className="font-mono text-slate-900">Total: Rp {combinedTotal.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto font-medium">
                    {allSupplierRecords.map((item, idx) => (
                      <div key={item.id} className="px-3 py-2 flex items-center justify-between text-xs hover:bg-slate-50">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono text-[10px] w-4">{idx + 1}.</span>
                          <div>
                            <span className="font-semibold text-slate-900">{item.itemName}</span>
                            <span className="text-[10px] text-slate-500 ml-1.5 font-normal">
                              ({item.quantity} {item.unit})
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-slate-800">
                            Rp {item.nominal.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Big Choice Options */}
                <div className="space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => handleCreateCombinedNotaForSupplier(supplierNotaPrompt.supplierName, allSupplierRecords, supplierNotaPrompt.clickedRecord.date)}
                    className="w-full p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-left transition-all shadow-md shadow-emerald-600/20 cursor-pointer group flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/50 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <Receipt className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <span>Gabungkan Semua ({allSupplierRecords.length} Barang) ke 1 Nota PO</span>
                        <span className="text-[10px] bg-white text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                          Rekomendasi
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-100 mt-0.5 leading-snug">
                        Satu nomor PO resmi memuat semua {allSupplierRecords.length} macam barang dari {supplierNotaPrompt.supplierName} tanggal {supplierNotaPrompt.clickedRecord.date} dengan total Rp {combinedTotal.toLocaleString('id-ID')}.
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCreateSingleItemNota(supplierNotaPrompt.clickedRecord)}
                    className="w-full p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-all cursor-pointer group flex items-start gap-3"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                      <FilePlus className="w-4 h-4 text-slate-500" />
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-800">
                        Hanya Buat untuk "{supplierNotaPrompt.clickedRecord.itemName}" Saja
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Cetak nota PO terpisah khusus 1 barang ini (Rp {supplierNotaPrompt.clickedRecord.nominal.toLocaleString('id-ID')}).
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSupplierNotaPrompt(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL: NOTA PESANAN & PO SUPPLIER OFFICIAL BER-KOP SURAT                  */}
      {/* ========================================================================= */}
      {isNotaModalOpen && activeNota && (
        <NotaPesananModal
          isOpen={isNotaModalOpen}
          onClose={() => setIsNotaModalOpen(false)}
          nota={activeNota}
          onSaveNota={handleSaveNotaFromModal}
          onDeleteNota={handleDeleteNota}
          suppliers={suppliers}
          currentUser={currentUser}
          onSupplierAdded={() => refreshAll()}
          isInPool={poolNotaIds.includes(activeNota.id) || poolNotaIds.includes(activeNota.poNumber)}
          onTogglePool={(id) => handleTogglePool(id)}
          onOpenBatchPool={() => {
            setIsNotaModalOpen(false);
            setIsBatchPrintModalOpen(true);
          }}
          poolCount={poolNotaIds.length}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: BATCH PRINT POOL (CETAK GABUNGAN 2 NOTA PER LEMBAR A4)              */}
      {/* ========================================================================= */}
      <BatchPrintNotaModal
        isOpen={isBatchPrintModalOpen}
        onClose={() => setIsBatchPrintModalOpen(false)}
        poolNotaIds={poolNotaIds}
        allNotas={purchaseOrders}
        onRemoveFromPool={handleRemoveFromPool}
        onClearPool={handleClearPool}
        onAddToPool={handleAddToPool}
        onOpenSingleNota={(nota) => {
          setIsBatchPrintModalOpen(false);
          handleOpenExistingNota(nota);
        }}
      />

      {/* ========================================================================= */}
      {/* MODAL: PENERIMAAN & PENIMBANGAN FISIK BAHAN PO (1-FLOW SUPPLY CHAIN)     */}
      {/* ========================================================================= */}
      {isWeighModalOpen && selectedPoForWeighing && (
        <PoReceivingWeighingModal
          isOpen={isWeighModalOpen}
          onClose={() => {
            setIsWeighModalOpen(false);
            setSelectedPoForWeighing(null);
          }}
          po={selectedPoForWeighing}
          onSuccess={() => {
            refreshAll();
          }}
        />
      )}

      {poBeingEdited && (
        <PoEditModal
          po={poBeingEdited}
          onClose={() => setPoBeingEdited(null)}
          onSaved={() => {
            setPoBeingEdited(null);
            refreshAll();
          }}
        />
      )}

      {/* Standard Reusable Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        icon={confirmDialog.icon}
        itemsSummary={confirmDialog.itemsSummary}
        isLoading={actionLoading.isLoading}
      />

      {/* Standard Global Action Loading Overlay */}
      <LoadingOverlay
        isLoading={actionLoading.isLoading}
        message={actionLoading.message}
        submessage={actionLoading.submessage}
      />

    </div>
  );
};
