import React, { useState, useMemo, useEffect } from 'react';
import { ScanButton } from './common/QrScannerDialog';
import { ScanTarget } from '../utils/scanCode';
import { Select } from './common/Select';
import { useConfirm } from '../context/ConfirmContext';
import { KopText } from './common/KopText';
import { useAuth } from '../context/AuthContext';
import { warehouseDb, signerName } from '../db/storage';
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
  Minus,
  FileText,
  Trash2,
  Sparkles,
  Tag,
  Sliders
} from 'lucide-react';
import { exportToExcel } from '../lib/excelExport';
import { BTN_PRIMARY, BTN_SECONDARY } from './common/FormDialog';
import { SppgLogo } from './SppgLogo';
import { useToast } from '../context/ToastContext';
import { localDateIso } from '../utils/localDate';
import { suggestDryLocation } from '../utils/warehouseRacks';

import {
  STANDARD_CATEGORIES,
  StandardCategory,
  normalizeToStandardCategory,
} from '../utils/categoryStandards';
import {
  WarehouseSkuType,
  WAREHOUSE_SKU_DEFINITIONS,
  ALL_STANDARD_LOCATIONS,
  detectWarehouseType,
  generateAutoSku,
  getStorageLocationDetails,
} from '../utils/skuGenerator';

interface InventoryModuleProps {
  onRefreshData?: () => void;
  initialTab?: 'stock' | 'master' | 'opname';
}

export const SPPG_STOCK_CATEGORIES = [
  'Semua Kategori',
  ...STANDARD_CATEGORIES,
] as const;

export type SppgCategory = typeof SPPG_STOCK_CATEGORIES[number];

// Helper to categorize items cleanly using standardized SPPG category logic
export function getDetailedItemCategory(item: { name: string; category?: string; subcategory?: string }): StandardCategory {
  return normalizeToStandardCategory(item.category || item.subcategory, item.name);
}

// Unit price as recorded on the item master. Items without a price contribute no value:
// a guessed price would show up as real money in the stock value and printed recap.
function getItemEstimatedUnitPrice(_name: string, _category: string, explicitPrice?: number): number {
  return explicitPrice && explicitPrice > 0 ? explicitPrice : 0;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ initialTab = 'stock' }) => {
  const { currentUser, can } = useAuth();
  const toast = useToast();
  const askConfirm = useConfirm();

  // Top level active tab: 'stock' (Data Stok Keseluruhan) vs 'master' (Master Barang) vs 'opname' (Stok Opname Fisik)
  const [activeMainTab, setActiveMainTab] = useState<'stock' | 'master' | 'opname'>(initialTab);

  useEffect(() => {
    if (initialTab) setActiveMainTab(initialTab);
  }, [initialTab]);

  // Data states
  const [dataVersion, setDataVersion] = useState(0);
  const items = useMemo(() => warehouseDb.getItems(), [dataVersion]);
  // Deactivated items stay in the master list but are not stock to count, report or reorder
  const activeItems = useMemo(() => items.filter(i => i.isActive !== false), [items]);
  const opnames = useMemo(() => warehouseDb.getOpnames(), [dataVersion]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<SppgCategory>('Semua Kategori');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  // Confirmation Modals State
  const [itemToDelete, setItemToDelete] = useState<ItemMaster | null>(null);
  const [opnameSessionToApprove, setOpnameSessionToApprove] = useState<StockOpnameSession | null>(null);

  // ----------------------------------------------------
  // Master Barang Tab Filter States
  // ----------------------------------------------------
  const [masterSearchQuery, setMasterSearchQuery] = useState('');
  const [masterCategoryFilter, setMasterCategoryFilter] = useState<SppgCategory>('Semua Kategori');
  const [masterStatusFilter, setMasterStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // ----------------------------------------------------
  // Stock Tab Modals
  // ----------------------------------------------------
  const [editingItem, setEditingItem] = useState<ItemMaster | null>(null);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<ItemMaster | null>(null);
  const [adjustQtyDelta, setAdjustQtyDelta] = useState<number>(0);
  const [adjustType, setAdjustType] = useState<'ADD' | 'SUBTRACT' | 'SET'>('ADD');
  const [adjustReason, setAdjustReason] = useState('Koreksi stok fisik');

  // Single Item Form State
  const [formWarehouse, setFormWarehouse] = useState<WarehouseSkuType>('GUDANG_KERING');
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<SppgCategory | 'Kategori Kustom'>('Bahan Kering');
  const [formCustomCategory, setFormCustomCategory] = useState('');
  const [formBaseUnit, setFormBaseUnit] = useState<BaseUnit | 'Satuan Kustom'>('Kg');
  const [formCustomUnit, setFormCustomUnit] = useState('');
  const [formInitialStock, setFormInitialStock] = useState<number>(0);
  const [formMinStock, setFormMinStock] = useState<number>(10);
  const [formLocation, setFormLocation] = useState('Gudang Kering - Rak A1 (Sembako Beras & Karung Pangan)');
  const [formEstimatedPrice, setFormEstimatedPrice] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formError, setFormError] = useState('');

  // ----------------------------------------------------
  // Opname Tab States
  // ----------------------------------------------------
  const [isCreateOpnameModalOpen, setIsCreateOpnameModalOpen] = useState(false);
  const [viewingOpname, setViewingOpname] = useState<StockOpnameSession | null>(null);
  const [opnameCategoryFilter, setOpnameCategoryFilter] = useState<SppgCategory>('Semua Kategori');
  const [opnameFormDate, setOpnameFormDate] = useState(localDateIso());
  const [opnameFormLocation, setOpnameFormLocation] = useState('Gudang SPPG MLG TUMPANG JERU');
  const [opnameFormNotes, setOpnameFormNotes] = useState('');
  const [opnameStatusFilter, setOpnameStatusFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED'>('ALL');
  const [opnameSearchQuery, setOpnameSearchQuery] = useState('');
  const [opnameScanNote, setOpnameScanNote] = useState('');
  const [countingItems, setCountingItems] = useState<
    { itemId: string; name: string; category: SppgCategory; unit: string; systemStock: number; physicalCount: number | null; variance: number; reason: string }[]
  >([]);

  // Reload only this module; the app-level refresh remounts the page and jumps back to the first tab.
  const refreshData = () => {
    setDataVersion(v => v + 1);
  };

  useEffect(() => {
    const handleStorageUpdate = () => {
      setDataVersion(v => v + 1);
    };
    window.addEventListener('sppg_storage_items_changed', handleStorageUpdate);
    return () => {
      window.removeEventListener('sppg_storage_items_changed', handleStorageUpdate);
    };
  }, []);

  // Escape closes the short dialogs. Opname counting is left out on purpose:
  // a stray key press there would throw away a lot of typed data.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setAdjustingItem(null);
      setItemToDelete(null);
      setOpnameSessionToApprove(null);
      setViewingOpname(null);
      setIsPrintPreviewOpen(false);
      setIsSingleModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showToast = (msg: string, title?: string) => {
    toast.success(msg, title || 'Sukses');
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(''), 4500);
  };

  const showError = (msg: string, title?: string) => {
    toast.error(msg, title || 'Peringatan');
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const getItemStockStatus = (item: ItemMaster): StockStatus => {
    if (item.currentStock <= 0) return 'OUT_OF_STOCK';
    if (item.currentStock <= item.minimumStock) return 'LOW';
    return 'NORMAL';
  };

  // Filtered Items for Stock Tab
  const filteredItems = useMemo(() => {
    return activeItems.filter(item => {
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
  }, [activeItems, searchQuery, selectedCategoryTab, filterStatus]);

  // Overall KPI Metrics for Stock Tab
  const stockMetrics = useMemo(() => {
    let totalAssetValue = 0;
    let unpricedCount = 0;
    let normalCount = 0;
    let lowCount = 0;
    let outCount = 0;

    const categoryItemCounts: Record<SppgCategory, number> = {
      'Semua Kategori': activeItems.length,
      'Bahan Basah': 0,
      'Bahan Kering': 0,
      'ATK & Administrasi': 0,
      'Sanitasi, Kemasan & APD': 0,
      'P3K & Obat-obatan': 0,
      'Operasional & Keperluan Lain': 0,
    };

    activeItems.forEach(i => {
      const cat = getDetailedItemCategory(i);
      if (categoryItemCounts[cat] !== undefined) {
        categoryItemCounts[cat]++;
      }
      const price = getItemEstimatedUnitPrice(i.name, cat, i.estimatedPrice);
      if (price > 0) totalAssetValue += Math.max(0, i.currentStock) * price;
      else if (i.currentStock > 0) unpricedCount++;

      const status = getItemStockStatus(i);
      if (status === 'NORMAL') normalCount++;
      else if (status === 'LOW') lowCount++;
      else outCount++;
    });

    return {
      totalItems: activeItems.length,
      totalAssetValue,
      unpricedCount,
      normalCount,
      lowCount,
      outCount,
      categoryItemCounts,
    };
  }, [activeItems]);

  // Filtered Items for Master Barang Tab
  const filteredMasterItems = useMemo(() => {
    const q = masterSearchQuery.trim().toLowerCase();
    return items.filter(item => {
      const cat = getDetailedItemCategory(item);
      const matchesSearch =
        !q ||
        item.id.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        (item.notes && item.notes.toLowerCase().includes(q));

      const matchesCat =
        masterCategoryFilter === 'Semua Kategori' || cat === masterCategoryFilter;

      let matchesStatus = true;
      if (masterStatusFilter === 'ACTIVE') matchesStatus = item.isActive !== false;
      else if (masterStatusFilter === 'INACTIVE') matchesStatus = item.isActive === false;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [items, masterSearchQuery, masterCategoryFilter, masterStatusFilter]);

  // Master KPI Metrics
  const masterMetrics = useMemo(() => {
    const total = items.length;
    const active = items.filter(i => i.isActive !== false).length;
    const basah = items.filter(i => getDetailedItemCategory(i) === 'Bahan Basah').length;
    const kering = items.filter(i => getDetailedItemCategory(i) === 'Bahan Kering').length;
    const nonFood = items.filter(i => {
      const cat = getDetailedItemCategory(i);
      return cat !== 'Bahan Basah' && cat !== 'Bahan Kering';
    }).length;
    return { total, active, basah, kering, nonFood };
  }, [items]);

  // Indonesian print date formatted
  const printDate = useMemo(() => {
    return new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Category breakdown for Stock Recap Report
  const categoryStockSummaries = useMemo(() => {
    const categories: SppgCategory[] = [...STANDARD_CATEGORIES];

    const targetItems = filteredItems;

    const summaryMap: Record<
      string,
      {
        category: SppgCategory;
        items: ItemMaster[];
        totalQty: number;
        totalValue: number;
        normalCount: number;
        lowCount: number;
        outCount: number;
      }
    > = {};

    categories.forEach(cat => {
      summaryMap[cat] = {
        category: cat,
        items: [],
        totalQty: 0,
        totalValue: 0,
        normalCount: 0,
        lowCount: 0,
        outCount: 0,
      };
    });

    targetItems.forEach(item => {
      const cat = getDetailedItemCategory(item);
      if (!summaryMap[cat]) {
        summaryMap[cat] = {
          category: cat,
          items: [],
          totalQty: 0,
          totalValue: 0,
          normalCount: 0,
          lowCount: 0,
          outCount: 0,
        };
      }
      summaryMap[cat].items.push(item);
      const stock = Math.max(0, item.currentStock);
      summaryMap[cat].totalQty += stock;
      const unitPrice = getItemEstimatedUnitPrice(item.name, cat, item.estimatedPrice);
      summaryMap[cat].totalValue += stock * unitPrice;

      const st = getItemStockStatus(item);
      if (st === 'NORMAL') summaryMap[cat].normalCount++;
      else if (st === 'LOW') summaryMap[cat].lowCount++;
      else summaryMap[cat].outCount++;
    });

    return categories.map(cat => summaryMap[cat]);
  }, [filteredItems]);

  const recapGrandTotals = useMemo(() => {
    return categoryStockSummaries.reduce(
      (acc, curr) => {
        acc.totalItems += curr.items.length;
        acc.totalQty += curr.totalQty;
        acc.totalValue += curr.totalValue;
        acc.normalCount += curr.normalCount;
        acc.lowCount += curr.lowCount;
        acc.outCount += curr.outCount;
        return acc;
      },
      { totalItems: 0, totalQty: 0, totalValue: 0, normalCount: 0, lowCount: 0, outCount: 0 }
    );
  }, [categoryStockSummaries]);

  // Printable Stock Sheet matching official SPPG Header standards
  const renderPrintableStockSheet = () => {
    return (
      <div id="print-inventory-rekap" className="bg-white font-sans text-slate-900 w-full">
        {/* Kop Surat Resmi Standar SPPG (Sama persis seperti di ToolsPrintModule & DailyExpensesModule) */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <SppgLogo size="lg" variant="color" showText={false} />
            <KopText />
          </div>

          <div className="text-right text-[11px] text-slate-500 space-y-0.5">
            <div>
              Tanggal Cetak: <span className="font-semibold text-slate-700">{printDate}</span>
            </div>
            <div>
              Operator: <span className="font-semibold text-slate-700">{currentUser.name}</span>
            </div>
          </div>
        </div>

        {/* Judul Dokumen */}
        <div className="text-center my-4">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            LAPORAN REKAPITULASI STOK FISIK & NILAI ASET GUDANG
          </h2>
        </div>

        {/* Bagian A: Rekapitulasi per Kategori Barang */}
        <div className="mb-6">
          <div className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
            <span>A. Rekapitulasi Stok Berdasarkan Kategori Barang</span>
            <span className="text-[11px] font-normal text-slate-500">Ringkasan Fisik, Status & Nilai Aset</span>
          </div>

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                <th className="py-2 px-2.5 border-r border-slate-300 text-center w-8">No</th>
                <th className="py-2 px-3 border-r border-slate-300">Kategori Barang</th>
                <th className="py-2 px-2.5 border-r border-slate-300 text-center w-24">Jumlah Item</th>
                <th className="py-2 px-2.5 border-r border-slate-300 text-center w-24">Ada Stok</th>
                <th className="py-2 px-2 border-r border-slate-300 text-center w-16">Aman</th>
                <th className="py-2 px-2 border-r border-slate-300 text-center w-16">Menipis</th>
                <th className="py-2 px-2 border-r border-slate-300 text-center w-16">Habis</th>
                <th className="py-2 px-3 border-r border-slate-300 text-right w-36">Nilai (harga terisi)</th>
                <th className="py-2 px-2.5 text-right w-16">Porsi (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {categoryStockSummaries.map((catSummary, idx) => {
                const pct =
                  recapGrandTotals.totalValue > 0
                    ? Math.round((catSummary.totalValue / recapGrandTotals.totalValue) * 100)
                    : 0;

                return (
                  <tr key={catSummary.category} className="hover:bg-slate-50">
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-800">
                      {catSummary.category}
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center">
                      {catSummary.items.length} item
                    </td>
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center font-medium">
                      {catSummary.items.length - catSummary.outCount} item
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 text-center font-medium text-emerald-700">
                      {catSummary.normalCount}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 text-center font-medium text-amber-600">
                      {catSummary.lowCount}
                    </td>
                    <td className="py-2 px-2 border-r border-slate-300 text-center font-medium text-rose-600">
                      {catSummary.outCount}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 text-right font-semibold text-slate-900">
                      Rp {catSummary.totalValue.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-2.5 text-right font-medium">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900 text-xs">
                <td colSpan={2} className="py-2.5 px-3 border-r border-slate-300 text-right">
                  TOTAL KESELURUHAN:
                </td>
                <td className="py-2.5 px-2.5 border-r border-slate-300 text-center">
                  {recapGrandTotals.totalItems} item
                </td>
                <td className="py-2.5 px-2.5 border-r border-slate-300 text-center">
                  {recapGrandTotals.totalItems - recapGrandTotals.outCount} item
                </td>
                <td className="py-2.5 px-2 border-r border-slate-300 text-center text-emerald-800">
                  {recapGrandTotals.normalCount}
                </td>
                <td className="py-2.5 px-2 border-r border-slate-300 text-center text-amber-700">
                  {recapGrandTotals.lowCount}
                </td>
                <td className="py-2.5 px-2 border-r border-slate-300 text-center text-rose-700">
                  {recapGrandTotals.outCount}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-right text-emerald-800">
                  Rp {recapGrandTotals.totalValue.toLocaleString('id-ID')}
                </td>
                <td className="py-2.5 px-2.5 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bagian B: Rincian Saldo Stok Fisik per Kategori Barang */}
        <div className="mb-6 space-y-5">
          <div className="font-bold text-xs text-slate-800 pb-1 border-b border-slate-200">
            B. Rincian Saldo Stok Fisik per Kategori Barang
          </div>

          {filteredItems.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs italic border border-dashed border-slate-200 rounded">
              Tidak ada data barang yang sesuai dengan filter saat ini.
            </div>
          ) : (
            categoryStockSummaries
              .filter(cat => cat.items.length > 0)
              .map((catSummary, catIdx) => (
                <div key={catSummary.category} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                    <span className="text-slate-800">
                      {catIdx + 1}. Kategori {catSummary.category} ({catSummary.items.length} item)
                    </span>
                    <span className="text-slate-900 font-mono text-[11px]">
                      Subtotal Nilai: Rp {catSummary.totalValue.toLocaleString('id-ID')}
                    </span>
                  </div>

                  <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300 text-slate-600 font-semibold">
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center w-7">No</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 font-mono w-20">SKU / ID</th>
                        <th className="py-1.5 px-2 border-r border-slate-300">Nama Barang</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 w-32">Lokasi Gudang</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center w-14">Min</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-right w-16">Stok Fisik</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center w-12">Satuan</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-right w-24">Harga Satuan</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-right w-24">Total Nilai</th>
                        <th className="py-1.5 px-2 text-center w-16">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {catSummary.items.map((item, itIdx) => {
                        const status = getItemStockStatus(item);
                        const price = getItemEstimatedUnitPrice(item.name, catSummary.category, item.estimatedPrice);
                        const totalVal = Math.max(0, item.currentStock) * price;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/60">
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-500">
                              {itIdx + 1}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-mono text-slate-700">
                              {item.id}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 font-medium text-slate-900">
                              {item.name}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-slate-700">
                              {(() => {
                                const spec = getStorageLocationDetails(item.location);
                                return `${spec.rackCode} - ${spec.commodityDetail}`;
                              })()}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-500">
                              {item.minimumStock}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-right font-bold text-slate-900">
                              {item.currentStock.toLocaleString('id-ID')}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-600">
                              {item.baseUnit}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-slate-600">
                              {price > 0 ? `Rp ${price.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono font-bold text-slate-900">
                              {price > 0 ? `Rp ${totalVal.toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="py-1.5 px-2 text-center font-medium">
                              {status === 'NORMAL' ? (
                                <span className="text-emerald-700">Aman</span>
                              ) : status === 'LOW' ? (
                                <span className="text-amber-700 font-semibold">Menipis</span>
                              ) : (
                                <span className="text-rose-700 font-bold">Habis</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-800">
                        <td colSpan={5} className="py-1.5 px-2 border-r border-slate-300 text-right">
                          Subtotal {catSummary.category}:
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300"></td>
                        <td className="py-1.5 px-2 border-r border-slate-300"></td>
                        <td className="py-1.5 px-2 border-r border-slate-300"></td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-bold text-slate-900">
                          Rp {catSummary.totalValue.toLocaleString('id-ID')}
                        </td>
                        <td className="py-1.5 px-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))
          )}
        </div>

        {/* Lembar Pengesahan Dokumen / Tanda Tangan */}
        <div className="pt-6 border-t border-slate-300 text-xs mt-8">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-slate-500">Dibuat Oleh,</div>
              <div className="font-semibold text-slate-800">Petugas Gudang / Logistik</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                ({currentUser.name})
              </div>
            </div>

            <div>
              <div className="text-slate-500">Diverifikasi Oleh,</div>
              <div className="font-semibold text-slate-800">Akuntan SPPG</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                ({signerName('AKUNTAN')})
              </div>
            </div>

            <div>
              <div className="text-slate-500">Mengetahui & Menyetujui,</div>
              <div className="font-semibold text-slate-800">Kepala SPPG MLG TUMPANG JERU</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                ({signerName('KEPALA_SPPG')})
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------------------
  // Opname Logic & Handlers
  // ----------------------------------------------------
  const handleOpenCreateOpname = (presetCategory?: SppgCategory) => {
    // Tanpa preset selalu mulai dari semua kategori; filter tab Stok tidak terlihat dari tab Opname.
    const chosenCat = presetCategory || 'Semua Kategori';
    setOpnameCategoryFilter(chosenCat);
    setOpnameFormDate(localDateIso());
    setOpnameFormLocation(
      chosenCat === 'Bahan Basah'
        ? 'Chiller & Dapur Pengolahan'
        : chosenCat === 'Bahan Kering'
        ? 'Gudang Kering & Sembako'
        : chosenCat === 'ATK & Administrasi'
        ? 'Ruang Kantor & Administrasi'
        : chosenCat === 'Sanitasi, Kemasan & APD' || chosenCat === 'P3K & Obat-obatan'
        ? 'Gudang Non-Food'
        : 'Gudang Utama SPPG MLG TUMPANG JERU'
    );
    setOpnameFormNotes('');
    initOpnameItems(chosenCat);
    setIsCreateOpnameModalOpen(true);
  };

  const initOpnameItems = (cat: SppgCategory) => {
    const pool = cat === 'Semua Kategori'
      ? activeItems
      : activeItems.filter(i => getDetailedItemCategory(i) === cat);

    setCountingItems(
      pool.map(item => ({
        itemId: item.id,
        name: item.name,
        category: getDetailedItemCategory(item),
        unit: item.baseUnit,
        systemStock: item.currentStock,
        physicalCount: null, // counted by staff; "Sesuai" fills in the system figure on purpose
        variance: 0,
        reason: '',
      }))
    );
  };

  const handleOpnameCategoryChange = async (cat: SppgCategory) => {
    const counted = countingItems.filter(c => c.physicalCount !== null).length;
    if (counted > 0 && !(await askConfirm({
      title: 'Ganti kategori?',
      message: `${counted} hasil hitung yang sudah diisi akan dihapus.`,
      confirmText: 'Ganti kategori',
      variant: 'warning',
    }))) {
      return;
    }
    setOpnameCategoryFilter(cat);
    initOpnameItems(cat);
  };

  // Pindai label saat menghitung: gulir ke barang itu dan fokuskan isian jumlah fisiknya (yang terlihat: tabel atau kartu HP).
  const handleOpnameScan = ({ code }: ScanTarget) => {
    const row = countingItems.find(c => c.itemId.toUpperCase() === code.toUpperCase());
    if (!row) {
      const other = warehouseDb.getItems().find(i => i.id.toUpperCase() === code.toUpperCase());
      setOpnameScanNote(
        other
          ? `${other.name} tidak ada di daftar hitung ini (kategori ${other.category}). Ganti filter kategori opname bila perlu.`
          : `Kode ${code} tidak ditemukan di Master Barang.`
      );
      return;
    }
    setOpnameScanNote('');
    setTimeout(() => {
      const el = [...document.querySelectorAll<HTMLInputElement>(`[data-opname-item="${row.itemId}"]`)].find(x => x.offsetParent !== null);
      el?.scrollIntoView({ block: 'center' });
      el?.focus();
      el?.select();
    }, 60);
  };

  const handlePhysicalCountChange = (index: number, val: string) => {
    const count = val.trim() === '' ? null : Math.max(0, parseFloat(val) || 0);
    setCountingItems(prev => {
      const updated = [...prev];
      const diff = count === null ? 0 : Number((count - updated[index].systemStock).toFixed(2));
      updated[index] = {
        ...updated[index],
        physicalCount: count,
        variance: diff,
        reason: diff === 0 ? '' : updated[index].reason,
      };
      return updated;
    });
  };

  const handleOpnameStep = (index: number, delta: number) => {
    setCountingItems(prev => {
      const updated = [...prev];
      const base = updated[index].physicalCount ?? updated[index].systemStock;
      const nextCount = Math.max(0, Number((base + delta).toFixed(2)));
      const diff = Number((nextCount - updated[index].systemStock).toFixed(2));
      updated[index] = {
        ...updated[index],
        physicalCount: nextCount,
        variance: diff,
        reason: diff === 0 ? '' : updated[index].reason,
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
      showError('Tidak ada item dalam kategori yang dipilih untuk di-opname.', 'Validasi Form');
      return;
    }

    const uncounted = countingItems.filter(c => c.physicalCount === null);
    if (uncounted.length > 0) {
      showError(
        `${uncounted.length} barang belum dihitung: ${uncounted.slice(0, 5).map(c => c.name).join(', ')}${uncounted.length > 5 ? ', dan lainnya' : ''}. Isi jumlah fisik atau tekan "Sesuai" jika sama dengan sistem.`,
        'Belum Selesai Dihitung'
      );
      return;
    }

    // Validate variances
    for (const item of countingItems) {
      if (item.variance !== 0 && (!item.reason || item.reason.trim().length === 0)) {
        showError(`Item "${item.name}" memiliki selisih (${item.variance > 0 ? '+' : ''}${item.variance} ${item.unit}). Harap isi alasan selisih fisik.`, 'Alasan Wajib Diisi');
        return;
      }
    }

    try {
      const session = warehouseDb.createStockOpname(
        opnameFormDate,
        opnameFormLocation,
        countingItems.map(c => ({
          itemId: c.itemId,
          physicalCount: c.physicalCount as number,
          reason: c.reason,
        })),
        currentUser,
        `[Kategori: ${opnameCategoryFilter}] ${opnameFormNotes}`.trim()
      );

      if (directApprove && can('APPROVE_OPNAME')) {
        warehouseDb.approveStockOpname(session.id, currentUser);
        showToast(`Opname #${session.id} (${opnameCategoryFilter}) disimpan dan disetujui. Stok sudah diperbarui.`);
      } else {
        showToast(`Opname #${session.id} (${opnameCategoryFilter}) disimpan. Stok berubah setelah disetujui.`);
      }

      setIsCreateOpnameModalOpen(false);
      refreshData();
    } catch (err: any) {
      showError(err.message || 'Gagal membuat sesi stock opname.', 'Gagal Menyimpan');
    }
  };

  const handleApproveOpname = (session: StockOpnameSession) => {
    if (!can('APPROVE_OPNAME')) {
      showError('Anda tidak memiliki peran otorisasi untuk menyetujui Stock Opname (Hanya Manager / Superadmin).');
      return;
    }
    setOpnameSessionToApprove(session);
  };

  const confirmApproveOpname = () => {
    if (!opnameSessionToApprove) return;
    try {
      warehouseDb.approveStockOpname(opnameSessionToApprove.id, currentUser);
      showToast(`Opname #${opnameSessionToApprove.id} disetujui. Stok sudah diperbarui.`);
      refreshData();
      setViewingOpname(null);
      setOpnameSessionToApprove(null);
    } catch (err: any) {
      showError(err.message || 'Gagal menyetujui stock opname.');
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
    setAdjustQtyDelta(0);
    setAdjustType('ADD');
    setAdjustReason('');
  };

  const adjustTargetStock = adjustingItem
    ? adjustType === 'ADD'
      ? adjustingItem.currentStock + adjustQtyDelta
      : adjustType === 'SUBTRACT'
      ? Math.max(0, adjustingItem.currentStock - adjustQtyDelta)
      : Math.max(0, adjustQtyDelta)
    : 0;

  const handleSaveAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    if (!can('MANAGE_ITEMS')) {
      showError('Peran Anda tidak bisa mengoreksi stok. Minta admin gudang, atau lakukan stok opname.');
      return;
    }

    try {
      const targetStock = Number(adjustTargetStock.toFixed(3));
      warehouseDb.adjustItemStock(adjustingItem.id, targetStock, adjustReason, currentUser);
      showToast(`Stok ${adjustingItem.name} dikoreksi menjadi ${targetStock.toLocaleString('id-ID')} ${adjustingItem.baseUnit} dan tercatat di Buku Mutasi.`);
      setAdjustingItem(null);
      refreshData();
    } catch (err: any) {
      showError(err.message || 'Gagal menyesuaikan stok.');
    }
  };

  // ----------------------------------------------------
  // Single Item Master Modal Handlers (Custom Item Support)
  // ----------------------------------------------------
  const handleOpenNewSingleItem = () => {
    setEditingItem(null);
    const initialWh: WarehouseSkuType = 'GUDANG_KERING';
    setFormWarehouse(initialWh);
    const autoSku = generateAutoSku(initialWh, items);
    setFormSku(autoSku);
    setFormName('');
    setFormCategory('Bahan Kering');
    setFormCustomCategory('');
    setFormBaseUnit('Kg');
    setFormCustomUnit('');
    setFormInitialStock(0);
    setFormMinStock(20);
    setFormLocation(WAREHOUSE_SKU_DEFINITIONS[initialWh].defaultLocation);
    setFormEstimatedPrice(0);
    setFormNotes('');
    setFormIsActive(true);
    setFormError('');
    setIsSingleModalOpen(true);
  };

  const handleOpenEditItem = (item: ItemMaster) => {
    setEditingItem(item);
    const wh = detectWarehouseType(item.location, item.category);
    setFormWarehouse(wh);
    setFormSku(item.id);
    setFormName(item.name);
    const cat = getDetailedItemCategory(item);
    setFormCategory(cat);
    setFormCustomCategory('');
    setFormBaseUnit(item.baseUnit);
    setFormCustomUnit('');
    setFormInitialStock(item.currentStock);
    setFormMinStock(item.minimumStock);
    setFormLocation(item.location);
    setFormEstimatedPrice(item.estimatedPrice || 0);
    setFormNotes(item.notes || '');
    setFormIsActive(item.isActive !== false);
    setFormError('');
    setIsSingleModalOpen(true);
  };

  const handleWarehouseChange = (wh: WarehouseSkuType) => {
    setFormWarehouse(wh);
    if (!editingItem) {
      const nextSku = generateAutoSku(wh, items);
      setFormSku(nextSku);
      setFormLocation(WAREHOUSE_SKU_DEFINITIONS[wh].defaultLocation);
      if (wh === 'GUDANG_KERING' && (formCategory === 'Bahan Basah' || formCategory === 'Sanitasi, Kemasan & APD')) {
        setFormCategory('Bahan Kering');
      } else if (wh === 'GUDANG_BASAH' && (formCategory === 'Bahan Kering' || formCategory === 'Sanitasi, Kemasan & APD')) {
        setFormCategory('Bahan Basah');
      } else if (wh === 'GUDANG_NONFOOD' && formCategory !== 'P3K & Obat-obatan') {
        setFormCategory('Sanitasi, Kemasan & APD');
      }
    }
  };

  const handleRegenerateAutoSku = () => {
    const nextSku = generateAutoSku(formWarehouse, items);
    setFormSku(nextSku);
  };

  const handleSaveSingleItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const invalid = !formName.trim()
      ? 'Nama barang wajib diisi.'
      : formCategory === 'Kategori Kustom' && !formCustomCategory.trim()
      ? 'Isi nama kategori baru, atau pilih kategori yang ada.'
      : formBaseUnit === 'Satuan Kustom' && !formCustomUnit.trim()
      ? 'Isi nama satuan baru, atau pilih satuan yang ada.'
      : !formLocation.trim()
      ? 'Isi lokasi penyimpanan.'
      : !editingItem && formInitialStock < 0
      ? 'Stok awal tidak boleh negatif.'
      : items.some(i => i.id !== editingItem?.id && i.name.trim().toLowerCase() === formName.trim().toLowerCase())
      ? `Barang "${formName.trim()}" sudah ada di master.`
      : null;
    if (invalid) {
      setFormError(invalid);
      return;
    }

    try {
      const isNew = !editingItem;
      const finalCategory = formCategory === 'Kategori Kustom' ? formCustomCategory.trim() : formCategory;
      const finalUnit = formBaseUnit === 'Satuan Kustom' ? formCustomUnit.trim() : formBaseUnit;
      const initialStockVal = Number(formInitialStock) || 0;
      const minStockVal = Math.max(0, Number(formMinStock) || 0);
      const estPriceVal = Math.max(0, Number(formEstimatedPrice) || 0);

      // The SKU is the item's identity; editing must never retarget the save to another item
      const finalSku = editingItem ? editingItem.id : formSku.trim().toUpperCase() || generateAutoSku(formWarehouse, items);

      const itemToSave: ItemMaster = {
        id: finalSku,
        name: formName.trim(),
        itemType: finalCategory === 'Bahan Kering'
          ? 'FOOD_CARRYING_STOCK'
          : finalCategory === 'Bahan Basah'
          ? 'FOOD_DAILY_FLOW'
          : 'OPERATIONAL_CONSUMABLE',
        category: finalCategory,
        baseUnit: finalUnit,
        minimumStock: minStockVal,
        reorderPoint: minStockVal * 1.5,
        currentStock: editingItem ? editingItem.currentStock : initialStockVal,
        // Barang kering baru yang lokasinya masih default diarahkan ke rak sesuai bentuknya
        location:
          (!editingItem &&
          formWarehouse === 'GUDANG_KERING' &&
          (!formLocation.trim() || formLocation.trim() === WAREHOUSE_SKU_DEFINITIONS.GUDANG_KERING.defaultLocation)
            ? suggestDryLocation(formName)
            : undefined) ||
          formLocation.trim() ||
          WAREHOUSE_SKU_DEFINITIONS[formWarehouse]?.defaultLocation ||
          'Gudang Utama',
        expiryTrackingEnabled: finalCategory === 'Bahan Basah' || finalCategory === 'Bahan Kering',
        isActive: formIsActive,
        notes: formNotes.trim() || undefined,
        estimatedPrice: estPriceVal > 0 ? estPriceVal : undefined,
        lastMovementDate: editingItem?.lastMovementDate || (initialStockVal > 0 ? new Date().toISOString() : undefined),
        createdAt: editingItem?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      warehouseDb.saveItem(itemToSave, currentUser, isNew);
      refreshData();
      setIsSingleModalOpen(false);

      if (isNew) {
        showToast(`Master barang "${itemToSave.name}" (${itemToSave.id}) berhasil didaftarkan ke katalog!`, 'Berhasil Ditambahkan');
      } else {
        showToast(`Perubahan data master barang "${itemToSave.name}" (${itemToSave.id}) berhasil disimpan!`, 'Perubahan Tersimpan');
      }
    } catch (err: any) {
      const errMsg = err.message || 'Gagal menyimpan data barang.';
      setFormError(errMsg);
      showError(errMsg, 'Gagal Menyimpan');
    }
  };

  const handleDeleteItem = (item: ItemMaster) => {
    setItemToDelete(item);
  };

  const confirmDeleteItem = () => {
    if (!itemToDelete) return;
    try {
      warehouseDb.deleteItem(itemToDelete.id, currentUser);
      refreshData();
      showToast(`Master barang "${itemToDelete.name}" (${itemToDelete.id}) berhasil dihapus dari database.`, 'Berhasil Dihapus');
      setItemToDelete(null);
    } catch (err: any) {
      showError(err.message || 'Gagal menghapus item.', 'Gagal Menghapus');
    }
  };

  const handleToggleActive = (item: ItemMaster) => {
    try {
      const updated = warehouseDb.toggleItemActive(item.id, currentUser);
      refreshData();
      showToast(`Status master barang "${updated.name}" berhasil diubah menjadi ${updated.isActive ? 'Aktif' : 'Nonaktif'}.`);
    } catch (err: any) {
      showError(err.message || 'Gagal mengubah status item.');
    }
  };

  const handleExportMasterExcel = () => {
    if (filteredMasterItems.length === 0) {
      showError('Tidak ada data master barang untuk diekspor.');
      return;
    }

    const rows = filteredMasterItems.map((item, idx) => {
      const cat = getDetailedItemCategory(item);
      const price = getItemEstimatedUnitPrice(item.name, cat, item.estimatedPrice);
      return {
        No: idx + 1,
        'Kode SKU': item.id,
        'Nama Barang': item.name,
        Kategori: cat,
        'Satuan Dasar': item.baseUnit,
        'Min. Stok': item.minimumStock,
        'Titik Pesan Ulang': item.reorderPoint,
        'Lokasi Simpan': item.location,
        'Estimasi Harga Satuan (Rp)': price,
        Status: item.isActive !== false ? 'Aktif' : 'Nonaktif',
        'Saldo Stok Saat Ini': item.currentStock,
        Catatan: item.notes || '-',
      };
    });

    exportToExcel(
      rows,
      `Katalog_Master_Barang_SPPG_MLG_TUMPANG_JERU_${localDateIso()}.xlsx`,
      'Master Barang'
    );
  };

  // Export Stock Data to Excel
  const handleExportStockExcel = () => {
    if (filteredItems.length === 0) {
      showError('Tidak ada data stok untuk diekspor.');
      return;
    }

    const rows = filteredItems.map((item, idx) => {
      const cat = getDetailedItemCategory(item);
      const price = getItemEstimatedUnitPrice(item.name, cat, item.estimatedPrice);
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
      `Data_Stok_Barang_SPPG_MLG_TUMPANG_JERU_${localDateIso()}.xlsx`,
      'Stok Barang'
    );
  };

  return (
    <div className="space-y-5">
      {/* Print-specific stylesheet */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-size: 10pt;
          }
          nav, header, footer, .no-print {
            display: none !important;
          }
          #print-inventory-rekap, #print-opname-modal-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: transparent !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>

      {/* Main Screen Content (hidden during print) */}
      <div className="no-print space-y-5">
        {/* Toast Alert Notice */}
        {successNotice && (
          <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-medium animate-in fade-in duration-150">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2.5 p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs font-medium animate-in fade-in duration-150">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Stok Barang</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Saldo stok tiap barang, data master barang, dan stok opname.
          </p>
        </div>

        <div role="tablist" aria-label="Bagian halaman stok" className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs self-start lg:self-auto">
          {([
            { id: 'stock', label: 'Saldo Stok', badge: null },
            { id: 'master', label: 'Master Barang', badge: items.length },
            { id: 'opname', label: 'Stok Opname', badge: opnames.filter(o => o.status === 'PENDING_APPROVAL').length > 0 ? `${opnames.filter(o => o.status === 'PENDING_APPROVAL').length} menunggu` : null },
          ] as const).map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeMainTab === tab.id}
              onClick={() => setActiveMainTab(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                activeMainTab === tab.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              {tab.label}
              {tab.badge !== null && (
                <span
                  className={`text-[11px] font-mono px-1.5 rounded-md ${
                    tab.id === 'opname' ? 'bg-indigo-50 text-indigo-700 font-sans font-semibold' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* SALDO STOK */}
      {activeMainTab === 'stock' && (
        <div className="space-y-4">
          {/* Status tiles double as filters: the question each morning is what is low or empty */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {([
              { id: 'ALL', label: 'Semua barang aktif', value: stockMetrics.totalItems, tone: 'text-slate-900', active: 'ring-slate-900' },
              { id: 'OUT_OF_STOCK', label: 'Habis', value: stockMetrics.outCount, tone: 'text-rose-700', active: 'ring-rose-600' },
              { id: 'LOW', label: 'Menipis', value: stockMetrics.lowCount, tone: 'text-amber-800', active: 'ring-amber-600' },
              { id: 'NORMAL', label: 'Aman', value: stockMetrics.normalCount, tone: 'text-emerald-800', active: 'ring-emerald-600' },
            ] as const).map(tile => (
              <button
                key={tile.id}
                type="button"
                onClick={() => setFilterStatus(tile.id)}
                aria-pressed={filterStatus === tile.id}
                className={`text-left bg-white p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  filterStatus === tile.id ? `ring-2 ${tile.active}` : ''
                }`}
              >
                <span className="block text-[11px] font-medium text-slate-600">{tile.label}</span>
                <span className={`block mt-1 text-2xl font-bold font-mono tabular-nums ${tile.tone}`}>{tile.value}</span>
                <span className="block text-[11px] text-slate-600">jenis barang</span>
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
            <p className="text-xs text-slate-600">
              Nilai stok:{' '}
              <strong className="font-mono text-slate-900">Rp {stockMetrics.totalAssetValue.toLocaleString('id-ID')}</strong>
              {stockMetrics.unpricedCount > 0 && (
                <span className="text-slate-600">
                  {' '}(belum termasuk {stockMetrics.unpricedCount} barang yang harganya belum diisi)
                </span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {can('MANAGE_ITEMS') && (
                <button
                  type="button"
                  onClick={handleOpenNewSingleItem}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Barang
                </button>
              )}
              <button
                type="button"
                onClick={handleExportStockExcel}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                Ekspor Excel
              </button>
              <button
                type="button"
                onClick={() => setIsPrintPreviewOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                Cetak Rekap
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-3.5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1">
                {SPPG_STOCK_CATEGORIES.map(cat => {
                  const count = stockMetrics.categoryItemCounts[cat] || 0;
                  const isSelected = selectedCategoryTab === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategoryTab(cat)}
                      aria-pressed={isSelected}
                      className={`px-2.5 py-1.5 rounded-lg text-xs cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                        isSelected
                          ? 'bg-slate-900 text-white font-semibold'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 font-medium'
                      }`}
                    >
                      {cat === 'Semua Kategori' ? 'Semua' : cat}
                      <span className={`text-[11px] font-mono ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="relative w-full lg:w-64 shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Cari nama, SKU, lokasi"
                  aria-label="Cari barang"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <p className="text-xs font-semibold text-slate-800">
                  {activeItems.length === 0 ? 'Belum ada barang di master.' : 'Tidak ada barang yang cocok dengan filter.'}
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  {activeItems.length === 0
                    ? 'Tambahkan barang di tab Master Barang.'
                    : 'Ubah kategori, status, atau kata kunci pencarian.'}
                </p>
                {activeItems.length > 0 && (filterStatus !== 'ALL' || selectedCategoryTab !== 'Semua Kategori' || searchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('ALL');
                      setSelectedCategoryTab('Semua Kategori');
                      setSearchQuery('');
                    }}
                    className="mt-3 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Hapus semua filter
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 min-w-[220px]">Barang</th>
                        <th className="py-2.5 px-3 w-36">Kategori</th>
                        <th className="py-2.5 px-3 w-32 text-right">Stok</th>
                        <th className="py-2.5 px-3 w-28 text-right">Minimum</th>
                        <th className="py-2.5 px-3 w-24">Status</th>
                        <th className="py-2.5 px-3 w-32 text-right">Nilai</th>
                        {can('MANAGE_ITEMS') && <th className="py-2.5 px-3 w-20"><span className="sr-only">Aksi</span></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredItems.map(item => {
                        const cat = getDetailedItemCategory(item);
                        const status = getItemStockStatus(item);
                        const unitPrice = getItemEstimatedUnitPrice(item.name, cat, item.estimatedPrice);
                        const rackSpec = getStorageLocationDetails(item.location);
                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{item.name}</div>
                              <div className="text-[11px] text-slate-600 mt-0.5">
                                <span className="font-mono">{item.id}</span> · {rackSpec.rackCode} {rackSpec.shortName}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{cat}</td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <span
                                className={`font-mono font-semibold ${
                                  status === 'OUT_OF_STOCK' ? 'text-rose-700' : status === 'LOW' ? 'text-amber-800' : 'text-slate-900'
                                }`}
                              >
                                {item.currentStock.toLocaleString('id-ID')}
                              </span>{' '}
                              <span className="text-slate-600 text-[11px]">{item.baseUnit}</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                              {item.minimumStock.toLocaleString('id-ID')} {item.baseUnit}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  status === 'OUT_OF_STOCK'
                                    ? 'bg-rose-50 text-rose-700'
                                    : status === 'LOW'
                                    ? 'bg-amber-50 text-amber-800'
                                    : 'bg-emerald-50 text-emerald-800'
                                }`}
                              >
                                {status === 'OUT_OF_STOCK' ? 'Habis' : status === 'LOW' ? 'Menipis' : 'Aman'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {unitPrice > 0 ? (
                                <>
                                  <div className="font-mono text-slate-900">
                                    Rp {(Math.max(0, item.currentStock) * unitPrice).toLocaleString('id-ID')}
                                  </div>
                                  <div className="text-[11px] text-slate-600 font-mono">@ Rp {unitPrice.toLocaleString('id-ID')}</div>
                                </>
                              ) : (
                                <span className="text-[11px] text-slate-600">Harga belum diisi</span>
                              )}
                            </td>
                            {can('MANAGE_ITEMS') && (
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAdjust(item)}
                                  className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                >
                                  Koreksi
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <ul className="md:hidden divide-y divide-slate-100">
                  {filteredItems.map(item => {
                    const status = getItemStockStatus(item);
                    const rackSpec = getStorageLocationDetails(item.location);
                    return (
                      <li key={item.id} className="p-4 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 leading-snug">{item.name}</div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {getDetailedItemCategory(item)} · {rackSpec.rackCode}
                          </div>
                          <div className="text-[11px] text-slate-600">Minimum {item.minimumStock.toLocaleString('id-ID')} {item.baseUnit}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div
                            className={`font-mono text-sm font-semibold ${
                              status === 'OUT_OF_STOCK' ? 'text-rose-700' : status === 'LOW' ? 'text-amber-800' : 'text-slate-900'
                            }`}
                          >
                            {item.currentStock.toLocaleString('id-ID')} <span className="text-[11px] font-sans font-normal text-slate-600">{item.baseUnit}</span>
                          </div>
                          <span
                            className={`inline-block mt-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${
                              status === 'OUT_OF_STOCK'
                                ? 'bg-rose-50 text-rose-700'
                                : status === 'LOW'
                                ? 'bg-amber-50 text-amber-800'
                                : 'bg-emerald-50 text-emerald-800'
                            }`}
                          >
                            {status === 'OUT_OF_STOCK' ? 'Habis' : status === 'LOW' ? 'Menipis' : 'Aman'}
                          </span>
                          {can('MANAGE_ITEMS') && (
                            <button
                              type="button"
                              onClick={() => handleOpenAdjust(item)}
                              className="block ml-auto mt-1 px-2 text-xs font-semibold text-emerald-700 cursor-pointer min-h-[44px]"
                            >
                              Koreksi
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: MASTER BARANG (KATALOG & CUSTOM ITEM) */}
      {/* ========================================================================= */}
      {activeMainTab === 'master' && (
        <div className="space-y-5">
          {/* Header Action Card for Master Barang */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
                Master Barang
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Data tiap barang: SKU, satuan, batas minimum, lokasi simpan, dan harga satuan.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              {can('MANAGE_ITEMS') && (
                <button type="button" onClick={handleOpenNewSingleItem} className={BTN_PRIMARY}>
                  <Plus className="w-4 h-4" />
                  Tambah barang
                </button>
              )}
              <button
                type="button"
                onClick={handleExportMasterExcel}
                className={BTN_SECONDARY}
                title="Unduh barang yang tampil di tabel (sesuai filter) ke Excel">
                <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                Ekspor Excel
              </button>
            </div>
          </div>

          {/* Master Metrics Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Total Master Item</span>
                <Package className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-xl font-bold text-slate-900">
                {masterMetrics.total} <span className="text-xs font-normal text-slate-500">item</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Terdaftar di katalog</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Status Aktif</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-800">
                {masterMetrics.active} <span className="text-xs font-normal text-slate-500">item</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Siap untuk operasional</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Bahan Basah</span>
                <Boxes className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl font-bold text-emerald-700">
                {masterMetrics.basah} <span className="text-xs font-normal text-slate-500">jenis</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Protein, sayur & buah</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Bahan Kering</span>
                <Boxes className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-amber-700">
                {masterMetrics.kering} <span className="text-xs font-normal text-slate-500">jenis</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Beras, sembako & bumbu</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-semibold">Non-Pangan</span>
                <Layers className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-xl font-bold text-slate-700">
                {masterMetrics.nonFood} <span className="text-xs font-normal text-slate-500">jenis</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">ATK, APD & kebersihan</p>
            </div>
          </div>

          {/* Master Barang Table Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Filter Bar */}
            <div className="px-5 pt-4 pb-3 border-b border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {SPPG_STOCK_CATEGORIES.map(cat => {
                  const isSelected = masterCategoryFilter === cat;
                  const count = cat === 'Semua Kategori'
                    ? items.length
                    : items.filter(i => getDetailedItemCategory(i) === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMasterCategoryFilter(cat)}
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
                <Select
                  value={masterStatusFilter}
                  onChange={e => setMasterStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}>
                  <option value="ALL">Semua Status</option>
                  <option value="ACTIVE">Aktif Saja</option>
                  <option value="INACTIVE">Nonaktif Saja</option>
                </Select>

                <div className="relative w-64">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari SKU, nama, lokasi, catatan..."
                    value={masterSearchQuery}
                    onChange={e => setMasterSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    <th className="py-3 px-3 min-w-[220px]">Nama Barang & Spesifikasi</th>
                    <th className="py-3 px-3 w-36">Kategori Standar</th>
                    <th className="py-3 px-3 w-20 text-center">Satuan</th>
                    <th className="py-3 px-3 w-28 text-right">Min. Stok</th>
                    <th className="py-3 px-3 w-28 text-right">Saldo Saat Ini</th>
                    <th className="py-3 px-3 w-36">Lokasi Gudang</th>
                    <th className="py-3 px-3 w-28 text-right">Harga Satuan</th>
                    <th className="py-3 px-3 w-20 text-center">Status</th>
                    <th className="py-3 px-3 w-28 text-center">Aksi Master</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredMasterItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500">
                        {items.length === 0 ? (
                          <div className="max-w-md mx-auto space-y-3">
                            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                              <Package className="w-6 h-6" />
                            </div>
                            <div className="font-bold text-slate-800 text-sm">
                              Katalog Master Barang Masih Kosong
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Data barang telah dikosongkan. Anda dapat mulai mendaftarkan barang baru dari awal, baik satuan maupun secara masal (Excel).
                            </p>
                            {can('MANAGE_ITEMS') && (
                              <div className="flex items-center justify-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={handleOpenNewSingleItem}
                                  className={BTN_PRIMARY}
                                >
                                  <Plus className="w-4 h-4" />
                                  Tambah barang pertama
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="italic text-slate-500">
                            Tidak ada data master barang yang sesuai dengan filter dan pencarian saat ini.
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredMasterItems.map((item, idx) => {
                      const cat = getDetailedItemCategory(item);
                      const unitPrice = getItemEstimatedUnitPrice(item.name, cat, item.estimatedPrice);
                      const isActive = item.isActive !== false;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                            {item.id}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-slate-900">{item.name}</div>
                            {item.notes && (
                              <div className="text-[10px] text-slate-500 mt-0.5 italic">
                                {item.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold border bg-slate-50 border-slate-200 text-slate-700">
                              {cat}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                            {item.baseUnit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-600">
                            {item.minimumStock} {item.baseUnit}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <span className="font-mono font-bold text-slate-900">
                              {item.currentStock.toLocaleString('id-ID')}
                            </span>{' '}
                            <span className="text-slate-500 font-normal">{item.baseUnit}</span>
                          </td>
                          <td className="py-3 px-3">
                            {(() => {
                              const rackSpec = getStorageLocationDetails(item.location);
                              return (
                                <div className="flex flex-col gap-0.5 max-w-xs">
                                  <div className="text-slate-800 text-[11px] font-semibold flex items-center gap-1.5">
                                    <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                                      {rackSpec.rackCode}
                                    </span>
                                    <span className="truncate">{rackSpec.shortName}</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 line-clamp-1" title={rackSpec.commodityDetail}>
                                    {rackSpec.commodityDetail}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700">
                            {unitPrice > 0 ? `Rp ${unitPrice.toLocaleString('id-ID')}` : <span className="font-sans text-[11px] text-slate-600">Belum diisi</span>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <Check className="w-3 h-3" /> Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                Nonaktif
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {can('MANAGE_ITEMS') && isActive && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenAdjust(item)}
                                  className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                                  title="Koreksi stok"
                                  aria-label={`Koreksi stok ${item.name}`}
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {can('MANAGE_ITEMS') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditItem(item)}
                                  className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                                  title="Edit data barang"
                                  aria-label={`Edit ${item.name}`}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {can('MANAGE_ITEMS') && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(item)}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors cursor-pointer"
                                  title={isActive ? 'Nonaktifkan barang ini' : 'Aktifkan kembali barang ini'}
                                  aria-label={isActive ? `Nonaktifkan ${item.name}` : `Aktifkan ${item.name}`}
                                >
                                  {isActive ? <Minus className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              {can('MANAGE_ITEMS') && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item)}
                                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                                  title="Hapus barang dari master"
                                  aria-label={`Hapus ${item.name}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-emerald-600" />
                Stok Opname
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Hitung ulang stok fisik di gudang dan cocokkan dengan sistem. Selisih baru mengubah stok setelah disetujui pejabat yang berwenang.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => handleOpenCreateOpname()} className={BTN_PRIMARY}>
                <Plus className="w-4 h-4" />
                Mulai opname
              </button>
            </div>
          </div>

          {/* Opname Category Quick Launch Pills */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Opname per kategori:</span>
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
                    <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full">
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
                <span className="text-xs font-bold text-slate-800">Riwayat Opname</span>
                <Select
                  value={opnameStatusFilter}
                  onChange={e => setOpnameStatusFilter(e.target.value as any)}>
                  <option value="ALL">Semua Status</option>
                  <option value="PENDING_APPROVAL">Menunggu Otorisasi (Pending)</option>
                  <option value="APPROVED">Telah Disetujui (Approved)</option>
                </Select>
              </div>

              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari no sesi, area, atau pemeriksa..."
                  value={opnameSearchQuery}
                  onChange={e => setOpnameSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                      <td colSpan={7} className="py-12 text-center text-slate-600">
                        Belum ada opname yang cocok dengan filter.
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
                            <div className="text-[10px] text-slate-500">
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
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Disetujui
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
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
      </div>

      {/* ========================================================================= */}
      {/* MODAL: FORMULIR PELAKSANAAN STOCK OPNAME BARU (BISA PER KATEGORI) */}
      {/* ========================================================================= */}
      {isCreateOpnameModalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">Stok Opname</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Isi jumlah fisik tiap barang. Kalau sama dengan sistem, cukup tekan Sesuai.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpnameModalOpen(false)}
                aria-label="Tutup"
                className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Opname Parameters: category decides the list, so it stays visible; the rest folds away */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label htmlFor="opname-category" className="block font-semibold text-slate-700 mb-1">Kategori yang dihitung</label>
                    <Select className="w-full"
                      id="opname-category"
                      value={opnameCategoryFilter}
                      onChange={e => handleOpnameCategoryChange(e.target.value as SppgCategory)}>
                      {SPPG_STOCK_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </div>
                  <p className="text-[11px] text-slate-600 sm:pb-2">
                    Pemeriksa: <strong className="text-slate-800">{currentUser.name}</strong> · {opnameFormDate}
                  </p>
                </div>

                <details className="group">
                  <summary className="cursor-pointer select-none font-semibold text-emerald-700 min-h-[44px] sm:min-h-0 flex items-center">
                    Ubah tanggal, lokasi, atau catatan
                  </summary>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label htmlFor="opname-date" className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                      <input id="opname-date" type="date" value={opnameFormDate} onChange={e => setOpnameFormDate(e.target.value)} className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" />
                    </div>
                    <div>
                      <label htmlFor="opname-location" className="block font-semibold text-slate-700 mb-1">Lokasi gudang</label>
                      <input id="opname-location" type="text" value={opnameFormLocation} onChange={e => setOpnameFormLocation(e.target.value)} className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" />
                    </div>
                    <div>
                      <label htmlFor="opname-notes" className="block font-semibold text-slate-700 mb-1">Catatan</label>
                      <input
                        id="opname-notes"
                        type="text"
                        value={opnameFormNotes}
                        onChange={e => setOpnameFormNotes(e.target.value)}
                        placeholder="Opsional"
                        className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      />
                    </div>
                  </div>
                </details>
              </div>

              {/* Items Counting Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div className="font-semibold text-slate-800">
                    Daftar Barang ({countingItems.length} item • {opnameCategoryFilter})
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-slate-500 text-[11px]">
                      Tekan <strong>Sesuai</strong> jika jumlah fisik sama dengan sistem
                    </div>
                    <ScanButton onResult={handleOpnameScan} hint="Pindai label barang untuk langsung mengisi jumlah fisiknya." />
                  </div>
                </div>
                {opnameScanNote && (
                  <p role="alert" className="px-4 py-2 text-[11px] font-medium text-amber-900 bg-amber-50 border-b border-amber-200">{opnameScanNote}</p>
                )}

                <div className="hidden md:block overflow-x-auto max-h-[50vh]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center">#</th>
                        <th className="py-2.5 px-3 min-w-[200px]">Nama Barang & Kode</th>
                        <th className="py-2.5 px-3 w-28 text-right">Stok Sistem</th>
                        <th className="py-2.5 px-3 w-48 text-center">Fisik Aktual</th>
                        <th className="py-2.5 px-3 w-28 text-center">Selisih</th>
                        <th className="py-2.5 px-3 min-w-[220px]">Alasan Selisih</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {countingItems.map((item, idx) => {
                        const hasVariance = item.variance !== 0;

                        return (
                          <tr key={item.itemId} className={hasVariance ? 'bg-amber-50/40' : 'hover:bg-slate-50/70 transition-colors'}>
                            <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-slate-900">{item.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.itemId} • {item.category}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="font-mono font-semibold text-slate-800 text-sm">
                                {item.systemStock}
                              </span>{' '}
                              <span className="text-slate-500 font-normal">{item.unit}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => handleOpnameStep(idx, -1)}
                                    className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-sm font-semibold"
                                    title="Kurangi 1"
                                  >
                                    -
                                  </button>
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={item.physicalCount ?? ''}
                                    placeholder="?"
                                    data-opname-item={item.itemId}
                                    aria-label={`Jumlah fisik ${item.name}`}
                                    onChange={e => handlePhysicalCountChange(idx, e.target.value)}
                                    className="w-16 h-7 text-xs text-center font-mono font-semibold text-slate-900 border-x border-slate-200 focus:outline-none focus:bg-emerald-50/50 placeholder:text-slate-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleOpnameStep(idx, 1)}
                                    className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer text-sm font-semibold"
                                    title="Tambah 1"
                                  >
                                    +
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpnameMatch(idx)}
                                  className="h-7 px-2.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200/80 transition-colors cursor-pointer"
                                  title="Hasil hitung sama dengan stok sistem"
                                >
                                  Sesuai
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {item.physicalCount === null ? (
                                <span className="text-[11px] text-slate-600">Belum dihitung</span>
                              ) : item.variance === 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                                  0 (Sesuai)
                                </span>
                              ) : item.variance < 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 border border-rose-200/60 text-rose-700 font-mono">
                                  {item.variance} {item.unit}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 border border-sky-200/60 text-sky-700 font-mono">
                                  +{item.variance} {item.unit}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {hasVariance ? (
                                <div className="space-y-1.5">
                                  <input
                                    type="text"
                                    value={item.reason}
                                    onChange={e => handleOpnameReasonChange(idx, e.target.value)}
                                    placeholder="Alasan selisih..."
                                    required
                                    className="w-full text-xs border border-amber-300 rounded-lg px-2.5 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-900"
                                  />
                                  <div className="flex flex-wrap gap-1">
                                    {['Susut alami', 'Rusak / kadaluarsa', 'Belum tercatat'].map(preset => (
                                      <button
                                        key={preset}
                                        type="button"
                                        onClick={() => handleOpnameReasonChange(idx, preset)}
                                        className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200/80 transition-colors cursor-pointer"
                                      >
                                        {preset}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-500 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* HP: satu kartu per barang, dipakai sambil berkeliling gudang */}
                <ul className="md:hidden divide-y divide-slate-100">
                  {countingItems.map((item, idx) => (
                    <li key={item.itemId} className={`p-3.5 ${item.physicalCount !== null && item.variance !== 0 ? 'bg-amber-50/50' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 leading-snug">{item.name}</div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            Sistem: <span className="font-mono font-semibold text-slate-800">{item.systemStock}</span> {item.unit}
                          </div>
                        </div>
                        <span className="text-[11px] shrink-0">
                          {item.physicalCount === null ? (
                            <span className="text-slate-600">Belum dihitung</span>
                          ) : item.variance === 0 ? (
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 font-semibold">Sesuai</span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded-md font-semibold font-mono ${item.variance < 0 ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>
                              {item.variance > 0 ? '+' : ''}{item.variance} {item.unit}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden">
                          <button type="button" onClick={() => handleOpnameStep(idx, -1)} aria-label={`Kurangi 1 ${item.name}`} className="w-11 h-11 text-base font-semibold text-slate-700 cursor-pointer">-</button>
                          <input
                            type="number"
                            inputMode="decimal"
                            min="0"
                            step="any"
                            value={item.physicalCount ?? ''}
                            placeholder="?"
                            data-opname-item={item.itemId}
                            aria-label={`Jumlah fisik ${item.name}`}
                            onChange={e => handlePhysicalCountChange(idx, e.target.value)}
                            className="w-20 h-11 text-sm text-center font-mono font-semibold text-slate-900 border-x border-slate-300 focus:outline-none focus:bg-emerald-50 placeholder:text-slate-500"
                          />
                          <button type="button" onClick={() => handleOpnameStep(idx, 1)} aria-label={`Tambah 1 ${item.name}`} className="w-11 h-11 text-base font-semibold text-slate-700 cursor-pointer">+</button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpnameMatch(idx)}
                          className="h-11 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 rounded-lg border border-emerald-200 cursor-pointer"
                        >
                          Sesuai
                        </button>
                      </div>
                      {item.physicalCount !== null && item.variance !== 0 && (
                        <div className="mt-2 space-y-1.5">
                          <input
                            type="text"
                            value={item.reason}
                            onChange={e => handleOpnameReasonChange(idx, e.target.value)}
                            placeholder="Alasan selisih..."
                            aria-label={`Alasan selisih ${item.name}`}
                            className="w-full text-xs border border-amber-300 rounded-lg px-2.5 py-2.5 bg-white text-slate-900"
                          />
                          <div className="flex flex-wrap gap-1">
                            {['Susut alami', 'Rusak / kadaluarsa', 'Belum tercatat'].map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => handleOpnameReasonChange(idx, preset)}
                                className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-md cursor-pointer"
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer Summary & Buttons */}
            <div className="px-4 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 text-xs">
                <span>Total: <strong className="text-slate-800">{countingItems.length}</strong> item</span>
                <span>•</span>
                <span className={countingItems.some(i => i.physicalCount === null) ? 'text-amber-800 font-semibold' : 'text-slate-600'}>
                  <strong>{countingItems.filter(i => i.physicalCount === null).length}</strong> belum dihitung
                </span>
                <span>•</span>
                <span className="text-emerald-700 font-medium"><strong>{countingItems.filter(i => i.physicalCount !== null && i.variance === 0).length}</strong> sesuai</span>
                <span>•</span>
                <span className={countingItems.some(i => i.variance !== 0) ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                  <strong>{countingItems.filter(i => i.variance !== 0).length}</strong> selisih
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpnameModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg font-medium cursor-pointer min-h-[44px] sm:min-h-[36px]"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmitOpnameSession(false)}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold cursor-pointer min-h-[44px] sm:min-h-[36px]"
                >
                  Simpan Sesi Opname
                </button>

                {can('APPROVE_OPNAME') && (
                  <button
                    type="button"
                    onClick={() => handleSubmitOpnameSession(true)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold cursor-pointer min-h-[44px] sm:min-h-[36px]"
                  >
                    Simpan & Setujui Langsung
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 overflow-y-auto print:p-0 print:bg-white print:static print:z-auto">
          <div id="print-opname-modal-area" className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150 print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none">
            <div className="no-print px-4 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Berita Acara Opname {viewingOpname.id}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                    viewingOpname.status === 'APPROVED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  {viewingOpname.status === 'APPROVED' ? 'Disetujui' : 'Menunggu persetujuan'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingOpname(null)}
                aria-label="Tutup"
                className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs print:p-0 print:overflow-visible">
              {viewingOpname.status !== 'APPROVED' && (
                <p className="p-2.5 rounded-lg border-2 border-amber-400 bg-amber-50 text-amber-900 font-semibold text-center print:border-slate-900 print:bg-white print:text-slate-900">
                  DRAF: opname ini belum disetujui. Stok belum berubah.
                </p>
              )}
              {/* Kop Surat Resmi Standar SPPG (Tampil saat cetak) */}
              <div className="border-b-2 border-slate-900 pb-4 mb-4 hidden print:flex items-start justify-between">
                <div className="flex items-center gap-3.5">
                  <SppgLogo size="lg" variant="color" showText={false} />
                  <KopText />
                </div>

                <div className="text-right text-[11px] text-slate-500 space-y-0.5">
                  <div>
                    Tanggal Cetak: <span className="font-semibold text-slate-700">{printDate}</span>
                  </div>
                  <div>
                    Operator: <span className="font-semibold text-slate-700">{currentUser.name}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px]">Tanggal Opname</span>
                  <span className="font-bold text-slate-800">{viewingOpname.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Lokasi Gudang</span>
                  <span className="font-bold text-slate-800">{viewingOpname.location}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Pencatat Fisik</span>
                  <span className="font-bold text-slate-800">{viewingOpname.createdByName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Otorisasi / Approval</span>
                  <span className="font-bold text-slate-800">{viewingOpname.approvedByName || 'Belum Disetujui'}</span>
                </div>
              </div>

              {viewingOpname.notes && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700">
                  <span className="font-bold">Keterangan Sesi:</span> {viewingOpname.notes}
                </div>
              )}

              <div className="border border-slate-200 rounded-xl overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[560px] text-left text-xs">
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
                              <span className={i.variance < 0 ? 'text-rose-700' : 'text-sky-700'}>
                                {i.variance > 0 ? `+${i.variance}` : i.variance} {i.unit}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{i.reason || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Lembar Pengesahan Dokumen Opname (Tampil saat cetak) */}
              <div className="pt-6 border-t border-slate-300 text-xs mt-6 hidden print:block">
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <div className="text-slate-500">Pencatat Fisik,</div>
                    <div className="font-semibold text-slate-800">Petugas Gudang / Logistik</div>
                    <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                      ({viewingOpname.createdByName})
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">Diverifikasi Oleh,</div>
                    <div className="font-semibold text-slate-800">Akuntan SPPG</div>
                    <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                      ({signerName('AKUNTAN')})
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-500">Otorisasi / Persetujuan,</div>
                    <div className="font-semibold text-slate-800">Kepala SPPG MLG TUMPANG JERU</div>
                    <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                      ({viewingOpname.approvedByName && !viewingOpname.approvedByName.includes('Siti Rahma') ? viewingOpname.approvedByName : signerName('KEPALA_SPPG')})
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="no-print flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 border-t border-slate-200 bg-slate-50 text-xs">
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
                    className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold cursor-pointer min-h-[44px] sm:min-h-[36px]"
                  >
                    <Check className="w-4 h-4" />
                    Setujui dan Perbarui Stok
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
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Koreksi Stok</h3>
                <p className="text-[11px] text-slate-600">{adjustingItem.name} ({adjustingItem.id})</p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingItem(null)}
                className="p-1 rounded-md text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="p-4 sm:p-6 space-y-4 text-xs">
              <p className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
                Koreksi tercatat di Buku Mutasi dengan nama Anda. Untuk hitung ulang banyak barang, pakai Stok Opname.
              </p>
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
                      adjustType === 'SET' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    Jadi Jumlah
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
                  value={adjustQtyDelta || ''}
                  placeholder="0"
                  onChange={e => setAdjustQtyDelta(Math.max(0, parseFloat(e.target.value) || 0))}
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-bold font-mono text-slate-900 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Alasan <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="Contoh: salah input saat penerimaan 15/10"
                  required
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {['Salah input', 'Rusak / busuk', 'Dipakai belum tercatat', 'Hasil hitung ulang'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdjustReason(preset)}
                      className="text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded-md cursor-pointer"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-slate-600">Stok setelah koreksi</span>
                <span className="font-mono font-bold text-base text-slate-900">
                  {Number(adjustTargetStock.toFixed(3)).toLocaleString('id-ID')} {adjustingItem.baseUnit}
                </span>
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
                  Simpan Koreksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: TAMBAH / EDIT MASTER BARANG SATUAN & CUSTOM */}
      {/* ========================================================================= */}
      {isSingleModalOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-form-title"
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden"
          >
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 id="item-form-title" className="text-base font-bold text-slate-900">
                  {editingItem ? `Edit ${editingItem.name}` : 'Tambah Barang'}
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {editingItem
                    ? 'Ubah data barang. Stok tidak berubah di sini, pakai Koreksi atau Stok Opname.'
                    : 'Daftarkan barang baru ke master barang.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSingleModalOpen(false)}
                aria-label="Tutup"
                className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSingleItem} noValidate className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
              {formError && (
                <div role="alert" className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
                  {formError}
                </div>
              )}

              {/* 1. Identitas barang */}
              <div>
                <label htmlFor="item-name" className="block font-semibold text-slate-700 mb-1">
                  Nama barang <span className="text-rose-600">*</span>
                </label>
                <input
                  id="item-name"
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Contoh: Beras Medium, Ayam Broiler Karkas"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="item-category" className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <Select className="w-full"
                    id="item-category"
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as SppgCategory)}>
                    {SPPG_STOCK_CATEGORIES.filter(c => c !== 'Semua Kategori').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="Kategori Kustom">Kategori lain...</option>
                  </Select>
                  {formCategory === 'Kategori Kustom' && (
                    <input
                      type="text"
                      value={formCustomCategory}
                      onChange={e => setFormCustomCategory(e.target.value)}
                      placeholder="Nama kategori baru"
                      aria-label="Nama kategori baru"
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 mt-1.5"
                    />
                  )}
                </div>
                <div>
                  <label htmlFor="item-unit" className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <Select className="w-full"
                    id="item-unit"
                    value={formBaseUnit}
                    onChange={e => setFormBaseUnit(e.target.value as BaseUnit)}>
                    {['Kg', 'Gram', 'Liter', 'Pcs', 'Pack', 'Dus', 'Ikat', 'Butir', 'Roll', 'Botol', 'Jerigen', 'Pouch', 'Rim'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                    <option value="Satuan Kustom">Satuan lain...</option>
                  </Select>
                  {formBaseUnit === 'Satuan Kustom' && (
                    <input
                      type="text"
                      value={formCustomUnit}
                      onChange={e => setFormCustomUnit(e.target.value)}
                      placeholder="Contoh: Kaleng, Slop"
                      aria-label="Nama satuan baru"
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 mt-1.5"
                    />
                  )}
                </div>
              </div>

              {/* 2. Angka stok */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="item-stock" className="block font-semibold text-slate-700 mb-1">
                    {editingItem ? 'Stok sekarang' : 'Stok awal'}
                  </label>
                  <input
                    id="item-stock"
                    type="number"
                    min="0"
                    step="any"
                    value={editingItem ? editingItem.currentStock : formInitialStock || ''}
                    placeholder="0"
                    onChange={e => setFormInitialStock(parseFloat(e.target.value) || 0)}
                    disabled={!!editingItem}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 text-right font-mono disabled:bg-slate-100 disabled:text-slate-700"
                  />
                  <span className="text-[11px] text-slate-600 mt-0.5 block">
                    {editingItem ? 'Ubah lewat Koreksi.' : 'Tercatat di Buku Mutasi.'}
                  </span>
                </div>
                <div>
                  <label htmlFor="item-min" className="block font-semibold text-slate-700 mb-1">Batas minimum</label>
                  <input
                    id="item-min"
                    type="number"
                    min="0"
                    step="any"
                    value={formMinStock}
                    onChange={e => setFormMinStock(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 text-right font-mono"
                  />
                  <span className="text-[11px] text-slate-600 mt-0.5 block">Di bawah ini ditandai menipis.</span>
                </div>
                <div>
                  <label htmlFor="item-price" className="block font-semibold text-slate-700 mb-1">Harga satuan (Rp)</label>
                  <input
                    id="item-price"
                    type="number"
                    min="0"
                    step="any"
                    value={formEstimatedPrice || ''}
                    onChange={e => setFormEstimatedPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    placeholder="Belum diisi"
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 text-right font-mono"
                  />
                  <span className="text-[11px] text-slate-600 mt-0.5 block">Untuk menghitung nilai stok.</span>
                </div>
              </div>

              {/* 3. Lokasi dan SKU */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="item-area" className="block font-semibold text-slate-700 mb-1">Area gudang</label>
                    <Select className="w-full"
                      id="item-area"
                      value={formWarehouse}
                      onChange={e => handleWarehouseChange(e.target.value as WarehouseSkuType)}>
                      {Object.values(WAREHOUSE_SKU_DEFINITIONS).map(wh => (
                        <option key={wh.key} value={wh.key}>{wh.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="item-sku" className="block font-semibold text-slate-700 mb-1">SKU</label>
                    <div className="flex gap-1.5">
                      <input
                        id="item-sku"
                        type="text"
                        value={formSku}
                        onChange={e => setFormSku(e.target.value)}
                        readOnly={!!editingItem}
                        placeholder="Dibuat otomatis"
                        className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-mono uppercase read-only:bg-slate-100 read-only:text-slate-700"
                      />
                      {!editingItem && (
                        <button
                          type="button"
                          onClick={handleRegenerateAutoSku}
                          className="shrink-0 px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer min-h-[44px] sm:min-h-[36px]"
                          title="Isi SKU berikutnya untuk area ini"
                        >
                          Otomatis
                        </button>
                      )}
                    </div>
                    {editingItem && <span className="text-[11px] text-slate-600 mt-0.5 block">SKU tidak bisa diubah.</span>}
                  </div>
                </div>

                <div>
                  <label htmlFor="item-location" className="block font-semibold text-slate-700 mb-1">Rak / lokasi simpan</label>
                  <Select className="w-full"
                    id="item-location"
                    value={ALL_STANDARD_LOCATIONS.includes(formLocation) ? formLocation : 'LOKASI_KUSTOM'}
                    onChange={e => setFormLocation(e.target.value === 'LOKASI_KUSTOM' ? '' : e.target.value)}>
                    <optgroup label={`Disarankan untuk ${WAREHOUSE_SKU_DEFINITIONS[formWarehouse]?.label || 'area ini'}`}>
                      {(WAREHOUSE_SKU_DEFINITIONS[formWarehouse]?.suggestedLocations || []).map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Lokasi lain">
                      {ALL_STANDARD_LOCATIONS.filter(
                        loc => !(WAREHOUSE_SKU_DEFINITIONS[formWarehouse]?.suggestedLocations || []).includes(loc)
                      ).map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </optgroup>
                    <option value="LOKASI_KUSTOM">Lokasi lain (ketik sendiri)...</option>
                  </Select>
                  {!ALL_STANDARD_LOCATIONS.includes(formLocation) && (
                    <input
                      type="text"
                      value={formLocation}
                      onChange={e => setFormLocation(e.target.value)}
                      placeholder="Contoh: Rak Khusus B2"
                      aria-label="Nama lokasi"
                      className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 mt-1.5"
                    />
                  )}
                  {ALL_STANDARD_LOCATIONS.includes(formLocation) && (() => {
                    const rackSpec = getStorageLocationDetails(formLocation);
                    return (
                      <p className="mt-1.5 text-[11px] text-slate-600 leading-relaxed">
                        <strong className="text-slate-800">{rackSpec.zone}</strong> ({rackSpec.temperature}). {rackSpec.storageRule}
                      </p>
                    );
                  })()}
                </div>
              </div>

              <div>
                <label htmlFor="item-notes" className="block font-semibold text-slate-700 mb-1">Catatan</label>
                <input
                  id="item-notes"
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Contoh: kemasan 5 kg, merek biasa dipakai"
                  className="w-full border border-slate-300 rounded-lg px-2.5 py-2 bg-white text-slate-900 min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={e => setFormIsActive(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <span>
                  <span className="font-semibold text-slate-800">Barang aktif</span>
                  <span className="block text-[11px] text-slate-600">Barang nonaktif tidak muncul di saldo stok dan opname.</span>
                </span>
              </label>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg font-semibold cursor-pointer min-h-[44px] sm:min-h-[36px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                >
                  {editingItem ? 'Simpan Perubahan' : 'Simpan Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PRATINJAU CETAK REKAPITULASI STOK RESMI SPPG */}
      {/* ========================================================================= */}
      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 flex items-center justify-center p-3 sm:p-5 print:p-0 print:bg-white print:static print:z-auto">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 print:max-w-none print:max-h-none print:shadow-none print:border-none print:rounded-none">
            {/* Modal Toolbar (hidden during printing) */}
            <div className="no-print px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-slate-800">
                  Pratinjau Format Cetak Dokumen Resmi Rekapitulasi Stok
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg font-medium cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
              </div>
            </div>

            {/* Document Sheet */}
            <div className="p-6 sm:p-10 overflow-y-auto print:p-0 print:overflow-visible">
              {renderPrintableStockSheet()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI: HAPUS MASTER BARANG (SINGLE ITEM) */}
      {/* ========================================================================= */}
      {itemToDelete && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header Dialog */}
            <div className="p-5 sm:p-6 pb-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    Hapus Master Barang?
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Apakah Anda yakin ingin menghapus data master barang ini dari database sistem?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setItemToDelete(null)}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Tutup dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Card Detail Item yang Hendak Dihapus */}
              <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-slate-500 block">
                      Nama Bahan Pangan / Barang
                    </span>
                    <div className="font-bold text-slate-900 text-sm mt-0.5 truncate">
                      {itemToDelete.name}
                    </div>
                  </div>
                  <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-slate-200/80 text-slate-800 shrink-0">
                    {itemToDelete.id}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-2 border-t border-slate-200/70">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Kategori</span>
                    <span className="font-medium text-slate-800">{itemToDelete.category || 'Bahan Kering'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Lokasi Gudang</span>
                    <span className="font-medium text-slate-800 truncate block">{itemToDelete.location || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Satuan / Min. Stok</span>
                    <span className="font-medium text-slate-800">
                      {itemToDelete.baseUnit} (Min. {itemToDelete.minimumStock} {itemToDelete.baseUnit})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Saldo Stok Tercatat</span>
                    <span className={`font-mono font-bold ${itemToDelete.currentStock > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                      {itemToDelete.currentStock.toLocaleString('id-ID')} {itemToDelete.baseUnit}
                    </span>
                  </div>
                </div>

                {itemToDelete.currentStock > 0 ? (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2 font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <p className="leading-relaxed">
                      Barang ini masih punya stok <strong>{itemToDelete.currentStock} {itemToDelete.baseUnit}</strong>. Kalau dihapus, stok itu hilang dari sistem tanpa tercatat di Buku Mutasi. Lebih aman dinonaktifkan: barang hilang dari saldo stok, tapi datanya tetap ada.
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Riwayat transaksi lama dengan SKU ini tetap tersimpan.
                  </p>
                )}
              </div>
            </div>

            {/* Footer Aksi */}
            <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 cursor-pointer min-h-[44px] sm:min-h-[36px]"
              >
                Batal
              </button>
              {itemToDelete.isActive !== false && (
                <button
                  type="button"
                  onClick={() => {
                    handleToggleActive(itemToDelete);
                    setItemToDelete(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 cursor-pointer min-h-[44px] sm:min-h-[36px]"
                >
                  Nonaktifkan saja
                </button>
              )}
              <button
                type="button"
                onClick={confirmDeleteItem}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ========================================================================= */}
      {/* MODAL KONFIRMASI: PERSETUJUAN STOCK OPNAME */}
      {/* ========================================================================= */}
      {opnameSessionToApprove && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 sm:p-6 pb-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0 shadow-2xs">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    Setujui & Terapkan Hasil Stock Opname?
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Sesi audit #{opnameSessionToApprove.id} ({opnameSessionToApprove.notes || opnameSessionToApprove.location})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpnameSessionToApprove(null)}
                  className="p-1 rounded-md text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Tutup dialog"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5 text-slate-600">
                <p className="leading-relaxed">
                  Dengan menyetujui sesi ini, saldo stok fisik sistem akan <strong>langsung disesuaikan</strong> dengan hasil hitung fisik yang tercatat.
                </p>
                <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                  Disetujui oleh: <strong className="text-slate-800">{currentUser.name}</strong> ({currentUser.role})
                </div>
              </div>
            </div>

            <div className="px-5 sm:px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setOpnameSessionToApprove(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmApproveOpname}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ya, Setujui & Terapkan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden printable area when modal is not open (for direct shortcut Cmd+P / window.print) */}
      {!isPrintPreviewOpen && !viewingOpname && (
        <div className="hidden print:block">
          {renderPrintableStockSheet()}
        </div>
      )}
    </div>
  );
};
