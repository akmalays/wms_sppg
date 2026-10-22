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
    label: 'Gudang Kering',
    prefix: 'ITM-KRG',
    shortDesc: 'Beras, Minyak, Gula, Tepung, Garam, Bumbu Kering & Bahan Pangan Awet',
    temperature: '20°C - 25°C (Suhu Ruang Terkendali)',
    defaultLocation: 'Gudang Kering - Rak 1 (Garam, Rempah & Bumbu Dasar)',
    suggestedLocations: [
      'Gudang Kering - Palet Tengah (Sembako Berat)',
      'Gudang Kering - Rak 1 (Garam, Rempah & Bumbu Dasar)',
      'Gudang Kering - Rak 2 (Tepung, Gula & Bumbu Bubuk)',
      'Gudang Kering - Rak 3 (Saus, Kecap & Mentega)',
      'Gudang Kering - Rak 4 (Stok Cadangan Dus)',
    ],
  },
  GUDANG_BASAH: {
    key: 'GUDANG_BASAH',
    label: 'Gudang Basah (Buah, Sayur & Telur)',
    prefix: 'ITM-BSH',
    shortDesc: 'Buah, sayur & telur; disimpan di Chiller',
    temperature: '1°C - 5°C (Chiller)',
    defaultLocation: 'Gudang Basah - Chiller (Buah, Sayur & Telur)',
    suggestedLocations: [
      'Gudang Basah - Chiller (Buah, Sayur & Telur)',
      'Gudang Basah - Palet Sisa (Sisa Bahan Kering dari Dapur)',
      'Gudang Basah - Freezer 1 (Stok Ayam & Protein Beku)',
    ],
  },
  CHILLER: {
    key: 'CHILLER',
    label: 'Chiller (1°C - 5°C)',
    prefix: 'ITM-CHL',
    shortDesc: 'Buah, sayur, telur & ayam yang sedang dicairkan',
    temperature: '1°C - 5°C',
    defaultLocation: 'Gudang Basah - Chiller (Buah, Sayur & Telur)',
    suggestedLocations: [
      'Gudang Basah - Chiller (Buah, Sayur & Telur)',
    ],
  },
  FREEZER: {
    key: 'FREEZER',
    label: 'Freezer (-18°C)',
    prefix: 'ITM-FRZ',
    shortDesc: 'Ayam, daging, ikan & olahan beku',
    temperature: '-18°C atau lebih dingin',
    defaultLocation: 'Gudang Basah - Freezer 1 (Stok Ayam & Protein Beku)',
    suggestedLocations: [
      'Gudang Basah - Freezer 1 (Stok Ayam & Protein Beku)',
      'Dapur - Freezer 2 (Ayam Siap Masak)',
      'Dapur - Freezer 3 (Protein & Olahan Beku Lain)',
    ],
  },
  GUDANG_NONFOOD: {
    key: 'GUDANG_NONFOOD',
    label: 'Gudang Non-Food (Sanitasi, Kemasan, APD & P3K)',
    prefix: 'ITM-NFD',
    shortDesc: 'Sabun Sanitasi, Plastik Kemasan, Tissue Dapur, APD & Masker, P3K & Obat-obatan',
    temperature: '20°C - 25°C (Berventilasi Baik, Terpisah Mutlak dari Makanan)',
    defaultLocation: 'Gudang Non-Food - Rak N1 (Sabun dan Sanitasi)',
    suggestedLocations: [
      'Gudang Non-Food - Rak N1 (Sabun dan Sanitasi)',
      'Gudang Non-Food - Rak N2 (Plastik, Tissue dan Kemasan)',
      'Gudang Non-Food - Rak N3 (APD dan Masker)',
      'Gudang Non-Food - Rak N4 (P3K dan Obat-obatan)',
    ],
  },
  OPERASIONAL_ATK: {
    key: 'OPERASIONAL_ATK',
    label: 'Gudang Operasional, ATK & Perlengkapan',
    prefix: 'ITM-OPS',
    shortDesc: 'Alat Tulis Kantor, Kertas, Perlengkapan Dapur & Peralatan Operasional',
    temperature: 'Suhu Ruang Normal',
    defaultLocation: 'Ruang Kantor / Lemari ATK (Alat Tulis Kantor & Administrasi)',
    suggestedLocations: [
      'Ruang Kantor / Lemari ATK (Alat Tulis Kantor & Administrasi)',
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
 * Spesifikasi Lengkap Rak & Lokasi Penyimpanan Standar Gudang SPPG
 * Digunakan secara sinkron pada Master Barang, Monitoring Stok, dan Cetak Form Label Rak Gudang.
 */
export interface StorageRackSpecification {
  id: string; // e.g. "PLT-KRG-T1", "RAK-KRG-A1", etc.
  shortName: string; // e.g. "Gudang Kering - Palet Tengah"
  rackCode: string; // e.g. "Palet Tengah"
  commodityDetail: string; // e.g. "Sembako Sak & Karung Curah"
  fullDisplay: string; // e.g. "Gudang Kering - Palet Tengah (Sembako Sak & Karung Curah)"
  warehouseType: WarehouseSkuType;
  zone: string;
  temperature: string;
  humidity?: string;
  capacityMax?: string;
  storageRule: string;
  description: string;
  rotationMethod: 'FIFO' | 'FEFO';
  picDefault: string;
}

export const STANDARD_STORAGE_RACKS: Record<string, StorageRackSpecification> = {
  'PLT-KRG-T1': {
    id: 'PLT-KRG-T1',
    shortName: 'Gudang Kering - Palet Tengah',
    rackCode: 'Palet Tengah',
    commodityDetail: 'Sembako Berat',
    fullDisplay: 'Gudang Kering - Palet Tengah (Sembako Berat)',
    warehouseType: 'GUDANG_KERING',
    zone: 'Lantai tengah gudang kering, di atas palet',
    temperature: 'Suhu ruang 20°C - 25°C',
    humidity: 'Kering, maks. 60% RH',
    capacityMax: '± 50-60 sak / karung',
    storageRule: 'Selalu di atas palet, min. 15 cm dari lantai dan 5 cm dari dinding. Tumpuk sak bersilangan, maks. 8 tumpuk. Sisakan lorong agar sak lama mudah diambil lebih dulu.',
    description: 'Barang berat dalam sak, karung, atau dus/jerigen besar: beras sak, tepung sak (terigu, panir, bubbling), gula sak, minyak goreng.',
    rotationMethod: 'FIFO',
    picDefault: 'Petugas Logistik Gudang Kering'
  },
  'RAK-KRG-A1': {
    id: 'RAK-KRG-A1',
    shortName: 'Gudang Kering - Rak 1',
    rackCode: 'Rak 1',
    commodityDetail: 'Garam, Rempah & Bumbu Dasar',
    fullDisplay: 'Gudang Kering - Rak 1 (Garam, Rempah & Bumbu Dasar)',
    warehouseType: 'GUDANG_KERING',
    zone: 'Gudang Kering - Rak 1',
    temperature: 'Suhu ruang 20°C - 25°C',
    humidity: 'Kering, wadah tertutup',
    capacityMax: 'Ambalan bumbu',
    storageRule: 'Bumbu yang sudah dibuka pindahkan ke toples/wadah tertutup dan beri label tanggal buka.',
    description: 'Bumbu berbentuk utuh atau padat: garam, kemiri, cengkeh, ketumbar utuh, terasi, petis.',
    rotationMethod: 'FIFO',
    picDefault: 'Petugas Logistik Gudang Kering'
  },
  'RAK-KRG-A2': {
    id: 'RAK-KRG-A2',
    shortName: 'Gudang Kering - Rak 2',
    rackCode: 'Rak 2',
    commodityDetail: 'Tepung, Gula & Bumbu Bubuk',
    fullDisplay: 'Gudang Kering - Rak 2 (Tepung, Gula & Bumbu Bubuk)',
    warehouseType: 'GUDANG_KERING',
    zone: 'Gudang Kering - Rak 2',
    temperature: 'Suhu ruang 20°C - 25°C',
    humidity: 'Kering, maks. 55% RH (mudah menggumpal)',
    capacityMax: 'Ambalan bertingkat',
    storageRule: 'Kemasan terbuka wajib diikat/masuk wadah tertutup. Jaga dari semut dan ceceran.',
    description: 'Bahan berbentuk bubuk atau butiran dalam kemasan kecil: tepung beras/kanji/hunkwee, gula pasir & gula merah, royco/kaldu, lada & ketumbar bubuk, pala bubuk, baking soda.',
    rotationMethod: 'FEFO',
    picDefault: 'Petugas Logistik Gudang Kering'
  },
  'RAK-KRG-A3': {
    id: 'RAK-KRG-A3',
    shortName: 'Gudang Kering - Rak 3',
    rackCode: 'Rak 3',
    commodityDetail: 'Saus, Kecap & Mentega',
    fullDisplay: 'Gudang Kering - Rak 3 (Saus, Kecap & Mentega)',
    warehouseType: 'GUDANG_KERING',
    zone: 'Gudang Kering - Rak 3',
    temperature: 'Suhu ruang 20°C - 25°C',
    humidity: 'Sirkulasi udara baik, jauh dari sinar matahari',
    capacityMax: 'Ambalan botol & pouch',
    storageRule: 'Botol berdiri dan tutup rapat. Botol besar/pouch di ambalan bawah. Ambil yang kedaluwarsanya paling dekat lebih dulu.',
    description: 'Bahan berbentuk cair atau kental dalam botol/pouch: kecap, saus tomat/sambal/teriyaki, kecap ikan, cuka, minyak wijen, mayones, mentega.',
    rotationMethod: 'FEFO',
    picDefault: 'Petugas Logistik Gudang Kering'
  },
  'RAK-KRG-A4': {
    id: 'RAK-KRG-A4',
    shortName: 'Gudang Kering - Rak 4',
    rackCode: 'Rak 4',
    commodityDetail: 'Stok Cadangan Dus',
    fullDisplay: 'Gudang Kering - Rak 4 (Stok Cadangan Dus)',
    warehouseType: 'GUDANG_KERING',
    zone: 'Gudang Kering - Rak 4',
    temperature: 'Suhu ruang 20°C - 25°C',
    humidity: 'Kering',
    capacityMax: 'Tumpukan dus',
    storageRule: 'Hanya dus yang belum dibuka. Tulis nama barang & tanggal datang di sisi dus. Dus lama dibuka lebih dulu untuk mengisi ulang Rak 1-3.',
    description: 'Cadangan dus tertutup untuk Rak 1, Rak 2, dan Rak 3. Di sistem, stoknya tetap tercatat di rak asal barangnya.',
    rotationMethod: 'FIFO',
    picDefault: 'Petugas Logistik Gudang Kering'
  },
  'RAK-KRG-N1': {
    id: 'RAK-KRG-N1',
    shortName: 'Gudang Non-Food - Rak N1',
    rackCode: 'Rak N1',
    commodityDetail: 'Sabun & Sanitasi',
    fullDisplay: 'Gudang Non-Food - Rak N1 (Sabun dan Sanitasi)',
    warehouseType: 'GUDANG_NONFOOD',
    zone: 'Zona Sabun & Sanitasi Dapur (Terpisah Fisik Mutlak)',
    temperature: '20°C - 25°C (Berventilasi Baik)',
    capacityMax: '40 Jerigen 5L / Botol',
    storageRule: 'STANDAR HACCP: Terpisah mutlak dari bahan makanan & kemasan! Dilarang keras menyimpan bahan pangan apa pun di rak ini.',
    description: 'Penyimpanan cairan pembersih piring food-contact, deterjen pencucian tray SUS 304, sabun lantai, dan disinfektan dapur.',
    rotationMethod: 'FIFO',
    picDefault: 'Staf Sanitasi & Kebersihan'
  },
  'RAK-KRG-N2': {
    id: 'RAK-KRG-N2',
    shortName: 'Gudang Non-Food - Rak N2',
    rackCode: 'Rak N2',
    commodityDetail: 'Plastik, Tissue & Kemasan',
    fullDisplay: 'Gudang Non-Food - Rak N2 (Plastik, Tissue dan Kemasan)',
    warehouseType: 'GUDANG_NONFOOD',
    zone: 'Zona Kemasan & Packaging Dapur',
    temperature: '20°C - 25°C (Bersih, Kering & Bebas Debu)',
    capacityMax: '30 Dus Kemasan / Kontainer',
    storageRule: 'Simpan kardus/pack dalam kondisi tertutup plastik pembungkus agar higienis sebelum didistribusikan ke dapur.',
    description: 'Penyimpanan kantong sampah medis/dapur, tissue serap minyak, tissue hand towel, mika bento, dan thinwall kemasan.',
    rotationMethod: 'FIFO',
    picDefault: 'Staf Logistik Non-Food'
  },
  'RAK-KRG-N3': {
    id: 'RAK-KRG-N3',
    shortName: 'Gudang Non-Food - Rak N3',
    rackCode: 'Rak N3',
    commodityDetail: 'APD & Masker',
    fullDisplay: 'Gudang Non-Food - Rak N3 (APD dan Masker)',
    warehouseType: 'GUDANG_NONFOOD',
    zone: 'Zona Higiene & Alat Pelindung Diri (APD)',
    temperature: '20°C - 25°C (Kering, Bersih & Bebas Debu)',
    capacityMax: '25 Box APD / Kontainer Tertutup',
    storageRule: 'Simpan dalam wadah/kotak tertutup rapat dan steril. Wajib digunakan sebelum memasuki area pengolahan dapur SPPG.',
    description: 'Penyimpanan masker medis (3-ply/hijab), penutup kepala (nurse cap/hairnet), celemek/apron, dan sarung tangan food-grade.',
    rotationMethod: 'FIFO',
    picDefault: 'Staf Higiene & K3 Dapur'
  },
  'BIN-FRZ-F2': {
    id: 'BIN-FRZ-F2',
    shortName: 'Gudang Basah - Freezer 1',
    rackCode: 'Freezer 1',
    commodityDetail: 'Stok Ayam & Protein Beku',
    fullDisplay: 'Gudang Basah - Freezer 1 (Stok Ayam & Protein Beku)',
    warehouseType: 'FREEZER',
    zone: 'Gudang Basah - Freezer 1',
    temperature: '-18°C atau lebih dingin (cek pagi & sore)',
    humidity: 'Bunga es maks. 5 mm, defrost berkala',
    capacityMax: 'Sesuai kapasitas',
    storageRule: 'Stok utama dari supplier. Beri label tanggal datang, yang lama di depan/atas. Pindahkan ke Freezer 2 (Dapur) sesuai kebutuhan masak besok.',
    description: 'Ayam (karkas, fillet, potongan) yang baru datang, serta daging/ikan beku bila ada.',
    rotationMethod: 'FIFO',
    picDefault: 'PIC Gudang Basah & Dapur'
  },
  'BIN-FRZ-D1': {
    id: 'BIN-FRZ-D1',
    shortName: 'Dapur - Freezer 2',
    rackCode: 'Freezer 2',
    commodityDetail: 'Ayam Siap Masak',
    fullDisplay: 'Dapur - Freezer 2 (Ayam Siap Masak)',
    warehouseType: 'FREEZER',
    zone: 'Dapur - Freezer 2',
    temperature: '-18°C atau lebih dingin',
    humidity: 'Tutup rapat, jangan sering dibuka',
    capacityMax: 'Sesuai kapasitas',
    storageRule: 'Hanya ayam yang sudah dibagi per kantong sesuai menu besok (H-1). Label: menu + tanggal. Cairkan di Chiller, bukan di suhu ruang. Ayam yang sudah cair tidak boleh dibekukan lagi.',
    description: 'Ayam yang sudah dibagi per kebutuhan masak, diisi dari Freezer 1 sesuai rencana menu.',
    rotationMethod: 'FIFO',
    picDefault: 'PIC Gudang Basah & Dapur'
  },
  'BIN-FRZ-D2': {
    id: 'BIN-FRZ-D2',
    shortName: 'Dapur - Freezer 3',
    rackCode: 'Freezer 3',
    commodityDetail: 'Protein & Olahan Beku Lain',
    fullDisplay: 'Dapur - Freezer 3 (Protein & Olahan Beku Lain)',
    warehouseType: 'FREEZER',
    zone: 'Dapur - Freezer 3',
    temperature: '-18°C atau lebih dingin',
    humidity: 'Tutup rapat, jangan sering dibuka',
    capacityMax: 'Sesuai kapasitas',
    storageRule: 'Pisahkan dari ayam. Simpan per jenis dalam wadah/kantong tertutup berlabel nama + tanggal.',
    description: 'Ikan, daging sapi, dan olahan beku (nugget, sosis, bakso, dll).',
    rotationMethod: 'FIFO',
    picDefault: 'PIC Gudang Basah & Dapur'
  },
  'BIN-CHL-C1': {
    id: 'BIN-CHL-C1',
    shortName: 'Gudang Basah - Chiller',
    rackCode: 'Chiller',
    commodityDetail: 'Buah, Sayur & Telur',
    fullDisplay: 'Gudang Basah - Chiller (Buah, Sayur & Telur)',
    warehouseType: 'CHILLER',
    zone: 'Gudang Basah - Chiller',
    temperature: '1°C - 5°C (cek pagi & sore)',
    humidity: 'Jangan terlalu penuh agar udara dingin mengalir',
    capacityMax: 'Sesuai kapasitas',
    storageRule: 'Atas: telur & bahan siap pakai. Tengah: buah & sayur. Bawah: ayam yang sedang dicairkan dalam wadah tertutup agar tidak menetes.',
    description: 'Sisa buah & sayur, telur, dan ayam yang dicairkan untuk dimasak besok.',
    rotationMethod: 'FEFO',
    picDefault: 'PIC Gudang Basah & Dapur'
  },
  'PLT-BSH-S1': {
    id: 'PLT-BSH-S1',
    shortName: 'Gudang Basah - Palet Sisa',
    rackCode: 'Palet Sisa',
    commodityDetail: 'Sisa Bahan Kering dari Dapur',
    fullDisplay: 'Gudang Basah - Palet Sisa (Sisa Bahan Kering dari Dapur)',
    warehouseType: 'GUDANG_BASAH',
    zone: 'Gudang Basah - Palet Sisa',
    temperature: 'Suhu ruang, kering',
    humidity: 'Jauh dari lantai basah & cipratan air',
    capacityMax: 'Sesuai kapasitas',
    storageRule: 'Semua sisa masuk kontainer/box tertutup di atas palet, tidak langsung di lantai. Label tiap kemasan: nama + tanggal buka. Pakai sisa di sini lebih dulu sebelum mengambil kemasan baru dari Gudang Kering.',
    description: 'Sisa royco, saus, kecap, tepung, gula, dan bumbu bubuk yang sudah dibuka dari dapur.',
    rotationMethod: 'FIFO',
    picDefault: 'PIC Gudang Basah & Dapur'
  },
  'RUANG_KANTOR_ATK': {
    id: 'RUANG_KANTOR_ATK',
    shortName: 'Ruang Kantor / Lemari ATK',
    rackCode: 'Lemari ATK',
    commodityDetail: 'Alat Tulis Kantor & Administrasi',
    fullDisplay: 'Ruang Kantor / Lemari ATK (Alat Tulis Kantor & Administrasi)',
    warehouseType: 'OPERASIONAL_ATK',
    zone: 'Ruang Administrasi Logistik SPPG',
    temperature: 'Suhu Ruang Normal',
    storageRule: 'Tersimpan rapi di dalam lemari arsip terkunci, kering, dan bebas dari debu operasional.',
    description: 'Penyimpanan kertas formulir cetak PO, label thermal barcode, map arsip, buku log gudang, dan alat tulis administrasi SPPG.',
    rotationMethod: 'FIFO',
    picDefault: 'Staf Administrasi & Gudang'
  }
};

/**
 * Mendapatkan detail spesifikasi rak & lokasi penyimpanan secara cerdas.
 * Mendukung pencocokan dari nama singkat, kode rak, maupun nama lengkap.
 */
export function getStorageLocationDetails(rawLocation: string): StorageRackSpecification {
  const l = (rawLocation || '').toLowerCase().trim();

  // 1. Palet Sisa (gudang basah) dulu, lalu Palet Tengah Gudang Kering
  if (l.includes('palet sisa')) {
    return STANDARD_STORAGE_RACKS['PLT-BSH-S1'];
  }
  if (
    l.includes('palet tengah') ||
    l.includes('plt-krg-t1') ||
    (l.includes('palet') && (l.includes('sak') || l.includes('tengah') || l.includes('curah')))
  ) {
    return STANDARD_STORAGE_RACKS['PLT-KRG-T1'];
  }

  // 2. Rak 1-4 gudang kering (dibagi menurut bentuk barang)
  const rakNo = l.match(/\brak\s*([1-4])\b/);
  if (rakNo) {
    return STANDARD_STORAGE_RACKS[`RAK-KRG-A${rakNo[1]}`];
  }

  // 3. Cek Non-Food (3 Kategori: Sabun dan Sanitasi, Plastik Tissue dan Kemasan, APD dan Masker)
  if (
    l.includes('rak n3') ||
    l.includes('apd') ||
    l.includes('masker') ||
    l.includes('hairnet') ||
    l.includes('celemek') ||
    l.includes('apron') ||
    l.includes('sarung tangan')
  ) {
    return STANDARD_STORAGE_RACKS['RAK-KRG-N3'];
  }
  if (
    l.includes('rak n1') ||
    l.includes('sabun') ||
    l.includes('sanitasi') ||
    l.includes('deterjen') ||
    l.includes('karbol') ||
    l.includes('pembersih') ||
    l.includes('disinfektan')
  ) {
    return STANDARD_STORAGE_RACKS['RAK-KRG-N1'];
  }
  if (
    l.includes('rak n2') ||
    l.includes('plastik') ||
    l.includes('tissue') ||
    l.includes('tisu') ||
    l.includes('kemasan') ||
    l.includes('mika') ||
    l.includes('thinwall') ||
    l.includes('wrap')
  ) {
    return STANDARD_STORAGE_RACKS['RAK-KRG-N2'];
  }

  // 4. Gudang basah & dapur: 3 freezer, chiller, palet sisa bahan
  if (l.includes('freezer 2')) return STANDARD_STORAGE_RACKS['BIN-FRZ-D1'];
  if (l.includes('freezer 3')) return STANDARD_STORAGE_RACKS['BIN-FRZ-D2'];
  if (l.includes('freezer') || l.includes('bin f2') || l.includes('beku')) {
    return STANDARD_STORAGE_RACKS['BIN-FRZ-F2'];
  }
  if (l.includes('chiller') || l.includes('bin c1') || l.includes('sayur') || l.includes('buah') || l.includes('telur')) {
    return STANDARD_STORAGE_RACKS['BIN-CHL-C1'];
  }

  // 6. Cek Operasional & ATK
  if (l.includes('kantor') || l.includes('lemari atk') || l.includes('atk') || l.includes('administrasi')) {
    return STANDARD_STORAGE_RACKS['RUANG_KANTOR_ATK'];
  }

  // Fallback untuk lokasi kustom / baru yang belum terdaftar
  const cleanName = rawLocation.trim() || 'Gudang Utama';
  return {
    id: `CUSTOM-${cleanName.replace(/\s+/g, '-').toUpperCase()}`,
    shortName: cleanName,
    rackCode: 'Kustom',
    commodityDetail: 'Lokasi Simpan Kustom',
    fullDisplay: cleanName,
    warehouseType: detectWarehouseType(cleanName),
    zone: 'Area Penyimpanan Khusus',
    temperature: 'Suhu Terkondisi',
    storageRule: 'Pastikan penataan barang memenuhi standar kebersihan, berjarak dari lantai, dan menerapkan rotasi FIFO.',
    description: 'Lokasi rak/area kustom yang dikonfigurasi mandiri oleh petugas logistik gudang SPPG.',
    rotationMethod: 'FIFO',
    picDefault: 'Staf Logistik SPPG'
  };
}

/**
 * Daftar seluruh lokasi / rak standar gudang SPPG.
 */
export const ALL_STANDARD_LOCATIONS: string[] = Array.from(
  new Set(Object.values(WAREHOUSE_SKU_DEFINITIONS).flatMap(w => w.suggestedLocations))
);
