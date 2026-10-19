import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer } from 'lucide-react';
import { SppgLogo } from './SppgLogo';
import { DialogShell, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST } from './common/FormDialog';

// Poster A4 berisi QR ke halaman absen (/absen) untuk ditempel di lobby.
// QR-nya tetap; keamanan absen ada di pemeriksaan lokasi HP dan foto, bukan di QR.

export const attendancePageUrl = () => `${window.location.origin}/absen`;

const STEPS = [
  'Pindai QR ini dengan kamera HP Anda.',
  'Pilih nama Anda (cukup sekali, berikutnya diingat).',
  'Saat masuk: tekan "Foto & absen masuk", lalu foto wajah.',
  'Saat pulang: pindai lagi, tekan "Absen pulang".',
  'Nyalakan lokasi/GPS HP. Absen hanya bisa di area SPPG.',
];

export const AttendancePosterSheet: React.FC<{ qrDataUrl: string }> = ({ qrDataUrl }) => (
  <div className="bg-white text-slate-900 font-sans w-full max-w-[190mm] mx-auto text-center p-6 print:p-0">
    <div className="flex items-center justify-center gap-3">
      <SppgLogo size="lg" variant="color" showText={false} />
      <div className="text-left">
        <div className="text-[12px] font-bold">BADAN GIZI NASIONAL</div>
        <div className="text-sm font-bold">SPPG Tumpang Jeru</div>
      </div>
    </div>
    <h1 className="mt-6 text-4xl font-bold">Absen karyawan</h1>
    <p className="mt-2 text-lg text-slate-700">Masuk dan pulang, pindai dari HP Anda</p>
    {qrDataUrl && <img src={qrDataUrl} alt="QR absen karyawan" className="mx-auto mt-6 w-[110mm] h-[110mm]" />}
    <p className="mt-2 font-mono text-sm text-slate-700">{attendancePageUrl().replace(/^https?:\/\//, '')}</p>
    <ol className="mt-6 mx-auto max-w-[150mm] text-left text-base space-y-1.5 list-decimal pl-6">
      {STEPS.map(s => (
        <li key={s}>{s}</li>
      ))}
    </ol>
    <p className="mt-5 text-sm text-slate-700">Kendala absen? Lapor ke satpam di lobby.</p>
  </div>
);

export const AttendancePosterDialog: React.FC<{ onClose: () => void; onPrint: () => void }> = ({ onClose, onPrint }) => {
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toDataURL(attendancePageUrl(), { width: 800, margin: 1, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, []);

  return (
    <DialogShell
      size="lg"
      title="QR absen untuk lobby"
      description="Cetak di A4 lalu tempel di lobby, dekat pos satpam. QR ini tetap dan tidak perlu diganti."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
            Tutup
          </button>
          <button type="button" onClick={onPrint} disabled={!qr} className={BTN_PRIMARY}>
            <Printer className="w-4 h-4" />
            Cetak poster
          </button>
        </>
      }
    >
      <div className="border border-slate-200 rounded-xl">
        {qr ? <AttendancePosterSheet qrDataUrl={qr} /> : <p className="p-8 text-center text-xs text-slate-600">Membuat QR…</p>}
      </div>
    </DialogShell>
  );
};

/** QR untuk dipakai di area cetak modul (di luar dialog). */
export const useAttendanceQr = () => {
  const [qr, setQr] = useState('');
  useEffect(() => {
    QRCode.toDataURL(attendancePageUrl(), { width: 800, margin: 1, errorCorrectionLevel: 'M' }).then(setQr).catch(() => setQr(''));
  }, []);
  return qr;
};
