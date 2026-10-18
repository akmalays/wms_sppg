import React, { useState, useMemo, useEffect } from 'react';
import { Select } from './common/Select';
import { useConfirm } from '../context/ConfirmContext';
import { KopText } from './common/KopText';
import { useAuth } from '../context/AuthContext';
import { warehouseDb, signerName } from '../db/storage';
import { WasteLog, DisposalMethod } from '../types/warehouse';
import { exportMultiSheetExcel } from '../lib/excelExport';
import {
  Trash2,
  Plus,
  Printer,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
  AlertTriangle,
} from 'lucide-react';
import { SppgLogo } from './SppgLogo';
import { localDateIso } from '../utils/localDate';

type NutritionKey = 'karbohidrat' | 'sayur' | 'protein hewani' | 'protein nabati' | 'buah';

const NUTRITION: { key: NutritionKey; label: string; short: string; dot: string }[] = [
  { key: 'karbohidrat', label: 'Karbohidrat', short: 'Karbo', dot: 'bg-amber-500' },
  { key: 'sayur', label: 'Sayur', short: 'Sayur', dot: 'bg-emerald-500' },
  { key: 'protein hewani', label: 'Protein hewani', short: 'Hewani', dot: 'bg-rose-500' },
  { key: 'protein nabati', label: 'Protein nabati', short: 'Nabati', dot: 'bg-violet-500' },
  { key: 'buah', label: 'Buah', short: 'Buah', dot: 'bg-teal-500' },
];

// Limbah di luar sisa makanan siswa: kupasan, bahan rusak, kemasan.
const OTHER_CATEGORIES: { value: string; label: string }[] = [
  { value: 'Limbah Olahan Dapur', label: 'Kupasan & sisa olahan dapur' },
  { value: 'Bahan Rusak / Kadaluarsa', label: 'Bahan rusak / kedaluwarsa' },
  { value: 'Kemasan & Non-Organik', label: 'Kemasan & non-organik' },
  { value: 'Sisa Makanan Distribusi', label: 'Sisa makanan distribusi' },
];

const DISPOSAL_OPTIONS: DisposalMethod[] = [
  'Pakan Ternak & Kompos Organik',
  'Pakan Maggot / Ternak',
  'Kompos Organik',
  'Bank Sampah / Daur Ulang',
  'TPS Terpadu',
];

// Dipakai untuk membagi total timbangan ke 5 kategori bila sisa tidak dipilah.
const SPLIT_PATTERNS: { name: string; shares: Record<NutritionKey, number> }[] = [
  { name: 'Menu nasi biasa', shares: { karbohidrat: 40, sayur: 30, 'protein nabati': 15, 'protein hewani': 10, buah: 5 } },
  { name: 'Gado-gado / tanpa nasi', shares: { karbohidrat: 10, sayur: 50, 'protein nabati': 25, 'protein hewani': 10, buah: 5 } },
  { name: 'Soto / sup', shares: { karbohidrat: 40, sayur: 35, 'protein nabati': 5, 'protein hewani': 15, buah: 5 } },
  { name: 'Bubur', shares: { karbohidrat: 55, sayur: 15, 'protein nabati': 10, 'protein hewani': 15, buah: 5 } },
];

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

const parseIso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const dayName = (iso: string) => (iso ? DAY_NAMES[parseIso(iso).getDay()] || '' : '');

// "18-Sep-26", format yang dipakai di spreadsheet rekap limbah.
const formatSheetDate = (iso: string) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)}-${MONTHS_SHORT[parseInt(m, 10) - 1] || m}-${y.slice(-2)}`;
};

const formatDate = (iso: string) => {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${MONTHS_SHORT[parseInt(m, 10) - 1] || m} ${y}`;
};

const formatKg = (val: number) =>
  val === 0 ? '0' : val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const round2 = (n: number) => Math.round(n * 100) / 100;

// Hanya satuan berat yang bisa dijumlahkan ke kg; Pcs dan Liter dihitung terpisah.
const toKg = (log: WasteLog): number | null => {
  const unit = (log.unit || '').toLowerCase();
  if (unit === 'kg') return log.quantity;
  if (unit === 'gram') return log.quantity / 1000;
  return null;
};

const nutritionKeyOf = (category: string): NutritionKey | null => {
  const c = (category || '').toLowerCase();
  const exact = NUTRITION.find(n => n.key === c);
  if (exact) return exact.key;
  if (c.includes('karbo')) return 'karbohidrat';
  if (c === 'sayur' || c === 'sayuran') return 'sayur';
  if (c.includes('hewani')) return 'protein hewani';
  if (c.includes('nabati')) return 'protein nabati';
  if (c === 'buah') return 'buah';
  return null;
};

const categoryLabel = (category: string) => {
  const nk = nutritionKeyOf(category);
  if (nk) return NUTRITION.find(n => n.key === nk)!.label;
  return OTHER_CATEGORIES.find(o => o.value === category)?.label || category;
};

const mostCommon = (values: string[]) => {
  const counts = new Map<string, number>();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
};

const weekRange = (iso: string) => {
  const d = parseIso(iso);
  const diffToMonday = d.getDay() === 0 ? -6 : 1 - d.getDay();
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: localDateIso(monday), end: localDateIso(sunday) };
};

interface OtherRow {
  category: string;
  itemName: string;
  quantity: string;
  unit: string;
  disposalMethod: DisposalMethod;
  notes: string;
}

const emptyOtherRow = (): OtherRow => ({
  category: 'Limbah Olahan Dapur',
  itemName: '',
  quantity: '',
  unit: 'Kg',
  disposalMethod: 'Kompos Organik',
  notes: '',
});

const emptyDailyValues = (): Record<NutritionKey, string> => ({
  karbohidrat: '',
  sayur: '',
  'protein hewani': '',
  'protein nabati': '',
  buah: '',
});

const inputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm sm:text-xs text-slate-800 min-h-[44px] sm:min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';

export const WasteLogModule: React.FC = () => {
  const { currentUser, can } = useAuth();
  const askConfirm = useConfirm();
  const canRecord = can('RECORD_CONSUMPTION');
  const today = localDateIso();

  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>(() => warehouseDb.getWasteLogs());
  const [successNotice, setSuccessNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'DAILY' | 'MATRIX' | 'LOGS'>('DAILY');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  const [filterMode, setFilterMode] = useState<'WEEK' | 'MONTH' | 'CUSTOM' | 'ALL'>('WEEK');
  const [selectedWeekDate, setSelectedWeekDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [customStartDate, setCustomStartDate] = useState(weekRange(today).start);
  const [customEndDate, setCustomEndDate] = useState(today);

  // Sisa makanan harian (5 kategori)
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [dailyDate, setDailyDate] = useState(today);
  const [dailyValues, setDailyValues] = useState<Record<NutritionKey, string>>(emptyDailyValues);
  const [dailyDisposal, setDailyDisposal] = useState<DisposalMethod>('Pakan Ternak & Kompos Organik');
  const [dailyNotes, setDailyNotes] = useState('');
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitTotal, setSplitTotal] = useState('');
  const [splitPatternIdx, setSplitPatternIdx] = useState(0);
  const [splitNote, setSplitNote] = useState('');

  // Limbah dapur lain
  const [isOtherModalOpen, setIsOtherModalOpen] = useState(false);
  const [otherDate, setOtherDate] = useState(today);
  const [otherRows, setOtherRows] = useState<OtherRow[]>([emptyOtherRow()]);

  const refreshLogs = () => setWasteLogs(warehouseDb.getWasteLogs());

  // Data dari Supabase bisa datang setelah halaman terbuka.
  useEffect(() => {
    const onChange = () => setWasteLogs(warehouseDb.getWasteLogs());
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

  const showNotice = (msg: string) => {
    setSuccessNotice(msg);
    setTimeout(() => setSuccessNotice(''), 5000);
  };

  const activeRange = useMemo(() => {
    if (filterMode === 'WEEK') {
      const { start, end } = weekRange(selectedWeekDate);
      return { start, end, label: `${formatDate(start)} s/d ${formatDate(end)}` };
    }
    if (filterMode === 'MONTH') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const last = new Date(y, m, 0).getDate();
      return {
        start: `${selectedMonth}-01`,
        end: `${selectedMonth}-${String(last).padStart(2, '0')}`,
        label: `${MONTHS_LONG[m - 1] || ''} ${y}`,
      };
    }
    if (filterMode === 'CUSTOM') {
      return { start: customStartDate, end: customEndDate, label: `${formatDate(customStartDate)} s/d ${formatDate(customEndDate)}` };
    }
    return { start: '', end: '', label: 'Semua tanggal' };
  }, [filterMode, selectedWeekDate, selectedMonth, customStartDate, customEndDate]);

  const rangeInvalid = filterMode === 'CUSTOM' && (!customStartDate || !customEndDate || customStartDate > customEndDate);

  const periodLogs = useMemo(() => {
    if (rangeInvalid) return [];
    if (filterMode === 'ALL') return wasteLogs;
    return wasteLogs.filter(l => l.date >= activeRange.start && l.date <= activeRange.end);
  }, [wasteLogs, filterMode, activeRange, rangeInvalid]);

  const stats = useMemo(() => {
    const byNutrition: Record<NutritionKey, number> = { karbohidrat: 0, sayur: 0, 'protein hewani': 0, 'protein nabati': 0, buah: 0 };
    let totalKg = 0;
    let otherKg = 0;
    let tpsKg = 0;
    let nonWeightCount = 0;
    periodLogs.forEach(l => {
      const kg = toKg(l);
      if (kg === null) {
        nonWeightCount += 1;
        return;
      }
      totalKg += kg;
      const nk = nutritionKeyOf(l.wasteCategory);
      if (nk) byNutrition[nk] += kg;
      else otherKg += kg;
      if (l.disposalMethod === 'TPS Terpadu') tpsKg += kg;
    });
    const divertedKg = totalKg - tpsKg;
    return {
      byNutrition,
      totalKg: round2(totalKg),
      otherKg: round2(otherKg),
      tpsKg: round2(tpsKg),
      divertedKg: round2(divertedKg),
      circularRate: totalKg > 0 ? Math.round((divertedKg / totalKg) * 100) : 0,
      nonWeightCount,
    };
  }, [periodLogs]);

  // Satu baris per tanggal untuk 5 kategori sisa makanan.
  const dailyRows = useMemo(() => {
    const map = new Map<string, WasteLog[]>();
    periodLogs.forEach(l => {
      if (!nutritionKeyOf(l.wasteCategory)) return;
      map.set(l.date, [...(map.get(l.date) || []), l]);
    });
    return Array.from(map.entries())
      .map(([date, logs]) => {
        const values: Record<NutritionKey, number> = { karbohidrat: 0, sayur: 0, 'protein hewani': 0, 'protein nabati': 0, buah: 0 };
        logs.forEach(l => {
          const nk = nutritionKeyOf(l.wasteCategory)!;
          values[nk] += toKg(l) ?? 0;
        });
        NUTRITION.forEach(n => (values[n.key] = round2(values[n.key])));
        const notes = Array.from(new Set(logs.map(l => l.notes || '').filter(Boolean))).join('; ');
        return {
          date,
          values,
          total: round2(NUTRITION.reduce((s, n) => s + values[n.key], 0)),
          disposal: mostCommon(logs.map(l => l.disposalMethod)),
          notes,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [periodLogs]);

  const matrix = useMemo(() => {
    const dates = Array.from(new Set(periodLogs.filter(l => toKg(l) !== null).map(l => l.date))).sort();
    const otherCats = Array.from(
      new Set(periodLogs.filter(l => !nutritionKeyOf(l.wasteCategory) && toKg(l) !== null).map(l => l.wasteCategory))
    );
    const rowDefs = [
      ...NUTRITION.map(n => ({ key: n.key as string, label: n.label, match: (l: WasteLog) => nutritionKeyOf(l.wasteCategory) === n.key })),
      ...otherCats.map(c => ({ key: c, label: categoryLabel(c), match: (l: WasteLog) => l.wasteCategory === c })),
    ];
    const dateTotals: Record<string, number> = {};
    const rows = rowDefs.map(def => {
      const values: Record<string, number> = {};
      let total = 0;
      dates.forEach(d => {
        const sum = periodLogs
          .filter(l => l.date === d && def.match(l))
          .reduce((acc, l) => acc + (toKg(l) ?? 0), 0);
        values[d] = round2(sum);
        total += sum;
        dateTotals[d] = round2((dateTotals[d] || 0) + sum);
      });
      const catLogs = periodLogs.filter(def.match);
      return {
        key: def.key,
        label: def.label,
        values,
        total: round2(total),
        disposal: mostCommon(catLogs.map(l => l.disposalMethod)),
      };
    });
    return { dates, rows, dateTotals, grandTotal: round2(rows.reduce((s, r) => s + r.total, 0)) };
  }, [periodLogs]);

  const visibleLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...periodLogs]
      .filter(l => {
        if (!q) return true;
        const hay = `${l.itemName || ''} ${categoryLabel(l.wasteCategory)} ${l.disposalMethod} ${l.notes || ''} ${l.recordedBy || ''} ${dayName(l.date)} ${l.date}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [periodLogs, searchQuery]);

  // ---------- Sisa makanan harian ----------
  const loadDailyForm = (date: string) => {
    const existing = wasteLogs.filter(l => l.date === date && nutritionKeyOf(l.wasteCategory));
    const values = emptyDailyValues();
    existing.forEach(l => {
      const nk = nutritionKeyOf(l.wasteCategory)!;
      const kg = toKg(l) ?? 0;
      values[nk] = String(round2((parseFloat(values[nk]) || 0) + kg));
    });
    setDailyValues(values);
    setDailyDisposal(existing.length > 0 ? mostCommon(existing.map(l => l.disposalMethod)) : 'Pakan Ternak & Kompos Organik');
    setDailyNotes(Array.from(new Set(existing.map(l => l.notes || '').filter(Boolean))).join('; '));
    setSplitNote('');
  };

  const openDailyModal = (date?: string) => {
    const target = date || today;
    setDailyDate(target);
    loadDailyForm(target);
    setSplitOpen(false);
    setSplitTotal('');
    setIsDailyModalOpen(true);
  };

  const dailyHasExisting = wasteLogs.some(l => l.date === dailyDate && nutritionKeyOf(l.wasteCategory));
  const dailySum = round2(NUTRITION.reduce((s, n) => s + (parseFloat(dailyValues[n.key]) || 0), 0));

  const applySplit = () => {
    const total = parseFloat(splitTotal);
    if (!(total > 0)) {
      alert('Isi total timbangan lebih dari 0 kg.');
      return;
    }
    const pattern = SPLIT_PATTERNS[splitPatternIdx];
    const values = emptyDailyValues();
    NUTRITION.forEach(n => (values[n.key] = String(round2((pattern.shares[n.key] / 100) * total))));
    setDailyValues(values);
    setSplitNote(`Dibagi otomatis dari total ${formatKg(total)} kg (pola ${pattern.name.toLowerCase()}).`);
    setSplitOpen(false);
  };

  const handleSaveDaily = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dailyDate) return;
    if (NUTRITION.some(n => (parseFloat(dailyValues[n.key]) || 0) < 0)) {
      alert('Berat tidak boleh negatif.');
      return;
    }
    if (dailySum === 0 && !(await askConfirm({
      title: 'Semua kategori 0 kg',
      message: 'Simpan sebagai hari tanpa sisa makanan?',
      confirmText: 'Simpan',
    }))) return;
    if (dailyHasExisting && !(await askConfirm({
      title: 'Ganti data yang sudah ada?',
      message: `Data ${dayName(dailyDate)}, ${formatDate(dailyDate)} sudah tercatat dan akan diganti dengan angka baru.`,
      confirmText: 'Ganti data',
      variant: 'warning',
    }))) return;

    const notes = [dailyNotes.trim(), splitNote].filter(Boolean).join(' ');
    warehouseDb.saveDailyNutritionLog(
      dailyDate,
      dayName(dailyDate),
      NUTRITION.map(n => ({
        category: n.key,
        quantity: parseFloat(dailyValues[n.key]) || 0,
        unit: 'Kg',
        disposalMethod: dailyDisposal,
        notes: notes || undefined,
      })),
      currentUser
    );
    refreshLogs();
    setIsDailyModalOpen(false);
    showNotice(`Sisa makanan ${dayName(dailyDate)}, ${formatDate(dailyDate)} tersimpan: ${formatKg(dailySum)} kg.`);
  };

  const handleDeleteDay = async (date: string) => {
    if (!(await askConfirm({
      title: `Hapus rekap sisa makanan ${dayName(date)}, ${formatDate(date)}?`,
      message: 'Catatan limbah dapur lain di tanggal itu tidak ikut terhapus.',
      confirmText: 'Hapus rekap',
      variant: 'danger',
    }))) return;
    warehouseDb.deleteDailyWasteLogs(date, currentUser);
    refreshLogs();
    showNotice(`Rekap sisa makanan ${formatDate(date)} dihapus.`);
  };

  // ---------- Limbah dapur lain ----------
  const openOtherModal = () => {
    setOtherDate(today);
    setOtherRows([emptyOtherRow()]);
    setIsOtherModalOpen(true);
  };

  const updateOtherRow = (idx: number, patch: Partial<OtherRow>) =>
    setOtherRows(rows => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const handleSaveOther = (e: React.FormEvent) => {
    e.preventDefault();
    const filled = otherRows.filter(r => r.itemName.trim() || r.quantity);
    if (filled.length === 0) {
      alert('Isi minimal satu baris limbah.');
      return;
    }
    const incomplete = filled.findIndex(r => !r.itemName.trim() || !(parseFloat(r.quantity) > 0));
    if (incomplete >= 0) {
      alert(`Baris ${otherRows.indexOf(filled[incomplete]) + 1}: isi uraian dan jumlah lebih dari 0.`);
      return;
    }
    warehouseDb.recordWasteBatch(
      filled.map(r => ({
        date: otherDate,
        wasteCategory: r.category,
        itemName: r.itemName.trim(),
        quantity: parseFloat(r.quantity),
        unit: r.unit,
        sourceArea: 'Dapur SPPG Tumpang Jeru',
        disposalMethod: r.disposalMethod,
        recordedBy: currentUser.name,
        notes: r.notes.trim() || undefined,
      })),
      currentUser
    );
    refreshLogs();
    setIsOtherModalOpen(false);
    setOtherRows([emptyOtherRow()]);
    showNotice(`${filled.length} catatan limbah dapur tanggal ${formatDate(otherDate)} tersimpan.`);
  };

  const handleDeleteLog = async (log: WasteLog) => {
    const name = log.itemName || categoryLabel(log.wasteCategory);
    if (!(await askConfirm({
      title: `Hapus catatan "${name}"?`,
      message: `${formatKg(log.quantity)} ${log.unit}, tanggal ${formatDate(log.date)}.`,
      confirmText: 'Hapus catatan',
      variant: 'danger',
    }))) return;
    warehouseDb.deleteWasteLog(log.id, currentUser);
    refreshLogs();
    showNotice(`Catatan "${name}" dihapus.`);
  };

  // ---------- Ekspor ----------
  const handleExportExcel = () => {
    if (periodLogs.length === 0) {
      alert('Tidak ada catatan limbah pada periode ini.');
      return;
    }
    // Lembar 1 dan 2 mengikuti format spreadsheet rekap limbah yang dipakai tim.
    const ascendingDays = [...dailyRows].reverse();
    const dailySheet: Record<string, any>[] = [];
    ascendingDays.forEach(day => {
      NUTRITION.forEach((n, idx) => {
        dailySheet.push({
          'hari': idx === 0 ? dayName(day.date).toLowerCase() : '',
          'tanggal': idx === 0 ? formatSheetDate(day.date) : '',
          'jenis limbah': n.key,
          'jumlah': day.values[n.key],
          'satuan': 'kg',
        });
      });
      dailySheet.push({ 'hari': 'total', 'tanggal': '', 'jenis limbah': '', 'jumlah': day.total, 'satuan': 'kg' });
      dailySheet.push({ 'hari': '', 'tanggal': '', 'jenis limbah': '', 'jumlah': '', 'satuan': '' });
    });

    const matrixSheet: Record<string, any>[] = matrix.rows.map((r, idx) => {
      const row: Record<string, any> = { 'no': idx + 1, 'limbah': r.label.toLowerCase() };
      matrix.dates.forEach(d => (row[formatSheetDate(d)] = r.values[d] ?? 0));
      row['total'] = r.total;
      row['satuan'] = 'kg';
      return row;
    });
    const totalRow: Record<string, any> = { 'no': '', 'limbah': 'total keseluruhan limbah :' };
    matrix.dates.forEach(d => (totalRow[formatSheetDate(d)] = matrix.dateTotals[d] ?? 0));
    totalRow['total'] = matrix.grandTotal;
    totalRow['satuan'] = 'kg';
    matrixSheet.push(totalRow);

    const detailSheet = visibleLogs.map((l, idx) => ({
      'No': idx + 1,
      'Hari': dayName(l.date),
      'Tanggal': l.date,
      'Kategori': categoryLabel(l.wasteCategory),
      'Uraian': l.itemName || '-',
      'Jumlah': l.quantity,
      'Satuan': l.unit,
      'Penanganan': l.disposalMethod,
      'Dicatat oleh': l.recordedBy || '-',
      'Catatan': l.notes || '-',
    }));

    exportMultiSheetExcel(
      [
        { sheetName: 'Rekap Harian', data: dailySheet },
        { sheetName: 'Total Hitung Limbah', data: matrixSheet },
        { sheetName: 'Detail Log', data: detailSheet },
      ],
      `Rekap_Limbah_SPPG_Tumpang_Jeru_${filterMode === 'ALL' ? 'semua' : `${activeRange.start}_${activeRange.end}`}.xlsx`
    );
  };

  // ---------- Dokumen cetak ----------
  const renderPrintDocument = () => {
    const ascendingDays = [...dailyRows].reverse();
    const chunkSize = 10;
    const chunks: string[][] = [];
    for (let i = 0; i < matrix.dates.length; i += chunkSize) chunks.push(matrix.dates.slice(i, i + chunkSize));
    const avgDaily = matrix.dates.length > 0 ? round2(stats.totalKg / matrix.dates.length) : 0;

    return (
      <div className="bg-white font-sans text-slate-900 w-full text-xs">
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <SppgLogo size="lg" variant="color" showText={false} />
            <KopText />
          </div>
          <div className="text-right text-[11px] text-slate-600 space-y-0.5 shrink-0">
            <div>Dicetak: {formatDate(today)}</div>
            <div>Oleh: {currentUser.name}</div>
          </div>
        </div>

        <div className="text-center mb-4">
          <h2 className="text-sm font-bold text-slate-900">Laporan Rekap Limbah</h2>
          <p className="text-xs font-semibold text-slate-800 mt-1">Periode {activeRange.label}</p>
        </div>

        <div className="grid grid-cols-4 gap-3 p-3 border border-slate-300 mb-5">
          <div>
            <div className="text-slate-600 text-[10px]">Total limbah</div>
            <div className="font-bold font-mono text-sm">{formatKg(stats.totalKg)} kg</div>
            <div className="text-[10px] text-slate-600">{matrix.dates.length} hari tercatat</div>
          </div>
          <div>
            <div className="text-slate-600 text-[10px]">Jadi pakan / kompos / daur ulang</div>
            <div className="font-bold font-mono text-sm">{formatKg(stats.divertedKg)} kg</div>
            <div className="text-[10px] text-slate-600">{stats.circularRate}% dari total</div>
          </div>
          <div>
            <div className="text-slate-600 text-[10px]">Dibuang ke TPS</div>
            <div className="font-bold font-mono text-sm">{formatKg(stats.tpsKg)} kg</div>
            <div className="text-[10px] text-slate-600">{stats.totalKg > 0 ? 100 - stats.circularRate : 0}% dari total</div>
          </div>
          <div>
            <div className="text-slate-600 text-[10px]">Rata-rata per hari</div>
            <div className="font-bold font-mono text-sm">{formatKg(avgDaily)} kg</div>
            <div className="text-[10px] text-slate-600">dari hari yang ada catatannya</div>
          </div>
        </div>

        <div className="mb-5">
          <div className="font-bold text-xs text-slate-800 mb-2 border-b border-slate-300 pb-1">A. Total per Kategori</div>
          <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 font-semibold text-slate-700">
                <th className="py-1.5 px-2 border border-slate-300 w-8 text-center">No</th>
                <th className="py-1.5 px-2 border border-slate-300">Kategori</th>
                <th className="py-1.5 px-2 border border-slate-300 text-right">Total (kg)</th>
                <th className="py-1.5 px-2 border border-slate-300 text-right">Rata-rata / hari</th>
                <th className="py-1.5 px-2 border border-slate-300 text-right">Porsi</th>
                <th className="py-1.5 px-2 border border-slate-300">Penanganan terbanyak</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row, idx) => (
                <tr key={row.key}>
                  <td className="py-1.5 px-2 border border-slate-300 text-center">{idx + 1}</td>
                  <td className="py-1.5 px-2 border border-slate-300 font-semibold">{row.label}</td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">{formatKg(row.total)}</td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">
                    {formatKg(matrix.dates.length > 0 ? round2(row.total / matrix.dates.length) : 0)}
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">
                    {matrix.grandTotal > 0 ? Math.round((row.total / matrix.grandTotal) * 100) : 0}%
                  </td>
                  <td className="py-1.5 px-2 border border-slate-300">{row.disposal || '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold">
                <td colSpan={2} className="py-1.5 px-2 border border-slate-300 text-right">Total</td>
                <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">{formatKg(matrix.grandTotal)}</td>
                <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">{formatKg(avgDaily)}</td>
                <td className="py-1.5 px-2 border border-slate-300 text-right font-mono">{matrix.grandTotal > 0 ? '100%' : '0%'}</td>
                <td className="py-1.5 px-2 border border-slate-300" />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mb-5">
          <div className="font-bold text-xs text-slate-800 mb-2 border-b border-slate-300 pb-1">B. Timbangan per Tanggal (kg)</div>
          {chunks.length === 0 ? (
            <div className="p-3 text-center text-slate-600 border border-slate-300">Tidak ada data timbangan pada periode ini.</div>
          ) : (
            <div className="space-y-3">
              {chunks.map((dates, ci) => (
                <table key={ci} className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 font-semibold text-slate-700">
                      <th className="py-1 px-2 border border-slate-300">Kategori</th>
                      {dates.map(d => (
                        <th key={d} className="py-1 px-1.5 border border-slate-300 text-center whitespace-nowrap">
                          <div className="font-normal">{dayName(d)}</div>
                          <div>{formatSheetDate(d)}</div>
                        </th>
                      ))}
                      <th className="py-1 px-2 border border-slate-300 text-right">{chunks.length > 1 ? 'Subtotal' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.rows.map(row => (
                      <tr key={row.key}>
                        <td className="py-1 px-2 border border-slate-300 font-semibold">{row.label}</td>
                        {dates.map(d => (
                          <td key={d} className="py-1 px-1.5 border border-slate-300 text-right font-mono">
                            {row.values[d] ? formatKg(row.values[d]) : '-'}
                          </td>
                        ))}
                        <td className="py-1 px-2 border border-slate-300 text-right font-mono font-bold">
                          {formatKg(round2(dates.reduce((s, d) => s + (row.values[d] || 0), 0)))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td className="py-1 px-2 border border-slate-300 text-right">Total harian</td>
                      {dates.map(d => (
                        <td key={d} className="py-1 px-1.5 border border-slate-300 text-right font-mono">{formatKg(matrix.dateTotals[d] || 0)}</td>
                      ))}
                      <td className="py-1 px-2 border border-slate-300 text-right font-mono">
                        {formatKg(round2(dates.reduce((s, d) => s + (matrix.dateTotals[d] || 0), 0)))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <div className="font-bold text-xs text-slate-800 mb-2 border-b border-slate-300 pb-1">C. Sisa Makanan per Hari</div>
          {ascendingDays.length === 0 ? (
            <div className="p-3 text-center text-slate-600 border border-slate-300">Tidak ada rekap sisa makanan pada periode ini.</div>
          ) : (
            <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100 font-semibold text-slate-700">
                  <th className="py-1 px-2 border border-slate-300">Hari, tanggal</th>
                  {NUTRITION.map(n => (
                    <th key={n.key} className="py-1 px-1.5 border border-slate-300 text-right">{n.short}</th>
                  ))}
                  <th className="py-1 px-1.5 border border-slate-300 text-right">Total</th>
                  <th className="py-1 px-2 border border-slate-300">Penanganan</th>
                  <th className="py-1 px-2 border border-slate-300">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {ascendingDays.map(d => (
                  <tr key={d.date}>
                    <td className="py-1 px-2 border border-slate-300 whitespace-nowrap">{dayName(d.date)}, {formatSheetDate(d.date)}</td>
                    {NUTRITION.map(n => (
                      <td key={n.key} className="py-1 px-1.5 border border-slate-300 text-right font-mono">{formatKg(d.values[n.key])}</td>
                    ))}
                    <td className="py-1 px-1.5 border border-slate-300 text-right font-mono font-bold">{formatKg(d.total)}</td>
                    <td className="py-1 px-2 border border-slate-300">{d.disposal || '-'}</td>
                    <td className="py-1 px-2 border border-slate-300">{d.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="pt-6 border-t border-slate-300 text-xs">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-slate-600">Dibuat oleh,</div>
              <div className="font-semibold text-slate-800">Petugas Sanitasi & Limbah</div>
              <div className="h-16 flex items-end justify-center font-bold">({currentUser.name})</div>
            </div>
            <div>
              <div className="text-slate-600">Diperiksa oleh,</div>
              <div className="font-semibold text-slate-800">Ahli Gizi SPPG</div>
              <div className="h-16 flex items-end justify-center font-bold">({signerName('AHLI_GIZI')})</div>
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
  };

  const iconButtonClass =
    'inline-flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';

  const secondaryButtonClass =
    'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';

  const navButtonClass =
    'inline-flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';

  return (
    <div className="space-y-5">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm 12mm; }
          body * { visibility: hidden; }
          #print-waste-rekap, #print-waste-rekap * { visibility: visible; }
          #print-waste-rekap { position: absolute; left: 0; top: 0; width: 100%; }
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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Rekap Limbah</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Timbangan sisa makanan harian dan limbah dapur, per minggu atau per bulan.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canRecord && (
              <>
                <button
                  type="button"
                  onClick={() => openDailyModal()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <Plus className="w-4 h-4" />
                  Catat Sisa Makanan
                </button>
                <button type="button" onClick={openOtherModal} className={secondaryButtonClass}>
                  <Plus className="w-4 h-4 text-slate-500" />
                  Limbah Dapur Lain
                </button>
              </>
            )}
            <button type="button" onClick={handleExportExcel} className={secondaryButtonClass}>
              <FileSpreadsheet className="w-4 h-4 text-slate-500" />
              Ekspor Excel
            </button>
            <button type="button" onClick={() => setIsPrintPreviewOpen(true)} className={secondaryButtonClass}>
              <Printer className="w-4 h-4 text-slate-500" />
              Cetak
            </button>
          </div>
        </div>

        {/* PERIODE */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div role="tablist" aria-label="Jenis periode" className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg text-xs self-start">
              {([
                { id: 'WEEK', label: 'Mingguan' },
                { id: 'MONTH', label: 'Bulanan' },
                { id: 'CUSTOM', label: 'Pilih tanggal' },
                { id: 'ALL', label: 'Semua' },
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={filterMode === opt.id}
                  onClick={() => setFilterMode(opt.id)}
                  className={`px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[32px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                    filterMode === opt.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {filterMode === 'WEEK' && (
                <>
                  <button
                    type="button"
                    aria-label="Minggu sebelumnya"
                    onClick={() => setSelectedWeekDate(localDateIso(new Date(parseIso(selectedWeekDate).getTime() - 7 * 86400000)))}
                    className={navButtonClass}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="font-semibold text-slate-800 min-w-[11rem] text-center">{activeRange.label}</span>
                  <button
                    type="button"
                    aria-label="Minggu berikutnya"
                    onClick={() => setSelectedWeekDate(localDateIso(new Date(parseIso(selectedWeekDate).getTime() + 7 * 86400000)))}
                    className={navButtonClass}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  {weekRange(selectedWeekDate).start !== weekRange(today).start && (
                    <button
                      type="button"
                      onClick={() => setSelectedWeekDate(today)}
                      className="px-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 font-medium text-slate-700 cursor-pointer min-h-[44px] sm:min-h-[34px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                    >
                      Minggu ini
                    </button>
                  )}
                </>
              )}
              {filterMode === 'MONTH' && (
                <label className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">Bulan</span>
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className={`${inputClass} w-auto`} />
                </label>
              )}
              {filterMode === 'CUSTOM' && (
                <>
                  <label className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Dari</span>
                    <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className={`${inputClass} w-auto`} />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-slate-600 font-medium">Sampai</span>
                    <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className={`${inputClass} w-auto`} />
                  </label>
                </>
              )}
            </div>
          </div>
          {rangeInvalid && (
            <p className="text-xs text-rose-700 font-medium">Tanggal awal harus sebelum atau sama dengan tanggal akhir.</p>
          )}
        </div>

        {/* RINGKASAN */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-xl bg-white border border-slate-200 col-span-2 sm:col-span-3 lg:col-span-1">
            <div className="text-xs font-medium text-slate-600">Total limbah</div>
            <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
              {formatKg(stats.totalKg)} <span className="text-sm font-medium text-slate-600">kg</span>
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              {stats.totalKg > 0 ? `${stats.circularRate}% jadi pakan, kompos, atau daur ulang` : `${matrix.dates.length} hari tercatat`}
            </div>
          </div>
          {NUTRITION.map(n => (
            <div key={n.key} className="p-4 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                <span className={`w-2 h-2 rounded-full ${n.dot}`} aria-hidden="true" />
                {n.label}
              </div>
              <div className="text-lg font-bold text-slate-900 mt-1 tabular-nums">
                {formatKg(round2(stats.byNutrition[n.key]))} <span className="text-xs font-medium text-slate-600">kg</span>
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {stats.totalKg > 0 ? Math.round((stats.byNutrition[n.key] / stats.totalKg) * 100) : 0}% dari total
              </div>
            </div>
          ))}
        </div>

        {(stats.otherKg > 0 || stats.nonWeightCount > 0) && (
          <div className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 space-y-1">
            {stats.otherKg > 0 && <p>Total sudah termasuk {formatKg(stats.otherKg)} kg limbah dapur lain (kupasan, bahan rusak, kemasan).</p>}
            {stats.nonWeightCount > 0 && (
              <p>{stats.nonWeightCount} catatan memakai satuan Pcs atau Liter, jadi tidak ikut dijumlahkan ke kg. Lihat di Semua catatan.</p>
            )}
          </div>
        )}

        {/* TAMPILAN */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-3.5 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div role="tablist" aria-label="Tampilan" className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg text-xs self-start">
              {([
                { id: 'DAILY', label: 'Sisa makanan per hari' },
                { id: 'MATRIX', label: 'Tabel per tanggal' },
                { id: 'LOGS', label: `Semua catatan (${periodLogs.length})` },
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
            {activeView === 'LOGS' && (
              <div className="relative w-full lg:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="search"
                  aria-label="Cari catatan limbah"
                  placeholder="Cari uraian, kategori, petugas"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg text-slate-800 min-h-[44px] sm:min-h-[34px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>
            )}
          </div>

          {/* PER HARI */}
          {activeView === 'DAILY' &&
            (dailyRows.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-600">
                <p>Belum ada rekap sisa makanan pada {activeRange.label.toLowerCase() === 'semua tanggal' ? 'data ini' : activeRange.label}.</p>
                {canRecord && (
                  <button
                    type="button"
                    onClick={() => openDailyModal()}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                  >
                    <Plus className="w-4 h-4" />
                    Catat Sisa Makanan
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4">Hari, tanggal</th>
                        {NUTRITION.map(n => (
                          <th key={n.key} className="py-2.5 px-3 text-right whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${n.dot}`} aria-hidden="true" />
                              {n.short}
                            </span>
                          </th>
                        ))}
                        <th className="py-2.5 px-3 text-right">Total (kg)</th>
                        <th className="py-2.5 px-3">Penanganan</th>
                        {canRecord && <th className="py-2.5 px-3 w-24"><span className="sr-only">Aksi</span></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyRows.map(d => (
                        <tr key={d.date} className="hover:bg-slate-50 align-top">
                          <td className="py-2.5 px-4">
                            <div className="font-semibold text-slate-900">{dayName(d.date)}</div>
                            <div className="text-[11px] text-slate-600">{formatDate(d.date)}</div>
                            {d.notes && <div className="text-[11px] text-slate-600 max-w-[16rem] truncate" title={d.notes}>{d.notes}</div>}
                          </td>
                          {NUTRITION.map(n => (
                            <td key={n.key} className={`py-2.5 px-3 text-right font-mono tabular-nums ${d.values[n.key] > 0 ? 'text-slate-900' : 'text-slate-500'}`}>
                              {formatKg(d.values[n.key])}
                            </td>
                          ))}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">{formatKg(d.total)}</td>
                          <td className="py-2.5 px-3 text-slate-700">{d.disposal || '-'}</td>
                          {canRecord && (
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => openDailyModal(d.date)}
                                  aria-label={`Ubah sisa makanan ${formatDate(d.date)}`}
                                  title="Ubah"
                                  className={`${iconButtonClass} text-slate-600 hover:text-emerald-800 hover:bg-emerald-50`}
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDay(d.date)}
                                  aria-label={`Hapus sisa makanan ${formatDate(d.date)}`}
                                  title="Hapus"
                                  className={`${iconButtonClass} text-slate-600 hover:text-rose-700 hover:bg-rose-50`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="md:hidden divide-y divide-slate-100">
                  {dailyRows.map(d => (
                    <li key={d.date} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{dayName(d.date)}, {formatDate(d.date)}</div>
                          <div className="text-xs text-slate-600 mt-0.5">{d.disposal || '-'}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-base font-bold font-mono text-slate-900">{formatKg(d.total)} kg</div>
                        </div>
                      </div>
                      <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 mt-2.5 text-xs">
                        {NUTRITION.map(n => (
                          <div key={n.key} className="flex items-center justify-between gap-1">
                            <dt className="flex items-center gap-1 text-slate-600">
                              <span className={`w-1.5 h-1.5 rounded-full ${n.dot}`} aria-hidden="true" />
                              {n.short}
                            </dt>
                            <dd className="font-mono text-slate-900">{formatKg(d.values[n.key])}</dd>
                          </div>
                        ))}
                      </dl>
                      {d.notes && <p className="text-xs text-slate-600 mt-2">{d.notes}</p>}
                      {canRecord && (
                        <div className="flex gap-2 mt-2.5">
                          <button
                            type="button"
                            onClick={() => openDailyModal(d.date)}
                            className="inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <Pencil className="w-4 h-4" /> Ubah
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDay(d.date)}
                            className="inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700 bg-white min-h-[44px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            <Trash2 className="w-4 h-4" /> Hapus
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ))}

          {/* MATRIKS */}
          {activeView === 'MATRIX' &&
            (matrix.dates.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-600">Belum ada timbangan pada {activeRange.label}.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4 sticky left-0 bg-slate-50 z-10 min-w-[9rem]">Kategori</th>
                      {matrix.dates.map(d => (
                        <th key={d} className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="text-[11px] font-normal text-slate-600">{dayName(d)}</div>
                          <div className="text-slate-800">{formatSheetDate(d)}</div>
                        </th>
                      ))}
                      <th className="py-2.5 px-4 text-right bg-slate-100">Total (kg)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matrix.rows.map(row => {
                      const nut = NUTRITION.find(n => n.key === row.key);
                      return (
                        <tr key={row.key} className="hover:bg-slate-50">
                          <td className="py-2.5 px-4 sticky left-0 bg-white z-10 font-medium text-slate-800">
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${nut ? nut.dot : 'bg-slate-400'}`} aria-hidden="true" />
                              {row.label}
                            </span>
                          </td>
                          {matrix.dates.map(d => (
                            <td key={d} className={`py-2.5 px-3 text-right font-mono tabular-nums ${row.values[d] > 0 ? 'text-slate-900' : 'text-slate-500'}`}>
                              {row.values[d] > 0 ? formatKg(row.values[d]) : '-'}
                            </td>
                          ))}
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 bg-slate-50 tabular-nums">{formatKg(row.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                      <td className="py-2.5 px-4 sticky left-0 bg-slate-50 z-10">Total harian</td>
                      {matrix.dates.map(d => (
                        <td key={d} className="py-2.5 px-3 text-right font-mono tabular-nums">{formatKg(matrix.dateTotals[d] || 0)}</td>
                      ))}
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums bg-slate-100">{formatKg(matrix.grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}

          {/* SEMUA CATATAN */}
          {activeView === 'LOGS' &&
            (visibleLogs.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-600">
                {periodLogs.length === 0 ? `Belum ada catatan limbah pada ${activeRange.label}.` : 'Tidak ada catatan yang cocok dengan pencarian ini.'}
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                        <th className="py-2.5 px-4">Tanggal</th>
                        <th className="py-2.5 px-3">Kategori</th>
                        <th className="py-2.5 px-3">Uraian</th>
                        <th className="py-2.5 px-3 text-right">Jumlah</th>
                        <th className="py-2.5 px-3">Penanganan</th>
                        <th className="py-2.5 px-3">Dicatat oleh</th>
                        {canRecord && <th className="py-2.5 px-3 w-12"><span className="sr-only">Aksi</span></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-50 align-top">
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <div className="text-slate-900">{formatDate(log.date)}</div>
                            <div className="text-[11px] text-slate-600">{dayName(log.date)}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">{categoryLabel(log.wasteCategory)}</td>
                          <td className="py-2.5 px-3">
                            <div className="text-slate-900">{log.itemName || '-'}</div>
                            {log.notes && <div className="text-[11px] text-slate-600 max-w-xs truncate" title={log.notes}>{log.notes}</div>}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900 whitespace-nowrap">
                            {formatKg(log.quantity)} {log.unit}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">{log.disposalMethod}</td>
                          <td className="py-2.5 px-3 text-slate-700">{log.recordedBy || '-'}</td>
                          {canRecord && (
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log)}
                                aria-label={`Hapus catatan ${log.itemName || categoryLabel(log.wasteCategory)}`}
                                title="Hapus"
                                className={`${iconButtonClass} text-slate-600 hover:text-rose-700 hover:bg-rose-50`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="md:hidden divide-y divide-slate-100">
                  {visibleLogs.map(log => (
                    <li key={log.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-600">{dayName(log.date)}, {formatDate(log.date)} · {categoryLabel(log.wasteCategory)}</div>
                        <div className="text-sm font-semibold text-slate-900 mt-0.5">{log.itemName || '-'}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{log.disposalMethod}</div>
                        {log.notes && <div className="text-xs text-slate-600 mt-0.5">{log.notes}</div>}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-mono font-semibold text-slate-900">{formatKg(log.quantity)} {log.unit}</div>
                        {canRecord && (
                          <button
                            type="button"
                            onClick={() => handleDeleteLog(log)}
                            aria-label={`Hapus catatan ${log.itemName || categoryLabel(log.wasteCategory)}`}
                            className={`${iconButtonClass} mt-1 text-slate-600 hover:text-rose-700 hover:bg-rose-50`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ))}
        </div>
      </div>

      {/* MODAL: SISA MAKANAN HARIAN */}
      {isDailyModalOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="daily-waste-title">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 id="daily-waste-title" className="text-base font-bold text-slate-900">Catat Sisa Makanan</h3>
                <p className="text-xs text-slate-600 mt-0.5">Hasil timbang sisa makanan per kategori, dalam kg.</p>
              </div>
              <button type="button" onClick={() => setIsDailyModalOpen(false)} aria-label="Tutup" className={`${iconButtonClass} text-slate-500 hover:text-slate-800 hover:bg-slate-100`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDaily} className="flex-1 flex flex-col min-h-0">
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                <label className="block">
                  <span className="block font-semibold text-slate-700 mb-1">Tanggal timbang</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      required
                      value={dailyDate}
                      onChange={e => {
                        const next = e.target.value;
                        setDailyDate(next);
                        // Tanggal yang sudah ada datanya dimuat; angka yang baru diketik untuk tanggal kosong dibiarkan.
                        const nextHasData = wasteLogs.some(l => l.date === next && nutritionKeyOf(l.wasteCategory));
                        if (nextHasData || dailyHasExisting) loadDailyForm(next);
                      }}
                      className={`${inputClass} w-auto`}
                    />
                    <span className="text-sm font-semibold text-slate-800">{dayName(dailyDate)}</span>
                  </div>
                </label>

                {dailyHasExisting && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Tanggal ini sudah ada datanya. Angka di bawah adalah data tersimpan; menyimpan akan menggantinya.</span>
                  </div>
                )}

                <fieldset className="border border-slate-200 rounded-lg">
                  <legend className="sr-only">Berat per kategori</legend>
                  <div className="divide-y divide-slate-100">
                    {NUTRITION.map(n => (
                      <label key={n.key} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="flex items-center gap-2 font-medium text-slate-800 text-sm sm:text-xs">
                          <span className={`w-2 h-2 rounded-full ${n.dot}`} aria-hidden="true" />
                          {n.label}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={dailyValues[n.key]}
                            onChange={e => setDailyValues(v => ({ ...v, [n.key]: e.target.value }))}
                            placeholder="0"
                            className="w-28 px-3 py-2 rounded-lg border border-slate-300 text-right font-mono text-sm sm:text-xs min-h-[44px] sm:min-h-[36px] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          />
                          <span className="text-slate-600 w-5">kg</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 border-t border-slate-200 text-sm font-semibold text-slate-900">
                    <span>Total</span>
                    <span className="font-mono">{formatKg(dailySum)} kg</span>
                  </div>
                </fieldset>

                <div className="border border-slate-200 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSplitOpen(o => !o)}
                    aria-expanded={splitOpen}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left font-medium text-slate-700 min-h-[44px] sm:min-h-[36px] cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <span>Sisa tidak dipilah? Bagi dari total timbangan</span>
                    <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${splitOpen ? 'rotate-90' : ''}`} />
                  </button>
                  {splitOpen && (
                    <div className="px-3 pb-3 space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <label>
                          <span className="block text-slate-600 mb-1">Total timbangan (kg)</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            value={splitTotal}
                            onChange={e => setSplitTotal(e.target.value)}
                            className={`${inputClass} font-mono`}
                          />
                        </label>
                        <label>
                          <span className="block text-slate-600 mb-1">Pola menu</span>
                          <Select className="w-full" value={splitPatternIdx} onChange={e => setSplitPatternIdx(Number(e.target.value))}>
                            {SPLIT_PATTERNS.map((p, idx) => (
                              <option key={p.name} value={idx}>{p.name}</option>
                            ))}
                          </Select>
                        </label>
                      </div>
                      <p className="text-slate-600">
                        {NUTRITION.map(n => `${n.short} ${SPLIT_PATTERNS[splitPatternIdx].shares[n.key]}%`).join(' · ')}.
                        Hasilnya perkiraan dan akan ditandai di catatan.
                      </p>
                      <button
                        type="button"
                        onClick={applySplit}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-emerald-700 text-emerald-800 bg-white hover:bg-emerald-50 min-h-[44px] sm:min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      >
                        Isi 5 kategori dari total ini
                      </button>
                    </div>
                  )}
                </div>
                {splitNote && <p className="text-xs text-slate-600">{splitNote}</p>}

                <label className="block">
                  <span className="block font-semibold text-slate-700 mb-1">Penanganan</span>
                  <Select className="w-full" value={dailyDisposal} onChange={e => setDailyDisposal(e.target.value)}>
                    {DISPOSAL_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                    {!DISPOSAL_OPTIONS.includes(dailyDisposal) && <option value={dailyDisposal}>{dailyDisposal}</option>}
                  </Select>
                </label>

                <label className="block">
                  <span className="block font-semibold text-slate-700 mb-1">Catatan (opsional)</span>
                  <input
                    type="text"
                    value={dailyNotes}
                    onChange={e => setDailyNotes(e.target.value)}
                    placeholder="Contoh: buah melon tidak habis dibagikan"
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDailyModalOpen(false)}
                  className="px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg min-h-[44px] sm:min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white min-h-[44px] sm:min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {dailyHasExisting ? 'Simpan Perubahan' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LIMBAH DAPUR LAIN */}
      {isOtherModalOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="other-waste-title">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h3 id="other-waste-title" className="text-base font-bold text-slate-900">Catat Limbah Dapur Lain</h3>
                <p className="text-xs text-slate-600 mt-0.5">Kupasan, bahan rusak, kemasan, dan limbah selain sisa makanan siswa.</p>
              </div>
              <button type="button" onClick={() => setIsOtherModalOpen(false)} aria-label="Tutup" className={`${iconButtonClass} text-slate-500 hover:text-slate-800 hover:bg-slate-100`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOther} className="flex-1 flex flex-col min-h-0">
              <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs">
                <label className="flex items-center gap-3">
                  <span className="font-semibold text-slate-700">Tanggal</span>
                  <input type="date" required value={otherDate} onChange={e => setOtherDate(e.target.value)} className={`${inputClass} w-auto`} />
                  <span className="text-sm font-semibold text-slate-800">{dayName(otherDate)}</span>
                </label>

                <ol className="space-y-3">
                  {otherRows.map((row, idx) => (
                    <li key={idx} className="border border-slate-200 rounded-lg p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700">Baris {idx + 1}</span>
                        {otherRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setOtherRows(rows => rows.filter((_, i) => i !== idx))}
                            aria-label={`Hapus baris ${idx + 1}`}
                            className={`${iconButtonClass} text-slate-500 hover:text-rose-700 hover:bg-rose-50`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <label>
                          <span className="block text-slate-600 mb-1">Jenis</span>
                          <Select className="w-full" value={row.category} onChange={e => updateOtherRow(idx, { category: e.target.value })}>
                            {OTHER_CATEGORIES.map(c => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </Select>
                        </label>
                        <label>
                          <span className="block text-slate-600 mb-1">Uraian</span>
                          <input
                            type="text"
                            value={row.itemName}
                            onChange={e => updateOtherRow(idx, { itemName: e.target.value })}
                            placeholder="Contoh: kulit telur, bonggol kol"
                            className={inputClass}
                          />
                        </label>
                        <div className="grid grid-cols-[1fr_auto] gap-2">
                          <label>
                            <span className="block text-slate-600 mb-1">Jumlah</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min="0"
                              value={row.quantity}
                              onChange={e => updateOtherRow(idx, { quantity: e.target.value })}
                              className={`${inputClass} font-mono`}
                            />
                          </label>
                          <label>
                            <span className="block text-slate-600 mb-1">Satuan</span>
                            <Select className="w-full" value={row.unit} onChange={e => updateOtherRow(idx, { unit: e.target.value })}>
                              <option value="Kg">Kg</option>
                              <option value="Gram">Gram</option>
                              <option value="Liter">Liter</option>
                              <option value="Pcs">Pcs</option>
                            </Select>
                          </label>
                        </div>
                        <label>
                          <span className="block text-slate-600 mb-1">Penanganan</span>
                          <Select className="w-full" value={row.disposalMethod} onChange={e => updateOtherRow(idx, { disposalMethod: e.target.value })}>
                            {DISPOSAL_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </Select>
                        </label>
                        <label className="sm:col-span-2">
                          <span className="block text-slate-600 mb-1">Catatan (opsional)</span>
                          <input type="text" value={row.notes} onChange={e => updateOtherRow(idx, { notes: e.target.value })} className={inputClass} />
                        </label>
                      </div>
                    </li>
                  ))}
                </ol>

                <button
                  type="button"
                  onClick={() => setOtherRows(rows => [...rows, emptyOtherRow()])}
                  className="inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 min-h-[44px] sm:min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <Plus className="w-4 h-4" />
                  Tambah baris
                </button>
              </div>

              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsOtherModalOpen(false)}
                  className="px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg min-h-[44px] sm:min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white min-h-[44px] sm:min-h-[36px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan {otherRows.length > 1 ? `${otherRows.length} Baris` : ''}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRATINJAU CETAK */}
      {isPrintPreviewOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60" role="dialog" aria-modal="true" aria-labelledby="waste-print-title">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <h3 id="waste-print-title" className="text-sm font-bold text-slate-900">Pratinjau cetak</h3>
                <p className="text-xs text-slate-600 truncate">Periode {activeRange.label}</p>
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
                  className={`${iconButtonClass} text-slate-500 hover:text-slate-800 hover:bg-slate-200/60`}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-3 sm:p-6 overflow-auto bg-slate-100 flex-1">
              <div className="bg-white p-5 sm:p-8 rounded-lg border border-slate-200 min-w-[640px] max-w-4xl mx-auto">
                {renderPrintDocument()}
              </div>
            </div>
          </div>
        </div>
      )}

      <div id="print-waste-rekap" className="hidden print:block">
        {renderPrintDocument()}
      </div>
    </div>
  );
};
