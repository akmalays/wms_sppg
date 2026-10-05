import React, { useState, useEffect, useMemo } from 'react';
import {
  PurchaseOrderNota,
  WeighedPoItemInput,
  ReceivePoMetadata,
} from '../types/warehouse';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  X,
  Calendar,
  Clock,
  Truck,
  Building2,
  CheckCircle2,
  RotateCcw,
  PackageCheck,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

interface PoReceivingWeighingModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrderNota | null;
  onSuccess: (updatedPo: PurchaseOrderNota) => void;
}

export const PoReceivingWeighingModal: React.FC<PoReceivingWeighingModalProps> = ({
  isOpen,
  onClose,
  po,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const toast = useToast();

  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [receiveDate, setReceiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [generalNotes, setGeneralNotes] = useState('');
  const [autoUpdateStock, setAutoUpdateStock] = useState(true);
  const [autoRecordExpense, setAutoRecordExpense] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<WeighedPoItemInput[]>([]);

  // Initialize data when modal opens
  useEffect(() => {
    if (po && isOpen) {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      setArrivalTime(`${currentHours}.${currentMinutes}`);
      setReceiveDate(now.toISOString().slice(0, 10));
      setDeliveryNoteNo(`SJ-${po.poNumber.replace(/[^\w]/g, '-').slice(-10)}`);
      setGeneralNotes(
        po.deliveryTerms ? `Penerimaan sesuai jadwal: ${po.deliveryTerms}` : ''
      );

      const initialItems: WeighedPoItemInput[] = (po.items || []).map(it => {
        const defaultQty = Number(it.quantity) || 1;
        const defaultPrice = Number(it.unitPrice) || 0;
        return {
          poiId: it.id,
          itemId: it.itemId,
          name: it.name,
          category: it.category || 'Bahan Makanan',
          unit: it.unit || 'Kg',
          targetQty: defaultQty,
          actualQty: defaultQty,
          unitPrice: defaultPrice,
          subtotal: it.subtotal || Math.round(defaultQty * defaultPrice),
          notes: it.notes || '',
          conditionNote: 'Kondisi segar, kualitas baik sesuai standar',
        };
      });

      setItems(initialItems);
    }
  }, [po, isOpen]);

  // Calculations
  const calculations = useMemo(() => {
    let totalTargetQty = 0;
    let totalActualQty = 0;
    let totalTargetCost = 0;
    let totalActualCost = 0;

    items.forEach(it => {
      totalTargetQty += it.targetQty;
      totalActualQty += it.actualQty;
      totalTargetCost += it.targetQty * it.unitPrice;
      totalActualCost += it.subtotal;
    });

    const diffCost = totalActualCost - totalTargetCost;

    return {
      totalTargetQty: Math.round(totalTargetQty * 100) / 100,
      totalActualQty: Math.round(totalActualQty * 100) / 100,
      totalTargetCost,
      totalActualCost,
      diffCost,
    };
  }, [items]);

  if (!isOpen || !po) return null;

  const handleQtyChange = (index: number, val: number) => {
    const updated = [...items];
    const item = updated[index];
    const newQty = Math.max(0, val);
    item.actualQty = newQty;
    item.subtotal = Math.round(newQty * item.unitPrice);
    setItems(updated);
  };

  const handlePriceChange = (index: number, val: number) => {
    const updated = [...items];
    const item = updated[index];
    const newPrice = Math.max(0, val);
    item.unitPrice = newPrice;
    item.subtotal = Math.round(item.actualQty * newPrice);
    setItems(updated);
  };

  const handleConditionChange = (index: number, text: string) => {
    const updated = [...items];
    updated[index].conditionNote = text;
    setItems(updated);
  };

  const handleCopyTargetToActual = () => {
    const updated = items.map(it => ({
      ...it,
      actualQty: it.targetQty,
      subtotal: Math.round(it.targetQty * it.unitPrice),
    }));
    setItems(updated);
    toast.showToast('Seluruh kuantitas timbangan disesuaikan sama persis dengan PO.', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.showToast('Tidak ada bahan dalam PO untuk diterima.', 'error');
      return;
    }

    const hasZeroQty = items.some(it => it.actualQty <= 0);
    if (hasZeroQty) {
      const confirmZero = window.confirm(
        'Ada bahan dengan kuantitas timbang 0 (tidak datang/ditolak). Lanjutkan penerimaan barang lainnya?'
      );
      if (!confirmZero) return;
    }

    setIsSubmitting(true);
    try {
      const metadata: ReceivePoMetadata = {
        poId: po.id,
        supplierId: po.supplierId,
        supplierName: po.supplierName,
        deliveryNoteNo: deliveryNoteNo.trim() || undefined,
        arrivalTime: arrivalTime.trim() || undefined,
        date: receiveDate,
        notes: generalNotes.trim() || undefined,
        autoUpdateStock,
        autoRecordExpense,
      };

      const result = warehouseDb.receiveAndCompletePurchaseOrder(
        po.id,
        items,
        metadata,
        currentUser
      );

      if (result.success && result.po) {
        toast.showToast(result.message, 'success');
        onSuccess(result.po);
        onClose();
      } else {
        toast.showToast(result.message || 'Gagal memproses penerimaan PO.', 'error');
      }
    } catch (err: any) {
      console.error('Error receiving PO:', err);
      toast.showToast(err.message || 'Terjadi kesalahan sistem saat memproses PO.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/90 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center border border-slate-200 shrink-0">
              <PackageCheck className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-base font-bold text-slate-900">
                  Penerimaan Bahan PO
                </h2>
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-medium text-slate-600 bg-white border border-slate-200">
                  {po.poNumber}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                    po.status === 'SELESAI'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
                      : 'bg-amber-50 text-amber-800 border-amber-200/80'
                  }`}
                >
                  {po.status === 'SELESAI' ? 'Sudah Diterima' : 'Menunggu Kedatangan'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {po.supplierName}
                </span>
                <span>•</span>
                <span>Target Menu: {po.notes?.replace('PO dibuat otomatis dari Perencanaan Menu:', '') || '-'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* SECTION 1: METADATA PENGIRIMAN & FISIK */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-slate-500" />
              Informasi Kedatangan & Surat Jalan
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Tanggal Tiba</label>
                <div className="relative">
                  <input
                    type="date"
                    value={receiveDate}
                    onChange={e => setReceiveDate(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Jam Tiba Fisik</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Contoh: 13.30"
                    value={arrivalTime}
                    onChange={e => setArrivalTime(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <Clock className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">No. Surat Jalan / Pengantar</label>
                <input
                  type="text"
                  placeholder="Contoh: SJ-2026/09/88"
                  value={deliveryNoteNo}
                  onChange={e => setDeliveryNoteNo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Petugas Penerima (Gudang)</label>
                <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold truncate">
                  {currentUser.name}
                </div>
              </div>

              <div className="sm:col-span-2 md:col-span-4">
                <label className="block text-slate-600 font-medium mb-1">Catatan Tambahan Pengiriman</label>
                <input
                  type="text"
                  placeholder="Contoh: Sayur diterima dalam coolbox bersih, daging ayam dingin 4°C..."
                  value={generalNotes}
                  onChange={e => setGeneralNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: TABLE OF WEIGHED ITEMS */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5 text-slate-500" />
                  Daftar Bahan & Hasil Pemeriksaan Fisik ({items.length} Item)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Sesuaikan kuantitas riil yang diterima dan periksa harga satuan nota.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyTargetToActual}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs self-start sm:self-auto"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Salin Target PO</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Nama Bahan</th>
                      <th className="py-2.5 px-3 w-28 text-right">Target PO</th>
                      <th className="py-2.5 px-3 w-36 text-right">
                        Kuantitas Diterima <span className="text-rose-500">*</span>
                      </th>
                      <th className="py-2.5 px-3 w-24 text-center">Selisih</th>
                      <th className="py-2.5 px-3 w-32 text-right">Harga Satuan</th>
                      <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 min-w-[180px]">Kondisi Fisik / Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it, idx) => {
                      const diff = Math.round((it.actualQty - it.targetQty) * 100) / 100;
                      return (
                        <tr key={it.poiId || idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 font-mono text-slate-400 text-center">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900">{it.name}</div>
                            <div className="text-[10px] text-slate-500">{it.category}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-slate-600">
                            {it.targetQty} <span className="text-slate-400">{it.unit}</span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={it.actualQty || ''}
                                onChange={e => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                                className="w-20 px-2 py-1 text-right font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded focus:border-slate-500 focus:outline-none"
                                required
                              />
                              <span className="text-slate-500 font-medium text-xs w-6">{it.unit}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {diff === 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                Sesuai
                              </span>
                            ) : diff > 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                +{diff} {it.unit}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                {diff} {it.unit}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <div className="relative inline-flex items-center justify-end">
                              <span className="absolute left-2 text-[10px] text-slate-400 font-medium select-none pointer-events-none">Rp</span>
                              <input
                                type="number"
                                min="0"
                                step="100"
                                value={it.unitPrice || ''}
                                onChange={e => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                                className="w-28 pl-7 pr-2 py-1 text-right font-mono text-slate-800 bg-white border border-slate-300 rounded focus:border-slate-500 focus:outline-none"
                              />
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                            Rp {(it.subtotal || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              placeholder="Catatan kondisi bahan..."
                              value={it.conditionNote || ''}
                              onChange={e => handleConditionChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1 text-xs text-slate-700 bg-white border border-slate-200 rounded focus:border-slate-400 focus:outline-none"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* SECTION 3: SYSTEM INTEGRATION OPTIONS */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Integrasi Pembaruan Sistem
            </span>
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={autoUpdateStock}
                  onChange={e => setAutoUpdateStock(e.target.checked)}
                  className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-500 cursor-pointer"
                />
                <span>Perbarui Stok Gudang</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={autoRecordExpense}
                  onChange={e => setAutoRecordExpense(e.target.checked)}
                  className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-500 cursor-pointer"
                />
                <span>Catat ke Laporan Pengeluaran</span>
              </label>
            </div>
          </div>

          {/* SECTION 4: RECAP & COMPARISON */}
          <div className="bg-slate-900 text-white p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[11px] text-slate-400 font-medium">Ringkasan Nilai Realisasi Belanja:</div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-xl font-bold font-mono text-emerald-400 tabular-nums">
                  Rp {calculations.totalActualCost.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Target PO: Rp {calculations.totalTargetCost.toLocaleString('id-ID')}
                </span>
                {calculations.diffCost !== 0 && (
                  <span
                    className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-md border ${
                      calculations.diffCost > 0
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {calculations.diffCost > 0 ? '+' : ''}
                    Rp {calculations.diffCost.toLocaleString('id-ID')}
                  </span>
                )}
              </div>
            </div>

            <div className="sm:text-right text-xs text-slate-300 space-y-1">
              <div>
                Total Kuantitas Fisik: <strong className="text-white font-mono">{calculations.totalActualQty} unit</strong>
              </div>
              <div className="text-[11px] text-slate-400">
                Status setelah disimpan: <span className="font-semibold text-emerald-300">Selesai Diterima</span>
              </div>
            </div>
          </div>
        </form>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan & Memperbarui Sistem...</span>
              </>
            ) : (
              <>
                <PackageCheck className="w-4 h-4" />
                <span>Simpan Penerimaan PO</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
