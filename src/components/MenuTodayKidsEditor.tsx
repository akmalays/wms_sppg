import React, { useRef, useState } from 'react';
import {
  WebsiteMenuTodayConfig,
  DailyHabitItem,
  NutritionHeroConfig,
  HABIT_WEEKDAY_LABELS,
  uploadCmsMedia
} from '../db/websiteConfigStorage';
import { Upload, Trash2, PenLine, ImagePlus } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { requestKidsAiDraft, requestKidsAiImage, KidsAiDraft } from '../utils/menuAiDraft';

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
type ImageTarget = 'hero' | 'habit';

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

interface ImageAiAction {
  busy: boolean;
  disabled: boolean;
  /** Alasan tombol tidak bisa dipakai, mis. nama bahan masih kosong */
  blockedHint?: string;
  onGenerate: () => void;
}

const ImagePicker: React.FC<{
  value: string;
  label: string;
  emptyHint: string;
  onChange: (url: string) => void;
  onNotify: (message: string) => void;
  ai?: ImageAiAction;
}> = ({ value, label, emptyHint, onChange, onNotify, ai }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

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
      <span className={labelCls}>{label}</span>
      <div className="flex items-start gap-3">
        <div className="w-24 h-24 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
          {ai?.busy ? (
            <span className="text-[10px] text-slate-600 text-center px-1" role="status">Menggambar, bisa sampai 30 detik</span>
          ) : value ? (
            <img src={value} alt="" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[10px] text-slate-500 text-center px-1">{emptyHint}</span>
          )}
        </div>
        <div className="space-y-1.5">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-70 text-white text-xs font-semibold cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Memproses...' : 'Unggah gambar'}
          </button>
          {ai && (
            <button
              type="button"
              onClick={ai.onGenerate}
              disabled={ai.disabled || Boolean(ai.blockedHint)}
              className="flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-[36px] rounded-lg border border-emerald-700 bg-white hover:bg-emerald-50 disabled:border-slate-300 disabled:text-slate-500 disabled:hover:bg-white disabled:cursor-not-allowed text-emerald-800 text-xs font-semibold cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {ai.busy ? 'Menggambar...' : 'Gambar dengan AI'}
            </button>
          )}
          {ai?.blockedHint && <p className="text-[10px] text-slate-500 max-w-[12rem]">{ai.blockedHint}</p>}
          {value && !ai?.busy && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="flex items-center gap-1 text-[11px] font-medium text-rose-700 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              Hapus gambar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const MenuTodayKidsEditor: React.FC<MenuTodayKidsEditorProps> = ({ menuToday, onChange, onNotify }) => {
  const hero = menuToday.nutritionHero;
  const habits = menuToday.dailyHabits;
  const [activeDay, setActiveDay] = useState(1);

  const updateHero = (patch: Partial<NutritionHeroConfig>) => onChange({ nutritionHero: { ...hero, ...patch } });

  const habit: DailyHabitItem =
    habits.find(h => h.weekday === activeDay) ?? { weekday: activeDay, title: '', description: '', steps: [], imageUrl: '' };

  // Draf AI: satu panggilan menghasilkan ketiga bagian, tapi tiap tombol hanya memakai bagiannya sendiri.
  const toast = useToast();
  const askConfirm = useConfirm();
  const [aiBusy, setAiBusy] = useState<AiTarget | null>(null);
  const [imageBusy, setImageBusy] = useState<ImageTarget | null>(null);
  const anyAiBusy = aiBusy !== null || imageBusy !== null;
  const dayLabel = HABIT_WEEKDAY_LABELS[activeDay];

  // Gambar selesai beberapa detik setelah teks masuk. Patch gambar harus membaca isi terbaru,
  // bukan isi saat tombol diklik, supaya teks hasil AI tidak tertimpa lagi oleh isi lama.
  const latest = useRef(menuToday);
  latest.current = menuToday;
  const patchHeroLatest = (patch: Partial<NutritionHeroConfig>) =>
    onChange({ nutritionHero: { ...latest.current.nutritionHero, ...patch } });
  const patchHabitLatest = (weekday: number, patch: Partial<DailyHabitItem>) => {
    const list = latest.current.dailyHabits;
    const current = list.find(h => h.weekday === weekday) ?? { weekday, title: '', description: '', steps: [], imageUrl: '' };
    const next = { ...current, ...patch };
    onChange({
      dailyHabits: list.some(h => h.weekday === weekday) ? list.map(h => (h.weekday === weekday ? next : h)) : [...list, next],
    });
  };

  const confirmReplace = async (what: string, message = 'Isi yang sekarang akan ditimpa. Baca dulu hasilnya sebelum menyimpan.') =>
    askConfirm({ title: `Ganti ${what} dengan hasil AI?`, message, confirmText: 'Ganti', variant: 'warning' });

  /** Melempar error bila gagal; pemanggil yang memilih pesan. */
  const generateImage = async (target: ImageTarget, subject: string, detail: string, apply: (url: string) => void) => {
    setImageBusy(target);
    try {
      const file = await requestKidsAiImage({ kind: target, subject, detail });
      const result = await uploadCmsMedia(file, 'menu');
      apply(result.url);
    } finally {
      setImageBusy(null);
    }
  };

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

  const errText = (err: unknown) => (err instanceof Error ? err.message : 'Gagal membuat gambar.');
  const REPLACE_WITH_IMAGE = 'Teks dan gambar yang sekarang akan ditimpa. Baca dulu hasilnya sebelum menyimpan.';

  // Satu klik mengisi teks lalu gambarnya. Gambar dibuat dari teks yang baru ditulis AI,
  // jadi keduanya selalu membahas bahan atau kebiasaan yang sama.
  const handleAiHero = async () => {
    const draft = await runAi(
      'hero',
      Boolean(hero.name.trim() || hero.imageUrl),
      'Pahlawan Gizi',
      d => {
        const category = d.hero.category.trim();
        updateHero({
          name: d.hero.name.trim(),
          category: category.charAt(0).toUpperCase() + category.slice(1),
          points: d.hero.points.map(p => p.trim()).filter(Boolean),
          funFact: d.hero.funFact.trim(),
        });
      },
      REPLACE_WITH_IMAGE
    );
    if (!draft) return;
    try {
      await generateImage('hero', draft.hero.name.trim(), draft.hero.points.join('. '), url => patchHeroLatest({ imageUrl: url }));
      onNotify('Teks dan gambar Pahlawan Gizi masuk. Periksa dulu sebelum Simpan.');
    } catch (err) {
      toast.error(`Teks sudah masuk, tapi gambar gagal: ${errText(err)}`);
    }
  };

  const handleAiHabit = async () => {
    const weekday = activeDay;
    const draft = await runAi(
      'habit',
      Boolean(habit.title.trim() || habit.imageUrl),
      `kebiasaan ${dayLabel}`,
      d =>
        updateHabit({
          title: d.habit.title.trim(),
          description: d.habit.description.trim(),
          steps: d.habit.steps.map(st => st.trim()).filter(Boolean),
          cheer: d.habit.cheer.trim(),
        }),
      REPLACE_WITH_IMAGE
    );
    if (!draft) return;
    try {
      await generateImage('habit', draft.habit.title.trim(), draft.habit.description.trim(), url => patchHabitLatest(weekday, { imageUrl: url }));
      onNotify(`Teks dan gambar kebiasaan ${HABIT_WEEKDAY_LABELS[weekday]} masuk. Periksa dulu sebelum Simpan.`);
    } catch (err) {
      toast.error(`Teks sudah masuk, tapi gambar gagal: ${errText(err)}`);
    }
  };

  // Hanya gambar, dari teks yang sudah ada di form (hasil AI atau ketikan petugas).
  const handleImageOnly = async (target: ImageTarget) => {
    const isHero = target === 'hero';
    const weekday = activeDay;
    if ((isHero ? hero.imageUrl : habit.imageUrl) && !(await confirmReplace('gambar', 'Gambar yang sekarang akan diganti.'))) return;
    try {
      if (isHero) {
        await generateImage('hero', hero.name.trim(), hero.points.join('. '), url => patchHeroLatest({ imageUrl: url }));
      } else {
        await generateImage('habit', habit.title.trim(), habit.description.trim(), url => patchHabitLatest(weekday, { imageUrl: url }));
      }
      onNotify('Gambar AI masuk. Periksa dulu sebelum Simpan.');
    } catch (err) {
      toast.error(errText(err));
    }
  };

  const busyLabel = (target: ImageTarget) =>
    aiBusy === target ? 'Menulis...' : imageBusy === target && aiBusy === null ? 'Menggambar...' : null;

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
        <div className="pb-2 border-b border-slate-100 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pahlawan Gizi Hari Ini</h3>
            <p className="text-[11px] text-slate-500">Satu bahan yang disorot untuk anak. Kosongkan nama untuk menyembunyikan bagian ini.</p>
          </div>
          <AiButton busy={busyLabel('hero')} disabled={anyAiBusy} label="Isi teks & gambar dengan AI" onClick={handleAiHero} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="hero-name">Nama bahan</label>
            <input id="hero-name" className={inputCls} value={hero.name} onChange={e => updateHero({ name: e.target.value })} placeholder="Tempe" />
          </div>
          <div>
            <label className={labelCls} htmlFor="hero-category">Kategori</label>
            <input
              id="hero-category"
              className={inputCls}
              value={hero.category}
              onChange={e => updateHero({ category: e.target.value })}
              placeholder="Protein Nabati"
            />
            <p className="text-[10px] text-slate-500 mt-1">Warna mengikuti kata: karbohidrat, protein, sayur, atau buah.</p>
          </div>
        </div>

        <ImagePicker
          label="Gambar kartun"
          emptyHint="Kosong: memakai foto bahan"
          value={hero.imageUrl}
          onChange={url => updateHero({ imageUrl: url })}
          onNotify={onNotify}
          ai={{
            busy: imageBusy === 'hero',
            disabled: anyAiBusy,
            blockedHint: hero.name.trim() ? undefined : 'Isi nama bahan dulu untuk membuat gambar.',
            onGenerate: () => handleImageOnly('hero'),
          }}
        />

        <div>
          <label className={labelCls} htmlFor="hero-points">Fakta menarik (satu per baris)</label>
          <textarea
            id="hero-points"
            rows={4}
            className={inputCls}
            value={hero.points.join('\n')}
            onChange={e => updateHero({ points: e.target.value.split('\n') })}
            onBlur={e => updateHero({ points: linesToList(e.target.value) })}
          />
        </div>
        <div>
          <label className={labelCls} htmlFor="hero-funfact">Fakta menarik (opsional)</label>
          <textarea
            id="hero-funfact"
            rows={2}
            className={inputCls}
            value={hero.funFact || ''}
            onChange={e => updateHero({ funFact: e.target.value })}
            placeholder="Kosongkan untuk menyembunyikan kotak ini"
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
      </div>

      {/* Kebiasaan baik per hari */}
      <div className="space-y-4">
        <div className="pb-2 border-b border-slate-100 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Kebiasaan Baik per Hari</h3>
            <p className="text-[11px] text-slate-500">Halaman publik otomatis menampilkan kebiasaan sesuai hari ini. Kosongkan judul untuk melewati hari tersebut.</p>
          </div>
          <AiButton busy={busyLabel('habit')} disabled={anyAiBusy} label={`Isi teks & gambar ${dayLabel}`} onClick={handleAiHabit} />
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
          ai={{
            busy: imageBusy === 'habit',
            disabled: anyAiBusy,
            blockedHint: habit.title.trim() ? undefined : 'Isi judul kebiasaan dulu untuk membuat gambar.',
            onGenerate: () => handleImageOnly('habit'),
          }}
        />
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
