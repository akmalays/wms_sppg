import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Share2 } from 'lucide-react';
import { Employee } from '../types/warehouse';
import { parseSchedule, formatSchedule } from '../utils/attendanceSchedule';
import { DialogShell, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST } from './common/FormDialog';

// QR absen pribadi. Isinya kode karyawan (mis. EMP-005) yang dibaca layar Mode absen.
// Gambar kartu bisa diunduh atau langsung dibagikan ke WhatsApp karyawan, atau dicetak.

const CARD_W = 600;
const CARD_H = 760;

async function buildCardPng(emp: Employee): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const qrUrl = await QRCode.toDataURL(emp.id, { width: 480, margin: 1, errorCorrectionLevel: 'M' });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = qrUrl;
  });
  ctx.drawImage(img, 60, 50, 480, 480);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 34px Inter, system-ui, sans-serif';
  ctx.fillText(emp.name, CARD_W / 2, 590, CARD_W - 40);
  ctx.fillStyle = '#334155';
  ctx.font = '26px Inter, system-ui, sans-serif';
  ctx.fillText(`${emp.department} · ${formatSchedule(parseSchedule(emp.shift))}`, CARD_W / 2, 636, CARD_W - 40);
  ctx.fillStyle = '#475569';
  ctx.font = '22px Inter, system-ui, sans-serif';
  ctx.fillText(`QR absen SPPG Tumpang Jeru · ${emp.id}`, CARD_W / 2, 700, CARD_W - 40);

  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/png'));
}

export const EmployeeQrDialog: React.FC<{ employee: Employee; onClose: () => void }> = ({ employee, onClose }) => {
  const [qrUrl, setQrUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    QRCode.toDataURL(employee.id, { width: 360, margin: 1, errorCorrectionLevel: 'M' })
      .then(setQrUrl)
      .catch(() => setError('QR gagal dibuat. Tutup lalu coba lagi.'));
  }, [employee.id]);

  const fileName = `QR-absen-${employee.name.replace(/[^a-zA-Z0-9]+/g, '-')}.png`;
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  const canShareFile = typeof nav.share === 'function' && typeof nav.canShare === 'function';

  const withCard = async (action: (blob: Blob) => Promise<void> | void) => {
    setBusy(true);
    setError('');
    try {
      const blob = await buildCardPng(employee);
      if (!blob) throw new Error();
      await action(blob);
    } catch (err: any) {
      // Membatalkan menu bagikan bukan kesalahan
      if (err?.name !== 'AbortError') setError('Gambar QR gagal dibuat. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const download = () =>
    withCard(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    });

  const share = () =>
    withCard(async blob => {
      const file = new File([blob], fileName, { type: 'image/png' });
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'QR absen', text: `QR absen ${employee.name}. Simpan di galeri, tunjukkan ke kamera Mode absen saat masuk dan pulang.` });
      } else {
        throw new Error('share-unsupported');
      }
    });

  return (
    <DialogShell
      size="md"
      title="QR absen"
      description="Kirim ke HP karyawan atau cetak. Tunjukkan ke kamera Mode absen saat masuk dan pulang."
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
            Tutup
          </button>
          <button type="button" onClick={download} disabled={busy || !qrUrl} className={BTN_SECONDARY}>
            <Download className="w-4 h-4 text-slate-500" />
            Unduh gambar
          </button>
          {canShareFile && (
            <button type="button" onClick={share} disabled={busy || !qrUrl} className={BTN_PRIMARY}>
              <Share2 className="w-4 h-4" />
              Bagikan
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        {qrUrl ? (
          <img src={qrUrl} alt={`QR absen ${employee.name}`} className="w-60 h-60" />
        ) : (
          <div className="w-60 h-60 rounded-xl bg-slate-100 flex items-center justify-center text-xs text-slate-600">
            {error || 'Membuat QR…'}
          </div>
        )}
        <div className="mt-3 text-base font-bold text-slate-900">{employee.name}</div>
        <div className="text-xs text-slate-700">
          {employee.department} · {formatSchedule(parseSchedule(employee.shift))}
        </div>
        <div className="mt-1 font-mono text-[11px] text-slate-600">{employee.id}</div>
        {error && qrUrl && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
      </div>
    </DialogShell>
  );
};
