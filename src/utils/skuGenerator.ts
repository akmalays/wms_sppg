/**
 * SPPG Warehouse Management System - Standard SKU Generator
 * Generates structured, warehouse-dependent SKU codes with sequential serial numbering.
 * Example formats:
 * - Gudang Kering: ITM-KRG-001, ITM-KRG-002, ...
 * - Gudang Basah / Segar: ITM-BSH-001, ITM-BSH-002, ...
 * - Chiller Dapur (Dingin): ITM-CHL-001, ITM-CHL-002, ...
 * - Freezer Dapur (Beku): ITM-FRZ-001, ITM-FRZ-002, ...
 * - Gudang Non-Food: ITM-NFD-001, ITM-NFD-002, ...
 * - Gudang Operasional / ATK: ITM-OPS-001, ITM-OPS-002, ...
 */

import { ItemMaster } from '../types/warehouse';

export type WarehouseSkuType =
  | 'GUDANG_KERING'
  | 'GUDANG_BASAH'
  | 'CHILLER'
  | 'FREEZER'
  | 'GUDANG_NONFOOD'
  | 'OPERASIONAL_ATK';

export interface WarehouseSkuDefinition {
  key: WarehouseSkuType;
  label: string;
  prefix: string; // e.g. "ITM-KRG"
  shortDesc: string;
  temperature: string;
  defaultLocation: string;
  suggestedLocations: string[];
}

export const WAREHOUSE_SKU_DEFINITIONS: Record<WarehouseSkuType, WarehouseSkuDefinition> = {
  GUDANG_KERING: {
    key: 'GUDANG_KERING',
    label: 'Gudang Kering (Dry Storage)',
    prefix: 'ITM-KRG',
    shortDesc: 'Beras, Minyak, Gula, Tepung, Garam, Bumbu Kering & Bahan Pangan Awet',
    temperature: '20°C - 25°C (Suhu Ruang Terkendali)',
    defaultLocation: 'Gudang Kering - Rak A1',
    suggestedLocations: [
      'Gudang Kering - Rak A1',
      'Gudang Kering - Rak A2',
      'Gudang Kering - Rak A3',
      'Gudang Kering - Rak A4',
      'Gudang Kering - Rak B1',
      'Gudang Kering - Palet Tengah',
    ],
  },
  GUDANG_BASAH: {
    key: 'GUDANG_BASAH',
    label: 'Gudang Basah & Segar (Fresh Storage)',
    prefix: 'ITM-BSH',
    shortDesc: 'Sayuran Segar, Buah Pencuci Mulut, Telur & Bahan Pangan Segar',
    temperature: '8°C - 15°C (Sejuk Berventilasi)',
    defaultLocation: 'Area Sortir Sayur',
    suggestedLocations: [
      'Area Sortir Sayur',
      'Area Buah & Distribusi',
      'Area Persiapan - Rak Telur',
      'Gudang Basah - Rak V1',
      'Gudang Basah - Rak B1',
    ],
  },
  CHILLER: {
    key: 'CHILLER',
    label: 'Chiller Dapur (Cold Storage 2°C - 4°C)',
    prefix: 'ITM-CHL',
    shortDesc: 'Daging Ayam Karkas, Unggas Segar & Bahan Olahan Dingin Harian',
    temperature: '2°C - 4°C (Cold Chain Terjaga)',
    defaultLocation: 'Chiller Dapur - Bin C1',
    suggestedLocations: [
      'Chiller Dapur - Bin C1',
      'Chiller Dapur 1 (Sayur & Buah Dingin)',
      'Chiller Dapur 2 (Olahan & Masak)',
    ],
  },
  FREEZER: {
    key: 'FREEZER',
    label: 'Freezer Dapur (Frozen Storage ≤ -18°C)',
    prefix: 'ITM-FRZ',
    shortDesc: 'Daging Beku, Ikan Kembung Segar/Beku, Seafood & Olahan Beku',
    temperature: '-18°C s/d -20°C (Pembekuan Sempurna)',
    defaultLocation: 'Freezer Dapur - Bin F2',
    suggestedLocations: [
      'Freezer Dapur - Bin F2',
      'Deep Chest Freezer 1',
      'Deep Chest Freezer 2',
    ],
  },
  GUDANG_NONFOOD: {
    key: 'GUDANG_NONFOOD',
    label: 'Gudang Non-Food (Kemasan & Sanitasi)',
    prefix: 'ITM-NFD',
    shortDesc: 'Sabun Cuci Piring, Kantong Plastik Sampah, Tissue, APD & Sanitasi',
    temperature: '20°C - 25°C (Berventilasi Baik, Terpisah Mutlak dari Makanan)',
    defaultLocation: 'Gudang Non-Food Rak N1',
    suggestedLocations: [
      'Gudang Non-Food Rak N1',
      'Gudang Non-Food Rak N2',
      'Gudang Non-Food Rak N3 (APD & Masker)',
    ],
  },
  OPERASIONAL_ATK: {
    key: 'OPERASIONAL_ATK',
    label: 'Gudang Operasional, ATK & Perlengkapan',
    prefix: 'ITM-OPS',
    shortDesc: 'Alat Tulis Kantor, Kertas, Perlengkapan Dapur & Peralatan Operasional',
    temperature: 'Suhu Ruang Normal',
    defaultLocation: 'Ruang Kantor / Lemari ATK',
    suggestedLocations: [
      'Ruang Kantor / Lemari ATK',
      'Gudang Peralatan Dapur',
      'Area Logistik Operasional',
    ],
  },
};

/**
 * Deteksi tipe gudang otomatis dari lokasi simpan atau kategori barang.
 */
export function detectWarehouseType(location?: string, category?: string): WarehouseSkuType {
  const loc = (location || '').toLowerCase();
  const cat = (category || '').toLowerCase();

  if (loc.includes('freezer') || loc.includes('beku') || loc.includes('frz')) {
    return 'FREEZER';
  }
  if (loc.includes('chiller') || loc.includes('chl') || loc.includes('dingin')) {
    return 'CHILLER';
  }
  if (
    loc.includes('non-food') ||
    loc.includes('nonfood') ||
    loc.includes('rak n') ||
    cat.includes('cleaning') ||
    cat.includes('packaging') ||
    cat.includes('hygiene')
  ) {
    return 'GUDANG_NONFOOD';
  }
  if (
    loc.includes('sortir') ||
    loc.includes('sayur') ||
    loc.includes('buah') ||
    loc.includes('telur') ||
    loc.includes('basah') ||
    cat.includes('sayur') ||
    cat.includes('buah')
  ) {
    return 'GUDANG_BASAH';
  }
  if (loc.includes('kantor') || loc.includes('atk') || cat.includes('equipment') || cat.includes('operasional')) {
    return 'OPERASIONAL_ATK';
  }

  // Default ke Gudang Kering
  return 'GUDANG_KERING';
}

/**
 * Generate SKU unik berurutan berdasarkan tipe gudang / prefix gudang.
 * Contoh: ITM-KRG-001, ITM-KRG-002, dst.
 */
export function generateAutoSku(
  warehouseTypeOrPrefix: WarehouseSkuType | string,
  existingItems: ItemMaster[] = []
): string {
  let prefix = 'ITM-KRG';

  if (warehouseTypeOrPrefix in WAREHOUSE_SKU_DEFINITIONS) {
    prefix = WAREHOUSE_SKU_DEFINITIONS[warehouseTypeOrPrefix as WarehouseSkuType].prefix;
  } else if (typeof warehouseTypeOrPrefix === 'string' && warehouseTypeOrPrefix.trim()) {
    // Normalisasi prefix kustom
    const clean = warehouseTypeOrPrefix.trim().toUpperCase().replace(/-+$/, '');
    prefix = clean.startsWith('ITM-') ? clean : `ITM-${clean}`;
  }

  const normalizedPrefix = `${prefix}-`;
  const existingUpperIds = new Set(existingItems.map(i => (i.id || '').toUpperCase().trim()));

  // Cari nomor urut tertinggi untuk prefix ini
  let maxSeq = 0;
  existingItems.forEach(item => {
    if (!item.id) return;
    const upperId = item.id.toUpperCase().trim();
    if (upperId.startsWith(normalizedPrefix)) {
      const rest = upperId.slice(normalizedPrefix.length);
      const match = rest.match(/^(\d+)/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > maxSeq) {
          maxSeq = val;
        }
      }
    }
  });

  // Cari urutan berikutnya yang belum pernah terpakai
  let nextSeq = maxSeq + 1;
  let candidate = `${normalizedPrefix}${String(nextSeq).padStart(3, '0')}`;
  while (existingUpperIds.has(candidate)) {
    nextSeq += 1;
    candidate = `${normalizedPrefix}${String(nextSeq).padStart(3, '0')}`;
  }

  return candidate;
}

/**
 * Daftar seluruh lokasi / rak standar gudang SPPG.
 */
export const ALL_STANDARD_LOCATIONS: string[] = Array.from(
  new Set(Object.values(WAREHOUSE_SKU_DEFINITIONS).flatMap(w => w.suggestedLocations))
);
