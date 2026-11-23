import React, { useEffect, useRef, useState } from 'react';
import { Camera, Download, ExternalLink, ImagePlus, Trash2, X } from 'lucide-react';
import { WastePhotoRecord } from '../types/warehouse';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  compressImageToWebP,
  formatPhotoTimestamp,
  uploadDocumentationPhoto,
} from '../utils/imageCompressor';
import {
  CameraCaptureModal,
  hasLiveCameraSupport,
  isTouchPrimaryDevice,
} from './common/CameraCaptureModal';

const MAX_DEFAULT_PHOTOS = 6;

interface WastePhotoLightboxProps {
  photo: WastePhotoRecord;
  dateLabel: string;
  canEdit: boolean;
  onDelete: (photo: WastePhotoRecord) => void;
  onClose: () => void;
}

const WastePhotoLightbox: React.FC<WastePhotoLightboxProps> = ({
  photo,
  dateLabel,
  canEdit,
  onDelete,
  onClose,
}) => {
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleDownload = async () => {
    setDownloading(true);
    const stampSlug = (photo.capturedAt || '').replace(/[^0-9]/g, '').slice(0, 14) || Date.now().toString();
    const filename = `foto-limbah-${photo.date}-${stampSlug}.webp`;
    try {
      const res = await fetch(photo.url);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
    } catch {
      window.open(photo.url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/80 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waste-lightbox-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 id="waste-lightbox-title" className="text-sm font-bold text-slate-900">
              Foto limbah · {dateLabel}
            </h4>
            <p className="text-xs text-slate-600 font-mono tabular-nums mt-0.5">
              {formatPhotoTimestamp(photo.capturedAt, true)}
              {photo.takenBy ? ` · ${photo.takenBy}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau foto"
            className="inline-flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-950 p-3 flex-1 overflow-auto flex items-center justify-center">
          <img
            src={photo.url}
            alt={`Foto dokumentasi limbah ${dateLabel} (${formatPhotoTimestamp(photo.capturedAt, false)})`}
            className="max-h-[65vh] w-auto object-contain rounded-lg"
          />
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-600">
            {photo.context === 'other' ? 'Limbah dapur lain' : 'Sisa makanan harian'}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3 font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50 min-h-[44px] sm:min-h-[34px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Mengunduh...' : 'Unduh'}
            </button>
            <a
              href={photo.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 min-h-[44px] sm:min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Tab baru
            </a>
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(photo);
                }}
                className="inline-flex items-center gap-1.5 px-3 font-semibold rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 min-h-[44px] sm:min-h-[34px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export interface WastePhotoSectionProps {
  date: string;
  dateLabel: string;
  photos: WastePhotoRecord[];
  pendingIds?: Set<string>;
  canEdit: boolean;
  context: 'daily' | 'other';
  takenBy: string;
  onAdded: (added: WastePhotoRecord[]) => void;
  onRemove: (photo: WastePhotoRecord) => Promise<void> | void;
  onBusyChange?: (busy: boolean) => void;
  maxPhotos?: number;
}

export const WastePhotoSection: React.FC<WastePhotoSectionProps> = ({
  date,
  dateLabel,
  photos,
  pendingIds,
  canEdit,
  context,
  takenBy,
  onAdded,
  onRemove,
  onBusyChange,
  maxPhotos = MAX_DEFAULT_PHOTOS,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<WastePhotoRecord | null>(null);

  const busy = progress !== '';

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    setError('');
  }, [date]);

  const contextLabel = context === 'other' ? 'Limbah dapur' : 'Sisa makanan';

  const processBlobs = async (items: Array<{ blob: File | Blob; label: string; capturedAt: Date }>) => {
    if (items.length === 0) return;
    setError('');
    const remaining = Math.max(0, maxPhotos - photos.length);
    if (remaining === 0) {
      setError(`Maksimal ${maxPhotos} foto per tanggal. Hapus salah satu foto dulu untuk menambah.`);
      return;
    }

    const picked = items.slice(0, remaining);
    const uploaded: WastePhotoRecord[] = [];
    const failed: string[] = [];

    for (const [idx, item] of picked.entries()) {
      setProgress(`Memproses & mengunggah foto ${idx + 1} dari ${picked.length}...`);
      try {
        const primaryStamp = formatPhotoTimestamp(item.capturedAt, true);
        const secondaryStamp = `SPPG MLG Tumpang Jeru · ${contextLabel}${takenBy ? ` · ${takenBy}` : ''}`;
        const compressed = await compressImageToWebP(item.blob, {
          maxDimension: 1600,
          quality: 0.78,
          timestampWatermark: {
            primary: primaryStamp,
            secondary: secondaryStamp,
          },
        });
        const res = await uploadDocumentationPhoto(compressed.blob, 'waste');
        // Hindari menyimpan base64 besar ke app_settings bila Supabase aktif
        if (res.isLocalFallback && isSupabaseConfigured()) {
          throw new Error(res.error || 'penyimpanan foto belum siap');
        }
        uploaded.push({
          id: `WPH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url: res.url,
          date,
          capturedAt: item.capturedAt.toISOString(),
          takenBy: takenBy || 'Petugas',
          context,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'gagal diproses';
        failed.push(`${item.label}: ${msg}`);
      }
    }

    setProgress('');
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    if (uploaded.length > 0) {
      onAdded(uploaded);
    }
    if (failed.length > 0) {
      setError(`Sebagian foto tidak tersimpan. ${failed.join('. ')}`);
    }
  };

  const handleFileList = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const now = new Date();
    const list = Array.from(files).map(f => ({
      blob: f,
      label: f.name || 'Foto',
      capturedAt: now,
    }));
    await processBlobs(list);
  };

  const handleOpenCamera = () => {
    setError('');
    if (!isTouchPrimaryDevice() && hasLiveCameraSupport()) {
      setIsCameraOpen(true);
    } else {
      cameraInputRef.current?.click();
    }
  };

  const handleLiveCapture = (blob: Blob, capturedAt: Date) => {
    setIsCameraOpen(false);
    void processBlobs([{ blob, label: 'Foto kamera', capturedAt }]);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="block font-semibold text-slate-700 text-xs">
            Foto dokumentasi limbah{' '}
            <span className="font-normal text-slate-600">
              ({photos.length}/{maxPhotos})
            </span>
          </span>
          <span className="block text-[11px] text-slate-600 mt-0.5">
            Otomatis diberi stempel tanggal &amp; jam saat diambil atau diunggah.
          </span>
        </div>

        {canEdit && photos.length < maxPhotos && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={handleOpenCamera}
              className="inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border border-emerald-700 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 min-h-[44px] sm:min-h-[34px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              <Camera className="w-3.5 h-3.5" />
              Ambil foto
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => galleryInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-h-[44px] sm:min-h-[34px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              Galeri
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => void handleFileList(e.target.files)}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={e => void handleFileList(e.target.files)}
            />
          </div>
        )}
      </div>

      <p aria-live="polite" className={busy ? 'text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2' : 'sr-only'}>
        {progress}
      </p>

      {error && (
        <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {photos.map((photo, idx) => {
            const isPending = pendingIds?.has(photo.id) ?? false;
            return (
              <li
                key={photo.id}
                className="rounded-lg border border-slate-200 overflow-hidden bg-white flex flex-col"
              >
                <button
                  type="button"
                  onClick={() => setPreviewPhoto(photo)}
                  aria-label={`Lihat foto limbah ${idx + 1} (${formatPhotoTimestamp(photo.capturedAt, false)})`}
                  className="relative block w-full bg-slate-100 aspect-4/3 overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                >
                  <img
                    src={photo.url}
                    alt={`Foto limbah ${dateLabel} #${idx + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                  {isPending && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold">
                      Belum disimpan
                    </span>
                  )}
                </button>
                <div className="px-2 py-1.5 border-t border-slate-100 bg-slate-50/70">
                  <div className="font-mono text-[11px] text-slate-800 tabular-nums truncate" title={formatPhotoTimestamp(photo.capturedAt, true)}>
                    {formatPhotoTimestamp(photo.capturedAt, false)}
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">{photo.takenBy || 'Petugas'}</div>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void onRemove(photo)}
                    disabled={busy}
                    className="w-full min-h-[44px] sm:min-h-[30px] border-t border-slate-200 text-[11px] font-medium text-slate-700 hover:text-rose-700 hover:bg-rose-50 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600"
                  >
                    Hapus
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
          Belum ada foto untuk {dateLabel}. Ambil foto timbangan atau kondisi limbah agar tersimpan lengkap dengan timestamp.
        </p>
      )}

      {isCameraOpen && (
        <CameraCaptureModal
          title="Ambil foto limbah"
          secondaryPreview={`SPPG MLG Tumpang Jeru · ${contextLabel}${takenBy ? ` · ${takenBy}` : ''}`}
          onCapture={handleLiveCapture}
          onFallbackFile={() => galleryInputRef.current?.click()}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {previewPhoto && (
        <WastePhotoLightbox
          photo={previewPhoto}
          dateLabel={dateLabel}
          canEdit={canEdit}
          onDelete={photo => void onRemove(photo)}
          onClose={() => setPreviewPhoto(null)}
        />
      )}
    </div>
  );
};
