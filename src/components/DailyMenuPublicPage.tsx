import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import logoSppgImg from '../assets/logo sppg.png';
import wortelMaskotImg from '../assets/sayur_wortel_mbg.jpg';
import sawahImg from '../assets/sawah_padi.jpg';
import kebunSayurImg from '../assets/kebun_sayur.jpg';
import peternakanAyamImg from '../assets/peternakan_ayam.jpg';
import trayImg1 from '../assets/tray_sample_1.jpg';
import menu3bImg from '../assets/menu_3b_ilustrasi.jpg';
import anakSehatImg from '../assets/anak_sehat_mbg.jpg';

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
import QRCode from 'qrcode';
import { Butterfly, Bee, FarmLandscape, HeaderSky, SunRays } from './menuPublic/NatureAccents';
import { FoodIllustration, FoodImage } from './menuPublic/FoodIllustrations';

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
  Sparkles,
  Users,
  School,
  Baby,
  Zap,
  Drumstick,
  Droplet,
  BarChart3,
  CheckCircle2,
  UtensilsCrossed,
  QrCode,
  Download,
  FileText
} from 'lucide-react';

type PortionKey = 'small' | 'large';
type MenuType = 'reguler' | 'b3';
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

// Warna latar ilustrasi bahan mengikuti kelompok makanannya.
const tintOf = (category: string) => {
  const group = groupOfCategory(category);
  return group ? FOOD_GROUPS[group].soft : '#f4efe3';
};

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
const splitDishes = (text: string) => text.split(/[,;+\n]|\s+dan\s+/i).map(s => s.trim()).filter(Boolean);
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

// Foto unggahan petugas di lembar detail; ilustrasi tetap jadi gambar utama. Disembunyikan bila kosong atau gagal dimuat.
const PhotoInset: React.FC<{ src?: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <figure className="absolute left-3 bottom-3 w-24 sm:w-28">
      <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} className="w-full aspect-square rounded-2xl object-cover border-4 border-white shadow-sm" />
      <figcaption className="sr-only">{alt}</figcaption>
    </figure>
  );
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
          <FoodImage
            name={item.name}
            category={item.category}
            alt={item.name}
            tint={tintOf(item.category)}
            className="w-full aspect-[16/9] rounded-t-3xl"
            illustrationClassName="h-[72%] w-auto"
          />
          <PhotoInset key={item.id} src={item.imageUrl} alt={`Foto ${item.name}`} />
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
/* Ilustrasi statis dari public/ilustrasi/. Selama file belum diunggah, */
/* dipakai gambar bawaan (JPG berlatar putih, dibaurkan ke latar kartu   */
/* dengan mix-blend-multiply).                                          */
/* ------------------------------------------------------------------ */
const Illustration: React.FC<{ src: string; fallbackSrc: string; className?: string }> = ({ src, fallbackSrc, className = '' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <img
      src={failed ? fallbackSrc : src}
      alt=""
      aria-hidden="true"
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} ${failed ? 'mix-blend-multiply' : ''}`}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Ranting daun + bunga: motif yang sama dengan daun di footer. Hanya   */
/* hiasan (aria-hidden), bergoyang pelan saat kartunya di-hover/disentuh. */
/* ------------------------------------------------------------------ */
const PETALS = [[0, -9], [8.6, -2.8], [5.3, 7.3], [-5.3, 7.3], [-8.6, -2.8]];

// flip: dicerminkan dengan poros tengah bawah, agar kotaknya tetap di tempat (poros di tepi akan memindahkannya).
const Sprig: React.FC<{ className?: string; flower?: boolean; flip?: boolean }> = ({ className = '', flower = true, flip = false }) => (
  <svg
    viewBox="0 0 120 120"
    aria-hidden="true"
    focusable="false"
    className={`pointer-events-none ${flip ? '-scale-x-100 origin-bottom' : 'origin-bottom-left'} motion-safe:group-hover:animate-[sway_1.8s_ease-in-out_infinite] ${className}`}
  >
    <path d="M18 114 C 38 90, 50 64, 60 32" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M30 96 C 12 92, 4 78, 8 64 C 24 68, 33 81, 30 96 Z" fill="currentColor" opacity="0.85" />
    <path d="M44 74 C 62 73, 75 61, 78 45 C 61 45, 48 57, 44 74 Z" fill="currentColor" opacity="0.65" />
    <path d="M52 54 C 37 48, 32 33, 36 22 C 49 28, 56 41, 52 54 Z" fill="currentColor" opacity="0.85" />
    {flower && (
      <g transform="translate(62 26)">
        {PETALS.map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="7" fill="#fcd34d" />)}
        <circle r="5" fill="#f59e0b" />
      </g>
    )}
  </svg>
);

const CardTitle: React.FC<{ id: string; icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }> = ({ id, icon, title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-3 mb-4">
    <div className="flex items-start gap-2.5 min-w-0">
      <span className="text-[#1f6b3a] shrink-0 mt-0.5" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <h2 id={id} className="font-kids text-xl sm:text-2xl font-bold text-[#173d26] leading-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-slate-600 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

const pillBtn = `inline-flex items-center gap-1 shrink-0 min-h-[40px] px-3.5 rounded-full border border-[#e3dccb] bg-white text-[13px] font-semibold text-[#1f2a22] hover:bg-[#f4efe3] cursor-pointer ${focusRing}`;

/* ------------------------------------------------------------------ */
/* Pilihan jenis menu: reguler (sekolah) atau 3B                        */
/* ------------------------------------------------------------------ */
const MENU_TYPES: Record<MenuType, { label: string; audience: string; Icon: typeof School }> = {
  reguler: { label: 'Menu Reguler', audience: 'Peserta didik di sekolah', Icon: School },
  b3: { label: 'Menu 3B', audience: 'Ibu hamil, ibu menyusui, balita non-PAUD', Icon: Baby }
};

const MenuTypeCard: React.FC<{ menuType: MenuType; hasB3: boolean; onChange: (t: MenuType) => void; onExplain: () => void }> = ({ menuType, hasB3, onChange, onExplain }) => (
  <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-3.5 lg:gap-5">
    <section aria-labelledby="jenis-title" className={cardCls}>
      <CardTitle id="jenis-title" icon={<Users className="w-6 h-6" />} title="Pilih Jenis Menu" subtitle="Informasi ditampilkan sesuai kelompok penerima manfaat." />
      <div role="radiogroup" aria-labelledby="jenis-title" className="grid sm:grid-cols-2 gap-3">
        {(Object.keys(MENU_TYPES) as MenuType[]).map(key => {
          const { label, audience, Icon } = MENU_TYPES[key];
          const on = menuType === key;
          const disabled = key === 'b3' && !hasB3;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={disabled}
              onClick={() => !disabled && onChange(key)}
              className={`flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-colors duration-150 ${focusRing} ${
                disabled
                  ? 'border-dashed border-[#e3dccb] bg-[#faf7ef] cursor-not-allowed'
                  : on
                    ? 'border-[#1f8a4c] bg-[#eef8f0] cursor-pointer'
                    : 'border-[#e9e0cc] bg-white hover:bg-[#faf7ef] cursor-pointer'
              }`}
            >
              <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${on ? 'bg-[#1f8a4c] text-white' : 'bg-[#f1ebdd] text-[#1f6b3a]'}`}>
                <Icon className="w-5 h-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-bold text-[#173d26]">{label}</span>
                <span className="block text-[13px] text-slate-600 leading-snug">{disabled ? 'Belum ada menu 3B untuk hari ini' : audience}</span>
              </span>
              <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'bg-[#1f8a4c] border-[#1f8a4c]' : 'border-slate-300'}`}>
                {on && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
              </span>
            </button>
          );
        })}
      </div>
    </section>
    <aside aria-labelledby="beda-3b-title" className="rounded-3xl bg-[#eef6ec] border border-[#d6e8d2] p-4 sm:p-5 flex flex-col">
      <h2 id="beda-3b-title" className="text-[15px] font-bold text-[#173d26]">Mau tahu perbedaan menu 3B?</h2>
      <img src={menu3bImg} alt="" className="mx-auto my-2 h-28 object-contain mix-blend-multiply" />
      <button type="button" onClick={onExplain} className={`${pillBtn} self-center mt-auto`}>
        Lihat penjelasan menu 3B
        <ChevronRight className="w-4 h-4" />
      </button>
    </aside>
  </div>
);

const B3ExplainDialog: React.FC<{ dishes: string[]; onClose: () => void }> = ({ dishes, onClose }) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEscape(onClose, true);
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#0a1e12]/50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="b3-title"
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="b3-title" className="font-kids text-2xl font-bold text-[#173d26] leading-tight">Apa itu menu 3B?</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Tutup penjelasan" className={`w-11 h-11 shrink-0 rounded-full hover:bg-[#f4efe3] flex items-center justify-center cursor-pointer ${focusRing}`}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <img src={menu3bImg} alt="Ilustrasi ibu hamil, ibu menyusui, dan balita" className="mx-auto h-36 object-contain mix-blend-multiply" />
        <p className="text-[15px] text-slate-800 leading-relaxed">
          Selain peserta didik, Program Makan Bergizi Gratis juga melayani tiga kelompok yang disebut 3B: <strong>ibu hamil</strong>, <strong>ibu menyusui</strong>, dan <strong>balita</strong> yang belum bersekolah di PAUD.
        </p>
        <h3 className="text-[15px] font-bold text-[#173d26] mt-4">Bedanya dengan menu reguler</h3>
        <ul className="mt-2 space-y-2 text-[15px] text-slate-800 leading-snug">
          <li className="flex items-start gap-2"><Check className="w-5 h-5 text-[#15803d] shrink-0 mt-px" />Ibu hamil dan menyusui butuh tambahan energi, protein, zat besi, dan asam folat, jadi lauk dan sayurnya disesuaikan.</li>
          <li className="flex items-start gap-2"><Check className="w-5 h-5 text-[#15803d] shrink-0 mt-px" />Balita mendapat porsi lebih kecil dengan tekstur yang lebih lembut dan mudah dikunyah.</li>
          <li className="flex items-start gap-2"><Check className="w-5 h-5 text-[#15803d] shrink-0 mt-px" />Menunya disusun terpisah oleh tim gizi SPPG, sehingga bisa berbeda dari menu sekolah di hari yang sama.</li>
        </ul>
        {dishes.length > 0 && (
          <div className="mt-4 rounded-2xl bg-[#eef6ec] border border-[#d6e8d2] p-3.5">
            <p className="text-[13px] font-bold text-slate-700">Menu 3B hari ini</p>
            <p className="text-[15px] font-bold text-[#173d26] mt-0.5">{dishes.join(', ')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Isi Piringku                                                         */
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

// Lauk pauk dipecah jadi protein hewani dan nabati seperti di desain; warnanya tetap warna lauk agar cocok dengan piring.
const PLATE_LEGEND: { group: FoodGroup; label: string; role: string }[] = [
  { group: 'pokok', label: 'Karbohidrat', role: 'sumber energi' },
  { group: 'lauk', label: 'Protein hewani', role: 'membangun tubuh' },
  { group: 'lauk', label: 'Protein nabati', role: 'menambah gizi' },
  { group: 'sayur', label: 'Sayuran', role: 'kaya vitamin dan serat' },
  { group: 'buah', label: 'Buah', role: 'menjaga daya tahan tubuh' }
];

const PlateCard: React.FC<{ ingredients: IngredientNutritionInfo[] }> = ({ ingredients }) => {
  const [selected, setSelected] = useState<FoodGroup | null>(null);
  const itemOf = (g: FoodGroup) => ingredients.find(i => groupOfCategory(i.category) === g);
  const toggle = (g: FoodGroup) => setSelected(s => (s === g ? null : g));

  return (
    <section aria-labelledby="piring-title" className={cardCls}>
      <CardTitle id="piring-title" icon={<Leaf className="w-6 h-6" />} title="Kenali Isi Piringmu" subtitle="Ketuk bagian piring untuk melihat perannya." />
      <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] sm:grid-cols-[160px_minmax(0,1fr)] gap-4 items-center">
        <svg viewBox="0 0 240 240" className="w-full h-auto" role="group" aria-label="Piring dibagi empat: sayur sepertiga, buah seperenam, lauk pauk seperenam, makanan pokok sepertiga">
          <defs>
            {PLATE_SECTORS.map(sec => (
              <clipPath key={sec.group} id={`plate-${sec.group}`}>
                <path d={sectorPath(120, 120, 104, sec.from, sec.to)} />
              </clipPath>
            ))}
          </defs>
          <circle cx="120" cy="120" r="117" fill="#ffffff" stroke="#e9e0cc" strokeWidth="3" />
          {PLATE_SECTORS.map(sec => {
            const g = FOOD_GROUPS[sec.group];
            const isActive = sec.group === selected;
            const mid = (sec.from + sec.to) / 2;
            const shift = polar(0, 0, isActive ? 6 : 0, mid);
            const center = polar(120, 120, 56, mid);
            const item = itemOf(sec.group);
            return (
              <g
                key={sec.group}
                role="button"
                tabIndex={0}
                aria-label={g.label}
                aria-pressed={isActive}
                onClick={() => toggle(sec.group)}
                onKeyDown={e => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle(sec.group);
                  }
                }}
                className="cursor-pointer outline-none motion-safe:transition-[transform,opacity] motion-safe:duration-200 focus-visible:[&>path:last-child]:stroke-[#15803d]"
                style={{ transform: `translate(${shift.x}px, ${shift.y}px)`, opacity: selected && !isActive ? 0.45 : 1 }}
              >
                <path d={sectorPath(120, 120, 104, sec.from, sec.to)} fill={g.soft} />
                {item && <FoodIllustration name={item.name} category={item.category} x={center.x - 24} y={center.y - 24} width="48" height="48" />}
                <path d={sectorPath(120, 120, 104, sec.from, sec.to)} fill="none" stroke={isActive ? g.fill : '#ffffff'} strokeWidth={isActive ? 5 : 3} />
              </g>
            );
          })}
        </svg>
        <ul className="min-w-0 space-y-2 text-[13px]">
          {PLATE_LEGEND.map(({ group, label, role }) => (
            <li key={label} className="flex items-start gap-2">
              <span className="w-3 h-3 rounded-full shrink-0 mt-1" style={{ backgroundColor: FOOD_GROUPS[group].fill }} />
              <span>
                <span className="font-bold text-[#173d26]">{label}</span>
                <span className="text-slate-600">: {role}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div aria-live="polite">
        {selected && (
          <p className="mt-3 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: FOOD_GROUPS[selected].soft, color: FOOD_GROUPS[selected].ink }}>
            <strong>{FOOD_GROUPS[selected].label}:</strong> {FOOD_GROUPS[selected].role}
          </p>
        )}
      </div>
      <p className="text-xs text-slate-600 leading-snug mt-3">Setengah piring sayur dan buah, setengahnya lagi makanan pokok dan lauk pauk.</p>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Rincian bahan                                                        */
/* ------------------------------------------------------------------ */
const IngredientStrip: React.FC<{ ingredients: IngredientNutritionInfo[]; portion: PortionKey; onOpen: (index: number) => void }> = ({ ingredients, portion, onOpen }) => (
  <section id="menu" aria-labelledby="bahan-title" className={cardCls}>
    <CardTitle
      id="bahan-title"
      icon={<Leaf className="w-6 h-6" />}
      title="Rincian Menu dan Bahan Makanan"
      subtitle="Kategori dan takaran tiap bahan pada menu hari ini."
      action={
        ingredients.length > 0 ? (
          <button type="button" onClick={() => onOpen(0)} className={`${pillBtn} max-sm:hidden`}>
            Lihat detail bahan
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : undefined
      }
    />
    {ingredients.length === 0 ? (
      <p className="rounded-2xl border border-dashed border-[#d9cfb9] px-4 py-8 text-center text-sm text-slate-600">Rincian menu belum diisi petugas.</p>
    ) : (
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {ingredients.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onOpen(i)}
              className={`w-full h-full flex items-center gap-3 rounded-2xl border border-[#e9e0cc] bg-white p-2.5 text-left hover:bg-[#faf7ef] cursor-pointer ${focusRing}`}
            >
              <FoodImage name={item.name} category={item.category} alt="" tint={tintOf(item.category)} className="w-16 h-16 rounded-xl shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-[#173d26] leading-snug">{item.name}</span>
                <GroupChip category={item.category} className="mt-1" />
                <span className="block text-[13px] text-slate-700 tabular-nums mt-1">{portion === 'large' ? item.portionLarge : item.portionSmall}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    )}
  </section>
);

/* ------------------------------------------------------------------ */
/* Informasi gizi per porsi                                            */
/* ------------------------------------------------------------------ */
const NUTRIENT_TILES = [
  { key: 'energi', label: 'Energi', unit: 'kkal', Icon: Zap, bg: '#fff4d6', ink: '#a16207' },
  { key: 'protein', label: 'Protein', unit: 'gram', Icon: Drumstick, bg: '#ffe4e2', ink: '#b42318' },
  { key: 'karbo', label: 'Karbohidrat', unit: 'gram', Icon: Wheat, bg: '#f6ead8', ink: '#8a5a1f' },
  { key: 'lemak', label: 'Lemak', unit: 'gram', Icon: Droplet, bg: '#e0f0ff', ink: '#1d5fa8' },
  { key: 'serat', label: 'Serat Pangan', unit: 'gram', Icon: Leaf, bg: '#e2f4e4', ink: '#1f7a3e' },
] as const;

const numberOnly = (raw: string | undefined) => (raw || '').replace(/\s*(kkal|gram|g)\s*$/i, '').trim() || '-';

const NutritionCard: React.FC<{
  tiers: { key: PortionKey; config: PortionTierConfig }[];
  portion: PortionKey;
  onPortionChange: (p: PortionKey) => void;
  calcium: string;
  iron: string;
  bodyWeight?: string;
}> = ({ tiers, portion, onPortionChange, calcium, iron, bodyWeight }) => {
  const [showDetail, setShowDetail] = useState(false);
  const tier = tiers.find(t => t.key === portion)!.config;
  const kcal = parseNumber(tier.targetCalories);
  const kg = parseNumber(bodyWeight);
  const canEstimate = kcal > 0 && kg > 0;
  const values: Record<string, string> = {
    energi: numberOnly(tier.targetCalories),
    protein: numberOnly(tier.proteinGrams),
    karbo: numberOnly(tier.carbGrams),
    lemak: numberOnly(tier.fatGrams),
    serat: numberOnly(tier.fiberGrams),
  };
  // Atwater: karbohidrat dan protein 4 kkal/g, lemak 9 kkal/g.
  const parts = [
    { label: 'Karbohidrat', kcal: parseNumber(tier.carbGrams) * 4, color: FOOD_GROUPS.pokok.fill },
    { label: 'Protein', kcal: parseNumber(tier.proteinGrams) * 4, color: FOOD_GROUPS.lauk.fill },
    { label: 'Lemak', kcal: parseNumber(tier.fatGrams) * 9, color: '#3b82f6' },
  ];
  const macroTotal = parts.reduce((sum, p) => sum + Math.max(p.kcal, 0), 0);

  return (
    <section id="gizi" aria-labelledby="gizi-title" className={cardCls}>
      <CardTitle
        id="gizi-title"
        icon={<BarChart3 className="w-6 h-6" />}
        title="Informasi Gizi per Porsi"
        subtitle="Nilai gizi ditampilkan berdasarkan resep dan takaran yang tercatat."
        action={
          <button type="button" onClick={() => setShowDetail(v => !v)} aria-expanded={showDetail} aria-controls="gizi-detail" className={`${pillBtn} max-sm:hidden`}>
            {showDetail ? 'Tutup detail' : 'Lihat detail gizi'}
            <ChevronRight className={`w-4 h-4 transition-transform ${showDetail ? 'rotate-90' : ''}`} />
          </button>
        }
      />
      {/* Porsi kecil/besar mengubah angka gizi dan takaran bahan di halaman ini. */}
      <div className="mb-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div role="radiogroup" aria-label="Pilih porsi" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#f4efe3] sm:w-auto">
          {tiers.map(t => {
            const on = portion === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onPortionChange(t.key)}
                className={`min-h-[44px] px-4 rounded-lg text-sm font-bold cursor-pointer transition-colors duration-150 ${focusRing} ${on ? 'bg-[#15803d] text-white' : 'text-slate-700 hover:bg-white/70'}`}
              >
                {splitTierName(t.config.tierName).name}
              </button>
            );
          })}
        </div>
        <p className="text-[13px] text-slate-600 leading-snug">
          {[splitTierName(tier.tierName).group, tier.totalGramature].filter(Boolean).join(' · ')}
        </p>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {NUTRIENT_TILES.map(({ key, label, unit, Icon, bg, ink }) => (
          <div key={key} className="rounded-2xl border border-[#efe8d8] bg-white p-3 flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2">
            <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: bg, color: ink }} aria-hidden="true">
              <Icon className="w-5 h-5" />
            </span>
            <div>
              <dt className="text-[13px] text-slate-600">{label}</dt>
              <dd className="text-2xl font-extrabold text-[#173d26] tabular-nums leading-tight">{values[key]}</dd>
              <dd className="text-xs text-slate-600">{unit}</dd>
            </div>
          </div>
        ))}
      </dl>
      <button type="button" onClick={() => setShowDetail(v => !v)} aria-expanded={showDetail} aria-controls="gizi-detail" className={`${pillBtn} sm:hidden mt-3 w-full justify-center`}>
        {showDetail ? 'Tutup detail gizi' : 'Lihat detail gizi'}
      </button>

      {showDetail && (
        <div id="gizi-detail" className="mt-4 pt-4 border-t border-[#efe8d8] space-y-4">
          {tier.description?.trim() && (
            <div>
              <p className="text-[13px] font-bold text-slate-700">Kenapa porsinya berbeda?</p>
              <p className="text-[13px] text-slate-700 leading-relaxed mt-1">{tier.description}</p>
            </div>
          )}
          {macroTotal > 0 && (
            <div>
              <p className="text-[13px] font-bold text-slate-700">Asal energinya</p>
              <div className="mt-2 flex h-3 gap-0.5 rounded-full overflow-hidden" aria-hidden="true">
                {parts.map(p => <div key={p.label} style={{ flexGrow: Math.max(p.kcal, 0), backgroundColor: p.color }} />)}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                {parts.map(p => (
                  <li key={p.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.label} {p.kcal > 0 ? `${Math.round((p.kcal / macroTotal) * 100)}%` : '-'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-2 text-[13px]">
            <div className="rounded-xl bg-[#faf7ef] px-3 py-2"><dt className="text-slate-600">Kalsium*</dt><dd className="font-bold tabular-nums">{calcium || '-'}</dd></div>
            <div className="rounded-xl bg-[#faf7ef] px-3 py-2"><dt className="text-slate-600">Zat besi*</dt><dd className="font-bold tabular-nums">{iron || '-'}</dd></div>
          </dl>
          {canEstimate && (
            <div>
              <p className="text-[13px] font-bold text-slate-700">Energi ini kira-kira cukup untuk</p>
              <ul className="mt-2 grid sm:grid-cols-3 gap-2">
                {ACTIVITIES.map(({ label, met, Icon }) => (
                  <li key={label} className="flex items-center gap-2.5 rounded-xl bg-[#faf7ef] px-3 py-2">
                    <Icon className="w-5 h-5 text-[#1f6b3a] shrink-0" />
                    <span className="flex-1 text-[13px] font-semibold">{label}</span>
                    <span className="text-[13px] font-bold tabular-nums">{formatDuration(kcal / ((met * 3.5 * kg) / 200))}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-slate-600 leading-relaxed">
            *Rata-rata semua porsi.
            {canEstimate && ` Perkiraan aktivitas untuk anak ${String(kg).replace('.', ',')} kg (acuan AKG 2019), nilai MET dari Compendium of Physical Activities 2011.`}
          </p>
        </div>
      )}
    </section>
  );
};

// Menu 3B hanya tercatat sebagai daftar hidangan; angka gizi dan takarannya belum ada di data.
const B3MenuCard: React.FC<{ dishes: string[]; onExplain: () => void }> = ({ dishes, onExplain }) => (
  <section id="menu" aria-labelledby="menu-3b-title" className={cardCls}>
    <CardTitle
      id="menu-3b-title"
      icon={<Baby className="w-6 h-6" />}
      title="Rincian Menu 3B"
      subtitle="Untuk ibu hamil, ibu menyusui, dan balita non-PAUD."
      action={
        <button type="button" onClick={onExplain} className={`${pillBtn} max-sm:hidden`}>
          Apa bedanya?
          <ChevronRight className="w-4 h-4" />
        </button>
      }
    />
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
      {dishes.map(d => (
        <li key={d} className="flex items-center gap-3 rounded-2xl border border-[#e9e0cc] bg-white p-3.5">
          <UtensilsCrossed className="w-5 h-5 text-[#1f6b3a] shrink-0" aria-hidden="true" />
          <span className="text-[15px] font-bold text-[#173d26] leading-snug">{d}</span>
        </li>
      ))}
    </ul>
    <p className="mt-3 text-[13px] text-slate-600 leading-relaxed">
      Takaran dan nilai gizi menu 3B disesuaikan untuk tiap sasaran dan belum ditampilkan di halaman ini. Tanyakan rinciannya kepada petugas SPPG.
    </p>
  </section>
);

const CHILD_BENEFITS =['Memberi energi', 'Membantu pertumbuhan', 'Menjaga daya tahan tubuh', 'Mendukung konsentrasi belajar'];

const BenefitsCard: React.FC = () => (
  <aside aria-labelledby="manfaat-title" className="group relative overflow-hidden rounded-3xl bg-[#eef6ec] border border-[#d6e8d2] p-4 sm:p-5">
    <Sprig className="absolute -bottom-3 -right-3 w-12 text-[#1f8a4c]/50" />
    <h2 id="manfaat-title" className="font-kids text-xl font-bold text-[#173d26]">Manfaat untuk Anak</h2>
    <div className="mt-3 flex items-center gap-3">
      <Illustration src="/ilustrasi/manfaat-anak.webp" fallbackSrc={anakSehatImg} className="w-28 h-32 object-contain shrink-0" />
      <ul className="space-y-2">
        {CHILD_BENEFITS.map(b => (
          <li key={b} className="flex items-start gap-2 text-[13px] font-semibold text-slate-800">
            <CheckCircle2 className="w-4.5 h-4.5 text-[#1f8a4c] shrink-0 mt-px" />
            {b}
          </li>
        ))}
      </ul>
    </div>
  </aside>
);

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
      <div className="grid grid-cols-[104px_minmax(0,1fr)] gap-4 items-center">
        <FoodImage
          name={hero.name}
          category={hero.category}
          imageUrl={hero.imageUrl}
          alt={`Ilustrasi ${hero.name}`}
          tint={meta.soft}
          className="w-26 h-26 rounded-2xl"
          photoClassName="object-contain"
        />
        <div className="min-w-0">
          <h3 className="font-kids text-3xl font-bold leading-tight text-[#173d26]">{hero.name}</h3>
          <span className="inline-flex rounded-md px-2 py-0.5 text-xs font-bold mt-1" style={{ backgroundColor: meta.soft, color: meta.ink }}>{hero.category}</span>
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

    </div>
  );
};

// Slide pertama pahlawan pilihan petugas, lalu bahan lain di menu hari ini memakai data gizinya sendiri.
const NutritionHeroCarousel: React.FC<{ hero: NutritionHeroConfig; ingredients: IngredientNutritionInfo[] }> = ({ hero, ingredients }) => {
  const slides = useMemo(() => {
    const heroName = hero.name.trim().toLowerCase();
    const fromIngredients: NutritionHeroConfig[] = ingredients
      .filter(i => !heroName || !i.name.toLowerCase().includes(heroName))
      .map(i => ({
        name: i.name,
        category: i.category,
        imageUrl: '',
        points: cleanList(i.whyGood).length ? cleanList(i.whyGood) : splitSentences(i.healthBenefits),
        keyNutrients: splitHighlights(i.nutritionHighlight)
      }));
    return heroName ? [hero, ...fromIngredients] : fromIngredients;
  }, [hero, ingredients]);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [slides]);

  if (slides.length === 0) return null;
  const current = slides[Math.min(index, slides.length - 1)];
  const go = (step: number) => setIndex(i => (i + step + slides.length) % slides.length);
  const navBtn = `w-11 h-11 rounded-full border border-[#e3dccb] bg-white flex items-center justify-center hover:bg-[#f4efe3] cursor-pointer ${focusRing}`;

  return (
    <section aria-labelledby="pahlawan-title" aria-roledescription="carousel" className={cardCls}>
      <CardTitle id="pahlawan-title" icon={<Sprout className="w-6 h-6" />} title="Pahlawan Gizi Hari Ini" subtitle="Kenali lebih dekat makanan di menu hari ini." />
      <div aria-live="polite">
        <NutritionHeroPanel key={current.name} hero={current} ingredients={ingredients} />
      </div>
      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <button type="button" onClick={() => go(-1)} aria-label="Makanan sebelumnya" className={navBtn}>
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-600 tabular-nums">{Math.min(index, slides.length - 1) + 1} / {slides.length}</span>
          <button type="button" onClick={() => go(1)} aria-label="Makanan berikutnya" className={navBtn}>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </section>
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

const HABIT_SHORT_LABELS: Record<number, string> = { 1: 'Sen', 2: 'Sel', 3: 'Rab', 4: 'Kam', 5: 'Jum', 6: 'Sab' };

const HabitSection: React.FC<{ habits: DailyHabitItem[] }> = ({ habits }) => {
  const filled = useMemo(() => habits.filter(h => h.title.trim()).sort((a, b) => a.weekday - b.weekday), [habits]);
  const [weekday, setWeekday] = useState<number | null>(null);
  const todayDow = new Date().getDay();
  const habit = filled.find(h => h.weekday === weekday) ?? pickHabit(habits);
  if (!habit) return null;

  return (
    <section aria-labelledby="misi-title" className={cardCls}>
      <CardTitle id="misi-title" icon={<BookOpen className="w-6 h-6" />} title="Misi Sehat Hari Ini" />
      {filled.length > 1 && (
        <div role="group" aria-label="Pilih hari" className="mb-3 grid grid-cols-6 gap-1 p-1 rounded-xl bg-[#f4efe3]">
          {filled.map(h => {
            const on = h.weekday === habit.weekday;
            const isToday = h.weekday === todayDow;
            return (
              <button
                key={h.weekday}
                type="button"
                aria-pressed={on}
                aria-label={`${HABIT_WEEKDAY_LABELS[h.weekday]}${isToday ? ' (hari ini)' : ''}`}
                onClick={() => setWeekday(h.weekday)}
                className={`min-h-[44px] rounded-lg text-[13px] font-bold leading-tight cursor-pointer transition-colors duration-150 ${focusRing} ${
                  on ? 'bg-[#15803d] text-white' : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                {HABIT_SHORT_LABELS[h.weekday]}
                {isToday && <span className="block text-[10px] font-semibold">hari ini</span>}
              </button>
            );
          })}
        </div>
      )}
      <HabitPanel key={habit.weekday} habit={habit} />
    </section>
  );
};

const HabitPanel: React.FC<{ habit: DailyHabitItem }> = ({ habit }) => {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
  const storageKey = `mbg-habit-${todayKey}-${habit.weekday}`;
  const isToday = habit.weekday === today.getDay();

  // Centang disimpan per tanggal + hari agar besok mulai dari kosong lagi.
  const [doneByKey, setDoneByKey] = useState<Record<string, number[]>>({});
  const done = doneByKey[storageKey] ?? readDoneSteps(storageKey);

  const steps = cleanList(habit.steps);
  // Ada ilustrasi: kalimat penyemangat jadi gelembung di atas gambar, seperti di desain.
  const cheer = habit.cheer?.trim() || '';
  const allDone = steps.length > 0 && steps.every((_, i) => done.includes(i));
  const toggleStep = (i: number) => {
    const next = done.includes(i) ? done.filter(d => d !== i) : [...done, i];
    setDoneByKey(m => ({ ...m, [storageKey]: next }));
    writeLocal(storageKey, JSON.stringify(next));
  };

  return (
    <div className="space-y-3">
      {habit.imageUrl && (
        <div className="relative rounded-2xl bg-[#e0f2fe] overflow-hidden">
          <SafeImg src={habit.imageUrl} alt={`Ilustrasi: ${habit.title}`} loading="lazy" className="w-full aspect-[16/9] object-contain" />
          {cheer && (
            <p className="absolute bottom-2.5 right-2.5 max-w-[60%] -rotate-2 rounded-2xl border border-[#f2d98a] bg-[#fff6d6] px-3 py-2 font-kids text-sm font-bold leading-snug text-[#5c3d06] shadow-sm">
              {cheer}
            </p>
          )}
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
        {(allDone || (cheer && !habit.imageUrl)) && (
          <div key={allDone ? 'done' : 'cheer'} className="flex items-center gap-3 rounded-2xl bg-[#e3f3e7] p-3.5 motion-safe:animate-[pop-in_300ms_ease-out]">
            {allDone ? <PartyPopper className="w-6 h-6 text-[#15803d] shrink-0" /> : <Sparkles className="w-6 h-6 text-[#15803d] shrink-0" />}
            <p className="text-[15px] font-extrabold text-[#166534] leading-snug">{allDone ? 'Hebat! Kebiasaan baik hari ini sudah kamu lakukan.' : cheer}</p>
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
  /** Bahan menu yang diwakili pilihan ini; ditampilkan sebagai foto atau ilustrasi bawaan. */
  food?: { name: string; category: string; imageUrl?: string };
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
    const options = ingredients.slice(0, 6).map(i => ({ id: i.id, label: i.name, food: { name: i.name, category: i.category, imageUrl: i.imageUrl } }));
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

const NO_INGREDIENTS: IngredientNutritionInfo[] = [];

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
            {/* Desktop: pilihan teks di kiri, hasil di kanan (seperti desain). HP: kartu bergambar bertumpuk. */}
            <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-4 lg:items-start">
              <div className={`mt-3 grid gap-2 ${q.options.some(o => o.food) ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
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
                      className={`relative rounded-2xl border-2 p-2 lg:min-h-[48px] lg:flex lg:items-center lg:gap-2.5 lg:px-3 text-left transition-colors duration-150 cursor-pointer ${focusRing} ${cls}`}
                    >
                      {opt.food && (
                        <FoodImage
                          name={opt.food.name}
                          category={opt.food.category}
                          alt=""
                          tint={tintOf(opt.food.category)}
                          className="w-full aspect-[4/3] rounded-xl mb-1.5 lg:hidden"
                          illustrationClassName="h-[70%] w-auto"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`hidden lg:flex w-5 h-5 shrink-0 rounded-full border-2 items-center justify-center ${
                          state === 'right' ? 'border-[#16a34a] bg-[#16a34a]' : state === 'wrong' ? 'border-[#e11d48] bg-[#e11d48]' : 'border-slate-300'
                        }`}
                      >
                        {state === 'right' && <Check className="w-3 h-3 text-white stroke-[3]" />}
                        {state === 'wrong' && <X className="w-3 h-3 text-white stroke-[3]" />}
                      </span>
                      <span className="block px-1 lg:px-0 min-h-[28px] lg:min-h-0 text-sm font-bold leading-snug">{opt.label}</span>
                      {state === 'right' && (
                        <span className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-[#16a34a] text-white flex items-center justify-center lg:hidden">
                          <Check className="w-4 h-4 stroke-[3]" />
                        </span>
                      )}
                      {state === 'wrong' && (
                        <span className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-[#e11d48] text-white flex items-center justify-center lg:hidden">
                          <X className="w-4 h-4 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div>
                <div aria-live="polite">
                  {solved && (
                    <div className="relative mt-3 rounded-2xl bg-[#e3f3e7] p-3.5 motion-safe:animate-[pop-in_260ms_ease-out]">
                      {/* Umpan balik jawaban benar: kupu-kupu terbang sekali lalu menghilang. */}
                      <Butterfly wander={false} className="absolute right-4 top-1 w-9 opacity-0 motion-safe:animate-[fly-up_1.8s_ease-out_forwards] motion-reduce:hidden" />
                      <div className="flex items-center gap-2 text-lg font-extrabold text-[#166534]">
                        <CheckCircle2 className="w-6 h-6" />
                        Benar!
                      </div>
                      <p className="text-sm text-slate-800 mt-1 leading-relaxed">{q.explain}</p>
                    </div>
                  )}
                  {!solved && picked.length > 0 && (
                    <p className="mt-3 rounded-2xl bg-[#fff1f2] p-3.5 text-sm font-semibold text-[#9f1239]">Belum tepat, coba pilih jawaban lain ya!</p>
                  )}
                  {!solved && picked.length === 0 && (
                    <p className="hidden lg:block mt-3 rounded-2xl border border-dashed border-[#d9cfb9] p-3.5 text-sm text-slate-600">Pilih satu jawaban. Penjelasannya muncul di sini.</p>
                  )}
                </div>
                {solved && (
                  <button type="button" onClick={next} className={`mt-3 w-full inline-flex items-center justify-center gap-2 min-h-[52px] rounded-2xl bg-[#15803d] hover:bg-[#166534] text-white font-bold cursor-pointer ${focusRing}`}>
                    {index + 1 >= questions.length ? 'Lihat nilaiku' : 'Lanjut ke pertanyaan berikutnya'}
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
};

export const DailyMenuPublicPage: React.FC = () => {
  const [config, setConfig] = useState<WebsiteConfig>(getWebsiteConfig);
  const [syncState, setSyncState] = useState<SyncState>(isSupabaseConfigured() ? 'loading' : 'offline');
  const [portion, setPortion] = useState<PortionKey>('large');
  const [menuType, setMenuType] = useState<MenuType>('reguler');
  const [isB3Open, setIsB3Open] = useState(false);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [isQrOpen, setIsQrOpen] = useState(false);

  const menuToday = config.menuToday;
  const ingredients = menuToday.ingredients;
  const pageUrl = `${window.location.origin}${MENU_PATH}`;
  const pageHost = `${window.location.host}${MENU_PATH}`;

  const isSampleData = menuToday === DEFAULT_WEBSITE_CONFIG.menuToday;
  const menuDate = parseIndonesianDate(menuToday.dateText);
  const isOutdated = menuDate !== null && !isSameDay(menuDate, new Date());
  const updatedLabel = isSampleData ? null : formatUpdatedAt(config.lastUpdated);
  const hero = menuToday.nutritionHero;
  const funFact = hero.funFact?.trim() || menuToday.plateTip?.trim() || '';

  // Halaman ini hanya diakses lewat QR: jangan muncul di mesin pencari.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    QRCode.toDataURL(pageUrl, { width: 320, margin: 1, color: { dark: '#173d26', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [pageUrl]);

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
  const closeQr = useCallback(() => setIsQrOpen(false), []);
  const closeB3 = useCallback(() => setIsB3Open(false), []);
  useEscape(closeQr, isQrOpen);

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

  const tiers: { key: PortionKey; config: PortionTierConfig }[] = [
    { key: 'small', config: menuToday.portionSmall },
    { key: 'large', config: menuToday.portionLarge }
  ];
  const activeTier = portion === 'large' ? menuToday.portionLarge : menuToday.portionSmall;
  const bodyWeight = portion === 'large' ? menuToday.bodyWeightLargeKg : menuToday.bodyWeightSmallKg;
  // Daftar hidangan: dari rincian bahan bila ada, selain itu dari judul menu.
  const regularDishes = ingredients.length > 0
    ? ingredients.map(i => i.name)
    : splitDishes(menuToday.menuTitle);
  const b3Dishes = splitDishes(menuToday.menuB3 || '');
  // Data lama atau menu baru tanpa 3B: kembali ke reguler agar pilihan tidak menunjuk ke menu kosong.
  const activeType: MenuType = menuType === 'b3' && b3Dishes.length > 0 ? 'b3' : 'reguler';
  const dishes = activeType === 'b3' ? b3Dishes : regularDishes;
  const subtitle = menuToday.menuSubtitle?.trim() || 'Makanan bergizi untuk mendukung tumbuh kembang dan semangat belajar.';

  return (
    /* Latar langit ke padang rumput: krem seperti langit header di atas, hijau muda di bawah agar menyatu dengan pemandangan sawah dan footer. */
    <div className="font-kids-body overflow-x-clip min-h-screen bg-[#f7f4ec] bg-[linear-gradient(180deg,#f7f4ec_0%,#f6f3e6_35%,#eef4e2_75%,#e6f1dc_100%)] text-[#1f2a22] antialiased text-[15px]">
      <header className="sticky top-0 z-40 bg-[#f7f4ec]/95 backdrop-blur-sm">
        <HeaderSky />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative w-10 h-10 shrink-0">
              <SunRays className="absolute -inset-2.5 w-[60px] h-[60px]" />
              <img src={logoSppgImg} alt="" className="relative w-10 h-10 rounded-full object-cover" />
            </span>
            <div className="min-w-0">
              <div className="font-kids text-[17px] font-bold text-[#173d26] leading-tight truncate">SPPG Tumpang Jeru</div>
              <div className="text-xs text-slate-600 leading-tight truncate">
                Dapur makan bergizi gratis<span className="hidden sm:inline"> di Tumpang, Malang</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={handleShare} className={`inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-[#e3dccb] bg-white text-sm font-semibold hover:bg-[#f4efe3] cursor-pointer ${focusRing}`}>
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Bagikan</span>
            </button>
            <button type="button" onClick={() => setIsQrOpen(true)} className={`inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl bg-[#1f4d2f] hover:bg-[#173d26] text-white text-sm font-semibold cursor-pointer ${focusRing}`}>
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">QR Code</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 pb-10">
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
            <div className="rounded-xl border border-[#e9e0cc] bg-white px-3.5 py-2.5 text-[13px] text-slate-700">Ini contoh menu bawaan aplikasi. Petugas SPPG belum mengisi menu.</div>
          )}
          {isOutdated && !isSampleData && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
              <span>Menu ini untuk <strong>{menuToday.dateText}</strong>, bukan hari ini. Menu hari ini belum diperbarui petugas.</span>
            </div>
          )}
        </div>

        <div className="relative isolate pt-3 space-y-3.5 lg:space-y-5">
          {/* Ranting besar dan samar di tepi halaman, sebesar daun footer, di belakang kartu (-z-10); hanya di layar lebar. */}
          <Sprig className="hidden xl:block absolute -z-10 -left-32 top-[620px] w-40 text-[#1f8a4c]/20" />
          <Sprig flip className="hidden xl:block absolute -z-10 -right-32 top-[1500px] w-40 text-[#1f8a4c]/20" />
          <Butterfly className="hidden xl:block absolute -left-24 top-[560px] w-10" />
          <Bee className="hidden xl:block absolute -right-20 top-[1460px] w-9" />
          {/* Hero */}
          <section aria-labelledby="hero-title" className="group rounded-3xl bg-white border border-[#e9e0cc] overflow-hidden grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <div className="relative p-5 sm:p-7 flex flex-col justify-center order-2 lg:order-1">
              <Sprig className="absolute bottom-3 right-3 w-14 sm:w-20 text-[#1f8a4c]/70" />
              <Butterfly className="absolute bottom-16 right-12 sm:bottom-24 sm:right-20 w-8 sm:w-10" />
              <ul className="flex flex-wrap gap-2 text-[13px] font-semibold">
                <li className="inline-flex items-center gap-1.5 rounded-lg border border-[#e3dccb] bg-[#faf7ef] px-2.5 py-1 text-[#173d26]">
                  <CalendarDays className="w-4 h-4" />
                  {menuToday.dateText}
                </li>
                <li className="inline-flex items-center gap-1.5 rounded-lg bg-[#1f8a4c] px-2.5 py-1 text-white">
                  {React.createElement(MENU_TYPES[activeType].Icon, { className: 'w-4 h-4', 'aria-hidden': true })}
                  {MENU_TYPES[activeType].label}
                </li>
                {menuToday.qcStatus?.trim() && (
                  <li className="inline-flex items-center gap-1.5 rounded-lg border border-[#cfe6d4] bg-[#eef8f0] px-2.5 py-1 text-[#1f6b3a]">
                    <ShieldCheck className="w-4 h-4" />
                    {menuToday.qcStatus}
                  </li>
                )}
              </ul>
              <h1 id="hero-title" className="font-kids text-[34px] sm:text-[44px] leading-[1.05] font-bold text-[#173d26] mt-3">Menu MBG Hari Ini</h1>
              <p className="text-[15px] text-slate-700 mt-2 max-w-md">{subtitle}</p>
              {dishes.length > 0 && (
                <div className="mt-4 flex items-center gap-4 rounded-2xl bg-[#eef6ec] border border-[#d6e8d2] p-4">
                  <span className="w-12 h-12 rounded-full bg-[#1f8a4c] text-white flex items-center justify-center shrink-0" aria-hidden="true">
                    <UtensilsCrossed className="w-6 h-6" />
                  </span>
                  <ul aria-label="Isi menu" className="font-kids text-lg sm:text-xl font-bold text-[#173d26] leading-snug">
                    {dishes.map(d => <li key={d}>{d}</li>)}
                  </ul>
                </div>
              )}
              {activeType === 'reguler' && (
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-slate-700">
                    {numberOnly(activeTier.targetCalories) !== '-' && (
                      <div className="flex gap-1"><dt className="sr-only">Energi</dt><dd><strong className="text-[#173d26] tabular-nums">{numberOnly(activeTier.targetCalories)}</strong> kkal</dd></div>
                    )}
                    {activeTier.totalGramature?.trim() && (
                      <div className="flex gap-1"><dt className="sr-only">Berat porsi</dt><dd className="font-semibold tabular-nums">{activeTier.totalGramature}</dd></div>
                    )}
                    {ingredients.length > 0 && (
                      <div className="flex gap-1"><dt className="sr-only">Jumlah komponen</dt><dd><strong className="text-[#173d26] tabular-nums">{ingredients.length}</strong> komponen</dd></div>
                    )}
                  </dl>
                  <a href="#gizi" className={`inline-flex items-center gap-1 min-h-[44px] text-[13px] font-bold text-[#15803d] underline underline-offset-2 rounded ${focusRing}`}>
                    Lihat detail gizi
                  </a>
                </div>
              )}
              {updatedLabel && (
                <p className="flex items-center gap-1.5 text-xs text-slate-600 mt-3">
                  <Clock className="w-3.5 h-3.5" />
                  {updatedLabel}
                </p>
              )}
            </div>
            <figure className="relative order-1 lg:order-2 min-h-[220px]">
              {/* Foto ompreng hanya untuk menu reguler; menu 3B belum punya foto sendiri. */}
              {activeType === 'b3' ? (
                <div className="absolute inset-0 bg-[#eef6ec] flex items-center justify-center p-4">
                  <img src={menu3bImg} alt="Ilustrasi ibu hamil, ibu menyusui, dan balita" className="h-full max-h-72 object-contain mix-blend-multiply" />
                </div>
              ) : (
                <>
                  <SafeImg src={menuToday.imageUrl || trayImg1} alt={`Foto ompreng menu: ${dishes.join(', ')}`} className="absolute inset-0 w-full h-full object-cover" />
                  {/* Gradasi menyambungkan foto dengan kolom teks di desktop; tidak ada teks di atasnya. */}
                  <div className="hidden lg:block absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-white to-transparent" aria-hidden="true" />
                  <p className="absolute top-3 right-3 sm:top-5 sm:right-5 max-w-[11rem] rotate-3 rounded-2xl border border-[#f2d98a] bg-[#fff6d6] px-3.5 py-2.5 font-kids text-sm sm:text-base font-bold leading-snug text-[#5c3d06] shadow-sm">
                    Menu sehat untuk tubuh kuat dan semangat belajar!
                  </p>
                </>
              )}
            </figure>
          </section>

          <MenuTypeCard menuType={activeType} hasB3={b3Dishes.length > 0} onChange={setMenuType} onExplain={() => setIsB3Open(true)} />

          {activeType === 'b3' ? (
            <B3MenuCard dishes={b3Dishes} onExplain={() => setIsB3Open(true)} />
          ) : (
            <>
              <div className="grid lg:grid-cols-[minmax(0,1fr)_280px] gap-3.5 lg:gap-5 items-start">
                <NutritionCard
                  tiers={tiers}
                  portion={portion}
                  onPortionChange={setPortion}
                  calcium={menuToday.energySummary.calciumAvg}
                  iron={menuToday.energySummary.ironAvg}
                  bodyWeight={bodyWeight}
                />
                <BenefitsCard />
              </div>

              <IngredientStrip ingredients={ingredients} portion={portion} onOpen={setDetailIndex} />
            </>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3.5 lg:gap-5 items-start">
            <PlateCard ingredients={ingredients} />
            <NutritionHeroCarousel hero={hero} ingredients={activeType === 'reguler' ? ingredients : NO_INGREDIENTS} />
            <HabitSection habits={menuToday.dailyHabits} />
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-3.5 lg:gap-5 items-start">
            <section aria-labelledby="kuis-title" className={`${cardCls} group relative overflow-hidden`}>
              <Sprig className="absolute top-2 right-3 w-12 sm:w-14 text-[#1f8a4c]/60" />
              <Bee className="absolute top-3 right-16 sm:right-20 w-8" />
              <CardTitle id="kuis-title" icon={<Lightbulb className="w-6 h-6 text-[#d99a00]" />} title="Kuis Gizi Singkat" />
              {/* Soal bahan disusun dari menu reguler; di mode 3B tinggal soal Isi Piringku agar tidak membingungkan. */}
              <QuizPanel ingredients={activeType === 'reguler' ? ingredients : NO_INGREDIENTS} />
            </section>
            {funFact && (
              <section aria-labelledby="fakta-title" className={`${cardCls} group relative overflow-hidden`}>
                <Sprig className="absolute -bottom-2 -right-2 w-20 text-[#1f8a4c]/40" />
                <CardTitle id="fakta-title" icon={<BookOpen className="w-6 h-6" />} title="Tahukah Kamu?" />
                <div className="flex items-center gap-3">
                  <Illustration src="/ilustrasi/tahukah-kamu.webp" fallbackSrc={wortelMaskotImg} className="w-28 h-28 object-contain shrink-0" />
                  <p className="rounded-2xl bg-[#faf7ef] border border-[#efe8d8] p-4 text-[15px] text-slate-800 leading-relaxed">{funFact}</p>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      <FarmLandscape footerColor="#173d26" />
      <footer className="relative overflow-hidden bg-[#173d26] text-white">
        {/* Daun mengulang motif ikon judul kartu; di belakang teks dan sangat samar agar kontras tetap aman. */}
        <Leaf className="absolute -bottom-8 -right-6 w-44 h-44 -rotate-12 text-emerald-200/10 pointer-events-none" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 grid md:grid-cols-[auto_minmax(0,1fr)_auto] gap-5 md:gap-8 items-center">
          <div className="flex items-center gap-4 min-w-0">
            {qrDataUrl && <img src={qrDataUrl} alt="QR code halaman menu hari ini" className="w-24 h-24 rounded-xl bg-white p-1.5 shrink-0" />}
            <div className="min-w-0">
              <h2 className="text-base font-bold">Akses Menu Ini Kapan Saja</h2>
              <p className="text-[13px] text-emerald-100/90 mt-0.5">Scan QR code atau buka tautan ini untuk melihat menu terbaru.</p>
              <button
                type="button"
                onClick={handleCopyLink}
                className={`mt-2 inline-flex items-center gap-2 max-w-full min-h-[40px] px-3.5 rounded-full bg-white text-[#173d26] text-[13px] font-semibold cursor-pointer ${focusRing}`}
              >
                <span className="truncate">{pageHost}</span>
                {copiedLink ? <Check className="w-4 h-4 shrink-0" /> : <Copy className="w-4 h-4 shrink-0" />}
                <span className="sr-only">{copiedLink ? 'Tautan tersalin' : 'Salin tautan'}</span>
              </button>
            </div>
          </div>
          <div className="hidden md:block" />
          <dl className="grid grid-cols-2 gap-5 text-[13px]">
            <div className="flex items-start gap-2">
              <Clock className="w-5 h-5 text-emerald-200 shrink-0" />
              <div>
                <dt className="font-semibold">Terakhir diperbarui</dt>
                <dd className="text-emerald-100/90">{updatedLabel || menuToday.dateText}</dd>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <FileText className="w-5 h-5 text-emerald-200 shrink-0" />
              <div>
                <dt className="font-semibold">Sumber data gizi</dt>
                <dd className="text-emerald-100/90">Resep dan takaran porsi SPPG Tumpang Jeru</dd>
              </div>
            </div>
          </dl>
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-3 border-t border-white/10 text-xs text-emerald-100/90">
          <strong className="font-semibold text-white">SPPG MLG Tumpang Jeru</strong>, Satuan Pelayanan Pemenuhan Gizi · Desa Jeru, Kec. Tumpang, Kab. Malang
        </div>
      </footer>

      {isQrOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4" onClick={closeQr}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-title"
            onClick={e => e.stopPropagation()}
            className="bg-white w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-5 text-center"
          >
            <div className="flex items-center justify-between">
              <h2 id="qr-title" className="font-kids text-xl font-bold text-[#173d26]">QR Menu Hari Ini</h2>
              <button type="button" onClick={closeQr} aria-label="Tutup" className={`w-11 h-11 rounded-full hover:bg-[#f4efe3] flex items-center justify-center cursor-pointer ${focusRing}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {qrDataUrl && <img src={qrDataUrl} alt="QR code halaman menu hari ini" className="w-60 h-60 mx-auto mt-2" />}
            <p className="text-[13px] text-slate-600 mt-2">Scan untuk membuka halaman ini di HP lain.</p>
            {qrDataUrl && (
              <a
                href={qrDataUrl}
                download="qr-menu-mbg-hari-ini.png"
                className={`mt-3 inline-flex items-center justify-center gap-2 w-full min-h-[48px] rounded-xl bg-[#1f4d2f] hover:bg-[#173d26] text-white text-sm font-semibold ${focusRing}`}
              >
                <Download className="w-4 h-4" />
                Simpan gambar QR
              </a>
            )}
            <p className="font-mono text-[13px] text-slate-700 mt-1 break-all">{pageHost}</p>
          </div>
        </div>
      )}

      {isB3Open && <B3ExplainDialog dishes={b3Dishes} onClose={closeB3} />}

      {detailIndex !== null && (
        <IngredientSheet ingredients={ingredients} index={detailIndex} portion={portion} onIndexChange={setDetailIndex} onClose={closeDetail} />
      )}
    </div>
  );
};
