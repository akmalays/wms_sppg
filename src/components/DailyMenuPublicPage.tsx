import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import logoSppgImg from '../assets/logo sppg.png';
import wortelMaskotImg from '../assets/sayur_wortel_mbg.jpg';
import sawahImg from '../assets/sawah_padi.jpg';
import kebunSayurImg from '../assets/kebun_sayur.jpg';
import peternakanAyamImg from '../assets/peternakan_ayam.jpg';
import trayImg1 from '../assets/tray_sample_1.jpg';

import {
  getWebsiteConfig,
  fetchWebsiteConfigFromCloud,
  WebsiteConfig,
  WEBSITE_CONFIG_UPDATED_EVENT,
  DEFAULT_WEBSITE_CONFIG,
  HABIT_WEEKDAY_LABELS,
  IngredientNutritionInfo,
  PortionTierConfig,
  NutritionHeroConfig,
  DailyHabitItem
} from '../db/websiteConfigStorage';
import { isSupabaseConfigured } from '../lib/supabase';

import {
  X,
  Check,
  Copy,
  Share2,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Wheat,
  Dumbbell,
  Leaf,
  Sprout,
  Footprints,
  Bike,
  BookOpen,
  Lightbulb,
  Trophy,
  Clock,
  CalendarDays,
  ShieldCheck,
  PartyPopper,
  Sparkles
} from 'lucide-react';

type PortionKey = 'small' | 'large';
type SyncState = 'loading' | 'synced' | 'offline' | 'error';

const MENU_PATH = '/menu-mbg-hari-ini';

/* ------------------------------------------------------------------ */
/* Kelompok makanan Isi Piringku. Warna = kode kelompok di seluruh     */
/* halaman (piring, strip bahan, asal energi). Warna lain tidak dipakai */
/* untuk data agar kode ini tetap terbaca.                              */
/* ------------------------------------------------------------------ */
type FoodGroup = 'pokok' | 'lauk' | 'sayur' | 'buah';

const FOOD_GROUPS: Record<FoodGroup, { label: string; role: string; fill: string; soft: string; ink: string; Icon: typeof Wheat }> = {
  pokok: { label: 'Makanan pokok', role: 'Memberikan energi untuk belajar, bermain, dan beraktivitas.', fill: '#f59e0b', soft: '#fdf1d3', ink: '#8a4a05', Icon: Wheat },
  lauk: { label: 'Lauk pauk', role: 'Protein untuk membangun dan memperbaiki tubuh.', fill: '#f97316', soft: '#ffe9d6', ink: '#9a3412', Icon: Dumbbell },
  sayur: { label: 'Sayuran', role: 'Vitamin, mineral, dan serat agar tubuh tidak mudah sakit.', fill: '#22c55e', soft: '#dcf5e3', ink: '#166534', Icon: Leaf },
  buah: { label: 'Buah', role: 'Vitamin dan serat yang menyegarkan tubuh.', fill: '#ec4899', soft: '#fce4f0', ink: '#9d174d', Icon: Sprout }
};

// Proporsi Isi Piringku Kemenkes: setengah piring sayur + buah, setengah lagi makanan pokok + lauk pauk,
// masing-masing 2/3 dan 1/3 dari setengahnya. Sudut searah jarum jam dari arah jam 12.
const PLATE_SECTORS: { group: FoodGroup; from: number; to: number }[] = [
  { group: 'sayur', from: 0, to: 120 },
  { group: 'buah', from: 120, to: 180 },
  { group: 'lauk', from: 180, to: 240 },
  { group: 'pokok', from: 240, to: 360 }
];

function groupOfCategory(category: string): FoodGroup | null {
  const c = category.toLowerCase();
  if (c.includes('karbo') || c.includes('pokok')) return 'pokok';
  if (c.includes('protein') || c.includes('lauk')) return 'lauk';
  if (c.includes('sayur')) return 'sayur';
  if (c.includes('buah')) return 'buah';
  return null;
}

// Foto ilustrasi lahan untuk tab "Asal bahan"; diberi keterangan bahwa ini bukan lokasi pemasok.
function originIllustration(category: string): string | null {
  const c = category.toLowerCase();
  if (c.includes('hewani')) return peternakanAyamImg;
  const group = groupOfCategory(category);
  if (group === 'pokok') return sawahImg;
  if (group === 'sayur') return kebunSayurImg;
  return null;
}

/* ------------------------------------------------------------------ */
/* Perkiraan energi setara aktivitas                                   */
/* menit = kkal / (MET x 3,5 x berat badan / 200)                       */
/* MET dari Compendium of Physical Activities 2011 (Ainsworth dkk.):    */
/* jogging umum 7,0; bersepeda santai < 16 km/jam 4,0; duduk membaca 1,3 */
/* ------------------------------------------------------------------ */
const ACTIVITIES = [
  { label: 'Berlari', met: 7.0, Icon: Footprints },
  { label: 'Bersepeda santai', met: 4.0, Icon: Bike },
  { label: 'Duduk membaca', met: 1.3, Icon: BookOpen }
];

function parseNumber(raw: string | undefined): number {
  if (!raw) return NaN;
  const m = raw.replace(/\s/g, '').match(/[\d.,]+/);
  if (!m) return NaN;
  return parseFloat(m[0].replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
}

function formatDuration(minutes: number): string {
  const rounded = Math.max(5, Math.round(minutes / 5) * 5);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `± ${m} menit`;
  return m === 0 ? `± ${h} jam` : `± ${h} jam ${m} menit`;
}

/* ------------------------------------------------------------------ */
/* Utilitas teks & tanggal                                             */
/* ------------------------------------------------------------------ */
const MONTHS_ID = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];

function parseIndonesianDate(text: string): Date | null {
  const match = text.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (!match) return null;
  const month = MONTHS_ID.indexOf(match[2]);
  if (month < 0) return null;
  return new Date(Number(match[3]), month, Number(match[1]));
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function splitTierName(tierName: string): { name: string; group: string } {
  const match = tierName.match(/^(.*?)\s*\((.*)\)\s*$/);
  return match ? { name: match[1], group: match[2] } : { name: tierName, group: '' };
}

// Hari ini cukup jamnya; hari lain tampilkan tanggal agar pembaca tahu datanya lama.
function formatUpdatedAt(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if (isSameDay(d, new Date())) return `Diperbarui pukul ${time}`;
  return `Diperbarui ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}, ${time}`;
}

const cleanList = (items: string[] | undefined) => (items || []).map(s => s.trim()).filter(Boolean);
const splitSentences = (text: string) => text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
const splitHighlights = (text: string) => text.split(/[•,;]/).map(s => s.trim()).filter(Boolean);
const shortName = (name: string) => name.trim().split(/\s+/)[0].toLowerCase();

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* mode privat: centang hanya bertahan selama halaman terbuka */
  }
}
function readDoneSteps(key: string): number[] {
  const raw = key ? readLocal(key) : null;
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Komponen dasar                                                      */
/* ------------------------------------------------------------------ */
const SafeImg: React.FC<React.ImgHTMLAttributes<HTMLImageElement> & { fallbackSrc?: string }> = ({ src, alt, className, fallbackSrc, ...rest }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const finalSrc = !src || failed ? fallbackSrc : src;
  if (!finalSrc) {
    return <div role={alt ? 'img' : undefined} aria-label={alt || undefined} className={`${className ?? ''} bg-[#efe9dd]`} />;
  }
  return <img src={finalSrc} alt={alt} className={className} onError={() => setFailed(true)} {...rest} />;
};

const GroupChip: React.FC<{ category: string; className?: string }> = ({ category, className = '' }) => {
  const group = groupOfCategory(category);
  const style = group ? { backgroundColor: FOOD_GROUPS[group].soft, color: FOOD_GROUPS[group].ink } : undefined;
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-700 ${className}`} style={style}>
      {category}
    </span>
  );
};

const SectionHead: React.FC<{ id: string; title: string; eyebrow?: string; subtitle?: string }> = ({ id, title, eyebrow, subtitle }) => (
  <div className="mb-4">
    {eyebrow && <p className="text-[13px] font-bold text-slate-600">{eyebrow}</p>}
    <h2 id={id} className="font-kids text-[26px] sm:text-3xl font-bold leading-tight">{title}</h2>
    {subtitle && <p className="text-sm text-slate-600 mt-0.5">{subtitle}</p>}
  </div>
);

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803d] focus-visible:ring-offset-2';
const cardCls = 'min-w-0 rounded-3xl bg-white border border-[#e9e0cc] p-4 sm:p-6 scroll-mt-28';

function useEscape(onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, active]);
}

/* ------------------------------------------------------------------ */
/* Detail bahan (lembar dari bawah di HP, dialog di desktop)            */
/* ------------------------------------------------------------------ */
type DetailTab = 'manfaat' | 'kandungan' | 'asal';

const IngredientSheet: React.FC<{
  ingredients: IngredientNutritionInfo[];
  index: number;
  portion: PortionKey;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}> = ({ ingredients, index, portion, onIndexChange, onClose }) => {
  const item = ingredients[index];
  const [tab, setTab] = useState<DetailTab>('manfaat');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEscape(onClose, true);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);
  useEffect(() => setTab('manfaat'), [index]);

  if (!item) return null;

  const whyGood = cleanList(item.whyGood).length ? cleanList(item.whyGood) : splitSentences(item.healthBenefits);
  const highlights = splitHighlights(item.nutritionHighlight);
  const origin = originIllustration(item.category);
  const group = groupOfCategory(item.category);
  const tint = group ? FOOD_GROUPS[group] : FOOD_GROUPS.lauk;
  const tabs: { key: DetailTab; label: string }[] = [
    { key: 'manfaat', label: 'Manfaat' },
    { key: 'kandungan', label: 'Kandungan gizi' },
    { key: 'asal', label: 'Asal bahan' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#0a1e12]/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ingredient-title"
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg max-h-[90dvh] sm:max-h-[92vh] rounded-t-3xl sm:rounded-3xl overflow-y-auto flex flex-col"
      >
        <div className="relative shrink-0">
          <SafeImg src={item.imageUrl} alt={`Foto ${item.name}`} className="w-full aspect-[16/9] object-cover rounded-t-3xl" />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup detail bahan"
            className={`absolute top-3 right-3 w-11 h-11 rounded-full bg-white/95 text-[#1f2a22] flex items-center justify-center shadow cursor-pointer ${focusRing}`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-5 flex-1">
          <GroupChip category={item.category} />
          <h2 id="ingredient-title" className="font-kids text-[28px] font-bold leading-tight mt-1.5">{item.name}</h2>
          <p className="text-sm font-semibold text-slate-600 mt-0.5 tabular-nums">
            {portion === 'large' ? item.portionLarge : item.portionSmall} · {portion === 'large' ? 'porsi besar' : 'porsi kecil'}
          </p>
          {item.notes && <p className="text-[15px] text-slate-700 mt-2 leading-relaxed">{item.notes}</p>}

          <div className="mt-4 grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#f4efe3]" role="group" aria-label="Pilih informasi">
            {tabs.map(t => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`min-h-[44px] rounded-lg text-[13px] sm:text-sm font-bold cursor-pointer transition-colors duration-150 ${focusRing} ${
                  tab === t.key ? 'bg-[#15803d] text-white' : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4" aria-live="polite">
            {tab === 'manfaat' && (
              <>
                <h3 className="text-base font-bold">Mengapa {shortName(item.name)} baik untukmu?</h3>
                {whyGood.length === 0 ? (
                  <p className="text-sm text-slate-600 mt-2">Manfaat bahan ini belum diisi petugas.</p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {whyGood.map((point, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-extrabold" style={{ backgroundColor: tint.soft, color: tint.ink }}>
                          {i + 1}
                        </span>
                        <span className="text-[15px] text-slate-800 leading-relaxed pt-1">{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {tab === 'kandungan' && (
              highlights.length === 0 ? (
                <p className="text-sm text-slate-600">Kandungan gizi bahan ini belum diisi petugas.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {highlights.map(h => (
                    <li key={h} className="inline-flex items-center gap-1.5 rounded-lg bg-[#e3f3e7] px-3 py-2 text-sm font-bold text-[#166534]">
                      <Check className="w-4 h-4 shrink-0" />
                      {h}
                    </li>
                  ))}
                </ul>
              )
            )}
            {tab === 'asal' && (
              <div className="space-y-3">
                <div className="rounded-xl bg-[#f4efe3] p-3.5">
                  <div className="text-xs font-bold text-slate-600">Pemasok</div>
                  <div className="text-base font-bold mt-0.5">{item.supplier || 'Belum diisi petugas'}</div>
                </div>
                {origin && (
                  <figure>
                    <img src={origin} alt="" loading="lazy" className="w-full h-36 rounded-xl object-cover" />
                    <figcaption className="text-xs text-slate-600 mt-1">Foto ilustrasi, bukan lokasi pemasok.</figcaption>
                  </figure>
                )}
              </div>
            )}
          </div>

          {item.funFact?.trim() && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-[#fff6e0] p-3.5">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#8a4b06]">
                  <Lightbulb className="w-4 h-4" />
                  Tahukah kamu?
                </div>
                <p className="text-sm text-slate-800 mt-1 leading-snug">{item.funFact}</p>
              </div>
              <img src={wortelMaskotImg} alt="" className="w-16 h-16 object-contain shrink-0 rounded-xl" />
            </div>
          )}
        </div>

        {ingredients.length > 1 && (
          <div className="sticky bottom-0 bg-white border-t border-[#e9e0cc] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onIndexChange((index - 1 + ingredients.length) % ingredients.length)}
              className={`inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg text-sm font-bold text-slate-800 hover:bg-[#f4efe3] cursor-pointer ${focusRing}`}
            >
              <ChevronLeft className="w-4 h-4" />
              Sebelumnya
            </button>
            <span className="text-sm text-slate-600 tabular-nums">{index + 1} / {ingredients.length}</span>
            <button
              type="button"
              onClick={() => onIndexChange((index + 1) % ingredients.length)}
              className={`inline-flex items-center gap-1 min-h-[44px] px-3 rounded-lg text-sm font-bold text-slate-800 hover:bg-[#f4efe3] cursor-pointer ${focusRing}`}
            >
              Berikutnya
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Pilihan porsi: mengubah semua angka di halaman                       */
/* ------------------------------------------------------------------ */
const PortionPicker: React.FC<{ tiers: { key: PortionKey; config: PortionTierConfig }[]; portion: PortionKey; onChange: (p: PortionKey) => void }> = ({
  tiers,
  portion,
  onChange
}) => (
  <fieldset className="min-w-0 rounded-3xl bg-white border border-[#e9e0cc] p-3">
    <legend className="sr-only">Takaran untuk</legend>
    <p className="text-[13px] font-bold text-slate-600 px-1 mb-2" aria-hidden="true">Takaran untuk</p>
    <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[#f4efe3]">
      {tiers.map(t => {
        const { name, group } = splitTierName(t.config.tierName);
        const active = portion === t.key;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(t.key)}
            className={`min-h-[56px] rounded-xl px-3 py-2 text-left cursor-pointer transition-colors duration-150 ${focusRing} ${active ? 'bg-white shadow-sm' : 'hover:bg-white/60'}`}
          >
            <span className={`block text-[15px] font-bold ${active ? 'text-[#15803d]' : 'text-slate-800'}`}>{name}</span>
            {group && <span className="block text-xs text-slate-600 leading-tight mt-0.5">{group}</span>}
          </button>
        );
      })}
    </div>
  </fieldset>
);

/* ------------------------------------------------------------------ */
/* Isi Piringku sekaligus daftar menu                                  */
/* ------------------------------------------------------------------ */
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function sectorPath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
}

const MenuPlateSection: React.FC<{ ingredients: IngredientNutritionInfo[]; portion: PortionKey; tip?: string; onOpenIngredient: (index: number) => void }> = ({
  ingredients,
  portion,
  tip,
  onOpenIngredient
}) => {
  const [selected, setSelected] = useState<FoodGroup | null>(null);
  const photoOf = (g: FoodGroup) => ingredients.find(i => groupOfCategory(i.category) === g)?.imageUrl;
  const toggle = (g: FoodGroup) => setSelected(s => (s === g ? null : g));

  return (
    <section id="menu" aria-labelledby="menu-title" className={cardCls}>
      <SectionHead id="menu-title" title="Isi piringku hari ini" subtitle="Ketuk bagian piring atau makanan untuk melihat manfaatnya." />

      <div className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] sm:grid-cols-[180px_minmax(0,1fr)] gap-4 items-center">
        <svg viewBox="0 0 240 240" className="w-full h-auto" role="group" aria-label="Piring dibagi empat: sayur sepertiga, buah seperenam, lauk pauk seperenam, makanan pokok sepertiga">
          <defs>
            {PLATE_SECTORS.map(s => (
              <clipPath key={s.group} id={`plate-${s.group}`}>
                <path d={sectorPath(120, 120, 104, s.from, s.to)} />
              </clipPath>
            ))}
          </defs>
          <circle cx="120" cy="120" r="117" fill="#ffffff" stroke="#e9e0cc" strokeWidth="3" />
          {PLATE_SECTORS.map(s => {
            const g = FOOD_GROUPS[s.group];
            const isActive = s.group === selected;
            const mid = (s.from + s.to) / 2;
            const shift = polar(0, 0, isActive ? 6 : 0, mid);
            const center = polar(120, 120, 56, mid);
            const photo = photoOf(s.group);
            return (
              <g
                key={s.group}
                role="button"
                tabIndex={0}
                aria-label={g.label}
                aria-pressed={isActive}
                onClick={() => toggle(s.group)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(s.group);
                  }
                }}
                className="cursor-pointer outline-none motion-safe:transition-[transform,opacity] motion-safe:duration-200 focus-visible:[&>path:last-child]:stroke-[#15803d]"
                style={{ transform: `translate(${shift.x}px, ${shift.y}px)`, opacity: selected && !isActive ? 0.45 : 1 }}
              >
                <path d={sectorPath(120, 120, 104, s.from, s.to)} fill={g.soft} />
                {photo && (
                  <image href={photo} x={center.x - 70} y={center.y - 70} width="140" height="140" preserveAspectRatio="xMidYMid slice" clipPath={`url(#plate-${s.group})`} />
                )}
                <path d={sectorPath(120, 120, 104, s.from, s.to)} fill="none" stroke={isActive ? g.fill : '#ffffff'} strokeWidth={isActive ? 5 : 3} />
              </g>
            );
          })}
        </svg>
        <div className="min-w-0 space-y-1.5 text-[13px]">
          {(['sayur', 'buah', 'lauk', 'pokok'] as FoodGroup[]).map(g => (
            <div key={g} className="flex items-center gap-2 font-semibold">
              <span className="w-3 h-3 rounded-[4px] shrink-0" style={{ backgroundColor: FOOD_GROUPS[g].fill }} />
              {FOOD_GROUPS[g].label}
            </div>
          ))}
          <p className="text-xs text-slate-600 leading-snug pt-1">Setengah piring sayur dan buah, setengahnya lagi makanan pokok dan lauk pauk.</p>
        </div>
      </div>

      <div aria-live="polite" className="mt-3 min-h-0">
        {selected && (
          <p className="rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: FOOD_GROUPS[selected].soft, color: FOOD_GROUPS[selected].ink }}>
            <strong>{FOOD_GROUPS[selected].label}:</strong> {FOOD_GROUPS[selected].role}
          </p>
        )}
      </div>

      {ingredients.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-[#d9cfb9] px-4 py-8 text-center text-sm text-slate-600">Rincian menu belum diisi petugas.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {ingredients.map((item, i) => {
            const group = groupOfCategory(item.category);
            const dim = selected !== null && group !== selected;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpenIngredient(i)}
                  className={`w-full grid grid-cols-[6px_56px_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-2xl border border-[#e9e0cc] bg-white pr-2.5 text-left hover:bg-[#f4efe3] cursor-pointer motion-safe:transition-[background-color,opacity] duration-150 ${focusRing} ${dim ? 'opacity-40' : ''}`}
                >
                  <span className="self-stretch" style={{ backgroundColor: group ? FOOD_GROUPS[group].fill : '#cbd5e1' }} />
                  <SafeImg src={item.imageUrl} alt="" loading="lazy" width={56} height={56} className="my-2 w-14 h-14 rounded-xl object-cover" />
                  <span className="min-w-0 py-2">
                    <span className="block text-[15px] font-bold leading-snug">{item.name}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2">
                      <GroupChip category={item.category} />
                      <span className="text-[13px] font-semibold text-slate-600 tabular-nums">{portion === 'large' ? item.portionLarge : item.portionSmall}</span>
                    </span>
                  </span>
                  <ChevronRight className="w-5 h-5 text-slate-500" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {tip?.trim() && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-[#fff6e0] p-4">
          <Lightbulb className="w-5 h-5 text-[#8a4b06] shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-extrabold text-[#8a4b06]">Tips hari ini</div>
            <p className="text-sm text-slate-800 mt-0.5 leading-snug">{tip}</p>
          </div>
        </div>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Nilai gizi: energi, asal energi, mineral, setara aktivitas          */
/* ------------------------------------------------------------------ */
const NutritionSection: React.FC<{ tier: PortionTierConfig; calcium: string; iron: string; bodyWeight?: string }> = ({ tier, calcium, iron, bodyWeight }) => {
  const kcal = parseNumber(tier.targetCalories);
  const kg = parseNumber(bodyWeight);
  const canEstimate = kcal > 0 && kg > 0;
  const { name: tierName } = splitTierName(tier.tierName);

  // Atwater: karbohidrat dan protein 4 kkal/g, lemak 9 kkal/g.
  const parts = [
    { label: 'Karbohidrat', value: tier.carbGrams, kcal: parseNumber(tier.carbGrams) * 4, color: FOOD_GROUPS.pokok.fill },
    { label: 'Protein', value: tier.proteinGrams, kcal: parseNumber(tier.proteinGrams) * 4, color: FOOD_GROUPS.lauk.fill },
    { label: 'Lemak', value: tier.fatGrams, kcal: parseNumber(tier.fatGrams) * 9, color: FOOD_GROUPS.buah.fill }
  ];
  const macroTotal = parts.reduce((sum, p) => sum + (p.kcal > 0 ? p.kcal : 0), 0);
  const energyNumber = tier.targetCalories.replace(/\s*kkal\s*/i, '');

  return (
    <section id="gizi" aria-labelledby="gizi-title" className={cardCls}>
      <SectionHead id="gizi-title" eyebrow={`${tierName} · ${tier.totalGramature}`} title="Nilai gizi satu ompreng" />

      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-kids text-[52px] font-extrabold leading-none tabular-nums">{energyNumber}</span>
        <span className="text-lg font-bold">kkal</span>
        <p className="w-full text-sm text-slate-600 mt-1">Energi total untuk belajar dan bermain sampai sore.</p>
      </div>

      {macroTotal > 0 && (
        <div className="mt-5">
          <p className="text-[13px] font-bold text-slate-600">Asal energinya</p>
          <div className="mt-2 flex h-4 gap-0.5 rounded-full overflow-hidden" aria-hidden="true">
            {parts.map(p => (
              <div key={p.label} className="motion-safe:transition-[flex-grow] motion-safe:duration-300" style={{ flexGrow: Math.max(p.kcal, 0), backgroundColor: p.color }} />
            ))}
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-2">
            {parts.map(p => (
              <div key={p.label} className="rounded-2xl bg-[#f4efe3] p-2.5 sm:p-3">
                <dt className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: p.color }} />
                  {p.label}
                </dt>
                <dd className="text-lg sm:text-xl font-extrabold tabular-nums leading-tight mt-0.5">{p.value}</dd>
                {p.kcal > 0 && <dd className="text-xs text-slate-600 tabular-nums">{Math.round((p.kcal / macroTotal) * 100)}% energi</dd>}
              </div>
            ))}
          </dl>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-3 border-t border-[#e9e0cc] pt-3 text-center">
        {[
          { label: 'Serat', value: tier.fiberGrams },
          { label: 'Kalsium*', value: calcium },
          { label: 'Zat besi*', value: iron }
        ].map((m, i) => (
          <div key={m.label} className={i > 0 ? 'border-l border-[#e9e0cc]' : ''}>
            <dd className="text-base font-extrabold tabular-nums">{m.value}</dd>
            <dt className="text-xs text-slate-600">{m.label}</dt>
          </div>
        ))}
      </dl>

      {canEstimate && (
        <div className="mt-5">
          <h3 className="text-[15px] font-bold">Energi ini kira-kira cukup untuk</h3>
          <ul className="mt-2 space-y-2">
            {ACTIVITIES.map(({ label, met, Icon }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#e3f3e7] text-[#15803d] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <span className="flex-1 text-[15px] font-semibold">{label}</span>
                <span className="text-sm font-bold tabular-nums">{formatDuration(kcal / ((met * 3.5 * kg) / 200))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-600 mt-4 leading-relaxed">
        *Rata-rata semua porsi.
        {canEstimate && ` Perkiraan aktivitas untuk anak ${String(kg).replace('.', ',')} kg (acuan AKG 2019) dengan nilai MET dari Compendium of Physical Activities 2011.`}
        {' '}Sumber data: resep dan takaran porsi SPPG Tumpang Jeru.
      </p>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Zona belajar: Pahlawan Gizi                                          */
/* ------------------------------------------------------------------ */
const NutritionHeroPanel: React.FC<{ hero: NutritionHeroConfig; ingredients: IngredientNutritionInfo[] }> = ({ hero, ingredients }) => {
  const points = cleanList(hero.points);
  const group = groupOfCategory(hero.category);
  const meta = group ? FOOD_GROUPS[group] : FOOD_GROUPS.lauk;
  const inTray = ingredients.find(i => i.name.toLowerCase().includes(hero.name.trim().toLowerCase()));
  const nutrients = cleanList(hero.keyNutrients).length ? cleanList(hero.keyNutrients) : inTray ? splitHighlights(inTray.nutritionHighlight) : [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-4 items-center rounded-2xl p-3" style={{ backgroundColor: meta.soft }}>
        <SafeImg src={hero.imageUrl} fallbackSrc={inTray?.imageUrl} alt={`Ilustrasi ${hero.name}`} className="w-28 h-28 rounded-xl object-cover bg-white" />
        <div className="min-w-0">
          <span className="inline-flex rounded-md bg-white px-2 py-0.5 text-xs font-bold" style={{ color: meta.ink }}>{hero.category}</span>
          <h3 className="font-kids text-3xl font-bold leading-tight mt-1" style={{ color: meta.ink }}>{hero.name}</h3>
          <p className="text-sm text-slate-700">Pahlawan gizi hari ini</p>
        </div>
      </div>

      {points.length > 0 && (
        <ul className="space-y-2">
          {points.map(p => (
            <li key={p} className="flex items-start gap-2 text-[15px] leading-snug">
              <Check className="w-5 h-5 text-[#15803d] shrink-0 mt-px" />
              {p}
            </li>
          ))}
        </ul>
      )}

      {nutrients.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Kandungan utama">
          {nutrients.map(n => (
            <li key={n} className="rounded-lg bg-[#e3f3e7] px-2.5 py-1 text-[13px] font-bold text-[#166534]">{n}</li>
          ))}
        </ul>
      )}

      {hero.funFact?.trim() && (
        <div className="rounded-2xl bg-[#fff6e0] p-3.5">
          <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#8a4b06]">
            <Lightbulb className="w-4 h-4" />
            Tahukah kamu?
          </div>
          <p className="text-sm text-slate-800 mt-1 leading-snug">{hero.funFact}</p>
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Zona belajar: Kebiasaan baik hari ini                               */
/* ------------------------------------------------------------------ */
function pickHabit(habits: DailyHabitItem[]): DailyHabitItem | undefined {
  const filled = habits.filter(h => h.title.trim());
  const today = new Date().getDay();
  return filled.find(h => h.weekday === today) ?? [...filled].sort((a, b) => a.weekday - b.weekday)[0];
}

const HabitPanel: React.FC<{ habit: DailyHabitItem }> = ({ habit }) => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const storageKey = `mbg-habit-${todayKey}-${habit.weekday}`;
  const isToday = habit.weekday === today.getDay();

  // Centang disimpan per tanggal + hari agar besok mulai dari kosong lagi.
  const [doneByKey, setDoneByKey] = useState<Record<string, number[]>>({});
  const done = doneByKey[storageKey] ?? readDoneSteps(storageKey);

  const steps = cleanList(habit.steps);
  const allDone = steps.length > 0 && steps.every((_, i) => done.includes(i));
  const toggleStep = (i: number) => {
    const next = done.includes(i) ? done.filter(d => d !== i) : [...done, i];
    setDoneByKey(m => ({ ...m, [storageKey]: next }));
    writeLocal(storageKey, JSON.stringify(next));
  };

  return (
    <div className="space-y-3">
      {habit.imageUrl && (
        <div className="rounded-2xl bg-[#e0f2fe] overflow-hidden">
          <SafeImg src={habit.imageUrl} alt={`Ilustrasi: ${habit.title}`} loading="lazy" className="w-full aspect-[16/9] object-contain" />
        </div>
      )}
      <div>
        <p className="text-[13px] font-bold text-slate-600">Kebiasaan hari {HABIT_WEEKDAY_LABELS[habit.weekday] ?? ''}{isToday ? ' ini' : ''}</p>
        <h3 className="font-kids text-2xl font-bold leading-tight">{habit.title}</h3>
        {habit.description && <p className="text-sm text-slate-700 mt-1 leading-relaxed">{habit.description}</p>}
      </div>

      {steps.length > 0 && (
        <ol className="space-y-2">
          {steps.map((stepText, i) => {
            const checked = done.includes(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={checked}
                  onClick={() => toggleStep(i)}
                  className={`w-full min-h-[52px] flex items-center gap-3 rounded-2xl border px-3 py-2 text-left text-[15px] font-semibold transition-colors duration-150 cursor-pointer ${focusRing} ${
                    checked ? 'bg-[#15803d] border-[#15803d] text-white' : 'bg-white border-[#e9e0cc] text-slate-900 hover:bg-[#f4efe3]'
                  }`}
                >
                  <span className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-extrabold ${checked ? 'bg-white text-[#15803d]' : 'bg-[#e3f3e7] text-[#15803d]'}`}>
                    {checked ? <Check className="w-4 h-4 stroke-[3]" /> : i + 1}
                  </span>
                  <span>{stepText}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <div aria-live="polite">
        {(allDone || habit.cheer?.trim()) && (
          <div key={allDone ? 'done' : 'cheer'} className="flex items-center gap-3 rounded-2xl bg-[#e3f3e7] p-3.5 motion-safe:animate-[pop-in_300ms_ease-out]">
            {allDone ? <PartyPopper className="w-6 h-6 text-[#15803d] shrink-0" /> : <Sparkles className="w-6 h-6 text-[#15803d] shrink-0" />}
            <p className="text-[15px] font-extrabold text-[#166534] leading-snug">{allDone ? 'Hebat! Kebiasaan baik hari ini sudah kamu lakukan.' : habit.cheer}</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Zona belajar: Kuis                                                  */
/* ------------------------------------------------------------------ */
interface QuizOption {
  id: string;
  label: string;
  imageUrl?: string;
}
interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
  answerId: string;
  explain: string;
}

const QUIZ_CATEGORIES = ['protein nabati', 'protein hewani', 'sayuran', 'buah', 'karbohidrat'];

// Soal disusun dari bahan menu hari ini: hanya kategori yang dimiliki satu bahan agar jawabannya tunggal.
function buildQuiz(ingredients: IngredientNutritionInfo[]): QuizQuestion[] {
  const questions: QuizQuestion[] = [];
  if (ingredients.length >= 3) {
    const options = ingredients.slice(0, 6).map(i => ({ id: i.id, label: i.name, imageUrl: i.imageUrl }));
    for (const category of QUIZ_CATEGORIES) {
      const matches = ingredients.filter(i => i.category.trim().toLowerCase() === category);
      if (matches.length !== 1 || !options.some(o => o.id === matches[0].id)) continue;
      questions.push({
        id: `cat-${category}`,
        prompt: `Dari menu hari ini, mana yang termasuk sumber ${category}?`,
        options,
        answerId: matches[0].id,
        explain: matches[0].healthBenefits
      });
      if (questions.length === 2) break;
    }
  }
  questions.push({
    id: 'piringku',
    prompt: 'Menurut Isi Piringku, setengah piring sebaiknya diisi apa?',
    options: [
      { id: 'nasi', label: 'Nasi saja' },
      { id: 'sayur-buah', label: 'Sayur dan buah' },
      { id: 'lauk', label: 'Lauk pauk saja' }
    ],
    answerId: 'sayur-buah',
    explain: 'Setengah piring diisi sayur dan buah, setengah lagi makanan pokok dan lauk pauk.'
  });
  return questions;
}

const QuizPanel: React.FC<{ ingredients: IngredientNutritionInfo[] }> = ({ ingredients }) => {
  const questions = useMemo(() => buildQuiz(ingredients), [ingredients]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const restart = useCallback(() => {
    setIndex(0);
    setPicked([]);
    setFirstTryCorrect(0);
    setFinished(false);
  }, []);
  useEffect(restart, [questions, restart]);

  const q = questions[index];
  const solved = q ? picked.includes(q.answerId) : false;
  const progress = finished ? 100 : ((index + (solved ? 1 : 0)) / questions.length) * 100;

  const choose = (optionId: string) => {
    if (solved || picked.includes(optionId)) return;
    if (picked.length === 0 && optionId === q.answerId) setFirstTryCorrect(n => n + 1);
    setPicked(p => [...p, optionId]);
  };

  const next = () => {
    if (index + 1 >= questions.length) setFinished(true);
    else {
      setIndex(i => i + 1);
      setPicked([]);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2.5 rounded-full bg-[#e8efe9] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={finished ? questions.length : index + 1} aria-label="Kemajuan kuis">
          <div className="h-full rounded-full bg-[#16a34a] motion-safe:transition-all motion-safe:duration-300" style={{ width: `${Math.max(progress, 6)}%` }} />
        </div>
        <span className="text-sm font-bold text-[#166534] tabular-nums">Soal {finished ? questions.length : index + 1} dari {questions.length}</span>
      </div>

      {finished ? (
        <div className="mt-5 text-center py-4 motion-safe:animate-[pop-in_300ms_ease-out]" aria-live="polite">
          <Trophy className="w-12 h-12 mx-auto text-[#ca8a04]" />
          <div className="font-kids text-5xl font-extrabold text-[#166534] tabular-nums mt-2">{firstTryCorrect}/{questions.length}</div>
          <p className="mt-1 text-[15px] font-semibold">
            {firstTryCorrect === questions.length ? 'Semua benar sejak percobaan pertama. Keren!' : 'Jawaban benar di percobaan pertama. Coba lagi untuk nilai sempurna!'}
          </p>
          <button type="button" onClick={restart} className={`mt-4 inline-flex items-center gap-2 min-h-[48px] px-5 rounded-2xl bg-[#15803d] hover:bg-[#166534] text-white font-bold cursor-pointer ${focusRing}`}>
            <RotateCcw className="w-4 h-4" />
            Ulangi kuis
          </button>
        </div>
      ) : (
        q && (
          <>
            <p className="mt-4 text-[17px] font-bold leading-snug">{q.prompt}</p>
            <div className={`mt-3 grid gap-2 ${q.options.some(o => o.imageUrl) ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1'}`}>
              {q.options.map(opt => {
                const wasPicked = picked.includes(opt.id);
                const isAnswer = opt.id === q.answerId;
                const state = wasPicked && isAnswer ? 'right' : wasPicked ? 'wrong' : solved ? 'muted' : 'idle';
                const cls = {
                  right: 'border-[#16a34a] bg-[#f0fdf4] ring-2 ring-[#16a34a] motion-safe:animate-[pop-in_260ms_ease-out]',
                  wrong: 'border-[#fda4af] bg-[#fff1f2] opacity-80',
                  muted: 'border-[#e9e0cc] bg-white opacity-60',
                  idle: 'border-[#e9e0cc] bg-white hover:border-[#86efac]'
                }[state];
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => choose(opt.id)}
                    aria-disabled={solved || wasPicked}
                    className={`relative rounded-2xl border-2 p-2 text-left transition-colors duration-150 cursor-pointer ${focusRing} ${cls}`}
                  >
                    {opt.imageUrl && <SafeImg src={opt.imageUrl} alt="" loading="lazy" className="w-full aspect-[4/3] rounded-xl object-cover mb-1.5" />}
                    <span className="block px-1 min-h-[28px] text-sm font-bold leading-snug">{opt.label}</span>
                    {state === 'right' && (
                      <span className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-[#16a34a] text-white flex items-center justify-center">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </span>
                    )}
                    {state === 'wrong' && (
                      <span className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-[#e11d48] text-white flex items-center justify-center">
                        <X className="w-4 h-4 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div aria-live="polite">
              {solved && (
                <div className="mt-3 rounded-2xl bg-[#e3f3e7] p-3.5 motion-safe:animate-[pop-in_260ms_ease-out]">
                  <div className="flex items-center gap-2 text-lg font-extrabold text-[#166534]">
                    <PartyPopper className="w-5 h-5" />
                    Benar!
                  </div>
                  <p className="text-sm text-slate-800 mt-1 leading-relaxed">{q.explain}</p>
                </div>
              )}
              {!solved && picked.length > 0 && (
                <p className="mt-3 rounded-2xl bg-[#fff1f2] p-3.5 text-sm font-semibold text-[#9f1239]">Belum tepat, coba pilih jawaban lain ya!</p>
              )}
            </div>
            {solved && (
              <button type="button" onClick={next} className={`mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[52px] rounded-2xl bg-[#15803d] hover:bg-[#166534] text-white font-bold cursor-pointer ${focusRing}`}>
                {index + 1 >= questions.length ? 'Lihat nilaiku' : 'Lanjut ke pertanyaan berikutnya'}
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </>
        )
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Zona belajar: satu kartu bertab                                     */
/* ------------------------------------------------------------------ */
type LearnTab = 'pahlawan' | 'kebiasaan' | 'kuis';

const LearningSection: React.FC<{ hero: NutritionHeroConfig; habits: DailyHabitItem[]; ingredients: IngredientNutritionInfo[] }> = ({ hero, habits, ingredients }) => {
  const habit = useMemo(() => pickHabit(habits), [habits]);
  const tabs = useMemo(() => {
    const list: { key: LearnTab; label: string }[] = [];
    if (hero.name.trim()) list.push({ key: 'pahlawan', label: 'Pahlawan' });
    if (habit) list.push({ key: 'kebiasaan', label: 'Kebiasaan' });
    list.push({ key: 'kuis', label: 'Kuis' });
    return list;
  }, [hero.name, habit]);
  const [active, setActive] = useState<LearnTab>(tabs[0].key);
  const current = tabs.some(t => t.key === active) ? active : tabs[0].key;
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const nextTab = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    setActive(nextTab.key);
    tabRefs.current[nextTab.key]?.focus();
  };

  return (
    <section id="belajar" aria-labelledby="belajar-title" className={cardCls}>
      <SectionHead id="belajar-title" title="Zona belajar" subtitle="Kenali makananmu, coba kebiasaan baik, lalu jawab kuisnya." />

      <div role="tablist" aria-label="Zona belajar" className="grid gap-1 p-1 rounded-2xl bg-[#f4efe3]" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t, i) => (
          <button
            key={t.key}
            ref={el => { tabRefs.current[t.key] = el; }}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-controls={`panel-${t.key}`}
            aria-selected={current === t.key}
            tabIndex={current === t.key ? 0 : -1}
            onClick={() => setActive(t.key)}
            onKeyDown={e => onTabKey(e, i)}
            className={`min-h-[44px] rounded-xl text-sm font-bold cursor-pointer transition-colors duration-150 ${focusRing} ${current === t.key ? 'bg-[#15803d] text-white' : 'text-slate-700 hover:bg-white/70'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${current}`} aria-labelledby={`tab-${current}`} className="mt-4">
        {current === 'pahlawan' && <NutritionHeroPanel hero={hero} ingredients={ingredients} />}
        {current === 'kebiasaan' && habit && <HabitPanel habit={habit} />}
        {current === 'kuis' && <QuizPanel ingredients={ingredients} />}
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Halaman                                                             */
/* ------------------------------------------------------------------ */
const NAV_ITEMS = [
  { id: 'menu', label: 'Menu' },
  { id: 'gizi', label: 'Nilai gizi' },
  { id: 'belajar', label: 'Zona belajar' },
  { id: 'bagikan', label: 'Bagikan' }
];

// Chip navigasi menyala sesuai bagian yang sedang terbaca di tengah layar.
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-40% 0px -55% 0px' }
    );
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

const NAV_IDS = NAV_ITEMS.map(n => n.id);

export const DailyMenuPublicPage: React.FC = () => {
  const [config, setConfig] = useState<WebsiteConfig>(getWebsiteConfig);
  const [syncState, setSyncState] = useState<SyncState>(isSupabaseConfigured() ? 'loading' : 'offline');
  const [portion, setPortion] = useState<PortionKey>('large');
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const activeSection = useActiveSection(NAV_IDS);

  const menuToday = config.menuToday;
  const ingredients = menuToday.ingredients;
  const tier: PortionTierConfig = portion === 'large' ? menuToday.portionLarge : menuToday.portionSmall;
  const pageUrl = `${window.location.origin}${MENU_PATH}`;
  const pageHost = `${window.location.host}${MENU_PATH}`;

  const isSampleData = menuToday === DEFAULT_WEBSITE_CONFIG.menuToday;
  const menuDate = parseIndonesianDate(menuToday.dateText);
  const isOutdated = menuDate !== null && !isSameDay(menuDate, new Date());
  const updatedLabel = isSampleData ? null : formatUpdatedAt(config.lastUpdated);

  const loadFromCloud = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setSyncState('offline');
      return;
    }
    setSyncState('loading');
    const result = await fetchWebsiteConfigFromCloud();
    setConfig(result.config);
    setSyncState(result.error ? 'error' : 'synced');
  }, []);

  useEffect(() => {
    const handleUpdate = () => setConfig(getWebsiteConfig());
    window.addEventListener(WEBSITE_CONFIG_UPDATED_EVENT, handleUpdate);
    loadFromCloud();
    return () => window.removeEventListener(WEBSITE_CONFIG_UPDATED_EVENT, handleUpdate);
  }, [loadFromCloud]);

  const closeDetail = useCallback(() => setDetailIndex(null), []);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      window.prompt('Salin tautan ini:', pageUrl);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Menu MBG Hari Ini, SPPG Tumpang Jeru', text: `Menu MBG ${menuToday.dateText}: ${menuToday.menuTitle}`, url: pageUrl });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    handleCopyLink();
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const tiers: { key: PortionKey; config: PortionTierConfig }[] = [
    { key: 'small', config: menuToday.portionSmall },
    { key: 'large', config: menuToday.portionLarge }
  ];
  const bodyWeight = portion === 'large' ? menuToday.bodyWeightLargeKg : menuToday.bodyWeightSmallKg;
  const menuTitle = menuToday.menuTitle.trim() || 'Menu sehat untuk hari ini';

  return (
    <div className="min-h-screen bg-[#fbf8f1] text-[#1f2a22] font-sans antialiased text-[15px]">
      {/* Header: tanpa tautan keluar halaman; chip hanya melompat ke bagian di halaman ini */}
      <header className="sticky top-0 z-40 bg-[#fbf8f1]/95 backdrop-blur-sm border-b border-[#e9e0cc]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-2.5 pt-2.5 pb-1.5">
            <img src={logoSppgImg} alt="" className="w-9 h-9 object-contain shrink-0" />
            <div className="min-w-0">
              <div className="text-[15px] font-extrabold leading-tight truncate">SPPG Tumpang Jeru</div>
              <div className="text-xs text-slate-600 leading-tight truncate">Menu Makan Bergizi Gratis</div>
            </div>
          </div>
          <nav aria-label="Bagian halaman" className="-mx-4 px-4 sm:mx-0 sm:px-0 flex gap-1.5 overflow-x-auto pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_ITEMS.map(n => {
              const on = activeSection === n.id;
              return (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  aria-current={on ? 'location' : undefined}
                  onClick={e => {
                    e.preventDefault();
                    scrollTo(n.id);
                  }}
                  className={`shrink-0 inline-flex items-center min-h-[38px] px-3.5 rounded-full text-[13.5px] font-bold transition-colors duration-150 ${focusRing} ${
                    on ? 'bg-[#15803d] text-white' : 'bg-[#f1ebdd] text-[#1f2a22] hover:bg-[#e9e0cc]'
                  }`}
                >
                  {n.label}
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 pb-8">
        {/* Status data */}
        <div aria-live="polite" className="pt-3 space-y-2 empty:hidden">
          {syncState === 'loading' && (
            <p className="flex items-center gap-2 text-[13px] text-slate-600 px-1">
              <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin" />
              Memeriksa menu terbaru dari dapur SPPG...
            </p>
          )}
          {syncState === 'error' && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-[13px] text-amber-900">
              <span>Menu terbaru belum bisa dimuat. Yang tampil adalah data terakhir yang tersimpan di perangkat ini.</span>
              <button type="button" onClick={loadFromCloud} className={`inline-flex items-center gap-1 min-h-[44px] px-2 font-semibold underline underline-offset-2 cursor-pointer rounded ${focusRing}`}>
                <RefreshCw className="w-3.5 h-3.5" />
                Coba lagi
              </button>
            </div>
          )}
          {syncState !== 'loading' && isSampleData && (
            <div className="rounded-xl border border-[#e9e0cc] bg-white px-3.5 py-2.5 text-[13px] text-slate-700">Ini contoh menu bawaan aplikasi. Petugas SPPG belum mengisi menu lewat CMS.</div>
          )}
          {isOutdated && !isSampleData && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span>Menu ini untuk <strong>{menuToday.dateText}</strong>, bukan hari ini. Menu hari ini belum diperbarui petugas.</span>
            </div>
          )}
        </div>

        {/* 1. Hero: nama menu + pilihan porsi + isi piring */}
        <div className="pt-3 grid lg:grid-cols-2 gap-3.5 lg:gap-6 items-start">
          <div className="grid gap-3.5 min-w-0">
            <section aria-labelledby="hero-title" className="rounded-3xl bg-[#1e6b38] text-white overflow-hidden">
              <div className="p-4 sm:p-6 pb-4">
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[13px] font-semibold text-[#d4f0dc]">
                  <li className="inline-flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4" />
                    {menuToday.dateText}
                  </li>
                  {updatedLabel && (
                    <li className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {updatedLabel}
                    </li>
                  )}
                  {menuToday.qcStatus?.trim() && (
                    <li className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      {menuToday.qcStatus}
                    </li>
                  )}
                </ul>
                <h1 id="hero-title" className="font-kids text-[30px] sm:text-[40px] leading-[1.08] font-extrabold mt-2.5 [text-wrap:balance]">
                  {menuTitle}
                </h1>
                <ul className="mt-3 flex flex-wrap gap-2 text-[13px] font-bold">
                  <li className="rounded-full bg-white/15 px-3 py-1 tabular-nums">{tier.targetCalories}</li>
                  <li className="rounded-full bg-white/15 px-3 py-1 tabular-nums">{tier.totalGramature}</li>
                  {ingredients.length > 0 && <li className="rounded-full bg-white/15 px-3 py-1">{ingredients.length} komponen</li>}
                </ul>
              </div>
              <figure className="relative">
                <SafeImg src={menuToday.imageUrl || trayImg1} alt={`Foto ompreng menu: ${menuTitle}`} className="w-full aspect-[16/10] object-cover" />
                <figcaption className="absolute left-3 bottom-3 rounded-full bg-black/55 px-2.5 py-0.5 text-xs text-white">Foto ompreng hari ini</figcaption>
              </figure>
            </section>

            <PortionPicker tiers={tiers} portion={portion} onChange={setPortion} />
          </div>

          <MenuPlateSection ingredients={ingredients} portion={portion} tip={menuToday.plateTip} onOpenIngredient={setDetailIndex} />
        </div>

        {/* 2-3. Nilai gizi & Zona belajar */}
        <div className="mt-3.5 lg:mt-6 grid lg:grid-cols-2 gap-3.5 lg:gap-6 items-start">
          <NutritionSection tier={tier} calcium={menuToday.energySummary.calciumAvg} iron={menuToday.energySummary.ironAvg} bodyWeight={bodyWeight} />
          <LearningSection hero={menuToday.nutritionHero} habits={menuToday.dailyHabits} ingredients={ingredients} />
        </div>

        {/* 4. Bagikan. QR untuk dicetak tersedia di CMS. */}
        <section id="bagikan" aria-labelledby="bagikan-title" className={`${cardCls} mt-3.5 lg:mt-6`}>
          <div className="lg:flex lg:items-end lg:justify-between lg:gap-6">
            <SectionHead id="bagikan-title" title="Bagikan ke orang tua" subtitle="Tautannya selalu sama. Isinya diperbarui petugas setiap pagi." />
            <div className="grid grid-cols-2 gap-2 lg:w-96 lg:mb-4">
              <button type="button" onClick={handleShare} className={`inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl bg-[#15803d] hover:bg-[#166534] text-white text-sm font-bold cursor-pointer ${focusRing}`}>
                <Share2 className="w-4 h-4" />
                Bagikan
              </button>
              <button type="button" onClick={handleCopyLink} className={`inline-flex items-center justify-center gap-2 min-h-[48px] rounded-2xl border-2 border-[#e9e0cc] bg-white text-sm font-bold hover:bg-[#f4efe3] cursor-pointer ${focusRing}`}>
                {copiedLink ? <Check className="w-4 h-4 text-[#15803d]" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? 'Tersalin' : 'Salin tautan'}
              </button>
            </div>
          </div>
          <p className="font-mono text-[13px] text-slate-600 break-all">{pageHost}</p>
        </section>
      </main>

      <footer className="text-center px-4 pb-8 text-[13px] text-slate-600">
        <div className="font-extrabold text-[#1f2a22]">SPPG MLG Tumpang Jeru</div>
        <div>Satuan Pelayanan Pemenuhan Gizi · Desa Jeru, Kec. Tumpang, Kab. Malang</div>
      </footer>

      {detailIndex !== null && (
        <IngredientSheet ingredients={ingredients} index={detailIndex} portion={portion} onIndexChange={setDetailIndex} onClose={closeDetail} />
      )}
    </div>
  );
};
