import React, { useState, useEffect, useMemo } from 'react';
import { useConfirm } from '../context/ConfirmContext';
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
import { localDateIso } from '../utils/localDate';

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
  const askConfirm = useConfirm();

  const [deliveryNoteNo, setDeliveryNoteNo] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [receiveDate, setReceiveDate] = useState(
    localDateIso()
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
      setReceiveDate(localDateIso(now));
      // Nomor surat jalan, hasil timbang, dan kondisi diisi petugas dari barang yang benar-benar datang
      setDeliveryNoteNo('');
      setGeneralNotes('');
      // A nota made from existing expense rows already has its spending recorded
      setAutoRecordExpense(!(po.relatedExpenseIds && po.relatedExpenseIds.length > 0));

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
          actualQty: 0,
          unitPrice: defaultPrice,
          subtotal: 0,
          notes: it.notes || '',
          conditionNote: '',
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

  const isAlreadyReceived = po.status === 'SELESAI';

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
    toast.showToast('Jumlah diterima diisi sama dengan jumlah PO. Periksa lagi bahan yang beratnya berbeda.', 'info');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isAlreadyReceived) {
      toast.error('PO ini sudah diterima. Penerimaan tidak bisa disimpan dua kali.', 'Sudah Diterima');
      return;
    }

    if (items.length === 0) {
      toast.error('Tidak ada bahan dalam PO untuk diterima.', 'Validasi Gagal');
      return;
    }

    const zeroItems = items.filter(it => it.actualQty <= 0);
    if (zeroItems.length === items.length) {
      toast.error('Isi jumlah diterima hasil timbang, minimal untuk satu bahan.', 'Belum Ditimbang');
      return;
    }
    if (zeroItems.length > 0) {
      const confirmZero = await askConfirm({
        title: `${zeroItems.length} bahan belum ditimbang`,
        message: `Jumlahnya masih kosong atau 0 dan akan dianggap tidak datang:\n${zeroItems.map(it => `- ${it.name}`).join('\n')}`,
        confirmText: 'Tetap simpan',
        variant: 'warning',
      });
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
        toast.success(
          result.message || `Penerimaan PO ${po.poNumber} berhasil disimpan ke sistem!`,
          'Penerimaan Berhasil'
        );
        onSuccess(result.po);
        onClose();
      } else {
        toast.error(result.message || 'Gagal memproses penerimaan PO.', 'Gagal Menyimpan');
      }
    } catch (err: any) {
      console.error('Error receiving PO:', err);
      toast.error(err.message || 'Terjadi kesalahan sistem saat memproses PO.', 'Gagal Menyimpan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/90 flex items-start justify-between gap-4">
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
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                {po.supplierName}
              </span>
              {po.notes?.startsWith('PO dibuat otomatis dari Perencanaan Menu:') && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Menu: {po.notes.replace('PO dibuat otomatis dari Perencanaan Menu:', '').trim()}</span>
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {isAlreadyReceived && (
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-800">
              PO ini sudah diterima dan stoknya sudah masuk. Halaman ini hanya untuk dilihat, penerimaan tidak bisa disimpan lagi.
            </div>
          )}
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
                  <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
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
                  <Clock className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
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
                  Isi jumlah sesuai hasil timbangan. Bahan yang tidak datang biarkan kosong.
                </p>
              </div>

              <button
                type="button"
                onClick={handleCopyTargetToActual}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer shrink-0 shadow-2xs self-start sm:self-auto"
              >
                <RotateCcw className="w-3 h-3 text-slate-500" />
                <span>Samakan dengan PO</span>
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
                          <td className="py-2 px-3 font-mono text-slate-500 text-center">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900">{it.name}</div>
                            <div className="text-[10px] text-slate-500">{it.category}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium text-slate-600">
                            {it.targetQty} <span className="text-slate-500">{it.unit}</span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={it.actualQty || ''}
                                onChange={e => handleQtyChange(idx, parseFloat(e.target.value) || 0)}
                                placeholder="0"
                                aria-label={`Jumlah diterima ${it.name}`}
                                className="w-20 px-2 py-1 text-right font-mono font-semibold text-slate-900 bg-white border border-slate-300 rounded focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                              />
                              <span className="text-slate-500 font-medium text-xs w-6">{it.unit}</span>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-center">
                            {it.actualQty <= 0 ? (
                              <span className="text-[11px] text-slate-500">Belum ditimbang</span>
                            ) : diff === 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                Sesuai
                              </span>
                            ) : diff > 0 ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
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
                              <span className="absolute left-2 text-[10px] text-slate-500 font-medium select-none pointer-events-none">Rp</span>
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
                              placeholder="Contoh: segar, 2 ikat layu dikembalikan"
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
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Perbarui Stok Gudang</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={autoRecordExpense}
                  onChange={e => setAutoRecordExpense(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 cursor-pointer"
                />
                <span>Catat ke Laporan Pengeluaran</span>
              </label>
              {po.relatedExpenseIds && po.relatedExpenseIds.length > 0 && (
                <span className="text-[11px] text-slate-600 basis-full">
                  Belanja untuk nota ini sudah tercatat, jadi tidak dicatat lagi.
                </span>
              )}
            </div>
          </div>

          {/* SECTION 4: RECAP & COMPARISON */}
          <div className="bg-emerald-50/70 border border-emerald-200/90 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="space-y-1">
              <div className="text-[11px] text-slate-600 font-medium">Ringkasan Nilai Realisasi Belanja:</div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
                  Rp {calculations.totalActualCost.toLocaleString('id-ID')}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Target PO: Rp {calculations.totalTargetCost.toLocaleString('id-ID')}
                </span>
                {calculations.totalActualQty > 0 && calculations.diffCost !== 0 && (
                  <span
                    className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-md border ${
                      calculations.diffCost > 0
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {calculations.diffCost > 0 ? '+' : ''}
                    Rp {calculations.diffCost.toLocaleString('id-ID')}
                  </span>
                )}
              </div>
            </div>

            <div className="sm:text-right text-xs text-slate-600 space-y-1">
              <div>
                Total Kuantitas Fisik: <strong className="text-slate-900 font-mono">{calculations.totalActualQty} unit</strong>
              </div>
              <div className="text-[11px] text-slate-500">
                Status setelah disimpan: <span className="font-semibold text-emerald-700">Selesai Diterima</span>
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
            disabled={isSubmitting || isAlreadyReceived}
            className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Menyimpan & Memperbarui Sistem...</span>
              </>
            ) : (
              <>
                <PackageCheck className="w-4 h-4 text-emerald-100" />
                <span>Simpan Penerimaan PO</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
