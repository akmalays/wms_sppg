import React from 'react';
import { SppgLogo } from '../SppgLogo';
import { KopText } from '../common/KopText';

export type DoDontTarget = 'ALL' | 'CHILLER' | 'FREEZER';

export const DO_DONT_OPTIONS: { value: DoDontTarget; label: string }[] = [
  { value: 'ALL', label: 'Chiller & freezer (1 plakat per lembar A4)' },
  { value: 'CHILLER', label: 'Chiller (1–5°C)' },
  { value: 'FREEZER', label: 'Freezer (−18°C atau lebih dingin)' },
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
  temp: string;
  tempNote: string;
  sopRef: string;
  guideTitle: string;
  guide: { place: string; contents: string; rule: string }[];
  dos: Rule[];
  donts: Rule[];
  reportWhen: string[];
}

// Isi plakat diringkas dari SOP/GDG/03 (chiller) dan SOP/GDG/04 (freezer); angka harus sama dengan SOP.
const POSTERS: Record<Exclude<DoDontTarget, 'ALL'>, Poster> = {
  CHILLER: {
    place: 'Chiller',
    location: 'Gudang Basah',
    temp: '1–5°C',
    tempNote: 'Cek dan catat pagi & sore',
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
    temp: '−18°C',
    tempNote: 'Atau lebih dingin. Cek dan catat pagi & sore',
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

const PosterPage: React.FC<{ poster: Poster; effectiveDate: string; breakAfter: boolean }> = ({ poster, effectiveDate, breakAfter }) => (
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
        <div>Tempel di pintu {poster.place.toLowerCase()}</div>
        <div>Berlaku: {effectiveDate}</div>
      </div>
    </div>

    {/* Suhu wajib dibuat paling besar: hal pertama yang dicocokkan relawan dengan termometer. */}
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">{poster.place}</h2>
        <p className="text-xs text-slate-600 mt-1.5">{poster.location}</p>
      </div>
      <div className="text-right">
        <p className="text-4xl font-bold font-mono text-slate-900 leading-none">{poster.temp}</p>
        <p className="text-[11px] text-slate-600 mt-1.5">{poster.tempNote}</p>
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
      <h3 className="text-sm font-bold text-amber-900">Lapor ke Asisten Lapangan kalau:</h3>
      <ul className="list-disc pl-5 mt-1 space-y-0.5 text-xs text-slate-900 leading-snug">
        {poster.reportWhen.map(r => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </section>

    <p className="pt-2 border-t border-slate-300 text-[11px] text-slate-600">
      Aturan lengkap: {poster.sopRef}.
    </p>
  </div>
);

export const DoDontPosterDoc: React.FC<DoDontPosterDocProps> = ({ target, effectiveDate }) => (
  <div>
    {(target === 'ALL' || target === 'CHILLER') && (
      <PosterPage poster={POSTERS.CHILLER} effectiveDate={effectiveDate} breakAfter={target === 'ALL'} />
    )}
    {(target === 'ALL' || target === 'FREEZER') && (
      <PosterPage poster={POSTERS.FREEZER} effectiveDate={effectiveDate} breakAfter={false} />
    )}
  </div>
);
