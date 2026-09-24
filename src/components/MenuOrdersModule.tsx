import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  MenuOrder,
  MenuOrderStatus,
  MenuIngredientReq,
  MenuPoArrivalItem,
  SchoolBeneficiaryAllocation,
  BeneficiaryCategory,
} from '../types/warehouse';
import {
  UtensilsCrossed,
  Plus,
  Printer,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronRight,
  Flame,
  ChefHat,
  Truck,
  Building2,
  GraduationCap,
  CalendarRange,
  FileSpreadsheet,
  Package,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Info,
  Layers,
  HeartHandshake,
  Check,
  Eye,
  X,
  Sparkles,
} from 'lucide-react';
import { exportToExcel } from '../lib/excelExport';
import { SppgLogo } from './SppgLogo';

type PeriodType = 'WEEKLY' | 'MONTHLY' | 'DAILY' | 'ALL';
type SubTabType = 'MENU_ORDERS' | 'BENEFICIARIES' | 'MONTHLY_USAGE';

const DEFAULT_MENU_PRICE_MAP: Record<string, number> = {
  beras: 14500,
  ayam: 38000,
  telur: 28000,
  tahu: 2500,
  tempe: 5000,
  minyak: 18000,
  tropical: 18000,
  susu: 3200,
  wortel: 12000,
  buncis: 12000,
  pakcoy: 8000,
  bayam: 8500,
  kentang: 16000,
  melon: 10000,
  semangka: 8500,
  pisang: 12000,
  kelengkeng: 28000,
  anggur: 35000,
  kacang: 28000,
  gula: 17500,
  mie: 12000,
  lontong: 2000,
  tepung: 11000,
  panir: 15000,
  saos: 16000,
  cabe: 35000,
  bawang: 35000,
};

function estimatePrice(itemName: string, customPrice?: number): number {
  if (customPrice && customPrice > 0) return customPrice;
  const nameLower = (itemName || '').toLowerCase();
  for (const [key, val] of Object.entries(DEFAULT_MENU_PRICE_MAP)) {
    if (nameLower.includes(key)) return val;
  }
  return 15000;
}

function parseNumericQuantity(qty: string | number): number {
  if (typeof qty === 'number') return qty;
  const clean = String(qty).replace(',', '.');
  const match = clean.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 1;
}

function parseMenuDate(dateStr: string): Date | null {
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

export const MenuOrdersModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<MenuOrder[]>(() => warehouseDb.getMenuOrders());
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('MENU_ORDERS');

  // Period filter states
  const [periodType, setPeriodType] = useState<PeriodType>('WEEKLY');
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const defaultWeekStart = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
    return start.toISOString().slice(0, 10);
  }, []);
  const [startDate, setStartDate] = useState<string>(defaultWeekStart);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // YYYY-MM
  );

  // Filters for Tab 1 (Menu Orders)
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Filters for Tab 2 (Beneficiaries & Schools)
  const [selectedBeneficiaryCategory, setSelectedBeneficiaryCategory] = useState<string>('ALL');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');

  // Detail Modal & New Menu Modal states
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<MenuOrder | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [successNotice, setSuccessNotice] = useState('');

  // Expandable cards state for Menu Order items
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({
    'ORD-2026-001': true,
  });

  // Form states for new menu order
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formPoDate, setFormPoDate] = useState('');
  const [formSession, setFormSession] = useState<'Pagi' | 'Siang' | 'Snack'>('Siang');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDietB3, setFormDietB3] = useState('');
  const [formPortions, setFormPortions] = useState<number>(3044);
  const [formChef, setFormChef] = useState('Chef Joko Santoso & Tim Dapur SPPG Jeru Tumpang');
  const [formNotes, setFormNotes] = useState('');

  const refreshOrders = () => {
    setOrders(warehouseDb.getMenuOrders());
  };

  const toggleExpandOrder = (id: string) => {
    setExpandedOrderIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

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

  // Date range evaluation
  const effectiveDateRange = useMemo(() => {
    if (periodType === 'ALL') {
      return { start: null, end: null, label: 'Semua Periode Tercatat' };
    }
    if (periodType === 'DAILY') {
      const target = parseMenuDate(selectedDailyDate);
      return { start: target, end: target, label: `Harian: ${selectedDailyDate}` };
    }
    if (periodType === 'WEEKLY') {
      const s = parseMenuDate(startDate);
      const e = parseMenuDate(endDate);
      return { start: s, end: e, label: `Mingguan: ${startDate} s/d ${endDate}` };
    }
    if (periodType === 'MONTHLY') {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
      ];
      return {
        start: startOfMonth,
        end: endOfMonth,
        label: `Bulan ${monthNames[month - 1] || ''} ${year}`,
      };
    }
    return { start: null, end: null, label: 'Periode Kustom' };
  }, [periodType, selectedDailyDate, startDate, endDate, selectedMonth]);

  // Filtered orders based on active period & filters
  const filteredOrders = useMemo(() => {
    return orders.filter(ord => {
      // 1. Period filter
      if (effectiveDateRange.start && effectiveDateRange.end) {
        const pDate = parseMenuDate(ord.date);
        if (pDate) {
          const itemTime = new Date(pDate.getFullYear(), pDate.getMonth(), pDate.getDate()).getTime();
          const startTime = new Date(effectiveDateRange.start.getFullYear(), effectiveDateRange.start.getMonth(), effectiveDateRange.start.getDate()).getTime();
          const endTime = new Date(effectiveDateRange.end.getFullYear(), effectiveDateRange.end.getMonth(), effectiveDateRange.end.getDate()).getTime();
          if (itemTime < startTime || itemTime > endTime) {
            return false;
          }
        }
      }

      // 2. Session & Status filter
      if (selectedSession !== 'ALL' && ord.mealSession !== selectedSession) return false;
      if (selectedStatus !== 'ALL' && ord.status !== selectedStatus) return false;

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = ord.menuTitle.toLowerCase().includes(q);
        const matchId = ord.id.toLowerCase().includes(q);
        const matchChef = (ord.chefInCharge || '').toLowerCase().includes(q);
        const matchB3 = (ord.specialDietB3 || '').toLowerCase().includes(q);
        const matchNotes = (ord.notes || '').toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchChef && !matchB3 && !matchNotes) return false;
      }

      return true;
    });
  }, [orders, effectiveDateRange, selectedSession, selectedStatus, searchQuery]);

  // Operational metrics for active period
  const stats = useMemo(() => {
    let totalOrders = filteredOrders.length;
    let totalPortionsPlanned = 0;
    let totalPortionsDistributed = 0;
    let inCooking = 0;
    let totalPOItemsCount = 0;
    let totalEstimatedCost = 0;

    filteredOrders.forEach(o => {
      totalPortionsPlanned += o.targetPortions || 0;
      if (o.status === 'DISTRIBUTED' || o.status === 'COMPLETED') {
        totalPortionsDistributed += o.targetPortions || 0;
      }
      if (o.status === 'COOKING' || o.status === 'PREPPING') {
        inCooking++;
      }
      if (o.poArrivalItems) {
        totalPOItemsCount += o.poArrivalItems.length;
        o.poArrivalItems.forEach(item => {
          totalEstimatedCost += item.totalCost || 0;
        });
      } else if (o.keyIngredients) {
        o.keyIngredients.forEach(item => {
          totalEstimatedCost += item.totalCost || 0;
        });
      }
    });

    return {
      totalOrders,
      totalPortionsPlanned,
      totalPortionsDistributed,
      inCooking,
      totalPOItemsCount,
      totalEstimatedCost,
    };
  }, [filteredOrders]);

  // Master schools & beneficiary categories list
  const masterSchools = useMemo<SchoolBeneficiaryAllocation[]>(() => {
    // Get from first available order allocations or fallback to storage default
    const foundOrder = orders.find(o => o.beneficiaryAllocations && o.beneficiaryAllocations.length > 0);
    if (foundOrder && foundOrder.beneficiaryAllocations) {
      return foundOrder.beneficiaryAllocations;
    }
    return warehouseDb.getSchoolBeneficiaries();
  }, [orders]);

  // Filtered schools based on category and search
  const filteredSchools = useMemo(() => {
    return masterSchools.filter(school => {
      if (selectedBeneficiaryCategory !== 'ALL' && school.category !== selectedBeneficiaryCategory) {
        return false;
      }
      if (schoolSearchQuery.trim()) {
        const q = schoolSearchQuery.toLowerCase();
        const matchName = school.schoolName.toLowerCase().includes(q);
        const matchPic = (school.contactPerson || '').toLowerCase().includes(q);
        const matchNotes = (school.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchPic && !matchNotes) return false;
      }
      return true;
    });
  }, [masterSchools, selectedBeneficiaryCategory, schoolSearchQuery]);

  // Beneficiary category summary breakdown
  const beneficiaryCategoryStats = useMemo(() => {
    const categories: Record<string, { category: string; portions: number; schoolCount: number }> = {
      'SD / MI': { category: 'SD / MI', portions: 0, schoolCount: 0 },
      'SMP / MTs': { category: 'SMP / MTs', portions: 0, schoolCount: 0 },
      'PAUD / TK': { category: 'PAUD / TK', portions: 0, schoolCount: 0 },
      'Ibu Hamil & Balita (B3)': { category: 'Ibu Hamil & Balita (B3)', portions: 0, schoolCount: 0 },
    };

    let totalAllPortions = 0;

    masterSchools.forEach(s => {
      const cat = s.category;
      if (!categories[cat]) {
        categories[cat] = { category: cat, portions: 0, schoolCount: 0 };
      }
      categories[cat].portions += s.portionCount;
      categories[cat].schoolCount += 1;
      totalAllPortions += s.portionCount;
    });

    return {
      list: Object.values(categories),
      totalAllPortions,
      totalSchools: masterSchools.length,
    };
  }, [masterSchools]);

  // =========================================================================
  // MONTHLY MATERIAL USAGE & ESTIMATED COST AGGREGATION (INTI PERMINTAAN USER)
  // =========================================================================
  interface MonthlyMaterialAgg {
    itemName: string;
    category: string;
    unit: string;
    totalQty: number;
    estimatedUnitPrice: number;
    totalCost: number;
    frequencyUsed: number;
    percentageOfTotal: number;
  }

  const monthlyMaterialData = useMemo(() => {
    // 1. Gather all menu orders matching selectedMonth
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthOrders = orders.filter(o => {
      const p = parseMenuDate(o.date);
      if (!p) return false;
      return p.getFullYear() === year && p.getMonth() === month - 1;
    });

    const itemMap: Record<string, MonthlyMaterialAgg> = {};
    let grandMonthlyCost = 0;
    let grandTotalPortions = 0;

    monthOrders.forEach(ord => {
      grandTotalPortions += ord.targetPortions || 0;

      // Extract from keyIngredients
      if (ord.keyIngredients && ord.keyIngredients.length > 0) {
        ord.keyIngredients.forEach(ing => {
          const name = (ing.itemName || ing.name || '').trim();
          if (!name) return;

          const nQty = parseNumericQuantity(ing.quantity);
          const price = estimatePrice(name, ing.unitPrice);
          const cost = ing.totalCost && ing.totalCost > 0 ? ing.totalCost : nQty * price;

          if (!itemMap[name]) {
            itemMap[name] = {
              itemName: name,
              category: ing.category || 'Bahan Makanan',
              unit: ing.unit || 'Kg',
              totalQty: 0,
              estimatedUnitPrice: price,
              totalCost: 0,
              frequencyUsed: 0,
              percentageOfTotal: 0,
            };
          }

          itemMap[name].totalQty += nQty;
          itemMap[name].totalCost += cost;
          itemMap[name].frequencyUsed += 1;
          grandMonthlyCost += cost;
        });
      }

      // Extract from poArrivalItems if keyIngredients were empty or additional
      if ((!ord.keyIngredients || ord.keyIngredients.length === 0) && ord.poArrivalItems) {
        ord.poArrivalItems.forEach(po => {
          const name = (po.itemName || '').trim();
          if (!name) return;

          const nQty = parseNumericQuantity(po.qtyArrived || po.qtyOrder);
          const price = estimatePrice(name, po.unitPrice);
          const cost = po.totalCost && po.totalCost > 0 ? po.totalCost : nQty * price;

          if (!itemMap[name]) {
            itemMap[name] = {
              itemName: name,
              category: po.category || 'Bahan Masuk PO',
              unit: 'Kg/Pcs',
              totalQty: 0,
              estimatedUnitPrice: price,
              totalCost: 0,
              frequencyUsed: 0,
              percentageOfTotal: 0,
            };
          }

          itemMap[name].totalQty += nQty;
          itemMap[name].totalCost += cost;
          itemMap[name].frequencyUsed += 1;
          grandMonthlyCost += cost;
        });
      }
    });

    const items = Object.values(itemMap).sort((a, b) => b.totalCost - a.totalCost);

    // Calculate percentage
    items.forEach(i => {
      i.percentageOfTotal = grandMonthlyCost > 0 ? Math.round((i.totalCost / grandMonthlyCost) * 100) : 0;
    });

    return {
      monthLabel: effectiveDateRange.label,
      ordersCount: monthOrders.length,
      grandTotalPortions,
      grandMonthlyCost,
      items,
    };
  }, [orders, selectedMonth, effectiveDateRange]);

  const handleStatusChange = (orderId: string, newStatus: MenuOrderStatus) => {
    try {
      warehouseDb.updateMenuOrderStatus(orderId, newStatus, currentUser);
      refreshOrders();
      setSuccessNotice(`Status menu order #${orderId} berhasil diubah ke: ${newStatus}`);
      setTimeout(() => setSuccessNotice(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status order menu.');
    }
  };

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || formPortions <= 0) {
      alert('Nama menu dan target porsi wajib diisi.');
      return;
    }

    try {
      const newId = `ORD-${Date.now().toString().slice(-6)}`;
      const newOrder: MenuOrder = {
        id: newId,
        date: formDate,
        poDate: formPoDate.trim() || undefined,
        mealSession: formSession,
        menuTitle: formTitle.trim(),
        menuDescription: formDescription.trim(),
        specialDietB3: formDietB3.trim() || undefined,
        targetPortions: formPortions,
        totalBeneficiaries: formPortions,
        status: 'PLANNED',
        chefInCharge: formChef.trim(),
        notes: formNotes.trim(),
        beneficiaryAllocations: masterSchools,
        createdAt: new Date().toISOString(),
      };

      warehouseDb.saveMenuOrder(newOrder, currentUser, true);
      refreshOrders();
      setSuccessNotice(`Berhasil menjadwalkan menu baru: ${newOrder.menuTitle} (${newOrder.targetPortions} porsi).`);
      setIsModalOpen(false);

      // Reset
      setFormTitle('');
      setFormDescription('');
      setFormDietB3('');
      setFormNotes('');
      setTimeout(() => setSuccessNotice(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan menu order.');
    }
  };

  const getStatusBadge = (status: MenuOrderStatus) => {
    switch (status) {
      case 'PLANNED':
        return { label: 'Direncanakan', class: 'bg-slate-100 text-slate-700 border-slate-300' };
      case 'PREPPING':
        return { label: 'Persiapan Bahan', class: 'bg-amber-50 text-amber-800 border-amber-300' };
      case 'COOKING':
        return { label: 'Sedang Dimasak', class: 'bg-orange-50 text-orange-800 border-orange-300' };
      case 'DISTRIBUTED':
        return { label: 'Didistribusikan', class: 'bg-blue-50 text-blue-800 border-blue-300' };
      case 'COMPLETED':
        return { label: 'Selesai & Valid', class: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
      case 'CANCELLED':
        return { label: 'Dibatalkan', class: 'bg-rose-50 text-rose-800 border-rose-300' };
    }
  };

  // Export to Excel based on current sub-tab
  const handleExportExcel = () => {
    if (activeSubTab === 'MENU_ORDERS') {
      const exportRows = filteredOrders.map((ord, idx) => ({
        'No': idx + 1,
        'ID Order': ord.id,
        'Tanggal Menu': ord.date,
        'Tanggal PO (H-1)': ord.poDate || '-',
        'Sesi': ord.mealSession,
        'Nama Menu': ord.menuTitle,
        'Menu Khusus B3': ord.specialDietB3 || '-',
        'Target Porsi': ord.targetPortions,
        'Total Penerima Manfaat': ord.totalBeneficiaries,
        'Status': ord.status,
        'Jumlah Bahan PO': ord.poArrivalItems?.length || 0,
        'PIC Chef': ord.chefInCharge || '-',
        'Catatan': ord.notes || '-',
      }));
      exportToExcel(exportRows, `Rekap_Menu_Gizi_SPPG_${periodType}.xlsx`, 'Rekap Menu & Order');
    } else if (activeSubTab === 'BENEFICIARIES') {
      const exportRows = filteredSchools.map((s, idx) => ({
        'No': idx + 1,
        'Nama Sekolah / Lembaga': s.schoolName,
        'Kategori Jenjang': s.category,
        'Jumlah Porsi / Siswa': s.portionCount,
        'Jadwal Pengiriman': s.deliveryTime || '-',
        'Kontak / PIC Sekolah': s.contactPerson || '-',
        'No. Telepon': s.phone || '-',
        'Status Distribusi': s.status || 'TERKIRIM',
        'Jalur / Keterangan': s.notes || '-',
      }));
      exportToExcel(exportRows, `Laporan_Penerima_Manfaat_Sekolah_${selectedBeneficiaryCategory}.xlsx`, 'Penerima Manfaat Sekolah');
    } else {
      const exportRows = monthlyMaterialData.items.map((item, idx) => ({
        'No': idx + 1,
        'Nama Bahan Makanan': item.itemName,
        'Kategori': item.category,
        'Total Pemakaian Bulan Ini': `${item.totalQty.toLocaleString('id-ID')} ${item.unit}`,
        'Estimasi Harga Satuan (Rp)': item.estimatedUnitPrice,
        'Total Estimasi Pengeluaran (Rp)': item.totalCost,
        '% Porsi Pengeluaran': `${item.percentageOfTotal}%`,
        'Frekuensi Masak': `${item.frequencyUsed} kali`,
      }));
      exportToExcel(exportRows, `Rekap_Bulanan_Bahan_SPPG_${selectedMonth}.xlsx`, 'Pemakaian Bahan Bulanan');
    }
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
              Rekap Order Menu & Penerima Manfaat Gizi
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Monitoring jadwal menu, bahan yang diorder via PO, alokasi sekolah penerima manfaat, dan estimasi biaya bulanan.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export Excel */}
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 shadow-2xs transition-colors cursor-pointer"
            title="Unduh data aktif sebagai format Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Ekspor Excel</span>
          </button>

          {/* Print Report */}
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Cetak Laporan</span>
          </button>

          {/* Add Menu Button */}
          {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.role === 'KA_SPPG') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Jadwalkan Menu Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tab Navigation Bar: 3 Focus Areas */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
        <div className="flex bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('MENU_ORDERS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              activeSubTab === 'MENU_ORDERS'
                ? 'bg-white text-emerald-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" />
            <span>1. Rekap Menu & Bahan (Per Periode)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('BENEFICIARIES')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              activeSubTab === 'BENEFICIARIES'
                ? 'bg-white text-blue-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            <span>2. Penerima Manfaat & Sekolah</span>
          </button>

          <button
            onClick={() => setActiveSubTab('MONTHLY_USAGE')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              activeSubTab === 'MONTHLY_USAGE'
                ? 'bg-white text-amber-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-600" />
            <span>3. Pemakaian Bahan & Estimasi Biaya Bulanan</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium px-2">
          Periode: <strong className="text-slate-800">{effectiveDateRange.label}</strong>
        </div>
      </div>

      {/* Period Filter Control Box (Visible across all tabs) */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-emerald-600" />
            Filter Waktu:
          </span>

          <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
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
              onClick={() => setPeriodType('DAILY')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                periodType === 'DAILY' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Harian
            </button>
            <button
              onClick={() => setPeriodType('ALL')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                periodType === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua
            </button>
          </div>
        </div>

        {/* Date / Month Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {periodType === 'WEEKLY' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSetThisWeek}
                className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer"
              >
                Minggu Ini
              </button>
              <button
                type="button"
                onClick={handleSetLastWeek}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer"
              >
                Minggu Lalu
              </button>
              <span className="text-slate-400 font-medium">|</span>
              <span className="text-slate-500 font-medium">{startDate} s/d {endDate}</span>
            </div>
          )}

          {periodType === 'MONTHLY' && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate-500 font-medium">Bulan:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
              />
            </div>
          )}

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
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: REKAP MENU & BAHAN YANG DIORDER / TERPAKAI */}
      {/* ========================================================================= */}
      {activeSubTab === 'MENU_ORDERS' && (
        <div className="space-y-5">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Total Sesi Menu</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {stats.totalOrders} <span className="text-xs font-normal text-slate-500">sesi</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Jadwal masak periode terpilih</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Total Porsi Sasaran</div>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {stats.totalPortionsPlanned.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-slate-500">porsi</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {stats.totalPortionsDistributed.toLocaleString('id-ID')} porsi tersalurkan
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Item Bahan Diorder via PO</div>
              <div className="text-xl font-bold text-blue-700 mt-1">
                {stats.totalPOItemsCount} <span className="text-xs font-normal text-slate-500">item PO</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Penerimaan & timbang bahan baku</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Estimasi Biaya Menu</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                Rp {stats.totalEstimatedCost.toLocaleString('id-ID')}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Total bahan masak periode ini</div>
            </div>
          </div>

          {/* Filter Bar: Session, Status, & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSession}
                onChange={e => setSelectedSession(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
              >
                <option value="ALL">Semua Sesi Makan</option>
                <option value="Pagi">Sarapan (Pagi)</option>
                <option value="Siang">Makan Siang</option>
                <option value="Snack">Snack Bergizi</option>
              </select>

              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
              >
                <option value="ALL">Semua Status Masak</option>
                <option value="PLANNED">Direncanakan</option>
                <option value="PREPPING">Persiapan Bahan</option>
                <option value="COOKING">Sedang Dimasak</option>
                <option value="DISTRIBUTED">Didistribusikan</option>
                <option value="COMPLETED">Selesai & Valid</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama menu, bahan, chef..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
              >
              </input>
            </div>
          </div>

          {/* List of Menu Orders */}
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs italic bg-white border border-slate-200 rounded-xl">
              Tidak ada jadwal order menu yang ditemukan pada periode terpilih.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map(order => {
                const statusMeta = getStatusBadge(order.status);
                const isExpanded = !!expandedOrderIds[order.id];

                // Calculate total PO arrival cost for this order
                const orderPoCost = (order.poArrivalItems || []).reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
                const orderIngredientCost = (order.keyIngredients || []).reduce((acc, curr) => acc + (curr.totalCost || 0), 0);
                const effectiveOrderCost = orderPoCost > 0 ? orderPoCost : orderIngredientCost;

                return (
                  <div
                    key={order.id}
                    className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs transition-all"
                  >
                    {/* Order Card Header */}
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${statusMeta.class}`}>
                            {statusMeta.label}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            Sesi {order.mealSession}
                          </span>
                          <span className="text-xs font-mono text-slate-400">#{order.id}</span>
                          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {order.date}
                          </span>
                          {order.poDate && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              (PO H-1: {order.poDate})
                            </span>
                          )}
                        </div>

                        <h2 className="text-base font-bold text-slate-900 mt-1">
                          {order.menuTitle}
                        </h2>

                        {order.specialDietB3 && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium mt-1">
                            <HeartHandshake className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span><strong>Menu Khusus B3 (Balita & Bumil):</strong> {order.specialDietB3}</span>
                          </div>
                        )}
                      </div>

                      {/* Right Portion & Action Buttons */}
                      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                        <div className="text-left lg:text-right">
                          <div className="text-lg font-bold text-slate-900">
                            {order.targetPortions.toLocaleString('id-ID')}{' '}
                            <span className="text-xs font-normal text-slate-500">Porsi</span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Estimasi Biaya: <strong className="text-slate-800">Rp {effectiveOrderCost.toLocaleString('id-ID')}</strong>
                          </div>
                        </div>

                        {/* Status Action Buttons */}
                        {(currentUser.role === 'ASLAP' || currentUser.role === 'ADMIN' || currentUser.role === 'SUPERADMIN' || currentUser.role === 'KA_SPPG') && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {order.status === 'PLANNED' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'PREPPING')}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer"
                              >
                                Mulai Persiapan Bahan
                              </button>
                            )}
                            {order.status === 'PREPPING' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'COOKING')}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-orange-600 hover:bg-orange-700 text-white transition-colors cursor-pointer"
                              >
                                Mulai Memasak
                              </button>
                            )}
                            {order.status === 'COOKING' && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'DISTRIBUTED')}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                              >
                                Distribusikan Porsi
                              </button>
                            )}
                            {order.status === 'DISTRIBUTED' && (currentUser.role === 'KA_SPPG' || currentUser.role === 'SUPERADMIN' || currentUser.role === 'ADMIN') && (
                              <button
                                onClick={() => handleStatusChange(order.id, 'COMPLETED')}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer"
                              >
                                Tandai Selesai & Valid
                              </button>
                            )}
                          </div>
                        )}

                        {/* Expand / Collapse Button */}
                        <button
                          onClick={() => toggleExpandOrder(order.id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                          title={isExpanded ? 'Tutup rincian' : 'Buka rincian'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Content: PO Arrival Items & Material Consumption */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 space-y-4 bg-slate-50/50">
                        {/* Section 1: Bahan yang Sudah Di-Order (PO Kedatangan Bahan) */}
                        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                          <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-blue-600" />
                              Bahan yang Diorder & Kedatangan PO ({order.poArrivalItems?.length || 0} item)
                            </span>
                            <span className="text-[11px] font-medium text-slate-500">
                              Dicatat oleh PIC Gudang & QC
                            </span>
                          </div>

                          {!order.poArrivalItems || order.poArrivalItems.length === 0 ? (
                            <div className="p-4 text-center text-slate-400 text-xs italic">
                              Belum ada rincian kedatangan PO untuk menu ini.
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                                    <th className="py-2 px-3 w-10 text-center">No</th>
                                    <th className="py-2 px-3">Kategori</th>
                                    <th className="py-2 px-3">Nama Bahan</th>
                                    <th className="py-2 px-3 text-right">Qty Order</th>
                                    <th className="py-2 px-3 text-right">Datang & Timbang</th>
                                    <th className="py-2 px-3">Supplier Rekanan</th>
                                    <th className="py-2 px-3 text-center">Jam Tiba</th>
                                    <th className="py-2 px-3 text-right">Estimasi Biaya (Rp)</th>
                                    <th className="py-2 px-3">PIC</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {order.poArrivalItems.map((po, pIdx) => (
                                    <tr key={pIdx} className="hover:bg-slate-50 transition-colors">
                                      <td className="py-2 px-3 text-center text-slate-400 font-medium">{pIdx + 1}</td>
                                      <td className="py-2 px-3">
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                          {po.category || 'Bahan Makanan'}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 font-bold text-slate-900">{po.itemName}</td>
                                      <td className="py-2 px-3 text-right font-medium text-slate-600">{po.qtyOrder || '-'}</td>
                                      <td className="py-2 px-3 text-right font-bold text-emerald-800">{po.qtyArrived || '-'}</td>
                                      <td className="py-2 px-3 font-medium text-slate-700">{po.supplier || 'Pemasok Lokal'}</td>
                                      <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-600">{po.arrivalTime || '-'}</td>
                                      <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                                        Rp {(po.totalCost || 0).toLocaleString('id-ID')}
                                      </td>
                                      <td className="py-2 px-3 text-slate-600 text-[11px]">{po.pic || 'Akmal'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Section 2: Pemakaian Bahan Masak (Resep Kebutuhan Masak) */}
                        {order.keyIngredients && order.keyIngredients.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                            <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-orange-600" />
                                Pemakaian Bahan Olahan Dapur ({order.keyIngredients.length} item bahan)
                              </span>
                              <span className="text-[11px] font-mono font-bold text-slate-800">
                                Subtotal Pemakaian: Rp {orderIngredientCost.toLocaleString('id-ID')}
                              </span>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                                    <th className="py-2 px-3 w-10 text-center">No</th>
                                    <th className="py-2 px-3">Nama Bahan</th>
                                    <th className="py-2 px-3">Kategori</th>
                                    <th className="py-2 px-3 text-right">Volume / Qty Terpakai</th>
                                    <th className="py-2 px-3 text-right">Estimasi Harga Satuan</th>
                                    <th className="py-2 px-3 text-right">Subtotal Biaya (Rp)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {order.keyIngredients.map((ing, iIdx) => (
                                    <tr key={iIdx} className="hover:bg-slate-50 transition-colors">
                                      <td className="py-2 px-3 text-center text-slate-400 font-medium">{iIdx + 1}</td>
                                      <td className="py-2 px-3 font-bold text-slate-900">{ing.itemName || ing.name}</td>
                                      <td className="py-2 px-3 text-slate-500 font-medium">{ing.category || 'Bahan Masak'}</td>
                                      <td className="py-2 px-3 text-right font-medium text-slate-800">
                                        {ing.quantity} {ing.unit}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-slate-600 text-[11px]">
                                        Rp {(ing.unitPrice || 0).toLocaleString('id-ID')}
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                        Rp {(ing.totalCost || 0).toLocaleString('id-ID')}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Section 3: Summary Alokasi Sekolah Ringkas */}
                        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-slate-200 rounded-xl text-xs">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="w-4 h-4 text-emerald-600" />
                            <span className="font-semibold text-slate-800">
                              Didistribusikan ke: 14 Sekolah & Posyandu Sasaran
                            </span>
                            <span className="text-slate-400">|</span>
                            <span className="text-slate-500">
                              Kecamatan Tumpang (SDN 1 Jeru, SMPN 1 Tumpang, Posyandu B3, dsb.)
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedOrderForDetail(order);
                            }}
                            className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Lihat Rincian Alokasi Sekolah</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: LAPORAN PENERIMA MANFAAT & SEKOLAH (SESUAI PERMINTAAN USER) */}
      {/* ========================================================================= */}
      {activeSubTab === 'BENEFICIARIES' && (
        <div className="space-y-5">
          {/* KPI Beneficiary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Total Penerima Manfaat</div>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {beneficiaryCategoryStats.totalAllPortions.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-slate-500">anak/hari</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Program Makan Bergizi Gratis SPPG Jeru Tumpang</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Jumlah Sekolah / Titik Gizi</div>
              <div className="text-xl font-bold text-blue-700 mt-1">
                {beneficiaryCategoryStats.totalSchools}{' '}
                <span className="text-xs font-normal text-slate-500">lembaga</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">SD, SMP, PAUD, & Posyandu B3</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Rata-Rata Porsi / Sekolah</div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {Math.round(beneficiaryCategoryStats.totalAllPortions / beneficiaryCategoryStats.totalSchools)}{' '}
                <span className="text-xs font-normal text-slate-500">porsi</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Kapasitas serap harian per titik</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Wilayah Satuan Pelayanan</div>
              <div className="text-base font-bold text-slate-900 mt-1">
                Kec. Tumpang
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Sentra SPPG Jeru Tumpang Kab. Malang</div>
            </div>
          </div>

          {/* Breakdown Cards by 4 Categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {beneficiaryCategoryStats.list.map(cat => {
              const pct = beneficiaryCategoryStats.totalAllPortions > 0
                ? Math.round((cat.portions / beneficiaryCategoryStats.totalAllPortions) * 100)
                : 0;

              return (
                <div
                  key={cat.category}
                  onClick={() => setSelectedBeneficiaryCategory(cat.category)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer shadow-2xs ${
                    selectedBeneficiaryCategory === cat.category
                      ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-emerald-500'
                      : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{cat.category}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      selectedBeneficiaryCategory === cat.category ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {pct}%
                    </span>
                  </div>
                  <div className={`text-lg font-bold mt-1 ${
                    selectedBeneficiaryCategory === cat.category ? 'text-white' : 'text-slate-900'
                  }`}>
                    {cat.portions.toLocaleString('id-ID')} <span className="text-xs font-normal opacity-70">porsi</span>
                  </div>
                  <div className="text-[11px] opacity-70 mt-0.5">
                    {cat.schoolCount} sekolah / lembaga
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter Bar: Category Tabs & Search Box */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedBeneficiaryCategory('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedBeneficiaryCategory === 'ALL'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Semua Kategori ({masterSchools.length} Sekolah)
              </button>

              <button
                onClick={() => setSelectedBeneficiaryCategory('SD / MI')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedBeneficiaryCategory === 'SD / MI'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-blue-800 hover:bg-blue-50 border border-blue-200'
                }`}
              >
                SD / MI (6 Sekolah)
              </button>

              <button
                onClick={() => setSelectedBeneficiaryCategory('SMP / MTs')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedBeneficiaryCategory === 'SMP / MTs'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-800 hover:bg-emerald-50 border border-emerald-200'
                }`}
              >
                SMP / MTs (3 Sekolah)
              </button>

              <button
                onClick={() => setSelectedBeneficiaryCategory('PAUD / TK')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedBeneficiaryCategory === 'PAUD / TK'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-amber-800 hover:bg-amber-50 border border-amber-200'
                }`}
              >
                PAUD / TK (3 Lembaga)
              </button>

              <button
                onClick={() => setSelectedBeneficiaryCategory('Ibu Hamil & Balita (B3)')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedBeneficiaryCategory === 'Ibu Hamil & Balita (B3)'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-800 hover:bg-rose-50 border border-rose-200'
                }`}
              >
                Ibu Hamil & Balita B3 (2 Posyandu)
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama sekolah, PIC, alamat..."
                value={schoolSearchQuery}
                onChange={e => setSchoolSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
              />
            </div>
          </div>

          {/* School Beneficiaries Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-700" />
                <h2 className="text-xs font-bold text-slate-900">
                  Daftar Sekolah & Titik Alokasi Penerima Manfaat ({filteredSchools.length} Titik)
                </h2>
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Total Porsi Terfilter:{' '}
                <strong className="text-emerald-700 font-bold font-mono">
                  {filteredSchools.reduce((acc, s) => acc + s.portionCount, 0).toLocaleString('id-ID')} Porsi
                </strong>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Sekolah / Lembaga</th>
                    <th className="py-2.5 px-3">Kategori Jenjang</th>
                    <th className="py-2.5 px-3 text-right">Alokasi Siswa / Porsi</th>
                    <th className="py-2.5 px-3 text-center">Jadwal Pengiriman</th>
                    <th className="py-2.5 px-3">Kontak / PIC Sekolah</th>
                    <th className="py-2.5 px-3">Status Pengiriman</th>
                    <th className="py-2.5 px-3">Jalur Distribusi & Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchools.map((school, sIdx) => {
                    const badgeClass =
                      school.category === 'SD / MI'
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : school.category === 'SMP / MTs'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : school.category === 'PAUD / TK'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200';

                    return (
                      <tr key={school.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 text-center text-slate-400 font-medium">{sIdx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {school.schoolName}
                          <div className="text-[10px] text-slate-400 font-mono font-normal">{school.id}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
                            {school.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono text-sm">
                          {school.portionCount.toLocaleString('id-ID')}{' '}
                          <span className="text-[10px] font-normal text-slate-500">anak</span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-700">
                          {school.deliveryTime || '09.30 WIB'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          <div className="font-medium">{school.contactPerson || '-'}</div>
                          <div className="text-[10px] text-slate-400">{school.phone || '-'}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Check className="w-3 h-3 text-emerald-700" />
                            {school.status || 'TERKIRIM'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate" title={school.notes}>
                          {school.notes || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REKAP BULANAN PEMAKAIAN BAHAN & ESTIMASI BIAYA (INTI PERMINTAAN USER) */}
      {/* ========================================================================= */}
      {activeSubTab === 'MONTHLY_USAGE' && (
        <div className="space-y-5">
          {/* Monthly KPI Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">
                Estimasi Total Pengeluaran Bulan Ini
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                Rp {monthlyMaterialData.grandMonthlyCost.toLocaleString('id-ID')}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Bulan: <strong>{monthlyMaterialData.monthLabel}</strong>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">
                Total Porsi Disalurkan
              </div>
              <div className="text-xl font-bold text-emerald-700 mt-1">
                {monthlyMaterialData.grandTotalPortions.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-slate-500">porsi</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {monthlyMaterialData.ordersCount} hari / sesi memasak
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">
                Ragam Komoditas Bahan Digunakan
              </div>
              <div className="text-xl font-bold text-blue-700 mt-1">
                {monthlyMaterialData.items.length}{' '}
                <span className="text-xs font-normal text-slate-500">jenis bahan</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Protein, beras, sayur, buah & bumbu
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">
                Rata-Rata Biaya Bahan / Porsi
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                Rp{' '}
                {monthlyMaterialData.grandTotalPortions > 0
                  ? Math.round(monthlyMaterialData.grandMonthlyCost / monthlyMaterialData.grandTotalPortions).toLocaleString('id-ID')
                  : 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Anggaran bahan pangan per anak
              </div>
            </div>
          </div>

          {/* Monthly Material Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-emerald-600" />
                  Rekapitulasi Total Pemakaian Bahan Makanan Tiap Bulan ({monthlyMaterialData.monthLabel})
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Akumulasi kuantitas fisik bahan yang digunakan serta perkalian estimasi nominal pengeluaran bulanan.
                </p>
              </div>

              <div className="text-xs font-semibold text-slate-600">
                Total Anggaran Terpakai:{' '}
                <strong className="font-mono text-sm font-bold text-emerald-700">
                  Rp {monthlyMaterialData.grandMonthlyCost.toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            {monthlyMaterialData.items.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs italic">
                Belum ada data pemakaian bahan makanan pada bulan terpilih.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-semibold text-slate-600">
                      <th className="py-2.5 px-4 w-12 text-center">No</th>
                      <th className="py-2.5 px-4">Nama Bahan Makanan</th>
                      <th className="py-2.5 px-4">Kategori Bahan</th>
                      <th className="py-2.5 px-4 text-right">Total Pemakaian Bulan Ini</th>
                      <th className="py-2.5 px-4 text-right">Estimasi Harga Satuan Acuan</th>
                      <th className="py-2.5 px-4 text-right">Total Nominal Biaya (Rp)</th>
                      <th className="py-2.5 px-4 text-center w-32">% Porsi Anggaran</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthlyMaterialData.items.map((item, idx) => (
                      <tr key={item.itemName} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 text-center text-slate-400 font-medium">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">
                          {item.itemName}
                          <div className="text-[10px] text-slate-400 font-normal">
                            Digunakan dalam {item.frequencyUsed} sesi masak
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium text-slate-800">
                          {item.totalQty.toLocaleString('id-ID')} {item.unit}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-600 text-[11px]">
                          Rp {item.estimatedUnitPrice.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                          Rp {item.totalCost.toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <div className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                            <div className="w-14 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="h-1.5 rounded-full bg-emerald-600"
                                style={{ width: `${item.percentageOfTotal}%` }}
                              ></div>
                            </div>
                            <span className="text-[11px] font-mono">{item.percentageOfTotal}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RINCIAN DETAIL MENU & ALOKASI SEKOLAH */}
      {/* ========================================================================= */}
      {selectedOrderForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Rincian Alokasi Sekolah: {selectedOrderForDetail.menuTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tanggal: <strong>{selectedOrderForDetail.date}</strong> • Total Porsi:{' '}
                  <strong>{selectedOrderForDetail.targetPortions.toLocaleString('id-ID')} Siswa</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-[11px] font-semibold text-slate-700">
                      <th className="py-2.5 px-3 w-10 text-center">No</th>
                      <th className="py-2.5 px-3">Nama Sekolah / Posyandu</th>
                      <th className="py-2.5 px-3">Jenjang</th>
                      <th className="py-2.5 px-3 text-right">Alokasi Porsi</th>
                      <th className="py-2.5 px-3 text-center">Jam Distribusi</th>
                      <th className="py-2.5 px-3">PIC Sekolah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedOrderForDetail.beneficiaryAllocations || masterSchools).map((s, idx) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{s.schoolName}</td>
                        <td className="py-2 px-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {s.category}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-800 font-mono">
                          {s.portionCount.toLocaleString('id-ID')} porsi
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-600">{s.deliveryTime || '09.30 WIB'}</td>
                        <td className="py-2 px-3 text-slate-700">{s.contactPerson || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3.5 border-t border-slate-200 flex justify-end bg-slate-50">
              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: JADWALKAN MENU BARU */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
                  Jadwalkan Menu Baru SPPG Jeru Tumpang
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tambahkan jadwal olahan menu dan alokasi porsi sasaran penerima manfaat.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Penyajian Menu *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tanggal Order PO (H-1)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Minggu, 19 Sept 2026"
                    value={formPoDate}
                    onChange={e => setFormPoDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Sesi Makan *
                  </label>
                  <select
                    value={formSession}
                    onChange={e => setFormSession(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 bg-white"
                  >
                    <option value="Pagi">Sarapan (Pagi)</option>
                    <option value="Siang">Makan Siang Utama</option>
                    <option value="Snack">Snack Gizi</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Total Porsi *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formPortions}
                    onChange={e => setFormPortions(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Menu Utama *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Nasi Putih, Ayam Krispi Sambal & Selada, Tahu Cabe Garam"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Menu Khusus Balita & Bumil (B3)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Ayam Fillet Suwir Lembut, Orak-Arik Telur, Buah Melon Halus"
                  value={formDietB3}
                  onChange={e => setFormDietB3(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chef / Penanggung Jawab Dapur
                </label>
                <input
                  type="text"
                  value={formChef}
                  onChange={e => setFormChef(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Distribusi / Khusus
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Distribusi menggunakan armada box steril jalur 1 & 2."
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs cursor-pointer"
                >
                  Simpan Jadwal Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
