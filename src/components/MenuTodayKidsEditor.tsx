import React, { useRef, useState } from 'react';
import {
  WebsiteMenuTodayConfig,
  DailyHabitItem,
  NutritionHeroConfig,
  HABIT_WEEKDAY_LABELS,
  uploadCmsMedia
} from '../db/websiteConfigStorage';
import { Upload, Trash2, Star, CalendarDays } from 'lucide-react';

interface MenuTodayKidsEditorProps {
  menuToday: WebsiteMenuTodayConfig;
  onChange: (patch: Partial<WebsiteMenuTodayConfig>) => void;
  onNotify: (message: string) => void;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

const linesToList = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean);

const ImagePicker: React.FC<{
  value: string;
  label: string;
  emptyHint: string;
  onChange: (url: string) => void;
  onNotify: (message: string) => void;
}> = ({ value, label, emptyHint, onChange, onNotify }) => {
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
          {value ? (
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
          {value && (
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
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
            <Star className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">Pahlawan Gizi Hari Ini</h3>
            <p className="text-[11px] text-slate-500">Satu bahan yang disorot untuk anak. Kosongkan nama untuk menyembunyikan bagian ini.</p>
          </div>
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
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">Kebiasaan Baik per Hari</h3>
            <p className="text-[11px] text-slate-500">Halaman publik otomatis menampilkan kebiasaan sesuai hari ini. Kosongkan judul untuk melewati hari tersebut.</p>
          </div>
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

      {/* Isi Piringku & perkiraan energi */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} htmlFor="plate-tip">Tips hari ini di bagian Isi Piringku (opsional)</label>
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
