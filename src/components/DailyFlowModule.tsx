import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { DailyFlowRecord } from '../types/warehouse';
import { Utensils, CheckCircle2, ArrowRight, Zap, RefreshCw, Calendar, Sparkles } from 'lucide-react';

interface DailyFlowModuleProps {
  onRefreshData?: () => void;
}

export const DailyFlowModule: React.FC<DailyFlowModuleProps> = ({ onRefreshData }) => {
  const { currentUser, can } = useAuth();
  const [dailyData, setDailyData] = useState<DailyFlowRecord[]>(() => warehouseDb.getDailyFlowData());
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [successMessage, setSuccessMessage] = useState('');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Batch consumption input state: map itemId -> consumedQty
  const [batchInputs, setBatchInputs] = useState<Record<string, number>>({});

  const refreshData = () => {
    const updated = warehouseDb.getDailyFlowData(selectedDate);
    setDailyData(updated);
    if (onRefreshData) onRefreshData();
  };

  const handleOpenBatch = () => {
    const inputs: Record<string, number> = {};
    dailyData.forEach(item => {
      // Default suggested consumption to either available today or existing consumed
      const available = item.openingBalance + item.receivedToday;
      inputs[item.itemId] = item.consumedToday > 0 ? item.consumedToday : Math.min(available, item.receivedToday || available);
    });
    setBatchInputs(inputs);
    setIsBatchModalOpen(true);
  };

  const handlePostBatchConsumption = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let count = 0;
      for (const item of dailyData) {
        const qty = batchInputs[item.itemId] || 0;
        if (qty > 0 && qty !== item.consumedToday) {
          const delta = qty - item.consumedToday;
          if (delta > 0) {
            warehouseDb.recordConsumption(
              item.itemId,
              delta,
              'Dapur Pengolahan SPPG',
              currentUser,
              `Konsumsi batch menu gizi harian (${selectedDate})`,
              `DAILY-PREP-${selectedDate}`
            );
            count++;
          }
        }
      }
      setSuccessMessage(`Berhasil memperbarui data konsumsi dapur harian untuk ${count} bahan.`);
      refreshData();
      setIsBatchModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan konsumsi harian.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Aliran Harian (Daily-Flow Consumables)</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800">
              Protein • Sayur • Buah
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Manajemen bahan cepat pakai: Saldo Awal + Penerimaan Hari Ini - Pengeluaran Dapur = Saldo Akhir.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="focus:outline-none text-xs text-slate-800"
            />
          </div>

          {can('RECORD_CONSUMPTION') && (
            <button
              onClick={handleOpenBatch}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Catat Konsumsi Harian Cepat
            </button>
          )}
        </div>
      </div>

      {/* Formula Explainer Card */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 p-4 rounded-xl bg-slate-900 text-white shadow-xs">
        <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
          <span className="text-[10px] uppercase font-semibold text-slate-400">1. Saldo Awal (Pagi)</span>
          <div className="text-sm font-bold mt-1 text-slate-200">Sisa Kemarin</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Stok bawaan dari penutupan shift sebelumnya.</p>
        </div>

        <div className="flex items-center justify-center font-black text-emerald-400 text-lg sm:hidden">
          +
        </div>

        <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
          <span className="text-[10px] uppercase font-semibold text-emerald-400">2. Penerimaan (+ Masuk)</span>
          <div className="text-sm font-bold mt-1 text-emerald-300">Penerimaan Pagi</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Barang segar datang dari supplier hari ini.</p>
        </div>

        <div className="flex items-center justify-center font-black text-amber-400 text-lg sm:hidden">
          -
        </div>

        <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
          <span className="text-[10px] uppercase font-semibold text-amber-400">3. Konsumsi Dapur (- Keluar)</span>
          <div className="text-sm font-bold mt-1 text-amber-300">Dipakai Masak</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Bahan diolah tim dapur untuk porsi gizi anak.</p>
        </div>

        <div className="flex items-center justify-center font-black text-sky-400 text-lg sm:hidden">
          =
        </div>

        <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700 sm:col-span-2">
          <span className="text-[10px] uppercase font-semibold text-sky-400">4. Saldo Akhir (Sisa Chiller)</span>
          <div className="text-sm font-bold mt-1 text-sky-300">Menjadi Saldo Awal Esok</div>
          <p className="text-[10px] text-slate-400 mt-0.5">Sisa bahan tersimpan di chiller/freezer.</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Nama Bahan</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-right">Saldo Awal</th>
                <th className="py-3 px-4 text-right text-emerald-700">+ Masuk Hari Ini</th>
                <th className="py-3 px-4 text-right">Total Tersedia</th>
                <th className="py-3 px-4 text-right text-amber-700">- Konsumsi Dapur</th>
                <th className="py-3 px-4 text-right text-sky-800 font-bold">= Saldo Akhir</th>
                <th className="py-3 px-4">Satuan</th>
                <th className="py-3 px-4">Status Aliran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dailyData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    Belum ada item tipe FOOD_DAILY_FLOW terdaftar.
                  </td>
                </tr>
              ) : (
                dailyData.map(item => {
                  const totalAvailable = item.openingBalance + item.receivedToday;
                  const isFullyConsumed = totalAvailable > 0 && item.closingBalance === 0;

                  return (
                    <tr key={item.itemId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {item.itemName}
                        <div className="text-[10px] font-mono text-slate-400 font-normal">{item.itemId}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            item.category === 'Protein'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : item.category === 'Sayuran'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-600">
                        {item.openingBalance}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 bg-emerald-50/40">
                        +{item.receivedToday}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-800">
                        {totalAvailable}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-700 bg-amber-50/40">
                        -{item.consumedToday}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-sm font-black text-sky-800 bg-sky-50/50">
                        {item.closingBalance}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-500">{item.unit}</td>
                      <td className="py-3 px-4">
                        {isFullyConsumed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                            Habis Sesuai Rencana
                          </span>
                        ) : item.closingBalance > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                            Sisa {item.closingBalance} {item.unit} di Chiller
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Nol</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK BATCH CONSUMPTION MODAL */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pencatatan Masak Cepat Harian Dapur SPPG</h3>
                  <p className="text-[11px] text-slate-500">
                    Masukkan jumlah bahan yang telah diolah hari ini ({selectedDate}). Sistem langsung menghitung sisa.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handlePostBatchConsumption} className="mt-4 space-y-4">
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Bahan Makanan</th>
                      <th className="py-2.5 px-3 text-right">Tersedia</th>
                      <th className="py-2.5 px-3 w-36">Jumlah Diolah Masak</th>
                      <th className="py-2.5 px-3">Satuan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyData.map(item => {
                      const totalAvailable = item.openingBalance + item.receivedToday;
                      return (
                        <tr key={item.itemId} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-800">{item.itemName}</div>
                            <div className="text-[10px] text-slate-400">{item.category}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {totalAvailable}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="number"
                              min="0"
                              max={totalAvailable}
                              step="any"
                              value={batchInputs[item.itemId] ?? ''}
                              onChange={e =>
                                setBatchInputs(prev => ({
                                  ...prev,
                                  [item.itemId]: parseFloat(e.target.value) || 0,
                                }))
                              }
                              className="w-full text-xs font-mono font-bold rounded border border-slate-300 p-1.5 text-slate-900 focus:ring-1 focus:ring-sky-500"
                              placeholder="0"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-medium">{item.unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Posting Konsumsi Dapur Harian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
