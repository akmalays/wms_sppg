import { PurchaseOrderNota } from '../types/warehouse';
import { warehouseDb } from '../db/storage';

// Jam pengiriman di nota mengikuti jam barang diterima: dari dokumen penerimaan, lalu catatan belanja
// dengan supplier dan tanggal yang sama. Nota yang belum diterima memakai jam di syarat pengiriman.
export const DEFAULT_DELIVERY_TIME_NOTE = '(Jam 12.00-15.00)';

export function deriveReceivedTimeNote(nota: PurchaseOrderNota): string {
  const day = (nota.deliveryDate || nota.date || '').slice(0, 10);
  const supplier = (nota.supplierName || '').trim().toLowerCase();

  const receivings = warehouseDb.getReceivings();
  const receiving =
    receivings.find(r => r.id === nota.relatedReceivingId) ||
    (supplier && day ? receivings.find(r => r.date?.slice(0, 10) === day && r.supplierName?.trim().toLowerCase() === supplier) : undefined);
  if (receiving?.arrivalTime) return `(Jam ${receiving.arrivalTime.slice(0, 5).replace(':', '.')})`;

  const expenses = warehouseDb.getNonFoodExpenses();
  const expense =
    expenses.find(e => e.time && nota.relatedExpenseIds?.includes(e.id)) ||
    (supplier && day
      ? expenses.find(
          e =>
            e.time &&
            e.date?.slice(0, 10) === day &&
            ((e.recipient || '').trim().toLowerCase() === supplier || (e.notes || '').toLowerCase().includes(`toko/supplier: ${supplier}`))
        )
      : undefined);
  if (expense?.time) return `(Jam ${expense.time.slice(0, 5).replace(':', '.')})`;

  const fromTerms = nota.deliveryTerms?.match(/\(Jam [^)]+\)/);
  return fromTerms ? fromTerms[0] : DEFAULT_DELIVERY_TIME_NOTE;
}

// Jam yang diketik manual di nota menang atas jam penerimaan
export function deliveryTimeNoteFor(nota: PurchaseOrderNota): string {
  return nota.deliveryTime?.trim() || deriveReceivedTimeNote(nota);
}
