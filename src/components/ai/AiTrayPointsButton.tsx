import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { BTN_SECONDARY } from '../common/FormDialog';
import { imageToAiPayload, requestTrayLabels } from '../../utils/aiAssist';

export interface TrayPoint {
  /** Posisi di foto, 0 sampai 1 dari kiri atas */
  nx: number;
  ny: number;
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// AI mencari tiap hidangan di foto. Yang tidak ditemukan tidak digeser, dan petugas diberi tahu: tanda foto tidak cocok dengan menu.
export const AiTrayPointsButton: React.FC<{
  photo: string;
  texts: string[];
  onPoints: (points: (TrayPoint | null)[], natural: { w: number; h: number }) => void;
}> = ({ photo, texts, onPoints }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<{ missing: string[]; seen: string[]; placed: number } | null>(null);

  const run = async () => {
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const payload = await imageToAiPayload(photo);
      const result = await requestTrayLabels({ mimeType: payload.mimeType, data: payload.data }, texts);
      const clamp = (v: number) => Math.min(1, Math.max(0, v / 1000));
      const points = texts.map(text => {
        const hit = result.items.find(i => sameText(i.text, text));
        return hit?.found ? { nx: clamp(hit.x), ny: clamp(hit.y) } : null;
      });
      onPoints(points, { w: payload.width, h: payload.height });
      setReport({
        missing: texts.filter((_, i) => !points[i]),
        seen: result.seenFoods,
        placed: points.filter(Boolean).length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Foto gagal dibaca AI. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-0">
      <button type="button" onClick={run} disabled={busy || texts.length === 0} className={`${BTN_SECONDARY} disabled:opacity-50 disabled:cursor-not-allowed`}>
        {busy && <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden="true" />}
        {busy ? 'Membaca foto...' : 'Cari titik dengan AI'}
      </button>
      <div aria-live="polite">
        {error && <p role="alert" className="mt-2 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        {report && report.missing.length > 0 && (
          <p className="mt-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Tidak terlihat di foto: <strong>{report.missing.join(', ')}</strong>. Titiknya tidak digeser. Periksa apakah foto ini memang untuk menu tersebut.
            {report.seen.length > 0 && ` AI melihat: ${report.seen.join(', ')}.`}
          </p>
        )}
        {report && report.missing.length === 0 && (
          <p className="mt-2 text-xs text-slate-700">{report.placed} titik diusulkan AI. Periksa lagi, lalu geser bila kurang pas.</p>
        )}
      </div>
    </div>
  );
};
