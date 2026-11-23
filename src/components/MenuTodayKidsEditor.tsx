import React, { useRef, useState } from 'react';
import {
  WebsiteMenuTodayConfig,
  DailyHabitItem,
  NutritionHeroConfig,
  HABIT_WEEKDAY_LABELS,
  INGREDIENT_CATEGORIES,
  IngredientNutritionInfo,
  heroSlideIngredients,
  isNutritionHeroInMenu,
  uploadCmsMedia
} from '../db/websiteConfigStorage';
import { Upload, Trash2, PenLine, Images, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { requestKidsAiDraft, requestMenuAiDraft, KidsAiDraft } from '../utils/menuAiDraft';
import { Select } from './common/Select';
import { ImageBankDialog } from './common/ImageBankDialog';
import { BTN_SECONDARY } from './common/FormDialog';

interface MenuTodayKidsEditorProps {
  menuToday: WebsiteMenuTodayConfig;
  onChange: (patch: Partial<WebsiteMenuTodayConfig>) => void;
  onNotify: (message: string) => void;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

const linesToList = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean);

type AiTarget = 'hero' | 'habit' | 'plateTip';

const AiButton: React.FC<{ busy: string | null; disabled: boolean; label: string; onClick: () => void }> = ({ busy, disabled, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="inline-flex items-center gap-1 px-2 min-h-[44px] sm:min-h-[28px] rounded-md text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:text-slate-400 disabled:cursor-wait cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
  >
    <PenLine className="w-3.5 h-3.5" />
    {busy || label}
  </button>
);

const PICKER_BTN = `${BTN_SECONDARY} w-full disabled:text-slate-400 disabled:cursor-not-allowed`;

const ImagePicker: React.FC<{
  value: string;
  label: string;
  emptyHint: string;
  onChange: (url: string) => void;
  onNotify: (message: string) => void;
}> = ({ value, label, emptyHint, onChange, onNotify }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const result = await uploadCmsMedia(file, 'menu');
      onChange(result.url);
      onNotify(result.isCloudStorage ? `Gambar diunggah ke cloud (${result.finalSizeKb} KB).` : 'Gambar disimpan.');
    } catch {
      alert('Gagal mengunggah gambar.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      {/* Hapus di baris judul, supaya kotak gambar dan tombol tidak bergeser saat gambar ada atau kosong */}
      <div className="flex items-center justify-between gap-2 mb-1 min-h-[20px]">
        <span className={`${labelCls} mb-0`}>{label}</span>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-1 -my-1 px-1.5 min-h-[44px] sm:min-h-[28px] rounded-md text-xs font-medium text-rose-700 hover:bg-rose-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Hapus gambar
          </button>
        )}
      </div>
      {/* Tombol di samping kotak gambar; di HP kotaknya ikut memanjang */}
      <div className="flex items-stretch gap-3">
        <div className="relative w-28 min-h-28 shrink-0 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
          {value ? (
            <img src={value} alt="" className="absolute inset-0 w-full h-full object-contain" />
          ) : (
            <span className="text-[11px] text-slate-500 text-center px-2">{emptyHint}</span>
          )}
        </div>
        <div className="grid content-start gap-2 flex-1 min-w-0 sm:flex-none sm:w-44">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className={PICKER_BTN}>
            <Upload className="w-4 h-4" />
            {uploading ? 'Memproses...' : 'Unggah gambar'}
          </button>
          <button type="button" onClick={() => setIsBankOpen(true)} className={PICKER_BTN}>
            <Images className="w-4 h-4" />
            Ambil dari bank
          </button>
        </div>
      </div>
      {isBankOpen && <ImageBankDialog onPick={onChange} onClose={() => setIsBankOpen(false)} />}
    </div>
  );
};

export const MenuTodayKidsEditor: React.FC<MenuTodayKidsEditorProps> = ({ menuToday, onChange, onNotify }) => {
  const hero = menuToday.nutritionHero;
  const habits = menuToday.dailyHabits;
  const [activeDay, setActiveDay] = useState(1);

  const updateHero = (patch: Partial<NutritionHeroConfig>) => onChange({ nutritionHero: { ...hero, ...patch } });

  // Sorotan utama hanya tampil bila namanya kosong/sedang ditambah atau memang ada di menu/bahan hari ini.
  // Bila sorotan dari hari sebelumnya (mis. Telur) tidak ada di menu sekarang, slide disembunyikan agar tidak tertinggal.
  const [isEditingCustomHero, setIsEditingCustomHero] = useState(false);
  const hasHeroName = Boolean(hero?.name?.trim());
  const heroInMenu = isNutritionHeroInMenu(hero?.name, menuToday.menuTitle, menuToday.ingredients);
  const staleHero = hasHeroName && !heroInMenu;
  const showCustomHeroSlide = isEditingCustomHero || heroInMenu;

  const slideIngredients = heroSlideIngredients(showCustomHeroSlide ? hero?.name : '', menuToday.ingredients);
  const slideCount = slideIngredients.length + (showCustomHeroSlide ? 1 : 0);
  const [slideIndex, setSlideIndex] = useState(0);
  const slide = slideCount > 0 ? Math.min(slideIndex, slideCount - 1) : 0;
  const isHeroSlide = showCustomHeroSlide && slide === 0;
  const slideItem: IngredientNutritionInfo | null = showCustomHeroSlide
    ? (slide > 0 ? slideIngredients[slide - 1] : null)
    : (slideIngredients[slide] ?? null);
  const goSlide = (step: number) => {
    if (slideCount > 0) setSlideIndex((slide + step + slideCount) % slideCount);
  };
  const clearHeroSpotlight = () => {
    setIsEditingCustomHero(false);
    setSlideIndex(0);
    updateHero({ name: '', category: '', imageUrl: '', points: [], keyNutrients: [] });
  };

  const habit: DailyHabitItem =
    habits.find(h => h.weekday === activeDay) ?? { weekday: activeDay, title: '', description: '', steps: [], imageUrl: '' };

  // Draf AI: satu panggilan menghasilkan ketiga bagian, tapi tiap tombol hanya memakai bagiannya sendiri.
  const toast = useToast();
  const askConfirm = useConfirm();
  const [aiBusy, setAiBusy] = useState<AiTarget | null>(null);
  const anyAiBusy = aiBusy !== null;
  const dayLabel = HABIT_WEEKDAY_LABELS[activeDay];

  // Teks AI masuk setelah jeda. Patch harus membaca isi terbaru, bukan isi saat tombol diklik.
  const latest = useRef(menuToday);
  latest.current = menuToday;
  const patchIngredientLatest = (id: string, patch: Partial<IngredientNutritionInfo>) =>
    onChange({ ingredients: latest.current.ingredients.map(i => (i.id === id ? { ...i, ...patch } : i)) });
  const confirmReplace = async (what: string, message = 'Isi yang sekarang akan ditimpa. Baca dulu hasilnya sebelum menyimpan.') =>
    askConfirm({ title: `Ganti ${what} dengan hasil AI?`, message, confirmText: 'Ganti', variant: 'warning' });

  const runAi = async (
    target: AiTarget,
    hasContent: boolean,
    what: string,
    apply: (draft: KidsAiDraft) => void,
    confirmMessage?: string
  ): Promise<KidsAiDraft | null> => {
    if (hasContent && !(await confirmReplace(what, confirmMessage))) return null;
    setAiBusy(target);
    try {
      const draft = await requestKidsAiDraft({
        menuTitle: menuToday.menuTitle,
        ingredients: menuToday.ingredients.map(i => ({ name: i.name, category: i.category })),
        habitDay: dayLabel,
        otherHabitTitles: habits.filter(h => h.weekday !== activeDay && h.title.trim()).map(h => h.title),
      });
      apply(draft);
      return draft;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat draf AI.');
      return null;
    } finally {
      setAiBusy(null);
    }
  };

  // Tombol AI hanya menulis teks. Gambar diunggah petugas atau diambil dari bank gambar.
  const handleAiHero = async () => {
    const draft = await runAi('hero', Boolean(hero.name.trim()), 'teks Pahlawan Gizi', d => {
      const category = d.hero.category.trim();
      const keyNutrients = (d.hero.keyNutrients || []).map(n => n.trim()).filter(Boolean);
      updateHero({
        name: d.hero.name.trim(),
        category: category.charAt(0).toUpperCase() + category.slice(1),
        points: d.hero.points.map(p => p.trim()).filter(Boolean),
        // Jawaban tanpa kandungan (fungsi versi lama): isi yang ada dibiarkan.
        ...(keyNutrients.length ? { keyNutrients } : {}),
        funFact: d.hero.funFact.trim(),
      });
    });
    if (draft) onNotify('Teks Pahlawan Gizi masuk. Periksa dulu sebelum Simpan.');
  };

  const handleAiSlide = async () => {
    const item = slideItem;
    if (!item?.name?.trim()) return;
    const hasContent = Boolean(item.nutritionHighlight?.trim() || item.whyGood?.some(w => w.trim()));
    if (hasContent && !(await confirmReplace(`teks slide ${item.name}`))) return;
    setAiBusy('hero');
    try {
      const draft = await requestMenuAiDraft({ menuTitle: menuToday.menuTitle, ingredients: [{ name: item.name.trim(), category: item.category }] });
      const d = draft.ingredients[0];
      if (!d) throw new Error('AI belum memberi hasil, coba lagi.');
      patchIngredientLatest(item.id, {
        whyGood: (d.whyGood || []).map(w => w.trim()).filter(Boolean),
        healthBenefits: d.healthBenefits.trim() || item.healthBenefits,
        nutritionHighlight: d.nutritionHighlight?.trim() || item.nutritionHighlight,
      });
      onNotify(`Teks slide ${item.name} masuk. Periksa dulu sebelum Simpan.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat draf AI.');
    } finally {
      setAiBusy(null);
    }
  };

  const handleAiHabit = async () => {
    const draft = await runAi('habit', Boolean(habit.title.trim()), `teks kebiasaan ${dayLabel}`, d =>
      updateHabit({
        title: d.habit.title.trim(),
        description: d.habit.description.trim(),
        steps: d.habit.steps.map(st => st.trim()).filter(Boolean),
        cheer: d.habit.cheer.trim(),
      })
    );
    if (draft) onNotify(`Teks kebiasaan ${dayLabel} masuk. Periksa dulu sebelum Simpan.`);
  };

  const busyLabel = (target: AiTarget) => (aiBusy === target ? 'Menulis...' : null);

  const handleAiPlateTip = () =>
    runAi('plateTip', Boolean(menuToday.plateTip?.trim()), 'tips Isi Piringku', d => {
      onChange({ plateTip: d.plateTip.trim() });
      onNotify('Draf tips Isi Piringku masuk. Baca dan perbaiki dulu sebelum Simpan.');
    });

  const updateHabit = (patch: Partial<DailyHabitItem>) => {
    const next = { ...habit, ...patch };
    const exists = habits.some(h => h.weekday === activeDay);
    onChange({
      dailyHabits: exists ? habits.map(h => (h.weekday === activeDay ? next : h)) : [...habits, next]
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Pahlawan Gizi */}
      <div className="space-y-4">
        <div className="pb-2 border-b border-slate-100 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pahlawan Gizi Hari Ini</h3>
            <p className="text-[11px] text-slate-500">
              {isHeroSlide
                ? 'Sorotan tambahan di slide pertama. Kosongkan atau hapus bila cukup memakai slide bahan menu.'
                : slideItem
                ? 'Isi slide ini tersimpan di data bahan, sama dengan daftar Bahan pangan.'
                : 'Belum ada bahan menu atau sorotan utama untuk ditampilkan.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {!showCustomHeroSlide && (
              <button
                type="button"
                onClick={() => {
                  if (staleHero) {
                    updateHero({ name: '', category: '', imageUrl: '', points: [], keyNutrients: [] });
                  }
                  setIsEditingCustomHero(true);
                  setSlideIndex(0);
                }}
                className="inline-flex items-center gap-1 px-2.5 min-h-[44px] sm:min-h-[28px] rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Sorotan utama
              </button>
            )}
            {isHeroSlide && (
              <button
                type="button"
                onClick={clearHeroSpotlight}
                className="inline-flex items-center gap-1 px-2 min-h-[44px] sm:min-h-[28px] rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus sorotan
              </button>
            )}
            {slideCount > 0 && (
              <AiButton
                busy={busyLabel('hero')}
                disabled={anyAiBusy || (slideItem !== null && !slideItem.name?.trim())}
                label="Isi teks dengan AI"
                onClick={slideItem ? handleAiSlide : handleAiHero}
              />
            )}
          </div>
        </div>

        {staleHero && !isEditingCustomHero && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <span>
              Sorotan lama <strong>{hero.name}</strong> tidak ada di menu hari ini sehingga disembunyikan.
            </span>
            <button
              type="button"
              onClick={clearHeroSpotlight}
              className="inline-flex items-center gap-1 px-2.5 min-h-[44px] sm:min-h-[28px] rounded-lg border border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus data lama
            </button>
          </div>
        )}

        {slideCount > 1 && (
          <div role="group" aria-label="Pilih slide" className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => goSlide(-1)} aria-label="Slide sebelumnya" className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] rounded-lg text-slate-700 hover:bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <p aria-live="polite" className="min-w-0 truncate text-xs font-semibold text-slate-800">
              Slide {slide + 1} dari {slideCount}: {slideItem ? slideItem.name : hero?.name?.trim() || 'Pahlawan utama'}
            </p>
            <button type="button" onClick={() => goSlide(1)} aria-label="Slide berikutnya" className="flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] rounded-lg text-slate-700 hover:bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {slideCount === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600">
            Tambahkan bahan menu di bagian <strong>Bahan pangan</strong> di atas agar tampil di slide Pahlawan Gizi, atau klik <strong>Sorotan utama</strong> untuk menulis satu bahan secara manual.
          </div>
        ) : slideItem ? (
          <div key={slideItem.id} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls} htmlFor="slide-name">Nama bahan</label>
                <input id="slide-name" className={inputCls} value={slideItem.name} onChange={e => patchIngredientLatest(slideItem.id, { name: e.target.value })} />
              </div>
              <div>
                <label className={labelCls} htmlFor="slide-category">Kategori</label>
                <Select id="slide-category" className="w-full" value={slideItem.category} onChange={e => patchIngredientLatest(slideItem.id, { category: e.target.value })}>
                  {!INGREDIENT_CATEGORIES.some(c => c.value === slideItem.category) && (
                    <option value={slideItem.category}>{slideItem.category || 'Pilih kategori'}</option>
                  )}
                  {INGREDIENT_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </div>
            </div>
            <ImagePicker
              label="Gambar kartun"
              emptyHint="Kosong: ilustrasi otomatis"
              value={slideItem.slideImageUrl || ''}
              onChange={url => patchIngredientLatest(slideItem.id, { slideImageUrl: url })}
              onNotify={onNotify}
            />
            <div>
              <label className={labelCls} htmlFor="slide-points">Poin yang tampil (satu per baris)</label>
              <textarea
                id="slide-points"
                rows={4}
                className={inputCls}
                value={(slideItem.whyGood || []).join('\n')}
                onChange={e => patchIngredientLatest(slideItem.id, { whyGood: e.target.value.split('\n') })}
                onBlur={e => patchIngredientLatest(slideItem.id, { whyGood: linesToList(e.target.value) })}
                placeholder="Kosong: memakai kalimat manfaat bahan"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="slide-nutrients">Kandungan utama</label>
              <input
                id="slide-nutrients"
                className={inputCls}
                value={slideItem.nutritionHighlight || ''}
                onChange={e => patchIngredientLatest(slideItem.id, { nutritionHighlight: e.target.value })}
                placeholder="Pisahkan dengan koma. Contoh: Vitamin C, Serat"
              />
            </div>
          </div>
        ) : (
          <>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="hero-name">Nama bahan</label>
            <input id="hero-name" className={inputCls} value={hero.name || ''} onChange={e => updateHero({ name: e.target.value })} placeholder="Tempe" />
          </div>
          <div>
            <label className={labelCls} htmlFor="hero-category">Kategori</label>
            <input
              id="hero-category"
              className={inputCls}
              value={hero.category || ''}
              onChange={e => updateHero({ category: e.target.value })}
              placeholder="Protein Nabati"
            />
            <p className="text-[10px] text-slate-500 mt-1">Warna mengikuti kata: karbohidrat, protein, sayur, atau buah.</p>
          </div>
        </div>

        <ImagePicker
          label="Gambar kartun"
          emptyHint="Kosong: memakai foto bahan"
          value={hero.imageUrl || ''}
          onChange={url => updateHero({ imageUrl: url })}
          onNotify={onNotify}
        />

        <div>
          <label className={labelCls} htmlFor="hero-points">Poin yang tampil (satu per baris)</label>
          <textarea
            id="hero-points"
            rows={4}
            className={inputCls}
            value={(hero.points || []).join('\n')}
            onChange={e => updateHero({ points: e.target.value.split('\n') })}
            onBlur={e => updateHero({ points: linesToList(e.target.value) })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="hero-nutrients">Kandungan utama (satu per baris, opsional)</label>
          <textarea
            id="hero-nutrients"
            rows={3}
            className={inputCls}
            value={(hero.keyNutrients || []).join('\n')}
            onChange={e => updateHero({ keyNutrients: e.target.value.split('\n') })}
            onBlur={e => updateHero({ keyNutrients: linesToList(e.target.value) })}
            placeholder="Kosong: memakai kandungan menonjol dari bahan yang namanya cocok"
          />
        </div>
          </>
        )}
      </div>

      {/* Kebiasaan baik per hari */}
      <div className="space-y-4">
        <div className="pb-2 border-b border-slate-100 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Kebiasaan Baik per Hari</h3>
            <p className="text-[11px] text-slate-500">Halaman publik otomatis menampilkan kebiasaan sesuai hari ini. Kosongkan judul untuk melewati hari tersebut.</p>
          </div>
          <AiButton busy={busyLabel('habit')} disabled={anyAiBusy} label={`Isi teks ${dayLabel} dengan AI`} onClick={handleAiHabit} />
        </div>

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Pilih hari">
          {Object.entries(HABIT_WEEKDAY_LABELS).map(([day, label]) => {
            const d = Number(day);
            const filled = habits.some(h => h.weekday === d && h.title.trim());
            return (
              <button
                key={d}
                type="button"
                aria-pressed={activeDay === d}
                onClick={() => setActiveDay(d)}
                className={`px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold border cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  activeDay === d
                    ? 'bg-emerald-700 text-white border-emerald-700'
                    : filled
                    ? 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'
                    : 'bg-slate-50 text-slate-500 border-dashed border-slate-300 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div>
          <label className={labelCls} htmlFor="habit-title">Judul kebiasaan</label>
          <input id="habit-title" className={inputCls} value={habit.title} onChange={e => updateHabit({ title: e.target.value })} placeholder="Cuci tangan pakai sabun" />
        </div>
        <div>
          <label className={labelCls} htmlFor="habit-desc">Penjelasan singkat</label>
          <textarea id="habit-desc" rows={2} className={inputCls} value={habit.description} onChange={e => updateHabit({ description: e.target.value })} />
        </div>
        <div>
          <label className={labelCls} htmlFor="habit-steps">Langkah yang bisa dicentang anak (satu per baris)</label>
          <textarea
            id="habit-steps"
            rows={3}
            className={inputCls}
            value={habit.steps.join('\n')}
            onChange={e => updateHabit({ steps: e.target.value.split('\n') })}
            onBlur={e => updateHabit({ steps: linesToList(e.target.value) })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="habit-cheer">Kalimat penyemangat (opsional)</label>
          <input
            id="habit-cheer"
            className={inputCls}
            value={habit.cheer || ''}
            onChange={e => updateHabit({ cheer: e.target.value })}
            placeholder="Yuk, biasakan setiap hari!"
          />
        </div>
        <ImagePicker
          label="Gambar kartun"
          emptyHint="Kosong: ilustrasi anak sehat"
          value={habit.imageUrl}
          onChange={url => updateHabit({ imageUrl: url })}
          onNotify={onNotify}
        />
      </div>

      {/* Tahukah Kamu? */}
      <div className="lg:col-span-2 pt-4 border-t border-slate-200 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Tahukah Kamu?</h3>
          <p className="text-[11px] text-slate-500">Kotak di bawah Kuis Gizi. Bila kosong, kotak memakai Tips hari ini; bila keduanya kosong, kotak disembunyikan.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls} htmlFor="hero-funfact">Isi fakta</label>
            <textarea
              id="hero-funfact"
              rows={4}
              className={inputCls}
              value={hero.funFact || ''}
              onChange={e => updateHero({ funFact: e.target.value })}
              placeholder="Contoh: Ayam bisa dimasak jadi banyak makanan enak."
            />
          </div>
          <ImagePicker
            label="Gambar"
            emptyHint="Kosong: gambar bawaan"
            value={menuToday.funFactImageUrl || ''}
            onChange={url => onChange({ funFactImageUrl: url })}
            onNotify={onNotify}
          />
        </div>
      </div>

      {/* Isi Piringku & perkiraan energi */}
      <div className="lg:col-span-2 pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-end justify-between gap-2 mb-1">
            <label className={`${labelCls} mb-0`} htmlFor="plate-tip">Tips hari ini di bagian Isi Piringku (opsional)</label>
            <AiButton busy={aiBusy === 'plateTip' ? 'Menulis...' : null} disabled={anyAiBusy} label="Tulis dengan AI" onClick={handleAiPlateTip} />
          </div>
          <textarea
            id="plate-tip"
            rows={3}
            className={inputCls}
            value={menuToday.plateTip || ''}
            onChange={e => onChange({ plateTip: e.target.value })}
            placeholder="Kosongkan untuk menyembunyikan kotak tips"
          />
        </div>
        <div>
          <span className={labelCls}>Berat badan acuan untuk perkiraan "energi setara aktivitas" (kg)</span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-slate-600 mb-1" htmlFor="bw-small">Porsi kecil</label>
              <input
                id="bw-small"
                inputMode="decimal"
                className={inputCls}
                value={menuToday.bodyWeightSmallKg || ''}
                onChange={e => onChange({ bodyWeightSmallKg: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-600 mb-1" htmlFor="bw-large">Porsi besar</label>
              <input
                id="bw-large"
                inputMode="decimal"
                className={inputCls}
                value={menuToday.bodyWeightLargeKg || ''}
                onChange={e => onChange({ bodyWeightLargeKg: e.target.value })}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Bawaan dari AKG 2019: usia 7–9 tahun 27 kg, usia 10–12 tahun rata-rata 37 kg. Kosongkan untuk menyembunyikan kartu perkiraan.
          </p>
        </div>
      </div>
    </div>
  );
};
