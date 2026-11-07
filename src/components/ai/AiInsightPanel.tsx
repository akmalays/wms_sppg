import React, { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { BTN_SECONDARY } from '../common/FormDialog';
import { findUnverifiedNumbers, requestInsights, type AiInsights } from '../../utils/aiAssist';

// Ringkasan rekap dari AI. Angkanya dihitung aplikasi, AI hanya menuliskan; angka di teks yang tidak ada di data ditandai.
export const AiInsightPanel: React.FC<{
  topic: 'limbah' | 'hedonik';
  periodLabel: string;
  /** Dipanggil saat tombol ditekan, supaya memakai filter yang sedang aktif. */
  getStats: () => unknown;
  /** Isi berarti belum ada data untuk diringkas. */
  emptyReason?: string;
}> = ({ topic, periodLabel, getStats, emptyReason }) => {
  const [result, setResult] = useState<{ insights: AiInsights; stats: unknown; period: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const stats = getStats();
      setResult({ insights: await requestInsights(topic, periodLabel, stats), stats, period: periodLabel });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ringkasan gagal dibuat. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const unverified = useMemo(() => {
    if (!result) return [];
    const { summary, findings, suggestions } = result.insights;
    const text = [summary, ...findings.flatMap(f => [f.title, f.detail]), ...suggestions].join(' ');
    return findUnverifiedNumbers(text, result.stats);
  }, [result]);

  return (
    <section aria-labelledby={`ai-insight-${topic}`} className="no-print bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 id={`ai-insight-${topic}`} className="text-sm font-semibold text-slate-800">Baca rekap dengan AI</h2>
          <p className="text-[11px] text-slate-600">
            {emptyReason || `Rekap ${periodLabel} dibaca AI menjadi temuan dan saran. Angka tetap dari rekap di halaman ini.`}
          </p>
        </div>
        <button type="button" onClick={generate} disabled={busy || Boolean(emptyReason)} className={`${BTN_SECONDARY} disabled:opacity-50 disabled:cursor-not-allowed`}>
          {busy && <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden="true" />}
          {busy ? 'Membaca rekap...' : result ? 'Buat ulang' : 'Buat ringkasan'}
        </button>
      </div>

      <div aria-live="polite">
        {error && <p role="alert" className="mt-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
        {result && (
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-3 text-xs text-slate-700 leading-relaxed">
            {result.period !== periodLabel && (
              <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">Ringkasan ini untuk {result.period}, bukan filter yang sedang aktif. Buat ulang bila perlu.</p>
            )}
            <p className="text-slate-900">{result.insights.summary}</p>
            {result.insights.findings.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-800">Temuan</h3>
                <ul className="mt-1 space-y-1.5">
                  {result.insights.findings.map((f, i) => (
                    <li key={i}><span className="font-semibold text-slate-900">{f.title}.</span> {f.detail}</li>
                  ))}
                </ul>
              </div>
            )}
            {result.insights.suggestions.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-800">Saran untuk dicek</h3>
                <ul className="mt-1 list-disc pl-4 space-y-1">
                  {result.insights.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {result.insights.caveats?.length > 0 && (
              <p className="text-slate-600"><span className="font-semibold">Keterbatasan data:</span> {result.insights.caveats.join(' ')}</p>
            )}
            {unverified.length > 0 && (
              <p className="flex items-start gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                Angka ini tidak ada di rekap, periksa dulu: {unverified.join(', ')}
              </p>
            )}
            <p className="text-[11px] text-slate-500">Draf dari AI, bukan kesimpulan resmi. Tidak tersimpan.</p>
          </div>
        )}
      </div>
    </section>
  );
};
