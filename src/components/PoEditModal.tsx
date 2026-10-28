import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PurchaseOrderItem, PurchaseOrderNota } from '../types/warehouse';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { warehouseDb } from '../db/storage';
import { DialogShell, FIELD_INPUT, FIELD_LABEL, TABLE_INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST } from './common/FormDialog';
import { isPendingSupplierPo, PENDING_SUPPLIER_NAME } from '../utils/poSupplier';
import { normalizeQtyForUnit } from '../utils/unitConversion';

// Revisi PO sebelum barang datang: jumlah, satuan, harga, bahan, dan supplier per bahan.
// Nomor PO tetap; bahan yang pindah supplier dipindah ke PO supplier itu (atau PO baru) oleh revisePurchaseOrder.

interface PoEditModalProps {
  po: PurchaseOrderNota;
  onClose: () => void;
  onSaved: (pos: PurchaseOrderNota[]) => void;
}

interface Row {
  id: string;
  itemId?: string;
  category?: string;
  notes?: string;
  name: string;
  supplier: string;
  qty: string;
  unit: string;
  price: string;
}

const UNIT_OPTIONS = ['Kg', 'Gram', 'Liter', 'Pcs', 'Pack', 'Dus', 'Ikat', 'Butir', 'Roll', 'Botol', 'Jerigen', 'Pouch', 'Rim'];
const parseNum = (s: string) => parseFloat(s.replace(',', '.')) || 0;
const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const norm = (s: string) => s.trim().toLowerCase();

export const PoEditModal: React.FC<PoEditModalProps> = ({ po, onClose, onSaved }) => {
  const { currentUser } = useAuth();
  const toast = useToast();
  const plannedSupplier = isPendingSupplierPo(po) ? '' : po.supplierName;

  const [rows, setRows] = useState<Row[]>(() =>
    po.items.map(it => ({
      id: it.id,
      itemId: it.itemId,
      category: it.category,
      notes: it.notes,
      name: it.name,
      supplier: plannedSupplier,
      qty: String(it.quantity),
      unit: it.unit,
      price: it.unitPrice ? String(it.unitPrice) : '',
    }))
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const supplierOptions = useMemo(() => warehouseDb.getSuppliers().filter(s => s.isActive !== false).map(s => s.name), []);
  const masterItems = useMemo(() => warehouseDb.getItems().filter(i => i.isActive), []);
  const originalById = useMemo(() => new Map(po.items.map(it => [it.id, it])), [po]);
  // null bila supplier tiap bahan berbeda, agar isian "semua bahan" tidak menampilkan nilai yang menyesatkan.
  const sharedSupplier = rows.length > 0 && rows.every(r => r.supplier === rows[0].supplier) ? rows[0].supplier : rows.length ? null : '';
  const total = rows.reduce((sum, r) => sum + parseNum(r.qty) * parseNum(r.price), 0);

  const updateRow = (id: string, patch: Partial<Row>) => setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const handleNameChange = (id: string, name: string) => {
    const master = masterItems.find(m => norm(m.name) === norm(name));
    updateRow(id, master ? { name, itemId: master.id, category: master.category, unit: master.baseUnit || 'Kg' } : { name, itemId: undefined });
  };

  const handleAddRow = () =>
    setRows(prev => [...prev, { id: `POI-REV-${Date.now()}`, name: '', supplier: plannedSupplier, qty: '', unit: 'Kg', price: '' }]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || isSubmitting) return;
    setError('');

    if (rows.length === 0) return setError('PO minimal berisi satu bahan. Untuk membatalkan PO, tutup dialog ini lalu pakai Hapus.');
    const incomplete = rows.filter(r => !r.name.trim() || !r.unit.trim() || parseNum(r.qty) <= 0);
    if (incomplete.length > 0) return setError('Lengkapi nama bahan, jumlah (lebih dari 0), dan satuan di setiap baris.');
    const seen = new Set<string>();
    const dup = rows.find(r => {
      const key = `${norm(r.name)}|${norm(r.supplier || PENDING_SUPPLIER_NAME)}`;
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    if (dup) return setError(`${dup.name} tercatat lebih dari sekali untuk supplier yang sama. Gabungkan jumlahnya di satu baris.`);
    if (!reason.trim()) return setError('Tulis alasan revisi, mis. "porsi berubah" atau "supplier ganti".');

    const payload = rows.map(r => {
      const original = originalById.get(r.id);
      const unit = r.unit.trim();
      const item: PurchaseOrderItem = {
        ...original,
        id: r.id,
        itemId: r.itemId,
        name: r.name.trim(),
        category: r.category || original?.category || 'Bahan Makanan',
        quantity: normalizeQtyForUnit(parseNum(r.qty), unit),
        unit,
        unitPrice: parseNum(r.price),
        subtotal: 0,
        notes: r.notes,
      };
      return { item, supplierName: r.supplier };
    });

    setIsSubmitting(true);
    const res = warehouseDb.revisePurchaseOrder(po.id, payload, reason, currentUser);
    setIsSubmitting(false);
    if (!res.success) return setError(res.message);
    if (!res.changed) {
      toast.info('Isi PO tidak berubah.', 'Tidak Ada Perubahan');
      onClose();
      return;
    }
    const numbers = (res.pos || []).map(p => `${p.poNumber} (${p.supplierName})`).join(', ');
    toast.success(`PO diperbarui: ${numbers}. Bila sudah dicetak atau dikirim ke supplier, cetak ulang dan kabari supplier.`, 'PO Direvisi');
    onSaved(res.pos || []);
  };

  return (
    <DialogShell
      size="2xl"
      title="Ubah PO"
      badges={
        <span className="px-1.5 py-0.5 rounded-md border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-700">{po.poNumber}</span>
      }
      description={`${po.supplierName} · kirim ${po.deliveryDate || po.date}. Nomor PO tetap; perubahan dicatat sebagai revisi.`}
      onClose={() => !isSubmitting && onClose()}
      onSubmit={handleSubmit}
      footer={
        <>
          <div className="mr-auto text-xs text-slate-700">
            Nilai PO <span className="font-mono font-semibold text-slate-900 tabular-nums">{rupiah(total)}</span>
            {po.grandTotal > 0 && Math.round(total) !== Math.round(po.grandTotal) && (
              <span className="text-slate-600"> (sebelumnya {rupiah(po.grandTotal)})</span>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
            Batal
          </button>
          <button type="submit" disabled={isSubmitting} className={BTN_PRIMARY}>
            {isSubmitting ? 'Menyimpan…' : 'Simpan revisi'}
          </button>
        </>
      }
    >
      <div
        className="space-y-4"
        onKeyDown={e => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') e.preventDefault();
        }}
      >
        {error && (
          <p role="alert" className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
            {error}
          </p>
        )}

        <section className="space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div className="space-y-1">
              <label htmlFor="po-edit-all-supplier" className={FIELD_LABEL}>
                Supplier semua bahan
              </label>
              <input
                id="po-edit-all-supplier"
                type="text"
                list="po-edit-supplier-options"
                value={sharedSupplier ?? ''}
                placeholder={sharedSupplier === null ? 'Berbeda per bahan' : PENDING_SUPPLIER_NAME}
                onChange={e => {
                  const supplier = e.target.value;
                  setRows(prev => prev.map(r => ({ ...r, supplier })));
                }}
                className={`${TABLE_INPUT} w-full sm:w-60`}
              />
            </div>
            <button type="button" onClick={handleAddRow} className={`${BTN_SECONDARY} self-start sm:self-auto`}>
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              Tambah bahan
            </button>
          </div>
          <p className="text-[11px] text-slate-600">
            Isi di atas untuk memindah seluruh PO, atau ganti supplier per bahan di tabel; bahan itu dipindah ke PO supplier tersebut.
            Kosongkan supplier untuk “{PENDING_SUPPLIER_NAME}”.
          </p>

          <div className="border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 font-semibold min-w-[180px]">Bahan</th>
                  <th className="py-2 px-3 font-semibold min-w-[170px]">Supplier</th>
                  <th className="py-2 px-3 font-semibold w-28">Jumlah</th>
                  <th className="py-2 px-3 font-semibold w-24">Satuan</th>
                  <th className="py-2 px-3 font-semibold w-32">Harga satuan</th>
                  <th className="py-2 px-3 font-semibold text-right w-28">Subtotal</th>
                  <th className="py-2 px-3 w-12">
                    <span className="sr-only">Hapus</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(r => {
                  const original = originalById.get(r.id);
                  const label = r.name.trim() || 'bahan baru';
                  const qtyChanged = !!original && (parseNum(r.qty) !== original.quantity || norm(r.unit) !== norm(original.unit));
                  const supplierChanged = norm(r.supplier || PENDING_SUPPLIER_NAME) !== norm(po.supplierName);
                  return (
                    <tr key={r.id} className={`align-top ${original ? '' : 'bg-sky-50/40'}`}>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          list="po-edit-item-options"
                          value={r.name}
                          onChange={e => handleNameChange(r.id, e.target.value)}
                          placeholder="Nama bahan"
                          aria-label="Nama bahan"
                          aria-invalid={!r.name.trim() || undefined}
                          className={TABLE_INPUT}
                        />
                        {!original && <div className="mt-1 text-[11px] font-medium text-sky-800">Bahan baru</div>}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          list="po-edit-supplier-options"
                          value={r.supplier}
                          onChange={e => updateRow(r.id, { supplier: e.target.value })}
                          placeholder={PENDING_SUPPLIER_NAME}
                          aria-label={`Supplier ${label}`}
                          className={TABLE_INPUT}
                        />
                        {supplierChanged && <div className="mt-1 text-[11px] text-amber-800">Pindah dari {po.supplierName}</div>}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={r.qty}
                          onChange={e => updateRow(r.id, { qty: e.target.value })}
                          aria-label={`Jumlah ${label}`}
                          aria-invalid={parseNum(r.qty) <= 0 || undefined}
                          className={`${TABLE_INPUT} text-right tabular-nums`}
                        />
                        {qtyChanged && (
                          <div className="mt-1 text-[11px] text-slate-600 text-right">
                            sebelumnya {original!.quantity.toLocaleString('id-ID')} {original!.unit}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          list="po-edit-unit-options"
                          value={r.unit}
                          onChange={e => updateRow(r.id, { unit: e.target.value })}
                          aria-label={`Satuan ${label}`}
                          aria-invalid={!r.unit.trim() || undefined}
                          className={TABLE_INPUT}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={r.price}
                          onChange={e => updateRow(r.id, { price: e.target.value })}
                          placeholder="0"
                          aria-label={`Harga satuan ${label}`}
                          className={`${TABLE_INPUT} text-right tabular-nums`}
                        />
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-900 pt-3.5">
                        {parseNum(r.price) > 0 ? rupiah(parseNum(r.qty) * parseNum(r.price)) : '-'}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          type="button"
                          onClick={() => setRows(prev => prev.filter(x => x.id !== r.id))}
                          aria-label={`Hapus ${label}`}
                          title="Hapus bahan dari PO"
                          className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[30px] sm:min-h-[30px] text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-600">
                      Semua bahan dihapus. Tambah bahan, atau batalkan dialog ini dan hapus PO bila tidak jadi memesan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <datalist id="po-edit-supplier-options">
              {supplierOptions.map(name => <option key={name} value={name} />)}
            </datalist>
            <datalist id="po-edit-item-options">
              {masterItems.map(m => <option key={m.id} value={m.name} />)}
            </datalist>
            <datalist id="po-edit-unit-options">
              {UNIT_OPTIONS.map(u => <option key={u} value={u} />)}
            </datalist>
          </div>
        </section>

        <div>
          <label htmlFor="po-edit-reason" className={FIELD_LABEL}>
            Alasan revisi
          </label>
          <input
            id="po-edit-reason"
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Mis. porsi bertambah, supplier tidak sanggup kirim"
            className={FIELD_INPUT}
          />
          <p className="mt-1 text-[11px] text-slate-600">Dicatat di catatan PO beserta tanggal, nama Anda, dan rincian perubahannya.</p>
        </div>
      </div>
    </DialogShell>
  );
};
