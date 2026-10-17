import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { DailyFlowRecord } from '../types/warehouse';
import { localDateIso } from '../utils/localDate';
import { CheckCircle2, AlertTriangle, Search, X } from 'lucide-react';

type Scope = 'ALL' | 'FOOD_DAILY_FLOW' | 'FOOD_CARRYING_STOCK';

const SCOPE_TABS: { id: Scope; label: string }[] = [
  { id: 'ALL', label: 'Semua' },
  { id: 'FOOD_DAILY_FLOW', label: 'Bahan segar' },
  { id: 'FOOD_CARRYING_STOCK', label: 'Bahan kering' },
];

const KITCHEN_LOCATION = 'Dapur SPPG Tumpang Jeru';

const INPUT_CLS =
  'w-full px-2.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1';

const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });

// Angka nol ditampilkan sebagai tanda pisah agar baris yang bergerak mudah terlihat.
const Num: React.FC<{ value: number; sign?: boolean; className?: string }> = ({ value, sign, className = '' }) =>
  value === 0 ? (
    <span className="text-slate-500">–</span>
  ) : (
    <span className={className}>
      {sign && value > 0 ? '+' : ''}
      {fmt(value)}
    </span>
  );

const formatLongDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

const parseQty = (q: number | string): number => {
  if (typeof q === 'number') return q;
  const match = String(q).replace(',', '.').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

export const DailyFlowModule: React.FC = () => {
  const { currentUser, can } = useAuth();
  const today = localDateIso();
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [dataVersion, setDataVersion] = useState(0);
  const [scope, setScope] = useState<Scope>('ALL');
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Isian modal: total pemakaian hari ini per barang (string agar kolom bisa kosong).
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [menuFilled, setMenuFilled] = useState(0);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Pemakaian selalu tercatat dengan jam sekarang, jadi pencatatan hanya untuk hari ini.
  const isToday = selectedDate === today;
  const canRecord = can('RECORD_CONSUMPTION') && isToday;

  const rows = useMemo(
    () => warehouseDb.getDailyFlowData(selectedDate, 'ALL_FOOD'),
    [selectedDate, dataVersion]
  );

  // Muat ulang saat data berubah (penerimaan baru, sinkronisasi Supabase).
  useEffect(() => {
    const onSync = () => setDataVersion(v => v + 1);
    window.addEventListener('sppg_storage_items_changed', onSync);
    window.addEventListener('sppg_warehouse_sync', onSync);
    return () => {
      window.removeEventListener('sppg_storage_items_changed', onSync);
      window.removeEventListener('sppg_warehouse_sync', onSync);
    };
  }, []);

  useEffect(() => {
    setFeedback(null);
  }, [selectedDate]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter(r => scope === 'ALL' || r.itemType === scope)
      .filter(r => !q || r.itemName.toLowerCase().includes(q) || r.location.toLowerCase().includes(q))
      .sort((a, b) => {
        // Bahan yang bergerak hari ini di atas, lalu urut nama.
        const movedA = a.receivedToday !== 0 || a.consumedToday !== 0 || a.adjustedToday !== 0;
        const movedB = b.receivedToday !== 0 || b.consumedToday !== 0 || b.adjustedToday !== 0;
        if (movedA !== movedB) return movedA ? -1 : 1;
        return a.itemName.localeCompare(b.itemName, 'id');
      });
  }, [rows, scope, query]);

  const scopeCounts = useMemo(
    () => ({
      ALL: rows.length,
      FOOD_DAILY_FLOW: rows.filter(r => r.itemType === 'FOOD_DAILY_FLOW').length,
      FOOD_CARRYING_STOCK: rows.filter(r => r.itemType === 'FOOD_CARRYING_STOCK').length,
    }),
    [rows]
  );

  const usedCount = rows.filter(r => r.consumedToday > 0).length;
  const hasAdjustments = rows.some(r => r.adjustedToday !== 0);

  // Kebutuhan bahan dari menu hari ini, hanya untuk barang yang satuannya sama dengan satuan stok.
  const menuSuggestions = useMemo(() => {
    const result: Record<string, number> = {};
    if (!isToday) return result;
    const byName = new Map(rows.map(r => [r.itemName.toLowerCase(), r]));
    const byId = new Map(rows.map(r => [r.itemId, r]));
    warehouseDb
      .getMenuOrders()
      .filter(o => o.date === today && o.status !== 'CANCELLED')
      .forEach(o =>
        (o.keyIngredients || []).forEach(ing => {
          const row = (ing.itemId && byId.get(ing.itemId)) || byName.get((ing.itemName || ing.name || '').toLowerCase());
          if (!row || (ing.unit || '').toLowerCase() !== (row.unit || '').toLowerCase()) return;
          const qty = parseQty(ing.quantity);
          if (qty > 0) result[row.itemId] = (result[row.itemId] || 0) + qty;
        })
      );
    return result;
  }, [rows, today, isToday, dataVersion]);

  const openModal = () => {
    const initial: Record<string, string> = {};
    rows.forEach(r => {
      if (r.consumedToday > 0) initial[r.itemId] = String(r.consumedToday);
    });
    setInputs(initial);
    setMenuFilled(0);
    setFeedback(null);
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  useEffect(() => {
    if (!isModalOpen) return;
    firstInputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen]);

  // Hanya bahan yang tampil di modal yang diisi, supaya tidak ada isian tersembunyi.
  const visibleSuggestionIds = visibleRows.map(r => r.itemId).filter(id => menuSuggestions[id] !== undefined);
  const menuSuggestionCount = visibleSuggestionIds.length;

  const fillFromMenu = () => {
    const next = { ...inputs };
    let filled = 0;
    visibleSuggestionIds.forEach(id => {
      if (!next[id]) {
        next[id] = String(menuSuggestions[id]);
        filled++;
      }
    });
    setInputs(next);
    setMenuFilled(filled);
  };

  // Selisih antara isian dan yang sudah tercatat: positif = pemakaian baru, negatif = koreksi.
  const changes = useMemo(() => {
    return rows
      .map(r => {
        const raw = inputs[r.itemId];
        const target = raw === undefined || raw === '' ? r.consumedToday : Number(raw);
        const available = r.closingBalance + r.consumedToday;
        return {
          row: r,
          target,
          delta: Number((target - r.consumedToday).toFixed(2)),
          invalid: Number.isNaN(target) || target < 0,
          overStock: target > available,
          available,
        };
      })
      .filter(c => c.delta !== 0 || c.invalid);
  }, [rows, inputs]);

  const blocking = changes.filter(c => c.invalid || c.overStock);
  const newUsage = changes.filter(c => !c.invalid && c.delta > 0).length;
  const corrections = changes.filter(c => !c.invalid && c.delta < 0).length;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (blocking.length > 0 || changes.length === 0) return;
    const ref = `DAPUR-${today}`;
    let used = 0;
    let corrected = 0;
    try {
      for (const c of changes) {
        if (c.delta > 0) {
          warehouseDb.recordConsumption(c.row.itemId, c.delta, KITCHEN_LOCATION, currentUser, 'Pemakaian dapur harian', ref);
          used++;
        } else {
          warehouseDb.correctConsumption(c.row.itemId, -c.delta, KITCHEN_LOCATION, currentUser, 'Koreksi pemakaian dapur harian', ref);
          corrected++;
        }
      }
      const parts = [used > 0 && `${used} bahan dicatat`, corrected > 0 && `${corrected} bahan dikoreksi`].filter(Boolean);
      setFeedback({ type: 'success', text: `Tersimpan: ${parts.join(', ')}.` });
      setIsModalOpen(false);
    } catch (err: any) {
      const done = used + corrected;
      setFeedback({
        type: 'error',
        text: `${err?.message || 'Gagal menyimpan pemakaian.'}${done > 0 ? ` ${done} bahan sebelumnya sudah tersimpan.` : ''}`,
      });
      setIsModalOpen(false);
    }
    setDataVersion(v => v + 1);
  };

  const modalRows = isModalOpen ? visibleRows : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pemakaian Dapur</h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Catat bahan yang dipakai masak. Saldo akhir = saldo awal + masuk − dipakai ± penyesuaian opname.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-2">
          <div>
            <label htmlFor="flow-date" className="block text-[11px] font-medium text-slate-700 mb-1">
              Tanggal
            </label>
            <input
              id="flow-date"
              type="date"
              value={selectedDate}
              max={today}
              onChange={e => setSelectedDate(e.target.value || today)}
              className={`${INPUT_CLS} sm:w-40`}
            />
          </div>
          {can('RECORD_CONSUMPTION') && (
            <button
              type="button"
              onClick={openModal}
              disabled={!isToday || rows.length === 0}
              className={`inline-flex items-center justify-center px-4 min-h-[44px] sm:min-h-[34px] rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer ${FOCUS}`}
            >
              Catat pemakaian hari ini
            </button>
          )}
        </div>
      </div>

      {!isToday && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Menampilkan {formatLongDate(selectedDate)}. Pemakaian hanya bisa dicatat untuk hari ini.
        </p>
      )}

      {feedback && (
        <div
          role="status"
          className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-px" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          )}
          <span className="flex-1">{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            aria-label="Tutup pesan"
            className={`-m-1 p-1 rounded cursor-pointer ${FOCUS}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div role="tablist" aria-label="Jenis bahan" className="inline-flex p-1 rounded-lg bg-slate-200/70 text-xs self-start">
          {SCOPE_TABS.map(t => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={scope === t.id}
              onClick={() => setScope(t.id)}
              className={`px-3 min-h-[44px] sm:min-h-[30px] rounded-md whitespace-nowrap cursor-pointer ${FOCUS} ${
                scope === t.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-700 hover:text-slate-900 font-medium'
              }`}
            >
              {t.label} <span className="text-slate-500 font-normal">{scopeCounts[t.id]}</span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            aria-label="Cari bahan"
            placeholder="Cari bahan atau lokasi"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className={`${INPUT_CLS} pl-8`}
          />
        </div>
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-200 text-xs text-slate-700">
          {formatLongDate(selectedDate)} · <span className="font-semibold text-slate-900">{usedCount}</span> bahan dipakai
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Bahan</th>
                <th className="py-2.5 px-3 font-semibold text-right">Saldo awal</th>
                <th className="py-2.5 px-3 font-semibold text-right">Masuk</th>
                <th className="py-2.5 px-3 font-semibold text-right">Dipakai</th>
                {hasAdjustments && <th className="py-2.5 px-3 font-semibold text-right">Penyesuaian</th>}
                <th className="py-2.5 px-4 font-semibold text-right">Saldo akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-600">
                    Belum ada bahan makanan terdaftar. Tambahkan barang di menu Stok.
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-600">
                    Tidak ada bahan yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                visibleRows.map(r => {
                  const needsCheck = r.openingBalance < 0 || r.closingBalance < 0;
                  return (
                    <tr key={r.itemId} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{r.itemName}</div>
                        <div className="text-[11px] text-slate-600">
                          {r.location}
                          {needsCheck && (
                            <span className="ml-1.5 inline-flex items-center gap-1 text-amber-800 font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              Saldo minus, cek pencatatan
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                        <Num value={r.openingBalance} />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <Num value={r.receivedToday} sign className="text-slate-900" />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        <Num value={r.consumedToday} className="font-semibold text-emerald-800" />
                      </td>
                      {hasAdjustments && (
                        <td className="py-2.5 px-3 text-right font-mono">
                          <Num value={r.adjustedToday} sign className="text-slate-900" />
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        {fmt(r.closingBalance)} <span className="font-sans font-normal text-slate-600">{r.unit}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal pencatatan */}
      {isModalOpen && canRecord && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="flow-modal-title"
            className="bg-white w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-xl sm:rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h2 id="flow-modal-title" className="text-sm font-semibold text-slate-900">
                  Catat pemakaian hari ini
                </h2>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Isi total yang dipakai hari ini per bahan. Mengubah angka yang sudah tercatat akan menambah atau mengoreksi pemakaian.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Tutup"
                className={`p-2 -m-1 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCUS}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0">
              <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                {menuSuggestionCount > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={fillFromMenu}
                      className={`px-3 min-h-[44px] sm:min-h-[30px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-medium text-slate-800 cursor-pointer ${FOCUS}`}
                    >
                      Isi dari menu hari ini ({menuSuggestionCount})
                    </button>
                    <span className="text-slate-600">
                      {menuFilled > 0
                        ? `${menuFilled} isian diambil dari rencana menu. Sesuaikan dengan yang benar-benar dipakai.`
                        : 'Hanya mengisi kolom yang masih kosong.'}
                    </span>
                  </>
                ) : (
                  <span className="text-slate-600">Belum ada kebutuhan bahan dari menu hari ini. Isi manual.</span>
                )}
                <span className="text-slate-500 sm:ml-auto">Tampil: {SCOPE_TABS.find(t => t.id === scope)?.label.toLowerCase()}</span>
              </div>

              <div className="overflow-y-auto flex-1">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 sticky top-0">
                    <tr>
                      <th className="py-2 px-4 sm:px-5 font-semibold">Bahan</th>
                      <th className="py-2 px-2 font-semibold text-right">Tersedia</th>
                      <th className="py-2 px-4 sm:px-5 font-semibold w-36">Total dipakai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modalRows.map((r, idx) => {
                      const change = changes.find(c => c.row.itemId === r.itemId);
                      const available = r.closingBalance + r.consumedToday;
                      return (
                        <tr key={r.itemId}>
                          <td className="py-2 px-4 sm:px-5">
                            <label htmlFor={`use-${r.itemId}`} className="font-semibold text-slate-900">
                              {r.itemName}
                            </label>
                            {r.consumedToday > 0 && (
                              <div className="text-[11px] text-slate-600">
                                Sudah tercatat {fmt(r.consumedToday)} {r.unit}
                              </div>
                            )}
                            {change?.overStock && (
                              <div className="text-[11px] text-rose-700 font-medium">
                                Melebihi stok tersedia. Cek penerimaan barang dulu.
                              </div>
                            )}
                            {change && !change.overStock && !change.invalid && change.delta < 0 && (
                              <div className="text-[11px] text-amber-800 font-medium">
                                Koreksi: {fmt(-change.delta)} {r.unit} kembali ke stok
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-slate-700 whitespace-nowrap">
                            {fmt(available)} <span className="font-sans text-slate-600">{r.unit}</span>
                          </td>
                          <td className="py-2 px-4 sm:px-5">
                            <input
                              ref={idx === 0 ? firstInputRef : undefined}
                              id={`use-${r.itemId}`}
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="any"
                              value={inputs[r.itemId] ?? ''}
                              placeholder="0"
                              aria-invalid={change?.overStock || change?.invalid || undefined}
                              onChange={e => setInputs(prev => ({ ...prev, [r.itemId]: e.target.value }))}
                              className={`${INPUT_CLS} text-right font-mono ${
                                change?.overStock || change?.invalid ? 'border-rose-400 bg-rose-50' : ''
                              }`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {modalRows.length === 0 && (
                      <tr>
                        <td colSpan={3} className="py-8 text-center text-slate-600">
                          Tidak ada bahan pada filter ini. Tutup lalu ubah filter atau pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-slate-700">
                  {blocking.length > 0
                    ? `${blocking.length} isian perlu diperbaiki.`
                    : changes.length === 0
                    ? 'Belum ada perubahan.'
                    : [newUsage > 0 && `${newUsage} pemakaian`, corrections > 0 && `${corrections} koreksi`].filter(Boolean).join(', ') +
                      ' akan disimpan.'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className={`flex-1 sm:flex-none px-4 min-h-[44px] sm:min-h-[34px] rounded-lg font-medium text-slate-700 hover:bg-slate-200/70 cursor-pointer ${FOCUS}`}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={blocking.length > 0 || changes.length === 0}
                    className={`flex-1 sm:flex-none px-4 min-h-[44px] sm:min-h-[34px] rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold cursor-pointer ${FOCUS}`}
                  >
                    Simpan pemakaian
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
