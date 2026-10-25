import React, { useState, useEffect, useMemo } from 'react';
import { useConfirm } from '../context/ConfirmContext';
import {
  PurchaseOrderNota,
  WeighedPoItemInput,
  ReceivePoMetadata,
} from '../types/warehouse';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { RotateCcw } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { DialogShell, FIELD_INPUT, FIELD_LABEL, TABLE_INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST } from './common/FormDialog';
import { localDateIso } from '../utils/localDate';
import { convertQty, isCountableUnit, normalizeQtyForUnit, unitKey } from '../utils/unitConversion';
import { isPendingSupplierPo } from '../utils/poSupplier';

interface PoReceivingWeighingModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrderNota | null;
  onSuccess: (updatedPo: PurchaseOrderNota) => void;
}

const MENU_NOTE_PREFIX = 'PO dibuat otomatis dari Perencanaan Menu:';

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
  const [courierName, setCourierName] = useState('');
  // PO "Supplier menyusul": supplier tiap bahan dipilih saat barang datang (indeks baris -> nama supplier)
  const [supplierByIndex, setSupplierByIndex] = useState<Record<number, string>>({});
  const [autoUpdateStock, setAutoUpdateStock] = useState(true);
  const [autoRecordExpense, setAutoRecordExpense] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<WeighedPoItemInput[]>([]);
  // Raw text typed in the qty box, so "0," / "0.5" can be typed without being reset to empty
  const [qtyDrafts, setQtyDrafts] = useState<Record<number, string>>({});

  // Initialize data when modal opens
  useEffect(() => {
    if (po && isOpen) {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      // Disimpan "HH:MM" untuk input jam; dikirim sebagai "HH.MM" seperti format jam di bagian lain aplikasi
      setArrivalTime(`${currentHours}:${currentMinutes}`);
      setReceiveDate(localDateIso(now));
      // Nomor surat jalan, hasil timbang, dan kondisi diisi petugas dari barang yang benar-benar datang
      setDeliveryNoteNo('');
      setGeneralNotes('');
      setCourierName('');
      setSupplierByIndex({});
      // A nota made from existing expense rows already has its spending recorded
      setAutoRecordExpense(!(po.relatedExpenseIds && po.relatedExpenseIds.length > 0));

      const initialItems: WeighedPoItemInput[] = (po.items || []).map(it => {
        // PO lama bisa berisi 0,1 Pcs; satuan hitung selalu dibulatkan (minimal 1)
        const defaultQty = normalizeQtyForUnit(Number(it.quantity) || 1, it.unit);
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
      setQtyDrafts({});
    }
  }, [po, isOpen]);

  // Satuan stok tiap bahan di Master Barang, untuk konversi (mis. Gram -> Kg) saat stok bertambah
  const stockUnitByIndex = useMemo(() => {
    const masterItems = warehouseDb.getItems();
    return items.map(it => {
      const master = masterItems.find(
        m => (it.itemId && m.id === it.itemId) || m.name.trim().toLowerCase() === it.name.trim().toLowerCase()
      );
      return master?.baseUnit as string | undefined;
    });
  }, [items]);

  // Calculations
  const calculations = useMemo(() => {
    let weighedCount = 0;
    let totalTargetCost = 0;
    let totalActualCost = 0;

    items.forEach(it => {
      if (it.actualQty > 0) weighedCount += 1;
      totalTargetCost += Math.round(it.targetQty * it.unitPrice);
      totalActualCost += it.subtotal;
    });

    const diffCost = totalActualCost - totalTargetCost;

    return {
      weighedCount,
      totalTargetCost,
      totalActualCost,
      diffCost,
    };
  }, [items]);

  const supplierOptions = useMemo(() => warehouseDb.getSuppliers().filter(s => s.isActive !== false).map(s => s.name), [isOpen]);

  if (!isOpen || !po) return null;

  const isAlreadyReceived = po.status === 'SELESAI';
  const pendingSupplier = isPendingSupplierPo(po);

  const updateItem = (index: number, patch: (it: WeighedPoItemInput) => Partial<WeighedPoItemInput>) => {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch(it) } : it)));
  };

  const handleQtyChange = (index: number, raw: string) => {
    // Petugas biasa mengetik desimal pakai koma (0,5 kg)
    const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    setQtyDrafts(prev => ({ ...prev, [index]: raw }));
    const newQty = Math.max(0, parseFloat(cleaned) || 0);
    updateItem(index, it => ({ actualQty: newQty, subtotal: Math.round(newQty * it.unitPrice) }));
  };

  // Satuan hitung (Pcs, Botol, ...) tidak bisa pecahan: bulatkan saat keluar dari kolom
  const handleQtyBlur = (index: number) => {
    setQtyDrafts(prev => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
    updateItem(index, it => {
      const qty = isCountableUnit(it.unit) ? normalizeQtyForUnit(it.actualQty, it.unit) : it.actualQty;
      return { actualQty: qty, subtotal: Math.round(qty * it.unitPrice) };
    });
  };

  const handlePriceChange = (index: number, val: number) => {
    const newPrice = Math.max(0, val);
    updateItem(index, it => ({ unitPrice: newPrice, subtotal: Math.round(it.actualQty * newPrice) }));
  };

  const handleConditionChange = (index: number, text: string) => {
    updateItem(index, () => ({ conditionNote: text }));
  };

  const handleCopyTargetToActual = () => {
    const updated = items.map(it => ({
      ...it,
      actualQty: it.targetQty,
      subtotal: Math.round(it.targetQty * it.unitPrice),
    }));
    setItems(updated);
    setQtyDrafts({});
    toast.showToast('Jumlah diterima diisi sama dengan jumlah PO. Periksa lagi bahan yang beratnya berbeda.', 'info');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSubmitting) return;

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

    const mismatchedUnits = items.filter(
      (it, idx) => autoUpdateStock && it.actualQty > 0 && stockUnitByIndex[idx] && convertQty(1, it.unit, stockUnitByIndex[idx]!) === null
    );
    if (mismatchedUnits.length > 0) {
      const confirmMismatch = await askConfirm({
        title: 'Satuan berbeda dengan satuan stok',
        message: `Bahan berikut tidak bisa dikonversi otomatis, jadi stoknya tidak akan ditambah:\n${mismatchedUnits
          .map(it => `- ${it.name}: ${it.unit} → ${stockUnitByIndex[items.indexOf(it)]}`)
          .join('\n')}\n\nSesuaikan nanti lewat koreksi stok.`,
        confirmText: 'Tetap simpan',
        variant: 'warning',
      });
      if (!confirmMismatch) return;
    }

    const unpricedItems = items.filter(it => it.actualQty > 0 && it.unitPrice <= 0);
    if (autoRecordExpense && unpricedItems.length > 0) {
      const confirmUnpriced = await askConfirm({
        title: `${unpricedItems.length} bahan belum ada harganya`,
        message: `Harga satuan masih Rp 0, jadi akan tercatat Rp 0 di laporan pengeluaran:\n${unpricedItems.map(it => `- ${it.name}`).join('\n')}`,
        confirmText: 'Tetap simpan',
        variant: 'warning',
      });
      if (!confirmUnpriced) return;
    }

    if (pendingSupplier) {
      const noSupplier = items.filter((it, idx) => it.actualQty > 0 && !(supplierByIndex[idx] || '').trim());
      if (noSupplier.length > 0) {
        toast.error(`Pilih supplier untuk: ${noSupplier.map(it => it.name).join(', ')}.`, 'Supplier Belum Diisi');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const notes = [generalNotes.trim(), courierName.trim() && `Diantar oleh: ${courierName.trim()}`].filter(Boolean).join('. ');
      const finalItems = items.map(it => {
        if (!isCountableUnit(it.unit)) return it;
        const qty = normalizeQtyForUnit(it.actualQty, it.unit);
        return { ...it, actualQty: qty, subtotal: Math.round(qty * it.unitPrice) };
      });

      // PO "Supplier menyusul" dipecah dulu jadi PO per supplier, supaya stok, pengeluaran, dan nota
      // tercatat atas nama supplier yang benar-benar mengirim.
      let targets: PurchaseOrderNota[] = [po];
      if (pendingSupplier) {
        const assignments: Record<string, string> = {};
        items.forEach((it, idx) => {
          if (supplierByIndex[idx]?.trim()) assignments[it.poiId] = supplierByIndex[idx].trim();
        });
        const split = warehouseDb.splitPendingSupplierPurchaseOrder(po.id, assignments, currentUser);
        if (!split.success || !split.pos) {
          toast.error(split.message || 'Gagal memecah PO per supplier.', 'Gagal Menyimpan');
          return;
        }
        targets = split.pos;
      }

      const received: PurchaseOrderNota[] = [];
      const warnings: string[] = [];
      for (const target of targets) {
        const poiIds = new Set(target.items.map(i => i.id));
        const result = warehouseDb.receiveAndCompletePurchaseOrder(
          target.id,
          finalItems.filter(it => poiIds.has(it.poiId)),
          {
            poId: target.id,
            supplierId: target.supplierId,
            supplierName: target.supplierName,
            deliveryNoteNo: deliveryNoteNo.trim() || undefined,
            arrivalTime: arrivalTime.trim() || undefined,
            date: receiveDate,
            notes: notes || undefined,
            autoUpdateStock,
            autoRecordExpense,
          } satisfies ReceivePoMetadata,
          currentUser
        );
        if (!result.success || !result.po) {
          toast.error(result.message || `Gagal memproses penerimaan PO ${target.poNumber}.`, 'Gagal Menyimpan');
          return;
        }
        received.push(result.po);
        if (result.unconvertedItems && result.unconvertedItems.length > 0) warnings.push(result.message);
      }

      if (warnings.length > 0) {
        toast.warning(warnings.join(' '), 'Stok Perlu Dicek');
      } else if (received.length > 1) {
        toast.success(
          `Penerimaan disimpan dan dipecah jadi ${received.length} PO: ${received.map(r => `${r.poNumber} (${r.supplierName})`).join(', ')}. Nota tiap supplier bisa dicetak dari Barang Masuk.`,
          'Penerimaan Berhasil'
        );
      } else {
        toast.success(`Penerimaan PO ${received[0].poNumber} berhasil disimpan ke sistem!`, 'Penerimaan Berhasil');
      }
      onSuccess(received[received.length - 1]);
      onClose();
    } catch (err: any) {
      console.error('Error receiving PO:', err);
      toast.error(err.message || 'Terjadi kesalahan sistem saat memproses PO.', 'Gagal Menyimpan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const menuName = po.notes?.startsWith(MENU_NOTE_PREFIX) ? po.notes.replace(MENU_NOTE_PREFIX, '').trim() : '';
  const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  return (
    <DialogShell
      size="2xl"
      title="Terima bahan PO"
      badges={
        <>
          <span className="px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-700">
            {po.poNumber}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[11px] font-medium ${
              isAlreadyReceived ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
            }`}
          >
            {isAlreadyReceived ? 'Sudah diterima' : 'Menunggu kedatangan'}
          </span>
        </>
      }
      description={
        <>
          {po.supplierName}
          {menuName && <> · Menu: {menuName}</>}
        </>
      }
      // Dialog tidak ditutup saat sedang menyimpan
      onClose={() => !isSubmitting && onClose()}
      onSubmit={handleSubmit}
      footer={
        <>
          {/* Ringkasan di kiri footer agar terlihat saat tabel digulir; aksi simpan tetap satu-satunya fokus */}
          <div className="mr-auto text-xs text-slate-700">
            <span className="font-mono font-semibold text-slate-900 tabular-nums">{rupiah(calculations.totalActualCost)}</span>
            {calculations.totalTargetCost > 0 && (
              <span className="text-slate-600"> dari {rupiah(calculations.totalTargetCost)}</span>
            )}
            <span className="text-slate-600"> · {calculations.weighedCount} dari {items.length} bahan ditimbang</span>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
            Batal
          </button>
          <button type="submit" disabled={isSubmitting || isAlreadyReceived} className={BTN_PRIMARY}>
            {isSubmitting ? 'Menyimpan…' : 'Simpan penerimaan'}
          </button>
        </>
      }
    >
      {/* Enter di kolom isian tidak langsung menyimpan seluruh penerimaan */}
      <div
        className="space-y-5"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
        }}
      >
        {isAlreadyReceived && (
          <p className="px-3 py-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-800">
            PO ini sudah diterima dan stoknya sudah masuk. Data hanya bisa dilihat.
          </p>
        )}

        <fieldset disabled={isAlreadyReceived || isSubmitting} className="space-y-5 min-w-0">
          {/* Kedatangan */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">Kedatangan</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label htmlFor="rcv-date" className={FIELD_LABEL}>Tanggal tiba</label>
                <input id="rcv-date" type="date" required value={receiveDate} onChange={e => setReceiveDate(e.target.value)} className={FIELD_INPUT} />
              </div>
              <div>
                <label htmlFor="rcv-time" className={FIELD_LABEL}>Jam tiba</label>
                <input id="rcv-time" type="time" value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className={FIELD_INPUT} />
              </div>
              <div>
                <label htmlFor="rcv-sj" className={FIELD_LABEL}>No. surat jalan supplier</label>
                <input
                  id="rcv-sj"
                  type="text"
                  placeholder="Kosongkan bila tidak ada"
                  value={deliveryNoteNo}
                  onChange={e => setDeliveryNoteNo(e.target.value)}
                  className={FIELD_INPUT}
                />
              </div>
              <div>
                <label htmlFor="rcv-courier" className={FIELD_LABEL}>Nama pengantar</label>
                <input
                  id="rcv-courier"
                  type="text"
                  placeholder="Orang yang mengantar barang"
                  value={courierName}
                  onChange={e => setCourierName(e.target.value)}
                  className={FIELD_INPUT}
                />
              </div>
              <div>
                <span className={FIELD_LABEL}>Diterima oleh</span>
                <p className="min-h-[44px] sm:min-h-[34px] flex items-center text-xs font-semibold text-slate-900">{currentUser.name}</p>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label htmlFor="rcv-notes" className={FIELD_LABEL}>Catatan pengiriman</label>
                <input
                  id="rcv-notes"
                  type="text"
                  placeholder="Mis. ayam datang dingin 4°C, sayur dalam keranjang bersih"
                  value={generalNotes}
                  onChange={e => setGeneralNotes(e.target.value)}
                  className={FIELD_INPUT}
                />
              </div>
            </div>
          </section>

          {/* Hasil timbang */}
          <section className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Hasil timbang ({items.length} bahan)</h3>
                <p className="text-[11px] text-slate-600">
                  Isi jumlah sesuai timbangan. Bahan yang tidak datang biarkan kosong.
                  {pendingSupplier && ' Pilih supplier tiap bahan; PO otomatis dipecah per supplier saat disimpan.'}
                </p>
              </div>
              <button type="button" onClick={handleCopyTargetToActual} className={`${BTN_SECONDARY} self-start sm:self-auto`}>
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                Samakan dengan PO
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold min-w-[180px]">Bahan</th>
                    {pendingSupplier && <th className="py-2 px-3 font-semibold min-w-[170px]">Supplier</th>}
                    <th className="py-2 px-3 font-semibold text-right w-24">Dipesan</th>
                    <th className="py-2 px-3 font-semibold w-36">Diterima</th>
                    <th className="py-2 px-3 font-semibold w-24">Selisih</th>
                    <th className="py-2 px-3 font-semibold w-32">Harga satuan</th>
                    <th className="py-2 px-3 font-semibold text-right w-28">Subtotal</th>
                    <th className="py-2 px-3 font-semibold min-w-[170px]">Kondisi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((it, idx) => {
                    const diff = Math.round((it.actualQty - it.targetQty) * 100) / 100;
                    const stockUnit = stockUnitByIndex[idx];
                    const needsConversion = !!stockUnit && unitKey(stockUnit) !== unitKey(it.unit);
                    const convertedQty = needsConversion ? convertQty(it.actualQty, it.unit, stockUnit!) : null;
                    return (
                      <tr key={it.poiId || idx} className="align-top">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-900">{it.name}</div>
                          <div className="text-[11px] text-slate-600">{it.category}</div>
                        </td>
                        {pendingSupplier && (
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              list="rcv-supplier-options"
                              value={supplierByIndex[idx] || ''}
                              onChange={e => setSupplierByIndex(prev => ({ ...prev, [idx]: e.target.value }))}
                              placeholder="Pilih atau ketik"
                              aria-label={`Supplier ${it.name}`}
                              aria-invalid={(it.actualQty > 0 && !(supplierByIndex[idx] || '').trim()) || undefined}
                              className={`${TABLE_INPUT} ${it.actualQty > 0 && !(supplierByIndex[idx] || '').trim() ? 'border-amber-400' : ''}`}
                            />
                          </td>
                        )}
                        <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap pt-3">
                          {it.targetQty.toLocaleString('id-ID')} {it.unit}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={qtyDrafts[idx] ?? (it.actualQty ? String(it.actualQty) : '')}
                              onChange={e => handleQtyChange(idx, e.target.value)}
                              onBlur={() => handleQtyBlur(idx)}
                              placeholder="0"
                              aria-label={`Jumlah diterima ${it.name}`}
                              className={`${TABLE_INPUT} w-20 text-right font-mono`}
                            />
                            <span className="text-slate-600 whitespace-nowrap">{it.unit}</span>
                          </div>
                          {needsConversion && autoUpdateStock && (
                            convertedQty === null ? (
                              <div className="mt-1 text-[11px] text-amber-800">Stok dalam {stockUnit}, tidak bisa dikonversi</div>
                            ) : it.actualQty > 0 ? (
                              <div className="mt-1 text-[11px] text-slate-600 font-mono">= {convertedQty.toLocaleString('id-ID')} {stockUnit} di stok</div>
                            ) : null
                          )}
                        </td>
                        <td className="py-2 px-3 pt-3 whitespace-nowrap">
                          {it.actualQty <= 0 ? (
                            <span className="text-slate-500">-</span>
                          ) : diff === 0 ? (
                            <span className="text-slate-700">Sesuai</span>
                          ) : (
                            <span className={`font-mono font-semibold ${diff > 0 ? 'text-sky-700' : 'text-amber-800'}`}>
                              {diff > 0 ? '+' : ''}
                              {diff.toLocaleString('id-ID')} {it.unit}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">Rp</span>
                            <input
                              type="number"
                              min="0"
                              step="100"
                              value={it.unitPrice || ''}
                              onChange={e => handlePriceChange(idx, parseFloat(e.target.value) || 0)}
                              aria-label={`Harga satuan ${it.name}`}
                              aria-invalid={it.unitPrice <= 0 || undefined}
                              className={`${TABLE_INPUT} pl-7 text-right font-mono ${it.unitPrice <= 0 ? 'border-amber-400' : ''}`}
                            />
                          </div>
                          {it.unitPrice <= 0 && <div className="mt-1 text-[11px] text-amber-800">Harga belum diisi</div>}
                        </td>
                        <td className="py-2 px-3 pt-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                          {rupiah(it.subtotal || 0)}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            placeholder="Mis. segar, 2 ikat layu"
                            value={it.conditionNote || ''}
                            onChange={e => handleConditionChange(idx, e.target.value)}
                            aria-label={`Kondisi ${it.name}`}
                            className={TABLE_INPUT}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pendingSupplier && (
                <datalist id="rcv-supplier-options">
                  {supplierOptions.map(name => <option key={name} value={name} />)}
                </datalist>
              )}
            </div>
            {calculations.weighedCount > 0 && calculations.diffCost !== 0 && calculations.totalTargetCost > 0 && (
              <p className={`text-[11px] ${calculations.diffCost > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                Nilai diterima {calculations.diffCost > 0 ? 'lebih' : 'kurang'} {rupiah(Math.abs(calculations.diffCost))} dari nilai PO.
              </p>
            )}
          </section>

          {/* Setelah disimpan */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">Setelah disimpan</h3>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2">
              <label className="inline-flex items-center gap-2 min-h-[44px] sm:min-h-0 cursor-pointer text-slate-800">
                <input
                  type="checkbox"
                  checked={autoUpdateStock}
                  onChange={e => setAutoUpdateStock(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700 border-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer"
                />
                Tambahkan ke stok gudang
              </label>
              <label className="inline-flex items-center gap-2 min-h-[44px] sm:min-h-0 cursor-pointer text-slate-800">
                <input
                  type="checkbox"
                  checked={autoRecordExpense}
                  onChange={e => setAutoRecordExpense(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-700 border-slate-300 focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer"
                />
                Catat ke laporan pengeluaran
              </label>
            </div>
            {po.relatedExpenseIds && po.relatedExpenseIds.length > 0 && (
              <p className="text-[11px] text-slate-600">Belanja untuk nota ini sudah tercatat, jadi tidak dicatat lagi.</p>
            )}
          </section>
        </fieldset>
      </div>
    </DialogShell>
  );
};
