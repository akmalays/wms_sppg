import React from 'react';

// Isi SOP Gudang per tempat simpan. Dipakai dokumen cetak SOP Gudang dan halaman Panduan Area
// (dibuka dari QR papan nama rak tanpa login), jadi file ini tidak boleh memuat data gudang.

export type SopPlace = 'DRY' | 'NONFOOD' | 'CHILLER' | 'FREEZER' | 'LEFTOVER' | 'CRATE' | 'APD';
export const SOP_PLACE_OPTIONS: { value: SopPlace | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Semua tempat (1 SOP per halaman)' },
  { value: 'DRY', label: 'Gudang Kering' },
  { value: 'NONFOOD', label: 'Gudang Non-Food (Sanitasi, Kemasan, APD & P3K)' },
  { value: 'CHILLER', label: 'Chiller' },
  { value: 'FREEZER', label: 'Freezer' },
  { value: 'LEFTOVER', label: 'Palet Sisa Bahan' },
  { value: 'CRATE', label: 'Area Krat & Wadah Retur (Roti & Buah)' },
  { value: 'APD', label: 'Pemakaian APD (dapur)' },
];

export interface LayoutRow {
  place: string;
  rackId?: string; // isi diambil dari Master Barang bila ada
  fallback: string;
  rules: React.ReactNode;
}

export interface SopDefinition {
  docNo: string;
  title: string;
  location: string;
  standard: string;
  purpose: string;
  layoutTitle: string;
  layout: LayoutRow[];
  notAllowed: React.ReactNode[];
  steps: { title: string; items: React.ReactNode[] }[];
  routine: { when: string; tasks: string }[];
  problems: { issue: string; action: React.ReactNode }[];
  shelfLife: { item: string; limit: string; discard: string }[];
}

export const SOPS: Record<Exclude<SopPlace, 'APD'>, SopDefinition> = {
  DRY: {
    docNo: 'SOP/GDG/01',
    title: 'Penyimpanan Bahan di Gudang Kering',
    location: 'Gudang Kering: Palet Tengah, Rak 1 – Rak 4',
    standard: 'Suhu ruang 20–25°C, kering (kelembapan maks. 60%), bebas hama',
    purpose: 'Menjaga bahan kering tetap layak pakai, mudah ditemukan, dan dipakai sesuai urutan datang.',
    layoutTitle: 'Tata letak: simpan menurut bentuk barang',
    layout: [
      {
        place: 'Palet Tengah: Sembako Berat',
        rackId: 'PLT-KRG-T1',
        fallback: 'Beras sak, tepung sak, gula sak, minyak goreng',
        rules: 'Masih dalam sak/karung atau dus/jerigen besar. Susun bersilangan, maks. 8 tumpuk.',
      },
      {
        place: 'Rak 1: Garam, Rempah & Bumbu Dasar',
        rackId: 'RAK-KRG-A1',
        fallback: 'Garam, kemiri, cengkeh, terasi, petis',
        rules: 'Bentuk utuh/padat. Kemasan terbuka masuk toples tertutup berlabel.',
      },
      {
        place: 'Rak 2: Tepung, Gula & Bumbu Bubuk',
        rackId: 'RAK-KRG-A2',
        fallback: 'Tepung kemasan kecil, gula, royco, lada bubuk',
        rules: 'Bentuk bubuk/butiran. Mudah menggumpal & mengundang semut, kemasan harus rapat.',
      },
      {
        place: 'Rak 3: Saus, Kecap & Mentega',
        rackId: 'RAK-KRG-A3',
        fallback: 'Kecap, saus, cuka, minyak wijen, mayones, mentega',
        rules: 'Bentuk cair/kental. Botol berdiri, tutup rapat, botol besar di ambalan bawah.',
      },
      {
        place: 'Rak 4: Stok Cadangan Dus',
        fallback: 'Dus tertutup cadangan untuk Rak 1–3',
        rules: 'Hanya dus yang belum dibuka. Tulis nama + tanggal datang di sisi dus.',
      },
    ],
    notAllowed: [
      'Bahan basah, ayam, sayur, buah, dan bahan beku (→ Chiller/Freezer).',
      'Sisa bahan terbuka dari dapur (→ Palet Sisa Bahan).',
      'Sabun, pembersih, dan bahan kimia (simpan di Gudang Non-Food, Rak N1).',
      'Bahan apa pun langsung di lantai.',
    ],
    steps: [
      {
        title: 'Memasukkan bahan',
        items: [
          'Periksa kemasan: utuh, kering, tidak berkutu, dan tanggal kedaluwarsa masih jauh.',
          'Tulis tanggal datang di kemasan atau sisi dus.',
          <>Simpan sesuai bentuknya: <b>sak → Palet Tengah</b>, <b>utuh/padat → Rak 1</b>, <b>bubuk → Rak 2</b>, <b>cair → Rak 3</b>, <b>dus cadangan → Rak 4</b>.</>,
          <>Barang baru diletakkan <b>di belakang atau di bawah</b>, barang lama di depan atau di atas.</>,
          'Catat penerimaan di aplikasi pada hari yang sama.',
        ],
      },
      {
        title: 'Mengambil bahan',
        items: [
          'Ambil hanya dengan Bon Dapur yang sudah diisi.',
          <>Ambil yang <b>paling lama datang</b> atau yang <b>kedaluwarsanya paling dekat</b>.</>,
          <>Cek Palet Sisa Bahan lebih dulu: <b>sisa terbuka dipakai sebelum membuka kemasan baru</b>.</>,
          'Rak 1–3 hampir kosong → isi ulang dari Rak 4, buka dus yang paling lama.',
          'Sak diambil dari tumpukan paling atas, jangan ditarik dari bawah.',
          'Catat pengeluaran di aplikasi pada hari yang sama.',
        ],
      },
    ],
    routine: [
      { when: 'Harian', tasks: 'Sapu ceceran, pintu selalu tertutup, cek tanda hama (kotoran tikus, kutu, semut).' },
      { when: 'Mingguan', tasks: 'Lap rak, cek tanggal kedaluwarsa (tandai yang < 1 bulan agar dipakai dulu), rapikan susunan.' },
      { when: 'Bulanan', tasks: 'Hitung fisik stok (stock opname) dan cocokkan dengan aplikasi.' },
    ],
    problems: [
      { issue: 'Kemasan sobek, basah, atau berkutu', action: 'Pisahkan, periksa isinya. Bila rusak, buang dan catat di Rekap Limbah.' },
      { issue: 'Ada tanda tikus/kecoa/semut', action: 'Lapor ke Asisten Lapangan, pisahkan bahan yang terkena, bersihkan area, pasang perangkap.' },
      { issue: 'Atap bocor atau dinding lembap', action: 'Pindahkan bahan dari area basah, lapor ke Asisten Lapangan.' },
    ],
    shelfLife: [
      { item: 'Beras', limit: 'Ikuti kemasan, FIFO', discard: 'Berkutu, apek, berjamur, basah' },
      { item: 'Tepung & gula (kemasan utuh)', limit: 'Sampai tanggal kedaluwarsa', discard: 'Menggumpal basah, berkutu, berbau apek' },
      { item: 'Royco, lada & bumbu bubuk', limit: 'Sampai tanggal kedaluwarsa', discard: 'Menggumpal keras, berubah warna/aroma' },
      { item: 'Garam, rempah utuh, terasi, petis', limit: 'Sampai tanggal kedaluwarsa', discard: 'Berjamur, basah, berbau tidak wajar' },
      { item: 'Saus, kecap, mayones (belum dibuka)', limit: 'Sampai tanggal kedaluwarsa', discard: 'Kemasan menggembung, bocor, berkarat' },
      { item: 'Minyak goreng', limit: 'Ikuti kemasan', discard: 'Tengik, keruh, kemasan bocor' },
    ],
  },

  CHILLER: {
    docNo: 'SOP/GDG/03',
    title: 'Penyimpanan Bahan di Chiller',
    location: 'Gudang Basah: Chiller',
    standard: 'Suhu 1–5°C, dicek dan dicatat pagi & sore',
    purpose: 'Menjaga buah, sayur, telur, dan ayam yang dicairkan tetap segar dan aman, tanpa saling mencemari.',
    layoutTitle: 'Tata letak: dari atas ke bawah',
    layout: [
      {
        place: 'Rak atas',
        fallback: 'Telur (dalam tray), bahan siap pakai, saus yang wajib disimpan dingin setelah dibuka',
        rules: 'Bahan yang tidak dimasak lagi atau mudah tercemar ada di atas.',
      },
      {
        place: 'Rak tengah',
        fallback: 'Buah dan sayur',
        rules: 'Keranjang berlubang/wadah. Buah potong dalam wadah tertutup berlabel.',
      },
      {
        place: 'Rak paling bawah',
        fallback: 'Ayam yang sedang dicairkan',
        rules: 'Wajib dalam wadah tertutup agar cairannya tidak menetes ke bahan lain.',
      },
    ],
    notAllowed: [
      'Makanan yang masih panas (dinginkan dulu, maks. 2 jam di suhu ruang).',
      'Bahan tanpa tutup atau tanpa label.',
      'Ayam di rak atas atau tengah.',
      'Tepung, royco, dan bahan kering lain (→ Gudang Kering / Palet Sisa Bahan).',
      'Barang non-food.',
    ],
    steps: [
      {
        title: 'Memasukkan bahan',
        items: [
          'Pastikan termometer chiller menunjukkan 5°C atau lebih dingin.',
          <><b>Sayur:</b> buang daun rusak, <b>jangan dicuci</b>, masukkan ke keranjang berlubang di rak tengah.</>,
          <><b>Telur:</b> jangan dicuci, simpan di tray pada rak atas.</>,
          <><b>Buah potong & bahan terbuka:</b> wadah tertutup, label nama + tanggal.</>,
          <><b>Ayam yang akan dicairkan:</b> ambil dari freezer pada H-1, masukkan ke wadah tertutup di rak paling bawah, label "dicairkan" + tanggal.</>,
          <>Isi chiller <b>maksimal ±80%</b>. Jangan menutupi kipas atau lubang udara.</>,
        ],
      },
      {
        title: 'Mengambil bahan',
        items: [
          'Buka pintu seperlunya, ambil sekaligus, lalu tutup rapat.',
          'Ambil yang paling lama disimpan lebih dulu.',
          'Periksa kondisi bahan sebelum dibawa ke dapur.',
          <><b>Ayam yang sudah cair dimasak paling lambat 24 jam</b> dan tidak boleh dibekukan lagi.</>,
        ],
      },
    ],
    routine: [
      { when: 'Harian', tasks: 'Catat suhu pagi & sore. Buang bahan yang lewat batas simpan. Lap tumpahan segera.' },
      { when: 'Mingguan', tasks: 'Kosongkan bertahap, cuci rak dan wadah dengan sabun lalu sanitizer, cek karet pintu.' },
    ],
    problems: [
      { issue: 'Suhu di atas 5°C', action: 'Cek pintu tertutup rapat dan setelan suhu. Bila tidak turun dalam 2 jam, lapor ke Asisten Lapangan dan pindahkan bahan ke tempat dingin lain.' },
      { issue: 'Suhu di atas 5°C lebih dari 4 jam', action: 'Buang bahan berisiko tinggi (ayam cair, buah potong, bahan siap pakai) dan catat di Rekap Limbah.' },
      { issue: 'Cairan ayam menetes', action: 'Bersihkan segera dengan sabun lalu sanitizer. Periksa bahan di bawahnya; buang yang terkena.' },
    ],
    shelfLife: [
      { item: 'Ayam yang dicairkan', limit: 'Dimasak ≤ 24 jam setelah cair', discard: 'Lewat 24 jam, berbau, berlendir' },
      { item: 'Sayur daun (bayam, sawi, kangkung)', limit: '1–2 hari', discard: 'Layu berlendir, menguning, busuk' },
      { item: 'Sayur buah/umbi (wortel, buncis, labu)', limit: '3–5 hari', discard: 'Lembek, berjamur, berair' },
      { item: 'Buah utuh', limit: '2–5 hari', discard: 'Memar lebar, busuk, berjamur' },
      { item: 'Buah sudah dipotong', limit: '≤ 1 hari', discard: 'Lewat 1 hari, berair, berbau' },
      { item: 'Telur', limit: '≤ 14 hari sejak datang', discard: 'Retak, berlendir, mengapung saat uji air' },
      { item: 'Saus terbuka (wajib dingin)', limit: 'Ikuti petunjuk kemasan', discard: 'Berjamur, berbuih, bau asam' },
    ],
  },

  FREEZER: {
    docNo: 'SOP/GDG/04',
    title: 'Penyimpanan Bahan di Freezer',
    location: 'Freezer 1 (Gudang Basah), Freezer 2 & Freezer 3 (Dapur)',
    standard: 'Suhu −18°C atau lebih dingin, dicek dan dicatat pagi & sore',
    purpose: 'Menjaga ayam dan protein beku tetap beku sempurna dari datang sampai dimasak.',
    layoutTitle: 'Pembagian freezer',
    layout: [
      {
        place: 'Freezer 1 (Gudang Basah): Stok Ayam',
        rackId: 'BIN-FRZ-F2',
        fallback: 'Ayam yang baru datang dari supplier',
        rules: 'Stok utama. Jarang dibuka; diambil untuk mengisi Freezer 2 sesuai menu.',
      },
      {
        place: 'Freezer 2 (Dapur): Ayam Siap Masak',
        rackId: 'BIN-FRZ-D1',
        fallback: 'Ayam yang sudah dibagi per kebutuhan menu besok',
        rules: 'Per kantong sesuai menu (H-1), label menu + tanggal.',
      },
      {
        place: 'Freezer 3 (Dapur): Protein & Olahan Beku',
        rackId: 'BIN-FRZ-D2',
        fallback: 'Ikan, daging sapi, nugget, sosis, bakso',
        rules: 'Terpisah dari ayam, per jenis dalam kantong/wadah tertutup.',
      },
    ],
    notAllowed: [
      'Bahan yang sudah pernah dicairkan.',
      'Makanan yang masih panas.',
      'Bahan tanpa kemasan atau tanpa label.',
      'Ayam dicampur dengan ikan atau olahan beku dalam satu wadah.',
    ],
    steps: [
      {
        title: 'Memasukkan bahan',
        items: [
          <>Ayam yang diterima masuk Freezer 1 <b>paling lambat 30 menit</b> setelah ditimbang.</>,
          'Bagi per kantong sesuai kebutuhan masak, ratakan tipis, dan keluarkan udaranya agar cepat beku.',
          <>Label setiap kantong: <b>nama, berat, tanggal datang</b>.</>,
          'Stok baru di bawah/belakang, stok lama di atas/depan.',
          'Jangan mengisi terlalu penuh atau menutupi lubang udara.',
        ],
      },
      {
        title: 'Memindahkan & mencairkan',
        items: [
          'Sore H-1: ambil ayam dari Freezer 1 sesuai menu besok, pindahkan ke Freezer 2 atau langsung ke Chiller untuk dicairkan.',
          <><b>Cairkan di Chiller</b> (rak paling bawah, wadah tertutup), bukan di suhu ruang atau direndam air diam.</>,
          'Bila mendesak: cairkan dalam kantong tertutup di bawah air mengalir dingin, lalu langsung dimasak.',
          <><b>Ayam yang sudah cair tidak boleh dibekukan lagi.</b></>,
          'Buka pintu sesingkat mungkin; ambil sekaligus.',
        ],
      },
    ],
    routine: [
      { when: 'Harian', tasks: 'Catat suhu pagi & sore ketiga freezer. Pastikan pintu menutup rapat.' },
      { when: 'Mingguan', tasks: 'Cek label & umur stok, dahulukan yang paling lama.' },
      { when: 'Bila bunga es > 5 mm', tasks: 'Pindahkan isi ke freezer lain, matikan, cairkan es, keringkan, nyalakan sampai −18°C, lalu isi kembali.' },
    ],
    problems: [
      { issue: 'Listrik padam', action: 'Jangan buka pintu. Freezer penuh yang tertutup bisa bertahan ±24 jam. Lapor ke Asisten Lapangan.' },
      { issue: 'Suhu lebih hangat dari −15°C', action: 'Cek pintu dan setelan, lapor ke Asisten Lapangan, pindahkan isi ke freezer lain.' },
      { issue: 'Bahan sudah lunak/cair', action: 'Pindahkan ke Chiller dan masak dalam 24 jam. Jangan dibekukan ulang.' },
      { issue: 'Bahan berbau, berlendir, atau kemasan sobek', action: 'Buang dan catat di Rekap Limbah.' },
    ],
    shelfLife: [
      { item: 'Ayam beku', limit: 'Habiskan ≤ 1 bulan, maks. 3 bulan', discard: 'Berbau, berlendir, kehijauan, atau pernah cair' },
      { item: 'Ikan & daging beku', limit: 'Maks. 3 bulan', discard: 'Bunga es tebal di dalam kemasan, berbau' },
      { item: 'Olahan beku (nugget, sosis, bakso)', limit: 'Ikuti kemasan', discard: 'Kemasan sobek, berubah warna, berbau' },
    ],
  },

  LEFTOVER: {
    docNo: 'SOP/GDG/05',
    title: 'Penanganan Sisa Bahan Terbuka dari Dapur',
    location: 'Gudang Basah: Palet Sisa Bahan',
    standard: 'Suhu ruang, kering, semua sisa di dalam box tertutup di atas palet',
    purpose: 'Sisa bahan yang sudah dibuka tetap layak pakai, mudah ditemukan, dan dipakai lebih dulu sebelum membuka kemasan baru.',
    layoutTitle: 'Pembagian box di palet',
    layout: [
      {
        place: 'Box 1: Tepung & Gula',
        fallback: 'Sisa tepung terigu/beras/kanji/panir, gula pasir, gula merah',
        rules: 'Kemasan dilipat dan dijepit/diikat rapat, atau dipindah ke wadah tertutup.',
      },
      {
        place: 'Box 2: Royco & Bumbu Bubuk',
        fallback: 'Sisa royco/kaldu, lada bubuk, ketumbar bubuk, pala bubuk, baking soda',
        rules: 'Wajib kedap udara agar tidak menggumpal.',
      },
      {
        place: 'Box 3: Saus, Kecap & Minyak',
        fallback: 'Sisa kecap, saus, cuka, minyak wijen, minyak goreng',
        rules: 'Botol berdiri, tutup rapat, mulut botol dilap bersih.',
      },
    ],
    notAllowed: [
      <>Saus/sambal yang kemasannya bertuliskan <i>"simpan di lemari es setelah dibuka"</i> (→ Chiller).</>,
      'Sisa masakan atau bahan basah.',
      'Bahan tanpa label tanggal buka.',
      'Bahan yang sudah tercampur air, kotor, atau tercampur bahan lain.',
      'Box diletakkan langsung di lantai atau di dekat area cuci.',
    ],
    steps: [
      {
        title: 'Mengembalikan sisa dari dapur',
        items: [
          'Setelah selesai masak, petugas dapur mengumpulkan semua kemasan yang sudah dibuka.',
          'Periksa: kering, bersih, tidak tercampur air atau bahan lain. Yang tidak layak dibuang.',
          'Tutup rapat: kemasan dilipat & dijepit/diikat, atau dipindah ke wadah tertutup; botol ditutup dan dilap.',
          <>Label: <b>nama bahan + tanggal buka + paraf</b>.</>,
          'Masukkan ke box sesuai kelompoknya (Box 1, 2, atau 3), lalu tutup box.',
        ],
      },
      {
        title: 'Memakai sisa',
        items: [
          <>Sebelum meminta bahan baru dari Gudang Kering, <b>cek Palet Sisa Bahan dulu</b>.</>,
          'Pakai yang tanggal bukanya paling lama.',
          'Periksa kondisi (bau, warna, gumpalan, jamur) sebelum dipakai.',
          'Jangan menuang sisa lama ke kemasan baru.',
        ],
      },
    ],
    routine: [
      { when: 'Harian', tasks: 'Akhir hari: semua sisa sudah berlabel dan box tertutup rapat.' },
      { when: 'Mingguan', tasks: 'Periksa seluruh isi box, buang yang lewat batas atau rusak, lap box dan palet.' },
    ],
    problems: [
      { issue: 'Sisa tanpa label', action: 'Jangan dipakai sebelum diperiksa. Bila ragu tanggal bukanya, buang.' },
      { issue: 'Menggumpal, berjamur, berkutu, atau berbau', action: 'Buang dan catat di Rekap Limbah.' },
      { issue: 'Box atau palet basah', action: 'Pindahkan isi, keringkan box dan palet, cari sumber air dan lapor.' },
    ],
    shelfLife: [
      { item: 'Tepung & gula terbuka', limit: '≤ 1 bulan sejak dibuka*', discard: 'Menggumpal basah, berkutu, apek' },
      { item: 'Royco & bumbu bubuk terbuka', limit: '≤ 1 bulan sejak dibuka*', discard: 'Menggumpal keras, aroma hilang/berubah' },
      { item: 'Kecap, saus, cuka terbuka', limit: 'Ikuti petunjuk kemasan, maks. 1 bulan*', discard: 'Berjamur, berbuih, bau asam, tutup menggembung' },
      { item: 'Minyak terbuka', limit: '≤ 1 bulan sejak dibuka*', discard: 'Tengik atau keruh' },
    ],
  },

  NONFOOD: {
    docNo: 'SOP/GDG/02',
    title: 'Penyimpanan Non-Food: Sabun, Kemasan, APD & P3K',
    location: 'Gudang Non-Food: Rak N1, Rak N2, Rak N3, Rak N4',
    standard: 'Suhu ruang, kering, berventilasi baik, dan terpisah dari bahan pangan',
    purpose: 'Mencegah bahan pembersih mencemari makanan, serta menjaga kemasan dan APD tetap bersih sampai dipakai di dapur.',
    layoutTitle: 'Tata letak: 4 kategori non-food',
    layout: [
      {
        place: 'Rak N1: Sabun & Sanitasi',
        rackId: 'RAK-KRG-N1',
        fallback: 'Sabun cuci piring, sabun cuci ompreng, pembersih lantai, disinfektan, alat kebersihan kecil',
        rules: 'Jauhkan dari makanan dan kemasan makanan. Tutup jeriken rapat. Cairan berat di ambalan paling bawah.',
      },
      {
        place: 'Rak N2: Plastik, Tissue & Kemasan',
        rackId: 'RAK-KRG-N2',
        fallback: 'Plastik wrap, plastik kemasan, thinwall, kantong sampah, tisu dapur & tisu tangan',
        rules: 'Simpan dalam dus atau bungkus aslinya yang tertutup, supaya bersih dan tidak berdebu.',
      },
      {
        place: 'Rak N3: APD & Masker',
        rackId: 'RAK-KRG-N3',
        fallback: 'Masker medis 3 lapis, penutup kepala (hairnet), celemek, sarung tangan plastik/food grade',
        rules: 'Simpan dalam box tertutup rapat yang bersih dan kering. Ambil secukupnya untuk dipakai hari itu.',
      },
      {
        place: 'Rak N4: P3K & Obat-obatan',
        rackId: 'RAK-KRG-N4',
        fallback: 'Obat minum, koyo & balsem, antiseptik & plester, vitamin',
        rules: 'Kotak tertutup berlabel "P3K", tidak kena sinar matahari. Pakai yang paling dekat kedaluwarsanya lebih dulu.',
      },
    ],
    notAllowed: [
      'Bahan makanan atau minuman dalam bentuk apa pun.',
      'Sabun atau cairan pembersih di ambalan yang sama dengan kemasan makanan atau APD.',
      'Masker, sarung tangan, atau tisu yang kemasannya dibiarkan terbuka.',
      'Jeriken sabun yang bocor diletakkan di lantai tanpa alas penampung.',
    ],
    steps: [
      {
        title: 'Menerima & menyimpan',
        items: [
          'Periksa kondisi barang: jeriken tidak bocor, dus masker dan kemasan tidak penyok atau basah.',
          <>Langsung simpan di raknya: <b>Rak N1 (Sabun & Sanitasi)</b>, <b>Rak N2 (Plastik, Tissue & Kemasan)</b>, <b>Rak N3 (APD & Masker)</b>, <b>Rak N4 (P3K & Obat-obatan)</b>.</>,
          'Barang baru ditaruh di belakang atau bawah, stok lama di depan atau atas (FIFO).',
          'Catat penerimaan di aplikasi WMS SPPG pada hari yang sama.',
        ],
      },
      {
        title: 'Mengambil & memakai',
        items: [
          'Ambil secukupnya untuk kebutuhan dapur dan kebersihan hari itu.',
          'Pakai APD lengkap (masker, penutup kepala, celemek, sarung tangan) sebelum menangani makanan.',
          'Tutup kembali box APD dan kemasan segera setelah mengambil isinya.',
          'Tuang cairan pembersih dengan corong supaya tidak tumpah.',
        ],
      },
    ],
    routine: [
      { when: 'Harian', tasks: 'Cek persediaan masker, sarung tangan, sabun cuci piring, dan tisu.' },
      { when: 'Mingguan', tasks: 'Bersihkan debu di rak, rapikan susunan dus kemasan dan box APD.' },
    ],
    problems: [
      { issue: 'Jeriken sabun bocor atau menetes', action: 'Lap dengan kain khusus kebersihan, lalu pindahkan isinya ke wadah tertutup yang baik.' },
      { issue: 'Masker atau APD basah atau kotor', action: 'Jangan dipakai. Buang dan ganti dengan yang baru.' },
      { issue: 'Stok APD atau sabun hampir habis', action: 'Ajukan pembelian non-food ke Asisten Lapangan.' },
      { issue: 'Ada obat yang kedaluwarsa', action: 'Pisahkan dari kotak P3K, jangan diberikan ke relawan, dan lapor ke Asisten Lapangan.' },
    ],
    shelfLife: [
      { item: 'Sabun cuci piring & pembersih', limit: 'Sesuai tanggal kedaluwarsa di kemasan', discard: 'Warna atau bau berubah, cairan mengendap atau menggumpal' },
      { item: 'Plastik kemasan & tisu', limit: 'Simpan kering, pakai yang lama lebih dulu', discard: 'Kotor, lembap, berjamur, atau sobek' },
      { item: 'Masker & sarung tangan', limit: 'Sesuai tanggal kedaluwarsa di box', discard: 'Kotor, basah, tali/karet putus, atau sudah lama terbuka dari bungkusnya' },
      { item: 'Obat & perlengkapan P3K', limit: 'Sesuai tanggal kedaluwarsa di kemasan', discard: 'Lewat kedaluwarsa, strip/kemasan sobek, tablet berubah warna atau lembap' },
    ],
  },

  CRATE: {
    docNo: 'SOP/GDG/06',
    title: 'Penanganan Krat & Wadah Retur',
    location: 'Area Krat & Wadah Retur',
    standard: 'Kering, bersih, di atas palet, dan jauh dari makanan matang',
    purpose: 'Krat roti dan buah tidak bau dan tidak mengundang lalat, dan krat milik supplier kembali lengkap saat diretur.',
    layoutTitle: 'Tata letak: dipisah menurut pemilik krat',
    layout: [
      {
        place: 'Palet A: Krat roti',
        fallback: 'Krat roti milik supplier roti',
        rules: 'Buang remah roti dulu, baru ditumpuk. Maks. 10 krat per tumpukan.',
      },
      {
        place: 'Palet B: Krat buah',
        fallback: 'Keranjang buah berlubang milik supplier (anggur, kelengkeng)',
        rules: 'Harus kosong dari buah busuk, tangkai, dan kertas. Kalau basah, tumpuk terbalik supaya cepat kering.',
      },
      {
        place: 'Palet C: Wadah dapur',
        fallback: 'Krat/box plastik milik SPPG untuk bawa bahan ke meja persiapan',
        rules: 'Cuci dan beri sanitizer sebelum ditumpuk. Jangan dicampur dengan krat supplier.',
      },
      {
        place: 'Sudut krat rusak',
        fallback: 'Krat pecah, patah, atau tidak jelas pemiliknya',
        rules: 'Beri tanda "rusak", jangan dipakai, lapor ke Asisten Lapangan.',
      },
    ],
    notAllowed: [
      'Krat langsung di lantai tanpa palet.',
      'Buah busuk, tangkai, atau plastik kotor tertinggal di dalam krat.',
      'Krat supplier masuk ke ruang masak atau ruang pemorsian.',
      'Tumpukan lebih dari 10 krat.',
      'Krat supplier dipakai untuk sampah atau limbah basah.',
    ],
    steps: [
      {
        title: 'Mengosongkan krat',
        items: [
          'Pindahkan buah dan roti ke rak atau meja dapur begitu selesai diterima.',
          <>Buang <b>kertas alas, plastik, tangkai, dan buah busuk</b> dari dalam krat.</>,
          'Cek bagian krat yang pecah dan tajam.',
          'Catat jumlah krat yang diterima di BA Penerimaan.',
        ],
      },
      {
        title: 'Membersihkan & menumpuk',
        items: [
          'Krat yang kena getah buah dibilas air bersih, lalu ditiriskan sampai kering.',
          <>Tumpuk <b>per supplier</b>. Krat buah dikelompokkan menurut ukuran.</>,
          'Tumpuk lurus di tengah palet supaya tidak miring.',
          'Sisakan jalan untuk troli di antara palet.',
        ],
      },
      {
        title: 'Retur ke supplier',
        items: [
          'Siapkan krat kosong milik supplier sebelum supplier datang mengantar pesanan berikutnya.',
          'Hitung krat bersama sopir atau petugas supplier.',
          'Cocokkan jumlahnya dengan catatan di BA Penerimaan.',
          'Minta paraf supplier di surat jalan sebagai bukti krat sudah kembali.',
        ],
      },
    ],
    routine: [
      { when: 'Setiap selesai bongkar', tasks: 'Kosongkan dan bersihkan krat, lalu taruh di paletnya.' },
      { when: 'Harian (sore)', tasks: 'Sapu area krat. Tidak boleh ada genangan getah atau sampah yang mengundang lalat dan semut.' },
      { when: 'Sebelum supplier datang', tasks: 'Hitung krat yang akan diretur.' },
    ],
    problems: [
      { issue: 'Krat bau asam atau lengket kena getah', action: 'Semprot dengan air bersih di area cuci luar, tiriskan terbalik sampai kering.' },
      { issue: 'Tumpukan miring', action: 'Bongkar dan susun ulang dari bawah. Jangan menambah krat di atasnya.' },
      { issue: 'Krat pecah atau pegangan patah', action: 'Pindahkan ke sudut krat rusak dan catat, supaya jelas krat itu rusak sejak kapan saat dicek supplier.' },
      { issue: 'Jumlah krat retur kurang dari catatan', action: 'Cari di dapur dulu, kalau tetap kurang lapor ke Asisten Lapangan.' },
    ],
    shelfLife: [
      { item: 'Krat roti', limit: 'Retur saat supplier mengantar pesanan berikutnya', discard: 'Sudut pecah, badan retak, kait patah' },
      { item: 'Keranjang buah', limit: 'Retur saat supplier mengantar pesanan berikutnya', discard: 'Pecah, getas, ada bagian tajam' },
      { item: 'Palet', limit: 'Dipakai terus selama masih kuat', discard: 'Papan patah, paku menonjol, lapuk atau berjamur' },
    ],
  },
};

// APD wajib per bagian dapur (SOP/DPR/01), dipakai SOP cetak dan plakat Do & Don't APD.
export const APD_BY_SECTION: { section: string; apd: string; note: string }[] = [
  { section: 'Persiapan', apd: 'Penutup kepala, masker, celemek, sarung tangan plastik', note: 'Ganti sarung tangan setiap pindah dari bahan mentah ke bahan lain.' },
  { section: 'Pengolahan', apd: 'Penutup kepala, masker, celemek', note: 'Sarung tangan tidak dipakai di dekat api atau minyak panas.' },
  { section: 'Pemorsian', apd: 'Penutup kepala, masker, celemek, sarung tangan plastik', note: 'Makanan matang tidak boleh disentuh dengan tangan telanjang.' },
  { section: 'Cuci ompreng', apd: 'Celemek tahan air, sarung tangan karet, sepatu/sandal tertutup', note: 'Sarung tangan karet tidak dipakai untuk memegang makanan.' },
  { section: 'Satpam, staf & tamu', apd: 'Penutup kepala dan masker', note: 'Wajib dipakai bila masuk area pengolahan atau pemorsian.' },
];

// Halaman Panduan Area: /panduan/<slug>, dibuka dari QR papan nama rak tanpa login.
export type GuidePlace = Exclude<SopPlace, 'APD'>;
export const AREA_GUIDE_PATH = '/panduan/';
export const AREA_GUIDE_SLUGS: Record<GuidePlace, string> = {
  DRY: 'gudang-kering',
  NONFOOD: 'non-food',
  CHILLER: 'chiller',
  FREEZER: 'freezer',
  LEFTOVER: 'palet-sisa',
  CRATE: 'area-krat',
};

export function buildAreaGuideUrl(place: GuidePlace): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}${AREA_GUIDE_PATH}${AREA_GUIDE_SLUGS[place]}`;
}

/** undefined = bukan halaman panduan; null = halaman panduan tanpa area yang dikenal (tampilkan daftar area). */
export function areaGuidePlaceFromPath(pathname: string): GuidePlace | null | undefined {
  const path = pathname.toLowerCase().replace(/\/+$/, '');
  if (path !== AREA_GUIDE_PATH.slice(0, -1) && !path.startsWith(AREA_GUIDE_PATH)) return undefined;
  const slug = path.slice(AREA_GUIDE_PATH.length);
  const found = (Object.keys(AREA_GUIDE_SLUGS) as GuidePlace[]).find(p => AREA_GUIDE_SLUGS[p] === slug);
  return found || null;
}
