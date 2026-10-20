import React, {useState, useMemo, useEffect, useRef} from "react";
import {Select} from "./common/Select";
import {SearchPicker} from "./common/SearchPicker";
import { useConfirm } from '../context/ConfirmContext';
import {useAuth} from "../context/AuthContext";
import {useToast} from "../context/ToastContext";
import {warehouseDb, APP_SETTINGS_CHANGED_EVENT} from "../db/storage";
import {getBeneficiaryRecap, saveBeneficiaryRecap, getBeneficiaryRecapsInRange, getAllBeneficiaryRecapDates, getLastBeneficiaryRecapBefore, parseBeneficiaryRecapText, DailyBeneficiaryRecap, SkipReason, SKIP_REASON_LABEL} from "../utils/beneficiaryRecap";
import {MenuOrder, MenuOrderStatus, MenuIngredientReq, MenuPoArrivalItem, SchoolBeneficiaryAllocation, PurchaseOrderNota, PurchaseOrderItem} from "../types/warehouse";
import {generateNextPoNumber} from "../utils/poNumberGenerator";
import {angkaTerbilang} from "./ToolsPrintModule";
import {
  UtensilsCrossed,
  Plus,
  Printer,
  FileText,
  Search,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  CalendarRange,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Edit2,
  Trash2,
  Filter,
  PackagePlus,
  Phone,
  MoreHorizontal,
  Save,
  RotateCcw,
  ClipboardPaste
} from "lucide-react";
import {exportMultiSheetExcel, exportToExcel} from "../lib/excelExport";
import {localDateIso} from "../utils/localDate";
import {normalizeQtyForUnit} from "../utils/unitConversion";
import {SPPG_ADDRESS} from "./common/KopText";
import {FormDialog, DialogShell, FIELD_INPUT, FIELD_LABEL, TABLE_INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, FOCUS_RING} from "./common/FormDialog";
import {ActionDropdown} from "./common/ActionDropdown";
import {DateStepper} from "./common/DateStepper";
import {SppgLogo} from "./SppgLogo";
import {DeliveryNotesSubModule} from "./DeliveryNotesSubModule";

type PeriodType = "WEEKLY" | "MONTHLY" | "DAILY" | "ALL" | "PRESET_SAMPLE";
type SubTabType = "MENU_ORDERS" | "BENEFICIARIES" | "DELIVERY_NOTES" | "MASTER_BENEFICIARIES";

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
  const nameLower = (itemName || "").toLowerCase();
  for (const [key, val] of Object.entries(DEFAULT_MENU_PRICE_MAP)) {
    if (nameLower.includes(key)) return val;
  }
  return 15000;
}

function parseNumericQuantity(qty: string | number): number {
  if (typeof qty === "number") return qty;
  const clean = String(qty).replace(",", ".");
  const match = clean.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

// Pembanding nama bahan dan supplier: abaikan huruf besar dan spasi berlebih.
const normName = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Baris dengan bahan dan supplier yang sama dalam satu daftar PO. */
function findDuplicatePoRows(items: MenuPoArrivalItem[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  items.forEach((it) => {
    const key = `${normName(it.itemName)}|${normName(it.supplier)}`;
    if (seen.has(key)) dupes.add(it.itemName);
    seen.add(key);
  });
  return Array.from(dupes);
}

function parseMenuDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const clean = dateStr.toLowerCase().trim();

  // If ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const parts = clean.slice(0, 10).split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day);
    return isNaN(d.getTime()) ? null : d;
  }

  const monthMap: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    mei: 4,
    jun: 5,
    jul: 6,
    agu: 7,
    ags: 7,
    sep: 8,
    okt: 9,
    nov: 10,
    des: 11,
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
  if (!dateStr) return "-";
  try {
    const d = parseMenuDate(dateStr);
    if (!d) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const shortYear = String(d.getFullYear()).slice(-2);
    return `${d.getDate()}-${months[d.getMonth()]}-${shortYear}`;
  } catch {
    return dateStr;
  }
};

const formatIndonesianDate = (dateStr: string): string => {
  const d = parseMenuDate(dateStr);
  if (!d) return dateStr;
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
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
    .map((s) => s.trim())
    .filter(Boolean);

  return rawList.map((name) => {
    const lower = name.toLowerCase();
    let category = "Pelengkap";

    if (lower.includes("nasi") || lower.includes("karbo") || lower.includes("lontong") || lower.includes("mie") || lower.includes("bihun")) {
      category = "Karbohidrat Pokok";
    } else if (
      lower.includes("ayam") ||
      lower.includes("daging") ||
      lower.includes("sapi") ||
      lower.includes("ikan") ||
      lower.includes("telur") ||
      lower.includes("rolade") ||
      lower.includes("nugget") ||
      lower.includes("katsu") ||
      lower.includes("semur") ||
      lower.includes("woku")
    ) {
      category = "Lauk Protein Hewani";
    } else if (lower.includes("tahu") || lower.includes("tempe") || lower.includes("kacang") || lower.includes("mendoan")) {
      category = "Lauk Protein Nabati";
    } else if (
      lower.includes("sayur") ||
      lower.includes("sop") ||
      lower.includes("sup") ||
      lower.includes("tumis") ||
      lower.includes("buncis") ||
      lower.includes("wortel") ||
      lower.includes("pokcoy") ||
      lower.includes("pakcoy") ||
      lower.includes("bayam") ||
      lower.includes("lodeh") ||
      lower.includes("steam") ||
      lower.includes("jagung") ||
      lower.includes("capcay")
    ) {
      category = "Sayuran Berserat";
    } else if (
      lower.includes("semangka") ||
      lower.includes("melon") ||
      lower.includes("pisang") ||
      lower.includes("jeruk") ||
      lower.includes("buah") ||
      lower.includes("kelengkeng") ||
      lower.includes("anggur") ||
      lower.includes("pepaya") ||
      lower.includes("apel")
    ) {
      category = "Buah Segar";
    } else if (lower.includes("susu") || lower.includes("puding") || lower.includes("snack")) {
      category = "Susu & Minuman Gizi";
    }

    return {name, category};
  });
}

// Template cepat untuk PO bahan standar SPPG
const STANDARD_PO_TEMPLATES = [
  {category: "Protein", itemName: "Ayam Potong", qtyOrder: "260 kg", qtyArrived: "260 kg", supplier: "Ayam Segar Fajar", arrivalTime: "08.30", pic: "Akmal"},
  {category: "Protein", itemName: "Tahu Putih", qtyOrder: "520 pcs", qtyArrived: "520 pcs", supplier: "Tahu Rio", arrivalTime: "09.30", pic: "Akmal"},
  {category: "Sembako", itemName: "Beras Mentari 25kg", qtyOrder: "7 sak", qtyArrived: "7 sak", supplier: "Tumpang Grosir", arrivalTime: "14.00", pic: "Akmal"},
  {category: "Sembako", itemName: "Minyak Tropical 2L", qtyOrder: "12 pouch", qtyArrived: "12 pouch", supplier: "Tumpang Grosir", arrivalTime: "14.00", pic: "Akmal"},
  {category: "Sayur dan Buah", itemName: "Buncis Segar", qtyOrder: "45 kg", qtyArrived: "45 kg", supplier: "Sayur Segar Malang", arrivalTime: "07.30", pic: "Akmal"},
  {category: "Sayur dan Buah", itemName: "Wortel Manis", qtyOrder: "35 kg", qtyArrived: "35 kg", supplier: "Sayur Segar Malang", arrivalTime: "07.30", pic: "Akmal"},
  {category: "Sayur dan Buah", itemName: "Semangka Non-Biji", qtyOrder: "180 kg", qtyArrived: "180 kg", supplier: "Buah Segar Nusantara", arrivalTime: "10.00", pic: "Akmal"},
  {category: "Bumbu", itemName: "Bawang Putih Kating", qtyOrder: "8 kg", qtyArrived: "8 kg", supplier: "Toko Bumbu Berkah", arrivalTime: "08.00", pic: "Akmal"},
];

const getTodayIso = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Urutan sesi makan dalam sehari, dipakai saat satu tanggal punya beberapa menu.
const MEAL_SESSION_ORDER: Record<MenuOrder["mealSession"], number> = {Pagi: 0, Siang: 1, Snack: 2};
const sortBySession = (a: MenuOrder, b: MenuOrder) => MEAL_SESSION_ORDER[a.mealSession] - MEAL_SESSION_ORDER[b.mealSession];

interface MenuOrdersModuleProps {
  onNavigate?: (tab: string) => void;
  /** Dibuka dari pengingat Ringkasan: langsung ke Penerima Manfaat → Porsi hari ini. */
  initialView?: "PORSI_HARI_INI";
}

export const MenuOrdersModule: React.FC<MenuOrdersModuleProps> = ({onNavigate, initialView}) => {
  const {currentUser} = useAuth();
  const toast = useToast();
  const askConfirm = useConfirm();
  const [orders, setOrders] = useState<MenuOrder[]>(() => warehouseDb.getMenuOrders());
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>(initialView === "PORSI_HARI_INI" ? "BENEFICIARIES" : "MENU_ORDERS");

  // Tanggal Hari Ini (otomatis sesuai jam sistem)
  const todayStr = useMemo(() => getTodayIso(), []);

  // Period filter states: DEFAULT KE HARI INI (DAILY)
  const [periodType, setPeriodType] = useState<PeriodType>("DAILY");
  const [selectedDailyDate, setSelectedDailyDate] = useState<string>(todayStr);
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return localDateIso(d);
  });
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<string>(todayStr.slice(0, 7)); // YYYY-MM

  // Filters for Tab 1 (Menu Orders)
  const [selectedSession, setSelectedSession] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Filters for Tab 2 (Penerima Manfaat)
  const [selectedBeneficiaryCategory, setSelectedBeneficiaryCategory] = useState<string>("ALL");
  const [beneficiaryStatusFilter, setBeneficiaryStatusFilter] = useState<string>("ALL");
  const [schoolSearchQuery, setSchoolSearchQuery] = useState("");
  const [beneficiaryViewMode, setBeneficiaryViewMode] = useState<"REKAP_HARIAN" | "DETAIL_HARIAN">(
    initialView === "PORSI_HARI_INI" ? "DETAIL_HARIAN" : "REKAP_HARIAN",
  );
  // Tab navbar kembali ke "Menu" setelah dibuka lewat pengingat, tanpa memuat ulang modul
  useEffect(() => {
    if (initialView === "PORSI_HARI_INI") onNavigate?.("menu_orders");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [beneficiaryPeriodPreset, setBeneficiaryPeriodPreset] = useState<"ALL_ORDERS" | "LAST_7_DAYS" | "THIS_MONTH" | "CUSTOM">("ALL_ORDERS");
  const [beneficiaryStartDate, setBeneficiaryStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return localDateIso(d);
  });
  const [beneficiaryEndDate, setBeneficiaryEndDate] = useState<string>(todayStr);
  const [beneficiarySelectedDate, setBeneficiarySelectedDate] = useState<string>(todayStr);
  const [dailyDraftPortions, setDailyDraftPortions] = useState<Record<string, number>>({});
  // Sekolah yang tidak dikirim di tanggal terpilih beserta alasannya. Porsinya di draf tetap porsi biasa.
  const [dailyDraftSkips, setDailyDraftSkips] = useState<Record<string, SkipReason>>({});
  // Asal angka awal draf, untuk keterangan di layar
  const [draftSource, setDraftSource] = useState<"RECAP" | "ORDER" | "LAST_RECAP" | "MASTER">("MASTER");
  const [draftSourceDate, setDraftSourceDate] = useState<string | undefined>(undefined);
  const [isDailyDraftDirty, setIsDailyDraftDirty] = useState(false);
  const [isBeneficiaryPrintModalOpen, setIsBeneficiaryPrintModalOpen] = useState(false);

  // Master beneficiaries state (persisted via storage.ts)
  const [beneficiaries, setBeneficiaries] = useState<SchoolBeneficiaryAllocation[]>(() => warehouseDb.getSchoolBeneficiaries());

  // Beneficiary Modal State (Edit & Create)
  const [isBeneficiaryModalOpen, setIsBeneficiaryModalOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState<SchoolBeneficiaryAllocation | null>(null);
  const [beneficiaryFormId, setBeneficiaryFormId] = useState("");
  const [beneficiaryFormName, setBeneficiaryFormName] = useState("");
  const [beneficiaryFormCategory, setBeneficiaryFormCategory] = useState<string>("SD / MI");
  const [beneficiaryFormPortions, setBeneficiaryFormPortions] = useState<number>(300);
  const [beneficiaryFormDeliveryTime, setBeneficiaryFormDeliveryTime] = useState("09.45 WIB");
  const [beneficiaryFormContactPerson, setBeneficiaryFormContactPerson] = useState("");
  const [beneficiaryFormPhone, setBeneficiaryFormPhone] = useState("");
  const [beneficiaryFormStatus, setBeneficiaryFormStatus] = useState<"TERKIRIM" | "DALAM_PERJALANAN" | "SIAP_KIRIM" | "DIJADWALKAN">("DIJADWALKAN");
  const [beneficiaryFormNotes, setBeneficiaryFormNotes] = useState("");

  // Filters for Tab 3 (Master Data Penerima Manfaat)
  const [masterCategoryFilter, setMasterCategoryFilter] = useState<string>("ALL");
  const [masterSearchQuery, setMasterSearchQuery] = useState<string>("");

  // Expandable cards state for Menu Order items
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});


  // Action Dropdowns
  const [openOrderMenuId, setOpenOrderMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".order-action-menu-container")) {
        setOpenOrderMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Navigasi Tanggal (Kemarin, Hari Ini, Besok)
  const handlePrevDay = () => {
    const cur = parseMenuDate(selectedDailyDate) || new Date();
    cur.setDate(cur.getDate() - 1);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    setSelectedDailyDate(`${y}-${m}-${d}`);
    setPeriodType("DAILY");
  };

  const handleNextDay = () => {
    const cur = parseMenuDate(selectedDailyDate) || new Date();
    cur.setDate(cur.getDate() + 1);
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    setSelectedDailyDate(`${y}-${m}-${d}`);
    setPeriodType("DAILY");
  };

  const handleJumpToToday = () => {
    setSelectedDailyDate(todayStr);
    setPeriodType("DAILY");
  };

  const handleSetThisWeek = () => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    setStartDate(localDateIso(start));
    setEndDate(localDateIso(end));
    setPeriodType("WEEKLY");
  };

  const handleSetLastWeek = () => {
    const end = new Date();
    end.setDate(end.getDate() - 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    setStartDate(localDateIso(start));
    setEndDate(localDateIso(end));
    setPeriodType("WEEKLY");
  };

  // =========================================================================
  // MODAL 1: FORM INPUT / EDIT MENU HARI INI
  // =========================================================================
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingMenuOrderId, setEditingMenuOrderId] = useState<string | null>(null);

  const [menuFormDate, setMenuFormDate] = useState(todayStr);
  const [menuFormPoDate, setMenuFormPoDate] = useState("");
  const [menuFormSession, setMenuFormSession] = useState<"Pagi" | "Siang" | "Snack">("Siang");
  const [menuFormTitle, setMenuFormTitle] = useState("");
  const [menuFormDietB3, setMenuFormDietB3] = useState("");
  const [menuFormChef, setMenuFormChef] = useState("");
  const [menuFormNotes, setMenuFormNotes] = useState("");

  // =========================================================================
  // MODAL 2: FORM INPUT / EDIT PO HARI INI & KEDATANGAN BARANG
  // =========================================================================
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedPoOrderId, setSelectedPoOrderId] = useState<string>("");
  const [poFormDate, setPoFormDate] = useState("");
  const [poFormRows, setPoFormRows] = useState<
    Array<{
      category: string;
      itemName: string;
      qtyOrder: string;
      qtyArrived: string;
      supplier: string;
      arrivalTime: string;
      pic: string;
      notes?: string;
    }>
  >([]);
  // Baris yang baru ditambahkan lewat kelompok supplier, agar kursor langsung ke nama bahan.
  const [poFocusRow, setPoFocusRow] = useState<number | null>(null);

  const anyFormModalOpen = isMenuModalOpen || isPoModalOpen || isBeneficiaryModalOpen || isBeneficiaryPrintModalOpen;
  useEffect(() => {
    if (!anyFormModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setIsMenuModalOpen(false);
      setIsPoModalOpen(false);
      setIsBeneficiaryModalOpen(false);
      setIsBeneficiaryPrintModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anyFormModalOpen]);

  const refreshOrders = () => {
    setOrders(warehouseDb.getMenuOrders());
  };

  // Kartu terbuka secara bawaan, jadi id yang belum tercatat dianggap terbuka.
  const toggleExpandOrder = (id: string) => {
    setExpandedOrderIds((prev) => ({...prev, [id]: !(prev[id] ?? true)}));
  };

  // Date range evaluation
  const effectiveDateRange = useMemo(() => {
    if (periodType === "PRESET_SAMPLE") {
      const s = parseMenuDate("2026-09-20");
      const e = parseMenuDate("2026-09-24");
      return {start: s, end: e, label: "Periode 20 - 24 Sep 2026 (Data Excel SPPG)"};
    }
    if (periodType === "ALL") {
      return {start: null, end: null, label: "Semua Periode Tercatat"};
    }
    if (periodType === "DAILY") {
      const target = parseMenuDate(selectedDailyDate);
      return {start: target, end: target, label: `Harian: ${selectedDailyDate}`};
    }
    if (periodType === "WEEKLY") {
      const s = parseMenuDate(startDate);
      const e = parseMenuDate(endDate);
      return {start: s, end: e, label: `Mingguan: ${startDate} s/d ${endDate}`};
    }
    if (periodType === "MONTHLY") {
      const [year, month] = selectedMonth.split("-").map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0);
      const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      return {
        start: startOfMonth,
        end: endOfMonth,
        label: `Bulan ${monthNames[month - 1] || ""} ${year}`,
      };
    }
    return {start: null, end: null, label: "Periode Kustom"};
  }, [periodType, selectedDailyDate, startDate, endDate, selectedMonth]);

  // Filtered orders based on active period & filters
  const filteredOrders = useMemo(() => {
    return orders
      .filter((ord) => {
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
        if (selectedSession !== "ALL" && ord.mealSession !== selectedSession) return false;
        if (selectedStatus !== "ALL" && ord.status !== selectedStatus) return false;

        // 3. Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = ord.menuTitle.toLowerCase().includes(q);
          const matchId = ord.id.toLowerCase().includes(q);
          const matchChef = (ord.chefInCharge || "").toLowerCase().includes(q);
          const matchB3 = (ord.specialDietB3 || "").toLowerCase().includes(q);
          const matchNotes = (ord.notes || "").toLowerCase().includes(q);
          const matchItems = (ord.poArrivalItems || []).some((it) => it.itemName.toLowerCase().includes(q) || it.supplier.toLowerCase().includes(q));
          if (!matchTitle && !matchId && !matchChef && !matchB3 && !matchNotes && !matchItems) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const da = parseMenuDate(a.date)?.getTime() || 0;
        const db = parseMenuDate(b.date)?.getTime() || 0;
        return da - db;
      });
  }, [orders, effectiveDateRange, selectedSession, selectedStatus, searchQuery]);

  // Distinct dates in the active filtered orders
  const activeOrderDates = useMemo(() => {
    const setDates = new Set<string>();
    filteredOrders.forEach((o) => setDates.add(o.date));
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
    let arrivedItemsCount = 0;

    filteredOrders.forEach((o) => {
      totalPortionsPlanned += o.targetPortions || 0;
      if (o.status === "DISTRIBUTED" || o.status === "COMPLETED") {
        totalPortionsDistributed += o.targetPortions || 0;
      }
      if (o.status === "COOKING" || o.status === "PREPPING") {
        inCooking++;
      }
      if (o.poArrivalItems) {
        totalPOItemsCount += o.poArrivalItems.length;
        o.poArrivalItems.forEach((item) => {
          totalEstimatedCost += item.totalCost || 0;
          if ((item.qtyArrived || "").trim()) arrivedItemsCount++;
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
      arrivedItemsCount,
    };
  }, [filteredOrders]);

  // Master schools & beneficiary categories list (sourced from reactive beneficiaries state)
  const masterSchools = beneficiaries;

  // Filtered schools based on category, status and search for Tab 2
  const filteredSchools = useMemo(() => {
    return masterSchools.filter((school) => {
      if (selectedBeneficiaryCategory !== "ALL" && school.category !== selectedBeneficiaryCategory) {
        return false;
      }
      if (beneficiaryStatusFilter !== "ALL" && (school.status || "DIJADWALKAN") !== beneficiaryStatusFilter) {
        return false;
      }
      if (schoolSearchQuery.trim()) {
        const q = schoolSearchQuery.toLowerCase();
        const matchName = school.schoolName.toLowerCase().includes(q);
        const matchPic = (school.contactPerson || "").toLowerCase().includes(q);
        const matchPhone = (school.phone || "").toLowerCase().includes(q);
        const matchNotes = (school.notes || "").toLowerCase().includes(q);
        if (!matchName && !matchPic && !matchPhone && !matchNotes) return false;
      }
      return true;
    });
  }, [masterSchools, selectedBeneficiaryCategory, beneficiaryStatusFilter, schoolSearchQuery]);

  // Filtered master beneficiaries for Tab 3 (Master Data)
  const filteredMasterBeneficiaries = useMemo(() => {
    return masterSchools.filter((school) => {
      if (masterCategoryFilter !== "ALL" && school.category !== masterCategoryFilter) {
        return false;
      }
      if (masterSearchQuery.trim()) {
        const q = masterSearchQuery.toLowerCase();
        const matchId = (school.id || "").toLowerCase().includes(q);
        const matchName = school.schoolName.toLowerCase().includes(q);
        const matchPic = (school.contactPerson || "").toLowerCase().includes(q);
        const matchPhone = (school.phone || "").toLowerCase().includes(q);
        const matchNotes = (school.notes || "").toLowerCase().includes(q);
        if (!matchId && !matchName && !matchPic && !matchPhone && !matchNotes) return false;
      }
      return true;
    });
  }, [masterSchools, masterCategoryFilter, masterSearchQuery]);

  // Beneficiary category summary breakdown
  const beneficiaryCategoryStats = useMemo(() => {
    const categories: Record<string, {category: string; portions: number; schoolCount: number}> = {
      "SD / MI": {category: "SD / MI", portions: 0, schoolCount: 0},
      "SMP / MTs": {category: "SMP / MTs", portions: 0, schoolCount: 0},
      "PAUD / TK": {category: "PAUD / TK", portions: 0, schoolCount: 0},
      "Ibu Hamil & Balita (B3)": {category: "Ibu Hamil & Balita (B3)", portions: 0, schoolCount: 0},
    };

    let totalAllPortions = 0;

    masterSchools.forEach((s) => {
      const cat = s.category;
      if (!categories[cat]) {
        categories[cat] = {category: cat, portions: 0, schoolCount: 0};
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

  const categoryOptions = useMemo(
    () => Array.from(new Set(["SD / MI", "SMP / MTs", "PAUD / TK", "Ibu Hamil & Balita (B3)", ...masterSchools.map((m) => m.category)])).filter(Boolean),
    [masterSchools],
  );

  // Beneficiary Actions Handlers
  const handleOpenAddBeneficiary = () => {
    setEditingBeneficiary(null);
    // Nomor terbesar + 1; memakai jumlah data bisa bentrok dengan id yang sudah ada setelah ada yang dihapus.
    const maxNum = beneficiaries.reduce((max, b) => Math.max(max, Number(b.id.match(/(\d+)$/)?.[1] || 0)), 0);
    setBeneficiaryFormId(`SCH-${String(maxNum + 1).padStart(3, "0")}`);
    setBeneficiaryFormName("");
    setBeneficiaryFormCategory("SD / MI");
    setBeneficiaryFormPortions(250);
    setBeneficiaryFormDeliveryTime("09.45 WIB");
    setBeneficiaryFormContactPerson("");
    setBeneficiaryFormPhone("");
    setBeneficiaryFormStatus("DIJADWALKAN");
    setBeneficiaryFormNotes("");
    setIsBeneficiaryModalOpen(true);
  };

  const handleOpenEditBeneficiary = (b: SchoolBeneficiaryAllocation) => {
    setEditingBeneficiary(b);
    setBeneficiaryFormId(b.id);
    setBeneficiaryFormName(b.schoolName);
    setBeneficiaryFormCategory(b.category);
    setBeneficiaryFormPortions(b.portionCount || 0);
    setBeneficiaryFormDeliveryTime(b.deliveryTime || "09.45 WIB");
    setBeneficiaryFormContactPerson(b.contactPerson || "");
    setBeneficiaryFormPhone(b.phone || "");
    setBeneficiaryFormStatus(b.status || "DIJADWALKAN");
    setBeneficiaryFormNotes(b.notes || "");
    setIsBeneficiaryModalOpen(true);
  };

  const handleSaveBeneficiary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiaryFormName.trim()) {
      toast.error("Nama sekolah atau lembaga penerima manfaat wajib diisi.", "Form Belum Lengkap");
      return;
    }
    if (Number(beneficiaryFormPortions) <= 0) {
      toast.error("Jumlah porsi penerima manfaat harus lebih dari 0.", "Form Belum Lengkap");
      return;
    }
    if (!editingBeneficiary && beneficiaries.some((b) => b.id === beneficiaryFormId.trim())) {
      toast.error(`ID ${beneficiaryFormId.trim()} sudah dipakai sekolah lain.`, "ID Sudah Ada");
      return;
    }

    const itemToSave: SchoolBeneficiaryAllocation = {
      // ID sekolah yang sedang diubah tidak boleh berganti, supaya tidak tercipta data ganda.
      id: editingBeneficiary ? editingBeneficiary.id : beneficiaryFormId.trim() || `SCH-${Date.now().toString().slice(-4)}`,
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
    toast.success(
      editingBeneficiary
        ? `Data penerima manfaat "${itemToSave.schoolName}" berhasil diperbarui: ${itemToSave.portionCount.toLocaleString("id-ID")} porsi, PIC: ${itemToSave.contactPerson || "-"} (${itemToSave.phone || "-"}).`
        : `Lembaga penerima manfaat baru "${itemToSave.schoolName}" berhasil ditambahkan.`,
    );
  };

  const handleDeleteBeneficiary = async (b: SchoolBeneficiaryAllocation) => {
    if (await askConfirm({
      title: `Hapus penerima manfaat "${b.schoolName}"?`,
      message: 'Data yang dihapus tidak bisa dikembalikan.',
      confirmText: 'Hapus',
      variant: 'danger',
    })) {
      warehouseDb.deleteSchoolBeneficiary(b.id, currentUser || undefined);
      setBeneficiaries(warehouseDb.getSchoolBeneficiaries());
      toast.success(`Data penerima manfaat "${b.schoolName}" berhasil dihapus.`);
    }
  };

  const handleQuickUpdateBeneficiaryStatus = (b: SchoolBeneficiaryAllocation, newStatus: SchoolBeneficiaryAllocation["status"]) => {
    const updated = {...b, status: newStatus};
    warehouseDb.saveSchoolBeneficiary(updated, currentUser || undefined);
    setBeneficiaries(warehouseDb.getSchoolBeneficiaries());
  };

  const handleExportMasterBeneficiariesExcel = () => {
    const rows = beneficiaries.map((b, idx) => ({
      No: idx + 1,
      "ID Lembaga": b.id,
      "Nama Sekolah / Lembaga": b.schoolName,
      "Kategori Sasaran": b.category,
      "Jumlah Alokasi Porsi": b.portionCount,
      "Jadwal Kirim": b.deliveryTime || "-",
      "Nama Kontak PIC": b.contactPerson || "-",
      "Nomor HP / WA PIC": b.phone || "-",
      "Status Operasional": b.status || "DIJADWALKAN",
      "Catatan / Titik Serah": b.notes || "-",
    }));
    exportToExcel(rows, `Master_Data_Penerima_Manfaat_SPPG_${localDateIso(new Date())}.xlsx`, "Master Penerima Manfaat");
  };

  // =========================================================================
  // REKAP DATA HARIAN PENERIMA MANFAAT (ALOKASI PORSI PER HARI TIAP SEKOLAH)
  // =========================================================================
  // Sinkronisasi draf porsi saat tanggal terpilih atau orders berubah
  // Satu tanggal bisa punya beberapa sesi makan; alokasi diatur per sesi.
  const [beneficiaryOrderId, setBeneficiaryOrderId] = useState("");
  // Rekap harian tersimpan (lihat utils/beneficiaryRecap); versi naik saat app_settings berubah dari perangkat lain
  const [recapVersion, setRecapVersion] = useState(0);
  useEffect(() => {
    const onChange = () => setRecapVersion((v) => v + 1);
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, onChange);
  }, []);
  const savedRecap = useMemo(
    () => getBeneficiaryRecap(beneficiarySelectedDate),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [beneficiarySelectedDate, recapVersion],
  );
  const [recapPasteText, setRecapPasteText] = useState<string | null>(null);
  const [recapReportedTotal, setRecapReportedTotal] = useState<number | undefined>(undefined);
  const dayOrders = useMemo(
    () => orders.filter((o) => o.date === beneficiarySelectedDate).sort(sortBySession),
    [orders, beneficiarySelectedDate],
  );
  const beneficiaryOrder = dayOrders.find((o) => o.id === beneficiaryOrderId) ?? dayOrders[0];

  const draftKey = `${beneficiarySelectedDate}|${beneficiaryOrder?.id || ""}`;
  const draftKeyRef = useRef(draftKey);
  const dailyDirtyRef = useRef(isDailyDraftDirty);
  dailyDirtyRef.current = isDailyDraftDirty;
  useEffect(() => {
    // Data order dimuat ulang (mis. setelah ubah status) tidak boleh menghapus perubahan porsi yang belum disimpan.
    if (draftKeyRef.current === draftKey && dailyDirtyRef.current) return;
    draftKeyRef.current = draftKey;
    const currentOrder = beneficiaryOrder;
    const draft: Record<string, number> = {};
    const skips: Record<string, SkipReason> = {};
    // Urutan sumber: rekap tanggal ini → alokasi di menu → rekap hari kirim terakhir → porsi standar.
    const recap = getBeneficiaryRecap(beneficiarySelectedDate);
    const hasOrderAllocations = Boolean(currentOrder?.beneficiaryAllocations?.length);
    const lastRecap = !recap && !hasOrderAllocations ? getLastBeneficiaryRecapBefore(beneficiarySelectedDate) : undefined;
    setRecapReportedTotal(recap?.reportedTotal);
    setDraftSource(recap ? "RECAP" : hasOrderAllocations ? "ORDER" : lastRecap ? "LAST_RECAP" : "MASTER");
    setDraftSourceDate(lastRecap?.date);
    masterSchools.forEach((s) => {
      if (recap) {
        // Rekap yang sudah dicatat adalah angka sebenarnya hari itu
        const entry = recap.entries.find((e) => e.schoolId === s.id);
        if (entry?.skipReason) {
          skips[s.id] = entry.skipReason;
          draft[s.id] = entry.usualCount ?? s.portionCount;
        } else {
          draft[s.id] = entry ? entry.count : 0;
        }
      } else if (hasOrderAllocations) {
        const match = currentOrder!.beneficiaryAllocations!.find((b) => b.id === s.id);
        draft[s.id] = match ? match.portionCount : s.portionCount;
      } else if (lastRecap) {
        // Angka harian biasanya mirip hari kirim terakhir; status tidak kirim tidak ikut terbawa
        const entry = lastRecap.entries.find((e) => e.schoolId === s.id);
        draft[s.id] = entry ? (entry.skipReason ? entry.usualCount ?? s.portionCount : entry.count) : s.portionCount;
      } else {
        draft[s.id] = s.portionCount;
      }
    });
    setDailyDraftPortions(draft);
    setDailyDraftSkips(skips);
    setIsDailyDraftDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, orders, masterSchools, recapVersion]);

  // Simpan perubahan porsi harian pada tanggal terpilih
  const handleSaveDailyAllocations = () => {
    const currentOrder = beneficiaryOrder;
    // Sekolah yang tidak dikirim tercatat 0 porsi di menu dan surat jalan
    const updatedAllocations: SchoolBeneficiaryAllocation[] = masterSchools.map((s) => ({
      ...s,
      portionCount: dailyDraftSkips[s.id] ? 0 : Number(dailyDraftPortions[s.id] ?? s.portionCount),
      status: currentOrder?.beneficiaryAllocations?.find((b) => b.id === s.id)?.status || "DIJADWALKAN",
    }));

    const totalPortions = updatedAllocations.reduce((sum, a) => sum + (Number(a.portionCount) || 0), 0);

    // Rekap harian selalu disimpan, juga tanpa menu, agar jumlah penerima manfaat tiap hari tercatat permanen.
    saveBeneficiaryRecap(
      beneficiarySelectedDate,
      masterSchools.map((sc) => {
        const reason = dailyDraftSkips[sc.id];
        const usual = Number(dailyDraftPortions[sc.id] ?? sc.portionCount) || 0;
        return reason
          ? {schoolId: sc.id, schoolName: sc.schoolName, category: sc.category, count: 0, skipReason: reason, usualCount: usual}
          : {schoolId: sc.id, schoolName: sc.schoolName, category: sc.category, count: usual};
      }),
      currentUser,
      recapReportedTotal,
    );
    setRecapVersion((v) => v + 1);

    // Tanpa menu tidak dibuat menu bayangan; alokasi di menu hanya diperbarui bila menunya ada.
    if (currentOrder) {
      const updatedOrder: MenuOrder = {
        ...currentOrder,
        beneficiaryAllocations: updatedAllocations,
        targetPortions: totalPortions,
        totalBeneficiaries: totalPortions,
      };
      warehouseDb.saveMenuOrder(updatedOrder, currentUser, false);
      setOrders(warehouseDb.getMenuOrders());
    }
    setIsDailyDraftDirty(false);
    const skippedCount = Object.keys(dailyDraftSkips).length;
    toast.success(
      `Porsi ${formatIndonesianDate(beneficiarySelectedDate)} tersimpan: ${totalPortions.toLocaleString("id-ID")} porsi` +
        (skippedCount > 0 ? `, ${skippedCount} sekolah tidak dikirim.` : "."),
    );
  };

  // Status kirim berlaku per tanggal, jadi disimpan di alokasi order hari itu, bukan di data master sekolah.
  const handleUpdateDailyStatus = (school: SchoolBeneficiaryAllocation, status: NonNullable<SchoolBeneficiaryAllocation["status"]>) => {
    const currentOrder = beneficiaryOrder;
    if (!currentOrder) {
      toast.warning("Catat menu untuk tanggal ini dulu.", "Menu Belum Ada");
      return;
    }
    const base: SchoolBeneficiaryAllocation[] = currentOrder.beneficiaryAllocations?.length
      ? currentOrder.beneficiaryAllocations
      : masterSchools.map((m) => ({...m, portionCount: Number(dailyDraftPortions[m.id] ?? m.portionCount), status: "DIJADWALKAN" as const}));
    const hasSchool = base.some((b) => b.id === school.id);
    const allocations = hasSchool
      ? base.map((b) => (b.id === school.id ? {...b, status} : b))
      : [...base, {...school, portionCount: Number(dailyDraftPortions[school.id] ?? school.portionCount), status}];
    warehouseDb.saveMenuOrder({...currentOrder, beneficiaryAllocations: allocations}, currentUser, false);
    setOrders(warehouseDb.getMenuOrders());
  };

  const changeBeneficiaryDate = async (date: string) => {
    if (date === beneficiarySelectedDate) return;
    if (isDailyDraftDirty && !(await askConfirm({
      title: "Pindah tanggal tanpa menyimpan?",
      message: "Perubahan porsi di tanggal ini akan hilang.",
      confirmText: "Pindah tanggal",
      variant: "warning",
    }))) return;
    setIsDailyDraftDirty(false);
    setBeneficiaryOrderId("");
    setBeneficiarySelectedDate(date);
  };

  const changeBeneficiaryOrder = async (orderId: string) => {
    if (orderId === beneficiaryOrder?.id) return;
    if (isDailyDraftDirty && !(await askConfirm({
      title: "Pindah sesi tanpa menyimpan?",
      message: "Perubahan porsi di sesi ini akan hilang.",
      confirmText: "Pindah sesi",
      variant: "warning",
    }))) return;
    setIsDailyDraftDirty(false);
    setBeneficiaryOrderId(orderId);
  };

  // Pratinjau teks rekap yang ditempel (dari WhatsApp/Excel)
  const recapPastePreview = useMemo(
    () => (recapPasteText && recapPasteText.trim() ? parseBeneficiaryRecapText(recapPasteText, masterSchools) : null),
    [recapPasteText, masterSchools],
  );

  const handleApplyRecapPaste = () => {
    const parsed = recapPastePreview;
    if (!parsed || parsed.matched.length === 0) {
      toast.warning('Tidak ada nama sekolah yang dikenali. Format per baris: "Nama sekolah : jumlah".', "Teks Tidak Terbaca");
      return;
    }
    // Sekolah yang angkanya kosong atau tidak ada di teks ditandai "Tidak kirim · Lainnya";
    // porsi biasanya tetap di draf agar tidak hilang.
    const draft: Record<string, number> = {...dailyDraftPortions};
    const skips: Record<string, SkipReason> = {};
    masterSchools.forEach((sc) => {
      skips[sc.id] = "LAINNYA";
    });
    parsed.matched.forEach((m) => {
      if (!m.schoolId) return;
      if (m.count > 0) {
        draft[m.schoolId] = m.count;
        delete skips[m.schoolId];
      }
    });
    setDailyDraftPortions(draft);
    setDailyDraftSkips(skips);
    setIsDailyDraftDirty(true);
    setRecapReportedTotal(parsed.reportedTotal);
    setRecapPasteText(null);
    const skipped = Object.keys(skips).length;
    toast.info(
      `${masterSchools.length - skipped} sekolah dikirim` +
        (skipped > 0 ? `, ${skipped} ditandai tidak kirim (alasan "Lainnya", ubah bila perlu)` : "") +
        '. Periksa lalu klik "Simpan".',
      "Rekap Ditempel",
    );
  };

  const handleResetDailyAllocationsToMaster = async () => {
    if (await askConfirm({
      title: 'Kembalikan ke porsi standar?',
      message: `Alokasi porsi ${formatIndonesianDate(beneficiarySelectedDate)} diganti dengan porsi standar tiap sekolah.`,
      confirmText: 'Kembalikan',
      variant: 'warning',
    })) {
      const draft: Record<string, number> = {};
      masterSchools.forEach((s) => {
        draft[s.id] = s.portionCount;
      });
      setDailyDraftPortions(draft);
      setIsDailyDraftDirty(true);
    }
  };

  const [scaleTarget, setScaleTarget] = useState<string | null>(null);
  const dailyDraftTotal = Object.entries(dailyDraftPortions).reduce((sum, [id, v]) => sum + (dailyDraftSkips[id] ? 0 : Number(v) || 0), 0);

  const handleScaleDailyPortionsProportional = () => {
    setScaleTarget(String(dailyDraftTotal || ""));
  };

  const handleApplyScale = (e: React.FormEvent) => {
    e.preventDefault();
    const currentTotal = dailyDraftTotal || 1;
    const targetVal = parseInt(scaleTarget || "", 10);
    if (isNaN(targetVal) || targetVal <= 0) {
      toast.warning("Target porsi harus berupa angka positif.", "Input Tidak Valid");
      return;
    }
    setScaleTarget(null);
    const ratio = targetVal / currentTotal;
    const newDraft: Record<string, number> = {};
    masterSchools.forEach((s) => {
      const cur = dailyDraftPortions[s.id] ?? s.portionCount;
      // Sekolah yang tidak dikirim tidak ikut diskalakan
      newDraft[s.id] = dailyDraftSkips[s.id] ? cur : Math.max(0, Math.round(cur * ratio));
    });
    setDailyDraftPortions(newDraft);
    setIsDailyDraftDirty(true);
  };

  // Matriks rekapitulasi harian per sekolah across tanggal
  const dailyBeneficiaryMatrix = useMemo(() => {
    // Tanggal bermenu + tanggal yang punya rekap tersimpan (rekap bisa dicatat tanpa menu)
    const allOrderDates = Array.from(new Set([...orders.map((o) => o.date), ...getAllBeneficiaryRecapDates()])).sort();

    let distinctDates: string[] = [];

    if (beneficiaryPeriodPreset === "ALL_ORDERS") {
      distinctDates = allOrderDates.length > 0 ? allOrderDates : [todayStr];
    } else if (beneficiaryPeriodPreset === "LAST_7_DAYS") {
      const end = parseMenuDate(beneficiaryEndDate) || new Date();
      const datesArr: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(end);
        d.setDate(d.getDate() - i);
        datesArr.push(localDateIso(d));
      }
      distinctDates = datesArr;
    } else if (beneficiaryPeriodPreset === "THIS_MONTH") {
      const curMonth = localDateIso(parseMenuDate(beneficiaryEndDate) || new Date()).slice(0, 7);
      distinctDates = allOrderDates.filter((d) => d.startsWith(curMonth));
      if (distinctDates.length === 0) distinctDates = allOrderDates;
    } else {
      // CUSTOM
      distinctDates = allOrderDates.filter((d) => d >= beneficiaryStartDate && d <= beneficiaryEndDate);
      if (distinctDates.length === 0 && beneficiaryStartDate && beneficiaryEndDate) {
        const s = parseMenuDate(beneficiaryStartDate);
        const e = parseMenuDate(beneficiaryEndDate);
        if (s && e) {
          const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays <= 31) {
            const list: string[] = [];
            for (let i = 0; i <= diffDays; i++) {
              const temp = new Date(s);
              temp.setDate(temp.getDate() + i);
              list.push(localDateIso(temp));
            }
            distinctDates = list;
          }
        }
      }
    }

    const sortedDates = [...distinctDates].sort();
    const recapByDate: Record<string, DailyBeneficiaryRecap> = {};
    if (sortedDates.length > 0) {
      getBeneficiaryRecapsInRange(sortedDates[0], sortedDates[sortedDates.length - 1]).forEach((r) => {
        recapByDate[r.date] = r;
      });
    }

    const ordersByDate: Record<string, MenuOrder[]> = {};
    const orderMap: Record<string, MenuOrder | undefined> = {};
    distinctDates.forEach((d) => {
      ordersByDate[d] = orders.filter((o) => o.date === d).sort(sortBySession);
      orderMap[d] = ordersByDate[d][0];
    });

    const visibleSchools = masterSchools.filter((school) => {
      if (selectedBeneficiaryCategory !== "ALL" && school.category !== selectedBeneficiaryCategory) {
        return false;
      }
      if (schoolSearchQuery.trim()) {
        const q = schoolSearchQuery.toLowerCase();
        const matchName = school.schoolName.toLowerCase().includes(q);
        const matchPic = (school.contactPerson || "").toLowerCase().includes(q);
        const matchPhone = (school.phone || "").toLowerCase().includes(q);
        if (!matchName && !matchPic && !matchPhone) return false;
      }
      return true;
    });

    const rows = visibleSchools.map((s) => {
      const datePortions: Record<string, number> = {};
      // Alasan tidak dikirim per tanggal (dari rekap harian)
      const dateSkips: Record<string, SkipReason> = {};
      let totalPeriod = 0;
      let activeDays = 0;

      distinctDates.forEach((d) => {
        // Rekap harian tersimpan adalah angka sebenarnya; tanpa rekap, semua sesi makan di tanggal itu dijumlahkan.
        let p = 0;
        const recap = recapByDate[d];
        if (recap) {
          const entry = recap.entries.find((e) => e.schoolId === s.id);
          p = entry?.count || 0;
          if (entry?.skipReason) dateSkips[d] = entry.skipReason;
          datePortions[d] = p;
          totalPeriod += p;
          if (p > 0) activeDays++;
          return;
        }
        ordersByDate[d].forEach((order) => {
          if (order.beneficiaryAllocations && order.beneficiaryAllocations.length > 0) {
            const found = order.beneficiaryAllocations.find((b) => b.id === s.id);
            p += found ? Number(found.portionCount) || 0 : 0;
          } else {
            const totalMaster = masterSchools.reduce((sum, item) => sum + item.portionCount, 0) || 1;
            p += Math.round(s.portionCount * (order.targetPortions / totalMaster));
          }
        });
        datePortions[d] = p;
        totalPeriod += p;
        if (p > 0) activeDays++;
      });

      const avgDaily = activeDays > 0 ? totalPeriod / activeDays : 0;

      return {
        schoolId: s.id,
        schoolName: s.schoolName,
        category: s.category,
        contactPerson: s.contactPerson,
        phone: s.phone,
        deliveryTime: s.deliveryTime,
        masterPortion: s.portionCount,
        datePortions,
        dateSkips,
        totalPeriod,
        avgDaily,
      };
    });

    const dateTotals: Record<string, number> = {};
    distinctDates.forEach((d) => {
      dateTotals[d] = rows.reduce((sum, r) => sum + (r.datePortions[d] || 0), 0);
    });

    const grandTotal = rows.reduce((sum, r) => sum + r.totalPeriod, 0);
    const activeDateCount = distinctDates.filter((d) => (dateTotals[d] || 0) > 0).length;
    const avgDailyTotal = activeDateCount > 0 ? grandTotal / activeDateCount : 0;

    return {
      dates: distinctDates,
      orderMap,
      rows,
      dateTotals,
      grandTotal,
      avgDailyTotal,
      activeDateCount,
      schoolCount: rows.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, masterSchools, beneficiaryPeriodPreset, beneficiaryStartDate, beneficiaryEndDate, selectedBeneficiaryCategory, schoolSearchQuery, todayStr, recapVersion]);

  const handleExportBeneficiaryDailyRecap = () => {
    const exportData = dailyBeneficiaryMatrix.rows.map((r, idx) => {
      const rowObj: Record<string, any> = {
        No: idx + 1,
        "Nama Sekolah / Lembaga": r.schoolName,
        Kategori: r.category,
      };
      dailyBeneficiaryMatrix.dates.forEach((d) => {
        // Hari tidak dikirim ditulis alasannya, bukan 0
        const skip = r.dateSkips[d];
        rowObj[formatShortDate(d)] = skip ? `Tidak kirim (${SKIP_REASON_LABEL[skip]})` : r.datePortions[d] || 0;
      });
      rowObj["Total Porsi Periode"] = r.totalPeriod;
      rowObj["Rata-rata/Hari"] = Math.round(r.avgDaily);
      rowObj["Jadwal Kirim"] = r.deliveryTime || "-";
      rowObj["PIC"] = r.contactPerson || "-";
      rowObj["No. Telepon"] = r.phone || "-";
      return rowObj;
    });

    const summaryRow: Record<string, any> = {
      No: "",
      "Nama Sekolah / Lembaga": "TOTAL PORSI HARIAN SELURUH SEKOLAH",
      Kategori: "",
    };
    dailyBeneficiaryMatrix.dates.forEach((d) => {
      summaryRow[formatShortDate(d)] = dailyBeneficiaryMatrix.dateTotals[d] || 0;
    });
    summaryRow["Total Porsi Periode"] = dailyBeneficiaryMatrix.grandTotal;
    summaryRow["Rata-rata/Hari"] = Math.round(dailyBeneficiaryMatrix.avgDailyTotal);
    summaryRow["Jadwal Kirim"] = "";
    summaryRow["PIC"] = "";
    summaryRow["No. Telepon"] = "";

    exportData.push(summaryRow);

    exportToExcel(exportData, `Rekap_Porsi_Harian_Sekolah_SPPG_${beneficiaryStartDate}_sd_${beneficiaryEndDate}.xlsx`, "Rekap Porsi Harian");
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
    const groupOrder = ["protein hewani", "protein nabati", "sembako", "sayur", "buah", "lain lain"];
    const mapRows: Record<string, MaterialMatrixRow> = {};

    filteredOrders.forEach((ord) => {
      const dateKey = ord.date;
      const items = ord.poArrivalItems || [];

      items.forEach((po) => {
        const rawName = (po.itemName || "").trim().toLowerCase();
        if (!rawName) return;

        let catGroup = (po.category || "").toLowerCase();
        if (catGroup.includes("protein")) {
          if (rawName.includes("tahu") || rawName.includes("tempe")) {
            catGroup = "protein nabati";
          } else {
            catGroup = "protein hewani";
          }
        } else if (catGroup.includes("sembako")) {
          catGroup = "sembako";
        } else if (catGroup.includes("sayur")) {
          catGroup = "sayur";
        } else if (catGroup.includes("buah")) {
          catGroup = "buah";
        } else {
          catGroup = "lain lain";
        }

        const rawQtyStr = po.qtyOrder || po.qtyArrived || "";
        let detectedUnit = "kg";
        if (rawQtyStr.toLowerCase().includes("sak")) detectedUnit = "sak";
        else if (rawQtyStr.toLowerCase().includes("krat")) detectedUnit = "krat";
        else if (rawQtyStr.toLowerCase().includes("layah")) detectedUnit = "layah";
        else if (rawQtyStr.toLowerCase().includes("dus") || rawQtyStr.toLowerCase().includes("ktn") || rawQtyStr.toLowerCase().includes("karton")) detectedUnit = "dus";
        else if (rawQtyStr.toLowerCase().includes("pack") || rawQtyStr.toLowerCase().includes("bks")) detectedUnit = "pack";
        else if (rawQtyStr.toLowerCase().includes("bal")) detectedUnit = "bal";
        else if (rawQtyStr.toLowerCase().includes("pcs") || rawQtyStr.toLowerCase().includes("pc")) detectedUnit = "pcs";
        else if (rawQtyStr.toLowerCase().includes("ikat")) detectedUnit = "ikat";

        const numericVal = parseNumericQuantity(po.qtyOrder || po.qtyArrived);

        if (!mapRows[rawName]) {
          const matchInv = inventoryItems.find((it) => it.name.toLowerCase().includes(rawName) || rawName.includes(it.name.toLowerCase()));

          mapRows[rawName] = {
            categoryGroup: catGroup,
            itemName: po.itemName,
            dateValues: {},
            totalPeriod: 0,
            unit: detectedUnit,
            warehouseStock: matchInv ? `${matchInv.currentStock} ${matchInv.baseUnit}` : "Ada di Rak",
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

    let curCat = "";
    let curNo = 0;
    allRows.forEach((r) => {
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
    const targetDate = typeof overrideDate === "string" && overrideDate ? overrideDate : selectedDailyDate || todayStr;
    setMenuFormDate(targetDate);

    // Auto H-1
    const d = parseMenuDate(targetDate) || new Date();
    d.setDate(d.getDate() - 1);
    setMenuFormPoDate(localDateIso(d));

    setMenuFormSession("Siang");
    setMenuFormTitle("");
    setMenuFormDietB3("");
    setMenuFormChef("");
    setMenuFormNotes("");
    setIsMenuModalOpen(true);
  };

  const handleOpenEditMenuModal = (order: MenuOrder) => {
    setEditingMenuOrderId(order.id);
    setMenuFormDate(order.date);
    setMenuFormPoDate(order.poDate || "");
    setMenuFormSession(order.mealSession);
    setMenuFormTitle(order.menuTitle);
    setMenuFormDietB3(order.specialDietB3 || "");
    setMenuFormChef(order.chefInCharge || "");
    setMenuFormNotes(order.notes || "");
    setIsMenuModalOpen(true);
  };

  // Porsi menu mengikuti Porsi hari ini: rekap tanggal itu → rekap hari kirim terakhir → porsi standar
  const menuFormPortionInfo = useMemo(() => {
    const recap = menuFormDate ? getBeneficiaryRecap(menuFormDate) : undefined;
    if (recap) {
      const sent = recap.entries.filter((e) => !e.skipReason && e.count > 0).length;
      const skipped = recap.entries.filter((e) => e.skipReason).length;
      return {
        source: "RECAP" as const,
        total: recap.total,
        recap,
        note: `Dari Porsi hari ini: ${sent} sekolah dikirim${skipped > 0 ? `, ${skipped} tidak` : ""}.`,
      };
    }
    const last = menuFormDate ? getLastBeneficiaryRecapBefore(menuFormDate) : undefined;
    if (last) {
      const total = last.entries.reduce((sum, e) => sum + (e.skipReason ? e.usualCount ?? 0 : e.count), 0);
      return {source: "LAST" as const, total, recap: undefined, note: `Perkiraan dari ${formatShortDate(last.date)}. Porsi tanggal ini belum dicatat.`};
    }
    return {
      source: "MASTER" as const,
      total: masterSchools.reduce((sum, sc) => sum + (sc.portionCount || 0), 0),
      recap: undefined,
      note: "Perkiraan dari porsi standar. Porsi tanggal ini belum dicatat.",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuFormDate, masterSchools, recapVersion]);

  // Tutup modal lalu buka Porsi hari ini di tanggal menu (isian menu yang belum disimpan dibuang setelah konfirmasi)
  const handleGoToDailyPortions = async () => {
    if (menuFormTitle.trim() && !(await askConfirm({
      title: "Tinggalkan form menu?",
      message: "Isian menu yang belum disimpan akan hilang. Simpan menu dulu bila ingin menyimpannya.",
      confirmText: "Tinggalkan",
      variant: "warning",
    }))) return;
    setIsMenuModalOpen(false);
    setActiveSubTab("BENEFICIARIES");
    setBeneficiaryViewMode("DETAIL_HARIAN");
    await changeBeneficiaryDate(menuFormDate);
  };

  const handleSaveMenuForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!menuFormTitle.trim()) {
      toast.error("Menu reguler wajib diisi.", "Form Belum Lengkap");
      return;
    }

    try {
      const isNew = !editingMenuOrderId;
      const orderId = editingMenuOrderId || `ORD-${Date.now().toString().slice(-6)}`;
      const existing = editingMenuOrderId ? orders.find((o) => o.id === editingMenuOrderId) : null;

      // Porsi per sekolah dari rekap tanggal itu bila sudah dicatat; tanpa rekap, alokasi lama dipertahankan
      // (atau porsi standar untuk menu baru) sampai Porsi hari ini disimpan.
      const info = menuFormPortionInfo;
      const updatedAllocations: SchoolBeneficiaryAllocation[] = info.recap
        ? masterSchools.map((sc) => ({...sc, portionCount: info.recap!.entries.find((en) => en.schoolId === sc.id)?.count || 0}))
        : existing?.beneficiaryAllocations?.length
          ? existing.beneficiaryAllocations
          : masterSchools.map((sc) => ({...sc}));
      const targetPortions = info.recap
        ? info.total
        : existing?.beneficiaryAllocations?.length
          ? existing.targetPortions
          : info.total;

      const orderToSave: MenuOrder = {
        id: orderId,
        date: menuFormDate,
        poDate: menuFormPoDate.trim() || undefined,
        mealSession: menuFormSession,
        menuTitle: menuFormTitle.trim(),
        menuDescription: existing?.menuDescription || "",
        specialDietB3: menuFormDietB3.trim() || undefined,
        targetPortions,
        totalBeneficiaries: targetPortions,
        // Status tidak diisi di form; menu baru "Direncanakan", status lama dipertahankan saat diubah
        status: existing?.status || "PLANNED",
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
        toast.success(
          info.recap
            ? `Menu ${formatIndonesianDate(orderToSave.date)} tersimpan (${orderToSave.targetPortions.toLocaleString("id-ID")} porsi). Lanjut input PO bahan.`
            : `Menu ${formatIndonesianDate(orderToSave.date)} tersimpan. Jangan lupa catat Porsi hari ini agar jumlah porsi sesuai.`,
        );
      } else {
        toast.success(`Berhasil memperbarui menu: ${orderToSave.menuTitle}.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data menu.", "Gagal Menyimpan");
    }
  };

  // =========================================================================
  // HANDLERS FOR MODAL 2: INPUT & EDIT PO HARI INI
  // =========================================================================
  const handleOpenPoModal = (targetOrderId?: string) => {
    // Tentukan order mana yang akan diinput PO-nya
    let targetOrder = targetOrderId ? orders.find((o) => o.id === targetOrderId) : null;

    if (!targetOrder && orders.length > 0) {
      // Prioritaskan order pada tanggal aktif terpilih, lalu hari ini, lalu order pertama
      targetOrder = orders.find((o) => o.date === selectedDailyDate) || orders.find((o) => o.date === todayStr) || orders[0];
    }

    if (!targetOrder) {
      toast.warning('Belum ada menu yang tercatat. Catat menu dulu lewat tombol "Catat Menu".', "Menu Belum Ada");
      return;
    }

    setSelectedPoOrderId(targetOrder.id);
    setPoFormDate(targetOrder.poDate || "H-1");

    setPoFocusRow(null);
    if (targetOrder.poArrivalItems && targetOrder.poArrivalItems.length > 0) {
      setPoFormRows(
        withSuggestedSuppliers(targetOrder.poArrivalItems.map((p) => ({
          category: p.category || "Bahan Makanan",
          itemName: p.itemName,
          qtyOrder: p.qtyOrder || "",
          qtyArrived: p.qtyArrived || "",
          supplier: p.supplier || "",
          arrivalTime: p.arrivalTime || "",
          pic: p.pic || currentUser.name,
          notes: p.notes || "",
        }))),
      );
    } else {
      // Mulai kosong: pengguna memilih supplier dulu, lalu mengisi bahannya.
      setPoFormRows([]);
    }

    setIsPoModalOpen(true);
  };

  // Naik setiap ada supplier baru dari form PO, agar daftar pilihan ikut diperbarui.
  const [supplierListVersion, setSupplierListVersion] = useState(0);
  const masterSuppliers = useMemo(() => {
    try {
      return warehouseDb.getSuppliers();
    } catch {
      return [];
    }
  }, [supplierListVersion]);

  const supplierOptions = useMemo(
    () =>
      masterSuppliers
        .filter((s) => s.isActive !== false)
        .map((s) => ({value: s.name, label: s.name, group: s.supplyCategory || "Lainnya"}))
        .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label)),
    [masterSuppliers],
  );

  const findMasterSupplier = (name: string) => masterSuppliers.find((s) => normName(s.name) === normName(name));

  type PoFormRow = (typeof poFormRows)[number];
  type IndexedPoRow = {row: PoFormRow; idx: number};
  // Isian lama dari versi sebelumnya, bukan nama supplier sungguhan.
  const cleanSupplier = (name: string) => (["Pemasok Rekanan", "Pemasok Lokal"].includes(name.trim()) ? "" : name.trim());

  // Supplier kosong ditebak sekali saat daftar dimuat, bukan saat mengetik, agar baris tidak pindah kelompok di tengah ketikan.
  const withSuggestedSuppliers = (rows: PoFormRow[]): PoFormRow[] =>
    rows.map((r) => ({...r, supplier: cleanSupplier(r.supplier) || resolveSupplierForItem(r.category, r.itemName, "", masterSuppliers)}));

  // Daftar bahan tetap satu array datar; kelompok per supplier hanya cara menampilkannya.
  const poGroups = (() => {
    const groups = new Map<string, {key: string; supplier: string; rows: IndexedPoRow[]}>();
    const unassigned: IndexedPoRow[] = [];
    poFormRows.forEach((row, idx) => {
      const name = cleanSupplier(row.supplier);
      if (!name) {
        unassigned.push({row, idx});
        return;
      }
      const key = normName(name);
      if (!groups.has(key)) groups.set(key, {key, supplier: findMasterSupplier(name)?.name || name, rows: []});
      groups.get(key)!.rows.push({row, idx});
    });
    return {assigned: Array.from(groups.values()), unassigned};
  })();

  const duplicatePoRowIdx = new Set<number>();
  poGroups.assigned.forEach((g) => {
    const seen = new Set<string>();
    g.rows.forEach(({row, idx}) => {
      const k = normName(row.itemName);
      if (!k) return;
      if (seen.has(k)) duplicatePoRowIdx.add(idx);
      seen.add(k);
    });
  });

  const updatePoRow = (idx: number, patch: Partial<PoFormRow>) =>
    setPoFormRows((rows) => rows.map((r, i) => (i === idx ? {...r, ...patch} : r)));

  const removePoRow = (idx: number) => setPoFormRows((rows) => rows.filter((_, i) => i !== idx));

  const addPoRow = (supplier: string) => {
    const name = supplier.trim();
    if (!name) return;
    const lastInGroup = [...poFormRows].reverse().find((r) => normName(cleanSupplier(r.supplier)) === normName(name));
    setPoFocusRow(poFormRows.length);
    setPoFormRows([
      ...poFormRows,
      {
        category: lastInGroup?.category || "Sayur dan Buah",
        itemName: "",
        qtyOrder: "",
        qtyArrived: "",
        supplier: findMasterSupplier(name)?.name || name,
        arrivalTime: "08.00",
        pic: currentUser.name,
        notes: "",
      },
    ]);
  };

  // Ganti supplier satu kelompok sekaligus, mis. supplier langganan mendadak tidak bisa kirim.
  const renamePoGroup = (groupKey: string, supplier: string) => {
    const name = supplier.trim();
    if (!name) return;
    setPoFormRows((rows) => rows.map((r) => (normName(cleanSupplier(r.supplier)) === groupKey ? {...r, supplier: name} : r)));
  };

  const removePoGroup = async (group: {key: string; supplier: string; rows: IndexedPoRow[]}) => {
    const filled = group.rows.filter(({row}) => row.itemName.trim()).length;
    if (
      filled > 0 &&
      !(await askConfirm({
        title: `Hapus ${filled} bahan dari ${group.supplier}?`,
        message: "Bahan dalam kelompok ini dihapus dari daftar PO.",
        confirmText: "Hapus",
        variant: "danger",
      }))
    )
      return;
    setPoFormRows((rows) => rows.filter((r) => normName(cleanSupplier(r.supplier)) !== group.key));
  };

  const resolveSupplierForItem = (
    category: string,
    itemName: string,
    existingSupplier?: string,
    suppliers: Array<{id: string; name: string; supplyCategory?: string}> = [],
  ): string => {
    if (existingSupplier && existingSupplier.trim() && existingSupplier !== "Pemasok Rekanan" && existingSupplier !== "Pemasok Lokal") {
      return existingSupplier.trim();
    }
    const cat = (category || "").toLowerCase();
    const name = (itemName || "").toLowerCase();

    if (suppliers && suppliers.length > 0) {
      if (cat.includes("tahu") || cat.includes("tempe") || name.includes("tahu") || name.includes("tempe")) {
        const match = suppliers.find((s) => {
          const full = `${s.name} ${s.supplyCategory || ""}`.toLowerCase();
          return full.includes("tahu") || full.includes("tempe") || full.includes("rio");
        });
        if (match) return match.name;
      }

      if (cat.includes("protein") || name.includes("ayam") || name.includes("daging") || name.includes("telur") || name.includes("unggas")) {
        if (name.includes("daging") || name.includes("sapi")) {
          const dagingMatch = suppliers.find((s) => `${s.name} ${s.supplyCategory || ""}`.toLowerCase().includes("daging"));
          if (dagingMatch) return dagingMatch.name;
        }
        const ayamMatch = suppliers.find((s) => {
          const full = `${s.name} ${s.supplyCategory || ""}`.toLowerCase();
          return full.includes("ayam") || full.includes("fjr") || full.includes("fajar") || full.includes("protein");
        });
        if (ayamMatch) return ayamMatch.name;
      }

      if (cat.includes("sembako") || name.includes("beras") || name.includes("minyak") || name.includes("gula") || name.includes("tepung")) {
        const sembakoMatch = suppliers.find((s) => {
          const full = `${s.name} ${s.supplyCategory || ""}`.toLowerCase();
          return full.includes("tumpang") || full.includes("grosir") || full.includes("sembako");
        });
        if (sembakoMatch) return sembakoMatch.name;
      }

      if (
        cat.includes("sayur") ||
        cat.includes("buah") ||
        name.includes("sayur") ||
        name.includes("buncis") ||
        name.includes("wortel") ||
        name.includes("semangka") ||
        name.includes("buah")
      ) {
        const sayurMatch = suppliers.find((s) => {
          const full = `${s.name} ${s.supplyCategory || ""}`.toLowerCase();
          return full.includes("fresh") || full.includes("sayur") || full.includes("buah") || full.includes("luber");
        });
        if (sayurMatch) return sayurMatch.name;
      }

      const directMatch = suppliers.find((s) => {
        const sCat = (s.supplyCategory || "").toLowerCase();
        return Boolean(cat && sCat && (sCat.includes(cat) || cat.includes(sCat)));
      });
      if (directMatch) return directMatch.name;
    }

    // Tidak dikenali: biarkan kosong agar pengguna memilih sendiri, bukan ditebak ke supplier pertama.
    return "";
  };

  const handleSaveAndGenerateOfficialPo = async () => {
    if (!selectedPoOrderId) {
      toast.warning("Pilih menu tujuan untuk PO ini.", "Menu Belum Dipilih");
      return;
    }

    const targetOrder = orders.find((o) => o.id === selectedPoOrderId);
    if (!targetOrder) {
      toast.error("Order menu tidak ditemukan.", "Menu Tidak Ditemukan");
      return;
    }

    try {
      const validItems: MenuPoArrivalItem[] = poFormRows
        .filter((r) => r.itemName.trim())
        .map((r) => {
          const estimatedCost = parseNumericQuantity(r.qtyOrder || r.qtyArrived) * estimatePrice(r.itemName);
          const autoSupplier = cleanSupplier(r.supplier);
          return {
            category: r.category.trim(),
            itemName: r.itemName.trim(),
            qtyOrder: r.qtyOrder.trim(),
            qtyArrived: (r.qtyArrived || "").trim(),
            supplier: autoSupplier,
            arrivalTime: (r.arrivalTime || "").trim(),
            pic: (r.pic && r.pic.trim()) || currentUser.name,
            totalCost: estimatedCost,
            notes: r.notes || "",
          };
        });

      if (validItems.length === 0) {
        toast.warning("Tambahkan minimal 1 item bahan untuk membuat PO.", "Item PO Kosong");
        return;
      }
      const noSupplier = validItems.filter((it) => !it.supplier);
      if (noSupplier.length > 0) {
        toast.error(`Pilih supplier untuk: ${noSupplier.map((it) => it.itemName).join(", ")}.`, "Supplier Belum Diisi");
        return;
      }
      const duplicates = findDuplicatePoRows(validItems);
      if (duplicates.length > 0) {
        toast.error(`${duplicates.join(", ")} tercatat lebih dari sekali untuk supplier yang sama. Gabungkan jumlahnya di satu baris.`, "Bahan Dobel");
        return;
      }

      // Terbit ulang diblokir: PO lama bisa sudah dicetak, dikirim ke supplier, atau diterima.
      const existingMenuPos = warehouseDb.getPurchaseOrdersByMenuOrderId(targetOrder.id);
      if (existingMenuPos.length > 0) {
        const poNumbers = existingMenuPos.map((po) => po.poNumber).join(", ");
        if (existingMenuPos.some((po) => warehouseDb.isPurchaseOrderLocked(po))) {
          toast.error(`PO ${poNumbers} untuk menu ini sudah diterima atau dibayar, jadi tidak bisa diterbitkan ulang.`, "PO Sudah Terbit");
        } else {
          toast.error(`Menu ini sudah punya PO ${poNumbers}. Batalkan PO dulu bila ingin menerbitkan ulang.`, "PO Sudah Terbit");
        }
        return;
      }

      const poTargetDate = targetOrder.date || localDateIso(new Date());
      const existingPOs = warehouseDb.getPurchaseOrders();

      // Bahan sama ke supplier sama di tanggal yang sama dari menu lain: bisa disengaja (beda sesi), jadi hanya diingatkan.
      const overlaps = validItems.flatMap((item) => {
        const hit = existingPOs.find(
          (po) =>
            po.date === poTargetDate &&
            po.relatedMenuOrderId !== targetOrder.id &&
            normName(po.supplierName) === normName(item.supplier) &&
            po.items.some((pi) => normName(pi.name) === normName(item.itemName)),
        );
        return hit ? [`${item.itemName} (${hit.poNumber})`] : [];
      });
      const newSupplierNames = Array.from(
        new Map(validItems.filter((it) => !findMasterSupplier(it.supplier)).map((it) => [normName(it.supplier), it.supplier.trim()])).values(),
      );

      if (overlaps.length > 0 || newSupplierNames.length > 0) {
        const ok = await askConfirm({
          title: "Periksa sebelum terbit PO",
          message: (
            <div className="space-y-2">
              {overlaps.length > 0 && (
                <p>
                  Sudah dipesan ke supplier yang sama untuk {formatIndonesianDate(poTargetDate)} lewat menu lain: <strong>{overlaps.join(", ")}</strong>.
                  Lanjutkan hanya bila memang perlu pesanan terpisah.
                </p>
              )}
              {newSupplierNames.length > 0 && (
                <p>
                  Supplier baru ditambahkan ke daftar supplier: <strong>{newSupplierNames.join(", ")}</strong>. Kontak dan alamatnya
                  dilengkapi nanti di menu Supplier.
                </p>
              )}
            </div>
          ),
          confirmText: "Terbitkan PO",
        });
        if (!ok) return;
      }

      // Supplier baru dicatat ke master dulu agar PO punya supplierId dan bisa dilengkapi kontaknya.
      const supplierByName = new Map(masterSuppliers.map((s) => [normName(s.name), s]));
      newSupplierNames.forEach((name) => {
        supplierByName.set(normName(name), warehouseDb.quickAddSupplier(name, currentUser));
      });
      if (newSupplierNames.length > 0) setSupplierListVersion((v) => v + 1);

      // 1. Simpan ke data Menu Order lokal
      const updatedOrder: MenuOrder = {
        ...targetOrder,
        poDate: poFormDate.trim() || targetOrder.poDate,
        poArrivalItems: validItems,
      };

      warehouseDb.saveMenuOrder(updatedOrder, currentUser, false);

      // 2. Kelompokkan bahan berdasarkan nama Supplier untuk dibuatkan PO resmi
      const itemsBySupplier = new Map<string, MenuPoArrivalItem[]>();
      validItems.forEach((item) => {
        const suppName = supplierByName.get(normName(item.supplier))?.name || item.supplier;
        if (!itemsBySupplier.has(suppName)) {
          itemsBySupplier.set(suppName, []);
        }
        itemsBySupplier.get(suppName)!.push(item);
      });

      const generatedPos: PurchaseOrderNota[] = [];
      let currentSeqList = [...existingPOs];

      itemsBySupplier.forEach((supplierItems, supplierName) => {
        // Cocokkan nama persis: pencocokan sebagian bisa mengarah ke supplier lain ("Tahu Pak Rio" ke "Tahu Rio").
        const suppObj = supplierByName.get(normName(supplierName));

        const nextPoNum = generateNextPoNumber(currentSeqList, poTargetDate);

        const poItems: PurchaseOrderItem[] = supplierItems.map((sItem, sIdx) => {
          const unitMatch = (sItem.qtyOrder || sItem.qtyArrived || "").match(/[a-zA-Z]+/g);
          const unitStr = unitMatch ? unitMatch.join(" ") : "Kg";

          const numQty = normalizeQtyForUnit(parseNumericQuantity(sItem.qtyOrder || sItem.qtyArrived) || 1, unitStr);
          const unitPrice = estimatePrice(sItem.itemName);
          const subtotal = sItem.totalCost && sItem.totalCost > 0 ? sItem.totalCost : Math.round(numQty * unitPrice);

          return {
            id: `POI-${Date.now()}-${sIdx}`,
            name: sItem.itemName,
            category: sItem.category || "Bahan Makanan",
            quantity: numQty,
            unit: unitStr || "Kg",
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
          supplierContact: suppObj?.phone ? `${suppObj.phone} (${suppObj.contactPerson || "PIC"})` : "",
          supplierAddress: suppObj?.address || "Malang, Jawa Timur",
          paymentMethod: "TRANSFER",
          bankInfo: suppObj ? `Transfer Bank Rekening Resmi ${suppObj.name}` : "",
          status: "DISETUJUI",
          items: poItems,
          subtotal: grandTotal,
          discount: 0,
          tax: 0,
          grandTotal: grandTotal,
          terbilang: angkaTerbilang(grandTotal),
          notes: `PO dibuat otomatis dari Perencanaan Menu: ${targetOrder.menuTitle} (${targetOrder.targetPortions} porsi).`,
          deliveryTerms: "Pengiriman langsung ke Satuan Pelayanan Pemenuhan Gizi (SPPG) MLG TUMPANG JERU (Jam 12.00-15.00).",
          createdBy: currentUser.name,
          createdByRole: currentUser.role === "ADMIN" ? "Admin Logistik" : currentUser.role,
          approvedBy: warehouseDb.getSppgHeadName(),
          approvedByRole: "Kepala SPPG",
          supplierPic: suppObj?.contactPerson || "Pihak Rekanan",
          relatedMenuOrderId: targetOrder.id,
          createdAt: new Date().toISOString(),
        };

        warehouseDb.savePurchaseOrder(newNota, currentUser);
        generatedPos.push(newNota);
        currentSeqList.push(newNota);
      });

      refreshOrders();
      setIsPoModalOpen(false);

      const supplierNames = Array.from(itemsBySupplier.keys()).join(", ");
      toast.success(`${generatedPos.length} PO terbit untuk ${supplierNames}. PO muncul di Barang Masuk untuk diterima.`);
    } catch (err: any) {
      toast.error(err.message || "Gagal generate Draft PO.", "Gagal Generate PO");
    }
  };

  const handleApplyPoTemplate = () => {
    setPoFocusRow(null);
    setPoFormRows(withSuggestedSuppliers(STANDARD_PO_TEMPLATES.map((t) => ({...t, notes: ""}))));
  };

  const handleDeletePoForOrder = async (orderId?: string) => {
    const targetId = orderId || selectedPoOrderId;
    if (!targetId) return;

    const targetOrder = orders.find((o) => o.id === targetId);
    const orderTitle = targetOrder ? targetOrder.menuTitle : "menu ini";

    const confirmDelete = await askConfirm({
      title: `Batalkan semua PO untuk "${orderTitle}"?`,
      message: 'PO dihapus dari sistem, termasuk dari Barang Masuk dan Ringkasan.',
      confirmText: 'Batalkan PO',
      variant: 'danger',
    });

    if (confirmDelete) {
      const deletedCount = warehouseDb.deletePurchaseOrdersByMenuOrderId(targetId, currentUser);
      const lockedPos = warehouseDb.getPurchaseOrdersByMenuOrderId(targetId);
      if (lockedPos.length > 0) {
        refreshOrders();
        setIsPoModalOpen(false);
        toast.warning(
          `${deletedCount} PO dibatalkan. PO ${lockedPos.map((po) => po.poNumber).join(", ")} tetap disimpan karena sudah diterima atau dibayar.`,
          "Sebagian PO Dikunci",
        );
        return;
      }
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
      toast.success(`Berhasil membatalkan & menghapus ${deletedCount} PO resmi untuk "${orderTitle}".`);
    }
  };

  const handleSavePoForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPoOrderId) {
      toast.warning("Pilih menu tujuan untuk PO ini.", "Menu Belum Dipilih");
      return;
    }

    const targetOrder = orders.find((o) => o.id === selectedPoOrderId);
    if (!targetOrder) {
      toast.error("Order menu tidak ditemukan.", "Menu Tidak Ditemukan");
      return;
    }

    try {
      const validItems: MenuPoArrivalItem[] = poFormRows
        .filter((r) => r.itemName.trim())
        .map((r) => {
          const estimatedCost = parseNumericQuantity(r.qtyOrder || r.qtyArrived) * estimatePrice(r.itemName);
          const autoSupplier = cleanSupplier(r.supplier);
          return {
            category: r.category.trim(),
            itemName: r.itemName.trim(),
            qtyOrder: r.qtyOrder.trim(),
            qtyArrived: (r.qtyArrived || "").trim(),
            supplier: autoSupplier,
            arrivalTime: (r.arrivalTime || "").trim(),
            pic: (r.pic && r.pic.trim()) || currentUser.name,
            totalCost: estimatedCost,
            notes: r.notes || "",
          };
        });

      if (validItems.length === 0) {
        if (warehouseDb.getPurchaseOrdersByMenuOrderId(selectedPoOrderId).length > 0) {
          toast.warning("Menu ini sudah punya PO terbit. Pakai tombol Batalkan PO untuk menghapusnya.", "PO Sudah Terbit");
          return;
        }
        const updatedOrder: MenuOrder = {
          ...targetOrder,
          poDate: poFormDate.trim() || targetOrder.poDate,
          poArrivalItems: [],
        };
        warehouseDb.saveMenuOrder(updatedOrder, currentUser, false);
        refreshOrders();
        setIsPoModalOpen(false);
        toast.success(`Seluruh rincian PO untuk menu ${updatedOrder.menuTitle} telah dihapus.`);
        return;
      }

      const duplicates = findDuplicatePoRows(validItems);
      if (duplicates.length > 0) {
        toast.error(`${duplicates.join(", ")} tercatat lebih dari sekali untuk supplier yang sama. Gabungkan jumlahnya di satu baris.`, "Bahan Dobel");
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
      toast.success(`${validItems.length} bahan tersimpan untuk menu ${formatIndonesianDate(updatedOrder.date)}. PO belum diterbitkan.`);
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan rincian PO.", "Gagal Menyimpan");
    }
  };

  // Delete Order
  const handleDeleteOrder = async (orderId: string, menuTitle: string) => {
    if (await askConfirm({
      title: `Hapus menu & PO "${menuTitle}"?`,
      message: 'Data yang dihapus tidak bisa dikembalikan.',
      confirmText: 'Hapus',
      variant: 'danger',
    })) {
      warehouseDb.deleteMenuOrder(orderId, currentUser);
      refreshOrders();
      toast.success(`Catatan menu "${menuTitle}" telah dihapus.`);
    }
  };

  // Quick Status Change
  const handleQuickStatusChange = (orderId: string, newStatus: MenuOrderStatus) => {
    try {
      warehouseDb.updateMenuOrderStatus(orderId, newStatus, currentUser);
      refreshOrders();
      toast.success(`Status menu order berhasil diperbarui.`);
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui status order.", "Gagal Update Status");
    }
  };

  const getStatusBadge = (status: MenuOrderStatus) => {
    switch (status) {
      case "PLANNED":
        return {label: "Direncanakan", class: "bg-slate-100 text-slate-700 border-slate-300"};
      case "PREPPING":
        return {label: "Persiapan Bahan", class: "bg-amber-50 text-amber-800 border-amber-300"};
      case "COOKING":
        return {label: "Sedang Dimasak", class: "bg-orange-50 text-orange-800 border-orange-300"};
      case "DISTRIBUTED":
      case "COMPLETED":
        return {label: "Terdistribusi Selesai", class: "bg-emerald-50 text-emerald-800 border-emerald-300"};
      case "CANCELLED":
        return {label: "Dibatalkan", class: "bg-rose-50 text-rose-800 border-rose-300"};
    }
  };

  // Ekspor Excel Multi-Sheet Komprehensif
  const handleExportExcelAll = () => {
    const dailyOrderRows: Record<string, any>[] = [];
    filteredOrders.forEach((ord, ordIdx) => {
      const items = ord.poArrivalItems || [];
      if (items.length === 0) {
        dailyOrderRows.push({
          No: ordIdx + 1,
          "Total Penerima Manfaat": ord.totalBeneficiaries,
          "Menu Reguler": ord.menuTitle,
          "Menu B3": ord.specialDietB3 || "-",
          Tanggal: ord.date,
          "Tanggal PO (H-1)": ord.poDate || "-",
          Kategori: "-",
          "Nama Barang": "-",
          "Qty PO": "-",
          "Datang dan Timbang": "-",
          Supplier: "-",
          "Jam Datang": "-",
          PIC: ord.chefInCharge || "-",
        });
      } else {
        items.forEach((it, itIdx) => {
          dailyOrderRows.push({
            No: itIdx === 0 ? ordIdx + 1 : "",
            "Total Penerima Manfaat": itIdx === 0 ? ord.totalBeneficiaries : "",
            "Menu Reguler": itIdx === 0 ? ord.menuTitle : "",
            "Menu B3": itIdx === 0 ? ord.specialDietB3 || "-" : "",
            Tanggal: itIdx === 0 ? ord.date : "",
            "Tanggal PO (H-1)": itIdx === 0 ? ord.poDate || "-" : "",
            Kategori: it.category,
            "Nama Barang": it.itemName,
            "Qty PO": it.qtyOrder,
            "Datang dan Timbang": it.qtyArrived,
            Supplier: it.supplier || "-",
            "Jam Datang": it.arrivalTime || "-",
            PIC: it.pic || "-",
          });
        });
      }
    });

    const matrixRows: Record<string, any>[] = weeklyMaterialMatrix.rows.map((r) => {
      const obj: Record<string, any> = {
        No: r.no || "",
        Kategori: r.categoryGroup,
        "Nama Barang": r.itemName,
      };
      weeklyMaterialMatrix.dates.forEach((d) => {
        obj[formatShortDate(d)] = r.dateValues[d] ?? "";
      });
      obj["Total Pengeluaran"] = r.totalPeriod;
      obj["Satuan"] = r.unit;
      obj["Sisa Bahan Gudang"] = r.warehouseStock || "-";
      return obj;
    });

    const schoolRows = filteredSchools.map((s, idx) => ({
      No: idx + 1,
      "Nama Sekolah / Titik Sasaran": s.schoolName,
      Kategori: s.category,
      "Jumlah Porsi / Siswa": s.portionCount,
      "Jadwal Kirim": s.deliveryTime || "-",
      "PIC Sekolah": s.contactPerson || "-",
      "No Telepon": s.phone || "-",
      Status: s.status || "TERKIRIM",
    }));

    exportMultiSheetExcel(
      [
        {sheetName: "Rekap Menu & PO Harian", data: dailyOrderRows},
        {sheetName: "Matriks Pengeluaran Bahan", data: matrixRows},
        {sheetName: "Penerima Manfaat Sekolah", data: schoolRows},
      ],
      `Rekap_Menu_PO_PenerimaManfaat_SPPG_${localDateIso(new Date())}.xlsx`,
    );
  };

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Menu & Sekolah</h1>
            <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
              Menu harian, PO bahan H-1, porsi tiap sekolah penerima, dan surat jalan distribusi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ActionDropdown
              splitAction={{
                label: "Catat Menu",
                icon: UtensilsCrossed,
                onClick: () => handleOpenCreateMenuModal(),
                title: "Catat menu untuk tanggal yang sedang dilihat",
                variant: "emerald",
              }}
              header="Catat"
              widthClass="w-64"
              items={[
                {
                  id: "menu",
                  label: "Catat menu",
                  description: "Menu reguler dan menu khusus 3B",
                  icon: UtensilsCrossed,
                  iconBgClass: "bg-slate-100 text-slate-700",
                  iconColorClass: "text-slate-600",
                  onClick: () => handleOpenCreateMenuModal(),
                },
                {
                  id: "po",
                  label: "Buat PO bahan",
                  description: "Pesan bahan H-1 ke supplier",
                  icon: PackagePlus,
                  iconBgClass: "bg-slate-100 text-slate-700",
                  iconColorClass: "text-slate-600",
                  onClick: () => handleOpenPoModal(),
                },
              ]}
            />
            <ActionDropdown
              triggerLabel="Cetak"
              triggerIcon={Printer}
              triggerVariant="white"
              header="Cetak"
              widthClass="w-60"
              items={[
                ...(onNavigate
                  ? [{
                      id: "menu-print",
                      label: "Poster menu MBG",
                      description: "Buka studio cetak menu harian",
                      icon: Printer,
                      iconBgClass: "bg-slate-100 text-slate-700",
                      iconColorClass: "text-slate-600",
                      onClick: () => onNavigate("menu_print"),
                    }]
                  : []),
                {
                  id: "page-print",
                  label: "Halaman ini",
                  description: "Cetak atau simpan sebagai PDF",
                  icon: FileText,
                  iconBgClass: "bg-slate-100 text-slate-700",
                  iconColorClass: "text-slate-600",
                  onClick: () => window.print(),
                },
              ]}
            />
            <button
              type="button"
              onClick={handleExportExcelAll}
              className={BTN_SECONDARY}
              title="Unduh order, PO, matriks bahan, dan data sekolah ke Excel">
              <FileSpreadsheet className="w-4 h-4" />
              Ekspor Excel
            </button>
          </div>
        </div>

        <div role="tablist" aria-label="Bagian halaman menu" className="flex gap-1 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto max-w-full w-fit">
          {([
            {id: "MENU_ORDERS", label: "Menu & PO"},
            {id: "BENEFICIARIES", label: "Porsi per Sekolah"},
            {id: "DELIVERY_NOTES", label: "Surat Jalan"},
            {id: "MASTER_BENEFICIARIES", label: `Data Sekolah (${beneficiaries.length})`},
          ] as {id: SubTabType; label: string}[]).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeSubTab === tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[32px] ${FOCUS_RING} ${
                activeSubTab === tab.id ? "bg-white text-slate-900 font-semibold shadow-xs" : "text-slate-600 hover:text-slate-900 font-medium"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: REKAP HARIAN MENU & KEDATANGAN PO (FORMAT KARTU VISUAL MUDAH BACA) */}
      {/* ========================================================================= */}
      {activeSubTab === "MENU_ORDERS" && (
        <div className="space-y-4">
          {/* Filter Control Box: Standardized Period Filter */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
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
                    onClick={() => setPeriodType("DAILY")}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      periodType === "DAILY" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                    }`}>
                    Harian
                  </button>

                  <button
                    type="button"
                    onClick={handleSetThisWeek}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      periodType === "WEEKLY" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                    }`}>
                    Mingguan
                  </button>

                  <button
                    type="button"
                    onClick={() => setPeriodType("MONTHLY")}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      periodType === "MONTHLY" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                    }`}>
                    Bulanan
                  </button>

                  <button
                    type="button"
                    onClick={() => setPeriodType("ALL")}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      periodType === "ALL" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600 hover:text-slate-900"
                    }`}>
                    Semua Tanggal
                  </button>
                </div>
              </div>

              {/* Date Range Inputs */}
              <div className="flex flex-wrap items-center gap-2">
                {periodType === "DAILY" && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handlePrevDay}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                      title="Hari Sebelumnya">
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                      <span className="text-slate-500 font-medium">Tanggal:</span>
                      <input
                        type="date"
                        value={selectedDailyDate}
                        onChange={(e) => {
                          setSelectedDailyDate(e.target.value);
                          setPeriodType("DAILY");
                        }}
                        className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleNextDay}
                      className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer transition-colors"
                      title="Hari Berikutnya">
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    {selectedDailyDate !== todayStr && (
                      <button
                        type="button"
                        onClick={handleJumpToToday}
                        className="px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 cursor-pointer transition-colors">
                        Hari Ini
                      </button>
                    )}
                  </div>
                )}

                {periodType === "WEEKLY" && (
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                      <span className="text-slate-500 font-medium">Dari:</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                      />
                    </div>
                    <span className="text-slate-500 font-medium">s/d</span>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                      <span className="text-slate-500 font-medium">Sampai:</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handleSetThisWeek}
                        className="px-2 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 cursor-pointer">
                        Minggu Ini
                      </button>
                      <button
                        type="button"
                        onClick={handleSetLastWeek}
                        className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 cursor-pointer">
                        Minggu Lalu
                      </button>
                    </div>
                  </div>
                )}

                {periodType === "MONTHLY" && (
                  <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs">
                    <span className="text-slate-500 font-medium">Pilih Bulan:</span>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="font-semibold text-slate-800 bg-transparent focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-600 rounded px-1 cursor-pointer"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-600">Sesi menu</div>
              <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{stats.totalOrders}</div>
              <div className="text-[11px] text-slate-600 mt-0.5">{stats.inCooking} sedang disiapkan atau dimasak</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-600">Porsi direncanakan</div>
              <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{stats.totalPortionsPlanned.toLocaleString("id-ID")}</div>
              <div className="text-[11px] text-slate-600 mt-0.5">{stats.totalPortionsDistributed.toLocaleString("id-ID")} sudah tersalurkan</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-600">Bahan sudah datang</div>
              <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                {stats.arrivedItemsCount} <span className="text-xs font-normal text-slate-600">dari {stats.totalPOItemsCount}</span>
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">Item PO yang jumlah datangnya sudah diisi</div>
            </div>
            <div className="p-3.5 rounded-xl bg-white border border-slate-200">
              <div className="text-xs text-slate-600">Perkiraan biaya PO</div>
              <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">Rp {Math.round(stats.totalEstimatedCost).toLocaleString("id-ID")}</div>
              <div className="text-[11px] text-slate-600 mt-0.5">Dari harga perkiraan per bahan</div>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select size="sm"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}>
                <option value="ALL">Semua Status</option>
                <option value="PLANNED">Direncanakan</option>
                <option value="PREPPING">Persiapan Bahan</option>
                <option value="COOKING">Sedang Dimasak</option>
                <option value="DISTRIBUTED">Terdistribusi Selesai</option>
              </Select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Cari nama menu, bahan PO, pemasok, PIC..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Daily Card Feed (Mudah Dibaca & Ergonomis) */}
          {filteredOrders.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-xs text-slate-500 space-y-3">
              <UtensilsCrossed className="w-10 h-10 text-slate-300 mx-auto" />
              <div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">
                  Belum ada jadwal menu untuk {periodType === "DAILY" ? formatIndonesianDate(selectedDailyDate) : effectiveDateRange.label}
                </h4>
                <p className="text-slate-500 max-w-md mx-auto">Anda dapat langsung mencatat menu dan pesanan bahan PO untuk tanggal ini, atau kembali melihat jadwal hari ini.</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleOpenCreateMenuModal(selectedDailyDate)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white transition-colors cursor-pointer">
                  <Plus className="w-4 h-4" />
                  <span>Input Menu untuk Tanggal Ini</span>
                </button>
                {selectedDailyDate !== todayStr && (
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer">
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
                  <div key={order.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all">
                    {/* Header Kartu Harian */}
                    <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{formatIndonesianDate(order.date)}</h3>
                          <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">{order.mealSession}</span>
                          {order.poDate && (
                            <span className="text-xs px-2 py-0.5 rounded-md bg-white text-slate-700 border border-slate-200">PO {formatShortDate(order.poDate)}</span>
                          )}
                          <div className="relative inline-flex items-center">
                            <Select size="sm"
                              tone={statusMeta.class}
                              value={order.status}
                              onChange={(e) => handleQuickStatusChange(order.id, e.target.value as MenuOrderStatus)}
                              aria-label={`Status menu ${formatIndonesianDate(order.date)}`}
                              title="Klik untuk ubah status pengerjaan menu">
                              <option value="PLANNED">Direncanakan</option>
                              <option value="PREPPING">Persiapan Bahan</option>
                              <option value="COOKING">Sedang Dimasak</option>
                              <option value="DISTRIBUTED">Terdistribusi Selesai</option>
                              <option value="CANCELLED">Dibatalkan</option>
                            </Select>
                            <ChevronDown className="w-3 h-3 absolute right-1.5 pointer-events-none opacity-60" />
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1.5">
                          <span>
                            Target:{" "}
                            <strong className="font-bold text-slate-900">
                              {order.totalBeneficiaries?.toLocaleString("id-ID") || order.targetPortions.toLocaleString("id-ID")} porsi
                            </strong>
                          </span>
                          {order.chefInCharge && (
                            <>
                              <span className="text-slate-300" aria-hidden="true">•</span>
                              <span>
                                Penanggung jawab: <span className="font-medium text-slate-800">{order.chefInCharge}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Tombol Aksi Langsung pada Kartu (Ringkas & Bersih) */}
                      <div className="flex items-center gap-1.5 self-start lg:self-auto">
                        {/* Edit Menu */}
                        <button
                          type="button"
                          onClick={() => handleOpenEditMenuModal(order)}
                          className={BTN_SECONDARY}
                          title="Ubah susunan menu & target porsi">
                          <Edit2 className="w-3.5 h-3.5" />
                          Ubah menu
                        </button>

                        {/* Kelola PO Bahan */}
                        <button
                          type="button"
                          onClick={() => handleOpenPoModal(order.id)}
                          className={poItems.length > 0 ? BTN_SECONDARY : BTN_PRIMARY}
                          title="Kelola daftar bahan PO & supplier">
                          <PackagePlus className="w-3.5 h-3.5" />
                          {poItems.length > 0 ? `PO (${poItems.length})` : "Buat PO"}
                        </button>

                        {/* Menu Tindakan Lainnya (...) */}
                        <div className="relative order-action-menu-container">
                          <button
                            type="button"
                            onClick={() => setOpenOrderMenuId(openOrderMenuId === order.id ? null : order.id)}
                            aria-label="Tindakan lainnya"
                            aria-expanded={openOrderMenuId === order.id}
                            className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] rounded-lg border transition-colors cursor-pointer ${FOCUS_RING} ${
                              openOrderMenuId === order.id
                                ? "bg-slate-100 text-slate-800 border-slate-300"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100 border-transparent"
                            }`}
                            title="Tindakan lainnya">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>

                          {openOrderMenuId === order.id && (
                            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white rounded-xl border border-slate-200 py-1 z-30 animate-in fade-in zoom-in-95 duration-100 text-xs">
                              {poItems.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenOrderMenuId(null);
                                    handleDeletePoForOrder(order.id);
                                  }}
                                  className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer">
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  <span>Batalkan PO</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenOrderMenuId(null);
                                  handleDeleteOrder(order.id, order.menuTitle);
                                }}
                                className="w-full text-left px-3 py-2 text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors cursor-pointer">
                                <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                <span>Hapus menu</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expand / Collapse */}
                        <button
                          type="button"
                          onClick={() => toggleExpandOrder(order.id)}
                          className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ${FOCUS_RING}`}
                          aria-expanded={isExpanded}
                          aria-label={isExpanded ? "Tutup rincian" : "Buka rincian"}
                          title={isExpanded ? "Tutup rincian" : "Buka rincian"}>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Konten Kartu */}
                    {isExpanded && (
                      <div className="p-4 sm:p-5 space-y-4">
                        {/* SEKSI 1: KOMPOSISI OLAHAN MENU */}
                        <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-200/80 space-y-3">
                          <span className="text-xs font-bold text-slate-900">Menu reguler</span>

                          {/* Komposisi Menu Reguler Cards */}
                          {regularDishes.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                              {regularDishes.map((dish, dIdx) => (
                                <div key={dIdx} className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col justify-between">
                                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-tight">{dish.category}</span>
                                  <span className="text-xs font-bold text-slate-900 mt-1 capitalize">{dish.name}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-500 italic">Belum ada menu reguler diinput.</div>
                          )}

                          {/* Menu Diet Khusus Balita & Bumil (B3) */}
                          <div className="pt-3 border-t border-slate-200/80">
                            <div className="text-xs font-semibold text-slate-700 mb-2">Menu balita & ibu hamil (B3)</div>
                            {order.specialDietB3 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {b3Dishes.map((dish, bIdx) => (
                                  <div key={bIdx} className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-800 font-medium capitalize">
                                    {dish.name}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500 italic">Mengikuti menu reguler dengan penyesuaian porsi balita & ibu hamil.</div>
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
                            <span className="text-xs font-bold text-slate-900">Rincian Bahan PO</span>
                            <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">{poItems.length} Bahan</span>
                          </div>

                          {/* List Bahan Table (Clean & Focused) */}
                          {poItems.length === 0 ? (
                            <div className="py-5 px-4 text-center rounded-xl bg-slate-50 border border-slate-200/80">
                              <p className="text-xs text-slate-500">Belum ada rincian bahan PO yang tercatat untuk menu ini.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                                    <th className="py-2.5 px-3 w-36">Kategori</th>
                                    <th className="py-2.5 px-4">Nama Bahan</th>
                                    <th className="py-2.5 px-4 w-52">Supplier / Rekanan</th>
                                    <th className="py-2.5 px-4 w-28 text-right">Dipesan</th>
                                    <th className="py-2.5 px-4 w-28 text-right">Datang</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {poItems.map((item, pIdx) => (
                                    <tr key={pIdx} className="hover:bg-slate-50/70 transition-colors">
                                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{pIdx + 1}</td>
                                      <td className="py-2.5 px-3 text-slate-600 font-medium">{item.category}</td>
                                      <td className="py-2.5 px-4 font-semibold text-slate-900">{item.itemName}</td>
                                      <td className="py-2.5 px-4 text-slate-700 font-medium">
                                        {item.supplier || <span className="text-amber-800">Belum dipilih</span>}
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">{item.qtyOrder || "-"}</td>
                                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                                        {item.qtyArrived ? <span className="font-semibold text-slate-900">{item.qtyArrived}</span> : <span className="text-slate-500 font-sans">Belum</span>}
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
      {activeSubTab === "BENEFICIARIES" && (
        <div className="space-y-4">
          {/* Pilih tampilan */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div role="tablist" aria-label="Tampilan porsi" className="inline-flex gap-1 p-1 bg-slate-200/70 rounded-lg text-xs w-fit">
              {([
                {id: "DETAIL_HARIAN", label: "Porsi hari ini"},
                {id: "REKAP_HARIAN", label: "Rekap periode"},
              ] as const).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={beneficiaryViewMode === v.id}
                  onClick={() => setBeneficiaryViewMode(v.id)}
                  className={`px-3 rounded-md whitespace-nowrap cursor-pointer min-h-[44px] sm:min-h-[30px] ${FOCUS_RING} ${
                    beneficiaryViewMode === v.id ? "bg-white text-slate-900 font-semibold shadow-xs" : "text-slate-700 hover:text-slate-900 font-medium"
                  }`}>
                  {v.label}
                </button>
              ))}
            </div>

            {beneficiaryViewMode === "REKAP_HARIAN" && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleExportBeneficiaryDailyRecap} className={BTN_SECONDARY} title="Unduh rekap porsi ke Excel">
                  <FileSpreadsheet className="w-4 h-4" />
                  Ekspor Excel
                </button>
                <button type="button" onClick={() => setIsBeneficiaryPrintModalOpen(true)} className={BTN_SECONDARY} title="Cetak rekap dengan kop surat SPPG">
                  <Printer className="w-4 h-4" />
                  Cetak rekap
                </button>
              </div>
            )}
          </div>

          {/* MODE 1: REKAP MATRIKS HARIAN */}
          {beneficiaryViewMode === "REKAP_HARIAN" && (
            <div className="space-y-4">
              {/* Filter Tanggal & Kategori Bar */}
              <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select size="sm"
                      aria-label="Periode rekap"
                      value={beneficiaryPeriodPreset}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setBeneficiaryPeriodPreset(val);
                      }}>
                      <option value="ALL_ORDERS">Semua tanggal tercatat</option>
                      <option value="LAST_7_DAYS">7 hari terakhir</option>
                      <option value="THIS_MONTH">Bulan ini</option>
                      <option value="CUSTOM">Pilih rentang…</option>
                    </Select>

                    {beneficiaryPeriodPreset === "CUSTOM" && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <input
                          type="date"
                          value={beneficiaryStartDate}
                          onChange={(e) => setBeneficiaryStartDate(e.target.value)}
                          className="px-2.5 py-1 border border-slate-300 rounded-lg text-slate-800 bg-white font-mono"
                        />
                        <span className="text-slate-500">s/d</span>
                        <input
                          type="date"
                          value={beneficiaryEndDate}
                          onChange={(e) => setBeneficiaryEndDate(e.target.value)}
                          className="px-2.5 py-1 border border-slate-300 rounded-lg text-slate-800 bg-white font-mono"
                        />
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-500 font-medium">
                    Menampilkan <strong className="text-slate-800 font-mono">{dailyBeneficiaryMatrix.dates.length}</strong> tanggal distribusi
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select size="sm"
                      value={selectedBeneficiaryCategory}
                      onChange={(e) => setSelectedBeneficiaryCategory(e.target.value)}>
                      <option value="ALL">Semua kategori</option>
                      {categoryOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari nama sekolah, kontak, PIC..."
                      value={schoolSearchQuery}
                      onChange={(e) => setSchoolSearchQuery(e.target.value)}
                      className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500">Total Porsi Periode Ini</div>
                  <div className="text-xl font-bold text-blue-900 mt-1 font-mono tabular-nums">
                    {dailyBeneficiaryMatrix.grandTotal.toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-500">porsi</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Akumulasi seluruh sekolah</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500">Rata-rata Porsi per Hari</div>
                  <div className="text-xl font-bold text-emerald-800 mt-1 font-mono tabular-nums">
                    {Math.round(dailyBeneficiaryMatrix.avgDailyTotal).toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-500">porsi/hari</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Rata-rata kebutuhan dapur SPPG</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500">Lembaga Terdaftar</div>
                  <div className="text-xl font-bold text-slate-800 mt-1 font-mono tabular-nums">
                    {dailyBeneficiaryMatrix.schoolCount} <span className="text-xs font-normal text-slate-500">titik</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Sekolah dasar, SMP, PAUD, posyandu</div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-500">Hari Distribusi Aktif</div>
                  <div className="text-xl font-bold text-slate-800 mt-1 font-mono tabular-nums">
                    {dailyBeneficiaryMatrix.activeDateCount} <span className="text-xs font-normal text-slate-500">hari</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Tersedia jadwal menu operasional</div>
                </div>
              </div>

              {/* Matriks Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                        <th className="py-2.5 px-3 w-10 text-center sticky left-0 bg-slate-100 z-10 border-r border-slate-200">No</th>
                        <th className="py-2.5 px-3 min-w-[200px] sticky left-10 bg-slate-100 z-10 border-r border-slate-200">Nama Sekolah / Lembaga</th>
                        <th className="py-2.5 px-2.5 w-24">Kategori</th>
                        {dailyBeneficiaryMatrix.dates.map((dateKey) => {
                          const order = dailyBeneficiaryMatrix.orderMap[dateKey];
                          const totalCol = dailyBeneficiaryMatrix.dateTotals[dateKey] || 0;
                          return (
                            <th key={dateKey} className="py-2 px-2.5 min-w-[105px] text-center border-l border-slate-200/80 bg-slate-50/50">
                              <div className="font-mono text-[11px] text-slate-900 font-bold whitespace-nowrap">{formatShortDate(dateKey)}</div>
                              <div className="text-[10px] font-mono text-emerald-800 font-semibold mt-0.5">{totalCol > 0 ? `${totalCol.toLocaleString("id-ID")} p` : "-"}</div>
                              {order?.menuTitle && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[95px] mx-auto mt-0.5" title={order.menuTitle}>
                                  {order.menuTitle.split(",")[0]}
                                </div>
                              )}
                            </th>
                          );
                        })}
                        <th className="py-2.5 px-3 w-28 text-right border-l-2 border-slate-300 bg-slate-100/80">Total Periode</th>
                        <th className="py-2.5 px-3 w-24 text-right border-l border-slate-200 bg-slate-100/80">Rata-rata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyBeneficiaryMatrix.rows.map((row, idx) => (
                        <tr key={row.schoolId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 sticky left-10 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200">
                            <div className="font-semibold text-slate-900">{row.schoolName}</div>
                            <div className="text-[10px] text-slate-500">
                              Standar Master: <span className="font-mono">{row.masterPortion} porsi</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-2.5">
                            <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">{row.category}</span>
                          </td>
                          {dailyBeneficiaryMatrix.dates.map((dateKey) => {
                            const portion = row.datePortions[dateKey] || 0;
                            const isDiffFromMaster = portion > 0 && portion !== row.masterPortion;
                            const skip = row.dateSkips[dateKey];
                            return (
                              <td key={dateKey} className="py-2 px-2 text-center font-mono border-l border-slate-100">
                                {skip ? (
                                  <span
                                    className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-sans font-medium whitespace-nowrap"
                                    title={`Tidak dikirim: ${SKIP_REASON_LABEL[skip]}`}>
                                    {SKIP_REASON_LABEL[skip]}
                                  </span>
                                ) : portion > 0 ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await changeBeneficiaryDate(dateKey);
                                      setBeneficiaryViewMode("DETAIL_HARIAN");
                                    }}
                                    className={`px-2 py-0.5 rounded text-xs font-semibold tabular-nums cursor-pointer transition-colors ${
                                      isDiffFromMaster
                                        ? "bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100"
                                        : "bg-slate-50 text-slate-800 border border-slate-200 hover:bg-slate-100"
                                    }`}
                                    title={`Klik untuk lihat/ubah alokasi tanggal ${dateKey}`}>
                                    {portion.toLocaleString("id-ID")}
                                  </button>
                                ) : (
                                  <span className="text-slate-300 font-mono text-xs">-</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-900 border-l-2 border-slate-200 tabular-nums">
                            {row.totalPeriod.toLocaleString("id-ID")} <span className="text-[10px] font-normal text-slate-500">p</span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700 border-l border-slate-100 tabular-nums">
                            {Math.round(row.avgDaily).toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900">
                        <td colSpan={3} className="py-3 px-3 text-right sticky left-0 bg-slate-100/90 z-10 border-r border-slate-200 text-xs">
                          Total Porsi Harian Seluruh Sekolah:
                        </td>
                        {dailyBeneficiaryMatrix.dates.map((dateKey) => {
                          const totalCol = dailyBeneficiaryMatrix.dateTotals[dateKey] || 0;
                          return (
                            <td key={dateKey} className="py-3 px-2 text-center font-mono font-bold text-emerald-800 border-l border-slate-200 tabular-nums text-xs">
                              {totalCol > 0 ? totalCol.toLocaleString("id-ID") : "-"}
                            </td>
                          );
                        })}
                        <td className="py-3 px-3 text-right font-mono font-bold text-blue-900 border-l-2 border-slate-300 tabular-nums text-xs">
                          {dailyBeneficiaryMatrix.grandTotal.toLocaleString("id-ID")}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800 border-l border-slate-200 tabular-nums text-xs">
                          {Math.round(dailyBeneficiaryMatrix.avgDailyTotal).toLocaleString("id-ID")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: DETAIL ALOKASI PER TANGGAL */}
          {beneficiaryViewMode === "DETAIL_HARIAN" &&
            (() => {
              const currentOrder = beneficiaryOrder;
              const totalDraftPortions = dailyDraftTotal;
              const skippedSchools = masterSchools.filter((sc) => dailyDraftSkips[sc.id]);
              const sentSchools = masterSchools.filter((sc) => !dailyDraftSkips[sc.id] && (Number(dailyDraftPortions[sc.id]) || 0) > 0);
              const distinctDatesWithOrders = Array.from(new Set(orders.map((o) => o.date))).sort();

              return (
                <div className="space-y-4">
                  {/* Tanggal & aksi */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <DateStepper ariaLabel="Tanggal porsi" value={beneficiarySelectedDate} onChange={changeBeneficiaryDate} />
                        {beneficiarySelectedDate !== todayStr && (
                          <button type="button" onClick={() => changeBeneficiaryDate(todayStr)} className={BTN_SECONDARY}>
                            Hari ini
                          </button>
                        )}
                        {distinctDatesWithOrders.length > 0 && (
                          <Select className="w-auto max-w-[260px]"
                            aria-label="Lompat ke tanggal bermenu"
                            value={distinctDatesWithOrders.includes(beneficiarySelectedDate) ? beneficiarySelectedDate : ""}
                            onChange={(e) => e.target.value && changeBeneficiaryDate(e.target.value)}>
                            <option value="">Lompat ke tanggal bermenu…</option>
                            {distinctDatesWithOrders.map((d) => (
                              <option key={d} value={d}>
                                {formatShortDate(d)} · {orders.find((o) => o.date === d)?.menuTitle}
                              </option>
                            ))}
                          </Select>
                        )}
                        {dayOrders.length > 1 && (
                          <div role="tablist" aria-label="Sesi makan" className="inline-flex gap-1 p-1 bg-slate-100 rounded-lg text-xs">
                            {dayOrders.map((o) => (
                              <button
                                key={o.id}
                                type="button"
                                role="tab"
                                aria-selected={beneficiaryOrder?.id === o.id}
                                onClick={() => changeBeneficiaryOrder(o.id)}
                                className={`px-3 rounded-md cursor-pointer min-h-[44px] sm:min-h-[30px] ${FOCUS_RING} ${
                                  beneficiaryOrder?.id === o.id ? "bg-white text-slate-900 font-semibold shadow-xs" : "text-slate-600 hover:text-slate-900 font-medium"
                                }`}>
                                {o.mealSession}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {(
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => setRecapPasteText("")} className={BTN_SECONDARY} title="Tempel rekap penerima manfaat dari WhatsApp atau Excel">
                            <ClipboardPaste className="w-4 h-4" />
                            Tempel rekap
                          </button>
                          <button type="button" onClick={handleScaleDailyPortionsProportional} className={BTN_SECONDARY} title="Ubah total porsi, tiap sekolah ikut menyesuaikan">
                            Sesuaikan total
                          </button>
                          <button type="button" onClick={handleResetDailyAllocationsToMaster} className={BTN_SECONDARY} title="Kembalikan porsi tiap sekolah ke porsi standar">
                            <RotateCcw className="w-3.5 h-3.5" />
                            Porsi standar
                          </button>
                          <button type="button" onClick={handleSaveDailyAllocations} disabled={!isDailyDraftDirty} className={BTN_PRIMARY}>
                            <Save className="w-4 h-4" />
                            Simpan
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pt-3 border-t border-slate-200">
                      {currentOrder ? (
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900">{formatIndonesianDate(beneficiarySelectedDate)}</div>
                          <div className="text-xs text-slate-600 mt-0.5 truncate">
                            {currentOrder.mealSession} · {currentOrder.menuTitle}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <p className="text-xs text-slate-700">
                            <span className="font-semibold text-slate-900">{formatIndonesianDate(beneficiarySelectedDate)}</span> belum ada menu. Rekap penerima manfaat tetap bisa dicatat; menu diperlukan untuk surat jalan.
                          </p>
                          <button type="button" onClick={() => handleOpenCreateMenuModal(beneficiarySelectedDate)} className={BTN_PRIMARY}>
                            <Plus className="w-4 h-4" />
                            Catat menu
                          </button>
                        </div>
                      )}
                      <div className="text-right shrink-0">
                        <div className="text-[11px] text-slate-600">Total porsi dikirim</div>
                        <div className="text-xl font-bold text-slate-900 tabular-nums">{totalDraftPortions.toLocaleString("id-ID")}</div>
                        <div className="text-[11px] text-slate-600">
                          {sentSchools.length} sekolah dikirim{skippedSchools.length > 0 ? ` · ${skippedSchools.length} tidak` : ""}
                        </div>
                        {!savedRecap && !isDailyDraftDirty && (
                          <div className="text-[11px] text-slate-500">
                            {draftSource === "LAST_RECAP" && draftSourceDate
                              ? `Angka awal dari ${formatShortDate(draftSourceDate)}`
                              : draftSource === "ORDER"
                                ? "Angka awal dari menu"
                                : "Angka awal dari porsi standar"}
                          </div>
                        )}
                        {isDailyDraftDirty ? (
                          <div className="text-[11px] font-semibold text-amber-800">Belum disimpan</div>
                        ) : savedRecap ? (
                          <div className="text-[11px] text-emerald-800">
                            Rekap tersimpan{savedRecap.updatedBy ? ` · ${savedRecap.updatedBy}` : ""}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-600">Rekap tanggal ini belum dicatat</div>
                        )}
                        {recapReportedTotal !== undefined && recapReportedTotal !== totalDraftPortions && (
                          <div className="text-[11px] font-semibold text-amber-800">
                            TOTAL di laporan {recapReportedTotal.toLocaleString("id-ID")} (selisih {(recapReportedTotal - totalDraftPortions).toLocaleString("id-ID")})
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Daily School Allocation Table */}
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="p-3 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Select size="sm"
                          value={selectedBeneficiaryCategory}
                          onChange={(e) => setSelectedBeneficiaryCategory(e.target.value)}>
                          <option value="ALL">Semua kategori ({masterSchools.length})</option>
                          {categoryOptions.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </Select>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          placeholder="Cari sekolah..."
                          value={schoolSearchQuery}
                          onChange={(e) => setSchoolSearchQuery(e.target.value)}
                          className="text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-1 w-52 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                          <th className="py-2.5 px-3 w-10 text-center">No</th>
                          <th className="py-2.5 px-4 min-w-[200px]">Nama Sekolah / Lembaga</th>
                          <th className="py-2.5 px-3 w-28">Kategori</th>
                          <th className="py-2.5 px-3 w-48">Dikirim?</th>
                          <th className="py-2.5 px-3 w-36 text-right">Porsi</th>
                          <th className="py-2.5 px-3 w-24 text-center">vs standar</th>
                          <th className="py-2.5 px-3 w-28">Jadwal Kirim</th>
                          <th className="py-2.5 px-4 w-44">PIC & Kontak</th>
                          <th className="py-2.5 px-3 w-36 text-center">Status kirim</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredSchools.map((s, idx) => {
                          const curPortion = dailyDraftPortions[s.id] ?? s.portionCount;
                          const diff = curPortion - s.portionCount;
                          const skipReason = dailyDraftSkips[s.id];
                          return (
                            <tr key={s.id} className={`transition-colors ${skipReason ? "bg-slate-50 text-slate-500" : "hover:bg-slate-50/70"}`}>
                              <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                              <td className="py-2.5 px-4">
                                <div className="font-bold text-slate-900">{s.schoolName}</div>
                                {s.notes && <div className="text-[10px] text-slate-500 truncate max-w-xs">{s.notes}</div>}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">{s.category}</span>
                              </td>
                              <td className="py-2.5 px-3">
                                <Select size="sm"
                                  aria-label={`Dikirim ke ${s.schoolName}`}
                                  tone={skipReason ? "bg-slate-100 text-slate-700 border-slate-300" : "bg-emerald-50 text-emerald-800 border-emerald-300"}
                                  value={skipReason || "KIRIM"}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setDailyDraftSkips((prev) => {
                                      const next = {...prev};
                                      if (v === "KIRIM") delete next[s.id];
                                      else next[s.id] = v as SkipReason;
                                      return next;
                                    });
                                    setIsDailyDraftDirty(true);
                                  }}>
                                  <option value="KIRIM">Kirim</option>
                                  {(Object.keys(SKIP_REASON_LABEL) as SkipReason[]).map((r) => (
                                    <option key={r} value={r}>Tidak kirim · {SKIP_REASON_LABEL[r]}</option>
                                  ))}
                                </Select>
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="inline-flex items-center gap-1 justify-end">
                                  <input
                                    type="number"
                                    min="0"
                                    value={curPortion || ""}
                                    onChange={(e) => {
                                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                      setDailyDraftPortions((prev) => ({...prev, [s.id]: val}));
                                      setIsDailyDraftDirty(true);
                                    }}
                                    aria-label={`Porsi ${s.schoolName}`}
                                    disabled={Boolean(skipReason)}
                                    title={skipReason ? "Porsi biasanya; tidak dihitung karena tidak dikirim" : undefined}
                                    className="w-20 px-2 min-h-[36px] sm:min-h-[28px] text-right font-mono font-bold text-slate-900 bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-500 focus:border-emerald-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                                  />
                                  <span className="text-slate-500 text-[11px]">porsi</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {skipReason ? (
                                  <span className="text-[10px] font-medium text-slate-500">-</span>
                                ) : diff === 0 ? (
                                  <span className="text-[10px] font-medium text-slate-500">Sesuai</span>
                                ) : diff > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">+{diff}</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{diff}</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span>{s.deliveryTime || "-"}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-4 text-slate-700 text-[11px]">
                                <div className="font-semibold text-slate-900">{s.contactPerson || "-"}</div>
                                <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                                  <Phone className="w-2.5 h-2.5 text-slate-500" />
                                  <span>{s.phone || "-"}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {(() => {
                                  const dayStatus = currentOrder?.beneficiaryAllocations?.find((b) => b.id === s.id)?.status || "DIJADWALKAN";
                                  const tone =
                                    dayStatus === "TERKIRIM"
                                      ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                      : dayStatus === "DALAM_PERJALANAN"
                                        ? "bg-amber-50 text-amber-800 border-amber-300"
                                        : dayStatus === "SIAP_KIRIM"
                                          ? "bg-sky-50 text-sky-800 border-sky-300"
                                          : "bg-slate-100 text-slate-700 border-slate-300";
                                  return (
                                    <Select size="sm"
                                      tone={tone}
                                      aria-label={`Status kirim ${s.schoolName}`}
                                      value={dayStatus}
                                      disabled={!currentOrder || Boolean(skipReason)}
                                      onChange={(e) => handleUpdateDailyStatus(s, e.target.value as NonNullable<SchoolBeneficiaryAllocation["status"]>)}>
                                      <option value="DIJADWALKAN">Dijadwalkan</option>
                                      <option value="SIAP_KIRIM">Siap kirim</option>
                                      <option value="DALAM_PERJALANAN">Dalam perjalanan</option>
                                      <option value="TERKIRIM">Terkirim</option>
                                    </Select>
                                  );
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-100/90 border-t-2 border-slate-300 font-bold text-slate-900">
                          <td colSpan={4} className="py-3 px-4 text-right text-xs">
                            Total porsi dikirim:
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-emerald-800 text-sm tabular-nums">
                            {totalDraftPortions.toLocaleString("id-ID")} <span className="text-xs font-normal">porsi</span>
                          </td>
                          <td colSpan={4} className="py-3 px-4 text-xs text-slate-600 font-normal">
                            {sentSchools.length} sekolah dikirim{skippedSchools.length > 0 ? `, ${skippedSchools.length} tidak` : ""} ·{" "}
                            {isDailyDraftDirty ? 'Belum disimpan, klik "Simpan".' : savedRecap ? "Tersimpan" : "Belum dicatat"}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SURAT JALAN & BERITA ACARA (3 LEMBAR PER SEKOLAH)                 */}
      {/* ========================================================================= */}
      {activeSubTab === "DELIVERY_NOTES" && (
        <DeliveryNotesSubModule orders={orders} masterSchools={masterSchools} currentDate={beneficiarySelectedDate || todayStr} onSelectDate={setBeneficiarySelectedDate} />
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MASTER DATA PENERIMA MANFAAT                                       */}
      {/* ========================================================================= */}
      {activeSubTab === "MASTER_BENEFICIARIES" && (
        <div className="space-y-4">
          {/* Ringkasan & aksi */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-600 max-w-xl">
                Daftar sekolah dan lembaga penerima, porsi standar per hari, jadwal kirim, dan kontak PIC. Porsi standar dipakai sebagai dasar alokasi harian.
              </p>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button type="button" onClick={handleExportMasterBeneficiariesExcel} className={BTN_SECONDARY} title="Unduh data sekolah ke Excel">
                  <FileSpreadsheet className="w-4 h-4" />
                  Ekspor Excel
                </button>
                <button type="button" onClick={handleOpenAddBeneficiary} className={BTN_PRIMARY}>
                  <Plus className="w-4 h-4" />
                  Tambah sekolah
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-600">Sekolah & lembaga</div>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{beneficiaries.length}</div>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-600">Porsi standar per hari</div>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">{beneficiaryCategoryStats.totalAllPortions.toLocaleString("id-ID")}</div>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-600">Kontak PIC lengkap</div>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                  {beneficiaries.filter((b) => b.contactPerson && b.phone).length}{" "}
                  <span className="text-xs font-normal text-slate-600">dari {beneficiaries.length}</span>
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-600">Rata-rata porsi</div>
                <div className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                  {Math.round(beneficiaryCategoryStats.totalAllPortions / (beneficiaries.length || 1)).toLocaleString("id-ID")}{" "}
                  <span className="text-xs font-normal text-slate-600">per sekolah</span>
                </div>
              </div>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <Select size="sm"
                  value={masterCategoryFilter}
                  onChange={(e) => setMasterCategoryFilter(e.target.value)}>
                  <option value="ALL">Semua kategori</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  aria-label="Cari sekolah"
                  placeholder="Cari ID, sekolah, PIC, kontak..."
                  value={masterSearchQuery}
                  onChange={(e) => setMasterSearchQuery(e.target.value)}
                  className={`${FIELD_INPUT} pl-8 w-full sm:w-64`}
                />
              </div>
            </div>
          </div>

          {/* Master Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-20">ID</th>
                  <th className="py-2.5 px-4">Nama Lembaga / Sekolah</th>
                  <th className="py-2.5 px-3 w-32">Kategori Sasaran</th>
                  <th className="py-2.5 px-3 w-28 text-right">Porsi standar</th>
                  <th className="py-2.5 px-4 w-48">Kontak PIC</th>
                  <th className="py-2.5 px-3 w-28">Jadwal Kirim</th>
                  <th className="py-2.5 px-4">Catatan Titik Serah</th>
                  <th className="py-2.5 px-3 w-28 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMasterBeneficiaries.map((s, idx) => (
                  <tr key={s.id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 font-semibold">{s.id}</td>
                    <td className="py-2.5 px-4 font-bold text-slate-900">{s.schoolName}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">{s.category}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 tabular-nums">
                      {s.portionCount.toLocaleString("id-ID")} <span className="text-[10px] font-normal text-slate-500">porsi</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 text-[11px]">
                      <div className="font-semibold text-slate-900">{s.contactPerson || "-"}</div>
                      <div className="text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                        <Phone className="w-2.5 h-2.5 text-slate-500" />
                        <span>{s.phone || "-"}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{s.deliveryTime || "-"}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px]">{s.notes || "-"}</td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditBeneficiary(s)}
                          className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer ${FOCUS_RING}`}
                          aria-label={`Ubah ${s.schoolName}`}
                          title="Ubah data sekolah">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBeneficiary(s)}
                          className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer ${FOCUS_RING}`}
                          aria-label={`Hapus ${s.schoolName}`}
                          title="Hapus sekolah">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMasterBeneficiaries.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                      Tidak ada sekolah yang cocok dengan filter atau kata kunci.
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
        <FormDialog
          title={editingMenuOrderId ? "Ubah menu" : "Catat menu"}
          description="Menu reguler, menu khusus 3B, dan tanggal PO. Jumlah porsi diambil dari Porsi hari ini."
          onClose={() => setIsMenuModalOpen(false)}
          onSubmit={handleSaveMenuForm}
          submitLabel={editingMenuOrderId ? "Simpan perubahan" : "Simpan menu"}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="menu-date" className={FIELD_LABEL}>Tanggal menu <span className="text-rose-600">*</span></label>
              <input
                id="menu-date"
                type="date"
                required
                value={menuFormDate}
                onChange={(e) => {
                  const newD = e.target.value;
                  setMenuFormDate(newD);
                  const d = parseMenuDate(newD) || new Date();
                  d.setDate(d.getDate() - 1);
                  setMenuFormPoDate(localDateIso(d));
                }}
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <label htmlFor="menu-po-date" className={FIELD_LABEL}>Tanggal PO</label>
              <input
                id="menu-po-date"
                type={/^\d{4}-\d{2}-\d{2}$/.test(menuFormPoDate) || !menuFormPoDate ? "date" : "text"}
                value={menuFormPoDate}
                onChange={(e) => setMenuFormPoDate(e.target.value)}
                className={FIELD_INPUT}
              />
              <p className="mt-0.5 text-[11px] text-slate-500">Otomatis H-1 dari tanggal menu.</p>
            </div>
          </div>

          {/* Porsi tidak diketik di sini: sumbernya Porsi hari ini (rekap per sekolah) */}
          <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] text-slate-600">Jumlah porsi</div>
              <div className="text-base font-bold text-slate-900 tabular-nums">
                {menuFormPortionInfo.total.toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-600">porsi</span>
              </div>
              <div className={`text-[11px] ${menuFormPortionInfo.source === "RECAP" ? "text-slate-600" : "text-amber-800"}`}>
                {menuFormPortionInfo.note}
              </div>
            </div>
            <button type="button" onClick={handleGoToDailyPortions} className={`${BTN_SECONDARY} shrink-0`}>
              Atur per sekolah
            </button>
          </div>

          <div>
            <label htmlFor="menu-title" className={FIELD_LABEL}>Menu reguler <span className="text-rose-600">*</span></label>
            <textarea
              id="menu-title"
              required
              rows={2}
              placeholder="Nasi putih, rolade ayam asam manis, tahu cabe garam, tumis pokcoy wortel, semangka"
              value={menuFormTitle}
              onChange={(e) => setMenuFormTitle(e.target.value)}
              className={`${FIELD_INPUT} py-2 leading-relaxed`}
            />
            <p className="mt-0.5 text-[11px] text-slate-500">Pisahkan tiap lauk dengan koma.</p>
          </div>

          <div>
            <label htmlFor="menu-b3" className={FIELD_LABEL}>Menu khusus 3B (balita, busui, bumil)</label>
            <textarea
              id="menu-b3"
              rows={2}
              placeholder="Kosongkan bila sama dengan menu reguler"
              value={menuFormDietB3}
              onChange={(e) => setMenuFormDietB3(e.target.value)}
              className={`${FIELD_INPUT} py-2 leading-relaxed`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="menu-chef" className={FIELD_LABEL}>Penanggung jawab masak</label>
              <input id="menu-chef" type="text" value={menuFormChef} onChange={(e) => setMenuFormChef(e.target.value)} className={FIELD_INPUT} />
            </div>
            <div>
              <label htmlFor="menu-notes" className={FIELD_LABEL}>Catatan</label>
              <input
                id="menu-notes"
                type="text"
                placeholder="Shift masak, catatan distribusi, dll."
                value={menuFormNotes}
                onChange={(e) => setMenuFormNotes(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
          </div>
        </FormDialog>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: INPUT & BUAT PO HARI INI                                         */}
      {/* ========================================================================= */}
      {isPoModalOpen && (
        <DialogShell
          size="xl"
          title="PO bahan"
          description="Daftar bahan yang dipesan ke supplier H-1 untuk menu terpilih."
          onClose={() => setIsPoModalOpen(false)}
          onSubmit={handleSavePoForm}
          footer={
            <>
              {/* Batalkan PO dipisah ke kiri: aksi merusak, jauh dari tombol terbitkan */}
              {selectedPoOrderId && (
                <button
                  type="button"
                  onClick={() => handleDeletePoForOrder(selectedPoOrderId)}
                  className={`${BTN_SECONDARY} border-transparent bg-transparent hover:bg-rose-50 text-rose-700 mr-auto`}
                  title="Batalkan dan hapus PO resmi untuk menu ini">
                  <Trash2 className="w-4 h-4" />
                  Batalkan PO
                </button>
              )}
              <button type="button" onClick={() => setIsPoModalOpen(false)} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
                Batal
              </button>
              <button type="submit" className={BTN_SECONDARY} title="Simpan daftar bahan tanpa menerbitkan PO ke supplier">
                Simpan draf
              </button>
              <button
                type="button"
                onClick={handleSaveAndGenerateOfficialPo}
                className={BTN_PRIMARY}
                title="Terbitkan PO resmi per supplier, muncul di Barang Masuk">
                Terbitkan PO
              </button>
            </>
          }>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className={FIELD_LABEL}>Menu</label>
                    <SearchPicker
                      value={selectedPoOrderId}
                      options={orders.map((ord) => ({ value: ord.id, label: ord.menuTitle, hint: `${ord.date} · ${ord.targetPortions} porsi` }))}
                      searchPlaceholder="Cari menu atau tanggal..."
                      ariaLabel="Menu tujuan untuk PO"
                      noun="menu"
                      onSelect={(opt) => {
                        if (!opt) return;
                        const newId = opt.value;
                        setSelectedPoOrderId(newId);
                        const found = orders.find((o) => o.id === newId);
                        if (found && found.poArrivalItems && found.poArrivalItems.length > 0) {
                          setPoFormRows(
                            withSuggestedSuppliers(found.poArrivalItems.map((p) => ({
                              category: p.category || "Bahan Makanan",
                              itemName: p.itemName,
                              qtyOrder: p.qtyOrder || "",
                              qtyArrived: p.qtyArrived || "",
                              supplier: p.supplier || "",
                              arrivalTime: p.arrivalTime || "",
                              pic: p.pic || currentUser.name,
                              notes: p.notes || "",
                            }))),
                          );
                        }
                      }}
                    />
                  </div>

                  <div>
                    <label htmlFor="po-date" className={FIELD_LABEL}>Tanggal PO</label>
                    <input
                      id="po-date"
                      type={/^\d{4}-\d{2}-\d{2}$/.test(poFormDate) || !poFormDate ? "date" : "text"}
                      value={poFormDate}
                      onChange={(e) => setPoFormDate(e.target.value)}
                      className={FIELD_INPUT}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Bahan per supplier</h3>
                    <p className="text-[11px] text-slate-600">Satu kelompok supplier jadi satu PO. Supplier di luar daftar bisa diketik langsung.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyPoTemplate}
                    className={`${BTN_SECONDARY} self-start sm:self-auto`}
                    title="Isi daftar dengan bahan standar SPPG: ayam, beras, tahu, sayur, buah">
                    Pakai daftar bahan standar
                  </button>
                </div>

                {poFormRows.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center">
                    <p className="text-sm text-slate-700">Belum ada bahan.</p>
                    <p className="mt-1 text-[11px] text-slate-600">Pilih supplier di bawah, lalu isi bahan yang dikirimnya.</p>
                  </div>
                )}

                {(() => {
                  const renderPoRow = ({row, idx}: IndexedPoRow, withSupplier: boolean) => {
                    const isDup = duplicatePoRowIdx.has(idx);
                    return (
                      <li
                        key={idx}
                        className={`grid gap-2 px-3 py-2 items-start grid-cols-[1fr_1fr_2.75rem] ${
                          withSupplier ? "sm:grid-cols-[9rem_1fr_7rem_12rem_2.25rem]" : "sm:grid-cols-[9rem_1fr_7rem_2.25rem]"
                        }`}>
                        <Select
                          className="w-full"
                          size="sm"
                          aria-label={`Kategori ${row.itemName || `baris ${idx + 1}`}`}
                          value={row.category}
                          onChange={(e) => updatePoRow(idx, {category: e.target.value})}>
                          <option value="Protein">Protein</option>
                          <option value="Sembako">Sembako</option>
                          <option value="Sayur dan Buah">Sayur dan Buah</option>
                          <option value="Sayur">Sayur</option>
                          <option value="Buah">Buah</option>
                          <option value="Bumbu">Bumbu</option>
                          <option value="Bahan Olahan">Bahan Olahan</option>
                          <option value="Lain-lain">Lain-lain</option>
                        </Select>
                        <div className="col-span-3 sm:col-span-1 order-first sm:order-none">
                          <input
                            type="text"
                            required
                            autoFocus={idx === poFocusRow}
                            onFocus={() => idx === poFocusRow && setPoFocusRow(null)}
                            placeholder="Misal: Ayam Potong / Telur Ayam"
                            value={row.itemName}
                            onChange={(e) => updatePoRow(idx, {itemName: e.target.value})}
                            aria-label={`Nama bahan baris ${idx + 1}`}
                            aria-invalid={isDup || undefined}
                            className={isDup ? TABLE_INPUT.replace("border-slate-300", "border-rose-500") : TABLE_INPUT}
                          />
                          {isDup && <p className="mt-1 text-[11px] text-rose-700">Sudah ada di supplier ini. Gabungkan jumlahnya.</p>}
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="Mis. 26 kg"
                          value={row.qtyOrder}
                          onChange={(e) => updatePoRow(idx, {qtyOrder: e.target.value})}
                          aria-label={`Jumlah ${row.itemName || `baris ${idx + 1}`}`}
                          className={`${TABLE_INPUT} font-mono`}
                        />
                        {withSupplier && (
                          <div className="col-span-3 sm:col-span-1 order-last sm:order-none">
                            <SearchPicker
                              size="sm"
                              allowCustom
                              noun="supplier"
                              value=""
                              options={supplierOptions}
                              placeholder="Pilih supplier"
                              searchPlaceholder="Cari atau ketik supplier baru..."
                              ariaLabel={`Supplier untuk ${row.itemName || `baris ${idx + 1}`}`}
                              onSelect={(opt, text) => updatePoRow(idx, {supplier: opt ? opt.value : text})}
                            />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removePoRow(idx)}
                          aria-label={`Hapus ${row.itemName || `baris ${idx + 1}`}`}
                          title="Hapus bahan"
                          className={`inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[30px] sm:min-h-[30px] rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer ${FOCUS_RING}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  };

                  let poNo = 0;
                  return (
                    <div className="space-y-3">
                      {poGroups.assigned.map((group) => {
                        const filled = group.rows.filter(({row}) => row.itemName.trim()).length;
                        if (filled > 0) poNo += 1;
                        const isNew = !findMasterSupplier(group.supplier);
                        return (
                          <section key={group.key} aria-label={`Bahan dari ${group.supplier}`} className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 bg-slate-50 border-b border-slate-200">
                              <div className="w-full sm:w-64">
                                <SearchPicker
                                  size="sm"
                                  allowCustom
                                  noun="supplier"
                                  value={group.supplier}
                                  options={supplierOptions}
                                  searchPlaceholder="Cari atau ketik supplier baru..."
                                  ariaLabel={`Ganti supplier ${group.supplier}`}
                                  onSelect={(opt, text) => renamePoGroup(group.key, opt ? opt.value : text)}
                                />
                              </div>
                              <span className="text-[11px] text-slate-600">
                                {filled > 0 ? `${filled} bahan · PO ${poNo}` : "Belum ada bahan"}
                              </span>
                              {isNew && <span className="text-[11px] text-amber-800">Supplier baru, masuk daftar saat PO terbit</span>}
                              <button
                                type="button"
                                onClick={() => removePoGroup(group)}
                                aria-label={`Hapus semua bahan dari ${group.supplier}`}
                                title="Hapus kelompok supplier"
                                className={`ml-auto inline-flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-[30px] sm:min-h-[30px] rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer ${FOCUS_RING}`}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="hidden sm:grid grid-cols-[9rem_1fr_7rem_2.25rem] gap-2 px-3 pt-2 text-[11px] font-semibold text-slate-600" aria-hidden="true">
                              <span>Kategori</span>
                              <span>Nama bahan</span>
                              <span>Jumlah</span>
                            </div>
                            <ul className="divide-y divide-slate-100">{group.rows.map((r) => renderPoRow(r, false))}</ul>
                            <div className="px-3 py-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => addPoRow(group.supplier)}
                                aria-label={`Tambah bahan dari ${group.supplier}`}
                                className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
                                <Plus className="w-4 h-4 text-slate-500" />
                                Tambah bahan
                              </button>
                            </div>
                          </section>
                        );
                      })}

                      {poGroups.unassigned.length > 0 && (
                        <section aria-label="Bahan tanpa supplier" className="border border-amber-300 rounded-xl overflow-hidden">
                          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
                            <h4 className="text-xs font-semibold text-amber-900">Belum ada supplier ({poGroups.unassigned.length})</h4>
                            <p className="text-[11px] text-amber-900">Pilih supplier tiap bahan. Bahan pindah ke kelompok supplier itu.</p>
                          </div>
                          <div className="hidden sm:grid grid-cols-[9rem_1fr_7rem_12rem_2.25rem] gap-2 px-3 pt-2 text-[11px] font-semibold text-slate-600" aria-hidden="true">
                            <span>Kategori</span>
                            <span>Nama bahan</span>
                            <span>Jumlah</span>
                            <span>Supplier</span>
                          </div>
                          <ul className="divide-y divide-slate-100">{poGroups.unassigned.map((r) => renderPoRow(r, true))}</ul>
                        </section>
                      )}
                    </div>
                  );
                })()}

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">{poGroups.assigned.length > 0 ? "Supplier lain" : "Supplier"}</span>
                  <div className="w-full sm:w-72">
                    <SearchPicker
                      size="sm"
                      allowCustom
                      noun="supplier"
                      value=""
                      options={supplierOptions}
                      placeholder="Pilih atau ketik supplier..."
                      searchPlaceholder="Cari atau ketik supplier baru..."
                      ariaLabel="Tambah kelompok supplier"
                      onSelect={(opt, text) => addPoRow(opt ? opt.value : text)}
                    />
                  </div>
                </div>
        </DialogShell>
      )}
      {/* ========================================================================= */}
      {/* MODAL 3: INPUT & EDIT DATA PENERIMA MANFAAT                                */}
      {/* ========================================================================= */}
      {isBeneficiaryModalOpen && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-slate-900/60 flex items-end sm:items-center justify-center sm:p-4">
          <div className="bg-white rounded-t-xl sm:rounded-xl border border-slate-200 sm:max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">{editingBeneficiary ? "Ubah data sekolah" : "Tambah sekolah"}</h2>
                <p className="text-[11px] text-slate-600 mt-0.5">Atur nama sekolah/lembaga, kuota jumlah porsi, serta kontak penanggung jawab (PIC)</p>
              </div>
              <button
                type="button"
                onClick={() => setIsBeneficiaryModalOpen(false)}
                aria-label="Tutup"
                className={`p-2 -m-1 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer ${FOCUS_RING}`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBeneficiary} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Sekolah / Lembaga <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={beneficiaryFormName}
                      onChange={(e) => setBeneficiaryFormName(e.target.value)}
                      placeholder="Contoh: SDN 1 Jeru atau Posyandu Dahlia"
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">ID Lembaga</label>
                    <input
                      type="text"
                      value={beneficiaryFormId}
                      onChange={(e) => setBeneficiaryFormId(e.target.value)}
                      readOnly={Boolean(editingBeneficiary)}
                      placeholder="SCH-001"
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 bg-slate-50 font-mono read-only:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    {editingBeneficiary && <p className="text-[11px] text-slate-600 mt-1">ID tidak bisa diubah.</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Kategori Sasaran <span className="text-rose-500">*</span>
                    </label>
                    <Select className="w-full"
                      value={beneficiaryFormCategory}
                      onChange={(e) => setBeneficiaryFormCategory(e.target.value)}>
                      <option value="SD / MI">Sekolah Dasar (SD / MI)</option>
                      <option value="SMP / MTs">Sekolah Menengah (SMP / MTs)</option>
                      <option value="PAUD / TK">PAUD / TK</option>
                      <option value="Ibu Hamil & Balita (B3)">Balita 3T & Ibu Hamil (B3)</option>
                      <option value="Lembaga Sasaran Lainnya">Lembaga Sasaran Lainnya</option>
                    </Select>
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
                        onChange={(e) => setBeneficiaryFormPortions(Number(e.target.value) || 0)}
                        className="w-full text-xs border border-slate-300 rounded-lg pl-3 pr-14 py-2 font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium">porsi</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Kontak PIC / Penanggung Jawab</label>
                    <input
                      type="text"
                      value={beneficiaryFormContactPerson}
                      onChange={(e) => setBeneficiaryFormContactPerson(e.target.value)}
                      placeholder="Contoh: Pak Hadi (Kepala Sekolah)"
                      className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Kontak / WhatsApp PIC</label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={beneficiaryFormPhone}
                        onChange={(e) => setBeneficiaryFormPhone(e.target.value)}
                        placeholder="Contoh: 0812-3344-5501"
                        className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-2 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Jadwal / Waktu Kirim</label>
                    <div className="relative">
                      <Clock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={beneficiaryFormDeliveryTime}
                        onChange={(e) => setBeneficiaryFormDeliveryTime(e.target.value)}
                        placeholder="Contoh: 09.45 WIB atau 10:00 - 10:30"
                        className="w-full text-xs border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Status Operasional Distribusi</label>
                    <Select className="w-full"
                      value={beneficiaryFormStatus}
                      onChange={(e) => setBeneficiaryFormStatus(e.target.value as any)}>
                      <option value="DIJADWALKAN">Dijadwalkan</option>
                      <option value="SIAP_KIRIM">Siap Kirim di Dapur</option>
                      <option value="DALAM_PERJALANAN">Dalam Perjalanan Kurir</option>
                      <option value="TERKIRIM">Telah Terkirim & Diterima</option>
                    </Select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Titik Serah & Catatan Jalur Distribusi</label>
                  <textarea
                    rows={2}
                    value={beneficiaryFormNotes}
                    onChange={(e) => setBeneficiaryFormNotes(e.target.value)}
                    placeholder="Contoh: Jalur Distribusi 1 - Area Jeru Timur, serah terima di ruang guru piket"
                    className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Action Buttons Sticky Footer */}
              <div className="px-4 sm:px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsBeneficiaryModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer">
                  Batal
                </button>
                <button
                  type="submit"
                  className={`${BTN_PRIMARY} flex-1 sm:flex-none`}>
                  <Check className="w-4 h-4" />
                  <span>{editingBeneficiary ? "Simpan Perubahan" : "Simpan Penerima Manfaat"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PRATINJAU CETAK REKAPITULASI HARIAN PENERIMA MANFAAT              */}
      {/* ========================================================================= */}
      {isBeneficiaryPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-2 sm:p-4 overflow-y-auto no-print">
          <div className="bg-white rounded-xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Cetak Rekapitulasi Alokasi Porsi Harian Sekolah</h2>
                <p className="text-[11px] text-slate-600 mt-0.5">Format resmi siap cetak / simpan PDF standar Satuan Pelayanan Pemenuhan Gizi</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer">
                  <Printer className="w-4 h-4 text-slate-200" />
                  <span>Cetak / Print PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBeneficiaryPrintModalOpen(false)}
                  className="p-1.5 text-slate-500 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                  title="Tutup dialog">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Paper Preview */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-100">
              <div id="print-beneficiary-paper" className="bg-white p-6 sm:p-8 rounded-xl shadow-xs border border-slate-200 max-w-4xl mx-auto text-slate-900">
                {/* Kop Surat Resmi */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-4">
                  <div className="flex items-center gap-3">
                    <SppgLogo size="md" variant="color" showText={false} />
                    <div>
                      <div className="text-sm font-bold tracking-tight text-slate-900 leading-tight">SATUAN PELAYANAN PEMENUHAN GIZI (SPPG MLG TUMPANG JERU)</div>
                      <div className="text-[11px] font-semibold text-slate-700">BADAN GIZI NASIONAL (BGN) REPUBLIK INDONESIA</div>
                      <div className="text-[10px] text-slate-500">{SPPG_ADDRESS}</div>
                    </div>
                  </div>
                  <div className="text-right text-[10px] font-mono text-slate-500">
                    <div>Dokumen Resmi Distribusi</div>
                    <div>Dicetak: {formatIndonesianDate(todayStr)}</div>
                  </div>
                </div>

                <div className="text-center my-3">
                  <h3 className="text-sm font-bold text-slate-900">Rekapitulasi Alokasi Distribusi Porsi Harian Sekolah & Penerima Manfaat</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Periode: {dailyBeneficiaryMatrix.dates[0] ? formatIndonesianDate(dailyBeneficiaryMatrix.dates[0]) : "-"} s/d{" "}
                    {dailyBeneficiaryMatrix.dates[dailyBeneficiaryMatrix.dates.length - 1]
                      ? formatIndonesianDate(dailyBeneficiaryMatrix.dates[dailyBeneficiaryMatrix.dates.length - 1])
                      : "-"}
                  </p>
                </div>

                {/* Printable Matrix Table */}
                <table className="w-full text-left text-[11px] border-collapse border border-slate-900 mt-4">
                  <thead>
                    <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900">
                      <th className="py-1.5 px-2 border border-slate-900 w-8 text-center">No</th>
                      <th className="py-1.5 px-2.5 border border-slate-900">Nama Sekolah / Lembaga</th>
                      <th className="py-1.5 px-2 border border-slate-900 w-20">Kategori</th>
                      {dailyBeneficiaryMatrix.dates.map((d) => (
                        <th key={d} className="py-1.5 px-1.5 border border-slate-900 text-center font-mono text-[10px]">
                          {formatShortDate(d)}
                        </th>
                      ))}
                      <th className="py-1.5 px-2 border border-slate-900 text-right w-24">Total Porsi</th>
                      <th className="py-1.5 px-2 border border-slate-900 text-right w-20">Rata-rata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBeneficiaryMatrix.rows.map((row, idx) => (
                      <tr key={row.schoolId} className="border-b border-slate-900/40">
                        <td className="py-1 px-2 border border-slate-900/60 text-center font-mono">{idx + 1}</td>
                        <td className="py-1 px-2.5 border border-slate-900/60 font-semibold">{row.schoolName}</td>
                        <td className="py-1 px-2 border border-slate-900/60 text-[10px]">{row.category}</td>
                        {dailyBeneficiaryMatrix.dates.map((d) => (
                          <td key={d} className="py-1 px-1.5 border border-slate-900/60 text-center font-mono">
                            {row.datePortions[d] ? row.datePortions[d].toLocaleString("id-ID") : "-"}
                          </td>
                        ))}
                        <td className="py-1 px-2 border border-slate-900/60 text-right font-mono font-bold">{row.totalPeriod.toLocaleString("id-ID")}</td>
                        <td className="py-1 px-2 border border-slate-900/60 text-right font-mono">{Math.round(row.avgDaily).toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-900">
                      <td colSpan={3} className="py-2 px-2 border border-slate-900 text-right text-[10px]">
                        Total Porsi Harian:
                      </td>
                      {dailyBeneficiaryMatrix.dates.map((d) => (
                        <td key={d} className="py-2 px-1.5 border border-slate-900 text-center font-mono font-bold text-[10px]">
                          {(dailyBeneficiaryMatrix.dateTotals[d] || 0).toLocaleString("id-ID")}
                        </td>
                      ))}
                      <td className="py-2 px-2 border border-slate-900 text-right font-mono font-bold text-xs">{dailyBeneficiaryMatrix.grandTotal.toLocaleString("id-ID")}</td>
                      <td className="py-2 px-2 border border-slate-900 text-right font-mono font-bold text-xs">
                        {Math.round(dailyBeneficiaryMatrix.avgDailyTotal).toLocaleString("id-ID")}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Signature Block */}
                <div className="mt-8 grid grid-cols-2 text-center text-xs pt-4 border-t border-slate-200">
                  <div className="space-y-12">
                    <div>
                      <div className="text-slate-500 text-[11px]">Mengetahui & Menyetujui,</div>
                      <div className="font-semibold text-slate-800">Ahli Gizi / Kepala SPPG</div>
                    </div>
                    <div className="font-bold underline text-slate-900">( .................................................. )</div>
                  </div>

                  <div className="space-y-12">
                    <div>
                      <div className="text-slate-500 text-[11px]">Dibuat & Diverifikasi,</div>
                      <div className="font-semibold text-slate-800">Petugas Distribusi & Penerima Manfaat</div>
                    </div>
                    <div className="font-bold underline text-slate-900">( {currentUser?.name || "Petugas SPPG"} )</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {scaleTarget !== null && (
        <FormDialog
          title="Sesuaikan total porsi"
          description={`Porsi tiap sekolah tanggal ${formatIndonesianDate(beneficiarySelectedDate)} diubah sebanding dengan total baru.`}
          onClose={() => setScaleTarget(null)}
          onSubmit={handleApplyScale}
          submitLabel="Terapkan"
        >
          <div>
            <label htmlFor="scale-target" className={FIELD_LABEL}>Target total porsi</label>
            <input
              id="scale-target"
              type="number"
              min={1}
              inputMode="numeric"
              value={scaleTarget}
              onChange={(e) => setScaleTarget(e.target.value)}
              className={FIELD_INPUT}
            />
            <p className="text-[11px] text-slate-600 mt-1">Sekarang: {dailyDraftTotal.toLocaleString("id-ID")} porsi</p>
          </div>
        </FormDialog>
      )}
      {recapPasteText !== null && (
        <FormDialog
          title="Tempel rekap penerima manfaat"
          description={`Untuk ${formatIndonesianDate(beneficiarySelectedDate)}. Tempel teks rekap dari WhatsApp atau Excel; satu sekolah per baris, misalnya "SDN 1 JERU: 135".`}
          onClose={() => setRecapPasteText(null)}
          onSubmit={(e) => {
            e.preventDefault();
            handleApplyRecapPaste();
          }}
          submitLabel="Isi ke tabel"
          submitDisabled={!recapPastePreview || recapPastePreview.matched.length === 0}
        >
          <div className="space-y-3">
            <div>
              <label htmlFor="recap-paste" className={FIELD_LABEL}>Teks rekap</label>
              <textarea
                id="recap-paste"
                rows={9}
                value={recapPasteText}
                onChange={(e) => setRecapPasteText(e.target.value)}
                placeholder={"Penerima Manfaat\n- TK DWP MALANGSUKO : 70\n- SDN 1 JERU: 135\n- Balita : 143\nTOTAL: 2653"}
                className={`${FIELD_INPUT} font-mono text-[11px] leading-relaxed py-2 min-h-[160px]`}
              />
            </div>
            {recapPastePreview && (
              <div className="text-[11px] space-y-1.5">
                <p className="text-slate-700">
                  <span className="font-semibold text-slate-900">{recapPastePreview.matched.length}</span> dikenali ·{" "}
                  total{" "}
                  <span className="font-semibold text-slate-900">
                    {recapPastePreview.matched.reduce((sum, m) => sum + m.count, 0).toLocaleString("id-ID")}
                  </span>
                  {recapPastePreview.reportedTotal !== undefined && (
                    <> · TOTAL di teks {recapPastePreview.reportedTotal.toLocaleString("id-ID")}</>
                  )}
                </p>
                {recapPastePreview.reportedTotal !== undefined &&
                  recapPastePreview.reportedTotal !== recapPastePreview.matched.reduce((sum, m) => sum + m.count, 0) && (
                    <p className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-900">
                      Jumlah per sekolah tidak sama dengan TOTAL di teks. Cek sekolah yang angkanya kosong:{" "}
                      {recapPastePreview.matched.filter((m) => m.count === 0).map((m) => m.name).join(", ") || "-"}.
                    </p>
                  )}
                {recapPastePreview.unmatched.length > 0 && (
                  <p className="p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-900">
                    Tidak dikenali (tambahkan dulu di Data Sekolah atau samakan namanya):{" "}
                    {recapPastePreview.unmatched.map((m) => `${m.name} (${m.count})`).join(", ")}
                  </p>
                )}
                <p className="text-slate-600">
                  Sekolah yang angkanya kosong atau tidak ada di teks ditandai <b>Tidak kirim</b>. Status dan angka masih bisa diubah sebelum disimpan.
                </p>
              </div>
            )}
          </div>
        </FormDialog>
      )}
    </div>
  );
};
