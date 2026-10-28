import { warehouseDb } from '../db/storage';
import { User } from '../types/warehouse';
import { getRomanMonth } from './poNumberGenerator';

/**
 * Permintaan pembelian: dokumen dari gudang ke bagian pembelian untuk barang non-menu yang perlu restock.
 * PO baru diterbitkan setelah permintaan disetujui. Disimpan di app_settings (tersinkron ke cloud) agar
 * tidak perlu tabel baru.
 */
export const SETTING_PURCHASE_REQUESTS = 'purchase_requests';

export type PurchaseRequestStatus = 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK' | 'PO_TERBIT';

export const PURCHASE_REQUEST_STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  MENUNGGU: 'Menunggu persetujuan',
  DISETUJUI: 'Disetujui, PO belum terbit',
  DITOLAK: 'Ditolak',
  PO_TERBIT: 'PO terbit',
};

export interface PurchaseRequestItem {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  supplier: string;
  stockAtRequest: number;
  minimumStock: number;
}

export interface PurchaseRequest {
  id: string;
  number: string;
  date: string;
  /** Tanggal barang dibutuhkan datang; jadi tanggal PO saat diterbitkan. */
  neededDate: string;
  status: PurchaseRequestStatus;
  items: PurchaseRequestItem[];
  requestedBy: string;
  notes?: string;
  decidedBy?: string;
  decidedAt?: string;
  poIds?: string[];
  poNumbers?: string[];
  createdAt: string;
}

export const getPurchaseRequests = (): PurchaseRequest[] =>
  warehouseDb.getAppSetting<PurchaseRequest[]>(SETTING_PURCHASE_REQUESTS, []);

export const savePurchaseRequests = (list: PurchaseRequest[], user?: User) =>
  warehouseDb.saveAppSetting(SETTING_PURCHASE_REQUESTS, list, user);

export const updatePurchaseRequest = (id: string, patch: Partial<PurchaseRequest>, user?: User) =>
  savePurchaseRequests(
    getPurchaseRequests().map(r => (r.id === id ? { ...r, ...patch } : r)),
    user
  );

/** Nomor urut per tahun: PP/SPPG/{urut}/{bulan romawi}/{tahun}, mis. PP/SPPG/003/X/2026. */
export function nextPurchaseRequestNumber(existing: PurchaseRequest[], date: string): string {
  const [year, month] = date.split('-').map(Number);
  const seq =
    existing.reduce((max, r) => {
      const m = r.number.match(/^PP\/SPPG\/(\d+)\/[IVXLC]+\/(\d{4})$/);
      return m && Number(m[2]) === year ? Math.max(max, Number(m[1])) : max;
    }, 0) + 1;
  return `PP/SPPG/${String(seq).padStart(3, '0')}/${getRomanMonth(month)}/${year}`;
}

export const purchaseRequestTotal = (r: Pick<PurchaseRequest, 'items'>) =>
  r.items.reduce((sum, it) => sum + Math.round(it.quantity * it.unitPrice), 0);
