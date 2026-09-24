import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import { WasteLog, WasteCategory, DisposalMethod } from '../types/warehouse';
import { exportToExcel } from '../lib/excelExport';
import { SppgLogo } from './SppgLogo';
import {
  Trash2,
  Plus,
  Printer,
  Search,
  Filter,
  Leaf,
  Recycle,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Calculator,
  Layers,
  Calendar,
  Sparkles,
  Scale,
  RefreshCw,
  X,
  PieChart,
  Sliders,
  Info
} from 'lucide-react';

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
    description: 'Nasi pulen + sayur bening/lodeh + tempe/tahu + lauk hewani + buah potong',
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
    description: 'Porsi sayuran dominan 50%, tahu/tempe/bumbu kacang 25%, kentang/lontong 10%, telur 10%, buah 5%',
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
    description: 'Bubur beras 55%, ayam suwir/telur 15%, sayur seledri/cakwe 15%, kacang kedelai 10%, buah 5%',
    shares: {
      karbohidrat: 55,
      sayur: 15,
      proteinHewani: 15,
      proteinNabati: 10,
      buah: 5,
    },
  },
];

export const WasteLogModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [wasteLogs, setWasteLogs] = useState<WasteLog[]>(() => warehouseDb.getWasteLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Periode Filter States
  const [periodType, setPeriodType] = useState<'ALL' | 'THIS_WEEK' | 'THIS_MONTH' | 'SPECIFIC_MONTH' | 'SPECIFIC_DATE'>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>(new Date().toISOString().slice(0, 10)); // YYYY-MM-DD
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDisposal, setSelectedDisposal] = useState<string>('ALL');

  // Modals state
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isCalcModalOpen, setIsCalcModalOpen] = useState(false);

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
    {
      category: 'Sisa Makanan Distribusi',
      itemName: 'Sisa nasi & lauk piring siswa',
      quantity: 12,
      unit: 'Kg',
      sourceArea: 'Sekolah Sasaran SPPG Jeru Tumpang',
      disposalMethod: 'Pakan Maggot / Ternak',
      notes: '',
    },
  ]);

  // Calculator Form State (Plate Waste Nutrition Estimator)
  const [calcDate, setCalcDate] = useState(new Date().toISOString().slice(0, 10));
  const [calcMenuName, setCalcMenuName] = useState('Menu Harian SPPG Jeru Tumpang');
  const [calcTotalWeight, setCalcTotalWeight] = useState<number>(20); // e.g. 20 kg
  const [calcDisposal, setCalcDisposal] = useState<DisposalMethod>('Pakan Maggot / Ternak');
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

  // Helper untuk mendapatkan nomor minggu & rentang tanggal
  const getWeekDates = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Senin
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      startStr: monday.toISOString().slice(0, 10),
      endStr: sunday.toISOString().slice(0, 10),
    };
  };

  // Filtered waste logs
  const filteredLogs = useMemo(() => {
    const now = new Date();
    const { startStr: currentWeekStart, endStr: currentWeekEnd } = getWeekDates(new Date(now));

    return wasteLogs.filter(log => {
      // Period filter
      if (periodType === 'THIS_WEEK') {
        if (log.date < currentWeekStart || log.date > currentWeekEnd) return false;
      } else if (periodType === 'THIS_MONTH') {
        const curMonth = now.toISOString().slice(0, 7);
        if (!log.date.startsWith(curMonth)) return false;
      } else if (periodType === 'SPECIFIC_MONTH') {
        if (!log.date.startsWith(selectedMonth)) return false;
      } else if (periodType === 'SPECIFIC_DATE') {
        if (log.date !== selectedSpecificDate) return false;
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
          (log.day || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [wasteLogs, periodType, selectedMonth, selectedSpecificDate, selectedCategory, selectedDisposal, searchQuery]);

  // Group logs by DATE for the "Buku Catatan Harian"
  const groupedDailyLogs = useMemo(() => {
    const groups: { [date: string]: WasteLog[] } = {};
    filteredLogs.forEach(log => {
      if (!groups[log.date]) {
        groups[log.date] = [];
      }
      groups[log.date].push(log);
    });

    // Sort dates descending
    return Object.entries(groups)
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(([date, logs]) => {
        const dayTotalKg = logs.reduce((sum, item) => sum + (item.unit === 'Gram' ? item.quantity / 1000 : item.quantity), 0);
        return {
          date,
          dayName: logs[0]?.day || new Date(date).toLocaleDateString('id-ID', { weekday: 'long' }),
          logs,
          dayTotalKg,
        };
      });
  }, [filteredLogs]);

  // Metrics summary based on filtered logs
  const stats = useMemo(() => {
    let totalKg = 0;
    let karboKg = 0;
    let sayurKg = 0;
    let nabatiKg = 0;
    let hewaniKg = 0;
    let buahKg = 0;
    let dapurScrapKg = 0;
    let damagedKg = 0;
    let kemasanKg = 0;
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
      else if (cat.includes('dapur')) dapurScrapKg += kg;
      else if (cat.includes('rusak') || cat.includes('kadaluarsa')) damagedKg += kg;
      else if (cat.includes('kemasan')) kemasanKg += kg;

      if (w.disposalMethod !== 'TPS Terpadu') {
        divertedKg += kg;
      }
    });

    const circularRate = totalKg > 0 ? Math.round((divertedKg / totalKg) * 100) : 0;

    return {
      totalKg,
      karboKg,
      sayurKg,
      nabatiKg,
      hewaniKg,
      buahKg,
      dapurScrapKg,
      damagedKg,
      kemasanKg,
      circularRate,
    };
  }, [filteredLogs]);

  // Calculator Live Computations
  const totalCalcShares = useMemo(() => {
    return (
      customShares.karbohidrat +
      customShares.sayur +
      customShares.proteinNabati +
      customShares.proteinHewani +
      customShares.buah
    );
  }, [customShares]);

  const calcResults = useMemo(() => {
    const total = calcTotalWeight > 0 ? calcTotalWeight : 0;
    return {
      karbo: {
        percent: customShares.karbohidrat,
        kg: Number(((customShares.karbohidrat / 100) * total).toFixed(2)),
      },
      sayur: {
        percent: customShares.sayur,
        kg: Number(((customShares.sayur / 100) * total).toFixed(2)),
      },
      nabati: {
        percent: customShares.proteinNabati,
        kg: Number(((customShares.proteinNabati / 100) * total).toFixed(2)),
      },
      hewani: {
        percent: customShares.proteinHewani,
        kg: Number(((customShares.proteinHewani / 100) * total).toFixed(2)),
      },
      buah: {
        percent: customShares.buah,
        kg: Number(((customShares.buah / 100) * total).toFixed(2)),
      },
    };
  }, [calcTotalWeight, customShares]);

  // Handle Preset Change
  const handleSelectPreset = (idx: number) => {
    setActivePresetIndex(idx);
    setCustomShares({ ...NUTRITION_PRESETS[idx].shares });
  };

  // Normalisasi persentase agar pas 100%
  const handleNormalizeShares = () => {
    if (totalCalcShares === 0) return;
    const factor = 100 / totalCalcShares;
    setCustomShares({
      karbohidrat: Math.round(customShares.karbohidrat * factor),
      sayur: Math.round(customShares.sayur * factor),
      proteinNabati: Math.round(customShares.proteinNabati * factor),
      proteinHewani: Math.round(customShares.proteinHewani * factor),
      buah: Math.round(customShares.buah * factor),
    });
  };

  // Simpan hasil hitungan kalkulator komposisi ke Rekap Limbah Harian
  const handleSaveCalculatorToWasteLogs = () => {
    if (calcTotalWeight <= 0) {
      alert('Total berat sisa makanan harus lebih dari 0 kg.');
      return;
    }
    if (totalCalcShares !== 100) {
      if (!window.confirm(`Total persentase saat ini ${totalCalcShares}% (bukan 100%). Tetap ingin menyimpan?`)) {
        return;
      }
    }

    const dayName = new Date(calcDate).toLocaleDateString('id-ID', { weekday: 'long' });

    const entriesToSave: Omit<WasteLog, 'id' | 'createdAt'>[] = [
      {
        day: dayName,
        date: calcDate,
        wasteCategory: 'karbohidrat',
        itemName: `Sisa Karbohidrat (${customShares.karbohidrat}%) - ${calcMenuName}`,
        quantity: calcResults.karbo.kg,
        unit: 'Kg',
        sourceArea: 'Piring Distribusi Sekolah SPPG Jeru Tumpang',
        reason: 'Sisa makanan porsi siswa (Plate waste)',
        disposalMethod: calcDisposal,
        recordedBy: currentUser.name,
        notes: `Estimasi proporsional dari total sisa ${calcTotalWeight} Kg`,
      },
      {
        day: dayName,
        date: calcDate,
        wasteCategory: 'sayur',
        itemName: `Sisa Sayuran (${customShares.sayur}%) - ${calcMenuName}`,
        quantity: calcResults.sayur.kg,
        unit: 'Kg',
        sourceArea: 'Piring Distribusi Sekolah SPPG Jeru Tumpang',
        reason: 'Sisa sayuran porsi siswa (Plate waste)',
        disposalMethod: calcDisposal,
        recordedBy: currentUser.name,
        notes: `Estimasi proporsional dari total sisa ${calcTotalWeight} Kg`,
      },
      {
        day: dayName,
        date: calcDate,
        wasteCategory: 'protein nabati',
        itemName: `Sisa Protein Nabati (${customShares.proteinNabati}%) - ${calcMenuName}`,
        quantity: calcResults.nabati.kg,
        unit: 'Kg',
        sourceArea: 'Piring Distribusi Sekolah SPPG Jeru Tumpang',
        reason: 'Sisa tahu/tempe/nabati siswa',
        disposalMethod: calcDisposal,
        recordedBy: currentUser.name,
        notes: `Estimasi proporsional dari total sisa ${calcTotalWeight} Kg`,
      },
      {
        day: dayName,
        date: calcDate,
        wasteCategory: 'protein hewani',
        itemName: `Sisa Protein Hewani (${customShares.proteinHewani}%) - ${calcMenuName}`,
        quantity: calcResults.hewani.kg,
        unit: 'Kg',
        sourceArea: 'Piring Distribusi Sekolah SPPG Jeru Tumpang',
        reason: 'Sisa daging/ayam/ikan/telur siswa',
        disposalMethod: calcDisposal,
        recordedBy: currentUser.name,
        notes: `Estimasi proporsional dari total sisa ${calcTotalWeight} Kg`,
      },
      {
        day: dayName,
        date: calcDate,
        wasteCategory: 'buah',
        itemName: `Sisa Buah-buahan (${customShares.buah}%) - ${calcMenuName}`,
        quantity: calcResults.buah.kg,
        unit: 'Kg',
        sourceArea: 'Piring Distribusi Sekolah SPPG Jeru Tumpang',
        reason: 'Sisa buah potong siswa',
        disposalMethod: calcDisposal,
        recordedBy: currentUser.name,
        notes: `Estimasi proporsional dari total sisa ${calcTotalWeight} Kg`,
      },
    ];

    warehouseDb.recordWasteBatch(entriesToSave, currentUser);
    refreshLogs();
    setIsCalcModalOpen(false);
    setSuccessNotice(`Berhasil menyimpan 5 butir rincian limbah sisa makanan (${calcTotalWeight} Kg) ke buku catatan harian!`);
    setTimeout(() => setSuccessNotice(''), 6000);
  };

  // Simpan Batch Baru
  const handleSaveBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = batchRows.filter(r => r.itemName.trim() && r.quantity > 0);
    if (validRows.length === 0) {
      alert('Minimal harus ada satu baris limbah dengan nama dan kuantitas valid.');
      return;
    }

    const dayName = new Date(batchDate).toLocaleDateString('id-ID', { weekday: 'long' });
    const entriesToSave = validRows.map(r => ({
      day: dayName,
      date: batchDate,
      wasteCategory: r.category,
      itemName: r.itemName.trim(),
      quantity: Number(r.quantity),
      unit: r.unit,
      sourceArea: r.sourceArea.trim(),
      reason: 'Pencatatan batch limbah harian',
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

    const dayName = new Date(formDate).toLocaleDateString('id-ID', { weekday: 'long' });
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

  // Handle Delete Record
  const handleDeleteRecord = (id: string, name: string) => {
    if (window.confirm(`Hapus catatan limbah "${name}"?`)) {
      warehouseDb.deleteWasteLog(id, currentUser);
      refreshLogs();
    }
  };

  // Ekspor Excel
  const handleExportExcel = () => {
    const exportData = filteredLogs.map((log, idx) => ({
      'No': idx + 1,
      'Hari': log.day || new Date(log.date).toLocaleDateString('id-ID', { weekday: 'long' }),
      'Tanggal': log.date,
      'Kategori Limbah': log.wasteCategory,
      'Nama Item / Bahan': log.itemName || '-',
      'Jumlah': log.quantity,
      'Satuan': log.unit,
      'Area Asal': log.sourceArea || '-',
      'Alasan / Sumber': log.reason || '-',
      'Jalur Penanganan': log.disposalMethod,
      'Pencatat (PIC)': log.recordedBy || '-',
      'Catatan': log.notes || '-',
    }));

    exportToExcel(
      exportData,
      `Buku_Catatan_Limbah_SPPG_Jeru_Tumpang_${periodType}_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Buku Catatan Limbah'
    );
  };

  const getDisposalBadgeClass = (method: DisposalMethod) => {
    switch (method) {
      case 'Kompos Organik':
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'Pakan Maggot / Ternak':
      case 'Pakan Ternak & Kompos Organik':
        return 'bg-amber-50 text-amber-800 border-amber-300';
      case 'Bank Sampah / Daur Ulang':
        return 'bg-blue-50 text-blue-800 border-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getCategoryBadgeColor = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('karbo')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (c.includes('sayur')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (c.includes('nabati')) return 'bg-sky-50 text-sky-800 border-sky-200';
    if (c.includes('hewani')) return 'bg-rose-50 text-rose-800 border-rose-200';
    if (c.includes('buah')) return 'bg-purple-50 text-purple-800 border-purple-200';
    if (c.includes('dapur')) return 'bg-teal-50 text-teal-800 border-teal-200';
    if (c.includes('rusak')) return 'bg-orange-50 text-orange-800 border-orange-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-5">
      {/* Alert Notice */}
      {successNotice && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Header dengan Logo Resmi SPPG */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 bg-white p-5 rounded-2xl border shadow-xs">
        <div className="flex items-center gap-3.5">
          <SppgLogo size="md" variant="color" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Buku Catatan & Rekapitulasi Limbah SPPG Jeru Tumpang
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitoring harian limbah preparasi dapur, sisa makanan distribusi (plate waste), dan circular economy.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Tombol Penghitung Otomatis */}
          <button
            type="button"
            onClick={() => setIsCalcModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors shadow-2xs cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5 text-emerald-700" />
            <span>Hitung Komposisi Sisa Piring</span>
          </button>

          {/* Tombol Input Batch */}
          <button
            type="button"
            onClick={() => setIsBatchModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 transition-colors shadow-2xs cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-teal-700" />
            <span>Input Batch Limbah</span>
          </button>

          {/* Tombol Catat Limbah Tunggal */}
          <button
            type="button"
            onClick={() => setIsSingleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Catat Tunggal</span>
          </button>

          {/* Ekspor Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ekspor Excel</span>
          </button>

          {/* Cetak PDF */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar: Filter Minggu, Bulan, Tanggal & Kategori */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Period Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-600 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Periode:
            </span>

            <button
              type="button"
              onClick={() => setPeriodType('ALL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                periodType === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Semua Periode
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('THIS_WEEK')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                periodType === 'THIS_WEEK'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Minggu Ini
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('THIS_MONTH')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                periodType === 'THIS_MONTH'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Bulan Ini
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('SPECIFIC_MONTH')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                periodType === 'SPECIFIC_MONTH'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Pilih Bulan
            </button>

            <button
              type="button"
              onClick={() => setPeriodType('SPECIFIC_DATE')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                periodType === 'SPECIFIC_DATE'
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}
            >
              Pilih Tanggal
            </button>
          </div>

          {/* Conditional Month / Date Picker */}
          {periodType === 'SPECIFIC_MONTH' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Bulan:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
              />
            </div>
          )}

          {periodType === 'SPECIFIC_DATE' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500 font-medium">Tanggal:</span>
              <input
                type="date"
                value={selectedSpecificDate}
                onChange={e => setSelectedSpecificDate(e.target.value)}
                className="text-xs font-semibold border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
              />
            </div>
          )}
        </div>

        {/* Category & Search Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="ALL">Semua Kategori Limbah</option>
                <option value="karbohidrat">Sisa Karbohidrat</option>
                <option value="sayur">Sisa Sayuran</option>
                <option value="protein nabati">Sisa Protein Nabati</option>
                <option value="protein hewani">Sisa Protein Hewani</option>
                <option value="buah">Sisa Buah</option>
                <option value="Limbah Olahan Dapur">Limbah Olahan Dapur (Kupasan)</option>
                <option value="Bahan Rusak / Kadaluarsa">Bahan Rusak / Kadaluarsa</option>
                <option value="Sisa Makanan Distribusi">Sisa Makanan Distribusi</option>
                <option value="Kemasan & Non-Organik">Kemasan & Non-Organik</option>
              </select>
            </div>

            <select
              value={selectedDisposal}
              onChange={e => setSelectedDisposal(e.target.value)}
              className="text-xs font-medium border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="ALL">Semua Jalur Penanganan</option>
              <option value="Pakan Maggot / Ternak">Pakan Maggot / Ternak</option>
              <option value="Kompos Organik">Kompos Organik</option>
              <option value="Bank Sampah / Daur Ulang">Bank Sampah / Daur Ulang</option>
              <option value="TPS Terpadu">TPS Terpadu</option>
            </select>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari item, hari, alasan..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 w-60 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* KPI Cards: Total Keseluruhan & Total Masing-Masing Jenis Limbah */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <PieChart className="w-3.5 h-3.5 text-emerald-600" />
          Rekapitulasi Total Limbah Berdasarkan Kategori ({periodType === 'THIS_WEEK' ? 'Minggu Ini' : periodType === 'THIS_MONTH' ? 'Bulan Ini' : 'Periode Terpilih'})
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Grand Total */}
          <div className="p-3.5 rounded-xl bg-slate-900 text-white shadow-2xs sm:col-span-1">
            <div className="text-[11px] font-medium text-slate-300">Total Akumulasi</div>
            <div className="text-xl font-bold mt-1 text-white">
              {stats.totalKg.toFixed(1)} <span className="text-xs font-normal text-slate-300">Kg</span>
            </div>
            <div className="text-[10px] text-emerald-300 mt-0.5 font-semibold">
              {stats.circularRate}% daur ulang/pakan
            </div>
          </div>

          {/* Karbohidrat */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-amber-900">Sisa Karbohidrat</div>
            <div className="text-xl font-bold text-amber-800 mt-1">
              {stats.karboKg.toFixed(1)} <span className="text-xs font-normal text-amber-700">Kg</span>
            </div>
            <div className="text-[10px] text-amber-700 mt-0.5">
              {stats.totalKg > 0 ? ((stats.karboKg / stats.totalKg) * 100).toFixed(0) : 0}% dari total
            </div>
          </div>

          {/* Sayuran */}
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-emerald-900">Sisa Sayuran</div>
            <div className="text-xl font-bold text-emerald-800 mt-1">
              {stats.sayurKg.toFixed(1)} <span className="text-xs font-normal text-emerald-700">Kg</span>
            </div>
            <div className="text-[10px] text-emerald-700 mt-0.5">
              {stats.totalKg > 0 ? ((stats.sayurKg / stats.totalKg) * 100).toFixed(0) : 0}% dari total
            </div>
          </div>

          {/* Protein Nabati */}
          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-sky-900">Protein Nabati</div>
            <div className="text-xl font-bold text-sky-800 mt-1">
              {stats.nabatiKg.toFixed(1)} <span className="text-xs font-normal text-sky-700">Kg</span>
            </div>
            <div className="text-[10px] text-sky-700 mt-0.5">
              {stats.totalKg > 0 ? ((stats.nabatiKg / stats.totalKg) * 100).toFixed(0) : 0}% dari total
            </div>
          </div>

          {/* Protein Hewani */}
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-rose-900">Protein Hewani</div>
            <div className="text-xl font-bold text-rose-800 mt-1">
              {stats.hewaniKg.toFixed(1)} <span className="text-xs font-normal text-rose-700">Kg</span>
            </div>
            <div className="text-[10px] text-rose-700 mt-0.5">
              {stats.totalKg > 0 ? ((stats.hewaniKg / stats.totalKg) * 100).toFixed(0) : 0}% dari total
            </div>
          </div>

          {/* Buah-buahan */}
          <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-200 shadow-2xs">
            <div className="text-[11px] font-semibold text-purple-900">Sisa Buah</div>
            <div className="text-xl font-bold text-purple-800 mt-1">
              {stats.buahKg.toFixed(1)} <span className="text-xs font-normal text-purple-700">Kg</span>
            </div>
            <div className="text-[10px] text-purple-700 mt-0.5">
              {stats.totalKg > 0 ? ((stats.buahKg / stats.totalKg) * 100).toFixed(0) : 0}% dari total
            </div>
          </div>
        </div>
      </div>

      {/* BUKU CATATAN HARIAN (GROUPED PER HARI) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Buku Catatan Limbah Harian ({groupedDailyLogs.length} Hari Tercatat)
            </h3>
            <p className="text-xs text-slate-500">
              Daftar insiden dan penimbangan limbah yang dikelompokkan per hari secara kronologis.
            </p>
          </div>
        </div>

        {groupedDailyLogs.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
            <Leaf className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            Tidak ada data limbah yang tercatat untuk filter periode ini.
          </div>
        ) : (
          groupedDailyLogs.map(dailyGroup => (
            <div
              key={dailyGroup.date}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
            >
              {/* Daily Group Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">
                    {dailyGroup.date.slice(-2)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      {dailyGroup.dayName}, {new Date(dailyGroup.date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {dailyGroup.logs.length} butir penimbangan limbah
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs text-slate-600">Total Hari Ini:</span>
                  <span className="text-xs font-black font-mono px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {dailyGroup.dayTotalKg.toFixed(2)} Kg
                  </span>
                </div>
              </div>

              {/* Table of items for this day */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3 w-10 text-center">No</th>
                      <th className="py-2 px-3 w-36">Kategori</th>
                      <th className="py-2 px-3">Uraian Bahan / Keterangan</th>
                      <th className="py-2 px-3 w-28 text-right">Bobot</th>
                      <th className="py-2 px-3 w-40">Jalur Penanganan</th>
                      <th className="py-2 px-3 w-44">Area Asal</th>
                      <th className="py-2 px-3 w-32">PIC</th>
                      <th className="py-2 px-3 w-12 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dailyGroup.logs.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${getCategoryBadgeColor(log.wasteCategory)}`}>
                            {log.wasteCategory}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-800">{log.itemName || '-'}</div>
                          {log.notes && (
                            <div className="text-[11px] text-slate-500 italic mt-0.5">{log.notes}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {log.quantity} {log.unit}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getDisposalBadgeClass(log.disposalMethod)}`}>
                            {log.disposalMethod}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          {log.sourceArea || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px] truncate">
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: PENGHITUNG OTOMATIS KOMPOSISI SISA MAKANAN (PLATE WASTE)        */}
      {/* ========================================================================= */}
      {isCalcModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Penghitung Komposisi Sisa Makanan (Plate Waste SPPG Jeru Tumpang)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Masukkan total timbangan sisa makanan untuk otomatis membagi ke 5 zat gizi
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
              {/* Tanggal & Menu Input */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Distribusi</label>
                  <input
                    type="date"
                    value={calcDate}
                    onChange={e => setCalcDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Menu Masakan</label>
                  <input
                    type="text"
                    value={calcMenuName}
                    onChange={e => setCalcMenuName(e.target.value)}
                    placeholder="Contoh: Menu Gado-Gado Komplit / Nasi Ayam Bali"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-800 font-semibold"
                  />
                </div>
              </div>

              {/* Total Weight Input (The Big Number) */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <label className="block text-xs font-bold text-emerald-950 mb-1 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-emerald-700" />
                  Total Berat Timbangan Sisa Makanan Hari Ini (Kg) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={calcTotalWeight || ''}
                    onChange={e => setCalcTotalWeight(parseFloat(e.target.value) || 0)}
                    placeholder="Contoh: 25.5"
                    className="w-48 px-3.5 py-2 text-lg font-black font-mono rounded-lg border border-emerald-300 bg-white text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                  />
                  <span className="text-sm font-bold text-emerald-800">Kilogram (Kg)</span>
                </div>
                <p className="text-[11px] text-emerald-700 mt-1">
                  Total timbangan ini akan otomatis dipecah menjadi 5 kelompok bahan gizi di bawah.
                </p>
              </div>

              {/* Preset Buttons */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  Pilih Preset Menu Sesuai Masakan Hari Ini:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {NUTRITION_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectPreset(idx)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        activePresetIndex === idx
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-500'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-800">{preset.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{preset.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders & Percentage Inputs */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800">
                    Penyesuaian Persentase Komposisi:
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                        totalCalcShares === 100
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                      }`}
                    >
                      Total: {totalCalcShares}%
                    </span>
                    {totalCalcShares !== 100 && (
                      <button
                        type="button"
                        onClick={handleNormalizeShares}
                        className="text-[11px] text-emerald-700 hover:underline font-bold"
                      >
                        Auto-100%
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                  {/* Karbohidrat */}
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="block text-[11px] font-bold text-amber-800">Karbohidrat</span>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={customShares.karbohidrat}
                        onChange={e => {
                          setCustomShares({ ...customShares, karbohidrat: parseInt(e.target.value) || 0 });
                          setActivePresetIndex(-1);
                        }}
                        className="w-14 text-center font-mono font-bold text-xs border border-slate-300 rounded p-1"
                      />
                      <span className="text-xs text-slate-500 font-semibold">%</span>
                    </div>
                    <span className="block text-[11px] font-mono font-bold text-amber-700 mt-1">
                      {calcResults.karbo.kg} Kg
                    </span>
                  </div>

                  {/* Sayur */}
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="block text-[11px] font-bold text-emerald-800">Sayur</span>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={customShares.sayur}
                        onChange={e => {
                          setCustomShares({ ...customShares, sayur: parseInt(e.target.value) || 0 });
                          setActivePresetIndex(-1);
                        }}
                        className="w-14 text-center font-mono font-bold text-xs border border-slate-300 rounded p-1"
                      />
                      <span className="text-xs text-slate-500 font-semibold">%</span>
                    </div>
                    <span className="block text-[11px] font-mono font-bold text-emerald-700 mt-1">
                      {calcResults.sayur.kg} Kg
                    </span>
                  </div>

                  {/* Nabati */}
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="block text-[11px] font-bold text-sky-800">Prot. Nabati</span>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={customShares.proteinNabati}
                        onChange={e => {
                          setCustomShares({ ...customShares, proteinNabati: parseInt(e.target.value) || 0 });
                          setActivePresetIndex(-1);
                        }}
                        className="w-14 text-center font-mono font-bold text-xs border border-slate-300 rounded p-1"
                      />
                      <span className="text-xs text-slate-500 font-semibold">%</span>
                    </div>
                    <span className="block text-[11px] font-mono font-bold text-sky-700 mt-1">
                      {calcResults.nabati.kg} Kg
                    </span>
                  </div>

                  {/* Hewani */}
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="block text-[11px] font-bold text-rose-800">Prot. Hewani</span>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={customShares.proteinHewani}
                        onChange={e => {
                          setCustomShares({ ...customShares, proteinHewani: parseInt(e.target.value) || 0 });
                          setActivePresetIndex(-1);
                        }}
                        className="w-14 text-center font-mono font-bold text-xs border border-slate-300 rounded p-1"
                      />
                      <span className="text-xs text-slate-500 font-semibold">%</span>
                    </div>
                    <span className="block text-[11px] font-mono font-bold text-rose-700 mt-1">
                      {calcResults.hewani.kg} Kg
                    </span>
                  </div>

                  {/* Buah */}
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    <span className="block text-[11px] font-bold text-purple-800">Buah</span>
                    <div className="flex items-center justify-center gap-1 mt-1">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={customShares.buah}
                        onChange={e => {
                          setCustomShares({ ...customShares, buah: parseInt(e.target.value) || 0 });
                          setActivePresetIndex(-1);
                        }}
                        className="w-14 text-center font-mono font-bold text-xs border border-slate-300 rounded p-1"
                      />
                      <span className="text-xs text-slate-500 font-semibold">%</span>
                    </div>
                    <span className="block text-[11px] font-mono font-bold text-purple-700 mt-1">
                      {calcResults.buah.kg} Kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Jalur Penanganan Limbah Sisa Makanan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jalur Penanganan Sisa Makanan</label>
                <select
                  value={calcDisposal}
                  onChange={e => setCalcDisposal(e.target.value as DisposalMethod)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium"
                >
                  <option value="Pakan Maggot / Ternak">Pakan Maggot / Ternak (Direkomendasikan SPPG)</option>
                  <option value="Kompos Organik">Kompos Organik (Komposter SPPG)</option>
                  <option value="TPS Terpadu">TPS Terpadu</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsCalcModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveCalculatorToWasteLogs}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Simpan 5 Komponen ke Rekap Harian
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INPUT BATCH LIMBAH MULTI-BARIS                                  */}
      {/* ========================================================================= */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Input Batch Penimbangan Limbah SPPG Jeru Tumpang
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Catat beberapa butir limbah sekaligus dalam satu sesi penimbangan
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
                <label className="font-semibold text-slate-700">Tanggal Penimbangan Batch:</label>
                <input
                  type="date"
                  value={batchDate}
                  onChange={e => setBatchDate(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800"
                />
              </div>

              {/* Dynamic rows table */}
              <div className="border border-slate-200 rounded-xl overflow-y-auto flex-1 mb-4">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5 w-8">No</th>
                      <th className="py-2 px-2.5 w-40">Kategori</th>
                      <th className="py-2 px-2.5">Nama Bahan / Keterangan</th>
                      <th className="py-2 px-2.5 w-24">Bobot</th>
                      <th className="py-2 px-2.5 w-20">Satuan</th>
                      <th className="py-2 px-2.5 w-44">Jalur Penanganan</th>
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
                            <option value="Limbah Olahan Dapur">Limbah Dapur</option>
                            <option value="Sisa Makanan Distribusi">Sisa Makanan</option>
                            <option value="Bahan Rusak / Kadaluarsa">Bahan Rusak</option>
                            <option value="Kemasan & Non-Organik">Kemasan</option>
                            <option value="karbohidrat">Karbohidrat</option>
                            <option value="sayur">Sayuran</option>
                            <option value="protein nabati">Nabati</option>
                            <option value="protein hewani">Hewani</option>
                            <option value="buah">Buah</option>
                          </select>
                        </td>
                        <td className="py-2 px-2.5">
                          <input
                            type="text"
                            required
                            placeholder="Misal: Kupasan wortel & labu"
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
                            <option value="Liter">Liter</option>
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
                            <option value="Pakan Maggot / Ternak">Pakan Maggot/Ternak</option>
                            <option value="Kompos Organik">Kompos Organik</option>
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

              {/* Add row button */}
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
                  Total Batch: {batchRows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0).toFixed(2)} Kg ({batchRows.length} baris)
                </div>
              </div>

              {/* Modal footer */}
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
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors cursor-pointer"
                >
                  Simpan Semua Baris Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PENCATATAN TUNGGAL (SINGLE RECORD)                             */}
      {/* ========================================================================= */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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
                    <option value="Liter">Liter</option>
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
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
