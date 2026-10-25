import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { ReceivingDetailModal } from './ReceivingDetailModal';
import { DailyChecklistWidget } from './DailyChecklistWidget';
import { localDateIso } from '../utils/localDate';
import { isAwaitingDelivery, isMenuPurchaseOrder } from '../utils/poSupplier';

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
      const matchCat = stockCategoryFilter === 'ALL' || item.category === stockCategoryFilter;
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

    // 1. Dari Rencana Menu hari ini (poArrivalItems)
    if (isMenuToday && todaysMenu.poArrivalItems && todaysMenu.poArrivalItems.length > 0) {
      todaysMenu.poArrivalItems.forEach((p, idx) => {
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

        const key = `${p.itemName.toLowerCase()}_${(p.supplier || '').toLowerCase()}`;
        itemKeySet.add(key);

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
      });
    }

    // 2. Dari Dokumen Purchase Order resmi untuk hari ini
    const todaysPos = purchaseOrders.filter(
      // Hanya pesanan dari menu; nota dari penerimaan/belanja yang sudah terjadi bukan barang yang ditunggu
      po => isMenuPurchaseOrder(po) && (po.deliveryDate === today || po.date === today)
    );

    todaysPos.forEach(po => {
      (po.items || []).forEach((it, idx) => {
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

    return list;
  }, [todaysMenu, isMenuToday, purchaseOrders, today]);

  const pendingPoItems = useMemo(
    () => todayPoItems.filter(i => i.status === 'PENDING' || i.status === 'PARTIAL'),
    [todayPoItems]
  );
  const arrivedPoItems = useMemo(
    () => todayPoItems.filter(i => i.status === 'ARRIVED'),
    [todayPoItems]
  );
  const itemsWithNotes = useMemo(
    () => todayPoItems.filter(i => i.notes && i.notes.trim() !== ''),
    [todayPoItems]
  );

  const displayedPoItems = useMemo(() => {
    if (poFilter === 'PENDING') return pendingPoItems;
    if (poFilter === 'ARRIVED') return arrivedPoItems;
    if (poFilter === 'NOTES') return itemsWithNotes;
    return todayPoItems;
  }, [todayPoItems, poFilter, pendingPoItems, arrivedPoItems, itemsWithNotes]);

  const triageTabs: { id: TriageFilter; label: string; count: number; active: string; idle: string }[] = [
    { id: 'ALL', label: 'Semua', count: totalAlertsCount, active: 'bg-slate-900 text-white', idle: 'text-slate-700 hover:bg-white' },
    { id: 'OUT_OF_STOCK', label: 'Stok habis', count: outOfStockItems.length, active: 'bg-rose-700 text-white', idle: 'text-rose-700 hover:bg-rose-50' },
    { id: 'LOW_STOCK', label: 'Stok menipis', count: lowStockItems.length, active: 'bg-amber-700 text-white', idle: 'text-amber-800 hover:bg-amber-50' },
    { id: 'OPNAME', label: 'Opname', count: pendingOpnames.length, active: 'bg-indigo-700 text-white', idle: 'text-indigo-700 hover:bg-indigo-50' },
    { id: 'EQUIPMENT', label: 'Alat', count: damagedEquipment.length, active: 'bg-slate-800 text-white', idle: 'text-slate-700 hover:bg-white' },
  ];

  const poTabs: { id: typeof poFilter; label: string; count: number }[] = [
    { id: 'ALL', label: 'Semua', count: todayPoItems.length },
    { id: 'PENDING', label: 'Belum tiba', count: pendingPoItems.length },
    { id: 'ARRIVED', label: 'Sudah tiba', count: arrivedPoItems.length },
    { id: 'NOTES', label: 'Ada catatan', count: itemsWithNotes.length },
  ];

  return (
    <div className="space-y-5">
      {/* Detail Physical Receiving Modal */}
      <ReceivingDetailModal
        document={selectedReceivingDoc}
        onClose={() => setSelectedReceivingDoc(null)}
        onPrint={onPrintReceiving}
      />

      {/* 1. HEADER & RINGKASAN HARI INI */}
      <section className={`${SECTION} p-4 sm:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] text-slate-600 font-medium">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
              Ringkasan Gudang Hari Ini
            </h1>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
              Kedatangan bahan, stok yang perlu ditindaklanjuti, dan menu MBG
              {schools.length > 0 ? ` untuk ${schools.length} sekolah penerima.` : '.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" onClick={() => onNavigate('receiving')} className={BTN_PRIMARY}>
              <Plus className="w-4 h-4" />
              Catat Barang Masuk
            </button>
            <button type="button" onClick={() => onNavigate('menu_orders')} className={BTN_SECONDARY}>
              <ChefHat className="w-4 h-4 text-slate-500" />
              Menu & Sekolah
            </button>
            <button type="button" onClick={() => onNavigate('tools_forms')} className={BTN_SECONDARY}>
              <Printer className="w-4 h-4 text-slate-500" />
              Cetak Form
            </button>
            <button type="button" onClick={() => onNavigate('website_cms')} className={BTN_SECONDARY}>
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
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-5">
          <div className="rounded-lg bg-slate-50 p-3.5">
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

          <div className="rounded-lg bg-slate-50 p-3.5">
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

          <div className={`rounded-lg p-3.5 ${totalAlertsCount > 0 ? 'bg-amber-50' : 'bg-slate-50'}`}>
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

          <div className="rounded-lg bg-slate-50 p-3.5">
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
              className="flex flex-wrap items-center gap-1 bg-slate-200/70 p-1 rounded-lg self-start sm:self-auto"
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {(triageFilter === 'ALL' || triageFilter === 'OUT_OF_STOCK') && outOfStockItems.length > 0 && (
              <div className="p-4 rounded-xl bg-white border border-rose-200 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-50 text-rose-700">
                      <XCircle className="w-3.5 h-3.5" />
                      Stok habis
                    </span>
                    <span className="font-mono text-xs font-bold text-rose-700 tabular-nums">
                      {outOfStockItems.length} bahan
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 leading-snug mt-2.5">
                    {namesPreview(outOfStockItems.map(i => i.name), 3)}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                    Stok fisik 0. Segera buat nota pesanan (PO) ke supplier.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className={`w-full px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${FOCUS}`}
                >
                  Buka Stok Barang
                </button>
              </div>
            )}

            {(triageFilter === 'ALL' || triageFilter === 'LOW_STOCK') && lowStockItems.length > 0 && (
              <div className="p-4 rounded-xl bg-white border border-amber-200 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Stok menipis
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-800 tabular-nums">
                      {lowStockItems.length} bahan
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 leading-snug mt-2.5">
                    {namesPreview(lowStockItems.map(i => i.name), 3)}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                    Sudah mencapai batas minimum. Masukkan ke pesanan berikutnya.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className={`w-full px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${FOCUS}`}
                >
                  Buka Stok Barang
                </button>
              </div>
            )}

            {(triageFilter === 'ALL' || triageFilter === 'OPNAME') && pendingOpnames.length > 0 && (
              <div className="p-4 rounded-xl bg-white border border-indigo-200 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700">
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      Opname belum disetujui
                    </span>
                    <span className="font-mono text-xs font-bold text-indigo-700 tabular-nums">
                      {pendingOpnames.length} sesi
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 leading-snug mt-2.5">
                    Opname #{pendingOpnames[0].id}
                    {pendingOpnames.length > 1 && `, +${pendingOpnames.length - 1} lainnya`}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                    Diajukan oleh {pendingOpnames[0].createdByName}. Menunggu persetujuan Kepala SPPG.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('stock_opname')}
                  className={`w-full px-3 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${FOCUS}`}
                >
                  Periksa Opname
                </button>
              </div>
            )}

            {(triageFilter === 'ALL' || triageFilter === 'EQUIPMENT') && damagedEquipment.length > 0 && (
              <div className="p-4 rounded-xl bg-white border border-slate-300 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800">
                      <Wrench className="w-3.5 h-3.5" />
                      Alat dapur bermasalah
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800 tabular-nums">
                      {damagedEquipment.length} unit
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 leading-snug mt-2.5">
                    {namesPreview(damagedEquipment.map(e => e.name), 2)}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                    Tercatat rusak atau sedang diperbaiki.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('equipment')}
                  className={`w-full px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px] ${FOCUS}`}
                >
                  Lihat Aset Dapur
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. KEDATANGAN BAHAN PO HARI INI */}
      <section className={SECTION}>
        <div className={SECTION_HEAD}>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Kedatangan Bahan PO Hari Ini</h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Pesanan ke supplier, jumlah yang sudah ditimbang, dan catatan penanganan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => onNavigate('receiving')} className={BTN_SECONDARY}>
              Catat Timbangan
            </button>
            <button type="button" onClick={() => onNavigate('menu_orders')} className={BTN_SECONDARY}>
              Kelola PO
            </button>
          </div>
        </div>

        {todayPoItems.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <p className="text-xs font-semibold text-slate-800">Belum ada pesanan bahan untuk hari ini.</p>
            <p className="text-[11px] text-slate-600 mt-1 max-w-md mx-auto">
              Buat PO di halaman Menu, atau terima barang tanpa PO di Barang Masuk.
            </p>
          </div>
        ) : (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Filter kedatangan bahan"
                className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg self-start"
              >
                {poTabs.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={poFilter === t.id}
                    onClick={() => setPoFilter(t.id)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${FOCUS} ${
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
                  <strong className="font-mono text-slate-900">{arrivedPoItems.length}/{todayPoItems.length}</strong> tiba
                </span>
              </div>
            </div>

            {pendingPoItems.length > 0 && poFilter !== 'PENDING' && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    <strong>{pendingPoItems.length} bahan</strong> belum tiba atau baru tiba sebagian.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setPoFilter('PENDING')}
                  className={`text-amber-900 underline font-semibold text-[11px] self-start sm:self-auto hover:text-amber-950 cursor-pointer rounded-md ${FOCUS}`}
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

            {displayedPoItems.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-600">Tidak ada bahan pada filter ini.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {displayedPoItems.map(item => {
                  const isPending = item.status === 'PENDING';
                  const isPartial = item.status === 'PARTIAL';
                  const isArrived = item.status === 'ARRIVED';

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border ${
                        isPending ? 'bg-white border-amber-200' : isPartial ? 'bg-white border-sky-200' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-md font-semibold ${
                            isPending
                              ? 'bg-amber-50 text-amber-800'
                              : isPartial
                              ? 'bg-sky-50 text-sky-700'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {isPending ? 'Belum tiba' : isPartial ? 'Tiba sebagian' : 'Sudah tiba'}
                        </span>
                        <span className="font-mono text-slate-600 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {item.expectedTime || 'Jam belum diatur'}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-slate-900 leading-snug mt-2.5">{item.itemName}</h3>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {item.category}
                        {item.poNumber && <span className="font-mono"> · {item.poNumber}</span>}
                      </p>

                      <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-700">
                        <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className={`truncate ${item.supplier ? 'font-semibold' : 'text-slate-500 italic'}`}>
                          {item.supplier || 'Supplier belum diisi'}
                        </span>
                      </p>

                      <dl className="mt-2 grid grid-cols-2 gap-2 p-2 rounded-lg bg-white border border-slate-200 text-xs">
                        <div>
                          <dt className="text-[11px] text-slate-600">Dipesan</dt>
                          <dd className="font-semibold font-mono text-slate-900">{item.qtyOrder}</dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-600">Diterima</dt>
                          <dd
                            className={`font-semibold font-mono ${
                              isArrived ? 'text-emerald-700' : isPartial ? 'text-sky-700' : 'text-slate-500'
                            }`}
                          >
                            {item.qtyArrived}
                          </dd>
                        </div>
                      </dl>

                      {item.notes && item.notes.trim() !== '' && (
                        <div className="mt-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-950 flex items-start gap-1.5 leading-snug">
                          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-px" />
                          <span>
                            <strong className="font-semibold">Catatan:</strong> {item.notes}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 4. MENU HARI INI & PENERIMAAN BARANG */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className={`lg:col-span-7 ${SECTION} flex flex-col`}>
          <div className={SECTION_HEAD}>
            <h2 className="text-sm font-semibold text-slate-800">
              {isMenuToday || !todaysMenu ? 'Menu MBG Hari Ini' : 'Menu MBG Terakhir'}
            </h2>
            <button type="button" onClick={() => onNavigate('menu_orders')} className={BTN_LINK}>
              Buka Menu & Sekolah
            </button>
          </div>

          <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
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
          <div className={SECTION_HEAD}>
            <h2 className="text-sm font-semibold text-slate-800">
              Barang Diterima Hari Ini{' '}
              <span className="font-mono text-slate-500">({todaysReceivings.length})</span>
            </h2>
            <button type="button" onClick={() => onNavigate('receiving')} className={BTN_LINK}>
              Lihat Semua GR
            </button>
          </div>

          <div className="p-4 sm:p-5 flex-1">
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
              <ul className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
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
        <div className={SECTION_HEAD}>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Neraca Bahan Harian</h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Bahan segar (protein, sayur, buah) dalam kg.
              {nonKgFlowCount > 0 && ` ${nonKgFlowCount} bahan bersatuan selain kg tidak ikut dijumlah.`}
            </p>
          </div>
          <button type="button" onClick={() => onNavigate('daily_flow')} className={BTN_LINK}>
            Buka Barang Keluar
          </button>
        </div>

        {kgFlow.length === 0 ? (
          <p className="py-8 px-4 text-center text-xs text-slate-600">Belum ada bahan segar yang dicatat di Barang Keluar.</p>
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
      </section>

      {/* 6. CHECKLIST TUGAS OPERASIONAL & SOP HARIAN SPPG */}
      <section>
        <DailyChecklistWidget
          onNavigateToProfileTodos={() => onNavigate('profile')}
        />
      </section>

      {/* 7. TABEL STOK HABIS & MENIPIS */}
      <section className={SECTION}>
        <div className={`${SECTION_HEAD} lg:flex-row`}>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Stok Habis & Menipis</h2>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Bahan dengan stok 0 atau sudah mencapai batas minimum.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
          </div>
        </div>

        <div className="overflow-x-auto">
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
      </section>
    </div>
  );
};
