import { ItemMaster, NonFoodExpense } from '../types/warehouse';

export interface ItemReference {
  item?: ItemMaster;
  unit?: string;
  /** Harga acuan: perkiraan harga di Master Barang, atau harga belanja terakhir dengan nama yang sama. */
  price?: number;
  priceSource?: 'master' | 'riwayat';
  /** Tanggal belanja terakhir bila harga diambil dari riwayat. */
  priceDate?: string;
}

const key = (name: string) => name.trim().toLowerCase();

/**
 * Acuan barang dari data nyata saja: Master Barang dan riwayat belanja.
 * Menggantikan katalog harga yang dulu ditulis langsung di kode.
 */
export function buildItemReference(items: ItemMaster[], expenses: NonFoodExpense[]) {
  const byName = new Map(items.map(i => [key(i.name), i]));
  // expenses dari getNonFoodExpenses() sudah urut terbaru dulu; ambil harga pertama yang terisi per nama.
  const lastPurchase = new Map<string, { price: number; unit?: string; date: string }>();
  for (const e of expenses) {
    const k = key(e.itemName);
    if (!k || lastPurchase.has(k) || !(Number(e.unitPrice) > 0)) continue;
    lastPurchase.set(k, { price: Number(e.unitPrice), unit: e.unit, date: e.date });
  }

  return (name: string): ItemReference | null => {
    const k = key(name);
    if (!k) return null;
    const item = byName.get(k);
    const last = lastPurchase.get(k);
    if (!item && !last) return null;
    if (item?.estimatedPrice && item.estimatedPrice > 0) {
      return { item, unit: item.baseUnit, price: item.estimatedPrice, priceSource: 'master' };
    }
    return {
      item,
      unit: item?.baseUnit || last?.unit,
      price: last?.price,
      priceSource: last ? 'riwayat' : undefined,
      priceDate: last?.date,
    };
  };
}

/** Keterangan sumber harga untuk ditampilkan di samping angka. */
export function describePriceSource(ref: ItemReference): string {
  if (ref.priceSource === 'master') return 'perkiraan harga di Master Barang';
  if (ref.priceSource === 'riwayat') return `belanja terakhir${ref.priceDate ? ` (${ref.priceDate})` : ''}`;
  return '';
}
