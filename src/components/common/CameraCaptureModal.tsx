import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, RefreshCw, X } from 'lucide-react';
import { formatPhotoTimestamp } from '../../utils/imageCompressor';

export const isTouchPrimaryDevice = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(pointer: coarse)').matches;

export const hasLiveCameraSupport = (): boolean =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function');

/** Ambil waktu unggah (ms) dari pola nama file sppg-documentation/<folder>/<epochMs>_<rand>.webp bila tersedia. */
export function extractTimestampFromPhotoUrl(url: string): Date | null {
  const match = (url || '').match(/\/(?:receiving|waste|menu|profile)\/(\d{13})_/);
  if (!match?.[1]) return null;
  const ms = Number(match[1]);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface CameraCaptureModalProps {
  title?: string;
  secondaryPreview: string;
  onCapture: (blob: Blob, capturedAt: Date) => void;
  onFallbackFile: () => void;
  onClose: () => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  title = 'Ambil foto',
  secondaryPreview,
  onCapture,
  onFallbackFile,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  useEffect(() => {
    let cancelled = false;

    const stopCurrent = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };

    const start = async () => {
      stopCurrent();
      setStatus('loading');
      setErrorMsg('');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('ready');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Izin kamera ditolak browser. Aktifkan izin kamera atau pilih foto dari perangkat.'
            : err instanceof DOMException && err.name === 'NotFoundError'
              ? 'Kamera tidak ditemukan di perangkat ini. Anda tetap bisa memilih foto dari galeri.'
              : 'Kamera tidak bisa dibuka di browser ini. Gunakan pilihan galeri sebagai gantinya.';
        setErrorMsg(msg);
        setStatus('error');
      }
    };

    void start();
    return () => {
      cancelled = true;
      stopCurrent();
    };
  }, [facingMode]);

  const handleShutter = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedAt = new Date();
    canvas.toBlob(
      blob => {
        if (!blob) return;
        onCapture(blob, capturedAt);
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-900/75 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sppg-camera-capture-title"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h4 id="sppg-camera-capture-title" className="text-sm font-bold text-slate-900">
              {title}
            </h4>
            <p className="text-xs text-slate-600">Timestamp otomatis dibakar ke foto saat dijepret.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kamera"
            className="inline-flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-slate-950 flex-1 flex flex-col items-center justify-center min-h-[260px]">
          {status === 'error' ? (
            <div role="alert" className="max-w-md w-full bg-white rounded-lg p-4 text-xs text-slate-700 space-y-3">
              <p className="font-semibold text-rose-700">Kamera tidak tersedia</p>
              <p>{errorMsg}</p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onFallbackFile();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white min-h-[44px] sm:min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
              >
                <ImagePlus className="w-4 h-4" />
                Pilih foto dari perangkat
              </button>
            </div>
          ) : (
            <div className="relative w-full max-w-xl aspect-4/3 bg-slate-900 rounded-lg overflow-hidden">
              <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
              {status === 'loading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 text-xs text-slate-200">
                  Membuka kamera...
                </div>
              )}
              {status === 'ready' && (
                <div className="pointer-events-none absolute left-3 bottom-3 max-w-[calc(100%-1.5rem)] rounded-lg bg-slate-900/80 border border-white/20 px-3 py-1.5 text-white">
                  <div className="font-mono text-xs font-bold tabular-nums">{formatPhotoTimestamp(now, true)}</div>
                  <div className="text-[11px] text-slate-200 truncate">{secondaryPreview}</div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'))}
            disabled={status !== 'ready'}
            className="inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50 min-h-[44px] sm:min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Ganti kamera
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-200/70 rounded-lg min-h-[44px] sm:min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleShutter}
              disabled={status !== 'ready'}
              className="inline-flex items-center gap-1.5 px-4 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white min-h-[44px] sm:min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
            >
              <Camera className="w-4 h-4" />
              Jepret foto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
