import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Trash2, X } from 'lucide-react';
import { SppgLogo } from '../SppgLogo';
import { KopText } from '../common/KopText';
import { Select } from '../common/Select';
import { FIELD_INPUT, FIELD_LABEL, BTN_PRIMARY, BTN_SECONDARY } from '../common/FormDialog';
import { compressImageToWebP } from '../../utils/imageCompressor';

// Lembar dokumentasi foto untuk laporan berkala: foto ditata otomatis per lembar A4 dengan kop dan judul
// di setiap lembar. Foto hanya diproses di browser (tidak diunggah dan tidak disimpan), jadi hilang saat
// halaman dimuat ulang.

interface Photo {
  id: string;
  url: string;
  name: string;
  takenAt: number;
  caption: string;
}

type PerPage = 4 | 6 | 8 | 9;
const GRID: Record<PerPage, { cols: number; rows: number }> = {
  4: { cols: 2, rows: 2 },
  6: { cols: 2, rows: 3 },
  8: { cols: 2, rows: 4 },
  9: { cols: 3, rows: 3 },
};

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// "9 – 22 Oktober 2026": dua minggu terakhir sampai hari ini
function defaultPeriod(): string {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - 13);
  const fmt = (d: Date, withYear: boolean) => `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ` ${d.getFullYear()}` : ''}`;
  if (start.getMonth() === end.getMonth()) return `${start.getDate()} – ${fmt(end, true)}`;
  return `${fmt(start, start.getFullYear() !== end.getFullYear())} – ${fmt(end, true)}`;
}

interface PhotoDocSheetProps {
  onCountChange: (pages: number) => void;
}

export const PhotoDocSheet: React.FC<PhotoDocSheetProps> = ({ onCountChange }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [perPage, setPerPage] = useState<PerPage>(6);
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [showCaptions, setShowCaptions] = useState(true);
  const [reportTitle, setReportTitle] = useState('Dokumentasi Kegiatan');
  const [period, setPeriod] = useState(defaultPeriod);
  const [pageTitles, setPageTitles] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Object URL dilepas saat foto dihapus atau halaman ditinggalkan, supaya memori browser tidak menumpuk
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => photosRef.current.forEach(p => URL.revokeObjectURL(p.url)), []);

  const pages: Photo[][] = [];
  for (let i = 0; i < photos.length; i += perPage) pages.push(photos.slice(i, i + perPage));

  useEffect(() => {
    onCountChange(pages.length);
  }, [pages.length, onCountChange]);

  const addFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (!files.length) return;
    setFailed([]);
    setProcessing({ done: 0, total: files.length });
    const added: Photo[] = [];
    const bad: string[] = [];
    // Diperkecil ke maks. 1600 px: cukup tajam untuk 1/6 lembar A4 dan membuat cetak 30 foto tetap ringan
    for (const file of files) {
      try {
        const res = await compressImageToWebP(file, { maxDimension: 1600, quality: 0.85 });
        added.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          url: URL.createObjectURL(res.blob),
          name: file.name,
          takenAt: file.lastModified,
          caption: '',
        });
      } catch {
        bad.push(file.name);
      }
      setProcessing(p => (p ? { ...p, done: p.done + 1 } : p));
    }
    // Urut menurut waktu foto (tanggal file), supaya dokumentasi tersusun kronologis
    setPhotos(prev => [...prev, ...added].sort((a, b) => a.takenAt - b.takenAt));
    setFailed(bad);
    setProcessing(null);
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => {
      const target = prev.find(p => p.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter(p => p.id !== id);
    });
  };

  const clearAll = () => {
    if (!window.confirm(`Hapus semua ${photos.length} foto dari lembar ini?`)) return;
    photos.forEach(p => URL.revokeObjectURL(p.url));
    setPhotos([]);
    setPageTitles({});
  };

  const movePhoto = (id: string, dir: -1 | 1) => {
    setPhotos(prev => {
      const idx = prev.findIndex(p => p.id === id);
      const to = idx + dir;
      if (idx < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[to]] = [next[to], next[idx]];
      return next;
    });
  };

  const setCaption = (id: string, caption: string) => setPhotos(prev => prev.map(p => (p.id === id ? { ...p, caption } : p)));

  const { cols, rows } = GRID[perPage];

  return (
    <div className="space-y-4">
      <style>{'@media print { .photo-page { break-after: page; page-break-after: always; } .photo-page:last-child { break-after: auto; page-break-after: auto; } }'}</style>

      {/* Pengaturan (hanya di layar) */}
      <div className="no-print space-y-3 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="photo-title" className={FIELD_LABEL}>Judul laporan</label>
            <input id="photo-title" type="text" value={reportTitle} onChange={e => setReportTitle(e.target.value)} className={FIELD_INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="photo-period" className={FIELD_LABEL}>Periode</label>
            <input id="photo-period" type="text" value={period} onChange={e => setPeriod(e.target.value)} placeholder="Kosongkan bila tidak perlu" className={FIELD_INPUT} />
          </div>
          <div>
            <label htmlFor="photo-per-page" className={FIELD_LABEL}>Foto per lembar</label>
            <Select id="photo-per-page" className="w-full" size="sm" value={String(perPage)} onChange={e => setPerPage(Number(e.target.value) as PerPage)}>
              <option value="4">4 foto (2 × 2, besar)</option>
              <option value="6">6 foto (2 × 3)</option>
              <option value="8">8 foto (2 × 4)</option>
              <option value="9">9 foto (3 × 3)</option>
            </Select>
          </div>
          <div>
            <label htmlFor="photo-fit" className={FIELD_LABEL}>Bentuk foto</label>
            <Select id="photo-fit" className="w-full" size="sm" value={fit} onChange={e => setFit(e.target.value as 'cover' | 'contain')}>
              <option value="cover">Rapi: ukuran kotak sama, tepi dipotong</option>
              <option value="contain">Utuh: foto tidak dipotong</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 sm:pt-5 text-slate-700 cursor-pointer">
            <input type="checkbox" checked={showCaptions} onChange={e => setShowCaptions(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
            Keterangan di bawah foto
          </label>
        </div>

        <div
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`rounded-xl border-2 border-dashed px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 ${
            dragOver ? 'border-emerald-600 bg-emerald-50' : 'border-slate-300 bg-slate-50'
          }`}
        >
          <div className="text-center sm:text-left">
            <p className="text-sm font-semibold text-slate-900">
              {processing ? `Menyiapkan foto ${processing.done} dari ${processing.total}...` : 'Tarik foto ke sini, atau pilih dari perangkat'}
            </p>
            <p className="text-slate-600 mt-0.5">
              Foto diurutkan menurut waktu foto dan ditata otomatis. Foto hanya diproses di perangkat ini, tidak diunggah, dan hilang bila halaman dimuat ulang.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {photos.length > 0 && (
              <button type="button" onClick={clearAll} className={BTN_SECONDARY}>
                <Trash2 className="w-3.5 h-3.5" />
                Hapus semua
              </button>
            )}
            <button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(processing)} className={BTN_PRIMARY}>
              <ImagePlus className="w-4 h-4" />
              {photos.length ? 'Tambah foto' : 'Pilih foto'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        {failed.length > 0 && (
          <p role="alert" className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
            {failed.length} foto tidak bisa dibaca ({failed.join(', ')}). Foto HEIC dari iPhone perlu diubah ke JPG dulu.
          </p>
        )}

        {photos.length > 0 && (
          <p className="text-slate-700">
            <span className="font-semibold text-slate-900">{photos.length} foto</span> menjadi{' '}
            <span className="font-semibold text-slate-900">{pages.length} lembar A4</span>. Judul tiap lembar dan keterangan foto bisa diklik untuk diubah.
          </p>
        )}
      </div>

      {/* Lembar A4: tampil di layar sebagai pratinjau, dan dicetak apa adanya */}
      {pages.length === 0 ? (
        <p className="no-print py-10 text-center text-slate-500 text-xs">Belum ada foto. Lembar akan muncul di sini setelah foto dipilih.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {pages.map((page, pageIdx) => {
            const defaultTitle = reportTitle;
            const title = pageTitles[pageIdx] ?? defaultTitle;
            return (
              <section
                key={pageIdx}
                className="photo-page bg-white flex flex-col w-full max-w-[210mm] mx-auto border border-slate-200 shadow-sm p-[6mm] print:p-0 print:border-0 print:shadow-none print:max-w-none aspect-[210/297] print:aspect-auto print:h-[279mm]"
              >
                <div className="border-b-2 border-slate-900 pb-2 flex items-start justify-between gap-4 shrink-0">
                  <div className="flex items-center gap-3">
                    <SppgLogo size="lg" variant="color" showText={false} />
                    <KopText />
                  </div>
                  <div className="text-right text-[11px] text-slate-600 shrink-0">
                    Lembar {pageIdx + 1} dari {pages.length}
                  </div>
                </div>

                <div className="text-center py-2.5 shrink-0">
                  <input
                    type="text"
                    value={title}
                    onChange={e => setPageTitles(prev => ({ ...prev, [pageIdx]: e.target.value }))}
                    aria-label={`Judul lembar ${pageIdx + 1}`}
                    className="w-full text-center text-sm font-bold uppercase tracking-wide text-slate-900 bg-transparent border-b border-dashed border-slate-300 print:border-0 rounded-none focus:outline-none focus-visible:bg-emerald-50"
                  />
                  {period && <p className="text-xs text-slate-700 mt-0.5">Periode {period}</p>}
                </div>

                <div
                  className="flex-1 min-h-0 grid gap-[3mm]"
                  style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}
                >
                  {page.map(photo => {
                    const index = photos.indexOf(photo);
                    return (
                      <figure key={photo.id} className="relative min-h-0 flex flex-col group">
                        <div className={`flex-1 min-h-0 border border-slate-300 ${fit === 'contain' ? 'bg-slate-50' : ''}`}>
                          <img src={photo.url} alt={photo.caption || photo.name} className={`w-full h-full ${fit === 'cover' ? 'object-cover' : 'object-contain'}`} />
                        </div>
                        {showCaptions && (
                          <figcaption className={`shrink-0 pt-1 ${photo.caption ? '' : 'print:hidden'}`}>
                            <input
                              type="text"
                              value={photo.caption}
                              onChange={e => setCaption(photo.id, e.target.value)}
                              placeholder="Tulis keterangan foto"
                              aria-label={`Keterangan foto ${index + 1}`}
                              className="w-full text-center text-[11px] text-slate-800 bg-transparent border-b border-dashed border-slate-300 print:border-0 rounded-none focus:outline-none focus-visible:bg-emerald-50 placeholder:text-slate-400"
                            />
                          </figcaption>
                        )}

                        {/* Tombol urutan & hapus (hanya di layar) */}
                        <div className="no-print absolute top-1 right-1 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => movePhoto(photo.id, -1)}
                            disabled={index === 0}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white/90 border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            aria-label={`Geser foto ${index + 1} ke depan`}
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePhoto(photo.id, 1)}
                            disabled={index === photos.length - 1}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white/90 border border-slate-300 text-slate-700 hover:bg-white disabled:opacity-40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            aria-label={`Geser foto ${index + 1} ke belakang`}
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removePhoto(photo.id)}
                            className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-white/90 border border-slate-300 text-slate-700 hover:bg-rose-50 hover:text-rose-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            aria-label={`Hapus foto ${index + 1}`}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </figure>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
