import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, CameraOff, ScanLine } from 'lucide-react';
import { parseScanText, ScanTarget } from '../../utils/scanCode';

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

interface QrScannerDialogProps {
  title?: string;
  /** Petunjuk singkat di bawah kamera, mis. "Arahkan ke label barang". */
  hint?: string;
  onResult: (target: ScanTarget) => void;
  onClose: () => void;
}

/**
 * Pemindai QR dengan kamera belakang. BarcodeDetector dipakai bila browser punya (Chrome Android);
 * selain itu jsQR membaca bingkai video (Safari iPhone). Kode juga bisa diketik bila kamera tidak bisa dipakai.
 */
export const QrScannerDialog: React.FC<QrScannerDialogProps> = ({ title = 'Pindai QR', hint = 'Arahkan kamera ke QR pada label.', onResult, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(false);
  // Disimpan di ref agar kamera tidak dibuka ulang setiap kali induknya render dengan fungsi baru.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const [cameraError, setCameraError] = useState('');
  const [manual, setManual] = useState('');

  useEffect(() => {
    // Fase capture + stopPropagation: Escape hanya menutup pemindai, bukan modal di belakangnya
    // (mis. modal pemakaian dapur yang isiannya belum disimpan).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;

    const finish = (raw: string) => {
      const target = parseScanText(raw);
      if (!target || doneRef.current) return false;
      doneRef.current = true;
      navigator.vibrate?.(60);
      onResultRef.current(target);
      return true;
    };

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue && finish(codes[0].rawValue)) return;
          } else {
            const canvas = (canvasRef.current ||= document.createElement('canvas'));
            // Diperkecil agar ringan di HP; QR di label tetap terbaca di resolusi ini.
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
              if (code?.data && finish(code.data)) return;
            }
          }
        } catch {
          /* bingkai berikutnya dicoba lagi */
        }
      }
      frame = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(window.isSecureContext ? 'Browser ini tidak mendukung kamera.' : 'Kamera hanya bisa dipakai lewat alamat https.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) return;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        frame = requestAnimationFrame(tick);
      } catch (err: any) {
        setCameraError(
          err?.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, atau ketik kodenya di bawah.'
            : 'Kamera tidak bisa dibuka. Ketik kodenya di bawah.'
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseScanText(manual);
    if (target) onResult(target);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scan-title"
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 id="qr-scan-title" className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-emerald-700" />
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Tutup pemindai" className={`w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCUS}`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-slate-900 aspect-square sm:aspect-[4/3]">
          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-200 text-xs">
              <CameraOff className="w-8 h-8 text-slate-400" />
              <p>{cameraError}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
              {/* Bingkai bidik: membantu menaruh QR di tengah. */}
              <div aria-hidden="true" className="absolute inset-[18%] rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.35)]" />
            </>
          )}
        </div>

        <div className="p-4 space-y-3">
          {!cameraError && <p className="text-xs text-slate-600">{hint}</p>}
          <form onSubmit={submitManual} className="flex gap-2">
            <label htmlFor="qr-manual" className="sr-only">Ketik kode</label>
            <input
              id="qr-manual"
              value={manual}
              onChange={e => setManual(e.target.value)}
              placeholder="Atau ketik kode, mis. ITM-BSH-001"
              className="flex-1 min-w-0 px-2.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            />
            <button type="submit" disabled={!manual.trim()} className={`px-3.5 min-h-[44px] sm:min-h-[34px] rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-xs font-semibold cursor-pointer ${FOCUS}`}>
              Buka
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

/** Tombol "Pindai" standar untuk form; membuka QrScannerDialog. */
export const ScanButton: React.FC<{ onResult: (target: ScanTarget) => void; label?: string; hint?: string; className?: string }> = ({
  onResult,
  label = 'Pindai',
  hint,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center justify-center gap-1.5 px-3 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer ${FOCUS} ${className}`}
      >
        <ScanLine className="w-4 h-4 text-emerald-700" />
        {label}
      </button>
      {open && (
        <QrScannerDialog
          hint={hint}
          onClose={() => setOpen(false)}
          onResult={t => {
            setOpen(false);
            onResult(t);
          }}
        />
      )}
    </>
  );
};
