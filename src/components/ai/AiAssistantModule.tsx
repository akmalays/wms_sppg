import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, RefreshCw } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY, FIELD_INPUT, FIELD_LABEL, FOCUS_RING } from '../common/FormDialog';
import { Select } from '../common/Select';
import { localDateIso } from '../../utils/localDate';
import { findUnverifiedNumbers, requestQuerySpec, requestReport, type AiQuerySpec } from '../../utils/aiAssist';
import { formatQueryValue, runQuery, type QueryResult } from '../../utils/aiDataQuery';
import { buildOperationalStats, type OperationalStats } from '../../utils/aiStats';

// Asisten Data: pertanyaan biasa dijawab dari data aplikasi (AI hanya menerjemahkan), dan draf laporan dari angka yang dihitung aplikasi.

const EXAMPLES = [
  'Berapa total belanja bulan ini?',
  'Barang apa yang paling banyak dibelanjakan bulan ini?',
  'Stok apa saja yang menipis?',
  'Berapa kg limbah per kategori bulan ini?',
  'Supplier mana dengan nilai pesanan terbesar bulan ini?',
];

const ErrorNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p role="alert" className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{children}</p>
);

const AskPanel: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState<{ question: string; spec: AiQuerySpec; result: QueryResult | null } | null>(null);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setQuestion(q);
    setBusy(true);
    setError('');
    setAnswer(null);
    try {
      const spec = await requestQuerySpec(q, localDateIso());
      setAnswer({ question: q, spec, result: spec.answerable ? runQuery(spec) : null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pertanyaan gagal diproses. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const result = answer?.result;

  return (
    <div className="space-y-3">
      <form
        onSubmit={e => {
          e.preventDefault();
          ask(question);
        }}
        className="bg-white rounded-xl border border-slate-200 p-4"
      >
        <label htmlFor="ai-question" className={FIELD_LABEL}>Pertanyaan</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input id="ai-question" type="text" maxLength={300} value={question} onChange={e => setQuestion(e.target.value)} placeholder="Berapa belanja ayam bulan ini?" className={FIELD_INPUT} />
          <button type="submit" disabled={busy || !question.trim()} className={`${BTN_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}>
            {busy && <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden="true" />}
            {busy ? 'Menghitung...' : 'Tanyakan'}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map(ex => (
            <button key={ex} type="button" onClick={() => ask(ex)} disabled={busy} className={`min-h-[44px] sm:min-h-[28px] px-2.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] text-slate-700 text-left cursor-pointer disabled:opacity-50 ${FOCUS_RING}`}>
              {ex}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-600">Yang dikirim ke AI hanya pertanyaanmu. Angkanya dihitung di aplikasi dari data Pengeluaran, nota pesanan, stok, limbah, dan rencana menu. Data karyawan tidak termasuk.</p>
      </form>

      <div aria-live="polite" className="space-y-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        {answer && !answer.spec.answerable && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-xs text-slate-700">
            <p className="font-semibold text-slate-900">Belum bisa dijawab dari data aplikasi.</p>
            <p className="mt-1">{answer.spec.reason || 'Pertanyaan ini di luar data yang tersedia. Coba tanyakan belanja, pesanan, stok, limbah, atau menu.'}</p>
          </div>
        )}
        {answer && result && (
          <section aria-label="Jawaban" className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-[11px] text-slate-600">{answer.question}</p>
            {result.recordCount === 0 ? (
              <p className="mt-1 text-sm font-semibold text-slate-900">Tidak ada catatan yang cocok untuk periode dan kata kunci ini.</p>
            ) : (
              <>
                <p className="mt-1 text-xs text-slate-700">{result.metricLabel}</p>
                <p className="text-xl font-bold text-slate-900 tracking-tight tabular-nums">
                  {result.totals.length > 0 ? result.totals.map(t => formatQueryValue(t, result.format)).join(' + ') : '-'}
                </p>
                {result.rows.length > 1 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-200">
                        {result.rows.map(row => (
                          <tr key={`${row.label}|${row.unit}`}>
                            <td className="py-1.5 pr-3 text-slate-800">{row.label}</td>
                            <td className="py-1.5 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">{formatQueryValue(row, result.format)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.truncated && <p className="mt-1 text-[11px] text-slate-600">Hanya baris teratas yang ditampilkan; totalnya tetap dari semua catatan.</p>}
                  </div>
                )}
                {result.skippedCount > 0 && <p className="mt-2 text-[11px] text-amber-800">{result.skippedCount} catatan tidak ikut dihitung karena tanpa harga atau bukan satuan berat.</p>}
              </>
            )}
            <dl className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[11px] text-slate-600">
              <dt className="font-medium">Dipahami sebagai</dt><dd>{answer.spec.interpretation || '-'}</dd>
              <dt className="font-medium">Sumber</dt><dd>{result.sourceLabel}, {result.recordCount} catatan</dd>
              <dt className="font-medium">Periode</dt><dd>{result.periodLabel}</dd>
              {result.filterLabels.length > 0 && <><dt className="font-medium">Saring</dt><dd>{result.filterLabels.join(', ')}</dd></>}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
};

type PeriodKey = '7' | 'MONTH' | 'LAST_MONTH' | 'CUSTOM';

const rangeOf = (key: PeriodKey, customFrom: string, customTo: string): [string, string] => {
  const now = new Date();
  if (key === 'MONTH') return [localDateIso(new Date(now.getFullYear(), now.getMonth(), 1)), localDateIso(now)];
  if (key === 'LAST_MONTH') return [localDateIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), localDateIso(new Date(now.getFullYear(), now.getMonth(), 0))];
  if (key === '7') return [localDateIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), localDateIso(now)];
  return [customFrom, customTo];
};

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

const ReportPanel: React.FC = () => {
  const today = localDateIso();
  const [period, setPeriod] = useState<PeriodKey>('MONTH');
  const [customFrom, setCustomFrom] = useState(today);
  const [customTo, setCustomTo] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<OperationalStats | null>(null);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  const [from, to] = rangeOf(period, customFrom, customTo);
  const invalid = !from || !to || from > to;

  const generate = async () => {
    setBusy(true);
    setError('');
    try {
      const nextStats = await buildOperationalStats(from, to);
      const report = await requestReport(`${from} sampai ${to}`, nextStats);
      setStats(nextStats);
      setText([report.title, ...report.sections.map(s => `${s.heading}\n${s.body}`)].join('\n\n'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Draf laporan gagal dibuat. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Browser menolak menyalin. Pilih teksnya lalu salin manual.');
    }
  };

  const unverified = useMemo(() => (stats && text ? findUnverifiedNumbers(text, stats) : []), [stats, text]);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="sm:w-48">
            <label htmlFor="ai-report-period" className={FIELD_LABEL}>Periode</label>
            <Select id="ai-report-period" size="sm" value={period} onChange={e => setPeriod(e.target.value as PeriodKey)}>
              <option value="7">7 hari terakhir</option>
              <option value="MONTH">Bulan ini</option>
              <option value="LAST_MONTH">Bulan lalu</option>
              <option value="CUSTOM">Pilih tanggal</option>
            </Select>
          </div>
          {period === 'CUSTOM' && (
            <>
              <div>
                <label htmlFor="ai-report-from" className={FIELD_LABEL}>Dari</label>
                <input id="ai-report-from" type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={FIELD_INPUT} />
              </div>
              <div>
                <label htmlFor="ai-report-to" className={FIELD_LABEL}>Sampai</label>
                <input id="ai-report-to" type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={FIELD_INPUT} />
              </div>
            </>
          )}
          <button type="button" onClick={generate} disabled={busy || invalid} className={`${BTN_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}>
            {busy && <RefreshCw className="w-3.5 h-3.5 motion-safe:animate-spin" aria-hidden="true" />}
            {busy ? 'Menyusun draf...' : stats ? 'Buat ulang draf' : 'Buat draf laporan'}
          </button>
        </div>
        {invalid && <p className="mt-2 text-[11px] text-rose-800">Tanggal mulai harus sebelum tanggal akhir.</p>}
        <p className="mt-2 text-[11px] text-slate-600">Yang dikirim ke AI: rekap belanja, pesanan, stok, limbah, menu, dan komentar uji hedonik tanpa nama penilai. Data karyawan tidak dikirim.</p>
      </div>

      <div aria-live="polite" className="space-y-3">
        {error && <ErrorNote>{error}</ErrorNote>}
        {stats && (
          <>
            <section aria-labelledby="ai-report-numbers" className="bg-white rounded-xl border border-slate-200 p-4">
              <h2 id="ai-report-numbers" className="text-sm font-semibold text-slate-800">Angka dari aplikasi</h2>
              <p className="text-[11px] text-slate-600">Dihitung langsung dari data, bukan oleh AI. Pakai untuk memeriksa draf di bawah.</p>
              <dl className="mt-2 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-xs">
                <div><dt className="text-slate-600">Menu</dt><dd className="font-semibold text-slate-900 tabular-nums">{stats.menu.jumlahMenu} menu, {stats.menu.totalPorsi.toLocaleString('id-ID')} porsi</dd></div>
                <div><dt className="text-slate-600">Belanja</dt><dd className="font-semibold text-slate-900 tabular-nums">{rupiah(stats.belanja.totalRupiah)}</dd></div>
                <div><dt className="text-slate-600">Pesanan supplier</dt><dd className="font-semibold text-slate-900 tabular-nums">{rupiah(stats.pesanan.totalRupiah)}</dd></div>
                <div><dt className="text-slate-600">Limbah</dt><dd className="font-semibold text-slate-900 tabular-nums">{stats.limbah.totalKg.toLocaleString('id-ID')} kg</dd></div>
                <div><dt className="text-slate-600">Stok di bawah minimum</dt><dd className="font-semibold text-slate-900 tabular-nums">{stats.stok.dibawahMinimum} dari {stats.stok.barangAktif} barang</dd></div>
                <div><dt className="text-slate-600">Nilai uji hedonik</dt><dd className="font-semibold text-slate-900 tabular-nums">{'nilaiRataRata' in stats.hedonik ? `${stats.hedonik.nilaiRataRata ?? '-'} dari ${stats.hedonik.jumlahPenilai} penilai` : 'Tidak bisa dimuat'}</dd></div>
              </dl>
            </section>
            <section aria-labelledby="ai-report-draft" className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h2 id="ai-report-draft" className="text-sm font-semibold text-slate-800"><label htmlFor="ai-report-text">Draf narasi</label></h2>
                  <p className="text-[11px] text-slate-600">Bisa langsung diedit. Tidak tersimpan di aplikasi, salin sebelum menutup halaman.</p>
                </div>
                <button type="button" onClick={copy} disabled={!text} className={BTN_SECONDARY}>
                  {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                  {copied ? 'Tersalin' : 'Salin draf'}
                </button>
              </div>
              <textarea id="ai-report-text" rows={18} value={text} onChange={e => setText(e.target.value)} className="w-full p-3 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 leading-relaxed focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" />
              {unverified.length > 0 && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  Angka ini tidak ada di data sumber, periksa dulu: {unverified.join(', ')}
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export const AiAssistantModule: React.FC = () => {
  const [tab, setTab] = useState<'ask' | 'report'>('ask');
  const tabCls = (on: boolean) => `flex-1 sm:flex-none min-h-[44px] sm:min-h-[32px] px-3 rounded-md text-xs cursor-pointer transition-colors duration-150 ${FOCUS_RING} ${on ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'}`;
  return (
    <div className="space-y-3">
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Asisten Data</h1>
          <p className="text-xs text-slate-600 mt-0.5">Tanya angka operasional dengan bahasa biasa, atau susun draf laporan.</p>
        </div>
        <div role="group" aria-label="Pilih alat" className="flex gap-1 p-1 rounded-lg bg-slate-100">
          <button type="button" aria-pressed={tab === 'ask'} onClick={() => setTab('ask')} className={tabCls(tab === 'ask')}>Tanya data</button>
          <button type="button" aria-pressed={tab === 'report'} onClick={() => setTab('report')} className={tabCls(tab === 'report')}>Draf laporan</button>
        </div>
      </div>
      {tab === 'ask' ? <AskPanel /> : <ReportPanel />}
    </div>
  );
};
