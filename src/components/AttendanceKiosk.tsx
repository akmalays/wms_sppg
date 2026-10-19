import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff, RefreshCw } from 'lucide-react';
import { warehouseDb } from '../db/storage';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { Employee, EmployeeAttendance } from '../types/warehouse';
import { localDateIso } from '../utils/localDate';
import { parseScanText } from '../utils/scanCode';
import { formatDuration, toMinutes } from '../utils/attendanceSchedule';
import { decideAttendance, nowHHMM, shiftIsoDate } from '../utils/attendanceAction';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_INPUT } from './common/FormDialog';

// Mode absen: satu HP/tablet di pintu masuk. Karyawan menunjukkan QR absen (dari HP-nya atau kartu),
// layar mencatat jam masuk/pulang dan memotret sekilas sebagai bukti agar QR tidak bisa dititipkan.

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

type ScanResult =
  | { kind: 'IN'; emp: Employee; time: string; lateMinutes: number; flexible: boolean; photo?: string }
  | { kind: 'OUT'; emp: Employee; time: string; worked: number; photo?: string }
  | { kind: 'ALREADY'; emp: Employee; message: string }
  | { kind: 'UNKNOWN'; code: string };

/** Kode yang sama diabaikan selama ini agar satu QR tidak terbaca berkali-kali. */
const SAME_CODE_COOLDOWN_MS = 8000;
const RESULT_VISIBLE_MS = 5000;

export const AttendanceKiosk: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { currentUser } = useAuth();
  const askConfirm = useConfirm();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const resultTimerRef = useRef<number | undefined>(undefined);

  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState('');
  const [clock, setClock] = useState(() => new Date());
  const [result, setResult] = useState<ScanResult | null>(null);
  const [todayLogs, setTodayLogs] = useState<EmployeeAttendance[]>(() => warehouseDb.getAttendanceLogs(localDateIso()));
  const [manualCode, setManualCode] = useState('');

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Layar tetap menyala selama mode absen (bila browser mendukung)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request('screen').then(l => (lock = l)).catch(() => undefined);
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, []);

  // Foto kecil dari kamera saat QR terbaca (±6 KB), cukup untuk mengenali wajah dan hemat database.
  // Dihapus otomatis setelah ATTENDANCE_PHOTO_RETENTION_DAYS (lihat storage.purgeOldAttendancePhotos).
  const capturePhoto = (): string | undefined => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return undefined;
    const canvas = document.createElement('canvas');
    const scale = 200 / video.videoWidth;
    canvas.width = 200;
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.55);
  };

  const showResult = (r: ScanResult) => {
    setResult(r);
    window.clearTimeout(resultTimerRef.current);
    resultTimerRef.current = window.setTimeout(() => setResult(null), RESULT_VISIBLE_MS);
  };

  const handleCode = useCallback(
    (raw: string) => {
      const code = (parseScanText(raw)?.code || '').trim().toUpperCase();
      if (!code) return;
      const nowMs = Date.now();
      if (lastScanRef.current.code === code && nowMs - lastScanRef.current.at < SAME_CODE_COOLDOWN_MS) return;
      lastScanRef.current = { code, at: nowMs };
      navigator.vibrate?.(60);

      const emp = warehouseDb.getEmployees().find(e => e.id.toUpperCase() === code && e.status !== 'NONAKTIF');
      if (!emp) {
        showResult({ kind: 'UNKNOWN', code });
        return;
      }

      const now = new Date();
      const time = nowHHMM(now);
      const today = localDateIso(now);
      const todays = warehouseDb.getAttendanceLogs(today).find(a => a.employeeId === emp.id);
      const yesterday = warehouseDb.getAttendanceLogs(shiftIsoDate(today, -1)).find(a => a.employeeId === emp.id);
      const decision = decideAttendance(emp.shift, today, time, todays, yesterday);

      const base = {
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        position: emp.position,
        shift: emp.shift,
        recordedBy: `Mode absen (${currentUser.name})`,
        verified: true,
      };

      if (decision.kind === 'TOO_SOON') {
        showResult({ kind: 'ALREADY', emp, message: `Sudah tercatat masuk pukul ${decision.checkIn}. Pindai lagi saat pulang.` });
        return;
      }
      if (decision.kind === 'COMPLETE') {
        showResult({ kind: 'ALREADY', emp, message: `Absen hari ini sudah lengkap: masuk ${decision.checkIn}, pulang ${decision.checkOut}.` });
        return;
      }
      if (decision.kind === 'OUT') {
        const open = decision.date === today ? todays! : yesterday!;
        warehouseDb.recordAttendance(
          { ...base, date: open.date, checkInTime: open.checkInTime, checkOutTime: time, status: open.status, lateMinutes: open.lateMinutes, photoUrl: open.photoUrl, notes: open.notes },
          currentUser
        );
        showResult({ kind: 'OUT', emp, time, worked: decision.worked, photo: open.photoUrl });
      } else {
        const late = decision.lateMinutes;
        const photo = capturePhoto();
        warehouseDb.recordAttendance(
          {
            ...base,
            date: today,
            checkInTime: time,
            checkOutTime: '',
            status: late > 0 ? 'TERLAMBAT' : 'HADIR',
            lateMinutes: late,
            photoUrl: photo || '',
            notes: todays?.notes,
          },
          currentUser
        );
        showResult({ kind: 'IN', emp, time, lateMinutes: late, flexible: decision.flexible, photo });
      }
      setTodayLogs(warehouseDb.getAttendanceLogs(today));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser]
  );

  const handleCodeRef = useRef(handleCode);
  handleCodeRef.current = handleCode;

  // Kamera terus membaca QR; dibuka ulang saat kamera depan/belakang diganti
  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
    setCameraError('');

    const tick = async () => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth > 0) {
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) handleCodeRef.current(codes[0].rawValue);
          } else {
            const canvas = (canvasRef.current ||= document.createElement('canvas'));
            const scale = Math.min(1, 640 / video.videoWidth);
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
              if (qr?.data) handleCodeRef.current(qr.data);
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
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
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
            ? 'Izin kamera ditolak. Izinkan kamera di pengaturan browser, lalu buka lagi mode absen.'
            : 'Kamera tidak bisa dibuka. Kode absen masih bisa diketik di bawah.'
        );
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [facing]);

  useEffect(() => () => window.clearTimeout(resultTimerRef.current), []);

  const handleExit = async () => {
    if (
      await askConfirm({
        title: 'Keluar dari mode absen?',
        message: 'Kamera berhenti dan karyawan tidak bisa absen dari perangkat ini sampai mode absen dibuka lagi.',
        confirmText: 'Keluar',
      })
    ) {
      onClose();
    }
  };

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    lastScanRef.current = { code: '', at: 0 };
    handleCode(manualCode);
    setManualCode('');
  };

  const masukCount = todayLogs.filter(a => a.checkInTime).length;
  const pulangCount = todayLogs.filter(a => a.checkOutTime).length;
  const recent = [...todayLogs]
    .filter(a => a.checkInTime)
    .sort((a, b) => toMinutes(b.checkOutTime || b.checkInTime) - toMinutes(a.checkOutTime || a.checkInTime))
    .slice(0, 8);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="kiosk-title" className="fixed inset-0 z-[60] bg-slate-100 flex flex-col">
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 id="kiosk-title" className="text-sm font-semibold text-slate-900">Mode absen</h1>
          <p className="text-[11px] text-slate-600">
            {clock.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {/* Jam besar: karyawan melihat jam yang akan tercatat */}
        <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums" aria-live="off">
          {clock.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <button type="button" onClick={handleExit} className={BTN_SECONDARY}>
          Keluar
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Kamera: latar gelap agar pratinjau jelas di ruangan terang maupun subuh */}
        <section className="flex flex-col gap-3 min-h-0">
          <div className="relative flex-1 min-h-[280px] rounded-xl overflow-hidden bg-slate-900">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-slate-200 text-sm">
                <CameraOff className="w-8 h-8 text-slate-400" />
                {cameraError}
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
                />
                {/* Bingkai bidik membantu karyawan menempatkan QR di tengah */}
                <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-xl border-2 border-white/80" />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-800">
              <b>Tunjukkan QR absen</b> dari HP atau kartu ke kamera. Pindai sekali saat masuk dan sekali saat pulang.
            </p>
            <button type="button" onClick={() => setFacing(f => (f === 'user' ? 'environment' : 'user'))} className={BTN_SECONDARY}>
              <RefreshCw className="w-4 h-4 text-slate-500" />
              Ganti kamera
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-4 min-w-0">
          {/* Hasil pindai terakhir: satu-satunya fokus layar setelah QR terbaca */}
          <div aria-live="polite" className="min-h-[148px]">
            {!result && (
              <div className="h-full rounded-xl border border-dashed border-slate-300 bg-white p-4 flex items-center text-sm text-slate-600">
                Menunggu QR. Hasil absen muncul di sini.
              </div>
            )}
            {result && (result.kind === 'IN' || result.kind === 'OUT') && (
              <div
                className={`rounded-xl border p-4 flex gap-3 ${
                  result.kind === 'IN' && result.lateMinutes > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                {result.photo ? (
                  <img src={result.photo} alt={`Foto ${result.emp.name}`} className="w-20 h-20 rounded-lg object-cover shrink-0 -scale-x-100" />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-white border border-slate-200 shrink-0 flex items-center justify-center text-2xl font-bold text-slate-500">
                    {result.emp.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-base font-bold text-slate-900 truncate">{result.emp.name}</div>
                  <div className="text-xs text-slate-700">{result.emp.department}</div>
                  <div className="mt-2 text-lg font-bold text-slate-900">
                    {result.kind === 'IN' ? 'Masuk' : 'Pulang'} <span className="font-mono tabular-nums">{result.time}</span>
                  </div>
                  <div className={`text-sm font-medium ${result.kind === 'IN' && result.lateMinutes > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {result.kind === 'IN'
                      ? result.flexible
                        ? 'Jam fleksibel'
                        : result.lateMinutes > 0
                          ? `Terlambat ${formatDuration(result.lateMinutes)}`
                          : 'Tepat waktu'
                      : `Lama kerja ${formatDuration(result.worked)}`}
                  </div>
                </div>
              </div>
            )}
            {result?.kind === 'ALREADY' && (
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                <div className="text-base font-bold text-slate-900">{result.emp.name}</div>
                <div className="text-sm text-sky-800 mt-1">{result.message}</div>
              </div>
            )}
            {result?.kind === 'UNKNOWN' && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <div className="text-base font-bold text-rose-900">QR tidak dikenali</div>
                <div className="text-sm text-rose-800 mt-1">
                  Kode {result.code} bukan QR absen karyawan aktif. Minta QR absen ke admin.
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Hari ini</h2>
              <span className="text-xs text-slate-600 tabular-nums">
                {masukCount} masuk · {pulangCount} pulang
              </span>
            </div>
            {recent.length === 0 ? (
              <p className="px-4 py-6 text-xs text-slate-600 text-center">Belum ada yang absen hari ini.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recent.map(a => (
                  <li key={a.id} className="px-4 py-2 flex items-center justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate font-medium text-slate-900">{a.employeeName}</span>
                    <span className="shrink-0 font-mono tabular-nums text-slate-700">
                      {a.checkInTime}
                      {a.checkOutTime ? ` - ${a.checkOutTime}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Cadangan bila QR rusak atau kamera bermasalah */}
          <form onSubmit={submitManual} className="flex gap-2">
            <label htmlFor="kiosk-manual" className="sr-only">Kode absen</label>
            <input
              id="kiosk-manual"
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value)}
              placeholder="Ketik kode absen, mis. EMP-005"
              className={`${FIELD_INPUT} font-mono uppercase`}
              autoComplete="off"
            />
            <button type="submit" disabled={!manualCode.trim()} className={BTN_PRIMARY}>
              Absen
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};
