import React, { useMemo } from 'react';
import { ItemMaster } from '../../types/warehouse';
import { matchItemToRackId } from '../../utils/warehouseRacks';
import { SppgLogo } from '../SppgLogo';
import { KopText } from '../common/KopText';

// SOP penanganan bahan, satu dokumen per tempat simpan agar bisa ditempel di lokasinya.
// Isi tiap rak/unit diambil dari Master Barang dengan aturan rak yang sama seperti Plakat Rak.

export type SopPlace = 'DRY' | 'CHILLER' | 'FREEZER' | 'LEFTOVER';
export const SOP_PLACE_OPTIONS: { value: SopPlace | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Semua tempat (1 SOP per halaman)' },
  { value: 'DRY', label: 'Gudang Kering' },
  { value: 'CHILLER', label: 'Chiller' },
  { value: 'FREEZER', label: 'Freezer' },
  { value: 'LEFTOVER', label: 'Palet Sisa Bahan' },
];

interface SopGudangDocProps {
  items: ItemMaster[];
  place: SopPlace | 'ALL';
  effectiveDate: string; // sudah diformat
  printedDate: string; // sudah diformat
  printedBy: string;
}

const SIGNERS = [
  { label: 'Disusun oleh', role: 'Asisten Lapangan', name: 'M. Ali Akbar Fathoni, S.Pd.' },
  { label: 'Diperiksa oleh', role: 'Akuntan', name: 'Alfiana Viransa, S.Tr.Ak.' },
];

interface LayoutRow {
  place: string;
  rackId?: string; // isi diambil dari Master Barang bila ada
  fallback: string;
  rules: React.ReactNode;
}

interface SopDefinition {
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

const SOPS: Record<SopPlace, SopDefinition> = {
  DRY: {
    docNo: 'SOP/GDG/01',
    title: 'Penyimpanan Bahan di Gudang Kering',
    location: 'Gudang Kering: Palet Tengah, Rak 1 – Rak 4',
    standard: 'Suhu ruang 20–25°C, kering (kelembapan maks. 60%), bebas hama',
    purpose: 'Menjaga bahan kering tetap layak pakai, mudah ditemukan, dan dipakai sesuai urutan datang.',
    layoutTitle: 'Tata letak: simpan menurut bentuk barang',
    layout: [
      {
        place: 'Palet Tengah — Sembako Berat',
        rackId: 'PLT-KRG-T1',
        fallback: 'Beras sak, tepung sak, gula sak, minyak goreng',
        rules: 'Masih dalam sak/karung atau dus/jerigen besar. Susun bersilangan, maks. 8 tumpuk.',
      },
      {
        place: 'Rak 1 — Garam, Rempah & Bumbu Dasar',
        rackId: 'RAK-KRG-A1',
        fallback: 'Garam, kemiri, cengkeh, terasi, petis',
        rules: 'Bentuk utuh/padat. Kemasan terbuka masuk toples tertutup berlabel.',
      },
      {
        place: 'Rak 2 — Tepung, Gula & Bumbu Bubuk',
        rackId: 'RAK-KRG-A2',
        fallback: 'Tepung kemasan kecil, gula, royco, lada bubuk',
        rules: 'Bentuk bubuk/butiran. Mudah menggumpal & mengundang semut, kemasan harus rapat.',
      },
      {
        place: 'Rak 3 — Saus, Kecap & Mentega',
        rackId: 'RAK-KRG-A3',
        fallback: 'Kecap, saus, cuka, minyak wijen, mayones, mentega',
        rules: 'Bentuk cair/kental. Botol berdiri, tutup rapat, botol besar di ambalan bawah.',
      },
      {
        place: 'Rak 4 — Stok Cadangan Dus',
        fallback: 'Dus tertutup cadangan untuk Rak 1–3',
        rules: 'Hanya dus yang belum dibuka. Tulis nama + tanggal datang di sisi dus.',
      },
    ],
    notAllowed: [
      'Bahan basah, ayam, sayur, buah, dan bahan beku (→ Chiller/Freezer).',
      'Sisa bahan terbuka dari dapur (→ Palet Sisa Bahan).',
      'Sabun, pembersih, dan bahan kimia (→ Rak Non-Food N1–N3).',
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
    docNo: 'SOP/GDG/02',
    title: 'Penyimpanan Bahan di Chiller',
    location: 'Gudang Basah — Chiller',
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
    docNo: 'SOP/GDG/03',
    title: 'Penyimpanan Bahan di Freezer',
    location: 'Freezer 1 (Gudang Basah), Freezer 2 & Freezer 3 (Dapur)',
    standard: 'Suhu −18°C atau lebih dingin, dicek dan dicatat pagi & sore',
    purpose: 'Menjaga ayam dan protein beku tetap beku sempurna dari datang sampai dimasak.',
    layoutTitle: 'Pembagian freezer',
    layout: [
      {
        place: 'Freezer 1 (Gudang Basah) — Stok Ayam',
        rackId: 'BIN-FRZ-F2',
        fallback: 'Ayam yang baru datang dari supplier',
        rules: 'Stok utama. Jarang dibuka; diambil untuk mengisi Freezer 2 sesuai menu.',
      },
      {
        place: 'Freezer 2 (Dapur) — Ayam Siap Masak',
        rackId: 'BIN-FRZ-D1',
        fallback: 'Ayam yang sudah dibagi per kebutuhan menu besok',
        rules: 'Per kantong sesuai menu (H-1), label menu + tanggal.',
      },
      {
        place: 'Freezer 3 (Dapur) — Protein & Olahan Beku',
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
    docNo: 'SOP/GDG/04',
    title: 'Penanganan Sisa Bahan Terbuka dari Dapur',
    location: 'Gudang Basah — Palet Sisa Bahan',
    standard: 'Suhu ruang, kering, semua sisa di dalam box tertutup di atas palet',
    purpose: 'Sisa bahan yang sudah dibuka tetap layak pakai, mudah ditemukan, dan dipakai lebih dulu sebelum membuka kemasan baru.',
    layoutTitle: 'Pembagian box di palet',
    layout: [
      {
        place: 'Box 1 — Tepung & Gula',
        fallback: 'Sisa tepung terigu/beras/kanji/panir, gula pasir, gula merah',
        rules: 'Kemasan dilipat dan dijepit/diikat rapat, atau dipindah ke wadah tertutup.',
      },
      {
        place: 'Box 2 — Royco & Bumbu Bubuk',
        fallback: 'Sisa royco/kaldu, lada bubuk, ketumbar bubuk, pala bubuk, baking soda',
        rules: 'Wajib kedap udara agar tidak menggumpal.',
      },
      {
        place: 'Box 3 — Saus, Kecap & Minyak',
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
};

const Section: React.FC<{ no: number; title: string; children: React.ReactNode }> = ({ no, title, children }) => (
  <section className="sop-section space-y-1.5">
    <h3 className="text-xs font-bold text-slate-900 border-b border-slate-300 pb-1">
      {no}. {title}
    </h3>
    {children}
  </section>
);

const List: React.FC<{ items: React.ReactNode[]; ordered?: boolean }> = ({ items, ordered }) => {
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`${ordered ? 'list-decimal' : 'list-disc'} pl-5 space-y-0.5 text-[11px] leading-snug text-slate-800`}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </Tag>
  );
};

const TH = 'border border-slate-300 p-1.5 text-left';
const TD = 'border border-slate-300 p-1.5';

const SopPage: React.FC<{
  sop: SopDefinition;
  contentsOf: (rackId: string | undefined, fallback: string) => string;
  effectiveDate: string;
  printedDate: string;
  printedBy: string;
  breakAfter: boolean;
}> = ({ sop, contentsOf, effectiveDate, printedDate, printedBy, breakAfter }) => {
  let n = 0;
  return (
    <div className={`space-y-3.5 text-xs ${breakAfter ? 'page-break pb-8 mb-8 border-b border-dashed border-slate-300 print:border-0 print:pb-0 print:mb-0' : ''}`}>
      {/* Kop di setiap SOP agar tiap lembar bisa ditempel sendiri */}
      <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <SppgLogo size="lg" variant="color" showText={false} />
          <KopText />
        </div>
        <div className="text-right text-[11px] text-slate-600 space-y-0.5 shrink-0">
          <div>Dicetak: {printedDate}</div>
          <div>Oleh: {printedBy}</div>
        </div>
      </div>

      <div className="text-center">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Standar Operasional Prosedur</h2>
        <p className="text-sm font-bold text-slate-900">{sop.title}</p>
      </div>

      <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
        <tbody>
          <tr>
            <td className={`${TD} text-slate-600 w-28`}>No. dokumen</td>
            <td className={`${TD} font-semibold`}>{sop.docNo}</td>
            <td className={`${TD} text-slate-600 w-28`}>Tanggal berlaku</td>
            <td className={`${TD} font-semibold`}>{effectiveDate}</td>
          </tr>
          <tr>
            <td className={`${TD} text-slate-600`}>Tempat</td>
            <td className={TD} colSpan={3}>{sop.location}</td>
          </tr>
          <tr>
            <td className={`${TD} text-slate-600`}>Standar</td>
            <td className={`${TD} font-semibold`} colSpan={3}>{sop.standard}</td>
          </tr>
          <tr>
            <td className={`${TD} text-slate-600`}>Tujuan</td>
            <td className={TD} colSpan={3}>{sop.purpose}</td>
          </tr>
        </tbody>
      </table>

      <Section no={++n} title={sop.layoutTitle}>
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th className={`${TH} w-40`}>Tempat</th>
              <th className={`${TH} w-[38%]`}>Isi</th>
              <th className={TH}>Cara simpan</th>
            </tr>
          </thead>
          <tbody>
            {sop.layout.map(r => (
              <tr key={r.place} className="align-top">
                <td className={`${TD} font-semibold text-slate-900`}>{r.place}</td>
                <td className={`${TD} text-slate-700`}>{contentsOf(r.rackId, r.fallback)}</td>
                <td className={`${TD} text-slate-800`}>{r.rules}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section no={++n} title="Tidak boleh disimpan di sini">
        <List items={sop.notAllowed} />
      </Section>

      {sop.steps.map(step => (
        <Section key={step.title} no={++n} title={step.title}>
          <List items={step.items} ordered />
        </Section>
      ))}

      <Section no={++n} title="Pemeriksaan & kebersihan rutin">
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <tbody>
            {sop.routine.map(r => (
              <tr key={r.when} className="align-top">
                <td className={`${TD} font-semibold text-slate-900 w-36`}>{r.when}</td>
                <td className={`${TD} text-slate-800`}>{r.tasks}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section no={++n} title="Bila terjadi masalah">
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th className={`${TH} w-[35%]`}>Masalah</th>
              <th className={TH}>Yang harus dilakukan</th>
            </tr>
          </thead>
          <tbody>
            {sop.problems.map(p => (
              <tr key={p.issue} className="align-top">
                <td className={`${TD} font-semibold text-slate-900`}>{p.issue}</td>
                <td className={`${TD} text-slate-800`}>{p.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section no={++n} title="Batas simpan & tanda harus dibuang">
        <table className="w-full border-collapse border border-slate-300 table-print text-[11px]">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th className={TH}>Bahan</th>
              <th className={TH}>Batas simpan</th>
              <th className={TH}>Buang bila</th>
            </tr>
          </thead>
          <tbody>
            {sop.shelfLife.map(r => (
              <tr key={r.item} className="align-top">
                <td className={`${TD} font-semibold text-slate-900`}>{r.item}</td>
                <td className={`${TD} text-slate-800`}>{r.limit}</td>
                <td className={`${TD} text-slate-800`}>{r.discard}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-slate-600">
          {sop.shelfLife.some(r => r.limit.includes('*'))
            ? '* Atau sampai tanggal kedaluwarsa kemasan bila lebih cepat. '
            : ''}
          Bahan yang dibuang dicatat di Rekap Limbah.
        </p>
      </Section>

      <div className="sop-avoid grid grid-cols-2 gap-6 pt-5 text-center text-xs">
        {SIGNERS.map(s => (
          <div key={s.name}>
            <p className="text-slate-700">{s.label},</p>
            <p className="text-slate-700">{s.role}</p>
            <div className="h-16" />
            <p className="font-semibold text-slate-900 underline underline-offset-2">{s.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const SopGudangDoc: React.FC<SopGudangDocProps> = ({ items, place, effectiveDate, printedDate, printedBy }) => {
  // Nama barang per rak/unit dari Master Barang (maks. 8 nama agar ringkas)
  const namesByRack = useMemo(() => {
    const map: Record<string, string[]> = {};
    items
      .filter(i => i.isActive)
      .forEach(i => {
        const rackId = matchItemToRackId(i.location, i.category, i.name, i.id);
        if (rackId) (map[rackId] = map[rackId] || []).push(i.name);
      });
    return map;
  }, [items]);

  const contentsOf = (rackId: string | undefined, fallback: string) => {
    const names = rackId ? [...(namesByRack[rackId] || [])].sort((a, b) => a.localeCompare(b)) : [];
    if (names.length === 0) return fallback;
    const shown = names.slice(0, 8).join(', ');
    return names.length > 8 ? `${shown}, dan ${names.length - 8} barang lain` : shown;
  };

  const places: SopPlace[] = place === 'ALL' ? ['DRY', 'CHILLER', 'FREEZER', 'LEFTOVER'] : [place];

  return (
    <>
      {places.map((p, i) => (
        <SopPage
          key={p}
          sop={SOPS[p]}
          contentsOf={contentsOf}
          effectiveDate={effectiveDate}
          printedDate={printedDate}
          printedBy={printedBy}
          breakAfter={i < places.length - 1}
        />
      ))}
    </>
  );
};
