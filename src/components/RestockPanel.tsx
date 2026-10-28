import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, FileText, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { warehouseDb, APP_SETTINGS_CHANGED_EVENT } from '../db/storage';
import { ItemMaster, PurchaseOrderItem, PurchaseOrderNota } from '../types/warehouse';
import { localDateIso } from '../utils/localDate';
import { generateNextPoNumber } from '../utils/poNumberGenerator';
import { angkaTerbilang } from '../utils/numberToWords';
import { isAwaitingDelivery, isRestockPurchaseOrder, PENDING_SUPPLIER_NAME, RESTOCK_PO_NOTE_PREFIX } from '../utils/poSupplier';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, DialogShell, FIELD_INPUT, FIELD_LABEL, TABLE_INPUT } from './common/FormDialog';
import {
  getPurchaseRequests,
  nextPurchaseRequestNumber,
  PurchaseRequest,
  purchaseRequestTotal,
  PURCHASE_REQUEST_STATUS_LABEL,
  savePurchaseRequests,
  updatePurchaseRequest,
} from '../utils/purchaseRequests';
import { PurchaseRequestDoc } from './print/PurchaseRequestDoc';

// Stok diisi sampai dua kali batas minimum.
const RESTOCK_TARGET_MULTIPLIER = 2;

const norm = (s: string) => s.trim().toLowerCase();
const parseNum = (v: string) => parseFloat((v || '').replace(',', '.')) || 0;

/** Kg dan Liter boleh desimal (dibulatkan ke atas per 0,5); satuan hitung (Pcs, Pack, Roll) dibulatkan ke atas. */
const roundOrderQty = (qty: number, unit: string) =>
  /^(kg|liter|l)$/i.test(unit.trim()) ? Math.ceil(qty * 2) / 2 : Math.ceil(qty);

const tomorrowIso = () => {
  const d = new Date();
  return localDateIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
};

interface RowDraft {
  selected: boolean;
  qty: string;
  supplier: string;
  price: string;
}

const STATUS_TONE: Record<PurchaseRequest['status'], string> = {
  MENUNGGU: 'bg-amber-50 text-amber-900',
  DISETUJUI: 'bg-emerald-50 text-emerald-800',
  DITOLAK: 'bg-slate-100 text-slate-700',
  PO_TERBIT: 'bg-slate-100 text-slate-700',
};

const formatShortDate = (iso: string) => {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Barang non-menu (APD, plastik, sabun, gas, ATK) yang stoknya di bawah batas minimum, dengan jumlah saran,
 * supplier, dan harga dari pembelian terakhir. Alurnya: barang yang dicentang jadi Permintaan Pembelian yang
 * dicetak untuk bagian pembelian; setelah disetujui, PO restock diterbitkan per supplier lalu diterima lewat
 * antrean PO di Barang Masuk seperti PO bahan menu.
 */
export const RestockPanel: React.FC<{ items: ItemMaster[] }> = ({ items }) => {
  const { currentUser, can } = useAuth();
  const toast = useToast();
  const askConfirm = useConfirm();
  const [version, setVersion] = useState(0);
  const [requests, setRequests] = useState<PurchaseRequest[]>(getPurchaseRequests);
  const [previewRequest, setPreviewRequest] = useState<PurchaseRequest | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [deliveryDate, setDeliveryDate] = useState(tomorrowIso);
  const [minInputs, setMinInputs] = useState<Record<string, string>>({});
  const [showNoMinimum, setShowNoMinimum] = useState(false);

  useEffect(() => {
    const bump = () => setVersion(v => v + 1);
    const reloadRequests = () => setRequests(getPurchaseRequests());
    window.addEventListener('sppg_warehouse_sync', bump);
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, reloadRequests);
    return () => {
      window.removeEventListener('sppg_warehouse_sync', bump);
      window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, reloadRequests);
    };
  }, []);

  const nonFood = useMemo(() => items.filter(i => i.isActive !== false && i.itemType === 'OPERATIONAL_CONSUMABLE'), [items]);
  const needRestock = useMemo(
    () =>
      nonFood
        .filter(i => i.minimumStock > 0 && i.currentStock <= i.minimumStock)
        .sort((a, b) => a.currentStock / a.minimumStock - b.currentStock / b.minimumStock || a.name.localeCompare(b.name, 'id')),
    [nonFood]
  );
  const noMinimum = useMemo(
    () => nonFood.filter(i => !(i.minimumStock > 0)).sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [nonFood]
  );

  // Supplier dan harga dari pembelian terakhir, sebagai isian awal.
  const lastPurchase = useMemo(() => {
    const supplierById: Record<string, string> = {};
    [...warehouseDb.getReceivings()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(doc => doc.lines.forEach(l => (supplierById[l.itemId] = doc.supplierName)));
    const priceByName: Record<string, number> = {};
    [...warehouseDb.getNonFoodExpenses()]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .forEach(e => {
        if (e.unitPrice && e.unitPrice > 0) priceByName[norm(e.itemName)] = e.unitPrice;
      });
    return { supplierById, priceByName };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, items]);

  // Barang yang sudah ada di PO restock yang belum datang, agar tidak dipesan dua kali.
  const pendingOrder = useMemo(() => {
    const map: Record<string, PurchaseOrderNota> = {};
    warehouseDb
      .getPurchaseOrders()
      .filter(po => isRestockPurchaseOrder(po) && isAwaitingDelivery(po))
      .forEach(po => po.items.forEach(it => (map[it.itemId || norm(it.name)] = po)));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, items]);

  const orderOf = (item: ItemMaster) => pendingOrder[item.id] || pendingOrder[norm(item.name)];

  // Barang yang masih ada di permintaan yang belum jadi PO
  const openRequests = requests.filter(r => r.status === 'MENUNGGU' || r.status === 'DISETUJUI');
  const requestOf = (item: ItemMaster) => openRequests.find(r => r.items.some(it => it.itemId === item.id));

  const draftOf = (item: ItemMaster): RowDraft =>
    drafts[item.id] || {
      selected: !orderOf(item) && !requestOf(item),
      qty: String(roundOrderQty(Math.max(0, RESTOCK_TARGET_MULTIPLIER * item.minimumStock - Math.max(0, item.currentStock)), item.baseUnit)),
      supplier: lastPurchase.supplierById[item.id] || '',
      price: String(lastPurchase.priceByName[norm(item.name)] || item.estimatedPrice || ''),
    };

  const updateDraft = (item: ItemMaster, patch: Partial<RowDraft>) =>
    setDrafts(prev => ({ ...prev, [item.id]: { ...draftOf(item), ...patch } }));

  const selectedRows = needRestock.filter(i => draftOf(i).selected && parseNum(draftOf(i).qty) > 0);
  const grandTotal = selectedRows.reduce((sum, i) => sum + Math.round(parseNum(draftOf(i).qty) * parseNum(draftOf(i).price)), 0);
  const suppliers = useMemo(() => warehouseDb.getSuppliers().filter(s => s.isActive !== false), [version]);

  const handleCreateRequest = () => {
    if (!currentUser || selectedRows.length === 0) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)) {
      toast.warning('Isi tanggal barang dibutuhkan terlebih dahulu.', 'Tanggal Belum Diisi');
      return;
    }
    const today = localDateIso();
    const all = getPurchaseRequests();
    const request: PurchaseRequest = {
      id: `PR-${Date.now()}`,
      number: nextPurchaseRequestNumber(all, today),
      date: today,
      neededDate: deliveryDate,
      status: 'MENUNGGU',
      items: selectedRows.map(item => {
        const d = draftOf(item);
        return {
          itemId: item.id,
          name: item.name,
          category: item.category,
          unit: item.baseUnit,
          quantity: parseNum(d.qty),
          unitPrice: parseNum(d.price),
          supplier: d.supplier.trim(),
          stockAtRequest: item.currentStock,
          minimumStock: item.minimumStock,
        };
      }),
      requestedBy: currentUser.name,
      createdAt: new Date().toISOString(),
    };
    savePurchaseRequests([request, ...all], currentUser);
    setDrafts({});
    setPreviewRequest(request);
    toast.success(`Permintaan ${request.number} dibuat. Cetak dan serahkan ke bagian pembelian.`, 'Permintaan Pembelian');
  };

  const handleDecide = async (request: PurchaseRequest, status: 'DISETUJUI' | 'DITOLAK') => {
    if (!currentUser) return;
    if (status === 'DITOLAK') {
      const ok = await askConfirm({
        title: `Tolak ${request.number}?`,
        message: 'Barang di permintaan ini kembali muncul di daftar Perlu restock dan bisa diminta ulang.',
        confirmText: 'Tolak permintaan',
        variant: 'danger',
      });
      if (!ok) return;
    }
    updatePurchaseRequest(request.id, { status, decidedBy: currentUser.name, decidedAt: new Date().toISOString() }, currentUser);
    toast.success(
      status === 'DISETUJUI' ? `${request.number} disetujui. Terbitkan PO saat siap memesan.` : `${request.number} ditolak.`,
      'Permintaan Pembelian'
    );
  };

  // Satu PO per supplier; barang tanpa supplier masuk PO "Supplier menyusul" yang dipilih saat barang datang.
  const handleIssuePos = (request: PurchaseRequest) => {
    if (!currentUser) return;
    const poDate = request.neededDate >= localDateIso() ? request.neededDate : localDateIso();
    const groups = new Map<string, PurchaseRequest['items']>();
    request.items.forEach(it => {
      const key = norm(it.supplier) || norm(PENDING_SUPPLIER_NAME);
      groups.set(key, [...(groups.get(key) || []), it]);
    });

    const created: PurchaseOrderNota[] = [];
    try {
      groups.forEach(groupItems => {
        const typed = groupItems[0].supplier.trim();
        let supplier = typed ? suppliers.find(s => norm(s.name) === norm(typed)) : undefined;
        if (!supplier && typed) supplier = warehouseDb.quickAddSupplier(typed, currentUser);

        const poItems: PurchaseOrderItem[] = groupItems.map((it, idx) => ({
          id: `POI-${Date.now()}-${created.length}-${idx}`,
          itemId: it.itemId,
          name: it.name,
          category: it.category,
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          subtotal: Math.round(it.quantity * it.unitPrice),
        }));
        const total = poItems.reduce((sum, it) => sum + (it.subtotal || 0), 0);

        const nota: PurchaseOrderNota = {
          id: `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          poNumber: generateNextPoNumber(warehouseDb.getPurchaseOrders(), poDate),
          date: poDate,
          deliveryDate: poDate,
          supplierId: supplier?.id,
          supplierName: supplier?.name || PENDING_SUPPLIER_NAME,
          supplierContact: supplier?.phone ? `${supplier.phone} (${supplier.contactPerson || 'PIC'})` : '',
          supplierAddress: supplier?.address || '',
          paymentMethod: 'TRANSFER',
          bankInfo: supplier ? `Transfer Bank Rekening Resmi ${supplier.name}` : '',
          status: 'DISETUJUI',
          items: poItems,
          subtotal: total,
          discount: 0,
          tax: 0,
          grandTotal: total,
          terbilang: angkaTerbilang(total),
          notes: `${RESTOCK_PO_NOTE_PREFIX}: dari permintaan pembelian ${request.number}.`,
          deliveryTerms: 'Pengiriman langsung ke gudang Satuan Pelayanan Pemenuhan Gizi (SPPG) MLG TUMPANG JERU.',
          createdBy: currentUser.name,
          createdByRole: currentUser.role === 'ADMIN' ? 'Admin Logistik' : currentUser.role,
          approvedBy: warehouseDb.getSppgHeadName(),
          approvedByRole: 'Kepala SPPG',
          supplierPic: supplier?.contactPerson || 'Pihak Rekanan',
          createdAt: new Date().toISOString(),
        };
        created.push(warehouseDb.savePurchaseOrder(nota, currentUser));
      });
    } catch (err: any) {
      toast.error(err?.message || 'PO restock gagal dibuat.', 'Gagal Membuat PO');
      return;
    }

    updatePurchaseRequest(
      request.id,
      { status: 'PO_TERBIT', poIds: created.map(po => po.id), poNumbers: created.map(po => po.poNumber.replace(/^NO\.\s*/i, '')) },
      currentUser
    );
    setVersion(v => v + 1);
    toast.success(
      `${created.length} PO restock terbit dari ${request.number}. Terima di Barang Masuk saat barang datang.`,
      'PO Restock Terbit'
    );
  };

  const handleSaveMinimum = (item: ItemMaster) => {
    if (!currentUser) return;
    const min = parseNum(minInputs[item.id] || '');
    if (min <= 0) {
      toast.warning('Isi batas minimum lebih dari 0.', 'Batas Minimum');
      return;
    }
    try {
      warehouseDb.saveItem({ ...item, minimumStock: min, reorderPoint: Math.max(item.reorderPoint || 0, min) }, currentUser, false);
      setMinInputs(prev => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      toast.success(`Batas minimum ${item.name} disimpan: ${min.toLocaleString('id-ID')} ${item.baseUnit}.`, 'Batas Minimum');
    } catch (err: any) {
      toast.error(err?.message || 'Batas minimum gagal disimpan.', 'Batas Minimum');
    }
  };

  const canOrder = can('RECEIVE_GOODS');

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Perlu restock</h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
              Barang non-food (APD, plastik, sabun, gas, ATK) yang stoknya sudah di batas minimum atau kurang. Jumlah saran
              mengisi stok sampai {RESTOCK_TARGET_MULTIPLIER}× minimum; supplier dan harga dari pembelian terakhir. Barang yang
              dicentang jadi Permintaan Pembelian untuk bagian pembelian; PO terbit setelah disetujui.
            </p>
          </div>
          {canOrder && needRestock.length > 0 && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="restock-date" className={FIELD_LABEL}>Dibutuhkan tanggal</label>
                <input
                  id="restock-date"
                  type="date"
                  value={deliveryDate}
                  min={localDateIso()}
                  onChange={e => setDeliveryDate(e.target.value)}
                  className={`${FIELD_INPUT} w-auto`}
                />
              </div>
              <button type="button" onClick={handleCreateRequest} disabled={selectedRows.length === 0} className={BTN_PRIMARY}>
                <FileText className="w-4 h-4" />
                {selectedRows.length === 0
                  ? 'Pilih barang'
                  : `Buat permintaan · ${selectedRows.length} barang · Rp ${grandTotal.toLocaleString('id-ID')}`}
              </button>
            </div>
          )}
        </div>

        {needRestock.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <p className="text-xs font-semibold text-slate-800">Semua stok non-food di atas batas minimum.</p>
            {noMinimum.length > 0 && (
              <p className="text-[11px] text-slate-600 mt-1">
                {noMinimum.length} barang belum punya batas minimum, jadi belum bisa dipantau. Isi di bawah.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10">
                    <span className="sr-only">Pesan</span>
                  </th>
                  <th className="py-2.5 px-3">Barang</th>
                  <th className="py-2.5 px-3 w-32 text-right">Stok / minimum</th>
                  <th className="py-2.5 px-3 w-36">Jumlah pesan</th>
                  <th className="py-2.5 px-3 w-48">Supplier</th>
                  <th className="py-2.5 px-3 w-32">Harga satuan</th>
                  <th className="py-2.5 px-3 w-32 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {needRestock.map(item => {
                  const d = draftOf(item);
                  const ordered = orderOf(item);
                  const subtotal = Math.round(parseNum(d.qty) * parseNum(d.price));
                  return (
                    <tr key={item.id} className={`align-top ${d.selected ? '' : 'bg-slate-50/60'}`}>
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={d.selected}
                          disabled={!canOrder}
                          onChange={e => updateDraft(item, { selected: e.target.checked })}
                          aria-label={`Pesan ${item.name}`}
                          className="w-5 h-5 accent-emerald-700 rounded cursor-pointer"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-[11px] text-slate-600">{item.category}</div>
                        {ordered ? (
                          <div className="text-[11px] text-amber-800 mt-0.5">
                            Sudah dipesan di {ordered.poNumber.replace(/^NO\.\s*/i, '')} ({ordered.supplierName})
                          </div>
                        ) : (
                          requestOf(item) && (
                            <div className="text-[11px] text-amber-800 mt-0.5">Sudah diminta di {requestOf(item)!.number}</div>
                          )
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <span className={`font-mono font-semibold ${item.currentStock <= 0 ? 'text-rose-700' : 'text-amber-800'}`}>
                          {item.currentStock.toLocaleString('id-ID')}
                        </span>
                        <span className="text-slate-600"> / {item.minimumStock.toLocaleString('id-ID')} {item.baseUnit}</span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={d.qty}
                            disabled={!canOrder}
                            onChange={e => updateDraft(item, { qty: e.target.value })}
                            aria-label={`Jumlah pesan ${item.name}`}
                            className={`${TABLE_INPUT} text-right tabular-nums`}
                          />
                          <span className="text-slate-600 shrink-0">{item.baseUnit}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          list="restock-supplier-options"
                          value={d.supplier}
                          disabled={!canOrder}
                          onChange={e => updateDraft(item, { supplier: e.target.value })}
                          placeholder={PENDING_SUPPLIER_NAME}
                          aria-label={`Supplier ${item.name}`}
                          className={TABLE_INPUT}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={d.price}
                          disabled={!canOrder}
                          onChange={e => updateDraft(item, { price: e.target.value })}
                          placeholder="0"
                          aria-label={`Harga satuan ${item.name}`}
                          className={`${TABLE_INPUT} text-right tabular-nums`}
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-900 whitespace-nowrap">
                        {subtotal > 0 ? `Rp ${subtotal.toLocaleString('id-ID')}` : <span className="text-slate-500 font-sans">-</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <datalist id="restock-supplier-options">
          {suppliers.map(s => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      </div>

      {/* Permintaan aktif selalu tampil; yang selesai (PO terbit / ditolak) bisa dibuka */}
      {requests.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Permintaan pembelian</h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Cetak dan serahkan ke bagian pembelian. Setelah ditandatangani, tandai disetujui lalu terbitkan PO.
              </p>
            </div>
            {requests.length > openRequests.length && (
              <button
                type="button"
                onClick={() => setShowDone(o => !o)}
                aria-pressed={showDone}
                className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer rounded min-h-[44px] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                {showDone ? 'Sembunyikan yang selesai' : `Tampilkan yang selesai (${requests.length - openRequests.length})`}
              </button>
            )}
          </div>
          {(showDone ? requests : openRequests).length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-slate-600">Tidak ada permintaan yang menunggu.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {(showDone ? requests : openRequests).map(r => {
                const total = purchaseRequestTotal(r);
                return (
                  <li key={r.id} className="px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-900">{r.number}</span>
                        <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${STATUS_TONE[r.status]}`}>
                          {PURCHASE_REQUEST_STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 truncate" title={r.items.map(it => it.name).join(', ')}>
                        {r.items.length} barang: {r.items.slice(0, 3).map(it => it.name).join(', ')}
                        {r.items.length > 3 && `, +${r.items.length - 3} lagi`}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        Diminta {formatShortDate(r.date)} oleh {r.requestedBy} · dibutuhkan {formatShortDate(r.neededDate)}
                        {total > 0 && <> · perkiraan Rp {total.toLocaleString('id-ID')}</>}
                        {r.poNumbers?.length ? <> · PO {r.poNumbers.join(', ')}</> : null}
                        {r.status === 'DITOLAK' && r.decidedBy && <> · ditolak oleh {r.decidedBy}</>}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button type="button" onClick={() => setPreviewRequest(r)} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
                        <Printer className="w-3.5 h-3.5" />
                        Cetak
                      </button>
                      {canOrder && r.status === 'MENUNGGU' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDecide(r, 'DITOLAK')}
                            className="inline-flex items-center px-3 min-h-[44px] sm:min-h-[32px] rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            Tolak
                          </button>
                          <button type="button" onClick={() => handleDecide(r, 'DISETUJUI')} className={BTN_SECONDARY}>
                            Tandai disetujui
                          </button>
                        </>
                      )}
                      {canOrder && r.status === 'DISETUJUI' && (
                        <button type="button" onClick={() => handleIssuePos(r)} className={BTN_PRIMARY}>
                          Terbitkan PO
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {noMinimum.length > 0 && can('MANAGE_ITEMS') && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowNoMinimum(o => !o)}
            aria-expanded={showNoMinimum}
            className="w-full flex items-center justify-between gap-2 px-4 text-left min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <span className="text-xs">
              <span className="font-semibold text-slate-900">{noMinimum.length} barang non-food belum punya batas minimum</span>
              <span className="text-slate-600"> · isi agar ikut dipantau restock</span>
            </span>
            <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${showNoMinimum ? 'rotate-90' : ''}`} />
          </button>
          {showNoMinimum && (
            <ul className="divide-y divide-slate-100 border-t border-slate-200">
              {noMinimum.map(item => (
                <li key={item.id} className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-slate-900">{item.name}</span>
                    <span className="text-slate-600">
                      {' '}· stok {item.currentStock.toLocaleString('id-ID')} {item.baseUnit}
                    </span>
                  </div>
                  <form
                    className="flex items-center gap-1.5"
                    onSubmit={e => {
                      e.preventDefault();
                      handleSaveMinimum(item);
                    }}
                  >
                    <input
                      type="text"
                      inputMode="decimal"
                      value={minInputs[item.id] || ''}
                      onChange={e => setMinInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                      placeholder="Minimum"
                      aria-label={`Batas minimum ${item.name}`}
                      className={`${TABLE_INPUT} w-24 text-right tabular-nums`}
                    />
                    <span className="text-slate-600 w-10">{item.baseUnit}</span>
                    <button
                      type="submit"
                      className="px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 min-h-[44px] sm:min-h-[32px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      Simpan
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {previewRequest && (
        <>
          <style>{`@media print {
            @page { size: A4 portrait; margin: 10mm; }
            body * { visibility: hidden; }
            #print-purchase-request, #print-purchase-request * { visibility: visible; }
            #print-purchase-request { position: absolute; left: 0; top: 0; width: 100%; }
          }`}</style>
          <DialogShell
            title={`Permintaan Pembelian ${previewRequest.number}`}
            description="Cetak lalu serahkan ke bagian pembelian untuk diperiksa dan disetujui."
            onClose={() => setPreviewRequest(null)}
            footer={
              <>
                <button type="button" onClick={() => setPreviewRequest(null)} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
                  Tutup
                </button>
                <button type="button" onClick={() => window.print()} className={BTN_PRIMARY}>
                  <Printer className="w-4 h-4" />
                  Cetak
                </button>
              </>
            }
          >
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <PurchaseRequestDoc request={previewRequest} />
              </div>
            </div>
          </DialogShell>
          {/* Salinan cetak langsung di <body>: halaman Stok menyembunyikan isinya (.no-print) saat dicetak,
              dan dialog bisa memotong isi yang panjang */}
          {createPortal(
            <div id="print-purchase-request" className="hidden print:block">
              <PurchaseRequestDoc request={previewRequest} />
            </div>,
            document.body
          )}
        </>
      )}
    </div>
  );
};
