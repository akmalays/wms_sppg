import React, { useMemo } from 'react';
import logoSppgImg from '../../assets/logo sppg.png';
import { QrSvg } from '../common/QrSvg';

// Desain mengikuti stiker segel lama (PDF "SPPG MALANG TUMPANG JERU"): hitam di atas putih supaya tetap jelas
// di printer hitam-putih, jam konsumsi paling besar, nama SPPG dengan logo BGN samar di belakangnya.

export type MealBoxLabelModel = 'STRIP_1' | 'STRIP_2' | 'GRID_3' | 'GRID_4';

type StickerLayout = 'ROW' | 'SPLIT' | 'STACK';

export interface MealBoxLabelModelInfo {
  id: MealBoxLabelModel;
  name: string;
  hint: string;
  cols: number;
  rows: number;
  perSheet: number;
  widthMm: number;
  heightMm: number;
  layout: StickerLayout;
}

// Area cetak A4 dengan @page margin 8 mm: 194 x 281 mm. Tinggi total dibuat <= 280 mm agar tidak meluber ke halaman berikut.
const SHEET_WIDTH_MM = 194;

const model = (
  id: MealBoxLabelModel,
  name: string,
  hint: string,
  cols: number,
  rows: number,
  heightMm: number,
  layout: StickerLayout
): MealBoxLabelModelInfo => ({
  id,
  name,
  hint,
  cols,
  rows,
  perSheet: cols * rows,
  widthMm: Math.floor((SHEET_WIDTH_MM / cols) * 10) / 10,
  heightMm,
  layout,
});

export const MEAL_BOX_MODELS: MealBoxLabelModelInfo[] = [
  model('STRIP_1', 'Pita lebar', 'Sama dengan stiker lama, melintang penuh di tutup ompreng.', 1, 10, 28, 'ROW'),
  model('STRIP_2', 'Pita pendek', 'Pita melintang untuk kotak makan yang lebih kecil.', 2, 11, 25.4, 'ROW'),
  model('GRID_3', 'Kotak sedang', 'Ditempel di tengah tutup, bukan melintang.', 3, 10, 28, 'SPLIT'),
  model('GRID_4', 'Kotak kecil', 'Untuk snack box atau sudut tutup.', 4, 9, 31, 'STACK'),
];

export const findMealBoxModel = (id: MealBoxLabelModel) => MEAL_BOX_MODELS.find(m => m.id === id) || MEAL_BOX_MODELS[0];

export const formatMm = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 1 });

interface MealBoxLabelDocProps {
  layoutModel: MealBoxLabelModel;
  consumeTime: string;
  sppgName: string;
  sheetCount: number;
  showCutLines: boolean;
  includeQrCode?: boolean;
  showDoodle?: boolean;
  qrUrl?: string;
  onCountChange?: (count: number) => void;
}

// Lingkaran berisi garpu dan sendok, seperti di stiker lama.
const UtensilsIcon: React.FC<{ size: string }> = ({ size }) => (
  <svg viewBox="0 0 48 48" fill="none" style={{ width: size, height: size }} className="shrink-0" aria-hidden="true">
    <circle cx="24" cy="24" r="21.5" stroke="currentColor" strokeWidth="2.5" />
    <path d="M17 12v8.5a3 3 0 003 3V37M23 12v8.5a3 3 0 01-3 3M20 12v8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M30.5 12c-2.4 0-3.8 3.2-3.8 6.4 0 2.8 1.4 5 3.8 5s3.8-2.2 3.8-5c0-3.2-1.4-6.4-3.8-6.4zM30.5 23.4V37" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

// Kotak makan dengan tanda silang di kiri: dilarang dipindah ke wadah lain.
const NoTakeawayIcon: React.FC<{ size: string }> = ({ size }) => (
  <svg viewBox="0 0 64 40" fill="none" style={{ width: `calc(${size} * 1.6)`, height: size }} className="shrink-0" aria-hidden="true">
    <rect x="22" y="15" width="38" height="20" rx="4" stroke="currentColor" strokeWidth="2.4" />
    <path d="M24 15l3-6h28l3 6M22 21h38" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
    <path d="M38 9v-3h6v3" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="16" cy="20" r="13.5" fill="#fff" stroke="currentColor" strokeWidth="2.6" />
    <path d="M10.5 14.5l11 11M21.5 14.5l-11 11" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" />
  </svg>
);

// Hiasan doodle makanan di tepi kiri pita, menggantikan pola gambar di stiker lama. Satu ubin 32 x 32 unit;
// garisnya tipis agar tidak bersaing dengan teks, dan hitam penuh agar printer hitam-putih tidak mencetaknya sebagai titik halftone.
const DOODLE_TILE = (
  <g fill="none" stroke="#000" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round">
    {/* mangkuk nasi berasap */}
    <path d="M2 10h11a5.5 5 0 01-11 0z" />
    <path d="M5 7.5q1-1.5 0-3M8 7.5q1-1.5 0-3M11 7.5q1-1.5 0-3" />
    {/* apel */}
    <path d="M24 6.5c-3-2-6 1-5 4s3 5 5 4c2 1 4-1 5-4s-2-6-5-4z" />
    <path d="M24 6.5V4M24 4.5q2-2 4-1q-2 2-4 1z" />
    {/* ikan */}
    <path d="M2 22q5-5 10 0q-5 5-10 0zM12 22l3-3v6z" />
    <circle cx="4.8" cy="21.3" r="0.5" />
    {/* cangkir susu */}
    <path d="M19 17.5h8l-1 7.5h-6zM27 19.5q3 0 2 3q-1 1.5-2.5 1" />
    {/* wortel */}
    <path d="M7 31l6-6 1.5 1.5zM13 25l2-2M13.8 25.7l2.4-1M13 25l.8-2.6" />
    {/* telur ceplok */}
    <path d="M21.5 29c0-3 4-4 6-2 3 0 3 4 0 4-1 2-5 2-6-2z" />
    <circle cx="25" cy="28.6" r="1.2" />
    {/* titik pengisi */}
    <circle cx="16" cy="12" r="0.5" fill="#000" />
    <circle cx="30.5" cy="13" r="0.5" fill="#000" />
    <circle cx="16.5" cy="30" r="0.5" fill="#000" />
  </g>
);

// Ubin digambar satu per satu, bukan lewat <pattern>: Chrome mencetak <pattern> sebagai bitmap sehingga garisnya kabur.
const DoodleStrip: React.FC<{ widthMm: number; heightMm: number; tileMm: number }> = ({ widthMm, heightMm, tileMm }) => {
  const u = 32 / tileMm; // unit SVG per mm
  const cols = Math.ceil(widthMm / tileMm);
  const rows = Math.ceil(heightMm / tileMm);
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${widthMm * u} ${heightMm * u}`}
      style={{ width: `${widthMm}mm`, height: `${heightMm}mm` }}
      className="block shrink-0"
    >
      {Array.from({ length: cols * rows }, (_, i) => (
        <g key={i} transform={`translate(${(i % cols) * 32} ${Math.floor(i / cols) * 32})`}>
          {DOODLE_TILE}
        </g>
      ))}
    </svg>
  );
};

// Ukuran huruf per bentuk stiker, dalam pt agar hasil cetak sama dengan ukuran fisiknya.
const TYPE: Record<MealBoxLabelModel, { icon: string; small: string; time: string; name: string; qr: string }> = {
  STRIP_1: { icon: '9mm', small: '7pt', time: '15pt', name: '15pt', qr: '17mm' },
  STRIP_2: { icon: '6.5mm', small: '5.6pt', time: '11pt', name: '8pt', qr: '13mm' },
  GRID_3: { icon: '6mm', small: '5.6pt', time: '11pt', name: '8pt', qr: '10mm' },
  GRID_4: { icon: '5.5mm', small: '5.6pt', time: '12pt', name: '6pt', qr: '10mm' },
};

const StickerBody: React.FC<{
  info: MealBoxLabelModelInfo;
  consumeTime: string;
  sppgName: string;
  qrValue: string | null;
  showDoodle: boolean;
}> = ({ info, consumeTime, sppgName, qrValue, showDoodle }) => {
  const t = TYPE[info.id];
  const time = consumeTime.trim() || '....';
  const name = sppgName.trim();

  const consumeBlock = (
    <div className="flex flex-col items-center text-center leading-none whitespace-nowrap">
      <UtensilsIcon size={t.icon} />
      <p className="font-bold mt-[0.8mm]" style={{ fontSize: t.small }}>SEGERA DIKONSUMSI</p>
      <p className="font-bold mt-[0.4mm]" style={{ fontSize: t.small }}>SEBELUM PUKUL</p>
      <p className="font-extrabold tabular-nums mt-[0.8mm]" style={{ fontSize: t.time }}>{time}</p>
    </div>
  );

  const banBlock = (
    <div className="flex flex-col items-center text-center leading-[1.15] whitespace-nowrap">
      <NoTakeawayIcon size={t.icon} />
      <p className="font-bold mt-[0.8mm]" style={{ fontSize: t.small }}>DILARANG DIBAWA</p>
      <p className="font-bold" style={{ fontSize: t.small }}>PULANG/DIPINDAH KE</p>
      <p className="font-bold" style={{ fontSize: t.small }}>KOTAK MAKAN/FOAM</p>
    </div>
  );

  const nameBlock = (watermark: string) => (
    <div className="relative flex-1 min-w-0 self-stretch flex items-center justify-center">
      <img
        src={logoSppgImg}
        alt=""
        className="absolute inset-0 m-auto object-contain opacity-20 pointer-events-none"
        style={{ width: watermark, height: watermark }}
      />
      <p className="relative font-extrabold uppercase text-center leading-tight text-balance" style={{ fontSize: t.name }}>
        {name}
      </p>
    </div>
  );

  const qrBlock = qrValue && (
    <div className="flex flex-col items-center shrink-0 leading-none">
      <div className="shrink-0" style={{ width: t.qr, height: t.qr }}><QrSvg value={qrValue} className="w-full h-full" color="#000" /></div>
      <p className="font-bold text-center leading-[1.1] mt-[0.6mm]" style={{ fontSize: '5.4pt' }}>
        MENU
        <br />
        HARI INI
      </p>
    </div>
  );

  if (info.layout === 'ROW') {
    const wide = info.id === 'STRIP_1';
    const doodleMm = wide ? 14 : 5;
    return (
      <div className={`h-full flex items-center ${wide ? 'gap-[3mm]' : 'gap-[2mm]'} ${showDoodle ? 'pr-[3mm]' : 'px-[3mm]'}`}>
        {showDoodle && <DoodleStrip widthMm={doodleMm} heightMm={info.heightMm} tileMm={wide ? 12.5 : 9} />}
        <div className={`flex items-start shrink-0 ${wide ? 'gap-[3mm]' : 'gap-[2mm]'}`}>
          {consumeBlock}
          {banBlock}
        </div>
        {nameBlock(wide ? '24mm' : '20mm')}
        {qrBlock}
      </div>
    );
  }

  if (info.layout === 'SPLIT') {
    return (
      <div className="h-full flex flex-col px-[2mm] py-[1.5mm]">
        <div className="flex items-center justify-center gap-[1.5mm] border-b border-black pb-[1mm]">
          <img src={logoSppgImg} alt="" className="w-[4mm] h-[4mm] object-contain shrink-0" />
          <p className="font-extrabold uppercase truncate leading-none" style={{ fontSize: t.name }}>{name}</p>
        </div>
        <div className="flex-1 flex items-center justify-around gap-[1.5mm] pt-[1mm]">
          <div className="flex items-start justify-around gap-[1.5mm] flex-1">
            {consumeBlock}
            {banBlock}
          </div>
          {qrBlock}
        </div>
      </div>
    );
  }

  // STACK: stiker kecil, jam konsumsi dan larangan disusun bertingkat agar huruf tidak mengecil.
  return (
    <div className="h-full flex flex-col px-[2mm] py-[1.5mm] leading-none">
      <div className="flex items-center justify-center gap-[1.2mm] border-b border-black pb-[1mm]">
        <img src={logoSppgImg} alt="" className="w-[3.5mm] h-[3.5mm] object-contain shrink-0" />
        <p className="font-extrabold uppercase truncate" style={{ fontSize: t.name }}>{name}</p>
      </div>
      <div className="flex-1 flex items-center gap-[1.5mm] py-[1mm]">
        <UtensilsIcon size={t.icon} />
        <div className="flex-1 min-w-0">
          <p className="font-bold" style={{ fontSize: t.small }}>SEGERA DIKONSUMSI</p>
          <p className="font-bold mt-[0.4mm]" style={{ fontSize: t.small }}>SEBELUM PUKUL</p>
          <p className="font-extrabold tabular-nums mt-[0.6mm]" style={{ fontSize: t.time }}>{time}</p>
        </div>
        {qrValue && <div className="shrink-0" style={{ width: t.qr, height: t.qr }}><QrSvg value={qrValue} className="w-full h-full" color="#000" /></div>}
      </div>
      <div className="flex items-center gap-[1.5mm] border-t border-black pt-[1mm]">
        <NoTakeawayIcon size="3.6mm" />
        <p className="font-bold leading-[1.15]" style={{ fontSize: t.small }}>
          DILARANG DIBAWA PULANG / DIPINDAH KE KOTAK MAKAN/FOAM
        </p>
      </div>
    </div>
  );
};

export const MealBoxLabelDoc: React.FC<MealBoxLabelDocProps> = ({
  layoutModel,
  consumeTime,
  sppgName,
  sheetCount,
  showCutLines,
  includeQrCode = false,
  showDoodle = true,
  qrUrl,
  onCountChange,
}) => {
  const info = findMealBoxModel(layoutModel);
  const sheets = Math.max(1, sheetCount);
  const totalLabels = info.perSheet * sheets;
  const qrValue = includeQrCode && qrUrl ? qrUrl : null;

  React.useEffect(() => {
    onCountChange?.(totalLabels);
  }, [totalLabels, onCountChange]);

  // Garis potong: tepi atas-kiri di wadah, tepi kanan-bawah di tiap stiker, supaya garis antar-stiker tidak dobel.
  const lineCls = showCutLines ? 'border-dashed border-slate-500' : 'border-transparent';

  const gridStyle = useMemo<React.CSSProperties>(
    () => ({
      width: `${info.widthMm * info.cols}mm`,
      gridTemplateColumns: `repeat(${info.cols}, ${info.widthMm}mm)`,
      gridTemplateRows: `repeat(${info.rows}, ${info.heightMm}mm)`,
    }),
    [info]
  );

  return (
    <div className="meal-box-labels">
      <style>{`
        @media print {
          .meal-sheet { break-after: page; page-break-after: always; margin: 0 !important; box-shadow: none !important; }
          .meal-sheet:last-child { break-after: auto; page-break-after: auto; }
        }
      `}</style>

      <p className="no-print text-xs text-slate-600 mb-3">
        Stiker {formatMm(info.widthMm)} × {formatMm(info.heightMm)} mm, {info.perSheet} per lembar A4.
        {sheets > 1 && ` ${sheets} lembar, total ${totalLabels} stiker.`}
        {' '}Cetak dengan skala 100% (jangan "Fit to page") agar ukurannya pas.
      </p>

      <div className="overflow-x-auto">
        {Array.from({ length: sheets }).map((_, sheetIdx) => (
          <div key={sheetIdx} className="meal-sheet mx-auto mb-6 last:mb-0 w-fit">
            {sheets > 1 && (
              <p className="no-print text-[11px] text-slate-500 mb-1">Lembar {sheetIdx + 1} dari {sheets}</p>
            )}
            <div className={`grid bg-white text-black border-t border-l ${lineCls}`} style={gridStyle}>
              {Array.from({ length: info.perSheet }).map((__, i) => (
                <article key={i} className={`overflow-hidden border-r border-b ${lineCls}`}>
                  <StickerBody info={info} consumeTime={consumeTime} sppgName={sppgName} qrValue={qrValue} showDoodle={showDoodle} />
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
