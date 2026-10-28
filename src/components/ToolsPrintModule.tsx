import React, { useState, useMemo, useEffect } from 'react';
import { buildScanUrl, WASTE_ENTRY_CODE, NONFOOD_ISSUE_CODE } from '../utils/scanCode';
import {
  BASE_RACKS_CONFIG,
  RackConfig,
  RackListedItem,
  RackOverride,
  SETTING_CUSTOM_RACKS,
  SETTING_RACK_OVERRIDES,
  matchItemToRackId,
  dynamicRackId,
} from '../utils/warehouseRacks';
import { SearchPicker } from './common/SearchPicker';
import { Select } from './common/Select';
import { DialogShell, FormDialog, FIELD_INPUT, FIELD_LABEL, TABLE_INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_GHOST, FOCUS_RING } from './common/FormDialog';
import { KopText } from './common/KopText';
import { SopGudangDoc, SopPlace, SOP_PLACE_OPTIONS } from './print/SopGudangDoc';
import { DoDontPosterDoc, DoDontTarget, DO_DONT_OPTIONS, doDontPosterCount } from './print/DoDontPosterDoc';
import { RackSignDoc } from './print/RackSignDoc';
import { PhotoDocSheet } from './print/PhotoDocSheet';
import { PicHandoverDoc } from './print/PicHandoverDoc';
import { ExpenseReceiptDoc } from './print/ExpenseReceiptDoc';
import { DailyPoSheetDoc } from './print/DailyPoSheetDoc';
import {
  Printer,
  FileText,
  ClipboardList,
  Tags,
  UtensilsCrossed,
  Layers,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  Info,
  QrCode,
  Search,
  Package,
  Boxes,
  CheckSquare,
  Square,
  Edit3,
  X,
  RotateCcw,
  Receipt,
  CreditCard,
  Plus,
  Trash2,
  Banknote,
  Calculator,
  ArrowRight,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { warehouseDb, APP_SETTINGS_CHANGED_EVENT } from '../db/storage';
import { NUTRITION, NutritionKey, nutritionKeyOf, toKg } from './WasteLogModule';
import { useAuth } from '../context/AuthContext';
import { ReceivingDocument, ItemMaster, EquipmentItem, Supplier, normalizeItemCategory } from '../types/warehouse';
import { SppgLogo } from './SppgLogo';
import { QrSvg } from './common/QrSvg';
import { localDateIso } from '../utils/localDate';

export type FormType = 'RECEIVING_FORM' | 'OPNAME_SHEET' | 'BIN_CARD' | 'KITCHEN_REQUISITION' | 'NONFOOD_ISSUE_FORM' | 'WASTE_RECAP_FORM' | 'ITEM_TAG_LABEL' | 'EQUIPMENT_LABEL' | 'RACK_LABEL' | 'RACK_SIGN' | 'SUPPLIER_EXPENSE_NOTE' | 'SOP_STORAGE' | 'DO_DONT_POSTER' | 'PHOTO_DOC' | 'PIC_HANDOVER' | 'EXPENSE_RECEIPT_BATCH' | 'DAILY_PO_SHEET';

export interface ItemTagData {
  uniqueKey: string;
  id: string;
  /** Nomor penerimaan (GR) bila tag dibuat dari dokumen penerimaan; ikut di tautan QR. */
  receivingId?: string;
  batchLotNo: string;
  name: string;
  category: string;
  warehouseType: 'GUDANG_KERING' | 'GUDANG_BASAH';
  storageLocation: string;
  storageTemp: string;
  supplier: string;
  arrivalDate: string;
  arrivalDateFormatted: string;
  arrivalTime: string;
  expiryDate: string;
  shelfLifeText: string;
  quantity?: number;
  unit?: string;
  qcStatus: string;
  inspector: string;
  notes?: string;
  copyIndex: number;
  totalCopies: number;
}

const ROLE_LABEL: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  KA_SPPG: 'Kepala SPPG',
  ADMIN: 'Admin Gudang',
  ASLAP: 'Asisten Lapangan',
  AKUNTAN: 'Akuntan',
};

const formatLongDate = (iso: string) => {
  const [y, m, d] = (iso || '').split('-').map(Number);
  if (!y || !m || !d) return iso || '';
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
};

const FORM_TABS: { id: FormType; label: string; hint: string }[] = [
  { id: 'DAILY_PO_SHEET', label: 'Form PO Harian', hint: 'Satu lembar berisi semua bahan PO yang datang di satu tanggal (untuk menu besok), per supplier. Hasil timbang, pengantar, tanda tangan supplier dan penerima, serta bahan tambahan di luar PO diisi tangan.' },
  { id: 'RECEIVING_FORM', label: 'BA Penerimaan', hint: 'Berita acara serah terima barang dari supplier.' },
  { id: 'OPNAME_SHEET', label: 'Lembar Opname', hint: 'Lembar hitung fisik stok per lokasi.' },
  { id: 'BIN_CARD', label: 'Kartu Stok', hint: 'Kartu gantung di rak untuk mencatat keluar-masuk satu barang.' },
  { id: 'KITCHEN_REQUISITION', label: 'Bon Dapur', hint: 'Bon permintaan bahan dari dapur ke gudang, diisi tangan.' },
  { id: 'NONFOOD_ISSUE_FORM', label: 'Pengambilan Non-Food', hint: 'Log harian barang non-food yang diambil relawan dari gudang. Disalin ke Barang Keluar > Operasional.' },
  { id: 'WASTE_RECAP_FORM', label: 'Rekap Limbah', hint: 'Lembar timbang sisa makanan Senin-Jumat: 5 jenis limbah dan total per hari. Tanggal bisa tercetak otomatis atau diisi tangan.' },
  { id: 'ITEM_TAG_LABEL', label: 'Tag Bahan Datang', hint: 'Tag kecil untuk wadah: supplier, jam datang, dan batas pakai.' },
  { id: 'EQUIPMENT_LABEL', label: 'Label Barang & Aset', hint: 'Stiker berkode QR untuk barang gudang dan aset dapur.' },
  { id: 'RACK_LABEL', label: 'Plakat Rak', hint: 'Plakat rak berisi daftar barang dan aturan penyimpanan.' },
  { id: 'RACK_SIGN', label: 'Papan Nama Rak & Kategori', hint: 'Papan nama huruf besar untuk rak dan kategori barang, terbaca dari jauh. Pasang di atas rak; plakat rak tetap di samping setinggi mata.' },
  { id: 'PIC_HANDOVER', label: 'Serah Terima Insentif PIC', hint: 'Kuitansi serah terima insentif PIC sekolah, dibuat sekaligus dari file Excel daftar penerima. File tidak diunggah atau disimpan.' },
  { id: 'EXPENSE_RECEIPT_BATCH', label: 'Kuitansi Pengeluaran', hint: 'Kuitansi pengeluaran dadakan (No. .../KULBanPer/bulan/tahun), dibuat sekaligus dari file Excel kuitansi. File tidak diunggah atau disimpan.' },
  { id: 'PHOTO_DOC', label: 'Dokumentasi Foto', hint: 'Foto dokumentasi untuk laporan berkala, ditata otomatis 4 sampai 9 foto per lembar A4 dengan kop dan judul di tiap lembar. Foto tidak diunggah atau disimpan.' },
  { id: 'SUPPLIER_EXPENSE_NOTE', label: 'Nota Kas Keluar', hint: 'Bukti pembayaran ke supplier dengan tanda tangan.' },
  { id: 'SOP_STORAGE', label: 'SOP Gudang', hint: 'SOP penanganan bahan di gudang kering, non-food, chiller, freezer, sisa bahan dari dapur, area krat, serta pemakaian APD di dapur.' },
  { id: 'DO_DONT_POSTER', label: "Plakat Do & Don't", hint: "Plakat aturan Lakukan & Jangan untuk chiller, freezer, gudang kering, non-food, palet sisa, area krat, dan pintu dapur (APD), diringkas dari SOP Gudang." },
];

export type FormCategory = 'DOCUMENTS' | 'FINANCE' | 'LABELS' | 'STANDARDS';

export interface FormCategoryGroup {
  id: FormCategory;
  label: string;
  shortLabel: string;
  forms: FormType[];
}

export const FORM_CATEGORIES: FormCategoryGroup[] = [
  {
    id: 'DOCUMENTS',
    label: 'Formulir Gudang & Dapur',
    shortLabel: 'Formulir Gudang',
    forms: [
      'DAILY_PO_SHEET',
      'RECEIVING_FORM',
      'KITCHEN_REQUISITION',
      'NONFOOD_ISSUE_FORM',
      'WASTE_RECAP_FORM',
      'OPNAME_SHEET',
      'BIN_CARD',
    ],
  },
  {
    // Kuitansi PIC, kuitansi pengeluaran, dan lampiran laporan: kebanyakan dicetak massal dari file Excel atau foto
    id: 'FINANCE',
    label: 'Keuangan & Laporan',
    shortLabel: 'Keuangan & Laporan',
    forms: [
      'SUPPLIER_EXPENSE_NOTE',
      'PIC_HANDOVER',
      'EXPENSE_RECEIPT_BATCH',
      'PHOTO_DOC',
    ],
  },
  {
    id: 'LABELS',
    label: 'Label, Tag & Plakat Rak',
    shortLabel: 'Label & Tag QR',
    forms: [
      'ITEM_TAG_LABEL',
      'EQUIPMENT_LABEL',
      'RACK_LABEL',
      'RACK_SIGN',
    ],
  },
  {
    id: 'STANDARDS',
    label: 'SOP & Panduan Relawan',
    shortLabel: 'SOP & Plakat',
    forms: [
      'SOP_STORAGE',
      'DO_DONT_POSTER',
    ],
  },
];

const FORMS_WITH_OWN_SETTINGS: FormType[] = ['RACK_SIGN', 'PIC_HANDOVER', 'EXPENSE_RECEIPT_BATCH', 'PHOTO_DOC', 'DAILY_PO_SHEET'];

export const getCategoryForForm = (formId: FormType): FormCategory => {
  const cat = FORM_CATEGORIES.find(c => c.forms.includes(formId));
  return cat ? cat.id : 'DOCUMENTS';
};


const INPUT_CLS =
  'w-full px-2.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';
const LABEL_CLS = 'block text-slate-700 font-medium mb-1';

const EXPENSE_STATUS_LABEL: Record<'LUNAS' | 'DP' | 'TEMPO' | 'PENDING', string> = {
  LUNAS: 'Lunas',
  DP: 'Uang muka (DP)',
  TEMPO: 'Tempo',
  PENDING: 'Menunggu verifikasi',
};

const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

// Garis kosong untuk isian tulis tangan saat data belum ada.
const BLANK = '....................................';

const DocTitle: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div className="text-center">
    <h2 className="text-sm font-bold text-slate-900">{title}</h2>
    {subtitle && <p className="text-xs text-slate-700 mt-0.5">{subtitle}</p>}
  </div>
);

// Baris "label: nilai". Nilai kosong dicetak sebagai titik-titik untuk diisi tangan.
const Field: React.FC<{ label: string; value?: string; blank?: string; mono?: boolean; strong?: boolean }> = ({
  label,
  value,
  blank = BLANK,
  mono,
  strong,
}) => (
  <div className="flex gap-2">
    <span className="text-slate-600 w-28 shrink-0">{label}</span>
    <span className={`text-slate-900 ${mono ? 'font-mono' : ''} ${strong ? 'font-bold' : 'font-medium'}`}>
      {value ? value : <span className="text-slate-400">{blank}</span>}
    </span>
  </div>
);

const SignBox: React.FC<{ role: string; name?: string; signature?: string }> = ({ role, name, signature }) => (
  <div className="text-center text-xs">
    <p className="text-slate-700">{role}</p>
    <div className="h-16 flex items-center justify-center">
      {signature?.startsWith('data:image') && <img src={signature} alt={`Tanda tangan ${role}`} className="max-h-14 object-contain" />}
    </div>
    <div className="border-t border-slate-500 mx-auto w-40 pt-1 font-semibold text-slate-900">
      {name || <span className="text-slate-400 font-normal">( {BLANK} )</span>}
    </div>
  </div>
);

// Baris status pilihan cetak untuk label, tag, dan plakat. Hanya tampil di layar.
const SelectionBar: React.FC<{
  selected: number;
  total: number;
  unit: string;
  allSelected: boolean;
  onToggleAll: () => void;
  children?: React.ReactNode;
}> = ({ selected, total, unit, allSelected, onToggleAll, children }) => (
  <div className="no-print flex flex-wrap items-center justify-between gap-2 text-xs">
    <span className="text-slate-700">
      <span className="font-semibold text-slate-900">{selected}</span> dari {total} {unit} akan dicetak. Hapus centang untuk melewati.
    </span>
    <div className="flex items-center gap-2">
      {children}
      <button
        type="button"
        onClick={onToggleAll}
        disabled={total === 0}
        className="px-3 min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
      >
        {allSelected ? 'Batal pilih semua' : 'Pilih semua'}
      </button>
    </div>
  </div>
);

interface PrintableLabelItem {
  id: string;
  name: string;
  warehouseType: 'GUDANG_KERING' | 'GUDANG_BASAH' | 'EQUIPMENT';
  warehouseName: string;
  category: string;
  subcategory?: string;
  location: string;
  unit?: string;
  instruction: string;
  badgeText: string;
  isEquipment?: boolean;
  supplier: string;
  shelfLifeText: string;
  shelfLifeDays: number;
  expiryDate: string;
  customNote?: string;
  arrivalDateFormatted: string;
  extraMeta?: string;
}

export type RackItemDetail = RackListedItem;

/** Isian manual satu label barang/aset; field kosong mengikuti pengaturan umum label. */
interface LabelOverride {
  supplierName?: string;
  shelfLifeText?: string;
  expiryDate?: string;
  customNote?: string;
  arrivalDate?: string;
}
const SETTING_LABEL_OVERRIDES = 'print_label_overrides';

export interface WarehouseRack extends RackConfig {
  isCustom?: boolean;
  items: RackItemDetail[];
}



// --- NOTA PENGELUARAN SUPPLIER / BUKTI KAS KELUAR (BKK) TYPES & HELPERS ---
export interface SupplierExpenseLine {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
}

/**
 * Konversi angka rupiah ke kalimat terbilang resmi Bahasa Indonesia
 */
export function angkaTerbilang(angka: number): string {
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima',
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];

  function toWords(n: number): string {
    const num = Math.floor(Math.abs(n));
    if (num < 12) {
      return bilangan[num];
    } else if (num < 20) {
      return toWords(num - 10) + ' Belas';
    } else if (num < 100) {
      const sisa = num % 10;
      return toWords(Math.floor(num / 10)) + ' Puluh' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 200) {
      const sisa = num - 100;
      return 'Seratus' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 1000) {
      const sisa = num % 100;
      return toWords(Math.floor(num / 100)) + ' Ratus' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 2000) {
      const sisa = num - 1000;
      return 'Seribu' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 1000000) {
      const sisa = num % 1000;
      return toWords(Math.floor(num / 1000)) + ' Ribu' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 1000000000) {
      const sisa = num % 1000000;
      return toWords(Math.floor(num / 1000000)) + ' Juta' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else if (num < 1000000000000) {
      const sisa = num % 1000000000;
      return toWords(Math.floor(num / 1000000000)) + ' Miliar' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    } else {
      const sisa = num % 1000000000000;
      return toWords(Math.floor(num / 1000000000000)) + ' Triliun' + (sisa > 0 ? ' ' + toWords(sisa) : '');
    }
  }

  if (!angka || isNaN(angka) || angka === 0) return 'Nol Rupiah';
  return `${toWords(angka).trim()} Rupiah`;
}

// =========================================================================
// UTILITY FUNCTIONS FOR TAG & LABEL CALCULATIONS (HOISTED FOR COMPONENT USE)
// =========================================================================

export const parseLocalDate = (dateStr: string): Date => {
  const parts = (dateStr || '').split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  return new Date();
};

export const formatDisplayDate = (d: Date): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export const addDaysToDate = (dateStr: string, days: number): string => {
  try {
    const base = parseLocalDate(dateStr);
    base.setDate(base.getDate() + days);
    return formatDisplayDate(base);
  } catch {
    return dateStr;
  }
};

export const getItemShelfLifeInfo = (item: ItemMaster): { durationText: string; shelfLifeDays: number } => {
  const name = (item.name || '').toLowerCase();
  const cat = (item.category || '').toLowerCase();
  const sub = (item.subcategory || '').toLowerCase();
  const loc = (item.location || '').toLowerCase();

  // Daging Unggas / Ayam
  if (name.includes('ayam') || sub.includes('unggas')) {
    if (loc.includes('freezer')) {
      return { durationText: '30 - 60 Hari (Freezer ≤ -18°C)', shelfLifeDays: 30 };
    }
    return { durationText: '1 - 2 Hari (Chiller <4°C)', shelfLifeDays: 2 };
  }
  // Daging Sapi / Ternak Lain
  if (name.includes('daging') || name.includes('sapi')) {
    if (loc.includes('freezer')) {
      return { durationText: '60 - 90 Hari (Freezer ≤ -18°C)', shelfLifeDays: 60 };
    }
    return { durationText: '2 - 3 Hari (Chiller 1-4°C)', shelfLifeDays: 2 };
  }

  // Ikan Laut & Hasil Laut Segar
  if (name.includes('ikan') || sub.includes('ikan') || name.includes('udang') || name.includes('cumi')) {
    if (loc.includes('freezer')) {
      return { durationText: '30 Hari (Freezer ≤ -18°C)', shelfLifeDays: 30 };
    }
    return { durationText: '1 Hari (Chiller 0-2°C)', shelfLifeDays: 1 };
  }

  // Telur Ayam Ras Segar
  if (name.includes('telur') || sub.includes('telur')) {
    return { durationText: '14 - 21 Hari (Suhu Sejuk)', shelfLifeDays: 14 };
  }

  // Sayuran Daun (Bayam, Kangkung, Sawi)
  if (name.includes('bayam') || name.includes('kangkung') || name.includes('sawi') || sub.includes('daun')) {
    return { durationText: '1 - 2 Hari (Chiller 2-4°C)', shelfLifeDays: 2 };
  }

  // Sayuran Umbi & Buah Sayur (Wortel, Kentang, Buncis, Tomat)
  if (name.includes('wortel') || name.includes('kentang') || name.includes('buncis') || name.includes('tomat') || sub.includes('umbi') || cat.includes('sayur')) {
    return { durationText: '5 - 7 Hari (Chiller 4-8°C)', shelfLifeDays: 7 };
  }

  // Buah Segar
  if (cat.includes('buah') || name.includes('pisang') || name.includes('jeruk') || name.includes('apel') || name.includes('melon')) {
    return { durationText: '3 - 5 Hari (Suhu Sejuk 12-16°C)', shelfLifeDays: 4 };
  }

  // Tahu / Tempe
  if (name.includes('tahu') || name.includes('tempe')) {
    return { durationText: '2 - 3 Hari (Chiller 1-4°C)', shelfLifeDays: 2 };
  }

  // Beras
  if (name.includes('beras') || sub.includes('beras')) {
    return { durationText: '3 - 6 Bulan (Suhu Ruang Kering)', shelfLifeDays: 120 };
  }

  // Minyak
  if (name.includes('minyak') || sub.includes('minyak')) {
    return { durationText: '12 Bulan (Tertutup & Sejuk)', shelfLifeDays: 365 };
  }

  // Gula Pasir
  if (name.includes('gula') || sub.includes('pemanis')) {
    return { durationText: '24 Bulan (Kering Tersegel)', shelfLifeDays: 730 };
  }

  // Tepung
  if (name.includes('tepung')) {
    return { durationText: '6 - 8 Bulan (Wadah Kedap Kering)', shelfLifeDays: 180 };
  }

  // Garam & Bumbu Kering
  if (name.includes('garam') || name.includes('bumbu') || sub.includes('bumbu')) {
    return { durationText: '12 - 24 Bulan (Kering Tersegel)', shelfLifeDays: 365 };
  }

  // Non-food / Operational
  if (cat.includes('clean') || name.includes('sabun')) {
    return { durationText: '24 Bulan (Tertutup Rapat)', shelfLifeDays: 730 };
  }
  if (cat.includes('pack') || cat.includes('hygiene') || cat.includes('operational')) {
    return { durationText: '36 Bulan / Kering Higienis', shelfLifeDays: 1095 };
  }

  // Default fallback
  if (loc.includes('chiller') || loc.includes('basah')) {
    return { durationText: '2 - 3 Hari (Chiller)', shelfLifeDays: 3 };
  }
  if (loc.includes('freezer')) {
    return { durationText: '30 - 60 Hari (Freezer)', shelfLifeDays: 30 };
  }
  return { durationText: '6 - 12 Bulan (Suhu Ruang)', shelfLifeDays: 180 };
};

export const isWetItem = (item: ItemMaster): boolean => {
  const norm = normalizeItemCategory(item.category);
  if (norm === 'Bahan Basah') return true;
  const loc = (item.location || '').toLowerCase();
  if (
    loc.includes('chiller') ||
    loc.includes('freezer') ||
    loc.includes('basah') ||
    loc.includes('segar') ||
    loc.includes('sayur') ||
    loc.includes('buah')
  ) {
    return true;
  }
  const cat = (item.category || '').toLowerCase();
  if (
    cat.includes('protein') ||
    cat.includes('sayur') ||
    cat.includes('buah') ||
    cat.includes('ayam') ||
    cat.includes('daging') ||
    cat.includes('ikan') ||
    cat.includes('telur')
  ) {
    return true;
  }
  return false;
};

export interface PrintTarget {
  form: FormType;
  supplierId?: string;
  labelSearch?: string;
  /** BA Penerimaan langsung untuk dokumen ini (dari detail penerimaan). */
  receivingId?: string;
  /** Tanggal untuk Form PO Harian (dari Perencanaan Menu). */
  date?: string;
}

export interface ToolsPrintModuleProps {
  initialForm?: FormType;
  initialSupplierId?: string;
  initialLabelSearch?: string;
  initialReceivingId?: string;
  initialDate?: string;
}

export const ToolsPrintModule: React.FC<ToolsPrintModuleProps> = ({
  initialForm,
  initialSupplierId,
  initialLabelSearch,
  initialReceivingId,
  initialDate,
}) => {
  const { currentUser } = useAuth();

  const [activeForm, setActiveForm] = useState<FormType>(
    initialSupplierId ? 'SUPPLIER_EXPENSE_NOTE' : (initialForm || 'RECEIVING_FORM')
  );
  const [printDate, setPrintDate] = useState<string>(localDateIso());
  const [sopPlace, setSopPlace] = useState<SopPlace | 'ALL'>('ALL');
  const [doDontTarget, setDoDontTarget] = useState<DoDontTarget>('ALL');
  const [signCount, setSignCount] = useState(0);
  const [photoPageCount, setPhotoPageCount] = useState(0);
  const [picReceiptCount, setPicReceiptCount] = useState(0);
  const [expenseReceiptCount, setExpenseReceiptCount] = useState(0);
  const [poSheetCount, setPoSheetCount] = useState(0);
  const [wasteMonth, setWasteMonth] = useState<string>(() => localDateIso().slice(0, 7));
  const [wasteDateMode, setWasteDateMode] = useState<'AUTO' | 'BLANK'>('AUTO');
  const [wasteBlankDays, setWasteBlankDays] = useState(10);
  const [wasteFillRecorded, setWasteFillRecorded] = useState(false);
  const [activeCategory, setActiveCategory] = useState<FormCategory>(() =>
    getCategoryForForm(initialSupplierId ? 'SUPPLIER_EXPENSE_NOTE' : (initialForm || 'RECEIVING_FORM'))
  );

  // Jika activeForm diubah dari luar, pastikan activeCategory tetap sinkron
  useEffect(() => {
    setActiveCategory(getCategoryForForm(activeForm));
  }, [activeForm]);

  const handleSelectCategory = (catId: FormCategory) => {
    setActiveCategory(catId);
    const cat = FORM_CATEGORIES.find(c => c.id === catId);
    if (cat && !cat.forms.includes(activeForm)) {
      setActiveForm(cat.forms[0]);
    }
  };

  const currentCategoryGroup = FORM_CATEGORIES.find(c => c.id === activeCategory) || FORM_CATEGORIES[0];
  const currentCategoryForms = FORM_TABS.filter(t => currentCategoryGroup.forms.includes(t.id));

  // Data sources
  const [receivingDocs, setReceivingDocs] = useState<ReceivingDocument[]>(() => warehouseDb.getReceivings());
  const [items, setItems] = useState<ItemMaster[]>(() => warehouseDb.getItems());
  const nonFoodItems = useMemo(
    () => items.filter(i => i.isActive && i.itemType === 'OPERATIONAL_CONSUMABLE').sort((a, b) => a.name.localeCompare(b.name)),
    [items]
  );
  const equipment = useMemo(() => warehouseDb.getEquipment(), []);
  const suppliers = useMemo(() => warehouseDb.getSuppliers(), []);
  const users = useMemo(() => warehouseDb.getUsers(), []);
  const headOfficeName = users.find(u => u.role === 'KA_SPPG')?.name || '';
  const accountantName = users.find(u => u.role === 'AKUNTAN')?.name || '';

  // Supplier terakhir per barang, diambil dari dokumen penerimaan (bukan tebakan).
  const lastSupplierByItem = useMemo(() => {
    const map: Record<string, string> = {};
    [...receivingDocs]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach(doc => doc.lines.forEach(l => { map[l.itemId] = doc.supplierName; }));
    return map;
  }, [receivingDocs]);

  // Sync data sources automatically when storage changes or window receives focus
  useEffect(() => {
    const handleSync = () => {
      setItems(warehouseDb.getItems());
      setReceivingDocs(warehouseDb.getReceivings());
    };
    window.addEventListener('sppg_storage_items_changed', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('sppg_storage_items_changed', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  // Form-specific states
  const [selectedReceivingId, setSelectedReceivingId] = useState<string>(
    initialReceivingId && receivingDocs.some(d => d.id === initialReceivingId) ? initialReceivingId : receivingDocs[0]?.id || 'BLANK'
  );
  const [opnameLocation, setOpnameLocation] = useState<string>('ALL');
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [menuToday, setMenuToday] = useState<string>('');
  const [targetPortions, setTargetPortions] = useState<number>(0);
  const [kitchenPic, setKitchenPic] = useState<string>('');

  // Supplier Expense Note States
  const [expenseSupplierId, setExpenseSupplierId] = useState<string>(
    initialSupplierId || suppliers[0]?.id || ''
  );
  const [expenseInvoiceNo, setExpenseInvoiceNo] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `BKK/SPPG-JT/${yyyy}/${mm}/001`;
  });
  const [expenseDate, setExpenseDate] = useState<string>(localDateIso());
  // Data rekening supplier belum tersimpan di sistem, jadi diisi petugas saat membuat nota.
  const [expenseBankName, setExpenseBankName] = useState<string>('');
  const [expenseBankAccount, setExpenseBankAccount] = useState<string>('');
  const [expenseAccountHolder, setExpenseAccountHolder] = useState<string>('');
  const [expenseDeliveryRef, setExpenseDeliveryRef] = useState<string>('');
  const [expensePurpose, setExpensePurpose] = useState<string>('Pembayaran belanja bahan pangan dapur SPPG Tumpang Jeru');
  const [expenseStatus, setExpenseStatus] = useState<'LUNAS' | 'DP' | 'TEMPO' | 'PENDING'>('LUNAS');
  const [expenseDiscount, setExpenseDiscount] = useState<number>(0);
  const [expenseShippingCost, setExpenseShippingCost] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState<string>('');
  const [expensePicTreasurer, setExpensePicTreasurer] = useState<string>(accountantName);
  const [expensePicVerifier, setExpensePicVerifier] = useState<string>(currentUser?.name || '');
  const [expensePicApprover, setExpensePicApprover] = useState<string>(headOfficeName);
  const [expenseLines, setExpenseLines] = useState<SupplierExpenseLine[]>([]);

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === expenseSupplierId) || {
      id: expenseSupplierId,
      name: '',
      contactPerson: '',
      phone: '',
      address: '',
      supplyCategory: '',
      isActive: true,
    };
  }, [suppliers, expenseSupplierId]);

  const supplierReceivings = useMemo(
    () =>
      receivingDocs.filter(
        r => r.supplierId === expenseSupplierId || r.supplierName.toLowerCase() === selectedSupplier.name.toLowerCase()
      ),
    [receivingDocs, expenseSupplierId, selectedSupplier.name]
  );
  const [expenseReceivingId, setExpenseReceivingId] = useState<string>('');

  // Synchronize when initialSupplierId or initialForm changes from outside (e.g. from SuppliersModule)
  useEffect(() => {
    if (initialSupplierId) {
      setActiveForm('SUPPLIER_EXPENSE_NOTE');
      handleSupplierChange(initialSupplierId);
    } else if (initialForm) {
      setActiveForm(initialForm);
    }
  }, [initialSupplierId, initialForm]);

  const handleSupplierChange = (supId: string) => {
    setExpenseSupplierId(supId);
    setExpenseBankName('');
    setExpenseBankAccount('');
    setExpenseAccountHolder(suppliers.find(s => s.id === supId)?.name || '');
    setExpenseReceivingId('');
    setExpenseDeliveryRef('');
    setExpenseLines([]);
  };

  // Harga belum tercatat di dokumen penerimaan, jadi harga satuan diisi petugas.
  const handleLoadReceivingDocToExpense = (docId: string) => {
    setExpenseReceivingId(docId);
    const doc = receivingDocs.find(r => r.id === docId);
    if (!doc) return;
    setExpenseDeliveryRef(doc.deliveryNoteNo ? `${doc.deliveryNoteNo} / ${doc.id}` : doc.id);
    setExpenseLines(
      doc.lines.map((l, idx) => ({
        id: `line-${Date.now()}-${idx}`,
        name: l.itemName,
        category: l.category || '',
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: 0,
        totalPrice: 0,
        notes: l.conditionNote || '',
      }))
    );
  };

  const handleAddExpenseLine = () => {
    const newLine: SupplierExpenseLine = {
      id: `line-${Date.now()}-${Math.random().toString().slice(2, 6)}`,
      name: '',
      category: 'Bahan Pangan',
      quantity: 1,
      unit: 'Kg',
      unitPrice: 0,
      totalPrice: 0,
      notes: ''
    };
    setExpenseLines(prev => [...prev, newLine]);
  };

  const handleUpdateExpenseLine = (id: string, field: keyof SupplierExpenseLine, val: any) => {
    setExpenseLines(prev => prev.map(line => {
      if (line.id !== id) return line;
      const updated = { ...line, [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        const q = field === 'quantity' ? Number(val) || 0 : line.quantity;
        const p = field === 'unitPrice' ? Number(val) || 0 : line.unitPrice;
        updated.totalPrice = q * p;
      }
      return updated;
    }));
  };

  const handleRemoveExpenseLine = (id: string) => {
    setExpenseLines(prev => prev.filter(l => l.id !== id));
  };

  const expenseSubtotal = useMemo(() => {
    return expenseLines.reduce((acc, curr) => acc + (curr.totalPrice || (curr.quantity * curr.unitPrice)), 0);
  }, [expenseLines]);

  const expenseTotalPayable = useMemo(() => {
    return Math.max(0, expenseSubtotal - (expenseDiscount || 0) + (expenseShippingCost || 0));
  }, [expenseSubtotal, expenseDiscount, expenseShippingCost]);

  // Label & QR feature states
  const [labelWarehouseFilter, setLabelWarehouseFilter] = useState<'ALL' | 'GUDANG_KERING' | 'GUDANG_BASAH' | 'EQUIPMENT'>('ALL');
  const [labelCategoryFilter, setLabelCategoryFilter] = useState<string>('ALL');
  const [labelArrivalDate, setLabelArrivalDate] = useState<string>(localDateIso());
  const [labelGlobalSupplier, setLabelGlobalSupplier] = useState<string>('AUTO');
  const [labelGlobalShelfLife, setLabelGlobalShelfLife] = useState<string>('');
  const [labelGlobalExpiryDate, setLabelGlobalExpiryDate] = useState<string>(''); // Default kosong untuk isi manual!
  const [labelCustomNote, setLabelCustomNote] = useState<string>('');
  const [labelSearchQuery, setLabelSearchQuery] = useState<string>(initialLabelSearch || '');
  const [labelGridCols, setLabelGridCols] = useState<'2' | '3'>('2');
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [hasCustomSelection, setHasCustomSelection] = useState<boolean>(false);

  // Isian manual per label, disimpan di app_settings agar tetap ada setelah halaman dimuat ulang.
  const [labelOverrides, setLabelOverrides] = useState<Record<string, LabelOverride>>(() =>
    warehouseDb.getAppSetting<Record<string, LabelOverride>>(SETTING_LABEL_OVERRIDES, {})
  );
  useEffect(() => {
    const reload = () => setLabelOverrides(warehouseDb.getAppSetting<Record<string, LabelOverride>>(SETTING_LABEL_OVERRIDES, {}));
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
  }, []);
  const commitLabelOverrides = (next: Record<string, LabelOverride>) => {
    setLabelOverrides(next);
    warehouseDb.saveAppSetting(SETTING_LABEL_OVERRIDES, next, currentUser || undefined);
  };

  // Active label being edited in modal
  const [editingModalData, setEditingModalData] = useState<{
    id: string;
    name: string;
    supplier: string;
    shelfLifeText: string;
    expiryDate: string;
    customNote: string;
    arrivalDate: string;
  } | null>(null);

  // =========================================================================
  // ITEM TAG LABELS (TAG ITEM & BAHAN MASUK - SUPPLIER, JAM DATANG & EXPIRED)
  // =========================================================================
  const [tagSourceType, setTagSourceType] = useState<'FROM_GR' | 'FROM_ITEMS'>(receivingDocs.length > 0 ? 'FROM_GR' : 'FROM_ITEMS');
  const [tagSelectedGrId, setTagSelectedGrId] = useState<string>(receivingDocs[0]?.id || '');
  const [tagGridCols, setTagGridCols] = useState<'4' | '3' | '2'>('4');
  const [tagArrivalDate, setTagArrivalDate] = useState<string>(receivingDocs[0]?.date || localDateIso());
  const [tagArrivalTime, setTagArrivalTime] = useState<string>(receivingDocs[0]?.arrivalTime || '');
  const [tagGlobalSupplier, setTagGlobalSupplier] = useState<string>(
    receivingDocs[0]?.supplierName || ''
  );
  const [tagExpiryMode, setTagExpiryMode] = useState<'AUTO' | 'CUSTOM_DATE' | 'BLANK'>('AUTO');
  const [tagManualExpiryDate, setTagManualExpiryDate] = useState<string>('');
  const [tagCopiesPerItem, setTagCopiesPerItem] = useState<number>(1);
  const [tagWarehouseFilter, setTagWarehouseFilter] = useState<'ALL' | 'GUDANG_KERING' | 'GUDANG_BASAH'>('ALL');
  const [tagSearchQuery, setTagSearchQuery] = useState<string>('');
  const [tagSelectedKeys, setTagSelectedKeys] = useState<string[]>([]);
  const [tagHasCustomSelection, setTagHasCustomSelection] = useState<boolean>(false);
  const [tagQcStatus, setTagQcStatus] = useState<string>('Lolos QC Organoleptik & Higiene');
  const [tagInspectorName, setTagInspectorName] = useState<string>(currentUser?.name || '');

  // Deriving Item Tags List
  const allItemTags = useMemo<ItemTagData[]>(() => {
    const list: ItemTagData[] = [];

    if (tagSourceType === 'FROM_GR') {
      const doc = receivingDocs.find(d => d.id === tagSelectedGrId) || receivingDocs[0];
      if (doc) {
        const docSupplier = tagGlobalSupplier || doc.supplierName || '';
        const docDate = tagArrivalDate || doc.date;
        const docTime = tagArrivalTime || doc.arrivalTime || '';

        (doc.lines || []).forEach((line, lineIdx) => {
          const matchedItem = items.find(
            i => i.id === line.itemId || i.name.toLowerCase() === line.itemName.toLowerCase()
          );

          const wet = matchedItem ? isWetItem(matchedItem) : true;
          const locLower = (matchedItem?.location || '').toLowerCase();
          const isFreezer = locLower.includes('freezer');
          const isChiller = locLower.includes('chiller');

          const autoShelf = matchedItem
            ? getItemShelfLifeInfo(matchedItem)
            : { durationText: '2 - 3 Hari (Chiller)', shelfLifeDays: 3 };

          let expDateFormatted = '';
          if (tagExpiryMode === 'AUTO') {
            expDateFormatted = addDaysToDate(docDate, autoShelf.shelfLifeDays);
          } else if (tagExpiryMode === 'CUSTOM_DATE' && tagManualExpiryDate) {
            expDateFormatted = formatDisplayDate(parseLocalDate(tagManualExpiryDate));
          }

          const storageLoc = matchedItem?.location || (wet ? 'Chiller Dapur' : 'Gudang Utama');
          const storageTemp = isFreezer
            ? 'Freezer (≤ -18°C)'
            : isChiller || wet
            ? 'Chiller (1°C - 4°C)'
            : 'Suhu Ruang Kering (18°C - 25°C)';

          const copies = Math.max(1, tagCopiesPerItem);
          for (let c = 1; c <= copies; c++) {
            list.push({
              uniqueKey: `gr-${doc.id}-${lineIdx}-${c}`,
              id: line.itemId || `ITEM-${lineIdx + 1}`,
              receivingId: doc.id,
              batchLotNo: line.batchNumber || (line as any).batchLotNo || `LOT-${doc.id.replace('GR-', '')}-${String(lineIdx + 1).padStart(2, '0')}`,
              name: line.itemName,
              category: matchedItem?.category || (wet ? 'Bahan Basah' : 'Bahan Kering'),
              warehouseType: wet ? 'GUDANG_BASAH' : 'GUDANG_KERING',
              storageLocation: storageLoc,
              storageTemp,
              supplier: docSupplier,
              arrivalDate: docDate,
              arrivalDateFormatted: formatDisplayDate(parseLocalDate(docDate)),
              arrivalTime: docTime,
              expiryDate: expDateFormatted,
              shelfLifeText: autoShelf.durationText,
              quantity: line.quantity,
              unit: line.unit,
              qcStatus: tagQcStatus,
              inspector: tagInspectorName,
              notes: copies > 1 ? `Wadah ${c} dari ${copies}` : (line.conditionNote || (line as any).notes || ''),
              copyIndex: c,
              totalCopies: copies,
            });
          }
        });
      }
    } else {
      // FROM_ITEMS: Loop through catalog items
      items.forEach(item => {
        const wet = isWetItem(item);
        const locLower = (item.location || '').toLowerCase();
        const isFreezer = locLower.includes('freezer');
        const isChiller = locLower.includes('chiller');
        const autoShelf = getItemShelfLifeInfo(item);
        const itemSupplier = tagGlobalSupplier || lastSupplierByItem[item.id] || '';
        const arrivalFormatted = formatDisplayDate(parseLocalDate(tagArrivalDate));

        let expDateFormatted = '';
        if (tagExpiryMode === 'AUTO') {
          expDateFormatted = addDaysToDate(tagArrivalDate, autoShelf.shelfLifeDays);
        } else if (tagExpiryMode === 'CUSTOM_DATE' && tagManualExpiryDate) {
          expDateFormatted = formatDisplayDate(parseLocalDate(tagManualExpiryDate));
        }

        const storageTemp = isFreezer
          ? 'Freezer (≤ -18°C)'
          : isChiller || wet
          ? 'Chiller (1°C - 4°C)'
          : 'Suhu Ruang Kering (18°C - 25°C)';

        const copies = Math.max(1, tagCopiesPerItem);
        for (let c = 1; c <= copies; c++) {
          list.push({
            uniqueKey: `item-${item.id}-${c}`,
            id: item.id,
            batchLotNo: `LOT-${item.id}-${tagArrivalDate.replace(/-/g, '').slice(2)}`,
            name: item.name,
            category: item.category,
            warehouseType: wet ? 'GUDANG_BASAH' : 'GUDANG_KERING',
            storageLocation: item.location,
            storageTemp,
            supplier: itemSupplier,
            arrivalDate: tagArrivalDate,
            arrivalDateFormatted: arrivalFormatted,
            arrivalTime: tagArrivalTime,
            expiryDate: expDateFormatted,
            shelfLifeText: autoShelf.durationText,
            // Jumlah datang tidak diketahui dari katalog, jadi dikosongkan untuk ditulis tangan.
            quantity: undefined,
            unit: item.baseUnit,
            qcStatus: tagQcStatus,
            inspector: tagInspectorName,
            notes: copies > 1 ? `Wadah ${c} dari ${copies}` : '',
            copyIndex: c,
            totalCopies: copies,
          });
        }
      });
    }

    return list;
  }, [
    tagSourceType,
    tagSelectedGrId,
    receivingDocs,
    items,
    tagGlobalSupplier,
    tagArrivalDate,
    tagArrivalTime,
    tagExpiryMode,
    tagManualExpiryDate,
    tagCopiesPerItem,
    tagQcStatus,
    tagInspectorName,
    lastSupplierByItem,
  ]);

  // Filtered Item Tags
  const filteredItemTags = useMemo(() => {
    return allItemTags.filter(tag => {
      if (tagWarehouseFilter !== 'ALL' && tag.warehouseType !== tagWarehouseFilter) {
        return false;
      }
      if (tagSearchQuery.trim()) {
        const q = tagSearchQuery.toLowerCase();
        const mName = tag.name.toLowerCase().includes(q);
        const mId = tag.id.toLowerCase().includes(q);
        const mSup = tag.supplier.toLowerCase().includes(q);
        const mBatch = tag.batchLotNo.toLowerCase().includes(q);
        if (!mName && !mId && !mSup && !mBatch) return false;
      }
      return true;
    });
  }, [allItemTags, tagWarehouseFilter, tagSearchQuery]);

  // Final tags to print
  const itemTagsToPrint = useMemo(() => {
    if (!tagHasCustomSelection) return filteredItemTags;
    return filteredItemTags.filter(t => tagSelectedKeys.includes(t.uniqueKey));
  }, [filteredItemTags, tagHasCustomSelection, tagSelectedKeys]);

  const toggleSelectAllItemTags = () => {
    // Semua terpilih (termasuk kondisi awal tanpa pilihan khusus) -> kosongkan; selain itu pilih semua.
    if (!tagHasCustomSelection || tagSelectedKeys.length === filteredItemTags.length) {
      setTagHasCustomSelection(true);
      setTagSelectedKeys([]);
    } else {
      setTagHasCustomSelection(false);
      setTagSelectedKeys([]);
    }
  };

  const toggleSelectItemTag = (key: string) => {
    if (!tagHasCustomSelection) {
      const newKeys = filteredItemTags.map(t => t.uniqueKey).filter(k => k !== key);
      setTagHasCustomSelection(true);
      setTagSelectedKeys(newKeys);
    } else {
      if (tagSelectedKeys.includes(key)) {
        setTagSelectedKeys(tagSelectedKeys.filter(k => k !== key));
      } else {
        setTagSelectedKeys([...tagSelectedKeys, key]);
      }
    }
  };

  // Selected entities
  const selectedReceivingDoc = useMemo<ReceivingDocument | null>(() => {
    if (selectedReceivingId === 'BLANK') return null;
    return receivingDocs.find(d => d.id === selectedReceivingId) || null;
  }, [receivingDocs, selectedReceivingId]);

  const selectedItem = useMemo<ItemMaster | null>(() => {
    return items.find(i => i.id === selectedItemId) || items[0] || null;
  }, [items, selectedItemId]);

  const filteredOpnameItems = useMemo(() => {
    if (opnameLocation === 'ALL') return items;
    if (opnameLocation === 'Gudang Non-Food') {
      return items.filter(i => {
        const l = (i.location || '').toLowerCase();
        const c = (i.category || '').toLowerCase();
        const n = (i.name || '').toLowerCase();
        return (
          l.includes('non-food') ||
          l.includes('nonfood') ||
          l.includes('rak n') ||
          l.includes('apd') ||
          c.includes('cleaning') ||
          c.includes('packaging') ||
          c.includes('hygiene') ||
          c.includes('apd') ||
          c.includes('p3k') ||
          c.includes('obat') ||
          n.includes('masker') ||
          n.includes('sarung tangan') ||
          n.includes('sabun') ||
          n.includes('tissue') ||
          n.includes('plastik')
        );
      });
    }
    return items.filter(i => i.location.toLowerCase().includes(opnameLocation.toLowerCase()));
  }, [items, opnameLocation]);

  const formattedArrivalDate = useMemo(() => {
    return formatDisplayDate(parseLocalDate(labelArrivalDate));
  }, [labelArrivalDate]);

  // Unified list of printable labels for Gudang Kering, Gudang Basah & Peralatan
  const allLabelItems = useMemo<PrintableLabelItem[]>(() => {
    const list: PrintableLabelItem[] = [];

    // Food & Operational Inventory Items
    items.forEach(item => {
      const wet = isWetItem(item);
      const rack = BASE_RACKS_CONFIG.find(r => r.id === matchItemToRackId(item.location, item.category, item.name, item.id));
      const isNonFood = !wet && rack?.warehouseName === 'Gudang Non-Food';
      const warehouseName = rack?.warehouseName || (wet ? 'Gudang Basah' : 'Gudang Kering');
      const locLower = (item.location || '').toLowerCase();
      const isFreezer = locLower.includes('freezer');
      const isChiller = locLower.includes('chiller');
      const autoShelf = getItemShelfLifeInfo(item);
      const autoSupplier = lastSupplierByItem[item.id] || '';

      const override = labelOverrides[item.id] || {};
      const itemArrival = override.arrivalDate || labelArrivalDate;
      const formattedArrival = formatDisplayDate(parseLocalDate(itemArrival));

      const finalSupplier =
        override.supplierName !== undefined
          ? override.supplierName
          : labelGlobalSupplier === 'AUTO'
          ? autoSupplier
          : labelGlobalSupplier === 'BLANK'
          ? ''
          : labelGlobalSupplier;

      const finalShelfLife =
        override.shelfLifeText !== undefined
          ? override.shelfLifeText
          : labelGlobalShelfLife.trim()
          ? labelGlobalShelfLife
          : autoShelf.durationText;

      const finalExpiryDate =
        override.expiryDate !== undefined
          ? override.expiryDate
          : labelGlobalExpiryDate.trim()
          ? labelGlobalExpiryDate
          : ''; // Default kosong untuk isi manual!

      const finalNote = override.customNote !== undefined ? override.customNote : labelCustomNote;

      if (wet) {
        list.push({
          id: item.id,
          name: item.name,
          warehouseType: 'GUDANG_BASAH',
          warehouseName,
          category: item.category,
          subcategory: item.subcategory,
          location: item.location,
          unit: item.baseUnit,
          instruction: isFreezer
            ? 'Freezer (−18°C atau lebih dingin) • Rotasi FEFO'
            : isChiller
            ? 'Chiller (1–5°C) • Rotasi FEFO'
            : 'Suhu Dingin / Segar • Rotasi FEFO Prioritas',
          badgeText: 'Gudang Basah • FEFO',
          supplier: finalSupplier,
          shelfLifeText: finalShelfLife,
          shelfLifeDays: autoShelf.shelfLifeDays,
          expiryDate: finalExpiryDate,
          customNote: finalNote,
          arrivalDateFormatted: formattedArrival,
          extraMeta: `Min: ${item.minimumStock} ${item.baseUnit} • ROP: ${item.reorderPoint} ${item.baseUnit}`,
        });
      } else {
        list.push({
          id: item.id,
          name: item.name,
          warehouseType: 'GUDANG_KERING',
          warehouseName,
          category: item.category,
          subcategory: item.subcategory,
          location: item.location,
          unit: item.baseUnit,
          instruction: isNonFood
            ? 'Suhu ruang, terpisah dari bahan pangan • Rotasi FIFO'
            : 'Suhu ruang kering (20°C - 25°C) • Rotasi FIFO',
          badgeText: isNonFood ? 'Gudang Non-Food • FIFO' : 'Gudang Kering • FIFO',
          supplier: finalSupplier,
          shelfLifeText: finalShelfLife,
          shelfLifeDays: autoShelf.shelfLifeDays,
          expiryDate: finalExpiryDate,
          customNote: finalNote,
          arrivalDateFormatted: formattedArrival,
          extraMeta: `Min: ${item.minimumStock} ${item.baseUnit} • ROP: ${item.reorderPoint} ${item.baseUnit}`,
        });
      }
    });

    // Kitchen Equipment & Inventory Items
    equipment.forEach(eq => {
      const condLabel =
        eq.condition === 'GOOD'
          ? 'Kondisi Baik'
          : eq.condition === 'NEEDS_INSPECTION'
          ? 'Perlu Inspeksi'
          : 'Perlu Servis';

      const override = labelOverrides[eq.id] || {};
      const itemArrival = override.arrivalDate || labelArrivalDate;
      const formattedArrival = formatDisplayDate(parseLocalDate(itemArrival));

      const finalSupplier =
        override.supplierName !== undefined
          ? override.supplierName
          : labelGlobalSupplier === 'AUTO'
          ? ''
          : labelGlobalSupplier === 'BLANK'
          ? ''
          : labelGlobalSupplier;

      const finalShelfLife =
        override.shelfLifeText !== undefined
          ? override.shelfLifeText
          : labelGlobalShelfLife.trim()
          ? labelGlobalShelfLife
          : 'Aset Tetap (Inspeksi Rutin 3 Bulan)';

      const finalExpiryDate =
        override.expiryDate !== undefined
          ? override.expiryDate
          : labelGlobalExpiryDate.trim()
          ? labelGlobalExpiryDate
          : '';

      const finalNote = override.customNote !== undefined ? override.customNote : labelCustomNote;

      list.push({
        id: eq.id,
        name: eq.name,
        warehouseType: 'EQUIPMENT',
        warehouseName: 'Aset & Peralatan Dapur',
        category: eq.category,
        location: eq.location,
        unit: eq.unit,
        instruction: `${condLabel} • Diperiksa: ${eq.lastInspectedDate}`,
        badgeText: 'Aset Dapur • Tetap',
        isEquipment: true,
        supplier: finalSupplier,
        shelfLifeText: finalShelfLife,
        shelfLifeDays: 90,
        expiryDate: finalExpiryDate,
        customNote: finalNote,
        arrivalDateFormatted: formattedArrival,
        extraMeta: `Jumlah: ${eq.quantity} ${eq.unit} • Status: ${eq.status}`,
      });
    });

    return list;
  }, [items, equipment, labelArrivalDate, labelGlobalSupplier, labelGlobalShelfLife, labelGlobalExpiryDate, labelCustomNote, labelOverrides, lastSupplierByItem]);

  const openEditModal = (label: PrintableLabelItem) => {
    setEditingModalData({
      id: label.id,
      name: label.name,
      supplier: label.supplier,
      shelfLifeText: label.shelfLifeText,
      expiryDate: label.expiryDate,
      customNote: label.customNote || '',
      arrivalDate: labelOverrides[label.id]?.arrivalDate || labelArrivalDate,
    });
  };

  const handleSaveModal = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editingModalData) return;
    commitLabelOverrides({
      ...labelOverrides,
      [editingModalData.id]: {
        supplierName: editingModalData.supplier,
        shelfLifeText: editingModalData.shelfLifeText,
        expiryDate: editingModalData.expiryDate,
        customNote: editingModalData.customNote,
        arrivalDate: editingModalData.arrivalDate,
      },
    });
    setEditingModalData(null);
  };

  const handleResetItemOverride = (id: string) => {
    const next = { ...labelOverrides };
    delete next[id];
    commitLabelOverrides(next);
    setEditingModalData(null);
  };

  // Dynamic categories based on warehouse filter
  const availableCategories = useMemo(() => {
    const list = allLabelItems.filter(l => {
      if (labelWarehouseFilter === 'ALL') return true;
      return l.warehouseType === labelWarehouseFilter;
    });
    return Array.from(new Set(list.map(l => l.category))).filter(Boolean).sort();
  }, [allLabelItems, labelWarehouseFilter]);

  // Category item counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 };
    const list = allLabelItems.filter(l => {
      if (labelWarehouseFilter === 'ALL') return true;
      return l.warehouseType === labelWarehouseFilter;
    });
    counts.ALL = list.length;
    list.forEach(l => {
      counts[l.category] = (counts[l.category] || 0) + 1;
    });
    return counts;
  }, [allLabelItems, labelWarehouseFilter]);

  // Filtered labels
  const filteredLabels = useMemo(() => {
    return allLabelItems.filter(l => {
      if (labelWarehouseFilter !== 'ALL' && l.warehouseType !== labelWarehouseFilter) {
        return false;
      }
      if (labelCategoryFilter !== 'ALL' && l.category !== labelCategoryFilter) {
        return false;
      }
      if (labelSearchQuery.trim()) {
        const q = labelSearchQuery.toLowerCase();
        const mName = l.name.toLowerCase().includes(q);
        const mId = l.id.toLowerCase().includes(q);
        const mLoc = l.location.toLowerCase().includes(q);
        const mCat = l.category.toLowerCase().includes(q);
        const mSub = (l.subcategory || '').toLowerCase().includes(q);
        if (!mName && !mId && !mLoc && !mCat && !mSub) return false;
      }
      return true;
    });
  }, [allLabelItems, labelWarehouseFilter, labelCategoryFilter, labelSearchQuery]);

  // Final labels to print
  const labelsToPrint = useMemo(() => {
    if (!hasCustomSelection) return filteredLabels;
    return filteredLabels.filter(l => selectedLabelIds.includes(l.id));
  }, [filteredLabels, hasCustomSelection, selectedLabelIds]);

  const toggleSelectAll = () => {
    if (!hasCustomSelection || selectedLabelIds.length === filteredLabels.length) {
      setHasCustomSelection(true);
      setSelectedLabelIds([]);
    } else {
      setHasCustomSelection(false);
      setSelectedLabelIds([]);
    }
  };

  const toggleSelectLabel = (id: string) => {
    if (!hasCustomSelection) {
      const newIds = filteredLabels.map(l => l.id).filter(item => item !== id);
      setHasCustomSelection(true);
      setSelectedLabelIds(newIds);
    } else {
      if (selectedLabelIds.includes(id)) {
        setSelectedLabelIds(selectedLabelIds.filter(item => item !== id));
      } else {
        setSelectedLabelIds([...selectedLabelIds, id]);
      }
    }
  };

  // =========================================================================
  // RACK LABELS (LABEL RAK GUDANG KERING & BASAH DENGAN DAFTAR ISI ITEM)
  // =========================================================================
  const [rackWarehouseFilter, setRackWarehouseFilter] = useState<'ALL' | 'GUDANG_KERING' | 'GUDANG_NONFOOD' | 'GUDANG_BASAH'>('ALL');
  const [rackSelectedId, setRackSelectedId] = useState<string>('ALL');
  const [rackSearchQuery, setRackSearchQuery] = useState<string>('');
  const [rackLayoutMode, setRackLayoutMode] = useState<'1' | '2'>('2');
  const [rackGlobalPic, setRackGlobalPic] = useState<string>('');
  const [rackGlobalNote, setRackGlobalNote] = useState<string>('');
  const [selectedRackIds, setSelectedRackIds] = useState<string[]>([]);
  const [hasCustomRackSelection, setHasCustomRackSelection] = useState<boolean>(false);

  // Plakat kustom dan perubahan plakat bawaan disimpan di app_settings agar tetap ada setelah dimuat ulang
  // dan sama di semua perangkat.
  const [customRacks, setCustomRacks] = useState<WarehouseRack[]>(() =>
    warehouseDb.getAppSetting<WarehouseRack[]>(SETTING_CUSTOM_RACKS, [])
  );
  const [rackOverrides, setRackOverrides] = useState<Record<string, RackOverride>>(() =>
    warehouseDb.getAppSetting<Record<string, RackOverride>>(SETTING_RACK_OVERRIDES, {})
  );

  // Pengaturan dari cloud tiba setelah halaman dibuka, dan bisa berubah dari perangkat lain.
  useEffect(() => {
    const reload = () => {
      setCustomRacks(warehouseDb.getAppSetting<WarehouseRack[]>(SETTING_CUSTOM_RACKS, []));
      setRackOverrides(warehouseDb.getAppSetting<Record<string, RackOverride>>(SETTING_RACK_OVERRIDES, {}));
    };
    window.addEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(APP_SETTINGS_CHANGED_EVENT, reload);
  }, []);

  const commitCustomRacks = (next: WarehouseRack[]) => {
    setCustomRacks(next);
    warehouseDb.saveAppSetting(SETTING_CUSTOM_RACKS, next, currentUser || undefined);
  };
  const commitRackOverrides = (next: Record<string, RackOverride>) => {
    setRackOverrides(next);
    warehouseDb.saveAppSetting(SETTING_RACK_OVERRIDES, next, currentUser || undefined);
  };

  const [editingRackData, setEditingRackData] = useState<{
    id: string;
    isNew?: boolean;
    name: string;
    warehouseType: 'GUDANG_KERING' | 'GUDANG_BASAH';
    warehouseName?: string;
    zone: string;
    temperatureGuide: string;
    humidityGuide?: string;
    capacityMax: string;
    storageRule: string;
    rotationMethod: 'FIFO' | 'FEFO';
    picName: string;
    customNote: string;
    items: RackItemDetail[];
    /** Daftar barang diubah di dialog; bila tidak, plakat tetap mengikuti Master Barang. */
    itemsEdited?: boolean;
  } | null>(null);
  const [rackFormError, setRackFormError] = useState('');

  // State untuk penambahan item manual di modal
  const [showManualItemInput, setShowManualItemInput] = useState<boolean>(false);
  const [manualItemForm, setManualItemForm] = useState<{
    id: string;
    name: string;
    category: string;
    unit: string;
    handlingNote: string;
  }>({
    id: '',
    name: '',
    category: 'Sembako',
    unit: 'Kg',
    handlingNote: '',
  });

  // Group all items dynamically into Warehouse Racks (Gudang Kering vs Gudang Basah)
  const allWarehouseRacks = useMemo<WarehouseRack[]>(() => {
    const itemsByRackId: Record<string, RackItemDetail[]> = {};
    BASE_RACKS_CONFIG.forEach(r => {
      itemsByRackId[r.id] = [];
    });

    const dynamicRacks: Record<string, WarehouseRack> = {};

    items.forEach(itm => {
      const targetRackId = matchItemToRackId(itm.location, itm.category, itm.name, itm.id, customRacks);
      const detail: RackItemDetail = {
        id: itm.id,
        name: itm.name,
        category: itm.category,
        subcategory: itm.subcategory,
        currentStock: itm.currentStock,
        unit: itm.baseUnit,
        minStock: itm.minimumStock,
        reorderPoint: itm.reorderPoint,
        handlingNote: itm.notes,
      };

      if (targetRackId && itemsByRackId[targetRackId]) {
        itemsByRackId[targetRackId].push(detail);
      } else {
        const locClean = itm.location || 'Area Gudang Tambahan';
        const dynId = dynamicRackId(locClean);
        const isWet = /chiller|freezer|basah|dingin|segar|sayur|buah|ikan|daging|telur|protein/i.test(
          locClean + ' ' + itm.category + ' ' + itm.name
        );

        if (!dynamicRacks[dynId]) {
          dynamicRacks[dynId] = {
            id: dynId,
            name: `Rak / Area: ${locClean}`,
            warehouseType: isWet ? 'GUDANG_BASAH' : 'GUDANG_KERING',
            warehouseName: isWet ? 'Gudang Basah' : 'Gudang Kering',
            zone: `Zona ${locClean}`,
            temperatureGuide: isWet ? '2°C - 4°C (Suhu Dingin Terkendali)' : '20°C - 25°C (Suhu Ruang)',
            storageRule: isWet
              ? 'Standar Rantai Dingin (Cold Chain). Simpan dalam wadah tertutup higienis.'
              : 'Standar Gudang Kering. Pastikan beralas palet min 15cm dan bersih dari debu/hama.',
            rotationMethod: isWet ? 'FEFO' : 'FIFO',
            capacityMax: 'Standar Rak SPPG',
            picName: rackGlobalPic,
            customNote: rackGlobalNote,
            items: [],
          };
        }
        dynamicRacks[dynId].items.push(detail);
      }
    });

    const baseList: WarehouseRack[] = BASE_RACKS_CONFIG.map(base => {
      const ov = rackOverrides[base.id] || {};
      let rackItems: RackItemDetail[];
      if (ov.customItems !== undefined) {
        rackItems = ov.customItems;
      } else {
        rackItems = [...(itemsByRackId[base.id] || [])];
        if (ov.extraItemsText) {
          const extraLines = ov.extraItemsText.split('\n').filter(l => l.trim().length > 0);
          extraLines.forEach((line, idx) => {
            const parts = line.split('|').map(p => p.trim());
            rackItems.push({
              id: parts[0] || `ITM-EXTRA-${idx + 1}`,
              name: parts[1] || parts[0] || 'Item Tambahan',
              category: parts[2] || 'Bahan Pangan',
              currentStock: Number(parts[3]) || 0,
              unit: parts[4] || 'Kg',
              minStock: 10,
              reorderPoint: 20,
              handlingNote: 'Item tambahan manual lapangan',
            });
          });
        }
      }

      return {
        ...base,
        name: ov.name || base.name,
        warehouseType: ov.warehouseType || base.warehouseType,
        warehouseName: ov.warehouseName || base.warehouseName,
        zone: ov.zone || base.zone,
        temperatureGuide: ov.temperatureGuide || base.temperatureGuide,
        humidityGuide: ov.humidityGuide !== undefined ? ov.humidityGuide : base.humidityGuide,
        rotationMethod: ov.rotationMethod || base.rotationMethod,
        capacityMax: ov.capacityMax || base.capacityMax,
        storageRule: ov.storageRule || base.storageRule,
        picName: ov.picName || rackGlobalPic || base.picName,
        customNote: ov.customNote !== undefined ? ov.customNote : (rackGlobalNote || base.customNote),
        items: rackItems,
      };
    });

    const customList: WarehouseRack[] = customRacks.map(cr => {
      const ov = rackOverrides[cr.id] || {};
      return {
        ...cr,
        isCustom: true,
        name: ov.name || cr.name,
        warehouseType: ov.warehouseType || cr.warehouseType,
        warehouseName: ov.warehouseName || cr.warehouseName,
        zone: ov.zone || cr.zone,
        temperatureGuide: ov.temperatureGuide || cr.temperatureGuide,
        humidityGuide: ov.humidityGuide !== undefined ? ov.humidityGuide : cr.humidityGuide,
        rotationMethod: ov.rotationMethod || cr.rotationMethod,
        capacityMax: ov.capacityMax || cr.capacityMax,
        storageRule: ov.storageRule || cr.storageRule,
        picName: ov.picName || rackGlobalPic || cr.picName,
        customNote: ov.customNote !== undefined ? ov.customNote : (rackGlobalNote || cr.customNote),
        items: ov.customItems !== undefined ? ov.customItems : cr.items,
      };
    });

    const dynList: WarehouseRack[] = Object.values(dynamicRacks).map(dyn => {
      const ov = rackOverrides[dyn.id] || {};
      return {
        ...dyn,
        name: ov.name || dyn.name,
        warehouseType: ov.warehouseType || dyn.warehouseType,
        warehouseName: ov.warehouseName || dyn.warehouseName,
        zone: ov.zone || dyn.zone,
        temperatureGuide: ov.temperatureGuide || dyn.temperatureGuide,
        humidityGuide: ov.humidityGuide !== undefined ? ov.humidityGuide : dyn.humidityGuide,
        rotationMethod: ov.rotationMethod || dyn.rotationMethod,
        capacityMax: ov.capacityMax || dyn.capacityMax,
        storageRule: ov.storageRule || dyn.storageRule,
        picName: ov.picName || rackGlobalPic || dyn.picName,
        customNote: ov.customNote !== undefined ? ov.customNote : (rackGlobalNote || dyn.customNote),
        items: ov.customItems !== undefined ? ov.customItems : dyn.items,
      };
    });

    return [...baseList, ...customList, ...dynList];
  }, [items, rackOverrides, customRacks, rackGlobalPic, rackGlobalNote]);

  const filteredRacks = useMemo(() => {
    return allWarehouseRacks.filter(rack => {
      if (rackWarehouseFilter !== 'ALL') {
        if (rackWarehouseFilter === 'GUDANG_NONFOOD') {
          if (!rack.id.includes('-N')) return false;
        } else if (rackWarehouseFilter === 'GUDANG_KERING') {
          if (rack.warehouseType !== 'GUDANG_KERING' || rack.id.includes('-N')) return false;
        } else if (rack.warehouseType !== rackWarehouseFilter) {
          return false;
        }
      }
      if (rackSelectedId !== 'ALL' && rack.id !== rackSelectedId) {
        return false;
      }
      if (rackSearchQuery.trim()) {
        const q = rackSearchQuery.toLowerCase();
        const matchRack =
          rack.id.toLowerCase().includes(q) ||
          rack.name.toLowerCase().includes(q) ||
          rack.zone.toLowerCase().includes(q);
        const matchItem = rack.items.some(
          itm =>
            itm.name.toLowerCase().includes(q) ||
            itm.id.toLowerCase().includes(q) ||
            itm.category.toLowerCase().includes(q)
        );
        if (!matchRack && !matchItem) return false;
      }
      return true;
    });
  }, [allWarehouseRacks, rackWarehouseFilter, rackSelectedId, rackSearchQuery]);

  const racksToPrint = useMemo(() => {
    if (!hasCustomRackSelection) return filteredRacks;
    return filteredRacks.filter(r => selectedRackIds.includes(r.id));
  }, [filteredRacks, hasCustomRackSelection, selectedRackIds]);

  const toggleSelectAllRacks = () => {
    if (!hasCustomRackSelection || selectedRackIds.length === filteredRacks.length) {
      setHasCustomRackSelection(true);
      setSelectedRackIds([]);
    } else {
      setHasCustomRackSelection(false);
      setSelectedRackIds([]);
    }
  };

  const toggleSelectRack = (id: string) => {
    if (!hasCustomRackSelection) {
      const newIds = filteredRacks.map(r => r.id).filter(item => item !== id);
      setHasCustomRackSelection(true);
      setSelectedRackIds(newIds);
    } else {
      if (selectedRackIds.includes(id)) {
        setSelectedRackIds(selectedRackIds.filter(item => item !== id));
      } else {
        setSelectedRackIds([...selectedRackIds, id]);
      }
    }
  };

  const openEditRackModal = (rack: WarehouseRack) => {
    setItems(warehouseDb.getItems());
    const ov = rackOverrides[rack.id] || {};
    setEditingRackData({
      id: rack.id,
      isNew: false,
      name: ov.name || rack.name,
      warehouseType: ov.warehouseType || rack.warehouseType,
      warehouseName: ov.warehouseName || rack.warehouseName,
      zone: ov.zone || rack.zone,
      temperatureGuide: ov.temperatureGuide || rack.temperatureGuide,
      humidityGuide: ov.humidityGuide !== undefined ? ov.humidityGuide : (rack.humidityGuide || ''),
      capacityMax: ov.capacityMax || rack.capacityMax,
      storageRule: ov.storageRule || rack.storageRule,
      rotationMethod: ov.rotationMethod || rack.rotationMethod,
      picName: ov.picName || rack.picName,
      customNote: ov.customNote !== undefined ? ov.customNote : (rack.customNote || ''),
      items: (ov.customItems !== undefined ? ov.customItems : rack.items).map(item => ({ ...item })),
    });
    setRackFormError('');
    setShowManualItemInput(false);
  };

  const handleCreateNewRack = () => {
    setItems(warehouseDb.getItems());
    // Nomor kosong pertama; jumlah plakat + 1 bisa bentrok setelah ada plakat yang dihapus.
    let nextNum = 1;
    while (allWarehouseRacks.some(r => r.id === `RAK-KST-${String(nextNum).padStart(2, '0')}`)) nextNum++;
    const newId = `RAK-KST-${String(nextNum).padStart(2, '0')}`;
    setEditingRackData({
      id: newId,
      isNew: true,
      name: '',
      warehouseType: 'GUDANG_KERING',
      warehouseName: 'Gudang Kering',
      zone: '',
      temperatureGuide: 'Suhu ruang 20°C - 25°C',
      humidityGuide: 'Kering',
      capacityMax: '',
      storageRule: 'Di atas palet atau ambalan, min. 15 cm dari lantai. Jaga bersih dari debu dan hama.',
      rotationMethod: 'FIFO',
      picName: rackGlobalPic,
      customNote: '',
      items: [],
    });
    setRackFormError('');
    setShowManualItemInput(false);
  };

  const handleSaveRackModal = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!editingRackData) return;
    const {
      isNew,
      warehouseType,
      zone,
      temperatureGuide,
      humidityGuide,
      capacityMax,
      storageRule,
      rotationMethod,
      picName,
      customNote,
      items: rackItems,
      itemsEdited,
    } = editingRackData;
    const id = editingRackData.id.trim().toUpperCase();
    const name = editingRackData.name.trim();

    if (!id || !name) {
      setRackFormError('Kode rak dan nama plakat wajib diisi.');
      return;
    }
    if (isNew && allWarehouseRacks.some(r => r.id === id)) {
      setRackFormError(`Kode ${id} sudah dipakai plakat lain. Pakai kode yang berbeda.`);
      return;
    }

    // Nama gudang asli rak dipertahankan (mis. Gudang Non-Food, Dapur); hanya diganti bila tipe gudangnya diubah.
    const whName = editingRackData.warehouseName || (warehouseType === 'GUDANG_BASAH' ? 'Gudang Basah' : 'Gudang Kering');

    if (isNew) {
      const newRack: WarehouseRack = {
        id,
        isCustom: true,
        name,
        warehouseType,
        warehouseName: whName,
        zone,
        temperatureGuide,
        humidityGuide: humidityGuide || undefined,
        capacityMax,
        storageRule,
        rotationMethod,
        picName,
        customNote,
        items: rackItems,
      };
      commitCustomRacks([...customRacks.filter(r => r.id !== id), newRack]);
      if (hasCustomRackSelection) {
        setSelectedRackIds(prev => [...prev, id]);
      }
    } else {
      const prevOverride = rackOverrides[id] || {};
      commitRackOverrides({
        ...rackOverrides,
        [id]: {
          name,
          warehouseType,
          warehouseName: whName,
          zone,
          temperatureGuide,
          humidityGuide,
          capacityMax,
          storageRule,
          rotationMethod,
          picName,
          customNote,
          // Daftar barang hanya dibekukan bila memang diubah, supaya barang baru di Master Barang tetap muncul.
          customItems: itemsEdited ? rackItems : prevOverride.customItems,
        },
      });
    }
    setEditingRackData(null);
  };

  const handleDeleteCustomRack = (id: string) => {
    const rack = customRacks.find(r => r.id === id);
    if (!window.confirm(`Hapus plakat ${rack?.name || id}? Plakat yang sudah dihapus tidak bisa dikembalikan.`)) return;
    commitCustomRacks(customRacks.filter(r => r.id !== id));
    if (rackOverrides[id]) {
      const next = { ...rackOverrides };
      delete next[id];
      commitRackOverrides(next);
    }
    setSelectedRackIds(prev => prev.filter(i => i !== id));
    if (editingRackData?.id === id) {
      setEditingRackData(null);
    }
  };

  const handleResetRackOverride = (id: string) => {
    if (!window.confirm('Kembalikan plakat ini ke isi bawaan? Semua perubahan pada plakat ini akan hilang.')) return;
    const next = { ...rackOverrides };
    delete next[id];
    commitRackOverrides(next);
    setEditingRackData(null);
  };

  const handleAddItemFromMaster = (itemId: string) => {
    if (!editingRackData) return;
    const masterItem = items.find(i => i.id === itemId);
    if (!masterItem) return;

    const newItem: RackItemDetail = {
      id: masterItem.id,
      name: masterItem.name,
      category: masterItem.category,
      subcategory: masterItem.subcategory,
      currentStock: masterItem.currentStock,
      unit: masterItem.baseUnit || 'Kg',
      minStock: masterItem.minimumStock,
      reorderPoint: masterItem.reorderPoint,
      handlingNote: masterItem.notes || '',
    };

    setEditingRackData(prev => (prev ? { ...prev, items: [...prev.items, newItem], itemsEdited: true } : null));
  };

  const handleAddManualItem = () => {
    if (!editingRackData || !manualItemForm.name.trim()) return;
    const newSku =
      manualItemForm.id.trim() ||
      `ITM-KST-${String(editingRackData.items.length + 1).padStart(2, '0')}`;
    const newItem: RackItemDetail = {
      id: newSku,
      name: manualItemForm.name.trim(),
      category: manualItemForm.category.trim() || 'Bahan Pangan',
      currentStock: 0,
      unit: manualItemForm.unit.trim() || 'Kg',
      minStock: 0,
      reorderPoint: 0,
      handlingNote: manualItemForm.handlingNote.trim(),
    };

    setEditingRackData(prev => (prev ? { ...prev, items: [...prev.items, newItem], itemsEdited: true } : null));
    setManualItemForm({
      id: '',
      name: '',
      category: 'Sembako',
      unit: 'Kg',
      handlingNote: '',
    });
    setShowManualItemInput(false);
  };

  const handleRemoveItemFromEditingRack = (indexToRemove: number) => {
    if (!editingRackData) return;
    setEditingRackData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: prev.items.filter((_, idx) => idx !== indexToRemove),
        itemsEdited: true,
      };
    });
  };

  const handleMoveItemInEditingRack = (index: number, direction: 'UP' | 'DOWN') => {
    if (!editingRackData) return;
    const itemsList = [...editingRackData.items];
    const targetIndex = direction === 'UP' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= itemsList.length) return;

    const temp = itemsList[index];
    itemsList[index] = itemsList[targetIndex];
    itemsList[targetIndex] = temp;

    setEditingRackData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: itemsList,
        itemsEdited: true,
      };
    });
  };

  const handleUpdateItemField = (index: number, field: keyof RackItemDetail, value: any) => {
    if (!editingRackData) return;
    setEditingRackData(prev => {
      if (!prev) return null;
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems, itemsEdited: true };
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Jumlah lembar/label yang akan tercetak, untuk label tombol cetak.
  // Form Rekapitulasi Limbah: per hari 5 baris jenis limbah + baris total. Hari timbang Senin-Jumat;
  // tanggal bisa dicetak otomatis dari bulan terpilih atau dikosongkan untuk ditulis tangan.
  const wasteRecap = useMemo(() => {
    if (activeForm !== 'WASTE_RECAP_FORM') return null;
    const [y, m] = wasteMonth.split('-').map(Number);
    const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    const values: Record<string, Partial<Record<NutritionKey, number>>> = {};
    if (wasteDateMode === 'BLANK') {
      return { days: Array.from({ length: wasteBlankDays }, () => ''), values, monthLabel: '' };
    }
    const days: string[] = [];
    const daysInMonth = new Date(y, m, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m - 1, d);
      if (date.getDay() >= 1 && date.getDay() <= 5) days.push(localDateIso(date));
    }
    if (wasteFillRecorded) {
      warehouseDb.getWasteLogs().forEach(log => {
        if (!log.date.startsWith(wasteMonth)) return;
        const key = nutritionKeyOf(log.wasteCategory);
        const kg = toKg(log);
        if (!key || kg === null) return;
        values[log.date] = { ...values[log.date], [key]: (values[log.date]?.[key] || 0) + kg };
      });
    }
    return { days, values, monthLabel };
  }, [activeForm, wasteMonth, wasteDateMode, wasteBlankDays, wasteFillRecorded]);

  const printCount =
    activeForm === 'ITEM_TAG_LABEL'
      ? itemTagsToPrint.length
      : activeForm === 'EQUIPMENT_LABEL'
      ? labelsToPrint.length
      : activeForm === 'RACK_LABEL'
      ? racksToPrint.length
      : activeForm === 'DO_DONT_POSTER'
      ? doDontPosterCount(doDontTarget)
      : activeForm === 'RACK_SIGN'
      ? signCount
      : activeForm === 'PHOTO_DOC'
      ? photoPageCount
      : activeForm === 'PIC_HANDOVER'
      ? picReceiptCount
      : activeForm === 'EXPENSE_RECEIPT_BATCH'
      ? expenseReceiptCount
      : activeForm === 'DAILY_PO_SHEET'
      ? poSheetCount
      : null;
  const printDisabled = printCount === 0 || (activeForm === 'BIN_CARD' && !selectedItem);

  return (
    <div className="space-y-4">
      {/* Print-specific style injected into head */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 8mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt;
          }
          nav, header, footer, .no-print {
            display: none !important;
          }
          /* Latar abu-abu dan padding tata letak aplikasi ikut tercetak karena color-adjust: exact. */
          #root, #root > div, main {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            min-height: 0 !important;
          }
          #print-area {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }
          .page-break {
            page-break-after: always;
          }
          /* SOP: bagian dan baris tabel tidak terpotong di pergantian halaman */
          .sop-section tr, .sop-section li, .sop-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .sop-section h3 {
            break-after: avoid;
            page-break-after: avoid;
          }
          .table-print th, .table-print td {
            border: 1px solid #333333 !important;
            padding: 6px 8px !important;
          }
          /* Tata letak plakat rak 2 item per lembar kertas A4 */
          .rack-print-container-2per-page {
            display: flex !important;
            flex-direction: column !important;
            gap: 5mm !important;
          }
          .rack-card-2per-page {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            /* Tanpa batas tinggi: rak berisi banyak barang memakai lebih dari setengah lembar, bingkainya tetap utuh */
            margin-bottom: 5mm !important;
            box-sizing: border-box !important;
          }
          .rack-card-2per-page:nth-child(2n) {
            break-after: page !important;
            page-break-after: always !important;
            margin-bottom: 0 !important;
          }
          .rack-card-2per-page:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }
          .rack-card-1per-page {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            break-after: page !important;
            page-break-after: always !important;
            margin-bottom: 0 !important;
          }
          .rack-card-1per-page:last-child {
            break-after: auto !important;
            page-break-after: auto !important;
          }
        }
      `}</style>

      {/* Kontrol layar: tidak ikut tercetak */}
      <div className="no-print bg-white rounded-xl border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 pt-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cetak Form</h1>
            <p className="text-xs text-slate-600 mt-0.5">Pilih form, atur isinya, lalu cetak atau simpan sebagai PDF.</p>
          </div>
          <button
            type="button"
            onClick={handlePrint}
            disabled={printDisabled}
            className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] sm:min-h-[36px] rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1"
          >
            <Printer className="w-4 h-4" />
            {printCount === null ? 'Cetak' : `Cetak ${printCount} ${activeForm === 'DAILY_PO_SHEET' ? 'form' : activeForm === 'PIC_HANDOVER' ? 'kuitansi' : activeForm === 'EXPENSE_RECEIPT_BATCH' ? 'kuitansi' : activeForm === 'PHOTO_DOC' ? 'lembar' : activeForm === 'RACK_SIGN' ? 'papan nama' : activeForm === 'RACK_LABEL' || activeForm === 'DO_DONT_POSTER' ? 'plakat' : activeForm === 'ITEM_TAG_LABEL' ? 'tag' : 'label'}`}
          </button>
        </div>

        {/* HP & tablet: satu dropdown berkelompok agar menu 11 form tidak memanjang ke bawah. */}
        <div className="md:hidden px-4 pt-3 text-xs">
          <label htmlFor="form-picker" className={LABEL_CLS}>Form</label>
          <Select id="form-picker" className="w-full" value={activeForm} onChange={e => setActiveForm(e.target.value as FormType)}>
            {FORM_CATEGORIES.map(cat => (
              <optgroup key={cat.id} label={cat.label}>
                {cat.forms.map(fId => (
                  <option key={fId} value={fId}>
                    {FORM_TABS.find(t => t.id === fId)?.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>

        {/* Layar lebar: kategori memakai segmented control standar, form memakai tab garis bawah sebagai level kedua. */}
        <div className="hidden md:block px-4 pt-3">
          <div role="tablist" aria-label="Kategori form" className="inline-flex p-1 rounded-lg bg-slate-100 text-xs">
            {FORM_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat.id}
                onClick={() => handleSelectCategory(cat.id)}
                className={`px-3 min-h-[32px] rounded-md whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  activeCategory === cat.id ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                {cat.shortLabel}
              </button>
            ))}
          </div>

          <div role="tablist" aria-label={`Form ${currentCategoryGroup.shortLabel}`} className="mt-2 flex flex-wrap border-b border-slate-200 text-xs">
            {currentCategoryForms.map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeForm === tab.id}
                onClick={() => setActiveForm(tab.id)}
                className={`-mb-px px-3 min-h-[36px] border-b-2 rounded-t-md whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  activeForm === tab.id
                    ? 'border-emerald-700 text-emerald-800 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 font-medium'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tanpa kotak pengaturan di bawahnya, keterangan butuh jarak bawah sendiri supaya tidak menempel ke tepi kartu */}
        <p className={`px-4 pt-3 text-[11px] text-slate-600 font-medium leading-snug ${FORMS_WITH_OWN_SETTINGS.includes(activeForm) ? 'pb-4' : ''}`}>
          {FORM_TABS.find(t => t.id === activeForm)?.hint}
        </p>

        {/* Pengaturan sesuai form yang dipilih. Form yang pengaturannya ada di bawah (Excel, foto, papan nama) tidak memakai kotak ini. */}
        <div className={`p-4 grid ${FORMS_WITH_OWN_SETTINGS.includes(activeForm) ? 'hidden' : ''} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-xs`}>
          {activeForm === 'WASTE_RECAP_FORM' ? (
            <>
              <div>
                <label htmlFor="waste-date-mode" className={LABEL_CLS}>Tanggal</label>
                <Select className="w-full" id="waste-date-mode" value={wasteDateMode} onChange={e => setWasteDateMode(e.target.value as 'AUTO' | 'BLANK')}>
                  <option value="AUTO">Tercetak otomatis (Senin-Jumat)</option>
                  <option value="BLANK">Kosong, diisi tangan</option>
                </Select>
              </div>
              {wasteDateMode === 'AUTO' ? (
                <>
                  <div>
                    <label htmlFor="waste-month" className={LABEL_CLS}>Bulan</label>
                    <input
                      id="waste-month"
                      type="month"
                      value={wasteMonth}
                      onChange={e => setWasteMonth(e.target.value || localDateIso().slice(0, 7))}
                      className={INPUT_CLS}
                    />
                  </div>
                  <label className="flex items-center gap-2 text-slate-800 sm:pt-5 min-h-[44px] sm:min-h-0 cursor-pointer sm:col-span-2">
                    <input type="checkbox" checked={wasteFillRecorded} onChange={e => setWasteFillRecorded(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
                    Isi dengan angka yang sudah tercatat di aplikasi (untuk rekap yang ditandatangani)
                  </label>
                </>
              ) : (
                <div>
                  <label htmlFor="waste-blank-days" className={LABEL_CLS}>Jumlah hari</label>
                  <input
                    id="waste-blank-days"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={25}
                    value={wasteBlankDays}
                    onChange={e => setWasteBlankDays(Math.min(25, Math.max(1, Number(e.target.value) || 1)))}
                    className={INPUT_CLS}
                  />
                </div>
              )}
            </>
          ) : activeForm !== 'EQUIPMENT_LABEL' && activeForm !== 'RACK_LABEL' && activeForm !== 'RACK_SIGN' && activeForm !== 'PHOTO_DOC' && activeForm !== 'PIC_HANDOVER' && activeForm !== 'EXPENSE_RECEIPT_BATCH' && activeForm !== 'SUPPLIER_EXPENSE_NOTE' && activeForm !== 'ITEM_TAG_LABEL' ? (
            <div>
              <label htmlFor="print-date" className={LABEL_CLS}>{activeForm === 'SOP_STORAGE' || activeForm === 'DO_DONT_POSTER' ? 'Tanggal berlaku' : 'Tanggal dokumen'}</label>
              <input id="print-date" type="date" value={printDate} onChange={e => setPrintDate(e.target.value || localDateIso())} className={INPUT_CLS} />
            </div>
          ) : activeForm === 'SUPPLIER_EXPENSE_NOTE' ? (
            <>
              <div>
                <label htmlFor="exp-supplier" className={LABEL_CLS}>Supplier</label>
                <SearchPicker
                  id="exp-supplier"
                  value={expenseSupplierId}
                  options={suppliers.map(s => ({ value: s.id, label: s.name, hint: s.supplyCategory || undefined }))}
                  onSelect={opt => opt && handleSupplierChange(opt.value)}
                  placeholder={suppliers.length === 0 ? 'Belum ada supplier' : 'Pilih supplier'}
                  searchPlaceholder="Cari supplier..."
                  noun="supplier"
                />
              </div>

              <div>
                <label htmlFor="exp-gr" className={LABEL_CLS}>Ambil rincian dari penerimaan</label>
                <SearchPicker
                  id="exp-gr"
                  value={expenseReceivingId}
                  options={supplierReceivings.map(r => ({ value: r.id, label: `${r.id} · ${r.deliveryNoteNo || 'tanpa SJ'}`, hint: formatLongDate(r.date) }))}
                  onSelect={opt => opt && handleLoadReceivingDocToExpense(opt.value)}
                  placeholder={supplierReceivings.length === 0 ? 'Belum ada penerimaan dari supplier ini' : 'Pilih dokumen penerimaan'}
                  searchPlaceholder="Cari nomor dokumen atau surat jalan..."
                  noun="dokumen"
                />
              </div>

              <div>
                <label htmlFor="exp-date" className={LABEL_CLS}>Tanggal bayar</label>
                <input
                  id="exp-date"
                  type="date"
                  value={expenseDate}
                  onChange={e => {
                    setExpenseDate(e.target.value);
                    setPrintDate(e.target.value);
                  }}
                  className={INPUT_CLS}
                />
              </div>

              <div>
                <label htmlFor="exp-no" className={LABEL_CLS}>No. bukti kas keluar</label>
                <input id="exp-no" type="text" value={expenseInvoiceNo} onChange={e => setExpenseInvoiceNo(e.target.value)} className={`${INPUT_CLS} font-mono`} />
              </div>

              <div>
                <label htmlFor="exp-status" className={LABEL_CLS}>Status pembayaran</label>
                <Select className="w-full" id="exp-status" value={expenseStatus} onChange={e => setExpenseStatus(e.target.value as typeof expenseStatus)}>
                  <option value="LUNAS">Lunas</option>
                  <option value="DP">Uang muka (DP)</option>
                  <option value="TEMPO">Tempo</option>
                  <option value="PENDING">Menunggu verifikasi</option>
                </Select>
              </div>

              <div>
                <label htmlFor="exp-ref" className={LABEL_CLS}>No. surat jalan / referensi</label>
                <input id="exp-ref" type="text" value={expenseDeliveryRef} onChange={e => setExpenseDeliveryRef(e.target.value)} placeholder="Kosongkan untuk diisi tangan" className={`${INPUT_CLS} font-mono`} />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="exp-purpose" className={LABEL_CLS}>Perihal</label>
                <input id="exp-purpose" type="text" value={expensePurpose} onChange={e => setExpensePurpose(e.target.value)} className={INPUT_CLS} />
              </div>

              <div>
                <label htmlFor="exp-bank" className={LABEL_CLS}>Bank tujuan</label>
                <input id="exp-bank" type="text" value={expenseBankName} onChange={e => setExpenseBankName(e.target.value)} placeholder="Kosongkan jika tunai" className={INPUT_CLS} />
              </div>
              <div>
                <label htmlFor="exp-acc" className={LABEL_CLS}>No. rekening</label>
                <input id="exp-acc" type="text" inputMode="numeric" value={expenseBankAccount} onChange={e => setExpenseBankAccount(e.target.value)} className={`${INPUT_CLS} font-mono`} />
              </div>
              <div>
                <label htmlFor="exp-holder" className={LABEL_CLS}>Atas nama</label>
                <input id="exp-holder" type="text" value={expenseAccountHolder} onChange={e => setExpenseAccountHolder(e.target.value)} className={INPUT_CLS} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="exp-disc" className={LABEL_CLS}>Potongan (Rp)</label>
                  <input id="exp-disc" type="number" min="0" value={expenseDiscount || ''} onChange={e => setExpenseDiscount(Number(e.target.value) || 0)} className={`${INPUT_CLS} font-mono`} />
                </div>
                <div>
                  <label htmlFor="exp-ship" className={LABEL_CLS}>Ongkir (Rp)</label>
                  <input id="exp-ship" type="number" min="0" value={expenseShippingCost || ''} onChange={e => setExpenseShippingCost(Number(e.target.value) || 0)} className={`${INPUT_CLS} font-mono`} />
                </div>
              </div>

              <div>
                <label htmlFor="exp-treasurer" className={LABEL_CLS}>Bendahara</label>
                <input id="exp-treasurer" type="text" value={expensePicTreasurer} onChange={e => setExpensePicTreasurer(e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <label htmlFor="exp-verifier" className={LABEL_CLS}>Pemeriksa barang</label>
                <input id="exp-verifier" type="text" value={expensePicVerifier} onChange={e => setExpensePicVerifier(e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <label htmlFor="exp-approver" className={LABEL_CLS}>Kepala SPPG</label>
                <input id="exp-approver" type="text" value={expensePicApprover} onChange={e => setExpensePicApprover(e.target.value)} className={INPUT_CLS} />
              </div>
              <div>
                <label htmlFor="exp-notes" className={LABEL_CLS}>Catatan (opsional)</label>
                <input id="exp-notes" type="text" value={expenseNotes} onChange={e => setExpenseNotes(e.target.value)} className={INPUT_CLS} />
              </div>

              {/* Rincian belanja: harga diisi petugas karena belum tercatat di penerimaan */}
              <div className="min-w-0 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-800">Rincian belanja ({expenseLines.length})</span>
                  <button
                    type="button"
                    onClick={handleAddExpenseLine}
                    className="inline-flex items-center gap-1 px-3 min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah baris
                  </button>
                </div>
                {expenseLines.length === 0 ? (
                  <p className="py-4 text-center text-slate-600 border border-dashed border-slate-300 rounded-lg">
                    Belum ada rincian. Ambil dari dokumen penerimaan atau tambah baris manual.
                  </p>
                ) : (
                  <div className="relative overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full min-w-[560px] text-left">
                      <thead className="bg-slate-50 text-slate-700">
                        <tr>
                          <th className="py-1.5 px-2 font-semibold">Uraian</th>
                          <th className="py-1.5 px-2 font-semibold w-20 text-right">Jumlah</th>
                          <th className="py-1.5 px-2 font-semibold w-20">Satuan</th>
                          <th className="py-1.5 px-2 font-semibold w-32 text-right">Harga satuan (Rp)</th>
                          <th className="py-1.5 px-2 font-semibold w-28 text-right">Total</th>
                          <th className="py-1.5 px-2 w-10"><span className="sr-only">Hapus</span></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {expenseLines.map(line => (
                          <tr key={line.id}>
                            <td className="py-1 px-2">
                              <input aria-label="Uraian" type="text" value={line.name} onChange={e => handleUpdateExpenseLine(line.id, 'name', e.target.value)} className={INPUT_CLS} />
                            </td>
                            <td className="py-1 px-2">
                              <input aria-label="Jumlah" type="number" min="0" step="any" value={line.quantity} onChange={e => handleUpdateExpenseLine(line.id, 'quantity', Number(e.target.value) || 0)} className={`${INPUT_CLS} text-right font-mono`} />
                            </td>
                            <td className="py-1 px-2">
                              <input aria-label="Satuan" type="text" value={line.unit} onChange={e => handleUpdateExpenseLine(line.id, 'unit', e.target.value)} className={INPUT_CLS} />
                            </td>
                            <td className="py-1 px-2">
                              <input aria-label="Harga satuan" type="number" min="0" value={line.unitPrice || ''} placeholder="0" onChange={e => handleUpdateExpenseLine(line.id, 'unitPrice', Number(e.target.value) || 0)} className={`${INPUT_CLS} text-right font-mono`} />
                            </td>
                            <td className="py-1 px-2 text-right font-mono font-semibold text-slate-900">
                              {(line.quantity * line.unitPrice).toLocaleString('id-ID')}
                            </td>
                            <td className="py-1 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveExpenseLine(line.id)}
                                aria-label={`Hapus ${line.name || 'baris'}`}
                                className="p-2 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {expenseLines.some(l => !l.unitPrice) && (
                  <p className="mt-1.5 text-[11px] text-amber-800">Ada baris yang harganya masih kosong. Isi sebelum mencetak nota.</p>
                )}
              </div>
            </>
          ) : activeForm === 'EQUIPMENT_LABEL' ? (
            <>
              <div>
                <label className={LABEL_CLS}>Gudang / Sumber Label</label>
                <Select className="w-full" size="sm"
                  value={labelWarehouseFilter}
                  onChange={e => {
                    setLabelWarehouseFilter(e.target.value as any);
                    setLabelCategoryFilter('ALL');
                    setHasCustomSelection(false);
                  }}>
                  <option value="ALL">Semua gudang & aset</option>
                  <option value="GUDANG_KERING">Gudang kering</option>
                  <option value="GUDANG_BASAH">Gudang basah</option>
                  <option value="EQUIPMENT">Aset dapur</option>
                </Select>
              </div>

              <div>
                <label className={LABEL_CLS}>Kategori</label>
                <Select className="w-full" size="sm"
                  value={labelCategoryFilter}
                  onChange={e => {
                    setLabelCategoryFilter(e.target.value);
                    setHasCustomSelection(false);
                  }}>
                  <option value="ALL">Semua kategori ({categoryCounts['ALL'] || 0})</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat} ({categoryCounts[cat] || 0})
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className={LABEL_CLS}>Supplier</label>
                <SearchPicker
                  value={labelGlobalSupplier}
                  options={[
                    { value: 'AUTO', label: 'Dari penerimaan terakhir' },
                    { value: 'BLANK', label: 'Kosongkan (diisi tangan)' },
                    ...suppliers.map(s => ({ value: s.name, label: s.name, group: 'Supplier', hint: s.supplyCategory || undefined })),
                  ]}
                  onSelect={opt => opt && setLabelGlobalSupplier(opt.value)}
                  searchPlaceholder="Cari supplier..."
                  ariaLabel="Supplier"
                  noun="pilihan"
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Tanggal datang</label>
                <input
                  type="date"
                  value={labelArrivalDate}
                  onChange={e => setLabelArrivalDate(e.target.value)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Masa simpan</label>
                <input
                  type="text"
                  placeholder="Otomatis sesuai jenis bahan"
                  value={labelGlobalShelfLife}
                  onChange={e => setLabelGlobalShelfLife(e.target.value)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-600 font-medium">Batas pakai</label>
                </div>
                <input
                  type="text"
                  placeholder="Kosongkan untuk diisi tangan"
                  value={labelGlobalExpiryDate}
                  onChange={e => setLabelGlobalExpiryDate(e.target.value)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Catatan</label>
                <input
                  type="text"
                  placeholder="Kosongkan untuk diisi tangan"
                  value={labelCustomNote}
                  onChange={e => setLabelCustomNote(e.target.value)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Ukuran label</label>
                <Select className="w-full" size="sm"
                  value={labelGridCols}
                  onChange={e => setLabelGridCols(e.target.value as '2' | '3')}>
                  <option value="2">Besar, 2 kolom</option>
                  <option value="3">Kecil, 3 kolom</option>
                </Select>
              </div>

              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <label className={LABEL_CLS}>Cari</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Nama, kode, atau lokasi"
                    value={labelSearchQuery}
                    onChange={e => setLabelSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </>
          ) : activeForm === 'ITEM_TAG_LABEL' ? (
            <>
              <div>
                <label htmlFor="tag-source" className={LABEL_CLS}>Sumber data</label>
                <Select className="w-full"
                  id="tag-source"
                  value={tagSourceType}
                  onChange={e => setTagSourceType(e.target.value as 'FROM_GR' | 'FROM_ITEMS')}>
                  <option value="FROM_GR" disabled={receivingDocs.length === 0}>Dokumen penerimaan</option>
                  <option value="FROM_ITEMS">Daftar barang (tanpa jumlah)</option>
                </Select>
              </div>

              {tagSourceType === 'FROM_GR' ? (
                <div>
                  <label htmlFor="tag-gr" className={LABEL_CLS}>Dokumen penerimaan</label>
                  <SearchPicker
                    id="tag-gr"
                    value={tagSelectedGrId}
                    options={receivingDocs.map(d => ({ value: d.id, label: `${d.id} · ${d.supplierName}`, hint: formatLongDate(d.date) }))}
                    searchPlaceholder="Cari nomor dokumen atau supplier..."
                    placeholder="Pilih dokumen penerimaan"
                    noun="dokumen"
                    onSelect={opt => {
                      if (!opt) return;
                      const grId = opt.value;
                      setTagSelectedGrId(grId);
                      const doc = receivingDocs.find(d => d.id === grId);
                      if (doc) {
                        setTagGlobalSupplier(doc.supplierName);
                        setTagArrivalDate(doc.date);
                        setTagArrivalTime(doc.arrivalTime || '');
                      }
                    }}
                  />
                </div>
              ) : (
                <div>
                  <label className={LABEL_CLS}>Gudang</label>
                  <Select className="w-full" size="sm"
                    value={tagWarehouseFilter}
                    onChange={e => setTagWarehouseFilter(e.target.value as any)}>
                    <option value="ALL">Semua gudang</option>
                    <option value="GUDANG_BASAH">Gudang basah (chiller/freezer)</option>
                    <option value="GUDANG_KERING">Gudang kering</option>
                  </Select>
                </div>
              )}

              {/* 3. Ukuran Cetak (Muat Banyak per Lembar) */}
              <div>
                <label className={LABEL_CLS}>Ukuran tag</label>
                <Select className="w-full"
                  value={tagGridCols}
                  onChange={e => setTagGridCols(e.target.value as any)}>
                  <option value="4">Kecil, 16 per lembar</option>
                  <option value="3">Sedang, 12 per lembar</option>
                  <option value="2">Besar, 6 per lembar</option>
                </Select>
              </div>

              {/* 4. Supplier */}
              <div>
                <label className={LABEL_CLS}>Supplier</label>
                <input
                  type="text"
                  value={tagGlobalSupplier}
                  onChange={e => setTagGlobalSupplier(e.target.value)}
                  placeholder="Kosongkan untuk diisi tangan"
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-medium"
                />
              </div>

              {/* 5. Tanggal Datang */}
              <div>
                <label className={LABEL_CLS}>Tanggal datang</label>
                <input
                  type="date"
                  value={tagArrivalDate}
                  onChange={e => setTagArrivalDate(e.target.value)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-mono"
                />
              </div>

              {/* 6. Waktu / Jam Datang */}
              <div>
                <label className={LABEL_CLS}>Jam datang</label>
                <input
                  type="text"
                  value={tagArrivalTime}
                  onChange={e => setTagArrivalTime(e.target.value)}
                  placeholder="08:30"
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-mono font-semibold"
                />
              </div>

              {/* 7. Mode Estimasi Expired */}
              <div>
                <label className={LABEL_CLS}>Batas pakai</label>
                <Select className="w-full" size="sm"
                  value={tagExpiryMode}
                  onChange={e => setTagExpiryMode(e.target.value as any)}>
                  <option value="AUTO">Hitung dari masa simpan</option>
                  <option value="CUSTOM_DATE">Tanggal tertentu</option>
                  <option value="BLANK">Kosongkan (diisi tangan)</option>
                </Select>
              </div>

              {/* 8. Tanggal Expired Manual (jika CUSTOM_DATE) atau Salinan Tag */}
              {tagExpiryMode === 'CUSTOM_DATE' ? (
                <div>
                  <label className={LABEL_CLS}>Tanggal batas pakai</label>
                  <input
                    type="date"
                    value={tagManualExpiryDate}
                    onChange={e => setTagManualExpiryDate(e.target.value)}
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-mono"
                  />
                </div>
              ) : (
                <div>
                  <label className={LABEL_CLS}>Tag per barang</label>
                  <Select className="w-full" size="sm"
                    value={tagCopiesPerItem}
                    onChange={e => setTagCopiesPerItem(Number(e.target.value))}>
                    <option value={1}>1 tag</option>
                    <option value={2}>2 tag (2 wadah)</option>
                    <option value={3}>3 tag (3 wadah)</option>
                    <option value={4}>4 tag (4 wadah)</option>
                    <option value={5}>5 tag (5 wadah)</option>
                    <option value={8}>8 tag (8 wadah)</option>
                    <option value={10}>10 tag (10 wadah)</option>
                  </Select>
                </div>
              )}

              {/* 9. Petugas QC / Pemeriksa */}
              <div>
                <label className={LABEL_CLS}>Pemeriksa</label>
                <input
                  type="text"
                  value={tagInspectorName}
                  onChange={e => setTagInspectorName(e.target.value)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              {/* 10. Status Uji QC Mutu */}
              <div>
                <label className={LABEL_CLS}>Hasil QC</label>
                <Select className="w-full" size="sm"
                  value={tagQcStatus}
                  onChange={e => setTagQcStatus(e.target.value)}>
                  <option value="Lolos QC Organoleptik & Higiene">Lolos QC organoleptik & higiene</option>
                  <option value="Karantina / Uji Organoleptik">Karantina, perlu cek ulang</option>
                  <option value="">Kosongkan (diisi tangan)</option>
                </Select>
              </div>

              {/* 11. Cari Bahan */}
              <div className="sm:col-span-2">
                <label className={LABEL_CLS}>Cari</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={tagSearchQuery}
                    onChange={e => setTagSearchQuery(e.target.value)}
                    placeholder="Nama bahan atau nomor lot"
                    className="w-full pl-8 pr-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>
              </div>
            </>
          ) : activeForm === 'RACK_LABEL' ? (
            <>
              <div>
                <label className={LABEL_CLS}>Gudang</label>
                <Select className="w-full" size="sm"
                  value={rackWarehouseFilter}
                  onChange={e => {
                    setRackWarehouseFilter(e.target.value as any);
                    setRackSelectedId('ALL');
                    setHasCustomRackSelection(false);
                  }}>
                  <option value="ALL">Semua gudang</option>
                  <option value="GUDANG_KERING">Gudang kering (pangan)</option>
                  <option value="GUDANG_NONFOOD">Gudang non-food (sanitasi, kemasan, APD & P3K)</option>
                  <option value="GUDANG_BASAH">Gudang basah (chiller/freezer)</option>
                </Select>
              </div>

              <div>
                <label className={LABEL_CLS}>Rak</label>
                <Select className="w-full" size="sm"
                  value={rackSelectedId}
                  onChange={e => {
                    setRackSelectedId(e.target.value);
                    setHasCustomRackSelection(false);
                  }}>
                  <option value="ALL">Semua rak ({allWarehouseRacks.length})</option>
                  {allWarehouseRacks
                    .filter(r => {
                      if (rackWarehouseFilter === 'ALL') return true;
                      if (rackWarehouseFilter === 'GUDANG_NONFOOD') return r.id.includes('-N');
                      if (rackWarehouseFilter === 'GUDANG_KERING') return r.warehouseType === 'GUDANG_KERING' && !r.id.includes('-N');
                      return r.warehouseType === rackWarehouseFilter;
                    })
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        {r.id} • {r.name} ({r.items.length} item)
                      </option>
                    ))}
                </Select>
              </div>

              <div>
                <label className={LABEL_CLS}>Ukuran plakat</label>
                <Select className="w-full" size="sm"
                  value={rackLayoutMode}
                  onChange={e => setRackLayoutMode(e.target.value as '1' | '2')}>
                  <option value="2">2 plakat per A4</option>
                  <option value="1">1 plakat per A4</option>
                </Select>
              </div>

              <div>
                <label className={LABEL_CLS}>Penanggung jawab</label>
                <input
                  type="text"
                  placeholder="Kosongkan untuk diisi tangan"
                  value={rackGlobalPic}
                  onChange={e => setRackGlobalPic(e.target.value)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              <div>
                <label className={LABEL_CLS}>Catatan</label>
                <input
                  type="text"
                  placeholder="Opsional"
                  value={rackGlobalNote}
                  onChange={e => setRackGlobalNote(e.target.value)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-3">
                <label className={LABEL_CLS}>Cari</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Kode rak, nama rak, atau barang"
                    value={rackSearchQuery}
                    onChange={e => setRackSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </>
          ) : null}

          {activeForm === 'RECEIVING_FORM' && (
            <div className="sm:col-span-2">
              <label htmlFor="rcv-doc" className={LABEL_CLS}>Dokumen penerimaan</label>
              <SearchPicker
                id="rcv-doc"
                value={selectedReceivingId}
                options={[
                  { value: 'BLANK', label: 'Form kosong (diisi tangan)' },
                  ...receivingDocs.map(d => ({ value: d.id, label: `${d.id} · ${d.supplierName}`, group: 'Dokumen penerimaan', hint: formatLongDate(d.date) })),
                ]}
                onSelect={opt => opt && setSelectedReceivingId(opt.value)}
                searchPlaceholder="Cari nomor dokumen atau supplier..."
                noun="pilihan"
              />
            </div>
          )}

          {activeForm === 'OPNAME_SHEET' && (
            <div className="sm:col-span-2">
              <label htmlFor="opn-loc" className={LABEL_CLS}>Lokasi</label>
              <Select className="w-full" id="opn-loc" value={opnameLocation} onChange={e => setOpnameLocation(e.target.value)}>
                <option value="ALL">Semua lokasi</option>
                <option value="Gudang Kering">Gudang kering</option>
                <option value="Gudang Non-Food">Gudang non-food (sanitasi, kemasan, APD & P3K)</option>
                <option value="Chiller">Chiller</option>
                <option value="Freezer">Freezer</option>
                <option value="Dapur">Dapur</option>
              </Select>
            </div>
          )}

          {activeForm === 'SOP_STORAGE' && (
            <div className="sm:col-span-2">
              <label htmlFor="sop-place" className={LABEL_CLS}>Tempat</label>
              <Select className="w-full" id="sop-place" value={sopPlace} onChange={e => setSopPlace(e.target.value as SopPlace | 'ALL')}>
                {SOP_PLACE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          )}

          {activeForm === 'DO_DONT_POSTER' && (
            <div className="sm:col-span-2">
              <label htmlFor="dodont-target" className={LABEL_CLS}>Plakat</label>
              <Select className="w-full" id="dodont-target" value={doDontTarget} onChange={e => setDoDontTarget(e.target.value as DoDontTarget)}>
                {DO_DONT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </div>
          )}

          {activeForm === 'BIN_CARD' && (
            <div className="sm:col-span-2">
              <label htmlFor="bin-item" className={LABEL_CLS}>Barang</label>
              <SearchPicker
                id="bin-item"
                value={selectedItemId}
                options={[...items]
                  .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
                  .map(i => ({ value: i.id, label: i.name, group: i.category, hint: i.location }))}
                onSelect={opt => opt && setSelectedItemId(opt.value)}
                placeholder={items.length === 0 ? 'Belum ada barang terdaftar' : 'Pilih barang'}
                searchPlaceholder="Cari nama barang..."
                noun="barang"
              />
            </div>
          )}

          {activeForm === 'KITCHEN_REQUISITION' && (
            <>
              <div>
                <label htmlFor="kr-portions" className={LABEL_CLS}>Target porsi</label>
                <input id="kr-portions" type="number" min="0" value={targetPortions || ''} placeholder="Kosongkan untuk diisi tangan" onChange={e => setTargetPortions(Number(e.target.value) || 0)} className={INPUT_CLS} />
              </div>
              <div>
                <label htmlFor="kr-pic" className={LABEL_CLS}>Peminta (dapur)</label>
                <input id="kr-pic" type="text" value={kitchenPic} placeholder="Kosongkan untuk diisi tangan" onChange={e => setKitchenPic(e.target.value)} className={INPUT_CLS} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="kr-menu" className={LABEL_CLS}>Menu</label>
                <input id="kr-menu" type="text" value={menuToday} placeholder="Kosongkan untuk diisi tangan" onChange={e => setMenuToday(e.target.value)} className={INPUT_CLS} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Printable Paper Document Container */}
      <div
        id="print-area"
        className={`bg-white rounded-xl border border-slate-200 max-w-4xl mx-auto font-sans text-slate-900 overflow-x-auto ${
          activeForm === 'EQUIPMENT_LABEL' || activeForm === 'RACK_LABEL' || activeForm === 'RACK_SIGN' || activeForm === 'PHOTO_DOC' || activeForm === 'PIC_HANDOVER' || activeForm === 'EXPENSE_RECEIPT_BATCH' || activeForm === 'DAILY_PO_SHEET' || activeForm === 'ITEM_TAG_LABEL' || activeForm === 'DO_DONT_POSTER' ? 'p-4 sm:p-6' : 'p-5 sm:p-10'
        }`}
      >
        {/* Kop dokumen, sama dengan Laporan Pengeluaran. Label dan plakat dicetak tanpa kop; SOP memasang kop di tiap lembarnya. */}
        {activeForm !== 'EQUIPMENT_LABEL' && activeForm !== 'RACK_LABEL' && activeForm !== 'RACK_SIGN' && activeForm !== 'PHOTO_DOC' && activeForm !== 'PIC_HANDOVER' && activeForm !== 'EXPENSE_RECEIPT_BATCH' && activeForm !== 'DAILY_PO_SHEET' && activeForm !== 'ITEM_TAG_LABEL' && activeForm !== 'SOP_STORAGE' && activeForm !== 'DO_DONT_POSTER' && (
          <div className="border-b-2 border-slate-900 pb-3 mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <SppgLogo size="lg" variant="color" showText={false} />
              <KopText />
            </div>
            <div className="text-right text-[11px] text-slate-600 space-y-0.5 shrink-0">
              <div>Dicetak: {formatLongDate(localDateIso())}</div>
              <div>Oleh: {currentUser?.name || BLANK}</div>
            </div>
          </div>
        )}

        {/* 1. Berita acara penerimaan */}
        {activeForm === 'RECEIVING_FORM' && (
          <div className="space-y-5 text-xs">
            <DocTitle
              title="Berita Acara Penerimaan Barang"
              subtitle={`No. ${selectedReceivingDoc ? selectedReceivingDoc.id : BLANK}`}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <Field label="Supplier" value={selectedReceivingDoc?.supplierName} />
              <Field label="Penerima" value={selectedReceivingDoc ? `${selectedReceivingDoc.receiverName} (${ROLE_LABEL[selectedReceivingDoc.receiverRole] || selectedReceivingDoc.receiverRole})` : undefined} />
              <Field label="No. surat jalan" value={selectedReceivingDoc?.deliveryNoteNo} mono />
              <Field
                label="Status"
                value={selectedReceivingDoc ? (selectedReceivingDoc.status === 'VERIFIED_POSTED' ? 'Diverifikasi, masuk stok' : 'Draf') : undefined}
              />
              <Field
                label="Waktu datang"
                value={selectedReceivingDoc ? `${formatLongDate(selectedReceivingDoc.date)}, ${selectedReceivingDoc.arrivalTime} WIB` : `${formatLongDate(printDate)}, pukul ..........`}
              />
              <Field label="Suhu kendaraan" value={undefined} blank=".......... °C" />
            </div>

            <table className="w-full border-collapse border border-slate-300 table-print">
              <thead className="bg-slate-100 text-slate-800 font-semibold">
                <tr>
                  <th className="border border-slate-300 p-1.5 w-8 text-center">No</th>
                  <th className="border border-slate-300 p-1.5 text-left">Barang</th>
                  <th className="border border-slate-300 p-1.5 text-left">Kategori</th>
                  <th className="border border-slate-300 p-1.5 text-right w-20">Jumlah</th>
                  <th className="border border-slate-300 p-1.5 text-center w-16">Satuan</th>
                  <th className="border border-slate-300 p-1.5 text-left">Kondisi / batch</th>
                  <th className="border border-slate-300 p-1.5 text-center w-14">Sesuai</th>
                </tr>
              </thead>
              <tbody>
                {selectedReceivingDoc && selectedReceivingDoc.lines.length > 0
                  ? selectedReceivingDoc.lines.map((line, idx) => (
                      <tr key={line.id} className="h-8">
                        <td className="border border-slate-300 p-1.5 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 p-1.5 font-semibold">{line.itemName}</td>
                        <td className="border border-slate-300 p-1.5 text-slate-700">{line.category}</td>
                        <td className="border border-slate-300 p-1.5 text-right font-mono font-semibold">{line.quantity}</td>
                        <td className="border border-slate-300 p-1.5 text-center">{line.unit}</td>
                        <td className="border border-slate-300 p-1.5 text-slate-700">
                          {[line.conditionNote, line.batchNumber].filter(Boolean).join(', ')}
                        </td>
                        <td className="border border-slate-300 p-1.5"></td>
                      </tr>
                    ))
                  : Array.from({ length: 10 }).map((_, idx) => (
                      <tr key={idx} className="h-8">
                        <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-500">{idx + 1}</td>
                        {Array.from({ length: 6 }).map((__, c) => (
                          <td key={c} className="border border-slate-300 p-1.5"></td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>

            <div className="border border-slate-300 rounded p-2.5 min-h-[56px]">
              <span className="font-semibold text-slate-800">Catatan pemeriksaan:</span>{' '}
              <span className="text-slate-700">{selectedReceivingDoc?.notes || ''}</span>
            </div>

            <div className="grid grid-cols-2 gap-8 pt-2">
              <SignBox
                role="Pengirim (supplier)"
                name={selectedReceivingDoc?.supplierName}
                signature={selectedReceivingDoc?.supplierSignature}
              />
              <SignBox
                role="Penerima gudang"
                name={selectedReceivingDoc?.receiverName}
                signature={selectedReceivingDoc?.receiverSignature}
              />
            </div>
          </div>
        )}

        {/* 2. Lembar hitung fisik stok opname */}
        {activeForm === 'OPNAME_SHEET' && (
          <div className="space-y-5 text-xs">
            <DocTitle
              title="Lembar Hitung Fisik Stok Opname"
              subtitle={`${opnameLocation === 'ALL' ? 'Semua lokasi' : opnameLocation}, ${formatLongDate(printDate)}`}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1.5">
              <Field label="Penghitung" value={undefined} />
              <Field label="Saksi" value={undefined} />
              <Field label="Jumlah barang" value={`${filteredOpnameItems.length} barang`} />
            </div>

            {filteredOpnameItems.length === 0 ? (
              <p className="py-8 text-center text-slate-600 border border-dashed border-slate-300 rounded">
                Tidak ada barang di lokasi ini.
              </p>
            ) : (
              <table className="w-full border-collapse border border-slate-300 table-print">
                <thead className="bg-slate-100 text-slate-800 font-semibold">
                  <tr>
                    <th className="border border-slate-300 p-1.5 w-8 text-center">No</th>
                    <th className="border border-slate-300 p-1.5 text-left w-24">Kode</th>
                    <th className="border border-slate-300 p-1.5 text-left">Barang</th>
                    <th className="border border-slate-300 p-1.5 text-left w-32">Lokasi</th>
                    <th className="border border-slate-300 p-1.5 text-center w-14">Satuan</th>
                    <th className="border border-slate-300 p-1.5 text-right w-20">Stok sistem</th>
                    <th className="border border-slate-300 p-1.5 text-center w-24">Hitung fisik</th>
                    <th className="border border-slate-300 p-1.5 text-left w-32">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpnameItems.map((item, idx) => (
                    <tr key={item.id} className="h-8">
                      <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-600">{idx + 1}</td>
                      <td className="border border-slate-300 p-1.5 font-mono">{item.id}</td>
                      <td className="border border-slate-300 p-1.5 font-semibold">{item.name}</td>
                      <td className="border border-slate-300 p-1.5 text-slate-700">{item.location}</td>
                      <td className="border border-slate-300 p-1.5 text-center">{item.baseUnit}</td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono">{item.currentStock}</td>
                      <td className="border border-slate-300 p-1.5"></td>
                      <td className="border border-slate-300 p-1.5"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="grid grid-cols-2 gap-8 pt-2">
              <SignBox role="Petugas hitung" />
              <SignBox role="Kepala gudang" />
            </div>
          </div>
        )}

        {/* 3. Kartu stok gantung */}
        {activeForm === 'BIN_CARD' && !selectedItem && (
          <p className="py-10 text-center text-xs text-slate-600">Belum ada barang terdaftar. Tambahkan barang di menu Stok terlebih dahulu.</p>
        )}
        {activeForm === 'BIN_CARD' && selectedItem && (
          <div className="space-y-5 text-xs">
            <DocTitle title="Kartu Stok" subtitle="Digantung di rak, diisi setiap barang masuk atau keluar" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 border-2 border-slate-900 rounded p-3">
              <Field label="Barang" value={selectedItem.name} strong />
              <Field label="Lokasi" value={selectedItem.location} />
              <Field label="Kode" value={selectedItem.id} mono />
              <Field label="Satuan" value={selectedItem.baseUnit} />
              <Field label="Kategori" value={selectedItem.category} />
              <Field label="Stok minimum" value={`${selectedItem.minimumStock} ${selectedItem.baseUnit}`} />
            </div>

            <table className="w-full border-collapse border border-slate-900 table-print">
              <thead className="bg-slate-100 text-slate-900 font-semibold">
                <tr>
                  <th className="border border-slate-900 p-1.5 w-24">Tanggal</th>
                  <th className="border border-slate-900 p-1.5 text-left">No. bukti</th>
                  <th className="border border-slate-900 p-1.5 text-right w-20">Masuk</th>
                  <th className="border border-slate-900 p-1.5 text-right w-20">Keluar</th>
                  <th className="border border-slate-900 p-1.5 text-right w-20">Sisa</th>
                  <th className="border border-slate-900 p-1.5 text-center w-20">Paraf</th>
                </tr>
              </thead>
              <tbody>
                <tr className="h-8 font-semibold">
                  <td className="border border-slate-900 p-1.5 text-center">{formatDisplayDate(parseLocalDate(printDate))}</td>
                  <td className="border border-slate-900 p-1.5">Saldo saat kartu dicetak</td>
                  <td className="border border-slate-900 p-1.5"></td>
                  <td className="border border-slate-900 p-1.5"></td>
                  <td className="border border-slate-900 p-1.5 text-right font-mono">{selectedItem.currentStock}</td>
                  <td className="border border-slate-900 p-1.5"></td>
                </tr>
                {Array.from({ length: 14 }).map((_, idx) => (
                  <tr key={idx} className="h-8">
                    {Array.from({ length: 6 }).map((__, c) => (
                      <td key={c} className="border border-slate-900 p-1.5"></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. Bon permintaan bahan dapur: baris kosong, diisi tangan oleh dapur dan gudang */}
        {activeForm === 'KITCHEN_REQUISITION' && (
          <div className="space-y-5 text-xs">
            <DocTitle title="Bon Permintaan Bahan Dapur" subtitle="Serah terima bahan dari gudang ke dapur" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <Field label="Tanggal masak" value={formatLongDate(printDate)} />
              <Field label="Target porsi" value={targetPortions > 0 ? `${targetPortions.toLocaleString('id-ID')} porsi` : undefined} />
              <div className="sm:col-span-2">
                <Field label="Menu" value={menuToday || undefined} />
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 table-print">
              <thead className="bg-slate-100 text-slate-800 font-semibold">
                <tr>
                  <th className="border border-slate-300 p-1.5 w-8 text-center">No</th>
                  <th className="border border-slate-300 p-1.5 text-left">Bahan</th>
                  <th className="border border-slate-300 p-1.5 text-right w-24">Diminta</th>
                  <th className="border border-slate-300 p-1.5 text-right w-24">Diserahkan</th>
                  <th className="border border-slate-300 p-1.5 text-center w-16">Satuan</th>
                  <th className="border border-slate-300 p-1.5 text-left w-40">Kondisi / suhu</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 14 }).map((_, idx) => (
                  <tr key={idx} className="h-8">
                    <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-500">{idx + 1}</td>
                    {Array.from({ length: 5 }).map((__, c) => (
                      <td key={c} className="border border-slate-300 p-1.5"></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-3 gap-6 pt-2">
              <SignBox role="Diminta (dapur)" name={kitchenPic || undefined} />
              <SignBox role="Diserahkan (gudang)" name={currentUser?.name} />
              <SignBox role="Mengetahui (Kepala SPPG)" name={headOfficeName || undefined} />
            </div>
          </div>
        )}

        {/* Log pengambilan non-food: kolomnya sama dengan layar "Input dari form kertas" di Barang Keluar,
            jadi penyalinan cukup baris demi baris. Daftar barang di bawah agar nama yang ditulis cocok dengan master. */}
        {activeForm === 'NONFOOD_ISSUE_FORM' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-sm font-bold text-slate-900">Form Pengambilan Barang Non-Food</h2>
                <p className="text-xs text-slate-700">Barang operasional yang diambil dari gudang</p>
                <div className="pt-1.5">
                  <Field label="Tanggal" value={formatLongDate(printDate)} />
                </div>
              </div>
              <div className="flex flex-col items-center shrink-0 border border-slate-900 rounded-md p-1.5 bg-white text-center">
                <QrSvg value={buildScanUrl(NONFOOD_ISSUE_CODE)} className="w-14 h-14" />
                <span className="text-[8px] font-semibold text-slate-900 mt-1">Pindai QR</span>
                <span className="text-[7.5px] text-slate-600 leading-tight">Input Pengeluaran<br />Operasional</span>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 table-print">
              <thead className="bg-slate-100 text-slate-800 font-semibold">
                <tr>
                  <th className="border border-slate-300 p-1.5 w-8 text-center">No</th>
                  <th className="border border-slate-300 p-1.5 text-left">Nama barang</th>
                  <th className="border border-slate-300 p-1.5 text-right w-14">Qty</th>
                  <th className="border border-slate-300 p-1.5 text-center w-16">Satuan</th>
                  <th className="border border-slate-300 p-1.5 text-left w-32">Nama relawan</th>
                  <th className="border border-slate-300 p-1.5 text-left w-28">PIC</th>
                  <th className="border border-slate-300 p-1.5 text-center w-16">Paraf</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 20 }).map((_, idx) => (
                  <tr key={idx} className="h-8">
                    <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-500">{idx + 1}</td>
                    {Array.from({ length: 6 }).map((__, c) => (
                      <td key={c} className="border border-slate-300 p-1.5"></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-start justify-between gap-4 break-inside-avoid">
              <div className="text-[10px] text-slate-700 leading-snug space-y-0.5">
                <p>• Catat setiap pengambilan barang operasional (tisu, sabun, ATK, gas, kemasan, dll.) dari gudang.</p>
                <p>• Tulis nama barang sesuai daftar resmi di bawah agar sesuai dengan Master Barang di aplikasi.</p>
                <p>• Pindai QR di pojok kanan atas untuk langsung input pengeluaran operasional di aplikasi (Barang Keluar &gt; Operasional).</p>
              </div>
            </div>

            {nonFoodItems.length > 0 && (
              <div className="break-inside-avoid">
                <p className="font-semibold text-slate-800 mb-1.5">Nama barang di gudang (tulis sesuai daftar ini)</p>
                <ul className="columns-2 sm:columns-3 print:columns-3 gap-6 text-[10px] text-slate-700 leading-relaxed">
                  {nonFoodItems.map(item => (
                    <li key={item.id} className="break-inside-avoid">
                      {item.name} <span className="text-slate-500">({item.baseUnit})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeForm === 'SOP_STORAGE' && (
          <SopGudangDoc
            items={items}
            place={sopPlace}
            effectiveDate={formatLongDate(printDate)}
            printedDate={formatLongDate(localDateIso())}
            printedBy={currentUser?.name || BLANK}
          />
        )}

        {activeForm === 'WASTE_RECAP_FORM' && wasteRecap && (
          <div className="space-y-4 text-xs">
            <DocTitle
              title="Form Rekapitulasi Limbah"
              subtitle={wasteRecap.monthLabel ? `Hari timbang Senin-Jumat · ${wasteRecap.monthLabel}` : `Hari timbang Senin-Jumat · Periode ${BLANK.slice(0, 24)}`}
            />

            {(() => {
              const fmt = (n: number) => n.toLocaleString('id-ID', { maximumFractionDigits: 2 });
              const CELL = 'border border-slate-400 px-1.5';
              const dayTotal = (date: string) => NUTRITION.reduce((sum, n) => sum + (wasteRecap.values[date]?.[n.key] || 0), 0);
              const periodTotal = wasteRecap.days.reduce((sum, date) => sum + (date ? dayTotal(date) : 0), 0);
              return (
                <table className="w-full border-collapse border border-slate-400 table-print text-[11px]">
                  <thead className="bg-slate-100 text-slate-800 font-semibold">
                    <tr>
                      <th className={`${CELL} py-1 w-8 text-center`}>No</th>
                      <th className={`${CELL} py-1 w-28 text-left`}>Tanggal</th>
                      <th className={`${CELL} py-1 w-32 text-left`}>Jenis limbah</th>
                      <th className={`${CELL} py-1 w-16 text-right`}>Jumlah</th>
                      <th className={`${CELL} py-1 w-14 text-center`}>Satuan</th>
                      <th className={`${CELL} py-1 text-left`}>Rincian timbangan</th>
                      <th className={`${CELL} py-1 w-24 text-center`}>Ttd petugas</th>
                    </tr>
                  </thead>
                  {wasteRecap.days.map((date, idx) => {
                    const d = date ? new Date(`${date}T00:00:00`) : null;
                    const total = date ? dayTotal(date) : 0;
                    return (
                      // Satu hari satu tbody, supaya blok harian tidak terpotong ke halaman berikutnya
                      <tbody key={date || idx} className="break-inside-avoid">
                        {NUTRITION.map((n, ni) => {
                          const v = date ? wasteRecap.values[date]?.[n.key] : undefined;
                          return (
                            <tr key={n.key} className="h-[5.5mm]">
                              {ni === 0 && (
                                <>
                                  <td rowSpan={NUTRITION.length + 1} className={`${CELL} text-center align-top pt-1 font-mono text-slate-600`}>{idx + 1}</td>
                                  <td rowSpan={NUTRITION.length + 1} className={`${CELL} align-top pt-1`}>
                                    {d ? `${d.toLocaleDateString('id-ID', { weekday: 'long' })}, ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                                  </td>
                                </>
                              )}
                              <td className={CELL}>{n.label}</td>
                              <td className={`${CELL} text-right font-mono`}>{v ? fmt(v) : ''}</td>
                              <td className={`${CELL} text-center`}>{v ? 'kg' : ''}</td>
                              {/* Ruang tulis hasil timbang satu per satu (bisa sampai 10 angka), jumlahnya di kolom kiri */}
                              <td className={CELL} />
                              {ni === 0 && <td rowSpan={NUTRITION.length + 1} className={CELL} />}
                            </tr>
                          );
                        })}
                        <tr className="h-[6mm] bg-slate-50 font-semibold">
                          <td className={CELL}>Total hari ini</td>
                          <td className={`${CELL} text-right font-mono`}>{total > 0 ? fmt(total) : ''}</td>
                          <td className={`${CELL} text-center`}>{total > 0 ? 'kg' : ''}</td>
                          <td className={CELL} />
                        </tr>
                      </tbody>
                    );
                  })}
                  <tfoot className="bg-slate-100 font-bold">
                    <tr className="h-[7mm]">
                      <td colSpan={3} className={CELL}>Total per periode</td>
                      <td className={`${CELL} text-right font-mono`}>{periodTotal > 0 ? fmt(periodTotal) : ''}</td>
                      <td className={`${CELL} text-center`}>{periodTotal > 0 ? 'kg' : ''}</td>
                      <td colSpan={2} className={CELL} />
                    </tr>
                  </tfoot>
                </table>
              );
            })()}

            <div className="flex items-start justify-between gap-4 break-inside-avoid">
              <div className="text-[10px] text-slate-700 leading-snug space-y-0.5">
                <p>Jumlah ditulis dengan koma, misalnya 2,5, dan satuannya diisi (kg atau gram). Di aplikasi semua dicatat dalam kg: 500 gram = 0,5 kg.</p>
                <p>Hari libur atau tanpa masak cukup dicoret.</p>
                <p>Pindai QR di samping untuk langsung mencatat sisa makanan hari ini di aplikasi. Urutan jenis limbahnya sama dengan isian di aplikasi.</p>
              </div>
              <div className="flex flex-col items-center shrink-0 border border-slate-900 rounded-md p-1">
                <QrSvg value={buildScanUrl(WASTE_ENTRY_CODE)} className="w-16 h-16" />
                <span className="text-[8px] font-semibold text-slate-900 mt-0.5">Catat limbah</span>
              </div>
            </div>

            {/* Susunan tanda tangan mengikuti form limbah yang biasa dipakai: keterangan, jabatan, ruang ttd, nama */}
            <div className="grid grid-cols-2 gap-6 pt-2 text-center text-xs break-inside-avoid">
              {[
                { top: 'Mengetahui,', role: 'Akuntan SPPG Tumpang Jeru', name: warehouseDb.getSignerName('AKUNTAN') },
                { top: `Malang, ${BLANK.slice(0, 20)}`, role: 'Asisten Lapangan', name: warehouseDb.getSignerName('ASLAP') },
              ].map(sg => (
                <div key={sg.role}>
                  <p className="text-slate-800">{sg.top}</p>
                  <p className="text-slate-800">{sg.role}</p>
                  <div className="h-16" />
                  <p className="font-semibold text-slate-900">({sg.name || BLANK})</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeForm === 'PHOTO_DOC' && <PhotoDocSheet onCountChange={setPhotoPageCount} />}

        {activeForm === 'PIC_HANDOVER' && <PicHandoverDoc onCountChange={setPicReceiptCount} />}

        {activeForm === 'EXPENSE_RECEIPT_BATCH' && <ExpenseReceiptDoc onCountChange={setExpenseReceiptCount} />}

        {activeForm === 'DAILY_PO_SHEET' && <DailyPoSheetDoc initialDate={initialDate} onCountChange={setPoSheetCount} />}

        {activeForm === 'RACK_SIGN' && (
          <RackSignDoc racks={allWarehouseRacks} items={items} customRacks={customRacks} onCountChange={setSignCount} />
        )}

        {activeForm === 'DO_DONT_POSTER' && (
          <DoDontPosterDoc
            target={doDontTarget}
            effectiveDate={formatLongDate(printDate)}
          />
        )}

        {/* Tag bahan datang: tanpa kop agar satu A4 muat hingga 16 tag */}
        {activeForm === 'ITEM_TAG_LABEL' && (
          <div className="space-y-4">
            <SelectionBar
              selected={itemTagsToPrint.length}
              total={filteredItemTags.length}
              unit="tag"
              allSelected={!tagHasCustomSelection || tagSelectedKeys.length === filteredItemTags.length}
              onToggleAll={toggleSelectAllItemTags}
            />

            {/* Tags Grid */}
            {filteredItemTags.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Tidak ada tag item yang sesuai dengan filter atau kata kunci pencarian.
              </div>
            ) : (
              <div
                className={`grid ${
                  tagGridCols === '4'
                    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 print:grid-cols-4 gap-2.5 print:gap-1.5'
                    : tagGridCols === '3'
                    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-3 print:gap-2'
                    : 'grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-3.5 print:gap-2.5'
                }`}
              >
                {filteredItemTags.map(tag => {
                  const isSelected = !tagHasCustomSelection || tagSelectedKeys.includes(tag.uniqueKey);
                  const isMini = tagGridCols === '4';
                  const isCompact = tagGridCols === '3';

                  return (
                    <div
                      key={tag.uniqueKey}
                      className={`relative border-2 border-slate-800 rounded-lg p-2.5 bg-white flex flex-col justify-between gap-2 break-inside-avoid ${
                        !isSelected ? 'opacity-40 border-slate-300 no-print' : ''
                      } print:border-slate-800 print:p-2`}
                    >
                      {/* Screen selection checkbox */}
                      <div className="no-print absolute top-1.5 right-1.5 z-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItemTag(tag.uniqueKey)}
                          className="w-5 h-5 accent-emerald-700 rounded cursor-pointer"
                          aria-label={`Cetak tag ${tag.name}`}
                        />
                      </div>

                      {/* Tag Header */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1 pr-4">
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="font-bold text-[8.5px] text-slate-800 truncate">
                            SPPG Tumpang Jeru
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {tag.totalCopies > 1 && (
                            <span className="px-1 rounded-md text-[7.5px] font-mono font-bold text-slate-800 border border-slate-400">
                              Wadah {tag.copyIndex}/{tag.totalCopies}
                            </span>
                          )}
                          <span className="px-1 rounded-md text-[7.5px] font-bold text-slate-800 border border-slate-400">
                            {tag.warehouseType === 'GUDANG_BASAH' ? 'FEFO' : 'FIFO'}
                          </span>
                        </div>
                      </div>

                      {/* Main Item Name & Lot ID */}
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="font-mono font-bold text-[8px] text-slate-600">
                            {tag.batchLotNo}
                          </div>
                          <h4
                            className={`font-bold text-slate-900 leading-snug line-clamp-2 ${
                              isMini ? 'text-[11px]' : isCompact ? 'text-xs' : 'text-sm'
                            }`}
                          >
                            {tag.name}
                          </h4>
                          <div className="text-[8px] text-slate-600 truncate">
                            <span className="font-medium text-slate-800">{tag.category}</span>
                            {tag.quantity !== undefined && (
                              <span className="ml-1 font-mono font-bold text-slate-900">
                                • {tag.quantity} {tag.unit}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* High Contrast Compact QR Code */}
                        <div
                          className={`flex flex-col items-center justify-center p-0.5 border border-slate-900 rounded bg-white shrink-0 text-center ${
                            isMini ? 'w-12 h-12' : isCompact ? 'w-14 h-14' : 'w-16 h-16'
                          }`}
                        >
                          <QrSvg value={isMini ? tag.id : buildScanUrl(tag.id, tag.receivingId)} className={isMini ? 'w-9 h-9' : isCompact ? 'w-10 h-10' : 'w-12 h-12'} />
                          <span className="text-[6.5px] font-mono font-bold text-slate-800 truncate w-full mt-0.2">
                            {tag.id}
                          </span>
                        </div>
                      </div>

                      {/* Batas pakai dibuat paling menonjol: itu yang dicek dapur sebelum memakai isi wadah */}
                      <div className="pt-1 border-t border-slate-300 text-[8.5px] space-y-0.5">
                        <div className="flex items-center gap-1 text-slate-800 truncate">
                          <span className="text-slate-600 font-medium">Supplier:</span>
                          <span className="font-bold text-slate-900 truncate">{tag.supplier || <span className="font-normal text-slate-600">{BLANK}</span>}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-800 truncate">
                          <span className="text-slate-600 font-medium">Datang:</span>
                          <span className="font-mono font-bold text-slate-900">{tag.arrivalDateFormatted}</span>
                          <span className="font-mono font-bold text-slate-900">
                            {tag.arrivalTime || <span className="font-normal text-slate-600">..:..</span>}
                          </span>
                        </div>
                        <div className="text-[7.5px] text-slate-600 truncate">
                          Masa simpan: <span className="font-medium text-slate-900">{tag.shelfLifeText}</span>
                        </div>
                        <div className="pt-0.5 border-t border-slate-300 flex items-center justify-between">
                          <span className="text-slate-900 font-bold">Batas pakai</span>
                          {tag.expiryDate ? (
                            <span className="font-mono font-bold text-rose-700 text-[9.5px]">{tag.expiryDate}</span>
                          ) : (
                            <span className="font-mono text-slate-600">..../..../........</span>
                          )}
                        </div>
                      </div>

                      {/* Detail Tambahan: Lokasi, QC & Petugas */}
                      <div className="grid grid-cols-2 gap-1 text-[7.5px] text-slate-600 pt-0.5 border-t border-slate-300">
                        <div className="truncate">
                          <span className="text-slate-600 block text-[6.5px]">Penyimpanan</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {tag.storageTemp}
                          </span>
                        </div>
                        <div className="text-right truncate">
                          <span className="text-slate-600 block text-[6.5px]">{tag.qcStatus || 'Hasil QC: ..........'}</span>
                          <span className="font-semibold text-slate-900 truncate block">
                            {tag.inspector || BLANK}
                          </span>
                        </div>
                      </div>

                      {/* Area Catatan Lapangan / Paraf Dapur */}
                      <div className="pt-0.5 border-t border-slate-300 flex items-center justify-between text-[7px] text-slate-700">
                        <span className="truncate">Catatan: {tag.notes || '..........'}</span>
                        <span className="shrink-0">Paraf: ..........</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Label barang & aset: tanpa kop */}
        {activeForm === 'EQUIPMENT_LABEL' && (
          <div className="space-y-4">
            <SelectionBar
              selected={labelsToPrint.length}
              total={filteredLabels.length}
              unit="label"
              allSelected={!hasCustomSelection || selectedLabelIds.length === filteredLabels.length}
              onToggleAll={toggleSelectAll}
            />

            {/* Labels Grid */}
            {filteredLabels.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Tidak ada label yang sesuai dengan filter atau kata kunci pencarian.
              </div>
            ) : (
              <div
                className={`grid ${
                  labelGridCols === '3'
                    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 print:grid-cols-3'
                    : 'grid-cols-1 sm:grid-cols-2 gap-3.5 print:grid-cols-2'
                }`}
              >
                {filteredLabels.map(label => {
                  const isSelected = !hasCustomSelection || selectedLabelIds.includes(label.id);
                  return (
                    <div
                      key={label.id}
                      className={`relative border-2 border-slate-800 rounded-lg p-3.5 bg-white flex flex-col justify-between gap-2.5 break-inside-avoid ${
                        !isSelected ? 'opacity-40 border-slate-300 no-print' : ''
                      }`}
                    >
                      {/* Screen selection checkbox */}
                      <div className="no-print absolute top-2 right-2 z-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLabel(label.id)}
                          className="w-5 h-5 accent-emerald-700 rounded cursor-pointer"
                          aria-label={`Cetak label ${label.name}`}
                        />
                      </div>

                      {/* Label Top Bar */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 pr-5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-[10px] text-slate-800 truncate">
                            SPPG Tumpang Jeru
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {labelOverrides[label.id] && (
                            <span className="no-print px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-slate-100 text-slate-800">Diubah</span>
                          )}
                          <span
                            className="px-1.5 py-0.5 rounded-md text-[9px] font-semibold border border-slate-400 text-slate-800 shrink-0"
                          >
                            {label.badgeText}
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditModal(label)}
                            className="no-print p-2 -m-1 rounded-lg hover:bg-slate-100 text-slate-600 hover:text-emerald-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            aria-label={`Ubah label ${label.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Label Main Identification & QR Code */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="font-mono font-bold text-xs text-slate-900 tracking-tight">
                            {label.id}
                          </div>
                          <div
                            className={`font-bold text-slate-900 leading-snug line-clamp-2 ${
                              labelGridCols === '3' ? 'text-xs' : 'text-sm'
                            }`}
                          >
                            {label.name}
                          </div>
                          <div className="text-[9px] text-slate-600 truncate">
                            <span className="font-medium text-slate-500">Kategori:</span>{' '}
                            {label.category}{' '}
                            {label.subcategory ? `• ${label.subcategory}` : ''}
                          </div>
                          <div className="text-[9px] text-slate-700 truncate">
                            <span className="font-medium text-slate-500">Lokasi:</span>{' '}
                            <span className="font-semibold text-slate-900">{label.location}</span>
                          </div>
                          <div className="text-[9px] text-slate-700 truncate">
                            <span className="font-medium text-slate-500">Supplier:</span>{' '}
                            {label.supplier ? (
                              <span className="font-semibold text-slate-900">{label.supplier}</span>
                            ) : (
                              <span className="text-slate-500 font-normal">___________________________</span>
                            )}
                          </div>
                        </div>

                        {/* High-Contrast QR Code Block */}
                        <div
                          className={`flex flex-col items-center justify-center p-1 border border-slate-900 rounded-md bg-white shrink-0 text-center ${
                            labelGridCols === '3' ? 'w-16 h-16' : 'w-20 h-20'
                          }`}
                        >
                          <QrSvg value={buildScanUrl(label.id)} className={labelGridCols === '3' ? 'w-11 h-11' : 'w-14 h-14'} />
                          <span className="text-[7px] font-mono font-bold text-slate-800 truncate w-full mt-0.5">
                            {label.id}
                          </span>
                        </div>
                      </div>

                      {/* Tanggal Datang, Masa Expired & Batas Expired */}
                      <div className="pt-1.5 border-t border-slate-300 text-[9px] space-y-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-slate-600 font-medium block text-[8px]">Tanggal datang</span>
                            <span className="font-mono font-bold text-slate-900 text-[10px]">
                              {label.arrivalDateFormatted}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-600 font-medium block text-[8px]">Masa simpan</span>
                            <span className="font-semibold text-slate-900 text-[9px] block truncate" title={label.shelfLifeText}>
                              {label.shelfLifeText}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[8px]">
                          <span className="text-slate-900 font-semibold">Batas pakai</span>
                          {label.expiryDate ? (
                            <span className="font-mono font-bold text-rose-700 text-[10px]">
                              {label.expiryDate}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-600 font-medium">
                              ..../..../........
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Area Catatan / Note Lapangan (Bisa diisi / Tulis Tangan) */}
                      <div className="pt-1 border-t border-slate-300 flex items-end gap-1.5 text-[8px] text-slate-700">
                        <span className="font-semibold shrink-0">Catatan:</span>
                        {label.customNote ? (
                          <span className="font-medium text-slate-900">{label.customNote}</span>
                        ) : (
                          <span className="flex-1 border-b border-dotted border-slate-500 h-2.5" />
                        )}
                      </div>

                      <div className="text-right text-[8px] font-semibold text-slate-800">
                        {label.warehouseName}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Plakat rak: tanpa kop; emerald untuk rak biasa, sky untuk chiller & freezer */}
        {activeForm === 'RACK_LABEL' && (
          <div className="space-y-5">
            <SelectionBar
              selected={racksToPrint.length}
              total={filteredRacks.length}
              unit="plakat"
              allSelected={!hasCustomRackSelection || selectedRackIds.length === filteredRacks.length}
              onToggleAll={toggleSelectAllRacks}
            >
              <button
                type="button"
                onClick={handleCreateNewRack}
                className="inline-flex items-center gap-1 px-3 min-h-[44px] sm:min-h-[32px] rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              >
                <Plus className="w-3.5 h-3.5" />
                Plakat baru
              </button>
            </SelectionBar>

            {/* Racks Grid / List */}
            {filteredRacks.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Tidak ada plakat rak yang sesuai dengan filter atau kata kunci pencarian.
              </div>
            ) : (
              <div
                className={`grid ${
                  rackLayoutMode === '2'
                    ? 'grid-cols-1 gap-5 print:gap-4 rack-print-container-2per-page'
                    : 'grid-cols-1 gap-6 rack-print-container-1per-page'
                }`}
              >
                {filteredRacks.map(rack => {
                  const isSelected = !hasCustomRackSelection || selectedRackIds.includes(rack.id);
                  const isOverridden = Boolean(rackOverrides[rack.id] || rack.isCustom);
                  // Satu warna brand untuk semua plakat; sky hanya untuk rantai dingin (chiller & freezer) sesuai DESIGN.md.
                  const isCold = /freezer|chiller/i.test(`${rack.id} ${rack.name} ${rack.zone}`) || rack.id.startsWith('BIN-FRZ') || rack.id.startsWith('BIN-CHL');

                  return (
                    <div
                      key={rack.id}
                      className={`relative border-2 rounded-lg bg-white flex flex-col ${
                        isCold ? 'border-sky-700' : 'border-emerald-800'
                      } ${!isSelected ? 'opacity-40 no-print' : ''} ${
                        rackLayoutMode === '2' ? 'rack-card-2per-page' : 'rack-card-1per-page'
                      }`}
                    >
                      {/* Tombol layar, tidak ikut tercetak */}
                      <div className="no-print absolute top-2 right-2 z-10 flex items-center gap-1.5">
                        {isOverridden && (
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white text-slate-800 border border-slate-300">
                            Diubah
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditRackModal(rack)}
                          className="inline-flex items-center gap-1 px-2 min-h-[32px] rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-[11px] font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          aria-label={`Ubah plakat ${rack.name}`}
                        >
                          <Edit3 className="w-3 h-3" />
                          Ubah
                        </button>
                        {rack.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomRack(rack.id)}
                            className="inline-flex items-center justify-center w-8 min-h-[32px] rounded-lg bg-white border border-slate-300 hover:bg-rose-50 text-slate-600 hover:text-rose-700 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                            aria-label={`Hapus plakat ${rack.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRack(rack.id)}
                          className="w-5 h-5 accent-emerald-700 rounded cursor-pointer"
                          aria-label={`Cetak plakat ${rack.name}`}
                        />
                      </div>

                      {/* Nama rak jadi bacaan pertama dari jauh; kode rak di kanan untuk dicocokkan dengan QR */}
                      <div className={`rounded-t-[6px] px-3.5 py-2.5 print:py-2 flex items-end justify-between gap-3 text-white ${isCold ? 'bg-sky-700' : 'bg-emerald-800'}`}>
                        <div className="min-w-0 pr-40 sm:pr-44 print:pr-0">
                          <p className="text-[11px] print:text-[9px] font-medium opacity-90">SPPG Tumpang Jeru · {rack.warehouseName}</p>
                          <h2 className="text-base print:text-sm font-bold tracking-tight leading-snug">{rack.name}</h2>
                        </div>
                        <span className="hidden print:block font-mono font-bold text-sm shrink-0">{rack.id}</span>
                      </div>

                      <div className="p-3.5 print:p-3 flex flex-col gap-2.5 print:gap-2 flex-1">
                      {/* Standar rak & QR */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] print:text-[9.5px] leading-snug text-slate-900">
                          <p className="sm:col-span-2 print:col-span-2"><span className="text-slate-600">Letak:</span> {rack.zone}</p>
                          <p><span className="text-slate-600">Suhu:</span> <span className="font-semibold">{rack.temperatureGuide}</span></p>
                          {rack.humidityGuide && <p><span className="text-slate-600">Kondisi:</span> {rack.humidityGuide}</p>}
                          <p>
                            <span className="text-slate-600">Rotasi:</span> <span className="font-semibold">{rack.rotationMethod}</span>{' '}
                            <span className="text-slate-600">({rack.rotationMethod === 'FEFO' ? 'kedaluwarsa terdekat dipakai dulu' : 'yang datang dulu dipakai dulu'})</span>
                          </p>
                          <p><span className="text-slate-600">Kapasitas:</span> {rack.capacityMax}</p>
                        </div>

                        <div className="flex flex-col items-center shrink-0 border border-slate-900 rounded-md p-1 bg-white">
                          <QrSvg value={buildScanUrl(rack.id)} className="w-14 h-14 print:w-12 print:h-12" />
                          <span className="text-[8px] print:text-[7px] font-mono font-bold text-slate-900 mt-0.5">{rack.id}</span>
                        </div>
                      </div>

                      {rack.isReserve ? (
                        /* Rak cadangan: isi berubah-ubah, jadi plakat berisi cara memberi label dus dan rak tujuan saat dus dibuka */
                        <div className="space-y-1.5">
                          <h3 className="font-bold text-[11px] print:text-[10px] text-slate-900">Isi rak: berubah-ubah</h3>
                          <p className="text-[10px] print:text-[9px] leading-snug text-slate-700">
                            Rak ini menampung dus yang belum dibuka dari barang Rak 1 sampai Rak 3. Isinya tidak tetap, jadi setiap dus wajib diberi label.
                          </p>

                          <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-2">
                            <div className="rounded-lg border border-slate-300 p-2 space-y-1">
                              <div className="text-[9.5px] print:text-[8.5px] font-bold text-slate-900">Contoh label di sisi dus</div>
                              <div className="rounded border-2 border-dashed border-slate-400 px-2 py-1.5 font-mono text-[10px] print:text-[9px] leading-snug text-slate-900">
                                <div className="font-bold">ROYCO AYAM 1 KG</div>
                                <div>Isi: 12 pcs</div>
                                <div>Datang: 20/10/2026</div>
                                <div>Rak asal: Rak 2</div>
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-300 p-2 space-y-1">
                              <div className="text-[9.5px] print:text-[8.5px] font-bold text-slate-900">Dus dibuka, isinya dipindah ke</div>
                              <ul className="text-[9.5px] print:text-[8.5px] leading-snug text-slate-700 space-y-0.5">
                                {BASE_RACKS_CONFIG.filter(r => ['RAK-KRG-A1', 'RAK-KRG-A2', 'RAK-KRG-A3'].includes(r.id)).map(r => (
                                  <li key={r.id}>{r.name.replace(' - ', ': ')}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          {rack.items.length > 0 && (
                            <div className="no-print p-2 rounded-lg border border-amber-300 bg-amber-50 text-[10px] text-amber-900 leading-snug">
                              {rack.items.length} barang masih tercatat berlokasi di Rak 4: {rack.items.map(i => i.name).join(', ')}. Ubah lokasinya di Master Barang ke rak asal (Rak 1 sampai Rak 3), supaya muncul di plakat rak tersebut.
                            </div>
                          )}
                        </div>
                      ) : (
                      /* DAFTAR ITEM YANG MENGISI RAK INI */
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-[11px] print:text-[10px] text-slate-900">
                              Isi rak ({rack.items.length} barang)
                            </h3>
                          </div>
                        </div>

                        {rack.items.length === 0 ? (
                          <>
                            <div className="no-print p-2 rounded-lg border border-dashed border-slate-300 text-center text-[10px] text-slate-600 bg-slate-50">
                              Rak ini belum berisi barang. Tekan "Ubah" untuk menambahkan barang dari daftar stok.
                            </div>
                            <div className="hidden print:block space-y-2 pt-1">
                              {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="border-b border-slate-300 h-4" />
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-slate-300">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-100 text-slate-800 border-b border-slate-300 font-semibold text-[9.5px] print:text-[8.5px]">
                                  <th className="py-1 print:py-0.5 px-2 w-7 text-center">No</th>
                                  <th className="py-1 print:py-0.5 px-2 w-20">Kode SKU</th>
                                  <th className="py-1 print:py-0.5 px-2">Nama barang</th>
                                  <th className="py-1 print:py-0.5 px-2">Kategori</th>
                                  <th className="py-1 print:py-0.5 px-2 w-16 text-center">Satuan</th>
                                  <th className="py-1 print:py-0.5 px-2">Catatan penanganan</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 text-[10px] print:text-[9px]">
                                {rack.items.map((itm, idx) => (
                                  <tr key={`${itm.id}-${idx}`}>
                                    <td className="py-1 print:py-0.5 px-2 text-center text-slate-500 font-mono text-[9.5px] print:text-[8.5px]">
                                      {String(idx + 1).padStart(2, '0')}
                                    </td>
                                    <td className="py-1 print:py-0.5 px-2 font-mono font-bold text-slate-900 text-[9.5px] print:text-[8.5px]">
                                      {itm.id}
                                    </td>
                                    <td className="py-1 print:py-0.5 px-2">
                                      <div className="font-bold text-slate-900 leading-tight">{itm.name}</div>
                                      {itm.subcategory && (
                                        <div className="text-[8.5px] print:text-[7.5px] text-slate-500 line-clamp-1">
                                          {itm.subcategory}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-1 print:py-0.5 px-2 text-slate-700">{itm.category}</td>
                                    <td className="py-1 print:py-0.5 px-2 text-center font-mono font-semibold text-slate-800">
                                      {itm.unit || 'Kg'}
                                    </td>
                                    <td className="py-1 print:py-0.5 px-2 text-slate-600">
                                      {itm.handlingNote || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Garis Tambahan Item Lapangan */}
                        <div className="pt-1 flex items-end gap-2 text-[9px] print:text-[8px] text-slate-700">
                          <span className="font-medium shrink-0">Tambahan:</span>
                          <span className="flex-1 border-b border-dotted border-slate-500 h-3" />
                        </div>
                      </div>
                      )}

                      <div className="pt-2 border-t border-slate-300 space-y-0.5">
                        <h3 className="font-bold text-[11px] print:text-[10px] text-slate-900">Aturan penyimpanan</h3>
                        <p className="text-[10px] print:text-[9px] leading-snug text-slate-800">{rack.storageRule}</p>
                        {rack.customNote && (
                          <p className="text-[10px] print:text-[9px] leading-snug text-slate-700">
                            <span className="font-semibold text-slate-900">Catatan:</span> {rack.customNote}
                          </p>
                        )}
                      </div>

                      <div className="mt-auto pt-1.5 border-t border-slate-300 flex items-end justify-between gap-4 text-[9px] print:text-[8px] text-slate-700">
                        <span>
                          Penanggung jawab: <span className="font-semibold text-slate-900">{rack.picName || BLANK}</span>
                        </span>
                        <span className="text-right">
                          Paraf / tanggal pasang:{' '}
                          <span className="font-mono text-slate-600">.......... / ..../..../........</span>
                        </span>
                      </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 7. Bukti kas keluar ke supplier */}
        {activeForm === 'SUPPLIER_EXPENSE_NOTE' && (
          <div className="space-y-5 text-xs">
            <DocTitle
              title="Bukti Kas Keluar"
              subtitle={`No. ${expenseInvoiceNo || BLANK}, ${formatLongDate(expenseDate)}`}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              <Field label="Dibayar kepada" value={selectedSupplier.name || undefined} strong />
              <Field label="Status" value={EXPENSE_STATUS_LABEL[expenseStatus]} />
              <Field
                label="Kontak"
                value={[selectedSupplier.contactPerson, selectedSupplier.phone].filter(Boolean).join(', ') || undefined}
              />
              <Field label="No. SJ / referensi" value={expenseDeliveryRef || undefined} mono />
              <Field label="Alamat" value={selectedSupplier.address || undefined} />
              <Field label="Cara bayar" value={expenseBankName ? `Transfer ${expenseBankName}` : undefined} blank="Tunai / transfer ...................." />
              <Field label="Rekening" value={expenseBankAccount ? `${expenseBankAccount}${expenseAccountHolder ? ` a.n. ${expenseAccountHolder}` : ''}` : undefined} mono />
              <Field label="Perihal" value={expensePurpose || undefined} />
            </div>

            <table className="w-full border-collapse border border-slate-300 table-print">
              <thead className="bg-slate-100 text-slate-800 font-semibold">
                <tr>
                  <th className="border border-slate-300 p-1.5 text-center w-8">No</th>
                  <th className="border border-slate-300 p-1.5 text-left">Uraian</th>
                  <th className="border border-slate-300 p-1.5 text-right w-16">Jumlah</th>
                  <th className="border border-slate-300 p-1.5 text-center w-14">Satuan</th>
                  <th className="border border-slate-300 p-1.5 text-right w-28">Harga satuan</th>
                  <th className="border border-slate-300 p-1.5 text-right w-32">Total</th>
                </tr>
              </thead>
              <tbody>
                {expenseLines.length === 0
                  ? Array.from({ length: 8 }).map((_, idx) => (
                      <tr key={idx} className="h-8">
                        <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-500">{idx + 1}</td>
                        {Array.from({ length: 5 }).map((__, c) => (
                          <td key={c} className="border border-slate-300 p-1.5"></td>
                        ))}
                      </tr>
                    ))
                  : expenseLines.map((line, idx) => (
                      <tr key={line.id}>
                        <td className="border border-slate-300 p-1.5 text-center">{idx + 1}</td>
                        <td className="border border-slate-300 p-1.5">
                          <div className="font-semibold">{line.name || BLANK}</div>
                          {line.notes && <div className="text-[10px] text-slate-600 mt-0.5">{line.notes}</div>}
                        </td>
                        <td className="border border-slate-300 p-1.5 text-right tabular-nums">{line.quantity}</td>
                        <td className="border border-slate-300 p-1.5 text-center">{line.unit}</td>
                        <td className="border border-slate-300 p-1.5 text-right tabular-nums">
                          {line.unitPrice ? formatRupiah(line.unitPrice) : ''}
                        </td>
                        <td className="border border-slate-300 p-1.5 text-right tabular-nums font-semibold">
                          {line.unitPrice ? formatRupiah(line.quantity * line.unitPrice) : ''}
                        </td>
                      </tr>
                    ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={5} className="border border-slate-300 p-1.5 text-right">Subtotal</td>
                  <td className="border border-slate-300 p-1.5 text-right tabular-nums">{expenseSubtotal ? formatRupiah(expenseSubtotal) : ''}</td>
                </tr>
                {expenseDiscount > 0 && (
                  <tr>
                    <td colSpan={5} className="border border-slate-300 p-1.5 text-right">Potongan</td>
                    <td className="border border-slate-300 p-1.5 text-right tabular-nums">- {formatRupiah(expenseDiscount)}</td>
                  </tr>
                )}
                {expenseShippingCost > 0 && (
                  <tr>
                    <td colSpan={5} className="border border-slate-300 p-1.5 text-right">Ongkos kirim</td>
                    <td className="border border-slate-300 p-1.5 text-right tabular-nums">{formatRupiah(expenseShippingCost)}</td>
                  </tr>
                )}
                <tr className="bg-slate-100 font-bold text-sm">
                  <td colSpan={5} className="border border-slate-300 p-2 text-right">Total dibayarkan</td>
                  <td className="border border-slate-300 p-2 text-right tabular-nums">{expenseTotalPayable ? formatRupiah(expenseTotalPayable) : ''}</td>
                </tr>
              </tfoot>
            </table>

            <div className="border border-slate-300 rounded p-2.5">
              <span className="font-semibold text-slate-800">Terbilang:</span>{' '}
              <span className="italic">
                {expenseTotalPayable ? angkaTerbilang(expenseTotalPayable) : BLANK}
              </span>
            </div>

            {expenseNotes && (
              <p className="text-slate-700">
                <span className="font-semibold text-slate-800">Catatan:</span> {expenseNotes}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-2">
              <SignBox role="Penerima (supplier)" name={selectedSupplier.contactPerson || selectedSupplier.name || undefined} />
              <SignBox role="Bendahara" name={expensePicTreasurer || undefined} />
              <SignBox role="Pemeriksa barang" name={expensePicVerifier || undefined} />
              <SignBox role="Menyetujui (Kepala SPPG)" name={expensePicApprover || undefined} />
            </div>
          </div>
        )}
      </div>

      {/* Dialog ubah isi satu label (hanya di layar) */}
      {editingModalData && (
        <div className="no-print">
          <FormDialog
            title="Ubah isi label"
            description={
              <>
                {editingModalData.name} · <span className="font-mono">{editingModalData.id}</span>
              </>
            }
            onClose={() => setEditingModalData(null)}
            onSubmit={handleSaveModal}
            submitLabel="Simpan label"
          >
            <p className="text-[11px] text-slate-600">Isian yang dikosongkan dicetak sebagai garis untuk ditulis tangan.</p>
            <div>
              <label htmlFor="lbl-supplier" className={FIELD_LABEL}>Supplier</label>
              <input
                id="lbl-supplier"
                type="text"
                value={editingModalData.supplier}
                onChange={e => setEditingModalData({ ...editingModalData, supplier: e.target.value })}
                className={FIELD_INPUT}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="lbl-arrival" className={FIELD_LABEL}>Tanggal datang</label>
                <input
                  id="lbl-arrival"
                  type="date"
                  value={editingModalData.arrivalDate}
                  onChange={e => setEditingModalData({ ...editingModalData, arrivalDate: e.target.value })}
                  className={FIELD_INPUT}
                />
              </div>
              <div>
                <label htmlFor="lbl-shelf" className={FIELD_LABEL}>Masa simpan</label>
                <input
                  id="lbl-shelf"
                  type="text"
                  value={editingModalData.shelfLifeText}
                  onChange={e => setEditingModalData({ ...editingModalData, shelfLifeText: e.target.value })}
                  placeholder="1 - 2 hari"
                  className={FIELD_INPUT}
                />
              </div>
            </div>
            <div>
              <label htmlFor="lbl-expiry" className={FIELD_LABEL}>Batas pakai</label>
              <input
                id="lbl-expiry"
                type="text"
                value={editingModalData.expiryDate}
                onChange={e => setEditingModalData({ ...editingModalData, expiryDate: e.target.value })}
                placeholder="dd/mm/yyyy"
                className={`${FIELD_INPUT} font-mono`}
              />
            </div>
            <div>
              <label htmlFor="lbl-note" className={FIELD_LABEL}>Catatan (opsional)</label>
              <input
                id="lbl-note"
                type="text"
                value={editingModalData.customNote}
                onChange={e => setEditingModalData({ ...editingModalData, customNote: e.target.value })}
                className={FIELD_INPUT}
              />
            </div>
            {labelOverrides[editingModalData.id] && (
              <div className="pt-3 border-t border-slate-200">
                <button type="button" onClick={() => handleResetItemOverride(editingModalData.id)} className={BTN_SECONDARY}>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Kembalikan ke pengaturan umum
                </button>
              </div>
            )}
          </FormDialog>
        </div>
      )}

      {/* Dialog ubah / tambah plakat rak (hanya di layar) */}
      {editingRackData && (
        <div className="no-print">
          <DialogShell
            title={editingRackData.isNew ? 'Plakat rak baru' : 'Ubah plakat rak'}
            description={
              <>
                <span className="font-mono font-semibold text-slate-800">{editingRackData.id || 'Kode belum diisi'}</span>
                {' · '}
                {editingRackData.warehouseName || (editingRackData.warehouseType === 'GUDANG_BASAH' ? 'Gudang Basah' : 'Gudang Kering')}
              </>
            }
            onClose={() => setEditingRackData(null)}
            onSubmit={handleSaveRackModal}
            size="xl"
            footer={
              <>
                {!editingRackData.isNew && rackOverrides[editingRackData.id] && (
                  <button
                    type="button"
                    onClick={() => handleResetRackOverride(editingRackData.id)}
                    className={`${BTN_SECONDARY} sm:mr-auto`}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Kembalikan ke bawaan
                  </button>
                )}
                <button type="button" onClick={() => setEditingRackData(null)} className={`${BTN_SECONDARY} ${BTN_GHOST}`}>
                  Batal
                </button>
                <button type="submit" className={BTN_PRIMARY}>
                  {editingRackData.isNew ? 'Tambah plakat' : 'Simpan plakat'}
                </button>
              </>
            }
          >
            {rackFormError && (
              <p role="alert" className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                {rackFormError}
              </p>
            )}

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">Isi plakat</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="rack-id" className={FIELD_LABEL}>Kode rak</label>
                  <input
                    id="rack-id"
                    type="text"
                    value={editingRackData.id}
                    disabled={!editingRackData.isNew}
                    onChange={e => setEditingRackData({ ...editingRackData, id: e.target.value.toUpperCase() })}
                    placeholder="RAK-KST-01"
                    className={`${FIELD_INPUT} font-mono font-semibold`}
                  />
                  {!editingRackData.isNew && <p className="text-[11px] text-slate-600 mt-1">Tidak bisa diubah, karena sudah tercetak di QR.</p>}
                </div>

                <div className="sm:col-span-1 lg:col-span-3">
                  <label htmlFor="rack-name" className={FIELD_LABEL}>Nama plakat</label>
                  <input
                    id="rack-name"
                    type="text"
                    value={editingRackData.name}
                    onChange={e => setEditingRackData({ ...editingRackData, name: e.target.value })}
                    placeholder="Rak 5 - Bumbu Kemasan Besar"
                    className={FIELD_INPUT}
                  />
                </div>

                <div>
                  <label htmlFor="rack-type" className={FIELD_LABEL}>Tipe gudang</label>
                  <Select
                    className="w-full"
                    id="rack-type"
                    value={editingRackData.warehouseType}
                    onChange={e =>
                      setEditingRackData({
                        ...editingRackData,
                        warehouseType: e.target.value as 'GUDANG_KERING' | 'GUDANG_BASAH',
                        warehouseName: e.target.value === 'GUDANG_BASAH' ? 'Gudang Basah' : 'Gudang Kering',
                      })
                    }
                  >
                    <option value="GUDANG_KERING">Gudang kering</option>
                    <option value="GUDANG_BASAH">Gudang basah</option>
                  </Select>
                </div>

                <div>
                  <label htmlFor="rack-rotation" className={FIELD_LABEL}>Rotasi</label>
                  <Select
                    className="w-full"
                    id="rack-rotation"
                    value={editingRackData.rotationMethod}
                    onChange={e => setEditingRackData({ ...editingRackData, rotationMethod: e.target.value as 'FIFO' | 'FEFO' })}
                  >
                    <option value="FIFO">FIFO: yang datang dulu dipakai dulu</option>
                    <option value="FEFO">FEFO: kedaluwarsa terdekat dipakai dulu</option>
                  </Select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="rack-zone" className={FIELD_LABEL}>Letak</label>
                  <input
                    id="rack-zone"
                    type="text"
                    value={editingRackData.zone}
                    onChange={e => setEditingRackData({ ...editingRackData, zone: e.target.value })}
                    placeholder="Gudang Kering - Rak 5"
                    className={FIELD_INPUT}
                  />
                </div>

                <div>
                  <label htmlFor="rack-temp" className={FIELD_LABEL}>Suhu</label>
                  <input
                    id="rack-temp"
                    type="text"
                    value={editingRackData.temperatureGuide}
                    onChange={e => setEditingRackData({ ...editingRackData, temperatureGuide: e.target.value })}
                    placeholder="Suhu ruang 20°C - 25°C"
                    className={FIELD_INPUT}
                  />
                </div>

                <div>
                  <label htmlFor="rack-humidity" className={FIELD_LABEL}>Kondisi</label>
                  <input
                    id="rack-humidity"
                    type="text"
                    value={editingRackData.humidityGuide || ''}
                    onChange={e => setEditingRackData({ ...editingRackData, humidityGuide: e.target.value })}
                    placeholder="Kering, maks. 60% RH"
                    className={FIELD_INPUT}
                  />
                </div>

                <div>
                  <label htmlFor="rack-capacity" className={FIELD_LABEL}>Kapasitas</label>
                  <input
                    id="rack-capacity"
                    type="text"
                    value={editingRackData.capacityMax}
                    onChange={e => setEditingRackData({ ...editingRackData, capacityMax: e.target.value })}
                    placeholder="Ambalan bertingkat"
                    className={FIELD_INPUT}
                  />
                </div>

                <div>
                  <label htmlFor="rack-pic" className={FIELD_LABEL}>Penanggung jawab</label>
                  <input
                    id="rack-pic"
                    type="text"
                    value={editingRackData.picName}
                    onChange={e => setEditingRackData({ ...editingRackData, picName: e.target.value })}
                    placeholder="Kosongkan untuk ditulis tangan"
                    className={FIELD_INPUT}
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label htmlFor="rack-rule" className={FIELD_LABEL}>Aturan penyimpanan</label>
                  <textarea
                    id="rack-rule"
                    rows={2}
                    value={editingRackData.storageRule}
                    onChange={e => setEditingRackData({ ...editingRackData, storageRule: e.target.value })}
                    className={`${FIELD_INPUT} py-2 leading-snug`}
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label htmlFor="rack-note" className={FIELD_LABEL}>Catatan (opsional)</label>
                  <textarea
                    id="rack-note"
                    rows={2}
                    value={editingRackData.customNote}
                    onChange={e => setEditingRackData({ ...editingRackData, customNote: e.target.value })}
                    className={`${FIELD_INPUT} py-2 leading-snug`}
                  />
                </div>
              </div>
            </section>

            {!editingRackData.isNew && BASE_RACKS_CONFIG.find(r => r.id === editingRackData.id)?.isReserve ? (
              <p className="pt-4 border-t border-slate-200 text-xs text-slate-700">
                Rak cadangan tidak punya daftar barang tetap. Plakatnya berisi cara memberi label dus.
              </p>
            ) : (
            <section className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Barang di rak ({editingRackData.items.length})</h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    {editingRackData.itemsEdited || (!editingRackData.isNew && rackOverrides[editingRackData.id]?.customItems)
                      ? 'Daftar ini diatur manual. Barang baru di Master Barang tidak otomatis masuk ke plakat ini.'
                      : 'Diambil otomatis dari lokasi barang di Master Barang. Kalau diubah di sini, daftarnya jadi diatur manual.'}
                  </p>
                </div>
                {editingRackData.items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditingRackData({ ...editingRackData, items: [], itemsEdited: true })}
                    className={`${BTN_SECONDARY} text-rose-700 hover:bg-rose-50`}
                  >
                    Kosongkan daftar
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <label htmlFor="rack-add-item" className={FIELD_LABEL}>Tambah dari Master Barang</label>
                  <SearchPicker
                    id="rack-add-item"
                    value=""
                    options={items
                      .filter(i => !editingRackData.items.some(r => r.id === i.id))
                      .map(i => ({ value: i.id, label: i.name, group: i.category, hint: i.id }))}
                    onSelect={opt => opt && handleAddItemFromMaster(opt.value)}
                    placeholder="Pilih barang"
                    searchPlaceholder="Cari nama atau kode barang..."
                    noun="barang"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowManualItemInput(!showManualItemInput)}
                  aria-expanded={showManualItemInput}
                  className={BTN_SECONDARY}
                >
                  {showManualItemInput ? 'Tutup isian manual' : 'Barang di luar master'}
                </button>
              </div>

              {showManualItemInput && (
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                    <div>
                      <label htmlFor="manual-sku" className={FIELD_LABEL}>Kode (opsional)</label>
                      <input
                        id="manual-sku"
                        type="text"
                        placeholder="ITM-KST-01"
                        value={manualItemForm.id}
                        onChange={e => setManualItemForm({ ...manualItemForm, id: e.target.value })}
                        className={`${FIELD_INPUT} font-mono`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="manual-name" className={FIELD_LABEL}>Nama barang</label>
                      <input
                        id="manual-name"
                        type="text"
                        value={manualItemForm.name}
                        onChange={e => setManualItemForm({ ...manualItemForm, name: e.target.value })}
                        className={FIELD_INPUT}
                      />
                    </div>
                    <div>
                      <label htmlFor="manual-cat" className={FIELD_LABEL}>Kategori</label>
                      <input
                        id="manual-cat"
                        type="text"
                        value={manualItemForm.category}
                        onChange={e => setManualItemForm({ ...manualItemForm, category: e.target.value })}
                        className={FIELD_INPUT}
                      />
                    </div>
                    <div>
                      <label htmlFor="manual-unit" className={FIELD_LABEL}>Satuan</label>
                      <input
                        id="manual-unit"
                        type="text"
                        value={manualItemForm.unit}
                        onChange={e => setManualItemForm({ ...manualItemForm, unit: e.target.value })}
                        className={FIELD_INPUT}
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleAddManualItem}
                        disabled={!manualItemForm.name.trim()}
                        className={`${BTN_SECONDARY} w-full disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Tambah
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="manual-note" className={FIELD_LABEL}>Catatan penanganan (opsional)</label>
                    <input
                      id="manual-note"
                      type="text"
                      value={manualItemForm.handlingNote}
                      onChange={e => setManualItemForm({ ...manualItemForm, handlingNote: e.target.value })}
                      className={FIELD_INPUT}
                    />
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 w-8 text-center">No</th>
                      <th className="py-2 px-2.5">Barang</th>
                      <th className="py-2 px-2.5 w-16">Satuan</th>
                      <th className="py-2 px-2.5">Catatan penanganan</th>
                      <th className="py-2 px-2.5 w-28 text-right"><span className="sr-only">Aksi</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editingRackData.items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-600">
                          Belum ada barang. Pilih dari Master Barang di atas.
                        </td>
                      </tr>
                    ) : (
                      editingRackData.items.map((itm, idx) => (
                        <tr key={`${itm.id}-${idx}`} className="align-middle">
                          <td className="py-1.5 px-2.5 text-center font-mono text-slate-600">{idx + 1}</td>
                          <td className="py-1.5 px-2.5">
                            <div className="font-semibold text-slate-900">{itm.name}</div>
                            <div className="text-[11px] text-slate-600">
                              <span className="font-mono">{itm.id}</span> · {itm.category}
                            </div>
                          </td>
                          <td className="py-1.5 px-2.5 font-mono text-slate-800">{itm.unit || 'Kg'}</td>
                          <td className="py-1.5 px-2.5">
                            <input
                              type="text"
                              aria-label={`Catatan penanganan ${itm.name}`}
                              value={itm.handlingNote || ''}
                              onChange={e => handleUpdateItemField(idx, 'handlingNote', e.target.value)}
                              className={TABLE_INPUT}
                            />
                          </td>
                          <td className="py-1.5 px-2.5">
                            <div className="flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => handleMoveItemInEditingRack(idx, 'UP')}
                                disabled={idx === 0}
                                aria-label={`Naikkan ${itm.name}`}
                                className={`p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${FOCUS_RING}`}
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveItemInEditingRack(idx, 'DOWN')}
                                disabled={idx === editingRackData.items.length - 1}
                                aria-label={`Turunkan ${itm.name}`}
                                className={`p-2 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${FOCUS_RING}`}
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItemFromEditingRack(idx)}
                                aria-label={`Keluarkan ${itm.name} dari rak`}
                                className={`p-2 rounded-lg text-slate-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer ${FOCUS_RING}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
            )}
          </DialogShell>
        </div>
      )}
    </div>
  );
};


