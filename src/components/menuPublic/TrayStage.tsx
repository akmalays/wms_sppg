import React, { useEffect, useMemo, useState } from 'react';
import type { TrayLabelPlacement, WebsiteMenuTodayConfig } from '../../db/websiteConfigStorage';
import {
  arrowPaths,
  GREEN_TRAY_BAND,
  GREEN_TRAY_BOX,
  GREEN_TRAY_CENTER,
  greenLabelTexts,
  labelLines,
  photoPointToBox,
  placedArrow,
  type LabelPlacement,
} from '../print/menuPosterDesigns';

// "+" tetap satu hidangan, sama seperti poster (mis. "tumis labu siam+jagung").
const splitDishes = (text: string) => text.split(/[,;\n]|\s+dan\s+/i).map(s => s.trim()).filter(Boolean);

/** Daftar hidangan halaman publik. Rincian bahan bisa berisi bahan belanja dari PO, jadi hanya dipakai bila judul menu bukan daftar hidangan. */
export function menuDishes(menu: Pick<WebsiteMenuTodayConfig, 'menuTitle' | 'menuB3' | 'ingredients'>): { regular: string[]; b3: string[] } {
  const title = splitDishes(menu.menuTitle);
  return {
    regular: title.length > 1 || menu.ingredients.length === 0 ? title : menu.ingredients.map(i => i.name),
    b3: splitDishes(menu.menuB3 || ''),
  };
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// Ompreng di halaman ini lebih besar daripada di poster, jadi nama hidangan didorong ke tepi. Letak tersimpan memakai
// koordinat panggung ini; letak dari poster diubah dulu lewat posterLabelToStage.
const TRAY_SCALE = 1.4;
const STAGE_BOX = { w: GREEN_TRAY_BOX.w * TRAY_SCALE, h: GREEN_TRAY_BOX.h * TRAY_SCALE };
const [CX, CY] = GREEN_TRAY_CENTER;
const STAGE_LABEL_X = [125, GREEN_TRAY_BAND.w - 125];
const STAGE_LABEL_Y = [GREEN_TRAY_BAND.y + 40, GREEN_TRAY_BAND.y + GREEN_TRAY_BAND.h - 40];
const STAGE_LABEL_WRAP = [220, 220, 220, 220, 640];

const STAGE_DEFAULTS: LabelPlacement[] = [
  { x: STAGE_LABEL_X[0], y: 1010, tipX: CX - 300, tipY: CY - 210 },
  { x: STAGE_LABEL_X[1], y: 1010, tipX: CX + 300, tipY: CY - 210 },
  { x: STAGE_LABEL_X[0], y: 1400, tipX: CX - 300, tipY: CY + 210 },
  { x: STAGE_LABEL_X[1], y: 1400, tipX: CX + 300, tipY: CY + 210 },
  { x: CX, y: STAGE_LABEL_Y[1], tipX: CX, tipY: CY + 280 },
];

const clampTo = (v: number, [from, to]: number[]) => Math.min(to, Math.max(from, v));

/** Ubah letak label poster Hijau 1 menu ke panggung: titik makanan ikut membesar bersama ompreng, teks tetap di dalam panggung. */
export function posterLabelToStage(p: LabelPlacement): LabelPlacement {
  const scaleX = (x: number) => Math.round(CX + (x - CX) * TRAY_SCALE);
  const scaleY = (y: number) => Math.round(CY + (y - CY) * TRAY_SCALE);
  return { x: clampTo(scaleX(p.x), STAGE_LABEL_X), y: clampTo(scaleY(p.y), STAGE_LABEL_Y), tipX: scaleX(p.tipX), tipY: scaleY(p.tipY) };
}

/** Titik di foto ke koordinat panggung, dengan aturan putar yang sama seperti saat foto digambar. */
export function photoPointToStage(point: { nx: number; ny: number }, natural: { w: number; h: number }): { x: number; y: number } {
  const rotated = natural.w <= natural.h;
  return photoPointToBox(point, natural, { cx: CX, cy: CY, w: rotated ? STAGE_BOX.w : STAGE_BOX.h, h: rotated ? STAGE_BOX.h : STAGE_BOX.w }, rotated);
}

/** Letak tiap label: yang tersimpan untuk hidangan itu, atau letak bawaan bila hidangannya berganti. */
export function resolveTrayLabels(texts: string[], saved: TrayLabelPlacement[] | null | undefined): LabelPlacement[] {
  return texts.map((text, i) => {
    const hit = saved?.find(l => sameText(l.text, text));
    return hit ? { x: hit.x, y: hit.y, tipX: hit.tipX, tipY: hit.tipY } : STAGE_DEFAULTS[i];
  });
}

export { greenLabelTexts as trayLabelTexts, GREEN_TRAY_BAND as TRAY_STAGE_VIEW };

const LABEL_FONT = (px: number) => `700 ${px}px "Baloo 2", sans-serif`;
const ARROW_WIDTH = 8;

let measureCtx: CanvasRenderingContext2D | null = null;
const getMeasureCtx = () => (measureCtx ??= document.createElement('canvas').getContext('2d'));

interface TrayStageProps {
  photo: string;
  fallbackPhoto?: string;
  alt: string;
  texts: string[];
  placements: LabelPlacement[];
  /** Ilustrasi berlatar putih: tidak diputar, tanpa bayangan potongan, tanpa panah karena tidak ada makanan yang ditunjuk. */
  plain?: boolean;
  compact?: boolean;
}

/**
 * Ompreng dan nama hidangan dengan letak yang sama seperti poster Hijau. Koordinatnya koordinat poster, jadi letak
 * yang digeser di modul poster langsung berlaku di sini.
 */
export const TrayStage: React.FC<TrayStageProps> = ({ photo, fallbackPhoto, alt, texts, placements, plain, compact }) => {
  const [failed, setFailed] = useState(false);
  const [natural, setNatural] = useState({ w: 3, h: 4 });
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  useEffect(() => {
    let live = true;
    document.fonts?.load(LABEL_FONT(46)).finally(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, []);

  const src = failed && fallbackPhoto ? fallbackPhoto : photo;
  // Foto tegak diputar agar nampan mendatar seperti di poster; foto yang sudah mendatar dibiarkan.
  const rotate = !plain && natural.w <= natural.h;
  const boxW = rotate ? STAGE_BOX.w : STAGE_BOX.h;
  const boxH = rotate ? STAGE_BOX.h : STAGE_BOX.w;
  // Di layar sempit tampilan dipotong pas ke ompreng, supaya memenuhi lebar layar; nama hidangan pindah ke daftar di bawahnya.
  const fit = Math.min(boxW / natural.w, boxH / natural.h);
  const shownW = (rotate ? natural.h : natural.w) * fit;
  const shownH = (rotate ? natural.w : natural.h) * fit;
  const view = compact
    ? { x: CX - shownW / 2 - 30, y: CY - shownH / 2 - 30, w: shownW + 60, h: shownH + 60 }
    : GREEN_TRAY_BAND;

  const labels = useMemo(() => {
    const ctx = getMeasureCtx();
    if (compact || !ctx) return [];
    return texts.map((text, i) => {
      const { lines, px } = labelLines(ctx, text, STAGE_LABEL_WRAP[i] ?? 220, 46, 30, LABEL_FONT);
      ctx.font = LABEL_FONT(px);
      const halfW = Math.max(...lines.map(l => ctx.measureText(l).width)) / 2;
      const halfH = (lines.length * px * 1.15) / 2;
      const arrow = placements[i] ? placedArrow(placements[i], halfW, halfH, GREEN_TRAY_CENTER) : null;
      return { text, lines, px, arrow: arrow && arrowPaths(arrow.x1, arrow.y1, arrow.x2, arrow.y2, arrow.bend, ARROW_WIDTH) };
    });
    // fontsReady: ukur ulang setelah Baloo 2 termuat.
  }, [compact, texts, placements, fontsReady]);

  const clamp = (v: number, from: number, size: number) => Math.min(from + size - 34, Math.max(from + 34, v));

  return (
    <div className="relative w-full" style={{ aspectRatio: `${view.w} / ${view.h}` }}>
      {/* Bayangan di pembungkus yang tidak berputar, supaya jatuhnya tetap ke bawah. */}
      <div className={`absolute inset-0 ${plain ? '' : '[filter:drop-shadow(0_18px_22px_rgba(6,40,44,0.45))]'}`}>
        <div
          className="absolute"
          style={{
            left: `${((CX - view.x) / view.w) * 100}%`,
            top: `${((CY - view.y) / view.h) * 100}%`,
            width: `${(boxW / view.w) * 100}%`,
            height: `${(boxH / view.h) * 100}%`,
            transform: `translate(-50%, -50%)${rotate ? ' rotate(-90deg)' : ''}`,
          }}
        >
          <img
            src={src}
            alt={alt}
            onLoad={e => setNatural({ w: e.currentTarget.naturalWidth || 3, h: e.currentTarget.naturalHeight || 4 })}
            onError={() => setFailed(true)}
            className={`block w-full h-full object-contain ${plain ? 'rounded-2xl bg-white' : ''}`}
          />
        </div>
      </div>
      <svg viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} aria-hidden="true" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
        {compact
          ? placements.map((p, i) => {
              const cx = clamp(p.tipX, view.x, view.w);
              const cy = clamp(p.tipY, view.y, view.h);
              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r="30" fill="#ffffff" stroke="#0d474c" strokeWidth="4" />
                  <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize="36" fontWeight="800" fill="#0d474c" className="font-kids">{i + 1}</text>
                </g>
              );
            })
          : labels.map((label, i) => {
              const p = placements[i];
              if (!p) return null;
              const lineH = label.px * 1.15;
              const firstY = p.y - ((label.lines.length - 1) * lineH) / 2;
              return (
                <g key={label.text} className="[filter:drop-shadow(0_1px_4px_rgba(8,50,54,0.7))]">
                  {label.arrow && !plain && (
                    <g fill="none" stroke="#ffffff" strokeWidth={ARROW_WIDTH} strokeLinecap="round" strokeLinejoin="round">
                      <path d={label.arrow.line} />
                      <path d={label.arrow.head} />
                    </g>
                  )}
                  <text textAnchor="middle" dominantBaseline="central" fontSize={label.px} fontWeight="700" fill="#ffffff" className="font-kids">
                    {label.lines.map((line, n) => (
                      <tspan key={n} x={p.x} y={firstY + n * lineH}>{line}</tspan>
                    ))}
                  </text>
                </g>
              );
            })}
      </svg>
    </div>
  );
};
