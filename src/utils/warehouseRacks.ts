// Konfigurasi rak gudang dan aturan barang-ke-rak, dipakai bersama oleh Cetak Form (Plakat Rak)
// dan halaman hasil pindai QR agar isi plakat dan hasil pindai selalu sama.

export interface RackConfig {
  id: string;
  name: string;
  warehouseType: 'GUDANG_KERING' | 'GUDANG_BASAH';
  warehouseName: string;
  zone: string;
  temperatureGuide: string;
  humidityGuide?: string;
  storageRule: string;
  rotationMethod: 'FIFO' | 'FEFO';
  capacityMax: string;
  picName: string;
  customNote?: string;
}

export const BASE_RACKS_CONFIG: RackConfig[] = [
  // --- GUDANG KERING (DRY STORAGE) ---
  // Pembagian berdasarkan bentuk barang supaya petugas langsung tahu tempatnya:
  // sak/karung -> Palet Tengah, utuh/padat -> Rak 1, bubuk/butiran -> Rak 2, cair/kental -> Rak 3,
  // dus belum dibuka -> Rak 4. ID rak lama dipertahankan agar QR plakat yang sudah dicetak tetap terbaca.
  {
    id: 'PLT-KRG-T1',
    name: 'Palet Tengah - Sembako Berat',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering',
    zone: 'Lantai tengah gudang kering, di atas palet',
    temperatureGuide: 'Suhu ruang 20°C - 25°C',
    humidityGuide: 'Kering, maks. 60% RH',
    storageRule: 'Selalu di atas palet, min. 15 cm dari lantai dan 5 cm dari dinding. Tumpuk sak bersilangan, maks. 8 tumpuk. Sisakan lorong agar sak lama mudah diambil lebih dulu.',
    rotationMethod: 'FIFO',
    capacityMax: '± 50-60 sak / karung',
    picName: '',
    customNote: 'Isi: beras sak, tepung sak (terigu, panir, bubbling), gula sak, minyak goreng dus/jerigen.',
  },
  {
    id: 'RAK-KRG-A1',
    name: 'Rak 1 - Garam, Rempah & Bumbu Dasar',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering',
    zone: 'Gudang Kering - Rak 1',
    temperatureGuide: 'Suhu ruang 20°C - 25°C',
    humidityGuide: 'Kering, wadah tertutup',
    storageRule: 'Bumbu yang sudah dibuka pindahkan ke toples/wadah tertutup dan beri label tanggal buka.',
    rotationMethod: 'FIFO',
    capacityMax: 'Ambalan bumbu',
    picName: '',
    customNote: 'Isi: garam, rempah utuh (kemiri, cengkeh, ketumbar utuh), terasi, petis.',
  },
  {
    id: 'RAK-KRG-A2',
    name: 'Rak 2 - Tepung, Gula & Bumbu Bubuk',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering',
    zone: 'Gudang Kering - Rak 2',
    temperatureGuide: 'Suhu ruang 20°C - 25°C',
    humidityGuide: 'Kering, maks. 55% RH (mudah menggumpal)',
    storageRule: 'Kemasan terbuka wajib diikat/masuk wadah tertutup. Jaga dari semut dan ceceran.',
    rotationMethod: 'FEFO',
    capacityMax: 'Ambalan bertingkat',
    picName: '',
    customNote: 'Isi: tepung kemasan kecil (beras, kanji, hunkwee), gula pasir & gula merah, royco/kaldu, lada & ketumbar bubuk, pala bubuk, baking soda.',
  },
  {
    id: 'RAK-KRG-A3',
    name: 'Rak 3 - Saus, Kecap & Mentega',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering',
    zone: 'Gudang Kering - Rak 3',
    temperatureGuide: 'Suhu ruang 20°C - 25°C, jauh dari sinar matahari',
    humidityGuide: 'Sirkulasi udara baik',
    storageRule: 'Botol berdiri dan tutup rapat. Botol besar/pouch di ambalan bawah. Cek tanggal kedaluwarsa, ambil yang paling dekat lebih dulu.',
    rotationMethod: 'FEFO',
    capacityMax: 'Ambalan botol & pouch',
    picName: '',
    customNote: 'Isi: kecap, saus tomat/sambal/teriyaki, kecap ikan, cuka, minyak wijen, mayones, mentega.',
  },
  {
    id: 'RAK-KRG-A4',
    name: 'Rak 4 - Stok Cadangan Dus',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering',
    zone: 'Gudang Kering - Rak 4',
    temperatureGuide: 'Suhu ruang 20°C - 25°C',
    humidityGuide: 'Kering',
    storageRule: 'Hanya dus yang belum dibuka. Tulis nama barang & tanggal datang di sisi dus. Buka dus di sini hanya untuk mengisi ulang Rak 1-3, dus lama lebih dulu.',
    rotationMethod: 'FIFO',
    capacityMax: 'Tumpukan dus',
    picName: '',
    customNote: 'Cadangan dari Rak 1, Rak 2, dan Rak 3. Stok di sistem tetap tercatat di rak asal barangnya.',
  },
  {
    id: 'RAK-KRG-N1',
    name: 'Rak N1 - Non-Food: Sabun & Sanitasi Dapur',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering & Non-Food',
    zone: 'Zona Kimia & Sanitasi (Terpisah Fisik)',
    temperatureGuide: '20°C - 25°C (Berventilasi Baik)',
    storageRule: 'STANDAR HACCP: Terpisah mutlak dari bahan makanan! Dilarang keras menyimpan bahan pangan di rak ini.',
    rotationMethod: 'FIFO',
    capacityMax: '40 Jerigen 5L',
    picName: 'Staf Sanitasi & Kebersihan',
    customNote: 'Penyimpanan khusus cairan pembersih, deterjen & disinfektan food contact.',
  },
  {
    id: 'RAK-KRG-N2',
    name: 'Rak N2 - Non-Food: Plastik, Tissue & Kemasan',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering & Non-Food',
    zone: 'Zona Kemasan & Packaging Dapur',
    temperatureGuide: '20°C - 25°C (Bersih & Bebas Debu)',
    storageRule: 'Simpan kardus/pack dalam kondisi tertutup plastik pembungkus agar higienis sebelum didistribusikan ke dapur.',
    rotationMethod: 'FIFO',
    capacityMax: '30 Dus Kemasan / Kontainer',
    picName: 'Staf Logistik Non-Food',
    customNote: 'Penyimpanan kantong sampah, sarung tangan & tissue dapur.',
  },

  // --- GUDANG BASAH & COLD STORAGE ---
  {
    id: 'BIN-CHL-C1',
    name: 'Chiller C1 - Daging Ayam & Protein Unggas',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah & Dingin (Cold Storage)',
    zone: 'Cold Storage Room - Chiller Protein Unggas',
    temperatureGuide: '2°C - 4°C (Wajib Cek Termometer 2x Sehari)',
    humidityGuide: 'Kelembaban Terkontrol Chiller',
    storageRule: 'Wadah stainless tertutup rapat. Beri label tanggal kedatangan. Konsumsi maksimal 24 - 48 jam.',
    rotationMethod: 'FEFO',
    capacityMax: '300 Kg (Rak Bin Stainless Steel SUS 304)',
    picName: '',
    customNote: 'Pastikan pintu chiller tertutup rapat setelah pengambilan bahan.',
  },
  {
    id: 'BIN-FRZ-F2',
    name: 'Freezer F2 - Daging Beku, Ikan Laut & Olahan',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah & Dingin (Cold Storage)',
    zone: 'Deep Freeze Storage Zone (-18°C)',
    temperatureGuide: '-18°C s/d -20°C (Pembekuan Sempurna)',
    humidityGuide: 'Cold Chain Beku Tanpa Bunga Es Berlebih',
    storageRule: 'Jaga rantai dingin (cold chain). Dilarang membekukan ulang bahan yang sudah dicairkan (thawing).',
    rotationMethod: 'FEFO',
    capacityMax: '400 Kg (Deep Chest Freezer)',
    picName: '',
    customNote: 'Defrost berkala jika bunga es melebihi ketebalan 5 mm.',
  },
  {
    id: 'RAK-BSH-V1',
    name: 'Rak V1 - Sayuran Segar & Umbi Hijau',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah & Dingin (Sayur Segar)',
    zone: 'Area Sortir Sayur & Ruang Sejuk Dapur',
    temperatureGuide: '8°C - 12°C (Sejuk Berventilasi)',
    humidityGuide: 'Sirkulasi Udara Aktif Keranjang Berventilasi',
    storageRule: 'Gunakan keranjang plastik berlubang agar sayur tidak layu & membusuk. Pisahkan sayuran daun dan umbi.',
    rotationMethod: 'FEFO',
    capacityMax: '250 Kg (15 Keranjang Sayur)',
    picName: 'PIC Penerimaan Bahan Segar',
    customNote: 'Penyortiran sayur dilakukan segera setelah serah terima supplier.',
  },
  {
    id: 'RAK-BSH-F1',
    name: 'Rak B1 - Buah Segar Pencuci Mulut',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah & Dingin (Buah Segar)',
    zone: 'Area Buah & Distribusi Menu Sehat',
    temperatureGuide: '12°C - 16°C (Sejuk Kering)',
    humidityGuide: 'Cegah Kelembaban Berlebih',
    storageRule: 'Jangan menumpuk buah lebih dari 2 lapis untuk mencegah memar fisik. Jauhkan dari buah yang terlalu matang.',
    rotationMethod: 'FEFO',
    capacityMax: '200 Kg (10 Keranjang Buah)',
    picName: 'PIC Pemorsian Buah & Distribusi',
    customNote: 'Periksa kematangan sebelum didistribusikan ke sekolah.',
  },
  {
    id: 'RAK-BSH-T1',
    name: 'Rak T1 - Telur Ayam Ras Segar',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah & Dingin (Protein Harian)',
    zone: 'Area Persiapan - Rak Khusus Telur',
    temperatureGuide: '15°C - 20°C (Sejuk & Kering)',
    humidityGuide: 'Bersih & Kering',
    storageRule: 'Gunakan egg tray higienis dengan posisi bagian runcing telur di bawah. Bersihkan cangkang retak segera.',
    rotationMethod: 'FIFO',
    capacityMax: '150 Kg (10 Peti / Egg Tray)',
    picName: 'PIC Persiapan Telur & Protein',
    customNote: 'Uji apung/kualitas acak pada setiap pengiriman baru.',
  },
];

/** Rak untuk lokasi yang tidak cocok dengan rak standar, dibentuk dari teks lokasinya. */
export function dynamicRackId(location: string): string {
  return `RAK-DYN-${location.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 14)}`;
}

export function matchItemToRackId(
  loc: string,
  cat: string,
  name: string,
  id: string,
  customRacks: { id: string; name: string }[] = []
): string {
  const l = (loc || '').toLowerCase();
  const c = (cat || '').toLowerCase();
  const n = (name || '').toLowerCase();
  const upperId = (id || '').toUpperCase();

  // Check explicit rack ID match in location
  for (const base of BASE_RACKS_CONFIG) {
    if (l.includes(base.id.toLowerCase())) return base.id;
  }
  for (const cr of customRacks) {
    if (l.includes(cr.id.toLowerCase()) || l.includes(cr.name.toLowerCase())) return cr.id;
  }

  if (
    l.includes('palet tengah') ||
    l.includes('plt-krg-t1') ||
    (l.includes('palet') && (l.includes('sak') || l.includes('tengah') || l.includes('curah')))
  ) {
    return 'PLT-KRG-T1';
  }

  // Lokasi baru "Rak 1".."Rak 4"; "Rak A1".."A4" lama sengaja tidak dipakai lagi (isinya sudah berubah)
  const rakNo = l.match(/\brak\s*([1-4])\b/);
  if (rakNo) return `RAK-KRG-A${rakNo[1]}`;

  const isDryFood = upperId.startsWith('ITM-KRG-') || c.includes('kering') || c.includes('sembako') || c.includes('bumbu');
  if (isDryFood || /\brak a[1-4]\b/.test(l)) {
    const suggested = suggestDryRackId(n);
    if (suggested) return suggested;
  }

  if (l.includes('rak n1') || upperId.startsWith('ITM-NFD-001') || n.includes('sabun') || c.includes('cleaning')) return 'RAK-KRG-N1';
  if (
    l.includes('rak n2') ||
    l.includes('rak n3') ||
    l.includes('apd') ||
    upperId.startsWith('ITM-NFD-') ||
    n.includes('plastik') ||
    n.includes('tissue') ||
    n.includes('sarung tangan')
  )
    return 'RAK-KRG-N2';

  if (
    upperId.startsWith('ITM-CHL-') ||
    l.includes('bin c1') ||
    l.includes('chiller') ||
    n.includes('ayam') ||
    (c.includes('protein') && !n.includes('ikan') && !n.includes('telur'))
  )
    return 'BIN-CHL-C1';
  if (
    upperId.startsWith('ITM-FRZ-') ||
    l.includes('bin f2') ||
    l.includes('freezer') ||
    n.includes('ikan') ||
    n.includes('daging sapi')
  )
    return 'BIN-FRZ-F2';
  if (
    (upperId.startsWith('ITM-BSH-') && (c.includes('sayur') || n.includes('sayur'))) ||
    l.includes('sortir sayur') ||
    c.includes('sayur') ||
    n.includes('bayam') ||
    n.includes('wortel')
  )
    return 'RAK-BSH-V1';
  if (
    (upperId.startsWith('ITM-BSH-') && (c.includes('buah') || n.includes('buah'))) ||
    l.includes('buah') ||
    c.includes('buah') ||
    n.includes('pisang')
  )
    return 'RAK-BSH-F1';
  if (
    (upperId.startsWith('ITM-BSH-') && n.includes('telur')) ||
    l.includes('telur') ||
    n.includes('telur')
  )
    return 'RAK-BSH-T1';

  if (upperId.startsWith('ITM-KRG-')) {
    return 'RAK-KRG-A1';
  }
  if (upperId.startsWith('ITM-BSH-')) {
    return 'RAK-BSH-V1';
  }

  return '';
}

/** Rak gudang kering yang disarankan dari nama barang, mengikuti aturan bentuk barang. */
export function suggestDryRackId(itemName: string): string {
  const n = (itemName || '').toLowerCase();
  if (
    /\b(sak|karung|jerigen)\b/.test(n) ||
    (n.includes('beras') && !n.includes('tepung')) ||
    n.includes('minyak goreng')
  ) {
    return 'PLT-KRG-T1';
  }
  if (/kecap|saus|saos|sauce|sambal|cuka|minyak wijen|mentega|margarin|blue band|mayon|teriyaki/.test(n)) {
    return 'RAK-KRG-A3';
  }
  if (/tepung|hunkwee|maizena|kanji|gula pasir|gula merah|\bgula\b|royco|kaldu|masako|penyedap|bubuk|baking|soda|lada|merica|ladaku|vetsin|micin/.test(n)) {
    return 'RAK-KRG-A2';
  }
  if (/garam|terasi|petis|kemiri|cengkeh|utuh|rempah|bumbu|kunyit|lengkuas|asam|daun salam|kayu manis|pekak/.test(n)) {
    return 'RAK-KRG-A1';
  }
  return '';
}

/** Teks lokasi standar per rak gudang kering, disimpan di Master Barang. */
export const DRY_RACK_LOCATION: Record<string, string> = {
  'PLT-KRG-T1': 'Gudang Kering - Palet Tengah (Sembako Berat)',
  'RAK-KRG-A1': 'Gudang Kering - Rak 1 (Garam, Rempah & Bumbu Dasar)',
  'RAK-KRG-A2': 'Gudang Kering - Rak 2 (Tepung, Gula & Bumbu Bubuk)',
  'RAK-KRG-A3': 'Gudang Kering - Rak 3 (Saus, Kecap & Mentega)',
  'RAK-KRG-A4': 'Gudang Kering - Rak 4 (Stok Cadangan Dus)',
};

/** Lokasi rak kering yang disarankan untuk barang baru, atau undefined bila nama tidak dikenali. */
export function suggestDryLocation(itemName: string): string | undefined {
  const rackId = suggestDryRackId(itemName);
  return rackId ? DRY_RACK_LOCATION[rackId] : undefined;
}
