import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ThermometerSnowflake,
  Snowflake,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { SppgLogo } from '../SppgLogo';

export type DoDontTarget = 'ALL' | 'CHILLER' | 'FREEZER';

export const DO_DONT_OPTIONS: { value: DoDontTarget; label: string }[] = [
  { value: 'ALL', label: 'Semua Plakat (Chiller & Freezer - 1 per lembar A4)' },
  { value: 'CHILLER', label: 'Chiller (Suhu 1–5°C: Buah, Sayur, Telur & Thawing)' },
  { value: 'FREEZER', label: 'Freezer (Suhu ≤ -18°C: Stok Ayam & Daging Beku)' },
];

interface DoDontPosterDocProps {
  target: DoDontTarget;
  effectiveDate: string;
}

interface PosterCardProps {
  title: string;
  subtitle: string;
  tempBadge: string;
  tempColor: string;
  icon: React.ReactNode;
  rackGuide?: {
    level: string;
    items: string;
    note: string;
    color: string;
  }[];
  dos: {
    highlight: string;
    text: string;
  }[];
  donts: {
    highlight: string;
    text: string;
  }[];
  criticalNote: string;
  breakAfter?: boolean;
}

const PosterCard: React.FC<PosterCardProps> = ({
  title,
  subtitle,
  tempBadge,
  tempColor,
  icon,
  rackGuide,
  dos,
  donts,
  criticalNote,
  breakAfter,
}) => (
  <div
    className={`bg-white text-slate-900 w-full max-w-[200mm] mx-auto p-4 sm:p-5 print:p-0 flex flex-col justify-between ${
      breakAfter ? 'page-break mb-8 print:mb-0' : ''
    }`}
  >
    {/* Header Institusi Resmi */}
    <div className="border-b-2 border-slate-900 pb-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <SppgLogo size="lg" variant="color" showText={false} />
        <div>
          <div className="text-[11px] font-bold text-slate-900 tracking-tight leading-none">
            BADAN GIZI NASIONAL • REPUBLIK INDONESIA
          </div>
          <div className="text-sm font-bold text-emerald-900 leading-snug mt-0.5">
            Satuan Pelayanan Pemenuhan Gizi (SPPG) Tumpang Jeru
          </div>
          <div className="text-[10px] text-slate-600 leading-none">
            Program Makan Bergizi Gratis (MBG) • Unit Dapur & Logistik Malang
          </div>
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white font-bold text-[10px] tracking-wide">
          PANDUAN RELAWAN DAPUR
        </span>
        <div className="text-[10px] text-slate-500 mt-0.5">Tempel di Pintu Unit</div>
      </div>
    </div>

    {/* Equipment Banner & Suhu */}
    <div className="mt-3 bg-slate-50 border border-slate-300 rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-emerald-800 text-white flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-950 leading-tight">{title}</h2>
          <p className="text-[11px] text-slate-600 leading-tight mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">Standar Suhu</div>
        <div className={`text-xs font-bold px-2.5 py-0.5 rounded-full inline-block mt-0.5 border ${tempColor}`}>
          {tempBadge}
        </div>
      </div>
    </div>

    {/* Panduan Susunan Rak (Opsional / Khusus Chiller) */}
    {rackGuide && rackGuide.length > 0 && (
      <div className="mt-2.5 border border-slate-300 rounded-lg p-2.5 bg-slate-50/50">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 mb-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-700" />
          <span>Aturan Susunan Rak Penyimpanan (Wajib Urut dari Atas ke Bawah)</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10.5px]">
          {rackGuide.map(rg => (
            <div key={rg.level} className={`p-2 rounded border bg-white ${rg.color}`}>
              <div className="font-bold text-slate-900 border-b pb-0.5 mb-1">{rg.level}</div>
              <div className="font-semibold text-slate-800 leading-tight">{rg.items}</div>
              <div className="text-[9.5px] text-slate-600 mt-1 leading-tight">{rg.note}</div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Kolom Do vs Don't */}
    <div className="mt-2.5 grid grid-cols-2 gap-3">
      {/* Kolom DO (Wajib) */}
      <div className="border-2 border-emerald-700 rounded-lg p-3 bg-emerald-50/20 flex flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-800 text-white text-xs font-bold mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>DO • WAJIB DILAKUKAN</span>
          </div>

          <ul className="space-y-2 text-[11px] leading-snug text-slate-800">
            {dos.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  ✓
                </span>
                <span>
                  <strong className="text-emerald-950 font-bold">{item.highlight}</strong> {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 pt-2 border-t border-emerald-200/80 text-[10px] font-medium text-emerald-900 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>Disiplin menjaga bahan = makanan sehat untuk adik-adik sekolah.</span>
        </div>
      </div>

      {/* Kolom DON'T (Dilarang) */}
      <div className="border-2 border-rose-700 rounded-lg p-3 bg-rose-50/20 flex flex-col justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-800 text-white text-xs font-bold mb-2">
            <XCircle className="w-4 h-4 text-rose-300 shrink-0" />
            <span>DON'T • DILARANG KERAS</span>
          </div>

          <ul className="space-y-2 text-[11px] leading-snug text-slate-800">
            {donts.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                  ✕
                </span>
                <span>
                  <strong className="text-rose-950 font-bold">{item.highlight}</strong> {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 pt-2 border-t border-rose-200/80 text-[10px] font-medium text-rose-900 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
          <span>Pelanggaran aturan penyimpanan memicu keracunan dan pembusukan.</span>
        </div>
      </div>
    </div>

    {/* Catatan Kritis / Hubungi Petugas */}
    <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-slate-900 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-amber-800 shrink-0 mt-0.5" />
      <div className="text-[10.5px] leading-tight">
        <span className="font-bold text-amber-950">PENTING UNTUK RELAWAN:</span> {criticalNote}
      </div>
    </div>

    {/* Footer Info & Verifikasi */}
    <div className="mt-3 pt-2 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-600">
      <div className="flex items-center gap-1">
        <Info className="w-3.5 h-3.5 text-slate-500" />
        <span>Standar Higiene Pangan Dapur SPPG • Unit Pelayanan Desa Jeru, Tumpang, Malang</span>
      </div>
      <div className="font-semibold text-slate-800">
        Pengawasan: Asisten Lapangan & Ahli Gizi SPPG
      </div>
    </div>
  </div>
);

export const DoDontPosterDoc: React.FC<DoDontPosterDocProps> = ({ target }) => {
  const showChiller = target === 'ALL' || target === 'CHILLER';
  const showFreezer = target === 'ALL' || target === 'FREEZER';

  return (
    <div className="space-y-6">
      {/* 1. PLAKAT PINTU CHILLER */}
      {showChiller && (
        <PosterCard
          title="CHILLER GUDANG BASAH & DAPUR"
          subtitle="Khusus Sayur Segar, Buah, Telur, dan Ayam yang Dicairkan (Thawing)"
          tempBadge="Wajib 1°C s/d 5°C"
          tempColor="bg-cyan-50 border-cyan-300 text-cyan-900"
          icon={<ThermometerSnowflake className="w-5 h-5" />}
          breakAfter={target === 'ALL'}
          rackGuide={[
            {
              level: 'Rak Paling Atas',
              items: 'Telur & Bahan Siap Saji',
              note: 'Telur di dalam baki (jangan dicuci). Saus/keju tertutup rapat.',
              color: 'border-cyan-200',
            },
            {
              level: 'Rak Tengah',
              items: 'Buah & Sayuran Bersih',
              note: 'Gunakan keranjang berlubang. Buah potong wajib bertutup & berlabel.',
              color: 'border-emerald-200',
            },
            {
              level: 'Rak Paling Bawah',
              items: 'Ayam yang Sedang Dicairkan',
              note: 'Wajib wadah tertutup + nampan alas agar air darah tidak menetes.',
              color: 'border-amber-200',
            },
          ]}
          dos={[
            {
              highlight: 'Tutup rapat semua wadah.',
              text: 'Gunakan box kedap atau plastik wrap serta tempel label nama bahan + tanggal masuk.',
            },
            {
              highlight: 'Ayam cair wajib di rak paling bawah.',
              text: 'Cegah tetesan cairan ayam mentah mencemari sayur atau buah di bawahnya.',
            },
            {
              highlight: 'Jangan cuci sayur & telur sebelum simpan.',
              text: 'Air cucian membuat kulit telur keropos dan sayur cepat berlendir membusuk.',
            },
            {
              highlight: 'Ambil seperlunya, tutup pintu segera.',
              text: 'Jangan biarkan pintu terbuka saat menimbang atau memotong bahan di meja dapur.',
            },
            {
              highlight: 'Cek suhu rutin pagi dan sore.',
              text: 'Pastikan jarum atau angka termometer selalu berada di kisaran aman 1°C – 5°C.',
            },
          ]}
          donts={[
            {
              highlight: 'Dilarang memasukkan makanan panas mengepul.',
              text: 'Uap panas merusak suhu kulkas dan membuat bahan lain cepat basi. Dinginkan dulu di suhu ruang.',
            },
            {
              highlight: 'Dilarang menaruh ayam di rak atas atau tengah.',
              text: 'Bakteri Salmonella dari ayam mentah sangat berbahaya bila menetes ke sayur atau buah.',
            },
            {
              highlight: 'Dilarang membiarkan pintu mengganjal / renggang.',
              text: 'Karet pintu harus menempel rapat agar suhu dingin tidak bocor ke luar.',
            },
            {
              highlight: 'Dilarang menyimpan bahan kering di chiller.',
              text: 'Tepung, royco, dan bumbu bubuk akan lembap dan menggumpal. Simpan di Gudang Kering.',
            },
            {
              highlight: 'Dilarang menyimpan bahan tanpa penutup.',
              text: 'Bahan terbuka menyerap bau makanan lain dan cepat terkontaminasi debu kulkas.',
            },
          ]}
          criticalNote="Jika suhu termometer chiller terbaca di atas 6°C lebih dari 2 jam, atau tercium bau asam/anyir menyengat, SEGERA lapor ke Asisten Lapangan atau Petugas Logistik. Jangan langsung olah bahan tersebut."
        />
      )}

      {/* 2. PLAKAT PINTU FREEZER */}
      {showFreezer && (
        <PosterCard
          title="FREEZER GUDANG & DAPUR PROTEIN"
          subtitle="Khusus Pembekuan Ayam Karkas, Fillet, Daging Sapi, Ikan, dan Olahan Beku"
          tempBadge="Wajib ≤ -18°C (Beku Sempurna)"
          tempColor="bg-blue-50 border-blue-300 text-blue-900"
          icon={<Snowflake className="w-5 h-5" />}
          dos={[
            {
              highlight: 'Langsung masukkan ayam baru datang.',
              text: 'Ayam dari supplier maksimal 30 menit di suhu ruang setelah ditimbang harus sudah masuk freezer.',
            },
            {
              highlight: 'Bagi per kantong & ratakan tipis.',
              text: 'Bagi per porsi menu harian dan ratakan agar udara dingin cepat membekukan bagian tengah daging.',
            },
            {
              highlight: 'Tulis label jelas di setiap kemasan.',
              text: 'Wajib ada nama bahan, berat porsi, dan tanggal datang agar urutan pakai (FIFO) tidak keliru.',
            },
            {
              highlight: 'Cairkan ayam selalu di dalam chiller.',
              text: 'Pindahkan ayam beku ke rak bawah chiller pada sore H-1 sebelum dimasak besok pagi.',
            },
            {
              highlight: 'Buka pintu sesingkat mungkin.',
              text: 'Tentukan barang yang mau diambil sebelum membuka freezer agar udara beku tidak terbuang.',
            },
          ]}
          donts={[
            {
              highlight: 'DILARANG KERAS membekukan kembali bahan yang sudah cair!',
              text: 'Ayam/daging yang sudah cair TIDAK BOLEH dimasukkan lagi ke freezer karena bakteri sudah berkembang biak.',
            },
            {
              highlight: 'Dilarang mencairkan daging di suhu ruang terbuka.',
              text: 'Jangan rendam daging di bak air diam atau dijemur di meja. Cairkan di chiller atau air mengalir dingin.',
            },
            {
              highlight: 'Dilarang mencampur ayam mentah dengan olahan matang.',
              text: 'Pisahkan wadah nugget/sosis dari ayam karkas mentah untuk mencegah kontaminasi silang.',
            },
            {
              highlight: 'Dilarang mengisi melebihi batas muat.',
              text: 'Beri ruang sirkulasi udara dingin. Jangan tumpuk menutupi lubang hembusan kipas pendingin.',
            },
            {
              highlight: 'Dilarang mencongkel bunga es dengan pisau / benda tajam.',
              text: 'Bisa menusuk pipa freon dan merusak freezer. Laporkan ke petugas untuk proses defrost berkala.',
            },
          ]}
          criticalNote="Daging ayam yang sudah dicairkan wajib dimasak habis maksimal 24 jam. Jika freezer mati atau listrik padam lebih dari 4 jam hingga daging lembek, lapor pengawas sebelum bahan dipindahkan."
        />
      )}
    </div>
  );
};
