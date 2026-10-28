import React, { useEffect, useState } from 'react';
import logoSppgImg from '../assets/logo sppg.png';
import { localDateIso } from '../utils/localDate';
import {
  HEDONIC_DAYS_OPEN,
  HEDONIC_PARAMS,
  HEDONIC_ROLES,
  HEDONIC_SAMPLES,
  HEDONIC_SCALE,
  HedonicLink,
  HedonicParam,
  HedonicScores,
  fetchHedonicLink,
  hedonicTokenFromPath,
  submitHedonicResponse,
} from '../utils/hedonic';

// Halaman uji hedonik (/nilai/<kode>): dibuka dari QR di surat jalan, tanpa login.
// Satu HP bisa dipakai bergantian: setelah terkirim, "Nilai lagi" mengosongkan isian untuk penilai berikutnya.

const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';

const formatLongDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return localDateIso(new Date(y, m - 1, d + days));
};

type Status = 'loading' | 'missing' | 'closed' | 'ready' | 'sent' | 'error';

// Lima tombol nilai 1–5; yang terpilih berwarna, label skala tampil di bawah baris
const ScoreRow: React.FC<{ label: string; value?: number; onChange: (v: number) => void; name: string }> = ({ label, value, onChange, name }) => (
  <div role="radiogroup" aria-label={label} className="space-y-1">
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <span className="text-xs text-slate-600">{value ? HEDONIC_SCALE[value - 1] : 'Belum dinilai'}</span>
    </div>
    <div className="grid grid-cols-5 gap-1.5">
      {[1, 2, 3, 4, 5].map(v => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          aria-label={`${label} ${v}, ${HEDONIC_SCALE[v - 1]}`}
          name={name}
          onClick={() => onChange(v)}
          className={`min-h-[44px] rounded-lg border text-base font-semibold cursor-pointer ${FOCUS} ${
            value === v
              ? v <= 2
                ? 'bg-rose-600 border-rose-600 text-white'
                : v === 3
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'bg-emerald-700 border-emerald-700 text-white'
              : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  </div>
);

const HedonicFormPage: React.FC = () => {
  const token = hedonicTokenFromPath(window.location.pathname);
  const [status, setStatus] = useState<Status>('loading');
  const [link, setLink] = useState<HedonicLink | null>(null);
  const [role, setRole] = useState('');
  const [raterClass, setRaterClass] = useState('');
  const [scores, setScores] = useState<HedonicScores>({});
  // Makanan yang tidak ada di menu hari ini (mis. tanpa buah) tidak dinilai
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    document.title = 'Penilaian Menu MBG · SPPG Tumpang Jeru';
    if (!token) {
      setStatus('missing');
      return;
    }
    fetchHedonicLink(token)
      .then(found => {
        if (!found) return setStatus('missing');
        setLink(found);
        const today = localDateIso();
        setStatus(today < found.delivery_date || today > addDays(found.delivery_date, HEDONIC_DAYS_OPEN) ? 'closed' : 'ready');
      })
      .catch(() => setStatus('error'));
  }, [token]);

  const setScore = (code: string, param: HedonicParam, value: number) =>
    setScores(prev => ({ ...prev, [code]: { ...prev[code], [param]: value } }));
  const setAll = (code: string, value: number) =>
    setScores(prev => ({ ...prev, [code]: { rasa: value, warna: value, aroma: value, tekstur: value } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || isSending) return;
    setError('');
    if (!role) return setError('Pilih siapa yang menilai.');
    const included = Object.fromEntries(Object.entries(scores).filter(([code, s]) => !skipped[code] && Object.keys(s).length > 0));
    if (Object.keys(included).length === 0) return setError('Beri nilai minimal satu makanan.');

    setIsSending(true);
    try {
      await submitHedonicResponse({ token, raterRole: role, raterClass, scores: included, comment });
      setSentCount(c => c + 1);
      setStatus('sent');
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setError(err?.message || 'Penilaian gagal dikirim.');
    } finally {
      setIsSending(false);
    }
  };

  const handleRateAgain = () => {
    // Peran dan kelas biasanya sama untuk penilai berikutnya, jadi dibiarkan
    setScores({});
    setSkipped({});
    setComment('');
    setError('');
    setStatus('ready');
    window.scrollTo({ top: 0 });
  };

  const unrated = HEDONIC_SAMPLES.filter(s => !skipped[s.code] && HEDONIC_PARAMS.some(p => !scores[s.code]?.[p.key])).length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans">
      <header className="bg-emerald-800 text-white">
        <div className="max-w-xl mx-auto px-4 py-5 space-y-2">
          <div className="flex items-center gap-2.5 text-sm font-medium opacity-90">
            <img src={logoSppgImg} alt="" className="w-8 h-8 rounded-full bg-white p-0.5 object-contain" />
            <span>SPPG Tumpang Jeru · Penilaian menu</span>
          </div>
          {link ? (
            <>
              <h1 className="text-xl font-bold leading-tight">{link.menu_title}</h1>
              <p className="text-sm opacity-90">
                {link.school_name} · {formatLongDate(link.delivery_date)}
              </p>
            </>
          ) : (
            <h1 className="text-xl font-bold leading-tight">Penilaian menu Makan Bergizi Gratis</h1>
          )}
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-4">
        {status === 'loading' && <p className="text-sm text-slate-600">Memuat…</p>}

        {status === 'missing' && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            QR ini tidak dikenal. Pindai ulang QR di surat jalan, atau minta QR baru ke petugas SPPG.
          </div>
        )}

        {status === 'error' && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            Halaman gagal dimuat. Periksa sinyal internet lalu muat ulang halaman.
          </div>
        )}

        {status === 'closed' && link && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            Penilaian untuk menu ini dibuka dari {formatLongDate(link.delivery_date)} sampai{' '}
            {formatLongDate(addDays(link.delivery_date, HEDONIC_DAYS_OPEN))}. Gunakan QR di surat jalan hari ini.
          </div>
        )}

        {status === 'sent' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
            <p className="text-base font-semibold text-emerald-900">Terima kasih, penilaian terkirim.</p>
            <p className="text-sm text-emerald-900">
              {sentCount} penilaian dikirim dari HP ini. Masukan Anda dibaca ahli gizi untuk memperbaiki menu berikutnya.
            </p>
            <button
              type="button"
              onClick={handleRateAgain}
              className={`w-full min-h-[48px] rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer ${FOCUS}`}
            >
              Nilai lagi untuk penilai berikutnya
            </button>
          </div>
        )}

        {status === 'ready' && link && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <h2 className="text-base font-bold">Siapa yang menilai?</h2>
              <div role="radiogroup" aria-label="Penilai" className="flex flex-wrap gap-2">
                {HEDONIC_ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={role === r}
                    onClick={() => setRole(r)}
                    className={`px-3.5 min-h-[44px] rounded-lg border text-sm font-medium cursor-pointer ${FOCUS} ${
                      role === r ? 'bg-emerald-800 border-emerald-800 text-white' : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor="hedonic-class" className="block text-sm font-medium text-slate-700 mb-1">
                  Kelas <span className="font-normal text-slate-500">(tidak wajib)</span>
                </label>
                <input
                  id="hedonic-class"
                  type="text"
                  value={raterClass}
                  onChange={e => setRaterClass(e.target.value)}
                  maxLength={60}
                  placeholder="Mis. Kelas 4"
                  className={`w-full px-3 min-h-[44px] rounded-lg border border-slate-300 bg-white text-sm ${FOCUS}`}
                />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <h2 className="text-base font-bold">Cara menilai</h2>
              <ol className="grid grid-cols-5 gap-1.5 text-center text-xs text-slate-700">
                {HEDONIC_SCALE.map((label, i) => (
                  <li key={label}>
                    <span className="block text-base font-bold text-slate-900">{i + 1}</span>
                    {label}
                  </li>
                ))}
              </ol>
              <p className="text-xs text-slate-600">Ketuk "Semua aspek" untuk memberi nilai yang sama ke rasa, warna, aroma, dan tekstur sekaligus.</p>
            </section>

            {HEDONIC_SAMPLES.map(sample => {
              const isSkipped = !!skipped[sample.code];
              return (
                <section key={sample.code} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-bold">
                      {sample.label} <span className="text-sm font-normal text-slate-500">({sample.code})</span>
                    </h2>
                    <label className="inline-flex items-center gap-2 min-h-[44px] text-sm text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSkipped}
                        onChange={e => setSkipped(prev => ({ ...prev, [sample.code]: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-700 cursor-pointer"
                      />
                      Tidak ada hari ini
                    </label>
                  </div>
                  {!isSkipped && (
                    <>
                      <ScoreRow
                        label="Semua aspek"
                        name={`${sample.code}-all`}
                        value={(() => {
                          const vals = HEDONIC_PARAMS.map(p => scores[sample.code]?.[p.key]);
                          return vals.every(v => v && v === vals[0]) ? vals[0] : undefined;
                        })()}
                        onChange={v => setAll(sample.code, v)}
                      />
                      <div className="border-t border-slate-100 pt-3 space-y-3">
                        {HEDONIC_PARAMS.map(p => (
                          <ScoreRow
                            key={p.key}
                            label={p.label}
                            name={`${sample.code}-${p.key}`}
                            value={scores[sample.code]?.[p.key]}
                            onChange={v => setScore(sample.code, p.key, v)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </section>
              );
            })}

            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
              <label htmlFor="hedonic-comment" className="block text-base font-bold">
                Kritik dan saran
              </label>
              <textarea
                id="hedonic-comment"
                value={comment}
                onChange={e => setComment(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Mis. sayurnya terlalu asin, porsi nasi kurang, buahnya enak"
                className={`w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm ${FOCUS}`}
              />
            </section>

            {error && (
              <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
                {error}
              </p>
            )}
            {unrated > 0 && !error && (
              <p className="text-xs text-slate-600">{unrated} makanan belum dinilai lengkap. Penilaian tetap bisa dikirim.</p>
            )}

            <button
              type="submit"
              disabled={isSending}
              className={`w-full min-h-[48px] rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white text-sm font-semibold cursor-pointer ${FOCUS}`}
            >
              {isSending ? 'Mengirim…' : 'Kirim penilaian'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
};

export default HedonicFormPage;
