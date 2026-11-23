import React, { useMemo, useRef, useState } from 'react';
import {
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Images,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DEFAULT_WEBSITE_CONFIG,
  DOCUMENTATION_STAGE_PRESETS,
  DocumentationRecapEntry,
  DocumentationRecapPhoto,
  WebsiteDocumentationRecapConfig,
  uploadCmsMedia,
} from '../db/websiteConfigStorage';
import { localDateIso } from '../utils/localDate';
import { FormDialog } from './common/FormDialog';
import { ImageBankDialog } from './common/ImageBankDialog';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';

interface WebsiteDocumentationCmsProps {
  value: WebsiteDocumentationRecapConfig;
  onChange: (next: WebsiteDocumentationRecapConfig) => void;
}

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';
const BTN_PRIMARY = `inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] ${FOCUS}`;
const BTN_SECONDARY = `inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors cursor-pointer min-h-[44px] sm:min-h-[36px] ${FOCUS}`;
const ICON_BTN = `inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${FOCUS}`;
const FIELD = `w-full px-3 min-h-[44px] sm:min-h-[36px] rounded-lg border border-slate-300 bg-white text-xs text-slate-800 ${FOCUS}`;
const FIELD_LABEL = 'block text-xs font-semibold text-slate-700 mb-1';

const formatIndonesianDate = (iso: string): string => {
  const parts = (iso || '').split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return iso || 'Tanpa tanggal';
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

export const WebsiteDocumentationCms: React.FC<WebsiteDocumentationCmsProps> = ({ value, onChange }) => {
  const toast = useToast();
  const askConfirm = useConfirm();

  const recap = value || DEFAULT_WEBSITE_CONFIG.documentationRecap;
  const sortedEntries = useMemo(
    () => [...(recap.entries || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [recap.entries]
  );

  const [editingEntry, setEditingEntry] = useState<DocumentationRecapEntry | null>(null);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [modalError, setModalError] = useState('');
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);
  const [bankTargetPhotoId, setBankTargetPhotoId] = useState<string | 'new' | null>(null);

  const multiUploadInputRef = useRef<HTMLInputElement>(null);
  const replacePhotoInputRef = useRef<HTMLInputElement>(null);

  const openAddEntry = () => {
    const today = localDateIso();
    setModalError('');
    setEditingEntry({
      id: `doc-recap-${Date.now()}`,
      date: today,
      title: '',
      summary: '',
      photos: [],
    });
    setIsEntryModalOpen(true);
  };

  const openEditEntry = (entry: DocumentationRecapEntry) => {
    setModalError('');
    setEditingEntry({
      ...entry,
      photos: (entry.photos || []).map((p) => ({ ...p })),
    });
    setIsEntryModalOpen(true);
  };

  const handleDeleteEntry = async (entry: DocumentationRecapEntry) => {
    const ok = await askConfirm({
      title: `Hapus dokumentasi ${formatIndonesianDate(entry.date)}?`,
      message: 'Semua foto dan keterangan di tanggal ini akan dihapus dari halaman depan setelah kamu klik Simpan.',
      confirmText: 'Hapus tanggal',
      variant: 'danger',
    });
    if (!ok) return;
    onChange({
      ...recap,
      entries: (recap.entries || []).filter((e) => e.id !== entry.id),
    });
    toast.success('Rekap tanggal dihapus. Klik Simpan untuk menerapkan ke website publik.');
  };

  const handleMultiPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const uploaded: DocumentationRecapPhoto[] = [];
    let cloudWarnings = 0;

    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setUploadStatus(`Mengunggah ${i + 1}/${files.length}...`);
        const res = await uploadCmsMedia(file, 'visual');
        if (!res.isCloudStorage) cloudWarnings += 1;
        uploaded.push({
          id: `doc-photo-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          imageUrl: res.url,
          stage: DOCUMENTATION_STAGE_PRESETS[Math.min(i, DOCUMENTATION_STAGE_PRESETS.length - 1)],
          caption: '',
        });
      }

      setEditingEntry((prev) =>
        prev
          ? {
              ...prev,
              photos: [...prev.photos, ...uploaded],
            }
          : null
      );

      if (cloudWarnings > 0) {
        toast.warning(`${uploaded.length} foto ditambahkan (sebagian tersimpan lokal karena cloud belum siap).`);
      } else {
        toast.success(`${uploaded.length} foto berhasil diunggah.`);
      }
    } catch {
      toast.error('Gagal mengunggah foto. Coba lagi dengan ukuran file lebih kecil.');
    } finally {
      setUploadStatus('');
      if (e.target) e.target.value = '';
    }
  };

  const triggerReplacePhoto = (photoId: string) => {
    setReplacingPhotoId(photoId);
    replacePhotoInputRef.current?.click();
  };

  const handleReplacePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetId = replacingPhotoId;
    if (!file || !targetId) return;

    try {
      setUploadStatus('Mengganti foto...');
      const res = await uploadCmsMedia(file, 'visual');
      setEditingEntry((prev) =>
        prev
          ? {
              ...prev,
              photos: prev.photos.map((p) => (p.id === targetId ? { ...p, imageUrl: res.url } : p)),
            }
          : null
      );
      if (res.isCloudStorage) {
        toast.success(`Foto diperbarui (${res.finalSizeKb} KB).`);
      } else {
        toast.warning(res.warning || 'Foto diperbarui dan tersimpan lokal di browser ini.');
      }
    } catch {
      toast.error('Gagal mengganti foto.');
    } finally {
      setUploadStatus('');
      setReplacingPhotoId(null);
      if (e.target) e.target.value = '';
    }
  };

  const handlePickFromBank = (url: string) => {
    if (bankTargetPhotoId === 'new') {
      const nextPhoto: DocumentationRecapPhoto = {
        id: `doc-photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        imageUrl: url,
        stage: 'Pengolahan Dapur',
        caption: '',
      };
      setEditingEntry((prev) => (prev ? { ...prev, photos: [...prev.photos, nextPhoto] } : null));
    } else if (bankTargetPhotoId) {
      setEditingEntry((prev) =>
        prev
          ? {
              ...prev,
              photos: prev.photos.map((p) => (p.id === bankTargetPhotoId ? { ...p, imageUrl: url } : p)),
            }
          : null
      );
    }
    setBankTargetPhotoId(null);
  };

  const handleMovePhoto = (idx: number, direction: 'up' | 'down') => {
    setEditingEntry((prev) => {
      if (!prev) return null;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.photos.length) return prev;
      const nextPhotos = [...prev.photos];
      const temp = nextPhotos[idx];
      nextPhotos[idx] = nextPhotos[targetIdx];
      nextPhotos[targetIdx] = temp;
      return { ...prev, photos: nextPhotos };
    });
  };

  const handleRemovePhoto = (photoId: string) => {
    setEditingEntry((prev) =>
      prev ? { ...prev, photos: prev.photos.filter((p) => p.id !== photoId) } : null
    );
  };

  const handleSaveEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    if (!editingEntry.date.trim()) {
      setModalError('Tanggal kegiatan wajib diisi.');
      return;
    }
    if (!editingEntry.title.trim()) {
      setModalError('Judul kegiatan untuk tanggal ini wajib diisi.');
      return;
    }
    if (editingEntry.photos.length === 0) {
      setModalError('Tambahkan minimal 1 foto kegiatan untuk tanggal ini.');
      return;
    }

    const cleanedEntry: DocumentationRecapEntry = {
      ...editingEntry,
      date: editingEntry.date.trim(),
      title: editingEntry.title.trim(),
      summary: editingEntry.summary.trim(),
      photos: editingEntry.photos.map((p) => ({
        ...p,
        stage: (p.stage || '').trim(),
        caption: (p.caption || '').trim(),
      })),
    };

    const existing = recap.entries || [];
    const exists = existing.some((item) => item.id === cleanedEntry.id);
    const nextEntries = exists
      ? existing.map((item) => (item.id === cleanedEntry.id ? cleanedEntry : item))
      : [cleanedEntry, ...existing];

    onChange({
      ...recap,
      entries: nextEntries,
    });

    setIsEntryModalOpen(false);
    setEditingEntry(null);
    toast.success(`Dokumentasi ${formatIndonesianDate(cleanedEntry.date)} diperbarui. Klik Simpan di atas.`);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 px-1">
        Kelola foto dan keterangan kegiatan per tanggal yang tampil pada bagian Rekap Dokumentasi di halaman utama website.
      </p>

      {/* Pengaturan Judul Seksi (collapsible agar fokus ke daftar tanggal) */}
      <details className="group bg-white rounded-xl border border-slate-200">
        <summary
          className={`list-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 min-h-[44px] cursor-pointer select-none rounded-xl hover:bg-slate-50 ${FOCUS}`}
        >
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Judul & Deskripsi Bagian</h2>
            <p className="text-xs text-slate-600 mt-0.5 truncate">
              {recap.sectionTitle || DEFAULT_WEBSITE_CONFIG.documentationRecap.sectionTitle}
            </p>
          </div>
          <ChevronDown
            className="w-4 h-4 text-slate-500 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-4 space-y-3 border-t border-slate-200">
          <div>
            <label htmlFor="doc-section-title" className={FIELD_LABEL}>
              Judul Bagian
            </label>
            <input
              id="doc-section-title"
              type="text"
              value={recap.sectionTitle}
              onChange={(e) => onChange({ ...recap, sectionTitle: e.target.value })}
              placeholder="Rekap Dokumentasi Kegiatan"
              className={FIELD}
            />
          </div>
          <div>
            <label htmlFor="doc-section-subtitle" className={FIELD_LABEL}>
              Subjudul Singkat
            </label>
            <textarea
              id="doc-section-subtitle"
              rows={2}
              value={recap.sectionSubtitle}
              onChange={(e) => onChange({ ...recap, sectionSubtitle: e.target.value })}
              placeholder="Foto kegiatan harian dari dapur hingga penyaluran makanan ke sekolah penerima."
              className={`${FIELD} py-2`}
            />
          </div>
        </div>
      </details>

      {/* Daftar Rekap Dokumentasi Per Tanggal */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900 flex flex-wrap items-center gap-2">
              <span>Daftar Rekap Per Tanggal</span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[11px] font-mono font-semibold">
                {sortedEntries.length} tanggal
              </span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Urutan di website otomatis menampilkan tanggal paling baru di sebelah kiri.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddEntry}
            className={`${BTN_PRIMARY} w-full sm:w-auto shrink-0`}
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Tanggal</span>
          </button>
        </div>

        {sortedEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center space-y-2">
            <Camera className="w-7 h-7 text-slate-400 mx-auto" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-800">Belum ada rekap dokumentasi</p>
            <p className="text-xs text-slate-600">
              Tambahkan tanggal kegiatan beserta foto dan keterangannya agar tampil di halaman depan website.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedEntries.map((entry) => {
              const photos = entry.photos || [];
              const previewPhotos = photos.slice(0, 4);
              const extraCount = Math.max(0, photos.length - previewPhotos.length);

              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 sm:p-4 flex flex-col gap-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                          <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{formatIndonesianDate(entry.date)}</span>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-mono font-semibold">
                          {photos.length} foto
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-900 leading-snug pt-0.5">
                        {entry.title || 'Tanpa judul kegiatan'}
                      </h3>

                      {entry.summary && (
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {entry.summary}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 border-t border-slate-200/80 pt-2.5 sm:border-t-0 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => openEditEntry(entry)}
                        className={`${BTN_SECONDARY} flex-1 sm:flex-none`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit &amp; Foto</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteEntry(entry)}
                        aria-label={`Hapus rekap ${formatIndonesianDate(entry.date)}`}
                        title="Hapus tanggal ini"
                        className={`${ICON_BTN} text-rose-600 hover:bg-rose-50 border border-slate-200 bg-white`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Strip Thumbnail Foto */}
                  {previewPhotos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {previewPhotos.map((photo, idx) => (
                        <div
                          key={photo.id}
                          className="relative aspect-4/3 rounded-lg overflow-hidden border border-slate-200 bg-slate-900"
                        >
                          <img
                            src={photo.imageUrl}
                            alt={photo.caption || `Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {photo.stage && (
                            <span className="absolute bottom-1.5 left-1.5 right-1.5 truncate px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-medium">
                              {photo.stage}
                            </span>
                          )}
                          {idx === previewPhotos.length - 1 && extraCount > 0 && (
                            <div className="absolute inset-0 bg-slate-950/65 flex items-center justify-center text-white text-sm font-mono font-bold">
                              +{extraCount}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Rekap Dokumentasi Per Tanggal */}
      {isEntryModalOpen && editingEntry && (
        <FormDialog
          title={
            (recap.entries || []).some((e) => e.id === editingEntry.id)
              ? 'Edit Rekap Dokumentasi'
              : 'Tambah Rekap Dokumentasi'
          }
          description="Isi tanggal, keterangan kegiatan, dan unggah foto dokumentasi untuk hari tersebut."
          onClose={() => {
            setIsEntryModalOpen(false);
            setEditingEntry(null);
            setModalError('');
          }}
          onSubmit={handleSaveEntry}
          submitLabel="Terapkan ke Daftar"
          submitDisabled={Boolean(uploadStatus)}
          error={modalError}
          size="lg"
        >
          <div className="space-y-4">
            {/* Input Tanggal & Judul */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-4">
                <label htmlFor="doc-entry-date" className={FIELD_LABEL}>
                  Tanggal Kegiatan
                </label>
                <input
                  id="doc-entry-date"
                  type="date"
                  value={editingEntry.date}
                  onChange={(e) => {
                    setModalError('');
                    setEditingEntry((prev) => (prev ? { ...prev, date: e.target.value } : null));
                  }}
                  className={FIELD}
                  required
                />
              </div>

              <div className="sm:col-span-8">
                <label htmlFor="doc-entry-title" className={FIELD_LABEL}>
                  Judul Kegiatan Hari Itu
                </label>
                <input
                  id="doc-entry-title"
                  type="text"
                  value={editingEntry.title}
                  onChange={(e) => {
                    setModalError('');
                    setEditingEntry((prev) => (prev ? { ...prev, title: e.target.value } : null));
                  }}
                  placeholder="Contoh: Persiapan Menu Senin & Penyaluran 14 Sekolah"
                  className={FIELD}
                  required
                />
              </div>
            </div>

            {/* Keterangan Per Tanggal */}
            <div>
              <label htmlFor="doc-entry-summary" className={FIELD_LABEL}>
                Keterangan Tanggal
              </label>
              <textarea
                id="doc-entry-summary"
                rows={3}
                value={editingEntry.summary}
                onChange={(e) =>
                  setEditingEntry((prev) => (prev ? { ...prev, summary: e.target.value } : null))
                }
                placeholder="Ceritakan ringkas kegiatan dapur, penerimaan bahan, atau penyaluran pada tanggal ini..."
                className={`${FIELD} py-2`}
              />
            </div>

            {/* Daftar Foto pada Tanggal Ini */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Foto Dokumentasi ({editingEntry.photos.length})
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Bisa unggah beberapa foto sekaligus; otomatis dikompresi ke WebP.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={multiUploadInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMultiPhotoUpload}
                    className="hidden"
                  />
                  <input
                    ref={replacePhotoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReplacePhotoFile}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => multiUploadInputRef.current?.click()}
                    disabled={Boolean(uploadStatus)}
                    className={`${BTN_PRIMARY} flex-1 sm:flex-none`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadStatus || 'Upload Foto'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBankTargetPhotoId('new')}
                    disabled={Boolean(uploadStatus)}
                    className={`${BTN_SECONDARY} flex-1 sm:flex-none`}
                  >
                    <Images className="w-3.5 h-3.5" />
                    <span>Bank Gambar</span>
                  </button>
                </div>
              </div>

              <datalist id="doc-stage-presets">
                {DOCUMENTATION_STAGE_PRESETS.map((stage) => (
                  <option key={stage} value={stage} />
                ))}
              </datalist>

              {editingEntry.photos.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center">
                  <p className="text-xs text-slate-600">
                    Belum ada foto. Klik <strong>Upload Foto</strong> untuk memilih dari galeri atau kamera.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {editingEntry.photos.map((photo, idx) => (
                    <div
                      key={photo.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col sm:flex-row gap-3"
                    >
                      {/* Preview & Tombol Ganti Foto */}
                      <div className="flex sm:flex-col items-center sm:items-stretch gap-2.5 sm:w-28 shrink-0">
                        <div className="relative w-24 h-20 sm:w-28 sm:h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-900 shrink-0">
                          <img
                            src={photo.imageUrl}
                            alt={photo.caption || `Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-mono font-bold">
                            #{idx + 1}
                          </span>
                        </div>
                        <div className="flex sm:grid sm:grid-cols-2 gap-1.5 flex-1">
                          <button
                            type="button"
                            onClick={() => triggerReplacePhoto(photo.id)}
                            disabled={Boolean(uploadStatus)}
                            className="px-2 py-1.5 min-h-[38px] sm:min-h-[28px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer flex items-center justify-center gap-1"
                            title="Unggah foto pengganti"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Ganti</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setBankTargetPhotoId(photo.id)}
                            disabled={Boolean(uploadStatus)}
                            className="px-2 py-1.5 min-h-[38px] sm:min-h-[28px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-semibold text-slate-700 cursor-pointer flex items-center justify-center gap-1"
                            title="Pilih dari bank gambar"
                          >
                            <Images className="w-3 h-3" />
                            <span>Bank</span>
                          </button>
                        </div>
                      </div>

                      {/* Field Tahap & Keterangan Foto */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                          <div className="sm:col-span-7">
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                              Tahap / Label Foto
                            </label>
                            <input
                              type="text"
                              list="doc-stage-presets"
                              value={photo.stage || ''}
                              onChange={(e) =>
                                setEditingEntry((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        photos: prev.photos.map((p) =>
                                          p.id === photo.id ? { ...p, stage: e.target.value } : p
                                        ),
                                      }
                                    : null
                                )
                              }
                              placeholder="Contoh: Pengolahan Dapur"
                              className={FIELD}
                            />
                          </div>

                          <div className="sm:col-span-5 flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleMovePhoto(idx, 'up')}
                              disabled={idx === 0}
                              aria-label="Geser foto ke atas"
                              title="Geser ke atas"
                              className={`${ICON_BTN} text-slate-600 hover:bg-slate-100 border border-slate-200`}
                            >
                              <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePhoto(idx, 'down')}
                              disabled={idx === editingEntry.photos.length - 1}
                              aria-label="Geser foto ke bawah"
                              title="Geser ke bawah"
                              className={`${ICON_BTN} text-slate-600 hover:bg-slate-100 border border-slate-200`}
                            >
                              <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(photo.id)}
                              aria-label="Hapus foto ini"
                              title="Hapus foto"
                              className={`${ICON_BTN} text-rose-600 hover:bg-rose-50 border border-slate-200`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Keterangan Foto
                          </label>
                          <input
                            type="text"
                            value={photo.caption}
                            onChange={(e) =>
                              setEditingEntry((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      photos: prev.photos.map((p) =>
                                        p.id === photo.id ? { ...p, caption: e.target.value } : p
                                      ),
                                    }
                                  : null
                              )
                            }
                            placeholder="Deskripsi singkat kegiatan yang tampak di foto..."
                            className={FIELD}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </FormDialog>
      )}

      {bankTargetPhotoId && (
        <ImageBankDialog
          onClose={() => setBankTargetPhotoId(null)}
          onPick={handlePickFromBank}
        />
      )}
    </div>
  );
};
