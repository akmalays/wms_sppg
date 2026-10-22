import { warehouseDb } from '../db/storage';
import {
  BASE_RACKS_CONFIG,
  RackConfig,
  RackOverride,
  StoredCustomRack,
  SETTING_CUSTOM_RACKS,
  SETTING_RACK_OVERRIDES,
  applyRackOverride,
  matchItemToRackId,
  dynamicRackId,
} from './warehouseRacks';
import { EquipmentItem, ItemMaster, ReceivingDocument } from '../types/warehouse';

/**
 * QR di label berisi tautan pendek ke aplikasi: <origin>/s/<kode>[?gr=<no penerimaan>].
 * Dipindai dengan kamera HP biasa, tautan membuka halaman hasil pindai (perlu login).
 * Label lama yang hanya berisi kode tetap terbaca lewat tombol Pindai di aplikasi.
 */
export const SCAN_PATH = '/s/';

/** QR di Form Rekapitulasi Limbah: dipindai langsung membuka isian Catat Sisa Makanan. */
export const WASTE_ENTRY_CODE = 'FORM-LIMBAH';

export const isWasteEntryTarget = (target: ScanTarget | null): boolean =>
  Boolean(target && target.code.trim().toUpperCase() === WASTE_ENTRY_CODE);

export interface ScanTarget {
  code: string;
  /** Nomor penerimaan (GR) bila dipindai dari Tag Bahan Datang. */
  gr?: string;
}

export function buildScanUrl(code: string, gr?: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}${SCAN_PATH}${encodeURIComponent(code)}${gr ? `?gr=${encodeURIComponent(gr)}` : ''}`;
}

/** Hasil pindai bisa berupa tautan aplikasi atau kode polos (label lama). */
export function parseScanText(raw: string): ScanTarget | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const idx = url.pathname.indexOf(SCAN_PATH);
    if (idx >= 0) {
      const code = decodeURIComponent(url.pathname.slice(idx + SCAN_PATH.length)).trim();
      return code ? { code, gr: url.searchParams.get('gr') || undefined } : null;
    }
    return null;
  } catch {
    return { code: text };
  }
}

export function scanTargetFromLocation(): ScanTarget | null {
  if (typeof window === 'undefined' || !window.location.pathname.startsWith(SCAN_PATH)) return null;
  return parseScanText(window.location.href);
}

export type ResolvedScan =
  | { type: 'item'; item: ItemMaster; receiving?: ReceivingDocument }
  /** otherItems: barang yang diketik manual di plakat dan tidak ada di Master Barang. */
  | { type: 'rack'; rack: RackConfig | { id: string; name: string }; items: ItemMaster[]; otherItems: { id: string; name: string }[] }
  | { type: 'asset'; asset: EquipmentItem }
  | { type: 'receiving'; receiving: ReceivingDocument }
  | { type: 'unknown'; code: string };

export function resolveScan(target: ScanTarget): ResolvedScan {
  const code = target.code.trim();
  const upper = code.toUpperCase();
  const item = warehouseDb.getItems().find(i => i.id.toUpperCase() === upper);
  if (item) {
    const receiving = target.gr ? warehouseDb.getReceivings().find(r => r.id === target.gr) : undefined;
    return { type: 'item', item, receiving };
  }
  // Barang per rak dihitung dengan aturan yang sama seperti Plakat Rak di Cetak Form,
  // termasuk plakat kustom dan perubahan yang disimpan dari dialog Ubah plakat.
  const overrides = warehouseDb.getAppSetting<Record<string, RackOverride>>(SETTING_RACK_OVERRIDES, {});
  const customRacks = warehouseDb.getAppSetting<StoredCustomRack[]>(SETTING_CUSTOM_RACKS, []);
  const activeItems = warehouseDb.getItems().filter(i => i.isActive);
  const rackOf = (i: ItemMaster) =>
    matchItemToRackId(i.location, i.category, i.name, i.id, customRacks) || dynamicRackId(i.location || 'Area Gudang Tambahan');
  const baseRack = BASE_RACKS_CONFIG.find(r => r.id === upper);
  const customRack = customRacks.find(r => r.id.toUpperCase() === upper);
  if (baseRack || customRack || upper.startsWith('RAK-DYN-')) {
    const ov = overrides[baseRack?.id || customRack?.id || upper];
    const listed = ov?.customItems ?? customRack?.items;
    let items: ItemMaster[];
    let otherItems: { id: string; name: string }[] = [];
    if (listed) {
      // Daftar diatur manual: urutan mengikuti plakat
      const byId = new Map(warehouseDb.getItems().map(i => [i.id, i] as const));
      items = listed.map(l => byId.get(l.id)).filter((i): i is ItemMaster => Boolean(i));
      otherItems = listed.filter(l => !byId.has(l.id)).map(l => ({ id: l.id, name: l.name }));
    } else {
      items = activeItems.filter(i => rackOf(i) === upper).sort((a, b) => a.name.localeCompare(b.name));
    }
    const source = customRack || baseRack;
    const rack = source
      ? applyRackOverride(source, ov)
      : { id: upper, name: ov?.name || (items[0] ? `Rak / Area: ${items[0].location}` : `Rak ${upper}`) };
    return { type: 'rack', rack, items, otherItems };
  }
  const asset = warehouseDb.getEquipment().find(e => e.id.toUpperCase() === upper);
  if (asset) return { type: 'asset', asset };
  const receiving = warehouseDb.getReceivings().find(r => r.id.toUpperCase() === upper);
  if (receiving) return { type: 'receiving', receiving };
  return { type: 'unknown', code };
}
