import React from 'react';
import { SppgLogo } from '../SppgLogo';
import { KopText } from '../common/KopText';
import { APD_BY_SECTION, GuidePlace, buildAreaGuideUrl } from './sopGudangContent';
import { QrSvg } from '../common/QrSvg';

type PosterKey = 'CHILLER' | 'FREEZER' | 'DRY' | 'NONFOOD' | 'LEFTOVER' | 'CRATE' | 'APD';
export type DoDontTarget = 'ALL' | 'COLD' | PosterKey;

const POSTER_ORDER: PosterKey[] = ['CHILLER', 'FREEZER', 'DRY', 'NONFOOD', 'LEFTOVER', 'CRATE', 'APD'];
const TARGET_KEYS: Record<DoDontTarget, PosterKey[]> = {
  ALL: POSTER_ORDER,
  COLD: ['CHILLER', 'FREEZER'],
  CHILLER: ['CHILLER'],
  FREEZER: ['FREEZER'],
  DRY: ['DRY'],
  NONFOOD: ['NONFOOD'],
  LEFTOVER: ['LEFTOVER'],
  CRATE: ['CRATE'],
  APD: ['APD'],
};
// QR di plakat membuka Panduan Area (SOP lengkap versi HP, tanpa login). APD dapur belum punya halaman panduan.
const GUIDE_FOR: Partial<Record<PosterKey, GuidePlace>> = {
  CHILLER: 'CHILLER',
  FREEZER: 'FREEZER',
  DRY: 'DRY',
  NONFOOD: 'NONFOOD',
  LEFTOVER: 'LEFTOVER',
  CRATE: 'CRATE',
};

export const doDontPosterCount = (target: DoDontTarget) => TARGET_KEYS[target].length;

export const DO_DONT_OPTIONS: { value: DoDontTarget; label: string }[] = [
  { value: 'ALL', label: 'Semua plakat (1 plakat per lembar A4)' },
  { value: 'COLD', label: 'Chiller & freezer' },
  { value: 'CHILLER', label: 'Chiller (1–5°C)' },
  { value: 'FREEZER', label: 'Freezer (−18°C atau lebih dingin)' },
  { value: 'DRY', label: 'Gudang Kering' },
  { value: 'NONFOOD', label: 'Gudang Non-Food (sabun, kemasan, APD & P3K)' },
  { value: 'LEFTOVER', label: 'Palet Sisa Bahan' },
  { value: 'CRATE', label: 'Area Krat & Wadah Retur' },
  { value: 'APD', label: 'APD dapur (pintu masuk dapur)' },
];

interface DoDontPosterDocProps {
  target: DoDontTarget;
  effectiveDate: string;
}

interface Rule {
  head: string;
  detail?: string;
}

interface Poster {
  place: string;
  location: string;
  postAt: string;
  /** Angka/aturan kunci yang dicetak paling besar, mis. suhu chiller. */
  keyFact: string;
  keyNote: string;
  sopRef: string;
  guideTitle: string;
  guide: { place: string; contents: string; rule: string }[];
  dos: Rule[];
  donts: Rule[];
  reportTitle?: string;
  reportWhen: string[];
}

// Isi plakat diringkas dari SOP/GDG/03 (chiller) dan SOP/GDG/04 (freezer); angka harus sama dengan SOP.
const POSTERS: Record<PosterKey, Poster> = {
  CHILLER: {
    place: 'Chiller',
    location: 'Gudang Basah',
    postAt: 'pintu chiller',
    keyFact: '1–5°C',
    keyNote: 'Cek dan catat pagi & sore',
    sopRef: 'SOP/GDG/03 Penyimpanan Bahan di Chiller',
    guideTitle: 'Susunan rak, dari atas ke bawah',
    guide: [
      { place: 'Rak atas', contents: 'Telur, bahan siap pakai, saus yang sudah dibuka', rule: 'Telur di tray, tidak dicuci.' },
      { place: 'Rak tengah', contents: 'Buah dan sayur', rule: 'Keranjang berlubang. Buah potong di wadah tertutup berlabel.' },
      { place: 'Rak paling bawah', contents: 'Ayam yang sedang dicairkan', rule: 'Wadah tertutup supaya cairannya tidak menetes.' },
    ],
    dos: [
      { head: 'Tutup dan beri label semua bahan.', detail: 'Tulis nama bahan dan tanggal masuk.' },
      { head: 'Ayam yang dicairkan di rak paling bawah.', detail: 'Supaya cairannya tidak menetes ke sayur dan buah.' },
      { head: 'Ambil yang paling lama disimpan lebih dulu.' },
      { head: 'Buka pintu seperlunya.', detail: 'Ambil sekaligus, lalu tutup rapat.' },
      { head: 'Masak ayam yang sudah cair paling lambat 24 jam.' },
    ],
    donts: [
      { head: 'Memasukkan makanan yang masih panas.', detail: 'Dinginkan dulu, maks. 2 jam di suhu ruang.' },
      { head: 'Mencuci sayur atau telur sebelum disimpan.', detail: 'Sayur jadi cepat berlendir dan telur mudah tercemar.' },
      { head: 'Menaruh ayam di rak atas atau tengah.' },
      { head: 'Menyimpan tepung, royco, atau bumbu kering.', detail: 'Tempatnya di Gudang Kering.' },
      { head: 'Mengisi lebih dari ±80% atau menutupi kipas.', detail: 'Udara dingin tidak bisa mengalir ke semua rak.' },
    ],
    reportWhen: [
      'Suhu di atas 5°C dan tidak turun dalam 2 jam.',
      'Ada bahan yang berbau asam, berlendir, atau berjamur. Jangan dipakai.',
      'Cairan ayam menetes ke bahan lain.',
    ],
  },
  FREEZER: {
    place: 'Freezer',
    location: 'Freezer 1 (Gudang Basah), Freezer 2 & 3 (Dapur)',
    postAt: 'pintu freezer',
    keyFact: '−18°C',
    keyNote: 'Atau lebih dingin. Cek dan catat pagi & sore',
    sopRef: 'SOP/GDG/04 Penyimpanan Bahan di Freezer',
    guideTitle: 'Pembagian freezer',
    guide: [
      { place: 'Freezer 1 (Gudang Basah)', contents: 'Stok ayam dari supplier', rule: 'Jarang dibuka. Diambil untuk mengisi Freezer 2.' },
      { place: 'Freezer 2 (Dapur)', contents: 'Ayam untuk menu besok', rule: 'Per kantong sesuai menu, label menu + tanggal.' },
      { place: 'Freezer 3 (Dapur)', contents: 'Ikan, daging sapi, nugget, sosis, bakso', rule: 'Terpisah dari ayam, per jenis.' },
    ],
    dos: [
      { head: 'Ayam masuk freezer paling lambat 30 menit setelah ditimbang.' },
      { head: 'Bagi per kantong dan ratakan tipis.', detail: 'Keluarkan udaranya supaya cepat beku.' },
      { head: 'Label setiap kantong.', detail: 'Nama, berat, dan tanggal datang.' },
      { head: 'Cairkan di chiller, rak paling bawah.', detail: 'Pindahkan sore hari sebelum dimasak (H-1).' },
      { head: 'Buka pintu sesingkat mungkin.', detail: 'Tentukan dulu apa yang mau diambil.' },
    ],
    donts: [
      { head: 'Membekukan lagi bahan yang sudah cair.', detail: 'Pindahkan ke chiller dan masak dalam 24 jam.' },
      { head: 'Mencairkan di suhu ruang atau direndam air diam.' },
      { head: 'Mencampur ayam dengan ikan atau olahan beku dalam satu wadah.' },
      { head: 'Mengisi terlalu penuh atau menutupi lubang udara.' },
      { head: 'Mencongkel bunga es dengan pisau.', detail: 'Pipa pendingin bisa bocor. Lapor kalau bunga es lebih dari 5 mm.' },
    ],
    reportWhen: [
      'Suhu lebih hangat dari −15°C.',
      'Listrik padam. Jangan buka pintu: freezer penuh yang tertutup bertahan ±24 jam.',
      'Bahan sudah lunak atau cair.',
    ],
  },
  // Plakat area lain diringkas dari SOP/GDG/01, 02, 05, 06 dan SOP/DPR/01 di sopGudangContent.
  DRY: {
    place: 'Gudang Kering',
    location: 'Palet Tengah, Rak 1 – Rak 4',
    postAt: 'pintu gudang kering',
    keyFact: '20–25°C',
    keyNote: 'Kering (kelembapan maks. 60%), bebas hama',
    sopRef: 'SOP/GDG/01 Penyimpanan Bahan di Gudang Kering',
    guideTitle: 'Simpan menurut bentuk barang',
    guide: [
      { place: 'Palet Tengah', contents: 'Sak beras, tepung, gula, minyak goreng', rule: 'Susun bersilangan, maks. 8 tumpuk.' },
      { place: 'Rak 1', contents: 'Utuh/padat: garam, rempah, terasi', rule: 'Kemasan terbuka masuk toples tertutup berlabel.' },
      { place: 'Rak 2', contents: 'Bubuk/butiran: tepung, gula, royco', rule: 'Kemasan harus rapat supaya tidak menggumpal dan disemuti.' },
      { place: 'Rak 3', contents: 'Cair/kental: kecap, saus, mentega', rule: 'Botol berdiri, tutup rapat, botol besar di ambalan bawah.' },
      { place: 'Rak 4', contents: 'Dus cadangan yang belum dibuka', rule: 'Tulis nama + tanggal datang di sisi dus.' },
    ],
    dos: [
      { head: 'Tulis tanggal datang di kemasan atau dus.' },
      { head: 'Barang baru di belakang atau di bawah.', detail: 'Barang lama di depan supaya dipakai dulu.' },
      { head: 'Ambil bahan hanya dengan Bon Dapur.' },
      { head: 'Cek Palet Sisa Bahan dulu.', detail: 'Sisa terbuka dipakai sebelum membuka kemasan baru.' },
      { head: 'Catat barang masuk dan keluar di aplikasi hari itu juga.' },
    ],
    donts: [
      { head: 'Menaruh bahan langsung di lantai.' },
      { head: 'Menyimpan ayam, sayur, buah, atau bahan beku.', detail: 'Tempatnya di chiller atau freezer.' },
      { head: 'Menyimpan sabun dan cairan pembersih.', detail: 'Tempatnya di Gudang Non-Food, Rak N1.' },
      { head: 'Menarik sak dari tumpukan bawah.', detail: 'Ambil dari yang paling atas.' },
      { head: 'Membiarkan pintu gudang terbuka.' },
    ],
    reportWhen: [
      'Ada kotoran tikus, kutu, kecoa, atau semut.',
      'Atap bocor atau dinding lembap. Pindahkan bahan dari area basah dulu.',
    ],
  },
  NONFOOD: {
    place: 'Gudang Non-Food',
    location: 'Rak N1 – Rak N4: sabun, kemasan, APD & P3K',
    postAt: 'pintu gudang non-food',
    keyFact: 'Jauh dari makanan',
    keyNote: 'Suhu ruang, kering, berventilasi',
    sopRef: 'SOP/GDG/02 Penyimpanan Non-Food',
    guideTitle: 'Isi rak',
    guide: [
      { place: 'Rak N1', contents: 'Sabun & sanitasi', rule: 'Jeriken ditutup rapat. Cairan berat di ambalan paling bawah.' },
      { place: 'Rak N2', contents: 'Plastik, tisu & kemasan', rule: 'Di dalam dus atau bungkus aslinya yang tertutup.' },
      { place: 'Rak N3', contents: 'APD & masker', rule: 'Box tertutup, bersih, dan kering.' },
      { place: 'Rak N4', contents: 'P3K & obat-obatan', rule: 'Kotak berlabel "P3K", tidak kena matahari. Pakai yang paling dekat kedaluwarsanya.' },
    ],
    dos: [
      { head: 'Langsung simpan di raknya (N1 – N4).' },
      { head: 'Barang baru di belakang atau di bawah.' },
      { head: 'Ambil secukupnya untuk kebutuhan hari itu.' },
      { head: 'Tutup lagi box APD dan kemasan setelah mengambil isinya.' },
      { head: 'Tuang cairan pembersih memakai corong.' },
    ],
    donts: [
      { head: 'Menyimpan makanan atau minuman di sini.' },
      { head: 'Menaruh sabun satu ambalan dengan kemasan makanan atau APD.' },
      { head: 'Membiarkan box masker, sarung tangan, atau tisu terbuka.' },
      { head: 'Menaruh jeriken bocor di lantai tanpa alas penampung.' },
      { head: 'Memberikan obat yang sudah kedaluwarsa.', detail: 'Pisahkan dari kotak P3K.' },
    ],
    reportWhen: [
      'Stok APD, sabun, atau obat P3K hampir habis.',
      'Ada obat yang kedaluwarsa.',
    ],
  },
  LEFTOVER: {
    place: 'Palet Sisa Bahan',
    location: 'Gudang Basah: sisa bahan terbuka dari dapur',
    postAt: 'palet sisa bahan',
    keyFact: '≤ 1 bulan',
    keyNote: 'Sejak dibuka, atau kedaluwarsa kemasan bila lebih cepat',
    sopRef: 'SOP/GDG/05 Penanganan Sisa Bahan Terbuka dari Dapur',
    guideTitle: 'Pembagian box',
    guide: [
      { place: 'Box 1', contents: 'Tepung & gula', rule: 'Kemasan dilipat dan dijepit/diikat rapat, atau dipindah ke wadah tertutup.' },
      { place: 'Box 2', contents: 'Royco & bumbu bubuk', rule: 'Wajib kedap udara supaya tidak menggumpal.' },
      { place: 'Box 3', contents: 'Saus, kecap & minyak', rule: 'Botol berdiri, tutup rapat, mulut botol dilap bersih.' },
    ],
    dos: [
      { head: 'Label setiap sisa.', detail: 'Nama bahan, tanggal buka, dan paraf.' },
      { head: 'Cek palet ini sebelum minta bahan baru.' },
      { head: 'Pakai yang tanggal bukanya paling lama.' },
      { head: 'Periksa bau, warna, gumpalan, dan jamur sebelum dipakai.' },
      { head: 'Tutup box setiap selesai mengambil atau menaruh.' },
    ],
    donts: [
      { head: 'Menyimpan sisa tanpa label tanggal buka.' },
      { head: 'Menyimpan sisa masakan atau bahan basah.' },
      { head: 'Menyimpan saus yang wajib masuk lemari es setelah dibuka.', detail: 'Pindahkan ke chiller.' },
      { head: 'Menuang sisa lama ke kemasan baru.' },
      { head: 'Menaruh box di lantai atau dekat area cuci.' },
    ],
    reportTitle: 'Buang dan catat di Rekap Limbah kalau:',
    reportWhen: [
      'Sudah lebih dari 1 bulan sejak dibuka.',
      'Menggumpal, berjamur, berkutu, atau berbau.',
      'Tidak berlabel dan tanggal bukanya tidak jelas.',
    ],
  },
  CRATE: {
    place: 'Area Krat',
    location: 'Krat & wadah retur supplier',
    postAt: 'area krat',
    keyFact: 'Maks. 10',
    keyNote: 'Krat per tumpukan, selalu di atas palet',
    sopRef: 'SOP/GDG/06 Penanganan Krat & Wadah Retur',
    guideTitle: 'Pembagian palet',
    guide: [
      { place: 'Palet A', contents: 'Krat roti', rule: 'Buang remah roti dulu, baru ditumpuk.' },
      { place: 'Palet B', contents: 'Krat buah', rule: 'Kosongkan dari buah busuk, tangkai, dan kertas. Basah: tumpuk terbalik.' },
      { place: 'Palet C', contents: 'Wadah dapur milik SPPG', rule: 'Cuci dan beri sanitizer. Jangan dicampur krat supplier.' },
      { place: 'Sudut krat rusak', contents: 'Krat pecah atau tidak jelas pemiliknya', rule: 'Beri tanda "rusak", jangan dipakai.' },
    ],
    dos: [
      { head: 'Kosongkan krat begitu barang selesai diterima.' },
      { head: 'Tumpuk per supplier, lurus di tengah palet.' },
      { head: 'Krat kena getah dibilas, lalu ditiriskan sampai kering.' },
      { head: 'Hitung krat retur bersama sopir supplier.', detail: 'Cocokkan dengan BA Penerimaan, minta paraf di surat jalan.' },
      { head: 'Sapu area krat setiap sore.' },
    ],
    donts: [
      { head: 'Menaruh krat langsung di lantai.' },
      { head: 'Menumpuk lebih dari 10 krat.' },
      { head: 'Membawa krat supplier ke ruang masak atau pemorsian.' },
      { head: 'Memakai krat supplier untuk sampah atau limbah basah.' },
      { head: 'Menambah krat di atas tumpukan yang miring.', detail: 'Bongkar dan susun ulang dari bawah.' },
    ],
    reportWhen: [
      'Krat pecah atau pegangannya patah. Pindahkan ke sudut krat rusak.',
      'Jumlah krat retur kurang dari catatan dan tidak ada di dapur.',
    ],
  },
  APD: {
    place: 'APD Dapur',
    location: 'Semua petugas, staf, dan tamu yang masuk dapur',
    postAt: 'pintu masuk dapur',
    keyFact: '20 detik',
    keyNote: 'Cuci tangan pakai sabun dan air mengalir',
    sopRef: 'SOP/DPR/01 Pemakaian Alat Pelindung Diri (APD) di Dapur',
    guideTitle: 'APD wajib per bagian',
    guide: APD_BY_SECTION.map(r => ({ place: r.section, contents: r.apd, rule: r.note })),
    dos: [
      { head: 'Cuci tangan 20 detik sebelum memakai APD.' },
      { head: 'Seluruh rambut tertutup penutup kepala.', detail: 'Ujung hijab dimasukkan ke dalam celemek.' },
      { head: 'Masker menutup hidung dan mulut.' },
      { head: 'Ganti sarung tangan setelah memegang bahan mentah, sampah, uang, atau HP.' },
      { head: 'Tutup luka di tangan dengan plester tahan air, lalu pakai sarung tangan.' },
    ],
    donts: [
      { head: 'Keluar dapur masih memakai APD.' },
      { head: 'Menurunkan masker ke dagu.' },
      { head: 'Memakai ulang masker atau sarung tangan sekali pakai.' },
      { head: 'Memakai sarung tangan sebagai pengganti cuci tangan.' },
      { head: 'Makan, minum, atau main HP di area pengolahan dan pemorsian.' },
    ],
    reportTitle: 'Lapor ke pengawas kalau:',
    reportWhen: [
      'Sedang diare, demam, muntah, atau batuk pilek. Jangan menangani makanan.',
      'Tangan terluka saat bekerja.',
      'Ada rambut atau benda asing di makanan.',
    ],
  },
};

const RuleList: React.FC<{ rules: Rule[] }> = ({ rules }) => (
  <ol className="list-decimal pl-5 space-y-2 marker:font-bold marker:text-slate-900">
    {rules.map(r => (
      <li key={r.head} className="pl-0.5">
        <p className="text-sm font-bold text-slate-900 leading-snug">{r.head}</p>
        {r.detail && <p className="text-xs text-slate-700 leading-snug mt-0.5">{r.detail}</p>}
      </li>
    ))}
  </ol>
);

const PosterPage: React.FC<{ poster: Poster; guideUrl?: string; effectiveDate: string; breakAfter: boolean }> = ({ poster, guideUrl, effectiveDate, breakAfter }) => (
  <div
    className={`bg-white text-slate-900 w-full max-w-[200mm] mx-auto space-y-4 ${
      breakAfter ? 'page-break pb-8 mb-8 border-b border-dashed border-slate-300 print:border-0 print:pb-0 print:mb-0' : ''
    }`}
  >
    <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <SppgLogo size="lg" variant="color" showText={false} />
        <KopText />
      </div>
      <div className="text-right text-[11px] text-slate-600 space-y-0.5 shrink-0">
        <div>Tempel di {poster.postAt}</div>
        <div>Berlaku: {effectiveDate}</div>
      </div>
    </div>

    {/* Angka kunci (suhu, batas simpan, dsb.) dibuat paling besar: hal pertama yang dicocokkan relawan. */}
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">{poster.place}</h2>
        <p className="text-xs text-slate-600 mt-1.5">{poster.location}</p>
      </div>
      <div className="text-right">
        <p className={`font-bold text-slate-900 leading-none ${/^[\d−≤-]/.test(poster.keyFact) ? 'text-4xl font-mono' : 'text-2xl'}`}>{poster.keyFact}</p>
        <p className="text-[11px] text-slate-600 mt-1.5">{poster.keyNote}</p>
      </div>
    </div>

    <section>
      <h3 className="text-sm font-bold text-slate-900 mb-1.5">{poster.guideTitle}</h3>
      <table className="w-full border-collapse border border-slate-300 table-print text-xs">
        <tbody>
          {poster.guide.map(g => (
            <tr key={g.place} className="align-top">
              <td className="border border-slate-300 p-2 font-bold text-slate-900 w-44">{g.place}</td>
              <td className="border border-slate-300 p-2 font-semibold text-slate-900">{g.contents}</td>
              <td className="border border-slate-300 p-2 text-slate-700">{g.rule}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>

    <div className="grid grid-cols-2 gap-3">
      <section className="border-2 border-emerald-700 rounded-lg overflow-hidden">
        <h3 className="bg-emerald-700 text-white text-base font-bold px-3 py-1.5">✓ Lakukan</h3>
        <div className="p-3">
          <RuleList rules={poster.dos} />
        </div>
      </section>
      <section className="border-2 border-rose-700 rounded-lg overflow-hidden">
        <h3 className="bg-rose-700 text-white text-base font-bold px-3 py-1.5">✕ Jangan</h3>
        <div className="p-3">
          <RuleList rules={poster.donts} />
        </div>
      </section>
    </div>

    <section className="border-2 border-amber-600 bg-amber-50 rounded-lg p-3">
      <h3 className="text-sm font-bold text-amber-900">{poster.reportTitle || 'Lapor ke Asisten Lapangan kalau:'}</h3>
      <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs text-slate-900 leading-snug">
        {poster.reportWhen.map(r => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>

    <div className="pt-2 border-t border-slate-300 flex items-center justify-between gap-4">
      <p className="text-[11px] text-slate-600">Aturan lengkap: {poster.sopRef}.</p>
      {guideUrl && (
        <div className="flex items-center gap-2.5 shrink-0">
          <p className="text-right text-[11px] leading-snug text-slate-700">
            <span className="block font-bold text-slate-900">Pindai untuk panduan lengkap</span>
            Pakai kamera HP, tanpa login
          </p>
          <QrSvg value={guideUrl} className="w-24 h-24" />
        </div>
      )}
    </div>
  </div>
);

export const DoDontPosterDoc: React.FC<DoDontPosterDocProps> = ({ target, effectiveDate }) => {
  const keys = TARGET_KEYS[target];
  return (
    <div>
      {keys.map((k, i) => (
        <PosterPage key={k} poster={POSTERS[k]} guideUrl={GUIDE_FOR[k] && buildAreaGuideUrl(GUIDE_FOR[k])} effectiveDate={effectiveDate} breakAfter={i < keys.length - 1} />
      ))}
    </div>
  );
};
