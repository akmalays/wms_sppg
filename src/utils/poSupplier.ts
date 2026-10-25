import { PurchaseOrderNota } from '../types/warehouse';
import { localDateIso } from './localDate';

// PO dari menu boleh dibuat sebelum suppliernya pasti. Bahan tanpa supplier dikumpulkan di satu PO
// "Supplier menyusul"; suppliernya dipilih per bahan saat barang datang, lalu PO dipecah per supplier.
export const PENDING_SUPPLIER_NAME = 'Supplier menyusul';

export const isPendingSupplierPo = (po: Pick<PurchaseOrderNota, 'supplierName'>) =>
  po.supplierName.trim().toLowerCase() === PENDING_SUPPLIER_NAME.toLowerCase();

/** Bahan dipesan dan datang sehari sebelum menu dimasak (H-1). */
export function poDateForMenu(menuDate: string): string {
  const [y, m, d] = (menuDate || '').split('-').map(Number);
  if (!y || !m || !d) return localDateIso();
  return localDateIso(new Date(y, m - 1, d - 1));
}

const MENU_PO_NOTE_PREFIX = 'PO dibuat otomatis dari Perencanaan Menu:';

/**
 * Pesanan ke supplier hanya terbit dari Perencanaan Menu. Nota lain dibuat dari penerimaan atau belanja
 * yang sudah terjadi, jadi bukan barang yang ditunggu. PO lama yang tautan menunya hilang dikenali dari catatannya.
 */
export const isMenuPurchaseOrder = (po: Pick<PurchaseOrderNota, 'relatedMenuOrderId' | 'notes'>) =>
  Boolean(po.relatedMenuOrderId) || (po.notes || '').startsWith(MENU_PO_NOTE_PREFIX);

export const isAwaitingDelivery = (po: PurchaseOrderNota) =>
  isMenuPurchaseOrder(po) && po.status !== 'SELESAI' && !po.relatedReceivingId;
