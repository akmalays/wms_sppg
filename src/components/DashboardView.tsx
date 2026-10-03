import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  ItemMaster,
  ReceivingDocument,
  EquipmentItem,
  StockOpnameSession,
  MenuOrder
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
  Users,
  Boxes,
  ChefHat,
  Sparkles,
  Calendar,
  Building2,
  FileText,
  Printer,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  XCircle,
  ThermometerSnowflake
} from 'lucide-react';
import { ReceivingDetailModal } from './ReceivingDetailModal';
import { DailyChecklistWidget } from './DailyChecklistWidget';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onRefreshData?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate, onRefreshData }) => {
  const { currentUser, can } = useAuth();

  const [items] = useState<ItemMaster[]>(() => warehouseDb.getItems());
  const [receivings] = useState<ReceivingDocument[]>(() => warehouseDb.getReceivings());
  const [equipment] = useState<EquipmentItem[]>(() => warehouseDb.getEquipment());
  const [opnames] = useState<StockOpnameSession[]>(() => warehouseDb.getOpnames());
  const [menuOrders] = useState<MenuOrder[]>(() => warehouseDb.getMenuOrders());
  const [selectedReceivingDoc, setSelectedReceivingDoc] = useState<ReceivingDocument | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  // Today's arrivals
  const todaysReceivings = receivings.filter(r => r.date === today);
  const totalReceivedItemsCount = todaysReceivings.reduce(
    (acc, r) => acc + r.lines.reduce((lAcc, line) => lAcc + line.quantity, 0),
    0
  );

  // Stock alerts
  const lowStockItems = items.filter(
    i => i.isActive && i.itemType !== 'EQUIPMENT' && i.currentStock > 0 && i.currentStock <= i.minimumStock
  );
  const outOfStockItems = items.filter(
    i => i.isActive && i.itemType !== 'EQUIPMENT' && i.currentStock <= 0
  );

  // Opname approvals needed
  const pendingOpnames = opnames.filter(o => o.status === 'PENDING_APPROVAL');

  // Equipment condition
  const damagedEquipment = equipment.filter(e => e.condition === 'DAMAGED' || e.status === 'IN_REPAIR');
  const needsInspectionEquipment = equipment.filter(e => e.condition === 'NEEDS_INSPECTION');
  const goodEquipmentCount = equipment.filter(e => e.condition === 'GOOD').length;

  // Daily flow data
  const dailyFlow = warehouseDb.getDailyFlowData(today);
  const totalFlowReceived = dailyFlow.reduce((acc, d) => acc + d.receivedToday, 0);
  const totalFlowConsumed = dailyFlow.reduce((acc, d) => acc + d.consumedToday, 0);
  const totalFlowRemaining = dailyFlow.reduce((acc, d) => acc + d.closingBalance, 0);

  // Today's active menu or latest scheduled menu order
  const todaysMenu = menuOrders.find(m => m.date === today) || menuOrders[0];

  return (
    <div className="space-y-6">
      {/* Detail Physical Receiving Modal */}
      <ReceivingDetailModal
        document={selectedReceivingDoc}
        onClose={() => setSelectedReceivingDoc(null)}
      />

      {/* 1. INSTITUTIONAL OPERATIONAL STATION BAR */}
      <section className="bg-white border border-slate-200 rounded-xl shadow-2xs p-5 lg:p-6 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Station Identity & Realtime Context */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                Stasiun Operasional Aktif
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-200">
                <ThermometerSnowflake className="w-3.5 h-3.5 text-sky-600" />
                Chiller 2-4°C (Normal)
              </span>
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Pusat Logistik Gudang SPPG Jeru Tumpang
              </h1>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed max-w-2xl">
                Satuan Pelayanan Pemenuhan Gizi (Program MBG) • Terhubung langsung dengan jalur penerimaan bahan segar, dapur masak, dan distribusi sekolah. Petugas aktif:{' '}
                <strong className="text-slate-800 font-semibold">{currentUser.name}</strong> ({currentUser.role}).
              </p>
            </div>
          </div>

          {/* Ergonomic Quick Action Buttons with WCAG Tap Targets */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
            <button
              type="button"
              onClick={() => onNavigate('receiving')}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              <Plus className="w-4 h-4 text-emerald-200" />
              <span>Input Barang Masuk</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('menu_orders')}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              <ChefHat className="w-4 h-4 text-emerald-700" />
              <span>Order Menu Gizi</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('daily_expenses')}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              <TrendingDown className="w-4 h-4 text-slate-500" />
              <span>Pengeluaran</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('tools_forms')}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200 shadow-2xs transition-colors cursor-pointer min-h-[44px] focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              title="Cetak Form Nota & Berita Acara"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Cetak Form</span>
            </button>
          </div>
        </div>
      </section>

      {/* 2. URGENT OPERATIONAL ATTENTION TRIAGE STRIP */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0 || pendingOpnames.length > 0 || damagedEquipment.length > 0) && (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-normal">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Perhatian Operasional Mendesak
            </h2>
            <span className="text-[11px] font-medium text-slate-500">
              Perlu respon petugas hari ini
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {outOfStockItems.length > 0 && (
              <div className="p-3.5 rounded-xl bg-rose-50/90 border border-rose-200 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                      <XCircle className="w-3.5 h-3.5" />
                      Kritis (0 Stok)
                    </span>
                    <span className="font-mono text-xs font-bold text-rose-800">
                      {outOfStockItems.length} Bahan
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-rose-950 mt-2 leading-tight">
                    {outOfStockItems.slice(0, 2).map(i => i.name).join(', ')}
                    {outOfStockItems.length > 2 && ` +${outOfStockItems.length - 2} lainnya`}
                  </p>
                  <p className="text-[11px] text-rose-700 mt-1 leading-normal">
                    Bahan habis total di rak gudang. Segera buat PO baru.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className="w-full text-center px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[36px]"
                >
                  Restock Bahan Habis
                </button>
              </div>
            )}

            {lowStockItems.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Buffer Menipis
                    </span>
                    <span className="font-mono text-xs font-bold text-amber-800">
                      {lowStockItems.length} Bahan
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-amber-950 mt-2 leading-tight">
                    {lowStockItems.slice(0, 2).map(i => i.name).join(', ')}
                    {lowStockItems.length > 2 && ` +${lowStockItems.length - 2} lainnya`}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1 leading-normal">
                    Kuantitas berada di bawah batas minimum keamanan gudang.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className="w-full text-center px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[36px]"
                >
                  Periksa Stok Minimum
                </button>
              </div>
            )}

            {pendingOpnames.length > 0 && (
              <div className="p-3.5 rounded-xl bg-purple-50/90 border border-purple-200 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      Approval Opname
                    </span>
                    <span className="font-mono text-xs font-bold text-purple-800">
                      {pendingOpnames.length} Sesi
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-purple-950 mt-2 leading-tight">
                    Sesi #{pendingOpnames[0].id}
                  </p>
                  <p className="text-[11px] text-purple-700 mt-1 leading-normal">
                    Diajukan oleh {pendingOpnames[0].createdByName}. Menunggu validasi Kepala SPPG.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('stock_opname')}
                  className="w-full text-center px-3 py-2 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[36px]"
                >
                  Tinjau Berita Acara
                </button>
              </div>
            )}

            {damagedEquipment.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-100/90 border border-slate-300 flex flex-col justify-between gap-3 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-200 text-slate-800 border border-slate-300">
                      <Wrench className="w-3.5 h-3.5" />
                      Alat Dapur Rusak
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-800">
                      {damagedEquipment.length} Unit
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-900 mt-2 leading-tight">
                    {damagedEquipment.slice(0, 2).map(e => e.name).join(', ')}
                  </p>
                  <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                    Dalam status perbaikan atau butuh penggantian suku cadang.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('equipment')}
                  className="w-full text-center px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer min-h-[36px]"
                >
                  Kelola Aset Dapur
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. ASYMMETRIC LOGISTICS FLOW MATRIX (NERACA PANGAN SPPG) */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Boxes className="w-4 h-4 text-emerald-700" />
              Neraca Logistik Pangan Hari Ini (Daily Material Balance)
            </h2>
            <p className="text-xs text-slate-500">
              Pencatatan volume masuk supplier vs pemakaian masak dapur MBG per {today}.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('daily_flow')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            Buka Aliran Harian Detail
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Card 1: Penerimaan Masuk */}
          <div className="p-5 flex flex-col justify-between hover:bg-slate-50/50 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Penerimaan Supplier (GR)</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Truck className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl lg:text-3xl font-bold font-mono text-emerald-800">
                  {totalReceivedItemsCount.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-medium text-slate-500">Unit / Kg</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Dokumen GR Hari Ini:</span>
              <strong className="text-slate-800 font-semibold">{todaysReceivings.length} surat terima</strong>
            </div>
          </div>

          {/* Card 2: Pengolahan Masak Dapur */}
          <div className="p-5 flex flex-col justify-between hover:bg-slate-50/50 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Konsumsi Masak Dapur</span>
                <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
                  <Utensils className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl lg:text-3xl font-bold font-mono text-amber-800">
                  {totalFlowConsumed.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-medium text-slate-500">Kg Bahan Olah</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Alokasi Porsi Masak:</span>
              <strong className="text-slate-800 font-semibold">{todaysMenu ? `${todaysMenu.targetPortions.toLocaleString('id-ID')} Porsi` : '-'}</strong>
            </div>
          </div>

          {/* Card 3: Saldo Chiller & Cold Storage */}
          <div className="p-5 flex flex-col justify-between hover:bg-slate-50/50 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Saldo Akhir di Chiller</span>
                <span className="p-1.5 rounded-lg bg-sky-50 text-sky-700 border border-sky-200">
                  <ThermometerSnowflake className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl lg:text-3xl font-bold font-mono text-sky-800">
                  {totalFlowRemaining.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-medium text-slate-500">Kg Saldo Aman</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Status Cold Chain:</span>
              <strong className="text-emerald-700 font-semibold">Tersimpan Higienis</strong>
            </div>
          </div>

          {/* Card 4: Kesiapan Alat Kerja Masak */}
          <div className="p-5 flex flex-col justify-between hover:bg-slate-50/50 transition-colors">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">Kesiapan Aset Dapur</span>
                <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                  <Wrench className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl lg:text-3xl font-bold font-mono text-slate-900">
                  {goodEquipmentCount}
                </span>
                <span className="text-xs font-medium text-slate-500">/ {equipment.length} Siap Pakai</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span>Perlu Inspeksi / Servis:</span>
              <strong className={needsInspectionEquipment.length > 0 ? 'text-amber-700 font-semibold' : 'text-slate-800 font-semibold'}>
                {needsInspectionEquipment.length + damagedEquipment.length} unit
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* 4. DUAL COLUMN LIVE OPERATIONAL COMMAND DECK */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Today's Nutrition Menu Order & School Allocation */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChefHat className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-normal">
                Menu Gizi & Penyaluran MBG Hari Ini
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('menu_orders')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
            >
              Lihat Detail Order
            </button>
          </div>

          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
            {todaysMenu ? (
              <>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Sesi: {todaysMenu.mealSession} • Order #{todaysMenu.id}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      {todaysMenu.targetPortions.toLocaleString('id-ID')} Porsi Target
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 leading-snug pt-1">
                    {todaysMenu.menuTitle}
                  </h4>

                  {todaysMenu.menuDescription && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {todaysMenu.menuDescription}
                    </p>
                  )}

                  {todaysMenu.specialDietB3 && (
                    <div className="p-3 rounded-lg bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900">
                      <strong className="font-semibold block mb-0.5">Penyesuaian Khusus B3 (Balita & Ibu Hamil):</strong>
                      <span className="text-[11px] text-amber-800 leading-normal">{todaysMenu.specialDietB3}</span>
                    </div>
                  )}
                </div>

                {/* Key Ingredients Required for Cooking */}
                {todaysMenu.keyIngredients && todaysMenu.keyIngredients.length > 0 && (
                  <div className="pt-2">
                    <div className="text-[11px] font-bold text-slate-500 mb-2 uppercase tracking-normal">
                      Bahan Pokok Terverifikasi di Dapur:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {todaysMenu.keyIngredients.slice(0, 6).map((ing, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                          <div className="text-xs font-semibold text-slate-800 truncate">{ing.itemName}</div>
                          <div className="text-[11px] font-mono font-bold text-emerald-800 mt-0.5">
                            {ing.quantity} {ing.unit}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Action Strip */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500">
                    Penanggung jawab masak: <strong className="text-slate-800">{todaysMenu.chefInCharge || 'Tim Dapur SPPG'}</strong>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate('menu_print')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
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
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-normal">
                Barang Datang Hari Ini ({todaysReceivings.length})
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
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {todaysReceivings.map(doc => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-emerald-800">{doc.id}</span>
                        <span className="text-[10px] text-slate-500 font-medium">({doc.arrivalTime} WIB)</span>
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
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-white hover:bg-emerald-50 rounded-md border border-slate-300 hover:border-emerald-300 transition-colors shrink-0 cursor-pointer min-h-[32px] flex items-center"
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
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-normal">
              Status Ketersediaan Stok Kritis & Minimum Gudang
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
          >
            Buka Katalog Stok Lengkap
          </button>
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
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...outOfStockItems, ...lowStockItems].length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-emerald-700">
                    <CheckCircle className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                    <span className="font-semibold block text-xs">Semua Ketersediaan Bahan Pangan Berada di Batas Aman</span>
                    <span className="text-[11px] text-slate-500">Tidak ada stok habis atau berada di bawah batas minimum gudang.</span>
                  </td>
                </tr>
              ) : (
                [...outOfStockItems, ...lowStockItems].slice(0, 6).map(item => {
                  const isOut = item.currentStock <= 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{item.name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{item.category}</td>
                      <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px]">{item.location}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        <span className={isOut ? 'text-rose-700' : 'text-amber-800'}>
                          {item.currentStock.toLocaleString('id-ID')} {item.baseUnit}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                        {item.minimumStock.toLocaleString('id-ID')} {item.baseUnit}
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
                          className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer min-h-[30px]"
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
