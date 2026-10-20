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
  /** Rak cadangan berisi dus dari rak lain; plakat tidak menampilkan daftar barang tetap. */
  isReserve?: boolean;
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
    customNote: 'Isi: tepung kemasan kecil (beras, kanji, hunkwee), gula pasir & gula merah, royco/kaldu, lada & ketumbar bubuk, pala bubuk, baking soda. Sisa kemasan terbuka dari dapur disimpan di Palet Sisa (Gudang Basah).',
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
    customNote: 'Isi: kecap, saus tomat/sambal/teriyaki, kecap ikan, cuka, minyak wijen, mayones, mentega. Sisa kemasan terbuka dari dapur disimpan di Palet Sisa (Gudang Basah).',
  },
  {
    id: 'RAK-KRG-A4',
    name: 'Rak 4 - Stok Cadangan Dus',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering',
    zone: 'Gudang Kering - Rak 4',
    temperatureGuide: 'Suhu ruang 20°C - 25°C',
    humidityGuide: 'Kering',
    storageRule: 'Hanya dus yang belum dibuka. Tulis nama barang, isi per dus, dan tanggal datang di sisi dus. Dus lama ditaruh di depan dan dibuka lebih dulu.',
    rotationMethod: 'FIFO',
    capacityMax: 'Tumpukan dus',
    picName: '',
    customNote: 'Stok di aplikasi tetap tercatat di rak asal barangnya. Saat stok opname, dus di rak ini ikut dihitung.',
    isReserve: true,
  },
  {
    id: 'RAK-KRG-N1',
    name: 'Rak N1 - Non-Food: Sabun & Sanitasi',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Non-Food',
    zone: 'Gudang Non-Food - Rak N1',
    temperatureGuide: 'Suhu ruang, berventilasi baik',
    humidityGuide: 'Kering',
    storageRule: 'Hanya sabun, pembersih, dan disinfektan. Jauhkan dari bahan makanan, kemasan makanan, dan APD. Jeriken ditutup rapat, cairan berat di ambalan paling bawah.',
    rotationMethod: 'FIFO',
    capacityMax: 'Ambalan jeriken & botol',
    picName: '',
    customNote: 'Isi: sabun cuci piring, sabun cuci ompreng, pembersih lantai, disinfektan. Jeriken bocor dipindah ke wadah tertutup dan tumpahannya langsung dilap.',
  },
  {
    id: 'RAK-KRG-N2',
    name: 'Rak N2 - Non-Food: Plastik, Tissue & Kemasan',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Non-Food',
    zone: 'Gudang Non-Food - Rak N2',
    temperatureGuide: 'Suhu ruang, bersih dari debu',
    humidityGuide: 'Kering',
    storageRule: 'Simpan dalam dus atau bungkus aslinya yang tertutup. Ambil secukupnya untuk dibawa ke dapur, lalu tutup kembali kemasannya.',
    rotationMethod: 'FIFO',
    capacityMax: 'Ambalan dus & pack',
    picName: '',
    customNote: 'Isi: plastik wrap, plastik kemasan, thinwall, kantong sampah, tisu dapur & tisu tangan. Kantong sampah ditaruh di ambalan terpisah dari kemasan makanan.',
  },
  {
    id: 'RAK-KRG-N3',
    name: 'Rak N3 - Non-Food: APD & Masker',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Non-Food',
    zone: 'Gudang Non-Food - Rak N3',
    temperatureGuide: 'Suhu ruang, bersih dari debu',
    humidityGuide: 'Kering',
    storageRule: 'Simpan dalam box tertutup rapat yang bersih dan kering. Ambil secukupnya untuk dipakai hari itu. APD yang basah atau kotor tidak boleh dikembalikan ke box.',
    rotationMethod: 'FIFO',
    capacityMax: 'Box APD tertutup',
    picName: '',
    customNote: 'Isi: masker medis 3 lapis, penutup kepala (hairnet), celemek, sarung tangan plastik/food grade. Cara memakai APD ada di SOP/DPR/01.',
  },

  // --- GUDANG BASAH & DAPUR: 3 freezer, 1 chiller, 1 palet sisa bahan ---
  // Freezer gudang = stok utama dari supplier; freezer dapur = yang akan segera dimasak / protein lain.
  // ID BIN-FRZ-F2 & BIN-CHL-C1 dipertahankan agar QR plakat lama tetap terbaca.
  {
    id: 'BIN-FRZ-F2',
    name: 'Freezer 1 (Gudang Basah) - Stok Ayam & Protein Beku',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah',
    zone: 'Gudang Basah - Freezer 1',
    temperatureGuide: '-18°C atau lebih dingin (cek termometer pagi & sore)',
    humidityGuide: 'Bunga es maks. 5 mm, defrost berkala',
    storageRule: 'Stok utama dari supplier. Beri label tanggal datang, yang lama di depan/atas. Pindahkan ke Freezer 2 (Dapur) sesuai kebutuhan masak besok.',
    rotationMethod: 'FIFO',
    capacityMax: 'Sesuai kapasitas freezer',
    picName: '',
    customNote: 'Isi: ayam (karkas, fillet, potongan) yang baru datang, serta daging/ikan beku bila ada.',
  },
  {
    id: 'BIN-FRZ-D1',
    name: 'Freezer 2 (Dapur) - Ayam Siap Masak',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Dapur',
    zone: 'Dapur - Freezer 2',
    temperatureGuide: '-18°C atau lebih dingin',
    humidityGuide: 'Tutup rapat, jangan sering dibuka',
    storageRule: 'Hanya ayam yang sudah dibagi per kantong sesuai menu besok (H-1). Label: menu + tanggal. Cairkan di Chiller, bukan di suhu ruang. Ayam yang sudah cair tidak boleh dibekukan lagi.',
    rotationMethod: 'FIFO',
    capacityMax: 'Sesuai kapasitas freezer',
    picName: '',
    customNote: 'Diisi dari Freezer 1 (Gudang Basah) sesuai rencana menu.',
  },
  {
    id: 'BIN-FRZ-D2',
    name: 'Freezer 3 (Dapur) - Protein & Olahan Beku Lain',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Dapur',
    zone: 'Dapur - Freezer 3',
    temperatureGuide: '-18°C atau lebih dingin',
    humidityGuide: 'Tutup rapat, jangan sering dibuka',
    storageRule: 'Pisahkan dari ayam. Simpan per jenis dalam wadah/kantong tertutup berlabel nama + tanggal.',
    rotationMethod: 'FIFO',
    capacityMax: 'Sesuai kapasitas freezer',
    picName: '',
    customNote: 'Isi: ikan, daging sapi, dan olahan beku (nugget, sosis, bakso, dll).',
  },
  {
    id: 'BIN-CHL-C1',
    name: 'Chiller (Gudang Basah) - Buah, Sayur & Telur',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah',
    zone: 'Gudang Basah - Chiller',
    temperatureGuide: '1°C - 5°C (cek termometer pagi & sore)',
    humidityGuide: 'Jangan terlalu penuh agar udara dingin mengalir',
    storageRule: 'Atas: telur & bahan siap pakai. Tengah: buah & sayur. Bawah: ayam yang sedang dicairkan dalam wadah tertutup agar tidak menetes.',
    rotationMethod: 'FEFO',
    capacityMax: 'Sesuai kapasitas chiller',
    picName: '',
    customNote: 'Isi: sisa buah & sayur, telur, dan ayam yang dicairkan untuk dimasak besok.',
  },
  {
    id: 'PLT-BSH-S1',
    name: 'Palet Sisa (Gudang Basah) - Sisa Bahan Kering dari Dapur',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah',
    zone: 'Gudang Basah - Palet Sisa',
    temperatureGuide: 'Suhu ruang, kering',
    humidityGuide: 'Jauh dari lantai basah & cipratan air',
    storageRule: 'Semua sisa masuk kontainer/box tertutup di atas palet, tidak langsung di lantai. Label tiap kemasan: nama + tanggal buka. Sisa di sini dipakai lebih dulu sebelum mengambil kemasan baru dari Gudang Kering.',
    rotationMethod: 'FIFO',
    capacityMax: 'Sesuai jumlah box di palet',
    picName: '',
    customNote: 'Isi: sisa royco, saus, kecap, tepung, gula, bumbu bubuk yang sudah dibuka dari dapur. Saus/sambal yang di kemasannya tertulis "simpan di lemari es setelah dibuka" sebaiknya ke Chiller.',
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

  // Palet sisa di gudang basah harus dicek sebelum aturan palet gudang kering
  if (l.includes('palet sisa') || l.includes('plt-bsh-s1')) return 'PLT-BSH-S1';

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

  // Cek Non-Food (3 Kategori: Sabun dan Sanitasi, Plastik Tissue dan Kemasan, APD dan Masker)
  // Kategori 3: APD & Masker
  if (
    l.includes('rak n3') ||
    l.includes('apd') ||
    n.includes('masker') ||
    n.includes('hairnet') ||
    n.includes('nurse cap') ||
    n.includes('penutup kepala') ||
    n.includes('celemek') ||
    n.includes('apron') ||
    n.includes('sarung tangan') ||
    n.includes('face shield') ||
    c.includes('apd') ||
    c.includes('pelindung')
  ) {
    return 'RAK-KRG-N3';
  }

  // Kategori 1: Sabun & Sanitasi
  if (
    l.includes('rak n1') ||
    upperId.startsWith('ITM-NFD-001') ||
    n.includes('sabun') ||
    n.includes('sanitasi') ||
    n.includes('deterjen') ||
    n.includes('pembersih') ||
    n.includes('karbol') ||
    n.includes('disinfektan') ||
    n.includes('rinso') ||
    n.includes('sunlight') ||
    c.includes('cleaning') ||
    c.includes('sanitasi')
  ) {
    return 'RAK-KRG-N1';
  }

  // Kategori 2: Plastik, Tissue & Kemasan
  if (
    l.includes('rak n2') ||
    upperId.startsWith('ITM-NFD-') ||
    n.includes('plastik') ||
    n.includes('tissue') ||
    n.includes('tisu') ||
    n.includes('kemasan') ||
    n.includes('packaging') ||
    n.includes('wrap') ||
    n.includes('mika') ||
    n.includes('thinwall') ||
    n.includes('kresek') ||
    n.includes('kantong sampah') ||
    c.includes('packaging') ||
    c.includes('kemasan')
  ) {
    return 'RAK-KRG-N2';
  }

  // Gudang basah: freezer untuk ayam/protein beku, chiller untuk buah, sayur, telur & sisa bahan terbuka
  if (l.includes('freezer 2') || l.includes('bin-frz-d1')) return 'BIN-FRZ-D1';
  if (l.includes('freezer 3') || l.includes('bin-frz-d2')) return 'BIN-FRZ-D2';
  if (l.includes('freezer') || l.includes('bin f2')) return 'BIN-FRZ-F2';
  if (l.includes('chiller') || l.includes('bin c1')) return 'BIN-CHL-C1';
  // "telur ayam" bukan ayam: telur disimpan di chiller
  if (n.includes('telur')) return 'BIN-CHL-C1';
  // Ikan, daging sapi & olahan beku di Freezer 3 (Dapur); ayam di Freezer 1 (Gudang Basah)
  if (/ikan|daging|sapi|nugget|sosis|bakso|seafood|udang beku|olahan beku/.test(n)) return 'BIN-FRZ-D2';
  if (
    upperId.startsWith('ITM-FRZ-') ||
    n.includes('ayam') ||
    n.includes('ikan') ||
    n.includes('daging') ||
    (c.includes('protein') && !n.includes('telur') && !n.includes('tahu') && !n.includes('tempe'))
  )
    return 'BIN-FRZ-F2';
  if (
    upperId.startsWith('ITM-CHL-') ||
    upperId.startsWith('ITM-BSH-') ||
    c.includes('sayur') ||
    c.includes('buah') ||
    c.includes('basah') ||
    n.includes('telur') ||
    l.includes('sayur') ||
    l.includes('buah') ||
    l.includes('telur')
  )
    return 'BIN-CHL-C1';

  if (upperId.startsWith('ITM-KRG-')) {
    return 'RAK-KRG-A1';
  }
  if (upperId.startsWith('ITM-BSH-')) {
    return 'BIN-CHL-C1';
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
