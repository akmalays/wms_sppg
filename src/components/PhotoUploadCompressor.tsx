import React, { useState, useRef } from 'react';
import { Camera, UploadCloud, Trash2, CheckCircle2, AlertCircle, ZoomIn, X, Loader2 } from 'lucide-react';
import { compressImageToWebP, uploadDocumentationPhoto, CompressedImageResult } from '../utils/imageCompressor';

export interface UploadedPhotoItem {
  id: string;
  url: string;
  originalName: string;
  originalSizeKb: number;
  compressedSizeKb: number;
  savedPercent: number;
  uploadedAt: string;
  isLocalFallback: boolean;
}

interface PhotoUploadCompressorProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  folder?: 'receiving' | 'waste' | 'menu' | 'profile';
  label?: string;
  description?: string;
}

export const PhotoUploadCompressor: React.FC<PhotoUploadCompressorProps> = ({
  photos,
  onChange,
  maxPhotos = 6,
  folder = 'receiving',
  label = 'Dokumentasi Foto Kedatangan (Auto-Kompres WebP)',
  description = 'Foto dari kamera HP otomatis dikonversi ke WebP & dikompres hingga ~95% sebelum di-upload.',
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStatus, setProcessStatus] = useState<string>('');
  const [recentStats, setRecentStats] = useState<Array<{ name: string; orig: number; comp: number; ratio: number }>>([]);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const availableSlots = maxPhotos - photos.length;
    if (availableSlots <= 0) {
      alert(`Maksimal hanya dapat melampirkan ${maxPhotos} foto dokumentasi.`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, availableSlots);
    setIsProcessing(true);
    const newPhotos = [...photos];
    const newStats: typeof recentStats = [];

    for (let i = 0; i < filesToProcess.length; i++) {
      const file = filesToProcess[i];
      setProcessStatus(`Mengompres foto ${i + 1}/${filesToProcess.length}: ${file.name}...`);

      try {
        // 1. Auto-kompres dan konversi ke WebP di sisi browser
        const compressed: CompressedImageResult = await compressImageToWebP(file, {
          maxDimension: 1600, // Sangat tajam untuk teks surat jalan & timbangan digital
          quality: 0.8, // Rasio kompresi optimal
        });

        // 2. Upload file WebP ke Supabase Storage (atau fallback lokal)
        setProcessStatus(`Mengunggah foto ${i + 1}/${filesToProcess.length} ke storage...`);
        const uploadResult = await uploadDocumentationPhoto(compressed.blob, folder);

        newPhotos.push(uploadResult.url);
        newStats.push({
          name: file.name,
          orig: compressed.originalSizeKb,
          comp: compressed.compressedSizeKb,
          ratio: compressed.compressionRatioPercent,
        });
      } catch (err) {
        console.error('Gagal memproses foto:', err);
      }
    }

    onChange(newPhotos);
    setRecentStats(prev => [...newStats, ...prev].slice(0, 8));
    setIsProcessing(false);
    setProcessStatus('');

    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    const updated = photos.filter((_, idx) => idx !== indexToRemove);
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div>
          <label className="block text-xs font-semibold text-slate-800">
            {label}
          </label>
          <p className="text-[11px] text-slate-500">
            {description}
          </p>
        </div>
        <span className="text-[11px] font-medium text-slate-500 self-start sm:self-auto bg-slate-100 px-2 py-0.5 rounded">
          {photos.length} / {maxPhotos} foto terlampir
        </span>
      </div>

      {/* Upload Action Area */}
      {photos.length < maxPhotos && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Tombol Kamera Langsung (Mobile Camera) */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => cameraInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <Camera className="w-4 h-4 text-emerald-700" />
            Ambil Kamera HP
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={e => handleFilesSelected(e.target.files)}
          />

          {/* Tombol Pilih File Galeri */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4 text-slate-500" />
            Pilih dari Galeri / File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => handleFilesSelected(e.target.files)}
          />

          <span className="text-[11px] text-slate-400 italic">
            Format: JPG, PNG, HEIC &rarr; otomatis WebP
          </span>
        </div>
      )}

      {/* Loading Indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
          <span>{processStatus}</span>
        </div>
      )}

      {/* Info Kompresi Terakhir */}
      {recentStats.length > 0 && (
        <div className="p-2.5 bg-emerald-50/70 border border-emerald-100 rounded-lg text-[11px] text-emerald-900 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Hasil kompresi otomatis browser:
          </div>
          <div className="flex flex-wrap gap-2 text-slate-600">
            {recentStats.slice(0, 3).map((st, i) => (
              <span key={i} className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-emerald-200">
                <span className="truncate max-w-[120px] font-medium text-slate-700">{st.name}</span>:
                <span className="text-slate-400 line-through">{st.orig} KB</span>
                &rarr;
                <span className="font-semibold text-emerald-700">{st.comp} KB</span>
                <span className="text-emerald-800 font-bold bg-emerald-100 px-1 rounded">-{st.ratio}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Photo Preview Grid */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-1">
          {photos.map((photoUrl, idx) => (
            <div
              key={idx}
              className="group relative rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shadow-2xs aspect-4/3 flex items-center justify-center"
            >
              <img
                src={photoUrl}
                alt={`Dokumentasi ${idx + 1}`}
                className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
              />

              <div className="absolute top-1.5 left-1.5 bg-slate-900/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-xs">
                Foto #{idx + 1} • WebP
              </div>

              {/* Hover Overlay Controls */}
              <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewModalUrl(photoUrl)}
                  className="p-1.5 bg-white/90 hover:bg-white text-slate-800 rounded-full shadow transition-transform hover:scale-110 cursor-pointer"
                  title="Perbesar Foto"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(idx)}
                  className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-full shadow transition-transform hover:scale-110 cursor-pointer"
                  title="Hapus Foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-slate-200 rounded-lg p-4 text-center bg-slate-50/50">
          <p className="text-xs text-slate-400">
            Belum ada foto dokumentasi yang dilampirkan. Lampirkan foto surat jalan atau fisik timbangan barang.
          </p>
        </div>
      )}

      {/* Lightbox Preview Modal */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative max-w-4xl max-h-[90vh] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-slate-800 text-white text-xs">
              <span className="font-medium">Preview Foto Dokumentasi (Format WebP)</span>
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center overflow-auto max-h-[80vh]">
              <img
                src={previewModalUrl}
                alt="Preview Dokumentasi"
                className="max-h-[75vh] max-w-full object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
