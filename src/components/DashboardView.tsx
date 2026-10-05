import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  ItemMaster,
  ReceivingDocument,
  EquipmentItem,
  StockOpnameSession,
  MenuOrder,
  PurchaseOrderNota,
} from '../types/warehouse';
import {
  Truck,
  Package,
  AlertTriangle,
  Wrench,
  Utensils,
  ClipboardCheck,
  CheckCircle2,
  TrendingDown,
  Clock,
  Plus,
  Boxes,
  ChefHat,
  Calendar,
  Building2,
  FileText,
  Printer,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  XCircle,
  ThermometerSnowflake,
  Search,
  ArrowRight,
  Layers,
  ArrowUpRight,
  Activity,
  Filter,
  ShoppingBag,
  Store,
  Info,
} from 'lucide-react';
import { ReceivingDetailModal } from './ReceivingDetailModal';
import { DailyChecklistWidget } from './DailyChecklistWidget';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onRefreshData?: () => void;
}

type TriageFilter = 'ALL' | 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OPNAME' | 'EQUIPMENT';

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onRefreshData }) => {
  const { currentUser } = useAuth();

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

  const today = new Date().toISOString().slice(0, 10);

  // Today's arrivals
  const todaysReceivings = useMemo(() => {
    return receivings.filter(r => r.date === today);
  }, [receivings, today]);

  const totalReceivedItemsCount = useMemo(() => {
    return todaysReceivings.reduce(
      (acc, r) => acc + r.lines.reduce((lAcc, line) => lAcc + line.quantity, 0),
      0
    );
  }, [todaysReceivings]);

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

  const needsInspectionEquipment = useMemo(() => {
    return equipment.filter(e => e.condition === 'NEEDS_INSPECTION');
  }, [equipment]);

  const goodEquipmentCount = useMemo(() => {
    return equipment.filter(e => e.condition === 'GOOD').length;
  }, [equipment]);

  // Daily flow data
  const dailyFlow = useMemo(() => {
    return warehouseDb.getDailyFlowData(today);
  }, [today]);

  const totalFlowReceived = dailyFlow.reduce((acc, d) => acc + d.receivedToday, 0);
  const totalFlowConsumed = dailyFlow.reduce((acc, d) => acc + d.consumedToday, 0);
  const totalFlowRemaining = dailyFlow.reduce((acc, d) => acc + d.closingBalance, 0);

  // Today's active menu or latest scheduled menu order
  const todaysMenu = menuOrders.find(m => m.date === today) || menuOrders[0];

  // School Beneficiaries
  const schools = useMemo(() => {
    return warehouseDb.getSchoolBeneficiaries();
  }, []);
  const totalTargetStudents = useMemo(() => {
    return schools.reduce((acc, s) => acc + (s.portionCount || 0), 0);
  }, [schools]);

  // Total alert counter
  const totalAlertsCount = outOfStockItems.length + lowStockItems.length + pendingOpnames.length + damagedEquipment.length;

  // Filtered Stock Items for Table
  const filteredCriticalStock = useMemo(() => {
    const list = [...outOfStockItems, ...lowStockItems];
    return list.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(stockSearchQuery.toLowerCase()) ||
        item.id.toLowerCase().includes(stockSearchQuery.toLowerCase());
      const matchCat = stockCategoryFilter === 'ALL' || item.category === stockCategoryFilter;
      return matchSearch && matchCat;
    });
  }, [outOfStockItems, lowStockItems, stockSearchQuery, stockCategoryFilter]);

  // Check ingredient stock availability for today's menu
  const menuIngredientsWithStock = useMemo(() => {
    if (!todaysMenu || !todaysMenu.keyIngredients) return [];
    return todaysMenu.keyIngredients.map(ing => {
      const ingName = (ing.itemName || ing.name || '').trim();
      const matched = items.find(
        i => ingName && (i.name.toLowerCase().includes(ingName.toLowerCase()) || ingName.toLowerCase().includes(i.name.toLowerCase()))
      );
      const reqQty = typeof ing.quantity === 'number' ? ing.quantity : parseFloat(String(ing.quantity)) || 0;
      return {
        ...ing,
        displayName: ingName,
        currentStock: matched ? matched.currentStock : null,
        isSufficient: matched ? matched.currentStock >= reqQty : true,
      };
    });
  }, [todaysMenu, items]);

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
    supplier: string;
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
    if (todaysMenu && todaysMenu.poArrivalItems && todaysMenu.poArrivalItems.length > 0) {
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
          category: p.category || 'Bahan Makanan',
          supplier: p.supplier || 'Pemasok Rekanan',
          qtyOrder: rawOrder || '-',
          qtyArrived: rawArrived || '-',
          status,
          expectedTime: p.arrivalTime || '08.00-11.00',
          notes: p.notes,
        });
      });
    }

    // 2. Dari Dokumen Purchase Order resmi untuk hari ini
    const todaysPos = purchaseOrders.filter(
      po => po.deliveryDate === today || po.date === today
    );

    todaysPos.forEach(po => {
      (po.items || []).forEach((it, idx) => {
        const key = `${it.name.toLowerCase()}_${(po.supplierName || '').toLowerCase()}`;
        if (!itemKeySet.has(key)) {
          itemKeySet.add(key);
          const isFinished = po.status === 'SELESAI';
          list.push({
            id: `official-po-${po.id}-${idx}`,
            itemName: it.name,
            category: it.category || 'Bahan Makanan',
            supplier: po.supplierName,
            qtyOrder: `${it.quantity} ${it.unit}`,
            qtyArrived: isFinished ? `${it.quantity} ${it.unit}` : '-',
            status: isFinished ? 'ARRIVED' : 'PENDING',
            expectedTime: po.deliveryTerms?.includes('Jam')
              ? po.deliveryTerms.split('Jam')[1]?.replace(')', '').trim()
              : '12.00-15.00',
            notes: it.notes || po.notes,
            poNumber: po.poNumber,
          });
        }
      });
    });

    return list;
  }, [todaysMenu, purchaseOrders, today]);

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

  return (
    <div className="space-y-6">
      {/* Detail Physical Receiving Modal */}
      <ReceivingDetailModal
        document={selectedReceivingDoc}
        onClose={() => setSelectedReceivingDoc(null)}
      />

      {/* 1. HERO OPERATIONAL COMMAND COCKPIT */}
      <section className="bg-white border border-slate-200/90 rounded-xl shadow-2xs overflow-hidden">
        {/* Top Operational Status Ribbon */}
        <div className="bg-slate-900 text-white px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Sistem Operasional Aktif
            </span>
            <span className="hidden sm:inline-block text-slate-400 font-normal">|</span>
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              SPPG Jeru Tumpang • Badan Gizi Nasional
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-slate-300 font-mono">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="hidden md:flex items-center gap-1.5 text-sky-300 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/40">
              <ThermometerSnowflake className="w-3 h-3 text-sky-400" />
              Chiller: 3.2°C • Freezer: -18.4°C
            </span>
          </div>
        </div>

        {/* Cockpit Main Area */}
        <div className="p-5 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded bg-emerald-100/70 text-emerald-800 text-[11px] font-semibold">
                  Program Makan Bergizi Gratis (MBG)
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-slate-600 text-xs font-medium">
                  Alokasi: <strong className="text-slate-900 font-mono font-semibold">{totalTargetStudents.toLocaleString('id-ID')} Siswa</strong> (10 Sekolah)
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Pusat Komando Pergudangan & Logistik Pangan
              </h1>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-2xl">
                Verifikasi kedatangan bahan baku supplier basah/kering, kepatuhan mutu pangan sekolah, dan transparansi belanja riil harian. Petugas:{' '}
                <strong className="text-slate-800 font-semibold">{currentUser.name}</strong> ({currentUser.role}).
              </p>
            </div>

            {/* Fast Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('receiving')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                <Plus className="w-4 h-4 text-emerald-200" />
                <span>Input Barang Datang (GR)</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('menu_orders')}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition-colors cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                <ChefHat className="w-4 h-4 text-emerald-700" />
                <span>Menu & Penerima Manfaat</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('tools_forms')}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-2xs transition-colors cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
                title="Cetak formulir dan berita acara"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span className="hidden sm:inline">Cetak Dokumen</span>
              </button>
            </div>
          </div>

          {/* Key Metrics Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mt-6 pt-5 border-t border-slate-100">
            {/* Metric 1: Bahan Masuk Hari Ini */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[11px] font-semibold">Penerimaan Masuk</span>
                <Truck className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  {totalReceivedItemsCount.toLocaleString('id-ID')}
                  <span className="text-xs font-normal text-slate-500 ml-1">Kg/Unit</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  <strong className="text-emerald-800 font-semibold">{todaysReceivings.length}</strong> surat terima (GR) hari ini
                </div>
              </div>
            </div>

            {/* Metric 2: Target Porsi Menu MBG */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[11px] font-semibold">Target Masak MBG</span>
                <ChefHat className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  {todaysMenu ? todaysMenu.targetPortions.toLocaleString('id-ID') : '-'}
                  <span className="text-xs font-normal text-slate-500 ml-1">Porsi</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                  {todaysMenu ? todaysMenu.menuTitle : 'Belum ada menu terjadwal'}
                </div>
              </div>
            </div>

            {/* Metric 3: Saldo Aman Chiller */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[11px] font-semibold">Saldo Cold Chain</span>
                <ThermometerSnowflake className="w-3.5 h-3.5 text-sky-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  {totalFlowRemaining.toLocaleString('id-ID')}
                  <span className="text-xs font-normal text-slate-500 ml-1">Kg</span>
                </div>
                <div className="text-[11px] text-sky-700 font-medium mt-0.5">
                  Tersimpan di Chiller & Rak Kering
                </div>
              </div>
            </div>

            {/* Metric 4: Kesiapan Aset & Alat */}
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[11px] font-semibold">Kesiapan Aset Dapur</span>
                <Wrench className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <div className="mt-2">
                <div className="text-xl sm:text-2xl font-bold font-mono text-slate-900 tabular-nums">
                  {goodEquipmentCount}
                  <span className="text-xs font-normal text-slate-500 ml-1">/ {equipment.length} Siap</span>
                </div>
                <div className="text-[11px] text-slate-600 mt-0.5">
                  {damagedEquipment.length > 0 ? (
                    <span className="text-rose-700 font-semibold">{damagedEquipment.length} butuh servis</span>
                  ) : (
                    <span className="text-emerald-700 font-medium">Semua alat layak operasional</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. ACTIONABLE OPERATIONAL TRIAGE STRIP (PERHATIAN OPERASIONAL MENDESAK) */}
      <section className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-md ${totalAlertsCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
                Pusat Tindakan & Perhatian Lapangan
              </h2>
              <p className="text-[11px] text-slate-500">
                {totalAlertsCount > 0
                  ? `Ditemukan ${totalAlertsCount} item yang membutuhkan verifikasi atau pengadaan ulang petugas hari ini.`
                  : 'Seluruh parameter stok, peralatan dapur, dan otorisasi dokumen berada dalam kondisi aman.'}
              </p>
            </div>
          </div>

          {/* Triage Filter Tabs */}
          {totalAlertsCount > 0 && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTriageFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                  triageFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({totalAlertsCount})
              </button>
              {outOfStockItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTriageFilter('OUT_OF_STOCK')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    triageFilter === 'OUT_OF_STOCK' ? 'bg-white text-rose-800 shadow-2xs' : 'text-slate-600 hover:text-rose-700'
                  }`}
                >
                  Habis ({outOfStockItems.length})
                </button>
              )}
              {lowStockItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTriageFilter('LOW_STOCK')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    triageFilter === 'LOW_STOCK' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-600 hover:text-amber-700'
                  }`}
                >
                  Buffer Menipis ({lowStockItems.length})
                </button>
              )}
              {pendingOpnames.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTriageFilter('OPNAME')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    triageFilter === 'OPNAME' ? 'bg-white text-indigo-800 shadow-2xs' : 'text-slate-600 hover:text-indigo-700'
                  }`}
                >
                  Opname ({pendingOpnames.length})
                </button>
              )}
              {damagedEquipment.length > 0 && (
                <button
                  type="button"
                  onClick={() => setTriageFilter('EQUIPMENT')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    triageFilter === 'EQUIPMENT' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Alat ({damagedEquipment.length})
                </button>
              )}
            </div>
          )}
        </div>

        {totalAlertsCount === 0 ? (
          <div className="bg-emerald-50/70 border border-emerald-200/90 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-semibold text-emerald-950">
                  Semua Indikator Bahan Pangan Berada di Ambang Aman
                </h3>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Tidak ada stok kosong, tidak ada buffer menipis, dan semua dokumen opname telah disetujui Kepala SPPG.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-300 transition-colors shrink-0 cursor-pointer"
            >
              Cek Katalog Stok
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {/* Triage Card: Kritis 0 Stok */}
            {(triageFilter === 'ALL' || triageFilter === 'OUT_OF_STOCK') && outOfStockItems.length > 0 && (
              <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                      <XCircle className="w-3.5 h-3.5" />
                      Kritis (0 Stok Fisik)
                    </span>
                    <span className="font-mono text-xs font-bold text-rose-800 tabular-nums">
                      {outOfStockItems.length} Bahan
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-xs font-semibold text-rose-950 leading-snug">
                      {outOfStockItems.slice(0, 3).map(i => i.name).join(', ')}
                      {outOfStockItems.length > 3 && ` +${outOfStockItems.length - 3} lainnya`}
                    </p>
                    <p className="text-[11px] text-rose-700 mt-1 leading-normal">
                      Bahan kosong di rak gudang. Dibutuhkan penerbitan Nota Pesanan (PO) segera.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className="w-full text-center px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[38px]"
                >
                  Restock Bahan Habis
                </button>
              </div>
            )}

            {/* Triage Card: Buffer Menipis */}
            {(triageFilter === 'ALL' || triageFilter === 'LOW_STOCK') && lowStockItems.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Buffer Stock Menipis
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-800 tabular-nums">
                      {lowStockItems.length} Bahan
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-xs font-semibold text-amber-950 leading-snug">
                      {lowStockItems.slice(0, 3).map(i => i.name).join(', ')}
                      {lowStockItems.length > 3 && ` +${lowStockItems.length - 3} lainnya`}
                    </p>
                    <p className="text-[11px] text-amber-700 mt-1 leading-normal">
                      Kuantitas mendekati batas minimum keamanan gudang penyimpanan SPPG.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className="w-full text-center px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[38px]"
                >
                  Periksa Stok Minimum
                </button>
              </div>
            )}

            {/* Triage Card: Approval Opname */}
            {(triageFilter === 'ALL' || triageFilter === 'OPNAME') && pendingOpnames.length > 0 && (
              <div className="p-4 rounded-xl bg-indigo-50/80 border border-indigo-200 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      Approval Opname Fisik
                    </span>
                    <span className="font-mono text-xs font-bold text-indigo-800 tabular-nums">
                      {pendingOpnames.length} Sesi
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-xs font-semibold text-indigo-950 leading-snug">
                      Sesi Opname #{pendingOpnames[0].id}
                    </p>
                    <p className="text-[11px] text-indigo-700 mt-1 leading-normal">
                      Diajukan oleh {pendingOpnames[0].createdByName}. Menunggu pengesahan Kepala SPPG.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('stock_opname')}
                  className="w-full text-center px-3 py-2 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[38px]"
                >
                  Validasi Berita Acara
                </button>
              </div>
            )}

            {/* Triage Card: Peralatan Rusak */}
            {(triageFilter === 'ALL' || triageFilter === 'EQUIPMENT') && damagedEquipment.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-200 text-slate-800 border border-slate-300">
                      <Wrench className="w-3.5 h-3.5" />
                      Peralatan Dapur Rusak
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800 tabular-nums">
                      {damagedEquipment.length} Unit
                    </span>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-xs font-semibold text-slate-900 leading-snug">
                      {damagedEquipment.slice(0, 2).map(e => e.name).join(', ')}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                      Dalam penanganan perbaikan atau menunggu penggantian suku cadang.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('equipment')}
                  className="w-full text-center px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[38px]"
                >
                  Kelola Aset Dapur
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. MATERIAL BALANCE & LOGISTICS FLOW PIPELINE (NERACA ALIRAN PANGAN SPPG) */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-700" />
              Aliran Logistik & Neraca Bahan Pangan Hari Ini
            </h2>
            <p className="text-xs text-slate-500">
              Siklus pergerakan bahan pangan dari penerimaan supplier hingga pengolahan dapur MBG ({today}).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('daily_flow')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>Buka Buku Aliran Harian</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pipeline Steps Flow */}
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {/* Step 1: Penerimaan Supplier */}
            <div className="p-4 rounded-xl border border-slate-200 bg-emerald-50/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">1. Bahan Masuk (Supplier)</span>
                  <span className="p-1 rounded-md bg-emerald-100 text-emerald-800">
                    <Truck className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-mono text-emerald-900 tabular-nums">
                    {totalFlowReceived.toLocaleString('id-ID')}
                    <span className="text-xs font-medium text-slate-500 ml-1">Kg Total</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Verifikasi fisik oleh petugas penerimaan SPPG dari mitra rekanan.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Surat Terima (GR):</span>
                <strong className="text-slate-900 font-semibold">{todaysReceivings.length} Dokumen</strong>
              </div>
            </div>

            {/* Step 2: Dapur Masak MBG */}
            <div className="p-4 rounded-xl border border-slate-200 bg-amber-50/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">2. Diolah di Dapur Masak</span>
                  <span className="p-1 rounded-md bg-amber-100 text-amber-800">
                    <Utensils className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-mono text-amber-900 tabular-nums">
                    {totalFlowConsumed.toLocaleString('id-ID')}
                    <span className="text-xs font-medium text-slate-500 ml-1">Kg Terpakai</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Preparasi resep bergizi untuk {todaysMenu ? todaysMenu.targetPortions.toLocaleString('id-ID') : 0} porsi siswa.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Menu Hari Ini:</span>
                <strong className="text-slate-900 font-semibold">{todaysMenu ? 'Menu Reguler & Balita 3T' : 'Belum Ditentukan'}</strong>
              </div>
            </div>

            {/* Step 3: Saldo Cadangan Gudang */}
            <div className="p-4 rounded-xl border border-slate-200 bg-sky-50/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">3. Saldo Aman Tersimpan</span>
                  <span className="p-1 rounded-md bg-sky-100 text-sky-800">
                    <ThermometerSnowflake className="w-3.5 h-3.5" />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold font-mono text-sky-900 tabular-nums">
                    {totalFlowRemaining.toLocaleString('id-ID')}
                    <span className="text-xs font-medium text-slate-500 ml-1">Kg Cadangan</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    Stok cadangan higienis di cold storage dan rak kering untuk hari berikutnya.
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Kondisi Penyimpanan:</span>
                <strong className="text-emerald-700 font-semibold">Tersertifikasi Higienis</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3.5 STATUS PO & KEDATANGAN BAHAN HARI INI */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Header Ribbon */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  Status PO & Kedatangan Bahan Hari Ini
                </h3>
                {pendingPoItems.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    {pendingPoItems.length} Belum Tiba
                  </span>
                ) : todayPoItems.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                    Semua Bahan Lengkap
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-slate-500">
                Monitoring kedatangan bahan dari supplier rekanan, status timbangan, dan catatan khusus penanganan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('receiving')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Truck className="w-3.5 h-3.5 text-slate-500" />
              <span>Input Belanja & Timbang</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('menu_orders')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <span>Kelola Menu & PO</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Counter & Filter Pills Bar */}
        <div className="px-4 py-3 bg-slate-50/40 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
            <button
              type="button"
              onClick={() => setPoFilter('ALL')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                poFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Bahan ({todayPoItems.length})
            </button>
            <button
              type="button"
              onClick={() => setPoFilter('PENDING')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                poFilter === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-2xs font-bold'
                  : 'text-amber-800 hover:bg-amber-100/60'
              }`}
            >
              <span>Belum Datang ({pendingPoItems.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setPoFilter('ARRIVED')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                poFilter === 'ARRIVED'
                  ? 'bg-emerald-700 text-white shadow-2xs font-bold'
                  : 'text-emerald-800 hover:bg-emerald-100/60'
              }`}
            >
              Sudah Tiba ({arrivedPoItems.length})
            </button>
            <button
              type="button"
              onClick={() => setPoFilter('NOTES')}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                poFilter === 'NOTES'
                  ? 'bg-blue-600 text-white shadow-2xs font-bold'
                  : 'text-blue-800 hover:bg-blue-100/60'
              }`}
            >
              Catatan Khusus ({itemsWithNotes.length})
            </button>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>Progress Pengiriman:</span>
            <strong className="text-slate-800 font-mono">
              {todayPoItems.length > 0
                ? `${Math.round((arrivedPoItems.length / todayPoItems.length) * 100)}%`
                : '0%'}
            </strong>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5">
          {todayPoItems.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">Belum ada pesanan bahan PO aktif untuk hari ini.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Silakan buat PO dari menu "Menu & Penerima Manfaat" atau rekam belanja di "Input Barang & Belanja".
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Highlight Banner */}
              {pendingPoItems.length > 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-950">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Perhatian Dapur:</strong> Masih ada <strong>{pendingPoItems.length} bahan</strong> yang belum tiba dari supplier rekanan untuk kebutuhan memasak hari ini.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPoFilter('PENDING')}
                    className="text-amber-800 underline font-semibold text-[11px] shrink-0 hover:text-amber-950 cursor-pointer"
                  >
                    Lihat bahan belum datang
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Pengiriman Lengkap:</strong> Semua bahan pesanan PO hari ini telah tiba dan diverifikasi di dapur SPPG Jeru Tumpang.
                  </span>
                </div>
              )}

              {/* Grid of Item Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {displayedPoItems.map(item => {
                  const isPending = item.status === 'PENDING';
                  const isPartial = item.status === 'PARTIAL';
                  const isArrived = item.status === 'ARRIVED';

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                        isPending
                          ? 'bg-white border-amber-200 shadow-2xs hover:border-amber-300'
                          : isPartial
                          ? 'bg-white border-sky-200 shadow-2xs hover:border-sky-300'
                          : 'bg-slate-50/60 border-slate-200/80 hover:bg-white'
                      }`}
                    >
                      <div>
                        {/* Status Tag & Jam */}
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-[10px]">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold tracking-tight inline-flex items-center gap-1 ${
                              isPending
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : isPartial
                                ? 'bg-sky-100 text-sky-900 border border-sky-200'
                                : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isPending
                                  ? 'bg-amber-500 animate-pulse'
                                  : isPartial
                                  ? 'bg-sky-500'
                                  : 'bg-emerald-600'
                              }`}
                            />
                            {isPending
                              ? 'Belum Datang'
                              : isPartial
                              ? 'Tiba Sebagian'
                              : 'Sudah Tiba'}
                          </span>

                          <span className="font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {item.expectedTime}
                          </span>
                        </div>

                        {/* Title & Category */}
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {item.itemName}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-semibold text-slate-500">
                              {item.category}
                            </span>
                            {item.poNumber && (
                              <span className="text-[10px] font-mono text-slate-400">
                                • {item.poNumber}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Supplier */}
                        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-slate-700">
                          <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold truncate">{item.supplier}</span>
                        </div>

                        {/* Qty Order vs Arrived */}
                        <div className="mt-2 grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-500 block">Dipesan (H-1):</span>
                            <span className="font-bold font-mono text-slate-800">{item.qtyOrder}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">Timbang Riil:</span>
                            <span
                              className={`font-bold font-mono ${
                                isArrived
                                  ? 'text-emerald-700'
                                  : isPartial
                                  ? 'text-sky-700'
                                  : 'text-slate-400'
                              }`}
                            >
                              {item.qtyArrived}
                            </span>
                          </div>
                        </div>

                        {/* Catatan Khusus / Spesifikasi Bahan */}
                        {item.notes && item.notes.trim() !== '' && (
                          <div className="mt-2.5 p-2 rounded-lg bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-950 flex items-start gap-1.5 leading-tight">
                            <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                            <div>
                              <strong className="font-semibold text-amber-900">Catatan Khusus:</strong>{' '}
                              <span>{item.notes}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. DUAL DECK: TODAY'S NUTRITION MENU & LIVE GOODS RECEIVING STREAM */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Today's Nutrition Menu Order & School Allocation */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Menu & Penerima Manfaat MBG Hari Ini
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('menu_orders')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              Lihat Detail Menu & Sekolah
            </button>
          </div>

          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            {todaysMenu ? (
              <>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Order Menu #{todaysMenu.id}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold font-mono bg-slate-100 text-slate-800 border border-slate-200">
                      {todaysMenu.targetPortions.toLocaleString('id-ID')} Porsi Target
                    </span>
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-slate-900 leading-snug">
                      {todaysMenu.menuTitle}
                    </h4>
                    {todaysMenu.menuDescription && (
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        {todaysMenu.menuDescription}
                      </p>
                    )}
                  </div>

                  {/* Special Diet B3 Note */}
                  {todaysMenu.specialDietB3 && (
                    <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200/90 text-xs text-amber-950">
                      <strong className="font-semibold block mb-0.5 text-amber-900">
                        Penyesuaian Khusus B3 (Balita, Ibu Hamil & Menyusui):
                      </strong>
                      <span className="text-[11px] text-amber-800 leading-normal">
                        {todaysMenu.specialDietB3}
                      </span>
                    </div>
                  )}

                  {/* Key Ingredients Required for Cooking with Inventory Availability */}
                  {menuIngredientsWithStock.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] font-semibold text-slate-600 mb-2 flex items-center justify-between">
                        <span>Bahan Baku Resep & Status Stok Gudang:</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {menuIngredientsWithStock.filter(i => i.isSufficient).length}/{menuIngredientsWithStock.length} bahan siap
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {menuIngredientsWithStock.slice(0, 6).map((ing, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 truncate">{ing.displayName || ing.itemName || 'Bahan Masak'}</div>
                              <div className="text-[11px] font-mono text-slate-500">
                                Butuh: <strong className="text-slate-900">{ing.quantity} {ing.unit}</strong>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                              ing.isSufficient ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {ing.isSufficient ? 'Tersedia' : 'Cek Stok'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action Strip */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500">
                    Penanggung jawab: <strong className="text-slate-800">{todaysMenu.chefInCharge || 'Tim Dapur SPPG'}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate('menu_print')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-500" />
                      Cetak Menu MBG
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigate('menu_orders')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Kelola Penyaluran
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-10 text-center text-slate-500 text-xs">
                <ChefHat className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                Belum ada jadwal menu gizi yang aktif hari ini.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Live Goods Receiving (GR) Feed */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Penerimaan Masuk Hari Ini ({todaysReceivings.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('receiving')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              Semua GR
            </button>
          </div>

          <div className="p-4 flex-1">
            {todaysReceivings.length === 0 ? (
              <div className="text-center py-10 px-4">
                <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Package className="w-6 h-6" />
                </div>
                <p className="text-xs font-semibold text-slate-700">Belum Ada Kedatangan Masuk Hari Ini</p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
                  Catat pengiriman dari supplier bahan basah maupun sembako kering untuk menambah stok.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('receiving')}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Input Penerimaan Pertama
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {todaysReceivings.map(doc => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-emerald-800 tabular-nums">{doc.id}</span>
                        <span className="text-[10px] text-slate-500 font-medium font-mono">({doc.arrivalTime} WIB)</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 truncate mt-0.5">
                        {doc.supplierName}
                      </div>
                      <div className="text-[11px] text-slate-600 truncate mt-0.5">
                        {doc.lines.map(l => `${l.itemName} (${l.quantity} ${l.unit})`).join(', ')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedReceivingDoc(doc)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-white hover:bg-slate-100 rounded-md border border-slate-300 hover:border-emerald-300 transition-colors shrink-0 cursor-pointer min-h-[32px] flex items-center"
                    >
                      Bukti Fisik
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 5. CHECKLIST TUGAS OPERASIONAL & SOP HARIAN SPPG */}
      <section>
        <DailyChecklistWidget
          onNavigateToProfileTodos={() => onNavigate('profile')}
          onRefreshData={onRefreshData}
        />
      </section>

      {/* 6. TABEL STATUS STOK KRITIS & BUFFER GUDANG */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-700" />
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Monitoring Stok Kritis & Batas Minimum Gudang
              </h3>
              <p className="text-[11px] text-slate-500">
                Peringatan dini bahan pangan yang habis atau berada di bawah buffer stok operasional.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={stockSearchQuery}
                onChange={e => setStockSearchQuery(e.target.value)}
                placeholder="Cari bahan..."
                className="pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-600 w-36 sm:w-44"
              />
            </div>

            {/* Category Filter */}
            <select
              value={stockCategoryFilter}
              onChange={e => setStockCategoryFilter(e.target.value as any)}
              className="px-2.5 py-1 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="Bahan Basah">Bahan Basah</option>
              <option value="Bahan Kering">Bahan Kering</option>
            </select>

            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer shrink-0 ml-1"
            >
              Katalog Lengkap
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-2.5 px-4">Nama Bahan Pangan</th>
                <th className="py-2.5 px-4">Kategori</th>
                <th className="py-2.5 px-4">Lokasi Fisik</th>
                <th className="py-2.5 px-4 text-right">Stok Aktual</th>
                <th className="py-2.5 px-4 text-right">Batas Minimum</th>
                <th className="py-2.5 px-4 text-center">Tingkat Buffer</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCriticalStock.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-emerald-700">
                    <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                    <span className="font-semibold block text-xs">
                      {stockSearchQuery ? 'Tidak Ada Bahan Pangan yang Sesuai Pencarian' : 'Semua Ketersediaan Bahan Pangan Berada di Batas Aman'}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {stockSearchQuery ? 'Coba ubah kata kunci pencarian Anda.' : 'Tidak ada stok habis atau berada di bawah batas minimum gudang.'}
                    </span>
                  </td>
                </tr>
              ) : (
                filteredCriticalStock.slice(0, 8).map(item => {
                  const isOut = item.currentStock <= 0;
                  const ratio = Math.min(100, Math.round((item.currentStock / Math.max(item.minimumStock, 1)) * 100));

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{item.id}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.category === 'Bahan Basah'
                            ? 'bg-sky-50 text-sky-800 border border-sky-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">{item.location}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                        <span className={isOut ? 'text-rose-700' : 'text-amber-800'}>
                          {item.currentStock.toLocaleString('id-ID')} {item.baseUnit}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-500 tabular-nums">
                        {item.minimumStock.toLocaleString('id-ID')} {item.baseUnit}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 w-24 mx-auto">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${isOut ? 'bg-rose-600' : ratio < 50 ? 'bg-rose-500' : 'bg-amber-500'}`}
                              style={{ width: `${ratio}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-600 tabular-nums">{ratio}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            Habis Total
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            Menipis
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onNavigate('inventory')}
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-slate-300 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer min-h-[30px]"
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
