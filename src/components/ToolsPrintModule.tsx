import React, { useState, useMemo, useEffect } from 'react';
import { KopText } from './common/KopText';
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
  Save,
  RotateCcw,
  Truck,
  Warehouse,
  Snowflake,
  Thermometer,
  ShieldCheck,
  Receipt,
  CreditCard,
  Plus,
  Trash2,
  Banknote,
  Calculator,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { warehouseDb } from '../db/storage';
import { useAuth } from '../context/AuthContext';
import { ReceivingDocument, ItemMaster, EquipmentItem, Supplier, normalizeItemCategory } from '../types/warehouse';
import { SppgLogo } from './SppgLogo';
import QRCode from 'qrcode';
import { localDateIso } from '../utils/localDate';

export type FormType = 'RECEIVING_FORM' | 'OPNAME_SHEET' | 'BIN_CARD' | 'KITCHEN_REQUISITION' | 'ITEM_TAG_LABEL' | 'EQUIPMENT_LABEL' | 'RACK_LABEL' | 'SUPPLIER_EXPENSE_NOTE';

export interface ItemTagData {
  uniqueKey: string;
  id: string;
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

// QR asli (bisa dipindai) berisi kode barang/rak, digambar sebagai SVG agar tajam saat dicetak.
const QrSvg: React.FC<{ value: string; className?: string; color?: string }> = ({ value, className, color = '#0f172a' }) => {
  const qr = useMemo(() => {
    try {
      return QRCode.create(value || '-', { errorCorrectionLevel: 'M' });
    } catch {
      return null;
    }
  }, [value]);
  if (!qr) return null;
  const size = qr.modules.size;
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (qr.modules.get(x, y)) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} />);
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} fill={color} role="img" aria-label={`QR ${value}`} shapeRendering="crispEdges">
      {cells}
    </svg>
  );
};

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
  { id: 'RECEIVING_FORM', label: 'BA Penerimaan', hint: 'Berita acara serah terima barang dari supplier.' },
  { id: 'OPNAME_SHEET', label: 'Lembar Opname', hint: 'Lembar hitung fisik stok per lokasi.' },
  { id: 'BIN_CARD', label: 'Kartu Stok', hint: 'Kartu gantung di rak untuk mencatat keluar-masuk satu barang.' },
  { id: 'KITCHEN_REQUISITION', label: 'Bon Dapur', hint: 'Bon permintaan bahan dari dapur ke gudang, diisi tangan.' },
  { id: 'ITEM_TAG_LABEL', label: 'Tag Bahan Datang', hint: 'Tag kecil untuk wadah: supplier, jam datang, dan batas pakai.' },
  { id: 'EQUIPMENT_LABEL', label: 'Label Barang & Aset', hint: 'Stiker berkode QR untuk barang gudang dan aset dapur.' },
  { id: 'RACK_LABEL', label: 'Plakat Rak', hint: 'Plakat rak berisi daftar barang dan aturan penyimpanan.' },
  { id: 'SUPPLIER_EXPENSE_NOTE', label: 'Nota Kas Keluar', hint: 'Bukti pembayaran ke supplier dengan tanda tangan.' },
];

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
  badgeStyle: {
    bg: string;
    text: string;
    border: string;
  };
  isEquipment?: boolean;
  supplier: string;
  shelfLifeText: string;
  shelfLifeDays: number;
  expiryDate: string;
  customNote?: string;
  arrivalDateFormatted: string;
  extraMeta?: string;
}

export interface RackItemDetail {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  currentStock: number;
  unit: string;
  minStock: number;
  reorderPoint: number;
  handlingNote?: string;
}

export interface WarehouseRack {
  id: string;
  name: string;
  warehouseType: 'GUDANG_KERING' | 'GUDANG_BASAH';
  warehouseName: string;
  zone: string;
  temperatureGuide: string;
  humidityGuide?: string;
  storageRule: string;
  rotationMethod: 'FIFO' | 'FEFO';
  capacityMax: string;
  picName: string;
  customNote?: string;
  isCustom?: boolean;
  items: RackItemDetail[];
}

const BASE_RACKS_CONFIG: Omit<WarehouseRack, 'items'>[] = [
  // --- GUDANG KERING (DRY STORAGE) ---
  {
    id: 'RAK-KRG-A1',
    name: 'Rak A1 - Sembako Beras & Karung Pangan',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering (Dry Storage)',
    zone: 'Zona Sembako Sektor A (Beban Berat)',
    temperatureGuide: '20°C - 25°C (Suhu Ruang Terkendali)',
    humidityGuide: 'Maks. 60% RH (Hindari Lembap)',
    storageRule: 'Wajib di atas palet plastik/kayu min. 15 cm dari lantai & berjarak 5 cm dari dinding. Bebas kutu beras & hama.',
    rotationMethod: 'FIFO',
    capacityMax: '1.500 Kg (Kapasitas Maks. 30 Karung 25-50 Kg)',
    picName: '',
    customNote: 'Periksa segel karung & catat nomor batch saat penumpukan.',
  },
  {
    id: 'PLT-KRG-T1',
    name: 'Gudang Kering - Palet Tengah (Sembako Sak & Karung Curah)',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering (Dry Storage)',
    zone: 'Zona Tengah Gudang Kering - Palet Lantai (Floor Bulk Storage Bay)',
    temperatureGuide: '20°C - 25°C (Suhu Ruang Kering Terkontrol)',
    humidityGuide: 'Maks. 60% RH (Sirkulasi Terbuka & Bebas Lembap)',
    storageRule: 'Wajib beralaskan palet plastik/kayu fumigasi min. 15 cm di atas lantai. Susun bersilangan (interlocking) maks. 8 tumpukan sak demi kestabilan. Beri lorong sirkulasi udara min. 50 cm antar tumpukan.',
    rotationMethod: 'FIFO',
    capacityMax: '2.500 Kg (Kapasitas Maks. 50-60 Sak / Karung Pangan 25-50 Kg)',
    picName: 'Petugas Logistik Gudang Kering',
    customNote: 'Khusus muatan komoditas berat: beras karung 25-50kg, gula sak 50kg, tepung sak, dan buffer stock pangan curah volume besar.',
  },
  {
    id: 'RAK-KRG-A2',
    name: 'Rak A2 - Minyak, Lemak & Cairan Pangan',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering (Dry Storage)',
    zone: 'Zona Cairan & Jerigen Sektor A',
    temperatureGuide: '20°C - 25°C (Terhindar Cahaya Langsung)',
    humidityGuide: 'Sirkulasi Udara Aktif',
    storageRule: 'Letakkan jerigen di ambalan paling bawah untuk stabilitas. Pastikan tutup tersegel rapat agar tidak merembes.',
    rotationMethod: 'FIFO',
    capacityMax: '500 Liter (Maks. 100 Jerigen 5L)',
    picName: '',
    customNote: 'Sedia wadah penampung tetesan jika kran jerigen digunakan.',
  },
  {
    id: 'RAK-KRG-A3',
    name: 'Rak A3 - Gula, Pemanis & Tepung Olahan',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering (Dry Storage)',
    zone: 'Zona Bahan Bubuk & Pemanis Sektor A',
    temperatureGuide: '20°C - 25°C (Kering & Bebas Semut)',
    humidityGuide: 'Maks. 55% RH (Sangat Rentan Gumpal)',
    storageRule: 'Gunakan kontainer tertutup food-grade setelah kemasan dibuka. Pasang kapur/anti semut di sekitar kaki rak.',
    rotationMethod: 'FEFO',
    capacityMax: '800 Kg (Ambalan Bertingkat SUS 304)',
    picName: '',
    customNote: 'Jaga kebersihan ambalan dari ceceran butir gula atau tepung.',
  },
  {
    id: 'RAK-KRG-A4',
    name: 'Rak A4 - Garam, Bumbu Kering & Rempah',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering (Dry Storage)',
    zone: 'Zona Bumbu & Rempah Sektor A',
    temperatureGuide: '20°C - 25°C (Suhu Ruang Kering)',
    humidityGuide: 'Kedap Udara & Tidak Lembap',
    storageRule: 'Wadah kedap udara agar aroma rempah terjaga dan yodium garam tidak berkurang akibat kelembapan.',
    rotationMethod: 'FIFO',
    capacityMax: '400 Kg (Rak Bin Tertutup)',
    picName: '',
    customNote: 'Tutup rapat toples/bin bumbu setelah penimbangan porsi masak.',
  },
  {
    id: 'RAK-KRG-N1',
    name: 'Rak N1 - Non-Food: Sabun & Sanitasi Dapur',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering & Non-Food',
    zone: 'Zona Kimia & Sanitasi (Terpisah Fisik)',
    temperatureGuide: '20°C - 25°C (Berventilasi Baik)',
    storageRule: 'STANDAR HACCP: Terpisah mutlak dari bahan makanan! Dilarang keras menyimpan bahan pangan di rak ini.',
    rotationMethod: 'FIFO',
    capacityMax: '40 Jerigen 5L',
    picName: 'Staf Sanitasi & Kebersihan',
    customNote: 'Penyimpanan khusus cairan pembersih, deterjen & disinfektan food contact.',
  },
  {
    id: 'RAK-KRG-N2',
    name: 'Rak N2 - Non-Food: Plastik, Tissue & Kemasan',
    warehouseType: 'GUDANG_KERING',
    warehouseName: 'Gudang Kering & Non-Food',
    zone: 'Zona Kemasan & Packaging Dapur',
    temperatureGuide: '20°C - 25°C (Bersih & Bebas Debu)',
    storageRule: 'Simpan kardus/pack dalam kondisi tertutup plastik pembungkus agar higienis sebelum didistribusikan ke dapur.',
    rotationMethod: 'FIFO',
    capacityMax: '30 Dus Kemasan / Kontainer',
    picName: 'Staf Logistik Non-Food',
    customNote: 'Penyimpanan kantong sampah, sarung tangan & tissue dapur.',
  },

  // --- GUDANG BASAH & COLD STORAGE ---
  {
    id: 'BIN-CHL-C1',
    name: 'Chiller C1 - Daging Ayam & Protein Unggas',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah & Dingin (Cold Storage)',
    zone: 'Cold Storage Room - Chiller Protein Unggas',
    temperatureGuide: '2°C - 4°C (Wajib Cek Termometer 2x Sehari)',
    humidityGuide: 'Kelembaban Terkontrol Chiller',
    storageRule: 'Wadah stainless tertutup rapat. Beri label tanggal kedatangan. Konsumsi maksimal 24 - 48 jam.',
    rotationMethod: 'FEFO',
    capacityMax: '300 Kg (Rak Bin Stainless Steel SUS 304)',
    picName: '',
    customNote: 'Pastikan pintu chiller tertutup rapat setelah pengambilan bahan.',
  },
  {
    id: 'BIN-FRZ-F2',
    name: 'Freezer F2 - Daging Beku, Ikan Laut & Olahan',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah & Dingin (Cold Storage)',
    zone: 'Deep Freeze Storage Zone (-18°C)',
    temperatureGuide: '-18°C s/d -20°C (Pembekuan Sempurna)',
    humidityGuide: 'Cold Chain Beku Tanpa Bunga Es Berlebih',
    storageRule: 'Jaga rantai dingin (cold chain). Dilarang membekukan ulang bahan yang sudah dicairkan (thawing).',
    rotationMethod: 'FEFO',
    capacityMax: '400 Kg (Deep Chest Freezer)',
    picName: '',
    customNote: 'Defrost berkala jika bunga es melebihi ketebalan 5 mm.',
  },
  {
    id: 'RAK-BSH-V1',
    name: 'Rak V1 - Sayuran Segar & Umbi Hijau',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah & Dingin (Sayur Segar)',
    zone: 'Area Sortir Sayur & Ruang Sejuk Dapur',
    temperatureGuide: '8°C - 12°C (Sejuk Berventilasi)',
    humidityGuide: 'Sirkulasi Udara Aktif Keranjang Berventilasi',
    storageRule: 'Gunakan keranjang plastik berlubang agar sayur tidak layu & membusuk. Pisahkan sayuran daun dan umbi.',
    rotationMethod: 'FEFO',
    capacityMax: '250 Kg (15 Keranjang Sayur)',
    picName: 'PIC Penerimaan Bahan Segar',
    customNote: 'Penyortiran sayur dilakukan segera setelah serah terima supplier.',
  },
  {
    id: 'RAK-BSH-F1',
    name: 'Rak B1 - Buah Segar Pencuci Mulut',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah & Dingin (Buah Segar)',
    zone: 'Area Buah & Distribusi Menu Sehat',
    temperatureGuide: '12°C - 16°C (Sejuk Kering)',
    humidityGuide: 'Cegah Kelembaban Berlebih',
    storageRule: 'Jangan menumpuk buah lebih dari 2 lapis untuk mencegah memar fisik. Jauhkan dari buah yang terlalu matang.',
    rotationMethod: 'FEFO',
    capacityMax: '200 Kg (10 Keranjang Buah)',
    picName: 'PIC Pemorsian Buah & Distribusi',
    customNote: 'Periksa kematangan sebelum didistribusikan ke sekolah.',
  },
  {
    id: 'RAK-BSH-T1',
    name: 'Rak T1 - Telur Ayam Ras Segar',
    warehouseType: 'GUDANG_BASAH',
    warehouseName: 'Gudang Basah & Dingin (Protein Harian)',
    zone: 'Area Persiapan - Rak Khusus Telur',
    temperatureGuide: '15°C - 20°C (Sejuk & Kering)',
    humidityGuide: 'Bersih & Kering',
    storageRule: 'Gunakan egg tray higienis dengan posisi bagian runcing telur di bawah. Bersihkan cangkang retak segera.',
    rotationMethod: 'FIFO',
    capacityMax: '150 Kg (10 Peti / Egg Tray)',
    picName: 'PIC Persiapan Telur & Protein',
    customNote: 'Uji apung/kualitas acak pada setiap pengiriman baru.',
  },
];

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
}

export interface ToolsPrintModuleProps {
  initialForm?: FormType;
  initialSupplierId?: string;
  initialLabelSearch?: string;
}

export const ToolsPrintModule: React.FC<ToolsPrintModuleProps> = ({
  initialForm,
  initialSupplierId,
  initialLabelSearch,
}) => {
  const { currentUser } = useAuth();

  const [activeForm, setActiveForm] = useState<FormType>(
    initialSupplierId ? 'SUPPLIER_EXPENSE_NOTE' : (initialForm || 'RECEIVING_FORM')
  );
  const [printDate, setPrintDate] = useState<string>(localDateIso());

  // Data sources
  const [receivingDocs, setReceivingDocs] = useState<ReceivingDocument[]>(() => warehouseDb.getReceivings());
  const [items, setItems] = useState<ItemMaster[]>(() => warehouseDb.getItems());
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
  const [selectedReceivingId, setSelectedReceivingId] = useState<string>(receivingDocs[0]?.id || 'BLANK');
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

  // Per-label manual edit overrides
  const [labelOverrides, setLabelOverrides] = useState<Record<string, {
    supplierName?: string;
    shelfLifeText?: string;
    expiryDate?: string;
    customNote?: string;
    arrivalDate?: string;
  }>>({});

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
          warehouseName: 'Gudang Basah & Cold Storage',
          category: item.category,
          subcategory: item.subcategory,
          location: item.location,
          unit: item.baseUnit,
          instruction: isFreezer
            ? 'Cold Storage (≤ -18°C) • Rotasi FEFO'
            : isChiller
            ? 'Chiller Dingin (1°C - 4°C) • Rotasi FEFO'
            : 'Suhu Dingin / Segar • Rotasi FEFO Prioritas',
          badgeText: 'Gudang Basah • FEFO',
          badgeStyle: {
            bg: 'bg-sky-50',
            text: 'text-sky-800',
            border: 'border-sky-300',
          },
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
          warehouseName: 'Gudang Kering (Dry Storage)',
          category: item.category,
          subcategory: item.subcategory,
          location: item.location,
          unit: item.baseUnit,
          instruction: 'Suhu Ruang Kering (18°C - 25°C) • Rotasi FIFO',
          badgeText: 'Gudang Kering • FIFO',
          badgeStyle: {
            bg: 'bg-amber-50',
            text: 'text-amber-800',
            border: 'border-amber-300',
          },
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
        badgeStyle: {
          bg: 'bg-emerald-50',
          text: 'text-emerald-800',
          border: 'border-emerald-300',
        },
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
      arrivalDate: labelArrivalDate,
    });
  };

  const handleSaveModal = () => {
    if (!editingModalData) return;
    setLabelOverrides(prev => ({
      ...prev,
      [editingModalData.id]: {
        supplierName: editingModalData.supplier,
        shelfLifeText: editingModalData.shelfLifeText,
        expiryDate: editingModalData.expiryDate,
        customNote: editingModalData.customNote,
        arrivalDate: editingModalData.arrivalDate,
      },
    }));
    setEditingModalData(null);
  };

  const handleResetItemOverride = (id: string) => {
    setLabelOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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
  const [rackWarehouseFilter, setRackWarehouseFilter] = useState<'ALL' | 'GUDANG_KERING' | 'GUDANG_BASAH'>('ALL');
  const [rackSelectedId, setRackSelectedId] = useState<string>('ALL');
  const [rackSearchQuery, setRackSearchQuery] = useState<string>('');
  const [rackLayoutMode, setRackLayoutMode] = useState<'1' | '2'>('2');
  const [rackGlobalPic, setRackGlobalPic] = useState<string>('');
  const [rackGlobalNote, setRackGlobalNote] = useState<string>('');
  const [selectedRackIds, setSelectedRackIds] = useState<string[]>([]);
  const [hasCustomRackSelection, setHasCustomRackSelection] = useState<boolean>(false);

  // Plakat rak kustom yang dibuat pengguna
  const [customRacks, setCustomRacks] = useState<WarehouseRack[]>([]);

  const [rackOverrides, setRackOverrides] = useState<Record<string, {
    name?: string;
    warehouseType?: 'GUDANG_KERING' | 'GUDANG_BASAH';
    warehouseName?: string;
    zone?: string;
    temperatureGuide?: string;
    humidityGuide?: string;
    capacityMax?: string;
    storageRule?: string;
    rotationMethod?: 'FIFO' | 'FEFO';
    picName?: string;
    customNote?: string;
    extraItemsText?: string;
    customItems?: RackItemDetail[];
  }>>({});

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
  } | null>(null);

  // State untuk penambahan item dari master stok barang atau manual di modal
  const [selectedMasterItemId, setSelectedMasterItemId] = useState<string>('');
  const [masterItemSearch, setMasterItemSearch] = useState<string>('');
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
    const matchItemToRackId = (loc: string, cat: string, name: string, id: string): string => {
      const l = (loc || '').toLowerCase();
      const c = (cat || '').toLowerCase();
      const n = (name || '').toLowerCase();
      const upperId = (id || '').toUpperCase();

      // Check explicit rack ID match in location
      for (const base of BASE_RACKS_CONFIG) {
        if (l.includes(base.id.toLowerCase())) return base.id;
      }
      for (const cr of customRacks) {
        if (l.includes(cr.id.toLowerCase()) || l.includes(cr.name.toLowerCase())) return cr.id;
      }

      if (
        l.includes('palet tengah') ||
        l.includes('plt-krg-t1') ||
        (l.includes('palet') && (l.includes('sak') || l.includes('tengah') || l.includes('curah')))
      ) {
        return 'PLT-KRG-T1';
      }

      if (l.includes('rak a1') || upperId.startsWith('ITM-KRG-001') || n.includes('beras')) return 'RAK-KRG-A1';
      if (l.includes('rak a2') || upperId.startsWith('ITM-KRG-002') || n.includes('minyak')) return 'RAK-KRG-A2';
      if (l.includes('rak a3') || upperId.startsWith('ITM-KRG-003') || upperId.startsWith('ITM-KRG-004') || n.includes('gula') || n.includes('tepung')) return 'RAK-KRG-A3';
      if (l.includes('rak a4') || upperId.startsWith('ITM-KRG-005') || n.includes('garam') || c.includes('bumbu')) return 'RAK-KRG-A4';
      if (l.includes('rak n1') || upperId.startsWith('ITM-NFD-001') || n.includes('sabun') || c.includes('cleaning')) return 'RAK-KRG-N1';
      if (
        l.includes('rak n2') ||
        l.includes('rak n3') ||
        l.includes('apd') ||
        upperId.startsWith('ITM-NFD-') ||
        n.includes('plastik') ||
        n.includes('tissue') ||
        n.includes('sarung tangan')
      )
        return 'RAK-KRG-N2';

      if (
        upperId.startsWith('ITM-CHL-') ||
        l.includes('bin c1') ||
        l.includes('chiller') ||
        n.includes('ayam') ||
        (c.includes('protein') && !n.includes('ikan') && !n.includes('telur'))
      )
        return 'BIN-CHL-C1';
      if (
        upperId.startsWith('ITM-FRZ-') ||
        l.includes('bin f2') ||
        l.includes('freezer') ||
        n.includes('ikan') ||
        n.includes('daging sapi')
      )
        return 'BIN-FRZ-F2';
      if (
        (upperId.startsWith('ITM-BSH-') && (c.includes('sayur') || n.includes('sayur'))) ||
        l.includes('sortir sayur') ||
        c.includes('sayur') ||
        n.includes('bayam') ||
        n.includes('wortel')
      )
        return 'RAK-BSH-V1';
      if (
        (upperId.startsWith('ITM-BSH-') && (c.includes('buah') || n.includes('buah'))) ||
        l.includes('buah') ||
        c.includes('buah') ||
        n.includes('pisang')
      )
        return 'RAK-BSH-F1';
      if (
        (upperId.startsWith('ITM-BSH-') && n.includes('telur')) ||
        l.includes('telur') ||
        n.includes('telur')
      )
        return 'RAK-BSH-T1';

      if (upperId.startsWith('ITM-KRG-')) {
        return 'RAK-KRG-A1';
      }
      if (upperId.startsWith('ITM-BSH-')) {
        return 'RAK-BSH-V1';
      }

      return '';
    };

    const itemsByRackId: Record<string, RackItemDetail[]> = {};
    BASE_RACKS_CONFIG.forEach(r => {
      itemsByRackId[r.id] = [];
    });

    const dynamicRacks: Record<string, WarehouseRack> = {};

    items.forEach(itm => {
      const targetRackId = matchItemToRackId(itm.location, itm.category, itm.name, itm.id);
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
        const dynId = `RAK-DYN-${locClean.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase().slice(0, 14)}`;
        const isWet = /chiller|freezer|basah|dingin|segar|sayur|buah|ikan|daging|telur|protein/i.test(
          locClean + ' ' + itm.category + ' ' + itm.name
        );

        if (!dynamicRacks[dynId]) {
          dynamicRacks[dynId] = {
            id: dynId,
            name: `Rak / Area: ${locClean}`,
            warehouseType: isWet ? 'GUDANG_BASAH' : 'GUDANG_KERING',
            warehouseName: isWet ? 'Gudang Basah & Dingin (Cold Storage)' : 'Gudang Kering (Dry Storage)',
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
        warehouseName: ov.warehouseName || (ov.warehouseType === 'GUDANG_BASAH' ? 'Gudang Basah & Dingin (Cold Storage)' : 'Gudang Kering (Dry Storage)'),
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
      if (rackWarehouseFilter !== 'ALL' && rack.warehouseType !== rackWarehouseFilter) {
        return false;
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
    setMasterItemSearch('');
    setSelectedMasterItemId('');
    setShowManualItemInput(false);
  };

  const handleCreateNewRack = () => {
    setItems(warehouseDb.getItems());
    const nextNum = customRacks.length + 1;
    const newId = `RAK-KST-${String(nextNum).padStart(2, '0')}`;
    setEditingRackData({
      id: newId,
      isNew: true,
      name: `Plakat Rak Kustom #${nextNum}`,
      warehouseType: 'GUDANG_KERING',
      warehouseName: 'Gudang Kering (Dry Storage)',
      zone: 'Sektor Khusus / Tambahan',
      temperatureGuide: '20°C - 25°C (Suhu Ruang Terkendali)',
      humidityGuide: 'Maks. 60% RH',
      capacityMax: '1.000 Kg',
      storageRule: 'Wajib di atas palet plastik/kayu min. 15 cm dari lantai & bersih dari hama.',
      rotationMethod: 'FIFO',
      picName: rackGlobalPic,
      customNote: '',
      items: [],
    });
    setMasterItemSearch('');
    setSelectedMasterItemId('');
    setShowManualItemInput(false);
  };

  const handleSaveRackModal = () => {
    if (!editingRackData) return;
    const {
      id,
      isNew,
      name,
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
    } = editingRackData;

    const whName =
      warehouseType === 'GUDANG_BASAH'
        ? 'Gudang Basah & Dingin (Cold Storage)'
        : 'Gudang Kering (Dry Storage)';

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
      setCustomRacks(prev => [...prev.filter(r => r.id !== id), newRack]);
      if (hasCustomRackSelection) {
        setSelectedRackIds(prev => [...prev, id]);
      }
    } else {
      setRackOverrides(prev => ({
        ...prev,
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
          customItems: rackItems,
        },
      }));
    }
    setEditingRackData(null);
  };

  const handleDeleteCustomRack = (id: string) => {
    setCustomRacks(prev => prev.filter(r => r.id !== id));
    setRackOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSelectedRackIds(prev => prev.filter(i => i !== id));
    if (editingRackData?.id === id) {
      setEditingRackData(null);
    }
  };

  const handleResetRackOverride = (id: string) => {
    setRackOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setEditingRackData(null);
  };

  const handleAddItemFromMaster = () => {
    if (!editingRackData || !selectedMasterItemId) return;
    const masterItem = items.find(i => i.id === selectedMasterItemId);
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
      handlingNote: masterItem.notes || (masterItem.location ? `Lokasi: ${masterItem.location}` : ''),
    };

    setEditingRackData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: [...prev.items, newItem],
      };
    });
    setSelectedMasterItemId('');
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
      handlingNote: manualItemForm.handlingNote.trim() || 'Penataan rak fisik manual',
    };

    setEditingRackData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        items: [...prev.items, newItem],
      };
    });
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
      };
    });
  };

  const handleUpdateItemField = (index: number, field: keyof RackItemDetail, value: any) => {
    if (!editingRackData) return;
    setEditingRackData(prev => {
      if (!prev) return null;
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Modal ubah label/plakat bisa ditutup dengan Escape.
  useEffect(() => {
    if (!editingModalData && !editingRackData) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setEditingModalData(null);
      setEditingRackData(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingModalData, editingRackData]);

  // Jumlah lembar/label yang akan tercetak, untuk label tombol cetak.
  const printCount =
    activeForm === 'ITEM_TAG_LABEL'
      ? itemTagsToPrint.length
      : activeForm === 'EQUIPMENT_LABEL'
      ? labelsToPrint.length
      : activeForm === 'RACK_LABEL'
      ? racksToPrint.length
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
            max-height: 133mm !important;
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
            {printCount === null ? 'Cetak' : `Cetak ${printCount} ${activeForm === 'RACK_LABEL' ? 'plakat' : activeForm === 'ITEM_TAG_LABEL' ? 'tag' : 'label'}`}
          </button>
        </div>

        <div role="tablist" aria-label="Jenis form" className="flex gap-1 overflow-x-auto px-4 mt-3 border-b border-slate-200">
          {FORM_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeForm === tab.id}
              title={tab.hint}
              onClick={() => setActiveForm(tab.id)}
              className={`shrink-0 px-3 min-h-[44px] sm:min-h-[38px] text-xs whitespace-nowrap border-b-2 -mb-px cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-t-md ${
                activeForm === tab.id
                  ? 'border-emerald-700 text-emerald-800 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 font-medium'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="px-4 pt-2 text-[11px] text-slate-600">{FORM_TABS.find(t => t.id === activeForm)?.hint}</p>

        {/* Pengaturan sesuai form yang dipilih */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-xs">
          {activeForm !== 'EQUIPMENT_LABEL' && activeForm !== 'RACK_LABEL' && activeForm !== 'SUPPLIER_EXPENSE_NOTE' && activeForm !== 'ITEM_TAG_LABEL' ? (
            <div>
              <label htmlFor="print-date" className={LABEL_CLS}>Tanggal dokumen</label>
              <input id="print-date" type="date" value={printDate} onChange={e => setPrintDate(e.target.value || localDateIso())} className={INPUT_CLS} />
            </div>
          ) : activeForm === 'SUPPLIER_EXPENSE_NOTE' ? (
            <>
              <div>
                <label htmlFor="exp-supplier" className={LABEL_CLS}>Supplier</label>
                <select id="exp-supplier" value={expenseSupplierId} onChange={e => handleSupplierChange(e.target.value)} className={INPUT_CLS}>
                  {suppliers.length === 0 && <option value="">Belum ada supplier</option>}
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplyCategory})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="exp-gr" className={LABEL_CLS}>Ambil rincian dari penerimaan</label>
                <select
                  id="exp-gr"
                  value={expenseReceivingId}
                  onChange={e => handleLoadReceivingDocToExpense(e.target.value)}
                  className={INPUT_CLS}
                >
                  <option value="">{supplierReceivings.length === 0 ? 'Belum ada penerimaan dari supplier ini' : 'Pilih dokumen penerimaan'}</option>
                  {supplierReceivings.map(r => (
                    <option key={r.id} value={r.id}>
                      {r.id} ({r.deliveryNoteNo || 'tanpa SJ'}), {formatLongDate(r.date)}
                    </option>
                  ))}
                </select>
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
                <select id="exp-status" value={expenseStatus} onChange={e => setExpenseStatus(e.target.value as typeof expenseStatus)} className={INPUT_CLS}>
                  <option value="LUNAS">Lunas</option>
                  <option value="DP">Uang muka (DP)</option>
                  <option value="TEMPO">Tempo</option>
                  <option value="PENDING">Menunggu verifikasi</option>
                </select>
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
                <select
                  value={labelWarehouseFilter}
                  onChange={e => {
                    setLabelWarehouseFilter(e.target.value as any);
                    setLabelCategoryFilter('ALL');
                    setHasCustomSelection(false);
                  }}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <option value="ALL">Semua gudang & aset</option>
                  <option value="GUDANG_KERING">Gudang kering</option>
                  <option value="GUDANG_BASAH">Gudang basah</option>
                  <option value="EQUIPMENT">Aset dapur</option>
                </select>
              </div>

              <div>
                <label className={LABEL_CLS}>Kategori</label>
                <select
                  value={labelCategoryFilter}
                  onChange={e => {
                    setLabelCategoryFilter(e.target.value);
                    setHasCustomSelection(false);
                  }}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <option value="ALL">Semua kategori ({categoryCounts['ALL'] || 0})</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat} ({categoryCounts[cat] || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLS}>Supplier</label>
                <select
                  value={labelGlobalSupplier}
                  onChange={e => setLabelGlobalSupplier(e.target.value)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <option value="AUTO">Dari penerimaan terakhir</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.supplyCategory})
                    </option>
                  ))}
                  <option value="BLANK">Kosongkan (diisi tangan)</option>
                </select>
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
                <select
                  value={labelGridCols}
                  onChange={e => setLabelGridCols(e.target.value as '2' | '3')}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <option value="2">Besar, 2 kolom</option>
                  <option value="3">Kecil, 3 kolom</option>
                </select>
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
                <select
                  id="tag-source"
                  value={tagSourceType}
                  onChange={e => setTagSourceType(e.target.value as 'FROM_GR' | 'FROM_ITEMS')}
                  className={INPUT_CLS}
                >
                  <option value="FROM_GR" disabled={receivingDocs.length === 0}>Dokumen penerimaan</option>
                  <option value="FROM_ITEMS">Daftar barang (tanpa jumlah)</option>
                </select>
              </div>

              {tagSourceType === 'FROM_GR' ? (
                <div>
                  <label htmlFor="tag-gr" className={LABEL_CLS}>Dokumen penerimaan</label>
                  <select
                    id="tag-gr"
                    value={tagSelectedGrId}
                    onChange={e => {
                      const grId = e.target.value;
                      setTagSelectedGrId(grId);
                      const doc = receivingDocs.find(d => d.id === grId);
                      if (doc) {
                        setTagGlobalSupplier(doc.supplierName);
                        setTagArrivalDate(doc.date);
                        setTagArrivalTime(doc.arrivalTime || '');
                      }
                    }}
                    className={INPUT_CLS}
                  >
                    {receivingDocs.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.id}, {d.supplierName} ({formatLongDate(d.date)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className={LABEL_CLS}>Gudang</label>
                  <select
                    value={tagWarehouseFilter}
                    onChange={e => setTagWarehouseFilter(e.target.value as any)}
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <option value="ALL">Semua gudang</option>
                    <option value="GUDANG_BASAH">Gudang basah (chiller/freezer)</option>
                    <option value="GUDANG_KERING">Gudang kering</option>
                  </select>
                </div>
              )}

              {/* 3. Ukuran Cetak (Muat Banyak per Lembar) */}
              <div>
                <label className={LABEL_CLS}>Ukuran tag</label>
                <select
                  value={tagGridCols}
                  onChange={e => setTagGridCols(e.target.value as any)}
                  className={INPUT_CLS}
                >
                  <option value="4">Kecil, 16 per lembar</option>
                  <option value="3">Sedang, 12 per lembar</option>
                  <option value="2">Besar, 6 per lembar</option>
                </select>
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
                <select
                  value={tagExpiryMode}
                  onChange={e => setTagExpiryMode(e.target.value as any)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <option value="AUTO">Hitung dari masa simpan</option>
                  <option value="CUSTOM_DATE">Tanggal tertentu</option>
                  <option value="BLANK">Kosongkan (diisi tangan)</option>
                </select>
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
                  <select
                    value={tagCopiesPerItem}
                    onChange={e => setTagCopiesPerItem(Number(e.target.value))}
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-medium"
                  >
                    <option value={1}>1 tag</option>
                    <option value={2}>2 tag (2 wadah)</option>
                    <option value={3}>3 tag (3 wadah)</option>
                    <option value={4}>4 tag (4 wadah)</option>
                    <option value={5}>5 tag (5 wadah)</option>
                    <option value={8}>8 tag (8 wadah)</option>
                    <option value={10}>10 tag (10 wadah)</option>
                  </select>
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
                <select
                  value={tagQcStatus}
                  onChange={e => setTagQcStatus(e.target.value)}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-medium"
                >
                  <option value="Lolos QC Organoleptik & Higiene">Lolos QC organoleptik & higiene</option>
                  <option value="Karantina / Uji Organoleptik">Karantina, perlu cek ulang</option>
                  <option value="">Kosongkan (diisi tangan)</option>
                </select>
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
          ) : (
            /* activeForm === 'RACK_LABEL' */
            <>
              <div>
                <label className={LABEL_CLS}>Gudang</label>
                <select
                  value={rackWarehouseFilter}
                  onChange={e => {
                    setRackWarehouseFilter(e.target.value as any);
                    setRackSelectedId('ALL');
                    setHasCustomRackSelection(false);
                  }}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <option value="ALL">Semua gudang</option>
                  <option value="GUDANG_KERING">Gudang kering</option>
                  <option value="GUDANG_BASAH">Gudang basah (chiller/freezer)</option>
                </select>
              </div>

              <div>
                <label className={LABEL_CLS}>Rak</label>
                <select
                  value={rackSelectedId}
                  onChange={e => {
                    setRackSelectedId(e.target.value);
                    setHasCustomRackSelection(false);
                  }}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                >
                  <option value="ALL">Semua rak ({allWarehouseRacks.length})</option>
                  {allWarehouseRacks
                    .filter(r => rackWarehouseFilter === 'ALL' || r.warehouseType === rackWarehouseFilter)
                    .map(r => (
                      <option key={r.id} value={r.id}>
                        {r.id} • {r.name} ({r.items.length} item)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className={LABEL_CLS}>Ukuran plakat</label>
                <select
                  value={rackLayoutMode}
                  onChange={e => setRackLayoutMode(e.target.value as '1' | '2')}
                  className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 font-medium"
                >
                  <option value="2">2 plakat per A4</option>
                  <option value="1">1 plakat per A4</option>
                </select>
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
          )}

          {activeForm === 'RECEIVING_FORM' && (
            <div className="sm:col-span-2">
              <label htmlFor="rcv-doc" className={LABEL_CLS}>Dokumen penerimaan</label>
              <select id="rcv-doc" value={selectedReceivingId} onChange={e => setSelectedReceivingId(e.target.value)} className={INPUT_CLS}>
                <option value="BLANK">Form kosong (diisi tangan)</option>
                {receivingDocs.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.id}, {d.supplierName} ({formatLongDate(d.date)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeForm === 'OPNAME_SHEET' && (
            <div className="sm:col-span-2">
              <label htmlFor="opn-loc" className={LABEL_CLS}>Lokasi</label>
              <select id="opn-loc" value={opnameLocation} onChange={e => setOpnameLocation(e.target.value)} className={INPUT_CLS}>
                <option value="ALL">Semua lokasi</option>
                <option value="Gudang Kering">Gudang kering</option>
                <option value="Chiller">Chiller</option>
                <option value="Freezer">Freezer</option>
                <option value="Dapur">Dapur</option>
              </select>
            </div>
          )}

          {activeForm === 'BIN_CARD' && (
            <div className="sm:col-span-2">
              <label htmlFor="bin-item" className={LABEL_CLS}>Barang</label>
              <select id="bin-item" value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className={INPUT_CLS}>
                {items.length === 0 && <option value="">Belum ada barang terdaftar</option>}
                {items.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.location})
                  </option>
                ))}
              </select>
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
          activeForm === 'EQUIPMENT_LABEL' || activeForm === 'RACK_LABEL' || activeForm === 'ITEM_TAG_LABEL' ? 'p-4 sm:p-6' : 'p-5 sm:p-10'
        }`}
      >
        {/* Kop dokumen, sama dengan Laporan Pengeluaran. Label dan plakat dicetak tanpa kop. */}
        {activeForm !== 'EQUIPMENT_LABEL' && activeForm !== 'RACK_LABEL' && activeForm !== 'ITEM_TAG_LABEL' && (
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
                      className={`relative border-2 border-slate-800 rounded-xl p-2.5 bg-white flex flex-col justify-between gap-2 shadow-2xs break-inside-avoid transition-all ${
                        !isSelected ? 'opacity-40 border-slate-300 no-print' : ''
                      } print:border-slate-800 print:shadow-none print:break-inside-avoid print:p-2`}
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
                            <span className="px-1 py-0.2 rounded text-[7.5px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300">
                              Wadah {tag.copyIndex}/{tag.totalCopies}
                            </span>
                          )}
                          <span
                            className={`px-1 py-0.2 rounded text-[7.5px] font-bold border ${
                              tag.warehouseType === 'GUDANG_BASAH'
                                ? 'bg-sky-50 text-sky-800 border-sky-300'
                                : 'bg-amber-50 text-amber-800 border-amber-300'
                            }`}
                          >
                            {tag.warehouseType === 'GUDANG_BASAH' ? 'FEFO' : 'FIFO'}
                          </span>
                        </div>
                      </div>

                      {/* Main Item Name & Lot ID */}
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="font-mono font-bold text-[8px] text-slate-500 tracking-tight">
                            {tag.batchLotNo}
                          </div>
                          <h4
                            className={`font-bold text-slate-900 leading-snug line-clamp-2 ${
                              isMini ? 'text-[11px]' : isCompact ? 'text-xs' : 'text-sm'
                            }`}
                          >
                            {tag.name}
                          </h4>
                          <div className="text-[8px] text-slate-500 truncate">
                            <span>Kat:</span> <span className="font-medium text-slate-700">{tag.category}</span>
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
                          <QrSvg value={tag.id} className={isMini ? 'w-9 h-9' : isCompact ? 'w-10 h-10' : 'w-12 h-12'} />
                          <span className="text-[6.5px] font-mono font-bold text-slate-800 truncate w-full mt-0.2">
                            {tag.id}
                          </span>
                        </div>
                      </div>

                      {/* Data Supplier, Waktu Datang & Expired Strip */}
                      <div className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[8.5px] space-y-1">
                        {/* Baris 1: Supplier */}
                        <div className="flex items-center gap-1 text-slate-800 truncate">
                          <Truck className="w-2.5 h-2.5 text-emerald-700 shrink-0" />
                          <span className="text-slate-500 font-medium">Supplier:</span>
                          <span className="font-bold text-slate-900 truncate">{tag.supplier || <span className="font-normal text-slate-400">{BLANK}</span>}</span>
                        </div>

                        {/* Baris 2: Tanggal & Waktu Datang */}
                        <div className="flex items-center gap-1 text-slate-800 truncate">
                          <Clock className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                          <span className="text-slate-500 font-medium">Datang:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {tag.arrivalDateFormatted}
                          </span>
                          <span className="text-slate-400 font-mono">•</span>
                          <span className="font-mono font-bold text-slate-900">
                            {tag.arrivalTime || <span className="font-normal text-slate-400">..:..</span>}
                          </span>
                        </div>

                        {/* Baris 3: Estimasi Expired */}
                        <div className="pt-0.5 border-t border-slate-200 flex items-center justify-between text-[8px]">
                          <span className="text-slate-600 font-semibold flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                            Batas pakai:
                          </span>
                          {tag.expiryDate ? (
                            <span className="font-mono font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                              {tag.expiryDate}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-400">
                              ..../..../........
                            </span>
                          )}
                        </div>

                        {/* Baris 4: Masa Simpan */}
                        <div className="text-[7.5px] text-slate-500 flex items-center justify-between truncate">
                          <span>Masa simpan:</span>
                          <span className="font-medium text-emerald-800 truncate">{tag.shelfLifeText}</span>
                        </div>
                      </div>

                      {/* Detail Tambahan: Lokasi, QC & Petugas */}
                      <div className="grid grid-cols-2 gap-1 text-[7.5px] text-slate-600 pt-0.5 border-t border-slate-100">
                        <div className="truncate">
                          <span className="text-slate-400 block text-[6.5px]">Penyimpanan:</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {tag.storageTemp}
                          </span>
                        </div>
                        <div className="text-right truncate">
                          <span className="text-slate-500 block text-[6.5px]">{tag.qcStatus || 'Hasil QC: ..........'}</span>
                          <span className="font-semibold text-slate-900 truncate block">
                            {tag.inspector || BLANK}
                          </span>
                        </div>
                      </div>

                      {/* Area Catatan Lapangan / Paraf Dapur */}
                      <div className="pt-0.5 border-t border-slate-200">
                        <div className="min-h-[14px] border border-dashed border-slate-300 rounded px-1 text-[7px] text-slate-500 flex items-center justify-between">
                          <span>Catatan: {tag.notes || '-'}</span>
                          <span className="text-[6.5px] text-slate-500">Paraf: ..........</span>
                        </div>
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
                      className={`relative border-2 border-slate-800 rounded-xl p-3.5 bg-white flex flex-col justify-between gap-2.5 shadow-2xs break-inside-avoid transition-all ${
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
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-medium border ${label.badgeStyle.bg} ${label.badgeStyle.text} ${label.badgeStyle.border} shrink-0`}
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
                              <span className="text-slate-400 font-normal">___________________________</span>
                            )}
                          </div>
                        </div>

                        {/* High-Contrast QR Code Block */}
                        <div
                          className={`flex flex-col items-center justify-center p-1 border-2 border-slate-900 rounded-lg bg-white shrink-0 text-center ${
                            labelGridCols === '3' ? 'w-16 h-16' : 'w-20 h-20'
                          }`}
                        >
                          <QrSvg value={label.id} className={labelGridCols === '3' ? 'w-11 h-11' : 'w-14 h-14'} />
                          <span className="text-[7px] font-mono font-bold text-slate-800 truncate w-full mt-0.5">
                            {label.id}
                          </span>
                        </div>
                      </div>

                      {/* Tanggal Datang, Masa Expired & Batas Expired */}
                      <div className="p-2 bg-slate-50/90 rounded-lg border border-slate-200 text-[9px] space-y-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-slate-500 font-medium block text-[8px]">Tanggal datang:</span>
                            <span className="font-mono font-bold text-slate-900 text-[10px]">
                              {label.arrivalDateFormatted}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium block text-[8px]">Masa simpan:</span>
                            <span className="font-semibold text-emerald-800 text-[9px] block truncate" title={label.shelfLifeText}>
                              {label.shelfLifeText}
                            </span>
                          </div>
                        </div>

                        <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between text-[8px]">
                          <span className="text-slate-500 font-medium">Batas pakai:</span>
                          {label.expiryDate ? (
                            <span className="font-mono font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {label.expiryDate}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-400 font-medium">
                              ..../..../........
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Area Catatan / Note Lapangan (Bisa diisi / Tulis Tangan) */}
                      <div className="pt-0.5 border-t border-slate-200">
                        <div className="flex items-center justify-between text-[8px] text-slate-500 font-medium mb-0.5">
                          <span className="font-semibold text-slate-700">Catatan:</span>
                        </div>
                        <div className="min-h-[22px] border border-dashed border-slate-300 rounded px-1.5 py-0.5 bg-slate-50/60 text-[8px] text-slate-800 flex items-center">
                          {label.customNote ? (
                            <span className="font-medium text-slate-900">{label.customNote}</span>
                          ) : (
                            <span className="text-slate-400 select-none">{BLANK}</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right text-[8px] font-semibold text-slate-700 pt-1 border-t border-slate-200">
                        {label.warehouseName}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Plakat rak: tanpa kop, pembeda warna gudang kering (amber) dan basah (biru) */}
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
                  const isDry = rack.warehouseType === 'GUDANG_KERING';
                  const isOverridden = Boolean(rackOverrides[rack.id] || rack.isCustom);

                  return (
                    <div
                      key={rack.id}
                      className={`relative border-2 ${
                        isDry ? 'border-amber-600 bg-white' : 'border-sky-600 bg-white'
                      } rounded-xl p-3.5 sm:p-4 print:p-3 flex flex-col justify-between gap-2.5 print:gap-2 shadow-xs transition-all ${
                        !isSelected ? 'opacity-40 border-slate-300 no-print' : ''
                      } ${
                        rackLayoutMode === '2'
                          ? 'rack-card-2per-page'
                          : 'rack-card-1per-page'
                      }`}
                      style={{
                        borderColor: isDry ? '#d97706' : '#0284c7',
                        WebkitPrintColorAdjust: 'exact',
                        printColorAdjust: 'exact',
                      }}
                    >
                      {/* Screen selection & edit buttons (Hidden on print) */}
                      <div className="no-print absolute top-3 right-3 z-10 flex items-center gap-1.5">
                        {isOverridden && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Kustom
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditRackModal(rack)}
                          className="px-2 py-1 rounded-lg bg-white/90 border border-slate-300 hover:bg-slate-100 text-slate-700 text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          aria-label={`Ubah plakat ${rack.name}`}
                        >
                          <Edit3 className="w-3 h-3 text-emerald-700" />
                          <span>Ubah</span>
                        </button>
                        {rack.isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomRack(rack.id)}
                            className="p-1 rounded-lg bg-white/90 border border-slate-300 hover:bg-rose-50 text-slate-500 hover:text-rose-700 text-[10px] transition-colors cursor-pointer shadow-2xs"
                            aria-label={`Hapus plakat ${rack.name}`}
                          >
                            <Trash2 className="w-3 h-3" />
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

                      {/* Header Plakat: Visual Pembeda Basah vs Kering */}
                      <div
                        className={`-mx-3.5 -mt-3.5 sm:-mx-4 sm:-mt-4 print:-mx-3 print:-mt-3 p-3 print:py-2 print:px-3 rounded-t-lg flex items-center justify-between border-b ${
                          isDry
                            ? 'bg-amber-800 text-amber-50 border-amber-900'
                            : 'bg-sky-800 text-sky-50 border-sky-900'
                        }`}
                        style={{
                          backgroundColor: isDry ? '#92400e' : '#0369a1',
                          color: isDry ? '#fffbeb' : '#f0f9ff',
                          borderColor: isDry ? '#78350f' : '#075985',
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1.5 rounded-lg ${isDry ? 'bg-amber-950/60' : 'bg-sky-950/60'}`}
                            style={{
                              backgroundColor: isDry ? 'rgba(69, 26, 3, 0.65)' : 'rgba(8, 47, 73, 0.65)',
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                            }}
                          >
                            {isDry ? (
                              <Package className="w-4 h-4 text-amber-200" />
                            ) : (
                              <Snowflake className="w-4 h-4 text-sky-200" />
                            )}
                          </div>
                          <div>
                            <div className="text-[9.5px] print:text-[8.5px] font-bold tracking-tight opacity-90">
                              SPPG Tumpang Jeru • {rack.warehouseName}
                            </div>
                            <div className="text-xs sm:text-sm print:text-xs font-bold tracking-tight text-white leading-tight">
                              {rack.zone}
                            </div>
                          </div>
                        </div>

                        <div className="text-right pr-14 sm:pr-0">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[9.5px] print:text-[8.5px] font-bold border ${
                              isDry
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-sky-100 text-sky-900 border-sky-300'
                            }`}
                            style={{
                              backgroundColor: isDry ? '#fef3c7' : '#e0f2fe',
                              color: isDry ? '#78350f' : '#075985',
                              borderColor: isDry ? '#fcd34d' : '#7dd3fc',
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                            }}
                          >
                            Rotasi {rack.rotationMethod}
                          </span>
                        </div>
                      </div>

                      {/* Rack Identification & QR Code */}
                      <div className="flex items-start justify-between gap-2.5 pt-0.5">
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div
                            className={`inline-block px-2 py-0.5 rounded font-mono font-bold text-[10px] tracking-tight ${
                              isDry ? 'bg-amber-800 text-amber-50' : 'bg-sky-800 text-sky-50'
                            }`}
                            style={{
                              backgroundColor: isDry ? '#92400e' : '#0369a1',
                              color: '#ffffff',
                              WebkitPrintColorAdjust: 'exact',
                              printColorAdjust: 'exact',
                            }}
                          >
                            {rack.id}
                          </div>
                          <h2 className="text-sm sm:text-base print:text-sm font-bold text-slate-900 tracking-tight leading-snug">
                            {rack.name}
                          </h2>
                          <div className="flex items-center gap-2 text-[11px] print:text-[9.5px] text-slate-600 flex-wrap pt-0.5">
                            <span className="flex items-center gap-1 font-medium text-slate-800">
                              <Thermometer className="w-3 h-3 text-slate-500" />
                              <span>{rack.temperatureGuide}</span>
                            </span>
                            {rack.humidityGuide && (
                              <span className="text-slate-500 font-medium">
                                • {rack.humidityGuide}
                              </span>
                            )}
                            <span className="text-slate-600 font-medium">
                              • Kapasitas: <span className="font-bold text-slate-900">{rack.capacityMax}</span>
                            </span>
                          </div>
                        </div>

                        {/* Barcode / QR Code Box with Amber/Sky Theme */}
                        <div
                          className={`flex flex-col items-center justify-center p-1 border-2 rounded-xl shrink-0 text-center w-16 h-16 print:w-14 print:h-14 ${
                            isDry
                              ? 'border-amber-600 bg-amber-50 text-amber-900'
                              : 'border-sky-600 bg-sky-50 text-sky-900'
                          }`}
                          style={{
                            borderColor: isDry ? '#d97706' : '#0284c7',
                            backgroundColor: isDry ? '#fffbeb' : '#f0f9ff',
                            WebkitPrintColorAdjust: 'exact',
                            printColorAdjust: 'exact',
                          }}
                        >
                          <QrSvg value={rack.id} className="w-11 h-11 print:w-10 print:h-10" color={isDry ? '#78350f' : '#075985'} />
                          <span
                            className={`text-[8px] print:text-[7px] font-mono font-bold truncate w-full mt-0.5 ${
                              isDry ? 'text-amber-900' : 'text-sky-900'
                            }`}
                            style={{ color: isDry ? '#78350f' : '#075985' }}
                          >
                            {rack.id}
                          </span>
                        </div>
                      </div>

                      {/* DAFTAR ITEM YANG MENGISI RAK INI */}
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
                                <tr
                                  className={`${
                                    isDry
                                      ? 'bg-amber-100/90 text-amber-950 border-b border-amber-300'
                                      : 'bg-sky-100/90 text-sky-950 border-b border-sky-300'
                                  } font-bold text-[9.5px] print:text-[8.5px]`}
                                  style={{
                                    backgroundColor: isDry ? '#fef3c7' : '#e0f2fe',
                                    color: isDry ? '#451a03' : '#082f49',
                                    borderColor: isDry ? '#fcd34d' : '#bae6fd',
                                    WebkitPrintColorAdjust: 'exact',
                                    printColorAdjust: 'exact',
                                  }}
                                >
                                  <th className="py-1 px-2 w-7 text-center">No</th>
                                  <th className="py-1 px-2 w-20">Kode SKU</th>
                                  <th className="py-1 px-2">Nama Bahan Pangan / Barang</th>
                                  <th className="py-1 px-2">Kategori</th>
                                  <th className="py-1 px-2 w-16 text-center">Satuan</th>
                                  <th className="py-1 px-2">Catatan Penanganan / Posisi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 text-[10px] print:text-[9px]">
                                {rack.items.map((itm, idx) => (
                                  <tr key={`${itm.id}-${idx}`} className="hover:bg-slate-50/50">
                                    <td className="py-1 px-2 text-center text-slate-500 font-mono text-[9.5px] print:text-[8.5px]">
                                      {String(idx + 1).padStart(2, '0')}
                                    </td>
                                    <td className="py-1 px-2 font-mono font-bold text-slate-900 text-[9.5px] print:text-[8.5px]">
                                      {itm.id}
                                    </td>
                                    <td className="py-1 px-2">
                                      <div className="font-bold text-slate-900 leading-tight">{itm.name}</div>
                                      {itm.subcategory && (
                                        <div className="text-[8.5px] print:text-[7.5px] text-slate-500 line-clamp-1">
                                          {itm.subcategory}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-1 px-2 text-slate-600">
                                      <span className="px-1 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200 text-[8.5px] print:text-[7.5px]">
                                        {itm.category}
                                      </span>
                                    </td>
                                    <td className="py-1 px-2 text-center font-mono font-semibold text-slate-800">
                                      {itm.unit || 'Kg'}
                                    </td>
                                    <td className="py-1 px-2 text-slate-600">
                                      {itm.handlingNote || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Garis Tambahan Item Lapangan */}
                        <div className="pt-0.5 flex items-center justify-between text-[8.5px] print:text-[7.5px] text-slate-500">
                          <span className="font-medium text-slate-700 shrink-0">Tambahan:</span>
                          <span className="text-slate-400 truncate pl-2">
                            ...................................................................................................................................................
                          </span>
                        </div>
                      </div>

                      {/* Standar Operasional Penataan (SOP Rak SPPG) */}
                      <div
                        className={`p-2 print:p-1.5 rounded-lg border text-xs print:text-[9px] space-y-0.5 ${
                          isDry
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                            : 'bg-sky-50/70 border-sky-200 text-sky-950'
                        }`}
                        style={{
                          backgroundColor: isDry ? '#fffbeb' : '#f0f9ff',
                          borderColor: isDry ? '#fde68a' : '#bae6fd',
                          WebkitPrintColorAdjust: 'exact',
                          printColorAdjust: 'exact',
                        }}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-[10px] print:text-[9px]">
                          <ShieldCheck
                            className={`w-3.5 h-3.5 shrink-0 ${isDry ? 'text-amber-700' : 'text-sky-700'}`}
                            style={{ color: isDry ? '#b45309' : '#0369a1' }}
                          />
                          <span>Aturan penyimpanan:</span>
                        </div>
                        <p className="text-[9.5px] print:text-[8.5px] leading-snug text-slate-700">
                          {rack.storageRule}
                        </p>
                        {rack.customNote && (
                          <div className="text-[9px] print:text-[8px] font-medium text-slate-800 pt-0.5 border-t border-slate-200/80">
                            <span className="font-semibold">Catatan Khusus:</span> {rack.customNote}
                          </div>
                        )}
                      </div>

                      {/* Footer Plakat: PIC & Paraf */}
                      <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                        <div>
                          <span className="text-[9px] print:text-[8px] text-slate-600">
                            Penanggung jawab: <span className="font-semibold text-slate-900">{rack.picName || BLANK}</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] print:text-[8px] text-slate-600 block">
                            Paraf / tanggal pasang
                          </span>
                          <span className="text-slate-400 text-[10px] print:text-[9px]">
                            .................... / ..../..../........
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

      {/* Modal Edit Label Khusus (Hanya di layar, hidden on print) */}
      {editingModalData && (
        <div role="dialog" aria-modal="true" className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Edit Data Stiker: {editingModalData.name}
                </h3>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  ID: {editingModalData.id} • Sesuaikan data sebelum dicetak
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingModalData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nama Supplier / Mitra</label>
                <input
                  type="text"
                  value={editingModalData.supplier}
                  onChange={e => setEditingModalData({ ...editingModalData, supplier: e.target.value })}
                  placeholder="Kosongkan jika ingin tulis tangan manual..."
                  className="w-full px-3 py-2 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tanggal Datang</label>
                  <input
                    type="date"
                    value={editingModalData.arrivalDate}
                    onChange={e => setEditingModalData({ ...editingModalData, arrivalDate: e.target.value })}
                    className="w-full px-3 py-2 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Masa Expired (Berapa Lama)</label>
                  <input
                    type="text"
                    value={editingModalData.shelfLifeText}
                    onChange={e => setEditingModalData({ ...editingModalData, shelfLifeText: e.target.value })}
                    placeholder="Contoh: 1 - 2 Hari, 6 Bulan..."
                    className="w-full px-3 py-2 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-medium">Batas Expired (Manual)</label>
                  <span className="text-[10px] text-slate-500 italic">Kosongkan jika ingin diisi manual nanti</span>
                </div>
                <input
                  type="text"
                  value={editingModalData.expiryDate}
                  onChange={e => setEditingModalData({ ...editingModalData, expiryDate: e.target.value })}
                  placeholder="Biarkan kosong untuk isi manual di kertas stiker..."
                  className="w-full px-3 py-2 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Catatan Tambahan (Bisa Kosong)</label>
                <input
                  type="text"
                  value={editingModalData.customNote}
                  onChange={e => setEditingModalData({ ...editingModalData, customNote: e.target.value })}
                  placeholder="Kosongkan untuk tulis tangan di kertas stiker..."
                  className="w-full px-3 py-2 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleResetItemOverride(editingModalData.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset ke Bawaan
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingModalData(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveModal}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Plakat Rak (Hanya di layar, hidden on print) */}
      {editingRackData && (
        <div role="dialog" aria-modal="true" className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-5 sm:p-6 border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-emerald-700" />
                  <span>
                    {editingRackData.isNew
                      ? 'Tambah Plakat Rak Gudang Baru'
                      : `Edit Plakat Rak: ${editingRackData.name}`}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  ID: <span className="font-mono font-bold text-slate-800">{editingRackData.id}</span> •{' '}
                  {editingRackData.warehouseType === 'GUDANG_KERING'
                    ? 'Gudang Kering (Dry Storage)'
                    : 'Gudang Basah & Dingin (Cold Storage)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRackData(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Bagian 1: Identitas & Standar Penyimpanan Rak */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-3.5 bg-emerald-600 rounded-full"></span>
                1. Identitas & Standar Penyimpanan Rak
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className={LABEL_CLS}>Kode Rak / Barcode</label>
                  <input
                    type="text"
                    value={editingRackData.id}
                    disabled={!editingRackData.isNew}
                    onChange={e => setEditingRackData({ ...editingRackData, id: e.target.value.toUpperCase() })}
                    placeholder="Misal: RAK-KRG-A5"
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white font-mono font-bold text-slate-900 text-xs focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-2">
                  <label className={LABEL_CLS}>Nama Plakat Rak</label>
                  <input
                    type="text"
                    value={editingRackData.name}
                    onChange={e => setEditingRackData({ ...editingRackData, name: e.target.value })}
                    placeholder="Misal: Rak A1 - Sembako Beras & Karung Pangan"
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white font-medium text-slate-900 text-xs focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className={LABEL_CLS}>Tipe Gudang</label>
                  <select
                    value={editingRackData.warehouseType}
                    onChange={e =>
                      setEditingRackData({
                        ...editingRackData,
                        warehouseType: e.target.value as any,
                        warehouseName:
                          e.target.value === 'GUDANG_BASAH'
                            ? 'Gudang Basah & Dingin (Cold Storage)'
                            : 'Gudang Kering (Dry Storage)',
                      })
                    }
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <option value="GUDANG_KERING">Gudang kering</option>
                    <option value="GUDANG_BASAH">Gudang Basah / Dingin (Cold Storage)</option>
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLS}>Metode Rotasi</label>
                  <select
                    value={editingRackData.rotationMethod}
                    onChange={e =>
                      setEditingRackData({ ...editingRackData, rotationMethod: e.target.value as any })
                    }
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-medium focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <option value="FIFO">FIFO (First In First Out)</option>
                    <option value="FEFO">FEFO (First Expired First Out)</option>
                  </select>
                </div>

                <div>
                  <label className={LABEL_CLS}>Zona / Sektor Rak</label>
                  <input
                    type="text"
                    value={editingRackData.zone}
                    onChange={e => setEditingRackData({ ...editingRackData, zone: e.target.value })}
                    placeholder="Misal: Zona Sembako Sektor A"
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className={LABEL_CLS}>Kapasitas Beban Maksimal</label>
                  <input
                    type="text"
                    value={editingRackData.capacityMax}
                    onChange={e => setEditingRackData({ ...editingRackData, capacityMax: e.target.value })}
                    placeholder="Misal: 1.500 Kg (30 Karung)"
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className={LABEL_CLS}>Parameter Suhu</label>
                  <input
                    type="text"
                    value={editingRackData.temperatureGuide}
                    onChange={e =>
                      setEditingRackData({ ...editingRackData, temperatureGuide: e.target.value })
                    }
                    placeholder="Misal: 20°C - 25°C (Suhu Ruang)"
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className={LABEL_CLS}>Parameter Kelembapan</label>
                  <input
                    type="text"
                    value={editingRackData.humidityGuide || ''}
                    onChange={e =>
                      setEditingRackData({ ...editingRackData, humidityGuide: e.target.value })
                    }
                    placeholder="Misal: Maks. 60% RH"
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className={LABEL_CLS}>Penanggung jawab</label>
                  <input
                    type="text"
                    value={editingRackData.picName}
                    onChange={e => setEditingRackData({ ...editingRackData, picName: e.target.value })}
                    placeholder="Nama PIC Rak..."
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-2">
                  <label className={LABEL_CLS}>Standar Penataan (SOP Rak)</label>
                  <input
                    type="text"
                    value={editingRackData.storageRule}
                    onChange={e => setEditingRackData({ ...editingRackData, storageRule: e.target.value })}
                    placeholder="Wajib di atas palet min 15 cm dari lantai & bersih dari debu/hama..."
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>

                <div className="sm:col-span-2 lg:col-span-4">
                  <label className={LABEL_CLS}>
                    Catatan Khusus Plakat (Bisa Kosong)
                  </label>
                  <input
                    type="text"
                    value={editingRackData.customNote}
                    onChange={e => setEditingRackData({ ...editingRackData, customNote: e.target.value })}
                    placeholder="Periksa segel karung & catat nomor batch saat penumpukan..."
                    className="w-full px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Bagian 2: Daftar Item Bahan Pangan di Rak */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-3.5 bg-emerald-600 rounded-full"></span>
                    2. Daftar Item Terdaftar di Rak Ini ({editingRackData.items.length} Item)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Pilih item dari Master Stok Barang SPPG atau buat item khusus secara manual.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowManualItemInput(!showManualItemInput)}
                    className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-slate-500" />
                    <span>{showManualItemInput ? 'Tutup Input Manual' : 'Input Manual'}</span>
                  </button>
                  {editingRackData.items.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditingRackData({ ...editingRackData, items: [] })}
                      className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
                    >
                      Kosongkan Item
                    </button>
                  )}
                </div>
              </div>

              {/* Panel Ambil dari Master Stok Barang */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-700" />
                    Ambil Item dari Master Stok Barang (SPPG)
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Total {items.length} item tersedia di katalog master
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                  <div className="sm:col-span-4">
                    <div className="relative">
                      <input
                        type="text"
                        value={masterItemSearch}
                        onChange={e => setMasterItemSearch(e.target.value)}
                        placeholder="Cari nama / SKU master..."
                        className="w-full pl-7 pr-2.5 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus-visible:ring-2 focus-visible:ring-emerald-600"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <select
                      value={selectedMasterItemId}
                      onChange={e => setSelectedMasterItemId(e.target.value)}
                      className="w-full px-2.5 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-medium focus-visible:ring-2 focus-visible:ring-emerald-600 truncate"
                    >
                      <option value="">-- Pilih Bahan / Barang dari Master Stok --</option>
                      {items
                        .filter(i => {
                          if (!masterItemSearch.trim()) return true;
                          const q = masterItemSearch.toLowerCase();
                          return (
                            i.name.toLowerCase().includes(q) ||
                            i.id.toLowerCase().includes(q) ||
                            i.category.toLowerCase().includes(q)
                          );
                        })
                        .map(itm => (
                          <option key={itm.id} value={itm.id}>
                            {itm.id} • {itm.name} ({itm.category} • Satuan: {itm.baseUnit})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddItemFromMaster}
                      disabled={!selectedMasterItemId}
                      className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tambah</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel Form Input Manual (Collapsible) */}
              {showManualItemInput && (
                <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2 text-xs">
                  <span className="font-bold text-emerald-900 block">
                    Tambah Item Bebas / Non-Master ke Rak:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-600 font-medium mb-0.5">
                        Kode SKU (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="ITM-CUSTOM-01"
                        value={manualItemForm.id}
                        onChange={e => setManualItemForm({ ...manualItemForm, id: e.target.value })}
                        className="w-full px-2.5 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-xs font-mono"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-600 font-medium mb-0.5">
                        Nama Bahan / Barang *
                      </label>
                      <input
                        type="text"
                        placeholder="Misal: Beras Ramos 25 Kg..."
                        value={manualItemForm.name}
                        onChange={e => setManualItemForm({ ...manualItemForm, name: e.target.value })}
                        className="w-full px-2.5 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 font-medium mb-0.5">Kategori</label>
                      <input
                        type="text"
                        placeholder="Sembako / Sayur..."
                        value={manualItemForm.category}
                        onChange={e => setManualItemForm({ ...manualItemForm, category: e.target.value })}
                        className="w-full px-2.5 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 font-medium mb-0.5">Satuan</label>
                      <input
                        type="text"
                        placeholder="Kg / Liter / Pack"
                        value={manualItemForm.unit}
                        onChange={e => setManualItemForm({ ...manualItemForm, unit: e.target.value })}
                        className="w-full px-2.5 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Catatan penanganan fisik / penempatan khusus di rak..."
                      value={manualItemForm.handlingNote}
                      onChange={e =>
                        setManualItemForm({ ...manualItemForm, handlingNote: e.target.value })
                      }
                      className="flex-1 px-2.5 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 bg-white text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualItem}
                      disabled={!manualItemForm.name.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-semibold text-xs transition-colors cursor-pointer shrink-0"
                    >
                      + Tambah Item Manual
                    </button>
                  </div>
                </div>
              )}

              {/* Tabel Interaktif Daftar Item yang Terdaftar */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-2.5 w-10 text-center">No</th>
                      <th className="py-2 px-2.5 w-24">Kode SKU</th>
                      <th className="py-2 px-2.5">Nama Bahan Pangan</th>
                      <th className="py-2 px-2.5">Kategori</th>
                      <th className="py-2 px-2.5 w-16 text-center">Satuan</th>
                      <th className="py-2 px-2.5">Catatan / Posisi</th>
                      <th className="py-2 px-2.5 w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {editingRackData.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500 bg-slate-50">
                          Belum ada item di rak ini. Silakan pilih item dari Master Stok Barang di atas atau input manual.
                        </td>
                      </tr>
                    ) : (
                      editingRackData.items.map((itm, idx) => (
                        <tr key={`${itm.id}-${idx}`} className="hover:bg-slate-50">
                          <td className="py-2 px-2.5 text-center font-mono text-slate-400 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-2.5 font-mono font-bold text-slate-800 text-[11px]">
                            {itm.id}
                          </td>
                          <td className="py-2 px-2.5">
                            <div className="font-semibold text-slate-900">{itm.name}</div>
                            {itm.subcategory && (
                              <div className="text-[10px] text-slate-500">{itm.subcategory}</div>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-slate-600">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium border border-slate-200 text-[10px]">
                              {itm.category}
                            </span>
                          </td>
                          <td className="py-2 px-2.5 text-center font-mono font-semibold text-slate-700">
                            {itm.unit || 'Kg'}
                          </td>
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={itm.handlingNote || ''}
                              onChange={e => handleUpdateItemField(idx, 'handlingNote', e.target.value)}
                              placeholder="Catatan penempatan..."
                              className="w-full px-2 py-1 rounded border border-transparent hover:border-slate-300 focus:border-emerald-500 focus:bg-white text-[11px] text-slate-700 bg-transparent"
                            />
                          </td>
                          <td className="py-2 px-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleMoveItemInEditingRack(idx, 'UP')}
                                disabled={idx === 0}
                                title="Geser Naik"
                                className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveItemInEditingRack(idx, 'DOWN')}
                                disabled={idx === editingRackData.items.length - 1}
                                title="Geser Turun"
                                className="p-1 rounded text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItemFromEditingRack(idx)}
                                title="Hapus Item dari Rak"
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
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
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <div>
                {!editingRackData.isNew && (
                  <button
                    type="button"
                    onClick={() => handleResetRackOverride(editingRackData.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] sm:min-h-[34px] rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset ke Standar Bawaan
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRackData(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs transition-colors cursor-pointer font-medium"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveRackModal}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-2xs transition-colors cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Simpan Plakat Rak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


