import type { PurchaseOrderItem } from '../types/warehouse';

/**
 * Biaya tambahan dari supplier (selep, kresek, ongkos kirim) yang ikut ditagih di nota.
 * Bukan barang: tidak masuk stok, tetapi tercatat di laporan pengeluaran dan menambah total nota.
 */
export interface ExtraCost {
  id: string;
  label: string;
  amount: number;
  /** Supplier yang menagih. Dipakai saat satu penerimaan PO dipecah ke beberapa supplier. */
  supplierName?: string;
}

export const EXTRA_COST_CATEGORY = 'Operasional & Keperluan Lain';
export const EXTRA_COST_UNIT = 'Paket';
export const EXTRA_COST_NOTE = 'Biaya tambahan';
export const EXTRA_COST_ID_PREFIX = 'POI-BIAYA-';
export const EXTRA_COST_SUGGESTIONS = ['Selep', 'Kresek', 'Ongkos kirim', 'Bongkar muat', 'Es batu'];

export const newExtraCost = (supplierName?: string): ExtraCost => ({
  id: `${EXTRA_COST_ID_PREFIX}${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  label: '',
  amount: 0,
  supplierName,
});

/** Baris yang benar-benar diisi (nominal lebih dari 0). Keterangan kosong diberi nama umum. */
export const filledExtraCosts = (rows: ExtraCost[]): ExtraCost[] =>
  rows.filter(r => r.amount > 0).map(r => ({ ...r, label: r.label.trim() || EXTRA_COST_NOTE }));

export const sumExtraCosts = (rows: ExtraCost[]): number => rows.reduce((sum, r) => sum + (r.amount > 0 ? r.amount : 0), 0);

/** Baris nota untuk satu biaya tambahan: 1 paket seharga nominalnya. */
export const extraCostToPoItem = (cost: ExtraCost): PurchaseOrderItem => ({
  id: cost.id.startsWith(EXTRA_COST_ID_PREFIX) ? cost.id : `${EXTRA_COST_ID_PREFIX}${cost.id}`,
  name: cost.label.trim() || EXTRA_COST_NOTE,
  category: EXTRA_COST_CATEGORY,
  quantity: 1,
  unit: EXTRA_COST_UNIT,
  unitPrice: cost.amount,
  subtotal: cost.amount,
  notes: EXTRA_COST_NOTE,
});
