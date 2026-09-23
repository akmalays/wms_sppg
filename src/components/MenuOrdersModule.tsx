import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { MenuOrder, MenuOrderStatus, MenuIngredientReq } from '../types/warehouse';
import {
  UtensilsCrossed,
  Plus,
  Printer,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronRight,
  Flame,
  ChefHat,
  Truck
} from 'lucide-react';

export const MenuOrdersModule: React.FC = () => {
  const { currentUser, can } = useAuth();
  const [orders, setOrders] = useState<MenuOrder[]>(() => warehouseDb.getMenuOrders());
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState('');

  // Form states for new menu order
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formSession, setFormSession] = useState<'Pagi' | 'Siang' | 'Snack'>('Siang');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPortions, setFormPortions] = useState<number>(250);
  const [formChef, setFormChef] = useState('Chef Joko Santoso');
  const [formNotes, setFormNotes] = useState('');

  // Key ingredients selection from warehouse items
  const items = useMemo(() => warehouseDb.getItems(), []);
  const [ingredients, setIngredients] = useState<MenuIngredientReq[]>([
    { itemId: 'ITM-SMB-001', itemName: 'Beras Pandan Wangi Premium', quantity: 25, unit: 'Kg' },
    { itemId: 'ITM-PRO-001', itemName: 'Daging Ayam Broiler Karkas Bersih', quantity: 20, unit: 'Kg' },
  ]);

  const refreshOrders = () => {
    setOrders(warehouseDb.getMenuOrders());
  };

  const handleStatusChange = (orderId: string, newStatus: MenuOrderStatus) => {
    try {
      warehouseDb.updateMenuOrderStatus(orderId, newStatus, currentUser);
      refreshOrders();
      setSuccessNotice(`Status menu order #${orderId} berhasil diubah ke: ${newStatus}`);
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status order menu.');
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      const matchSession = selectedSession === 'ALL' || ord.mealSession === selectedSession;
      const matchStatus = selectedStatus === 'ALL' || ord.status === selectedStatus;
      const matchSearch =
        ord.menuTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ord.chefInCharge.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSession && matchStatus && matchSearch;
    });
  }, [orders, selectedSession, selectedStatus, searchQuery]);

  // Operational metrics
  const stats = useMemo(() => {
    let totalOrders = orders.length;
    let totalPortionsPlanned = 0;
    let totalPortionsDistributed = 0;
    let inCooking = 0;

    orders.forEach(o => {
      totalPortionsPlanned += o.targetPortions;
      if (o.status === 'DISTRIBUTED' || o.status === 'COMPLETED') {
        totalPortionsDistributed += o.targetPortions;
      }
      if (o.status === 'COOKING' || o.status === 'PREPPING') {
        inCooking++;
      }
    });

    return { totalOrders, totalPortionsPlanned, totalPortionsDistributed, inCooking };
  }, [orders]);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || formPortions <= 0) {
      alert('Nama menu dan target porsi wajib diisi.');
      return;
    }

    try {
      const newId = `ORD-${Date.now().toString().slice(-6)}`;
      const newOrder: MenuOrder = {
        id: newId,
        date: formDate,
        mealSession: formSession,
        menuTitle: formTitle.trim(),
        menuDescription: formDescription.trim(),
        targetPortions: formPortions,
        status: 'PLANNED',
        keyIngredients: ingredients,
        chefInCharge: formChef.trim(),
        notes: formNotes.trim(),
        createdAt: new Date().toISOString(),
      };

      warehouseDb.saveMenuOrder(newOrder, currentUser, true);
      refreshOrders();
      setSuccessNotice(`Berhasil menjadwalkan menu baru: ${newOrder.menuTitle} (${newOrder.targetPortions} porsi).`);
      setIsModalOpen(false);

      // Reset
      setFormTitle('');
      setFormDescription('');
      setFormNotes('');
      setTimeout(() => setSuccessNotice(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan menu order.');
    }
  };

  const getStatusBadge = (status: MenuOrderStatus) => {
    switch (status) {
      case 'PLANNED':
        return { label: 'Direncanakan', class: 'bg-slate-100 text-slate-700 border-slate-300' };
      case 'PREPPING':
        return { label: 'Persiapan Bahan', class: 'bg-amber-50 text-amber-800 border-amber-300' };
      case 'COOKING':
        return { label: 'Sedang Dimasak', class: 'bg-orange-50 text-orange-800 border-orange-300' };
      case 'DISTRIBUTED':
        return { label: 'Didistribusikan', class: 'bg-blue-50 text-blue-800 border-blue-300' };
      case 'COMPLETED':
        return { label: 'Selesai & Valid', class: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
      case 'CANCELLED':
        return { label: 'Dibatalkan', class: 'bg-rose-50 text-rose-800 border-rose-300' };
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Rekap Order Menu Gizi
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Perencanaan menu gizi harian, alokasi porsi sasaran, dan pelacakan alur dapur SPPG.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Cetak Jadwal Menu</span>
          </button>

          {can('ADMIN') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Jadwalkan Menu Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Total Order Menu</div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {stats.totalOrders} <span className="text-xs font-normal text-slate-500">sesi</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Jadwal sarapan, makan siang & snack</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Total Porsi Terencana</div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            {stats.totalPortionsPlanned.toLocaleString('id-ID')}{' '}
            <span className="text-xs font-normal text-slate-500">porsi</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Kebutuhan nutrisi penerima gizi</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Porsi Telah Disalurkan</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            {stats.totalPortionsDistributed.toLocaleString('id-ID')}{' '}
            <span className="text-xs font-normal text-emerald-800">porsi</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Tuntas distribusi ke titik sasaran</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">Proses Dapur Aktif</div>
          <div className="text-xl font-bold text-orange-700 mt-1">
            {stats.inCooking}{' '}
            <span className="text-xs font-normal text-orange-800">menu aktif</span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Tahap persiapan atau sedang masak</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Meal Session Filter */}
          <select
            value={selectedSession}
            onChange={e => setSelectedSession(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Sesi Makan</option>
            <option value="Pagi">Sarapan Pagi</option>
            <option value="Siang">Makan Siang</option>
            <option value="Snack">Kudapan / Snack</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value)}
            className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="ALL">Semua Status Dapur</option>
            <option value="PLANNED">Direncanakan</option>
            <option value="PREPPING">Persiapan Bahan</option>
            <option value="COOKING">Sedang Dimasak</option>
            <option value="DISTRIBUTED">Didistribusikan</option>
            <option value="COMPLETED">Selesai</option>
          </select>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari judul menu / chef / ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 w-56 text-slate-800"
          />
        </div>
      </div>

      {/* Menu Orders List */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-700">Belum ada order menu terjadwal</div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Tidak ada data yang sesuai filter. Silakan jadwalkan menu baru atau ubah filter pencarian.
            </p>
          </div>
        ) : (
          filteredOrders.map(order => {
            const badge = getStatusBadge(order.status);
            return (
              <div
                key={order.id}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs hover:border-slate-300 transition-all"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                  {/* Left Main Info */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {order.id}
                      </span>
                      <span className="text-slate-300">•</span>
                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span className="font-medium">{order.date}</span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Sesi {order.mealSession}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.class}`}>
                        {badge.label}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                      {order.menuTitle}
                    </h3>

                    {order.menuDescription && (
                      <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                        {order.menuDescription}
                      </p>
                    )}

                    {/* Ingredients Pills */}
                    {order.keyIngredients && order.keyIngredients.length > 0 && (
                      <div className="pt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-slate-500 mr-1">Bahan Kunci:</span>
                        {order.keyIngredients.map((ing, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-[11px] text-slate-700"
                          >
                            <span className="font-semibold text-slate-900">{ing.itemName}:</span>
                            <span>{ing.quantity} {ing.unit}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Portions, Chef, & Workflow Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <div className="text-lg font-bold text-slate-900">
                        {order.targetPortions.toLocaleString('id-ID')}{' '}
                        <span className="text-xs font-normal text-slate-500">Porsi</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center sm:justify-end gap-1">
                        <ChefHat className="w-3 h-3 text-slate-400" />
                        <span>PIC: {order.chefInCharge}</span>
                      </div>
                    </div>

                    {/* Status Action Buttons */}
                    {can('ASLAP') && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {order.status === 'PLANNED' && (
                          <button
                            onClick={() => handleStatusChange(order.id, 'PREPPING')}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                          >
                            Mulai Persiapan Dapur
                          </button>
                        )}
                        {order.status === 'PREPPING' && (
                          <button
                            onClick={() => handleStatusChange(order.id, 'COOKING')}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-orange-600 hover:bg-orange-700 text-white transition-colors cursor-pointer"
                          >
                            Mulai Memasak
                          </button>
                        )}
                        {order.status === 'COOKING' && (
                          <button
                            onClick={() => handleStatusChange(order.id, 'DISTRIBUTED')}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                          >
                            Distribusikan Porsi
                          </button>
                        )}
                        {order.status === 'DISTRIBUTED' && can('KA_SPPG') && (
                          <button
                            onClick={() => handleStatusChange(order.id, 'COMPLETED')}
                            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer"
                          >
                            Tandai Selesai & Valid
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {order.notes && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-700">Catatan Pelaksanaan:</span> {order.notes}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Jadwalkan Menu Baru */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Jadwalkan Menu Gizi Baru</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Menetapkan jadwal menu, target porsi sasaran, dan alokasi juru masak.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Pelaksanaan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sesi Makan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formSession}
                    onChange={e => setFormSession(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Pagi">Sarapan Pagi</option>
                    <option value="Siang">Makan Siang</option>
                    <option value="Snack">Kudapan / Snack Sehat</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Menu Gizi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  placeholder="Misal: Nasi Semur Daging Sapi & Tumis Buncis Jagung"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Keterangan Komposisi Gizi & Kalori
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Deskripsi bahan utama, kandungan gizi seimbang, atau standar menu..."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Porsi <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formPortions}
                    onChange={e => setFormPortions(parseInt(e.target.value) || 0)}
                    placeholder="250"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Juru Masak / Chef In Charge
                  </label>
                  <input
                    type="text"
                    value={formChef}
                    onChange={e => setFormChef(e.target.value)}
                    placeholder="Nama Chef"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan Distribusi / Titik Sasaran
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Titik sekolah atau jadwal pengiriman"
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors shadow-2xs"
                >
                  Jadwalkan Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
