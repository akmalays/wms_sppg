import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  MainItemCategory,
  normalizeItemCategory,
  NonFoodExpense,
  InventoryTransaction
} from '../types/warehouse';
import { Calendar, Printer, Search, TrendingDown, Clock, CheckCircle2, FileSpreadsheet, Trash2, CalendarRange, DollarSign, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { exportToExcel } from '../lib/excelExport';
import { SppgLogo } from './SppgLogo';

type PeriodType = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

// Realistic price map for SPPG goods
const DEFAULT_PRICE_MAP: Record<string, number> = {
  // Bahan Kering
  beras: 14500,
  minyak: 18000,
  gula: 17500,
  tepung: 11000,
  garam: 4000,
  kecap: 22000,
  saus: 18000,
  bawang: 35000,
  bumbu: 25000,

  // Bahan Basah
  ayam: 38000,
  daging: 120000,
  telur: 28000,
  bayam: 8000,
  kangkung: 7000,
  wortel: 12000,
  labu: 9000,
  pisang: 16000,
  semangka: 8500,
  pepaya: 7500,
  tahu: 10000,
  tempe: 10000,
  susu: 15000,
  ikan: 35000,

  // Bahan Peralatan
  kresek: 15000,
  trashbag: 32000,
  plastik: 14000,
  sunlight: 85000,
  natura: 95000,
  oixs: 38000,
  tissue: 12000,
  spons: 4500,
  sabut: 6000,
  lap: 8000,
  kanebo: 15000,
  masker: 25000,
  'sarung tangan': 12000,
  'nurse cap': 30000,
  sabun: 18000,
  gayung: 12000,
  cikrak: 18000,
  obat: 8000,
};

function getItemEstimatedUnitPrice(itemName: string, category: string, existingPrice?: number): number {
  if (existingPrice && existingPrice > 0) return existingPrice;
  const nameLower = (itemName || '').toLowerCase();

  for (const [key, price] of Object.entries(DEFAULT_PRICE_MAP)) {
    if (nameLower.includes(key)) {
      return price;
    }
  }

  const norm = normalizeItemCategory(category);
  if (norm === 'Bahan Basah') return 30000;
  if (norm === 'Bahan Kering') return 15000;
  if (norm === 'Bahan Peralatan') return 20000;
  return 15000;
}

function parseNumericQty(qty: string | number): number {
  if (typeof qty === 'number') return qty;
  const match = String(qty).replace(',', '.').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 1;
}

function parseExpenseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.toLowerCase().trim();

  // If ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.slice(0, 10).split('-');
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const monthMap: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3,
    mei: 4, jun: 5, jul: 6, agu: 7, ags: 7,
    sep: 8, okt: 9, nov: 10, des: 11,
  };

  const match = clean.match(/(\d{1,2})\s+([a-z]{3,4})\s+(\d{4})/i);
  if (match) {
    const day = Number(match[1]);
    const monthKey = match[2].slice(0, 3).toLowerCase();
    const month = monthMap[monthKey] !== undefined ? monthMap[monthKey] : 8;
    const year = Number(match[3]);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export const DailyExpensesModule: React.FC = () => {
  const { currentUser } = useAuth();

  // ----------------------------------------------------
  // Period & Filter States
  // ----------------------------------------------------
  const [periodType, setPeriodType] = useState<PeriodType>('WEEKLY');
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Range for Weekly / Custom (Default to last 7 days)
  const defaultWeekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  }, []);
  const [startDate, setStartDate] = useState<string>(defaultWeekStart);
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Selected Month (YYYY-MM)
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7)
  );

  // Category filter: 3 categories
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'ALL' | MainItemCategory>('ALL');

  // Search & Views
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'SUMMARY' | 'TRANSACTIONS' | 'PRINT_VIEW'>('SUMMARY');
  const [successNotice, setSuccessNotice] = useState<string>('');

  // Data sources
  const items = useMemo(() => warehouseDb.getItems(), [successNotice]);
  const transactions = useMemo(() => warehouseDb.getTransactions(), [successNotice]);
  const manualExpenses = useMemo(() => warehouseDb.getNonFoodExpenses(), [successNotice]);

  // Normalized unified expenses
  interface UnifiedExpense {
    id: string;
    source: 'MANUAL' | 'KITCHEN';
    rawDate: string;
    parsedDate: Date | null;
    time: string;
    itemName: string;
    category: MainItemCategory;
    quantity: string | number;
    numericQty: number;
    unit: string;
    unitPrice: number;
    nominal: number;
    recipientOrVolunteer: string;
    picOrUser: string;
    notes?: string;
    referenceNo?: string;
  }

  const allExpenses = useMemo<UnifiedExpense[]>(() => {
    const list: UnifiedExpense[] = [];

    // 1. Manual logs (nonFoodExpenses)
    manualExpenses.forEach(exp => {
      const pDate = parseExpenseDate(exp.date);
      const cat = normalizeItemCategory(exp.category);
      const nQty = parseNumericQty(exp.quantity);
      const price = getItemEstimatedUnitPrice(exp.itemName, cat, exp.unitPrice);
      const nominal = exp.totalCost && exp.totalCost > 0 ? exp.totalCost : nQty * price;

      list.push({
        id: exp.id,
        source: 'MANUAL',
        rawDate: exp.date,
        parsedDate: pDate,
        time: exp.time || '12.00',
        itemName: exp.itemName,
        category: cat,
        quantity: exp.quantity,
        numericQty: nQty,
        unit: exp.unit || 'Pack',
        unitPrice: price,
        nominal: nominal,
        recipientOrVolunteer: exp.volunteer || exp.recipient || '-',
        picOrUser: exp.pic || exp.recordedBy || currentUser.name,
        notes: exp.notes,
      });
    });

    // 2. Kitchen stock issues
    transactions
      .filter(tx => tx.transactionType === 'ISSUE_CONSUMPTION')
      .forEach(tx => {
        const rawD = tx.timestamp.slice(0, 10);
        const pDate = parseExpenseDate(rawD);
        const cat = normalizeItemCategory(tx.category);
        const nQty = Math.abs(tx.quantity);
        const price = getItemEstimatedUnitPrice(tx.itemName, cat);
        const nominal = nQty * price;

        list.push({
          id: tx.id,
          source: 'KITCHEN',
          rawDate: rawD,
          parsedDate: pDate,
          time: tx.timestamp.slice(11, 16).replace(':', '.'),
          itemName: tx.itemName,
          category: cat,
          quantity: nQty,
          numericQty: nQty,
          unit: tx.unit,
          unitPrice: price,
          nominal: nominal,
          recipientOrVolunteer: tx.location || 'Dapur Pengolahan SPPG Jeru Tumpang',
          picOrUser: tx.userName,
          notes: tx.notes,
          referenceNo: tx.referenceDocument || tx.id,
        });
      });

    return list.sort((a, b) => {
      const timeA = a.parsedDate ? a.parsedDate.getTime() : 0;
      const timeB = b.parsedDate ? b.parsedDate.getTime() : 0;
      return timeB - timeA;
    });
  }, [manualExpenses, transactions, currentUser.name]);

  const formatFriendlyDate = (dateStr: string) => {
    const d = parseExpenseDate(dateStr);
    if (!d) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  // Effective Date Range based on periodType
  const effectiveDateRange = useMemo(() => {
    if (periodType === 'DAILY') {
      const target = parseExpenseDate(selectedDailyDate);
      return { start: target, end: target, label: `Harian (${formatFriendlyDate(selectedDailyDate)})` };
    }

    if (periodType === 'WEEKLY') {
      const s = parseExpenseDate(startDate);
      const e = parseExpenseDate(endDate);
      return { start: s, end: e, label: `Mingguan (${formatFriendlyDate(startDate)} s/d ${formatFriendlyDate(endDate)})` };
    }

    if (periodType === 'MONTHLY') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      return {
        start: startOfMonth,
        end: endOfMonth,
        label: `Bulan ${monthNames[month - 1] || ''} ${year}`,
      };
    }

    // CUSTOM
    const s = parseExpenseDate(startDate);
    const e = parseExpenseDate(endDate);
    return { start: s, end: e, label: `Periode ${formatFriendlyDate(startDate)} s/d ${formatFriendlyDate(endDate)}` };
  }, [periodType, selectedDailyDate, startDate, endDate, selectedMonth]);

  const printDate = useMemo(() => {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }, []);

  // Filtered expenses based on Period, Category, and Search
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter(item => {
      // 1. Category Filter
      if (selectedCategoryTab !== 'ALL' && item.category !== selectedCategoryTab) {
        return false;
      }

      // 2. Date Range Filter
      if (item.parsedDate && effectiveDateRange.start && effectiveDateRange.end) {
        const itemTime = new Date(item.parsedDate.getFullYear(), item.parsedDate.getMonth(), item.parsedDate.getDate()).getTime();
        const startTime = new Date(effectiveDateRange.start.getFullYear(), effectiveDateRange.start.getMonth(), effectiveDateRange.start.getDate()).getTime();
        const endTime = new Date(effectiveDateRange.end.getFullYear(), effectiveDateRange.end.getMonth(), effectiveDateRange.end.getDate()).getTime();

        if (itemTime < startTime || itemTime > endTime) {
          return false;
        }
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          item.itemName.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q) ||
          item.recipientOrVolunteer.toLowerCase().includes(q) ||
          item.picOrUser.toLowerCase().includes(q) ||
          (item.notes && item.notes.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [allExpenses, selectedCategoryTab, effectiveDateRange, searchQuery]);

  // ==========================================
  // PERIOD BREAKDOWN BY 3 CATEGORIES & ITEMS
  // ==========================================
  interface CategoryItemAgg {
    itemName: string;
    unit: string;
    totalQty: number;
    unitPrice: number;
    totalNominal: number;
    countOccurrences: number;
    percentageOfCategory: number;
  }

  interface CategorySummary {
    category: MainItemCategory;
    totalNominal: number;
    totalItemsCount: number;
    items: CategoryItemAgg[];
  }

  const categoryBreakdowns = useMemo<Record<MainItemCategory, CategorySummary>>(() => {
    const summary: Record<MainItemCategory, CategorySummary> = {
      'Bahan Basah': { category: 'Bahan Basah', totalNominal: 0, totalItemsCount: 0, items: [] },
      'Bahan Kering': { category: 'Bahan Kering', totalNominal: 0, totalItemsCount: 0, items: [] },
      'Bahan Peralatan': { category: 'Bahan Peralatan', totalNominal: 0, totalItemsCount: 0, items: [] },
    };

    const itemMaps: Record<MainItemCategory, Record<string, CategoryItemAgg>> = {
      'Bahan Basah': {},
      'Bahan Kering': {},
      'Bahan Peralatan': {},
    };

    filteredExpenses.forEach(exp => {
      const cat = exp.category;
      if (!summary[cat]) return;

      summary[cat].totalNominal += exp.nominal;
      summary[cat].totalItemsCount += 1;

      const normName = exp.itemName.trim();
      if (!itemMaps[cat][normName]) {
        itemMaps[cat][normName] = {
          itemName: normName,
          unit: exp.unit,
          totalQty: 0,
          unitPrice: exp.unitPrice,
          totalNominal: 0,
          countOccurrences: 0,
          percentageOfCategory: 0,
        };
      }

      itemMaps[cat][normName].totalQty += exp.numericQty;
      itemMaps[cat][normName].totalNominal += exp.nominal;
      itemMaps[cat][normName].countOccurrences += 1;
    });

    // Convert map to sorted array & calculate percentage
    (['Bahan Basah', 'Bahan Kering', 'Bahan Peralatan'] as MainItemCategory[]).forEach(cat => {
      const arr = Object.values(itemMaps[cat]).sort((a, b) => b.totalNominal - a.totalNominal);
      const catTotal = summary[cat].totalNominal;

      arr.forEach(item => {
        item.percentageOfCategory = catTotal > 0 ? Math.round((item.totalNominal / catTotal) * 100) : 0;
      });

      summary[cat].items = arr;
    });

    return summary;
  }, [filteredExpenses]);

  // Overall totals in the active filter
  const grandTotalNominal = useMemo(() => {
    return (
      categoryBreakdowns['Bahan Basah'].totalNominal +
      categoryBreakdowns['Bahan Kering'].totalNominal +
      categoryBreakdowns['Bahan Peralatan'].totalNominal
    );
  }, [categoryBreakdowns]);

  // Quick weekly helpers
  const handleSetThisWeek = () => {
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
    setPeriodType('WEEKLY');
  };

  const handleSetLastWeek = () => {
    const end = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
    setPeriodType('WEEKLY');
  };

  const handleDeleteManual = (id: string, name: string) => {
    if (window.confirm(`Hapus catatan pengeluaran "${name}"?`)) {
      warehouseDb.deleteNonFoodExpense(id, currentUser);
      setSuccessNotice(`Catatan "${name}" berhasil dihapus.`);
      setTimeout(() => setSuccessNotice(''), 4000);
    }
  };

  // Export to Excel with full category breakdown & nominals
  const handleExportExcel = () => {
    if (filteredExpenses.length === 0) {
      alert('Tidak ada data untuk diekspor pada filter periode ini.');
      return;
    }

    // Sheet 1: Detailed transactions with nominals
    const transactionRows = filteredExpenses.map((item, idx) => ({
      'No': idx + 1,
      'Tanggal': item.rawDate,
      'Jam': item.time,
      'Kategori': item.category,
      'Nama Barang': item.itemName,
      'Jumlah': item.quantity,
      'Satuan': item.unit,
      'Harga Satuan (Rp)': item.unitPrice,
      'Total Nominal (Rp)': item.nominal,
      'Relawan / Pengambil': item.recipientOrVolunteer,
      'PIC Petugas': item.picOrUser,
      'Keterangan': item.notes || '-',
    }));

    // Sheet 2: Category itemized summary
    const summaryRows: any[] = [];
    (['Bahan Basah', 'Bahan Kering', 'Bahan Peralatan'] as MainItemCategory[]).forEach(cat => {
      categoryBreakdowns[cat].items.forEach(item => {
        summaryRows.push({
          'Kategori': cat,
          'Nama Barang': item.itemName,
          'Total Volume Keluar': `${item.totalQty} ${item.unit}`,
          'Harga Satuan (Rp)': item.unitPrice,
          'Total Nominal (Rp)': item.totalNominal,
          '% Terhadap Kategori': `${item.percentageOfCategory}%`,
        });
      });
    });

    exportToExcel(
      summaryRows.length > 0 ? summaryRows : transactionRows,
      `Rekap_Pengeluaran_SPPG_Jeru_Tumpang_${periodType}_${selectedCategoryTab}.xlsx`,
      'Rekap Pengeluaran & Biaya'
    );
  };

  const handlePrint = () => {
    setActiveSubTab('PRINT_VIEW');
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-5">
      {/* Print-specific style injected into head */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm 12mm;
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-size: 10pt;
          }
          nav, header, footer, .no-print {
            display: none !important;
          }
          #print-expenses-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: transparent !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>

      {/* Alert Notice */}
      {successNotice && (
        <div className="no-print flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 bg-white p-5 rounded-2xl border shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Laporan & Rekap Pengeluaran
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Monitoring data pengeluaran dan nominal biaya per minggu, bulan, serta rincian per kategori barang.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 shadow-2xs transition-colors cursor-pointer"
            title="Unduh rekap pengeluaran dan rincian biaya sebagai Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Excel</span>
          </button>

          {/* Print PDF */}
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* Filter Control Box: Period (Minggu, Bulan, Hari) & Categories */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3.5">
        {/* Row 1: Period Mode Selector & Date Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CalendarRange className="w-4 h-4 text-emerald-600" />
              Periode Filter:
            </span>

            {/* Period Pills */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                onClick={() => setPeriodType('DAILY')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'DAILY' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Harian
              </button>

              <button
                onClick={handleSetThisWeek}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'WEEKLY' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mingguan
              </button>

              <button
                onClick={() => setPeriodType('MONTHLY')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'MONTHLY' ? 'bg-white text-blue-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulanan
              </button>

              <button
                onClick={() => setPeriodType('CUSTOM')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'CUSTOM' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rentang Kustom
              </button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="flex flex-wrap items-center gap-2">
            {periodType === 'DAILY' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <span className="text-slate-500 font-medium">Tanggal:</span>
                <input
                  type="date"
                  value={selectedDailyDate}
                  onChange={e => setSelectedDailyDate(e.target.value)}
                  className="font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {(periodType === 'WEEKLY' || periodType === 'CUSTOM') && (
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="text-slate-500 font-medium">Dari:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                  />
                </div>
                <span className="text-slate-400 font-medium">s/d</span>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="text-slate-500 font-medium">Sampai:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                  />
                </div>

                {periodType === 'WEEKLY' && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleSetThisWeek}
                      className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
                    >
                      Minggu Ini
                    </button>
                    <button
                      type="button"
                      onClick={handleSetLastWeek}
                      className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
                    >
                      Minggu Lalu
                    </button>
                  </div>
                )}
              </div>
            )}

            {periodType === 'MONTHLY' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <span className="text-slate-500 font-medium">Pilih Bulan:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>

        {/* Row 2: 3 Category Tabs & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Category Tabs: Exactly 3 categories */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedCategoryTab('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedCategoryTab === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Semua Kategori ({allExpenses.length})
            </button>

            <button
              onClick={() => setSelectedCategoryTab('Bahan Basah')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedCategoryTab === 'Bahan Basah'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              Bahan Basah ({categoryBreakdowns['Bahan Basah'].totalItemsCount})
            </button>

            <button
              onClick={() => setSelectedCategoryTab('Bahan Kering')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedCategoryTab === 'Bahan Kering'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-800 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              Bahan Kering ({categoryBreakdowns['Bahan Kering'].totalItemsCount})
            </button>

            <button
              onClick={() => setSelectedCategoryTab('Bahan Peralatan')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                selectedCategoryTab === 'Bahan Peralatan'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-blue-800 hover:bg-blue-50 border border-blue-200'
              }`}
            >
              Bahan Peralatan ({categoryBreakdowns['Bahan Peralatan'].totalItemsCount})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari barang, relawan, PIC..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
            />
          </div>
        </div>
      </div>


      {/* ========================================================================= */}
      {/* SUMMARY NOMINAL CARDS: TOTAL & 3 KATEGORI (SESUAI PERMINTAAN USER) */}
      {/* ========================================================================= */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Pengeluaran Periode */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="text-[11px] font-medium text-slate-500">
            Total Pengeluaran Periode ({effectiveDateRange.label})
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">
            Rp {grandTotalNominal.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {filteredExpenses.length} catatan pengeluaran
          </div>
        </div>

        {/* Card 2: Bahan Basah */}
        <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-2xs bg-gradient-to-b from-white to-emerald-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-800">Bahan Basah</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              {grandTotalNominal > 0 ? Math.round((categoryBreakdowns['Bahan Basah'].totalNominal / grandTotalNominal) * 100) : 0}%
            </span>
          </div>
          <div className="text-xl font-bold text-emerald-700 mt-1">
            Rp {categoryBreakdowns['Bahan Basah'].totalNominal.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {categoryBreakdowns['Bahan Basah'].items.length} jenis bahan basah
          </div>
        </div>

        {/* Card 3: Bahan Kering */}
        <div className="p-4 rounded-xl bg-white border border-amber-200 shadow-2xs bg-gradient-to-b from-white to-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800">Bahan Kering</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {grandTotalNominal > 0 ? Math.round((categoryBreakdowns['Bahan Kering'].totalNominal / grandTotalNominal) * 100) : 0}%
            </span>
          </div>
          <div className="text-xl font-bold text-amber-700 mt-1">
            Rp {categoryBreakdowns['Bahan Kering'].totalNominal.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {categoryBreakdowns['Bahan Kering'].items.length} jenis bahan kering
          </div>
        </div>

        {/* Card 4: Bahan Peralatan */}
        <div className="p-4 rounded-xl bg-white border border-blue-200 shadow-2xs bg-gradient-to-b from-white to-blue-50/20">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-800">Bahan Peralatan</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {grandTotalNominal > 0 ? Math.round((categoryBreakdowns['Bahan Peralatan'].totalNominal / grandTotalNominal) * 100) : 0}%
            </span>
          </div>
          <div className="text-xl font-bold text-blue-700 mt-1">
            Rp {categoryBreakdowns['Bahan Peralatan'].totalNominal.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {categoryBreakdowns['Bahan Peralatan'].items.length} jenis peralatan
          </div>
        </div>
      </div>

      {/* View Switcher: Rekapitulasi Nominal vs Rincian Transaksi vs Lembar Cetak */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">Tampilan Data:</span>
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('SUMMARY')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeSubTab === 'SUMMARY' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rekapitulasi Barang & Biaya
            </button>
            <button
              onClick={() => setActiveSubTab('TRANSACTIONS')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeSubTab === 'TRANSACTIONS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Log Catatan Transaksi
            </button>
            <button
              onClick={() => setActiveSubTab('PRINT_VIEW')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeSubTab === 'PRINT_VIEW' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Printer className="w-3.5 h-3.5 text-emerald-600" />
              <span>Lembar Cetak Laporan (Resmi)</span>
            </button>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Menampilkan periode: <strong className="text-slate-800">{effectiveDateRange.label}</strong>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAMPILAN 1: REKAPITULASI BARANG & NOMINAL PER KATEGORI (INTI PERMINTAAN USER) */}
      {/* ========================================================================= */}
      {activeSubTab === 'SUMMARY' && (
        <div className="no-print space-y-6">
          {(['Bahan Basah', 'Bahan Kering', 'Bahan Peralatan'] as MainItemCategory[]).map(cat => {
            if (selectedCategoryTab !== 'ALL' && selectedCategoryTab !== cat) {
              return null;
            }

            const data = categoryBreakdowns[cat];
            const badgeClass =
              cat === 'Bahan Basah'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : cat === 'Bahan Kering'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-blue-100 text-blue-800 border-blue-200';

            const subtotalClass =
              cat === 'Bahan Basah'
                ? 'text-emerald-700'
                : cat === 'Bahan Kering'
                ? 'text-amber-700'
                : 'text-blue-700';

            return (
              <div
                key={cat}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs"
              >
                {/* Category Header */}
                <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${badgeClass}`}>
                      {cat}
                    </span>
                    <h2 className="text-xs font-semibold text-slate-700">
                      Rincian Barang & Pengeluaran ({effectiveDateRange.label})
                    </h2>
                  </div>

                  <div className="text-xs font-semibold text-slate-600">
                    Subtotal Pengeluaran {cat}:{' '}
                    <strong className={`font-mono text-sm font-bold ${subtotalClass}`}>
                      Rp {data.totalNominal.toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>

                {data.items.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    Belum ada pengeluaran {cat} yang tercatat pada periode ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                          <th className="py-2.5 px-4 w-12 text-center">No</th>
                          <th className="py-2.5 px-4">Nama Barang</th>
                          <th className="py-2.5 px-4 text-right">Total Volume Keluar</th>
                          <th className="py-2.5 px-4 text-right">Estimasi Harga Satuan</th>
                          <th className="py-2.5 px-4 text-right">Total Nominal (Rp)</th>
                          <th className="py-2.5 px-4 text-center w-28">% Porsi Kategori</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.items.map((item, idx) => (
                          <tr key={item.itemName} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-4 text-center text-slate-400 font-medium">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-900">
                              {item.itemName}
                              <div className="text-[10px] text-slate-400 font-normal">
                                {item.countOccurrences} kali pengambilan
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-slate-800">
                              {item.totalQty.toLocaleString('id-ID')} {item.unit}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                              Rp {item.unitPrice.toLocaleString('id-ID')} / {item.unit}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                              Rp {item.totalNominal.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <div className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                                <div className="w-12 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-1.5 rounded-full ${
                                      cat === 'Bahan Basah'
                                        ? 'bg-emerald-600'
                                        : cat === 'Bahan Kering'
                                        ? 'bg-amber-600'
                                        : 'bg-blue-600'
                                    }`}
                                    style={{ width: `${item.percentageOfCategory}%` }}
                                  ></div>
                                </div>
                                <span className="text-[11px]">{item.percentageOfCategory}%</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN 2: RINCIAN LOG TRANSAKSI PER BARIS */}
      {/* ========================================================================= */}
      {activeSubTab === 'TRANSACTIONS' && (
        <div className="no-print bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-rose-600" />
              <h2 className="text-xs font-bold text-slate-900">
                Log Transaksi Pengeluaran ({filteredExpenses.length} baris)
              </h2>
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Total Nominal: <strong className="text-slate-900 font-mono">Rp {grandTotalNominal.toLocaleString('id-ID')}</strong>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs italic">
              Tidak ada transaksi pengeluaran pada periode yang dipilih.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-3 text-center w-12">No</th>
                    <th className="py-2.5 px-3">Tanggal & Jam</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Nama Barang</th>
                    <th className="py-2.5 px-3 text-right">Jumlah</th>
                    <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                    <th className="py-2.5 px-3 text-right">Total Nominal</th>
                    <th className="py-2.5 px-3">Pengambil / Relawan</th>
                    <th className="py-2.5 px-3">PIC Petugas</th>
                    <th className="py-2.5 px-3">Keterangan</th>
                    <th className="py-2.5 px-3 text-center w-12">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredExpenses.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-700 whitespace-nowrap">
                        <div>{item.rawDate}</div>
                        <div className="text-[10px] text-slate-400 font-mono">Pukul {item.time}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            item.category === 'Bahan Basah'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : item.category === 'Bahan Kering'
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {item.itemName}
                        {item.source === 'KITCHEN' && item.referenceNo && (
                          <div className="text-[10px] text-slate-400 font-mono font-normal">
                            Ref: {item.referenceNo}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600 text-[11px] whitespace-nowrap">
                        Rp {item.unitPrice.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        Rp {item.nominal.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">
                        {item.recipientOrVolunteer}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {item.picOrUser}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={item.notes}>
                        {item.notes || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {item.source === 'MANUAL' && (
                          <button
                            onClick={() => handleDeleteManual(item.id, item.itemName)}
                            title="Hapus baris ini"
                            className="text-slate-300 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAMPILAN 3 / DOKUMEN CETAK: LEMBAR LAPORAN RESMI SPPG BERDASARKAN FILTER */}
      {/* ========================================================================= */}
      <div
        id="print-expenses-area"
        className={`${
          activeSubTab === 'PRINT_VIEW' ? 'block' : 'hidden print:block'
        } bg-white p-6 sm:p-10 rounded-2xl border border-slate-300 shadow-sm max-w-4xl mx-auto font-sans text-slate-900 print:p-0 print:border-none print:shadow-none`}
      >
        {/* Actions bar visible only on screen in PRINT_VIEW */}
        <div className="no-print mb-6 pb-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Pratinjau Format Cetak Dokumen Resmi SPPG</span>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / Simpan PDF Sekarang</span>
          </button>
        </div>

        {/* KOP SURAT RESMI STANDAR SPPG (PERSIS SEPERTI CETAK FORM) */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
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
            <div className="font-bold text-slate-800 text-xs">
              BERITA ACARA REKAP PENGELUARAN
            </div>
            <div>
              Tanggal Cetak: <span className="font-semibold text-slate-700">{printDate}</span>
            </div>
            <div>
              Operator: <span className="font-semibold text-slate-700">{currentUser.name}</span>
            </div>
          </div>
        </div>

        {/* JUDUL DOKUMEN & IDENTITAS FILTER WAKTU */}
        <div className="text-center my-5">
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">
            LAPORAN REKAPITULASI BIAYA & PENGELUARAN LOGISTIK
          </h2>
          <p className="text-xs text-slate-600 font-medium mt-0.5">
            Program Makanan Bergizi Gratis (MBG) • Satuan Pelayanan Pemenuhan Gizi
          </p>
          <div className="inline-block mt-2 px-3 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700 border border-slate-200">
            Filter Periode: {effectiveDateRange.label}
          </div>
        </div>

        {/* BAGIAN 1: REKAPITULASI PER KATEGORI (RINGKASAN TOTAL QTY & BIAYA) */}
        <div className="mb-6">
          <div className="font-bold text-xs text-slate-800 mb-2 flex items-center justify-between border-b border-slate-200 pb-1">
            <span>A. Rekapitulasi Berdasarkan Kategori Bahan</span>
            <span className="text-[11px] font-normal text-slate-500">Akumulasi Qty & Nominal Biaya</span>
          </div>

          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                <th className="py-2 px-3 border-r border-slate-300 text-center w-10">No</th>
                <th className="py-2 px-3 border-r border-slate-300">Kategori Barang</th>
                <th className="py-2 px-3 border-r border-slate-300 text-center w-28">Jumlah Ragam</th>
                <th className="py-2 px-3 border-r border-slate-300 text-right w-36">Total Akumulasi Qty</th>
                <th className="py-2 px-3 border-r border-slate-300 text-right w-44">Total Biaya (Rp)</th>
                <th className="py-2 px-3 text-right w-24">Porsi (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(['Bahan Basah', 'Bahan Kering', 'Bahan Peralatan'] as MainItemCategory[]).map((cat, idx) => {
                const catData = categoryBreakdowns[cat];
                const totalQty = catData.items.reduce((s, it) => s + it.totalQty, 0);
                const pct = grandTotalNominal > 0 ? Math.round((catData.totalNominal / grandTotalNominal) * 100) : 0;

                return (
                  <tr key={cat} className="hover:bg-slate-50">
                    <td className="py-2 px-3 border-r border-slate-300 text-center text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 border-r border-slate-300 font-semibold text-slate-800">{cat}</td>
                    <td className="py-2 px-3 border-r border-slate-300 text-center">{catData.items.length} jenis item</td>
                    <td className="py-2 px-3 border-r border-slate-300 text-right font-medium">{totalQty.toLocaleString('id-ID')}</td>
                    <td className="py-2 px-3 border-r border-slate-300 text-right font-bold text-slate-900">
                      Rp {catData.totalNominal.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold">{pct}%</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
                <td colSpan={2} className="py-2.5 px-3 border-r border-slate-300 text-right">
                  TOTAL KESELURUHAN PENGELUARAN:
                </td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-center">
                  {categoryBreakdowns['Bahan Basah'].items.length +
                    categoryBreakdowns['Bahan Kering'].items.length +
                    categoryBreakdowns['Bahan Peralatan'].items.length} jenis
                </td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-right">
                  {(
                    categoryBreakdowns['Bahan Basah'].items.reduce((s, it) => s + it.totalQty, 0) +
                    categoryBreakdowns['Bahan Kering'].items.reduce((s, it) => s + it.totalQty, 0) +
                    categoryBreakdowns['Bahan Peralatan'].items.reduce((s, it) => s + it.totalQty, 0)
                  ).toLocaleString('id-ID')}
                </td>
                <td className="py-2.5 px-3 border-r border-slate-300 text-right text-emerald-800 text-sm">
                  Rp {grandTotalNominal.toLocaleString('id-ID')}
                </td>
                <td className="py-2.5 px-3 text-right">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* BAGIAN 2: RINCIAN PENGELUARAN TERPISAH PER KATEGORI */}
        <div className="mb-6 space-y-6">
          <div className="font-bold text-xs text-slate-800 pb-1 border-b border-slate-200">
            B. Rincian Item Barang Keluar per Kategori
          </div>

          {(['Bahan Basah', 'Bahan Kering', 'Bahan Peralatan'] as MainItemCategory[]).map((cat, catIdx) => {
            const catData = categoryBreakdowns[cat];
            const totalQty = catData.items.reduce((s, it) => s + it.totalQty, 0);

            return (
              <div key={cat} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold bg-slate-100 px-3 py-1.5 rounded border border-slate-200">
                  <span className="text-slate-800">
                    {catIdx + 1}. Kategori {cat} ({catData.items.length} jenis barang)
                  </span>
                  <span className="text-slate-900 font-mono">
                    Subtotal: Rp {catData.totalNominal.toLocaleString('id-ID')}
                  </span>
                </div>

                {catData.items.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-[11px] italic border border-dashed border-slate-200 rounded">
                    Tidak ada pengeluaran {cat} yang tercatat pada periode ini.
                  </div>
                ) : (
                  <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300 text-slate-600 font-semibold">
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center w-8">No</th>
                        <th className="py-1.5 px-2 border-r border-slate-300">Nama Barang</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-center w-16">Satuan</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-right w-24">Total Qty</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-right w-28">Harga Satuan</th>
                        <th className="py-1.5 px-2 border-r border-slate-300 text-right w-32">Total Biaya (Rp)</th>
                        <th className="py-1.5 px-2 text-right w-16">% Kat.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {catData.items.map((it, itIdx) => (
                        <tr key={it.itemName} className="hover:bg-slate-50/60">
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-400">{itIdx + 1}</td>
                          <td className="py-1.5 px-2 border-r border-slate-300 font-medium text-slate-900">{it.itemName}</td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-center text-slate-600">{it.unit}</td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-right font-semibold text-slate-800">
                            {it.totalQty.toLocaleString('id-ID')}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono text-slate-600">
                            Rp {it.unitPrice.toLocaleString('id-ID')}
                          </td>
                          <td className="py-1.5 px-2 border-r border-slate-300 text-right font-mono font-bold text-slate-900">
                            Rp {it.totalNominal.toLocaleString('id-ID')}
                          </td>
                          <td className="py-1.5 px-2 text-right text-slate-600">{it.percentageOfCategory}%</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-50 font-bold border-t border-slate-300 text-slate-800">
                        <td colSpan={3} className="py-1.5 px-2 border-r border-slate-300 text-right">
                          Subtotal {cat}:
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-bold">
                          {totalQty.toLocaleString('id-ID')}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-300"></td>
                        <td className="py-1.5 px-2 border-r border-slate-300 text-right font-bold text-slate-900">
                          Rp {catData.totalNominal.toLocaleString('id-ID')}
                        </td>
                        <td className="py-1.5 px-2 text-right">100%</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>

        {/* LEMBAR PENGESAHAN DOKUMEN / TANDA TANGAN */}
        <div className="pt-6 border-t border-slate-300 text-xs">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-slate-500">Dibuat Oleh,</div>
              <div className="font-semibold text-slate-800">Petugas Gudang / Logistik</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                ({currentUser.name})
              </div>
            </div>

            <div>
              <div className="text-slate-500">Diverifikasi Oleh,</div>
              <div className="font-semibold text-slate-800">Akuntan SPPG</div>
              <div className="h-16 flex items-end justify-center font-bold text-slate-900">
                (Dewi Lestari, S.Ak)
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
    </div>
  );
};
