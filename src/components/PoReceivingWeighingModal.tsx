import React, { useState, useEffect, useMemo } from 'react';
import { useConfirm } from '../context/ConfirmContext';
import {
  PurchaseOrderNota,
  PurchaseOrderItem,
  WeighedPoItemInput,
  ReceivePoMetadata,
} from '../types/warehouse';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { DialogShell, FIELD_INPUT, FIELD_LABEL, TABLE_INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST } from './common/FormDialog';
import { localDateIso } from '../utils/localDate';
import { convertQty, isCountableUnit, normalizeQtyForUnit, unitKey } from '../utils/unitConversion';
import { isPendingSupplierPo } from '../utils/poSupplier';
import { handleGridKeyDown } from '../utils/gridNav';
import { ExtraCost, filledExtraCosts, sumExtraCosts } from '../utils/extraCosts';
import { ExtraCostsEditor } from './common/ExtraCostsEditor';

interface PoReceivingWeighingModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PurchaseOrderNota | null;
  onSuccess: (updatedPo: PurchaseOrderNota) => void;
}

const MENU_NOTE_PREFIX = 'PO dibuat otomatis dari Perencanaan Menu:';
// Bahan yang ikut datang padahal tidak ada di PO; dikenali dari awalan id barisnya
const EXTRA_PREFIX = 'POI-LUAR-';
const EXTRA_NOTE = 'Di luar PO';
const UNIT_OPTIONS = ['Kg', 'Gram', 'Liter', 'Pcs', 'Pack', 'Dus', 'Ikat', 'Butir', 'Roll', 'Botol', 'Jerigen', 'Pouch', 'Rim'];
const isExtraItem = (it: WeighedPoItemInput) => it.poiId.startsWith(EXTRA_PREFIX);

// Harga diketik bebas: "14250", "14.333" (titik ribuan), "14 333", "Rp 100.000", "5000,5" (koma desimal)
const parseRupiah = (raw: string): number => {
  const v = raw.replace(/[^\d.,]/g, '');
  const normalized = /^\d{1,3}(\.\d{3})+(,\d*)?$/.test(v) ? v.replace(/\./g, '').replace(',', '.') : v.replace(',', '.');
  return Math.max(0, parseFloat(normalized) || 0);
};
const formatRupiahInput = (n: number) => (n ? n.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '');

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
  // Supplier yang benar-benar mengirim tiap bahan (id baris -> nama). Diisi supplier rencana di PO;
  // PO "Supplier menyusul" diisi petugas saat barang datang.
  const [supplierByPoiId, setSupplierByPoiId] = useState<Record<string, string>>({});
  const [autoUpdateStock, setAutoUpdateStock] = useState(true);
  const [autoRecordExpense, setAutoRecordExpense] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [items, setItems] = useState<WeighedPoItemInput[]>([]);
  // Raw text typed in the qty box, so "0," / "0.5" can be typed without being reset to empty
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  // Teks harga yang sedang diketik; dirapikan (titik ribuan) saat keluar dari kolom
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  // Harga per kemasan (opsional), mis. Rp100.000 per dus isi 20: harga satuan dihitung otomatis
  const [packByPoiId, setPackByPoiId] = useState<Record<string, { price: string; size: string }>>({});
  // Biaya tambahan supplier (selep, kresek) yang ikut ditagih di nota
  const [extraCosts, setExtraCosts] = useState<ExtraCost[]>([]);

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
      setSupplierByPoiId(
        isPendingSupplierPo(po) ? {} : Object.fromEntries((po.items || []).map(it => [it.id, po.supplierName]))
      );
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
      setExtraCosts([]);
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
  const masterItems = useMemo(() => warehouseDb.getItems().filter(i => i.isActive !== false), [isOpen]);

  if (!isOpen || !po) return null;

  const isAlreadyReceived = po.status === 'SELESAI';
  const pendingSupplier = isPendingSupplierPo(po);
  const plannedSupplier = pendingSupplier ? '' : po.supplierName;

  // Supplier yang benar-benar mengirim bahan: biaya tambahan hanya bisa ditagihkan ke salah satunya
  const receivedSuppliers = [
    ...new Map(
      items
        .filter(it => it.actualQty > 0)
        .map(it => (supplierByPoiId[it.poiId] || '').trim())
        .filter(Boolean)
        .map(name => [name.toLowerCase(), name] as const)
    ).values(),
  ];
  const costSupplierOptions = receivedSuppliers.length > 0 ? receivedSuppliers : plannedSupplier ? [plannedSupplier] : [];
  const extraCostTotal = sumExtraCosts(extraCosts);
  // Satu supplier saja: biaya otomatis milik supplier itu
  const costSupplierOf = (c: ExtraCost) => (costSupplierOptions.length === 1 ? costSupplierOptions[0] : (c.supplierName || '').trim());

  const updateItem = (index: number, patch: (it: WeighedPoItemInput) => Partial<WeighedPoItemInput>) => {
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, ...patch(it) } : it)));
  };

  const handleAddExtraItem = () => {
    const poiId = `${EXTRA_PREFIX}${Date.now()}`;
    setItems(prev => [
      ...prev,
      { poiId, name: '', category: 'Bahan Makanan', unit: 'Kg', targetQty: 0, actualQty: 0, unitPrice: 0, subtotal: 0, notes: EXTRA_NOTE, conditionNote: '' },
    ]);
    setSupplierByPoiId(prev => ({ ...prev, [poiId]: plannedSupplier }));
  };

  // Nama yang cocok dengan Master Barang ikut membawa id, kategori, dan satuan stoknya
  const handleExtraNameChange = (index: number, name: string) => {
    const master = masterItems.find(m => m.name.trim().toLowerCase() === name.trim().toLowerCase());
    updateItem(index, () =>
      master ? { name, itemId: master.id, category: master.category, unit: master.baseUnit } : { name, itemId: undefined }
    );
  };

  const handleRemoveExtraItem = (index: number) => {
    const poiId = items[index].poiId;
    setItems(prev => prev.filter((_, i) => i !== index));
    setSupplierByPoiId(({ [poiId]: _removed, ...rest }) => rest);
  };

  const handleQtyChange = (index: number, raw: string) => {
    // Petugas biasa mengetik desimal pakai koma (0,5 kg)
    const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
    setQtyDrafts(prev => ({ ...prev, [items[index].poiId]: raw }));
    const newQty = Math.max(0, parseFloat(cleaned) || 0);
    updateItem(index, it => ({ actualQty: newQty, subtotal: Math.round(newQty * it.unitPrice) }));
  };

  // Satuan hitung (Pcs, Botol, ...) tidak bisa pecahan: bulatkan saat keluar dari kolom
  const handleQtyBlur = (index: number) => {
    setQtyDrafts(prev => {
      const next = { ...prev };
      delete next[items[index].poiId];
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

  const packFor = (poiId: string) => {
    const pack = packByPoiId[poiId];
    const price = pack ? parseRupiah(pack.price) : 0;
    const size = pack ? Math.max(0, parseFloat(pack.size.replace(',', '.')) || 0) : 0;
    return { price, size, active: price > 0 && size > 0 };
  };

  const handlePackChange = (index: number, patch: Partial<{ price: string; size: string }>) => {
    const poiId = items[index].poiId;
    const current = packByPoiId[poiId];
    const next = { price: current?.price ?? '', size: current?.size ?? '', ...patch };
    setPackByPoiId(prev => ({ ...prev, [poiId]: next }));
    const price = parseRupiah(next.price);
    const size = Math.max(0, parseFloat(next.size.replace(',', '.')) || 0);
    if (price > 0 && size > 0) handlePriceChange(index, Math.round((price / size) * 100) / 100);
  };

  const handleConditionChange = (index: number, text: string) => {
    updateItem(index, () => ({ conditionNote: text }));
  };

  const handleCopyTargetToActual = () => {
    // Bahan di luar PO tidak punya jumlah pesanan, jadi angkanya dibiarkan
    const updated = items.map(it =>
      isExtraItem(it) ? it : { ...it, actualQty: it.targetQty, subtotal: Math.round(it.targetQty * it.unitPrice) }
    );
    setItems(updated);
    setQtyDrafts(prev => Object.fromEntries(Object.entries(prev).filter(([poiId]) => poiId.startsWith(EXTRA_PREFIX))));
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

    const extras = items.filter(isExtraItem);
    if (extras.some(it => !it.name.trim() || !it.unit.trim() || it.actualQty <= 0)) {
      toast.error('Bahan di luar PO perlu nama, jumlah diterima, dan satuan. Hapus barisnya bila tidak jadi.', 'Bahan Tambahan Belum Lengkap');
      return;
    }

    const zeroItems = items.filter(it => !isExtraItem(it) && it.actualQty <= 0);
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

    const noSupplier = items.filter(it => it.actualQty > 0 && !(supplierByPoiId[it.poiId] || '').trim());
    if (noSupplier.length > 0) {
      toast.error(`Pilih supplier untuk: ${noSupplier.map(it => it.name).join(', ')}.`, 'Supplier Belum Diisi');
      return;
    }

    const costs = filledExtraCosts(extraCosts);
    const receivedKeys = new Set(costSupplierOptions.map(s => s.toLowerCase()));
    const orphanCosts = costs.filter(c => !receivedKeys.has(costSupplierOf(c).toLowerCase()));
    if (orphanCosts.length > 0) {
      toast.error(
        `Pilih supplier yang menagih: ${orphanCosts.map(c => c.label).join(', ')}. Hanya supplier yang mengirim bahan yang bisa dipilih.`,
        'Biaya Tambahan Belum Lengkap'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const notes = [generalNotes.trim(), courierName.trim() && `Diantar oleh: ${courierName.trim()}`].filter(Boolean).join('. ');
      const finalItems = items.map(it => {
        if (!isCountableUnit(it.unit)) return it;
        const qty = normalizeQtyForUnit(it.actualQty, it.unit);
        return { ...it, actualQty: qty, subtotal: Math.round(qty * it.unitPrice) };
      });

      // PO dipecah dulu per supplier yang benar-benar mengirim (bila beda dari rencana atau ada bahan di luar PO),
      // supaya stok, pengeluaran, dan nota tercatat atas nama supplier itu. Bahan yang tidak datang tidak
      // diberi supplier, jadi ikut PO asal.
      const assignments: Record<string, string> = {};
      finalItems.forEach(it => {
        const name = (supplierByPoiId[it.poiId] || '').trim();
        if (it.actualQty > 0 && name) assignments[it.poiId] = name;
      });
      const extraItems: PurchaseOrderItem[] = finalItems.filter(isExtraItem).map(it => ({
        id: it.poiId,
        itemId: it.itemId,
        name: it.name.trim(),
        category: it.category,
        quantity: it.actualQty,
        unit: it.unit,
        unitPrice: it.unitPrice,
        subtotal: it.subtotal,
        notes: EXTRA_NOTE,
      }));
      const split = warehouseDb.splitPurchaseOrderBySupplier(po.id, assignments, currentUser, extraItems);
      if (!split.success || !split.pos) {
        toast.error(split.message || 'Gagal memecah PO per supplier.', 'Gagal Menyimpan');
        return;
      }
      const targets = split.pos;
      // Nama supplier di PO hasil pecahan bisa sedikit beda tulisannya; biaya yang tidak cocok ikut PO pertama
      const costKey = (c: ExtraCost) => costSupplierOf(c).toLowerCase();
      const targetKeys = new Set(targets.map(t => t.supplierName.trim().toLowerCase()));
      const unmatchedCosts = costs.filter(c => !targetKeys.has(costKey(c)));

      const received: PurchaseOrderNota[] = [];
      const warnings: string[] = [];
      for (const [targetIdx, target] of targets.entries()) {
        const poiIds = new Set(target.items.map(i => i.id));
        const result = warehouseDb.receiveAndCompletePurchaseOrder(
          target.id,
          finalItems.filter(it => poiIds.has(it.poiId)).map(it => ({ ...it, name: it.name.trim() })),
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
            extraCosts: [
              ...costs.filter(c => costKey(c) === target.supplierName.trim().toLowerCase()),
              ...(targetIdx === 0 ? unmatchedCosts : []),
            ],
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
          `Penerimaan disimpan sebagai ${received.length} PO per supplier: ${received.map(r => `${r.poNumber} (${r.supplierName})`).join(', ')}. Nota tiap supplier bisa dicetak dari Barang Masuk.`,
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

  const menuName = po.notes?.startsWith(MENU_NOTE_PREFIX) ? po.notes.split('\n')[0].replace(MENU_NOTE_PREFIX, '').trim() : '';
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
          {pendingSupplier ? po.supplierName : `Supplier rencana: ${po.supplierName}`}
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
            <span className="font-mono font-semibold text-slate-900 tabular-nums">{rupiah(calculations.totalActualCost + extraCostTotal)}</span>
            {calculations.totalTargetCost > 0 && (
              <span className="text-slate-600"> dari {rupiah(calculations.totalTargetCost)}</span>
            )}
            {extraCostTotal > 0 && <span className="text-slate-600"> · termasuk biaya tambahan {rupiah(extraCostTotal)}</span>}
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
            {/* Penerima bukan isian, jadi ditulis di baris judul agar grid isian tetap sejajar */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <h3 className="text-sm font-semibold text-slate-800">Kedatangan</h3>
              <p className="text-[11px] text-slate-600">
                Diterima oleh <span className="font-semibold text-slate-900">{currentUser.name}</span>
              </p>
            </div>
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
              <div className="sm:col-span-2 lg:col-span-4">
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
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-800">Hasil timbang ({items.length} bahan)</h3>
                <p className="text-[11px] text-slate-600">
                  Kosongkan bahan yang tidak datang. Pindah sel dengan panah atau Enter.{' '}
                  {pendingSupplier
                    ? 'Pilih supplier tiap bahan, PO dipecah per supplier saat disimpan.'
                    : 'Supplier bisa diganti per bahan, PO dipecah per supplier saat disimpan.'}
                </p>
              </div>
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                <button type="button" onClick={handleCopyTargetToActual} className={BTN_SECONDARY}>
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  Samakan dengan PO
                </button>
                <button type="button" onClick={handleAddExtraItem} className={BTN_SECONDARY}>
                  <Plus className="w-3.5 h-3.5 text-slate-500" />
                  Bahan di luar PO
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-x-auto">
              {/* Lebar minimum: di layar sempit tabel digeser ke samping, bukan isiannya yang menyempit */}
              <table className="w-full min-w-[1320px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3 font-semibold min-w-[180px]">Bahan</th>
                    <th className="py-2 px-3 font-semibold min-w-[170px]">Supplier</th>
                    <th className="py-2 px-3 font-semibold text-right w-24">Dipesan</th>
                    <th className="py-2 px-3 font-semibold min-w-[140px]">Diterima</th>
                    <th className="py-2 px-3 font-semibold w-24">Selisih</th>
                    <th className="py-2 px-3 font-semibold min-w-[220px]">
                      Harga kemasan <span className="font-normal text-slate-500">(opsional)</span>
                    </th>
                    <th className="py-2 px-3 font-semibold min-w-[140px]">Harga satuan</th>
                    <th className="py-2 px-3 font-semibold text-right w-28">Subtotal</th>
                    <th className="py-2 px-3 font-semibold min-w-[170px]">Kondisi</th>
                  </tr>
                </thead>
                {/* Navigasi seperti spreadsheet: panah dan Enter pindah sel (lihat utils/gridNav) */}
                <tbody className="divide-y divide-slate-100" onKeyDownCapture={handleGridKeyDown}>
                  {items.map((it, idx) => {
                    const diff = Math.round((it.actualQty - it.targetQty) * 100) / 100;
                    const stockUnit = stockUnitByIndex[idx];
                    const needsConversion = !!stockUnit && unitKey(stockUnit) !== unitKey(it.unit);
                    const convertedQty = needsConversion ? convertQty(it.actualQty, it.unit, stockUnit!) : null;
                    const extra = isExtraItem(it);
                    const label = it.name.trim() || 'bahan di luar PO';
                    const supplier = supplierByPoiId[it.poiId] || '';
                    const supplierMissing = it.actualQty > 0 && !supplier.trim();
                    const supplierChanged =
                      !extra && !!plannedSupplier && !!supplier.trim() && supplier.trim().toLowerCase() !== plannedSupplier.trim().toLowerCase();
                    return (
                      <tr key={it.poiId || idx} data-grid-rowel className={`align-top ${extra ? 'bg-sky-50/40' : ''}`}>
                        <td className="py-2 px-3">
                          {extra ? (
                            <div className="flex items-start gap-1.5">
                              <div className="flex-1 min-w-0">
                                <input
                                  type="text"
                                  list="rcv-item-options"
                                  value={it.name}
                                  onChange={e => handleExtraNameChange(idx, e.target.value)}
                                  placeholder="Nama bahan"
                                  data-grid-col={0}
                                  aria-label="Nama bahan di luar PO"
                                  aria-invalid={!it.name.trim() || undefined}
                                  className={`${TABLE_INPUT} ${!it.name.trim() ? 'border-amber-400' : ''}`}
                                />
                                <div className="mt-1 text-[11px] font-medium text-sky-800">{EXTRA_NOTE}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveExtraItem(idx)}
                                aria-label={`Hapus baris ${label}`}
                                title="Hapus baris"
                                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[30px] sm:min-h-[30px] text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="font-semibold text-slate-900">{it.name}</div>
                              <div className="text-[11px] text-slate-600">{it.category}</div>
                            </>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            list="rcv-supplier-options"
                            value={supplier}
                            onChange={e => setSupplierByPoiId(prev => ({ ...prev, [it.poiId]: e.target.value }))}
                            placeholder="Pilih atau ketik"
                            data-grid-col={1}
                            aria-label={`Supplier ${label}`}
                            aria-invalid={supplierMissing || undefined}
                            className={`${TABLE_INPUT} ${supplierMissing ? 'border-amber-400' : ''}`}
                          />
                          {supplierChanged && <div className="mt-1 text-[11px] text-amber-800">Rencana: {plannedSupplier}</div>}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap pt-3">
                          {extra ? <span className="text-slate-500">-</span> : `${it.targetQty.toLocaleString('id-ID')} ${it.unit}`}
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={qtyDrafts[it.poiId] ?? (it.actualQty ? String(it.actualQty) : '')}
                              onChange={e => handleQtyChange(idx, e.target.value)}
                              onBlur={() => handleQtyBlur(idx)}
                              placeholder="0"
                              data-grid-col={2}
                              aria-label={`Jumlah diterima ${label}`}
                              className={`${TABLE_INPUT} w-20 text-right font-mono`}
                            />
                            {extra ? (
                              <input
                                type="text"
                                list="rcv-unit-options"
                                value={it.unit}
                                onChange={e => updateItem(idx, () => ({ unit: e.target.value }))}
                                data-grid-col={3}
                                aria-label={`Satuan ${label}`}
                                className={`${TABLE_INPUT} w-16`}
                              />
                            ) : (
                              <span className="text-slate-600 whitespace-nowrap">{it.unit}</span>
                            )}
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
                          {it.actualQty <= 0 || extra ? (
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
                          <div className="flex items-center gap-1">
                            <div className="relative flex-1 min-w-[104px]">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">Rp</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={packByPoiId[it.poiId]?.price ?? ''}
                                onChange={e => handlePackChange(idx, { price: e.target.value })}
                                placeholder="per dus"
                                data-grid-col={4}
                                aria-label={`Harga per kemasan ${label}`}
                                className={`${TABLE_INPUT} pl-7 text-right font-mono`}
                              />
                            </div>
                            <span className="text-slate-500">isi</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={packByPoiId[it.poiId]?.size ?? ''}
                              onChange={e => handlePackChange(idx, { size: e.target.value })}
                              placeholder="0"
                              data-grid-col={5}
                              aria-label={`Isi per kemasan ${label}, dalam ${it.unit}`}
                              className={`${TABLE_INPUT} w-12 text-right font-mono`}
                            />
                            <span className="text-slate-600 whitespace-nowrap">{it.unit}</span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {(() => {
                            const pack = packFor(it.poiId);
                            return (
                              <>
                                <div className="relative">
                                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 pointer-events-none">Rp</span>
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    value={priceDrafts[it.poiId] ?? formatRupiahInput(it.unitPrice)}
                                    onChange={e => {
                                      setPriceDrafts(prev => ({ ...prev, [it.poiId]: e.target.value }));
                                      handlePriceChange(idx, parseRupiah(e.target.value));
                                    }}
                                    onBlur={() =>
                                      setPriceDrafts(prev => {
                                        const next = { ...prev };
                                        delete next[it.poiId];
                                        return next;
                                      })
                                    }
                                    readOnly={pack.active}
                                    title={pack.active ? 'Dihitung dari harga kemasan. Kosongkan harga kemasan untuk mengisi manual.' : undefined}
                                    data-grid-col={6}
                                    aria-label={`Harga satuan ${label}`}
                                    aria-invalid={it.unitPrice <= 0 || undefined}
                                    className={`${TABLE_INPUT} pl-7 text-right font-mono ${pack.active ? 'bg-slate-50 text-slate-700' : ''} ${it.unitPrice <= 0 ? 'border-amber-400' : ''}`}
                                  />
                                </div>
                                {pack.active ? (
                                  <div className="mt-1 text-[11px] text-slate-600">otomatis</div>
                                ) : (
                                  it.unitPrice <= 0 && <div className="mt-1 text-[11px] text-amber-800">Harga belum diisi</div>
                                )}
                              </>
                            );
                          })()}
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
                            data-grid-col={7}
                            aria-label={`Kondisi ${label}`}
                            className={TABLE_INPUT}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id="rcv-supplier-options">
                {supplierOptions.map(name => <option key={name} value={name} />)}
              </datalist>
              <datalist id="rcv-item-options">
                {masterItems.map(m => <option key={m.id} value={m.name} />)}
              </datalist>
              <datalist id="rcv-unit-options">
                {UNIT_OPTIONS.map(u => <option key={u} value={u} />)}
              </datalist>
            </div>
            {calculations.weighedCount > 0 && calculations.diffCost !== 0 && calculations.totalTargetCost > 0 && (
              <p className={`text-[11px] ${calculations.diffCost > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
                Nilai diterima {calculations.diffCost > 0 ? 'lebih' : 'kurang'} {rupiah(Math.abs(calculations.diffCost))} dari nilai PO.
              </p>
            )}
          </section>

          <ExtraCostsEditor
            idPrefix="rcv"
            rows={extraCosts}
            onChange={setExtraCosts}
            supplierOptions={costSupplierOptions}
            defaultSupplier={costSupplierOptions.length === 1 ? costSupplierOptions[0] : undefined}
          />

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
