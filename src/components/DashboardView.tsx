import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { ItemMaster, ReceivingDocument, EquipmentItem, StockOpnameSession } from '../types/warehouse';
import {
  Truck,
  Package,
  AlertTriangle,
  Wrench,
  Utensils,
  ArrowRight,
  ClipboardCheck,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
  Clock,
  Plus
} from 'lucide-react';
import { ReceivingDetailModal } from './ReceivingDetailModal';

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

  // Daily flow data
  const dailyFlow = warehouseDb.getDailyFlowData(today);
  const totalFlowReceived = dailyFlow.reduce((acc, d) => acc + d.receivedToday, 0);
  const totalFlowConsumed = dailyFlow.reduce((acc, d) => acc + d.consumedToday, 0);
  const totalFlowRemaining = dailyFlow.reduce((acc, d) => acc + d.closingBalance, 0);

  return (
    <div className="space-y-6">
      {/* Detail Modal */}
      <ReceivingDetailModal
        document={selectedReceivingDoc}
        onClose={() => setSelectedReceivingDoc(null)}
      />

      {/* Greeting & Quick Action Hero */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 p-6 rounded-2xl text-white shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Operasional Hari Ini • {today}
            </span>
          </div>
          <h2 className="text-xl font-bold mt-1.5 text-white">
            Pusat Logistik Gudang SPPG (Satuan Pelayanan Pemenuhan Gizi)
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Selamat bertugas, <span className="font-semibold text-white">{currentUser.name}</span> ({currentUser.role}).
            Pantau arus penerimaan pangan, ketersediaan sembako, dan kesiapan dapur gizi anak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {can('RECEIVE_GOODS') && (
            <button
              onClick={() => onNavigate('receiving')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              Catat Penerimaan Masuk
            </button>
          )}
          {can('RECORD_CONSUMPTION') && (
            <button
              onClick={() => onNavigate('daily_flow')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold border border-slate-600 shadow-xs transition-colors cursor-pointer"
            >
              <Utensils className="w-4 h-4" />
              Aliran Harian Dapur
            </button>
          )}
        </div>
      </div>

      {/* Critical Operational Attention Alerts */}
      {(lowStockItems.length > 0 || outOfStockItems.length > 0 || pendingOpnames.length > 0 || damagedEquipment.length > 0) && (
        <div className="space-y-2.5">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Perhatian Operasional Mendesak
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {outOfStockItems.length > 0 && (
              <div className="flex items-start justify-between p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-900">
                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                    {outOfStockItems.length} Bahan Habis (0 Stock)
                  </div>
                  <p className="text-[11px] text-rose-700">
                    {outOfStockItems.map(i => i.name).slice(0, 2).join(', ')}
                    {outOfStockItems.length > 2 ? ` dan ${outOfStockItems.length - 2} lainnya` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('inventory')}
                  className="text-xs font-bold text-rose-800 hover:text-rose-900 hover:underline flex items-center gap-1 shrink-0"
                >
                  Cek <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {lowStockItems.length > 0 && (
              <div className="flex items-start justify-between p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <span className="w-2 h-2 rounded-full bg-amber-600" />
                    {lowStockItems.length} Bahan di Bawah Batas Minimum
                  </div>
                  <p className="text-[11px] text-amber-700">
                    {lowStockItems.map(i => i.name).slice(0, 2).join(', ')}
                    {lowStockItems.length > 2 ? ` dan ${lowStockItems.length - 2} lainnya` : ''}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('inventory')}
                  className="text-xs font-bold text-amber-800 hover:text-amber-900 hover:underline flex items-center gap-1 shrink-0"
                >
                  Cek <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {pendingOpnames.length > 0 && (
              <div className="flex items-start justify-between p-3.5 rounded-xl bg-purple-50 border border-purple-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                    <ClipboardCheck className="w-3.5 h-3.5 text-purple-700" />
                    {pendingOpnames.length} Sesi Opname Menunggu Approval
                  </div>
                  <p className="text-[11px] text-purple-700">
                    Sesi #{pendingOpnames[0].id} diajukan oleh {pendingOpnames[0].createdByName}.
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('stock_opname')}
                  className="text-xs font-bold text-purple-800 hover:text-purple-900 hover:underline flex items-center gap-1 shrink-0"
                >
                  Tinjau <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {damagedEquipment.length > 0 && (
              <div className="flex items-start justify-between p-3.5 rounded-xl bg-slate-100 border border-slate-300">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Wrench className="w-3.5 h-3.5 text-slate-700" />
                    {damagedEquipment.length} Peralatan Rusak / Perbaikan
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {damagedEquipment.map(e => e.name).slice(0, 2).join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('equipment')}
                  className="text-xs font-bold text-slate-800 hover:underline flex items-center gap-1 shrink-0"
                >
                  Detail <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TODAY'S FLOW BALANCE & OPERATIONAL METRICS */}
      <div>
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
          Neraca Aliran Pangan Hari Ini (Daily Food Balance)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500">Penerimaan Masuk Hari Ini</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-700">
                {totalReceivedItemsCount.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-slate-500 font-medium">Satuan Bahan</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Dari <span className="font-semibold text-slate-800">{todaysReceivings.length}</span> surat bukti penerimaan
            </span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500">Konsumsi Olahan Dapur Hari Ini</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-amber-700">
                {totalFlowConsumed.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-slate-500 font-medium">Kg / Porsi Masak</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">Bahan segar terpakai hari ini</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500">Sisa Pangan di Chiller</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-sky-800">
                {totalFlowRemaining.toLocaleString('id-ID')}
              </span>
              <span className="text-xs text-slate-500 font-medium">Kg Saldo Akhir</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">Menjadi saldo awal esok pagi</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500">Kesiapan Alat Kerja Masak</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-900">
                {equipment.filter(e => e.condition === 'GOOD').length} / {equipment.length}
              </span>
              <span className="text-xs text-emerald-600 font-bold">Siap</span>
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              {needsInspectionEquipment.length} perlu inspeksi berkala
            </span>
          </div>
        </div>
      </div>

      {/* TWO COLUMN OPERATIONAL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: What Arrived Today */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Barang Masuk Hari Ini ({todaysReceivings.length} Dokumen)
              </h4>
            </div>
            <button
              onClick={() => onNavigate('receiving')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              Lihat Semua
            </button>
          </div>

          <div className="p-4 flex-1">
            {todaysReceivings.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs italic">
                Belum ada barang masuk yang tercatat hari ini ({today}).
              </div>
            ) : (
              <div className="space-y-3">
                {todaysReceivings.map(doc => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-emerald-800">{doc.id}</span>
                        <span className="text-[10px] text-slate-500 font-medium">({doc.arrivalTime} WIB)</span>
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-0.5">{doc.supplierName}</div>
                      <div className="text-[11px] text-slate-600 mt-1">
                        {doc.lines.map(l => `${l.itemName} (${l.quantity} ${l.unit})`).join(', ')}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedReceivingDoc(doc)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-colors shrink-0"
                    >
                      Bukti Fisik
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Stock Status by Criticality */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-700" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Status Stok Kritis & Minimum
              </h4>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            >
              Master Stok
            </button>
          </div>

          <div className="p-4 flex-1">
            <div className="space-y-2.5">
              {[...outOfStockItems, ...lowStockItems].slice(0, 5).map(item => {
                const isOut = item.currentStock <= 0;
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-lg border flex items-center justify-between ${
                      isOut ? 'bg-rose-50/60 border-rose-200' : 'bg-amber-50/60 border-amber-200'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        Kategori: <span className="font-semibold">{item.category}</span> • Lokasi: {item.location}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-mono text-sm font-black ${
                          isOut ? 'text-rose-700' : 'text-amber-800'
                        }`}
                      >
                        {item.currentStock} {item.baseUnit}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Min: {item.minimumStock} {item.baseUnit}
                      </div>
                    </div>
                  </div>
                );
              })}

              {outOfStockItems.length === 0 && lowStockItems.length === 0 && (
                <div className="text-center py-8 text-emerald-700 text-xs font-medium">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                  Semua stok bahan pangan berada di atas batas minimum aman.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
