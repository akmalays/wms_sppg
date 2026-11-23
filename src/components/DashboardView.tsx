import React, { useState, useMemo, useEffect } from 'react';
import { normalizeToStandardCategory } from '../utils/categoryStandards';
import { Select } from './common/Select';
import { warehouseDb, APP_SETTINGS_CHANGED_EVENT } from '../db/storage';
import { getBeneficiaryRecap } from '../utils/beneficiaryRecap';
import {
  ItemMaster,
  ReceivingDocument,
  EquipmentItem,
  StockOpnameSession,
  MenuOrder,
  PurchaseOrderNota,
} from '../types/warehouse';
import {
  AlertTriangle,
  Wrench,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  Plus,
  Printer,
  ShieldCheck,
  XCircle,
  Search,
  Store,
  Info,
  Globe,
  ChefHat,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { ReceivingDetailModal } from './ReceivingDetailModal';
import { DailyChecklistWidget } from './DailyChecklistWidget';
import { localDateIso } from '../utils/localDate';
import { isAwaitingDelivery, isOrderedPurchaseOrder, poDateForMenu } from '../utils/poSupplier';
import { isExtraCostPoItem } from '../utils/extraCosts';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onRefreshData?: () => void;
  onPrintReceiving?: (receivingId: string) => void;
}

type TriageFilter = 'ALL' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OPNAME' | 'EQUIPMENT';

// Shared control styles (DESIGN.md: rounded-lg controls, emerald-700 primary, ring-2 focus)
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const BTN_PRIMARY = `inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] ${FOCUS}`;
const BTN_SECONDARY = `inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] ${FOCUS}`;
const BTN_LINK = `text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer rounded-md min-h-[44px] sm:min-h-0 inline-flex items-center ${FOCUS}`;
const SECTION = 'bg-white rounded-xl border border-slate-200 overflow-hidden';
const SECTION_HEAD = 'px-4 sm:px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2';

const FOCUS_INSET = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600';

// Di HP, bagian rujukan dilipat supaya layar pertama berisi hal yang perlu dikerjakan; judul lipatan tetap memuat angkanya.
// Kedatangan bahan terbuka selama ada pesanan, karena itu yang dipantau sepanjang pagi.
type FoldId = 'po' | 'menu' | 'gr' | 'neraca' | 'jobdesk' | 'stok';
const FOLD_STORAGE_KEY = 'sppg_ringkasan_lipatan';
// Halaman ini dipasang ulang setiap data tersinkron, jadi pilihan lipatan disimpan selama sesi
const readFolds = (): Partial<Record<FoldId, boolean>> => {
  try {
    return JSON.parse(sessionStorage.getItem(FOLD_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
};

const WIDE_QUERY = '(min-width: 1024px)';
const useIsWide = () => {
  const [wide, setWide] = useState(() => window.matchMedia(WIDE_QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(WIDE_QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
};

interface FoldHeadProps {
  id: FoldId;
  title: React.ReactNode;
  /** Keterangan di bawah judul pada layar lebar. */
  description?: React.ReactNode;
  /** Satu baris angka kunci pada judul lipatan di HP. */
  summary: React.ReactNode;
  summaryTone?: string;
  open: boolean;
  isWide: boolean;
  onToggle: (id: FoldId) => void;
  actions?: React.ReactNode;
}

const FoldHead: React.FC<FoldHeadProps> = ({ id, title, description, summary, summaryTone, open, isWide, onToggle, actions }) =>
  isWide ? (
    <div className={SECTION_HEAD}>
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {description && <p className="text-[11px] text-slate-600 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  ) : (
    <div className={open ? 'border-b border-slate-200' : ''}>
      <h2>
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-expanded={open}
          aria-controls={`lipatan-${id}`}
          className={`w-full flex items-center justify-between gap-3 px-4 py-3 min-h-[60px] text-left cursor-pointer ${FOCUS_INSET}`}
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800">{title}</span>
            <span className={`block text-xs mt-0.5 truncate ${summaryTone || 'text-slate-600'}`}>{summary}</span>
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>
      {open && actions && <div className="px-4 pb-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );

const formatDate = (iso: string, withWeekday = false) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    ...(withWeekday ? { weekday: 'long' as const } : {}),
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const namesPreview = (names: string[], max: number) =>
  names.slice(0, max).join(', ') + (names.length > max ? `, +${names.length - max} lainnya` : '');

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onRefreshData, onPrintReceiving }) => {
  const [items] = useState<ItemMaster[]>(() => warehouseDb.getItems());
  const [receivings] = useState<ReceivingDocument[]>(() => warehouseDb.getReceivings());
  const [equipment] = useState<EquipmentItem[]>(() => warehouseDb.getEquipment());
  const [opnames] = useState<StockOpnameSession[]>(() => warehouseDb.getOpnames());
  const [menuOrders] = useState<MenuOrder[]>(() => warehouseDb.getMenuOrders());
  const [selectedReceivingDoc, setSelectedReceivingDoc] = useState<ReceivingDocument | null>(null);

  // Search & filter state for stock triage table
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockCategoryFilter, setStockCategoryFilter] = useState<'ALL' | 'Bahan Basah' | 'Bahan Kering'>('ALL');
  const [triageFilter, setTriageFilter] = useState<TriageFilter>('ALL');

  const today = localDateIso();

  const isWide = useIsWide();
  const [folds, setFolds] = useState(readFolds);
  const isOpen = (id: FoldId) => isWide || (folds[id] ?? (id === 'po' && todayPoItems.length > 0));
  const toggleFold = (id: FoldId) => {
    const next = { ...folds, [id]: !isOpen(id) };
    setFolds(next);
    try {
      sessionStorage.setItem(FOLD_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Penyimpanan sesi diblokir: lipatan tetap berfungsi, hanya tidak diingat
    }
  };
  const foldProps = (id: FoldId) => ({ id, open: isOpen(id), isWide, onToggle: toggleFold });
  const [jobdeskStats, setJobdeskStats] = useState<{ total: number; done: number; overdue: number } | null>(null);

  // Rekap porsi hari ini; dibaca ulang saat data pengaturan tersinkron dari perangkat lain
  const [recapVersion, setRecapVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setRecapVersion(v => v + 1);
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, onChange);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todayRecap = useMemo(() => getBeneficiaryRecap(today), [today, recapVersion]);

  // Today's arrivals
  const todaysReceivings = useMemo(() => {
    return receivings.filter(r => r.date === today);
  }, [receivings, today]);

  // Stock alerts
  const lowStockItems = useMemo(() => {
    return items.filter(
      i => i.isActive && i.itemType !== 'EQUIPMENT' && i.currentStock > 0 && i.currentStock <= i.minimumStock
    );
  }, [items]);

  const outOfStockItems = useMemo(() => {
    return items.filter(
      i => i.isActive && i.itemType !== 'EQUIPMENT' && i.currentStock <= 0
    );
  }, [items]);

  // Opname approvals needed
  const pendingOpnames = useMemo(() => {
    return opnames.filter(o => o.status === 'PENDING_APPROVAL');
  }, [opnames]);

  // Equipment condition
  const damagedEquipment = useMemo(() => {
    return equipment.filter(e => e.condition === 'DAMAGED' || e.status === 'IN_REPAIR');
  }, [equipment]);

  const goodEquipmentCount = useMemo(() => {
    return equipment.filter(e => e.condition === 'GOOD').length;
  }, [equipment]);

  // Daily flow data. Totals only add up Kg items so mixed units never get summed together.
  const dailyFlow = useMemo(() => {
    return warehouseDb.getDailyFlowData(today);
  }, [today]);

  const kgFlow = dailyFlow.filter(d => (d.unit || '').toLowerCase() === 'kg');
  const nonKgFlowCount = dailyFlow.length - kgFlow.length;
  const totalFlowOpening = kgFlow.reduce((acc, d) => acc + d.openingBalance, 0);
  const totalFlowReceived = kgFlow.reduce((acc, d) => acc + d.receivedToday, 0);
  const totalFlowConsumed = kgFlow.reduce((acc, d) => acc + d.consumedToday, 0);
  const totalFlowRemaining = kgFlow.reduce((acc, d) => acc + d.closingBalance, 0);
  const formatKg = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });

  // Today's menu, or the most recent menu order when nothing is scheduled today
  const todaysMenu = menuOrders.find(m => m.date === today) || menuOrders[0];
  const isMenuToday = !!todaysMenu && todaysMenu.date === today;

  // Menu yang pesanan PO-nya terbentuk / dijadwalkan hari ini (dipesan H-1 untuk menu besok)
  const menuWithPoToday = useMemo(() => {
    return menuOrders.find(m => m.poDate === today || poDateForMenu(m.date) === today);
  }, [menuOrders, today]);

  // School Beneficiaries
  const schools = useMemo(() => {
    return warehouseDb.getSchoolBeneficiaries();
  }, []);

  // Total alert counter
  const totalAlertsCount = outOfStockItems.length + lowStockItems.length + pendingOpnames.length + damagedEquipment.length;

  // Filtered Stock Items for Table
  const filteredCriticalStock = useMemo(() => {
    const q = stockSearchQuery.toLowerCase();
    const list = [...outOfStockItems, ...lowStockItems];
    return list.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);
      // Kategori lama dari PO ("Protein", "Sayur") ikut terbaca sebagai Bahan Basah
      const matchCat = stockCategoryFilter === 'ALL' || normalizeToStandardCategory(item.category, item.name) === stockCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [outOfStockItems, lowStockItems, stockSearchQuery, stockCategoryFilter]);

  const STOCK_TABLE_LIMIT = 8;

  // Check ingredient stock availability for today's menu
  const menuIngredientsWithStock = useMemo(() => {
    if (!todaysMenu || !todaysMenu.keyIngredients) return [];
    return todaysMenu.keyIngredients.map(ing => {
      const ingName = (ing.itemName || ing.name || '').trim();
      const matched = items.find(
        i => ingName && (i.name.toLowerCase().includes(ingName.toLowerCase()) || ingName.toLowerCase().includes(i.name.toLowerCase()))
      );
      const reqQty = typeof ing.quantity === 'number' ? ing.quantity : parseFloat(String(ing.quantity)) || 0;
      const stockStatus: 'ENOUGH' | 'SHORT' | 'UNKNOWN' = !matched
        ? 'UNKNOWN'
        : matched.currentStock >= reqQty
        ? 'ENOUGH'
        : 'SHORT';
      return {
        ...ing,
        displayName: ingName,
        stockStatus,
      };
    });
  }, [todaysMenu, items]);

  const ingredientsReadyCount = menuIngredientsWithStock.filter(i => i.stockStatus === 'ENOUGH').length;

  // Purchase Orders state for today's PO tracking
  const [purchaseOrders] = useState<PurchaseOrderNota[]>(() => {
    try {
      return warehouseDb.getPurchaseOrders();
    } catch {
      return [];
    }
  });

  const [poFilter, setPoFilter] = useState<'ALL' | 'PENDING' | 'ARRIVED' | 'NOTES'>('ALL');

  interface TodayPoItemTrack {
    id: string;
    itemName: string;
    category: string;
    supplier?: string;
    qtyOrder: string;
    qtyArrived: string;
    status: 'ARRIVED' | 'PENDING' | 'PARTIAL';
    expectedTime?: string;
    notes?: string;
    poNumber?: string;
  }

  const todayPoItems: TodayPoItemTrack[] = useMemo(() => {
    const list: TodayPoItemTrack[] = [];
    const itemKeySet = new Set<string>();

    // 1. Dari Dokumen Purchase Order resmi yang tanggal PO / tanggal kedatangannya hari ini (prioritas utama)
    const todaysPos = purchaseOrders.filter(
      // PO restock barang non-menu ikut, karena sama-sama barang yang ditunggu datang hari ini
      po => isOrderedPurchaseOrder(po) && (po.date === today || po.deliveryDate === today)
    );

    todaysPos.forEach(po => {
      (po.items || []).forEach((it, idx) => {
        // Biaya tambahan (selep, kresek) bukan bahan yang ditunggu datang
        if (isExtraCostPoItem(it)) return;
        const key = `${it.name.toLowerCase()}_${(po.supplierName || '').toLowerCase()}`;
        if (!itemKeySet.has(key)) {
          itemKeySet.add(key);
          const isFinished = !isAwaitingDelivery(po);
          list.push({
            id: `official-po-${po.id}-${idx}`,
            itemName: it.name,
            category: it.category || 'Bahan makanan',
            supplier: po.supplierName || undefined,
            qtyOrder: `${it.quantity} ${it.unit}`,
            qtyArrived: isFinished ? `${it.quantity} ${it.unit}` : '-',
            status: isFinished ? 'ARRIVED' : 'PENDING',
            expectedTime: po.deliveryTerms?.includes('Jam')
              ? po.deliveryTerms.split('Jam')[1]?.replace(')', '').trim() || undefined
              : undefined,
            notes: it.notes || po.notes,
            poNumber: po.poNumber,
          });
        }
      });
    });

    // 2. Dari Rencana Menu yang PO-nya terbentuk hari ini (dipesan H-1 untuk menu besok) bila belum ada PO resmi
    if (menuWithPoToday && menuWithPoToday.poArrivalItems && menuWithPoToday.poArrivalItems.length > 0) {
      menuWithPoToday.poArrivalItems.forEach((p, idx) => {
        const key = `${p.itemName.toLowerCase()}_${(p.supplier || '').toLowerCase()}`;
        if (!itemKeySet.has(key)) {
          itemKeySet.add(key);
          const rawOrder = (p.qtyOrder || '').trim();
          const rawArrived = (p.qtyArrived || '').trim();
          const numOrder = parseFloat(rawOrder) || 0;
          const numArrived = parseFloat(rawArrived) || 0;

          let status: 'ARRIVED' | 'PENDING' | 'PARTIAL' = 'PENDING';
          if (numArrived > 0 && numArrived >= numOrder && numOrder > 0) {
            status = 'ARRIVED';
          } else if (numArrived > 0 && numArrived < numOrder) {
            status = 'PARTIAL';
          } else if (rawArrived && rawArrived !== '-' && rawArrived !== '0' && rawArrived.toLowerCase() !== 'belum') {
            status = 'ARRIVED';
          }

          list.push({
            id: `menu-po-${idx}`,
            itemName: p.itemName,
            category: p.category || 'Bahan makanan',
            supplier: p.supplier || undefined,
            qtyOrder: rawOrder || '-',
            qtyArrived: rawArrived || '-',
            status,
            expectedTime: p.arrivalTime || undefined,
            notes: p.notes,
          });
        }
      });
    }

    return list;
  }, [purchaseOrders, menuWithPoToday, today]);

  const pendingPoItems = useMemo(
    () => todayPoItems.filter(i => i.status === 'PENDING' || i.status === 'PARTIAL'),
    [todayPoItems]
  );
  const arrivedPoItems = useMemo(
    () => todayPoItems.filter(i => i.status === 'ARRIVED'),
    [todayPoItems]
  );

  // Satu kartu per supplier: petugas menunggu kiriman per supplier, bukan per bahan
  const poSupplierGroups = useMemo(() => {
    const groups = new Map<string, { key: string; supplier?: string; items: TodayPoItemTrack[] }>();
    todayPoItems.forEach(item => {
      const key = (item.supplier || '').trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, { key: key || '__none', supplier: item.supplier, items: [] });
      groups.get(key)!.items.push(item);
    });
    return [...groups.values()].map(g => {
      const arrived = g.items.filter(i => i.status === 'ARRIVED').length;
      const partial = g.items.some(i => i.status === 'PARTIAL');
      const status: TodayPoItemTrack['status'] = arrived === g.items.length ? 'ARRIVED' : arrived > 0 || partial ? 'PARTIAL' : 'PENDING';
      const times = g.items.map(i => i.expectedTime).filter((t): t is string => Boolean(t)).sort();
      return {
        ...g,
        arrived,
        status,
        expectedTime: times[0],
        poNumbers: [...new Set(g.items.map(i => i.poNumber).filter((n): n is string => Boolean(n)))],
        // Catatan PO ikut tersalin ke tiap bahan; cukup ditampilkan sekali per supplier
        notes: [...new Set(g.items.map(i => (i.notes || '').trim()).filter(Boolean))],
      };
    });
  }, [todayPoItems]);
  const arrivedSupplierCount = poSupplierGroups.filter(g => g.status === 'ARRIVED').length;
  const pendingSupplierCount = poSupplierGroups.length - arrivedSupplierCount;

  const displayedPoGroups = useMemo(() => {
    if (poFilter === 'PENDING') return poSupplierGroups.filter(g => g.status !== 'ARRIVED');
    if (poFilter === 'ARRIVED') return poSupplierGroups.filter(g => g.status === 'ARRIVED');
    if (poFilter === 'NOTES') return poSupplierGroups.filter(g => g.notes.length > 0);
    return poSupplierGroups;
  }, [poSupplierGroups, poFilter]);

  const triageTabs: { id: TriageFilter; label: string; count: number; active: string; idle: string }[] = [
    { id: 'ALL', label: 'Semua', count: totalAlertsCount, active: 'bg-slate-900 text-white', idle: 'text-slate-700 hover:bg-white' },
    { id: 'OUT_OF_STOCK', label: 'Stok habis', count: outOfStockItems.length, active: 'bg-rose-700 text-white', idle: 'text-rose-700 hover:bg-rose-50' },
    { id: 'LOW_STOCK', label: 'Stok menipis', count: lowStockItems.length, active: 'bg-amber-700 text-white', idle: 'text-amber-800 hover:bg-amber-50' },
    { id: 'OPNAME', label: 'Opname', count: pendingOpnames.length, active: 'bg-indigo-700 text-white', idle: 'text-indigo-700 hover:bg-indigo-50' },
    { id: 'EQUIPMENT', label: 'Alat', count: damagedEquipment.length, active: 'bg-slate-800 text-white', idle: 'text-slate-700 hover:bg-white' },
  ];

  // Satu sumber untuk dua tampilan: baris ringkas di HP, kartu di layar lebar
  const alerts: {
    id: Exclude<TriageFilter, 'ALL'>;
    icon: React.ElementType;
    label: string;
    count: string;
    title: string;
    hint: string;
    cta: string;
    target: string;
    border: string;
    chip: string;
    countTone: string;
    button: string;
  }[] = [];
  if (outOfStockItems.length > 0) {
    alerts.push({
      id: 'OUT_OF_STOCK',
      icon: XCircle,
      label: 'Stok habis',
      count: `${outOfStockItems.length} bahan`,
      title: namesPreview(outOfStockItems.map(i => i.name), 3),
      hint: 'Stok fisik 0. Segera buat nota pesanan (PO) ke supplier.',
      cta: 'Buka Stok Barang',
      target: 'inventory',
      border: 'border-rose-200',
      chip: 'bg-rose-50 text-rose-700',
      countTone: 'text-rose-700',
      button: 'bg-rose-700 hover:bg-rose-800',
    });
  }
  if (lowStockItems.length > 0) {
    alerts.push({
      id: 'LOW_STOCK',
      icon: AlertTriangle,
      label: 'Stok menipis',
      count: `${lowStockItems.length} bahan`,
      title: namesPreview(lowStockItems.map(i => i.name), 3),
      hint: 'Sudah mencapai batas minimum. Masukkan ke pesanan berikutnya.',
      cta: 'Buka Stok Barang',
      target: 'inventory',
      border: 'border-amber-200',
      chip: 'bg-amber-50 text-amber-800',
      countTone: 'text-amber-800',
      button: 'bg-amber-700 hover:bg-amber-800',
    });
  }
  if (pendingOpnames.length > 0) {
    alerts.push({
      id: 'OPNAME',
      icon: ClipboardCheck,
      label: 'Opname belum disetujui',
      count: `${pendingOpnames.length} sesi`,
      title: `Opname #${pendingOpnames[0].id}${pendingOpnames.length > 1 ? `, +${pendingOpnames.length - 1} lainnya` : ''}`,
      hint: `Diajukan oleh ${pendingOpnames[0].createdByName}. Menunggu persetujuan Kepala SPPG.`,
      cta: 'Periksa Opname',
      target: 'stock_opname',
      border: 'border-indigo-200',
      chip: 'bg-indigo-50 text-indigo-700',
      countTone: 'text-indigo-700',
      button: 'bg-indigo-700 hover:bg-indigo-800',
    });
  }
  if (damagedEquipment.length > 0) {
    alerts.push({
      id: 'EQUIPMENT',
      icon: Wrench,
      label: 'Alat dapur bermasalah',
      count: `${damagedEquipment.length} unit`,
      title: namesPreview(damagedEquipment.map(e => e.name), 2),
      hint: 'Tercatat rusak atau sedang diperbaiki.',
      cta: 'Lihat Aset Dapur',
      target: 'equipment',
      border: 'border-slate-300',
      chip: 'bg-slate-100 text-slate-800',
      countTone: 'text-slate-800',
      button: 'bg-slate-800 hover:bg-slate-900',
    });
  }

  const poTabs: { id: typeof poFilter; label: string; count: number }[] = [
    { id: 'ALL', label: 'Semua', count: poSupplierGroups.length },
    { id: 'PENDING', label: 'Belum tiba', count: pendingSupplierCount },
    { id: 'ARRIVED', label: 'Sudah tiba', count: arrivedSupplierCount },
    { id: 'NOTES', label: 'Ada catatan', count: poSupplierGroups.filter(g => g.notes.length > 0).length },
  ];

  return (
    <div className="space-y-3 lg:space-y-5">
      {/* Detail Physical Receiving Modal */}
      <ReceivingDetailModal
        document={selectedReceivingDoc}
        onClose={() => setSelectedReceivingDoc(null)}
        onPrint={onPrintReceiving}
      />

      {/* 1. HEADER & RINGKASAN HARI INI */}
      <section className={`${SECTION} p-4 sm:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 lg:gap-4">
          <div>
            <p className="text-[11px] text-slate-600 font-medium">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
              Ringkasan Gudang Hari Ini
            </h1>
            <p className="hidden sm:block text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
              Kedatangan bahan, stok yang perlu ditindaklanjuti, dan menu MBG
              {schools.length > 0 ? ` untuk ${schools.length} sekolah penerima.` : '.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" onClick={() => onNavigate('receiving')} className={`${BTN_PRIMARY} max-sm:w-full`}>
              <Plus className="w-4 h-4" />
              Catat Barang Masuk
            </button>
            {/* Di HP ketiga tujuan ini sudah ada di bilah navigasi bawah, jadi tidak diulang di sini */}
            <button type="button" onClick={() => onNavigate('menu_orders')} className={`${BTN_SECONDARY} max-sm:hidden`}>
              <ChefHat className="w-4 h-4 text-slate-500" />
              Menu & Sekolah
            </button>
            <button type="button" onClick={() => onNavigate('tools_forms')} className={`${BTN_SECONDARY} hidden lg:inline-flex`}>
              <Printer className="w-4 h-4 text-slate-500" />
              Cetak Form
            </button>
            <button type="button" onClick={() => onNavigate('website_cms')} className={`${BTN_SECONDARY} max-sm:hidden`}>
              <Globe className="w-4 h-4 text-slate-500" />
              Atur Website
            </button>
          </div>
        </div>

        {/* Pengingat porsi harian: rekap penerima manfaat per sekolah belum dicatat (Minggu dilewati) */}
        {!todayRecap && new Date().getDay() !== 0 && (
          <div role="note" className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-900">
            <span>
              <b>Porsi hari ini belum dicatat.</b> Isi jumlah penerima manfaat tiap sekolah dan tandai sekolah yang tidak dikirim.
            </span>
            <button type="button" onClick={() => onNavigate('menu_portions')} className={`${BTN_PRIMARY} shrink-0`}>
              Catat porsi hari ini
            </button>
          </div>
        )}

        {/* Key numbers: each tile answers one morning question, colored only when it needs attention */}
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 mt-4 sm:mt-5">
          <div className="rounded-lg bg-slate-50 p-3 sm:p-3.5">
            <dt className="text-[11px] text-slate-600 font-medium">Bahan PO sudah tiba</dt>
            <dd className="mt-1.5">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {arrivedPoItems.length}
              </span>
              <span className="text-xs text-slate-500 ml-1">dari {todayPoItems.length}</span>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {todaysReceivings.length} surat terima (GR) dicatat
              </p>
            </dd>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 sm:p-3.5">
            <dt className="text-[11px] text-slate-600 font-medium">Target porsi</dt>
            <dd className="mt-1.5">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
                {isMenuToday ? todaysMenu.targetPortions.toLocaleString('id-ID') : '-'}
              </span>
              <span className="text-xs text-slate-500 ml-1">porsi</span>
              <p className="text-[11px] text-slate-600 mt-0.5 truncate">
                {isMenuToday ? todaysMenu.menuTitle : 'Menu hari ini belum dibuat'}
              </p>
            </dd>
          </div>

          <div className={`rounded-lg p-3 sm:p-3.5 ${totalAlertsCount > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
            <dt className={`text-[11px] font-medium ${totalAlertsCount > 0 ? 'text-amber-800' : 'text-slate-600'}`}>
              Perlu ditindaklanjuti
            </dt>
            <dd className="mt-1.5">
              <span className={`text-2xl font-bold font-mono tabular-nums ${totalAlertsCount > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
                {totalAlertsCount}
              </span>
              <span className="text-xs text-slate-500 ml-1">hal</span>
              <p className={`text-[11px] mt-0.5 ${outOfStockItems.length > 0 ? 'text-rose-700 font-semibold' : 'text-slate-600'}`}>
                {outOfStockItems.length > 0 ? `${outOfStockItems.length} bahan stoknya habis` : 'Tidak ada stok habis'}
              </p>
            </dd>
          </div>

          <div className="rounded-lg bg-slate-50 p-3 sm:p-3.5">
            <dt className="text-[11px] text-slate-600 font-medium">Alat dapur siap pakai</dt>
            <dd className="mt-1.5">
              <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">{goodEquipmentCount}</span>
              <span className="text-xs text-slate-500 ml-1">dari {equipment.length}</span>
              <p className={`text-[11px] mt-0.5 ${damagedEquipment.length > 0 ? 'text-rose-700 font-semibold' : 'text-slate-600'}`}>
                {damagedEquipment.length > 0 ? `${damagedEquipment.length} rusak atau diperbaiki` : 'Tidak ada alat rusak'}
              </p>
            </dd>
          </div>
        </dl>
      </section>

      {/* 2. PERLU TINDAKAN */}
      <section className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Perlu Tindakan</h2>
            <p className="text-[11px] text-slate-600">
              {totalAlertsCount > 0
                ? `${totalAlertsCount} hal perlu dicek atau dipesan ulang hari ini.`
                : 'Stok, alat dapur, dan opname tidak ada masalah.'}
            </p>
          </div>

          {totalAlertsCount > 0 && (
            <div
              role="tablist"
              aria-label="Filter perlu tindakan"
              className="hidden md:flex flex-wrap items-center gap-1 bg-slate-200/70 p-1 rounded-lg self-start sm:self-auto"
            >
              {triageTabs
                .filter(t => t.id === 'ALL' || t.count > 0)
                .map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={triageFilter === t.id}
                    onClick={() => setTriageFilter(t.id)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${FOCUS} ${
                      triageFilter === t.id ? t.active : t.idle
                    }`}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
            </div>
          )}
        </div>

        {totalAlertsCount === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0" />
              <p className="text-xs text-emerald-900">
                Tidak ada stok habis atau menipis, tidak ada alat rusak, dan semua opname sudah disetujui.
              </p>
            </div>
            <button type="button" onClick={() => onNavigate('inventory')} className={BTN_SECONDARY}>
              Lihat Stok Barang
            </button>
          </div>
        ) : (
          <>
            {/* HP: satu baris per hal, seluruh baris bisa ditekan */}
            <ul className="md:hidden bg-white rounded-xl border border-slate-200 divide-y divide-slate-200 overflow-hidden">
              {alerts.map(a => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => onNavigate(a.target)}
                    className={`w-full flex items-center gap-3 px-4 py-3 min-h-[60px] text-left cursor-pointer active:bg-slate-50 ${FOCUS_INSET}`}
                  >
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${a.chip}`}>
                      <a.icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-900">{a.label}</span>
                        <span className={`font-mono text-xs font-bold tabular-nums shrink-0 ${a.countTone}`}>{a.count}</span>
                      </span>
                      <span className="block text-xs text-slate-600 truncate mt-0.5">{a.title}</span>
                    </span>
                    <span className="sr-only">{a.cta}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="hidden md:grid grid-cols-2 xl:grid-cols-4 gap-3">
              {alerts
                .filter(a => triageFilter === 'ALL' || triageFilter === a.id)
                .map(a => (
                  <div key={a.id} className={`p-4 rounded-xl bg-white border ${a.border} flex flex-col justify-between gap-3`}>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${a.chip}`}>
                          <a.icon className="w-3.5 h-3.5" />
                          {a.label}
                        </span>
                        <span className={`font-mono text-xs font-bold tabular-nums ${a.countTone}`}>{a.count}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900 leading-snug mt-2.5">{a.title}</p>
                      <p className="text-[11px] text-slate-600 mt-1 leading-normal">{a.hint}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate(a.target)}
                      className={`w-full px-3 py-2 rounded-lg text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${a.button} ${FOCUS}`}
                    >
                      {a.cta}
                    </button>
                  </div>
                ))}
            </div>
          </>
        )}
      </section>

      {/* 3. KEDATANGAN BAHAN PO HARI INI */}
      <section className={SECTION}>
        <FoldHead
          {...foldProps('po')}
          title="Kedatangan Bahan PO Hari Ini"
          description="Pesanan ke supplier, jumlah yang sudah ditimbang, dan catatan penanganan."
          summary={
            todayPoItems.length === 0
              ? 'Belum ada pesanan untuk hari ini'
              : pendingSupplierCount > 0
              ? `${arrivedPoItems.length}/${todayPoItems.length} bahan tiba, ${pendingSupplierCount} supplier belum lengkap`
              : `Semua ${todayPoItems.length} bahan sudah tiba`
          }
          summaryTone={pendingSupplierCount > 0 ? 'text-amber-800' : undefined}
          actions={
            <>
              <button type="button" onClick={() => onNavigate('receiving')} className={`${BTN_SECONDARY} max-sm:flex-1`}>
                Catat Timbangan
              </button>
              <button type="button" onClick={() => onNavigate('menu_orders')} className={`${BTN_SECONDARY} max-sm:flex-1`}>
                Kelola PO
              </button>
            </>
          }
        />

        <div id="lipatan-po" hidden={!isOpen('po')}>
        {todayPoItems.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <p className="text-xs font-semibold text-slate-800">Belum ada pesanan bahan untuk hari ini.</p>
            <p className="text-[11px] text-slate-600 mt-1 max-w-md mx-auto">
              Buat PO di halaman Menu, atau catat Belanja Non-Menu di Barang Masuk.
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Filter kedatangan bahan"
                className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg sm:self-start"
              >
                {poTabs.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={poFilter === t.id}
                    onClick={() => setPoFilter(t.id)}
                    className={`px-2.5 py-1.5 min-h-[44px] sm:min-h-0 rounded-md text-xs font-medium transition-colors cursor-pointer ${FOCUS} ${
                      poFilter === t.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>

              {/* Progress bar: the one place in this section that shows overall completion */}
              <div className="flex items-center gap-2.5 text-[11px] text-slate-600 md:w-64">
                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden" aria-hidden="true">
                  <div
                    className="h-full bg-emerald-600 rounded-full"
                    style={{ width: `${Math.round((arrivedPoItems.length / todayPoItems.length) * 100)}%` }}
                  />
                </div>
                <span className="shrink-0">
                  <strong className="font-mono text-slate-900">{arrivedPoItems.length}/{todayPoItems.length}</strong> bahan tiba
                </span>
              </div>
            </div>

            {pendingSupplierCount > 0 && poFilter !== 'PENDING' && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>{pendingSupplierCount} supplier</strong> belum tiba atau baru mengirim sebagian ({pendingPoItems.length} bahan).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPoFilter('PENDING')}
                  className={`text-amber-900 underline font-semibold text-xs sm:text-[11px] min-h-[44px] sm:min-h-0 inline-flex items-center self-start sm:self-auto hover:text-amber-950 cursor-pointer rounded-md ${FOCUS}`}
                >
                  Tampilkan yang belum tiba
                </button>
              </div>
            )}
            {pendingPoItems.length === 0 && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                Semua bahan pesanan hari ini sudah tiba.
              </div>
            )}

            {displayedPoGroups.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-600">Tidak ada supplier pada filter ini.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
                {displayedPoGroups.map(group => {
                  const isPending = group.status === 'PENDING';
                  const isPartial = group.status === 'PARTIAL';

                  return (
                    <div
                      key={group.key}
                      className={`p-3.5 rounded-xl border ${
                        isPending ? 'bg-white border-amber-200' : isPartial ? 'bg-white border-sky-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold ${
                            isPending ? 'bg-amber-50 text-amber-800' : isPartial ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {isPending ? 'Belum tiba' : isPartial ? 'Tiba sebagian' : 'Sudah tiba'}
                        </span>
                        <span className="font-mono text-slate-600 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {group.expectedTime || 'Jam belum diatur'}
                        </span>
                      </div>

                      <h3 className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900 leading-snug">
                        <Store className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className={`truncate ${group.supplier ? '' : 'text-slate-500 italic font-medium'}`}>
                          {group.supplier || 'Supplier belum diisi'}
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {group.items.length} bahan
                        {group.poNumbers.length > 0 && <span className="font-mono"> · {group.poNumbers.join(', ')}</span>}
                      </p>

                      <p className="mt-2 text-xs text-slate-700">
                        <strong className="font-mono text-slate-900">{group.arrived}/{group.items.length}</strong> bahan diterima
                      </p>

                      {group.notes.length > 0 && (
                        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 flex items-start gap-1.5 leading-snug">
                          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-px" />
                          <span className="min-w-0">
                            <strong className="font-semibold">Catatan:</strong> {group.notes.join(' · ')}
                          </span>
                        </div>
                      )}

                      <details className="group mt-2">
                        <summary className={`list-none flex items-center gap-1 text-xs font-medium text-emerald-800 hover:text-emerald-900 cursor-pointer rounded-md min-h-[44px] sm:min-h-0 sm:py-1 ${FOCUS}`}>
                          <span className="group-open:hidden">Lihat bahan</span>
                          <span className="hidden group-open:inline">Sembunyikan bahan</span>
                        </summary>
                        <ul className="mt-1.5 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                          {group.items.map(item => (
                            <li key={item.id} className="flex items-start justify-between gap-3 px-2.5 py-1.5 text-xs">
                              <span className="min-w-0">
                                <span className="text-slate-900">{item.itemName}</span>
                                {item.status !== 'ARRIVED' && (
                                  <span className={`ml-1.5 text-[11px] ${item.status === 'PARTIAL' ? 'text-sky-700' : 'text-amber-800'}`}>
                                    {item.status === 'PARTIAL' ? 'sebagian' : 'belum'}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 font-mono tabular-nums text-right">
                                <span className="text-slate-600">{item.qtyOrder}</span>
                                {item.qtyArrived !== '-' && <span className="text-slate-900"> → {item.qtyArrived}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </section>

      {/* 4. MENU HARI INI & PENERIMAAN BARANG */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-5">
        <div className={`lg:col-span-7 ${SECTION} flex flex-col`}>
          <FoldHead
            {...foldProps('menu')}
            title={isMenuToday || !todaysMenu ? 'Menu MBG Hari Ini' : 'Menu MBG Terakhir'}
            summary={
              isMenuToday
                ? `${todaysMenu.menuTitle} · ${todaysMenu.targetPortions.toLocaleString('id-ID')} porsi`
                : todaysMenu
                ? 'Menu hari ini belum dibuat'
                : 'Belum ada menu yang dibuat'
            }
            summaryTone={isMenuToday ? undefined : 'text-amber-800'}
            actions={
              <button type="button" onClick={() => onNavigate('menu_orders')} className={BTN_LINK}>
                Buka Menu & Sekolah
              </button>
            }
          />

          <div id="lipatan-menu" hidden={!isOpen('menu')} className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
            {todaysMenu ? (
              <>
                <div className="space-y-3">
                  {!isMenuToday && (
                    <p className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-[11px] text-sky-800">
                      Menu hari ini belum dibuat. Yang tampil adalah menu tanggal {formatDate(todaysMenu.date)}.
                    </p>
                  )}

                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 leading-snug">{todaysMenu.menuTitle}</h3>
                      <p className="text-[11px] text-slate-600 font-mono mt-0.5">Order #{todaysMenu.id}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono bg-slate-100 text-slate-800">
                      {todaysMenu.targetPortions.toLocaleString('id-ID')} porsi
                    </span>
                  </div>

                  {todaysMenu.menuDescription && (
                    <p className="text-xs text-slate-600 leading-relaxed">{todaysMenu.menuDescription}</p>
                  )}

                  {todaysMenu.specialDietB3 && (
                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950">
                      <strong className="font-semibold block mb-0.5">
                        Penyesuaian B3 (balita, ibu hamil, ibu menyusui)
                      </strong>
                      <span className="text-[11px] text-amber-900 leading-normal">{todaysMenu.specialDietB3}</span>
                    </div>
                  )}

                  {menuIngredientsWithStock.length > 0 && (
                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-2 text-[11px]">
                        <span className="font-semibold text-slate-700">Bahan utama dan stok gudang</span>
                        <span className="text-slate-600">
                          {ingredientsReadyCount} dari {menuIngredientsWithStock.length} cukup
                        </span>
                      </div>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {menuIngredientsWithStock.slice(0, 6).map((ing, idx) => (
                          <li key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">{ing.displayName || 'Bahan tanpa nama'}</div>
                              <div className="text-[11px] font-mono text-slate-600">
                                Butuh {ing.quantity} {ing.unit}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] font-semibold shrink-0 ${
                                ing.stockStatus === 'ENOUGH'
                                  ? 'bg-emerald-50 text-emerald-800'
                                  : ing.stockStatus === 'SHORT'
                                  ? 'bg-rose-50 text-rose-700'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {ing.stockStatus === 'ENOUGH' ? 'Cukup' : ing.stockStatus === 'SHORT' ? 'Kurang' : 'Tidak ada di stok'}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {menuIngredientsWithStock.length > 6 && (
                        <p className="text-[11px] text-slate-600 mt-2">
                          +{menuIngredientsWithStock.length - 6} bahan lain di halaman menu.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-slate-600">
                    Penanggung jawab: <strong className="text-slate-900">{todaysMenu.chefInCharge || 'Belum ditentukan'}</strong>
                  </span>
                  <button type="button" onClick={() => onNavigate('menu_print')} className={BTN_SECONDARY}>
                    <Printer className="w-3.5 h-3.5 text-slate-500" />
                    Cetak Menu
                  </button>
                </div>
              </>
            ) : (
              <div className="py-10 text-center">
                <p className="text-xs font-semibold text-slate-800">Belum ada menu yang dibuat.</p>
                <p className="text-[11px] text-slate-600 mt-1">Buat menu harian agar kebutuhan bahan bisa dicek terhadap stok.</p>
                <button type="button" onClick={() => onNavigate('menu_orders')} className={`${BTN_PRIMARY} mt-4`}>
                  <Plus className="w-3.5 h-3.5" />
                  Buat Menu
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`lg:col-span-5 ${SECTION} flex flex-col`}>
          <FoldHead
            {...foldProps('gr')}
            title={
              <>
                Barang Diterima Hari Ini{' '}
                <span className="font-mono text-slate-500 max-lg:hidden">({todaysReceivings.length})</span>
              </>
            }
            summary={
              todaysReceivings.length > 0
                ? `${todaysReceivings.length} surat terima (GR) dicatat`
                : 'Belum ada barang yang diterima'
            }
            actions={
              <button type="button" onClick={() => onNavigate('receiving')} className={BTN_LINK}>
                Lihat Semua GR
              </button>
            }
          />

          <div id="lipatan-gr" hidden={!isOpen('gr')} className="p-4 sm:p-5 flex-1">
            {todaysReceivings.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-xs font-semibold text-slate-800">Belum ada barang yang diterima hari ini.</p>
                <p className="text-[11px] text-slate-600 mt-1 max-w-xs mx-auto">
                  Catat setiap kiriman bahan basah atau kering dari supplier supaya stok bertambah.
                </p>
                <button type="button" onClick={() => onNavigate('receiving')} className={`${BTN_PRIMARY} mt-4`}>
                  <Plus className="w-3.5 h-3.5" />
                  Catat Barang Masuk
                </button>
              </div>
            ) : (
              <ul className="space-y-2 lg:max-h-[380px] lg:overflow-y-auto lg:pr-1">
                {todaysReceivings.map(doc => (
                  <li
                    key={doc.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] font-mono">
                        <span className="font-semibold text-emerald-800">{doc.id}</span>
                        <span className="text-slate-600">{doc.arrivalTime} WIB</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 truncate mt-0.5">{doc.supplierName}</div>
                      <div className="text-[11px] text-slate-600 truncate mt-0.5">
                        {doc.lines.map(l => `${l.itemName} (${l.quantity} ${l.unit})`).join(', ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedReceivingDoc(doc)}
                      className={`px-3 text-[11px] font-semibold text-emerald-800 bg-white hover:bg-emerald-50 rounded-lg border border-slate-300 transition-colors shrink-0 cursor-pointer min-h-[44px] sm:min-h-[32px] ${FOCUS}`}
                    >
                      Detail
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* 5. NERACA BAHAN HARIAN (stok awal + masuk - terpakai = sisa) */}
      <section className={SECTION}>
        <FoldHead
          {...foldProps('neraca')}
          title="Neraca Bahan Harian"
          description={
            <>
              Bahan basah (protein, sayur, buah) dalam kg.
              {nonKgFlowCount > 0 && ` ${nonKgFlowCount} bahan bersatuan selain kg tidak ikut dijumlah.`}
            </>
          }
          summary={
            kgFlow.length === 0
              ? 'Belum ada bahan basah yang dicatat'
              : `Sisa ${formatKg(totalFlowRemaining)} kg, terpakai ${formatKg(totalFlowConsumed)} kg`
          }
          actions={
            <button type="button" onClick={() => onNavigate('daily_flow')} className={BTN_LINK}>
              Buka Barang Keluar
            </button>
          }
        />

        <div id="lipatan-neraca" hidden={!isOpen('neraca')}>
        {!isWide && nonKgFlowCount > 0 && (
          <p className="px-4 pt-3 text-xs text-slate-600">
            Dalam kg. {nonKgFlowCount} bahan bersatuan selain kg tidak ikut dijumlah.
          </p>
        )}
        {kgFlow.length === 0 ? (
          <p className="py-8 px-4 text-center text-xs text-slate-600">Belum ada bahan basah yang dicatat di Barang Keluar.</p>
        ) : (
          <dl className="grid grid-cols-2 md:grid-cols-4 text-xs">
            {[
              { label: 'Stok awal', value: totalFlowOpening, sign: '', tone: 'text-slate-900' },
              { label: 'Masuk hari ini', value: totalFlowReceived, sign: '+', tone: 'text-emerald-800' },
              { label: 'Terpakai di dapur', value: totalFlowConsumed, sign: '−', tone: 'text-slate-900' },
              { label: 'Sisa stok', value: totalFlowRemaining, sign: '=', tone: 'text-slate-900' },
            ].map((row, idx) => (
              <div
                key={row.label}
                className={`p-4 sm:px-5 border-slate-200 ${idx % 2 === 1 ? 'border-l' : ''} ${idx >= 2 ? 'border-t md:border-t-0' : ''} ${idx === 2 ? 'md:border-l' : ''} ${idx === 3 ? 'bg-slate-50' : ''}`}
              >
                <dt className="text-[11px] text-slate-600 font-medium">{row.label}</dt>
                <dd className={`mt-1 font-mono tabular-nums text-xl font-bold ${row.tone}`}>
                  {row.sign && <span className="text-slate-500 font-normal mr-1" aria-hidden="true">{row.sign}</span>}
                  {formatKg(row.value)}
                  <span className="text-xs font-normal text-slate-500 ml-1">kg</span>
                </dd>
              </div>
            ))}
          </dl>
        )}
        </div>
      </section>

      {/* 6. CHECKLIST TUGAS OPERASIONAL & SOP HARIAN SPPG */}
      <section className="space-y-2">
        {/* Widget punya judul sendiri di layar lebar. Di HP hanya disembunyikan, tidak dilepas, supaya pengingat jam tetap berbunyi. */}
        {!isWide && (
          <div className={SECTION}>
            <FoldHead
              {...foldProps('jobdesk')}
              title="Jobdesk Hari Ini"
              summary={
                !jobdeskStats || jobdeskStats.total === 0
                  ? 'Belum ada jobdesk untuk hari ini'
                  : `${jobdeskStats.done} dari ${jobdeskStats.total} selesai${jobdeskStats.overdue > 0 ? `, ${jobdeskStats.overdue} lewat target jam` : ''}`
              }
              summaryTone={jobdeskStats && jobdeskStats.overdue > 0 ? 'text-rose-700' : undefined}
            />
          </div>
        )}
        <div id="lipatan-jobdesk" hidden={!isOpen('jobdesk')}>
          <DailyChecklistWidget
            onNavigateToProfileTodos={() => onNavigate('profile')}
            onStats={setJobdeskStats}
          />
        </div>
      </section>

      {/* 7. TABEL STOK HABIS & MENIPIS */}
      <section className={SECTION}>
        <FoldHead
          {...foldProps('stok')}
          title="Stok Habis & Menipis"
          description="Bahan dengan stok 0 atau sudah mencapai batas minimum."
          summary={
            outOfStockItems.length + lowStockItems.length === 0
              ? 'Tidak ada stok habis atau menipis'
              : `${outOfStockItems.length} habis, ${lowStockItems.length} menipis`
          }
          summaryTone={outOfStockItems.length > 0 ? 'text-rose-700' : lowStockItems.length > 0 ? 'text-amber-800' : undefined}
          actions={
            <>
              <div className="relative flex-1 min-w-[140px] sm:flex-none">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  type="search"
                  value={stockSearchQuery}
                  onChange={e => setStockSearchQuery(e.target.value)}
                  placeholder="Cari nama, kode, lokasi"
                  aria-label="Cari bahan"
                  className={`w-full sm:w-52 pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-500 min-h-[44px] sm:min-h-[36px] ${FOCUS}`}
                />
              </div>
              <Select
                value={stockCategoryFilter}
                onChange={e => setStockCategoryFilter(e.target.value as 'ALL' | 'Bahan Basah' | 'Bahan Kering')}
                aria-label="Filter kategori">
                <option value="ALL">Semua kategori</option>
                <option value="Bahan Basah">Bahan Basah</option>
                <option value="Bahan Kering">Bahan Kering</option>
              </Select>
            </>
          }
        />

        <div id="lipatan-stok" hidden={!isOpen('stok')}>
        {/* HP: daftar, karena tabel enam kolom harus digeser ke samping */}
        <ul className="sm:hidden divide-y divide-slate-100">
          {filteredCriticalStock.length === 0 ? (
            <li className="py-8 px-4 text-center text-xs text-slate-900 font-semibold">
              {stockSearchQuery || stockCategoryFilter !== 'ALL'
                ? 'Tidak ada bahan yang cocok dengan pencarian.'
                : 'Tidak ada stok habis atau menipis.'}
            </li>
          ) : (
            filteredCriticalStock.slice(0, STOCK_TABLE_LIMIT).map(item => {
              const isOut = item.currentStock <= 0;
              return (
                <li key={item.id} className="px-4 py-3 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{item.name}</div>
                    <div className="text-slate-600 mt-0.5">
                      {item.category} · <span className="font-mono">{item.location}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={`font-mono font-semibold tabular-nums ${isOut ? 'text-rose-700' : 'text-amber-800'}`}>
                      {item.currentStock.toLocaleString('id-ID')} {item.baseUnit}
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      {isOut ? 'Habis' : 'Menipis'}, min. <span className="font-mono tabular-nums">{item.minimumStock.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-4">Bahan</th>
                <th className="py-2.5 px-4">Kategori</th>
                <th className="py-2.5 px-4">Lokasi</th>
                <th className="py-2.5 px-4 text-right">Stok</th>
                <th className="py-2.5 px-4 text-right">Minimum</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCriticalStock.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center">
                    <span className="font-semibold block text-xs text-slate-900">
                      {stockSearchQuery || stockCategoryFilter !== 'ALL'
                        ? 'Tidak ada bahan yang cocok dengan pencarian.'
                        : 'Tidak ada stok habis atau menipis.'}
                    </span>
                    {(stockSearchQuery || stockCategoryFilter !== 'ALL') && (
                      <span className="text-[11px] text-slate-600 mt-0.5 block">Coba kata kunci atau kategori lain.</span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredCriticalStock.slice(0, STOCK_TABLE_LIMIT).map(item => {
                  const isOut = item.currentStock <= 0;
                  const ratio = Math.min(100, Math.round((item.currentStock / Math.max(item.minimumStock, 1)) * 100));

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{item.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{item.id}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{item.category}</td>
                      <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">{item.location}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        <span className={isOut ? 'text-rose-700' : 'text-amber-800'}>
                          {item.currentStock.toLocaleString('id-ID')} {item.baseUnit}
                        </span>
                        {!isOut && (
                          <div className="text-[11px] font-normal text-slate-500">{ratio}% dari minimum</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 text-[11px]">
                        {item.minimumStock.toLocaleString('id-ID')} {item.baseUnit}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            isOut ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {isOut ? 'Habis' : 'Menipis'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <span>
            {filteredCriticalStock.length > STOCK_TABLE_LIMIT
              ? `Menampilkan ${STOCK_TABLE_LIMIT} dari ${filteredCriticalStock.length} bahan.`
              : `${filteredCriticalStock.length} bahan.`}
          </span>
          <button type="button" onClick={() => onNavigate('inventory')} className={BTN_LINK}>
            Buka Stok Barang
          </button>
        </div>
        </div>
      </section>
    </div>
  );
};
