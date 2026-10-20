import React, { useState, useMemo, useEffect } from 'react';
import { useConfirm } from '../context/ConfirmContext';
import { KopText } from './common/KopText';
import { useAuth } from '../context/AuthContext';
import { warehouseDb, signerName } from '../db/storage';
import { STANDARD_CATEGORIES, StandardCategory, normalizeToStandardCategory } from '../utils/categoryStandards';
import { Printer, Search, CheckCircle2, FileSpreadsheet, Trash2, Plus, X } from 'lucide-react';
import { exportMultiSheetExcel } from '../lib/excelExport';
import { SppgLogo } from './SppgLogo';
import { localDateIso } from '../utils/localDate';

type PeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

// BELANJA: uang keluar dengan harga tercatat.
// PENGAMBILAN: catatan pengeluaran tanpa harga (biasanya barang diambil relawan dari gudang).
// DAPUR: stok gudang yang dikeluarkan (bahan dapur maupun operasional), dicatat di Buku Mutasi.
type ExpenseKind = 'BELANJA' | 'PENGAMBILAN' | 'DAPUR';

const KIND_LABEL: Record<ExpenseKind, string> = {
  BELANJA: 'Belanja',
  PENGAMBILAN: 'Pengambilan',
  DAPUR: 'Barang keluar',
};

const KIND_BADGE: Record<ExpenseKind, string> = {
  BELANJA: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PENGAMBILAN: 'bg-slate-100 text-slate-700 border-slate-200',
  DAPUR: 'bg-sky-50 text-sky-800 border-sky-200',
};

// Sama dengan kategori Master Barang, agar rekap pengeluaran bisa dicocokkan dengan stok.
const CATEGORIES: StandardCategory[] = [...STANDARD_CATEGORIES];
const emptyByCategory = <T,>(make: () => T) =>
  Object.fromEntries(CATEGORIES.map(c => [c, make()])) as Record<StandardCategory, T>;

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function parseNumericQty(qty: string | number): number {
  if (typeof qty === 'number') return qty;
  const match = String(qty).replace(',', '.').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

// Tanggal lama tersimpan dalam beberapa format ("2026-09-20", "20 sept 2026").
function parseExpenseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.toLowerCase().trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const [y, m, d] = clean.slice(0, 10).split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
  }

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5, jul: 6,
    agu: 7, ags: 7, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
  };
  const match = clean.match(/(\d{1,2})\s+([a-z]{3,})\s+(\d{4})/i);
  if (match) {
    const month = monthMap[match[2].slice(0, 3)];
    if (month === undefined) return null;
    const date = new Date(Number(match[3]), month, Number(match[1]));
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

const formatRp = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const formatDateLong = (d: Date) =>
  d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

const formatDateShort = (d: Date) =>
  d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const shiftDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return localDateIso(new Date(y, m - 1, d + days));
};

interface UnifiedExpense {
  id: string;
  kind: ExpenseKind;
  rawDate: string;
  parsedDate: Date | null;
  time: string;
  itemName: string;
  category: StandardCategory;
  quantityLabel: string;
  numericQty: number;
  unit: string;
  unitPrice: number | null;
  nominal: number | null;
  takenBy: string;
  recordedBy: string;
  notes?: string;
  referenceNo?: string;
}

interface ItemAgg {
  key: string;
  itemName: string;
  unit: string;
  totalQty: number;
  totalNominal: number;
  pricedCount: number;
  count: number;
}

export interface DailyExpensesModuleProps {
  onNavigate?: (tab: string) => void;
}

export const DailyExpensesModule: React.FC<DailyExpensesModuleProps> = ({ onNavigate }) => {
  const { currentUser, can } = useAuth();
  const askConfirm = useConfirm();
  const today = localDateIso();

  const [periodType, setPeriodType] = useState<PeriodType>('WEEKLY');
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(today);
  const [startDate, setStartDate] = useState<string>(shiftDays(today, -6));
  const [endDate, setEndDate] = useState<string>(today);
  const [selectedMonth, setSelectedMonth] = useState<string>(today.slice(0, 7));

  const [categoryFilter, setCategoryFilter] = useState<'ALL' | StandardCategory>('ALL');
  const [kindFilter, setKindFilter] = useState<'ALL' | ExpenseKind>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'SUMMARY' | 'TRANSACTIONS'>('SUMMARY');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState('');
  const [dataVersion, setDataVersion] = useState(0);

  // App tidak me-remount halaman ini saat data berubah, jadi halaman memuat ulang datanya sendiri.
  useEffect(() => {
    const onChange = () => setDataVersion(v => v + 1);
    window.addEventListener('sppg_storage_items_changed', onChange);
    return () => window.removeEventListener('sppg_storage_items_changed', onChange);
  }, []);

  useEffect(() => {
    if (!isPrintPreviewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPrintPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPrintPreviewOpen]);

  const transactions = useMemo(() => warehouseDb.getTransactions(), [dataVersion]);
  const manualExpenses = useMemo(() => warehouseDb.getNonFoodExpenses(), [dataVersion]);

  const allExpenses = useMemo<UnifiedExpense[]>(() => {
    const list: UnifiedExpense[] = [];

    manualExpenses.forEach(exp => {
      const qty = parseNumericQty(exp.quantity);
      const total =
        exp.totalCost && exp.totalCost > 0
          ? exp.totalCost
          : exp.unitPrice && exp.unitPrice > 0 && qty > 0
          ? exp.unitPrice * qty
          : 0;
      const hasPrice = total > 0;
      const unit = exp.unit || '';
      const rawQty = typeof exp.quantity === 'number' ? String(exp.quantity) : String(exp.quantity || '');
      // Data lama menyimpan "1 pack" di kolom jumlah; jangan tampilkan satuannya dua kali.
      const quantityLabel = /[a-z]/i.test(rawQty) ? rawQty : `${rawQty} ${unit}`.trim();

      list.push({
        id: exp.id,
        kind: hasPrice ? 'BELANJA' : 'PENGAMBILAN',
        rawDate: exp.date,
        parsedDate: parseExpenseDate(exp.date),
        time: exp.time || '',
        itemName: exp.itemName,
        category: normalizeToStandardCategory(exp.category, exp.itemName),
        quantityLabel,
        numericQty: qty,
        unit,
        unitPrice: hasPrice ? (exp.unitPrice && exp.unitPrice > 0 ? exp.unitPrice : qty > 0 ? Math.round(total / qty) : null) : null,
        nominal: hasPrice ? total : null,
        takenBy: exp.volunteer || exp.recipientName || exp.recipient || '',
        recordedBy: exp.pic || exp.recordedBy || '',
        notes: exp.notes,
      });
    });

    transactions
      .filter(tx => tx.transactionType === 'ISSUE_CONSUMPTION')
      .forEach(tx => {
        const rawDate = tx.timestamp.slice(0, 10);
        // Pemakaian bernilai negatif; koreksi (bahan kembali ke stok) positif dan mengurangi total.
        const qty = -tx.quantity;
        list.push({
          id: tx.id,
          kind: 'DAPUR',
          rawDate,
          parsedDate: parseExpenseDate(rawDate),
          // Catatan dari form kertas tidak punya jam asli (disimpan pukul 12.00), jadi tidak ditampilkan.
          time: tx.referenceDocument?.startsWith('FORM-') ? '' : tx.timestamp.slice(11, 16).replace(':', '.'),
          itemName: tx.itemName,
          category: normalizeToStandardCategory(tx.category, tx.itemName),
          quantityLabel: qty < 0
            ? `Koreksi ${Math.abs(qty).toLocaleString('id-ID')} ${tx.unit}`
            : `${qty.toLocaleString('id-ID')} ${tx.unit}`,
          numericQty: qty,
          unit: tx.unit,
          unitPrice: null,
          nominal: null,
          takenBy: tx.location || '',
          recordedBy: tx.userName,
          notes: tx.notes,
          referenceNo: tx.referenceDocument || tx.id,
        });
      });

    return list.sort((a, b) => (b.parsedDate?.getTime() ?? 0) - (a.parsedDate?.getTime() ?? 0));
  }, [manualExpenses, transactions]);

  const range = useMemo(() => {
    const toDate = (iso: string) => parseExpenseDate(iso);
    if (periodType === 'DAILY') {
      const d = toDate(selectedDailyDate);
      return { start: d, end: d, label: d ? formatDateLong(d) : '-' };
    }
    if (periodType === 'MONTHLY') {
      const [y, m] = selectedMonth.split('-').map(Number);
      return {
        start: new Date(y, m - 1, 1),
        end: new Date(y, m, 0),
        label: `${MONTH_NAMES[m - 1] || ''} ${y}`,
      };
    }
    const s = toDate(startDate);
    const e = toDate(endDate);
    return {
      start: s,
      end: e,
      label: s && e ? `${formatDateShort(s)} s/d ${formatDateShort(e)}` : '-',
    };
  }, [periodType, selectedDailyDate, startDate, endDate, selectedMonth]);

  const rangeInvalid = !range.start || !range.end || range.start.getTime() > range.end.getTime();

  // Catatan pada periode aktif, sebelum filter kategori/jenis/pencarian.
  const periodExpenses = useMemo(() => {
    if (rangeInvalid || !range.start || !range.end) return [];
    const startT = range.start.getTime();
    const endT = range.end.getTime();
    return allExpenses.filter(item => {
      if (!item.parsedDate) return false;
      const t = item.parsedDate.getTime();
      return t >= startT && t <= endT;
    });
  }, [allExpenses, range, rangeInvalid]);

  const unreadableDateCount = useMemo(() => allExpenses.filter(e => !e.parsedDate).length, [allExpenses]);

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return periodExpenses.filter(item => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (kindFilter !== 'ALL' && item.kind !== kindFilter) return false;
      if (q) {
        const hay = `${item.itemName} ${item.takenBy} ${item.recordedBy} ${item.notes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [periodExpenses, categoryFilter, kindFilter, searchQuery]);

  const totals = useMemo(() => {
    const byCategory = emptyByCategory(() => 0);
    let belanja = 0;
    let belanjaCount = 0;
    let pengambilanCount = 0;
    let dapurCount = 0;
    filteredExpenses.forEach(e => {
      if (e.kind === 'BELANJA' && e.nominal) {
        belanja += e.nominal;
        belanjaCount += 1;
        if (byCategory[e.category] !== undefined) byCategory[e.category] += e.nominal;
      } else if (e.kind === 'PENGAMBILAN') {
        pengambilanCount += 1;
      } else {
        dapurCount += 1;
      }
    });
    return { belanja, belanjaCount, pengambilanCount, dapurCount, byCategory };
  }, [filteredExpenses]);

  // Rekap uang keluar per tanggal untuk laporan mingguan/bulanan.
  const dailyTotals = useMemo(() => {
    const map = new Map<string, { date: Date; count: number; total: number }>();
    filteredExpenses.forEach(e => {
      if (e.kind !== 'BELANJA' || !e.nominal || !e.parsedDate) return;
      const d = e.parsedDate;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const row = map.get(key) || { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), count: 0, total: 0 };
      row.count += 1;
      row.total += e.nominal;
      map.set(key, row);
    });
    return [...map.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredExpenses]);

  const categoryItems = useMemo(() => {
    const result = emptyByCategory<ItemAgg[]>(() => []);
    const maps: Record<string, Map<string, ItemAgg>> = {};
    CATEGORIES.forEach(c => (maps[c] = new Map()));

    filteredExpenses.forEach(e => {
      const map = maps[e.category];
      if (!map) return;
      // Satuan ikut jadi kunci supaya 2 Kg dan 3 Pack tidak dijumlahkan.
      const key = `${e.itemName.trim().toLowerCase()}|${e.unit.toLowerCase()}`;
      const agg = map.get(key) || {
        key,
        itemName: e.itemName.trim(),
        unit: e.unit,
        totalQty: 0,
        totalNominal: 0,
        pricedCount: 0,
        count: 0,
      };
      agg.totalQty += e.numericQty;
      agg.count += 1;
      if (e.nominal) {
        agg.totalNominal += e.nominal;
        agg.pricedCount += 1;
      }
      map.set(key, agg);
    });

    CATEGORIES.forEach(c => {
      result[c] = Array.from(maps[c].values()).sort(
        (a, b) => b.totalNominal - a.totalNominal || a.itemName.localeCompare(b.itemName)
      );
    });
    return result;
  }, [filteredExpenses]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0, ...emptyByCategory(() => 0) };
    periodExpenses.forEach(e => {
      if (kindFilter !== 'ALL' && e.kind !== kindFilter) return;
      counts.ALL += 1;
      counts[e.category] = (counts[e.category] || 0) + 1;
    });
    return counts;
  }, [periodExpenses, kindFilter]);

  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0, BELANJA: 0, PENGAMBILAN: 0, DAPUR: 0 };
    periodExpenses.forEach(e => {
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return;
      counts.ALL += 1;
      counts[e.kind] += 1;
    });
    return counts;
  }, [periodExpenses, categoryFilter]);

  const visibleCategories = categoryFilter === 'ALL' ? CATEGORIES : [categoryFilter];

  const handleDeleteManual = async (id: string, name: string) => {
    if (!(await askConfirm({
      title: `Hapus catatan "${name}"?`,
      message: 'Catatan yang dihapus tidak bisa dikembalikan.',
      confirmText: 'Hapus catatan',
      variant: 'danger',
    }))) return;
    warehouseDb.deleteNonFoodExpense(id, currentUser);
    setSuccessNotice(`Catatan "${name}" dihapus.`);
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      alert('Tidak ada catatan pada periode dan filter ini.');
      return;
    }
    const detailRows = filteredExpenses.map((item, idx) => ({
      'No': idx + 1,
      'Tanggal': item.parsedDate ? localDateIso(item.parsedDate) : item.rawDate,
      'Jam': item.time || '-',
      'Jenis': KIND_LABEL[item.kind],
      'Kategori': item.category,
      'Nama Barang': item.itemName,
      'Jumlah': item.numericQty,
      'Satuan': item.unit,
      'Harga Satuan (Rp)': item.unitPrice ?? '',
      'Total (Rp)': item.nominal ?? '',
      'Diambil oleh / Tujuan': item.takenBy || '-',
      'Dicatat oleh': item.recordedBy || '-',
      'Keterangan': item.notes || '-',
    }));
    const summaryRows: Record<string, any>[] = [];
    visibleCategories.forEach(cat => {
      categoryItems[cat].forEach(item => {
        summaryRows.push({
          'Kategori': cat,
          'Nama Barang': item.itemName,
          'Jumlah': item.totalQty,
          'Satuan': item.unit,
          'Berapa kali': item.count,
          'Total Belanja (Rp)': item.totalNominal || '',
        });
      });
    });
    exportMultiSheetExcel(
      [
        { sheetName: 'Rekap per Barang', data: summaryRows },
        { sheetName: 'Rincian Catatan', data: detailRows },
      ],
      `Pengeluaran_SPPG_Tumpang_Jeru_${range.start ? localDateIso(range.start) : ''}_${range.end ? localDateIso(range.end) : ''}.xlsx`
    );
  };

  const periodButton = (type: PeriodType, label: string) => (
    <button
      key={type}
      type="button"
      role="tab"
      aria-selected={periodType === type}
      onClick={() => setPeriodType(type)}
      className={`px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
        periodType === type ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
      }`}
    >
      {label}
    </button>
  );

  const chipClass = (selected: boolean) =>
    `px-2.5 py-1.5 rounded-lg text-xs cursor-pointer inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
      selected
        ? 'bg-slate-900 text-white font-semibold'
        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 font-medium'
    }`;

  const dateInputClass =
    'px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 min-h-[44px] sm:min-h-[34px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';

  const renderPrintDocument = () => (
    <div className="bg-white font-sans text-slate-900 text-xs">
      <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <SppgLogo size="lg" variant="color" showText={false} />
          <KopText />
        </div>
        <div className="text-right text-[11px] text-slate-600 space-y-0.5 shrink-0">
          <div>Dicetak: {formatDateLong(new Date())}</div>
          <div>Oleh: {currentUser.name}</div>
        </div>
      </div>

      <div className="text-center mb-5">
        <h2 className="text-sm font-bold text-slate-900">Laporan Pengeluaran Gudang</h2>
        <p className="text-xs text-slate-600 mt-0.5">Program Makan Bergizi Gratis</p>
        <p className="text-xs font-semibold text-slate-800 mt-1">
          Periode {range.label}
          {categoryFilter !== 'ALL' && ` · ${categoryFilter}`}
          {kindFilter !== 'ALL' && ` · ${KIND_LABEL[kindFilter]}`}
        </p>
      </div>

      <div className="mb-5">
        <div className="font-bold text-xs text-slate-800 mb-2 border-b border-slate-300 pb-1">
          A. Ringkasan per Kategori
        </div>
        <table className="w-full text-left text-xs border border-slate-300 border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-semibold">
              <th className="py-1.5 px-2 border border-slate-300 w-8 text-center">No</th>
              <th className="py-1.5 px-2 border border-slate-300">Kategori</th>
              <th className="py-1.5 px-2 border border-slate-300 text-center">Jenis barang</th>
              <th className="py-1.5 px-2 border border-slate-300 text-center">Catatan</th>
              <th className="py-1.5 px-2 border border-slate-300 text-right">Total belanja</th>
            </tr>
          </thead>
          <tbody>
            {visibleCategories.map((cat, idx) => (
              <tr key={cat}>
                <td className="py-1.5 px-2 border border-slate-300 text-center">{idx + 1}</td>
                <td className="py-1.5 px-2 border border-slate-300 font-semibold">{cat}</td>
                <td className="py-1.5 px-2 border border-slate-300 text-center">{categoryItems[cat].length}</td>
                <td className="py-1.5 px-2 border border-slate-300 text-center">
                  {categoryItems[cat].reduce((s, it) => s + it.count, 0)}
                </td>
                <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">
                  {totals.byCategory[cat] > 0 ? formatRp(totals.byCategory[cat]) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold">
              <td colSpan={4} className="py-1.5 px-2 border border-slate-300 text-right">Total belanja tercatat</td>
              <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">{formatRp(totals.belanja)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="text-[10px] text-slate-600 mt-1">
          Total hanya menjumlahkan belanja yang harganya dicatat. Pengambilan barang dan barang keluar dicatat jumlahnya saja.
        </p>
      </div>

      {periodType !== 'DAILY' && (
        <div className="mb-5">
          <div className="font-bold text-xs text-slate-800 mb-2 border-b border-slate-300 pb-1">B. Rekap per Hari</div>
          {dailyTotals.length === 0 ? (
            <p className="text-[11px] text-slate-600">Tidak ada belanja bernilai rupiah pada periode ini.</p>
          ) : (
            <table className="w-full text-left text-xs border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold">
                  <th className="py-1.5 px-2 border border-slate-300 w-8 text-center">No</th>
                  <th className="py-1.5 px-2 border border-slate-300">Tanggal</th>
                  <th className="py-1.5 px-2 border border-slate-300 text-center">Catatan belanja</th>
                  <th className="py-1.5 px-2 border border-slate-300 text-right">Total belanja</th>
                </tr>
              </thead>
              <tbody>
                {dailyTotals.map((d, idx) => (
                  <tr key={d.date.toISOString()}>
                    <td className="py-1.5 px-2 border border-slate-300 text-center">{idx + 1}</td>
                    <td className="py-1.5 px-2 border border-slate-300">{formatDateLong(d.date)}</td>
                    <td className="py-1.5 px-2 border border-slate-300 text-center">{d.count}</td>
                    <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">{formatRp(d.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold">
                  <td colSpan={3} className="py-1.5 px-2 border border-slate-300 text-right">Total periode</td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">{formatRp(totals.belanja)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}

      <div className="mb-6 space-y-4">
        <div className="font-bold text-xs text-slate-800 border-b border-slate-300 pb-1">{periodType !== 'DAILY' ? 'C' : 'B'}. Rincian per Barang</div>
        {visibleCategories.map((cat, catIdx) => (
          <div key={cat} className="space-y-1">
            <div className="flex justify-between font-bold text-xs bg-slate-100 px-2 py-1 border border-slate-300">
              <span>{catIdx + 1}. {cat}</span>
              <span className="font-mono">{totals.byCategory[cat] > 0 ? formatRp(totals.byCategory[cat]) : '-'}</span>
            </div>
            {categoryItems[cat].length === 0 ? (
              <div className="p-2 text-center text-slate-600 text-[11px] border border-slate-300">
                Tidak ada catatan {cat.toLowerCase()} pada periode ini.
              </div>
            ) : (
              <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-semibold">
                    <th className="py-1 px-2 border border-slate-300 w-8 text-center">No</th>
                    <th className="py-1 px-2 border border-slate-300">Nama barang</th>
                    <th className="py-1 px-2 border border-slate-300 text-right">Jumlah</th>
                    <th className="py-1 px-2 border border-slate-300 text-center">Berapa kali</th>
                    <th className="py-1 px-2 border border-slate-300 text-right">Total belanja</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryItems[cat].map((it, itIdx) => (
                    <tr key={it.key}>
                      <td className="py-1 px-2 border border-slate-300 text-center">{itIdx + 1}</td>
                      <td className="py-1 px-2 border border-slate-300 font-medium">{it.itemName}</td>
                      <td className="py-1 px-2 border border-slate-300 text-right whitespace-nowrap">
                        {it.totalQty.toLocaleString('id-ID')} {it.unit}
                      </td>
                      <td className="py-1 px-2 border border-slate-300 text-center">{it.count}</td>
                      <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                        {it.totalNominal > 0 ? formatRp(it.totalNominal) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>

      <div className="pt-6 border-t border-slate-300 text-xs">
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-slate-600">Dibuat oleh,</div>
            <div className="font-semibold text-slate-800">Petugas Gudang</div>
            <div className="h-16 flex items-end justify-center font-bold">({currentUser.name})</div>
          </div>
          <div>
            <div className="text-slate-600">Diperiksa oleh,</div>
            <div className="font-semibold text-slate-800">Akuntan SPPG</div>
            <div className="h-16 flex items-end justify-center font-bold">({signerName('AKUNTAN')})</div>
          </div>
          <div>
            <div className="text-slate-600">Mengetahui,</div>
            <div className="font-semibold text-slate-800">Kepala SPPG Tumpang Jeru</div>
            <div className="h-16 flex items-end justify-center font-bold">({signerName('KEPALA_SPPG')})</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          body * { visibility: hidden; }
          #print-expenses-area, #print-expenses-area * { visibility: visible; }
          #print-expenses-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="no-print space-y-5">
        {successNotice && (
          <div role="status" className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-200">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Laporan Pengeluaran</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Uang belanja dan barang yang keluar dari gudang, per hari, minggu, atau bulan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onNavigate && can('RECEIVE_GOODS') && (
              <button
                type="button"
                onClick={() => onNavigate('receiving')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                <Plus className="w-4 h-4" />
                Terima Barang
              </button>
            )}
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              Ekspor Excel
            </button>
            <button
              type="button"
              onClick={() => setIsPrintPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              Cetak Laporan
            </button>
          </div>
        </div>

        {/* PERIODE */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div role="tablist" aria-label="Jenis periode" className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg text-xs self-start">
              {periodButton('DAILY', 'Harian')}
              {periodButton('WEEKLY', 'Mingguan')}
              {periodButton('MONTHLY', 'Bulanan')}
              {periodButton('CUSTOM', 'Pilih tanggal')}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {periodType === 'DAILY' && (
                <label className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">Tanggal</span>
                  <input type="date" value={selectedDailyDate} onChange={e => setSelectedDailyDate(e.target.value)} className={dateInputClass} />
                </label>
              )}
              {periodType === 'MONTHLY' && (
                <label className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">Bulan</span>
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className={dateInputClass} />
                </label>
              )}
              {(periodType === 'WEEKLY' || periodType === 'CUSTOM') && (
                <>
                  <label className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Dari</span>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={dateInputClass} />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Sampai</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={dateInputClass} />
                  </label>
                </>
              )}
              {periodType === 'WEEKLY' && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { setStartDate(shiftDays(today, -6)); setEndDate(today); }}
                    className="px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-medium text-slate-700 cursor-pointer min-h-[44px] sm:min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    7 hari terakhir
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStartDate(shiftDays(startDate, -7)); setEndDate(shiftDays(endDate, -7)); }}
                    className="px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-medium text-slate-700 cursor-pointer min-h-[44px] sm:min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    Mundur seminggu
                  </button>
                </div>
              )}
            </div>
          </div>
          {rangeInvalid && (
            <p className="text-xs text-rose-700 font-medium">Tanggal awal harus sebelum atau sama dengan tanggal akhir.</p>
          )}
        </div>

        {/* RINGKASAN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-white border border-slate-200">
            <div className="text-xs font-medium text-slate-600">Total belanja · {range.label}</div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{formatRp(totals.belanja)}</div>
            <div className="text-xs text-slate-600 mt-1">
              {totals.belanjaCount} belanja · {totals.pengambilanCount} pengambilan · {totals.dapurCount} barang keluar
            </div>
          </div>
          {CATEGORIES.map(cat => (
            <div key={cat} className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">{cat}</span>
                <span className="text-[11px] font-mono text-slate-600">
                  {totals.belanja > 0 ? Math.round((totals.byCategory[cat] / totals.belanja) * 100) : 0}%
                </span>
              </div>
              <div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{formatRp(totals.byCategory[cat])}</div>
              <div className="text-xs text-slate-600 mt-0.5">{categoryItems[cat].length} jenis barang</div>
            </div>
          ))}
        </div>

        {(totals.pengambilanCount > 0 || unreadableDateCount > 0) && (
          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 space-y-1">
            {totals.pengambilanCount > 0 && (
              <p>
                {totals.pengambilanCount} catatan belum ada harganya, jadi tidak ikut dijumlahkan ke total belanja.
              </p>
            )}
            {unreadableDateCount > 0 && (
              <p>
                {unreadableDateCount} catatan lama tanggalnya tidak terbaca, sehingga tidak masuk periode mana pun.
              </p>
            )}
          </div>
        )}

        {/* DAFTAR */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div role="tablist" aria-label="Tampilan" className="flex gap-1 p-1 bg-slate-100 rounded-lg text-xs self-start">
                {([
                  { id: 'SUMMARY', label: 'Rekap per barang' },
                  { id: 'TRANSACTIONS', label: `Semua catatan (${filteredExpenses.length})` },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeView === tab.id}
                    onClick={() => setActiveView(tab.id)}
                    className={`px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                      activeView === tab.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="relative w-full lg:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Cari catatan"
                  placeholder="Cari barang, relawan, petugas"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 min-h-[44px] sm:min-h-[34px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" aria-pressed={categoryFilter === 'ALL'} onClick={() => setCategoryFilter('ALL')} className={chipClass(categoryFilter === 'ALL')}>
                Semua kategori <span className="font-mono text-[11px] opacity-75">{categoryCounts.ALL}</span>
              </button>
              {CATEGORIES.map(cat => (
                <button key={cat} type="button" aria-pressed={categoryFilter === cat} onClick={() => setCategoryFilter(cat)} className={chipClass(categoryFilter === cat)}>
                  {cat} <span className="font-mono text-[11px] opacity-75">{categoryCounts[cat] || 0}</span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" aria-pressed={kindFilter === 'ALL'} onClick={() => setKindFilter('ALL')} className={chipClass(kindFilter === 'ALL')}>
                Semua jenis <span className="font-mono text-[11px] opacity-75">{kindCounts.ALL}</span>
              </button>
              {(['BELANJA', 'PENGAMBILAN', 'DAPUR'] as ExpenseKind[]).map(kind => (
                <button key={kind} type="button" aria-pressed={kindFilter === kind} onClick={() => setKindFilter(kind)} className={chipClass(kindFilter === kind)}>
                  {KIND_LABEL[kind]} <span className="font-mono text-[11px] opacity-75">{kindCounts[kind]}</span>
                </button>
              ))}
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-600">
              {periodExpenses.length === 0
                ? `Belum ada pengeluaran tercatat pada ${range.label}.`
                : 'Tidak ada catatan yang cocok dengan filter atau pencarian ini.'}
            </div>
          ) : activeView === 'SUMMARY' ? (
            <div className="divide-y divide-slate-200">
              {visibleCategories.map(cat => {
                const rows = categoryItems[cat];
                if (rows.length === 0) return null;
                return (
                  <section key={cat}>
                    <div className="px-4 py-2.5 bg-slate-50 flex items-center justify-between gap-2">
                      <h2 className="text-xs font-bold text-slate-800">{cat}</h2>
                      <span className={`text-xs font-semibold text-slate-700 ${totals.byCategory[cat] > 0 ? 'font-mono' : ''}`}>
                        {totals.byCategory[cat] > 0 ? formatRp(totals.byCategory[cat]) : 'Belum ada belanja'}
                      </span>
                    </div>
                    {/* Desktop */}
                    <table className="hidden md:table w-full table-fixed text-left text-xs">
                      <thead>
                        <tr className="text-slate-600 font-semibold border-b border-slate-200">
                          <th className="py-2 px-4">Nama barang</th>
                          <th className="py-2 px-4 text-right w-36">Jumlah</th>
                          <th className="py-2 px-4 text-center w-28">Berapa kali</th>
                          <th className="py-2 px-4 text-right w-40">Total belanja</th>
                          <th className="py-2 px-4 w-48">Porsi kategori</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {rows.map(item => {
                          const pct = totals.byCategory[cat] > 0 ? Math.round((item.totalNominal / totals.byCategory[cat]) * 100) : 0;
                          return (
                            <tr key={item.key} className="hover:bg-slate-50">
                              <td className="py-2.5 px-4 font-semibold text-slate-900">{item.itemName}</td>
                              <td className="py-2.5 px-4 text-right text-slate-800 whitespace-nowrap">
                                {item.totalQty.toLocaleString('id-ID')} {item.unit}
                              </td>
                              <td className="py-2.5 px-4 text-center text-slate-700">{item.count}</td>
                              <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">
                                {item.totalNominal > 0 ? formatRp(item.totalNominal) : <span className="text-slate-500 font-sans font-normal">-</span>}
                              </td>
                              <td className="py-2.5 px-4">
                                {item.totalNominal > 0 ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                      <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-700 w-8 text-right">{pct}%</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Mobile */}
                    <ul className="md:hidden divide-y divide-slate-100">
                      {rows.map(item => (
                        <li key={item.key} className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{item.itemName}</div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {item.totalQty.toLocaleString('id-ID')} {item.unit} · {item.count} kali
                            </div>
                          </div>
                          <div className="text-sm font-mono font-semibold text-slate-900 shrink-0">
                            {item.totalNominal > 0 ? formatRp(item.totalNominal) : '-'}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Jenis</th>
                      <th className="py-2.5 px-3">Barang</th>
                      <th className="py-2.5 px-3 text-right">Jumlah</th>
                      <th className="py-2.5 px-3 text-right">Total</th>
                      <th className="py-2.5 px-3">Diambil oleh / tujuan</th>
                      <th className="py-2.5 px-3">Dicatat oleh</th>
                      <th className="py-2.5 px-3 w-12"><span className="sr-only">Aksi</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredExpenses.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50 align-top">
                        <td className="py-2.5 px-3 text-slate-800 whitespace-nowrap">
                          <div>{item.parsedDate ? formatDateShort(item.parsedDate) : item.rawDate}</div>
                          {item.time && <div className="text-[11px] text-slate-600 font-mono">{item.time}</div>}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${KIND_BADGE[item.kind]}`}>
                            {KIND_LABEL[item.kind]}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{item.itemName}</div>
                          <div className="text-[11px] text-slate-600">{item.category}</div>
                          {item.notes && (
                            <div className="text-[11px] text-slate-600 max-w-xs truncate" title={item.notes}>{item.notes}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-800 whitespace-nowrap">{item.quantityLabel}</td>
                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                          {item.nominal ? (
                            <>
                              <div className="font-semibold text-slate-900">{formatRp(item.nominal)}</div>
                              {item.unitPrice && <div className="text-[11px] text-slate-600">@ {formatRp(item.unitPrice)}</div>}
                            </>
                          ) : (
                            <span className="text-slate-500 font-sans">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">{item.takenBy || '-'}</td>
                        <td className="py-2.5 px-3 text-slate-700">{item.recordedBy || '-'}</td>
                        <td className="py-2.5 px-3 text-center">
                          {item.kind !== 'DAPUR' && can('RECEIVE_GOODS') && (
                            <button
                              type="button"
                              onClick={() => handleDeleteManual(item.id, item.itemName)}
                              aria-label={`Hapus catatan ${item.itemName}`}
                              title="Hapus catatan"
                              className="inline-flex items-center justify-center w-8 h-8 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile */}
              <ul className="md:hidden divide-y divide-slate-100">
                {filteredExpenses.map(item => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${KIND_BADGE[item.kind]}`}>
                            {KIND_LABEL[item.kind]}
                          </span>
                          <span className="text-xs text-slate-600">
                            {item.parsedDate ? formatDateShort(item.parsedDate) : item.rawDate}
                            {item.time && ` · ${item.time}`}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 mt-1">{item.itemName}</div>
                        <div className="text-xs text-slate-600 mt-0.5">
                          {item.quantityLabel}
                          {item.takenBy && ` · ${item.takenBy}`}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-semibold text-slate-900">{item.nominal ? formatRp(item.nominal) : '-'}</div>
                        {item.kind !== 'DAPUR' && can('RECEIVE_GOODS') && (
                          <button
                            type="button"
                            onClick={() => handleDeleteManual(item.id, item.itemName)}
                            aria-label={`Hapus catatan ${item.itemName}`}
                            className="mt-1 inline-flex items-center justify-center w-11 h-11 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {isPrintPreviewOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expenses-print-title"
        >
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <h3 id="expenses-print-title" className="text-sm font-bold text-slate-900">Pratinjau cetak</h3>
                <p className="text-xs text-slate-600 truncate">Mengikuti periode dan filter yang sedang dipilih.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <Printer className="w-4 h-4" />
                  Cetak
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  aria-label="Tutup pratinjau"
                  className="inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200/60 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-6 overflow-auto bg-slate-100 flex-1">
              <div className="bg-white p-5 sm:p-8 rounded-lg border border-slate-200 min-w-[640px]">
                {renderPrintDocument()}
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="print-expenses-area" className="hidden print:block">
        {renderPrintDocument()}
      </div>
    </div>
  );
};
