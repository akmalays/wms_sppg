/**
 * Standar Tunggal Kategori SPPG (Satuan Pelayanan Pemenuhan Gizi)
 * Menyeragamkan seluruh kategori barang di semua modul:
 * - Penerimaan Barang & Belanja (ReceivingModule)
 * - Persediaan & Kartu Stok (InventoryModule)
 * - Pengeluaran Harian & Laporan (DailyExpensesModule)
 * - Nota Pesanan & PO Supplier (NotaPesananModal)
 * - Master Item & Master Supplier
 */

/**
 * 3 Kategori Utama Pilar WMS SPPG
 */
export const MAIN_CATEGORIES = [
  'Bahan Basah',
  'Bahan Kering',
  'Bahan Peralatan',
] as const;

export type MainCategory = typeof MAIN_CATEGORIES[number];

/**
 * 6 Kategori Rinci Standar SPPG (Digunakan pada form input, stok opname, dan katalog barang)
 */
export const STANDARD_CATEGORIES = [
  'Bahan Basah',
  'Bahan Kering',
  'ATK & Administrasi',
  'Alat Kebersihan',
  'Perlengkapan & APD',
  'Operasional & Keperluan Lain',
] as const;

export type StandardCategory = typeof STANDARD_CATEGORIES[number];

/**
 * Pemetaan setiap kategori rinci ke Kategori Utama
 */
export const CATEGORY_HIERARCHY_MAP: Record<StandardCategory, MainCategory> = {
  'Bahan Basah': 'Bahan Basah',
  'Bahan Kering': 'Bahan Kering',
  'ATK & Administrasi': 'Bahan Peralatan',
  'Alat Kebersihan': 'Bahan Peralatan',
  'Perlengkapan & APD': 'Bahan Peralatan',
  'Operasional & Keperluan Lain': 'Bahan Peralatan',
};

/**
 * Subkategori Deskriptif untuk Referensi & Dokumen Pengadaan
 */
export const SUBCATEGORIES_MAP: Record<StandardCategory, readonly string[]> = {
  'Bahan Basah': [
    'Protein Hewani (Ayam, Daging, Ikan)',
    'Telur Ayam Ras',
    'Olahan Kedelai (Tahu, Tempe)',
    'Sayuran Segar (Bayam, Kangkung, Wortel, dll)',
    'Buah Segar (Pisang, Semangka, Pepaya, dll)',
  ],
  'Bahan Kering': [
    'Sembako & Beras',
    'Minyak & Lemak',
    'Gula & Pemanis',
    'Tepung-tepungan (Terigu, Tapioka, dll)',
    'Bumbu Dapur & Rempah',
    'Bahan Olahan Kering',
  ],
  'ATK & Administrasi': [
    'Kertas & Buku (HVS, Ekspedisi, dll)',
    'Alat Tulis (Pulpen, Spidol, Pensil)',
    'Arsip & Map (Ordner, Snelhecter)',
    'Tinta & Cetak',
    'Perlengkapan Kantor (Staples, Lakban)',
  ],
  'Alat Kebersihan': [
    'Sabun & Deterjen (Cuci Piring, Handsoap)',
    'Karbol & Disinfektan Lantai',
    'Alat Pembersih Fisik (Sapu, Pel, Pengki)',
    'Kain Lap & Spons (Microfiber, Kanebo, Busa)',
    'Plastik Sampah (Trash Bag Hitam)',
  ],
  'Perlengkapan & APD': [
    'Wadah & Kemasan (Kotak Makan Mika, Thinwall)',
    'Kantong Plastik / Kresek',
    'Alat Pelindung Diri (Masker, Sarung Tangan, Nurse Cap)',
    'Peralatan Masak Dapur (Celemek, Pisau, Talenan)',
  ],
  'Operasional & Keperluan Lain': [
    'Bahan Bakar & Gas (Tabung LPG 12kg/3kg)',
    'Air Minum & Galon',
    'Es Batu Kristal Konsumsi',
    'Utilitas (Listrik, Pemeliharaan)',
  ],
};

/**
 * Normalisasi cerdas kategori string apa pun (dari input user, database lama, atau import Excel)
 * menjadi salah satu dari 3 Kategori Utama ('Bahan Basah' | 'Bahan Kering' | 'Bahan Peralatan')
 */
export function normalizeToMainCategory(category?: string, itemName?: string): MainCategory {
  const c = (category || '').trim().toLowerCase();
  const n = (itemName || '').trim().toLowerCase();

  // 1. Cek Kategori Bahan Basah
  if (
    c.includes('basah') ||
    c.includes('protein') ||
    c.includes('sayur') ||
    c.includes('buah') ||
    c.includes('ayam') ||
    c.includes('daging') ||
    c.includes('telur') ||
    c.includes('ikan') ||
    c.includes('tahu') ||
    c.includes('tempe') ||
    c.includes('unggas') ||
    n.includes('ayam') ||
    n.includes('daging') ||
    n.includes('telur') ||
    n.includes('ikan') ||
    n.includes('sayur') ||
    n.includes('bayam') ||
    n.includes('kangkung') ||
    n.includes('wortel') ||
    n.includes('tahu') ||
    n.includes('tempe') ||
    n.includes('buah') ||
    n.includes('pisang') ||
    n.includes('semangka') ||
    n.includes('pepaya') ||
    n.includes('melon') ||
    n.includes('buncis') ||
    n.includes('labu')
  ) {
    return 'Bahan Basah';
  }

  // 2. Cek Kategori Bahan Kering
  if (
    c.includes('kering') ||
    c.includes('sembako') ||
    c.includes('beras') ||
    c.includes('minyak') ||
    c.includes('gula') ||
    c.includes('pemanis') ||
    c.includes('tepung') ||
    c.includes('bumbu') ||
    c.includes('rempah') ||
    c.includes('garam') ||
    c.includes('kecap') ||
    c.includes('saus') ||
    n.includes('beras') ||
    n.includes('minyak') ||
    n.includes('gula') ||
    n.includes('tepung') ||
    n.includes('garam') ||
    n.includes('kecap') ||
    n.includes('saus') ||
    n.includes('bawang') ||
    n.includes('merica') ||
    n.includes('racik') ||
    n.includes('mie') ||
    n.includes('bihun')
  ) {
    return 'Bahan Kering';
  }

  // 3. Sisanya Bahan Peralatan (Non-Food & Operasional)
  return 'Bahan Peralatan';
}

/**
 * Normalisasi ke salah satu dari 6 Kategori Rinci Standar
 */
export function normalizeToStandardCategory(category?: string, itemName?: string): StandardCategory {
  const c = (category || '').trim().toLowerCase();
  const n = (itemName || '').trim().toLowerCase();

  // ATK & Administrasi
  if (
    c.includes('atk') ||
    c.includes('administrasi') ||
    c.includes('kantor') ||
    c.includes('stok') ||
    c.includes('arsip') ||
    n.includes('hvs') ||
    n.includes('kertas') ||
    n.includes('pulpen') ||
    n.includes('spidol') ||
    n.includes('buku') ||
    n.includes('ordner') ||
    n.includes('map') ||
    n.includes('printer') ||
    n.includes('tinta') ||
    n.includes('staples') ||
    n.includes('lakban') ||
    n.includes('stempel') ||
    n.includes('thermal roll')
  ) {
    return 'ATK & Administrasi';
  }

  // Alat Kebersihan
  if (
    c.includes('cleaning') ||
    c.includes('kebersihan') ||
    c.includes('sanitasi') ||
    c.includes('deterjen') ||
    n.includes('sunlight') ||
    n.includes('karbol') ||
    n.includes('wipol') ||
    n.includes('sabun') ||
    n.includes('spons') ||
    n.includes('lap') ||
    n.includes('kanebo') ||
    n.includes('trash') ||
    n.includes('sampah') ||
    n.includes('sapu') ||
    n.includes('pel') ||
    n.includes('mop') ||
    n.includes('kamper')
  ) {
    return 'Alat Kebersihan';
  }

  // Perlengkapan & APD
  if (
    c.includes('apd') ||
    c.includes('packaging') ||
    c.includes('kemasan') ||
    c.includes('pelindung') ||
    c.includes('perlengkapan') ||
    c.includes('equipment') ||
    c.includes('peralatan') ||
    c.includes('dapur') ||
    c.includes('kitchen') ||
    c.includes('qc') ||
    c.includes('penerimaan') ||
    c.includes('warehouse') ||
    c.includes('persiapan') ||
    n.includes('plastik kresek') ||
    n.includes('bento') ||
    n.includes('thinwall') ||
    n.includes('sarung tangan') ||
    n.includes('masker') ||
    n.includes('nurse cap') ||
    n.includes('celemek') ||
    n.includes('apron') ||
    n.includes('pisau') ||
    n.includes('spatula') ||
    n.includes('talenan') ||
    n.includes('wajan') ||
    n.includes('panci') ||
    n.includes('timbangan') ||
    n.includes('termometer') ||
    n.includes('trolley')
  ) {
    return 'Perlengkapan & APD';
  }

  // Operasional & Keperluan Lain
  if (
    c.includes('operasional') ||
    c.includes('operational') ||
    c.includes('utilitas') ||
    c.includes('keperluan lain') ||
    n.includes('gas') ||
    n.includes('elpiji') ||
    n.includes('galon') ||
    n.includes('aqua') ||
    n.includes('es batu') ||
    n.includes('listrik') ||
    n.includes('token') ||
    n.includes('air galon')
  ) {
    return 'Operasional & Keperluan Lain';
  }

  // Bahan Basah
  if (
    c.includes('basah') ||
    c.includes('protein') ||
    c.includes('sayur') ||
    c.includes('buah') ||
    c.includes('ayam') ||
    c.includes('daging') ||
    c.includes('telur') ||
    c.includes('ikan') ||
    c.includes('tahu') ||
    c.includes('tempe') ||
    n.includes('ayam') ||
    n.includes('daging') ||
    n.includes('telur') ||
    n.includes('ikan') ||
    n.includes('sayur') ||
    n.includes('bayam') ||
    n.includes('kangkung') ||
    n.includes('wortel') ||
    n.includes('tahu') ||
    n.includes('tempe') ||
    n.includes('buah') ||
    n.includes('pisang') ||
    n.includes('semangka') ||
    n.includes('pepaya') ||
    n.includes('melon') ||
    n.includes('buncis') ||
    n.includes('labu')
  ) {
    return 'Bahan Basah';
  }

  // Default: Bahan Kering
  return 'Bahan Kering';
}

/**
 * Styling badge konsisten untuk 3 Kategori Utama
 */
export const MAIN_CATEGORY_BADGES: Record<
  MainCategory,
  { bg: string; text: string; border: string; dot: string }
> = {
  'Bahan Basah': {
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  'Bahan Kering': {
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  'Bahan Peralatan': {
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
};
