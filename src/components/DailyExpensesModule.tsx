import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  MainItemCategory,
  normalizeItemCategory,
  NonFoodExpense,
  InventoryTransaction
} from '../types/warehouse';
import {
  Calendar,
  Plus,
  Printer,
  Search,
  TrendingDown,
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  Upload,
  Download,
  Trash2,
  Package,
  TableProperties,
  ClipboardPaste,
  PlusCircle,
  Info,
  CalendarRange,
  DollarSign,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { exportToExcel, parseExcelFile, downloadExcelTemplate } from '../lib/excelExport';
import { SppgLogo } from './SppgLogo';

interface BatchRowItem {
  id: string;
  itemName: string;
  qty: string;
  unit: string;
  time: string;
  volunteer: string;
  category: MainItemCategory;
  notes: string;
}

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
  const [activeSubTab, setActiveSubTab] = useState<'SUMMARY' | 'TRANSACTIONS'>('SUMMARY');
  const [successNotice, setSuccessNotice] = useState<string>('');

  // Modals
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isKitchenModalOpen, setIsKitchenModalOpen] = useState(false);

  // Batch Form State
  const defaultCurrentTime = new Date()
    .toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    .replace(':', '.');

  const [batchDate, setBatchDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [batchPic, setBatchPic] = useState<string>(currentUser.name);
  const [batchRows, setBatchRows] = useState<BatchRowItem[]>([
    { id: '1', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Bahan Peralatan', notes: '' },
    { id: '2', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Bahan Peralatan', notes: '' },
    { id: '3', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Bahan Peralatan', notes: '' },
    { id: '4', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Bahan Peralatan', notes: '' },
    { id: '5', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Bahan Peralatan', notes: '' },
  ]);
  const [batchInputMode, setBatchInputMode] = useState<'GRID' | 'PASTE'>('GRID');
  const [pasteRawText, setPasteRawText] = useState('');

  // Single Form State
  const [singleItemName, setSingleItemName] = useState('');
  const [singleCategory, setSingleCategory] = useState<MainItemCategory>('Bahan Peralatan');
  const [singleQty, setSingleQty] = useState('1');
  const [singleUnit, setSingleUnit] = useState('pack');
  const [singleTime, setSingleTime] = useState(defaultCurrentTime);
  const [singleVolunteer, setSingleVolunteer] = useState('');
  const [singlePic, setSinglePic] = useState(currentUser.name);
  const [singleNotes, setSingleNotes] = useState('');
  const [singleUnitPrice, setSingleUnitPrice] = useState<number>(0);

  // Kitchen Issue Form State
  const [kitchenItemId, setKitchenItemId] = useState('');
  const [kitchenQty, setKitchenQty] = useState<number>(0);
  const [kitchenDestination, setKitchenDestination] = useState('Dapur Pengolahan Utama SPPG Jeru Tumpang');
  const [kitchenMealSession, setKitchenMealSession] = useState<'Pagi' | 'Siang' | 'Snack'>('Siang');
  const [kitchenNotes, setKitchenNotes] = useState('Pengeluaran rutin persiapan masak');

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

  // Effective Date Range based on periodType
  const effectiveDateRange = useMemo(() => {
    if (periodType === 'DAILY') {
      const target = parseExpenseDate(selectedDailyDate);
      return { start: target, end: target, label: `Harian: ${selectedDailyDate}` };
    }

    if (periodType === 'WEEKLY') {
      const s = parseExpenseDate(startDate);
      const e = parseExpenseDate(endDate);
      return { start: s, end: e, label: `Mingguan: ${startDate} s/d ${endDate}` };
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
    return { start: s, end: e, label: `${startDate} s/d ${endDate}` };
  }, [periodType, selectedDailyDate, startDate, endDate, selectedMonth]);

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

  // ==========================================
  // BATCH INPUT LOGIC
  // ==========================================

  const handleAddBatchRows = (count: number = 1) => {
    const newItems: BatchRowItem[] = [];
    for (let i = 0; i < count; i++) {
      newItems.push({
        id: String(Date.now() + Math.random()),
        itemName: '',
        qty: '1',
        unit: 'pack',
        time: defaultCurrentTime,
        volunteer: '',
        category: 'Bahan Peralatan',
        notes: '',
      });
    }
    setBatchRows(prev => [...prev, ...newItems]);
  };

  const handleUpdateBatchRow = (id: string, field: keyof BatchRowItem, value: any) => {
    setBatchRows(prev =>
      prev.map(row => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const handleRemoveBatchRow = (id: string) => {
    setBatchRows(prev => (prev.length > 1 ? prev.filter(row => row.id !== id) : prev));
  };

  const handleParsePastedText = () => {
    if (!pasteRawText.trim()) {
      alert('Tempelkan teks data dari Excel terlebih dahulu.');
      return;
    }

    const lines = pasteRawText.trim().split(/\r?\n/);
    const parsedRows: BatchRowItem[] = [];

    lines.forEach((line, idx) => {
      let cols = line.split('\t');
      if (cols.length === 1 && line.includes(';')) cols = line.split(';');
      else if (cols.length === 1 && line.includes(',')) cols = line.split(',');

      const col0 = (cols[0] || '').trim();
      const col1 = (cols[1] || '').trim();
      const col2 = (cols[2] || '').trim();
      const col3 = (cols[3] || '').trim();
      const col4 = (cols[4] || '').trim();

      if (idx === 0 && (col0.toLowerCase().includes('nama') || col0.toLowerCase().includes('tanggal'))) {
        return;
      }

      let itemName = col0;
      let qty = '1';
      let unit = 'pack';
      let time = defaultCurrentTime;
      let volunteer = '';

      if (cols.length >= 4) {
        if (col0.match(/\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/) || col0.toLowerCase().includes('sept')) {
          itemName = col1;
          qty = col2 || '1';
          time = col3 || defaultCurrentTime;
          volunteer = col4 || '';
        } else {
          itemName = col0;
          qty = col1 || '1';
          time = col2 || defaultCurrentTime;
          volunteer = col3 || '';
        }
      } else if (cols.length >= 2) {
        itemName = col0;
        qty = col1 || '1';
      }

      if (itemName) {
        const cat = normalizeItemCategory(itemName);
        parsedRows.push({
          id: String(Date.now() + Math.random() + idx),
          itemName,
          qty,
          unit,
          time,
          volunteer,
          category: cat,
          notes: '',
        });
      }
    });

    if (parsedRows.length > 0) {
      setBatchRows(parsedRows);
      setBatchInputMode('GRID');
      setPasteRawText('');
      alert(`Berhasil membaca ${parsedRows.length} baris dari teks Excel! Silakan periksa dan klik "Simpan Semua".`);
    } else {
      alert('Tidak ada baris yang valid terdeteksi.');
    }
  };

  const handleSaveAllBatch = (e: React.FormEvent) => {
    e.preventDefault();
    const validRows = batchRows.filter(r => r.itemName.trim() !== '');

    if (validRows.length === 0) {
      alert('Harap isi minimal 1 nama barang pada tabel sebelum menyimpan.');
      return;
    }

    const payload = validRows.map(r => ({
      date: batchDate,
      itemName: r.itemName.trim(),
      category: r.category,
      quantity: r.qty.trim() || '1',
      unit: r.unit.trim() || 'pack',
      time: r.time.trim() || defaultCurrentTime,
      volunteer: r.volunteer.trim() || undefined,
      pic: batchPic.trim() || currentUser.name,
      notes: r.notes.trim() || undefined,
      unitPrice: getItemEstimatedUnitPrice(r.itemName, r.category),
    }));

    warehouseDb.recordNonFoodExpensesBatch(payload, currentUser);
    setSuccessNotice(`Berhasil menyimpan ${validRows.length} barang pengeluaran sekaligus!`);
    setIsBatchModalOpen(false);

    setBatchRows([
      { id: '1', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Bahan Peralatan', notes: '' },
      { id: '2', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Bahan Peralatan', notes: '' },
      { id: '3', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Bahan Peralatan', notes: '' },
      { id: '4', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Bahan Peralatan', notes: '' },
      { id: '5', itemName: '', qty: '1', unit: 'pack', time: defaultCurrentTime, volunteer: '', category: 'Bahan Peralatan', notes: '' },
    ]);
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  // Single Item Logic
  const handleSaveSingleRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleItemName.trim()) {
      alert('Nama barang wajib diisi.');
      return;
    }

    const cleanQty = singleQty.trim() || '1';
    const price = singleUnitPrice > 0 ? singleUnitPrice : getItemEstimatedUnitPrice(singleItemName, singleCategory);

    warehouseDb.recordNonFoodExpense(
      {
        date: selectedDailyDate,
        itemName: singleItemName.trim(),
        category: singleCategory,
        quantity: cleanQty,
        unit: singleUnit,
        time: singleTime.trim() || defaultCurrentTime,
        volunteer: singleVolunteer.trim() || undefined,
        pic: singlePic.trim() || currentUser.name,
        notes: singleNotes.trim() || undefined,
        unitPrice: price,
        totalCost: parseNumericQty(cleanQty) * price,
      },
      currentUser
    );

    setSuccessNotice(`Berhasil mencatat pengeluaran barang: "${singleItemName.trim()}".`);
    setIsSingleModalOpen(false);
    setSingleItemName('');
    setSingleQty('1');
    setSingleVolunteer('');
    setSingleNotes('');
    setTimeout(() => setSuccessNotice(''), 4000);
  };

  // Kitchen Issue Logic
  const handleRecordKitchenIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitchenItemId || kitchenQty <= 0) {
      alert('Pilih bahan dan tentukan jumlah yang valid.');
      return;
    }

    const item = items.find(i => i.id === kitchenItemId);
    if (!item) {
      alert('Bahan tidak ditemukan.');
      return;
    }

    if (item.currentStock < kitchenQty) {
      alert(`Stok tidak mencukupi! Stok tersedia: ${item.currentStock} ${item.baseUnit}`);
      return;
    }

    try {
      warehouseDb.recordConsumption(
        kitchenItemId,
        kitchenQty,
        kitchenDestination,
        currentUser,
        `Sesi ${kitchenMealSession}: ${kitchenNotes}`,
        `BON-DAPUR-${selectedDailyDate}-${Date.now().toString().slice(-4)}`
      );

      setSuccessNotice(`Berhasil mengeluarkan ${kitchenQty} ${item.baseUnit} ${item.name} ke ${kitchenDestination}.`);
      setIsKitchenModalOpen(false);
      setKitchenQty(0);
      setKitchenItemId('');
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal mencatat pengeluaran.');
    }
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
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Alert Notice */}
      {successNotice && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 bg-white p-5 rounded-2xl border shadow-xs">
        <div className="flex items-center gap-3.5">
          <SppgLogo size="md" variant="color" />
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Laporan & Rekap Pengeluaran SPPG Jeru Tumpang
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Monitoring data pengeluaran dan nominal biaya per minggu, bulan, serta rincian per kategori barang.
            </p>
          </div>
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

          {/* Batch Multi-Row Input */}
          <button
            onClick={() => {
              setBatchDate(selectedDailyDate);
              setIsBatchModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer ring-2 ring-emerald-600/20"
          >
            <TableProperties className="w-4 h-4" />
            <span>Input Masal (Banyak Barang)</span>
          </button>

          {/* Single Item Input */}
          <button
            onClick={() => setIsSingleModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-slate-500" />
            <span>Input Satuan</span>
          </button>

          {/* Kitchen Issue */}
          <button
            onClick={() => setIsKitchenModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-white shadow-2xs transition-colors cursor-pointer"
          >
            <Package className="w-3.5 h-3.5 text-slate-300" />
            <span>Keluarkan Bahan Dapur</span>
          </button>
        </div>
      </div>

      {/* Filter Control Box: Period (Minggu, Bulan, Hari) & Categories */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3.5">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
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

      {/* View Switcher: Rekapitulasi Nominal vs Rincian Transaksi */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">Tampilan Data:</span>
          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setActiveSubTab('SUMMARY')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeSubTab === 'SUMMARY' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rekapitulasi Barang & Nominal Biaya
            </button>
            <button
              onClick={() => setActiveSubTab('TRANSACTIONS')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeSubTab === 'TRANSACTIONS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Log Catatan Transaksi Harian
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
        <div className="space-y-6">
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
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
      {/* MODAL 1: BATCH INPUT (BANYAK BARANG SEKALIGUS) */}
      {/* ========================================================================= */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TableProperties className="w-5 h-5 text-emerald-600" />
                  Input Masal Rekap Pengeluaran Barang
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Isi banyak barang sekaligus dalam satu form tabel cepat atau tempel langsung data dari Excel.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-slate-200/80 p-0.5 rounded-lg text-xs">
                  <button
                    type="button"
                    onClick={() => setBatchInputMode('GRID')}
                    className={`px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      batchInputMode === 'GRID' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    Tabel Cepat
                  </button>
                  <button
                    type="button"
                    onClick={() => setBatchInputMode('PASTE')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                      batchInputMode === 'PASTE' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-slate-600'
                    }`}
                  >
                    <ClipboardPaste className="w-3.5 h-3.5" />
                    <span>Tempel dari Excel</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsBatchModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 cursor-pointer ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Rekap Pengeluaran
                  </label>
                  <input
                    type="date"
                    value={batchDate}
                    onChange={e => setBatchDate(e.target.value)}
                    className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    PIC Petugas Gudang
                  </label>
                  <input
                    type="text"
                    value={batchPic}
                    onChange={e => setBatchPic(e.target.value)}
                    placeholder="Nama PIC (contoh: teguh, ade, akmal)..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {batchInputMode === 'GRID' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                            <th className="py-2 px-2 text-center w-8">#</th>
                            <th className="py-2 px-2.5 min-w-[190px]">Nama Barang <span className="text-rose-500">*</span></th>
                            <th className="py-2 px-2 w-32">Kategori</th>
                            <th className="py-2 px-2 w-20">Jumlah</th>
                            <th className="py-2 px-2 w-20">Satuan</th>
                            <th className="py-2 px-2 w-20">Jam</th>
                            <th className="py-2 px-2 min-w-[130px]">Relawan / Pengambil</th>
                            <th className="py-2 px-2 min-w-[130px]">Catatan</th>
                            <th className="py-2 px-1 text-center w-8"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {batchRows.map((row, idx) => (
                            <tr key={row.id} className="hover:bg-slate-50/80">
                              <td className="py-1.5 px-2 text-center text-slate-400 font-mono text-[11px]">
                                {idx + 1}
                              </td>

                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.itemName}
                                  onChange={e => {
                                    const val = e.target.value;
                                    const autoCat = normalizeItemCategory(val);
                                    handleUpdateBatchRow(row.id, 'itemName', val);
                                    if (autoCat) handleUpdateBatchRow(row.id, 'category', autoCat);
                                  }}
                                  placeholder="Nama barang..."
                                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-medium"
                                  list="batch-item-datalist"
                                />
                              </td>

                              <td className="py-1.5 px-2">
                                <select
                                  value={row.category}
                                  onChange={e => handleUpdateBatchRow(row.id, 'category', e.target.value as MainItemCategory)}
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 cursor-pointer font-medium"
                                >
                                  <option value="Bahan Basah">Bahan Basah</option>
                                  <option value="Bahan Kering">Bahan Kering</option>
                                  <option value="Bahan Peralatan">Bahan Peralatan</option>
                                </select>
                              </td>

                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.qty}
                                  onChange={e => handleUpdateBatchRow(row.id, 'qty', e.target.value)}
                                  placeholder="1"
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 text-center"
                                />
                              </td>

                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.unit}
                                  onChange={e => handleUpdateBatchRow(row.id, 'unit', e.target.value)}
                                  placeholder="pack"
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                                  list="batch-unit-datalist"
                                />
                              </td>

                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.time}
                                  onChange={e => handleUpdateBatchRow(row.id, 'time', e.target.value)}
                                  placeholder="19.55"
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700 text-center font-mono"
                                />
                              </td>

                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.volunteer}
                                  onChange={e => handleUpdateBatchRow(row.id, 'volunteer', e.target.value)}
                                  placeholder="Contoh: roni..."
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                                />
                              </td>

                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.notes}
                                  onChange={e => handleUpdateBatchRow(row.id, 'notes', e.target.value)}
                                  placeholder="Opsional..."
                                  className="w-full px-2 py-1.5 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-700"
                                />
                              </td>

                              <td className="py-1.5 px-1 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBatchRow(row.id)}
                                  className="text-slate-300 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                                  title="Hapus baris"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddBatchRows(1)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah 1 Baris</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddBatchRows(5)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Tambah 5 Baris Sekaligus</span>
                      </button>
                    </div>

                    <span className="text-xs text-slate-500 font-medium">
                      {batchRows.filter(r => r.itemName.trim() !== '').length} barang terisi
                    </span>
                  </div>
                </div>
              )}

              {batchInputMode === 'PASTE' && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 leading-relaxed">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-800 mb-1">
                      <Info className="w-4 h-4" />
                      Salin & Tempel Data dari Lembar Excel Anda
                    </div>
                    Blok baris pada spreadsheet Excel Anda, tekan <strong>Ctrl + C</strong>, lalu tempel (<strong>Ctrl + V</strong>) di kotak bawah ini.
                  </div>

                  <textarea
                    rows={8}
                    value={pasteRawText}
                    onChange={e => setPasteRawText(e.target.value)}
                    placeholder="Contoh format teks Excel:&#10;kresek merah	1 pack	19.55	roni&#10;ayam karkas	264 kg	09.00	koki utama&#10;beras pandan wangi	50 kg	08.30	budi"
                    className="w-full p-3 text-xs font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 bg-white"
                  ></textarea>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleParsePastedText}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                    >
                      <TableProperties className="w-4 h-4" />
                      <span>Konversi ke Tabel Masal</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Total barang siap simpan:{' '}
                <strong className="text-slate-800">
                  {batchRows.filter(r => r.itemName.trim() !== '').length} barang
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllBatch}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Simpan Semua ({batchRows.filter(r => r.itemName.trim() !== '').length} Barang) Sekaligus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INPUT SATUAN */}
      {/* ========================================================================= */}
      {isSingleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  Input Rekap Barang Manual (Satuan)
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Catat satu per satu pengeluaran barang ke buku harian.
                </p>
              </div>
              <button
                onClick={() => setIsSingleModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSingleRecord} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Barang <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={singleItemName}
                  onChange={e => {
                    const val = e.target.value;
                    setSingleItemName(val);
                    const autoCat = normalizeItemCategory(val);
                    setSingleCategory(autoCat);
                  }}
                  placeholder="Ketik nama barang..."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  list="batch-item-datalist"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={singleCategory}
                    onChange={e => setSingleCategory(e.target.value as MainItemCategory)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium"
                  >
                    <option value="Bahan Basah">Bahan Basah</option>
                    <option value="Bahan Kering">Bahan Kering</option>
                    <option value="Bahan Peralatan">Bahan Peralatan</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={selectedDailyDate}
                    onChange={e => setSelectedDailyDate(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah (Qty) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={singleQty}
                    onChange={e => setSingleQty(e.target.value)}
                    placeholder="1"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <input
                    type="text"
                    value={singleUnit}
                    onChange={e => setSingleUnit(e.target.value)}
                    placeholder="pack, kg..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    list="batch-unit-datalist"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Jam Ambil</label>
                  <input
                    type="text"
                    value={singleTime}
                    onChange={e => setSingleTime(e.target.value)}
                    placeholder="19.55"
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Harga Satuan (Rp) — Opsional
                </label>
                <input
                  type="number"
                  min="0"
                  value={singleUnitPrice || ''}
                  onChange={e => setSingleUnitPrice(parseFloat(e.target.value) || 0)}
                  placeholder="Estimasi otomatis jika dikosongkan..."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Relawan / Pengambil
                  </label>
                  <input
                    type="text"
                    value={singleVolunteer}
                    onChange={e => setSingleVolunteer(e.target.value)}
                    placeholder="Contoh: roni..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    PIC Petugas Gudang
                  </label>
                  <input
                    type="text"
                    value={singlePic}
                    onChange={e => setSinglePic(e.target.value)}
                    placeholder="Contoh: teguh..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={singleNotes}
                  onChange={e => setSingleNotes(e.target.value)}
                  placeholder="Catatan pengambilan..."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSingleModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: KELUARKAN BAHAN DAPUR */}
      {/* ========================================================================= */}
      {isKitchenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Keluarkan Bahan Pangan ke Dapur</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Memotong stok fisik gudang dan mencatat nomor bon pengeluaran bahan.
                </p>
              </div>
              <button
                onClick={() => setIsKitchenModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordKitchenIssue} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Pilih Bahan Pangan Gudang <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={kitchenItemId}
                  onChange={e => setKitchenItemId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Pilih bahan dari inventaris --</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({normalizeItemCategory(item.category)}) — Stok: {item.currentStock} {item.baseUnit}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah Pengeluaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    value={kitchenQty || ''}
                    onChange={e => setKitchenQty(parseFloat(e.target.value) || 0)}
                    placeholder="Contoh: 15"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sesi Makan
                  </label>
                  <select
                    value={kitchenMealSession}
                    onChange={e => setKitchenMealSession(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="Pagi">Makan Pagi (Sarapan)</option>
                    <option value="Siang">Makan Siang Utama</option>
                    <option value="Snack">Snack Bergizi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tujuan Penyaluran
                </label>
                <input
                  type="text"
                  value={kitchenDestination}
                  onChange={e => setKitchenDestination(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Keterangan / Menu Dapur
                </label>
                <input
                  type="text"
                  value={kitchenNotes}
                  onChange={e => setKitchenNotes(e.target.value)}
                  placeholder="Contoh: Persiapan 1200 porsi sup ayam..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsKitchenModalOpen(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-2xs transition-colors cursor-pointer"
                >
                  Keluarkan & Potong Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Datalists for Autocomplete */}
      <datalist id="batch-item-datalist">
        {items.map(i => (
          <option key={i.id} value={i.name} />
        ))}
      </datalist>

      <datalist id="batch-unit-datalist">
        <option value="pack" />
        <option value="pcs" />
        <option value="kg" />
        <option value="liter" />
        <option value="botol" />
        <option value="kaplet" />
        <option value="dus" />
        <option value="roll" />
        <option value="ikat" />
      </datalist>
    </div>
  );
};
