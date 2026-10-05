import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { warehouseDb } from '../db/storage';
import {
  MenuOrder,
  MenuOrderStatus,
  MenuIngredientReq,
  MenuPoArrivalItem,
  SchoolBeneficiaryAllocation,
  PurchaseOrderNota,
  PurchaseOrderItem,
} from '../types/warehouse';
import { generateNextPoNumber } from '../utils/poNumberGenerator';
import { angkaTerbilang } from './ToolsPrintModule';
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
  ChevronLeft,
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
  Edit2,
  Trash2,
  Scale,
  Table as TableIcon,
  Filter,
  ShoppingBag,
  PackagePlus,
  ArrowRight,
  Store,
  CheckSquare,
  Phone,
  MoreHorizontal
} from 'lucide-react';
import { exportMultiSheetExcel, exportToExcel } from '../lib/excelExport';

type PeriodType = 'WEEKLY' | 'MONTHLY' | 'DAILY' | 'ALL' | 'PRESET_SAMPLE';
type SubTabType = 'MENU_ORDERS' | 'BENEFICIARIES' | 'MASTER_BENEFICIARIES';

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
  return match ? parseFloat(match[0]) : 0;
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

const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    const d = parseMenuDate(dateStr);
    if (!d) return dateStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const shortYear = String(d.getFullYear()).slice(-2);
    return `${d.getDate()}-${months[d.getMonth()]}-${shortYear}`;
  } catch {
    return dateStr;
  }
};

const formatIndonesianDate = (dateStr: string): string => {
  const d = parseMenuDate(dateStr);
  if (!d) return dateStr;
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

// Helper untuk memecah daftar menu menjadi komponen visual yang mudah dibaca
interface ParsedDish {
  name: string;
  category: string;
}

function parseDishItems(menuStr: string): ParsedDish[] {
  if (!menuStr) return [];
  const rawList = menuStr
    .split(/[,+;\n]/)
    .map(s => s.trim())
    .filter(Boolean);

  return rawList.map(name => {
    const lower = name.toLowerCase();
    let category = 'Pelengkap';

    if (lower.includes('nasi') || lower.includes('karbo') || lower.includes('lontong') || lower.includes('mie') || lower.includes('bihun')) {
      category = 'Karbohidrat Pokok';
    } else if (lower.includes('ayam') || lower.includes('daging') || lower.includes('sapi') || lower.includes('ikan') || lower.includes('telur') || lower.includes('rolade') || lower.includes('nugget') || lower.includes('katsu') || lower.includes('semur') || lower.includes('woku')) {
      category = 'Lauk Protein Hewani';
    } else if (lower.includes('tahu') || lower.includes('tempe') || lower.includes('kacang') || lower.includes('mendoan')) {
      category = 'Lauk Protein Nabati';
    } else if (lower.includes('sayur') || lower.includes('sop') || lower.includes('sup') || lower.includes('tumis') || lower.includes('buncis') || lower.includes('wortel') || lower.includes('pokcoy') || lower.includes('pakcoy') || lower.includes('bayam') || lower.includes('lodeh') || lower.includes('steam') || lower.includes('jagung') || lower.includes('capcay')) {
      category = 'Sayuran Berserat';
    } else if (lower.includes('semangka') || lower.includes('melon') || lower.includes('pisang') || lower.includes('jeruk') || lower.includes('buah') || lower.includes('kelengkeng') || lower.includes('anggur') || lower.includes('pepaya') || lower.includes('apel')) {
      category = 'Buah Segar';
    } else if (lower.includes('susu') || lower.includes('puding') || lower.includes('snack')) {
      category = 'Susu & Minuman Gizi';
    }

    return { name, category };
  });
}

// Template cepat untuk PO bahan standar SPPG
const STANDARD_PO_TEMPLATES = [
  { category: 'Protein', itemName: 'Ayam Potong', qtyOrder: '260 kg', qtyArrived: '260 kg', supplier: 'Ayam Segar Fajar', arrivalTime: '08.30', pic: 'Akmal' },
  { category: 'Protein', itemName: 'Tahu Putih', qtyOrder: '520 pcs', qtyArrived: '520 pcs', supplier: 'Tahu Rio', arrivalTime: '09.30', pic: 'Akmal' },
  { category: 'Sembako', itemName: 'Beras Mentari 25kg', qtyOrder: '7 sak', qtyArrived: '7 sak', supplier: 'Tumpang Grosir', arrivalTime: '14.00', pic: 'Akmal' },
  { category: 'Sembako', itemName: 'Minyak Tropical 2L', qtyOrder: '12 pouch', qtyArrived: '12 pouch', supplier: 'Tumpang Grosir', arrivalTime: '14.00', pic: 'Akmal' },
  { category: 'Sayur dan Buah', itemName: 'Buncis Segar', qtyOrder: '45 kg', qtyArrived: '45 kg', supplier: 'Sayur Segar Malang', arrivalTime: '07.30', pic: 'Akmal' },
  { category: 'Sayur dan Buah', itemName: 'Wortel Manis', qtyOrder: '35 kg', qtyArrived: '35 kg', supplier: 'Sayur Segar Malang', arrivalTime: '07.30', pic: 'Akmal' },
  { category: 'Sayur dan Buah', itemName: 'Semangka Non-Biji', qtyOrder: '180 kg', qtyArrived: '180 kg', supplier: 'Buah Segar Nusantara', arrivalTime: '10.00', pic: 'Akmal' },
  { category: 'Bumbu', itemName: 'Bawang Putih Kating', qtyOrder: '8 kg', qtyArrived: '8 kg', supplier: 'Toko Bumbu Berkah', arrivalTime: '08.00', pic: 'Akmal' },
];

const getTodayIso = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface MenuOrdersModuleProps {
  onNavigate?: (tab: string) => void;
}

export const MenuOrdersModule: React.FC<MenuOrdersModuleProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<MenuOrder[]>(() => warehouseDb.getMenuOrders());
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('MENU_ORDERS');

  // Tanggal Hari Ini (otomatis sesuai jam sistem)
  const todayStr = useMemo(() => getTodayIso(), []);

  // Period filter states: DEFAULT KE HARI INI (DAILY)
  const [periodType, setPeriodType] = useState<PeriodType>('DAILY');
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>('2026-09-20');
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7)); // YYYY-MM

  // Filters for Tab 1 (Menu Orders)
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Filters for Tab 2 (Penerima Manfaat)
  const [selectedBeneficiaryCategory, setSelectedBeneficiaryCategory] = useState<string>('ALL');
  const [beneficiaryStatusFilter, setBeneficiaryStatusFilter] = useState<string>('ALL');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');

  // Master beneficiaries state (persisted via storage.ts)
  const [beneficiaries, setBeneficiaries] = useState<SchoolBeneficiaryAllocation[]>(() =>
    warehouseDb.getSchoolBeneficiaries()
  );

  // Beneficiary Modal State (Edit & Create)
  const [isBeneficiaryModalOpen, setIsBeneficiaryModalOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<SchoolBeneficiaryAllocation | null>(null);
  const [beneficiaryFormId, setBeneficiaryFormId] = useState('');
  const [beneficiaryFormName, setBeneficiaryFormName] = useState('');
  const [beneficiaryFormCategory, setBeneficiaryFormCategory] = useState<string>('SD / MI');
  const [beneficiaryFormPortions, setBeneficiaryFormPortions] = useState<number>(300);
  const [beneficiaryFormDeliveryTime, setBeneficiaryFormDeliveryTime] = useState('09.45 WIB');
  const [beneficiaryFormContactPerson, setBeneficiaryFormContactPerson] = useState('');
  const [beneficiaryFormPhone, setBeneficiaryFormPhone] = useState('');
  const [beneficiaryFormStatus, setBeneficiaryFormStatus] = useState<'TERKIRIM' | 'DALAM_PERJALANAN' | 'SIAP_KIRIM' | 'DIJADWALKAN'>('DIJADWALKAN');
  const [beneficiaryFormNotes, setBeneficiaryFormNotes] = useState('');

  // Filters for Tab 3 (Master Data Penerima Manfaat)
  const [masterCategoryFilter, setMasterCategoryFilter] = useState<string>('ALL');
  const [masterSearchQuery, setMasterSearchQuery] = useState<string>('');

  // Expandable cards state for Menu Order items
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({
    'ORD-2026-001': true,
    'ORD-2026-002': true,
    'ORD-2026-003': true,
    'ORD-2026-004': true,
    'ORD-2026-005': true,
    'ORD-2026-006': true,
  });

  // Notification notice
  const [successNotice, setSuccessNotice] = useState('');

  // Action Dropdowns
  const [isInputDropdownOpen, setIsInputDropdownOpen] = useState(false);
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState(false);
  const [openOrderMenuId, setOpenOrderMenuId] = useState<string | null>(null);
  const actionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(event.target as Node)) {
        setIsInputDropdownOpen(false);
        setIsPrintDropdownOpen(false);
      }
      const target = event.target as HTMLElement;
      if (!target.closest('.order-action-menu-container')) {
        setOpenOrderMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navigasi Tanggal (Kemarin, Hari Ini, Besok)
  const handlePrevDay = () => {
    const cur = parseMenuDate(selectedDailyDate) || new Date();
    cur.setDate(cur.getDate() - 1);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    setSelectedDailyDate(`${y}-${m}-${d}`);
    setPeriodType('DAILY');
  };

  const handleNextDay = () => {
    const cur = parseMenuDate(selectedDailyDate) || new Date();
    cur.setDate(cur.getDate() + 1);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    setSelectedDailyDate(`${y}-${m}-${d}`);
    setPeriodType('DAILY');
  };

  const handleJumpToToday = () => {
    setSelectedDailyDate(todayStr);
    setPeriodType('DAILY');
  };

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



  // =========================================================================
  // MODAL 1: FORM INPUT / EDIT MENU HARI INI
  // =========================================================================
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenuOrderId, setEditingMenuOrderId] = useState<string | null>(null);

  const [menuFormDate, setMenuFormDate] = useState(todayStr);
  const [menuFormPoDate, setMenuFormPoDate] = useState('');
  const [menuFormSession, setMenuFormSession] = useState<'Pagi' | 'Siang' | 'Snack'>('Siang');
  const [menuFormTitle, setMenuFormTitle] = useState('');
  const [menuFormDietB3, setMenuFormDietB3] = useState('');
  const [menuFormPortions, setMenuFormPortions] = useState<number>(3044);
  const [menuFormStatus, setMenuFormStatus] = useState<MenuOrderStatus>('PLANNED');
  const [menuFormChef, setMenuFormChef] = useState('Chef Joko Santoso & Tim Dapur SPPG Jeru Tumpang');
  const [menuFormNotes, setMenuFormNotes] = useState('');

  // =========================================================================
  // MODAL 2: FORM INPUT / EDIT PO HARI INI & KEDATANGAN BARANG
  // =========================================================================
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedPoOrderId, setSelectedPoOrderId] = useState<string>('');
  const [poFormDate, setPoFormDate] = useState('');
  const [poFormRows, setPoFormRows] = useState<Array<{
    category: string;
    itemName: string;
    qtyOrder: string;
    qtyArrived: string;
    supplier: string;
    arrivalTime: string;
    pic: string;
    notes?: string;
  }>>([]);

  const refreshOrders = () => {
    setOrders(warehouseDb.getMenuOrders());
  };

  const toggleExpandOrder = (id: string) => {
    setExpandedOrderIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Date range evaluation
  const effectiveDateRange = useMemo(() => {
    if (periodType === 'PRESET_SAMPLE') {
      const s = parseMenuDate('2026-09-20');
      const e = parseMenuDate('2026-09-24');
      return { start: s, end: e, label: 'Periode 20 - 24 Sep 2026 (Data Excel SPPG)' };
    }
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
        const matchItems = (ord.poArrivalItems || []).some(
          it => it.itemName.toLowerCase().includes(q) || it.supplier.toLowerCase().includes(q)
        );
        if (!matchTitle && !matchId && !matchChef && !matchB3 && !matchNotes && !matchItems) return false;
      }

      return true;
    }).sort((a, b) => {
      const da = parseMenuDate(a.date)?.getTime() || 0;
      const db = parseMenuDate(b.date)?.getTime() || 0;
      return da - db;
    });
  }, [orders, effectiveDateRange, selectedSession, selectedStatus, searchQuery]);

  // Distinct dates in the active filtered orders
  const activeOrderDates = useMemo(() => {
    const setDates = new Set<string>();
    filteredOrders.forEach(o => setDates.add(o.date));
    return Array.from(setDates).sort((a, b) => {
      const da = parseMenuDate(a)?.getTime() || 0;
      const db = parseMenuDate(b)?.getTime() || 0;
      return da - db;
    });
  }, [filteredOrders]);

  // Master inventory items for matching current stock
  const inventoryItems = useMemo(() => warehouseDb.getItems(), []);

  // Operational metrics for active period
  const stats = useMemo(() => {
    let totalOrders = filteredOrders.length;
    let totalPortionsPlanned = 0;
    let totalPortionsDistributed = 0;
    let inCooking = 0;
    let totalPOItemsCount = 0;
    let totalEstimatedCost = 0;
    let totalArrivedKg = 0;

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
          const parsed = parseNumericQuantity(item.qtyArrived || item.qtyOrder);
          totalArrivedKg += parsed;
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
      totalArrivedKg: Math.round(totalArrivedKg),
    };
  }, [filteredOrders]);

  // Master schools & beneficiary categories list (sourced from reactive beneficiaries state)
  const masterSchools = beneficiaries;

  // Filtered schools based on category, status and search for Tab 2
  const filteredSchools = useMemo(() => {
    return masterSchools.filter(school => {
      if (selectedBeneficiaryCategory !== 'ALL' && school.category !== selectedBeneficiaryCategory) {
        return false;
      }
      if (beneficiaryStatusFilter !== 'ALL' && (school.status || 'DIJADWALKAN') !== beneficiaryStatusFilter) {
        return false;
      }
      if (schoolSearchQuery.trim()) {
        const q = schoolSearchQuery.toLowerCase();
        const matchName = school.schoolName.toLowerCase().includes(q);
        const matchPic = (school.contactPerson || '').toLowerCase().includes(q);
        const matchPhone = (school.phone || '').toLowerCase().includes(q);
        const matchNotes = (school.notes || '').toLowerCase().includes(q);
        if (!matchName && !matchPic && !matchPhone && !matchNotes) return false;
      }
      return true;
    });
  }, [masterSchools, selectedBeneficiaryCategory, beneficiaryStatusFilter, schoolSearchQuery]);

  // Filtered master beneficiaries for Tab 3 (Master Data)
  const filteredMasterBeneficiaries = useMemo(() => {
    return masterSchools.filter(school => {
      if (masterCategoryFilter !== 'ALL' && school.category !== masterCategoryFilter) {
        return false;
      }
      if (masterSearchQuery.trim()) {
        const q = masterSearchQuery.toLowerCase();
        const matchId = (school.id || '').toLowerCase().includes(q);
        const matchName = school.schoolName.toLowerCase().includes(q);
        const matchPic = (school.contactPerson || '').toLowerCase().includes(q);
        const matchPhone = (school.phone || '').toLowerCase().includes(q);
        const matchNotes = (school.notes || '').toLowerCase().includes(q);
        if (!matchId && !matchName && !matchPic && !matchPhone && !matchNotes) return false;
      }
      return true;
    });
  }, [masterSchools, masterCategoryFilter, masterSearchQuery]);

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

  // Beneficiary Actions Handlers
  const handleOpenAddBeneficiary = () => {
    setEditingBeneficiary(null);
    const nextNum = beneficiaries.length + 1;
    setBeneficiaryFormId(`SCH-${String(nextNum).padStart(3, '0')}`);
    setBeneficiaryFormName('');
    setBeneficiaryFormCategory('SD / MI');
    setBeneficiaryFormPortions(250);
    setBeneficiaryFormDeliveryTime('09.45 WIB');
    setBeneficiaryFormContactPerson('');
    setBeneficiaryFormPhone('');
    setBeneficiaryFormStatus('DIJADWALKAN');
    setBeneficiaryFormNotes('');
    setIsBeneficiaryModalOpen(true);
  };

  const handleOpenEditBeneficiary = (b: SchoolBeneficiaryAllocation) => {
    setEditingBeneficiary(b);
    setBeneficiaryFormId(b.id);
    setBeneficiaryFormName(b.schoolName);
    setBeneficiaryFormCategory(b.category);
    setBeneficiaryFormPortions(b.portionCount || 0);
    setBeneficiaryFormDeliveryTime(b.deliveryTime || '09.45 WIB');
    setBeneficiaryFormContactPerson(b.contactPerson || '');
    setBeneficiaryFormPhone(b.phone || '');
    setBeneficiaryFormStatus(b.status || 'DIJADWALKAN');
    setBeneficiaryFormNotes(b.notes || '');
    setIsBeneficiaryModalOpen(true);
  };

  const handleSaveBeneficiary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiaryFormName.trim()) {
      alert('Nama sekolah atau lembaga penerima manfaat wajib diisi.');
      return;
    }
    if (Number(beneficiaryFormPortions) <= 0) {
      alert('Jumlah porsi penerima manfaat harus lebih dari 0.');
      return;
    }

    const itemToSave: SchoolBeneficiaryAllocation = {
      id: beneficiaryFormId || `SCH-${Date.now().toString().slice(-4)}`,
      schoolName: beneficiaryFormName.trim(),
      category: beneficiaryFormCategory,
      portionCount: Number(beneficiaryFormPortions),
      deliveryTime: beneficiaryFormDeliveryTime.trim() || undefined,
      contactPerson: beneficiaryFormContactPerson.trim() || undefined,
      phone: beneficiaryFormPhone.trim() || undefined,
      status: beneficiaryFormStatus,
      notes: beneficiaryFormNotes.trim() || undefined,
    };

    warehouseDb.saveSchoolBeneficiary(itemToSave, currentUser || undefined);
    setBeneficiaries(warehouseDb.getSchoolBeneficiaries());
    setIsBeneficiaryModalOpen(false);
    setSuccessNotice(
      editingBeneficiary
        ? `Data penerima manfaat "${itemToSave.schoolName}" berhasil diperbarui: ${itemToSave.portionCount.toLocaleString('id-ID')} porsi, PIC: ${itemToSave.contactPerson || '-'} (${itemToSave.phone || '-'}).`
        : `Lembaga penerima manfaat baru "${itemToSave.schoolName}" berhasil ditambahkan.`
    );
    setTimeout(() => setSuccessNotice(''), 6000);
  };

  const handleDeleteBeneficiary = (b: SchoolBeneficiaryAllocation) => {
    if (window.confirm(`Yakin ingin menghapus data penerima manfaat "${b.schoolName}"? Data yang terhapus tidak dapat dikembalikan.`)) {
      warehouseDb.deleteSchoolBeneficiary(b.id, currentUser || undefined);
      setBeneficiaries(warehouseDb.getSchoolBeneficiaries());
      setSuccessNotice(`Data penerima manfaat "${b.schoolName}" berhasil dihapus.`);
      setTimeout(() => setSuccessNotice(''), 5000);
    }
  };

  const handleQuickUpdateBeneficiaryStatus = (b: SchoolBeneficiaryAllocation, newStatus: SchoolBeneficiaryAllocation['status']) => {
    const updated = { ...b, status: newStatus };
    warehouseDb.saveSchoolBeneficiary(updated, currentUser || undefined);
    setBeneficiaries(warehouseDb.getSchoolBeneficiaries());
  };

  const handleExportMasterBeneficiariesExcel = () => {
    const rows = beneficiaries.map((b, idx) => ({
      No: idx + 1,
      'ID Lembaga': b.id,
      'Nama Sekolah / Lembaga': b.schoolName,
      'Kategori Sasaran': b.category,
      'Jumlah Alokasi Porsi': b.portionCount,
      'Jadwal Kirim': b.deliveryTime || '-',
      'Nama Kontak PIC': b.contactPerson || '-',
      'Nomor HP / WA PIC': b.phone || '-',
      'Status Operasional': b.status || 'DIJADWALKAN',
      'Catatan / Titik Serah': b.notes || '-',
    }));
    exportToExcel(
      rows,
      `Master_Data_Penerima_Manfaat_SPPG_${new Date().toISOString().slice(0, 10)}.xlsx`,
      'Master Penerima Manfaat'
    );
  };

  // =========================================================================
  // MATRIKS PENGELUARAN BAHAN MINGGUAN (PERSIS KOLOM KANAN EXCEL USER)
  // =========================================================================
  interface MaterialMatrixRow {
    no?: number;
    categoryGroup: string;
    itemName: string;
    dateValues: Record<string, number | string>;
    totalPeriod: number;
    unit: string;
    warehouseStock?: number | string;
  }

  const weeklyMaterialMatrix = useMemo(() => {
    const groupOrder = ['protein hewani', 'protein nabati', 'sembako', 'sayur', 'buah', 'lain lain'];
    const mapRows: Record<string, MaterialMatrixRow> = {};

    filteredOrders.forEach(ord => {
      const dateKey = ord.date;
      const items = ord.poArrivalItems || [];

      items.forEach(po => {
        const rawName = (po.itemName || '').trim().toLowerCase();
        if (!rawName) return;

        let catGroup = (po.category || '').toLowerCase();
        if (catGroup.includes('protein')) {
          if (rawName.includes('tahu') || rawName.includes('tempe')) {
            catGroup = 'protein nabati';
          } else {
            catGroup = 'protein hewani';
          }
        } else if (catGroup.includes('sembako')) {
          catGroup = 'sembako';
        } else if (catGroup.includes('sayur')) {
          catGroup = 'sayur';
        } else if (catGroup.includes('buah')) {
          catGroup = 'buah';
        } else {
          catGroup = 'lain lain';
        }

        const rawQtyStr = po.qtyOrder || po.qtyArrived || '';
        let detectedUnit = 'kg';
        if (rawQtyStr.toLowerCase().includes('sak')) detectedUnit = 'sak';
        else if (rawQtyStr.toLowerCase().includes('krat')) detectedUnit = 'krat';
        else if (rawQtyStr.toLowerCase().includes('layah')) detectedUnit = 'layah';
        else if (rawQtyStr.toLowerCase().includes('dus') || rawQtyStr.toLowerCase().includes('ktn') || rawQtyStr.toLowerCase().includes('karton')) detectedUnit = 'dus';
        else if (rawQtyStr.toLowerCase().includes('pack') || rawQtyStr.toLowerCase().includes('bks')) detectedUnit = 'pack';
        else if (rawQtyStr.toLowerCase().includes('bal')) detectedUnit = 'bal';
        else if (rawQtyStr.toLowerCase().includes('pcs') || rawQtyStr.toLowerCase().includes('pc')) detectedUnit = 'pcs';
        else if (rawQtyStr.toLowerCase().includes('ikat')) detectedUnit = 'ikat';

        const numericVal = parseNumericQuantity(po.qtyOrder || po.qtyArrived);

        if (!mapRows[rawName]) {
          const matchInv = inventoryItems.find(it =>
            it.name.toLowerCase().includes(rawName) || rawName.includes(it.name.toLowerCase())
          );

          mapRows[rawName] = {
            categoryGroup: catGroup,
            itemName: po.itemName,
            dateValues: {},
            totalPeriod: 0,
            unit: detectedUnit,
            warehouseStock: matchInv ? `${matchInv.currentStock} ${matchInv.baseUnit}` : 'Ada di Rak',
          };
        }

        mapRows[rawName].dateValues[dateKey] = numericVal > 0 ? numericVal : po.qtyArrived || po.qtyOrder;
        mapRows[rawName].totalPeriod += numericVal;
      });
    });

    const allRows = Object.values(mapRows);
    allRows.sort((a, b) => {
      const idxA = groupOrder.indexOf(a.categoryGroup);
      const idxB = groupOrder.indexOf(b.categoryGroup);
      if (idxA !== idxB) {
        return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      }
      return a.itemName.localeCompare(b.itemName);
    });

    let curCat = '';
    let curNo = 0;
    allRows.forEach(r => {
      if (r.categoryGroup !== curCat) {
        curCat = r.categoryGroup;
        curNo++;
        r.no = curNo;
      }
    });

    return {
      dates: activeOrderDates,
      rows: allRows,
    };
  }, [filteredOrders, activeOrderDates, inventoryItems]);

  // =========================================================================
  // HANDLERS FOR MODAL 1: INPUT & EDIT MENU HARI INI
  // =========================================================================
  const handleOpenCreateMenuModal = (overrideDate?: string | React.MouseEvent) => {
    setEditingMenuOrderId(null);
    const targetDate = typeof overrideDate === 'string' && overrideDate ? overrideDate : (selectedDailyDate || todayStr);
    setMenuFormDate(targetDate);

    // Auto H-1
    const d = new Date(targetDate);
    d.setDate(d.getDate() - 1);
    setMenuFormPoDate(d.toISOString().slice(0, 10));

    setMenuFormSession('Siang');
    setMenuFormTitle('');
    setMenuFormDietB3('');
    setMenuFormPortions(3044);
    setMenuFormStatus('PLANNED');
    setMenuFormChef('Chef Joko Santoso & Tim Dapur SPPG Jeru Tumpang');
    setMenuFormNotes('');
    setIsMenuModalOpen(true);
  };

  const handleOpenEditMenuModal = (order: MenuOrder) => {
    setEditingMenuOrderId(order.id);
    setMenuFormDate(order.date);
    setMenuFormPoDate(order.poDate || '');
    setMenuFormSession(order.mealSession);
    setMenuFormTitle(order.menuTitle);
    setMenuFormDietB3(order.specialDietB3 || '');
    setMenuFormPortions(order.targetPortions || 3044);
    setMenuFormStatus(order.status);
    setMenuFormChef(order.chefInCharge || 'Chef Joko Santoso & Tim Dapur SPPG Jeru Tumpang');
    setMenuFormNotes(order.notes || '');
    setIsMenuModalOpen(true);
  };

  const handleSaveMenuForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuFormTitle.trim() || menuFormPortions <= 0) {
      alert('Nama menu dan total porsi penerima manfaat wajib diisi.');
      return;
    }

    try {
      const isNew = !editingMenuOrderId;
      const orderId = editingMenuOrderId || `ORD-${Date.now().toString().slice(-6)}`;
      const existing = editingMenuOrderId ? orders.find(o => o.id === editingMenuOrderId) : null;

      const totalBasePortions = masterSchools.reduce((sum, s) => sum + (s.portionCount || 0), 0) || 3044;
      const updatedAllocations = masterSchools.map(s => ({
        ...s,
        portionCount: Math.round(s.portionCount * (menuFormPortions / totalBasePortions)),
      }));

      const orderToSave: MenuOrder = {
        id: orderId,
        date: menuFormDate,
        poDate: menuFormPoDate.trim() || undefined,
        mealSession: menuFormSession,
        menuTitle: menuFormTitle.trim(),
        menuDescription: existing?.menuDescription || '',
        specialDietB3: menuFormDietB3.trim() || undefined,
        targetPortions: menuFormPortions,
        totalBeneficiaries: menuFormPortions,
        status: menuFormStatus,
        chefInCharge: menuFormChef.trim(),
        notes: menuFormNotes.trim(),
        poArrivalItems: existing?.poArrivalItems || [],
        beneficiaryAllocations: updatedAllocations,
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      warehouseDb.saveMenuOrder(orderToSave, currentUser, isNew);
      refreshOrders();
      setIsMenuModalOpen(false);

      if (isNew) {
        setSuccessNotice(
          `Menu berhasil dicatat untuk tanggal ${orderToSave.date}: ${orderToSave.menuTitle} (${orderToSave.targetPortions} porsi). Kamu bisa langsung input PO bahan dengan tombol "+ Input PO Hari Ini".`
        );
      } else {
        setSuccessNotice(`Berhasil memperbarui menu: ${orderToSave.menuTitle}.`);
      }
      setTimeout(() => setSuccessNotice(''), 6000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan data menu.');
    }
  };

  // =========================================================================
  // HANDLERS FOR MODAL 2: INPUT & EDIT PO HARI INI
  // =========================================================================
  const handleOpenPoModal = (targetOrderId?: string) => {
    // Tentukan order mana yang akan diinput PO-nya
    let targetOrder = targetOrderId ? orders.find(o => o.id === targetOrderId) : null;

    if (!targetOrder && orders.length > 0) {
      // Prioritaskan order pada tanggal aktif terpilih, lalu hari ini, lalu order pertama
      targetOrder =
        orders.find(o => o.date === selectedDailyDate) ||
        orders.find(o => o.date === todayStr) ||
        orders[0];
    }

    if (!targetOrder) {
      alert('Belum ada menu yang tercatat. Silakan input menu terlebih dahulu dengan tombol "+ Input Menu Hari Ini".');
      return;
    }

    setSelectedPoOrderId(targetOrder.id);
    setPoFormDate(targetOrder.poDate || 'H-1');

    if (targetOrder.poArrivalItems && targetOrder.poArrivalItems.length > 0) {
      setPoFormRows(
        targetOrder.poArrivalItems.map(p => ({
          category: p.category || 'Bahan Makanan',
          itemName: p.itemName,
          qtyOrder: p.qtyOrder || '',
          qtyArrived: p.qtyArrived || '',
          supplier: p.supplier || '',
          arrivalTime: p.arrivalTime || '',
          pic: p.pic || 'Akmal',
          notes: p.notes || '',
        }))
      );
    } else {
      // Default baris kosong atau default template
      setPoFormRows([
        { category: 'Protein', itemName: 'Ayam Potong', qtyOrder: '260 kg', qtyArrived: '260 kg', supplier: 'Ayam Segar Fajar', arrivalTime: '08.30', pic: 'Akmal', notes: '' },
        { category: 'Protein', itemName: 'Tahu Putih', qtyOrder: '520 pcs', qtyArrived: '520 pcs', supplier: 'Tahu Rio', arrivalTime: '09.30', pic: 'Akmal', notes: '' },
        { category: 'Sembako', itemName: 'Beras Mentari 25kg', qtyOrder: '7 sak', qtyArrived: '7 sak', supplier: 'Tumpang Grosir', arrivalTime: '14.00', pic: 'Akmal', notes: '' },
      ]);
    }

    setIsPoModalOpen(true);
  };

  const masterSuppliers = useMemo(() => {
    try {
      return warehouseDb.getSuppliers();
    } catch {
      return [];
    }
  }, []);

  const resolveSupplierForItem = (
    category: string,
    itemName: string,
    existingSupplier?: string,
    suppliers: Array<{ id: string; name: string; supplyCategory?: string }> = []
  ): string => {
    if (existingSupplier && existingSupplier.trim() && existingSupplier !== 'Pemasok Rekanan' && existingSupplier !== 'Pemasok Lokal') {
      return existingSupplier.trim();
    }
    const cat = (category || '').toLowerCase();
    const name = (itemName || '').toLowerCase();

    if (suppliers && suppliers.length > 0) {
      if (cat.includes('tahu') || cat.includes('tempe') || name.includes('tahu') || name.includes('tempe')) {
        const match = suppliers.find(s => {
          const full = `${s.name} ${s.supplyCategory || ''}`.toLowerCase();
          return full.includes('tahu') || full.includes('tempe') || full.includes('rio');
        });
        if (match) return match.name;
      }

      if (cat.includes('protein') || name.includes('ayam') || name.includes('daging') || name.includes('telur') || name.includes('unggas')) {
        if (name.includes('daging') || name.includes('sapi')) {
          const dagingMatch = suppliers.find(s => `${s.name} ${s.supplyCategory || ''}`.toLowerCase().includes('daging'));
          if (dagingMatch) return dagingMatch.name;
        }
        const ayamMatch = suppliers.find(s => {
          const full = `${s.name} ${s.supplyCategory || ''}`.toLowerCase();
          return full.includes('ayam') || full.includes('fjr') || full.includes('fajar') || full.includes('protein');
        });
        if (ayamMatch) return ayamMatch.name;
      }

      if (cat.includes('sembako') || name.includes('beras') || name.includes('minyak') || name.includes('gula') || name.includes('tepung')) {
        const sembakoMatch = suppliers.find(s => {
          const full = `${s.name} ${s.supplyCategory || ''}`.toLowerCase();
          return full.includes('tumpang') || full.includes('grosir') || full.includes('sembako');
        });
        if (sembakoMatch) return sembakoMatch.name;
      }

      if (cat.includes('sayur') || cat.includes('buah') || name.includes('sayur') || name.includes('buncis') || name.includes('wortel') || name.includes('semangka') || name.includes('buah')) {
        const sayurMatch = suppliers.find(s => {
          const full = `${s.name} ${s.supplyCategory || ''}`.toLowerCase();
          return full.includes('fresh') || full.includes('sayur') || full.includes('buah') || full.includes('luber');
        });
        if (sayurMatch) return sayurMatch.name;
      }

      const directMatch = suppliers.find(s => {
        const sCat = (s.supplyCategory || '').toLowerCase();
        return sCat.includes(cat) || (cat && cat.includes(sCat));
      });
      if (directMatch) return directMatch.name;

      return suppliers[0].name;
    }

    return 'Pemasok Rekanan';
  };

  const handleSaveAndGenerateOfficialPo = () => {
    if (!selectedPoOrderId) {
      alert('Pilih menu tujuan untuk PO ini.');
      return;
    }

    const targetOrder = orders.find(o => o.id === selectedPoOrderId);
    if (!targetOrder) {
      alert('Order menu tidak ditemukan.');
      return;
    }

    try {
      const validItems: MenuPoArrivalItem[] = poFormRows
        .filter(r => r.itemName.trim())
        .map(r => {
          const estimatedCost = parseNumericQuantity(r.qtyOrder || r.qtyArrived) * estimatePrice(r.itemName);
          const autoSupplier = resolveSupplierForItem(r.category, r.itemName, r.supplier, masterSuppliers);
          return {
            category: r.category.trim(),
            itemName: r.itemName.trim(),
            qtyOrder: r.qtyOrder.trim(),
            qtyArrived: (r.qtyArrived && r.qtyArrived.trim()) || r.qtyOrder.trim(),
            supplier: autoSupplier,
            arrivalTime: (r.arrivalTime && r.arrivalTime.trim()) || '08.00',
            pic: (r.pic && r.pic.trim()) || currentUser.name,
            totalCost: estimatedCost,
            notes: r.notes || '',
          };
        });

      if (validItems.length === 0) {
        alert('Tambahkan minimal 1 item bahan untuk membuat PO.');
        return;
      }

      // 1. Simpan ke data Menu Order lokal
      const updatedOrder: MenuOrder = {
        ...targetOrder,
        poDate: poFormDate.trim() || targetOrder.poDate,
        poArrivalItems: validItems,
      };

      warehouseDb.saveMenuOrder(updatedOrder, currentUser, false);

      // 2. Bersihkan draft PO resmi lama untuk menu ini agar tidak ada duplikasi / PO usang
      warehouseDb.deletePurchaseOrdersByMenuOrderId(selectedPoOrderId, currentUser);

      // 3. Kelompokkan bahan berdasarkan nama Supplier untuk dibuatkan PO resmi
      const itemsBySupplier = new Map<string, MenuPoArrivalItem[]>();
      validItems.forEach(item => {
        const suppName = item.supplier || 'Pemasok Rekanan';
        if (!itemsBySupplier.has(suppName)) {
          itemsBySupplier.set(suppName, []);
        }
        itemsBySupplier.get(suppName)!.push(item);
      });

      const existingPOs = warehouseDb.getPurchaseOrders();
      const generatedPos: PurchaseOrderNota[] = [];
      const poTargetDate = targetOrder.date || new Date().toISOString().slice(0, 10);
      let currentSeqList = [...existingPOs];

      itemsBySupplier.forEach((supplierItems, supplierName) => {
        const suppObj = masterSuppliers.find(
          s => s.name.toLowerCase() === supplierName.toLowerCase() ||
               supplierName.toLowerCase().includes(s.name.toLowerCase()) ||
               s.name.toLowerCase().includes(supplierName.toLowerCase())
        );

        const nextPoNum = generateNextPoNumber(currentSeqList, poTargetDate);

        const poItems: PurchaseOrderItem[] = supplierItems.map((sItem, sIdx) => {
          const numQty = parseNumericQuantity(sItem.qtyOrder || sItem.qtyArrived) || 1;
          const unitPrice = estimatePrice(sItem.itemName);
          const subtotal = sItem.totalCost && sItem.totalCost > 0 ? sItem.totalCost : Math.round(numQty * unitPrice);

          const unitMatch = (sItem.qtyOrder || sItem.qtyArrived || '').match(/[a-zA-Z]+/g);
          const unitStr = unitMatch ? unitMatch.join(' ') : 'Kg';

          return {
            id: `POI-${Date.now()}-${sIdx}`,
            name: sItem.itemName,
            category: sItem.category || 'Bahan Makanan',
            quantity: numQty,
            unit: unitStr || 'Kg',
            unitPrice: unitPrice,
            subtotal: subtotal,
            notes: sItem.notes || (sItem.arrivalTime ? `Estimasi tiba: ${sItem.arrivalTime}` : undefined),
          };
        });

        const grandTotal = poItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);

        const newNota: PurchaseOrderNota = {
          id: `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          poNumber: nextPoNum,
          date: poTargetDate,
          deliveryDate: poTargetDate,
          supplierId: suppObj?.id,
          supplierName: suppObj?.name || supplierName,
          supplierContact: suppObj?.phone ? `${suppObj.phone} (${suppObj.contactPerson || 'PIC'})` : '',
          supplierAddress: suppObj?.address || 'Malang, Jawa Timur',
          paymentMethod: 'TRANSFER',
          bankInfo: suppObj ? `Transfer Bank Rekening Resmi ${suppObj.name}` : '',
          status: 'DISETUJUI',
          items: poItems,
          subtotal: grandTotal,
          discount: 0,
          tax: 0,
          grandTotal: grandTotal,
          terbilang: angkaTerbilang(grandTotal),
          notes: `PO dibuat otomatis dari Perencanaan Menu: ${targetOrder.menuTitle} (${targetOrder.targetPortions} porsi).`,
          deliveryTerms: 'Pengiriman langsung ke Satuan Pelayanan Pemenuhan Gizi (SPPG) Jeru Tumpang (Jam 12.00-15.00).',
          createdBy: currentUser.name,
          createdByRole: currentUser.role === 'ADMIN' ? 'Admin Logistik' : currentUser.role,
          approvedBy: 'Rizky Iman Ramdhan, S.Pd',
          approvedByRole: 'Kepala SPPG Jeru Tumpang',
          supplierPic: suppObj?.contactPerson || 'Pihak Rekanan',
          relatedMenuOrderId: targetOrder.id,
          createdAt: new Date().toISOString(),
        };

        warehouseDb.savePurchaseOrder(newNota, currentUser);
        generatedPos.push(newNota);
        currentSeqList.push(newNota);
      });

      refreshOrders();
      setIsPoModalOpen(false);

      const supplierNames = Array.from(itemsBySupplier.keys()).join(', ');
      setSuccessNotice(
        `Sukses! Berhasil generate ${generatedPos.length} Draft Nota PO Resmi untuk: ${supplierNames}. Data otomatis tersinkron ke modul "Input Barang & Belanja".`
      );
      setTimeout(() => setSuccessNotice(''), 7000);
    } catch (err: any) {
      alert(err.message || 'Gagal generate Draft PO.');
    }
  };

  const handleApplyPoTemplate = () => {
    setPoFormRows(STANDARD_PO_TEMPLATES.map(t => ({ ...t, notes: '' })));
  };

  const handleDeletePoForOrder = (orderId?: string) => {
    const targetId = orderId || selectedPoOrderId;
    if (!targetId) return;

    const targetOrder = orders.find(o => o.id === targetId);
    const orderTitle = targetOrder ? targetOrder.menuTitle : 'menu ini';

    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin membatalkan & menghapus seluruh PO resmi untuk menu "${orderTitle}"?\n\nPO ini akan otomatis terhapus dari sistem, modul Input Barang & Belanja, dan Ringkasan.`
    );

    if (confirmDelete) {
      const deletedCount = warehouseDb.deletePurchaseOrdersByMenuOrderId(targetId, currentUser);
      if (targetOrder) {
        const updatedOrder: MenuOrder = {
          ...targetOrder,
          poArrivalItems: [],
        };
        warehouseDb.saveMenuOrder(updatedOrder, currentUser, false);
      }
      setPoFormRows([]);
      refreshOrders();
      setIsPoModalOpen(false);
      setSuccessNotice(`Berhasil membatalkan & menghapus ${deletedCount} PO resmi untuk "${orderTitle}".`);
      setTimeout(() => setSuccessNotice(''), 4000);
    }
  };

  const handleSavePoForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoOrderId) {
      alert('Pilih menu tujuan untuk PO ini.');
      return;
    }

    const targetOrder = orders.find(o => o.id === selectedPoOrderId);
    if (!targetOrder) {
      alert('Order menu tidak ditemukan.');
      return;
    }

    try {
      const validItems: MenuPoArrivalItem[] = poFormRows
        .filter(r => r.itemName.trim())
        .map(r => {
          const estimatedCost = parseNumericQuantity(r.qtyOrder || r.qtyArrived) * estimatePrice(r.itemName);
          const autoSupplier = resolveSupplierForItem(r.category, r.itemName, r.supplier, masterSuppliers);
          return {
            category: r.category.trim(),
            itemName: r.itemName.trim(),
            qtyOrder: r.qtyOrder.trim(),
            qtyArrived: (r.qtyArrived && r.qtyArrived.trim()) || r.qtyOrder.trim(),
            supplier: autoSupplier,
            arrivalTime: (r.arrivalTime && r.arrivalTime.trim()) || '08.00',
            pic: (r.pic && r.pic.trim()) || currentUser.name,
            totalCost: estimatedCost,
            notes: r.notes || '',
          };
        });

      if (validItems.length === 0) {
        // Jika user mengosongkan seluruh baris, hapus seluruh PO terkait
        warehouseDb.deletePurchaseOrdersByMenuOrderId(selectedPoOrderId, currentUser);
        const updatedOrder: MenuOrder = {
          ...targetOrder,
          poDate: poFormDate.trim() || targetOrder.poDate,
          poArrivalItems: [],
        };
        warehouseDb.saveMenuOrder(updatedOrder, currentUser, false);
        refreshOrders();
        setIsPoModalOpen(false);
        setSuccessNotice(`Seluruh rincian PO untuk menu ${updatedOrder.menuTitle} telah dihapus.`);
        setTimeout(() => setSuccessNotice(''), 4000);
        return;
      }

      const updatedOrder: MenuOrder = {
        ...targetOrder,
        poDate: poFormDate.trim() || targetOrder.poDate,
        poArrivalItems: validItems,
      };

      warehouseDb.saveMenuOrder(updatedOrder, currentUser, false);
      refreshOrders();
      setIsPoModalOpen(false);
      setSuccessNotice(
        `Berhasil menyimpan ${validItems.length} item PO & timbangan kedatangan untuk menu tanggal ${updatedOrder.date}.`
      );
      setTimeout(() => setSuccessNotice(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan rincian PO.');
    }
  };

  // Delete Order
  const handleDeleteOrder = (orderId: string, menuTitle: string) => {
    if (window.confirm(`Hapus catatan menu & PO "${menuTitle}"? Data yang dihapus tidak dapat dikembalikan.`)) {
      warehouseDb.deleteMenuOrder(orderId, currentUser);
      refreshOrders();
      setSuccessNotice(`Catatan menu "${menuTitle}" telah dihapus.`);
      setTimeout(() => setSuccessNotice(''), 4000);
    }
  };

  // Quick Status Change
  const handleQuickStatusChange = (orderId: string, newStatus: MenuOrderStatus) => {
    try {
      warehouseDb.updateMenuOrderStatus(orderId, newStatus, currentUser);
      refreshOrders();
      setSuccessNotice(`Status menu order berhasil diperbarui.`);
      setTimeout(() => setSuccessNotice(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal memperbarui status order.');
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
      case 'COMPLETED':
        return { label: 'Terdistribusi Selesai', class: 'bg-emerald-50 text-emerald-800 border-emerald-300' };
      case 'CANCELLED':
        return { label: 'Dibatalkan', class: 'bg-rose-50 text-rose-800 border-rose-300' };
    }
  };

  // Ekspor Excel Multi-Sheet Komprehensif
  const handleExportExcelAll = () => {
    const dailyOrderRows: Record<string, any>[] = [];
    filteredOrders.forEach((ord, ordIdx) => {
      const items = ord.poArrivalItems || [];
      if (items.length === 0) {
        dailyOrderRows.push({
          'No': ordIdx + 1,
          'Total Penerima Manfaat': ord.totalBeneficiaries,
          'Menu Reguler': ord.menuTitle,
          'Menu B3': ord.specialDietB3 || '-',
          'Tanggal': ord.date,
          'Tanggal PO (H-1)': ord.poDate || '-',
          'Kategori': '-',
          'Nama Barang': '-',
          'Qty PO': '-',
          'Datang dan Timbang': '-',
          'Supplier': '-',
          'Jam Datang': '-',
          'PIC': ord.chefInCharge || '-',
        });
      } else {
        items.forEach((it, itIdx) => {
          dailyOrderRows.push({
            'No': itIdx === 0 ? ordIdx + 1 : '',
            'Total Penerima Manfaat': itIdx === 0 ? ord.totalBeneficiaries : '',
            'Menu Reguler': itIdx === 0 ? ord.menuTitle : '',
            'Menu B3': itIdx === 0 ? (ord.specialDietB3 || '-') : '',
            'Tanggal': itIdx === 0 ? ord.date : '',
            'Tanggal PO (H-1)': itIdx === 0 ? (ord.poDate || '-') : '',
            'Kategori': it.category,
            'Nama Barang': it.itemName,
            'Qty PO': it.qtyOrder,
            'Datang dan Timbang': it.qtyArrived,
            'Supplier': it.supplier || '-',
            'Jam Datang': it.arrivalTime || '-',
            'PIC': it.pic || '-',
          });
        });
      }
    });

    const matrixRows: Record<string, any>[] = weeklyMaterialMatrix.rows.map(r => {
      const obj: Record<string, any> = {
        'No': r.no || '',
        'Kategori': r.categoryGroup,
        'Nama Barang': r.itemName,
      };
      weeklyMaterialMatrix.dates.forEach(d => {
        obj[formatShortDate(d)] = r.dateValues[d] ?? '';
      });
      obj['Total Pengeluaran'] = r.totalPeriod;
      obj['Satuan'] = r.unit;
      obj['Sisa Bahan Gudang'] = r.warehouseStock || '-';
      return obj;
    });

    const schoolRows = filteredSchools.map((s, idx) => ({
      'No': idx + 1,
      'Nama Sekolah / Titik Sasaran': s.schoolName,
      'Kategori': s.category,
      'Jumlah Porsi / Siswa': s.portionCount,
      'Jadwal Kirim': s.deliveryTime || '-',
      'PIC Sekolah': s.contactPerson || '-',
      'No Telepon': s.phone || '-',
      'Status': s.status || 'TERKIRIM',
    }));

    exportMultiSheetExcel(
      [
        { sheetName: 'Rekap Menu & PO Harian', data: dailyOrderRows },
        { sheetName: 'Matriks Pengeluaran Bahan', data: matrixRows },
        { sheetName: 'Penerima Manfaat Sekolah', data: schoolRows },
      ],
      `Rekap_Menu_PO_PenerimaManfaat_SPPG_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  return (
    <div className="space-y-5">
      {/* Alert Notice */}
      {successNotice && (
        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Header Utama dengan 2 Tombol Aksi Mandiri */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 bg-white p-5 rounded-2xl border shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Rekap Order Menu, PO Bahan & Penerima Manfaat Gizi
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Manajemen menu harian, pesanan PO H-1, timbangan riil, dan alokasi penerima manfaat.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0" ref={actionDropdownRef}>
          {/* Split Button: Primary Input Menu + Dropdown for Input PO */}
          <div className="relative inline-flex rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={handleOpenCreateMenuModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-l-xl bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer"
              title="Input menu makanan bergizi hari ini"
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>+ Input Menu</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsInputDropdownOpen(!isInputDropdownOpen);
                setIsPrintDropdownOpen(false);
              }}
              className="inline-flex items-center px-2 py-2 text-xs font-bold rounded-r-xl bg-emerald-800 hover:bg-emerald-900 text-white border-l border-emerald-600/40 transition-colors cursor-pointer"
              title="Pilihan input lainnya (PO Bahan)"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isInputDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu Input */}
            {isInputDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 border-b border-slate-100">
                  Pilihan Input
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsInputDropdownOpen(false);
                    handleOpenCreateMenuModal();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-emerald-50/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Input Menu Hari Ini</div>
                    <div className="text-[10px] text-slate-500">Jadwal menu & porsi makan bergizi</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsInputDropdownOpen(false);
                    handleOpenPoModal();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                    <PackagePlus className="w-4 h-4 text-blue-700" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Input PO Bahan Hari Ini</div>
                    <div className="text-[10px] text-slate-500">Pemesanan bahan baku H-1 dapur</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Cetak Dropdown Button */}
          <div className="relative inline-flex">
            <button
              type="button"
              onClick={() => {
                setIsPrintDropdownOpen(!isPrintDropdownOpen);
                setIsInputDropdownOpen(false);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
              title="Pilihan cetak menu atau laporan"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Cetak</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${isPrintDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu Cetak */}
            {isPrintDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-40 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 border-b border-slate-100">
                  Opsi Cetak
                </div>

                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPrintDropdownOpen(false);
                      onNavigate('menu_print');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-purple-50/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                      <Printer className="w-4 h-4 text-purple-700" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Cetak Menu MBG</div>
                      <div className="text-[10px] text-slate-500">Studio cetak poster menu harian</div>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsPrintDropdownOpen(false);
                    window.print();
                  }}
                  className="w-full px-3.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-100"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Printer className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">Cetak Laporan PDF</div>
                    <div className="text-[10px] text-slate-500">Cetak atau simpan halaman ini</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Export Excel Multi-Sheet */}
          <button
            type="button"
            onClick={handleExportExcelAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
            title="Unduh seluruh data order, PO, dan matriks bahan ke Excel"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ekspor Excel</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs">
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg text-xs font-semibold gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('MENU_ORDERS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              activeSubTab === 'MENU_ORDERS'
                ? 'bg-white text-emerald-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-600" />
            <span>1. Input Menu & Buat PO</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('BENEFICIARIES')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              activeSubTab === 'BENEFICIARIES'
                ? 'bg-white text-blue-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
            <span>2. Penerima Manfaat</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('MASTER_BENEFICIARIES')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md transition-all cursor-pointer ${
              activeSubTab === 'MASTER_BENEFICIARIES'
                ? 'bg-white text-indigo-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900 font-medium'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>3. Master Data Penerima Manfaat</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium px-2">
          Periode: <strong className="text-slate-800">{effectiveDateRange.label}</strong>
        </div>
      </div>

      {/* Filter Control Box: Standardized Period Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        {/* Row 1: Period Mode Selector & Date Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <CalendarRange className="w-4 h-4 text-emerald-600" />
              Periode Filter:
            </span>

            {/* Period Pills */}
            <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPeriodType('DAILY')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'DAILY' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Harian
              </button>

              <button
                type="button"
                onClick={handleSetThisWeek}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'WEEKLY' ? 'bg-white text-emerald-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mingguan
              </button>

              <button
                type="button"
                onClick={() => setPeriodType('MONTHLY')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'MONTHLY' ? 'bg-white text-blue-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulanan
              </button>

              <button
                type="button"
                onClick={() => setPeriodType('ALL')}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                  periodType === 'ALL' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Tanggal
              </button>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="flex flex-wrap items-center gap-2">
            {periodType === 'DAILY' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                  title="Hari Sebelumnya"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                  <span className="text-slate-500 font-medium">Tanggal:</span>
                  <input
                    type="date"
                    value={selectedDailyDate}
                    onChange={e => {
                      setSelectedDailyDate(e.target.value);
                      setPeriodType('DAILY');
                    }}
                    className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleNextDay}
                  className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                  title="Hari Berikutnya"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {selectedDailyDate !== todayStr && (
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                  >
                    Hari Ini
                  </button>
                )}
              </div>
            )}

            {periodType === 'WEEKLY' && (
              <div className="flex items-center gap-2 text-xs">
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="text-slate-500 font-medium">Dari:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                  />
                </div>
                <span className="text-slate-400 font-medium">s/d</span>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="text-slate-500 font-medium">Sampai:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                  />
                </div>
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
              </div>
            )}

            {periodType === 'MONTHLY' && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                <span className="text-slate-500 font-medium">Pilih Bulan:</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: REKAP HARIAN MENU & KEDATANGAN PO (FORMAT KARTU VISUAL MUDAH BACA) */}
      {/* ========================================================================= */}
      {activeSubTab === 'MENU_ORDERS' && (
        <div className="space-y-4">

          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Total Sesi Menu</div>
              <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                {stats.totalOrders} <span className="text-xs font-normal text-slate-500">hari/sesi</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Jadwal masak periode terpilih</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Total Penerima Manfaat</div>
              <div className="text-xl font-bold text-emerald-700 mt-1 tabular-nums">
                {stats.totalPortionsPlanned.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-slate-500">porsi</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {stats.totalPortionsDistributed.toLocaleString('id-ID')} porsi tersalurkan
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Item Bahan PO Masuk</div>
              <div className="text-xl font-bold text-blue-700 mt-1 tabular-nums">
                {stats.totalPOItemsCount} <span className="text-xs font-normal text-slate-500">item barang</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Total kedatangan bahan baku</div>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
              <div className="text-[11px] font-medium text-slate-500">Total Bahan Ditimbang</div>
              <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                {stats.totalArrivedKg.toLocaleString('id-ID')}{' '}
                <span className="text-xs font-normal text-slate-500">kg/satuan</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Hasil penimbangan riil di gudang</div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 bg-white"
              >
                <option value="ALL">Semua Status</option>
                <option value="PLANNED">Direncanakan</option>
                <option value="PREPPING">Persiapan Bahan</option>
                <option value="COOKING">Sedang Dimasak</option>
                <option value="DISTRIBUTED">Terdistribusi Selesai</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama menu, bahan PO, pemasok, PIC..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Daily Card Feed (Mudah Dibaca & Ergonomis) */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-xs text-slate-500 shadow-2xs space-y-3">
              <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  Belum ada jadwal menu untuk {periodType === 'DAILY' ? formatIndonesianDate(selectedDailyDate) : effectiveDateRange.label}
                </h4>
                <p className="text-slate-500 max-w-md mx-auto">
                  Anda dapat langsung mencatat menu dan pesanan bahan PO untuk tanggal ini, atau kembali melihat jadwal hari ini.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleOpenCreateMenuModal(selectedDailyDate)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Input Menu untuk Tanggal Ini</span>
                </button>
                {selectedDailyDate !== todayStr && (
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-emerald-700" />
                    <span>Lihat Hari Ini ({formatShortDate(todayStr)})</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order, oIdx) => {
                const isExpanded = expandedOrderIds[order.id] ?? true;
                const poItems = order.poArrivalItems || [];
                const statusMeta = getStatusBadge(order.status);
                const regularDishes = parseDishItems(order.menuTitle);
                const b3Dishes = order.specialDietB3 ? parseDishItems(order.specialDietB3) : [];

                return (
                  <div
                    key={order.id}
                    className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all"
                  >
                    {/* Header Kartu Harian */}
                    <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200/80 text-slate-700">
                            Hari {oIdx + 1}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900">
                            {formatIndonesianDate(order.date)}
                          </h3>
                          <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">
                            PO: {order.poDate || 'H-1'}
                          </span>
                          <div className="relative inline-flex items-center">
                            <select
                              value={order.status}
                              onChange={e => handleQuickStatusChange(order.id, e.target.value as MenuOrderStatus)}
                              className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border cursor-pointer focus:outline-none appearance-none pr-5 transition-colors ${statusMeta.class}`}
                              title="Klik untuk ubah status pengerjaan menu"
                            >
                              <option value="PLANNED">Direncanakan</option>
                              <option value="PREPPING">Persiapan Bahan</option>
                              <option value="COOKING">Sedang Dimasak</option>
                              <option value="DISTRIBUTED">Terdistribusi Selesai</option>
                              <option value="CANCELLED">Dibatalkan</option>
                            </select>
                            <ChevronDown className="w-3 h-3 absolute right-1.5 pointer-events-none opacity-60" />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1.5">
                          <span>
                            Target: <strong className="font-bold text-slate-900">{order.totalBeneficiaries?.toLocaleString('id-ID') || order.targetPortions.toLocaleString('id-ID')} porsi</strong>
                          </span>
                          <span className="text-slate-300">•</span>
                          <span>
                            Penanggung Jawab: <span className="font-medium text-slate-800">{order.chefInCharge || 'Chef Joko Santoso & Tim Dapur SPPG Jeru Tumpang'}</span>
                          </span>
                        </div>
                      </div>

                      {/* Tombol Aksi Langsung pada Kartu (Ringkas & Bersih) */}
                      <div className="flex items-center gap-1.5 self-start lg:self-auto">
                        {/* Edit Menu */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditMenuModal(order)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                          title="Edit susunan menu & target porsi"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit Menu</span>
                        </button>

                        {/* Kelola PO Bahan */}
                        <button
                          type="button"
                          onClick={() => handleOpenPoModal(order.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
                          title="Kelola daftar bahan PO & supplier"
                        >
                          <PackagePlus className="w-3.5 h-3.5 text-slate-300" />
                          <span>{poItems.length > 0 ? `Kelola PO (${poItems.length})` : 'Buat PO'}</span>
                        </button>

                        {/* Menu Tindakan Lainnya (...) */}
                        <div className="relative order-action-menu-container">
                          <button
                            type="button"
                            onClick={() => setOpenOrderMenuId(openOrderMenuId === order.id ? null : order.id)}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              openOrderMenuId === order.id
                                ? 'bg-slate-100 text-slate-800 border-slate-300'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 border-transparent'
                            }`}
                            title="Tindakan lainnya"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {openOrderMenuId === order.id && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
                              {poItems.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenOrderMenuId(null);
                                    handleDeletePoForOrder(order.id);
                                  }}
                                  className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  <span>Hapus Draft PO</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenOrderMenuId(null);
                                  handleDeleteOrder(order.id, order.menuTitle);
                                }}
                                className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>Hapus Menu Order</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expand / Collapse */}
                        <button
                          type="button"
                          onClick={() => toggleExpandOrder(order.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ml-1"
                          title={isExpanded ? 'Tutup Rincian' : 'Buka Rincian'}
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Konten Kartu */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 space-y-4">
                        {/* SEKSI 1: KOMPOSISI OLAHAN MENU */}
                        <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">
                              Komposisi Menu Reguler (Siswa SD & SMP)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenEditMenuModal(order)}
                              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3 text-slate-500" />
                              <span>Ubah Menu</span>
                            </button>
                          </div>

                          {/* Komposisi Menu Reguler Cards */}
                          {regularDishes.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              {regularDishes.map((dish, dIdx) => (
                                <div
                                  key={dIdx}
                                  className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col justify-between"
                                >
                                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">
                                    {dish.category}
                                  </span>
                                  <span className="text-xs font-bold text-slate-900 mt-1 capitalize">
                                    {dish.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">Belum ada menu reguler diinput.</div>
                          )}

                          {/* Menu Diet Khusus Balita & Bumil (B3) */}
                          <div className="pt-3 border-t border-slate-200/80">
                            <div className="text-xs font-semibold text-slate-700 mb-2">
                              Penyesuaian Menu Khusus Balita 3T & Ibu Hamil (B3):
                            </div>
                            {order.specialDietB3 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {b3Dishes.map((dish, bIdx) => (
                                  <div
                                    key={bIdx}
                                    className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 font-medium capitalize"
                                  >
                                    {dish.name}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500 italic">
                                Mengikuti menu reguler dengan penyesuaian porsi balita & ibu hamil.
                              </div>
                            )}
                          </div>

                          {order.notes && (
                            <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
                              <span className="font-semibold text-slate-700">Catatan Khusus:</span> {order.notes}
                            </div>
                          )}
                        </div>

                        {/* SEKSI 2: RINCIAN BAHAN PO */}
                        <div className="space-y-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              Rincian Bahan PO
                            </span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              {poItems.length} Bahan
                            </span>
                          </div>

                          {/* List Bahan Table (Clean & Focused) */}
                          {poItems.length === 0 ? (
                            <div className="py-5 px-4 text-center rounded-xl bg-slate-50 border border-slate-200/80">
                              <p className="text-xs text-slate-500">
                                Belum ada rincian bahan PO yang tercatat untuk menu ini.
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                                    <th className="py-2.5 px-3 w-36">Kategori</th>
                                    <th className="py-2.5 px-4">Nama Bahan</th>
                                    <th className="py-2.5 px-4 w-52">Supplier / Rekanan</th>
                                    <th className="py-2.5 px-4 w-32 text-right">Qty PO</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {poItems.map((item, pIdx) => (
                                    <tr key={pIdx} className="hover:bg-slate-50/70 transition-colors">
                                      <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{pIdx + 1}</td>
                                      <td className="py-2.5 px-3 text-slate-600 font-medium">{item.category}</td>
                                      <td className="py-2.5 px-4 font-semibold text-slate-900">{item.itemName}</td>
                                      <td className="py-2.5 px-4 text-slate-700 font-medium">
                                        {item.supplier || 'Pemasok Rekanan'}
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                                        {item.qtyOrder || item.qtyArrived || '-'}
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
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PENERIMA MANFAAT & DISTRIBUSI HARIAN                               */}
      {/* ========================================================================= */}
      {activeSubTab === 'BENEFICIARIES' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {beneficiaryCategoryStats.list.map(c => (
              <div key={c.category} className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="text-[11px] font-semibold text-slate-500">{c.category}</div>
                <div className="text-xl font-bold text-blue-900 mt-1 tabular-nums">
                  {c.portions.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500">porsi</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">{c.schoolCount} titik lembaga</div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedBeneficiaryCategory}
                onChange={e => setSelectedBeneficiaryCategory(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg text-slate-800 bg-white"
              >
                <option value="ALL">Semua Kategori Sasaran</option>
                <option value="SD / MI">Sekolah Dasar (SD / MI)</option>
                <option value="SMP / MTs">Sekolah Menengah (SMP / MTs)</option>
                <option value="PAUD / TK">PAUD / TK</option>
                <option value="Ibu Hamil & Balita (B3)">Balita 3T & Ibu Hamil (B3)</option>
              </select>

              <select
                value={beneficiaryStatusFilter}
                onChange={e => setBeneficiaryStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg text-slate-800 bg-white"
              >
                <option value="ALL">Semua Status Distribusi</option>
                <option value="DIJADWALKAN">Dijadwalkan</option>
                <option value="SIAP_KIRIM">Siap Kirim</option>
                <option value="DALAM_PERJALANAN">Dalam Perjalanan</option>
                <option value="TERKIRIM">Terkirim</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari nama sekolah, kontak, PIC..."
                value={schoolSearchQuery}
                onChange={e => setSchoolSearchQuery(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 w-60 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table of Schools */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-4">Nama Sekolah / Lembaga</th>
                  <th className="py-2.5 px-3 w-32">Kategori</th>
                  <th className="py-2.5 px-3 w-28 text-right">Alokasi Porsi</th>
                  <th className="py-2.5 px-3 w-28">Jadwal Kirim</th>
                  <th className="py-2.5 px-4 w-48">PIC & Kontak</th>
                  <th className="py-2.5 px-3 w-32 text-center">Status</th>
                  <th className="py-2.5 px-3 w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchools.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-bold text-slate-900">{s.schoolName}</div>
                      {s.notes && (
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">{s.notes}</div>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                        {s.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 tabular-nums">
                      {s.portionCount.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-500">porsi</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{s.deliveryTime || '10:00 - 10:30'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 text-[11px]">
                      <div className="font-semibold text-slate-900">{s.contactPerson || '-'}</div>
                      <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-2.5 h-2.5 text-slate-400" />
                        <span>{s.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <select
                        value={s.status || 'DIJADWALKAN'}
                        onChange={e => handleQuickUpdateBeneficiaryStatus(s, e.target.value as any)}
                        className={`text-[11px] font-bold px-2 py-1 rounded border cursor-pointer ${
                          s.status === 'TERKIRIM'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : s.status === 'DALAM_PERJALANAN'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : s.status === 'SIAP_KIRIM'
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : 'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        <option value="DIJADWALKAN">Dijadwalkan</option>
                        <option value="SIAP_KIRIM">Siap Kirim</option>
                        <option value="DALAM_PERJALANAN">Dalam Perjalanan</option>
                        <option value="TERKIRIM">Terkirim</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEditBeneficiary(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                        title="Edit data penerima manfaat, jumlah porsi, dan kontak PIC"
                      >
                        <Edit2 className="w-3 h-3 text-blue-600" />
                        <span>Edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MASTER DATA PENERIMA MANFAAT                                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'MASTER_BENEFICIARIES' && (
        <div className="space-y-4">
          {/* Header Box: Actions & Stats */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-indigo-700" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    Master Data Penerima Manfaat
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Database induk lembaga, sekolah sasaran, penetapan target porsi harian, dan kontak penanggung jawab (PIC).
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleExportMasterBeneficiariesExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors cursor-pointer"
                  title="Unduh database master penerima manfaat ke file Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Ekspor Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddBeneficiary}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Tambah Penerima Manfaat</span>
                </button>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500">Total Lembaga Terdaftar</div>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                  {beneficiaries.length} <span className="text-xs font-normal text-slate-500">titik lembaga</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Sekolah, Madrasah, PAUD & Posyandu</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500">Total Target Porsi Harian</div>
                <div className="text-xl font-bold text-emerald-800 mt-1 tabular-nums">
                  {beneficiaryCategoryStats.totalAllPortions.toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-slate-500">porsi / hari</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Kapasitas makan bergizi SPPG</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500">Kontak PIC Terverifikasi</div>
                <div className="text-xl font-bold text-indigo-900 mt-1 tabular-nums">
                  {beneficiaries.filter(b => b.contactPerson && b.phone).length}{' '}
                  <span className="text-xs font-normal text-slate-500">penanggung jawab</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Nomor HP/WA aktif terhubung</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-500">Rata-rata Porsi per Sekolah</div>
                <div className="text-xl font-bold text-blue-900 mt-1 tabular-nums">
                  {Math.round(beneficiaryCategoryStats.totalAllPortions / (beneficiaries.length || 1)).toLocaleString('id-ID')}{' '}
                  <span className="text-xs font-normal text-slate-500">porsi/titik</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">Rata-rata distribusi per lembaga</div>
              </div>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <select
                  value={masterCategoryFilter}
                  onChange={e => setMasterCategoryFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg text-slate-800 bg-white"
                >
                  <option value="ALL">Semua Kategori Sasaran</option>
                  <option value="SD / MI">Sekolah Dasar (SD / MI)</option>
                  <option value="SMP / MTs">Sekolah Menengah (SMP / MTs)</option>
                  <option value="PAUD / TK">PAUD / TK</option>
                  <option value="Ibu Hamil & Balita (B3)">Balita 3T & Ibu Hamil (B3)</option>
                </select>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari ID, sekolah, PIC, kontak..."
                  value={masterSearchQuery}
                  onChange={e => setMasterSearchQuery(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Master Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-20">ID</th>
                  <th className="py-2.5 px-4">Nama Lembaga / Sekolah</th>
                  <th className="py-2.5 px-3 w-32">Kategori Sasaran</th>
                  <th className="py-2.5 px-3 w-28 text-right">Target Porsi</th>
                  <th className="py-2.5 px-4 w-48">Kontak PIC</th>
                  <th className="py-2.5 px-3 w-28">Jadwal Kirim</th>
                  <th className="py-2.5 px-4">Catatan Titik Serah</th>
                  <th className="py-2.5 px-3 w-28 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMasterBeneficiaries.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 font-semibold">{s.id}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{s.schoolName}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {s.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 tabular-nums">
                      {s.portionCount.toLocaleString('id-ID')} <span className="text-[10px] font-normal text-slate-500">porsi</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 text-[11px]">
                      <div className="font-semibold text-slate-900">{s.contactPerson || '-'}</div>
                      <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-2.5 h-2.5 text-slate-400" />
                        <span>{s.phone || '-'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{s.deliveryTime || '09.45 WIB'}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                      {s.notes || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditBeneficiary(s)}
                          className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit data penerima manfaat"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBeneficiary(s)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus lembaga ini dari master data"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMasterBeneficiaries.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 text-xs">
                      Tidak ada data lembaga penerima manfaat yang sesuai dengan filter atau kata kunci.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INPUT & EDIT MENU HARI INI                                       */}
      {/* ========================================================================= */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <UtensilsCrossed className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {editingMenuOrderId ? 'Edit Menu & Porsi' : 'Input Menu Hari Ini'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Catat menu reguler siswa, menu khusus balita/bumil (B3), dan total sasaran porsi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMenuForm} className="flex-1 flex flex-col min-h-0 text-xs space-y-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal Distribusi Menu</label>
                  <input
                    type="date"
                    required
                    value={menuFormDate}
                    onChange={e => {
                      const newD = e.target.value;
                      setMenuFormDate(newD);
                      const d = new Date(newD);
                      d.setDate(d.getDate() - 1);
                      setMenuFormPoDate(d.toISOString().slice(0, 10));
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-semibold text-slate-800 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tanggal PO (H-1)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 2026-09-19"
                    value={menuFormPoDate}
                    onChange={e => setMenuFormPoDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-emerald-900 mb-1">
                  Total Penerima Manfaat (Porsi) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    value={menuFormPortions}
                    onChange={e => setMenuFormPortions(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-emerald-300 font-mono font-bold text-sm text-emerald-950 bg-emerald-50/50"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                    porsi siswa & balita
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Macam Menu Reguler (Siswa SD / SMP) <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Contoh: Nasi Putih, Rolade Ayam Krispi Asam Manis, Tahu Cabe Garam, Tumis Pokcoy Wortel, Semangka"
                  value={menuFormTitle}
                  onChange={e => setMenuFormTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-400">
                  Tip: Pisahkan setiap lauk atau buah dengan tanda koma (,) agar otomatis tampil sebagai badge rapi.
                </span>
              </div>

              <div>
                <label className="block font-semibold text-slate-800 mb-1">
                  Menu Khusus Balita 3T & Ibu Hamil (Diet B3)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Honey Garlic Chicken, Tempe Kukus, Sup Buncis Jagung, Pisang/Kelengkeng"
                  value={menuFormDietB3}
                  onChange={e => setMenuFormDietB3(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <span className="text-[11px] text-slate-400">
                  Kosongkan jika menu balita/bumil sama persis dengan menu reguler.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status Pengerjaan</label>
                  <select
                    value={menuFormStatus}
                    onChange={e => setMenuFormStatus(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800"
                  >
                    <option value="PLANNED">Direncanakan</option>
                    <option value="PREPPING">Persiapan Bahan</option>
                    <option value="COOKING">Sedang Dimasak</option>
                    <option value="DISTRIBUTED">Terdistribusi Selesai</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PIC Chef / Penanggung Jawab</label>
                  <input
                    type="text"
                    value={menuFormChef}
                    onChange={e => setMenuFormChef(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan Tambahan</label>
                <input
                  type="text"
                  placeholder="Keterangan distribusi, shift masak, dll"
                  value={menuFormNotes}
                  onChange={e => setMenuFormNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-800"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMenuModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan Data Menu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INPUT & BUAT PO HARI INI                                         */}
      {/* ========================================================================= */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 mb-4 shrink-0">
              <div>
                <h4 className="text-sm font-semibold text-slate-900">
                  Input & Buat Purchase Order (PO)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pencatatan daftar kebutuhan bahan baku (H-1) untuk menu harian
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPoModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pilihan Order Menu & Tanggal PO */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs shrink-0">
              <div className="sm:col-span-2">
                <label className="block font-medium text-slate-700 mb-1">
                  Menu Tujuan untuk PO:
                </label>
                <select
                  value={selectedPoOrderId}
                  onChange={e => {
                    const newId = e.target.value;
                    setSelectedPoOrderId(newId);
                    const found = orders.find(o => o.id === newId);
                    if (found && found.poArrivalItems && found.poArrivalItems.length > 0) {
                      setPoFormRows(
                        found.poArrivalItems.map(p => ({
                          category: p.category || 'Bahan Makanan',
                          itemName: p.itemName,
                          qtyOrder: p.qtyOrder || '',
                          qtyArrived: p.qtyArrived || '',
                          supplier: p.supplier || '',
                          arrivalTime: p.arrivalTime || '',
                          pic: p.pic || currentUser.name,
                          notes: p.notes || '',
                        }))
                      );
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 font-medium text-slate-800 bg-white focus:outline-none focus:border-slate-400"
                >
                  {orders.map(ord => (
                    <option key={ord.id} value={ord.id}>
                      {ord.date} - {ord.menuTitle.slice(0, 45)}... ({ord.targetPortions} porsi)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Tanggal PO (H-1):
                </label>
                <input
                  type="text"
                  placeholder="Contoh: 2026-09-19"
                  value={poFormDate}
                  onChange={e => setPoFormDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-800 bg-white font-mono focus:outline-none focus:border-slate-400"
                />
              </div>
            </div>

            {/* Form Tabel Bahan PO */}
            <form onSubmit={handleSavePoForm} className="flex-1 flex flex-col min-h-0 text-xs space-y-3 overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 text-xs">
                  Daftar Bahan PO ({poFormRows.length} item bahan):
                </span>
                <button
                  type="button"
                  onClick={handleApplyPoTemplate}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 cursor-pointer transition-colors"
                >
                  Gunakan Template Standar SPPG (Ayam, Beras, Tahu, Sayur, Buah)
                </button>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0 z-10 text-xs">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center font-medium text-slate-400">No</th>
                        <th className="py-2.5 px-3 w-36 font-medium text-slate-700">Kategori</th>
                        <th className="py-2.5 px-3 font-medium text-slate-700">Nama Barang</th>
                        <th className="py-2.5 px-3 w-48 font-medium text-slate-700">Supplier / Rekanan</th>
                        <th className="py-2.5 px-3 w-32 font-medium text-slate-700">Qty PO</th>
                        <th className="py-2.5 px-2 w-10 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {poFormRows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-400 font-mono text-xs">
                            {rIdx + 1}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={row.category}
                              onChange={e => {
                                const newCat = e.target.value;
                                const updated = [...poFormRows];
                                updated[rIdx].category = newCat;
                                if (!updated[rIdx].supplier || updated[rIdx].supplier === 'Pemasok Rekanan') {
                                  const suggested = resolveSupplierForItem(newCat, updated[rIdx].itemName, '', masterSuppliers);
                                  if (suggested && suggested !== 'Pemasok Rekanan') {
                                    updated[rIdx].supplier = suggested;
                                  }
                                }
                                setPoFormRows(updated);
                              }}
                              className="w-full px-2 py-1.5 rounded-md border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-slate-400"
                            >
                              <option value="Protein">Protein</option>
                              <option value="Sembako">Sembako</option>
                              <option value="Sayur dan Buah">Sayur dan Buah</option>
                              <option value="Sayur">Sayur</option>
                              <option value="Buah">Buah</option>
                              <option value="Bumbu">Bumbu</option>
                              <option value="Bahan Olahan">Bahan Olahan</option>
                              <option value="Lain-lain">Lain-lain</option>
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              required
                              placeholder="Misal: Ayam Potong / Telur Ayam"
                              value={row.itemName}
                              onChange={e => {
                                const newName = e.target.value;
                                const updated = [...poFormRows];
                                updated[rIdx].itemName = newName;
                                if (!updated[rIdx].supplier || updated[rIdx].supplier === 'Pemasok Rekanan') {
                                  const suggested = resolveSupplierForItem(updated[rIdx].category, newName, '', masterSuppliers);
                                  if (suggested && suggested !== 'Pemasok Rekanan') {
                                    updated[rIdx].supplier = suggested;
                                  }
                                }
                                setPoFormRows(updated);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 font-medium"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              list="po-supplier-options"
                              placeholder="Pilih / ketik supplier..."
                              value={row.supplier}
                              onChange={e => {
                                const updated = [...poFormRows];
                                updated[rIdx].supplier = e.target.value;
                                setPoFormRows(updated);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-400 font-medium bg-white"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              required
                              placeholder="Misal: 260 kg / 7 sak"
                              value={row.qtyOrder}
                              onChange={e => {
                                const updated = [...poFormRows];
                                updated[rIdx].qtyOrder = e.target.value;
                                setPoFormRows(updated);
                              }}
                              className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 text-xs text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:border-slate-400"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              disabled={poFormRows.length === 1}
                              onClick={() => {
                                const updated = poFormRows.filter((_, idx) => idx !== rIdx);
                                setPoFormRows(updated);
                              }}
                              className="text-slate-400 hover:text-rose-600 disabled:opacity-20 cursor-pointer p-1 rounded hover:bg-slate-100 transition-colors"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <datalist id="po-supplier-options">
                    {masterSuppliers.map(s => (
                      <option key={s.id} value={s.name}>
                        {s.supplyCategory ? `${s.name} (${s.supplyCategory})` : s.name}
                      </option>
                    ))}
                    {masterSuppliers.every(s => s.name !== 'Ayam Segar Fajar') && <option value="Ayam Segar Fajar" />}
                    {masterSuppliers.every(s => s.name !== 'Tahu Rio') && <option value="Tahu Rio" />}
                    {masterSuppliers.every(s => s.name !== 'UMKM Tahu Rio') && <option value="UMKM Tahu Rio" />}
                    {masterSuppliers.every(s => s.name !== 'Tumpang Grosir') && <option value="Tumpang Grosir" />}
                    {masterSuppliers.every(s => s.name !== 'UMKM Tumpang Grosir') && <option value="UMKM Tumpang Grosir" />}
                    {masterSuppliers.every(s => s.name !== 'Sayur Segar Malang') && <option value="Sayur Segar Malang" />}
                    {masterSuppliers.every(s => s.name !== 'Buah Segar Nusantara') && <option value="Buah Segar Nusantara" />}
                    {masterSuppliers.every(s => s.name !== 'Toko Bumbu Berkah') && <option value="Toko Bumbu Berkah" />}
                  </datalist>
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setPoFormRows([
                        ...poFormRows,
                        {
                          category: 'Sayur dan Buah',
                          itemName: '',
                          qtyOrder: '',
                          qtyArrived: '',
                          supplier: '',
                          arrivalTime: '08.00',
                          pic: currentUser.name,
                          notes: '',
                        },
                      ])
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 cursor-pointer shadow-2xs transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-600" />
                    <span>Tambah Baris Bahan</span>
                  </button>

                  <span className="text-xs text-slate-500">
                    Total {poFormRows.length} item bahan
                  </span>
                </div>
              </div>

              {/* Action Buttons: Hapus PO (kiri), Batal & Generate PO (kanan) */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 shrink-0">
                <div>
                  {selectedPoOrderId && (
                    <button
                      type="button"
                      onClick={() => handleDeletePoForOrder(selectedPoOrderId)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                      title="Batalkan & hapus PO resmi untuk menu ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus PO</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPoModalOpen(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndGenerateOfficialPo}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition-colors cursor-pointer active:scale-[0.99]"
                    title="Generate dan terbitkan PO resmi ke menu Input Barang & Belanja"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Generate PO</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL 3: INPUT & EDIT DATA PENERIMA MANFAAT                                */}
      {/* ========================================================================= */}
      {isBeneficiaryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {editingBeneficiary ? 'Edit Data Penerima Manfaat' : 'Tambah Penerima Manfaat Baru'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Atur nama sekolah/lembaga, kuota jumlah porsi, serta kontak penanggung jawab (PIC)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBeneficiaryModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBeneficiary} className="space-y-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Sekolah / Lembaga <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={beneficiaryFormName}
                    onChange={e => setBeneficiaryFormName(e.target.value)}
                    placeholder="Contoh: SDN 1 Jeru atau Posyandu Dahlia"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ID Lembaga
                  </label>
                  <input
                    type="text"
                    value={beneficiaryFormId}
                    onChange={e => setBeneficiaryFormId(e.target.value)}
                    placeholder="SCH-001"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-slate-50 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kategori Sasaran <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={beneficiaryFormCategory}
                    onChange={e => setBeneficiaryFormCategory(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="SD / MI">Sekolah Dasar (SD / MI)</option>
                    <option value="SMP / MTs">Sekolah Menengah (SMP / MTs)</option>
                    <option value="PAUD / TK">PAUD / TK</option>
                    <option value="Ibu Hamil & Balita (B3)">Balita 3T & Ibu Hamil (B3)</option>
                    <option value="Lembaga Sasaran Lainnya">Lembaga Sasaran Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Target Alokasi Porsi <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min={1}
                      value={beneficiaryFormPortions}
                      onChange={e => setBeneficiaryFormPortions(Number(e.target.value) || 0)}
                      className="w-full text-xs border border-slate-300 rounded-lg pl-3 pr-14 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                      porsi
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Kontak PIC / Penanggung Jawab
                  </label>
                  <input
                    type="text"
                    value={beneficiaryFormContactPerson}
                    onChange={e => setBeneficiaryFormContactPerson(e.target.value)}
                    placeholder="Contoh: Pak Hadi (Kepala Sekolah)"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Kontak / WhatsApp PIC
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={beneficiaryFormPhone}
                      onChange={e => setBeneficiaryFormPhone(e.target.value)}
                      placeholder="Contoh: 0812-3344-5501"
                      className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-2 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jadwal / Waktu Kirim
                  </label>
                  <div className="relative">
                    <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={beneficiaryFormDeliveryTime}
                      onChange={e => setBeneficiaryFormDeliveryTime(e.target.value)}
                      placeholder="Contoh: 09.45 WIB atau 10:00 - 10:30"
                      className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Operasional Distribusi
                  </label>
                  <select
                    value={beneficiaryFormStatus}
                    onChange={e => setBeneficiaryFormStatus(e.target.value as any)}
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="DIJADWALKAN">Dijadwalkan</option>
                    <option value="SIAP_KIRIM">Siap Kirim di Dapur</option>
                    <option value="DALAM_PERJALANAN">Dalam Perjalanan Kurir</option>
                    <option value="TERKIRIM">Telah Terkirim & Diterima</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Titik Serah & Catatan Jalur Distribusi
                </label>
                <textarea
                  rows={2}
                  value={beneficiaryFormNotes}
                  onChange={e => setBeneficiaryFormNotes(e.target.value)}
                  placeholder="Contoh: Jalur Distribusi 1 - Area Jeru Timur, serah terima di ruang guru piket"
                  className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBeneficiaryModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingBeneficiary ? 'Simpan Perubahan' : 'Simpan Penerima Manfaat'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
