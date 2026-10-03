import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { WasteLog, WasteCategory, DisposalMethod } from '../types/warehouse';
import { exportMultiSheetExcel, exportToExcel } from '../lib/excelExport';
import {
  Trash2,
  Plus,
  Printer,
  Search,
  Filter,
  Leaf,
  CheckCircle2,
  FileSpreadsheet,
  Calculator,
  Layers,
  Calendar,
  CalendarRange,
  Scale,
  X,
  PieChart,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Edit2,
  Table as TableIcon,
  ListFilter,
  Sparkles,
  Info,
  FileText
} from 'lucide-react';
import { SppgLogo } from './SppgLogo';

interface CompositionPreset {
  name: string;
  description: string;
  shares: {
    karbohidrat: number;
    sayur: number;
    proteinNabati: number;
    proteinHewani: number;
    buah: number;
  };
}

const NUTRITION_PRESETS: CompositionPreset[] = [
  {
    name: 'Standar Piring Bergizi SPPG Jeru Tumpang',
    description: 'Nasi 40%, sayur 30%, tempe/tahu 15%, lauk hewani 10%, buah 5%',
    shares: {
      karbohidrat: 40,
      sayur: 30,
      proteinNabati: 15,
      proteinHewani: 10,
      buah: 5,
    },
  },
  {
    name: 'Menu Gado-Gado / Tanpa Nasi',
    description: 'Sayuran dominan 50%, tahu/tempe 25%, lontong/karbo 10%, telur 10%, buah 5%',
    shares: {
      sayur: 50,
      proteinNabati: 25,
      karbohidrat: 10,
      proteinHewani: 10,
      buah: 5,
    },
  },
  {
    name: 'Menu Soto / Sup Ayam Kuah',
    description: 'Nasi/soun 40%, sayur kol/tauge/wortel 35%, ayam suwir 15%, tempe 5%, buah 5%',
    shares: {
      karbohidrat: 40,
      sayur: 35,
      proteinHewani: 15,
      proteinNabati: 5,
      buah: 5,
    },
  },
  {
    name: 'Menu Sarapan / Bubur Ayam',
    description: 'Bubur beras 55%, ayam suwir/telur 15%, sayur seledri/cakwe 15%, kacang 10%, buah 5%',
    shares: {
      karbohidrat: 55,
      sayur: 15,
      proteinHewani: 15,
      proteinNabati: 10,
      buah: 5,
    },
  },
];

// 5 Kategori Gizi Baku Sesuai Spreadsheet User
const NUTRITION_CATEGORIES = [
  'karbohidrat',
  'sayur',
  'protein hewani',
  'protein nabati',
  'buah',
] as const;

type NutritionCategoryType = typeof NUTRITION_CATEGORIES[number];

// Helper format tanggal singkat spreadsheet (e.g. "18-Sep-26")
const formatSheetDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthIdx = parseInt(m, 10) - 1;
    const monthLabel = months[monthIdx] || m;
    const shortYear = y.slice(-2);
    return `${parseInt(d, 10)}-${monthLabel}-${shortYear}`;
  } catch {
    return dateStr;
  }
};

// Helper nama hari bahasa Indonesia (Title Case)
const getIndonesianDay = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(dateStr + 'T00:00:00');
    return days[d.getDay()] || '';
  } catch {
    return '';
  }
};

// Helper format tanggal display ramah pengguna (e.g. "18 Sep 2026")
const formatDisplayDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const monthIdx = parseInt(m, 10) - 1;
    const monthLabel = months[monthIdx] || m;
    return `${parseInt(d, 10)} ${monthLabel} ${y}`;
  } catch {
    return dateStr;
  }
};

interface CategoryMeta {
  label: string;
  badgeClass: string;
  dotClass: string;
}

const getCategoryMeta = (cat: string): CategoryMeta => {
  const c = cat.toLowerCase();
  if (c.includes('karbo')) {
    return {
      label: 'Karbohidrat',
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-200/80',
      dotClass: 'bg-amber-500',
    };
  }
  if (c.includes('sayur')) {
    return {
      label: 'Sayur',
      badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200/80',
      dotClass: 'bg-emerald-500',
    };
  }
  if (c.includes('hewani')) {
    return {
      label: 'Protein Hewani',
      badgeClass: 'bg-rose-50 text-rose-900 border-rose-200/80',
      dotClass: 'bg-rose-500',
    };
  }
  if (c.includes('nabati')) {
    return {
      label: 'Protein Nabati',
      badgeClass: 'bg-purple-50 text-purple-900 border-purple-200/80',
      dotClass: 'bg-purple-500',
    };
  }
  if (c.includes('buah')) {
    return {
      label: 'Buah',
      badgeClass: 'bg-teal-50 text-teal-900 border-teal-200/80',
      dotClass: 'bg-teal-500',
    };
  }
  return {
    label: cat.charAt(0).toUpperCase() + cat.slice(1),
    badgeClass: 'bg-slate-50 text-slate-800 border-slate-200',
    dotClass: 'bg-slate-500',
  };
};

// Helper format angka desimal dengan koma (e.g. 64,16 atau 16,4 atau 0)
const formatNumberId = (val: number): string => {
  if (val === 0) return '0';
  return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export const WasteLogModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>(() => warehouseDb.getWasteLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Active View Tab: 'BOTH' | 'DAILY_SHEET' | 'MATRIX' | 'DETAILED_LOGS'
  const [activeViewTab, setActiveViewTab] = useState<'BOTH' | 'DAILY_SHEET' | 'MATRIX' | 'DETAILED_LOGS'>('BOTH');
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  // Indonesian print date formatted
  const printDate = useMemo(() => {
    return new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  // Periode Filter Types
  const [filterMode, setFilterMode] = useState<'ALL' | 'WEEK' | 'MONTH' | 'CUSTOM' | 'PRESET_SAMPLE'>('WEEK');
  
  // Action Dropdown state
  const [isInputDropdownOpen, setIsInputDropdownOpen] = useState(false);
  const actionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(event.target as Node)) {
        setIsInputDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // States untuk filter waktu
  const [selectedWeekDate, setSelectedWeekDate] = useState<string>('2026-09-21'); // Tanggal acuan minggu
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09'); // YYYY-MM
  const [customStartDate, setCustomStartDate] = useState<string>('2026-09-18');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-09-25');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDisposal, setSelectedDisposal] = useState<string>('ALL');

  // Modals state
  const [isDailyInputModalOpen, setIsDailyInputModalOpen] = useState(false);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);

  // Daily Input Modal State (5-category direct entry)
  const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [dailyKarbo, setDailyKarbo] = useState<number | ''>('');
  const [dailySayur, setDailySayur] = useState<number | ''>('');
  const [dailyHewani, setDailyHewani] = useState<number | ''>('');
  const [dailyNabati, setDailyNabati] = useState<number | ''>('');
  const [dailyBuah, setDailyBuah] = useState<number | ''>('');
  const [dailyDisposal, setDailyDisposal] = useState<DisposalMethod>('Pakan Ternak & Kompos Organik');
  const [dailyNotes, setDailyNotes] = useState<string>('');

  // Calculator expander inside daily modal
  const [showCalcHelper, setShowCalcHelper] = useState(false);
  const [helperTotalWeight, setHelperTotalWeight] = useState<number>(150);
  const [helperPresetIndex, setHelperPresetIndex] = useState<number>(0);

  // Single Form State
  const [formCategory, setFormCategory] = useState<WasteCategory>('Limbah Olahan Dapur');
  const [formItemName, setFormItemName] = useState('');
  const [formQuantity, setFormQuantity] = useState<number>(0);
  const [formUnit, setFormUnit] = useState<'Kg' | 'Liter' | 'Gram' | 'Pcs'>('Kg');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formSourceArea, setFormSourceArea] = useState('Ruang Preparasi Dapur');
  const [formReason, setFormReason] = useState('Sisa trimming dan kupasan bahan sebelum pengolahan');
  const [formDisposal, setFormDisposal] = useState<DisposalMethod>('Pakan Maggot / Ternak');
  const [formNotes, setFormNotes] = useState('');

  // Batch Form State
  const [batchDate, setBatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [batchRows, setBatchRows] = useState<Array<{
    category: WasteCategory;
    itemName: string;
    quantity: number;
    unit: string;
    sourceArea: string;
    disposalMethod: DisposalMethod;
    notes: string;
  }>>([
    {
      category: 'Limbah Olahan Dapur',
      itemName: 'Kupasan & bonggol sayur',
      quantity: 5,
      unit: 'Kg',
      sourceArea: 'Ruang Preparasi Dapur',
      disposalMethod: 'Kompos Organik',
      notes: '',
    },
  ]);

  // Calculator Form State (Dedicated Calculator Modal)
  const [calcDate, setCalcDate] = useState(new Date().toISOString().slice(0, 10));
  const [calcMenuName, setCalcMenuName] = useState('Menu Harian SPPG Jeru Tumpang');
  const [calcTotalWeight, setCalcTotalWeight] = useState<number>(150);
  const [calcDisposal, setCalcDisposal] = useState<DisposalMethod>('Pakan Ternak & Kompos Organik');
  const [activePresetIndex, setActivePresetIndex] = useState<number>(0);
  const [customShares, setCustomShares] = useState({
    karbohidrat: 40,
    sayur: 30,
    proteinNabati: 15,
    proteinHewani: 10,
    buah: 5,
  });

  const refreshLogs = () => {
    setWasteLogs(warehouseDb.getWasteLogs());
  };

  // Helper untuk batas awal dan akhir minggu dari tanggal tertentu (Senin - Minggu)
  const getWeekRange = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      startDate: monday.toISOString().slice(0, 10),
      endDate: sunday.toISOString().slice(0, 10),
    };
  };

  // Navigasi minggu sebelumnya / berikutnya
  const handleShiftWeek = (offsetDays: number) => {
    const d = new Date(selectedWeekDate + 'T00:00:00');
    d.setDate(d.getDate() + offsetDays);
    setSelectedWeekDate(d.toISOString().slice(0, 10));
  };

  // Navigasi bulan sebelumnya / berikutnya
  const handleShiftMonth = (offsetMonths: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + offsetMonths, 1);
    const nextY = d.getFullYear();
    const nextM = String(d.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${nextY}-${nextM}`);
  };

  // Hitung rentang tanggal aktif berdasarkan filterMode
  const activeDateRange = useMemo(() => {
    if (filterMode === 'PRESET_SAMPLE') {
      return {
        startDate: '2026-09-18',
        endDate: '2026-09-25',
        label: 'Periode 18 - 25 Sep 2026',
      };
    }
    if (filterMode === 'WEEK') {
      const { startDate, endDate } = getWeekRange(selectedWeekDate);
      return {
        startDate,
        endDate,
        label: `Minggu (${formatSheetDate(startDate)} s/d ${formatSheetDate(endDate)})`,
      };
    }
    if (filterMode === 'MONTH') {
      const [y, m] = selectedMonth.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      const startDate = `${selectedMonth}-01`;
      const endDate = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      return {
        startDate,
        endDate,
        label: `Bulan ${months[m - 1]} ${y}`,
      };
    }
    if (filterMode === 'CUSTOM') {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        label: `Rentang ${formatSheetDate(customStartDate)} s/d ${formatSheetDate(customEndDate)}`,
      };
    }
    return {
      startDate: '2020-01-01',
      endDate: '2030-12-31',
      label: 'Semua Periode',
    };
  }, [filterMode, selectedWeekDate, selectedMonth, customStartDate, customEndDate]);

  // Filter logs berdasarkan periode dan pencarian
  const filteredLogs = useMemo(() => {
    return wasteLogs.filter(log => {
      // Period filter
      if (filterMode !== 'ALL') {
        if (log.date < activeDateRange.startDate || log.date > activeDateRange.endDate) {
          return false;
        }
      }

      // Category filter
      if (selectedCategory !== 'ALL' && log.wasteCategory !== selectedCategory) {
        return false;
      }

      // Disposal filter
      if (selectedDisposal !== 'ALL' && log.disposalMethod !== selectedDisposal) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          (log.itemName || '').toLowerCase().includes(q) ||
          log.wasteCategory.toLowerCase().includes(q) ||
          (log.reason || '').toLowerCase().includes(q) ||
          (log.sourceArea || '').toLowerCase().includes(q) ||
          (log.day || '').toLowerCase().includes(q) ||
          log.date.includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [wasteLogs, filterMode, activeDateRange, selectedCategory, selectedDisposal, searchQuery]);

  // Distinct dates in ascending order for the current period
  const periodDatesAscending = useMemo(() => {
    const datesSet = new Set<string>();
    filteredLogs.forEach(l => {
      datesSet.add(l.date);
    });
    return Array.from(datesSet).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  }, [filteredLogs]);

  // MATRIX DATA: Data Cross-Tabulation per Jenis Limbah
  const matrixData = useMemo(() => {
    const dateTotals: { [date: string]: number } = {};
    periodDatesAscending.forEach(date => {
      dateTotals[date] = 0;
    });

    // Check if there are other categories in filteredLogs outside NUTRITION_CATEGORIES
    const extraCategories = Array.from(
      new Set(
        filteredLogs
          .map(l => l.wasteCategory)
          .filter(c => !NUTRITION_CATEGORIES.some(nc => c.toLowerCase().includes(nc.toLowerCase())))
      )
    );

    const allCategoriesList: { key: string; label: string; isNutrition: boolean }[] = [
      ...NUTRITION_CATEGORIES.map(nc => ({
        key: nc,
        label:
          nc === 'karbohidrat'
            ? 'Karbohidrat'
            : nc === 'sayur'
            ? 'Sayur'
            : nc === 'protein hewani'
            ? 'Protein Hewani'
            : nc === 'protein nabati'
            ? 'Protein Nabati'
            : nc === 'buah'
            ? 'Buah'
            : nc,
        isNutrition: true,
      })),
      ...extraCategories.map(ec => ({
        key: ec,
        label: ec,
        isNutrition: false,
      })),
    ];

    // Build rows
    const rows = allCategoriesList.map((item, idx) => {
      const dateValues: { [date: string]: number } = {};
      let rowTotal = 0;

      periodDatesAscending.forEach(date => {
        const matchingLogs = filteredLogs.filter(l => {
          if (l.date !== date) return false;
          if (item.isNutrition) {
            return l.wasteCategory.toLowerCase().includes(item.key);
          }
          return l.wasteCategory.toLowerCase() === item.key.toLowerCase();
        });

        const sumKg = matchingLogs.reduce((acc, curr) => {
          const kg = curr.unit === 'Gram' ? curr.quantity / 1000 : curr.quantity;
          return acc + kg;
        }, 0);

        const val = Number(sumKg.toFixed(2));
        dateValues[date] = val;
        rowTotal += sumKg;
        dateTotals[date] = Number(((dateTotals[date] || 0) + sumKg).toFixed(2));
      });

      return {
        no: idx + 1,
        category: item.key,
        displayLabel: item.label,
        dateValues,
        rowTotal: Number(rowTotal.toFixed(2)),
        unit: 'kg',
      };
    });

    // Grand total keseluruhan limbah
    const grandTotal = rows.reduce((acc, r) => acc + r.rowTotal, 0);

    return {
      rows,
      grandTotal: Number(grandTotal.toFixed(2)),
      dates: periodDatesAscending,
      dateTotals,
    };
  }, [filteredLogs, periodDatesAscending]);

  // DAILY BREAKDOWN DATA: Grouped by date
  const dailySheetData = useMemo(() => {
    return periodDatesAscending.map(date => {
      const logsForDate = filteredLogs.filter(l => l.date === date);
      const dayName = logsForDate[0]?.day || getIndonesianDay(date);

      // Kumpulkan 5 kategori zat gizi
      const items = NUTRITION_CATEGORIES.map(cat => {
        const matching = logsForDate.filter(l => l.wasteCategory.toLowerCase().includes(cat));
        const sumKg = matching.reduce((acc, curr) => {
          return acc + (curr.unit === 'Gram' ? curr.quantity / 1000 : curr.quantity);
        }, 0);
        return {
          category: cat,
          quantity: Number(sumKg.toFixed(2)),
          unit: 'kg',
          rawLogs: matching,
        };
      });

      const dayTotal = items.reduce((acc, curr) => acc + curr.quantity, 0);

      return {
        date,
        sheetDate: formatSheetDate(date),
        dayName,
        items,
        dayTotal: Number(dayTotal.toFixed(2)),
      };
    });
  }, [periodDatesAscending, filteredLogs]);

  // Stats KPI Summary
  const stats = useMemo(() => {
    let totalKg = 0;
    let karboKg = 0;
    let sayurKg = 0;
    let nabatiKg = 0;
    let hewaniKg = 0;
    let buahKg = 0;
    let divertedKg = 0;

    filteredLogs.forEach(w => {
      const kg = w.unit === 'Gram' ? w.quantity / 1000 : w.quantity;
      totalKg += kg;

      const cat = w.wasteCategory.toLowerCase();
      if (cat.includes('karbo')) karboKg += kg;
      else if (cat.includes('sayur')) sayurKg += kg;
      else if (cat.includes('nabati')) nabatiKg += kg;
      else if (cat.includes('hewani')) hewaniKg += kg;
      else if (cat.includes('buah')) buahKg += kg;

      if (w.disposalMethod !== 'TPS Terpadu') {
        divertedKg += kg;
      }
    });

    const circularRate = totalKg > 0 ? Math.round((divertedKg / totalKg) * 100) : 0;
    const tpsKg = Math.max(0, totalKg - divertedKg);

    return {
      totalKg: Number(totalKg.toFixed(2)),
      karboKg: Number(karboKg.toFixed(2)),
      sayurKg: Number(sayurKg.toFixed(2)),
      nabatiKg: Number(nabatiKg.toFixed(2)),
      hewaniKg: Number(hewaniKg.toFixed(2)),
      buahKg: Number(buahKg.toFixed(2)),
      divertedKg: Number(divertedKg.toFixed(2)),
      tpsKg: Number(tpsKg.toFixed(2)),
      circularRate,
    };
  }, [filteredLogs]);

  // Printable Waste Sheet matching official SPPG Header standards and dynamic active filters
  const renderPrintableWasteSheet = () => {
    const maxColsPerTable = 10;
    const dateChunks: string[][] = [];
    if (matrixData.dates.length <= maxColsPerTable) {
      dateChunks.push(matrixData.dates);
    } else {
      for (let i = 0; i < matrixData.dates.length; i += maxColsPerTable) {
        dateChunks.push(matrixData.dates.slice(i, i + maxColsPerTable));
      }
    }

    const avgDailyKg =
      matrixData.dates.length > 0 ? Number((stats.totalKg / matrixData.dates.length).toFixed(2)) : 0;

    return (
      <div id="print-waste-rekap" className="bg-white font-sans text-slate-900 w-full text-xs">
        {/* Kop Surat Resmi Standar SPPG */}
        <div className="border-b-2 border-slate-900 pb-4 mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <SppgLogo size="lg" variant="color" showText={false} />
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
                Satuan Pelayanan Pemenuhan Gizi (SPPG Jeru Tumpang)
              </h1>
              <p className="text-xs text-slate-600 font-medium">
                SPPG Jeru Tumpang - Unit Pelayanan Dapur Gizi
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Jl. Pattimura No. 107, Dsn. Krajan, Ds. Jeru, Kec. Tumpang, Kab. Malang
              </p>
            </div>
          </div>

          <div className="text-right text-[11px] text-slate-500 space-y-0.5">
            <div>
              Tanggal Cetak: <span className="font-semibold text-slate-700">{printDate}</span>
            </div>
            <div>
              Operator: <span className="font-semibold text-slate-700">{currentUser.name}</span>
            </div>
          </div>
        </div>

        {/* Judul Dokumen & Identitas Filter Aktif */}
        <div className="text-center my-4">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            LAPORAN REKAPITULASI PENCATATAN & PENGELOLAAN LIMBAH
          </h2>
          <div className="inline-flex flex-wrap items-center justify-center gap-2 mt-2 px-3 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200">
            <span>Filter Periode: {activeDateRange.label}</span>
            {selectedCategory !== 'ALL' && <span>• Kategori: {selectedCategory}</span>}
            {selectedDisposal !== 'ALL' && <span>• Metode: {selectedDisposal}</span>}
            {searchQuery.trim() && <span>• Pencarian: &ldquo;{searchQuery}&rdquo;</span>}
          </div>
        </div>

        {/* Ringkasan Indikator Kunci (KPI Akumulasi) */}
        <div className="grid grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 mb-5">
          <div>
            <span className="text-slate-500 block text-[10px]">Total Akumulasi Limbah</span>
            <span className="font-bold font-mono text-sm text-slate-900">
              {formatNumberId(stats.totalKg)} kg
            </span>
            <span className="block text-[10px] text-slate-400">
              {matrixData.dates.length} hari operasional
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Teralihkan / Sirkular</span>
            <span className="font-bold font-mono text-sm text-emerald-700">
              {formatNumberId(stats.divertedKg)} kg
            </span>
            <span className="block text-[10px] text-emerald-600 font-semibold">
              {stats.circularRate}% (Pakan / Kompos)
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Residu ke TPS Terpadu</span>
            <span className="font-bold font-mono text-sm text-rose-700">
              {formatNumberId(stats.tpsKg)} kg
            </span>
            <span className="block text-[10px] text-slate-400">
              {100 - stats.circularRate}% dari total timbulan
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px]">Rata-rata Timbulan Harian</span>
            <span className="font-bold font-mono text-sm text-slate-900">
              {formatNumberId(avgDailyKg)} kg
            </span>
            <span className="block text-[10px] text-slate-400">
              Per hari penimbangan aktif
            </span>
          </div>
        </div>

        {/* Bagian A: Matriks Rekapitulasi Akumulasi per Kategori Limbah */}
        <div className="mb-6">
          <div className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
            <span>A. Matriks Akumulasi Total per Kategori Limbah</span>
            <span className="text-[11px] font-normal text-slate-500">
              Akumulasi berat & porsi timbulan pada periode aktif
            </span>
          </div>

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                <th className="py-2 px-2.5 border-r border-slate-300 text-center w-10">No</th>
                <th className="py-2 px-3 border-r border-slate-300">Kategori Limbah</th>
                <th className="py-2 px-3 border-r border-slate-300 text-right w-36">Total Akumulasi (kg)</th>
                <th className="py-2 px-3 border-r border-slate-300 text-right w-32">Rata-rata / Hari</th>
                <th className="py-2 px-3 border-r border-slate-300 text-right w-24">Porsi (%)</th>
                <th className="py-2 px-3">Metode Penanganan Utama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {matrixData.rows.map((row, idx) => {
                const meta = getCategoryMeta(row.category);
                const pct =
                  matrixData.grandTotal > 0 ? Math.round((row.rowTotal / matrixData.grandTotal) * 100) : 0;
                const rowAvg =
                  matrixData.dates.length > 0 ? Number((row.rowTotal / matrixData.dates.length).toFixed(2)) : 0;

                const catLogs = filteredLogs.filter(
                  l =>
                    row.category.toLowerCase().includes(l.wasteCategory.toLowerCase()) ||
                    l.wasteCategory.toLowerCase().includes(row.category.toLowerCase())
                );
                const disposalCounts: { [method: string]: number } = {};
                catLogs.forEach(l => {
                  disposalCounts[l.disposalMethod] = (disposalCounts[l.disposalMethod] || 0) + 1;
                });
                const dominantDisposal =
                  Object.entries(disposalCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
                  'Pakan Ternak & Kompos Organik';

                return (
                  <tr key={row.category} className="hover:bg-slate-50">
                    <td className="py-2 px-2.5 border-r border-slate-300 text-center text-slate-500 font-mono">
                      {idx + 1}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-800">
                      {row.displayLabel || meta.label}
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 text-right font-mono font-bold text-slate-900">
                      {formatNumberId(row.rowTotal)} kg
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 text-right font-mono text-slate-600">
                      {formatNumberId(rowAvg)} kg
                    </td>
                    <td className="py-2 px-3 border-r border-slate-300 text-right font-mono text-slate-700">
                      {pct}%
                    </td>
                    <td className="py-2 px-3 text-slate-600">{dominantDisposal}</td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                <td colSpan={2} className="py-2 px-3 border-r border-slate-300 text-right">
                  Total Akumulasi Seluruh Kategori:
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-right font-mono font-bold text-emerald-800">
                  {formatNumberId(matrixData.grandTotal)} kg
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-right font-mono text-slate-800">
                  {formatNumberId(avgDailyKg)} kg
                </td>
                <td className="py-2 px-3 border-r border-slate-300 text-right font-mono">100%</td>
                <td className="py-2 px-3 text-slate-600">
                  Tingkat Sirkularitas: {stats.circularRate}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bagian B: Tabel Matriks Penimbangan Harian (Cross-Tabulation Horizontal) */}
        <div className="mb-6">
          <div className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
            <span>B. Tabel Matriks Penimbangan Harian Sisa Makanan</span>
            <span className="text-[11px] font-normal text-slate-500">
              Rincian horizontal harian (kg) sesuai filter aktif
            </span>
          </div>

          {matrixData.dates.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 border border-slate-200 rounded-lg">
              Tidak ada data penimbangan untuk periode dan filter yang dipilih.
            </div>
          ) : (
            <div className="space-y-4">
              {dateChunks.map((chunkDates, chunkIdx) => {
                const chunkSubtotals: { [cat: string]: number } = {};
                let chunkGrandTotal = 0;

                matrixData.rows.forEach(r => {
                  const sum = chunkDates.reduce((acc, d) => acc + (r.dateValues[d] ?? 0), 0);
                  chunkSubtotals[r.category] = Number(sum.toFixed(2));
                });
                chunkGrandTotal = Number(
                  chunkDates
                    .reduce((acc, d) => acc + (matrixData.dateTotals[d] ?? 0), 0)
                    .toFixed(2)
                );

                return (
                  <div key={chunkIdx} className="overflow-x-auto">
                    {dateChunks.length > 1 && (
                      <div className="text-[11px] font-semibold text-slate-600 mb-1">
                        Bagian {chunkIdx + 1} ({formatSheetDate(chunkDates[0])} s/d{' '}
                        {formatSheetDate(chunkDates[chunkDates.length - 1])})
                      </div>
                    )}
                    <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                          <th className="py-2 px-2 border-r border-slate-300 text-center w-8">No</th>
                          <th className="py-2 px-3 border-r border-slate-300 min-w-[130px]">
                            Kategori Limbah
                          </th>
                          {chunkDates.map(dateStr => (
                            <th
                              key={dateStr}
                              className="py-1.5 px-2 border-r border-slate-300 text-center whitespace-nowrap"
                            >
                              <div className="text-[9px] text-slate-500 font-normal">
                                {getIndonesianDay(dateStr)}
                              </div>
                              <div className="text-[10px] font-bold text-slate-800">
                                {formatSheetDate(dateStr)}
                              </div>
                            </th>
                          ))}
                          <th className="py-2 px-3 text-right border-l border-slate-300 bg-slate-200/60 font-bold min-w-[80px]">
                            {dateChunks.length > 1 ? 'Subtotal (kg)' : 'Total (kg)'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {matrixData.rows.map((row, idx) => {
                          const meta = getCategoryMeta(row.category);
                          const totalForChunk = chunkSubtotals[row.category] ?? 0;

                          return (
                            <tr key={row.category} className="hover:bg-slate-50">
                              <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-500 font-mono">
                                {idx + 1}
                              </td>
                              <td className="py-1.5 px-3 border-r border-slate-300 font-semibold text-slate-800">
                                {row.displayLabel || meta.label}
                              </td>
                              {chunkDates.map(dateStr => {
                                const val = row.dateValues[dateStr] ?? 0;
                                return (
                                  <td
                                    key={dateStr}
                                    className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-slate-800"
                                  >
                                    {val > 0 ? (
                                      formatNumberId(val)
                                    ) : (
                                      <span className="text-slate-300">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="py-1.5 px-3 text-right font-mono font-bold text-slate-900 border-l border-slate-300 bg-slate-50">
                                {formatNumberId(totalForChunk)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                          <td colSpan={2} className="py-2 px-3 border-r border-slate-300 text-right">
                            Total Harian (kg):
                          </td>
                          {chunkDates.map(dateStr => (
                            <td
                              key={dateStr}
                              className="py-2 px-2 border-r border-slate-300 text-right font-mono font-bold text-slate-900"
                            >
                              {formatNumberId(matrixData.dateTotals[dateStr] ?? 0)}
                            </td>
                          ))}
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-800 border-l border-slate-300 bg-emerald-50">
                            {formatNumberId(chunkGrandTotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bagian C: Rincian Penimbangan & Catatan Penanganan per Hari */}
        <div className="mb-6">
          <div className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
            <span>C. Rincian Penimbangan & Catatan Pengelolaan per Hari</span>
            <span className="text-[11px] font-normal text-slate-500">
              Rincian zat gizi & catatan lapangan
            </span>
          </div>

          {dailySheetData.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 border border-slate-200 rounded-lg">
              Tidak ada riwayat harian untuk ditampilkan.
            </div>
          ) : (
            <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                  <th className="py-1.5 px-2 border-r border-slate-300 text-center w-8">No</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-300 w-24">Hari & Tanggal</th>
                  <th className="py-1.5 px-2 border-r border-slate-300 text-right w-16">Karbo (kg)</th>
                  <th className="py-1.5 px-2 border-r border-slate-300 text-right w-16">Sayur (kg)</th>
                  <th className="py-1.5 px-2 border-r border-slate-300 text-right w-16">Hewani (kg)</th>
                  <th className="py-1.5 px-2 border-r border-slate-300 text-right w-16">Nabati (kg)</th>
                  <th className="py-1.5 px-2 border-r border-slate-300 text-right w-16">Buah (kg)</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-300 text-right w-20 font-bold">
                    Total (kg)
                  </th>
                  <th className="py-1.5 px-2.5 border-r border-slate-300 w-36">Metode Pengelolaan</th>
                  <th className="py-1.5 px-2.5">Catatan / Alasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {dailySheetData.map((d, idx) => {
                  const getKg = (cat: string) => {
                    const it = d.items.find(i => i.category.toLowerCase().includes(cat));
                    return it ? it.quantity : 0;
                  };
                  const allLogs = d.items.flatMap(i => i.rawLogs);
                  const disposal = allLogs[0]?.disposalMethod || 'Pakan Ternak & Kompos Organik';
                  const notes =
                    allLogs
                      .map(l => l.reason || l.notes)
                      .filter(Boolean)
                      .join('; ') || 'Sisa makanan konsumsi santri/siswa';

                  return (
                    <tr key={d.date} className="hover:bg-slate-50">
                      <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-500 font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 font-medium text-slate-800">
                        {d.dayName}, {d.sheetDate}
                      </td>
                      <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-slate-700">
                        {formatNumberId(getKg('karbo'))}
                      </td>
                      <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-slate-700">
                        {formatNumberId(getKg('sayur'))}
                      </td>
                      <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-slate-700">
                        {formatNumberId(getKg('hewani'))}
                      </td>
                      <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-slate-700">
                        {formatNumberId(getKg('nabati'))}
                      </td>
                      <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-slate-700">
                        {formatNumberId(getKg('buah'))}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 text-right font-mono font-bold text-slate-900 bg-slate-50">
                        {formatNumberId(d.dayTotal)}
                      </td>
                      <td className="py-1.5 px-2.5 border-r border-slate-300 text-slate-700">
                        {disposal}
                      </td>
                      <td className="py-1.5 px-2.5 text-slate-600 truncate max-w-xs" title={notes}>
                        {notes}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                  <td colSpan={2} className="py-2 px-2.5 border-r border-slate-300 text-right">
                    Total Akumulasi:
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right font-mono">
                    {formatNumberId(stats.karboKg)}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right font-mono">
                    {formatNumberId(stats.sayurKg)}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right font-mono">
                    {formatNumberId(stats.hewaniKg)}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right font-mono">
                    {formatNumberId(stats.nabatiKg)}
                  </td>
                  <td className="py-2 px-2 border-r border-slate-300 text-right font-mono">
                    {formatNumberId(stats.buahKg)}
                  </td>
                  <td className="py-2 px-2.5 border-r border-slate-300 text-right font-mono font-bold text-emerald-800 bg-emerald-50">
                    {formatNumberId(stats.totalKg)}
                  </td>
                  <td colSpan={2} className="py-2 px-2.5 text-slate-500 font-normal">
                    kg (Seluruh Timbulan Periode Aktif)
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Lembar Tanda Tangan Pengesahan (3 Kolom) */}
        <div className="pt-6 border-t border-slate-300 text-xs mt-8 print:mt-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-slate-500">Dibuat Oleh,</div>
              <div className="font-semibold text-slate-800">Petugas Sanitasi & Limbah</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                ({currentUser.name})
              </div>
            </div>

            <div>
              <div className="text-slate-500">Diverifikasi Oleh,</div>
              <div className="font-semibold text-slate-800">Ahli Gizi SPPG</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                (Rina Kartika, S.Gz)
              </div>
            </div>

            <div>
              <div className="text-slate-500">Mengetahui & Menyetujui,</div>
              <div className="font-semibold text-slate-800">Kepala SPPG Jeru Tumpang</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                (Dr. Siti Rahma, M.M)
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Buka Modal Input Harian (bisa pre-fill jika ada tanggal yang dipilih)
  const handleOpenDailyModal = (targetDate?: string) => {
    const dateToUse = targetDate || new Date().toISOString().slice(0, 10);
    setDailyDate(dateToUse);

    // Cari apakah sudah ada data tanggal ini di database
    const existingLogs = wasteLogs.filter(l => l.date === dateToUse);
    const getCatQty = (cat: string) => {
      const found = existingLogs.find(l => l.wasteCategory.toLowerCase().includes(cat));
      return found ? found.quantity : '';
    };

    setDailyKarbo(getCatQty('karbohidrat'));
    setDailySayur(getCatQty('sayur'));
    setDailyHewani(getCatQty('protein hewani'));
    setDailyNabati(getCatQty('protein nabati'));
    setDailyBuah(getCatQty('buah'));
    setDailyNotes('');
    setShowCalcHelper(false);
    setIsDailyInputModalOpen(true);
  };

  // Terapkan hasil kalkulator pembantu ke form modal input harian
  const handleApplyHelperToDailyForm = () => {
    if (helperTotalWeight <= 0) return;
    const preset = NUTRITION_PRESETS[helperPresetIndex];
    const shares = preset.shares;

    setDailyKarbo(Number(((shares.karbohidrat / 100) * helperTotalWeight).toFixed(2)));
    setDailySayur(Number(((shares.sayur / 100) * helperTotalWeight).toFixed(2)));
    setDailyNabati(Number(((shares.proteinNabati / 100) * helperTotalWeight).toFixed(2)));
    setDailyHewani(Number(((shares.proteinHewani / 100) * helperTotalWeight).toFixed(2)));
    setDailyBuah(Number(((shares.buah / 100) * helperTotalWeight).toFixed(2)));
    setShowCalcHelper(false);
  };

  // Simpan Input Rekap Harian (5 Kategori)
  const handleSaveDailyNutrition = (e: React.FormEvent) => {
    e.preventDefault();

    const karboVal = Number(dailyKarbo) || 0;
    const sayurVal = Number(dailySayur) || 0;
    const hewaniVal = Number(dailyHewani) || 0;
    const nabatiVal = Number(dailyNabati) || 0;
    const buahVal = Number(dailyBuah) || 0;

    const dayName = getIndonesianDay(dailyDate);

    const itemsToSave: {
      category: NutritionCategoryType;
      quantity: number;
      unit: string;
      disposalMethod: DisposalMethod;
      notes?: string;
    }[] = [
      { category: 'karbohidrat', quantity: karboVal, unit: 'Kg', disposalMethod: dailyDisposal, notes: dailyNotes },
      { category: 'sayur', quantity: sayurVal, unit: 'Kg', disposalMethod: dailyDisposal, notes: dailyNotes },
      { category: 'protein hewani', quantity: hewaniVal, unit: 'Kg', disposalMethod: dailyDisposal, notes: dailyNotes },
      { category: 'protein nabati', quantity: nabatiVal, unit: 'Kg', disposalMethod: dailyDisposal, notes: dailyNotes },
      { category: 'buah', quantity: buahVal, unit: 'Kg', disposalMethod: dailyDisposal, notes: dailyNotes },
    ];

    warehouseDb.saveDailyNutritionLog(dailyDate, dayName, itemsToSave, currentUser);
    refreshLogs();
    setIsDailyInputModalOpen(false);

    const sumDaily = karboVal + sayurVal + hewaniVal + nabatiVal + buahVal;
    setSuccessNotice(`Berhasil menyimpan rekap limbah ${formatSheetDate(dailyDate)} (${dayName}): total ${formatNumberId(sumDaily)} kg.`);
    setTimeout(() => setSuccessNotice(''), 6000);
  };

  // Hapus seluruh limbah pada satu tanggal
  const handleDeleteDailyGroup = (date: string, dayName: string) => {
    if (window.confirm(`Hapus seluruh catatan rekap limbah untuk hari ${dayName}, tanggal ${formatSheetDate(date)}?`)) {
      warehouseDb.deleteDailyWasteLogs(date, currentUser);
      refreshLogs();
      setSuccessNotice(`Catatan limbah tanggal ${formatSheetDate(date)} telah dihapus.`);
      setTimeout(() => setSuccessNotice(''), 5000);
    }
  };

  // Simpan Batch Baru Manual
  const handleSaveBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = batchRows.filter(r => r.itemName.trim() && r.quantity > 0);
    if (validRows.length === 0) {
      alert('Minimal harus ada satu baris limbah dengan nama dan kuantitas valid.');
      return;
    }

    const dayName = getIndonesianDay(batchDate);
    const entriesToSave = validRows.map(r => ({
      day: dayName,
      date: batchDate,
      wasteCategory: r.category,
      itemName: r.itemName.trim(),
      quantity: Number(r.quantity),
      unit: r.unit,
      sourceArea: r.sourceArea.trim(),
      reason: 'Pencatatan batch limbah',
      disposalMethod: r.disposalMethod,
      recordedBy: currentUser.name,
      notes: r.notes.trim() || undefined,
    }));

    warehouseDb.recordWasteBatch(entriesToSave, currentUser);
    refreshLogs();
    setIsBatchModalOpen(false);
    setSuccessNotice(`Berhasil mencatat ${validRows.length} butir batch limbah untuk tanggal ${batchDate}!`);
    setTimeout(() => setSuccessNotice(''), 6000);
  };

  // Simpan Single Record
  const handleRecordWaste = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formItemName.trim() || formQuantity <= 0) {
      alert('Nama bahan/limbah dan bobot wajib diisi.');
      return;
    }

    const dayName = getIndonesianDay(formDate);
    warehouseDb.recordWasteLog(
      {
        day: dayName,
        date: formDate,
        wasteCategory: formCategory,
        itemName: formItemName.trim(),
        quantity: formQuantity,
        unit: formUnit,
        sourceArea: formSourceArea.trim(),
        reason: formReason.trim(),
        disposalMethod: formDisposal,
        recordedBy: currentUser.name,
        notes: formNotes.trim() || undefined,
      },
      currentUser
    );

    refreshLogs();
    setIsSingleModalOpen(false);
    setFormItemName('');
    setFormQuantity(0);
    setFormNotes('');
    setSuccessNotice(`Berhasil mencatat log limbah: ${formItemName} (${formQuantity} ${formUnit}).`);
    setTimeout(() => setSuccessNotice(''), 5000);
  };

  // Handle Delete Single Record
  const handleDeleteRecord = (id: string, name: string) => {
    if (window.confirm(`Hapus catatan limbah "${name}"?`)) {
      warehouseDb.deleteWasteLog(id, currentUser);
      refreshLogs();
    }
  };

  // Ekspor Excel Multi-Sheet (Format Rekap Harian + Format Matriks Total Hitung)
  const handleExportExcelAll = () => {
    // 1. Data Sheet 1: Rekap Harian (Format Image 1)
    const dailySheetRows: Record<string, any>[] = [];
    dailySheetData.forEach(dayGroup => {
      dayGroup.items.forEach((item, idx) => {
        dailySheetRows.push({
          'hari': idx === 0 ? dayGroup.dayName : '',
          'tanggal': idx === 0 ? dayGroup.sheetDate : '',
          'jenis limbah': item.category,
          'jumlah': item.quantity,
          'satuan': item.unit,
        });
      });
      // Baris Subtotal per Hari
      dailySheetRows.push({
        'hari': 'total',
        'tanggal': '',
        'jenis limbah': '',
        'jumlah': dayGroup.dayTotal,
        'satuan': 'kg',
      });
      // Spacing row
      dailySheetRows.push({
        'hari': '',
        'tanggal': '',
        'jenis limbah': '',
        'jumlah': '',
        'satuan': '',
      });
    });

    // 2. Data Sheet 2: Matriks Total Hitung Limbah (Format Image 2)
    const matrixSheetRows: Record<string, any>[] = matrixData.rows.map(r => {
      const rowObj: Record<string, any> = {
        'no': r.no,
        'limbah': r.category,
      };
      matrixData.dates.forEach(d => {
        rowObj[formatSheetDate(d)] = r.dateValues[d] ?? 0;
      });
      rowObj['total'] = r.rowTotal;
      rowObj['satuan'] = r.unit;
      return rowObj;
    });

    // Baris Grand Total pada Matriks
    const grandTotalRow: Record<string, any> = {
      'no': '',
      'limbah': 'total keseluruhan limbah :',
    };
    matrixData.dates.forEach(d => {
      grandTotalRow[formatSheetDate(d)] = '';
    });
    grandTotalRow['total'] = matrixData.grandTotal;
    grandTotalRow['satuan'] = 'kg';
    matrixSheetRows.push(grandTotalRow);

    // 3. Data Sheet 3: Riwayat Detail Log
    const detailedLogsSheet = filteredLogs.map((log, idx) => ({
      'No': idx + 1,
      'Hari': log.day || getIndonesianDay(log.date),
      'Tanggal': log.date,
      'Kategori': log.wasteCategory,
      'Nama Item / Uraian': log.itemName || '-',
      'Jumlah': log.quantity,
      'Satuan': log.unit,
      'Jalur Penanganan': log.disposalMethod,
      'Area Asal': log.sourceArea || '-',
      'PIC': log.recordedBy || '-',
      'Catatan': log.notes || '-',
    }));

    exportMultiSheetExcel(
      [
        { sheetName: 'Rekap Harian', data: dailySheetRows },
        { sheetName: 'Total Hitung Limbah', data: matrixSheetRows },
        { sheetName: 'Detail Log', data: detailedLogsSheet },
      ],
      `Rekap_Limbah_SPPG_Jeru_Tumpang_${filterMode}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="space-y-5">
      {/* Stylesheet khusus untuk print agar rapi & hanya mencetak lembar rekap */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-waste-rekap, #print-waste-rekap * {
            visibility: visible;
          }
          #print-waste-rekap {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 15px !important;
            margin: 0 !important;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Konten Dashboard Utama (Disembunyikan saat mencetak) */}
      <div className="no-print space-y-5">
        {/* Alert Notice */}
        {successNotice && (
          <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Header Utama */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 bg-white p-5 rounded-2xl border shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Rekapitulasi & Buku Catatan Limbah
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Input rekap harian sisa makanan dan penarikan total limbah per minggu atau per bulan.
            </p>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 shrink-0" ref={actionDropdownRef}>
            {/* Split Button: Primary Input Rekap + Dropdown for Tools */}
            <div className="relative inline-flex rounded-xl shadow-2xs">
              <button
                type="button"
                onClick={() => handleOpenDailyModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-l-xl bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer"
                title="Input rekap harian sisa makanan (5 Kategori)"
              >
                <Plus className="w-4 h-4" />
                <span>Input Rekap Harian</span>
              </button>

              <button
                type="button"
                onClick={() => setIsInputDropdownOpen(!isInputDropdownOpen)}
                className="inline-flex items-center px-2 py-2 text-xs font-bold rounded-r-xl bg-emerald-800 hover:bg-emerald-900 text-white border-l border-emerald-600/40 transition-colors cursor-pointer"
                title="Pilihan input & alat bantu lainnya"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isInputDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu Input & Tools */}
              {isInputDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 border-b border-slate-100">
                    Pilihan Input & Alat
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsInputDropdownOpen(false);
                      handleOpenDailyModal();
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <Plus className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Input Rekap Harian</div>
                      <div className="text-[10px] text-slate-500">5 kategori sisa makanan per hari</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsInputDropdownOpen(false);
                      setIsCalcModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <Calculator className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Kalkulator Piring</div>
                      <div className="text-[10px] text-slate-500">Hitung proporsi sisa per piring</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsInputDropdownOpen(false);
                      setIsBatchModalOpen(true);
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-teal-50/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                      <Layers className="w-4 h-4 text-teal-700" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Batch Non-Gizi</div>
                      <div className="text-[10px] text-slate-500">Pencatatan limbah khusus non-porsi</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Cetak PDF */}
            <button
              type="button"
              onClick={() => setIsPrintPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Cetak PDF</span>
            </button>

          {/* Ekspor Excel */}
          <button
            type="button"
            onClick={handleExportExcelAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* FILTER PERIODE (PER MINGGU / PER BULAN / KUSTOM) */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Tombol Mode Periode */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CalendarRange className="w-4 h-4 text-emerald-600" />
              Periode Filter:
            </span>

            {/* Period Pills */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('WEEK');
                  if (!selectedWeekDate) setSelectedWeekDate('2026-09-21');
                }}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  filterMode === 'WEEK' || filterMode === 'PRESET_SAMPLE'
                    ? 'bg-white text-emerald-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mingguan
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilterMode('MONTH');
                  if (!selectedMonth) setSelectedMonth('2026-09');
                }}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  filterMode === 'MONTH'
                    ? 'bg-white text-blue-800 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulanan
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('CUSTOM')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  filterMode === 'CUSTOM'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rentang Kustom
              </button>

              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  filterMode === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Data
              </button>
            </div>
          </div>

          {/* Sub-Controls: Navigasi Minggu, Bulan, atau Rentang Tanggal */}
          <div className="flex flex-wrap items-center gap-2">
            {(filterMode === 'WEEK' || filterMode === 'PRESET_SAMPLE') && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (filterMode === 'PRESET_SAMPLE') setFilterMode('WEEK');
                    handleShiftWeek(-7);
                  }}
                  className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                  title="Minggu Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-slate-500 font-medium">Minggu:</span>
                  <input
                    type="date"
                    value={selectedWeekDate}
                    onChange={e => {
                      setSelectedWeekDate(e.target.value);
                      if (filterMode === 'PRESET_SAMPLE') setFilterMode('WEEK');
                    }}
                    className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (filterMode === 'PRESET_SAMPLE') setFilterMode('WEEK');
                    handleShiftWeek(7);
                  }}
                  className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                  title="Minggu Berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {filterMode === 'MONTH' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleShiftMonth(-1)}
                  className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                  title="Bulan Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-slate-500 font-medium">Pilih Bulan:</span>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleShiftMonth(1)}
                  className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                  title="Bulan Berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {filterMode === 'CUSTOM' && (
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="text-slate-500 font-medium">Dari:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                  />
                </div>
                <span className="text-slate-400 font-medium">s/d</span>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="text-slate-500 font-medium">Sampai:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Row Status Periode Terpilih & Pencarian */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Periode Aktif:</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
              {activeDateRange.label}
            </span>
            <span className="text-slate-400 text-[11px]">({matrixData.dates.length} hari penimbangan tercatat)</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari hari, tanggal, kategori..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 w-60 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* KPI SUMMARY CARDS */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Akumulasi Periode */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-white shadow-2xs">
            <div className="text-[11px] font-medium text-slate-300">Total Limbah Periode</div>
            <div className="text-xl font-bold mt-1 text-white tabular-nums">
              {formatNumberId(stats.totalKg)} <span className="text-xs font-normal text-slate-300">kg</span>
            </div>
            <div className="text-[10px] text-emerald-300 mt-0.5 font-semibold">
              {stats.circularRate}% daur ulang/pakan
            </div>
          </div>

          {/* Karbohidrat */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-amber-900">Total Karbohidrat</div>
            <div className="text-xl font-bold text-amber-800 mt-1 tabular-nums">
              {formatNumberId(stats.karboKg)} <span className="text-xs font-normal text-amber-700">kg</span>
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">
              {stats.totalKg > 0 ? ((stats.karboKg / stats.totalKg) * 100).toFixed(1) : 0}% dari total
            </div>
          </div>

          {/* Sayuran */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-emerald-900">Total Sayuran</div>
            <div className="text-xl font-bold text-emerald-800 mt-1 tabular-nums">
              {formatNumberId(stats.sayurKg)} <span className="text-xs font-normal text-emerald-700">kg</span>
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5">
              {stats.totalKg > 0 ? ((stats.sayurKg / stats.totalKg) * 100).toFixed(1) : 0}% dari total
            </div>
          </div>

          {/* Protein Hewani */}
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-rose-900">Protein Hewani</div>
            <div className="text-xl font-bold text-rose-800 mt-1 tabular-nums">
              {formatNumberId(stats.hewaniKg)} <span className="text-xs font-normal text-rose-700">kg</span>
            </div>
            <div className="text-[10px] text-rose-700 mt-0.5">
              {stats.totalKg > 0 ? ((stats.hewaniKg / stats.totalKg) * 100).toFixed(1) : 0}% dari total
            </div>
          </div>

          {/* Protein Nabati */}
          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-sky-900">Protein Nabati</div>
            <div className="text-xl font-bold text-sky-800 mt-1 tabular-nums">
              {formatNumberId(stats.nabatiKg)} <span className="text-xs font-normal text-sky-700">kg</span>
            </div>
            <div className="text-[10px] text-sky-700 mt-0.5">
              {stats.totalKg > 0 ? ((stats.nabatiKg / stats.totalKg) * 100).toFixed(1) : 0}% dari total
            </div>
          </div>

          {/* Buah-buahan */}
          <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-purple-900">Total Buah</div>
            <div className="text-xl font-bold text-purple-800 mt-1 tabular-nums">
              {formatNumberId(stats.buahKg)} <span className="text-xs font-normal text-purple-700">kg</span>
            </div>
            <div className="text-[10px] text-purple-700 mt-0.5">
              {stats.totalKg > 0 ? ((stats.buahKg / stats.totalKg) * 100).toFixed(1) : 0}% dari total
            </div>
          </div>
        </div>
      </div>

      {/* VIEW SWITCHER TABS */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveViewTab('BOTH')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeViewTab === 'BOTH'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Semua Rekapitulasi
        </button>

        <button
          type="button"
          onClick={() => setActiveViewTab('DAILY_SHEET')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeViewTab === 'DAILY_SHEET'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Rekap Harian
        </button>

        <button
          type="button"
          onClick={() => setActiveViewTab('MATRIX')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeViewTab === 'MATRIX'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Matriks Akumulasi
        </button>

        <button
          type="button"
          onClick={() => setActiveViewTab('DETAILED_LOGS')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            activeViewTab === 'DETAILED_LOGS'
              ? 'bg-white text-slate-900 shadow-2xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
          }`}
        >
          Riwayat Rinci Log
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAMPILAN TABEL 1: REKAP LIMBAH HARIAN SPPG (PERSIS GAMBAR 1)              */}
      {/* ========================================================================= */}
      {(activeViewTab === 'BOTH' || activeViewTab === 'DAILY_SHEET') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100 bg-white">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Rekap Limbah SPPG Harian</span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/70">
                  {dailySheetData.length} Hari Tercatat
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Periode {matrixData.dates.length > 0 ? `${formatSheetDate(matrixData.dates[0])} - ${formatSheetDate(matrixData.dates[matrixData.dates.length - 1])}` : activeDateRange.label}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenDailyModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Catat Hari Baru</span>
              </button>
            </div>
          </div>

          {dailySheetData.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Leaf className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              Tidak ada data limbah harian pada periode ini. Klik <strong>Input Rekap Harian</strong> untuk menambahkan data.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4 w-44 text-left">Hari & Tanggal</th>
                    <th className="py-3 px-4 text-left">Kategori Limbah</th>
                    <th className="py-3 px-4 w-36 text-right">Jumlah Sisa</th>
                    <th className="py-3 px-4 w-24 text-center">Satuan</th>
                    <th className="py-3 px-4 w-28 text-center no-print">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailySheetData.map(dayGroup => (
                    <React.Fragment key={dayGroup.date}>
                      {dayGroup.items.map((item, idx) => {
                        const meta = getCategoryMeta(item.category);
                        const isFirst = idx === 0;

                        return (
                          <tr
                            key={`${dayGroup.date}-${item.category}`}
                            className="hover:bg-slate-50/70 transition-colors"
                          >
                            {/* Hari & Tanggal (Rowspan 6 = 5 kategori + 1 subtotal) */}
                            {isFirst && (
                              <td
                                rowSpan={6}
                                className="py-3.5 px-4 bg-slate-50/60 border-r border-slate-100 align-top"
                              >
                                <div className="space-y-1.5 sticky top-12">
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100/70 text-emerald-900 font-bold text-xs">
                                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>{dayGroup.dayName}</span>
                                  </div>
                                  <div className="text-xs font-semibold text-slate-800 pl-0.5">
                                    {formatDisplayDate(dayGroup.date)}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono pl-0.5">
                                    {formatSheetDate(dayGroup.date)}
                                  </div>
                                </div>
                              </td>
                            )}

                            {/* Jenis / Kategori Limbah */}
                            <td className="py-2.5 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${meta.badgeClass}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                                <span>{meta.label}</span>
                              </span>
                            </td>

                            {/* Jumlah */}
                            <td className="py-2.5 px-4 text-right">
                              <span
                                className={`font-mono text-xs tabular-nums ${
                                  item.quantity > 0 ? 'font-bold text-slate-900' : 'text-slate-400 font-normal'
                                }`}
                              >
                                {formatNumberId(item.quantity)}
                              </span>
                            </td>

                            {/* Satuan */}
                            <td className="py-2.5 px-4 text-center">
                              <span className="text-xs text-slate-500 font-medium">
                                {item.unit}
                              </span>
                            </td>

                            {/* Aksi (Rowspan 6 = 5 kategori + 1 subtotal) */}
                            {isFirst && (
                              <td
                                rowSpan={6}
                                className="py-3.5 px-3 border-l border-slate-100 text-center align-middle bg-slate-50/30 no-print"
                              >
                                <div className="flex flex-col items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDailyModal(dayGroup.date)}
                                    className="inline-flex items-center justify-center gap-1.5 w-20 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                                    title="Edit data hari ini"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDailyGroup(dayGroup.date, dayGroup.dayName)}
                                    className="inline-flex items-center justify-center gap-1.5 w-20 px-2.5 py-1 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                                    title="Hapus data hari ini"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* Baris Total Harian */}
                      <tr className="bg-slate-50/80 border-t border-slate-200/80 border-b-2 border-slate-200">
                        <td className="py-2.5 px-4 font-semibold text-slate-700">
                          Total Limbah {dayGroup.dayName}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-800 text-sm tabular-nums">
                          {formatNumberId(dayGroup.dayTotal)}
                        </td>
                        <td className="py-2.5 px-4 text-center font-bold text-emerald-800 text-xs">
                          kg
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN TABEL 2: TOTAL HITUNG LIMBAH MATRIKS (PERSIS GAMBAR 2)           */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TAMPILAN TABEL 2: MATRIKS AKUMULASI LIMBAH HARIAN                         */}
      {/* ========================================================================= */}
      {(activeViewTab === 'BOTH' || activeViewTab === 'MATRIX') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          {/* Header Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100 bg-white">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Matriks Akumulasi Limbah Harian</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Rekapitulasi sisa makanan horizontal per tanggal dalam periode aktif ({activeDateRange.label})
              </p>
            </div>

            <div className="text-xs text-slate-600 font-semibold flex items-center gap-2">
              <span className="text-slate-500">Grand Total:</span>
              <span className="font-mono font-bold text-sm text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                {formatNumberId(matrixData.grandTotal)} kg
              </span>
            </div>
          </div>

          {matrixData.dates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Leaf className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              Belum ada data penimbangan untuk ditampilkan dalam matriks.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-3 w-12 text-center">No</th>
                    <th className="py-3 px-4 w-48 sticky left-0 bg-slate-50 z-10 shadow-xs">Kategori Limbah</th>
                    {matrixData.dates.map(dateStr => (
                      <th
                        key={dateStr}
                        className="py-2.5 px-3 text-center whitespace-nowrap min-w-[90px] border-r border-slate-100/80"
                      >
                        <div className="text-[10px] text-slate-400 font-medium">{getIndonesianDay(dateStr)}</div>
                        <div className="text-xs font-semibold text-slate-700">{formatSheetDate(dateStr)}</div>
                      </th>
                    ))}
                    <th className="py-3 px-4 w-32 text-right font-bold text-slate-800 bg-slate-100/70 border-l border-slate-200">
                      Total
                    </th>
                    <th className="py-3 px-3 w-20 text-center font-semibold text-slate-600">
                      Satuan
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {matrixData.rows.map(row => {
                    const meta = getCategoryMeta(row.category);
                    return (
                      <tr
                        key={row.category}
                        className="hover:bg-slate-50/70 transition-colors group"
                      >
                        <td className="py-3 px-3 text-center font-mono text-slate-400 text-xs">
                          {row.no}
                        </td>
                        <td className="py-3 px-4 sticky left-0 bg-white group-hover:bg-slate-50 transition-colors z-10 shadow-xs">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${meta.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                            <span>{meta.label}</span>
                          </span>
                        </td>
                        {matrixData.dates.map(dateStr => {
                          const val = row.dateValues[dateStr] ?? 0;
                          return (
                            <td
                              key={dateStr}
                              className="py-3 px-3 text-right font-mono text-xs tabular-nums border-r border-slate-50"
                            >
                              <span className={val > 0 ? 'font-semibold text-slate-900' : 'text-slate-300 font-normal'}>
                                {formatNumberId(val)}
                              </span>
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-800 text-xs tabular-nums bg-emerald-50/40 border-l border-slate-100">
                          {formatNumberId(row.rowTotal)}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-500 font-medium text-xs">
                          {row.unit}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {/* Summary Footer Row */}
                  <tr className="bg-slate-50/95 border-t-2 border-slate-200 font-bold">
                    <td
                      colSpan={2}
                      className="py-3.5 px-4 text-left text-slate-800 font-bold text-xs sticky left-0 bg-slate-50 z-10 shadow-xs"
                    >
                      <div className="flex items-center gap-1.5">
                        <TableIcon className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Total Harian:</span>
                      </div>
                    </td>
                    {matrixData.dates.map(dateStr => (
                      <td
                        key={dateStr}
                        className="py-3.5 px-3 text-right font-mono font-bold text-slate-900 text-xs tabular-nums border-r border-slate-200/60"
                      >
                        {formatNumberId(matrixData.dateTotals[dateStr] ?? 0)}
                      </td>
                    ))}
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-emerald-700 text-sm tabular-nums bg-emerald-50/70 border-l border-slate-200">
                      {formatNumberId(matrixData.grandTotal)}
                    </td>
                    <td className="py-3.5 px-3 text-center text-emerald-800 font-bold text-xs">
                      kg
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN TABEL 3: DETAIL RIWAYAT LOG OPERASIONAL                          */}
      {/* ========================================================================= */}
      {activeViewTab === 'DETAILED_LOGS' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-slate-100 bg-white">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Riwayat Rinci Log Limbah Operasional</span>
                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  {filteredLogs.length} Data
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Pencatatan detail mencakup jalur penanganan, pic penginput, dan catatan insiden limbah.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsSingleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 text-white cursor-pointer hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Catat Tunggal</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">No</th>
                  <th className="py-3 px-3 w-32">Tanggal</th>
                  <th className="py-3 px-3 w-36">Kategori</th>
                  <th className="py-3 px-3">Uraian / Keterangan</th>
                  <th className="py-3 px-3 w-28 text-right">Bobot</th>
                  <th className="py-3 px-3 w-40">Jalur Penanganan</th>
                  <th className="py-3 px-3 w-36">PIC</th>
                  <th className="py-3 px-3 w-12 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((log, idx) => {
                  const meta = getCategoryMeta(log.wasteCategory);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {formatSheetDate(log.date)} ({log.day || getIndonesianDay(log.date)})
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${meta.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                          <span>{meta.label}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{log.itemName || '-'}</div>
                        {log.notes && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">{log.notes}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {log.quantity} {log.unit}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 text-[11px]">
                        {log.disposalMethod}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {log.recordedBy || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(log.id, log.itemName || log.wasteCategory)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer rounded"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL UTAMA: INPUT REKAP LIMBAH HARIAN (5 KATEGORI LANGSUNG)             */}
      {/* ========================================================================= */}
      {isDailyInputModalOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <TableIcon className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Input Rekap Limbah Harian (5 Kategori)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Masukkan hasil penimbangan sisa makanan harian SPPG Jeru Tumpang
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDailyInputModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDailyNutrition} className="space-y-4 text-xs">
              {/* Tanggal & Hari */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Tanggal Penimbangan
                  </label>
                  <input
                    type="date"
                    required
                    value={dailyDate}
                    onChange={e => {
                      const newDate = e.target.value;
                      setDailyDate(newDate);
                      // Jika sudah ada data tanggal ini di database, auto load nilainya
                      const existing = wasteLogs.filter(l => l.date === newDate);
                      const getCat = (c: string) => {
                        const f = existing.find(l => l.wasteCategory.toLowerCase().includes(c));
                        return f ? f.quantity : '';
                      };
                      if (existing.length > 0) {
                        setDailyKarbo(getCat('karbohidrat'));
                        setDailySayur(getCat('sayur'));
                        setDailyHewani(getCat('protein hewani'));
                        setDailyNabati(getCat('protein nabati'));
                        setDailyBuah(getCat('buah'));
                      }
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 bg-white"
                  />
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-500">Hari Terpilih:</div>
                  <div className="text-sm font-bold text-emerald-800 capitalize">
                    {getIndonesianDay(dailyDate) || '-'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {formatSheetDate(dailyDate)}
                  </div>
                </div>
              </div>

              {/* Bantuan Kalkulator Persentase (Bisa Dibuka/Tutup) */}
              <div className="border border-emerald-200 rounded-xl bg-emerald-50/50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    Bantuan Hitung Otomatis dari Total Bobot (Opsional)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowCalcHelper(!showCalcHelper)}
                    className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    {showCalcHelper ? 'Tutup Bantuan' : 'Gunakan Bantuan'}
                  </button>
                </div>

                {showCalcHelper && (
                  <div className="pt-2 border-t border-emerald-200/60 space-y-2.5 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-emerald-900 font-semibold mb-0.5">
                          Total Timbangan (kg)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={helperTotalWeight || ''}
                          onChange={e => setHelperTotalWeight(parseFloat(e.target.value) || 0)}
                          placeholder="Misal: 161.3"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-white font-mono font-bold text-emerald-950"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-emerald-900 font-semibold mb-0.5">
                          Preset Menu
                        </label>
                        <select
                          value={helperPresetIndex}
                          onChange={e => setHelperPresetIndex(Number(e.target.value))}
                          className="w-full px-2 py-1.5 rounded-lg border border-emerald-300 bg-white text-slate-800 text-[11px]"
                        >
                          {NUTRITION_PRESETS.map((p, idx) => (
                            <option key={idx} value={idx}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleApplyHelperToDailyForm}
                      className="w-full py-1.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
                    >
                      Terapkan Pembagian ke 5 Kolom di Bawah
                    </button>
                  </div>
                )}
              </div>

              {/* 5 Input Nilai Kategori Limbah */}
              <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-white">
                <div className="text-[11px] font-bold text-slate-700 pb-1 border-b border-slate-100 flex items-center justify-between">
                  <span>Isi Bobot Limbah (kg) Sesuai Spreadsheet:</span>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    Subtotal: {(
                      (Number(dailyKarbo) || 0) +
                      (Number(dailySayur) || 0) +
                      (Number(dailyHewani) || 0) +
                      (Number(dailyNabati) || 0) +
                      (Number(dailyBuah) || 0)
                    ).toFixed(2)} kg
                  </span>
                </div>

                {/* 1. Karbohidrat */}
                <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg hover:bg-amber-50/50">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                    <span>Karbohidrat</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dailyKarbo}
                      onChange={e => setDailyKarbo(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-28 text-right font-mono font-bold text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
                    />
                    <span className="text-slate-500 font-medium w-6">kg</span>
                  </div>
                </div>

                {/* 2. Sayur */}
                <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg hover:bg-emerald-50/50">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Sayur</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dailySayur}
                      onChange={e => setDailySayur(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-28 text-right font-mono font-bold text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
                    />
                    <span className="text-slate-500 font-medium w-6">kg</span>
                  </div>
                </div>

                {/* 3. Protein Hewani */}
                <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg hover:bg-rose-50/50">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                    <span>Protein Hewani</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dailyHewani}
                      onChange={e => setDailyHewani(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-28 text-right font-mono font-bold text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
                    />
                    <span className="text-slate-500 font-medium w-6">kg</span>
                  </div>
                </div>

                {/* 4. Protein Nabati */}
                <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg hover:bg-purple-50/50">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                    <span>Protein Nabati</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dailyNabati}
                      onChange={e => setDailyNabati(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-28 text-right font-mono font-bold text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
                    />
                    <span className="text-slate-500 font-medium w-6">kg</span>
                  </div>
                </div>

                {/* 5. Buah */}
                <div className="flex items-center justify-between gap-3 p-1.5 rounded-lg hover:bg-teal-50/50">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block"></span>
                    <span>Buah</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dailyBuah}
                      onChange={e => setDailyBuah(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      placeholder="0.00"
                      className="w-28 text-right font-mono font-bold text-xs border border-slate-300 rounded-lg p-1.5 bg-white"
                    />
                    <span className="text-slate-500 font-medium w-6">kg</span>
                  </div>
                </div>
              </div>

              {/* Jalur Penanganan Limbah */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Jalur Penanganan Sisa Makanan
                </label>
                <select
                  value={dailyDisposal}
                  onChange={e => setDailyDisposal(e.target.value as DisposalMethod)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800"
                >
                  <option value="Pakan Ternak & Kompos Organik">Pakan Ternak & Kompos Organik (Rekomendasi SPPG)</option>
                  <option value="Pakan Maggot / Ternak">Pakan Maggot / Ternak</option>
                  <option value="Kompos Organik">Kompos Organik SPPG</option>
                  <option value="TPS Terpadu">TPS Terpadu</option>
                </select>
              </div>

              {/* Catatan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={dailyNotes}
                  onChange={e => setDailyNotes(e.target.value)}
                  placeholder="Misal: Sisa buah melon tidak terdistribusi, kuah soto..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsDailyInputModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Rekap Harian</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: KALKULATOR KOMPOSISI PIRING BERGIZI                              */}
      {/* ========================================================================= */}
      {isCalcModalOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Kalkulator Komposisi Sisa Piring SPPG Jeru Tumpang
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Hitung proporsi gizi sisa makanan piring siswa berdasarkan total timbangan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCalcModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={calcDate}
                    onChange={e => setCalcDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Menu</label>
                  <input
                    type="text"
                    value={calcMenuName}
                    onChange={e => setCalcMenuName(e.target.value)}
                    placeholder="Contoh: Menu Gado-Gado / Nasi Soto Ayam"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Total Weight */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <label className="block text-xs font-bold text-emerald-950 mb-1">
                  Total Timbangan Sisa Piring Siswa (kg)
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={calcTotalWeight || ''}
                    onChange={e => setCalcTotalWeight(parseFloat(e.target.value) || 0)}
                    placeholder="Contoh: 157.3"
                    className="w-48 px-3.5 py-2 text-lg font-bold font-mono rounded-lg border border-emerald-300 bg-white text-emerald-900"
                  />
                  <span className="text-sm font-bold text-emerald-800">Kilogram (kg)</span>
                </div>
              </div>

              {/* Presets */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  Pilih Preset Menu Sesuai Masakan:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {NUTRITION_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setActivePresetIndex(idx);
                        setCustomShares({ ...preset.shares });
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        activePresetIndex === idx
                          ? 'border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-800">{preset.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hasil Kalkulasi Live */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-xs text-slate-800">
                  Hasil Estimasi Bobot Tiap Zat Gizi:
                </div>
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="block text-[11px] font-bold text-amber-800">Karbohidrat</span>
                    <span className="text-[10px] text-slate-500">{customShares.karbohidrat}%</span>
                    <span className="block text-xs font-mono font-bold text-amber-700 mt-1">
                      {((customShares.karbohidrat / 100) * calcTotalWeight).toFixed(2)} kg
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="block text-[11px] font-bold text-emerald-800">Sayur</span>
                    <span className="text-[10px] text-slate-500">{customShares.sayur}%</span>
                    <span className="block text-xs font-mono font-bold text-emerald-700 mt-1">
                      {((customShares.sayur / 100) * calcTotalWeight).toFixed(2)} kg
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="block text-[11px] font-bold text-rose-800">Prot. Hewani</span>
                    <span className="text-[10px] text-slate-500">{customShares.proteinHewani}%</span>
                    <span className="block text-xs font-mono font-bold text-rose-700 mt-1">
                      {((customShares.proteinHewani / 100) * calcTotalWeight).toFixed(2)} kg
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="block text-[11px] font-bold text-sky-800">Prot. Nabati</span>
                    <span className="text-[10px] text-slate-500">{customShares.proteinNabati}%</span>
                    <span className="block text-xs font-mono font-bold text-sky-700 mt-1">
                      {((customShares.proteinNabati / 100) * calcTotalWeight).toFixed(2)} kg
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-slate-200">
                    <span className="block text-[11px] font-bold text-purple-800">Buah</span>
                    <span className="text-[10px] text-slate-500">{customShares.buah}%</span>
                    <span className="block text-xs font-mono font-bold text-purple-700 mt-1">
                      {((customShares.buah / 100) * calcTotalWeight).toFixed(2)} kg
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCalcModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Simpan hasil hitungan ke database
                    const dayName = getIndonesianDay(calcDate);
                    const itemsToSave: {
                      category: NutritionCategoryType;
                      quantity: number;
                      unit: string;
                      disposalMethod: DisposalMethod;
                      notes?: string;
                    }[] = [
                      {
                        category: 'karbohidrat',
                        quantity: Number(((customShares.karbohidrat / 100) * calcTotalWeight).toFixed(2)),
                        unit: 'Kg',
                        disposalMethod: calcDisposal,
                        notes: `Hitungan otomatis menu ${calcMenuName}`,
                      },
                      {
                        category: 'sayur',
                        quantity: Number(((customShares.sayur / 100) * calcTotalWeight).toFixed(2)),
                        unit: 'Kg',
                        disposalMethod: calcDisposal,
                        notes: `Hitungan otomatis menu ${calcMenuName}`,
                      },
                      {
                        category: 'protein hewani',
                        quantity: Number(((customShares.proteinHewani / 100) * calcTotalWeight).toFixed(2)),
                        unit: 'Kg',
                        disposalMethod: calcDisposal,
                        notes: `Hitungan otomatis menu ${calcMenuName}`,
                      },
                      {
                        category: 'protein nabati',
                        quantity: Number(((customShares.proteinNabati / 100) * calcTotalWeight).toFixed(2)),
                        unit: 'Kg',
                        disposalMethod: calcDisposal,
                        notes: `Hitungan otomatis menu ${calcMenuName}`,
                      },
                      {
                        category: 'buah',
                        quantity: Number(((customShares.buah / 100) * calcTotalWeight).toFixed(2)),
                        unit: 'Kg',
                        disposalMethod: calcDisposal,
                        notes: `Hitungan otomatis menu ${calcMenuName}`,
                      },
                    ];

                    warehouseDb.saveDailyNutritionLog(calcDate, dayName, itemsToSave, currentUser);
                    refreshLogs();
                    setIsCalcModalOpen(false);
                    setSuccessNotice(`Berhasil menyimpan 5 rincian limbah hasil hitungan (${calcTotalWeight} kg) untuk tanggal ${formatSheetDate(calcDate)}!`);
                    setTimeout(() => setSuccessNotice(''), 6000);
                  }}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Hasil ke Rekap Harian</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: INPUT BATCH NON-GIZI                                            */}
      {/* ========================================================================= */}
      {isBatchModalOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                  <Layers className="w-5 h-5 text-teal-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Input Batch Limbah Non-Gizi / Preparasi Dapur
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Catat limbah preparasi, kupasan, kemasan, atau bahan rusak
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="flex-1 flex flex-col min-h-0 text-xs">
              <div className="flex items-center gap-3 mb-3 shrink-0">
                <label className="font-semibold text-slate-700">Tanggal Penimbangan:</label>
                <input
                  type="date"
                  value={batchDate}
                  onChange={e => setBatchDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800"
                />
              </div>

              <div className="border border-slate-200 rounded-xl overflow-y-auto flex-1 mb-4">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5 w-8">No</th>
                      <th className="py-2 px-2.5 w-40">Kategori</th>
                      <th className="py-2 px-2.5">Nama Bahan / Uraian</th>
                      <th className="py-2 px-2.5 w-24">Bobot</th>
                      <th className="py-2 px-2.5 w-20">Satuan</th>
                      <th className="py-2 px-2.5 w-40">Jalur Penanganan</th>
                      <th className="py-2 px-2.5 w-8 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-2.5 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-2 px-2.5">
                          <select
                            value={row.category}
                            onChange={e => {
                              const updated = [...batchRows];
                              updated[idx].category = e.target.value as WasteCategory;
                              setBatchRows(updated);
                            }}
                            className="w-full p-1 rounded border border-slate-200 bg-white"
                          >
                            <option value="Limbah Olahan Dapur">Limbah Dapur (Kupasan)</option>
                            <option value="Bahan Rusak / Kadaluarsa">Bahan Rusak</option>
                            <option value="Kemasan & Non-Organik">Kemasan</option>
                            <option value="Sisa Makanan Distribusi">Sisa Makanan</option>
                          </select>
                        </td>
                        <td className="py-2 px-2.5">
                          <input
                            type="text"
                            required
                            placeholder="Misal: Kulit telur, bonggol kol"
                            value={row.itemName}
                            onChange={e => {
                              const updated = [...batchRows];
                              updated[idx].itemName = e.target.value;
                              setBatchRows(updated);
                            }}
                            className="w-full p-1 rounded border border-slate-200"
                          />
                        </td>
                        <td className="py-2 px-2.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={row.quantity || ''}
                            onChange={e => {
                              const updated = [...batchRows];
                              updated[idx].quantity = parseFloat(e.target.value) || 0;
                              setBatchRows(updated);
                            }}
                            className="w-full p-1 font-mono font-bold rounded border border-slate-200"
                          />
                        </td>
                        <td className="py-2 px-2.5">
                          <select
                            value={row.unit}
                            onChange={e => {
                              const updated = [...batchRows];
                              updated[idx].unit = e.target.value;
                              setBatchRows(updated);
                            }}
                            className="w-full p-1 rounded border border-slate-200 bg-white"
                          >
                            <option value="Kg">Kg</option>
                            <option value="Gram">Gram</option>
                            <option value="Pcs">Pcs</option>
                          </select>
                        </td>
                        <td className="py-2 px-2.5">
                          <select
                            value={row.disposalMethod}
                            onChange={e => {
                              const updated = [...batchRows];
                              updated[idx].disposalMethod = e.target.value as DisposalMethod;
                              setBatchRows(updated);
                            }}
                            className="w-full p-1 rounded border border-slate-200 bg-white text-[11px]"
                          >
                            <option value="Kompos Organik">Kompos Organik</option>
                            <option value="Pakan Maggot / Ternak">Pakan Maggot/Ternak</option>
                            <option value="Bank Sampah / Daur Ulang">Daur Ulang</option>
                            <option value="TPS Terpadu">TPS Terpadu</option>
                          </select>
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <button
                            type="button"
                            disabled={batchRows.length === 1}
                            onClick={() => {
                              const updated = batchRows.filter((_, rIdx) => rIdx !== idx);
                              setBatchRows(updated);
                            }}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30 cursor-pointer p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between shrink-0 mb-4">
                <button
                  type="button"
                  onClick={() =>
                    setBatchRows([
                      ...batchRows,
                      {
                        category: 'Limbah Olahan Dapur',
                        itemName: '',
                        quantity: 1,
                        unit: 'Kg',
                        sourceArea: 'Ruang Preparasi Dapur',
                        disposalMethod: 'Kompos Organik',
                        notes: '',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Baris Limbah
                </button>

                <div className="font-mono text-xs font-bold text-slate-800">
                  Total Batch: {batchRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0).toFixed(2)} Kg
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-teal-700 hover:bg-teal-800 text-white shadow-xs cursor-pointer"
                >
                  Simpan Semua Baris Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PENCATATAN TUNGGAL                                              */}
      {/* ========================================================================= */}
      {isSingleModalOpen && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h4 className="text-sm font-bold text-slate-900">
                Pencatatan Insiden Limbah Tunggal
              </h4>
              <button
                type="button"
                onClick={() => setIsSingleModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordWaste} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori Limbah</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as WasteCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800"
                  >
                    <option value="Limbah Olahan Dapur">Limbah Olahan Dapur</option>
                    <option value="Sisa Makanan Distribusi">Sisa Makanan Distribusi</option>
                    <option value="Bahan Rusak / Kadaluarsa">Bahan Rusak / Kadaluarsa</option>
                    <option value="Kemasan & Non-Organik">Kemasan & Non-Organik</option>
                    <option value="karbohidrat">Karbohidrat</option>
                    <option value="sayur">Sayuran</option>
                    <option value="protein nabati">Protein Nabati</option>
                    <option value="protein hewani">Protein Hewani</option>
                    <option value="buah">Buah</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Bahan / Jenis Limbah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formItemName}
                  onChange={e => setFormItemName(e.target.value)}
                  placeholder="Misal: Trimming sayur bayam layu, kulit telur, sisa nasi..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Bobot / Volume <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formQuantity || ''}
                    onChange={e => setFormQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 font-mono font-bold rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <select
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800"
                  >
                    <option value="Kg">Kilogram (Kg)</option>
                    <option value="Gram">Gram</option>
                    <option value="Pcs">Pcs</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Area Asal</label>
                  <input
                    type="text"
                    value={formSourceArea}
                    onChange={e => setFormSourceArea(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jalur Penanganan</label>
                  <select
                    value={formDisposal}
                    onChange={e => setFormDisposal(e.target.value as DisposalMethod)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800"
                  >
                    <option value="Pakan Ternak & Kompos Organik">Pakan Ternak & Kompos Organik</option>
                    <option value="Pakan Maggot / Ternak">Pakan Maggot / Ternak</option>
                    <option value="Kompos Organik">Kompos Organik</option>
                    <option value="Bank Sampah / Daur Ulang">Bank Sampah / Daur Ulang</option>
                    <option value="TPS Terpadu">TPS Terpadu</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan / Alasan</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  placeholder="Catatan penanganan atau kondisi bahan..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs cursor-pointer"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL PRATINJAU CETAK RESMI SPPG (PRINT PREVIEW)                          */}
      {/* ========================================================================= */}
      {isPrintPreviewOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header Controls */}
            <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Printer className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Pratinjau Cetak Laporan Rekapitulasi Limbah
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Format dokumen resmi SPPG • Mengikuti filter aktif ({activeDateRange.label})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak / Simpan PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-base font-bold p-1.5 rounded-lg hover:bg-slate-200/60 cursor-pointer"
                  title="Tutup Pratinjau"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Preview Body */}
            <div className="p-6 sm:p-8 overflow-y-auto bg-slate-100 flex-1">
              <div className="bg-white p-6 sm:p-8 rounded-xl shadow-xs border border-slate-200 max-w-4xl mx-auto">
                {renderPrintableWasteSheet()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Target Render untuk Print Langsung Browser */}
      <div className="hidden print:block">
        {renderPrintableWasteSheet()}
      </div>
    </div>
  );
};
