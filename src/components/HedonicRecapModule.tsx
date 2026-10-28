import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Trash2 } from 'lucide-react';
import { Select } from './common/Select';
import { BTN_SECONDARY, FIELD_INPUT, FOCUS_RING } from './common/FormDialog';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import { localDateIso } from '../utils/localDate';
import {
  HEDONIC_PARAMS,
  HEDONIC_SAMPLES,
  HedonicLink,
  HedonicResponse,
  averageScore,
  deleteHedonicResponse,
  fetchHedonicLinks,
  fetchHedonicResponses,
} from '../utils/hedonic';

// Rekap uji hedonik dari QR di surat jalan: nilai per menu, per jenis makanan, per sekolah, serta kritik dan saran.
// Data dibaca langsung dari Supabase (tabel hedonic_links dan hedonic_responses).

type Period = '7' | '30' | 'MONTH' | 'LAST_MONTH';
const PERIOD_LABEL: Record<Period, string> = {
  '7': '7 hari terakhir',
  '30': '30 hari terakhir',
  MONTH: 'Bulan ini',
  LAST_MONTH: 'Bulan lalu',
};

const periodRange = (p: Period): [string, string] => {
  const now = new Date();
  if (p === 'MONTH') return [localDateIso(new Date(now.getFullYear(), now.getMonth(), 1)), localDateIso(now)];
  if (p === 'LAST_MONTH') {
    return [localDateIso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), localDateIso(new Date(now.getFullYear(), now.getMonth(), 0))];
  }
  return [localDateIso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(p) + 1)), localDateIso(now)];
};

const fmtScore = (v: number | null) => (v === null ? '-' : v.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
// Di bawah 3 (sedikit suka) perlu perhatian ahli gizi
const scoreClass = (v: number | null) => (v === null ? 'text-slate-400' : v < 3 ? 'text-rose-700 font-semibold' : v < 3.5 ? 'text-amber-700' : 'text-slate-900');
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
};
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const paramAvg = (rs: HedonicResponse[], key: string) => averageScore(rs, s => Object.values(s).map(v => v?.[key as keyof typeof v]));
const sampleAvg = (rs: HedonicResponse[], code: string) => averageScore(rs, s => Object.values(s[code] || {}));
const overallAvg = (rs: HedonicResponse[]) => (rs.length ? rs.reduce((a, r) => a + r.overall, 0) / rs.length : null);

const TH = 'py-2 px-3 font-semibold text-slate-700 whitespace-nowrap';
const TD = 'py-2 px-3';

export const HedonicRecapModule: React.FC = () => {
  const askConfirm = useConfirm();
  const toast = useToast();
  const [period, setPeriod] = useState<Period>('30');
  const [schoolFilter, setSchoolFilter] = useState('ALL');
  const [responses, setResponses] = useState<HedonicResponse[]>([]);
  const [links, setLinks] = useState<HedonicLink[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [commentQuery, setCommentQuery] = useState('');
  const [lowOnly, setLowOnly] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const [from, to] = periodRange(period);
      const [rs, ls] = await Promise.all([fetchHedonicResponses(from, to), fetchHedonicLinks(from, to)]);
      setResponses(rs);
      setLinks(ls);
      setState('ready');
    } catch (err) {
      console.error('Gagal memuat rekap uji hedonik:', err);
      setState('error');
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const schools = useMemo(
    () => [...new Map(links.map(l => [l.school_id, l.school_name])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'id')),
    [links]
  );
  useEffect(() => {
    if (schoolFilter !== 'ALL' && !schools.some(([id]) => id === schoolFilter)) setSchoolFilter('ALL');
  }, [schools, schoolFilter]);

  const filtered = useMemo(() => (schoolFilter === 'ALL' ? responses : responses.filter(r => r.school_id === schoolFilter)), [responses, schoolFilter]);
  const filteredLinks = useMemo(() => (schoolFilter === 'ALL' ? links : links.filter(l => l.school_id === schoolFilter)), [links, schoolFilter]);

  const ratedLinkCount = useMemo(() => new Set(filtered.map(r => r.token)).size, [filtered]);

  const byMenu = useMemo(() => {
    const map = new Map<string, { date: string; title: string; rs: HedonicResponse[]; linkCount: number }>();
    filteredLinks.forEach(l => {
      const g = map.get(l.menu_order_id) || { date: l.delivery_date, title: l.menu_title, rs: [], linkCount: 0 };
      g.linkCount += 1;
      map.set(l.menu_order_id, g);
    });
    filtered.forEach(r => {
      const g = map.get(r.menu_order_id) || { date: r.delivery_date, title: r.menu_title, rs: [], linkCount: 0 };
      g.rs.push(r);
      map.set(r.menu_order_id, g);
    });
    return [...map.entries()].sort((a, b) => b[1].date.localeCompare(a[1].date));
  }, [filtered, filteredLinks]);

  const bySchool = useMemo(() => {
    const map = new Map<string, { name: string; rs: HedonicResponse[]; menus: number }>();
    filteredLinks.forEach(l => {
      const g = map.get(l.school_id) || { name: l.school_name, rs: [], menus: 0 };
      g.menus += 1;
      map.set(l.school_id, g);
    });
    filtered.forEach(r => {
      const g = map.get(r.school_id) || { name: r.school_name, rs: [], menus: 0 };
      g.rs.push(r);
      map.set(r.school_id, g);
    });
    return [...map.values()].sort((a, b) => (overallAvg(a.rs) ?? 99) - (overallAvg(b.rs) ?? 99));
  }, [filtered, filteredLinks]);

  const comments = useMemo(() => {
    const q = commentQuery.trim().toLowerCase();
    return filtered.filter(
      r =>
        (r.comment || '').trim() &&
        (!lowOnly || r.overall < 3) &&
        (!q || [r.comment, r.school_name, r.menu_title].some(v => (v || '').toLowerCase().includes(q)))
    );
  }, [filtered, commentQuery, lowOnly]);
  const commentTotal = useMemo(() => filtered.filter(r => (r.comment || '').trim()).length, [filtered]);

  const handleDelete = async (r: HedonicResponse) => {
    const ok = await askConfirm({
      title: 'Hapus penilaian ini?',
      message: `Penilaian dari ${r.school_name} (${r.rater_role}) untuk ${r.menu_title} dihapus dari rekap. Pakai untuk isian iseng atau dobel.`,
      confirmText: 'Hapus',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await deleteHedonicResponse(r.id);
      setResponses(prev => prev.filter(x => x.id !== r.id));
      toast.success('Penilaian dihapus dari rekap.', 'Dihapus');
    } catch {
      toast.error('Penilaian gagal dihapus. Coba lagi.', 'Gagal Menghapus');
    }
  };

  const overall = overallAvg(filtered);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900">Rekap uji hedonik</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Dari QR di surat jalan format ringkas. Skala 1 (tidak suka) sampai 5 (sangat suka); di bawah 3 ditandai merah.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={period} onChange={e => setPeriod(e.target.value as Period)} aria-label="Periode">
              {(Object.keys(PERIOD_LABEL) as Period[]).map(p => (
                <option key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </option>
              ))}
            </Select>
            <Select value={schoolFilter} onChange={e => setSchoolFilter(e.target.value)} aria-label="Sekolah" className="max-w-[220px]">
              <option value="ALL">Semua sekolah</option>
              {schools.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
            <button type="button" onClick={load} disabled={state === 'loading'} className={BTN_SECONDARY}>
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${state === 'loading' ? 'animate-spin' : ''}`} />
              Muat ulang
            </button>
          </div>
        </div>

        {state === 'ready' && (
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">{filtered.length.toLocaleString('id-ID')} penilaian</span>
            {' · '}rata-rata <span className={scoreClass(overall)}>{fmtScore(overall)}</span> dari 5
            {' · '}
            {ratedLinkCount} dari {filteredLinks.length} QR sudah diisi sekolah
            {' · '}
            {commentTotal} kritik dan saran
          </p>
        )}
      </div>

      {state === 'error' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
          Rekap gagal dimuat. Periksa internet, atau jalankan migrasi <span className="font-mono">20261028000000_hedonic_qr.sql</span> di
          Supabase bila belum.
        </div>
      )}

      {state === 'loading' && <p className="text-xs text-slate-600 px-1">Memuat rekap…</p>}

      {state === 'ready' && filteredLinks.length === 0 && filtered.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl py-10 px-4 text-center">
          <p className="text-sm font-semibold text-slate-800">Belum ada penilaian di periode ini.</p>
          <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
            QR uji hedonik tercetak di dokumen pengiriman format ringkas (Menu → Sekolah → Cetak dokumen pengiriman, centang Uji hedonik lewat
            QR).
          </p>
        </div>
      )}

      {state === 'ready' && (filteredLinks.length > 0 || filtered.length > 0) && (
        <>
          {/* Per jenis makanan: bagian menu mana yang kurang disukai */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <h2 className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">Per jenis makanan</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={TH}>Jenis</th>
                    {HEDONIC_PARAMS.map(p => (
                      <th key={p.key} className={`${TH} text-right`}>
                        {p.label}
                      </th>
                    ))}
                    <th className={`${TH} text-right`}>Rata-rata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {HEDONIC_SAMPLES.map(s => {
                    const withSample = filtered.filter(r => r.scores?.[s.code]);
                    return (
                      <tr key={s.code}>
                        <td className={TD}>
                          <span className="font-medium text-slate-900">{s.label}</span>
                          <span className="text-slate-500"> ({s.code})</span>
                        </td>
                        {HEDONIC_PARAMS.map(p => {
                          const v = averageScore(withSample, sc => [sc[s.code]?.[p.key]]);
                          return (
                            <td key={p.key} className={`${TD} text-right tabular-nums ${scoreClass(v)}`}>
                              {fmtScore(v)}
                            </td>
                          );
                        })}
                        <td className={`${TD} text-right tabular-nums ${scoreClass(sampleAvg(withSample, s.code))}`}>
                          {fmtScore(sampleAvg(withSample, s.code))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <h2 className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">Per menu</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className={TH}>Tanggal</th>
                    <th className={TH}>Menu</th>
                    <th className={`${TH} text-right`}>Sekolah menilai</th>
                    <th className={`${TH} text-right`}>Penilai</th>
                    {HEDONIC_PARAMS.map(p => (
                      <th key={p.key} className={`${TH} text-right`}>
                        {p.label}
                      </th>
                    ))}
                    <th className={`${TH} text-right`}>Rata-rata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byMenu.map(([id, g]) => {
                    const schoolsRated = new Set(g.rs.map(r => r.school_id)).size;
                    return (
                      <tr key={id}>
                        <td className={`${TD} whitespace-nowrap text-slate-700`}>{fmtDate(g.date)}</td>
                        <td className={`${TD} font-medium text-slate-900`}>{g.title}</td>
                        <td className={`${TD} text-right tabular-nums text-slate-700`}>
                          {schoolsRated}
                          {g.linkCount > 0 && ` dari ${g.linkCount}`}
                        </td>
                        <td className={`${TD} text-right tabular-nums text-slate-700`}>{g.rs.length}</td>
                        {HEDONIC_PARAMS.map(p => {
                          const v = paramAvg(g.rs, p.key);
                          return (
                            <td key={p.key} className={`${TD} text-right tabular-nums ${scoreClass(v)}`}>
                              {fmtScore(v)}
                            </td>
                          );
                        })}
                        <td className={`${TD} text-right tabular-nums ${scoreClass(overallAvg(g.rs))}`}>{fmtScore(overallAvg(g.rs))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {schoolFilter === 'ALL' && (
            <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <h2 className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">
                Per sekolah <span className="font-normal text-slate-600">· nilai terendah di atas</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className={TH}>Sekolah</th>
                      <th className={`${TH} text-right`}>Menu dinilai</th>
                      <th className={`${TH} text-right`}>Penilai</th>
                      <th className={`${TH} text-right`}>Rata-rata</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {bySchool.map(g => {
                      const menusRated = new Set(g.rs.map(r => r.menu_order_id)).size;
                      return (
                        <tr key={g.name}>
                          <td className={`${TD} font-medium text-slate-900`}>{g.name}</td>
                          <td className={`${TD} text-right tabular-nums text-slate-700`}>
                            {menusRated}
                            {g.menus > 0 && ` dari ${g.menus}`}
                          </td>
                          <td className={`${TD} text-right tabular-nums text-slate-700`}>{g.rs.length}</td>
                          <td className={`${TD} text-right tabular-nums ${scoreClass(overallAvg(g.rs))}`}>
                            {g.rs.length ? fmtScore(overallAvg(g.rs)) : 'Belum menilai'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Kritik dan saran <span className="font-normal text-slate-600">· {comments.length} dari {commentTotal}</span>
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 text-xs text-slate-800 cursor-pointer min-h-[44px] sm:min-h-0">
                  <input
                    type="checkbox"
                    checked={lowOnly}
                    onChange={e => setLowOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-700 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                  Hanya nilai di bawah 3
                </label>
                <div className="relative w-full sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
                  <input
                    type="search"
                    value={commentQuery}
                    onChange={e => setCommentQuery(e.target.value)}
                    placeholder="Cari kata, sekolah, menu"
                    aria-label="Cari kritik dan saran"
                    className={`${FIELD_INPUT} pl-8`}
                  />
                </div>
              </div>
            </div>
            {comments.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-slate-600">
                {commentTotal === 0 ? 'Belum ada kritik atau saran.' : 'Tidak ada kritik yang cocok dengan pencarian.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {comments.map(r => (
                  <li key={r.id} className="px-4 py-3 flex items-start gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm text-slate-900 whitespace-pre-line break-words">{r.comment}</p>
                      <p className="text-[11px] text-slate-600">
                        {r.school_name} · {r.rater_role}
                        {r.rater_class ? ` ${r.rater_class}` : ''} · {r.menu_title} ({fmtDate(r.delivery_date)}) · dikirim {fmtTime(r.created_at)}
                      </p>
                    </div>
                    <span className={`shrink-0 text-xs tabular-nums ${scoreClass(r.overall)}`} title="Rata-rata nilai penilai ini">
                      {fmtScore(r.overall)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      aria-label={`Hapus penilaian dari ${r.school_name}`}
                      title="Hapus isian iseng atau dobel"
                      className={`shrink-0 inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[30px] sm:min-h-[30px] rounded-lg text-rose-700 hover:bg-rose-50 cursor-pointer ${FOCUS_RING}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
};
