import React, { useMemo } from 'react';
import logoSppgImg from '../../assets/logo sppg.png';
import { QrSvg } from '../common/QrSvg';

export type MealBoxLabelModel = 'MODEL_B' | 'MODEL_A' | 'MODEL_C' | 'MODEL_LEGACY';

export interface MealBoxLabelModelInfo {
  id: MealBoxLabelModel;
  name: string;
  cols: number;
  rows: number;
  perSheet: number;
  labelSizeMm: string;
  badge: string;
  description: string;
}

export const MEAL_BOX_MODELS: MealBoxLabelModelInfo[] = [
  {
    id: 'MODEL_B',
    name: 'Model B · 3 Kolom (30 pcs/A4)',
    cols: 3,
    rows: 10,
    perSheet: 30,
    labelSizeMm: '63 mm × 27 mm',
    badge: 'Rekomendasi Terbaik',
    description: '30 label per A4 (3x lebih hemat). Teks dan ikon sangat jelas terbaca, proporsional untuk tutup ompreng/bento.',
  },
  {
    id: 'MODEL_A',
    name: 'Model A · 2 Kolom (22 pcs/A4)',
    cols: 2,
    rows: 11,
    perSheet: 22,
    labelSizeMm: '96 mm × 25 mm',
    badge: 'Format Pita Segel',
    description: '22 label per A4 (2,2x lebih hemat). Bentuk pita memanjang horizontal, cocok ditempel melintang sebagai segel tutup.',
  },
  {
    id: 'MODEL_C',
    name: 'Model C · 4 Kolom (36 pcs/A4)',
    cols: 4,
    rows: 9,
    perSheet: 36,
    labelSizeMm: '48 mm × 30 mm',
    badge: 'Maksimal Hemat',
    description: '36 label per A4 (3,6x lebih hemat). Bentuk badge vertikal kompak, cocok untuk wadah kecil atau stiker sudut.',
  },
  {
    id: 'MODEL_LEGACY',
    name: 'Format Asli · 1 Kolom (10 pcs/A4)',
    cols: 1,
    rows: 10,
    perSheet: 10,
    labelSizeMm: '190 mm × 27 mm',
    badge: 'Format Lama (Boros)',
    description: 'Format sesuai file PDF lama. Membentang 1 baris penuh selebar kertas A4 sehingga hanya muat 10 label.',
  },
];

interface MealBoxLabelDocProps {
  layoutModel: MealBoxLabelModel;
  onModelChange?: (model: MealBoxLabelModel) => void;
  consumeTime: string;
  sppgName: string;
  sheetCount: number;
  showCutLines: boolean;
  includeQrCode?: boolean;
  qrUrl?: string;
  onCountChange?: (count: number) => void;
}

// Icon piring, sendok & garpu melingkar
const UtensilsIcon: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`}>
    <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2.5" />
    {/* Garpu */}
    <path d="M16 11v8a3 3 0 003 3v15h2V22a3 3 0 003-3v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M18.5 11v7M21.5 11v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    {/* Sendok */}
    <path d="M29 11c-2.5 0-4 3-4 6s1.5 6 4 6 4-3 4-6-1.5-6-4-6zm0 12v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Icon wadah makanan disilang merah/hitam
const NoTakeawayIcon: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={`shrink-0 ${className}`}>
    <ellipse cx="24" cy="27" rx="15" ry="9" stroke="currentColor" strokeWidth="2.2" />
    <path d="M9 27v4c0 5 6.7 9 15 9s15-4 15-9v-4" stroke="currentColor" strokeWidth="2" />
    <ellipse cx="24" cy="20" rx="11" ry="5.5" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2 2" />
    {/* Tanda silang tegas */}
    <circle cx="34" cy="14" r="9" fill="#ffffff" stroke="#dc2626" strokeWidth="2" />
    <path d="M29.5 9.5l9 9M38.5 9.5l-9 9" stroke="#dc2626" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

export const MealBoxLabelDoc: React.FC<MealBoxLabelDocProps> = ({
  layoutModel,
  onModelChange,
  consumeTime = '11.00',
  sppgName = 'SPPG MALANG TUMPANG JERU',
  sheetCount = 1,
  showCutLines = true,
  includeQrCode = true,
  qrUrl = '/menu-mbg-hari-ini',
  onCountChange,
}) => {
  const [showModelComparison, setShowModelComparison] = React.useState<boolean>(true);

  const modelInfo = useMemo(
    () => MEAL_BOX_MODELS.find(m => m.id === layoutModel) || MEAL_BOX_MODELS[0],
    [layoutModel]
  );

  const resolvedQrValue = useMemo(() => {
    return qrUrl || '/menu-mbg-hari-ini';
  }, [qrUrl]);

  const totalLabels = modelInfo.perSheet * Math.max(1, sheetCount);

  React.useEffect(() => {
    onCountChange?.(totalLabels);
  }, [totalLabels, onCountChange]);

  const cutBorderCls = showCutLines ? 'border-dashed border-slate-300 print:border-slate-400' : 'border-transparent';

  // Render Label Model B: 3 Kolom (30 pcs/A4) - Rekomendasi
  const renderModelB = (idx: number) => (
    <article
      key={idx}
      className={`relative bg-white border ${cutBorderCls} rounded-xs p-1.5 flex flex-col justify-between overflow-hidden text-black leading-tight break-inside-avoid shadow-none`}
      style={{ minHeight: '26.5mm', height: '100%' }}
    >
      {/* Header SPPG & Logo */}
      <div className="flex items-center gap-1.5 pb-1 border-b border-black">
        <img src={logoSppgImg} alt="Logo" className="w-4 h-4 object-contain shrink-0" />
        <span className="font-extrabold text-[9px] sm:text-[10px] tracking-tight uppercase truncate">
          {sppgName}
        </span>
      </div>

      {/* Konten Sejajar */}
      <div className={`grid ${includeQrCode ? 'grid-cols-[1fr_1.1fr_auto]' : 'grid-cols-2'} gap-1 pt-1 items-center flex-1`}>
        {/* Kolom Konsumsi */}
        <div className="flex items-center gap-1 border-r border-slate-300 pr-1">
          <UtensilsIcon size={includeQrCode ? 19 : 22} className="text-emerald-700 print:text-black shrink-0" />
          <div className="min-w-0">
            <p className="text-[7px] font-bold text-slate-800 leading-none">SEGERA KONSUMSI</p>
            <p className="text-[6.5px] text-slate-600 mt-0.5 leading-none">SEBELUM PUKUL</p>
            <p className="text-[11px] font-black text-black font-mono tracking-tight mt-0.5 leading-none">
              {consumeTime}
            </p>
          </div>
        </div>

        {/* Kolom Larangan Bawa Pulang */}
        <div className={`flex items-center gap-1 pl-0.5 ${includeQrCode ? 'border-r border-slate-300 pr-1' : ''}`}>
          <NoTakeawayIcon size={includeQrCode ? 19 : 22} className="text-rose-600 print:text-black shrink-0" />
          <div className="min-w-0">
            <p className="text-[7px] font-extrabold text-rose-700 print:text-black leading-none">
              DILARANG DIBAWA
            </p>
            <p className="text-[6px] font-bold text-slate-700 leading-tight mt-0.5">
              PULANG / DIPINDAH
            </p>
            <p className="text-[5.5px] text-slate-600 leading-tight">
              KE KOTAK MAKAN/FOAM
            </p>
          </div>
        </div>

        {/* Kolom QR Code Menu MBG */}
        {includeQrCode && (
          <div className="flex flex-col items-center justify-center pl-0.5 text-center shrink-0">
            <QrSvg value={resolvedQrValue} className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
            <span className="text-[5.5px] font-extrabold leading-none mt-0.5 text-slate-900">
              MENU MBG
            </span>
          </div>
        )}
      </div>
    </article>
  );

  // Render Label Model A: 2 Kolom (22 pcs/A4) - Pita Strip
  const renderModelA = (idx: number) => (
    <article
      key={idx}
      className={`relative bg-white border ${cutBorderCls} rounded-xs px-2 py-1 flex items-center justify-between gap-1.5 overflow-hidden text-black leading-tight break-inside-avoid shadow-none`}
      style={{ minHeight: '24.5mm', height: '100%' }}
    >
      {/* Bagian 1: Waktu Konsumsi */}
      <div className="flex items-center gap-1.5 shrink-0 border-r border-black pr-2">
        <UtensilsIcon size={24} className="text-emerald-700 print:text-black shrink-0" />
        <div className="text-center">
          <p className="text-[7.5px] font-bold leading-none">SEGERA DIKONSUMSI</p>
          <p className="text-[6.5px] text-slate-600 mt-0.5 leading-none">SEBELUM PUKUL</p>
          <p className="text-xs font-black font-mono tracking-tight mt-0.5 leading-none">
            {consumeTime}
          </p>
        </div>
      </div>

      {/* Bagian 2: Larangan Bawa Pulang */}
      <div className="flex items-center gap-1.5 shrink-0 border-r border-black pr-2">
        <NoTakeawayIcon size={24} className="text-rose-600 print:text-black shrink-0" />
        <div>
          <p className="text-[7.5px] font-extrabold text-rose-700 print:text-black leading-none">DILARANG DIBAWA</p>
          <p className="text-[7px] font-bold text-slate-800 leading-none mt-0.5">PULANG/DIPINDAH KE</p>
          <p className="text-[6.5px] text-slate-600 leading-none mt-0.5">KOTAK MAKAN/FOAM</p>
        </div>
      </div>

      {/* Bagian 3: QR Code Menu MBG */}
      {includeQrCode && (
        <div className="flex items-center gap-1.5 shrink-0 border-r border-black pr-2">
          <QrSvg value={resolvedQrValue} className="w-6 h-6 shrink-0" />
          <div className="text-left">
            <span className="block text-[7px] font-extrabold leading-tight text-slate-900">MENU MBG</span>
            <span className="block text-[6px] text-slate-600 leading-none mt-0.5">Scan Info Gizi</span>
          </div>
        </div>
      )}

      {/* Bagian 4: Identitas SPPG & Logo */}
      <div className="flex items-center gap-1.5 min-w-0 pl-1 flex-1 justify-end">
        <img src={logoSppgImg} alt="Logo" className="w-5 h-5 object-contain shrink-0" />
        <span className="font-extrabold text-[9px] tracking-tight uppercase text-right leading-tight">
          {sppgName}
        </span>
      </div>
    </article>
  );

  // Render Label Model C: 4 Kolom (36 pcs/A4) - Mini Badge
  const renderModelC = (idx: number) => (
    <article
      key={idx}
      className={`relative bg-white border ${cutBorderCls} rounded-xs p-1 flex flex-col justify-between overflow-hidden text-black leading-tight break-inside-avoid shadow-none`}
      style={{ minHeight: '29mm', height: '100%' }}
    >
      <div className="text-center border-b border-black pb-0.5">
        <span className="font-extrabold text-[7.5px] tracking-tight uppercase truncate block">
          {sppgName}
        </span>
      </div>

      {/* Waktu Konsumsi & QR Code Sejajar */}
      <div className="my-0.5 p-1 rounded bg-slate-50 border border-slate-200 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <UtensilsIcon size={16} className="text-emerald-700 print:text-black shrink-0" />
          <div className="min-w-0">
            <span className="text-[6px] font-bold block text-slate-700 leading-none">KONSUMSI SEBELUM</span>
            <span className="text-[11px] font-black font-mono tracking-tight block text-black leading-none mt-0.5">
              {consumeTime}
            </span>
          </div>
        </div>
        {includeQrCode && (
          <div className="flex items-center gap-0.5 border-l border-slate-300 pl-1 shrink-0">
            <QrSvg value={resolvedQrValue} className="w-5 h-5 shrink-0" />
            <span className="text-[5px] font-bold text-slate-800 leading-none">
              MENU<br />HARI INI
            </span>
          </div>
        )}
      </div>

      {/* Larangan Bawah */}
      <div className="flex items-center gap-1 pt-0.5">
        <NoTakeawayIcon size={16} className="text-rose-600 print:text-black shrink-0" />
        <p className="text-[6.5px] font-bold text-rose-700 print:text-black leading-tight">
          Dilarang bawa pulang / pindah ke wadah lain
        </p>
      </div>
    </article>
  );

  // Render Format Asli (1 Kolom - 10 pcs/A4) - Mirip PDF Lama
  const renderModelLegacy = (idx: number) => (
    <article
      key={idx}
      className={`relative bg-white border-y border-black ${cutBorderCls} p-2 flex items-center justify-between gap-3 overflow-hidden text-black leading-tight break-inside-avoid shadow-none`}
      style={{ minHeight: '26mm', height: '100%' }}
    >
      {/* Kolom 1: Doodle Latar & Waktu Konsumsi */}
      <div className="flex items-center gap-3 shrink-0 border-r border-black pr-4 min-w-[190px]">
        <UtensilsIcon size={32} className="text-black shrink-0" />
        <div className="text-center">
          <p className="text-[9px] font-bold leading-none">SEGERA DIKONSUMSI</p>
          <p className="text-[8px] text-slate-700 mt-0.5 leading-none">SEBELUM PUKUL</p>
          <p className="text-base font-black font-mono tracking-tight mt-1 leading-none">
            {consumeTime}
          </p>
        </div>
      </div>

      {/* Kolom 2: Larangan Bawa Pulang */}
      <div className="flex items-center gap-3 shrink-0 border-r border-black pr-4 min-w-[200px]">
        <NoTakeawayIcon size={32} className="text-black shrink-0" />
        <div>
          <p className="text-[9.5px] font-extrabold text-black leading-none">DILARANG DIBAWA</p>
          <p className="text-[9px] font-bold text-black leading-none mt-0.5">PULANG/DIPINDAH KE</p>
          <p className="text-[8px] text-black leading-none mt-0.5">KOTAK MAKAN/FOAM</p>
        </div>
      </div>

      {/* Kolom 3: QR Code Menu MBG */}
      {includeQrCode && (
        <div className="flex items-center gap-2.5 shrink-0 border-r border-black pr-4 min-w-[140px]">
          <QrSvg value={resolvedQrValue} className="w-9 h-9 shrink-0" />
          <div>
            <p className="text-[9px] font-bold text-black leading-none">MENU MBG HARI INI</p>
            <p className="text-[7.5px] text-slate-700 leading-tight mt-0.5">Pindai info gizi & foto menu</p>
            <p className="text-[7px] font-mono text-slate-500 leading-none mt-0.5 truncate max-w-[110px]">{resolvedQrValue}</p>
          </div>
        </div>
      )}

      {/* Kolom 4: Nama SPPG dengan Watermark Logo */}
      <div className="relative flex-1 flex items-center justify-center pl-4 py-2">
        <img
          src={logoSppgImg}
          alt="Watermark"
          className="absolute inset-0 m-auto w-12 h-12 object-contain opacity-15 pointer-events-none"
        />
        <span className="relative z-10 font-extrabold text-sm sm:text-base tracking-tight uppercase text-center">
          {sppgName}
        </span>
      </div>
    </article>
  );

  const sheets = Array.from({ length: Math.max(1, sheetCount) });

  return (
    <div className="space-y-6 meal-box-labels-wrapper">
      <style>{`
        @media print {
          .meal-sheet-page {
            break-after: page;
            page-break-after: always;
            padding: 8mm 6mm !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .meal-sheet-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Header Info & Showcase Contoh Semua Model (no-print) */}
      <div className="no-print space-y-3">
        {/* Banner Status Model Aktif */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">{modelInfo.name}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                {modelInfo.badge}
              </span>
              <button
                type="button"
                onClick={() => setShowModelComparison(prev => !prev)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold underline underline-offset-2 ml-1 cursor-pointer"
              >
                {showModelComparison ? 'Sembunyikan Contoh Model' : 'Lihat Contoh Semua Model'}
              </button>
            </div>
            <p className="text-slate-600 mt-1">{modelInfo.description}</p>
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-slate-500 text-[11px]">Kapasitas cetak</p>
            <p className="text-sm font-bold text-slate-900 font-mono">
              {modelInfo.perSheet} pcs / lembar A4 · Total {totalLabels} pcs ({sheetCount} lembar)
            </p>
          </div>
        </div>

        {/* Panel Contoh & Perbandingan Masing-Masing Model */}
        {showModelComparison && (
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-100 pb-2">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                  Contoh & Perbandingan Desain Model Stiker Segel
                </h2>
                <p className="text-[11px] text-slate-500">
                  Berikut contoh nyata 1 stiker untuk setiap model. Klik kartu untuk beralih dan melihat hasil 1 lembar A4 penuh.
                </p>
              </div>
              <span className="text-[10px] text-slate-400">Ukuran kertas: A4 Standar</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
              {/* Card 1: Model B (3 Kolom) - Rekomendasi */}
              <div
                onClick={() => onModelChange?.('MODEL_B')}
                className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  layoutModel === 'MODEL_B'
                    ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900">1. Model B · 3 Kolom (30 pcs/A4)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                      Rekomendasi
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Ukuran: ~63 mm × 27 mm · Efisiensi 3× lipat lebih hemat dari format asli.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Tata letak 2 kolom internal (jam konsumsi + larangan) proporsional untuk tutup kotak makan.
                  </p>
                </div>

                {/* Live Sample Model B */}
                <div className="p-2 bg-white rounded border border-slate-300 shadow-xs max-w-[260px]">
                  {renderModelB(1001)}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-[10px] font-mono text-slate-500">Kapasitas: 30 label/A4</span>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${
                      layoutModel === 'MODEL_B'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {layoutModel === 'MODEL_B' ? 'Sedang Dipilih' : 'Pilih Model B'}
                  </button>
                </div>
              </div>

              {/* Card 2: Model A (2 Kolom) - Pita Segel */}
              <div
                onClick={() => onModelChange?.('MODEL_A')}
                className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  layoutModel === 'MODEL_A'
                    ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900">2. Model A · 2 Kolom (22 pcs/A4)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                      Pita Segel
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Ukuran: ~96 mm × 25 mm · Efisiensi 2,2× lipat lebih hemat dari format asli.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Format pita horizontal memanjang, sangat cocok direkatkan melintang di sela tutup wadah.
                  </p>
                </div>

                {/* Live Sample Model A */}
                <div className="p-2 bg-white rounded border border-slate-300 shadow-xs">
                  {renderModelA(1002)}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-[10px] font-mono text-slate-500">Kapasitas: 22 label/A4</span>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${
                      layoutModel === 'MODEL_A'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {layoutModel === 'MODEL_A' ? 'Sedang Dipilih' : 'Pilih Model A'}
                  </button>
                </div>
              </div>

              {/* Card 3: Model C (4 Kolom) - Mini Badge */}
              <div
                onClick={() => onModelChange?.('MODEL_C')}
                className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  layoutModel === 'MODEL_C'
                    ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900">3. Model C · 4 Kolom (36 pcs/A4)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                      Maksimal Hemat
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Ukuran: ~48 mm × 30 mm · Efisiensi 3,6× lipat lebih hemat dari format asli.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Bentuk badge vertikal ringkas, ideal untuk snack box kecil atau stiker segel sudut.
                  </p>
                </div>

                {/* Live Sample Model C */}
                <div className="p-2 bg-white rounded border border-slate-300 shadow-xs max-w-[200px]">
                  {renderModelC(1003)}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-[10px] font-mono text-slate-500">Kapasitas: 36 label/A4</span>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${
                      layoutModel === 'MODEL_C'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {layoutModel === 'MODEL_C' ? 'Sedang Dipilih' : 'Pilih Model C'}
                  </button>
                </div>
              </div>

              {/* Card 4: Format Asli (1 Kolom) - Legacy */}
              <div
                onClick={() => onModelChange?.('MODEL_LEGACY')}
                className={`p-3 rounded-lg border-2 transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                  layoutModel === 'MODEL_LEGACY'
                    ? 'border-emerald-600 bg-emerald-50/30 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-slate-900">4. Format Asli · 1 Kolom (10 pcs/A4)</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      Format Lama
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Ukuran: ~190 mm × 27 mm · Sesuai persis dengan file PDF lama (hanya muat 10 label).
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Membentang penuh selebar lembar A4, boros kertas dibanding model desain baru.
                  </p>
                </div>

                {/* Live Sample Format Asli */}
                <div className="p-2 bg-white rounded border border-slate-300 shadow-xs overflow-x-auto">
                  {renderModelLegacy(1004)}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                  <span className="text-[10px] font-mono text-slate-500">Kapasitas: 10 label/A4</span>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded text-xs font-semibold ${
                      layoutModel === 'MODEL_LEGACY'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {layoutModel === 'MODEL_LEGACY' ? 'Sedang Dipilih' : 'Pilih Format Asli'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Render Lembar-Lembar A4 */}
      {sheets.map((_, sheetIdx) => (
        <div
          key={sheetIdx}
          className="meal-sheet-page bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-xs max-w-[210mm] mx-auto"
        >
          {/* Header Penanda Lembar di Layar */}
          {sheetCount > 1 && (
            <div className="no-print pb-2 mb-2 border-b border-slate-100 text-[11px] text-slate-400 flex justify-between">
              <span>Lembar ke-{sheetIdx + 1} dari {sheetCount}</span>
              <span>{modelInfo.perSheet} label pada lembar ini</span>
            </div>
          )}

          {/* Grid Label */}
          <div
            className={`grid gap-1 print:gap-1 ${
              modelInfo.cols === 3
                ? 'grid-cols-3'
                : modelInfo.cols === 2
                ? 'grid-cols-2'
                : modelInfo.cols === 4
                ? 'grid-cols-4'
                : 'grid-cols-1 divide-y divide-black'
            }`}
          >
            {Array.from({ length: modelInfo.perSheet }).map((_, itemIdx) => {
              const globalIdx = sheetIdx * modelInfo.perSheet + itemIdx;
              if (layoutModel === 'MODEL_B') return renderModelB(globalIdx);
              if (layoutModel === 'MODEL_A') return renderModelA(globalIdx);
              if (layoutModel === 'MODEL_C') return renderModelC(globalIdx);
              return renderModelLegacy(globalIdx);
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
