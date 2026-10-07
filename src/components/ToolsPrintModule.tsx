import React, { useState, useMemo, useEffect } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { warehouseDb } from '../db/storage';
import { useAuth } from '../context/AuthContext';
import { ReceivingDocument, ItemMaster, EquipmentItem, Supplier, normalizeItemCategory } from '../types/warehouse';
import { SppgLogo } from './SppgLogo';

type FormType = 'RECEIVING_FORM' | 'OPNAME_SHEET' | 'BIN_CARD' | 'KITCHEN_REQUISITION' | 'EQUIPMENT_LABEL' | 'RACK_LABEL' | 'SUPPLIER_EXPENSE_NOTE';

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
    picName: 'Pak Joko (Logistik Gudang Kering)',
    customNote: 'Periksa segel karung & catat nomor batch saat penumpukan.',
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
    picName: 'Pak Joko (Logistik Gudang Kering)',
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
    picName: 'Pak Joko (Logistik Gudang Kering)',
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
    picName: 'Pak Joko (Logistik Gudang Kering)',
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
    picName: 'Chef Rahmat / PIC Chiller Dapur',
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
    picName: 'Chef Rahmat / PIC Cold Storage',
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

const DEFAULT_EXPENSE_PRICE_MAP: Record<string, number> = {
  beras: 14500,
  minyak: 18000,
  gula: 17500,
  tepung: 11000,
  garam: 4000,
  kecap: 22000,
  saus: 18000,
  bawang: 35000,
  bumbu: 25000,
  ayam: 38000,
  daging: 125000,
  telur: 28000,
  ikan: 35000,
  tahu: 2000,
  tempe: 2500,
  bayam: 3500,
  kangkung: 3500,
  wortel: 12000,
  buncis: 14000,
  labu: 8000,
  pisang: 16000,
  semangka: 8500,
  pepaya: 7500,
  susu: 15000,
  kresek: 15000,
  plastik: 25000,
  trashbag: 32000,
  sunlight: 85000,
  sabun: 18000,
  masker: 25000,
  tissue: 12000,
};

function getEstimatedItemPrice(name: string, category?: string): number {
  const lower = (name || '').toLowerCase();
  for (const [k, p] of Object.entries(DEFAULT_EXPENSE_PRICE_MAP)) {
    if (lower.includes(k)) return p;
  }
  const norm = normalizeItemCategory(category);
  if (norm === 'Bahan Basah') return 25000;
  if (norm === 'Bahan Kering') return 15000;
  if (norm === 'Bahan Peralatan') return 20000;
  return 15000;
}

const SUPPLIER_BANK_DEFAULTS: Record<string, { bank: string; accountNo: string; holder: string }> = {
  'SUP-001': { bank: 'Bank BRI', accountNo: '0182-01-002931-50-8', holder: 'UMKM Sumber Lumintu' },
  'SUP-002': { bank: 'Bank Mandiri', accountNo: '132-00-8829102-1', holder: "UMKM Luber's Fresh" },
  'SUP-003': { bank: 'BCA (Bank Central Asia)', accountNo: '841-092-4411', holder: 'UMKM Tumpang Grosir' },
  'SUP-004': { bank: 'Bank BRI', accountNo: '0182-01-098877-50-1', holder: 'UMKM Tahu Rio' },
  'SUP-005': { bank: 'Bank Mandiri', accountNo: '132-00-998877', holder: 'UMKM Ayam Segar FJR' },
  'SUP-006': { bank: 'Bank BNI', accountNo: '082-991-4421', holder: 'UMKM Divarif Plastik' },
  'SUP-007': { bank: 'Bank BRI', accountNo: '0182-01-077123-50-2', holder: 'Ayam Segar 98' },
  'SUP-008': { bank: 'Bank Mandiri', accountNo: '132-00-776655', holder: 'Tempe Pak Tro' },
  'SUP-009': { bank: 'Bank BRI', accountNo: '0182-01-055432-50-3', holder: 'Berkah Tahu Tempe Saidah' },
  'SUP-010': { bank: 'BCA (Bank Central Asia)', accountNo: '524-118-9902', holder: 'PT Tuan Raja Emas Mulia' },
  'SUP-011': { bank: 'Bank BRI', accountNo: '0182-01-088765-50-4', holder: 'Plastmart Murni' },
  'SUP-012': { bank: 'Bank Mandiri', accountNo: '132-00-554433', holder: 'Mbak Pur Daging' },
};

function getDefaultLinesForSupplier(supplier: Supplier): SupplierExpenseLine[] {
  const cat = (supplier.supplyCategory || '').toLowerCase();
  if (cat.includes('beras') || cat.includes('sembako')) {
    return [
      { id: 'exp-1', name: 'Beras Premium Pandan Wangi (Karung 50kg)', category: 'Bahan Kering', quantity: 200, unit: 'Kg', unitPrice: 14500, totalPrice: 2900000, notes: 'Mutu beras pulen, putih & bebas kutu' },
      { id: 'exp-2', name: 'Minyak Goreng Sawit Higienis (Jerigen)', category: 'Bahan Kering', quantity: 60, unit: 'Liter', unitPrice: 18000, totalPrice: 1080000, notes: 'Kemasan jerigen tersegel rapat' },
      { id: 'exp-3', name: 'Gula Pasir Kristal Putih', category: 'Bahan Kering', quantity: 30, unit: 'Kg', unitPrice: 17500, totalPrice: 525000, notes: 'Gula tebu murni' },
      { id: 'exp-4', name: 'Garam Halus Beriodium', category: 'Bahan Kering', quantity: 15, unit: 'Pack', unitPrice: 4000, totalPrice: 60000, notes: 'Konsumsi dapur gizi' }
    ];
  }
  if (cat.includes('protein') || cat.includes('unggas') || cat.includes('daging')) {
    return [
      { id: 'exp-1', name: 'Daging Ayam Broiler Karkas Bersih', category: 'Bahan Basah', quantity: 50, unit: 'Kg', unitPrice: 38000, totalPrice: 1900000, notes: 'Ayam segar dingin dipotong pagi hari' },
      { id: 'exp-2', name: 'Telur Ayam Negeri Ras Segar', category: 'Bahan Basah', quantity: 35, unit: 'Kg', unitPrice: 28000, totalPrice: 980000, notes: 'Cangkang bersih utuh tanpa retak' },
      { id: 'exp-3', name: 'Tahu Kedelai Putih Segar', category: 'Bahan Basah', quantity: 60, unit: 'Pcs', unitPrice: 2000, totalPrice: 120000, notes: 'Tahu higienis non-pengawet' }
    ];
  }
  if (cat.includes('sayur')) {
    return [
      { id: 'exp-1', name: 'Sayur Bayam Hijau Segar', category: 'Bahan Basah', quantity: 40, unit: 'Ikat', unitPrice: 3500, totalPrice: 140000, notes: 'Sayur petik pagi' },
      { id: 'exp-2', name: 'Wortel Segar Brastagi', category: 'Bahan Basah', quantity: 30, unit: 'Kg', unitPrice: 12000, totalPrice: 360000, notes: 'Wortel manis kelas A' },
      { id: 'exp-3', name: 'Buncis Muda Segar', category: 'Bahan Basah', quantity: 25, unit: 'Kg', unitPrice: 14000, totalPrice: 350000, notes: 'Buncis renyah tanpa serat tua' },
      { id: 'exp-4', name: 'Labu Siam Manisa', category: 'Bahan Basah', quantity: 20, unit: 'Kg', unitPrice: 8000, totalPrice: 160000, notes: 'Kondisi segar keras' }
    ];
  }
  if (cat.includes('buah')) {
    return [
      { id: 'exp-1', name: 'Pisang Cavendish Matang Pas', category: 'Bahan Basah', quantity: 45, unit: 'Kg', unitPrice: 16000, totalPrice: 720000, notes: 'Siap dibagikan ke penerima gizi' },
      { id: 'exp-2', name: 'Semangka Merah Non-Biji', category: 'Bahan Basah', quantity: 60, unit: 'Kg', unitPrice: 8500, totalPrice: 510000, notes: 'Kadar manis tinggi & segar' },
      { id: 'exp-3', name: 'Pepaya California Matang Pohon', category: 'Bahan Basah', quantity: 35, unit: 'Kg', unitPrice: 7500, totalPrice: 262500, notes: 'Tekstur daging padat' }
    ];
  }
  if (cat.includes('hygiene') || cat.includes('clean') || cat.includes('alat')) {
    return [
      { id: 'exp-1', name: 'Sabun Cuci Piring Food-Grade 4L', category: 'Bahan Peralatan', quantity: 3, unit: 'Jerigen', unitPrice: 85000, totalPrice: 255000, notes: 'Sanitasi peralatan makan SPPG' },
      { id: 'exp-2', name: 'Kantong Plastik Sampah HD Hitam Roll', category: 'Bahan Peralatan', quantity: 10, unit: 'Roll', unitPrice: 32000, totalPrice: 320000, notes: 'Pengelolaan limbah dapur' },
      { id: 'exp-3', name: 'Masker Medis Dapur 3-Ply (Box 50 pcs)', category: 'Bahan Peralatan', quantity: 5, unit: 'Dus', unitPrice: 25000, totalPrice: 125000, notes: 'Protokol higienitas penjamah makanan' }
    ];
  }
  return [
    { id: 'exp-1', name: `Pasokan Bahan ${supplier.supplyCategory}`, category: 'Bahan Kering', quantity: 50, unit: 'Kg', unitPrice: 25000, totalPrice: 1250000, notes: 'Penerimaan bahan operasional' }
  ];
}

export interface ToolsPrintModuleProps {
  initialForm?: FormType;
  initialSupplierId?: string;
}

export const ToolsPrintModule: React.FC<ToolsPrintModuleProps> = ({
  initialForm,
  initialSupplierId
}) => {
  const { currentUser } = useAuth();

  const [activeForm, setActiveForm] = useState<FormType>(
    initialSupplierId ? 'SUPPLIER_EXPENSE_NOTE' : (initialForm || 'RECEIVING_FORM')
  );
  const [unitName, setUnitName] = useState<string>('SPPG MLG TUMPANG JERU - Unit Pelayanan Dapur Gizi');
  const [printDate, setPrintDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Data sources
  const receivingDocs = useMemo(() => warehouseDb.getReceivings(), []);
  const items = useMemo(() => warehouseDb.getItems(), []);
  const equipment = useMemo(() => warehouseDb.getEquipment(), []);
  const suppliers = useMemo(() => warehouseDb.getSuppliers(), []);

  // Form-specific states
  const [selectedReceivingId, setSelectedReceivingId] = useState<string>(receivingDocs[0]?.id || 'BLANK');
  const [opnameLocation, setOpnameLocation] = useState<string>('ALL');
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || '');
  const [menuToday, setMenuToday] = useState<string>('Nasi Putih Pulen, Ayam Fillet Semur Kecap, Sup Sayur Buncis & Wortel, Pisang Cavendish');
  const [targetPortions, setTargetPortions] = useState<number>(1200);
  const [kitchenPic, setKitchenPic] = useState<string>('Chef Rahmat (Kepala Dapur)');

  // Supplier Expense Note States
  const [expenseSupplierId, setExpenseSupplierId] = useState<string>(
    initialSupplierId || suppliers[0]?.id || 'SUP-001'
  );
  const [expenseInvoiceNo, setExpenseInvoiceNo] = useState<string>(() => {
    const today = new Date();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `BKK/SPPG-JT/${yyyy}/${mm}/001`;
  });
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [expensePaymentMethod, setExpensePaymentMethod] = useState<string>(() => {
    const sId = initialSupplierId || suppliers[0]?.id || 'SUP-001';
    const b = SUPPLIER_BANK_DEFAULTS[sId];
    return b ? `Transfer ${b.bank}` : 'Transfer Bank';
  });
  const [expenseBankName, setExpenseBankName] = useState<string>(() => {
    const sId = initialSupplierId || suppliers[0]?.id || 'SUP-001';
    return SUPPLIER_BANK_DEFAULTS[sId]?.bank || 'Bank BRI';
  });
  const [expenseBankAccount, setExpenseBankAccount] = useState<string>(() => {
    const sId = initialSupplierId || suppliers[0]?.id || 'SUP-001';
    return SUPPLIER_BANK_DEFAULTS[sId]?.accountNo || '0182-01-002931-50-8';
  });
  const [expenseAccountHolder, setExpenseAccountHolder] = useState<string>(() => {
    const sId = initialSupplierId || suppliers[0]?.id || 'SUP-001';
    return SUPPLIER_BANK_DEFAULTS[sId]?.holder || suppliers[0]?.name || 'UMKM Sumber Lumintu';
  });
  const [expenseDeliveryRef, setExpenseDeliveryRef] = useState<string>('SJ-TG-8842 / GR-2026-0001');
  const [expensePurpose, setExpensePurpose] = useState<string>(
    'Pembayaran Belanja Bahan Baku Pangan Dapur Gizi SPPG MLG TUMPANG JERU'
  );
  const [expenseStatus, setExpenseStatus] = useState<'LUNAS' | 'DP' | 'TEMPO' | 'PENDING'>('LUNAS');
  const [expenseDiscount, setExpenseDiscount] = useState<number>(0);
  const [expenseShippingCost, setExpenseShippingCost] = useState<number>(0);
  const [expenseNotes, setExpenseNotes] = useState<string>(
    'Bahan pangan telah diperiksa mutu fisiknya oleh Tim Logistik & Penerimaan Gudang SPPG MLG TUMPANG JERU dalam kondisi segar, lengkap, dan memenuhi standar keamanan pangan.'
  );
  const [expensePicTreasurer, setExpensePicTreasurer] = useState<string>('Siti Aisyah (Bendahara)');
  const [expensePicVerifier, setExpensePicVerifier] = useState<string>('Akmal (Admin Gudang)');
  const [expensePicApprover, setExpensePicApprover] = useState<string>('Rizky Iman Ramdhan, S.Pd (Kepala SPPG)');
  const [expenseLines, setExpenseLines] = useState<SupplierExpenseLine[]>(() => {
    const defaultSup = suppliers.find(s => s.id === (initialSupplierId || suppliers[0]?.id)) || suppliers[0];
    return defaultSup ? getDefaultLinesForSupplier(defaultSup) : [];
  });

  const selectedSupplier = useMemo(() => {
    return suppliers.find(s => s.id === expenseSupplierId) || {
      id: expenseSupplierId,
      name: 'Mitra Rekanan SPPG',
      contactPerson: 'PIC Supplier',
      phone: '-',
      address: 'Malang, Jawa Timur',
      supplyCategory: 'Logistik Pangan',
      isActive: true,
    };
  }, [suppliers, expenseSupplierId]);

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
    const sup = suppliers.find(s => s.id === supId);
    if (!sup) return;

    // Bank defaults
    const bankDefault = SUPPLIER_BANK_DEFAULTS[sup.id] || {
      bank: 'Bank BRI / Rekening Mitra',
      accountNo: '0182-01-098877-50-1',
      holder: sup.name
    };
    setExpensePaymentMethod(`Transfer ${bankDefault.bank}`);
    setExpenseBankName(bankDefault.bank);
    setExpenseBankAccount(bankDefault.accountNo);
    setExpenseAccountHolder(bankDefault.holder);

    // Look for recent receiving doc for this supplier
    const supReceivings = receivingDocs.filter(
      r => r.supplierId === sup.id || r.supplierName.toLowerCase() === sup.name.toLowerCase()
    );
    if (supReceivings.length > 0) {
      const latest = supReceivings[0];
      setExpenseDeliveryRef(latest.deliveryNoteNo ? `${latest.deliveryNoteNo} / ${latest.id}` : latest.id);
      const convertedLines: SupplierExpenseLine[] = latest.lines.map((l, idx) => {
        const unitPrice = getEstimatedItemPrice(l.itemName, l.category);
        return {
          id: `line-${Date.now()}-${idx}`,
          name: l.itemName,
          category: l.category || 'Bahan Pangan',
          quantity: l.quantity,
          unit: l.unit,
          unitPrice,
          totalPrice: l.quantity * unitPrice,
          notes: l.conditionNote || 'Kondisi baik & sesuai PO'
        };
      });
      setExpenseLines(convertedLines);
    } else {
      setExpenseDeliveryRef(`SJ-${sup.id.replace('SUP-', '')}-${new Date().toISOString().slice(2, 7).replace('-', '')}`);
      setExpenseLines(getDefaultLinesForSupplier(sup));
    }
  };

  const handleLoadReceivingDocToExpense = (docId: string) => {
    const doc = receivingDocs.find(r => r.id === docId);
    if (!doc) return;
    setExpenseDeliveryRef(doc.deliveryNoteNo ? `${doc.deliveryNoteNo} / ${doc.id}` : doc.id);
    const convertedLines: SupplierExpenseLine[] = doc.lines.map((l, idx) => {
      const unitPrice = getEstimatedItemPrice(l.itemName, l.category);
      return {
        id: `line-${Date.now()}-${idx}`,
        name: l.itemName,
        category: l.category || 'Bahan Pangan',
        quantity: l.quantity,
        unit: l.unit,
        unitPrice,
        totalPrice: l.quantity * unitPrice,
        notes: l.conditionNote || 'Kondisi baik & sesuai standar mutu gizi'
      };
    });
    setExpenseLines(convertedLines);
  };

  const handleLoadDefaultTemplate = (sup: Supplier) => {
    setExpenseLines(getDefaultLinesForSupplier(sup));
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
  const [labelArrivalDate, setLabelArrivalDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [labelGlobalSupplier, setLabelGlobalSupplier] = useState<string>('AUTO');
  const [labelGlobalShelfLife, setLabelGlobalShelfLife] = useState<string>('');
  const [labelGlobalExpiryDate, setLabelGlobalExpiryDate] = useState<string>(''); // Default kosong untuk isi manual!
  const [labelCustomNote, setLabelCustomNote] = useState<string>('');
  const [labelSearchQuery, setLabelSearchQuery] = useState<string>('');
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

  // Helpers for date parsing and shelf life calculation
  const parseLocalDate = (dateStr: string): Date => {
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

  const formatDisplayDate = (d: Date): string => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const addDaysToDate = (dateStr: string, days: number): string => {
    try {
      const base = parseLocalDate(dateStr);
      base.setDate(base.getDate() + days);
      return formatDisplayDate(base);
    } catch {
      return dateStr;
    }
  };

  const formattedArrivalDate = useMemo(() => {
    return formatDisplayDate(parseLocalDate(labelArrivalDate));
  }, [labelArrivalDate]);

  // Default supplier resolver per ingredient category
  const getDefaultSupplierForItem = (item: ItemMaster): string => {
    const cat = (item.category || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    if (cat.includes('protein') || name.includes('ayam') || name.includes('telur') || name.includes('ikan') || name.includes('daging')) {
      return 'UMKM Ayam Segar FJR';
    }
    if (cat.includes('sayur') || name.includes('sayur') || name.includes('bayam') || name.includes('wortel')) {
      return "UMKM Luber's Fresh";
    }
    if (cat.includes('buah') || name.includes('buah') || name.includes('pisang')) {
      return 'UMKM Sumber Lumintu';
    }
    if (cat.includes('clean') || cat.includes('hygiene') || cat.includes('pack')) {
      return 'UMKM Divarif Plastik';
    }
    if (cat.includes('sembako') || name.includes('beras') || name.includes('minyak') || name.includes('gula') || name.includes('tepung') || name.includes('garam')) {
      return 'UMKM Tumpang Grosir';
    }
    return suppliers[0]?.name || 'UMKM Sumber Lumintu';
  };

  // Shelf life estimation tailored per ingredient & warehouse storage condition
  const getItemShelfLifeInfo = (item: ItemMaster): { durationText: string; shelfLifeDays: number } => {
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

  // Helper: check if item belongs to wet / cold warehouse
  const isWetItem = (item: ItemMaster): boolean => {
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
      const autoSupplier = getDefaultSupplierForItem(item);

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
          ? 'CV Dapur Prima Mandiri'
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
  }, [items, equipment, labelArrivalDate, labelGlobalSupplier, labelGlobalShelfLife, labelGlobalExpiryDate, labelCustomNote, labelOverrides]);

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
    if (hasCustomSelection && selectedLabelIds.length === filteredLabels.length) {
      setHasCustomSelection(true);
      setSelectedLabelIds([]);
    } else {
      setHasCustomSelection(false);
      setSelectedLabelIds(filteredLabels.map(l => l.id));
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
  const [rackLayoutMode, setRackLayoutMode] = useState<'1' | '2'>('1');
  const [rackGlobalPic, setRackGlobalPic] = useState<string>('Petugas Logistik SPPG');
  const [rackGlobalNote, setRackGlobalNote] = useState<string>('');
  const [selectedRackIds, setSelectedRackIds] = useState<string[]>([]);
  const [hasCustomRackSelection, setHasCustomRackSelection] = useState<boolean>(false);

  const [rackOverrides, setRackOverrides] = useState<Record<string, {
    name?: string;
    zone?: string;
    temperatureGuide?: string;
    capacityMax?: string;
    storageRule?: string;
    picName?: string;
    customNote?: string;
    extraItemsText?: string;
  }>>({});

  const [editingRackData, setEditingRackData] = useState<{
    id: string;
    name: string;
    warehouseType: 'GUDANG_KERING' | 'GUDANG_BASAH';
    zone: string;
    temperatureGuide: string;
    capacityMax: string;
    storageRule: string;
    picName: string;
    customNote: string;
    extraItemsText: string;
  } | null>(null);

  // Group all items dynamically into Warehouse Racks (Gudang Kering vs Gudang Basah)
  const allWarehouseRacks = useMemo<WarehouseRack[]>(() => {
    const matchItemToRackId = (loc: string, cat: string, name: string): string => {
      const l = (loc || '').toLowerCase();
      const c = (cat || '').toLowerCase();
      const n = (name || '').toLowerCase();

      if (l.includes('rak a1') || n.includes('beras')) return 'RAK-KRG-A1';
      if (l.includes('rak a2') || n.includes('minyak')) return 'RAK-KRG-A2';
      if (l.includes('rak a3') || n.includes('gula') || n.includes('tepung')) return 'RAK-KRG-A3';
      if (l.includes('rak a4') || n.includes('garam') || c.includes('bumbu')) return 'RAK-KRG-A4';
      if (l.includes('rak n1') || n.includes('sabun') || c.includes('cleaning')) return 'RAK-KRG-N1';
      if (
        l.includes('rak n2') ||
        l.includes('rak n3') ||
        l.includes('apd') ||
        n.includes('plastik') ||
        n.includes('tissue') ||
        n.includes('sarung tangan')
      )
        return 'RAK-KRG-N2';

      if (
        l.includes('bin c1') ||
        l.includes('chiller') ||
        n.includes('ayam') ||
        (c.includes('protein') && !n.includes('ikan') && !n.includes('telur'))
      )
        return 'BIN-CHL-C1';
      if (l.includes('bin f2') || l.includes('freezer') || n.includes('ikan') || n.includes('daging sapi'))
        return 'BIN-FRZ-F2';
      if (l.includes('sortir sayur') || c.includes('sayur') || n.includes('bayam') || n.includes('wortel'))
        return 'RAK-BSH-V1';
      if (l.includes('buah') || c.includes('buah') || n.includes('pisang')) return 'RAK-BSH-F1';
      if (l.includes('telur') || n.includes('telur')) return 'RAK-BSH-T1';

      return '';
    };

    const itemsByRackId: Record<string, RackItemDetail[]> = {};
    BASE_RACKS_CONFIG.forEach(r => {
      itemsByRackId[r.id] = [];
    });

    const dynamicRacks: Record<string, WarehouseRack> = {};

    items.forEach(itm => {
      const targetRackId = matchItemToRackId(itm.location, itm.category, itm.name);
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
      const rackItems = [...(itemsByRackId[base.id] || [])];

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

      return {
        ...base,
        name: ov.name || base.name,
        zone: ov.zone || base.zone,
        temperatureGuide: ov.temperatureGuide || base.temperatureGuide,
        capacityMax: ov.capacityMax || base.capacityMax,
        storageRule: ov.storageRule || base.storageRule,
        picName: ov.picName || rackGlobalPic || base.picName,
        customNote: ov.customNote !== undefined ? ov.customNote : (rackGlobalNote || base.customNote),
        items: rackItems,
      };
    });

    const dynList: WarehouseRack[] = Object.values(dynamicRacks).map(dyn => {
      const ov = rackOverrides[dyn.id] || {};
      return {
        ...dyn,
        name: ov.name || dyn.name,
        zone: ov.zone || dyn.zone,
        temperatureGuide: ov.temperatureGuide || dyn.temperatureGuide,
        capacityMax: ov.capacityMax || dyn.capacityMax,
        storageRule: ov.storageRule || dyn.storageRule,
        picName: ov.picName || rackGlobalPic || dyn.picName,
        customNote: ov.customNote !== undefined ? ov.customNote : (rackGlobalNote || dyn.customNote),
      };
    });

    return [...baseList, ...dynList];
  }, [items, rackOverrides, rackGlobalPic, rackGlobalNote]);

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
    if (!hasCustomRackSelection || selectedRackIds.length !== filteredRacks.length) {
      setHasCustomRackSelection(true);
      setSelectedRackIds(filteredRacks.map(r => r.id));
    } else {
      setHasCustomRackSelection(true);
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
    const ov = rackOverrides[rack.id] || {};
    setEditingRackData({
      id: rack.id,
      name: ov.name || rack.name,
      warehouseType: rack.warehouseType,
      zone: ov.zone || rack.zone,
      temperatureGuide: ov.temperatureGuide || rack.temperatureGuide,
      capacityMax: ov.capacityMax || rack.capacityMax,
      storageRule: ov.storageRule || rack.storageRule,
      picName: ov.picName || rack.picName,
      customNote: ov.customNote !== undefined ? ov.customNote : (rack.customNote || ''),
      extraItemsText: ov.extraItemsText || '',
    });
  };

  const handleSaveRackModal = () => {
    if (!editingRackData) return;
    setRackOverrides(prev => ({
      ...prev,
      [editingRackData.id]: {
        name: editingRackData.name,
        zone: editingRackData.zone,
        temperatureGuide: editingRackData.temperatureGuide,
        capacityMax: editingRackData.capacityMax,
        storageRule: editingRackData.storageRule,
        picName: editingRackData.picName,
        customNote: editingRackData.customNote,
        extraItemsText: editingRackData.extraItemsText,
      },
    }));
    setEditingRackData(null);
  };

  const handleResetRackOverride = (id: string) => {
    setRackOverrides(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setEditingRackData(null);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Print-specific style injected into head */}
      <style>{`
        @media print {
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            font-size: 12pt;
          }
          nav, header, footer, .no-print {
            display: none !important;
          }
          #print-area {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .page-break {
            page-break-after: always;
          }
          .table-print th, .table-print td {
            border: 1px solid #333333 !important;
            padding: 6px 8px !important;
          }
        }
      `}</style>

      {/* Screen Control Header */}
      <div className="no-print bg-white p-5 sm:p-6 rounded-2xl border border-[#ded7c8] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif-display text-xl sm:text-2xl font-bold text-[#111915] tracking-tight">
              Pusat Formulir & Alat Cetak Fisik
            </h1>
            <p className="text-xs text-[#5a6860] mt-0.5">
              Cetak dokumen operasional lapangan standar untuk pencatatan fisik di rak gudang, ruang chiller, dan dapur pengolahan.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0c3123] hover:bg-[#155e42] text-white text-xs font-medium shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-[#86efac]" />
              Cetak Dokumen Sekarang (Print / PDF)
            </button>
          </div>
        </div>

        {/* Form Category Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 mt-6 pt-5 border-t border-[#eee8dc]">
          <button
            onClick={() => setActiveForm('RECEIVING_FORM')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'RECEIVING_FORM'
                ? 'bg-[#ecf7f0] border-[#c2e7cf] text-[#0c3123] shadow-xs font-semibold'
                : 'bg-[#faf8f4] border-[#ded7c8] hover:bg-[#ede7da] text-[#111915]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-[#0c3123]" />
              <span className="text-xs">BA Penerimaan</span>
            </div>
            <p className="text-[11px] text-[#5a6860] line-clamp-1">Bukti fisik serah terima supplier</p>
          </button>

          <button
            onClick={() => setActiveForm('OPNAME_SHEET')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'OPNAME_SHEET'
                ? 'bg-[#ecf7f0] border-[#c2e7cf] text-[#0c3123] shadow-xs font-semibold'
                : 'bg-[#faf8f4] border-[#ded7c8] hover:bg-[#ede7da] text-[#111915]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-4 h-4 text-[#0c3123]" />
              <span className="text-xs">Lembar Opname Fisik</span>
            </div>
            <p className="text-[11px] text-[#5a6860] line-clamp-1">Tally sheet hitung rak & chiller</p>
          </button>

          <button
            onClick={() => setActiveForm('BIN_CARD')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'BIN_CARD'
                ? 'bg-[#ecf7f0] border-[#c2e7cf] text-[#0c3123] shadow-xs font-semibold'
                : 'bg-[#faf8f4] border-[#ded7c8] hover:bg-[#ede7da] text-[#111915]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-[#0c3123]" />
              <span className="text-xs">Kartu Stok (Bin Card)</span>
            </div>
            <p className="text-[11px] text-[#5a6860] line-clamp-1">Kartu gantung mutasi fisik rak</p>
          </button>

          <button
            onClick={() => setActiveForm('KITCHEN_REQUISITION')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'KITCHEN_REQUISITION'
                ? 'bg-[#ecf7f0] border-[#c2e7cf] text-[#0c3123] shadow-xs font-semibold'
                : 'bg-[#faf8f4] border-[#ded7c8] hover:bg-[#ede7da] text-[#111915]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <UtensilsCrossed className="w-4 h-4 text-[#0c3123]" />
              <span className="text-xs">Bon Permintaan Dapur</span>
            </div>
            <p className="text-[11px] text-[#5a6860] line-clamp-1">Pengeluaran harian porsi masak</p>
          </button>

          <button
            onClick={() => setActiveForm('EQUIPMENT_LABEL')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'EQUIPMENT_LABEL'
                ? 'bg-[#ecf7f0] border-[#c2e7cf] text-[#0c3123] shadow-xs font-semibold'
                : 'bg-[#faf8f4] border-[#ded7c8] hover:bg-[#ede7da] text-[#111915]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Tags className="w-4 h-4 text-[#0c3123]" />
              <span className="text-xs">Label & QR Gudang / Aset</span>
            </div>
            <p className="text-[11px] text-[#5a6860] line-clamp-1">Stiker barang & aset kering/basah</p>
          </button>

          <button
            onClick={() => setActiveForm('RACK_LABEL')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'RACK_LABEL'
                ? 'bg-[#ecf7f0] border-[#c2e7cf] text-[#0c3123] shadow-xs font-semibold'
                : 'bg-[#faf8f4] border-[#ded7c8] hover:bg-[#ede7da] text-[#111915]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Warehouse className="w-4 h-4 text-[#0c3123]" />
              <span className="text-xs">Label Rak Gudang</span>
            </div>
            <p className="text-[11px] text-[#5a6860] line-clamp-1">Plakat rak fisik, daftar isi & pembeda</p>
          </button>

          <button
            onClick={() => setActiveForm('SUPPLIER_EXPENSE_NOTE')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              activeForm === 'SUPPLIER_EXPENSE_NOTE'
                ? 'bg-[#ecf7f0] border-[#c2e7cf] text-[#0c3123] shadow-xs font-semibold'
                : 'bg-[#faf8f4] border-[#ded7c8] hover:bg-[#ede7da] text-[#111915]'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="w-4 h-4 text-[#0c3123]" />
              <span className="text-xs">Nota Kas Keluar</span>
            </div>
            <p className="text-[11px] text-[#5a6860] line-clamp-1">Kop resmi & bukti bayar supplier</p>
          </button>
        </div>

        {/* Contextual Customizer Controls */}
        <div className="mt-5 p-4 rounded-xl bg-[#faf8f4] border border-[#ded7c8] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-xs">
          {activeForm !== 'EQUIPMENT_LABEL' && activeForm !== 'RACK_LABEL' && activeForm !== 'SUPPLIER_EXPENSE_NOTE' ? (
            <>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Nama Satuan Layanan (Header)</label>
                <input
                  type="text"
                  value={unitName}
                  onChange={e => setUnitName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Tanggal Dokumen Cetak</label>
                <input
                  type="date"
                  value={printDate}
                  onChange={e => setPrintDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </>
          ) : activeForm === 'SUPPLIER_EXPENSE_NOTE' ? (
            <>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nama Satuan Layanan (Header)</label>
                <input
                  type="text"
                  value={unitName}
                  onChange={e => setUnitName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Pilih Mitra Supplier</label>
                <select
                  value={expenseSupplierId}
                  onChange={e => handleSupplierChange(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-medium text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.supplyCategory})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tarik Dokumen Penerimaan</label>
                <div className="flex gap-1.5">
                  <select
                    id="receivingDocSelect"
                    defaultValue=""
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 truncate"
                  >
                    <option value="">-- Pilih Penerimaan Gudang --</option>
                    {receivingDocs
                      .filter(r => r.supplierId === expenseSupplierId || r.supplierName.toLowerCase() === selectedSupplier.name.toLowerCase())
                      .map(r => (
                        <option key={r.id} value={r.id}>
                          {r.id} ({r.deliveryNoteNo || 'Tanpa SJ'}) - {r.date}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const sel = (document.getElementById('receivingDocSelect') as HTMLSelectElement)?.value;
                      if (sel) handleLoadReceivingDocToExpense(sel);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs whitespace-nowrap cursor-pointer transition-colors"
                    title="Tarik daftar item dan surat jalan dari penerimaan ini"
                  >
                    Tarik
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tanggal Bayar / Dokumen</label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={e => {
                    setExpenseDate(e.target.value);
                    setPrintDate(e.target.value);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">No. Bukti Kas Keluar (BKK)</label>
                <input
                  type="text"
                  value={expenseInvoiceNo}
                  onChange={e => setExpenseInvoiceNo(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Status Pembayaran</label>
                <select
                  value={expenseStatus}
                  onChange={e => setExpenseStatus(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="LUNAS">Lunas / Dibayarkan</option>
                  <option value="DP">Uang Muka (DP)</option>
                  <option value="TEMPO">Tempo / Kredit</option>
                  <option value="PENDING">Menunggu Verifikasi</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Rekening Tujuan Transfer</label>
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="Nama Bank (misal: Bank BRI)"
                    value={expenseBankName}
                    onChange={e => {
                      setExpenseBankName(e.target.value);
                      setExpensePaymentMethod(`Transfer ${e.target.value}`);
                    }}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Nomor Rekening"
                    value={expenseBankAccount}
                    onChange={e => setExpenseBankAccount(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <input
                    type="text"
                    placeholder="Nama Pemilik Rekening"
                    value={expenseAccountHolder}
                    onChange={e => setExpenseAccountHolder(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </>
          ) : activeForm === 'EQUIPMENT_LABEL' ? (
            <>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Gudang / Sumber Label</label>
                <select
                  value={labelWarehouseFilter}
                  onChange={e => {
                    setLabelWarehouseFilter(e.target.value as any);
                    setLabelCategoryFilter('ALL');
                    setHasCustomSelection(false);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua Gudang & Aset</option>
                  <option value="GUDANG_KERING">Gudang Kering (Sembako & Non-Food)</option>
                  <option value="GUDANG_BASAH">Gudang Basah (Chiller, Sayur, Protein)</option>
                  <option value="EQUIPMENT">Aset & Peralatan Dapur</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Pilih Kategori</label>
                <select
                  value={labelCategoryFilter}
                  onChange={e => {
                    setLabelCategoryFilter(e.target.value);
                    setHasCustomSelection(false);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua Kategori ({categoryCounts['ALL'] || 0})</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat} ({categoryCounts[cat] || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Pilih Supplier / Mitra</label>
                <select
                  value={labelGlobalSupplier}
                  onChange={e => setLabelGlobalSupplier(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="AUTO">Otomatis (Sesuai Bahan)</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.supplyCategory})
                    </option>
                  ))}
                  <option value="BLANK">Kosongkan (Tulis Tangan Manual)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Tanggal Datang / Masuk</label>
                <input
                  type="date"
                  value={labelArrivalDate}
                  onChange={e => setLabelArrivalDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Masa Expired (Form Edit)</label>
                <input
                  type="text"
                  placeholder="Otomatis sesuai bahan / ketik ubah..."
                  value={labelGlobalShelfLife}
                  onChange={e => setLabelGlobalShelfLife(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-600 font-medium">Batas Expired (Manual)</label>
                  <span className="text-[10px] text-slate-400 italic">Default kosong</span>
                </div>
                <input
                  type="text"
                  placeholder="Kosongkan untuk isi manual tulis tangan..."
                  value={labelGlobalExpiryDate}
                  onChange={e => setLabelGlobalExpiryDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Catatan Stiker (Bisa Kosong)</label>
                <input
                  type="text"
                  placeholder="Kosongkan untuk tulis tangan..."
                  value={labelCustomNote}
                  onChange={e => setLabelCustomNote(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Tata Letak Stiker</label>
                <select
                  value={labelGridCols}
                  onChange={e => setLabelGridCols(e.target.value as '2' | '3')}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="2">2 Kolom (Standar Label Besar)</option>
                  <option value="3">3 Kolom (Ringkas / Stiker Kecil)</option>
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
                <label className="block text-slate-600 font-medium mb-1">Cari Nama / SKU / Rak</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ketik untuk mencari label..."
                    value={labelSearchQuery}
                    onChange={e => setLabelSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>
            </>
          ) : (
            /* activeForm === 'RACK_LABEL' */
            <>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Pembeda Tipe Gudang</label>
                <select
                  value={rackWarehouseFilter}
                  onChange={e => {
                    setRackWarehouseFilter(e.target.value as any);
                    setRackSelectedId('ALL');
                    setHasCustomRackSelection(false);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua Gudang (Kering & Basah)</option>
                  <option value="GUDANG_KERING">Gudang Kering (Sembako & Bumbu)</option>
                  <option value="GUDANG_BASAH">Gudang Basah / Dingin (Chiller & Freezer)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Pilih Spesifik Rak</label>
                <select
                  value={rackSelectedId}
                  onChange={e => {
                    setRackSelectedId(e.target.value);
                    setHasCustomRackSelection(false);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="ALL">Semua Rak ({allWarehouseRacks.length} Rak Terdaftar)</option>
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
                <label className="block text-slate-600 font-medium mb-1">Tata Letak Plakat Cetak</label>
                <select
                  value={rackLayoutMode}
                  onChange={e => setRackLayoutMode(e.target.value as '1' | '2')}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="1">1 Plakat Besar per Lembar A4 (Plakat Rak Utama)</option>
                  <option value="2">2 Plakat Sedang per Lembar (Grid Ambalan)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Penanggung Jawab (PIC)</label>
                <input
                  type="text"
                  placeholder="Petugas Logistik SPPG..."
                  value={rackGlobalPic}
                  onChange={e => setRackGlobalPic(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Catatan Tambahan Plakat</label>
                <input
                  type="text"
                  placeholder="Catatan umum rak gudang..."
                  value={rackGlobalNote}
                  onChange={e => setRackGlobalNote(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3 xl:col-span-3">
                <label className="block text-slate-600 font-medium mb-1">Cari Kode Rak / Nama Rak / Item di Rak</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Ketik kode rak (misal: RAK-KRG-A1, CHL) atau nama item (misal: Beras, Ayam)..."
                    value={rackSearchQuery}
                    onChange={e => setRackSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>
            </>
          )}

          {activeForm === 'RECEIVING_FORM' && (
            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Pilih Dokumen Penerimaan</label>
              <select
                value={selectedReceivingId}
                onChange={e => setSelectedReceivingId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="BLANK">-- Formulir Kosong (Siap Tulis Tangan Lapangan) --</option>
                {receivingDocs.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.id} • {d.supplierName} ({d.date})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeForm === 'OPNAME_SHEET' && (
            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Filter Lokasi Rak / Ruang</label>
              <select
                value={opnameLocation}
                onChange={e => setOpnameLocation(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Semua Lokasi & Rak Bahan</option>
                <option value="Gudang Kering">Gudang Kering (Sembako & Bumbu)</option>
                <option value="Chiller">Chiller Bahan Segar (Sayur, Buah, Telur)</option>
                <option value="Freezer">Cold Storage Freezer (Daging & Ikan)</option>
                <option value="Dapur">Area Dapur & Persiapan</option>
              </select>
            </div>
          )}

          {activeForm === 'BIN_CARD' && (
            <div className="sm:col-span-2">
              <label className="block text-slate-600 font-medium mb-1">Pilih Master Bahan Pangan</label>
              <select
                value={selectedItemId}
                onChange={e => setSelectedItemId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {items.map(i => (
                  <option key={i.id} value={i.id}>
                    {i.id} - {i.name} ({i.location})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeForm === 'KITCHEN_REQUISITION' && (
            <>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Target Porsi Masak</label>
                <input
                  type="number"
                  value={targetPortions}
                  onChange={e => setTargetPortions(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-slate-600 font-medium mb-1">Juru Masak / PIC Dapur</label>
                <input
                  type="text"
                  value={kitchenPic}
                  onChange={e => setKitchenPic(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Printable Paper Document Container */}
      <div
        id="print-area"
        className={`bg-white rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto font-sans text-slate-900 ${
          activeForm === 'EQUIPMENT_LABEL' || activeForm === 'RACK_LABEL' ? 'p-4 sm:p-6' : 'p-8 sm:p-12'
        }`}
      >
        {/* =========================================================================
            HEADER RESMI SATUAN PELAYANAN PEMENUHAN GIZI (SPPG)
            (Ditiadakan khusus untuk Label & QR serta Label Rak agar lembar cetak maksimal)
        ========================================================================= */}
        {activeForm !== 'EQUIPMENT_LABEL' && activeForm !== 'RACK_LABEL' && (
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <SppgLogo size="lg" variant="color" showText={false} />
              <div>
                <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
                  Satuan Pelayanan Pemenuhan Gizi (SPPG MLG TUMPANG JERU)
                </h1>
                <p className="text-xs text-slate-600 font-medium">{unitName}</p>
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
        )}

        {/* =========================================================================
            1. BERITA ACARA PENERIMAAN BARANG (GOODS RECEIPT NOTE)
        ========================================================================= */}
        {activeForm === 'RECEIVING_FORM' && (
          <div className="space-y-6">
            <div className="text-center my-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight border-b border-slate-300 pb-1 inline-block">
                Berita Acara Penerimaan Bahan Pangan & Logistik
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Nomor Dokumen: <span className="font-mono font-semibold">{selectedReceivingDoc ? selectedReceivingDoc.id : 'GR-2026-____'}</span>
              </p>
            </div>

            {/* Document Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 p-4 border border-slate-300 rounded-lg text-xs bg-slate-50/50">
              <div className="space-y-1.5">
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">Nama Supplier:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReceivingDoc ? selectedReceivingDoc.supplierName : '___________________________'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">No. Surat Jalan:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {selectedReceivingDoc ? selectedReceivingDoc.deliveryNoteNo || '-' : 'SJ-______________________'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">Waktu Kedatangan:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReceivingDoc ? `${selectedReceivingDoc.date} pukul ${selectedReceivingDoc.arrivalTime} WIB` : `${printDate} pukul __:__ WIB`}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">Petugas Penerima:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReceivingDoc ? `${selectedReceivingDoc.receiverName} (${selectedReceivingDoc.receiverRole})` : `${currentUser.name} (${currentUser.role})`}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">Status Verifikasi:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReceivingDoc ? selectedReceivingDoc.status : 'VERIFIED_POSTED'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-28 inline-block">Suhu Chiller / Mobil:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedReceivingDoc ? 'Sesuai Standar (< 4°C)' : '___ °C (Standar Dingin)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1.5">
                Rincian Bahan / Barang yang Diserahterimakan:
              </div>
              <table className="w-full border-collapse border border-slate-300 text-xs table-print">
                <thead className="bg-slate-100 text-slate-800 font-semibold text-center">
                  <tr>
                    <th className="border border-slate-300 p-2 w-10">No</th>
                    <th className="border border-slate-300 p-2 text-left">Nama Bahan Pangan / Barang</th>
                    <th className="border border-slate-300 p-2 text-left">Kategori</th>
                    <th className="border border-slate-300 p-2 text-right w-24">Jumlah</th>
                    <th className="border border-slate-300 p-2 text-center w-20">Satuan</th>
                    <th className="border border-slate-300 p-2 text-left">Kondisi Fisik / Batch / Expired</th>
                    <th className="border border-slate-300 p-2 text-center w-16">QC</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReceivingDoc && selectedReceivingDoc.lines.length > 0 ? (
                    selectedReceivingDoc.lines.map((line, idx) => (
                      <tr key={line.id}>
                        <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 p-2 font-semibold text-slate-900">{line.itemName}</td>
                        <td className="border border-slate-300 p-2 text-slate-700">{line.category}</td>
                        <td className="border border-slate-300 p-2 text-right font-mono font-bold text-slate-900">
                          {line.quantity}
                        </td>
                        <td className="border border-slate-300 p-2 text-center text-slate-700">{line.unit}</td>
                        <td className="border border-slate-300 p-2 text-slate-600">
                          {line.conditionNote || line.batchNumber || 'Segar, Bersih, Lolos Uji Organoleptik'}
                        </td>
                        <td className="border border-slate-300 p-2 text-center text-emerald-700 font-bold">✓</td>
                      </tr>
                    ))
                  ) : (
                    // Blank lines for hand-written operational receipt
                    Array.from({ length: 8 }).map((_, idx) => (
                      <tr key={idx} className="h-8">
                        <td className="border border-slate-300 p-2 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="border border-slate-300 p-2"></td>
                        <td className="border border-slate-300 p-2"></td>
                        <td className="border border-slate-300 p-2"></td>
                        <td className="border border-slate-300 p-2"></td>
                        <td className="border border-slate-300 p-2"></td>
                        <td className="border border-slate-300 p-2"></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Notes Section */}
            <div className="p-3 border border-slate-300 rounded text-xs space-y-1">
              <span className="font-semibold text-slate-800">Catatan Pemeriksaan Mutu Fisik:</span>
              <p className="text-slate-600 italic">
                {selectedReceivingDoc?.notes ||
                  'Bahan makanan diterima dalam kemasan higienis, bersih dari cemaran fisik, bau normal, dan suhu simpan rantai dingin terjaga.'}
              </p>
            </div>

            {/* Signatures Section */}
            <div className="grid grid-cols-2 gap-8 pt-6">
              <div className="border border-slate-300 rounded p-3 text-center">
                <p className="text-xs text-slate-600 font-medium">Pihak Pengirim / Pemasok</p>
                <div className="h-24 flex items-center justify-center">
                  {selectedReceivingDoc?.supplierSignature?.startsWith('data:image') ? (
                    <img
                      src={selectedReceivingDoc.supplierSignature}
                      alt="Tanda Tangan Pengirim"
                      className="max-h-20 object-contain"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs italic">[ Tanda Tangan & Nama Terang ]</span>
                  )}
                </div>
                <div className="border-t border-slate-300 pt-1 text-xs font-semibold text-slate-900">
                  {selectedReceivingDoc ? selectedReceivingDoc.supplierName : '( ................................................ )'}
                </div>
              </div>

              <div className="border border-slate-300 rounded p-3 text-center">
                <p className="text-xs text-slate-600 font-medium">Petugas Penerima Gudang SPPG</p>
                <div className="h-24 flex items-center justify-center">
                  {selectedReceivingDoc?.receiverSignature?.startsWith('data:image') ? (
                    <img
                      src={selectedReceivingDoc.receiverSignature}
                      alt="Tanda Tangan Penerima"
                      className="max-h-20 object-contain"
                    />
                  ) : (
                    <span className="text-slate-400 text-xs italic">[ Tanda Tangan & Stempel SPPG ]</span>
                  )}
                </div>
                <div className="border-t border-slate-300 pt-1 text-xs font-semibold text-slate-900">
                  {selectedReceivingDoc ? `${selectedReceivingDoc.receiverName} (${selectedReceivingDoc.receiverRole})` : `( ${currentUser.name} )`}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            2. LEMBAR KERJA FISIK STOCK OPNAME (TALLY SHEET)
        ========================================================================= */}
        {activeForm === 'OPNAME_SHEET' && (
          <div className="space-y-6">
            <div className="text-center my-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight border-b border-slate-300 pb-1 inline-block">
                Lembar Kerja Hitung Fisik (Stock Opname Tally Sheet)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Area: <span className="font-semibold">{opnameLocation === 'ALL' ? 'Seluruh Gudang & Chiller' : opnameLocation}</span> • Tanggal: <span className="font-semibold">{printDate}</span>
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-300 rounded text-xs grid grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500">Tim Penghitung (Checker):</span>
                <div className="font-semibold text-slate-900">1. ........................................</div>
              </div>
              <div>
                <span className="text-slate-500">Saksi / Supervisor:</span>
                <div className="font-semibold text-slate-900">2. ........................................</div>
              </div>
              <div>
                <span className="text-slate-500">Target Rekonsiliasi:</span>
                <div className="font-semibold text-slate-900">{filteredOpnameItems.length} SKU Bahan</div>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs table-print">
              <thead className="bg-slate-100 text-slate-800 font-semibold">
                <tr>
                  <th className="border border-slate-300 p-2 w-8 text-center">No</th>
                  <th className="border border-slate-300 p-2 text-left w-24">Kode SKU</th>
                  <th className="border border-slate-300 p-2 text-left">Nama Bahan Makanan</th>
                  <th className="border border-slate-300 p-2 text-left w-36">Lokasi Rak/Box</th>
                  <th className="border border-slate-300 p-2 text-center w-16">Satuan</th>
                  <th className="border border-slate-300 p-2 text-right w-20">Stok Sistem</th>
                  <th className="border border-slate-300 p-2 text-center w-28 bg-emerald-50/70">
                    Hitung Fisik (Tally)
                  </th>
                  <th className="border border-slate-300 p-2 text-left w-36">Kondisi / Catatan</th>
                </tr>
              </thead>
              <tbody>
                {filteredOpnameItems.map((item, idx) => (
                  <tr key={item.id} className="h-9">
                    <td className="border border-slate-300 p-2 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="border border-slate-300 p-2 font-mono font-semibold text-slate-700">{item.id}</td>
                    <td className="border border-slate-300 p-2 font-semibold text-slate-900">{item.name}</td>
                    <td className="border border-slate-300 p-2 text-slate-600">{item.location}</td>
                    <td className="border border-slate-300 p-2 text-center text-slate-700">{item.baseUnit}</td>
                    <td className="border border-slate-300 p-2 text-right font-mono font-semibold text-slate-500">
                      {item.currentStock}
                    </td>
                    <td className="border border-slate-300 p-2 text-center bg-emerald-50/30">
                      {/* Blank box for pen writing */}
                    </td>
                    <td className="border border-slate-300 p-2 text-slate-400"></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
              <div>
                <p className="text-slate-600">Petugas Hitung Lapangan</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-48 pt-1 font-semibold text-slate-800">
                    ( .................................................. )
                  </div>
                </div>
              </div>
              <div>
                <p className="text-slate-600">Warehouse Manager / Kepala Gudang</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-48 pt-1 font-semibold text-slate-800">
                    ( .................................................. )
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            3. KARTU STOK FISIK / BIN CARD (RAK & CHILLER)
        ========================================================================= */}
        {activeForm === 'BIN_CARD' && selectedItem && (
          <div className="space-y-6">
            <div className="text-center my-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight border-b border-slate-300 pb-1 inline-block">
                Kartu Stok Fisik Gudang & Chiller (Bin Card)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Ditempelkan pada rak penyimpanan atau keranjang bahan baku di gudang
              </p>
            </div>

            {/* Card Header Spec */}
            <div className="grid grid-cols-2 gap-3 p-3.5 border-2 border-slate-900 rounded-lg text-xs bg-slate-50">
              <div className="space-y-1">
                <div>
                  <span className="text-slate-500 w-28 inline-block">Kode Bahan (SKU):</span>
                  <span className="font-mono font-bold text-slate-900">{selectedItem.id}</span>
                </div>
                <div>
                  <span className="text-slate-500 w-28 inline-block">Nama Bahan:</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedItem.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 w-28 inline-block">Kategori Pangan:</span>
                  <span className="font-semibold text-slate-800">{selectedItem.category}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div>
                  <span className="text-slate-500 w-32 inline-block">Lokasi Simpan:</span>
                  <span className="font-bold text-slate-900">{selectedItem.location}</span>
                </div>
                <div>
                  <span className="text-slate-500 w-32 inline-block">Satuan Pengukuran:</span>
                  <span className="font-semibold text-slate-800">{selectedItem.baseUnit}</span>
                </div>
                <div>
                  <span className="text-slate-500 w-32 inline-block">Batas Minimum:</span>
                  <span className="font-mono font-bold text-amber-800">{selectedItem.minimumStock} {selectedItem.baseUnit}</span>
                </div>
              </div>
            </div>

            {/* Manual Tally Table */}
            <table className="w-full border-collapse border border-slate-900 text-xs table-print">
              <thead className="bg-slate-200 text-slate-900 font-bold text-center">
                <tr>
                  <th className="border border-slate-900 p-2 w-24">Tanggal</th>
                  <th className="border border-slate-900 p-2 text-left">No. Bukti / Dokumen Ref</th>
                  <th className="border border-slate-900 p-2 text-right w-20">Masuk (+)</th>
                  <th className="border border-slate-900 p-2 text-right w-20">Keluar (-)</th>
                  <th className="border border-slate-900 p-2 text-right w-24">Sisa Saldo</th>
                  <th className="border border-slate-900 p-2 text-center w-24">Paraf Petugas</th>
                </tr>
              </thead>
              <tbody>
                {/* Initial Balance Row */}
                <tr className="bg-slate-50 font-semibold">
                  <td className="border border-slate-900 p-2 text-center font-mono">{printDate}</td>
                  <td className="border border-slate-900 p-2">Saldo Awal Cetak Kartu</td>
                  <td className="border border-slate-900 p-2 text-right font-mono">-</td>
                  <td className="border border-slate-900 p-2 text-right font-mono">-</td>
                  <td className="border border-slate-900 p-2 text-right font-mono font-bold">{selectedItem.currentStock}</td>
                  <td className="border border-slate-900 p-2 text-center text-slate-500">Initial</td>
                </tr>

                {/* 10 Empty Grid Rows for Hand Writing */}
                {Array.from({ length: 12 }).map((_, idx) => (
                  <tr key={idx} className="h-8">
                    <td className="border border-slate-900 p-2 text-center"></td>
                    <td className="border border-slate-900 p-2"></td>
                    <td className="border border-slate-900 p-2"></td>
                    <td className="border border-slate-900 p-2"></td>
                    <td className="border border-slate-900 p-2"></td>
                    <td className="border border-slate-900 p-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* =========================================================================
            4. FORMULIR PERMINTAAN BAHAN MASAK DAPUR (KITCHEN REQUISITION)
        ========================================================================= */}
        {activeForm === 'KITCHEN_REQUISITION' && (
          <div className="space-y-6">
            <div className="text-center my-4">
              <h2 className="text-lg font-bold text-slate-900 tracking-tight border-b border-slate-300 pb-1 inline-block">
                Bon Pengeluaran & Permintaan Bahan Pangan Dapur
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Dokumen Serah Terima Bahan Gudang/Chiller ke Tim Olahan Masak SPPG
              </p>
            </div>

            <div className="p-4 border border-slate-300 rounded-lg text-xs bg-slate-50 space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-500 font-medium">Hari / Tanggal Pengolahan:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{printDate}</div>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Target Porsi Anak Penerima:</span>
                  <div className="font-bold text-emerald-800 text-sm mt-0.5">
                    {targetPortions.toLocaleString('id-ID')} Porsi Makan Bergizi
                  </div>
                </div>
              </div>
              <div className="border-t border-slate-200 pt-2">
                <span className="text-slate-500 font-medium">Menu Masakan Hari Ini:</span>
                <div className="font-semibold text-slate-900 mt-0.5">{menuToday}</div>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs table-print">
              <thead className="bg-slate-100 text-slate-800 font-semibold">
                <tr>
                  <th className="border border-slate-300 p-2 w-8 text-center">No</th>
                  <th className="border border-slate-300 p-2 text-left">Nama Bahan Pangan</th>
                  <th className="border border-slate-300 p-2 text-left w-32">Lokasi Ambil</th>
                  <th className="border border-slate-300 p-2 text-right w-24">Jumlah Diminta</th>
                  <th className="border border-slate-300 p-2 text-right w-24">Jumlah Diserahkan</th>
                  <th className="border border-slate-300 p-2 text-center w-16">Satuan</th>
                  <th className="border border-slate-300 p-2 text-left">Pemeriksaan Suhu/Mutu</th>
                </tr>
              </thead>
              <tbody>
                {items.slice(0, 8).map((item, idx) => (
                  <tr key={item.id} className="h-8">
                    <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-300 p-2 font-semibold text-slate-900">{item.name}</td>
                    <td className="border border-slate-300 p-2 text-slate-600">{item.location}</td>
                    <td className="border border-slate-300 p-2 text-right font-mono font-semibold text-slate-700">
                      {Math.round(item.currentStock * 0.35)}
                    </td>
                    <td className="border border-slate-300 p-2 text-right font-mono font-bold text-emerald-800">
                      {Math.round(item.currentStock * 0.35)}
                    </td>
                    <td className="border border-slate-300 p-2 text-center text-slate-700">{item.baseUnit}</td>
                    <td className="border border-slate-300 p-2 text-slate-600">Suhu Aman, Baik</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-3 gap-4 pt-8 text-center text-xs">
              <div>
                <p className="text-slate-600">Diminta Oleh (Koki/Dapur)</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-40 pt-1 font-semibold text-slate-800">
                    {kitchenPic}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-slate-600">Diserahkan Oleh (Gudang)</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-40 pt-1 font-semibold text-slate-800">
                    {currentUser.name}
                  </div>
                </div>
              </div>
              <div>
                <p className="text-slate-600">Mengetahui (Kepala Unit)</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-40 pt-1 font-semibold text-slate-800">
                    Rizky Iman Ramdhan, S.Pd (Kepala SPPG)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            5. LABEL & QR GUDANG KERING, GUDANG BASAH & ASET PERALATAN
            (Khusus formulir label & QR, kop surat resmi dihilangkan dari hasil cetak)
        ========================================================================= */}
        {activeForm === 'EQUIPMENT_LABEL' && (
          <div className="space-y-4">
            {/* Screen-Only Control Toolbar & Guidance (Hidden during print) */}
            <div className="no-print p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">
                  {labelsToPrint.length} label siap dicetak
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">
                  Total filter: {filteredLabels.length} item
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-700 font-medium">
                  Header dokumen resmi otomatis ditiadakan khusus label QR
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {hasCustomSelection && selectedLabelIds.length === filteredLabels.length
                    ? 'Batal Pilih Semua'
                    : 'Pilih Semua'}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Lembar Stiker ({labelsToPrint.length})
                </button>
              </div>
            </div>

            {/* Labels Grid */}
            {labelsToPrint.length === 0 ? (
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
                {labelsToPrint.map(label => {
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
                          className="w-3.5 h-3.5 accent-emerald-600 rounded cursor-pointer"
                          title="Centang untuk cetak stiker ini"
                        />
                      </div>

                      {/* Label Top Bar */}
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 pr-5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-[10px] text-slate-800 truncate">
                            SPPG MLG TUMPANG JERU
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
                            className="no-print p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-emerald-700 transition-colors cursor-pointer"
                            title="Edit data label sebelum cetak"
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
                          <QrCode
                            className={`${labelGridCols === '3' ? 'w-8 h-8' : 'w-10 h-10'} text-slate-900`}
                          />
                          <span className="text-[7px] font-mono font-bold text-slate-800 truncate w-full mt-0.5">
                            {label.id}
                          </span>
                        </div>
                      </div>

                      {/* Tanggal Datang, Masa Expired & Batas Expired */}
                      <div className="p-2 bg-slate-50/90 rounded-lg border border-slate-200 text-[9px] space-y-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="text-slate-500 font-medium block text-[8px]">Tanggal Datang:</span>
                            <span className="font-mono font-bold text-slate-900 text-[10px]">
                              {label.arrivalDateFormatted}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 font-medium block text-[8px]">Masa Expired:</span>
                            <span className="font-semibold text-emerald-800 text-[9px] block truncate" title={label.shelfLifeText}>
                              {label.shelfLifeText}
                            </span>
                          </div>
                        </div>

                        <div className="pt-1 border-t border-slate-200/80 flex items-center justify-between text-[8px]">
                          <span className="text-slate-500 font-medium">Batas Expired:</span>
                          {label.expiryDate ? (
                            <span className="font-mono font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                              {label.expiryDate}
                            </span>
                          ) : (
                            <span className="font-mono text-slate-400 font-medium">
                              _____ / _____ / 202___ <span className="text-[7px] italic text-slate-400 font-sans">(Isi Manual)</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Area Catatan / Note Lapangan (Bisa diisi / Tulis Tangan) */}
                      <div className="pt-0.5 border-t border-slate-200">
                        <div className="flex items-center justify-between text-[8px] text-slate-500 font-medium mb-0.5">
                          <span className="font-semibold text-slate-700">Catatan:</span>
                          <span className="text-[7px] text-slate-400 italic">
                            {label.customNote ? 'Catatan label' : 'Bisa diisi tulisan tangan'}
                          </span>
                        </div>
                        <div className="min-h-[22px] border border-dashed border-slate-300 rounded px-1.5 py-0.5 bg-slate-50/60 text-[8px] text-slate-800 flex items-center">
                          {label.customNote ? (
                            <span className="font-medium text-slate-900">{label.customNote}</span>
                          ) : (
                            <span className="text-slate-300 select-none tracking-tight">
                              ....................................................................................................
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Label Footer: SPPG LOGISTIK dengan Tanggal di bawahnya */}
                      <div className="flex items-center justify-between text-[9px] pt-1.5 border-t border-slate-200">
                        <div>
                          <span className="font-mono font-bold text-slate-800 text-[9px] block leading-tight">
                            SPPG LOGISTIK
                          </span>
                          <span className="text-[8px] text-slate-600 font-medium block leading-tight">
                            Tanggal: {label.arrivalDateFormatted}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] font-semibold text-slate-700 block leading-tight">
                            {label.warehouseName}
                          </span>
                          <span className="text-[7px] text-slate-400 font-mono block leading-tight">
                            STANDAR GIZI & HIGIENE
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

        {/* =========================================================================
            6. LABEL RAK GUDANG (WAREHOUSE RACK / BIN PLACARD)
            Menampilkan identitas rak, pembeda basah/kering & daftar isi item di rak
        ========================================================================= */}
        {activeForm === 'RACK_LABEL' && (
          <div className="space-y-5">
            {/* Screen-Only Control Toolbar & Guidance (Hidden during print) */}
            <div className="no-print p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">
                  {racksToPrint.length} plakat rak siap dicetak
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">
                  Total filter: {filteredRacks.length} rak
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-emerald-700 font-medium">
                  Dilengkapi tabel daftar isi item & pembeda visual gudang basah/kering
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleSelectAllRacks}
                  className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {hasCustomRackSelection && selectedRackIds.length === filteredRacks.length
                    ? 'Batal Pilih Semua'
                    : 'Pilih Semua'}
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-2xs transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Plakat Rak ({racksToPrint.length})
                </button>
              </div>
            </div>

            {/* Racks Grid / List */}
            {racksToPrint.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                Tidak ada plakat rak yang sesuai dengan filter atau kata kunci pencarian.
              </div>
            ) : (
              <div
                className={`grid ${
                  rackLayoutMode === '2'
                    ? 'grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2'
                    : 'grid-cols-1 gap-6'
                }`}
              >
                {racksToPrint.map(rack => {
                  const isSelected = !hasCustomRackSelection || selectedRackIds.includes(rack.id);
                  const isDry = rack.warehouseType === 'GUDANG_KERING';

                  return (
                    <div
                      key={rack.id}
                      className={`relative border-2 ${
                        isDry ? 'border-amber-700 bg-white' : 'border-sky-700 bg-white'
                      } rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm break-inside-avoid transition-all ${
                        !isSelected ? 'opacity-40 border-slate-300 no-print' : ''
                      } ${rackLayoutMode === '1' ? 'print:my-6 print:break-after-page' : ''}`}
                    >
                      {/* Screen selection & edit buttons (Hidden on print) */}
                      <div className="no-print absolute top-3 right-3 z-10 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditRackModal(rack)}
                          className="px-2 py-1 rounded-lg bg-white/90 border border-slate-300 hover:bg-slate-100 text-slate-700 text-[10px] font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                          title="Edit plakat rak ini sebelum cetak"
                        >
                          <Edit3 className="w-3 h-3 text-emerald-700" />
                          <span>Edit Rak</span>
                        </button>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRack(rack.id)}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                          title="Centang untuk cetak plakat rak ini"
                        />
                      </div>

                      {/* Header Plakat: Visual Pembeda Basah vs Kering */}
                      <div
                        className={`-mx-5 -mt-5 p-4 rounded-t-2xl flex items-center justify-between border-b ${
                          isDry
                            ? 'bg-amber-800 text-amber-50 border-amber-900'
                            : 'bg-sky-800 text-sky-50 border-sky-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl ${isDry ? 'bg-amber-900/60' : 'bg-sky-900/60'}`}>
                            {isDry ? (
                              <Package className="w-5 h-5 text-amber-200" />
                            ) : (
                              <Snowflake className="w-5 h-5 text-sky-200" />
                            )}
                          </div>
                          <div>
                            <div className="text-[10px] font-bold tracking-tight opacity-90">
                              SPPG LOGISTIK • {rack.warehouseName}
                            </div>
                            <div className="text-sm font-bold tracking-tight text-white leading-tight">
                              {rack.zone}
                            </div>
                          </div>
                        </div>

                        <div className="text-right pr-14 sm:pr-0">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isDry
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : 'bg-sky-100 text-sky-900 border-sky-300'
                            }`}
                          >
                            ROTASI: {rack.rotationMethod}
                          </span>
                          <div className="text-[9px] opacity-80 mt-0.5 font-mono">
                            STANDAR GIZI & HIGIENE
                          </div>
                        </div>
                      </div>

                      {/* Rack Identification & QR Code */}
                      <div className="flex items-start justify-between gap-3 pt-1">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="inline-block px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-xs tracking-tight">
                            {rack.id}
                          </div>
                          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-snug">
                            {rack.name}
                          </h2>
                          <div className="flex items-center gap-2.5 text-xs text-slate-600 flex-wrap pt-0.5">
                            <span className="flex items-center gap-1 font-medium text-slate-800">
                              <Thermometer className="w-3.5 h-3.5 text-slate-500" />
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

                        {/* High-Contrast QR Code */}
                        <div className="flex flex-col items-center justify-center p-1.5 border-2 border-slate-900 rounded-xl bg-white shrink-0 text-center w-20 h-20">
                          <QrCode className="w-10 h-10 text-slate-900" />
                          <span className="text-[7px] font-mono font-bold text-slate-800 truncate w-full mt-0.5">
                            {rack.id}
                          </span>
                        </div>
                      </div>

                      {/* DAFTAR ITEM YANG MENGISI RAK INI ("ada tanda misal rak ini itu isinya item apa saja") */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-4 rounded-full ${
                                isDry ? 'bg-amber-600' : 'bg-sky-600'
                              }`}
                            ></span>
                            <h3 className="font-bold text-xs text-slate-900">
                              DAFTAR BAHAN / ITEM TERDAFTAR DI RAK INI ({rack.items.length} Item)
                            </h3>
                          </div>
                          <span className="text-[10px] text-slate-500 font-medium">
                            Katalog Fisik Penataan Rak
                          </span>
                        </div>

                        {rack.items.length === 0 ? (
                          <div className="p-3.5 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 bg-slate-50">
                            Belum ada item terdaftar di rak ini. Siap dialokasikan untuk bahan pangan baru.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-slate-300">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr
                                  className={`${
                                    isDry
                                      ? 'bg-amber-50/90 text-amber-950 border-b border-amber-200'
                                      : 'bg-sky-50/90 text-sky-950 border-b border-sky-200'
                                  } font-bold text-[10px]`}
                                >
                                  <th className="py-1.5 px-2.5 w-8 text-center">No</th>
                                  <th className="py-1.5 px-2.5 w-24">Kode SKU</th>
                                  <th className="py-1.5 px-2.5">Nama Bahan Pangan / Barang</th>
                                  <th className="py-1.5 px-2.5">Kategori</th>
                                  <th className="py-1.5 px-2.5 text-right">Stok WMS</th>
                                  <th className="py-1.5 px-2.5 text-center">Batas Min</th>
                                  <th className="py-1.5 px-2.5 text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200 text-[11px]">
                                {rack.items.map((itm, idx) => (
                                  <tr key={itm.id} className="hover:bg-slate-50/50">
                                    <td className="py-1.5 px-2.5 text-center text-slate-500 font-mono text-[10px]">
                                      {String(idx + 1).padStart(2, '0')}
                                    </td>
                                    <td className="py-1.5 px-2.5 font-mono font-bold text-slate-900 text-[10px]">
                                      {itm.id}
                                    </td>
                                    <td className="py-1.5 px-2.5">
                                      <div className="font-bold text-slate-900 leading-tight">{itm.name}</div>
                                      {itm.handlingNote && (
                                        <div className="text-[9px] text-slate-500 line-clamp-1">
                                          {itm.handlingNote}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-2.5 text-slate-600 text-[10px]">
                                      {itm.category} {itm.subcategory ? `• ${itm.subcategory}` : ''}
                                    </td>
                                    <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900">
                                      {itm.currentStock.toLocaleString('id-ID')} {itm.unit}
                                    </td>
                                    <td className="py-1.5 px-2.5 text-center text-slate-500 font-mono text-[10px]">
                                      {itm.minStock} {itm.unit}
                                    </td>
                                    <td className="py-1.5 px-2.5 text-center">
                                      {itm.currentStock <= 0 ? (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                          Habis
                                        </span>
                                      ) : itm.currentStock <= itm.minStock ? (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                          Menipis
                                        </span>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          Tersedia
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Garis Tambahan Item Lapangan */}
                        <div className="pt-1 flex items-center justify-between text-[9px] text-slate-500">
                          <span className="font-medium text-slate-700">+ Tambahan Item Fisik:</span>
                          <span className="font-mono text-slate-300 truncate pl-2">
                            ...................................................................................................................................................
                          </span>
                        </div>
                      </div>

                      {/* Standar Operasional Penataan (SOP Rak SPPG) */}
                      <div
                        className={`p-3 rounded-xl border text-xs space-y-1 ${
                          isDry
                            ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                            : 'bg-sky-50/70 border-sky-200 text-sky-950'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-[11px]">
                          <ShieldCheck className="w-4 h-4 shrink-0" />
                          <span>Standar Penataan & Kebersihan Rak SPPG:</span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-slate-700">
                          {rack.storageRule}
                        </p>
                        {rack.customNote && (
                          <div className="text-[10px] font-medium text-slate-800 pt-1 border-t border-slate-200/80">
                            <span className="font-semibold">Catatan Khusus:</span> {rack.customNote}
                          </div>
                        )}
                      </div>

                      {/* Footer Plakat: PIC & Paraf */}
                      <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                        <div>
                          <span className="font-bold text-slate-800 block text-[11px]">
                            SPPG MLG TUMPANG JERU • LOGISTIK & DISTRIBUSI
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Penanggung Jawab (PIC): <span className="font-semibold text-slate-800">{rack.picName}</span>
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">
                            Paraf Juru Gudang / Tanggal Pasang:
                          </span>
                          <span className="font-mono text-slate-400 text-xs">
                            _____________________ / _____ - _____ - 202___
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

        {/* =========================================================================
            7. BUKTI KAS KELUAR / NOTA PENGELUARAN SUPPLIER (EXPENSE VOUCHER)
        ========================================================================= */}
        {activeForm === 'SUPPLIER_EXPENSE_NOTE' && (
          <div className="space-y-6">
            {/* Document Title Banner */}
            <div className="text-center my-4 pb-3 border-b border-slate-300">
              <span className="inline-block px-3 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-300 mb-1">
                Bukti Kas Keluar (BKK) / Expense Voucher
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Nota Pengeluaran & Pembayaran Mitra Supplier
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-600 mt-1.5">
                <span>
                  No. Bukti Kas: <strong className="font-mono text-slate-900">{expenseInvoiceNo}</strong>
                </span>
                <span>•</span>
                <span>
                  Tanggal Bayar: <strong className="text-slate-900">{expenseDate}</strong>
                </span>
                <span>•</span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    expenseStatus === 'LUNAS'
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : expenseStatus === 'DP'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : expenseStatus === 'TEMPO'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-slate-100 text-slate-700 border border-slate-300'
                  }`}
                >
                  Status:{' '}
                  {expenseStatus === 'LUNAS'
                    ? 'Lunas / Dibayarkan'
                    : expenseStatus === 'DP'
                    ? 'Uang Muka (DP)'
                    : expenseStatus === 'TEMPO'
                    ? 'Tempo / Kredit'
                    : 'Menunggu Verifikasi'}
                </span>
              </div>
            </div>

            {/* Document Metadata Grid (2-Column) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-slate-300 rounded-lg text-xs bg-slate-50/50">
              {/* Left Column: Supplier / Beneficiary Info */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Penerima Dana (Mitra Supplier / Rekanan)</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-32 inline-block">Nama Perusahaan:</span>
                  <span className="font-bold text-slate-900">{selectedSupplier.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-32 inline-block">PIC / Kontak:</span>
                  <span className="text-slate-900 font-medium">
                    {selectedSupplier.contactPerson} ({selectedSupplier.phone})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-32 inline-block">Alamat Usaha:</span>
                  <span className="text-slate-800">{selectedSupplier.address}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-32 inline-block">Kategori Pasokan:</span>
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {selectedSupplier.supplyCategory}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-32 inline-block">Rekening Tujuan:</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {expenseBankName} - {expenseBankAccount} (a.n {expenseAccountHolder})
                  </span>
                </div>
              </div>

              {/* Right Column: Transaction & Settlement Details */}
              <div className="space-y-1.5">
                <div className="font-bold text-slate-800 border-b border-slate-200 pb-1 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Informasi Dokumen & Pembayaran</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-32 inline-block">No. Surat Jalan / Ref:</span>
                  <span className="font-mono font-bold text-slate-900">{expenseDeliveryRef || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-32 inline-block">Metode Bayar:</span>
                  <span className="font-semibold text-slate-900">{expensePaymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-32 inline-block">Sumber Dana / Kas:</span>
                  <span className="text-slate-900 font-medium">Kas Operasional Pelayanan Gizi (SPPG MLG TUMPANG JERU)</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-32 inline-block">Perihal Belanja:</span>
                  <span className="text-slate-800 font-medium">{expensePurpose}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium w-32 inline-block">Petugas Kasir / PIC:</span>
                  <span className="text-slate-900">{currentUser.name} ({currentUser.role})</span>
                </div>
              </div>
            </div>

            {/* Table of Itemized Expenses */}
            <div>
              <table className="w-full text-xs border-collapse border border-slate-300 table-print">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="border border-slate-300 p-2 text-center w-10">No</th>
                    <th className="border border-slate-300 p-2 text-left">Uraian Bahan Pangan / Pengadaan Barang</th>
                    <th className="border border-slate-300 p-2 text-center w-28">Kategori</th>
                    <th className="border border-slate-300 p-2 text-right w-20">Volume</th>
                    <th className="border border-slate-300 p-2 text-center w-16">Satuan</th>
                    <th className="border border-slate-300 p-2 text-right w-28">Harga Satuan (Rp)</th>
                    <th className="border border-slate-300 p-2 text-right w-32">Total Biaya (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {expenseLines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border border-slate-300 p-6 text-center text-slate-500 italic">
                        Belum ada item belanja yang ditambahkan. Gunakan formulir di atas untuk memuat rincian bahan.
                      </td>
                    </tr>
                  ) : (
                    expenseLines.map((line, idx) => (
                      <tr key={line.id || idx} className="hover:bg-slate-50/50">
                        <td className="border border-slate-300 p-2 text-center font-medium">{idx + 1}</td>
                        <td className="border border-slate-300 p-2">
                          <div className="font-semibold text-slate-900">{line.name}</div>
                          {line.notes && <div className="text-[10px] text-slate-500 italic mt-0.5">{line.notes}</div>}
                        </td>
                        <td className="border border-slate-300 p-2 text-center text-slate-700">{line.category}</td>
                        <td className="border border-slate-300 p-2 text-right font-medium tabular-nums">{line.quantity}</td>
                        <td className="border border-slate-300 p-2 text-center text-slate-600">{line.unit}</td>
                        <td className="border border-slate-300 p-2 text-right tabular-nums text-slate-800">
                          Rp {line.unitPrice.toLocaleString('id-ID')}
                        </td>
                        <td className="border border-slate-300 p-2 text-right tabular-nums font-semibold text-slate-900">
                          Rp {(line.totalPrice || line.quantity * line.unitPrice).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold text-slate-800">
                    <td colSpan={5} className="border border-slate-300 p-2 text-right">Subtotal Belanja Bahan:</td>
                    <td colSpan={2} className="border border-slate-300 p-2 text-right tabular-nums text-slate-900 font-bold">
                      Rp {expenseSubtotal.toLocaleString('id-ID')}
                    </td>
                  </tr>
                  {expenseDiscount > 0 && (
                    <tr className="bg-slate-50 text-slate-700">
                      <td colSpan={5} className="border border-slate-300 p-1.5 text-right">Potongan / Diskon Supplier:</td>
                      <td colSpan={2} className="border border-slate-300 p-1.5 text-right tabular-nums text-rose-700 font-semibold">
                        - Rp {expenseDiscount.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  )}
                  {expenseShippingCost > 0 && (
                    <tr className="bg-slate-50 text-slate-700">
                      <td colSpan={5} className="border border-slate-300 p-1.5 text-right">Ongkos Kirim & Penanganan:</td>
                      <td colSpan={2} className="border border-slate-300 p-1.5 text-right tabular-nums text-slate-800 font-semibold">
                        + Rp {expenseShippingCost.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  )}
                  <tr className="bg-emerald-50/70 border-t-2 border-slate-400 font-bold text-slate-900 text-sm">
                    <td colSpan={5} className="border border-slate-300 p-2.5 text-right">
                      TOTAL DIBAYARKAN (KAS KELUAR):
                    </td>
                    <td colSpan={2} className="border border-slate-300 p-2.5 text-right tabular-nums text-emerald-950 text-base font-extrabold">
                      Rp {expenseTotalPayable.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Terbilang Box */}
            <div className="p-3 border-2 border-slate-300 rounded-lg bg-slate-50/70 text-xs">
              <div className="flex items-start gap-2">
                <span className="font-bold text-slate-700 shrink-0">Terbilang:</span>
                <span className="italic font-semibold text-slate-900">
                  # {angkaTerbilang(expenseTotalPayable)} #
                </span>
              </div>
            </div>

            {/* Catatan / Pernyataan Serah Terima */}
            <div className="p-3 border border-slate-200 rounded-lg text-[11px] text-slate-600 bg-white space-y-1">
              <div className="font-bold text-slate-700">Catatan & Pernyataan Serah Terima:</div>
              <p>{expenseNotes}</p>
            </div>

            {/* 4-Signatory Signature Matrix */}
            <div className="grid grid-cols-4 gap-4 text-center text-xs pt-4 border-t border-slate-200">
              <div>
                <p className="text-slate-600 font-medium">Penerima Dana (Rekanan)</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-36 pt-1 font-semibold text-slate-800">
                    {selectedSupplier.contactPerson || selectedSupplier.name}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Cap / Tanda Tangan Mitra</p>
              </div>
              <div>
                <p className="text-slate-600 font-medium">Bendahara Pengeluaran</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-36 pt-1 font-semibold text-slate-800">
                    {expensePicTreasurer}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Staf Kasir SPPG</p>
              </div>
              <div>
                <p className="text-slate-600 font-medium">Verifikator Logistik</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-36 pt-1 font-semibold text-slate-800">
                    {expensePicVerifier}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Pemeriksa Fisik Bahan</p>
              </div>
              <div>
                <p className="text-slate-600 font-medium">Menyetujui (Kepala SPPG)</p>
                <div className="h-20 flex items-end justify-center">
                  <div className="border-t border-slate-400 w-36 pt-1 font-semibold text-slate-800">
                    {expensePicApprover}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Kepala SPPG MLG TUMPANG JERU</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Edit Label Khusus (Hanya di layar, hidden on print) */}
      {editingModalData && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Tanggal Datang</label>
                  <input
                    type="date"
                    value={editingModalData.arrivalDate}
                    onChange={e => setEditingModalData({ ...editingModalData, arrivalDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Masa Expired (Berapa Lama)</label>
                  <input
                    type="text"
                    value={editingModalData.shelfLifeText}
                    onChange={e => setEditingModalData({ ...editingModalData, shelfLifeText: e.target.value })}
                    placeholder="Contoh: 1 - 2 Hari, 6 Bulan..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Catatan Tambahan (Bisa Kosong)</label>
                <input
                  type="text"
                  value={editingModalData.customNote}
                  onChange={e => setEditingModalData({ ...editingModalData, customNote: e.target.value })}
                  placeholder="Kosongkan untuk tulis tangan di kertas stiker..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleResetItemOverride(editingModalData.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
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
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Edit Plakat Rak: {editingRackData.name}
                </h3>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  ID: {editingRackData.id} • {editingRackData.warehouseType === 'GUDANG_KERING' ? 'Gudang Kering' : 'Gudang Basah / Dingin'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingRackData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Nama Rak / Lokasi</label>
                <input
                  type="text"
                  value={editingRackData.name}
                  onChange={e => setEditingRackData({ ...editingRackData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Zona / Sektor</label>
                  <input
                    type="text"
                    value={editingRackData.zone}
                    onChange={e => setEditingRackData({ ...editingRackData, zone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Kapasitas Maksimal</label>
                  <input
                    type="text"
                    value={editingRackData.capacityMax}
                    onChange={e => setEditingRackData({ ...editingRackData, capacityMax: e.target.value })}
                    placeholder="Contoh: 1.500 Kg, 30 Box..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Suhu & Parameter Lingkungan</label>
                  <input
                    type="text"
                    value={editingRackData.temperatureGuide}
                    onChange={e => setEditingRackData({ ...editingRackData, temperatureGuide: e.target.value })}
                    placeholder="Contoh: 20°C - 25°C atau 2°C - 4°C..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Penanggung Jawab (PIC)</label>
                  <input
                    type="text"
                    value={editingRackData.picName}
                    onChange={e => setEditingRackData({ ...editingRackData, picName: e.target.value })}
                    placeholder="Nama PIC Rak..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Standar Penataan (SOP Rak)</label>
                <textarea
                  rows={2}
                  value={editingRackData.storageRule}
                  onChange={e => setEditingRackData({ ...editingRackData, storageRule: e.target.value })}
                  placeholder="Instruksi penataan palet, rantai dingin, dll..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Catatan Khusus Rak (Bisa Kosong)</label>
                <input
                  type="text"
                  value={editingRackData.customNote}
                  onChange={e => setEditingRackData({ ...editingRackData, customNote: e.target.value })}
                  placeholder="Catatan tambahan di plakat..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-medium">Tambah Item Manual ke Rak</label>
                  <span className="text-[10px] text-slate-500 italic">Format: SKU | Nama | Kategori | Stok | Satuan</span>
                </div>
                <textarea
                  rows={2}
                  value={editingRackData.extraItemsText}
                  onChange={e => setEditingRackData({ ...editingRackData, extraItemsText: e.target.value })}
                  placeholder="Contoh: ITM-X01 | Bumbu Kari Bubuk | Sembako | 10 | Pack"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => handleResetRackOverride(editingRackData.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset ke Bawaan
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRackData(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveRackModal}
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
    </div>
  );
};


