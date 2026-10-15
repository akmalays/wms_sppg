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
    defaultLocation: 'Gudang Kering - Rak A1 (Sembako Beras & Karung Pangan)',
    suggestedLocations: [
      'Gudang Kering - Rak A1 (Sembako Beras & Karung Pangan)',
      'Gudang Kering - Palet Tengah (Sembako Sak & Karung Curah)',
      'Gudang Kering - Rak A2 (Minyak, Lemak & Cairan Pangan)',
      'Gudang Kering - Rak A3 (Gula, Pemanis & Tepung Olahan)',
      'Gudang Kering - Rak A4 (Garam, Bumbu Kering & Rempah)',
    ],
  },
  GUDANG_BASAH: {
    key: 'GUDANG_BASAH',
    label: 'Gudang Basah & Segar (Fresh Storage)',
    prefix: 'ITM-BSH',
    shortDesc: 'Sayuran Segar, Buah Pencuci Mulut, Telur & Bahan Pangan Segar',
    temperature: '8°C - 15°C (Sejuk Berventilasi)',
    defaultLocation: 'Gudang Basah - Rak V1 (Sayuran Segar & Umbi Hijau)',
    suggestedLocations: [
      'Gudang Basah - Rak V1 (Sayuran Segar & Umbi Hijau)',
      'Gudang Basah - Rak B1 (Buah Segar Pencuci Mulut)',
      'Area Persiapan - Rak Telur (Telur Ayam Ras Segar)',
      'Area Sortir Sayur (Penerimaan Bahan Segar)',
    ],
  },
  CHILLER: {
    key: 'CHILLER',
    label: 'Chiller Dapur (Cold Storage 2°C - 4°C)',
    prefix: 'ITM-CHL',
    shortDesc: 'Daging Ayam Karkas, Unggas Segar & Bahan Olahan Dingin Harian',
    temperature: '2°C - 4°C (Cold Chain Terjaga)',
    defaultLocation: 'Chiller Dapur - Bin C1 (Daging Ayam & Protein Unggas)',
    suggestedLocations: [
      'Chiller Dapur - Bin C1 (Daging Ayam & Protein Unggas)',
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
    defaultLocation: 'Freezer Dapur - Bin F2 (Daging Beku, Ikan Laut & Olahan)',
    suggestedLocations: [
      'Freezer Dapur - Bin F2 (Daging Beku, Ikan Laut & Olahan)',
      'Deep Chest Freezer 1 (Stok Cadangan Beku)',
      'Deep Chest Freezer 2 (Ikan & Seafood)',
    ],
  },
  GUDANG_NONFOOD: {
    key: 'GUDANG_NONFOOD',
    label: 'Gudang Non-Food (Kemasan & Sanitasi)',
    prefix: 'ITM-NFD',
    shortDesc: 'Sabun Cuci Piring, Kantong Plastik Sampah, Tissue, APD & Sanitasi',
    temperature: '20°C - 25°C (Berventilasi Baik, Terpisah Mutlak dari Makanan)',
    defaultLocation: 'Gudang Non-Food - Rak N1 (Sabun, Kebersihan & Sanitasi Dapur)',
    suggestedLocations: [
      'Gudang Non-Food - Rak N1 (Sabun, Kebersihan & Sanitasi Dapur)',
      'Gudang Non-Food - Rak N2 (Plastik, Kemasan & Tissue Dapur)',
      'Gudang Non-Food - Rak N3 (Perlengkapan APD & Masker)',
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
    commodityDetail: 'Sembako Sak & Karung Curah',
    fullDisplay: 'Gudang Kering - Palet Tengah (Sembako Sak & Karung Curah)',
    warehouseType: 'GUDANG_KERING',
    zone: 'Zona Tengah Gudang Kering - Palet Lantai (Floor Bulk Storage Bay)',
    temperature: '20°C - 25°C (Suhu Ruang Kering Terkontrol)',
    humidity: 'Maks. 60% RH (Sirkulasi Terbuka & Bebas Lembap)',
    capacityMax: '2.500 Kg (Maks. 50-60 Sak / Karung Pangan 25-50 Kg)',
    storageRule: 'Wajib beralaskan palet plastik/kayu fumigasi min. 15 cm di atas lantai. Susun bersilangan (interlocking) maks. 8 tumpukan sak demi kestabilan. Beri lorong sirkulasi udara min. 50 cm antar tumpukan.',
    description: 'Area palet tengah lantai (floor pallet bay) khusus penempatan komoditas pangan pokok berbobot berat dalam kemasan sak/karung 25–50 kg (seperti karung beras premium, sak gula pasir, sak tepung terigu, serta buffer stock pangan curah volume besar). Memudahkan manuver hand pallet/forklift dan penerapan rotasi FIFO pengeluaran bahan.',
    rotationMethod: 'FIFO',
    picDefault: 'Petugas Logistik Gudang Kering'
  },
  'RAK-KRG-A1': {
    id: 'RAK-KRG-A1',
    shortName: 'Gudang Kering - Rak A1',
    rackCode: 'Rak A1',
    commodityDetail: 'Sembako Beras & Karung Pangan',
    fullDisplay: 'Gudang Kering - Rak A1 (Sembako Beras & Karung Pangan)',
    warehouseType: 'GUDANG_KERING',
    zone: 'Zona Sembako Sektor A (Beban Berat)',
    temperature: '20°C - 25°C (Suhu Ruang Terkendali)',
    humidity: 'Maks. 60% RH (Hindari Lembap)',
    capacityMax: '1.500 Kg (Kapasitas Maks. 30 Karung 25-50 Kg)',
    storageRule: 'Wajib di atas palet plastik/kayu min. 15 cm dari lantai & berjarak 5 cm dari dinding. Bebas kutu beras & hama.',
    description: 'Penyimpanan beras kemasan karung 25-50 kg berlabel Halal & SNI, ketan, dan biji-bijian pangan kemasan bertingkat.',
    rotationMethod: 'FIFO',
    picDefault: 'Petugas Logistik Gudang Kering'
  },
  'RAK-KRG-A2': {
    id: 'RAK-KRG-A2',
    shortName: 'Gudang Kering - Rak A2',
    rackCode: 'Rak A2',
    commodityDetail: 'Minyak, Lemak & Cairan Pangan',
    fullDisplay: 'Gudang Kering - Rak A2 (Minyak, Lemak & Cairan Pangan)',
    warehouseType: 'GUDANG_KERING',
    zone: 'Zona Cairan & Jerigen Sektor A',
    temperature: '20°C - 25°C (Terhindar Cahaya Langsung)',
    humidity: 'Sirkulasi Udara Aktif',
    capacityMax: '500 Liter (Maks. 100 Jerigen 5L)',
    storageRule: 'Letakkan jerigen di ambalan paling bawah untuk stabilitas. Pastikan tutup tersegel rapat agar tidak merembes.',
    description: 'Penyimpanan minyak goreng jerigen 5 Liter, minyak bantal fortifikasi Vitamin A, mentega, dan margarin kemasan karton.',
    rotationMethod: 'FIFO',
    picDefault: 'Petugas Logistik Gudang Kering'
  },
  'RAK-KRG-A3': {
    id: 'RAK-KRG-A3',
    shortName: 'Gudang Kering - Rak A3',
    rackCode: 'Rak A3',
    commodityDetail: 'Gula, Pemanis & Tepung Olahan',
    fullDisplay: 'Gudang Kering - Rak A3 (Gula, Pemanis & Tepung Olahan)',
    warehouseType: 'GUDANG_KERING',
    zone: 'Zona Bahan Bubuk & Pemanis Sektor A',
    temperature: '20°C - 25°C (Kering & Bebas Semut)',
    humidity: 'Maks. 55% RH (Sangat Rentan Gumpal)',
    capacityMax: '800 Kg (Ambalan Bertingkat SUS 304)',
    storageRule: 'Gunakan kontainer tertutup food-grade setelah kemasan dibuka. Pasang kapur/anti semut di sekitar kaki rak.',
    description: 'Penyimpanan gula pasir kristal putih 1kg, tepung terigu protein sedang/tinggi, tepung beras, dan tepung maizena.',
    rotationMethod: 'FEFO',
    picDefault: 'Petugas Logistik Gudang Kering'
  },
  'RAK-KRG-A4': {
    id: 'RAK-KRG-A4',
    shortName: 'Gudang Kering - Rak A4',
    rackCode: 'Rak A4',
    commodityDetail: 'Garam, Bumbu Kering & Rempah',
    fullDisplay: 'Gudang Kering - Rak A4 (Garam, Bumbu Kering & Rempah)',
    warehouseType: 'GUDANG_KERING',
    zone: 'Zona Bumbu & Rempah Sektor A',
    temperature: '20°C - 25°C (Suhu Ruang Kering)',
    humidity: 'Kedap Udara & Tidak Lembap',
    capacityMax: '400 Kg (Rak Bin Tertutup)',
    storageRule: 'Wadah kedap udara agar aroma rempah terjaga dan yodium garam tidak berkurang akibat kelembapan.',
    description: 'Penyimpanan garam beryodium halus, ketumbar bubuk, merica, bumbu penyedap rasa terstandarisasi, dan rempah kering.',
    rotationMethod: 'FIFO',
    picDefault: 'Petugas Logistik Gudang Kering'
  },
  'RAK-KRG-N1': {
    id: 'RAK-KRG-N1',
    shortName: 'Gudang Non-Food - Rak N1',
    rackCode: 'Rak N1',
    commodityDetail: 'Sabun & Sanitasi Dapur',
    fullDisplay: 'Gudang Non-Food - Rak N1 (Sabun, Kebersihan & Sanitasi Dapur)',
    warehouseType: 'GUDANG_NONFOOD',
    zone: 'Zona Kimia & Sanitasi (Terpisah Fisik Mutlak)',
    temperature: '20°C - 25°C (Berventilasi Baik)',
    capacityMax: '40 Jerigen 5L',
    storageRule: 'STANDAR HACCP: Terpisah mutlak dari bahan makanan! Dilarang keras menyimpan bahan pangan apa pun di rak ini.',
    description: 'Penyimpanan cairan pembersih piring food-contact, deterjen pencucian tray SUS 304, sabun lantai, dan disinfektan dapur.',
    rotationMethod: 'FIFO',
    picDefault: 'Staf Sanitasi & Kebersihan'
  },
  'RAK-KRG-N2': {
    id: 'RAK-KRG-N2',
    shortName: 'Gudang Non-Food - Rak N2',
    rackCode: 'Rak N2',
    commodityDetail: 'Plastik, Tissue & Kemasan',
    fullDisplay: 'Gudang Non-Food - Rak N2 (Plastik, Kemasan & Tissue Dapur)',
    warehouseType: 'GUDANG_NONFOOD',
    zone: 'Zona Kemasan & Packaging Dapur',
    temperature: '20°C - 25°C (Bersih & Bebas Debu)',
    capacityMax: '30 Dus Kemasan / Kontainer',
    storageRule: 'Simpan kardus/pack dalam kondisi tertutup plastik pembungkus agar higienis sebelum didistribusikan ke dapur.',
    description: 'Penyimpanan kantong sampah medis/dapur, tissue serap minyak, sarung tangan plastik (hand gloves), dan mika kemasan.',
    rotationMethod: 'FIFO',
    picDefault: 'Staf Logistik Non-Food'
  },
  'BIN-CHL-C1': {
    id: 'BIN-CHL-C1',
    shortName: 'Chiller Dapur - Bin C1',
    rackCode: 'Chiller C1',
    commodityDetail: 'Daging Ayam & Protein Unggas',
    fullDisplay: 'Chiller Dapur - Bin C1 (Daging Ayam & Protein Unggas)',
    warehouseType: 'CHILLER',
    zone: 'Cold Storage Room - Chiller Protein Unggas',
    temperature: '2°C - 4°C (Wajib Cek Termometer 2x Sehari)',
    humidity: 'Kelembaban Terkontrol Chiller',
    capacityMax: '300 Kg (Rak Bin Stainless Steel SUS 304)',
    storageRule: 'Wadah stainless tertutup rapat. Beri label tanggal kedatangan. Konsumsi maksimal 24 - 48 jam.',
    description: 'Penyimpanan daging ayam broiler karkas bersih, paha fillet, dan potongan unggas segar harian sebelum diolah subuh hari.',
    rotationMethod: 'FEFO',
    picDefault: 'Chef Rahmat / PIC Chiller Dapur'
  },
  'BIN-FRZ-F2': {
    id: 'BIN-FRZ-F2',
    shortName: 'Freezer Dapur - Bin F2',
    rackCode: 'Freezer F2',
    commodityDetail: 'Daging Beku, Ikan Laut & Olahan',
    fullDisplay: 'Freezer Dapur - Bin F2 (Daging Beku, Ikan Laut & Olahan)',
    warehouseType: 'FREEZER',
    zone: 'Deep Freeze Storage Zone (-18°C)',
    temperature: '-18°C s/d -20°C (Pembekuan Sempurna)',
    humidity: 'Cold Chain Beku Tanpa Bunga Es Berlebih',
    capacityMax: '400 Kg (Deep Chest Freezer)',
    storageRule: 'Jaga rantai dingin (cold chain). Dilarang membekukan ulang bahan yang sudah dicairkan (thawing).',
    description: 'Penyimpanan daging sapi beku berstandar halal, ikan laut kembung/tongkol segar beku, dan protein cadangan beku.',
    rotationMethod: 'FEFO',
    picDefault: 'Chef Rahmat / PIC Cold Storage'
  },
  'RAK-BSH-V1': {
    id: 'RAK-BSH-V1',
    shortName: 'Gudang Basah - Rak V1',
    rackCode: 'Rak V1',
    commodityDetail: 'Sayuran Segar & Umbi Hijau',
    fullDisplay: 'Gudang Basah - Rak V1 (Sayuran Segar & Umbi Hijau)',
    warehouseType: 'GUDANG_BASAH',
    zone: 'Area Sortir Sayur & Ruang Sejuk Dapur',
    temperature: '8°C - 12°C (Sejuk Berventilasi)',
    humidity: 'Sirkulasi Udara Aktif Keranjang Berventilasi',
    capacityMax: '250 Kg (15 Keranjang Sayur)',
    storageRule: 'Gunakan keranjang plastik berlubang agar sayur tidak layu & membusuk. Pisahkan sayuran daun dan umbi.',
    description: 'Penyimpanan sayur sop harian, wortel brastagi/lokal, buncis, bayam, labu siam, dan kentang segar panenan petani Jeru & Poncokusumo.',
    rotationMethod: 'FEFO',
    picDefault: 'PIC Penerimaan Bahan Segar'
  },
  'RAK-BSH-F1': {
    id: 'RAK-BSH-F1',
    shortName: 'Gudang Basah - Rak B1',
    rackCode: 'Rak B1',
    commodityDetail: 'Buah Segar Pencuci Mulut',
    fullDisplay: 'Gudang Basah - Rak B1 (Buah Segar Pencuci Mulut)',
    warehouseType: 'GUDANG_BASAH',
    zone: 'Area Buah & Distribusi Menu Sehat',
    temperature: '12°C - 16°C (Sejuk Kering)',
    humidity: 'Cegah Kelembaban Berlebih',
    capacityMax: '200 Kg (10 Keranjang Buah)',
    storageRule: 'Jangan menumpuk buah lebih dari 2 lapis untuk mencegah memar fisik. Jauhkan dari buah yang terlalu matang.',
    description: 'Penyimpanan buah pisang mas lokal Malang, jeruk manis, semangka potong, dan melon segar pencuci mulut siswa.',
    rotationMethod: 'FEFO',
    picDefault: 'PIC Pemorsian Buah & Distribusi'
  },
  'RAK-BSH-T1': {
    id: 'RAK-BSH-T1',
    shortName: 'Area Persiapan - Rak Telur',
    rackCode: 'Rak T1',
    commodityDetail: 'Telur Ayam Ras Segar',
    fullDisplay: 'Area Persiapan - Rak Telur (Telur Ayam Ras Segar)',
    warehouseType: 'GUDANG_BASAH',
    zone: 'Area Persiapan - Rak Khusus Telur',
    temperature: '15°C - 20°C (Sejuk & Kering)',
    humidity: 'Bersih & Kering',
    capacityMax: '150 Kg (10 Peti / Egg Tray)',
    storageRule: 'Gunakan egg tray higienis dengan posisi bagian runcing telur di bawah. Bersihkan cangkang retak segera.',
    description: 'Penyimpanan telur ayam ras segar grade A, cangkang utuh cokelat bersih rata-rata 16 butir per kilogram.',
    rotationMethod: 'FIFO',
    picDefault: 'PIC Persiapan Telur & Protein'
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

  // 1. Cek Palet Tengah Gudang Kering
  if (
    l.includes('palet tengah') ||
    l.includes('plt-krg-t1') ||
    (l.includes('palet') && (l.includes('sak') || l.includes('tengah') || l.includes('curah')))
  ) {
    return STANDARD_STORAGE_RACKS['PLT-KRG-T1'];
  }

  // 2. Cek Rak Kering Lainnya
  if (l.includes('rak a1') || l.includes('sembako beras') || l.includes('karung pangan')) {
    return STANDARD_STORAGE_RACKS['RAK-KRG-A1'];
  }
  if (l.includes('rak a2') || l.includes('minyak') || l.includes('lemak') || l.includes('cairan pangan')) {
    return STANDARD_STORAGE_RACKS['RAK-KRG-A2'];
  }
  if (l.includes('rak a3') || l.includes('gula') || l.includes('tepung')) {
    return STANDARD_STORAGE_RACKS['RAK-KRG-A3'];
  }
  if (l.includes('rak a4') || l.includes('garam') || l.includes('bumbu') || l.includes('rempah')) {
    return STANDARD_STORAGE_RACKS['RAK-KRG-A4'];
  }

  // 3. Cek Non-Food
  if (l.includes('rak n1') || l.includes('sabun') || l.includes('sanitasi')) {
    return STANDARD_STORAGE_RACKS['RAK-KRG-N1'];
  }
  if (l.includes('rak n2') || l.includes('rak n3') || l.includes('plastik') || l.includes('tissue') || l.includes('kemasan') || l.includes('apd')) {
    return STANDARD_STORAGE_RACKS['RAK-KRG-N2'];
  }

  // 4. Cek Chiller & Freezer
  if (l.includes('bin c1') || l.includes('chiller c1') || (l.includes('chiller') && l.includes('ayam'))) {
    return STANDARD_STORAGE_RACKS['BIN-CHL-C1'];
  }
  if (l.includes('bin f2') || l.includes('freezer f2') || (l.includes('freezer') && (l.includes('ikan') || l.includes('daging')))) {
    return STANDARD_STORAGE_RACKS['BIN-FRZ-F2'];
  }

  // 5. Cek Gudang Basah
  if (l.includes('rak v1') || l.includes('sortir sayur') || l.includes('sayur')) {
    return STANDARD_STORAGE_RACKS['RAK-BSH-V1'];
  }
  if (l.includes('rak b1') || l.includes('buah')) {
    return STANDARD_STORAGE_RACKS['RAK-BSH-F1'];
  }
  if (l.includes('rak telur') || l.includes('telur')) {
    return STANDARD_STORAGE_RACKS['RAK-BSH-T1'];
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
