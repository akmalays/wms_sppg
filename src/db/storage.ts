/**
 * SPPG Warehouse Relational Data Store & Operations
 * Features atomic transaction simulation, ledger immutability, foreign key integrity, and audit logging.
 */

import {
  User,
  ItemMaster,
  Supplier,
  ReceivingDocument,
  InventoryTransaction,
  StockOpnameSession,
  EquipmentItem,
  AuditLog,
  DailyFlowRecord,
  UserRole,
  NonFoodExpense,
  MenuOrder,
  WasteLog,
  DisposalMethod,
  DailyTodoItem,
  SchoolBeneficiaryAllocation,
  Employee,
  EmployeeAttendance,
  PurchaseOrderNota,
  PurchaseOrderItem,
  PaymentMethod,
  PurchaseOrderStatus,
  WeighedPoItemInput,
  ReceivePoMetadata,
} from '../types/warehouse';
import {
  REAL_NONFOOD_EXPENSES,
  REAL_WASTE_LOGS,
  REAL_EQUIPMENT_ITEMS,
  REAL_MENU_ORDERS,
  DEFAULT_SCHOOL_BENEFICIARIES,
  REAL_EMPLOYEES,
  REAL_ATTENDANCE_LOGS,
} from './realSeedData';
import { getRomanMonth, getYearFromDate, generateNextPoNumber } from '../utils/poNumberGenerator';
import { isPendingSupplierPo } from '../utils/poSupplier';
import { angkaTerbilang } from '../utils/numberToWords';
import { removeFromPrintPool } from '../utils/poPrintPool';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { reportCloudWriteError } from '../lib/cloudEvents';
import { localDateIso, localTimestamp } from '../utils/localDate';
import { convertQty, unitKey } from '../utils/unitConversion';

const MAX_AUDIT_LOGS = 2000;

const EQUIPMENT_CONDITION_TEXT: Record<string, string> = { GOOD: 'baik', NEEDS_INSPECTION: 'perlu dicek', DAMAGED: 'rusak' };
const EQUIPMENT_STATUS_TEXT: Record<string, string> = { ACTIVE: 'dipakai', IN_REPAIR: 'diservis', LOST: 'hilang', RETIRED: 'tidak dipakai lagi' };

// "rusak → baik" bila berubah, "tetap rusak" bila sama.
const change = (labels: Record<string, string>, before: string, after: string) =>
  before === after ? `tetap ${labels[after] || after}` : `${labels[before] || before} → ${labels[after] || after}`;

const STORAGE_KEYS = {
  ITEMS: 'sppg_items_v1',
  SUPPLIERS: 'sppg_suppliers_v1',
  RECEIVINGS: 'sppg_receivings_v2',
  TRANSACTIONS: 'sppg_transactions_v1',
  OPNAMES: 'sppg_opnames_v1',
  EQUIPMENT: 'sppg_equipment_v1',
  AUDIT_LOGS: 'sppg_audit_logs_v1',
  NONFOOD_EXPENSES: 'sppg_nonfood_expenses_v2',
  MENU_ORDERS: 'sppg_menu_orders_v1',
  WASTE_LOGS: 'sppg_waste_logs_v1',
  TODOS: 'sppg_todos_v1',
  EMPLOYEES: 'sppg_employees_v1',
  ATTENDANCE: 'sppg_attendance_v1',
  USERS: 'sppg_users_v1',
  PURCHASE_ORDERS: 'sppg_purchase_orders_v1',
  BENEFICIARIES: 'sppg_school_beneficiaries_v1',
  APP_SETTINGS: 'sppg_app_settings_v1',
};

export const APP_SETTINGS_CHANGED_EVENT = 'sppg_app_settings_changed';

// Pengaturan yang dulu disimpan langsung di localStorage per perangkat, dipindah sekali ke app_settings.
const LEGACY_SETTING_KEYS: Array<[legacyKey: string, settingKey: string]> = [
  ['sppg_delivery_officers_v2', 'delivery_officers'],
  ['sppg_delivery_class_breakdowns_v2', 'delivery_class_breakdowns'],
];

// Akun petugas SPPG Tumpang Jeru. ID USR-001..005 dipakai ulang agar akun dummy lama
// yang tersimpan di browser tertimpa saat dimuat (lihat penggabungan di constructor).
export const INITIAL_USERS: User[] = [
  { id: 'USR-001', name: 'Eno Shafira R', email: 'eno.sppgjeru@sppg.id', role: 'ASLAP', employeeId: 'EMP-003' },
  { id: 'USR-002', name: 'Rizky Iman Ramdhan, S.Pd', email: 'rizky.sppgjeru@sppg.id', role: 'KA_SPPG', employeeId: 'EMP-001' },
  { id: 'USR-003', name: 'Nur Akmal Ays', email: 'akmal.sppgjeru@sppg.id', role: 'SUPERADMIN', employeeId: 'EMP-002' },
  { id: 'USR-004', name: 'M Ali Akbar Fathoni', email: 'toni.sppgjeru@sppg.id', role: 'ASLAP', employeeId: 'EMP-005' },
  { id: 'USR-005', name: 'Alfiana Viransa', email: 'alfiana.sppgjeru@sppg.id', role: 'AKUNTAN', employeeId: 'EMP-004' },
];

// Kata sandi awal (sementara) dibaca dari .env agar tidak masuk ke git.
// Format: VITE_INITIAL_PASSWORDS="email1:sandi1,email2:sandi2". Catatan: nilai VITE_* tetap
// tertanam di bundle hasil build, jadi petugas wajib mengganti kata sandi setelah login pertama.
const INITIAL_PASSWORDS: Record<string, string> = Object.fromEntries(
  String(import.meta.env.VITE_INITIAL_PASSWORDS || '')
    .split(',')
    .map(pair => {
      const idx = pair.indexOf(':');
      return idx > 0 ? [pair.slice(0, idx).trim().toLowerCase(), pair.slice(idx + 1).trim()] : null;
    })
    .filter((entry): entry is [string, string] => !!entry && !!entry[0] && !!entry[1])
);

// Akun dummy lama beserta alias login-nya, dibersihkan dari penyimpanan browser.
const LEGACY_DUMMY_LOGINS = [
  'budi.superadmin@sppg.id', 'rizky.kasppg@sppg.id', 'akmal@sppg.id', 'andi.aslap@sppg.id', 'dewi.akuntan@sppg.id',
  'akmal', 'dewi', 'rizky', 'andi', 'budi', 'admin', 'akuntan', 'kasppg', 'aslap', 'superadmin',
];

// Supplier UMKM & mitra asli SPPG MLG TUMPANG JERU (dari data nota pesanan).
// Kategori pasokan perlu dicek ulang lewat menu Master Supplier.
const umkm = (name: string, address: string, supplyCategory: string): Omit<Supplier, 'id'> => ({
  name,
  contactPerson: '',
  phone: '',
  address,
  supplyCategory,
  isActive: true,
});

export const LOCAL_UMKM_SUPPLIERS: Omit<Supplier, 'id'>[] = [
  umkm('UMKM Sumber Lumintu', 'Jl. Raya Sukoanyar 49 RT.05/RW.01 Cokro, Kec. Pakis, Kab. Malang', 'Umum'),
  umkm("UMKM Luber's Fresh", 'Jl. Raya Sukoanyar 49 RT.05/RW.01 Cokro, Kec. Pakis, Kab. Malang', 'Sayur & Buah Segar'),
  umkm('UMKM Tumpang Grosir', 'Jl. Pahlawan Barat, Kec. Tumpang, Kab. Malang', 'Sembako & Bahan Kering'),
  umkm('UMKM Tahu Rio', 'Jl. Curahampel, Pakis, Kab. Malang', 'Tahu & Tempe'),
  umkm('UMKM Ayam Segar FJR', 'Kebonsari, Tumpang, Malang', 'Protein & Unggas'),
  umkm('UMKM Divarif Plastik', 'Kambingan, Tumpang, Kab. Malang', 'Plastik & Kemasan'),
  umkm('Ayam Segar 98', 'Jl. Kebonsari-Kidal, Kec. Tumpang, Malang', 'Protein & Unggas'),
  umkm('Tempe Pak Tro', 'Malangsuko, Kab. Malang', 'Tahu & Tempe'),
  umkm('Berkah Tahu Tempe Saidah', 'Kec. Pakis, Kab. Malang', 'Tahu & Tempe'),
  umkm('PT Tuan Raja Emas Mulia', 'Kedungkandang, Kota Malang', 'Umum'),
  umkm('Plastmart Murni', 'Kec. Tumpang, Kab. Malang', 'Plastik & Kemasan'),
  umkm('Mbak Pur Daging', 'Pakisjajar, Kec. Pakis, Malang', 'Protein & Daging'),
];

export const INITIAL_SUPPLIERS: Supplier[] = LOCAL_UMKM_SUPPLIERS.map((s, i) => ({
  ...s,
  id: `SUP-${String(i + 1).padStart(3, '0')}`,
}));

// Supplier dummy bawaan versi lama yang dibersihkan dari penyimpanan lokal browser.
export const LEGACY_DUMMY_SUPPLIER_NAMES = [
  'PT ABC Pangan Mandiri',
  'CV Berkah Unggas Segar',
  'Koperasi Tani Makmur Subang',
  'PT Buah Nusantara Segar',
  'PT Higienis Sanitasi Sentosa',
];

export const INITIAL_ITEMS: ItemMaster[] = [
  // Sembako (Food Carrying Stock)
  {
    id: 'ITM-SMB-001',
    name: 'Beras Pandan Wangi Premium',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    subcategory: 'Beras & Biji-bijian',
    baseUnit: 'Kg',
    minimumStock: 200,
    reorderPoint: 350,
    currentStock: 450,
    location: 'Gudang Kering - Rak A1',
    expiryTrackingEnabled: true,
    isActive: true,
    notes: 'Beras kemasan karung 25kg berlabel Halal & SNI.',
    lastMovementDate: '2026-09-20',
  },
  {
    id: 'ITM-SMB-002',
    name: 'Minyak Goreng Sawit Higienis',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    subcategory: 'Minyak & Lemak',
    baseUnit: 'Liter',
    minimumStock: 80,
    reorderPoint: 120,
    currentStock: 140,
    location: 'Gudang Kering - Rak A2',
    expiryTrackingEnabled: true,
    isActive: true,
    notes: 'Jerigen 5 Liter food grade fortifikasi Vitamin A.',
    lastMovementDate: '2026-09-20',
  },
  {
    id: 'ITM-SMB-003',
    name: 'Gula Pasir Kristal Putih',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    subcategory: 'Pemanis',
    baseUnit: 'Kg',
    minimumStock: 50,
    reorderPoint: 90,
    currentStock: 85,
    location: 'Gudang Kering - Rak A3',
    expiryTrackingEnabled: false,
    isActive: true,
    notes: 'Kemasan 1kg standar nasional.',
    lastMovementDate: '2026-09-19',
  },
  {
    id: 'ITM-SMB-004',
    name: 'Tepung Terigu Protein Sedang',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    subcategory: 'Tepung',
    baseUnit: 'Kg',
    minimumStock: 40,
    reorderPoint: 70,
    currentStock: 60,
    location: 'Gudang Kering - Rak A3',
    expiryTrackingEnabled: true,
    isActive: true,
    notes: 'Untuk olahan lauk dan camilan bernutrisi.',
    lastMovementDate: '2026-09-19',
  },
  {
    id: 'ITM-SMB-005',
    name: 'Garam Beryodium Halus',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    subcategory: 'Bumbu & Rempah',
    baseUnit: 'Kg',
    minimumStock: 20,
    reorderPoint: 35,
    currentStock: 15, // LOW STOCK TRIGGER
    location: 'Gudang Kering - Rak A4',
    expiryTrackingEnabled: false,
    isActive: true,
    notes: 'Garam konsumsi beryodium 30-80 ppm.',
    lastMovementDate: '2026-09-18',
  },

  // Protein (Food Daily Flow)
  {
    id: 'ITM-PRO-001',
    name: 'Daging Ayam Broiler Karkas Bersih',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Protein',
    subcategory: 'Unggas',
    baseUnit: 'Kg',
    minimumStock: 30,
    reorderPoint: 50,
    currentStock: 45,
    location: 'Chiller Dapur - Bin C1',
    expiryTrackingEnabled: true,
    isActive: true,
    notes: 'Penerimaan harian suhu <4°C. Dikonsumsi hari yang sama.',
    lastMovementDate: '2026-09-20',
  },
  {
    id: 'ITM-PRO-002',
    name: 'Telur Ayam Ras Segar',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Protein',
    subcategory: 'Telur',
    baseUnit: 'Kg',
    minimumStock: 25,
    reorderPoint: 40,
    currentStock: 50,
    location: 'Area Persiapan - Rak Telur',
    expiryTrackingEnabled: true,
    isActive: true,
    notes: 'Cangkang bersih tidak retak, rata-rata 16 butir/kg.',
    lastMovementDate: '2026-09-20',
  },
  {
    id: 'ITM-PRO-003',
    name: 'Ikan Kembung Segar',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Protein',
    subcategory: 'Ikan Laut',
    baseUnit: 'Kg',
    minimumStock: 20,
    reorderPoint: 35,
    currentStock: 0, // OUT OF STOCK
    location: 'Freezer Dapur - Bin F2',
    expiryTrackingEnabled: true,
    isActive: true,
    notes: 'Mata jernih, insang merah segar, bebas formalin.',
    lastMovementDate: '2026-09-19',
  },

  // Vegetables (Food Daily Flow)
  {
    id: 'ITM-VEG-001',
    name: 'Sayur Bayam Hijau Segar',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Sayuran',
    subcategory: 'Sayuran Daun',
    baseUnit: 'Kg',
    minimumStock: 15,
    reorderPoint: 25,
    currentStock: 20,
    location: 'Area Sortir Sayur',
    expiryTrackingEnabled: true,
    isActive: true,
    notes: 'Datang pagi hari, langsung dicuci & diolah untuk menu siang.',
    lastMovementDate: '2026-09-20',
  },
  {
    id: 'ITM-VEG-002',
    name: 'Wortel Segar Super',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Sayuran',
    subcategory: 'Sayuran Umbi',
    baseUnit: 'Kg',
    minimumStock: 15,
    reorderPoint: 25,
    currentStock: 18,
    location: 'Area Sortir Sayur',
    expiryTrackingEnabled: true,
    isActive: true,
    notes: 'Wortel manis segar tanpa daun & sudah bersih dari tanah.',
    lastMovementDate: '2026-09-20',
  },

  // Fruit (Food Daily Flow)
  {
    id: 'ITM-FRT-001',
    name: 'Pisang Cavendish / Ambon Matang',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Buah',
    subcategory: 'Buah Segar',
    baseUnit: 'Kg',
    minimumStock: 30,
    reorderPoint: 50,
    currentStock: 40,
    location: 'Area Buah & Distribusi',
    expiryTrackingEnabled: true,
    isActive: true,
    notes: 'Tingkat kematangan optimal untuk paket menu anak.',
    lastMovementDate: '2026-09-20',
  },

  // Operational Supplies
  {
    id: 'ITM-OPS-001',
    name: 'Sabun Cuci Piring Food-Grade 5L',
    itemType: 'OPERATIONAL_CONSUMABLE',
    category: 'Cleaning',
    subcategory: 'Deterjen & Sanitasi',
    baseUnit: 'Jerigen' as any,
    minimumStock: 6,
    reorderPoint: 10,
    currentStock: 12,
    location: 'Gudang Non-Food Rak N1',
    expiryTrackingEnabled: false,
    isActive: true,
    notes: 'Konsentrat ramah tangan dengan sertifikasi Kemenkes.',
    lastMovementDate: '2026-09-18',
  },
  {
    id: 'ITM-OPS-002',
    name: 'Kantong Plastik Sampah Hitam Tebal 80x100',
    itemType: 'OPERATIONAL_CONSUMABLE',
    category: 'Packaging',
    subcategory: 'Pengelolaan Limbah',
    baseUnit: 'Pack',
    minimumStock: 10,
    reorderPoint: 20,
    currentStock: 8, // LOW STOCK
    location: 'Gudang Non-Food Rak N2',
    expiryTrackingEnabled: false,
    isActive: true,
    notes: 'Isi 25 lembar per pack, kuat menahan beban sisa dapur.',
    lastMovementDate: '2026-09-17',
  },
  {
    id: 'ITM-OPS-003',
    name: 'Sarung Tangan Plastik Dapur Disposable',
    itemType: 'OPERATIONAL_CONSUMABLE',
    category: 'Hygiene/PPE',
    subcategory: 'Alat Pelindung Diri',
    baseUnit: 'Dus',
    minimumStock: 15,
    reorderPoint: 25,
    currentStock: 22,
    location: 'Gudang Non-Food Rak N3',
    expiryTrackingEnabled: false,
    isActive: true,
    notes: 'Isi 100 pcs per dus untuk staf pemorsian gizi.',
    lastMovementDate: '2026-09-20',
  },
  {
    id: 'ITM-OPS-004',
    name: 'Tissue Dapur Hand Towel Multifold',
    itemType: 'OPERATIONAL_CONSUMABLE',
    category: 'Packaging',
    subcategory: 'Tissue & Kemasan',
    baseUnit: 'Pack',
    minimumStock: 20,
    reorderPoint: 35,
    currentStock: 30,
    location: 'Gudang Non-Food Rak N2',
    expiryTrackingEnabled: false,
    isActive: true,
    notes: 'Tissue higienis pengering tangan dan meja persiapan dapur.',
    lastMovementDate: '2026-09-18',
  },
  {
    id: 'ITM-OPS-005',
    name: 'Masker Medis 3-Ply & Hijab SPPG 50 Pcs',
    itemType: 'OPERATIONAL_CONSUMABLE',
    category: 'Hygiene/PPE',
    subcategory: 'Alat Pelindung Diri',
    baseUnit: 'Dus',
    minimumStock: 10,
    reorderPoint: 20,
    currentStock: 18,
    location: 'Gudang Non-Food Rak N3',
    expiryTrackingEnabled: false,
    isActive: true,
    notes: 'Masker steril standar higienis staf pengolahan makanan SPPG.',
    lastMovementDate: '2026-09-21',
  },
];

export const INITIAL_EQUIPMENT: EquipmentItem[] = [
  {
    id: 'EQ-KIT-001',
    name: 'Kompor Gas Low-Pressure 4 Tungku Heavy Duty',
    category: 'Kitchen Equipment',
    quantity: 2,
    unit: 'Unit',
    location: 'Dapur Utama - Jalur Masak 1',
    condition: 'GOOD',
    status: 'ACTIVE',
    lastInspectedDate: '2026-09-15',
    notes: 'Regulator dan selang gas SNI telah diganti baru 2 minggu lalu.',
  },
  {
    id: 'EQ-KIT-002',
    name: 'Kuali Wok Besi Waja 60 cm',
    category: 'Kitchen Equipment',
    quantity: 4,
    unit: 'Pcs',
    location: 'Dapur Utama - Rak Wok',
    condition: 'GOOD',
    status: 'ACTIVE',
    lastInspectedDate: '2026-09-18',
    notes: 'Digunakan untuk tumisan porsi besar.',
  },
  {
    id: 'EQ-KIT-003',
    name: 'Panci Kaldu Stainless Steel 50 Liter',
    category: 'Kitchen Equipment',
    quantity: 3,
    unit: 'Pcs',
    location: 'Dapur Utama - Rak Panci',
    condition: 'GOOD',
    status: 'ACTIVE',
    lastInspectedDate: '2026-09-18',
    notes: 'Panci sup dan bubur gizi, bahan SUS 304 food grade.',
  },
  {
    id: 'EQ-KIT-004',
    name: 'Commercial Rice Cooker Gas 10 Liter',
    category: 'Kitchen Equipment',
    quantity: 2,
    unit: 'Unit',
    location: 'Dapur Utama - Stasiun Nasi',
    condition: 'NEEDS_INSPECTION',
    status: 'ACTIVE',
    lastInspectedDate: '2026-09-19',
    notes: 'Pemantik api tungku 2 kadang tersendat saat menyala pertama kali.',
  },
  {
    id: 'EQ-KIT-005',
    name: 'Timbangan Digital Dapur 30 Kg Presisi 1 Gram',
    category: 'Electronic Equipment',
    quantity: 2,
    unit: 'Unit',
    location: 'Area Penerimaan & Penimbangan',
    condition: 'GOOD',
    status: 'ACTIVE',
    lastInspectedDate: '2026-09-20',
    notes: 'Terkalibrasi per September 2026.',
  },
  {
    id: 'EQ-KIT-006',
    name: 'Blender Dapur Komersil 2 Liter Heavy Duty',
    category: 'Electronic Equipment',
    quantity: 1,
    unit: 'Unit',
    location: 'Area Persiapan Bumbu',
    condition: 'DAMAGED',
    status: 'IN_REPAIR',
    lastInspectedDate: '2026-09-19',
    notes: 'Mata pisau macet karena as aus, dalam proses pemesanan suku cadang.',
  },
  {
    id: 'EQ-CLN-001',
    name: 'Set Sapu & Pengki Dapur Food-Grade Karet',
    category: 'Cleaning Equipment',
    quantity: 4,
    unit: 'Set',
    location: 'Area Cuci & Sanitasi',
    condition: 'GOOD',
    status: 'ACTIVE',
    lastInspectedDate: '2026-09-15',
    notes: 'Khusus pembersihan area lantai dapur basah.',
  },
  {
    id: 'EQ-WRH-001',
    name: 'Trolley Barang Stainless 3 Susun',
    category: 'Warehouse Equipment',
    quantity: 2,
    unit: 'Unit',
    location: 'Gudang Kering & Jalur Distribusi',
    condition: 'GOOD',
    status: 'ACTIVE',
    lastInspectedDate: '2026-09-14',
    notes: 'Roda lancar, rem berfungsi normal.',
  },
];

export const INITIAL_TODOS: DailyTodoItem[] = [
  {
    id: 'TODO-001',
    date: localDateIso(),
    title: 'Pemeriksaan kebersihan dan kesiapan area penyimpanan bahan',
    category: 'Penerimaan & QC',
    priority: 'Tinggi',
    session: 'Pagi',
    targetTime: '06:00',
    isCompleted: true,
    completedAt: '06:15',
    completedBy: 'Andi Pratama (ASLAP)',
    assignedRole: 'ASLAP',
    assignedUserId: 'USR-004',
    assignedUserName: 'Andi Pratama',
    notes: 'Area penyimpanan bersih, higienis, dan siap untuk operasional.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TODO-002',
    date: localDateIso(),
    title: 'Penerimaan & uji organoleptik ayam karkas dan telur segar dari supplier',
    category: 'Penerimaan & QC',
    priority: 'Tinggi',
    session: 'Pagi',
    targetTime: '06:30',
    isCompleted: true,
    completedAt: '06:45',
    completedBy: 'Andi Pratama (ASLAP)',
    assignedRole: 'ASLAP',
    assignedUserId: 'USR-004',
    assignedUserName: 'Andi Pratama',
    notes: 'Kondisi segar, aroma normal, kualitas bahan prima saat tiba.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TODO-003',
    date: localDateIso(),
    title: 'Penimbangan & sortasi sayuran segar (bayam, wortel, labu siam)',
    category: 'Persiapan Dapur',
    priority: 'Sedang',
    session: 'Pagi',
    targetTime: '07:00',
    isCompleted: true,
    completedAt: '07:10',
    completedBy: 'Akmal (ADMIN)',
    assignedRole: 'ADMIN',
    assignedUserId: 'USR-003',
    assignedUserName: 'Akmal',
    notes: 'Disortir bersih, daun layu dipisahkan masuk limbah organik.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TODO-004',
    date: localDateIso(),
    title: 'Serah terima bahan masak menu makan siang ke koki utama & tim masak',
    category: 'Persiapan Dapur',
    priority: 'Tinggi',
    session: 'Pagi',
    targetTime: '07:30',
    isCompleted: true,
    completedAt: '07:30',
    completedBy: 'Budi Santoso (SUPERADMIN)',
    assignedRole: 'ADMIN',
    assignedUserId: 'USR-001',
    assignedUserName: 'Budi Santoso',
    notes: 'Target 3.044 porsi makan siang bergizi anak sekolah.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TODO-005',
    date: localDateIso(),
    title: 'Pengecekan stok aman bahan kering gudang (beras premium & minyak goreng)',
    category: 'Administrasi & Stok',
    priority: 'Sedang',
    session: 'Siang',
    targetTime: '10:30',
    isCompleted: false,
    assignedRole: 'ADMIN',
    assignedUserId: 'USR-003',
    assignedUserName: 'Akmal',
    notes: 'Pastikan safety stock mencukupi jadwal menu hingga akhir pekan.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TODO-006',
    date: localDateIso(),
    title: 'Pencatatan rekapitulasi limbah organik dan sisa pengolahan dapur hari ini',
    category: 'Sanitasi & Kebersihan',
    priority: 'Sedang',
    session: 'Siang',
    targetTime: '13:00',
    isCompleted: false,
    assignedRole: 'ASLAP',
    assignedUserId: 'USR-004',
    assignedUserName: 'Andi Pratama',
    notes: 'Timbang limbah kupasan sayur & sisa makanan sebelum dialihkan ke pakan ternak.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TODO-007',
    date: localDateIso(),
    title: 'Sterilisasi peralatan masak besar & sanitasi area pencucian bahan',
    category: 'Sanitasi & Kebersihan',
    priority: 'Tinggi',
    session: 'Sore',
    targetTime: '15:30',
    isCompleted: false,
    assignedRole: 'ASLAP',
    assignedUserId: 'USR-004',
    assignedUserName: 'Andi Pratama',
    notes: 'Pembersihan meja stainless, wajan komersial, dan saluran drainase dapur.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TODO-008',
    date: localDateIso(),
    title: 'Rekonsiliasi bon pengeluaran bahan & verifikasi buku mutasi stok harian',
    category: 'Administrasi & Stok',
    priority: 'Tinggi',
    session: 'Sore',
    targetTime: '16:30',
    isCompleted: false,
    assignedRole: 'AKUNTAN',
    assignedUserId: 'USR-005',
    assignedUserName: 'Dewi Lestari',
    notes: 'Cocokkan bukti fisik pengeluaran bahan masak dengan ledger mutasi.',
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_RECEIVINGS: ReceivingDocument[] = [
  {
    id: 'GR-2026-0001',
    date: '2026-09-20',
    arrivalTime: '07:15',
    supplierId: 'SUP-003',
    supplierName: 'UMKM Tumpang Grosir',
    deliveryNoteNo: 'SJ-TG-8842',
    receiverId: 'USR-003',
    receiverName: 'Akmal',
    receiverRole: 'ADMIN',
    status: 'VERIFIED_POSTED',
    notes: 'Pengiriman beras dan minyak sesuai PO rutin mingguan, kualitas prima.',
    lines: [
      {
        id: 'GRL-001',
        itemId: 'ITM-SMB-001',
        itemName: 'Beras Pandan Wangi Premium',
        category: 'Sembako',
        quantity: 100,
        unit: 'Kg',
        conditionNote: 'Karung utuh, bersih, bebas kutu',
        batchNumber: 'BCH-202609-01',
        expiryDate: '2027-03-20',
      },
      {
        id: 'GRL-002',
        itemId: 'ITM-SMB-002',
        itemName: 'Minyak Goreng Sawit Higienis',
        category: 'Sembako',
        quantity: 50,
        unit: 'Liter',
        conditionNote: 'Segel jerigen rapat tanpa bocor',
        batchNumber: 'BCH-202609-02',
        expiryDate: '2027-09-15',
      },
    ],
    supplierSignature: 'CONFIRMED: PIC UMKM Tumpang Grosir',
    receiverSignature: 'VERIFIED: Akmal (Admin Gudang)',
    createdAt: '2026-09-20T07:30:00Z',
  },
  {
    id: 'GR-2026-0002',
    date: '2026-09-20',
    arrivalTime: '06:40',
    supplierId: 'SUP-005',
    supplierName: 'UMKM Ayam Segar FJR',
    deliveryNoteNo: 'SJ-FJR-0920',
    receiverId: 'USR-003',
    receiverName: 'Akmal',
    receiverRole: 'ADMIN',
    status: 'VERIFIED_POSTED',
    notes: 'Penerimaan protein harian menu gizi seimbang. Suhu mobil boks 3.2°C.',
    lines: [
      {
        id: 'GRL-003',
        itemId: 'ITM-PRO-001',
        itemName: 'Daging Ayam Broiler Karkas Bersih',
        category: 'Protein',
        quantity: 65,
        unit: 'Kg',
        conditionNote: 'Daging segar warna merah muda, kenyal, lolos uji organoleptik QC',
        batchNumber: 'AYM-20260920',
        expiryDate: '2026-09-21',
      },
      {
        id: 'GRL-004',
        itemId: 'ITM-PRO-002',
        itemName: 'Telur Ayam Ras Segar',
        category: 'Protein',
        quantity: 30,
        unit: 'Kg',
        conditionNote: '100% utuh tanpa retak, berat rata-rata 62g/butir',
        batchNumber: 'TLR-20260920',
        expiryDate: '2026-10-04',
      },
    ],
    supplierSignature: 'CONFIRMED: PIC Ayam Segar FJR',
    receiverSignature: 'VERIFIED: Akmal (Admin Gudang)',
    createdAt: '2026-09-20T06:55:00Z',
  },
  {
    id: 'GR-2026-0003',
    date: '2026-09-28',
    arrivalTime: '08:10',
    supplierId: 'SUP-003',
    supplierName: 'UMKM Tumpang Grosir',
    deliveryNoteNo: 'SJ-TG-8901',
    receiverId: 'USR-003',
    receiverName: 'Akmal',
    receiverRole: 'ADMIN',
    status: 'VERIFIED_POSTED',
    notes: 'Pengiriman beras premium & gula pasir persiapan menu gizi pekan ke-5.',
    lines: [
      {
        id: 'GRL-005',
        itemId: 'ITM-SMB-001',
        itemName: 'Beras Pandan Wangi Premium',
        category: 'Sembako',
        quantity: 150,
        unit: 'Kg',
        conditionNote: 'Karung rapi, kadar air < 14%, mutu super',
        batchNumber: 'BCH-202609-08',
        expiryDate: '2027-03-28',
      },
      {
        id: 'GRL-006',
        itemId: 'ITM-SMB-003',
        itemName: 'Gula Pasir Kristal Putih',
        category: 'Sembako',
        quantity: 40,
        unit: 'Kg',
        conditionNote: 'Bersih & kering tanpa gumpalan',
        batchNumber: 'GLA-202609-02',
        expiryDate: '2027-09-28',
      },
    ],
    supplierSignature: 'CONFIRMED: PIC UMKM Tumpang Grosir',
    receiverSignature: 'VERIFIED: Akmal (Admin Gudang)',
    createdAt: '2026-09-28T08:20:00Z',
  },
  {
    id: 'GR-2026-0004',
    date: '2026-09-29',
    arrivalTime: '06:50',
    supplierId: 'SUP-007',
    supplierName: 'Ayam Segar 98',
    deliveryNoteNo: 'SJ-AS98-0929',
    receiverId: 'USR-003',
    receiverName: 'Akmal',
    receiverRole: 'ADMIN',
    status: 'VERIFIED_POSTED',
    notes: 'Pasokan ayam potong segar pagi hari & telur ayam negeri.',
    lines: [
      {
        id: 'GRL-007',
        itemId: 'ITM-PRO-001',
        itemName: 'Daging Ayam Broiler Karkas Bersih',
        category: 'Protein',
        quantity: 60,
        unit: 'Kg',
        conditionNote: 'Suhu 3.0°C, segar, bersih tanpa lendir',
        batchNumber: 'AYM-20260929',
        expiryDate: '2026-09-30',
      },
      {
        id: 'GRL-008',
        itemId: 'ITM-PRO-002',
        itemName: 'Telur Ayam Ras Segar',
        category: 'Protein',
        quantity: 35,
        unit: 'Kg',
        conditionNote: 'Cangkang bersih dan utuh',
        batchNumber: 'TLR-20260929',
        expiryDate: '2026-10-14',
      },
    ],
    supplierSignature: 'CONFIRMED: PIC Ayam Segar 98',
    receiverSignature: 'VERIFIED: Akmal (Admin Gudang)',
    createdAt: '2026-09-29T07:05:00Z',
  },
  {
    id: 'GR-2026-0005',
    date: '2026-09-30',
    arrivalTime: '07:00',
    supplierId: 'SUP-002',
    supplierName: "UMKM Luber's Fresh",
    deliveryNoteNo: 'SJ-LF-0930',
    receiverId: 'USR-003',
    receiverName: 'Akmal',
    receiverRole: 'ADMIN',
    status: 'VERIFIED_POSTED',
    notes: 'Sayuran segar panen pagi langsung dari petani mitra gizi.',
    lines: [
      {
        id: 'GRL-009',
        itemId: 'ITM-VEG-001',
        itemName: 'Sayur Bayam Hijau Segar',
        category: 'Sayuran',
        quantity: 50,
        unit: 'Ikat',
        conditionNote: 'Segar renyah, daun hijau bebas hama',
        batchNumber: 'BYM-20260930',
        expiryDate: '2026-10-02',
      },
      {
        id: 'GRL-010',
        itemId: 'ITM-VEG-002',
        itemName: 'Wortel Segar Brastagi',
        category: 'Sayuran',
        quantity: 30,
        unit: 'Kg',
        conditionNote: 'Kelas A, keras & warna jingga cerah',
        batchNumber: 'WRT-20260930',
        expiryDate: '2026-10-07',
      },
    ],
    supplierSignature: "CONFIRMED: PIC Luber's Fresh",
    receiverSignature: 'VERIFIED: Akmal (Admin Gudang)',
    createdAt: '2026-09-30T07:15:00Z',
  },
  {
    id: 'GR-2026-0006',
    date: '2026-09-30',
    arrivalTime: '08:30',
    supplierId: 'SUP-001',
    supplierName: 'UMKM Sumber Lumintu',
    deliveryNoteNo: 'SJ-SL-0930',
    receiverId: 'USR-003',
    receiverName: 'Akmal',
    receiverRole: 'ADMIN',
    status: 'VERIFIED_POSTED',
    notes: 'Pengiriman buah pelengkap makan siang sekolah anak.',
    lines: [
      {
        id: 'GRL-011',
        itemId: 'ITM-FRU-001',
        itemName: 'Pisang Cavendish Matang Pas',
        category: 'Buah',
        quantity: 40,
        unit: 'Kg',
        conditionNote: 'Kulit kuning mulus, siap dikonsumsi',
        batchNumber: 'PSG-20260930',
        expiryDate: '2026-10-03',
      },
      {
        id: 'GRL-012',
        itemId: 'ITM-FRU-002',
        itemName: 'Semangka Merah Non-Biji',
        category: 'Buah',
        quantity: 50,
        unit: 'Kg',
        conditionNote: 'Kondisi segar utuh',
        batchNumber: 'SMK-20260930',
        expiryDate: '2026-10-06',
      },
    ],
    supplierSignature: 'CONFIRMED: PIC Sumber Lumintu',
    receiverSignature: 'VERIFIED: Akmal (Admin Gudang)',
    createdAt: '2026-09-30T08:45:00Z',
  },
];

export const INITIAL_TRANSACTIONS: InventoryTransaction[] = [
  {
    id: 'TX-2026-0001',
    timestamp: '2026-09-20 07:30',
    itemId: 'ITM-SMB-001',
    itemName: 'Beras Pandan Wangi Premium',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    location: 'Gudang Kering - Rak A1',
    quantity: 100,
    unit: 'Kg',
    transactionType: 'RECEIVING',
    referenceDocument: 'GR-2026-0001',
    userId: 'USR-003',
    userName: 'Akmal',
    userRole: 'ADMIN',
    notes: 'Penerimaan barang dari UMKM Tumpang Grosir',
    balanceAfter: 450,
  },
  {
    id: 'TX-2026-0002',
    timestamp: '2026-09-20 07:30',
    itemId: 'ITM-SMB-002',
    itemName: 'Minyak Goreng Sawit Higienis',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    location: 'Gudang Kering - Rak A2',
    quantity: 50,
    unit: 'Liter',
    transactionType: 'RECEIVING',
    referenceDocument: 'GR-2026-0001',
    userId: 'USR-003',
    userName: 'Akmal',
    userRole: 'ADMIN',
    notes: 'Penerimaan barang dari UMKM Tumpang Grosir',
    balanceAfter: 140,
  },
  {
    id: 'TX-2026-0003',
    timestamp: '2026-09-20 06:55',
    itemId: 'ITM-PRO-001',
    itemName: 'Daging Ayam Broiler Karkas Bersih',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Protein',
    location: 'Chiller Dapur - Bin C1',
    quantity: 65,
    unit: 'Kg',
    transactionType: 'RECEIVING',
    referenceDocument: 'GR-2026-0002',
    userId: 'USR-003',
    userName: 'Akmal',
    userRole: 'ADMIN',
    notes: 'Penerimaan protein dari UMKM Ayam Segar FJR',
    balanceAfter: 65,
  },
  {
    id: 'TX-2026-0004',
    timestamp: '2026-09-20 08:30',
    itemId: 'ITM-PRO-001',
    itemName: 'Daging Ayam Broiler Karkas Bersih',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Protein',
    location: 'Chiller Dapur - Bin C1',
    quantity: -20,
    unit: 'Kg',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0920-A',
    userId: 'USR-002',
    userName: 'Budi Santoso',
    userRole: 'ADMIN',
    notes: 'Pengeluaran untuk persiapan menu makan siang SPPG Batch 1',
    balanceAfter: 45,
  },
  {
    id: 'TX-2026-0005',
    timestamp: '2026-09-20 08:45',
    itemId: 'ITM-SMB-001',
    itemName: 'Beras Pandan Wangi Premium',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    location: 'Gudang Kering - Rak A1',
    quantity: -25,
    unit: 'Kg',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0920-B',
    userId: 'USR-002',
    userName: 'Budi Santoso',
    userRole: 'ADMIN',
    notes: 'Pemasakan nasi porsi makan siang 3.044 penerima manfaat',
    balanceAfter: 425,
  },
  {
    id: 'TX-2026-0006',
    timestamp: '2026-09-20 09:00',
    itemId: 'ITM-SMB-002',
    itemName: 'Minyak Goreng Sawit Higienis',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    location: 'Gudang Kering - Rak A2',
    quantity: -10,
    unit: 'Liter',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0920-C',
    userId: 'USR-002',
    userName: 'Budi Santoso',
    userRole: 'ADMIN',
    notes: 'Penggorengan lauk ayam krispi dan tahu cabe garam',
    balanceAfter: 130,
  },
  {
    id: 'TX-2026-0007',
    timestamp: '2026-09-21 07:30',
    itemId: 'ITM-SMB-001',
    itemName: 'Beras Pandan Wangi Premium',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    location: 'Gudang Kering - Rak A1',
    quantity: -20,
    unit: 'Kg',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0921-A',
    userId: 'USR-003',
    userName: 'Akmal',
    userRole: 'ADMIN',
    notes: 'Menu bubur sarapan gizi anak sekolah',
    balanceAfter: 405,
  },
  {
    id: 'TX-2026-0008',
    timestamp: '2026-09-21 07:45',
    itemId: 'ITM-PRO-002',
    itemName: 'Telur Ayam Ras Segar',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Protein',
    location: 'Area Persiapan - Rak Telur',
    quantity: -16,
    unit: 'Kg',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0921-B',
    userId: 'USR-003',
    userName: 'Akmal',
    userRole: 'ADMIN',
    notes: 'Perebusan telur topping bubur sarapan gizi',
    balanceAfter: 34,
  },
  {
    id: 'TX-2026-0009',
    timestamp: '2026-09-21 08:00',
    itemId: 'ITM-VEG-001',
    itemName: 'Sayur Bayam Hijau Segar',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Sayuran',
    location: 'Area Sortir Sayur',
    quantity: -12,
    unit: 'Kg',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0921-C',
    userId: 'USR-003',
    userName: 'Akmal',
    userRole: 'ADMIN',
    notes: 'Pengolahan sayur bening bayam jagung',
    balanceAfter: 8,
  },
  {
    id: 'TX-2026-0010',
    timestamp: '2026-09-22 08:00',
    itemId: 'ITM-SMB-001',
    itemName: 'Beras Pandan Wangi Premium',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    location: 'Gudang Kering - Rak A1',
    quantity: -28,
    unit: 'Kg',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0922-A',
    userId: 'USR-002',
    userName: 'Budi Santoso',
    userRole: 'ADMIN',
    notes: 'Pemasakan nasi makan siang semur daging',
    balanceAfter: 377,
  },
  {
    id: 'TX-2026-0011',
    timestamp: '2026-09-22 08:15',
    itemId: 'ITM-PRO-001',
    itemName: 'Daging Ayam Broiler Karkas Bersih',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Protein',
    location: 'Chiller Dapur - Bin C1',
    quantity: -25,
    unit: 'Kg',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0922-B',
    userId: 'USR-002',
    userName: 'Budi Santoso',
    userRole: 'ADMIN',
    notes: 'Pembuatan semur ayam bumbu nusantara',
    balanceAfter: 20,
  },
  {
    id: 'TX-2026-0012',
    timestamp: '2026-09-22 08:30',
    itemId: 'ITM-VEG-002',
    itemName: 'Wortel Segar Super',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Sayuran',
    location: 'Area Sortir Sayur',
    quantity: -12,
    unit: 'Kg',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0922-C',
    userId: 'USR-002',
    userName: 'Budi Santoso',
    userRole: 'ADMIN',
    notes: 'Tumisan wortel dan buncis pelengkap gizi',
    balanceAfter: 6,
  },
  {
    id: 'TX-2026-0013',
    timestamp: '2026-09-23 07:15',
    itemId: 'ITM-FRT-001',
    itemName: 'Pisang Cavendish / Ambon Matang',
    itemType: 'FOOD_DAILY_FLOW',
    category: 'Buah',
    location: 'Area Buah & Distribusi',
    quantity: -25,
    unit: 'Kg',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0923-A',
    userId: 'USR-003',
    userName: 'Akmal',
    userRole: 'ADMIN',
    notes: 'Penyaluran buah segar pencuci mulut anak',
    balanceAfter: 15,
  },
  {
    id: 'TX-2026-0014',
    timestamp: '2026-09-23 07:45',
    itemId: 'ITM-SMB-003',
    itemName: 'Gula Pasir Kristal Putih',
    itemType: 'FOOD_CARRYING_STOCK',
    category: 'Sembako',
    location: 'Gudang Kering - Rak A3',
    quantity: -8,
    unit: 'Kg',
    transactionType: 'ISSUE_CONSUMPTION',
    referenceDocument: 'ISS-2026-0923-B',
    userId: 'USR-003',
    userName: 'Akmal',
    userRole: 'ADMIN',
    notes: 'Bumbu olahan masakan dan minuman teh manis hangat',
    balanceAfter: 77,
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'AUD-001',
    timestamp: '2026-09-20 07:30',
    userId: 'USR-003',
    userName: 'Akmal',
    userRole: 'ADMIN',
    action: 'RECEIVING_POSTED',
    entity: 'RECEIVING',
    entityId: 'GR-2026-0001',
    details: 'Berhasil mencatat & memposting penerimaan 2 item dari UMKM Tumpang Grosir (Total: 150 unit).',
  },
  {
    id: 'AUD-002',
    timestamp: '2026-09-20 06:55',
    userId: 'USR-003',
    userName: 'Akmal',
    userRole: 'ADMIN',
    action: 'RECEIVING_POSTED',
    entity: 'RECEIVING',
    entityId: 'GR-2026-0002',
    details: 'Penerimaan dan verifikasi QC ayam karkas (65 Kg) dan telur (30 Kg).',
  },
  {
    id: 'AUD-003',
    timestamp: '2026-09-20 08:30',
    userId: 'USR-002',
    userName: 'Budi Santoso',
    userRole: 'ADMIN',
    action: 'STOCK_CONSUMED',
    entity: 'INVENTORY',
    entityId: 'ITM-PRO-001',
    details: 'Pengeluaran bahan 20 Kg Daging Ayam Broiler untuk persiapan dapur siang.',
  },
];

export const INITIAL_OPNAMES: StockOpnameSession[] = [
  {
    id: 'SO-2026-0001',
    date: '2026-09-18',
    location: 'Gudang Kering - Rak A',
    createdById: 'USR-003',
    createdByName: 'Siti Rahma',
    status: 'APPROVED',
    approvedById: 'USR-002',
    approvedByName: 'Budi Santoso',
    approvedAt: '2026-09-18 17:00',
    notes: 'Stock opname rutin akhir pekan untuk bahan sembako utama.',
    items: [
      {
        id: 'SOI-001',
        itemId: 'ITM-SMB-001',
        itemName: 'Beras Pandan Wangi Premium',
        category: 'Sembako',
        unit: 'Kg',
        systemStock: 355,
        physicalCount: 350,
        variance: -5,
        reason: 'Penyusutan kelembaban karung dan tumpahan kecil saat pemindahan.',
      },
      {
        id: 'SOI-002',
        itemId: 'ITM-SMB-002',
        itemName: 'Minyak Goreng Sawit Higienis',
        category: 'Sembako',
        unit: 'Liter',
        systemStock: 90,
        physicalCount: 90,
        variance: 0,
        reason: 'Sesuai fisik.',
      },
    ],
    createdAt: '2026-09-18T16:30:00Z',
  },
];

export const INITIAL_NONFOOD_EXPENSES: NonFoodExpense[] = [
  {
    id: "PRL-EXP-NEW-01",
    date: "2026-09-28",
    itemName: "Minyak Goreng Sawit Higienis",
    quantity: "40 Liter",
    unit: "Liter",
    time: "08.15",
    volunteer: "Siti Rahma",
    pic: "Siti Rahma",
    category: "Bahan Kering",
    department: "Dapur Pengolahan Utama",
    recipient: "Siti Rahma",
    recordedBy: "Siti Rahma",
    unitPrice: 18000,
    totalCost: 720000,
    notes: "[Toko/Supplier: Toko Sembako Berkah Jaya] Pasokan minyak goreng stok pekan berjalan",
    createdAt: "2026-09-28T08:15:00Z"
  },
  {
    id: "PRL-EXP-NEW-02",
    date: "2026-09-29",
    itemName: "Sabun Cuci Piring Sunlight 4L",
    quantity: "2 jerigen",
    unit: "Jerigen",
    time: "09.40",
    volunteer: "Roni",
    pic: "Akmal",
    category: "Bahan Peralatan",
    department: "Area Cuci & Sanitasi",
    recipient: "Roni",
    recordedBy: "Akmal",
    unitPrice: 85000,
    totalCost: 170000,
    notes: "[Toko/Supplier: UMKM Divarif Plastik] Keperluan sanitasi dapur dan tray makan",
    createdAt: "2026-09-29T09:40:00Z"
  },
  {
    id: "PRL-EXP-NEW-03",
    date: "2026-09-30",
    itemName: "Telur Ayam Ras Segar",
    quantity: "40 Kg",
    unit: "Kg",
    time: "07.30",
    volunteer: "Pak Joko",
    pic: "Akmal",
    category: "Bahan Basah",
    department: "Dapur Pengolahan Utama",
    recipient: "Pak Joko",
    recordedBy: "Akmal",
    unitPrice: 28000,
    totalCost: 1120000,
    notes: "[Toko/Supplier: UMKM Ayam Segar FJR] Belanja protein menu telur balado anak",
    createdAt: "2026-09-30T07:30:00Z"
  },
  ...REAL_NONFOOD_EXPENSES
];

export const INITIAL_MENU_ORDERS: MenuOrder[] = REAL_MENU_ORDERS;
export const INITIAL_SCHOOL_BENEFICIARIES: SchoolBeneficiaryAllocation[] = DEFAULT_SCHOOL_BENEFICIARIES;

export const INITIAL_WASTE_LOGS: WasteLog[] = REAL_WASTE_LOGS;

export const INITIAL_PURCHASE_ORDERS: PurchaseOrderNota[] = [
  {
    id: 'PO-2026-09-001',
    poNumber: 'NO. NP/SPPG/134/IX/2026',
    date: '2026-09-28',
    deliveryDate: '2026-09-28',
    supplierId: 'SUP-003',
    supplierName: 'UMKM Tumpang Grosir',
    supplierContact: '0812-3456-7890 (Ibu Linda)',
    supplierAddress: 'Jl. Pahlawan Barat, Kec. Tumpang, Kab. Malang',
    paymentMethod: 'TRANSFER',
    bankInfo: 'BCA: 14000-8899-221 a.n UMKM Tumpang Grosir',
    status: 'DISETUJUI',
    items: [
      {
        id: 'POI-001',
        name: 'Beras Pandan Wangi Premium',
        category: 'Bahan Kering',
        quantity: 100,
        unit: 'Kg',
        unitPrice: 14500,
        subtotal: 1450000,
        notes: 'Kemasan karung 25kg berlabel Halal',
      },
      {
        id: 'POI-002',
        name: 'Minyak Goreng Sawit Higienis',
        category: 'Bahan Kering',
        quantity: 40,
        unit: 'Liter',
        unitPrice: 18000,
        subtotal: 720000,
        notes: 'Kemasan jerigen/pouch higienis',
      },
      {
        id: 'POI-003',
        name: 'Gula Pasir Kristal Putih',
        category: 'Bahan Kering',
        quantity: 25,
        unit: 'Kg',
        unitPrice: 17500,
        subtotal: 437500,
        notes: 'Gula kristal putih kemasan food grade',
      },
    ],
    subtotal: 2607500,
    discount: 0,
    tax: 0,
    grandTotal: 2607500,
    terbilang: 'Dua Juta Enam Ratus Tujuh Ribu Lima Ratus Rupiah',
    notes: 'Mohon barang dikirim dalam kondisi tersegel baik dan lampirkan faktur pengiriman.',
    deliveryTerms: 'Pengiriman langsung ke Gudang Utama SPPG MLG TUMPANG JERU sebelum jam 10:00 WIB.',
    createdBy: 'Akmal',
    createdByRole: 'Admin Logistik',
    approvedBy: 'Rizky Iman Ramdhan, S.Pd',
    approvedByRole: 'Kepala SPPG MLG TUMPANG JERU',
    supplierPic: 'Logistik UMKM Tumpang Grosir',
    relatedReceivingId: 'GR-2026-0003',
    createdAt: '2026-09-28T08:30:00.000Z',
  },
  {
    id: 'PO-2026-09-002',
    poNumber: 'NO. NP/SPPG/135/IX/2026',
    date: '2026-09-29',
    deliveryDate: '2026-09-29',
    supplierId: 'SUP-005',
    supplierName: 'UMKM Ayam Segar FJR',
    supplierContact: '0813-8877-2211 (Pak Joko)',
    supplierAddress: 'Kebonsari, Tumpang, Malang',
    paymentMethod: 'TEMPO_7',
    bankInfo: 'Mandiri: 132-00-998877 a.n UMKM Ayam Segar FJR',
    status: 'DISETUJUI',
    items: [
      {
        id: 'POI-004',
        name: 'Daging Ayam Broiler Karkas Bersih',
        category: 'Bahan Basah',
        quantity: 60,
        unit: 'Kg',
        unitPrice: 38000,
        subtotal: 2280000,
        notes: 'Karkas segar dingin suhu 2-4°C, bebas formalin',
      },
      {
        id: 'POI-005',
        name: 'Telur Ayam Ras Segar',
        category: 'Bahan Basah',
        quantity: 35,
        unit: 'Kg',
        unitPrice: 28000,
        subtotal: 980000,
        notes: 'Telur bersih, utuh tidak retak, grade A',
      },
    ],
    subtotal: 3260000,
    discount: 0,
    tax: 0,
    grandTotal: 3260000,
    terbilang: 'Tiga Juta Dua Ratus Enam Puluh Ribu Rupiah',
    notes: 'Suhu pengiriman wajib terjaga dingin menggunakan coolbox berinsulasi.',
    deliveryTerms: 'Tiba di SPPG maksimal pukul 07:00 WIB untuk persiapan masak pagi.',
    createdBy: 'Akmal',
    createdByRole: 'Admin Logistik',
    approvedBy: 'Rizky Iman Ramdhan, S.Pd',
    approvedByRole: 'Kepala SPPG MLG TUMPANG JERU',
    supplierPic: 'PIC UMKM Ayam Segar FJR',
    relatedReceivingId: 'GR-2026-0004',
    createdAt: '2026-09-29T06:15:00.000Z',
  },
  {
    id: 'PO-2026-09-003',
    poNumber: 'NO. NP/SPPG/136/IX/2026',
    date: '2026-09-29',
    deliveryDate: '2026-09-29',
    supplierId: 'SUP-002',
    supplierName: "UMKM Luber's Fresh",
    supplierContact: '0857-1122-3344 (Ibu Ratna)',
    supplierAddress: 'Jl. Raya Sukoanyar 49 RT.05/RW.01 Cokro, Kec. Pakis, Kab. Malang',
    paymentMethod: 'TUNAI',
    status: 'DISETUJUI',
    items: [
      {
        id: 'POI-006',
        name: 'Sayur Bayam Hijau Segar',
        category: 'Bahan Basah',
        quantity: 40,
        unit: 'Ikat',
        unitPrice: 3500,
        subtotal: 140000,
        notes: 'Sayur segar panen subuh, daun hijau tanpa hama',
      },
      {
        id: 'POI-007',
        name: 'Wortel Segar Brastagi',
        category: 'Bahan Basah',
        quantity: 25,
        unit: 'Kg',
        unitPrice: 12000,
        subtotal: 300000,
        notes: 'Wortel mulus, sudah dicuci bersih',
      },
      {
        id: 'POI-008',
        name: 'Labu Siam Segar',
        category: 'Bahan Basah',
        quantity: 20,
        unit: 'Kg',
        unitPrice: 9000,
        subtotal: 180000,
        notes: 'Ukuran sedang, kulit mulus',
      },
    ],
    subtotal: 620000,
    discount: 0,
    tax: 0,
    grandTotal: 620000,
    terbilang: 'Enam Ratus Dua Puluh Ribu Rupiah',
    notes: 'Kuitansi pembayaran tunai ditandatangani saat serah terima barang.',
    deliveryTerms: 'Diantar ke Gudang Sayur SPPG.',
    createdBy: 'Akmal',
    createdByRole: 'Admin Logistik',
    approvedBy: 'Rizky Iman Ramdhan, S.Pd',
    approvedByRole: 'Kepala SPPG MLG TUMPANG JERU',
    supplierPic: "PIC UMKM Luber's Fresh",
    relatedReceivingId: 'GR-2026-0005',
    createdAt: '2026-09-29T06:45:00.000Z',
  },
  {
    id: 'PO-2026-09-004',
    poNumber: 'NO. NP/SPPG/137/IX/2026',
    date: '2026-09-29',
    deliveryDate: '2026-09-29',
    supplierName: 'Toko Barokah Jaya (Pak Syamsul)',
    supplierContact: '0852-9988-1122',
    supplierAddress: 'Pasar Tumpang Kios No. 12',
    paymentMethod: 'TUNAI',
    status: 'DIBAYAR',
    items: [
      {
        id: 'POI-009',
        name: 'Kertas HVS A4 70gr (PaperOne)',
        category: 'ATK & Administrasi',
        quantity: 3,
        unit: 'Rim',
        unitPrice: 48000,
        subtotal: 144000,
        notes: 'Untuk arsip form penerimaan gudang',
      },
      {
        id: 'POI-010',
        name: 'Sabun Cuci Piring Sunlight Jeruk Nipis 750ml',
        category: 'Sanitasi, Kemasan & APD',
        quantity: 5,
        unit: 'Pouch',
        unitPrice: 18500,
        subtotal: 92500,
        notes: 'Kebutuhan sanitasi cuci ompreng',
      },
    ],
    subtotal: 236500,
    discount: 0,
    tax: 0,
    grandTotal: 236500,
    terbilang: 'Dua Ratus Tiga Puluh Enam Ribu Lima Ratus Rupiah',
    notes: 'Pembelian langsung operasional SPPG dengan kas bon.',
    createdBy: 'Akmal',
    createdByRole: 'Admin Logistik',
    approvedBy: 'Rizky Iman Ramdhan, S.Pd',
    approvedByRole: 'Kepala SPPG MLG TUMPANG JERU',
    supplierPic: 'Pak Syamsul (Toko Barokah)',
    relatedExpenseIds: ['NFE-2026-003', 'NFE-2026-004'],
    createdAt: '2026-09-29T10:00:00.000Z',
  },
];

// Helper to safe parse JSON
function getStored<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    console.error(`Error reading ${key} from storage:`, e);
    return fallback;
  }
}

// Hanya simpan sesi/konfigurasi non-operasional ke localStorage.
// Seluruh data operasional gudang (barang, stok, supplier, PO, transaksi, dll) disimpan langsung ke Supabase Cloud.
function setStored<T>(key: string, data: T): void {
  const OPERATIONAL_KEYS = new Set([
    STORAGE_KEYS.ITEMS,
    STORAGE_KEYS.SUPPLIERS,
    STORAGE_KEYS.RECEIVINGS,
    STORAGE_KEYS.TRANSACTIONS,
    STORAGE_KEYS.OPNAMES,
    STORAGE_KEYS.EQUIPMENT,
    STORAGE_KEYS.NONFOOD_EXPENSES,
    STORAGE_KEYS.MENU_ORDERS,
    STORAGE_KEYS.WASTE_LOGS,
    STORAGE_KEYS.PURCHASE_ORDERS,
  ]);
  if (OPERATIONAL_KEYS.has(key)) {
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
  }
}

// ==============================================================================
// SUPABASE CLOUD MAPPING HELPERS
// ==============================================================================

export function mapItemToSupabase(item: ItemMaster) {
  return {
    id: item.id,
    name: item.name,
    item_type: item.itemType || 'FOOD_CARRYING_STOCK',
    category: item.category,
    subcategory: item.subcategory || null,
    base_unit: item.baseUnit,
    minimum_stock: Number(item.minimumStock) || 0,
    reorder_point: Number(item.reorderPoint) || 0,
    current_stock: Number(item.currentStock) || 0,
    estimated_price: Number(item.estimatedPrice) || 0,
    location_id: item.location || 'Gudang Utama',
    expiry_tracking_enabled: Boolean(item.expiryTrackingEnabled),
    is_active: item.isActive !== false,
    notes: item.notes || null,
    last_movement_date: item.lastMovementDate ? new Date(item.lastMovementDate).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
}

export function mapSupabaseToItem(row: any): ItemMaster {
  return {
    id: row.id,
    name: row.name,
    itemType: row.item_type || 'FOOD_CARRYING_STOCK',
    category: row.category || 'Sembako',
    subcategory: row.subcategory || undefined,
    baseUnit: row.base_unit || 'Kg',
    minimumStock: Number(row.minimum_stock) || 0,
    reorderPoint: Number(row.reorder_point) || 0,
    currentStock: Number(row.current_stock) || 0,
    estimatedPrice: row.estimated_price !== null && row.estimated_price !== undefined && Number(row.estimated_price) > 0
      ? Number(row.estimated_price)
      : undefined,
    location: row.location_id || 'Gudang Utama',
    expiryTrackingEnabled: Boolean(row.expiry_tracking_enabled),
    isActive: Boolean(row.is_active),
    notes: row.notes || undefined,
    lastMovementDate: row.last_movement_date ? String(row.last_movement_date).slice(0, 10) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSupplierToSupabase(s: Supplier) {
  return {
    id: s.id,
    name: s.name,
    contact_person: s.contactPerson || '',
    phone: s.phone || '',
    address: s.address || '',
    supply_category: s.supplyCategory || 'Umum',
    is_active: s.isActive !== false,
    notes: s.notes || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapSupabaseToSupplier(row: any): Supplier {
  return {
    id: row.id,
    name: row.name,
    contactPerson: row.contact_person || '',
    phone: row.phone || '',
    address: row.address || '',
    supplyCategory: row.supply_category || 'Umum',
    isActive: Boolean(row.is_active),
    notes: row.notes || undefined,
  };
}

// Kolom penaut PO (menu asal, penerimaan, belanja, supplier). Ditambahkan migrasi 20261023000000;
// sebelum migrasi dijalankan, PO tetap disimpan tanpa kolom ini (lihat upsertPurchaseOrderRow).
let poLinkColumnsMissing = false;

function poLinkColumns(po: PurchaseOrderNota) {
  return {
    supplier_id: po.supplierId || null,
    supplier_address: po.supplierAddress || null,
    supplier_contact: po.supplierContact || null,
    delivery_terms: po.deliveryTerms || null,
    delivery_time: po.deliveryTime || null,
    related_menu_order_id: po.relatedMenuOrderId || null,
    related_receiving_id: po.relatedReceivingId || null,
    related_expense_ids: po.relatedExpenseIds && po.relatedExpenseIds.length > 0 ? po.relatedExpenseIds : null,
  };
}

// Baris dari Supabase tidak memuat semua isian PO (mis. diskon, terbilang, atau tautan bila migrasi belum
// dijalankan). Pantulan realtime dari simpanan sendiri tidak boleh menghapus isian yang ada di perangkat ini.
export function mergePoKeepingLocalFields(local: PurchaseOrderNota, fromCloud: PurchaseOrderNota): PurchaseOrderNota {
  const merged: PurchaseOrderNota = { ...local, ...fromCloud };
  (Object.keys(local) as (keyof PurchaseOrderNota)[]).forEach(key => {
    if (fromCloud[key] === undefined || fromCloud[key] === '') (merged as any)[key] = local[key];
  });
  return merged;
}

/** Simpan PO ke Supabase. Bila kolom penaut belum ada (migrasi belum dijalankan), ulangi tanpa kolom itu. */
export async function upsertPurchaseOrderRow(po: PurchaseOrderNota): Promise<{ error: any }> {
  if (!poLinkColumnsMissing) {
    const res = await supabase.from('purchase_orders').upsert({ ...mapPoToSupabase(po), ...poLinkColumns(po) });
    const missingColumn = res.error && (res.error.code === 'PGRST204' || /column/i.test(res.error.message || ''));
    if (!missingColumn) return res;
    poLinkColumnsMissing = true;
    console.warn(
      'Kolom penaut PO belum ada di Supabase. Jalankan migrasi 20261023000000_purchase_orders_links.sql supaya PO tidak kehilangan tautan menu dan penerimaan.'
    );
  }
  return supabase.from('purchase_orders').upsert(mapPoToSupabase(po));
}

export function mapPoToSupabase(po: PurchaseOrderNota) {
  return {
    id: po.id,
    po_number: po.poNumber,
    date: po.date || localDateIso(),
    delivery_date: po.deliveryDate || po.date,
    supplier_name: po.supplierName,
    status: po.status || 'DRAFT',
    items: po.items || [],
    subtotal: Number(po.subtotal) || 0,
    shipping_cost: Number(po.shippingCost) || 0,
    grand_total: Number(po.grandTotal) || 0,
    payment_method: po.paymentMethod || 'Tempo',
    notes: po.notes || null,
    created_by: po.createdBy || null,
    approved_by: po.approvedBy || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapSupabaseToPo(row: any): PurchaseOrderNota {
  return {
    id: row.id,
    poNumber: row.po_number,
    date: row.date,
    deliveryDate: row.delivery_date || row.date,
    supplierId: row.supplier_id || undefined,
    supplierName: row.supplier_name,
    supplierAddress: row.supplier_address || undefined,
    supplierContact: row.supplier_contact || undefined,
    deliveryTerms: row.delivery_terms || undefined,
    deliveryTime: row.delivery_time || undefined,
    relatedMenuOrderId: row.related_menu_order_id || undefined,
    relatedReceivingId: row.related_receiving_id || undefined,
    relatedExpenseIds: Array.isArray(row.related_expense_ids) && row.related_expense_ids.length > 0 ? row.related_expense_ids : undefined,
    status: row.status as any,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal) || 0,
    shippingCost: Number(row.shipping_cost) || 0,
    discount: Number(row.discount) || 0,
    tax: Number(row.tax) || 0,
    grandTotal: Number(row.grand_total) || 0,
    terbilang: row.terbilang || '',
    paymentMethod: row.payment_method || 'Tempo',
    notes: row.notes || '',
    createdBy: row.created_by || undefined,
    approvedBy: row.approved_by || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const WASTE_NUTRITION_CATEGORIES = new Set(['karbohidrat', 'sayur', 'protein hewani', 'protein nabati', 'buah']);

const WASTE_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function wasteDayName(date: string): string {
  const [y, m, d] = (date || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  return WASTE_DAY_NAMES[new Date(y, m - 1, d).getDay()] || '';
}

// Tabel waste_logs tidak punya kolom hari; hari dihitung ulang dari tanggal.
export function mapWasteToSupabase(w: WasteLog) {
  return {
    id: w.id,
    date: w.date,
    waste_category: w.wasteCategory,
    item_name: w.itemName || w.wasteCategory,
    quantity: Number(w.quantity) || 0,
    unit: w.unit || 'Kg',
    source_area: w.sourceArea || '-',
    reason: w.reason || '-',
    disposal_method: w.disposalMethod,
    recorded_by: w.recordedBy || '-',
    notes: w.notes || null,
    created_at: w.createdAt || new Date().toISOString(),
  };
}

export function mapSupabaseToWaste(row: any): WasteLog {
  return {
    id: row.id,
    day: wasteDayName(row.date),
    date: row.date,
    wasteCategory: row.waste_category,
    itemName: row.item_name || undefined,
    quantity: Number(row.quantity) || 0,
    unit: row.unit || 'Kg',
    sourceArea: row.source_area || '',
    reason: row.reason && row.reason !== '-' ? row.reason : undefined,
    disposalMethod: row.disposal_method,
    recordedBy: row.recorded_by || '',
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

export function mapExpenseToSupabase(e: NonFoodExpense) {
  return {
    id: e.id,
    date: e.date || localDateIso(),
    category: e.category,
    description: e.itemName || 'Pengeluaran Non-Food',
    nominal: Number(e.totalCost || 0),
    pic: e.pic || 'Akmal',
    item_name: e.itemName,
    quantity: typeof e.quantity === 'number' ? e.quantity : parseFloat(String(e.quantity)) || 1,
    unit: e.unit || '',
    unit_price: Number(e.unitPrice || 0),
    total_cost: Number(e.totalCost || 0),
    department: e.department || '',
    time: e.time || '',
    volunteer: e.volunteer || '',
    notes: e.notes || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapSupabaseToExpense(row: any): NonFoodExpense {
  return {
    id: row.id,
    date: row.date,
    itemName: row.item_name || row.description || '',
    category: row.category as any,
    quantity: row.quantity !== null ? Number(row.quantity) : 1,
    unit: row.unit || '',
    unitPrice: Number(row.unit_price) || 0,
    totalCost: Number(row.total_cost) || Number(row.nominal) || 0,
    department: row.department as any,
    time: row.time || '',
    volunteer: row.volunteer || '',
    pic: row.pic,
    notes: row.notes || undefined,
    createdAt: row.created_at,
  };
}

export function mapReceivingToSupabase(doc: ReceivingDocument) {
  return {
    id: doc.id,
    date: doc.date || localDateIso(),
    arrival_time: toClock(doc.arrivalTime),
    supplier_id: doc.supplierId,
    supplier_name: doc.supplierName || null,
    delivery_note_no: doc.deliveryNoteNo || null,
    receiver_id: doc.receiverId || 'USR-003',
    receiver_name: doc.receiverName || 'Akmal',
    receiver_role: doc.receiverRole || 'ADMIN',
    status: doc.status || 'VERIFIED_POSTED',
    notes: doc.notes || null,
    supplier_signature: doc.supplierSignature || null,
    receiver_signature: doc.receiverSignature || null,
    documentation_photos: doc.documentationPhotos || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapLineToSupabase(line: any, docId: string) {
  return {
    id: line.id || `GRL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    document_id: docId,
    item_id: line.itemId,
    item_name: line.itemName,
    category: line.category,
    quantity: Number(line.quantity) || 1,
    unit: line.unit,
    condition_note: line.conditionNote || null,
    batch_number: line.batchNumber || null,
    expiry_date: line.expiryDate || null,
  };
}

export function mapTxToSupabase(tx: InventoryTransaction) {
  return {
    id: tx.id,
    timestamp: tx.timestamp ? localTsToIso(tx.timestamp) : new Date().toISOString(),
    item_id: tx.itemId,
    item_name: tx.itemName,
    item_type: tx.itemType,
    category: tx.category,
    location_id: tx.location || 'Gudang Utama',
    quantity: Number(tx.quantity) || 0,
    unit: tx.unit,
    transaction_type: tx.transactionType,
    reference_document: tx.referenceDocument,
    user_id: tx.userId || 'USR-003',
    user_name: tx.userName || 'Akmal',
    user_role: tx.userRole || 'ADMIN',
    balance_after: Number(tx.balanceAfter) || 0,
    notes: tx.notes || null,
  };
}

// ------------------------------------------------------------------------------
// Pemetaan kolom untuk data yang disinkronkan lewat migrasi 20261017000000:
// karyawan, absensi, penerima manfaat, riwayat aktivitas, stok opname, tugas harian.
// ------------------------------------------------------------------------------

// Timestamp lokal "YYYY-MM-DD HH:mm" -> ISO untuk kolom TIMESTAMPTZ (dan sebaliknya saat dimuat).
// Jam bergaya Indonesia ("08.30") juga diterima: new Date() menolaknya dan toISOString() lalu
// melempar "Invalid time value".
const localTsToIso = (ts: string): string => {
  const d = new Date((ts || '').trim().replace(' ', 'T').replace(/T(\d{1,2})\.(\d{2})/, (_, h, m) => `T${h.padStart(2, '0')}:${m}`));
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

// ID unik untuk baris baru. Enam digit terakhir jam (cara lama) berulang tiap sekitar 16 menit,
// sehingga upsert ke Supabase diam-diam menimpa baris lama yang ID-nya sama.
let idSeq = 0;
const uniqueId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${String(idSeq++ % 1000).padStart(3, '0')}${Math.floor(Math.random() * 10)}`;

/** Jam "HH:mm" untuk kolom TIME; "8.30", "08.30", dan "08:30" diterima, selain itu jam sekarang. */
const toClock = (time?: string): string => {
  const m = (time || '').trim().match(/^(\d{1,2})[.:](\d{2})/);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return `${m[1].padStart(2, '0')}:${m[2]}`;
  return localTimestamp().slice(11);
};
const isoToLocalTs = (iso: string): string => (iso ? localTimestamp(new Date(iso)) : '');

export function mapEmployeeToSupabase(e: Employee) {
  return {
    id: e.id,
    name: e.name,
    nik: e.nik || null,
    nip: e.nip || null,
    gender: e.gender,
    phone: e.phone || null,
    department: e.department,
    position: e.position,
    employment_type: e.employmentType,
    shift: e.shift,
    join_date: e.joinDate || null,
    status: e.status,
    is_active: e.status !== 'NONAKTIF',
    address: e.address || null,
    emergency_contact: e.emergencyContact || null,
    avatar_url: e.avatarUrl || null,
    notes: e.notes || null,
    updated_at: new Date().toISOString(),
  };
}

export function mapSupabaseToEmployee(r: any): Employee {
  return {
    id: r.id,
    nik: r.nik || '',
    nip: r.nip || '',
    name: r.name || '',
    gender: r.gender === 'P' ? 'P' : 'L',
    phone: r.phone || '',
    department: r.department || 'Manajemen & Administrasi',
    position: r.position || '',
    employmentType: r.employment_type || 'Tetap',
    shift: r.shift || 'Pagi (05:00 - 13:00)',
    joinDate: r.join_date || '',
    status: r.status || (r.is_active === false ? 'NONAKTIF' : 'AKTIF'),
    address: r.address || '',
    emergencyContact: r.emergency_contact || '',
    avatarUrl: r.avatar_url || undefined,
    notes: r.notes || undefined,
  };
}

/** Kolom absensi yang dimuat saat sinkron; photo_url sengaja tidak ikut (bisa puluhan KB per baris). */
export const ATTENDANCE_COLUMNS =
  'id,date,employee_id,employee_name,department,position,shift,check_in_time,check_out_time,status,late_minutes,notes,recorded_by,verified,created_at';

/** Foto absen dihapus otomatis setelah sekian hari; jam masuk/pulang dan status tetap disimpan. */
export const ATTENDANCE_PHOTO_RETENTION_DAYS = 60;

export function mapAttendanceToSupabase(a: EmployeeAttendance) {
  return {
    id: a.id,
    date: a.date,
    employee_id: a.employeeId,
    employee_name: a.employeeName,
    department: a.department,
    position: a.position,
    shift: a.shift,
    check_in_time: a.checkInTime || null,
    check_out_time: a.checkOutTime || null,
    status: a.status,
    late_minutes: a.lateMinutes || 0,
    // Foto tidak ikut dimuat saat sinkron (lihat ATTENDANCE_COLUMNS), jadi hanya dikirim bila memang ada di
    // catatan ini. Tanpa ini, menyimpan ulang catatan (mis. absen pulang) akan menghapus foto di database.
    ...(a.photoUrl !== undefined ? { photo_url: a.photoUrl || null } : {}),
    notes: a.notes || null,
    recorded_by: a.recordedBy,
    verified: !!a.verified,
    created_at: a.createdAt,
    updated_at: new Date().toISOString(),
  };
}

export function mapSupabaseToAttendance(r: any): EmployeeAttendance {
  return {
    id: r.id,
    date: r.date,
    employeeId: r.employee_id,
    employeeName: r.employee_name || '',
    department: r.department || 'Manajemen & Administrasi',
    position: r.position || '',
    shift: r.shift || 'Pagi (05:00 - 13:00)',
    checkInTime: r.check_in_time || '',
    checkOutTime: r.check_out_time || '',
    status: r.status,
    lateMinutes: Number(r.late_minutes) || 0,
    photoUrl: r.photo_url || undefined,
    notes: r.notes || undefined,
    recordedBy: r.recorded_by || '',
    verified: !!r.verified,
    createdAt: r.created_at || new Date().toISOString(),
  };
}

// Order menu disimpan utuh di kolom `data`; kolom lain untuk kueri & view website publik.
export function mapMenuOrderToSupabase(o: MenuOrder) {
  return {
    id: o.id,
    date: o.date,
    meal_session: o.mealSession,
    menu_title: o.menuTitle,
    menu_description: o.menuDescription || null,
    target_portions: o.targetPortions || 0,
    status: o.status,
    key_ingredients: o.keyIngredients || [],
    chef_in_charge: o.chefInCharge || null,
    notes: o.notes || null,
    created_at: o.createdAt || new Date().toISOString(),
    data: o,
  };
}

export function mapSupabaseToMenuOrder(m: any): MenuOrder {
  if (m.data && typeof m.data === 'object') return { ...(m.data as MenuOrder), id: m.id };
  // Baris lama (sebelum kolom data ada)
  return {
    id: m.id,
    date: m.date,
    mealSession: m.meal_session || 'Siang',
    menuTitle: m.menu_title || m.menu_name || 'Menu SPPG',
    menuDescription: m.menu_description || undefined,
    targetPortions: Number(m.target_portions) || 0,
    status: m.status || 'PLANNED',
    keyIngredients: Array.isArray(m.key_ingredients) ? m.key_ingredients : [],
    poArrivalItems: Array.isArray(m.po_arrival_items) ? m.po_arrival_items : [],
    chefInCharge: m.chef_in_charge || undefined,
    notes: m.notes || undefined,
    createdAt: m.created_at || new Date().toISOString(),
  };
}

export function mapBeneficiaryToSupabase(b: SchoolBeneficiaryAllocation) {
  return {
    id: b.id,
    school_name: b.schoolName,
    category: b.category,
    portion_count: b.portionCount,
    delivery_time: b.deliveryTime || null,
    contact_person: b.contactPerson || null,
    phone: b.phone || null,
    status: b.status || null,
    notes: b.notes || null,
  };
}

export function mapSupabaseToBeneficiary(r: any): SchoolBeneficiaryAllocation {
  return {
    id: r.id,
    schoolName: r.school_name || '',
    category: r.category || '',
    portionCount: Number(r.portion_count ?? r.student_count) || 0,
    deliveryTime: r.delivery_time || undefined,
    contactPerson: r.contact_person || undefined,
    phone: r.phone || undefined,
    status: r.status || undefined,
    notes: r.notes || undefined,
  };
}

export function mapAuditToSupabase(l: AuditLog) {
  return {
    id: l.id,
    timestamp: localTsToIso(l.timestamp),
    user_id: l.userId,
    user_name: l.userName,
    user_role: l.userRole,
    action: l.action,
    entity: l.entity,
    entity_id: l.entityId || '-',
    details: l.details,
  };
}

export function mapSupabaseToAudit(r: any): AuditLog {
  return {
    id: r.id,
    timestamp: isoToLocalTs(r.timestamp),
    userId: r.user_id,
    userName: r.user_name,
    userRole: r.user_role,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    details: typeof r.details === 'string' ? r.details : JSON.stringify(r.details),
  };
}

export function mapOpnameToSupabase(o: StockOpnameSession) {
  return {
    id: o.id,
    date: o.date,
    location: o.location,
    created_by_id: o.createdById,
    created_by_name: o.createdByName,
    status: o.status,
    approved_by_id: o.approvedById || null,
    approved_by_name: o.approvedByName || null,
    approved_at: o.approvedAt ? localTsToIso(o.approvedAt) : null,
    notes: o.notes || null,
    created_at: o.createdAt,
    updated_at: new Date().toISOString(),
  };
}

export function mapOpnameItemsToSupabase(o: StockOpnameSession) {
  return o.items.map(i => ({
    id: i.id,
    session_id: o.id,
    item_id: i.itemId,
    item_name: i.itemName,
    category: i.category,
    unit: i.unit,
    system_stock: i.systemStock,
    physical_count: i.physicalCount,
    variance: i.variance,
    reason: i.reason,
  }));
}

export function mapSupabaseToOpname(r: any): StockOpnameSession {
  return {
    id: r.id,
    date: r.date,
    location: r.location || r.location_id || '',
    createdById: r.created_by_id || '',
    createdByName: r.created_by_name || '',
    status: r.status,
    approvedById: r.approved_by_id || undefined,
    approvedByName: r.approved_by_name || undefined,
    approvedAt: r.approved_at ? isoToLocalTs(r.approved_at) : undefined,
    notes: r.notes || undefined,
    createdAt: r.created_at,
    items: Array.isArray(r.stock_opname_items)
      ? r.stock_opname_items.map((i: any) => ({
          id: i.id,
          itemId: i.item_id,
          itemName: i.item_name,
          category: i.category,
          unit: i.unit,
          systemStock: Number(i.system_stock) || 0,
          physicalCount: Number(i.physical_count) || 0,
          variance: Number(i.variance) || 0,
          reason: i.reason || '',
        }))
      : [],
  };
}

export function mapTodoToSupabase(t: DailyTodoItem) {
  return {
    id: t.id,
    date: t.date,
    title: t.title,
    category: t.category,
    priority: t.priority,
    session: t.session || null,
    target_time: t.targetTime || null,
    is_completed: t.isCompleted,
    completed_at: t.completedAt || null,
    completed_by: t.completedBy || null,
    assigned_role: t.assignedRole || null,
    assigned_user_id: t.assignedUserId || null,
    assigned_user_name: t.assignedUserName || null,
    notes: t.notes || null,
    created_at: t.createdAt,
  };
}

export function mapSupabaseToTodo(r: any): DailyTodoItem {
  return {
    id: r.id,
    date: r.date,
    title: r.title,
    category: r.category,
    priority: r.priority,
    session: r.session || undefined,
    targetTime: r.target_time || undefined,
    isCompleted: !!r.is_completed,
    completedAt: r.completed_at || undefined,
    completedBy: r.completed_by || undefined,
    assignedRole: r.assigned_role || undefined,
    assignedUserId: r.assigned_user_id || undefined,
    assignedUserName: r.assigned_user_name || undefined,
    notes: r.notes || undefined,
    createdAt: r.created_at,
  };
}

export function purgeLocalStorageOperationalData(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const OPERATIONAL_STORAGE_KEYS = [
    STORAGE_KEYS.ITEMS,
    STORAGE_KEYS.SUPPLIERS,
    STORAGE_KEYS.RECEIVINGS,
    STORAGE_KEYS.TRANSACTIONS,
    STORAGE_KEYS.EQUIPMENT,
    // OPNAMES & AUDIT_LOGS sengaja tidak dihapus: riwayat aktivitas harus bertahan setelah halaman dimuat ulang.
    STORAGE_KEYS.NONFOOD_EXPENSES,
    STORAGE_KEYS.PURCHASE_ORDERS,
    STORAGE_KEYS.MENU_ORDERS,
    STORAGE_KEYS.WASTE_LOGS,
    // BENEFICIARIES tidak dihapus: tersimpan di cloud dan di-cache lokal.
    'sppg_master_items_cleared_v2',
    'sppg_transactions_cleared_v1',
    'sppg_clean_real_suppliers_v3',
    'sppg_auto_clean_transactions_20261001',
    'sppg_items',
    'sppg_receivings',
    'sppg_transactions',
    'sppg_suppliers',
  ];
  OPERATIONAL_STORAGE_KEYS.forEach(k => {
    try {
      localStorage.removeItem(k);
    } catch {}
  });
}

export type SignerRole = 'KEPALA_SPPG' | 'AHLI_GIZI' | 'AKUNTAN' | 'KOORDINATOR' | 'ASLAP';

const SIGNER_POSITIONS: Record<SignerRole, RegExp> = {
  KEPALA_SPPG: /kepala\s+sppg/i,
  AHLI_GIZI: /ahli\s+gizi/i,
  AKUNTAN: /akuntan/i,
  KOORDINATOR: /koordinator/i,
  ASLAP: /asisten\s+lapangan/i,
};

class WarehouseDatabase {
  private items: ItemMaster[] = [];
  private suppliers: Supplier[] = [];
  private receivings: ReceivingDocument[] = [];
  private transactions: InventoryTransaction[] = [];
  private opnames: StockOpnameSession[] = [];
  private equipment: EquipmentItem[] = [];
  private auditLogs: AuditLog[] = [];
  private nonFoodExpenses: NonFoodExpense[] = [];
  private menuOrders: MenuOrder[] = [];
  private wasteLogs: WasteLog[] = [];
  private todos: DailyTodoItem[] = [];
  private employees: Employee[] = [];
  private attendanceLogs: EmployeeAttendance[] = [];
  private users: User[] = [];
  private appSettings: Record<string, unknown> = {};
  private purchaseOrders: PurchaseOrderNota[] = [];
  private schoolBeneficiaries: SchoolBeneficiaryAllocation[] = [];
  private isCloudInitialized = false;
  private realtimeChannel: any = null;

  constructor() {
    // 1. Bersihkan seluruh data operasional dari localStorage sesuai instruksi
    purgeLocalStorageOperationalData();

    // 2. Akun & Otentikasi (tetap dipertahankan untuk login lokal)
    this.users = getStored<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    this.users = this.users.filter(u => !LEGACY_DUMMY_LOGINS.includes(u.email.toLowerCase()) || INITIAL_USERS.some(i => i.id === u.id));
    INITIAL_USERS.forEach(initUser => {
      const idx = this.users.findIndex(u => u.id === initUser.id || u.email.toLowerCase() === initUser.email.toLowerCase());
      if (idx >= 0) {
        // Akun dummy lama ber-ID sama diganti seluruhnya (tidak membawa NIP/HP dummy).
        const wasLegacy = LEGACY_DUMMY_LOGINS.includes(this.users[idx].email.toLowerCase());
        // Akun asli: perubahan nama/peran/email dari Profil atau Kelola Akun dipertahankan.
        this.users[idx] = wasLegacy
          ? { ...initUser }
          : { ...initUser, ...this.users[idx], employeeId: this.users[idx].employeeId || initUser.employeeId };
      } else {
        this.users.push(initUser);
      }
    });
    // Versi lama menyimpan kata sandi di objek akun; kata sandi hanya boleh ada di penyimpanan sandi.
    this.users = this.users.map(u => {
      const { password: _pw, ...rest } = u as User & { password?: string };
      return rest;
    });
    setStored(STORAGE_KEYS.USERS, this.users);

    const passwords = getStored<Record<string, string>>('sppg_user_passwords_v1', {});
    LEGACY_DUMMY_LOGINS.forEach(k => delete passwords[k]);
    // Kata sandi awal hanya dipasang jika belum pernah diganti petugas.
    Object.entries(INITIAL_PASSWORDS).forEach(([email, pw]) => {
      passwords[email] = passwords[email] || pw;
    });
    setStored('sppg_user_passwords_v1', passwords);

    // 3. Fallback in-memory arrays sebelum data live dari Supabase Cloud selesai dimuat
    this.items = [];
    this.suppliers = [...INITIAL_SUPPLIERS];
    this.receivings = [];
    this.transactions = [];
    this.opnames = getStored<StockOpnameSession[]>(STORAGE_KEYS.OPNAMES, []);
    this.equipment = [...INITIAL_EQUIPMENT];
    this.auditLogs = getStored<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, []);
    this.nonFoodExpenses = [];
    this.purchaseOrders = [];
    this.menuOrders = [];
    this.wasteLogs = [];
    // Tugas harian dibuat per tanggal oleh getDailyTodos. Tugas lama yang masih memakai ID template
    // (sama setiap hari) diberi akhiran tanggal agar tidak saling menimpa di database.
    const templateIds = new Set(INITIAL_TODOS.map(t => t.id));
    const loadedTodos = getStored<DailyTodoItem[]>(STORAGE_KEYS.TODOS, []);
    this.todos = loadedTodos.map(t => (templateIds.has(t.id) ? { ...t, id: `${t.id}-${t.date}` } : t)).map(t => {
      if (t.title.toLowerCase().includes('chiller') || t.title.toLowerCase().includes('cold storage')) {
        return {
          ...t,
          title: 'Pemeriksaan kebersihan dan kesiapan area penyimpanan bahan',
          notes: 'Area penyimpanan bersih, higienis, dan siap untuk operasional.',
        };
      }
      return t;
    });
    setStored(STORAGE_KEYS.TODOS, this.todos);
    // Sebelumnya karyawan & absensi selalu di-reset ke data contoh setiap halaman dimuat,
    // sehingga data yang dicatat hilang. Sekarang dibaca dari penyimpanan; data contoh lama
    // (18 karyawan dummy) dibuang sekali lewat penanda migrasi.
    const EMPLOYEE_MIGRATION_FLAG = 'sppg_employees_real_v2';
    if (localStorage.getItem(EMPLOYEE_MIGRATION_FLAG) !== 'done') {
      setStored(STORAGE_KEYS.EMPLOYEES, REAL_EMPLOYEES);
      setStored(STORAGE_KEYS.ATTENDANCE, REAL_ATTENDANCE_LOGS);
      localStorage.setItem(EMPLOYEE_MIGRATION_FLAG, 'done');
    }
    this.employees = getStored<Employee[]>(STORAGE_KEYS.EMPLOYEES, [...REAL_EMPLOYEES]);
    this.attendanceLogs = getStored<EmployeeAttendance[]>(STORAGE_KEYS.ATTENDANCE, [...REAL_ATTENDANCE_LOGS]);
    this.schoolBeneficiaries = getStored<SchoolBeneficiaryAllocation[]>(STORAGE_KEYS.BENEFICIARIES, [...DEFAULT_SCHOOL_BENEFICIARIES]);
    this.appSettings = getStored<Record<string, unknown>>(STORAGE_KEYS.APP_SETTINGS, {});
    LEGACY_SETTING_KEYS.forEach(([legacyKey, key]) => {
      if (this.appSettings[key] !== undefined) return;
      try {
        const raw = localStorage.getItem(legacyKey);
        if (raw) this.appSettings[key] = JSON.parse(raw);
      } catch {
        // data lama rusak: abaikan, pengguna mengisi ulang
      }
    });
    setStored(STORAGE_KEYS.APP_SETTINGS, this.appSettings);

    // 4. Inisialisasi Cloud Supabase & Realtime Subscription
    this.initCloudAndRealtime();
  }

  // Tulis ke Supabase tanpa menunggu; kegagalan dilaporkan ke layar, data tetap ada di cache lokal.
  private pushCloud(label: string, run: () => PromiseLike<{ error: any }>): void {
    if (!isSupabaseConfigured()) return;
    run().then(({ error }) => {
      if (error) reportCloudWriteError(label, error);
    });
  }

  /**
   * Kirim berurutan dan berhenti di langkah pertama yang gagal. Rincian penerimaan dan mutasinya
   * merujuk dokumen induk, jadi tidak boleh tiba di server sebelum dokumennya tersimpan.
   */
  private pushCloudSequence(steps: Array<[label: string, run: () => PromiseLike<{ error: any }>]>): void {
    if (!isSupabaseConfigured()) return;
    void (async () => {
      for (const [label, run] of steps) {
        const { error } = await run();
        if (error) {
          reportCloudWriteError(label, error);
          return;
        }
      }
    })();
  }

  /** Nomor GR berikutnya dari nomor terbesar tahun ini; "jumlah + 1" bentrok setelah ada yang dihapus. */
  private nextReceivingId(): string {
    const year = new Date().getFullYear();
    const pattern = new RegExp(`^GR-${year}-(\\d+)$`);
    const max = this.receivings.reduce((m, r) => {
      const hit = r.id.match(pattern);
      return hit ? Math.max(m, Number(hit[1])) : m;
    }, 0);
    return `GR-${year}-${String(max + 1).padStart(4, '0')}`;
  }

  private async initCloudAndRealtime(): Promise<void> {
    if (this.isCloudInitialized) return;
    this.isCloudInitialized = true;

    if (!isSupabaseConfigured()) {
      console.warn('Supabase credentials belum terkonfigurasi. Berjalan dalam in-memory mode.');
      return;
    }

    await this.loadFromSupabase();
    this.initRealtimeSubscriptions();
  }

  public async loadFromSupabase(): Promise<void> {
    try {
      // 1. Master Barang
      const { data: dbItems, error: itemsErr } = await supabase
        .from('item_master')
        .select('*')
        .order('name', { ascending: true });
      if (!itemsErr && dbItems) {
        this.items = dbItems.map(mapSupabaseToItem);
      }

      // 2. Master Rekanan Supplier
      const { data: dbSuppliers, error: supErr } = await supabase
        .from('suppliers')
        .select('*')
        .order('id', { ascending: true });
      if (!supErr && dbSuppliers && dbSuppliers.length > 0) {
        this.suppliers = dbSuppliers.map(mapSupabaseToSupplier);
      }

      // 3. Nota Pesanan / Purchase Orders
      const { data: dbPos, error: poErr } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('date', { ascending: false });
      if (!poErr && dbPos) {
        this.purchaseOrders = dbPos.map(mapSupabaseToPo);
      }

      // 4. Pengeluaran Belanja / Non-Food Expenses
      const { data: dbExpenses, error: expErr } = await supabase
        .from('non_food_expenses')
        .select('*')
        .order('date', { ascending: false });
      if (!expErr && dbExpenses) {
        this.nonFoodExpenses = dbExpenses.map(mapSupabaseToExpense);
      }

      // 5. Dokumen Penerimaan Barang (Receiving Documents) & Detail Baris
      const { data: dbReceivings, error: recErr } = await supabase
        .from('receiving_documents')
        .select('*, receiving_lines(*)')
        .order('date', { ascending: false });
      if (!recErr && dbReceivings) {
        this.receivings = dbReceivings.map((row: any) => ({
          id: row.id,
          date: row.date,
          arrivalTime: row.arrival_time,
          supplierId: row.supplier_id,
          supplierName: row.supplier_name || '',
          deliveryNoteNo: row.delivery_note_no || '',
          receiverId: row.receiver_id || 'USR-003',
          receiverName: row.receiver_name || 'Akmal',
          receiverRole: row.receiver_role || 'ADMIN',
          status: row.status || 'VERIFIED_POSTED',
          notes: row.notes || undefined,
          supplierSignature: row.supplier_signature || undefined,
          receiverSignature: row.receiver_signature || undefined,
          documentationPhotos: row.documentation_photos || undefined,
          createdAt: row.created_at,
          lines: Array.isArray(row.receiving_lines)
            ? row.receiving_lines.map((l: any) => ({
                id: l.id,
                itemId: l.item_id,
                itemName: l.item_name,
                category: l.category,
                quantity: Number(l.quantity) || 1,
                unit: l.unit,
                conditionNote: l.condition_note || undefined,
                batchNumber: l.batch_number || undefined,
                expiryDate: l.expiry_date || undefined,
              }))
            : [],
        }));
      }

      // 6. Buku Kas Masuk/Keluar Logistik (Inventory Transactions)
      const { data: dbTxs, error: txErr } = await supabase
        .from('inventory_transactions')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(500);
      if (!txErr && dbTxs) {
        this.transactions = dbTxs.map((row: any) => ({
          id: row.id,
          timestamp: row.timestamp ? localTimestamp(new Date(row.timestamp)) : '',
          itemId: row.item_id,
          itemName: row.item_name,
          itemType: row.item_type,
          category: row.category,
          location: row.location_id,
          quantity: Number(row.quantity),
          unit: row.unit,
          transactionType: row.transaction_type,
          referenceDocument: row.reference_document,
          userId: row.user_id,
          userName: row.user_name,
          userRole: row.user_role,
          balanceAfter: Number(row.balance_after),
          notes: row.notes || undefined,
        }));
      }

      // 7. Inventaris Alat & Perlengkapan
      const { data: dbEq, error: eqErr } = await supabase
        .from('equipment_items')
        .select('*');
      if (!eqErr && dbEq && dbEq.length > 0) {
        this.equipment = dbEq.map((e: any) => ({
          id: e.id,
          name: e.name,
          category: e.category,
          quantity: Number(e.quantity) || 1,
          unit: e.unit || 'Unit',
          condition: e.condition,
          status: e.status,
          location: e.location_id,
          lastInspectedDate: e.last_inspected_date || localDateIso(),
          notes: e.notes || undefined,
        }));
      }

      // 9. Rekap Limbah
      const { data: dbWaste, error: wasteErr } = await supabase
        .from('waste_logs')
        .select('*')
        .order('date', { ascending: false });
      if (wasteErr) {
        console.error('Supabase waste_logs load error:', wasteErr);
      } else if (dbWaste) {
        this.wasteLogs = dbWaste.map(mapSupabaseToWaste);
      }

      // 10. Karyawan, absensi, penerima manfaat, opname, tugas harian, riwayat aktivitas
      await this.loadSyncedTables(true);

      // Beritahu seluruh komponen bahwa data cloud telah siap
      this.notifyAllChanged();
    } catch (err) {
      console.error('Gagal mengambil data operasional dari Supabase Cloud:', err);
    }
  }

  // Cloud adalah sumber utama. Jika tabel cloud masih kosong tetapi browser punya data
  // (data lama sebelum sinkronisasi), data browser diunggah sekali agar tidak hilang.
  private async loadOrSeed<T>(opts: {
    table: string;
    fetch: () => PromiseLike<{ data: any[] | null; error: any }>;
    fromRow: (row: any) => T;
    toRows: (items: T[]) => any[];
    getLocal: () => T[];
    setLocal: (items: T[]) => void;
    seed: boolean;
  }): Promise<void> {
    const { data, error } = await opts.fetch();
    if (error) {
      console.error(`Supabase ${opts.table} gagal dimuat (sudah menjalankan migrasi 20261017000000?):`, error.message);
      return;
    }
    if (data && data.length > 0) {
      opts.setLocal(data.map(opts.fromRow));
    } else if (opts.seed && opts.getLocal().length > 0) {
      const rows = opts.toRows(opts.getLocal());
      const { error: upErr } = await supabase.from(opts.table).upsert(rows);
      if (upErr) console.error(`Supabase ${opts.table} gagal diunggah:`, upErr.message);
    }
  }

  private async loadSyncedTables(seed: boolean): Promise<void> {
    // Order menu hanya disimpan di cloud (tidak di-cache browser), jadi cloud selalu menjadi sumbernya.
    const { data: dbMenus, error: menuErr } = await supabase
      .from('menu_orders')
      .select('*')
      .order('date', { ascending: false });
    if (menuErr) {
      console.error('Supabase menu_orders gagal dimuat (sudah menjalankan migrasi 20261018000001?):', menuErr.message);
    } else {
      this.menuOrders = (dbMenus || []).map(mapSupabaseToMenuOrder);
    }

    await this.loadOrSeed<Employee>({
      table: 'employees',
      fetch: () => supabase.from('employees').select('*').order('id'),
      fromRow: mapSupabaseToEmployee,
      toRows: list => list.map(mapEmployeeToSupabase),
      getLocal: () => this.employees,
      setLocal: list => {
        this.employees = list;
        setStored(STORAGE_KEYS.EMPLOYEES, list);
      },
      seed,
    });

    // Absensi: tanpa kolom foto dan hanya 120 hari terakhir, karena dimuat ulang setiap ada yang absen
    // (realtime). Foto diambil saat dibuka (getAttendancePhoto); data lama tetap tersimpan di database.
    const attendanceSince = localDateIso(new Date(Date.now() - 120 * 86400000));
    await this.loadOrSeed<EmployeeAttendance>({
      table: 'attendance_logs',
      fetch: () =>
        supabase
          .from('attendance_logs')
          .select(ATTENDANCE_COLUMNS)
          .gte('date', attendanceSince)
          .order('date', { ascending: false })
          .limit(6000),
      fromRow: mapSupabaseToAttendance,
      toRows: list => list.map(mapAttendanceToSupabase),
      getLocal: () => this.attendanceLogs,
      setLocal: list => {
        this.attendanceLogs = list;
        setStored(STORAGE_KEYS.ATTENDANCE, list);
      },
      seed,
    });

    this.purgeOldAttendancePhotos();

    await this.loadOrSeed<SchoolBeneficiaryAllocation>({
      table: 'school_beneficiaries',
      fetch: () => supabase.from('school_beneficiaries').select('*').order('id'),
      fromRow: mapSupabaseToBeneficiary,
      toRows: list => list.map(mapBeneficiaryToSupabase),
      getLocal: () => this.schoolBeneficiaries,
      setLocal: list => {
        this.schoolBeneficiaries = list;
        setStored(STORAGE_KEYS.BENEFICIARIES, list);
      },
      seed,
    });

    // Tugas harian 60 hari terakhir cukup untuk tampilan; yang lebih lama tetap di database.
    const since = localDateIso(new Date(Date.now() - 60 * 86400000));
    await this.loadOrSeed<DailyTodoItem>({
      table: 'daily_todos',
      fetch: () => supabase.from('daily_todos').select('*').gte('date', since),
      fromRow: mapSupabaseToTodo,
      toRows: list => list.map(mapTodoToSupabase),
      getLocal: () => this.todos,
      setLocal: list => {
        this.todos = list;
        setStored(STORAGE_KEYS.TODOS, list);
      },
      seed,
    });

    // Opname: sesi dan rincian dimuat terpisah lalu digabung.
    const { data: sessions, error: sesErr } = await supabase
      .from('stock_opname_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (sesErr) {
      console.error('Supabase stock_opname_sessions gagal dimuat:', sesErr.message);
    } else if (sessions && sessions.length > 0) {
      const { data: lines } = await supabase.from('stock_opname_items').select('*');
      const bySession = new Map<string, any[]>();
      (lines || []).forEach((l: any) => bySession.set(l.session_id, [...(bySession.get(l.session_id) || []), l]));
      this.opnames = sessions.map((sRow: any) => mapSupabaseToOpname({ ...sRow, stock_opname_items: bySession.get(sRow.id) || [] }));
      setStored(STORAGE_KEYS.OPNAMES, this.opnames);
    } else if (seed && this.opnames.length > 0) {
      this.opnames.forEach(o => this.pushOpname(o));
    }

    // Pengaturan: nilai di cloud menang; kunci yang baru ada di browser ini diunggah.
    const { data: settingRows, error: settingsErr } = await supabase.from('app_settings').select('key, value');
    if (settingsErr) {
      console.error('Supabase app_settings gagal dimuat:', settingsErr.message);
    } else {
      const cloudKeys = new Set((settingRows || []).map((r: any) => r.key as string));
      const merged: Record<string, unknown> = { ...this.appSettings };
      (settingRows || []).forEach((r: any) => { merged[r.key] = r.value; });
      if (seed) {
        const localOnly = Object.keys(this.appSettings).filter(k => !cloudKeys.has(k));
        if (localOnly.length > 0) {
          const { error: upErr } = await supabase
            .from('app_settings')
            .upsert(localOnly.map(k => ({ key: k, value: this.appSettings[k], updated_at: new Date().toISOString() })));
          if (upErr) console.error('Supabase app_settings gagal diunggah:', upErr.message);
        }
      }
      this.appSettings = merged;
      setStored(STORAGE_KEYS.APP_SETTINGS, merged);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(APP_SETTINGS_CHANGED_EVENT));
    }

    // Riwayat aktivitas hanya bertambah: gabungkan cloud + catatan browser yang belum terunggah.
    const { data: cloudLogs, error: auditErr } = await supabase
      .from('audit_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(MAX_AUDIT_LOGS);
    if (auditErr) {
      console.error('Supabase audit_logs gagal dimuat:', auditErr.message);
    } else {
      const cloud = (cloudLogs || []).map(mapSupabaseToAudit);
      const cloudIds = new Set(cloud.map(l => l.id));
      const localOnly = this.auditLogs.filter(l => !cloudIds.has(l.id));
      if (seed && localOnly.length > 0) {
        const { error: upErr } = await supabase.from('audit_logs').insert(localOnly.map(mapAuditToSupabase));
        if (upErr) console.error('Supabase audit_logs gagal diunggah:', upErr.message);
      }
      this.auditLogs = [...cloud, ...localOnly]
        .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
        .slice(0, MAX_AUDIT_LOGS);
      setStored(STORAGE_KEYS.AUDIT_LOGS, this.auditLogs);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sppg_audit_changed'));
    }
  }

  // Perubahan dari perangkat lain: muat ulang (tanpa unggah) dengan jeda singkat agar banyak
  // perubahan beruntun (mis. presensi massal) cukup sekali dimuat.
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshSyncedTables(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(async () => {
      this.refreshTimer = null;
      await this.loadSyncedTables(false);
      this.notifyAllChanged();
    }, 800);
  }

  private initRealtimeSubscriptions(): void {
    if (this.realtimeChannel || !isSupabaseConfigured()) return;

    this.realtimeChannel = supabase
      .channel('sppg_warehouse_realtime_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as { key?: string; value?: unknown };
        if (!row?.key) return;
        const next = { ...this.appSettings };
        if (payload.eventType === 'DELETE') delete next[row.key];
        else next[row.key] = row.value;
        this.appSettings = next;
        setStored(STORAGE_KEYS.APP_SETTINGS, next);
        window.dispatchEvent(new CustomEvent(APP_SETTINGS_CHANGED_EVENT));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_master' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newItem = mapSupabaseToItem(payload.new);
          if (!this.items.some(i => i.id === newItem.id)) {
            this.items.push(newItem);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedItem = mapSupabaseToItem(payload.new);
          const idx = this.items.findIndex(i => i.id === updatedItem.id);
          if (idx >= 0) this.items[idx] = updatedItem;
          else this.items.push(updatedItem);
        } else if (payload.eventType === 'DELETE') {
          const delId = payload.old.id;
          this.items = this.items.filter(i => i.id !== delId);
        }
        this.notifyAllChanged();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const sup = mapSupabaseToSupplier(payload.new);
          const idx = this.suppliers.findIndex(s => s.id === sup.id);
          if (idx >= 0) this.suppliers[idx] = sup;
          else this.suppliers.push(sup);
        } else if (payload.eventType === 'DELETE') {
          this.suppliers = this.suppliers.filter(s => s.id !== payload.old.id);
        }
        this.notifyAllChanged();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const po = mapSupabaseToPo(payload.new);
          const idx = this.purchaseOrders.findIndex(p => p.id === po.id);
          if (idx >= 0) this.purchaseOrders[idx] = mergePoKeepingLocalFields(this.purchaseOrders[idx], po);
          else this.purchaseOrders.unshift(po);
        } else if (payload.eventType === 'DELETE') {
          this.purchaseOrders = this.purchaseOrders.filter(p => p.id !== payload.old.id);
        }
        this.notifyAllChanged();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'non_food_expenses' }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const exp = mapSupabaseToExpense(payload.new);
          const idx = this.nonFoodExpenses.findIndex(e => e.id === exp.id);
          if (idx >= 0) this.nonFoodExpenses[idx] = exp;
          else this.nonFoodExpenses.unshift(exp);
        } else if (payload.eventType === 'DELETE') {
          this.nonFoodExpenses = this.nonFoodExpenses.filter(e => e.id !== payload.old.id);
        }
        this.notifyAllChanged();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'receiving_documents' }, async () => {
        const { data: dbRecs } = await supabase
          .from('receiving_documents')
          .select('*, receiving_lines(*)')
          .order('date', { ascending: false });
        if (dbRecs) {
          this.receivings = dbRecs.map((row: any) => ({
            id: row.id,
            date: row.date,
            arrivalTime: row.arrival_time,
            supplierId: row.supplier_id,
            supplierName: row.supplier_name || '',
            deliveryNoteNo: row.delivery_note_no || '',
            receiverId: row.receiver_id || 'USR-003',
            receiverName: row.receiver_name || 'Akmal',
            receiverRole: row.receiver_role || 'ADMIN',
            status: row.status || 'VERIFIED_POSTED',
            notes: row.notes || undefined,
            supplierSignature: row.supplier_signature || undefined,
            receiverSignature: row.receiver_signature || undefined,
            documentationPhotos: row.documentation_photos || undefined,
            createdAt: row.created_at,
            lines: Array.isArray(row.receiving_lines)
              ? row.receiving_lines.map((l: any) => ({
                  id: l.id,
                  itemId: l.item_id,
                  itemName: l.item_name,
                  category: l.category,
                  quantity: Number(l.quantity) || 1,
                  unit: l.unit,
                  conditionNote: l.condition_note || undefined,
                  batchNumber: l.batch_number || undefined,
                  expiryDate: l.expiry_date || undefined,
                }))
              : [],
          }));
          this.notifyAllChanged();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_transactions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new;
          const newTx: InventoryTransaction = {
            id: row.id,
            timestamp: row.timestamp ? localTimestamp(new Date(row.timestamp)) : '',
            itemId: row.item_id,
            itemName: row.item_name,
            itemType: row.item_type,
            category: row.category,
            location: row.location_id,
            quantity: Number(row.quantity),
            unit: row.unit,
            transactionType: row.transaction_type,
            referenceDocument: row.reference_document,
            userId: row.user_id,
            userName: row.user_name,
            userRole: row.user_role,
            balanceAfter: Number(row.balance_after),
            notes: row.notes || undefined,
          };
          if (!this.transactions.some(t => t.id === newTx.id)) {
            this.transactions.unshift(newTx);
          }
          this.notifyAllChanged();
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => this.refreshSyncedTables())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_orders' }, () => this.refreshSyncedTables())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, () => this.refreshSyncedTables())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_opname_sessions' }, () => this.refreshSyncedTables())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_todos' }, () => this.refreshSyncedTables())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => this.refreshSyncedTables())
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Supabase Realtime] Berhasil terhubung ke realtime sinkronisasi data gudang.');
        }
      });
  }

  public getSchoolBeneficiaries(): SchoolBeneficiaryAllocation[] {
    return [...this.schoolBeneficiaries];
  }

  public saveSchoolBeneficiary(
    beneficiary: SchoolBeneficiaryAllocation,
    user?: User
  ): SchoolBeneficiaryAllocation {
    const idx = this.schoolBeneficiaries.findIndex(b => b.id === beneficiary.id);
    if (idx >= 0) {
      this.schoolBeneficiaries[idx] = beneficiary;
    } else {
      this.schoolBeneficiaries.push(beneficiary);
    }
    setStored(STORAGE_KEYS.BENEFICIARIES, this.schoolBeneficiaries);
    this.pushCloud('school_beneficiaries', () => supabase.from('school_beneficiaries').upsert(mapBeneficiaryToSupabase(beneficiary)));

    if (user) {
      this.logAudit(
        user,
        idx >= 0 ? 'BENEFICIARY_UPDATED' : 'BENEFICIARY_CREATED',
        'OPERATIONAL',
        beneficiary.id,
        `${idx >= 0 ? 'Mengubah' : 'Menambah'} Penerima Manfaat: ${beneficiary.schoolName} (${beneficiary.portionCount} porsi, PIC: ${beneficiary.contactPerson || '-'} - ${beneficiary.phone || '-'})`
      );
    }
    return beneficiary;
  }

  public deleteSchoolBeneficiary(id: string, user?: User): boolean {
    const idx = this.schoolBeneficiaries.findIndex(b => b.id === id);
    if (idx < 0) return false;
    const deleted = this.schoolBeneficiaries.splice(idx, 1)[0];
    setStored(STORAGE_KEYS.BENEFICIARIES, this.schoolBeneficiaries);
    this.pushCloud('school_beneficiaries', () => supabase.from('school_beneficiaries').delete().eq('id', id));

    if (user) {
      this.logAudit(
        user,
        'BENEFICIARY_DELETED',
        'OPERATIONAL',
        id,
        `Menghapus Penerima Manfaat: ${deleted.schoolName}`
      );
    }
    return true;
  }

  // --- READERS ---
  public getItems(): ItemMaster[] {
    return [...this.items];
  }

  public getItemById(id: string): ItemMaster | undefined {
    return this.items.find(item => item.id === id);
  }

  public getSuppliers(): Supplier[] {
    return [...this.suppliers];
  }

  public getSupplierById(id: string): Supplier | undefined {
    return this.suppliers.find(s => s.id === id);
  }

  public getReceivings(): ReceivingDocument[] {
    return [...this.receivings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getReceivingDocs(): ReceivingDocument[] {
    return this.getReceivings();
  }

  public getReceivingById(id: string): ReceivingDocument | undefined {
    return this.receivings.find(r => r.id === id);
  }

  public getTransactions(): InventoryTransaction[] {
    return [...this.transactions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  public getOpnames(): StockOpnameSession[] {
    return [...this.opnames].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public getEquipment(): EquipmentItem[] {
    return [...this.equipment];
  }

  public getAuditLogs(): AuditLog[] {
    // Format timestamp "YYYY-MM-DD HH:mm" urut secara teks; new Date() untuk format ini tidak andal di Safari.
    return [...this.auditLogs].sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  }

  // Untuk aktivitas yang dicatat dari luar storage (mis. kelola akun aplikasi).
  public logActivity(user: User, action: string, entity: AuditLog['entity'], entityId: string, details: string): void {
    this.logAudit(user, action, entity, entityId, details);
  }

  // --- AUDIT HELPER ---
  private logAudit(
    user: User,
    action: string,
    entity: AuditLog['entity'],
    entityId: string,
    details: string
  ): void {
    const now = new Date();
    const formatted = localTimestamp(now);
    const newLog: AuditLog = {
      id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: formatted,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      entity,
      entityId,
      details,
    };
    // Batasi jumlah agar penyimpanan browser (sekitar 5 MB) tidak penuh.
    this.auditLogs = [newLog, ...this.auditLogs].slice(0, MAX_AUDIT_LOGS);
    setStored(STORAGE_KEYS.AUDIT_LOGS, this.auditLogs);
    this.pushCloud('audit_logs', () => supabase.from('audit_logs').insert(mapAuditToSupabase(newLog)));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sppg_audit_changed'));
  }

  public notifyAllChanged(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sppg_storage_items_changed'));
      window.dispatchEvent(new CustomEvent('sppg_warehouse_sync'));
      window.dispatchEvent(new Event('storage'));
    }
  }

  public notifyItemsChanged(): void {
    this.notifyAllChanged();
  }

  // --- ATOMIC RECEIVING POSTING ---
  public postReceiving(
    doc: Omit<ReceivingDocument, 'id' | 'createdAt' | 'status'>,
    user: User
  ): ReceivingDocument {
    // Validation
    if (!doc.supplierId) {
      throw new Error('Supplier wajib dipilih.');
    }
    if (!doc.lines || doc.lines.length === 0) {
      throw new Error('Minimal harus ada satu baris item penerimaan.');
    }

    const supplier = this.getSupplierById(doc.supplierId);
    if (!supplier) {
      throw new Error('Supplier tidak ditemukan dalam database.');
    }

    // Generate unique receiving ID
    const docId = this.nextReceivingId();
    const now = new Date();
    const timestampStr = localTimestamp(now);

    const newLines = doc.lines.map((line, idx) => {
      const item = this.getItemById(line.itemId);
      if (!item) {
        throw new Error(`Item ${line.itemId} tidak terdaftar di master item.`);
      }
      if (line.quantity <= 0) {
        throw new Error(`Kuantitas untuk ${item.name} harus lebih dari 0.`);
      }
      return {
        ...line,
        id: `GRL-${Date.now()}-${idx + 1}`,
        itemName: item.name,
        category: item.category,
        unit: item.baseUnit,
      };
    });

    // Execute stock adjustments & ledger entries
    for (const line of newLines) {
      const itemIndex = this.items.findIndex(i => i.id === line.itemId);
      if (itemIndex >= 0) {
        const item = this.items[itemIndex];
        const newStock = Number((item.currentStock + line.quantity).toFixed(2));
        this.items[itemIndex] = {
          ...item,
          currentStock: newStock,
          lastMovementDate: doc.date || localDateIso(now),
        };

        // Create transaction entry
        const tx: InventoryTransaction = {
          id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: timestampStr,
          itemId: item.id,
          itemName: item.name,
          itemType: item.itemType,
          category: item.category,
          location: item.location,
          quantity: line.quantity,
          unit: item.baseUnit,
          transactionType: 'RECEIVING',
          referenceDocument: docId,
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          notes: `Penerimaan dari ${supplier.name}. ${line.conditionNote || ''}`.trim(),
          balanceAfter: newStock,
        };
        this.transactions.unshift(tx);
      }
    }

    const savedDoc: ReceivingDocument = {
      ...doc,
      id: docId,
      status: 'VERIFIED_POSTED',
      lines: newLines,
      createdAt: now.toISOString(),
    };

    this.receivings.unshift(savedDoc);

    // Dokumen dulu, lalu rincian dan mutasinya (keduanya merujuk dokumen), lalu stok barang.
    const docRow = mapReceivingToSupabase(savedDoc);
    const lineRows = newLines.map(l => mapLineToSupabase(l, savedDoc.id));
    const txRows = this.transactions.filter(t => t.referenceDocument === docId).map(mapTxToSupabase);
    const stockUpdates = newLines
      .map(line => this.getItemById(line.itemId))
      .filter((item): item is ItemMaster => Boolean(item))
      .map(item => ({
        name: item.name,
        id: item.id,
        row: {
          current_stock: item.currentStock,
          last_movement_date: localTsToIso(item.lastMovementDate || localDateIso()),
          updated_at: new Date().toISOString(),
        },
      }));
    this.pushCloudSequence([
      [`simpan penerimaan ${docId}`, () => supabase.from('receiving_documents').insert(docRow)],
      [`simpan rincian penerimaan ${docId}`, () => supabase.from('receiving_lines').insert(lineRows)],
      ...(txRows.length > 0
        ? [[`simpan mutasi stok ${docId}`, () => supabase.from('inventory_transactions').insert(txRows)] as [string, () => PromiseLike<{ error: any }>]]
        : []),
      ...stockUpdates.map(
        u => [`simpan stok "${u.name}"`, () => supabase.from('item_master').update(u.row).eq('id', u.id)] as [string, () => PromiseLike<{ error: any }>]
      ),
    ]);

    this.notifyAllChanged();

    this.logAudit(
      user,
      'RECEIVING_CREATED_POSTED',
      'RECEIVING',
      docId,
      `Mencatat penerimaan barang #${docId} dari ${supplier.name} dengan ${newLines.length} jenis item.`
    );

    return savedDoc;
  }

  // --- RECORD ISSUE / CONSUMPTION ---
  /** occurredAt diisi saat menyalin catatan kertas: transaksi masuk ke tanggal di kertas, bukan saat diinput. */
  public recordConsumption(
    itemId: string,
    quantity: number,
    location: string,
    user: User,
    notes: string,
    referenceDoc?: string,
    occurredAt?: Date
  ): InventoryTransaction {
    if (quantity <= 0) {
      throw new Error('Jumlah pemakaian bahan harus lebih dari 0.');
    }
    return this.postConsumption(itemId, -quantity, location, user, notes, referenceDoc, occurredAt);
  }

  // Koreksi pemakaian yang tercatat berlebih: bahan dikembalikan ke stok.
  // Dicatat sebagai ISSUE_CONSUMPTION bernilai positif agar net pemakaian harian ikut turun.
  public correctConsumption(
    itemId: string,
    quantity: number,
    location: string,
    user: User,
    notes: string,
    referenceDoc?: string
  ): InventoryTransaction {
    if (quantity <= 0) {
      throw new Error('Jumlah koreksi harus lebih dari 0.');
    }
    return this.postConsumption(itemId, quantity, location, user, notes, referenceDoc);
  }

  private postConsumption(
    itemId: string,
    signedQty: number,
    location: string,
    user: User,
    notes: string,
    referenceDoc?: string,
    occurredAt?: Date
  ): InventoryTransaction {
    const itemIndex = this.items.findIndex(i => i.id === itemId);
    if (itemIndex < 0) {
      throw new Error('Barang tidak ditemukan.');
    }
    const item = this.items[itemIndex];
    const isCorrection = signedQty > 0;
    const quantity = Math.abs(signedQty);

    if (!isCorrection && item.currentStock < quantity) {
      console.warn(`Pemakaian melebihi stok tercatat: ${quantity} > ${item.currentStock}`);
    }

    const newStock = Number((item.currentStock + signedQty).toFixed(2));
    const now = occurredAt || new Date();
    const timestampStr = localTimestamp(now);
    const ref = referenceDoc || `ISS-${localDateIso(now).replace(/-/g, '')}-${Math.floor(Math.random() * 100)}`;
    // Catatan mundur tidak boleh memundurkan tanggal gerak terakhir barang.
    const movementDate =
      item.lastMovementDate && item.lastMovementDate > localDateIso(now) ? item.lastMovementDate : localDateIso(now);

    this.items[itemIndex] = {
      ...item,
      currentStock: newStock,
      lastMovementDate: movementDate,
    };

    const tx: InventoryTransaction = {
      id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: timestampStr,
      itemId: item.id,
      itemName: item.name,
      itemType: item.itemType,
      category: item.category,
      location: location || item.location,
      quantity: signedQty,
      unit: item.baseUnit,
      transactionType: 'ISSUE_CONSUMPTION',
      referenceDocument: ref,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      notes: notes || (isCorrection ? 'Koreksi pemakaian dapur' : 'Pemakaian dapur'),
      balanceAfter: newStock,
    };

    this.transactions.unshift(tx);

    // Save directly to Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('inventory_transactions').insert(mapTxToSupabase(tx)).then(({ error }) => {
        if (error) console.error('Supabase consumption transaction error:', error);
      });
      supabase.from('item_master').update({
        current_stock: newStock,
        last_movement_date: new Date(movementDate).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', item.id).then();
    }

    this.notifyAllChanged();

    this.logAudit(
      user,
      'STOCK_CONSUMED',
      'INVENTORY',
      item.id,
      `${isCorrection ? 'Koreksi pemakaian' : 'Pemakaian'} ${quantity} ${item.baseUnit} ${item.name} (${ref}): ${notes}`
    );

    return tx;
  }

  // --- DAILY FLOW SUMMARY ---
  // scope 'DAILY_FLOW' hanya bahan segar (dipakai ringkasan dashboard); 'ALL_FOOD' termasuk bahan kering.
  public getDailyFlowData(targetDate?: string, scope: 'DAILY_FLOW' | 'ALL_FOOD' = 'DAILY_FLOW'): DailyFlowRecord[] {
    const date = targetDate || localDateIso();
    const flowItems = this.items.filter(i =>
      scope === 'ALL_FOOD'
        ? i.itemType === 'FOOD_DAILY_FLOW' || i.itemType === 'FOOD_CARRYING_STOCK'
        : i.itemType === 'FOOD_DAILY_FLOW'
    );

    return flowItems.map(item => {
      const sumOnDate = (types: string[]) =>
        this.transactions
          .filter(tx => tx.itemId === item.id && types.includes(tx.transactionType) && tx.timestamp.startsWith(date))
          .reduce((sum, tx) => sum + tx.quantity, 0);

      const receivedToday = Number(sumOnDate(['RECEIVING']).toFixed(2));
      // Pemakaian bernilai negatif, koreksi positif; net pemakaian = kebalikan jumlahnya.
      const consumedToday = Number((-sumOnDate(['ISSUE_CONSUMPTION'])).toFixed(2));
      const adjustedToday = Number(sumOnDate(['ADJUSTMENT', 'STOCK_OPNAME_ADJUSTMENT']).toFixed(2));

      // Saldo akhir tanggal lampau = stok sekarang dikurangi semua pergerakan setelah tanggal itu.
      const netAfterDate = this.transactions
        .filter(tx => tx.itemId === item.id && tx.timestamp.slice(0, 10) > date)
        .reduce((sum, tx) => sum + tx.quantity, 0);
      const closingBalance = Number((item.currentStock - netAfterDate).toFixed(2));
      // Tidak dipotong ke 0: saldo awal negatif menandakan ada pencatatan yang perlu dicek.
      const openingBalance = Number((closingBalance - receivedToday + consumedToday - adjustedToday).toFixed(2));

      return {
        itemId: item.id,
        itemName: item.name,
        itemType: item.itemType,
        category: item.category as any,
        unit: item.baseUnit,
        location: item.location,
        openingBalance,
        receivedToday,
        consumedToday,
        adjustedToday,
        closingBalance,
      };
    });
  }

  // --- STOCK OPNAME WORKFLOW ---
  public createStockOpname(
    date: string,
    location: string,
    itemsToCount: { itemId: string; physicalCount: number; reason: string }[],
    user: User,
    notes?: string
  ): StockOpnameSession {
    const year = new Date().getFullYear();
    // Berbasis waktu agar dua perangkat tidak membuat nomor yang sama.
    const opnameId = `SO-${year}-${Date.now().toString().slice(-7)}`;

    const countedItems = itemsToCount.map((entry, idx) => {
      const item = this.getItemById(entry.itemId);
      if (!item) throw new Error(`Item ${entry.itemId} tidak valid.`);
      const sysStock = item.currentStock;
      const diff = Number((entry.physicalCount - sysStock).toFixed(2));
      if (diff !== 0 && (!entry.reason || entry.reason.trim().length === 0)) {
        throw new Error(`Alasan selisih stok (variance) untuk item ${item.name} wajib diisi.`);
      }
      return {
        id: `SOI-${Date.now()}-${idx + 1}`,
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        unit: item.baseUnit,
        systemStock: sysStock,
        physicalCount: entry.physicalCount,
        variance: diff,
        reason: entry.reason || 'Sesuai fisik',
      };
    });

    const newOpname: StockOpnameSession = {
      id: opnameId,
      date,
      location,
      createdById: user.id,
      createdByName: user.name,
      status: 'PENDING_APPROVAL',
      notes,
      items: countedItems,
      createdAt: new Date().toISOString(),
    };

    this.opnames.unshift(newOpname);
    setStored(STORAGE_KEYS.OPNAMES, this.opnames);
    this.pushOpname(newOpname);

    this.logAudit(
      user,
      'STOCK_OPNAME_CREATED',
      'STOCK_OPNAME',
      opnameId,
      `Membuat sesi Stock Opname #${opnameId} (${countedItems.length} item) menunggu persetujuan.`
    );

    return newOpname;
  }

  // Sesi dulu, baru rincian (rincian merujuk ke sesi).
  private pushOpname(o: StockOpnameSession): void {
    if (!isSupabaseConfigured()) return;
    supabase.from('stock_opname_sessions').upsert(mapOpnameToSupabase(o)).then(({ error }) => {
      if (error) return console.error('Supabase stock_opname_sessions gagal:', error.message);
      if (o.items.length === 0) return;
      supabase.from('stock_opname_items').upsert(mapOpnameItemsToSupabase(o)).then(({ error: itemErr }) => {
        if (itemErr) console.error('Supabase stock_opname_items gagal:', itemErr.message);
      });
    });
  }

  public approveStockOpname(opnameId: string, approver: User): StockOpnameSession {
    const allowedRoles: UserRole[] = ['SUPERADMIN', 'KA_SPPG', 'ADMIN', 'AKUNTAN'];
    if (!allowedRoles.includes(approver.role)) {
      throw new Error('Anda tidak memiliki otorisasi untuk menyetujui Stock Opname. Hubungi Manajer Gudang atau Manajer SPPG.');
    }

    const opIndex = this.opnames.findIndex(o => o.id === opnameId);
    if (opIndex < 0) {
      throw new Error('Sesi Stock Opname tidak ditemukan.');
    }

    const session = this.opnames[opIndex];
    if (session.status !== 'PENDING_APPROVAL') {
      throw new Error(`Sesi Stock Opname sudah berstatus ${session.status}.`);
    }

    const now = new Date();
    const timestampStr = localTimestamp(now);

    // Process adjustments for items with non-zero variance
    for (const opItem of session.items) {
      if (opItem.variance !== 0) {
        const itemIdx = this.items.findIndex(i => i.id === opItem.itemId);
        if (itemIdx >= 0) {
          const item = this.items[itemIdx];
          const newStock = opItem.physicalCount;
          this.items[itemIdx] = {
            ...item,
            currentStock: newStock,
            lastMovementDate: localDateIso(now),
          };

          const tx: InventoryTransaction = {
            id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: timestampStr,
            itemId: item.id,
            itemName: item.name,
            itemType: item.itemType,
            category: item.category,
            location: item.location,
            quantity: opItem.variance,
            unit: item.baseUnit,
            transactionType: 'STOCK_OPNAME_ADJUSTMENT',
            referenceDocument: session.id,
            userId: approver.id,
            userName: approver.name,
            userRole: approver.role,
            notes: `Penyesuaian Opname: Selisih ${opItem.variance > 0 ? '+' : ''}${opItem.variance} ${item.baseUnit}. Alasan: ${opItem.reason}`,
            balanceAfter: newStock,
          };
          this.transactions.unshift(tx);
        }
      }
    }

    const updatedSession: StockOpnameSession = {
      ...session,
      status: 'APPROVED',
      approvedById: approver.id,
      approvedByName: approver.name,
      approvedAt: timestampStr,
    };

    this.opnames[opIndex] = updatedSession;
    setStored(STORAGE_KEYS.OPNAMES, this.opnames);
    this.pushCloud('stock_opname_sessions', () =>
      supabase.from('stock_opname_sessions').upsert(mapOpnameToSupabase(updatedSession))
    );

    // Save directly to Supabase Cloud
    if (isSupabaseConfigured()) {
      for (const opItem of session.items) {
        if (opItem.variance !== 0) {
          const item = this.getItemById(opItem.itemId);
          if (item) {
            supabase.from('item_master').update({
              current_stock: item.currentStock,
              last_movement_date: new Date(localDateIso()).toISOString(),
              updated_at: new Date().toISOString(),
            }).eq('id', item.id).then();
          }
        }
      }
      const newTxs = this.transactions.filter(t => t.referenceDocument === session.id);
      if (newTxs.length > 0) {
        supabase.from('inventory_transactions').insert(newTxs.map(mapTxToSupabase)).then();
      }
    }

    this.notifyAllChanged();

    this.logAudit(
      approver,
      'STOCK_OPNAME_APPROVED',
      'STOCK_OPNAME',
      session.id,
      `Menyetujui Stock Opname #${session.id}. Penyesuaian stok berhasil diaplikasikan ke sistem.`
    );

    return updatedSession;
  }

  // --- ITEM MASTER MANAGEMENT ---
  public saveItem(item: ItemMaster, user: User, isNew: boolean): ItemMaster {
    if (!item.name || !item.id || !item.baseUnit) {
      throw new Error('Nama, SKU, dan Satuan Dasar wajib diisi.');
    }
    if (item.minimumStock < 0) {
      throw new Error('Batas minimum stok tidak boleh bernilai negatif.');
    }

    if (isNew) {
      const exists = this.items.some(i => i.id.toLowerCase() === item.id.toLowerCase());
      if (exists) {
        throw new Error(`Item dengan SKU/ID "${item.id}" sudah ada.`);
      }
      this.items.push(item);
      this.logAudit(user, 'ITEM_MASTER_CREATED', 'ITEM_MASTER', item.id, `Menambahkan item baru: ${item.name} (${item.category}).`);

      if (item.currentStock > 0) {
        const initTx: InventoryTransaction = {
          id: uniqueId('TX-INIT'),
          timestamp: localTimestamp(),
          itemId: item.id,
          itemName: item.name,
          itemType: item.itemType,
          category: item.category,
          location: item.location,
          quantity: item.currentStock,
          unit: item.baseUnit,
          transactionType: 'ADJUSTMENT',
          referenceDocument: 'INIT-MASTER-CUSTOM',
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          notes: 'Saldo stok awal saat registrasi item custom di Master Barang',
          balanceAfter: item.currentStock,
        };
        this.transactions.unshift(initTx);
        if (isSupabaseConfigured()) {
          supabase.from('inventory_transactions').insert(mapTxToSupabase(initTx)).then();
        }
      }
    } else {
      const idx = this.items.findIndex(i => i.id === item.id);
      if (idx < 0) throw new Error('Item tidak ditemukan untuk diperbarui.');
      // Editing master data never changes stock: stock only moves through recorded transactions
      // (receiving, consumption, opname, adjustItemStock). Keep the stored balance, not the form's copy.
      item = { ...item, currentStock: this.items[idx].currentStock, lastMovementDate: this.items[idx].lastMovementDate };
      this.items[idx] = item;
      this.logAudit(user, 'ITEM_MASTER_UPDATED', 'ITEM_MASTER', item.id, `Memperbarui data item: ${item.name}.`);
    }

    // Direct save to Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('item_master').upsert(mapItemToSupabase(item)).then(({ error }) => {
        if (error) reportCloudWriteError(`simpan barang "${item.name}"`, error);
      });
    }

    this.notifyAllChanged();
    return item;
  }

  public deleteItem(itemId: string, user: User): void {
    const idx = this.items.findIndex(i => i.id.toLowerCase() === itemId.toLowerCase());
    if (idx < 0) throw new Error('Item master tidak ditemukan.');
    const deletedItem = this.items[idx];
    this.items.splice(idx, 1);

    // Direct delete from Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('item_master').delete().eq('id', itemId).then(({ error }) => {
        if (error) console.error('Supabase item delete error:', error);
      });
    }

    this.notifyAllChanged();
    this.logAudit(user, 'ITEM_MASTER_DELETED', 'ITEM_MASTER', itemId, `Menghapus master item: ${deletedItem.name} (${deletedItem.id}).`);
  }

  public clearAllItems(user?: User): void {
    this.items = [];

    // Direct delete all from Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('item_master').delete().neq('id', '___').then(({ error }) => {
        if (error) console.error('Supabase clear items error:', error);
      });
    }

    this.notifyAllChanged();
    this.logAudit(
      user || { id: 'USR-003', name: 'Akmal', email: 'akmal@sppg.id', role: 'ADMIN' },
      'ITEM_MASTER_DELETED',
      'ITEM_MASTER',
      'ALL_ITEMS',
      'Mengosongkan seluruh katalog master barang untuk input data baru dari awal.'
    );
  }

  public toggleItemActive(itemId: string, user: User): ItemMaster {
    const idx = this.items.findIndex(i => i.id.toLowerCase() === itemId.toLowerCase());
    if (idx < 0) throw new Error('Item master tidak ditemukan.');
    const item = this.items[idx];
    item.isActive = !item.isActive;
    item.updatedAt = new Date().toISOString();

    // Direct update to Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('item_master').update({ is_active: item.isActive, updated_at: item.updatedAt }).eq('id', itemId).then(({ error }) => {
        if (error) console.error('Supabase toggle item error:', error);
      });
    }

    this.notifyAllChanged();
    this.logAudit(user, 'ITEM_MASTER_UPDATED', 'ITEM_MASTER', itemId, `Mengubah status item ${item.name} menjadi ${item.isActive ? 'Aktif' : 'Nonaktif'}.`);
    return item;
  }

  /** Manual stock correction, recorded as an ADJUSTMENT transaction so the ledger stays in sync. */
  public adjustItemStock(itemId: string, newStock: number, reason: string, user: User): ItemMaster {
    const idx = this.items.findIndex(i => i.id === itemId);
    if (idx < 0) throw new Error('Barang tidak ditemukan.');
    if (!reason.trim()) throw new Error('Alasan koreksi wajib diisi.');
    if (!Number.isFinite(newStock) || newStock < 0) throw new Error('Stok baru tidak boleh negatif.');

    const item = this.items[idx];
    const delta = Number((newStock - item.currentStock).toFixed(3));
    if (delta === 0) throw new Error('Stok baru sama dengan stok sekarang.');

    const nowIso = new Date().toISOString();
    const tx: InventoryTransaction = {
      id: uniqueId('TX-ADJ'),
      timestamp: nowIso,
      itemId: item.id,
      itemName: item.name,
      itemType: item.itemType,
      category: item.category,
      location: item.location,
      quantity: delta,
      unit: item.baseUnit,
      transactionType: 'ADJUSTMENT',
      referenceDocument: `ADJ-${Date.now().toString().slice(-6)}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      notes: reason.trim(),
      balanceAfter: newStock,
    };
    const updated: ItemMaster = { ...item, currentStock: newStock, lastMovementDate: nowIso, updatedAt: nowIso };
    this.items[idx] = updated;
    this.transactions.unshift(tx);

    if (isSupabaseConfigured()) {
      supabase.from('item_master').upsert(mapItemToSupabase(updated)).then(({ error }) => {
        if (error) console.error('Supabase item upsert error:', error);
      });
      supabase.from('inventory_transactions').insert(mapTxToSupabase(tx)).then();
    }

    this.logAudit(
      user,
      'STOCK_ADJUSTED',
      'ITEM_MASTER',
      item.id,
      `Koreksi stok ${item.name}: ${item.currentStock} -> ${newStock} ${item.baseUnit}. Alasan: ${reason.trim()}`
    );
    this.notifyAllChanged();
    return updated;
  }

  public saveItemsBatch(newItems: ItemMaster[], user: User): ItemMaster[] {
    const saved: ItemMaster[] = [];
    const now = new Date().toISOString();

    // Batch registration only adds new items. Reusing an existing SKU used to silently overwrite
    // that item, including its stock, so reject the whole batch before changing anything.
    const seen = new Set<string>();
    const clashes: string[] = [];
    newItems.forEach(item => {
      const id = (item.id || '').trim().toLowerCase();
      if (!id) return;
      if (seen.has(id) || this.items.some(it => it.id.toLowerCase() === id)) clashes.push(item.id.trim());
      seen.add(id);
    });
    if (clashes.length > 0) {
      throw new Error(`SKU sudah dipakai: ${clashes.join(', ')}. Ganti SKU atau kosongkan agar dibuat otomatis.`);
    }

    for (let i = 0; i < newItems.length; i++) {
      const item = newItems[i];
      if (!item.name || !item.baseUnit) continue;

      const cleanId = item.id && item.id.trim()
        ? item.id.trim()
        : `ITM-${Date.now().toString().slice(-4)}-${i + 1}`;

      const existingIdx = this.items.findIndex(
        it => it.id.toLowerCase() === cleanId.toLowerCase()
      );

      const itemToSave: ItemMaster = {
        ...item,
        id: cleanId,
        name: item.name.trim(),
        minimumStock: Math.max(0, item.minimumStock || 0),
        reorderPoint: Math.max(item.minimumStock || 0, item.reorderPoint || (item.minimumStock || 0) * 1.5),
        currentStock: Math.max(0, item.currentStock || 0),
        createdAt: item.createdAt || now,
        updatedAt: now,
      };

      if (existingIdx >= 0) {
        this.items[existingIdx] = itemToSave;
      } else {
        this.items.push(itemToSave);
      }
      saved.push(itemToSave);

      if (existingIdx < 0 && itemToSave.currentStock > 0) {
        const initTx: InventoryTransaction = {
          id: uniqueId('TX-INIT'),
          timestamp: localTimestamp(new Date(now)),
          itemId: itemToSave.id,
          itemName: itemToSave.name,
          itemType: itemToSave.itemType,
          category: itemToSave.category,
          location: itemToSave.location,
          quantity: itemToSave.currentStock,
          unit: itemToSave.baseUnit,
          transactionType: 'ADJUSTMENT',
          referenceDocument: 'INIT-MASTER-BATCH',
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          notes: 'Saldo stok awal saat registrasi masal di Master Barang',
          balanceAfter: itemToSave.currentStock,
        };
        this.transactions.unshift(initTx);
        if (isSupabaseConfigured()) {
          supabase.from('inventory_transactions').insert(mapTxToSupabase(initTx)).then();
        }
      }
    }

    // Direct batch upsert to Supabase Cloud
    if (isSupabaseConfigured() && saved.length > 0) {
      supabase.from('item_master').upsert(saved.map(mapItemToSupabase)).then(({ error }) => {
        if (error) console.error('Supabase items batch upsert error:', error);
      });
    }

    this.notifyAllChanged();
    this.logAudit(
      user,
      'ITEMS_BATCH_SAVED',
      'ITEM_MASTER',
      `BATCH-${Date.now()}`,
      `Menambahkan / memperbarui masal ${saved.length} master barang sekaligus.`
    );
    return saved;
  }

  // --- SUPPLIER MANAGEMENT ---
  /** ID berurutan SUP-001, SUP-002, ... berdasarkan angka terbesar yang sudah ada. */
  public nextSupplierId(): string {
    const maxNum = this.suppliers.reduce((max, s) => {
      const m = /^SUP-(\d+)$/i.exec(s.id);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
    return `SUP-${String(maxNum + 1).padStart(3, '0')}`;
  }

  /**
   * Tambah supplier cepat dari form input (cukup nama). Kalau nama sudah ada,
   * kembalikan data yang lama supaya tidak dobel.
   */
  public quickAddSupplier(name: string, user: User, address = ''): Supplier {
    const clean = name.trim();
    const existing = this.suppliers.find(s => s.name.trim().toLowerCase() === clean.toLowerCase());
    if (existing) return existing;
    return this.saveSupplier(
      {
        id: this.nextSupplierId(),
        name: clean,
        contactPerson: '',
        phone: '',
        address,
        supplyCategory: 'Umum',
        isActive: true,
        notes: 'Ditambahkan dari input belanja. Lengkapi kontak & kategori.',
      },
      user,
      true
    );
  }

  /**
   * Pembersihan supplier dummy bawaan (PT ABC Pangan, CV Berkah Unggas, dll.)
   * dan sinkronisasi 10 supplier UMKM mitra resmi SPPG MLG TUMPANG JERU ke localStorage.
   */
  private cleanAndSyncRealSuppliers(): void {
    const FLAG = 'sppg_real_suppliers_clean_v6';
    if (localStorage.getItem(FLAG)) return;

    const DUMMY_NAMES = new Set(
      LEGACY_DUMMY_SUPPLIER_NAMES.map(n => n.trim().toLowerCase())
    );

    // 1. Bersihkan supplier dummy lama dari memori dan storage
    let cleaned = this.suppliers.filter(
      s => !DUMMY_NAMES.has(s.name.trim().toLowerCase())
    );

    // 2. Pastikan ke-10 supplier UMKM resmi masuk ke daftar
    INITIAL_SUPPLIERS.forEach(realSup => {
      const idx = cleaned.findIndex(
        s => s.name.trim().toLowerCase() === realSup.name.trim().toLowerCase()
      );
      if (idx === -1) {
        cleaned.push(realSup);
      } else {
        cleaned[idx] = {
          ...cleaned[idx],
          address: cleaned[idx].address || realSup.address,
          supplyCategory:
            cleaned[idx].supplyCategory === 'Umum'
              ? realSup.supplyCategory
              : cleaned[idx].supplyCategory,
        };
      }
    });

    this.suppliers = cleaned;
  }

  public saveSupplier(supplier: Supplier, user: User, isNew: boolean): Supplier {
    if (!supplier.name || !supplier.id) {
      throw new Error('ID Supplier dan Nama Supplier wajib diisi.');
    }

    if (isNew) {
      const exists = this.suppliers.some(s => s.id.toLowerCase() === supplier.id.toLowerCase());
      if (exists) {
        throw new Error(`Supplier dengan ID "${supplier.id}" sudah ada.`);
      }
      this.suppliers.push(supplier);
      this.logAudit(user, 'SUPPLIER_CREATED', 'SUPPLIER', supplier.id, `Menambahkan supplier baru: ${supplier.name}.`);
    } else {
      const idx = this.suppliers.findIndex(s => s.id === supplier.id);
      if (idx < 0) throw new Error('Supplier tidak ditemukan.');
      this.suppliers[idx] = supplier;
      this.logAudit(user, 'SUPPLIER_UPDATED', 'SUPPLIER', supplier.id, `Memperbarui data supplier: ${supplier.name}.`);
    }

    // Direct save to Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('suppliers').upsert(mapSupplierToSupabase(supplier)).then(({ error }) => {
        if (error) console.error('Supabase supplier upsert error:', error);
      });
    }

    this.notifyAllChanged();
    return supplier;
  }

  public deleteSupplier(supplierId: string, user: User): void {
    const idx = this.suppliers.findIndex(s => s.id === supplierId);
    if (idx < 0) throw new Error('Supplier tidak ditemukan.');
    const deletedName = this.suppliers[idx].name;
    this.suppliers.splice(idx, 1);

    // Direct delete from Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('suppliers').delete().eq('id', supplierId).then(({ error }) => {
        if (error) console.error('Supabase supplier delete error:', error);
      });
    }

    this.notifyAllChanged();
    this.logAudit(user, 'SUPPLIER_DELETED', 'SUPPLIER', supplierId, `Menghapus data supplier: ${deletedName}.`);
  }

  // --- EQUIPMENT MANAGEMENT ---
  public updateEquipmentCondition(
    equipmentId: string,
    condition: EquipmentItem['condition'],
    status: EquipmentItem['status'],
    notes: string,
    user: User
  ): EquipmentItem {
    const idx = this.equipment.findIndex(e => e.id === equipmentId);
    if (idx < 0) throw new Error('Alat / Perlengkapan tidak ditemukan.');

    const old = this.equipment[idx];
    const now = localDateIso();
    const updated: EquipmentItem = {
      ...old,
      condition,
      status,
      lastInspectedDate: now,
      // Catatan pemeriksaan dicatat di riwayat audit; catatan aset (merek, spesifikasi) tidak ditimpa.
      notes: old.notes,
    };

    this.equipment[idx] = updated;
    setStored(STORAGE_KEYS.EQUIPMENT, this.equipment);

    // Sebelumnya perubahan kondisi hanya tersimpan lokal dan hilang saat data dimuat ulang dari cloud.
    if (isSupabaseConfigured()) {
      supabase
        .from('equipment_items')
        .update({
          condition,
          status,
          last_inspected_date: now,
          notes: updated.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', equipmentId)
        .then(({ error }) => {
          if (error) console.error('Supabase equipment condition update error:', error);
        });
    }
    this.notifyAllChanged();

    this.logAudit(
      user,
      'EQUIPMENT_CONDITION_CHANGED',
      'EQUIPMENT',
      equipmentId,
      `${old.name}: kondisi ${change(EQUIPMENT_CONDITION_TEXT, old.condition, condition)}, status ${change(EQUIPMENT_STATUS_TEXT, old.status, status)}. Hasil cek: ${notes}`
    );

    return updated;
  }

  public saveEquipment(equipment: EquipmentItem, user: User, isNew: boolean): EquipmentItem {
    if (!equipment.id || !equipment.name) {
      throw new Error('ID dan Nama Perlengkapan wajib diisi.');
    }

    if (isNew) {
      const exists = this.equipment.some(e => e.id.toLowerCase() === equipment.id.toLowerCase());
      if (exists) throw new Error(`Alat dengan ID "${equipment.id}" sudah ada.`);
      this.equipment.push(equipment);
      this.logAudit(user, 'EQUIPMENT_CREATED', 'EQUIPMENT', equipment.id, `Mendaftarkan alat baru: ${equipment.name}.`);
    } else {
      const idx = this.equipment.findIndex(e => e.id === equipment.id);
      if (idx < 0) throw new Error('Alat tidak ditemukan.');
      this.equipment[idx] = equipment;
      this.logAudit(user, 'EQUIPMENT_UPDATED', 'EQUIPMENT', equipment.id, `Memperbarui data alat: ${equipment.name}.`);
    }

    // Direct save to Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('equipment_items').upsert({
        id: equipment.id,
        name: equipment.name,
        category: equipment.category,
        quantity: equipment.quantity,
        unit: equipment.unit,
        condition: equipment.condition,
        status: equipment.status,
        location_id: equipment.location,
        assigned_to: equipment.assignedTo || null,
        last_inspected_date: equipment.lastInspectedDate,
        notes: equipment.notes || null,
        updated_at: new Date().toISOString(),
      }).then(({ error }) => {
        if (error) console.error('Supabase equipment upsert error:', error);
      });
    }
    this.notifyAllChanged();
    return equipment;
  }

  // --- NON-FOOD EXPENSES ---
  public getNonFoodExpenses(): NonFoodExpense[] {
    return [...this.nonFoodExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public recordNonFoodExpense(
    expense: Omit<NonFoodExpense, 'id' | 'createdAt'>,
    user: User
  ): NonFoodExpense {
    const newId = uniqueId('NFE');
    const newExpense: NonFoodExpense = {
      ...expense,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    this.nonFoodExpenses.unshift(newExpense);

    // Direct save to Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('non_food_expenses').upsert(mapExpenseToSupabase(newExpense)).then(({ error }) => {
        if (error) console.error('Supabase expense upsert error:', error);
      });
    }

    this.notifyAllChanged();

    this.logAudit(
      user,
      'NONFOOD_EXPENSE_RECORDED',
      'INVENTORY',
      newId,
      `Pengeluaran Non-Food [${newExpense.category}]: ${newExpense.itemName} (${newExpense.quantity} ${newExpense.unit}) total Rp ${(newExpense.totalCost || 0).toLocaleString('id-ID')} untuk ${newExpense.department}`
    );
    return newExpense;
  }

  public deleteNonFoodExpense(id: string, user: User): boolean {
    const idx = this.nonFoodExpenses.findIndex(e => e.id === id);
    if (idx < 0) return false;
    const deleted = this.nonFoodExpenses.splice(idx, 1)[0];

    // Direct delete from Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('non_food_expenses').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase expense delete error:', error);
      });
    }

    this.notifyAllChanged();
    this.logAudit(
      user,
      'NONFOOD_EXPENSE_DELETED',
      'INVENTORY',
      id,
      `Menghapus catatan pengeluaran barang: ${deleted.itemName} (${deleted.quantity} ${deleted.unit || ''})`
    );
    return true;
  }

  /**
   * Hapus satu baris penerimaan yang salah catat. Stok yang dulu ditambahkan baris ini dikurangi lagi
   * lewat transaksi koreksi (riwayat penerimaan tetap terlihat di Buku Mutasi), dan belanja yang tertaut
   * ikut dihapus agar nominalnya tidak tetap terhitung.
   */
  public deleteReceivingLine(receivingId: string, lineId: string, user: User, linkedExpenseId?: string): void {
    const docIdx = this.receivings.findIndex(r => r.id === receivingId);
    if (docIdx < 0) throw new Error('Dokumen penerimaan tidak ditemukan.');
    const doc = this.receivings[docIdx];
    const line = doc.lines.find(l => l.id === lineId);
    if (!line) throw new Error('Baris penerimaan tidak ditemukan.');

    // Penerimaan lewat PO mencatat transaksinya dengan nomor PO, penerimaan langsung dengan nomor GR.
    const po = this.purchaseOrders.find(p => p.relatedReceivingId === receivingId);
    const refs = [receivingId, po?.poNumber].filter(Boolean) as string[];
    const receivedTx = this.transactions.find(
      t => t.transactionType === 'RECEIVING' && t.itemId === line.itemId && refs.includes(t.referenceDocument)
    );
    const itemIdx = this.items.findIndex(i => i.id === line.itemId);

    let reversalTx: InventoryTransaction | undefined;
    if (receivedTx && itemIdx >= 0) {
      const item = this.items[itemIdx];
      const newStock = Math.round((item.currentStock - receivedTx.quantity) * 1000) / 1000;
      if (newStock < 0) {
        throw new Error(
          `Stok ${item.name} tinggal ${item.currentStock} ${item.baseUnit}, kurang dari ${receivedTx.quantity} ${item.baseUnit} yang akan dibatalkan. ` +
            'Sebagian sudah terpakai, jadi catat dulu koreksi stoknya di Buku Mutasi.'
        );
      }
      const nowIso = new Date().toISOString();
      this.items[itemIdx] = { ...item, currentStock: newStock, updatedAt: nowIso };
      reversalTx = {
        id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: localTimestamp(),
        itemId: item.id,
        itemName: item.name,
        itemType: item.itemType,
        category: item.category,
        location: item.location,
        quantity: -receivedTx.quantity,
        unit: item.baseUnit,
        transactionType: 'ADJUSTMENT',
        referenceDocument: receivingId,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        notes: `Pembatalan penerimaan ${receivingId} (salah catat): ${line.itemName} ${line.quantity} ${line.unit}.`,
        balanceAfter: newStock,
      };
      this.transactions.unshift(reversalTx);
    }

    const remaining = doc.lines.filter(l => l.id !== lineId);
    if (remaining.length > 0) {
      this.receivings[docIdx] = { ...doc, lines: remaining };
    } else {
      this.receivings.splice(docIdx, 1);
    }

    const expIdx = linkedExpenseId ? this.nonFoodExpenses.findIndex(e => e.id === linkedExpenseId) : -1;
    if (expIdx >= 0) this.nonFoodExpenses.splice(expIdx, 1);

    if (reversalTx) {
      const item = this.items[itemIdx];
      const tx = reversalTx;
      this.pushCloud('koreksi stok pembatalan penerimaan', () => supabase.from('inventory_transactions').insert(mapTxToSupabase(tx)));
      this.pushCloud(`stok ${item.name}`, () =>
        supabase.from('item_master').update({ current_stock: item.currentStock, updated_at: item.updatedAt }).eq('id', item.id)
      );
    }
    if (remaining.length > 0) {
      this.pushCloud('hapus baris penerimaan', () => supabase.from('receiving_lines').delete().eq('id', lineId));
    } else {
      // Baris ikut terhapus lewat ON DELETE CASCADE
      this.pushCloud('hapus dokumen penerimaan', () => supabase.from('receiving_documents').delete().eq('id', receivingId));
    }
    if (expIdx >= 0 && linkedExpenseId) {
      this.pushCloud('hapus belanja tertaut', () => supabase.from('non_food_expenses').delete().eq('id', linkedExpenseId));
    }

    this.notifyAllChanged();
    this.logAudit(
      user,
      'RECEIVING_LINE_DELETED',
      'RECEIVING',
      receivingId,
      `Menghapus baris penerimaan ${line.itemName} (${line.quantity} ${line.unit}) dari ${receivingId}` +
        (reversalTx ? `; stok dikurangi ${-reversalTx.quantity} ${reversalTx.unit}.` : '; stok tidak berubah (tidak ada transaksi penerimaan).')
    );
  }

  public recordNonFoodExpensesBatch(
    expenses: Omit<NonFoodExpense, 'id' | 'createdAt'>[],
    user: User
  ): NonFoodExpense[] {
    const created: NonFoodExpense[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];
      const newId = uniqueId('NFE');
      const newExpense: NonFoodExpense = {
        ...exp,
        id: newId,
        createdAt: now,
      };
      created.push(newExpense);
      this.nonFoodExpenses.unshift(newExpense);
    }

    // Direct batch upsert to Supabase Cloud
    if (isSupabaseConfigured() && created.length > 0) {
      supabase.from('non_food_expenses').upsert(created.map(mapExpenseToSupabase)).then(({ error }) => {
        if (error) console.error('Supabase batch expenses upsert error:', error);
      });
    }

    this.notifyAllChanged();
    this.logAudit(
      user,
      'NONFOOD_EXPENSES_BATCH_RECORDED',
      'INVENTORY',
      `BATCH-${Date.now()}`,
      `Mencatat masal ${created.length} barang pengeluaran harian sekaligus`
    );
    return created;
  }

  // --- PURCHASE ORDERS / NOTA PESANAN ---
  public getPurchaseOrders(): PurchaseOrderNota[] {
    return [...this.purchaseOrders]
      .map(po => {
        if (!po.approvedBy || po.approvedBy.includes('Siti Rahma')) {
          return { ...po, approvedBy: this.getSppgHeadName() };
        }
        return po;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public getPurchaseOrderById(id: string): PurchaseOrderNota | undefined {
    const po = this.purchaseOrders.find(p => p.id === id || p.poNumber === id);
    if (!po) return undefined;
    if (!po.approvedBy || po.approvedBy.includes('Siti Rahma')) {
      return { ...po, approvedBy: this.getSppgHeadName() };
    }
    return po;
  }

  public savePurchaseOrder(order: PurchaseOrderNota, user?: User): PurchaseOrderNota {
    const idx = this.purchaseOrders.findIndex(p => p.id === order.id);
    const updatedPoData = idx >= 0
      ? { ...order, updatedAt: new Date().toISOString() }
      : { ...order, createdAt: order.createdAt || new Date().toISOString() };

    if (idx >= 0) {
      this.purchaseOrders[idx] = updatedPoData;
    } else {
      this.purchaseOrders.unshift(updatedPoData);
    }

    // Direct save to Supabase Cloud
    if (isSupabaseConfigured()) {
      upsertPurchaseOrderRow(updatedPoData).then(({ error }) => {
        if (error) console.error('Supabase PO upsert error:', error);
      });
    }

    this.notifyAllChanged();

    if (user) {
      this.logAudit(
        user,
        idx >= 0 ? 'PO_UPDATED' : 'PO_CREATED',
        'RECEIVING',
        order.id,
        `Nota Pesanan / PO ${order.poNumber} untuk ${order.supplierName} total Rp ${order.grandTotal.toLocaleString('id-ID')}`
      );
    }
    return updatedPoData;
  }

  /**
   * Tutup PO yang barangnya sudah dicatat lewat jalur lain (Terima Barang manual, belanja langsung) atau tidak
   * jadi datang. Status jadi SELESAI tanpa menambah stok atau pengeluaran, supaya tidak lagi ditunggu.
   */
  public closePurchaseOrdersWithoutReceiving(ids: string[], reason: string, user: User): number {
    let closed = 0;
    ids.forEach(id => {
      const po = this.purchaseOrders.find(p => p.id === id);
      if (!po || po.status === 'SELESAI') return;
      const note = `Ditutup tanpa timbang: ${reason}`;
      this.savePurchaseOrder({ ...po, status: 'SELESAI', notes: po.notes ? `${po.notes}\n${note}` : note }, user);
      this.logAudit(user, 'PO_UPDATED', 'RECEIVING', po.id, `PO ${po.poNumber} (${po.supplierName}) ditutup tanpa timbang: ${reason}`);
      closed += 1;
    });
    return closed;
  }

  public deletePurchaseOrder(id: string, user?: User): boolean {
    const idx = this.purchaseOrders.findIndex(p => p.id === id);
    if (idx < 0) return false;
    const deleted = this.purchaseOrders.splice(idx, 1)[0];

    // Direct delete from Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('purchase_orders').delete().eq('id', id).then(({ error }) => {
        if (error) console.error('Supabase PO delete error:', error);
      });
    }

    try {
      removeFromPrintPool(deleted.id);
      removeFromPrintPool(deleted.poNumber);
    } catch {}

    // If this PO was linked to a MenuOrder, sync back and remove its arrival items
    if (deleted.relatedMenuOrderId) {
      const mOrder = this.menuOrders.find(m => m.id === deleted.relatedMenuOrderId);
      if (mOrder && mOrder.poArrivalItems) {
        const poItemNames = deleted.items.map(it => it.name.trim().toLowerCase());
        mOrder.poArrivalItems = mOrder.poArrivalItems.filter(
          it => !poItemNames.includes(it.itemName.trim().toLowerCase())
        );
      }
    }

    this.notifyAllChanged();

    if (user) {
      this.logAudit(user, 'PO_DELETED', 'RECEIVING', id, `Menghapus Nota Pesanan ${deleted.poNumber}`);
    }
    return true;
  }

  /**
   * Supplier di PO hanya rencana; yang dicatat adalah supplier yang benar-benar mengirim tiap bahan saat datang,
   * termasuk bahan tambahan di luar PO. Bila semua bahan datang dari supplier rencana tanpa tambahan, PO tidak
   * berubah. Selain itu PO dipecah jadi satu PO per supplier: PO asal dipakai untuk supplier rencana (pada PO
   * "Supplier menyusul": supplier pertama) dan nomornya tetap, supplier lain mendapat nomor PO baru.
   * Bahan tanpa supplier (tidak datang) ikut PO asal.
   */
  public splitPurchaseOrderBySupplier(
    poId: string,
    supplierByPoiId: Record<string, string>,
    user: User,
    extraItems: PurchaseOrderItem[] = []
  ): { success: boolean; message: string; pos?: PurchaseOrderNota[] } {
    const po = this.purchaseOrders.find(p => p.id === poId);
    if (!po) return { success: false, message: 'Nota Pesanan (PO) tidak ditemukan.' };
    if (po.status === 'SELESAI') return { success: false, message: `PO ${po.poNumber} sudah diterima sebelumnya.` };

    const plannedKey = isPendingSupplierPo(po) ? '' : po.supplierName.trim().toLowerCase();
    const groups = new Map<string, PurchaseOrderItem[]>();
    const unassigned: PurchaseOrderItem[] = [];
    [...po.items, ...extraItems].forEach(it => {
      const name = (supplierByPoiId[it.id] || '').trim();
      if (!name) {
        unassigned.push(it);
        return;
      }
      const key = name.toLowerCase();
      groups.set(key, [...(groups.get(key) || []), it]);
    });
    if (groups.size === 0) return { success: false, message: 'Pilih supplier untuk bahan yang datang.' };
    if (groups.size === 1 && groups.has(plannedKey) && extraItems.length === 0) return { success: true, message: '', pos: [po] };

    const totals = (items: PurchaseOrderItem[]) => {
      const subtotal = items.reduce((sum, it) => sum + (it.subtotal || it.quantity * it.unitPrice), 0);
      return { subtotal, grandTotal: subtotal, terbilang: angkaTerbilang(subtotal) };
    };
    // Supplier rencana didahulukan agar nomor PO asal tetap miliknya
    const ordered = [...groups.entries()].sort(([a], [b]) => Number(b === plannedKey) - Number(a === plannedKey));
    const result: PurchaseOrderNota[] = [];
    ordered.forEach(([key, items], i) => {
      const first = i === 0;
      const groupItems = first ? [...items, ...unassigned] : items;
      // Supplier rencana memakai data kontak di PO apa adanya
      const supplierFields =
        key === plannedKey
          ? {}
          : (() => {
              const supplier = this.quickAddSupplier(supplierByPoiId[items[0].id].trim(), user);
              return {
                supplierId: supplier.id,
                supplierName: supplier.name,
                supplierContact: supplier.phone ? `${supplier.phone} (${supplier.contactPerson || 'PIC'})` : '',
                supplierAddress: supplier.address || '',
                supplierPic: supplier.contactPerson || 'Pihak Rekanan',
              };
            })();
      const next: PurchaseOrderNota = {
        ...po,
        id: first ? po.id : uniqueId('PO'),
        poNumber: first ? po.poNumber : generateNextPoNumber(this.purchaseOrders, po.date),
        ...supplierFields,
        items: groupItems,
        ...totals(groupItems),
        createdAt: first ? po.createdAt : new Date().toISOString(),
      };
      // Simpan satu per satu supaya nomor PO berikutnya dihitung dari PO yang baru dibuat
      result.push(this.savePurchaseOrder(next, user));
    });
    this.logAudit(
      user,
      'PO_UPDATED',
      'RECEIVING',
      po.id,
      `PO ${po.poNumber} (${po.supplierName}) disesuaikan dengan supplier yang mengirim` +
        (extraItems.length > 0 ? `, ${extraItems.length} bahan di luar PO` : '') +
        `: ${result.map(r => `${r.poNumber} ${r.supplierName}`).join(', ')}`
    );
    return { success: true, message: '', pos: result };
  }

  public receiveAndCompletePurchaseOrder(
    poId: string,
    weighedItems: WeighedPoItemInput[],
    metadata: ReceivePoMetadata,
    user: User
  ): { success: boolean; message: string; po?: PurchaseOrderNota; receivingId?: string; unconvertedItems?: string[] } {
    const poIndex = this.purchaseOrders.findIndex(p => p.id === poId);
    if (poIndex < 0) {
      return { success: false, message: 'Nota Pesanan (PO) tidak ditemukan.' };
    }

    const po = this.purchaseOrders[poIndex];
    // A completed PO already posted its stock and expenses; receiving it again would double both.
    if (po.status === 'SELESAI') {
      return { success: false, message: `PO ${po.poNumber} sudah diterima sebelumnya. Penerimaan tidak bisa disimpan dua kali.` };
    }
    // Nota yang dibuat dari dokumen penerimaan: barangnya sudah masuk stok lewat Terima Barang.
    if (po.relatedReceivingId) {
      return {
        success: false,
        message: `Barang di ${po.poNumber} sudah masuk stok lewat penerimaan ${po.relatedReceivingId}. Penerimaan tidak disimpan lagi agar stok tidak dobel.`,
      };
    }
    const nowIso = new Date().toISOString();
    const todayStr = metadata.date || localDateIso();
    // Disimpan "HH:mm"; toLocaleTimeString('id-ID') menghasilkan "08.30" yang tidak bisa dibaca sebagai waktu.
    const arrivalTime = toClock(metadata.arrivalTime);

    // 1. Generate ReceivingDocument
    const receivingId = this.nextReceivingId();
    // Resolve each line to its master item up front so the receiving line, the new
    // master item (if any) and the stock transaction all share the same id.
    const receivingLines = weighedItems.map((item, idx) => ({
      id: `RL-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
      itemId:
        item.itemId ||
        this.items.find(i => i.name.trim().toLowerCase() === item.name.trim().toLowerCase())?.id ||
        `ITM-${Date.now().toString().slice(-5)}-${idx}`,
      itemName: item.name,
      category: item.category as any,
      quantity: item.actualQty,
      unit: item.unit as any,
      conditionNote: item.conditionNote || '',
    }));

    const receivingDoc: ReceivingDocument = {
      id: receivingId,
      date: todayStr,
      arrivalTime: arrivalTime,
      supplierId:
        metadata.supplierId ||
        po.supplierId ||
        this.suppliers.find(sp => sp.name.trim().toLowerCase() === (po.supplierName || '').trim().toLowerCase())?.id ||
        'SUP-DIRECT',
      supplierName: po.supplierName,
      deliveryNoteNo: metadata.deliveryNoteNo || undefined,
      receiverId: user.id,
      receiverName: user.name,
      receiverRole: user.role,
      status: 'VERIFIED_POSTED',
      notes: metadata.notes || `Penerimaan & penimbangan fisik dari PO ${po.poNumber}`,
      lines: receivingLines,
      supplierSignature: metadata.supplierSignature,
      receiverSignature: metadata.receiverSignature,
      createdAt: nowIso,
    };

    this.receivings.unshift(receivingDoc);

    // Save receiving doc to Supabase Cloud
    // Semua baris server dikumpulkan dulu, lalu dikirim berurutan di akhir (lihat pushCloudSequence).
    const cloudSteps: Array<[string, () => PromiseLike<{ error: any }>]> = [];
    const docRow = mapReceivingToSupabase(receivingDoc);
    const lineRows = receivingLines.map(l => mapLineToSupabase(l, receivingId));
    cloudSteps.push([`simpan penerimaan ${receivingId}`, () => supabase.from('receiving_documents').insert(docRow)]);

    // 2. Auto-update Inventory Stock & Transactions if selected
    // Bahan yang satuannya tidak bisa dikonversi ke satuan stok (mis. Pcs ke Kg) tidak ditambahkan,
    // supaya stok tidak tercampur; petugas diminta menyesuaikan lewat koreksi stok.
    const unconvertedItems: string[] = [];
    const txSteps: Array<[string, () => PromiseLike<{ error: any }>]> = [];
    if (metadata.autoUpdateStock !== false) {
      weighedItems.forEach((itemInput, idx) => {
        if (itemInput.actualQty <= 0) return;

        let targetItem = this.items.find(
          i => (itemInput.itemId && i.id === itemInput.itemId) ||
               i.name.trim().toLowerCase() === itemInput.name.trim().toLowerCase()
        );

        let itemToUpdate: ItemMaster;
        if (!targetItem) {
          const newSku = receivingLines[idx].itemId;
          itemToUpdate = {
            id: newSku,
            name: itemInput.name,
            category: itemInput.category as any,
            currentStock: 0,
            baseUnit: (itemInput.unit as any) || 'Kg',
            minimumStock: 5,
            reorderPoint: 10,
            location: 'Gudang Utama SPPG',
            itemType: itemInput.category === 'Bahan Basah' ? 'FOOD_DAILY_FLOW' : 'FOOD_CARRYING_STOCK',
            expiryTrackingEnabled: false,
            isActive: true,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          this.items.unshift(itemToUpdate);
        } else {
          itemToUpdate = targetItem;
        }

        const stockQty = convertQty(itemInput.actualQty, itemInput.unit, itemToUpdate.baseUnit);
        if (stockQty === null) {
          unconvertedItems.push(`${itemInput.name} (${itemInput.unit} → ${itemToUpdate.baseUnit})`);
          return;
        }
        const convertedNote =
          unitKey(itemInput.unit) !== unitKey(itemToUpdate.baseUnit)
            ? ` Diterima ${itemInput.actualQty} ${itemInput.unit} = ${stockQty} ${itemToUpdate.baseUnit}.`
            : '';

        const newStock = Math.round((itemToUpdate.currentStock + stockQty) * 1000) / 1000;
        itemToUpdate.currentStock = newStock;
        itemToUpdate.updatedAt = nowIso;
        itemToUpdate.lastMovementDate = todayStr;

        const tx: InventoryTransaction = {
          id: uniqueId('TX'),
          timestamp: `${todayStr} ${arrivalTime}`,
          itemId: itemToUpdate.id,
          itemName: itemToUpdate.name,
          itemType: itemToUpdate.itemType,
          category: itemToUpdate.category,
          location: itemToUpdate.location,
          quantity: stockQty,
          unit: itemToUpdate.baseUnit,
          transactionType: 'RECEIVING',
          referenceDocument: po.poNumber,
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          notes: `Penerimaan resmi PO ${po.poNumber} (${po.supplierName}).${convertedNote} ${itemInput.conditionNote || ''}`.trim(),
          balanceAfter: newStock,
        };
        this.transactions.unshift(tx);

        const itemRow = mapItemToSupabase(itemToUpdate);
        const txRow = mapTxToSupabase(tx);
        // Barang baru harus ada di server sebelum rincian penerimaan dan mutasinya yang merujuk barang itu.
        cloudSteps.push([`simpan stok "${itemToUpdate.name}"`, () => supabase.from('item_master').upsert(itemRow)]);
        txSteps.push([`simpan mutasi stok "${itemToUpdate.name}"`, () => supabase.from('inventory_transactions').insert(txRow)]);
      });
    }

    // 3. Auto-record to Non-Food / Food Expense Report
    const expenseIds: string[] = [];
    if (metadata.autoRecordExpense !== false) {
      weighedItems.forEach((itemInput, idx) => {
        if (itemInput.actualQty <= 0) return;
        const expId = uniqueId('NFE');
        const newExpense: NonFoodExpense = {
          id: expId,
          date: todayStr,
          time: arrivalTime.replace(':', '.'),
          itemName: itemInput.name,
          category: itemInput.category,
          quantity: itemInput.actualQty,
          unit: itemInput.unit,
          unitPrice: itemInput.unitPrice,
          totalCost: itemInput.subtotal || Math.round(itemInput.actualQty * itemInput.unitPrice),
          department: 'Dapur Pengolahan Utama',
          volunteer: user.name,
          pic: user.name,
          recipient: po.supplierName,
          receiptRef: po.poNumber,
          // Penanda [GR: id] menautkan belanja ini ke dokumen penerimaannya agar riwayat tidak dobel.
          notes: `[GR: ${receivingDoc.id}] Belanja bahan PO ${po.poNumber} (${po.supplierName}). ${itemInput.notes || ''}`.trim(),
          createdAt: nowIso,
        };
        expenseIds.push(expId);
        this.nonFoodExpenses.unshift(newExpense);

        const expenseRow = mapExpenseToSupabase(newExpense);
        txSteps.push([`simpan belanja "${itemInput.name}"`, () => supabase.from('non_food_expenses').upsert(expenseRow)]);
      });
    }

    // 4. Update the Purchase Order itself: mark as SELESAI
    const updatedPoItems: PurchaseOrderItem[] = weighedItems.map((w, idx) => ({
      ...(po.items.find(orig => orig.id === w.poiId) || {}),
      id: w.poiId,
      itemId: w.itemId || receivingLines[idx].itemId,
      name: w.name,
      category: w.category,
      quantity: w.actualQty,
      unit: w.unit,
      unitPrice: w.unitPrice,
      subtotal: w.subtotal,
      notes: w.conditionNote ? `${w.conditionNote}${w.notes ? ' | ' + w.notes : ''}` : w.notes,
    }));

    const newGrandTotal = updatedPoItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);

    const updatedPo: PurchaseOrderNota = {
      ...po,
      items: updatedPoItems,
      subtotal: newGrandTotal,
      grandTotal: newGrandTotal,
      terbilang: angkaTerbilang(newGrandTotal),
      status: 'SELESAI',
      relatedReceivingId: receivingId,
      relatedExpenseIds: expenseIds.length > 0 ? expenseIds : po.relatedExpenseIds,
      updatedAt: nowIso,
    };

    this.purchaseOrders[poIndex] = updatedPo;

    this.pushCloudSequence([
      ...cloudSteps,
      [`simpan rincian penerimaan ${receivingId}`, () => supabase.from('receiving_lines').insert(lineRows)],
      ...txSteps,
      [`tandai ${po.poNumber} selesai`, () => upsertPurchaseOrderRow(updatedPo)],
    ]);

    // 5. Sync back to Menu Orders poArrivalItems if applicable
    const targetMenuOrderId = po.relatedMenuOrderId;
    this.menuOrders.forEach((mOrder, mIdx) => {
      let orderChanged = false;
      const shouldSync = targetMenuOrderId ? mOrder.id === targetMenuOrderId : mOrder.date === po.date;
      if (shouldSync && mOrder.poArrivalItems && mOrder.poArrivalItems.length > 0) {
        const updatedArrivals = mOrder.poArrivalItems.map(arrItem => {
          const matchedWeighed = weighedItems.find(
            w => w.name.trim().toLowerCase() === arrItem.itemName.trim().toLowerCase()
          );
          if (matchedWeighed) {
            orderChanged = true;
            return {
              ...arrItem,
              qtyArrived: `${matchedWeighed.actualQty} ${matchedWeighed.unit}`,
              arrivalTime: arrivalTime.replace(':', '.'),
              unitPrice: matchedWeighed.unitPrice,
              totalCost: matchedWeighed.subtotal,
              notes: matchedWeighed.conditionNote || arrItem.notes,
            };
          }
          return arrItem;
        });

        if (orderChanged) {
          this.menuOrders[mIdx] = {
            ...mOrder,
            poArrivalItems: updatedArrivals,
          };
          this.pushMenuOrder(this.menuOrders[mIdx]);
        }
      }
    });

    this.notifyAllChanged();

    // 6. Audit Trail
    this.logAudit(
      user,
      'PO_RECEIVED_COMPLETED',
      'RECEIVING',
      po.id,
      `Penerimaan & penimbangan fisik PO ${po.poNumber} dari ${po.supplierName}. Total Rp ${newGrandTotal.toLocaleString('id-ID')}, ${weighedItems.filter(w => w.actualQty > 0).length} dari ${weighedItems.length} bahan diterima.`
    );

    return {
      success: true,
      message:
        unconvertedItems.length > 0
          ? `Penerimaan PO ${po.poNumber} tersimpan, tetapi stok bahan berikut belum ditambah karena satuannya berbeda dengan satuan stok: ${unconvertedItems.join(', ')}. Sesuaikan lewat koreksi stok.`
          : `Penerimaan PO ${po.poNumber} berhasil diselesaikan. Stok gudang dan laporan pengeluaran telah diperbarui!`,
      unconvertedItems,
      po: updatedPo,
      receivingId,
    };
  }

  // --- MENU ORDERS ---
  public getMenuOrders(): MenuOrder[] {
    return [...this.menuOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  private pushMenuOrder(order: MenuOrder): void {
    this.pushCloud('menu_orders', () => supabase.from('menu_orders').upsert(mapMenuOrderToSupabase(order)));
  }

  public saveMenuOrder(order: MenuOrder, user: User, isNew: boolean = false): MenuOrder {
    if (isNew) {
      this.menuOrders.unshift(order);
      this.logAudit(
        user,
        'MENU_ORDER_CREATED',
        'OPERATIONAL',
        order.id,
        `Membuat Order Menu: ${order.menuTitle} (${order.targetPortions} porsi) - Sesi ${order.mealSession}`
      );
    } else {
      const idx = this.menuOrders.findIndex(o => o.id === order.id);
      if (idx >= 0) {
        this.menuOrders[idx] = order;
        this.logAudit(
          user,
          'MENU_ORDER_UPDATED',
          'OPERATIONAL',
          order.id,
          `Memperbarui Order Menu: ${order.menuTitle} (${order.status})`
        );
      } else {
        this.menuOrders.unshift(order);
      }
    }
    setStored(STORAGE_KEYS.MENU_ORDERS, this.menuOrders);
    this.pushMenuOrder(order);
    return order;
  }

  public updateMenuOrderStatus(orderId: string, status: MenuOrder['status'], user: User): MenuOrder {
    const idx = this.menuOrders.findIndex(o => o.id === orderId);
    if (idx < 0) throw new Error('Order menu tidak ditemukan');
    const old = this.menuOrders[idx];
    const updated: MenuOrder = { ...old, status };
    this.menuOrders[idx] = updated;
    setStored(STORAGE_KEYS.MENU_ORDERS, this.menuOrders);
    this.pushMenuOrder(updated);

    this.logAudit(
      user,
      'MENU_ORDER_STATUS_CHANGED',
      'OPERATIONAL',
      orderId,
      `Status order ${old.menuTitle} diubah dari ${old.status} ke ${status}`
    );
    return updated;
  }

  /** PO yang barangnya sudah diterima atau sudah dibayar dikunci: tidak boleh dihapus atau diterbitkan ulang. */
  public isPurchaseOrderLocked(po: PurchaseOrderNota): boolean {
    return po.status === 'SELESAI' || po.status === 'DIBAYAR' || !!po.relatedReceivingId;
  }

  /**
   * PO milik satu menu. PO lama yang belum punya relatedMenuOrderId dikenali dari catatan otomatisnya,
   * dengan tanggal dan judul menu yang persis sama, agar PO menu lain di tanggal yang sama tidak ikut terbawa.
   */
  public getPurchaseOrdersByMenuOrderId(menuOrderId: string): PurchaseOrderNota[] {
    const targetOrder = this.menuOrders.find(o => o.id === menuOrderId);
    return this.purchaseOrders.filter(po =>
      po.relatedMenuOrderId
        ? po.relatedMenuOrderId === menuOrderId
        : !!targetOrder &&
          po.date === targetOrder.date &&
          !!po.notes?.includes(`Perencanaan Menu: ${targetOrder.menuTitle} (`)
    );
  }

  /** Hapus PO milik menu yang belum dikunci. PO yang sudah diterima atau dibayar tetap disimpan. */
  public deletePurchaseOrdersByMenuOrderId(menuOrderId: string, user?: User): number {
    const targetOrder = this.menuOrders.find(o => o.id === menuOrderId);
    const linked = this.getPurchaseOrdersByMenuOrderId(menuOrderId);
    const removedPos = linked.filter(po => !this.isPurchaseOrderLocked(po));
    const hasLocked = removedPos.length < linked.length;
    const removedIds = new Set(removedPos.map(po => po.id));

    if (removedPos.length > 0) {
      this.purchaseOrders = this.purchaseOrders.filter(po => !removedIds.has(po.id));
      removedPos.forEach(po => {
        try {
          removeFromPrintPool(po.id);
          removeFromPrintPool(po.poNumber);
        } catch {}
      });
      setStored(STORAGE_KEYS.PURCHASE_ORDERS, this.purchaseOrders);

      // Tanpa ini PO lama tetap ada di cloud dan muncul lagi (dobel) setelah halaman dimuat ulang.
      if (isSupabaseConfigured()) {
        supabase.from('purchase_orders').delete().in('id', Array.from(removedIds)).then(({ error }) => {
          if (error) console.error('Supabase PO delete error:', error);
        });
      }

      if (targetOrder && !hasLocked) {
        targetOrder.poArrivalItems = [];
        setStored(STORAGE_KEYS.MENU_ORDERS, this.menuOrders);
        this.pushMenuOrder(targetOrder);
      }
      if (user) {
        this.logAudit(
          user,
          'PO_DELETED_BY_MENU',
          'RECEIVING',
          menuOrderId,
          `Menghapus ${removedPos.length} Nota PO resmi terkait menu order ${targetOrder?.menuTitle || menuOrderId}`
        );
      }
    }
    return removedPos.length;
  }

  public deleteMenuOrder(orderId: string, user: User): boolean {
    const idx = this.menuOrders.findIndex(o => o.id === orderId);
    if (idx < 0) return false;
    const removed = this.menuOrders[idx];

    // Cascade delete any purchase orders linked to this menu order
    this.deletePurchaseOrdersByMenuOrderId(orderId, user);

    this.menuOrders.splice(idx, 1);
    setStored(STORAGE_KEYS.MENU_ORDERS, this.menuOrders);
    this.pushCloud('menu_orders', () => supabase.from('menu_orders').delete().eq('id', orderId));
    this.logAudit(
      user,
      'MENU_ORDER_DELETED',
      'OPERATIONAL',
      orderId,
      `Menghapus Order Menu: ${removed.menuTitle} (${removed.date})`
    );
    return true;
  }

  // --- WASTE LOGS ---
  public getWasteLogs(): WasteLog[] {
    return [...this.wasteLogs].sort((a, b) => b.date.localeCompare(a.date));
  }

  private nextWasteId(suffix?: number): string {
    const base = `WST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return suffix !== undefined ? `${base}-${suffix}` : base;
  }

  private syncWasteUpsert(logs: WasteLog[]): void {
    if (!isSupabaseConfigured() || logs.length === 0) return;
    supabase.from('waste_logs').upsert(logs.map(mapWasteToSupabase)).then(({ error }) => {
      if (error) console.error('Supabase waste_logs upsert error:', error);
    });
  }

  private syncWasteDelete(ids: string[]): void {
    if (!isSupabaseConfigured() || ids.length === 0) return;
    supabase.from('waste_logs').delete().in('id', ids).then(({ error }) => {
      if (error) console.error('Supabase waste_logs delete error:', error);
    });
  }

  public recordWasteLog(
    log: Omit<WasteLog, 'id' | 'createdAt'>,
    user: User
  ): WasteLog {
    return this.recordWasteBatch([log], user)[0];
  }

  public recordWasteBatch(
    logs: Omit<WasteLog, 'id' | 'createdAt'>[],
    user: User
  ): WasteLog[] {
    const createdAt = new Date().toISOString();
    const createdLogs: WasteLog[] = logs.map((log, index) => ({
      ...log,
      day: wasteDayName(log.date),
      id: this.nextWasteId(index + 1),
      createdAt,
    }));

    this.wasteLogs = [...createdLogs, ...this.wasteLogs];
    this.syncWasteUpsert(createdLogs);

    this.logAudit(
      user,
      'WASTE_BATCH_RECORDED',
      'OPERATIONAL',
      createdLogs[0]?.id || 'WST',
      `Pencatatan limbah: ${createdLogs
        .map(l => `${l.itemName || l.wasteCategory} ${l.quantity} ${l.unit}`)
        .join(', ')}`
    );

    return createdLogs;
  }

  public deleteWasteLog(id: string, user: User): boolean {
    const idx = this.wasteLogs.findIndex(w => w.id === id);
    if (idx < 0) return false;
    const removed = this.wasteLogs[idx];
    this.wasteLogs.splice(idx, 1);
    this.syncWasteDelete([id]);

    this.logAudit(
      user,
      'WASTE_DELETED',
      'OPERATIONAL',
      id,
      `Menghapus catatan limbah: ${removed.itemName || removed.wasteCategory} (${removed.quantity} ${removed.unit})`
    );
    return true;
  }

  public saveDailyNutritionLog(
    date: string,
    _day: string,
    items: {
      category: 'karbohidrat' | 'sayur' | 'protein hewani' | 'protein nabati' | 'buah';
      quantity: number;
      unit?: string;
      disposalMethod?: DisposalMethod;
      notes?: string;
    }[],
    user: User
  ): WasteLog[] {
    // Simpan ulang 5 kategori sisa makanan untuk tanggal ini; catatan limbah lain di tanggal yang sama tidak disentuh.
    const replaced = this.wasteLogs.filter(w => w.date === date && WASTE_NUTRITION_CATEGORIES.has(w.wasteCategory.toLowerCase()));
    this.wasteLogs = this.wasteLogs.filter(w => !replaced.includes(w));

    const createdAt = new Date().toISOString();
    const createdLogs: WasteLog[] = items.map((item, idx) => ({
      id: this.nextWasteId(idx + 1),
      day: wasteDayName(date),
      date,
      wasteCategory: item.category,
      itemName: `Sisa ${item.category}`,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || 'Kg',
      sourceArea: 'Dapur SPPG Tumpang Jeru',
      reason: undefined,
      disposalMethod: item.disposalMethod || 'Pakan Ternak & Kompos Organik',
      recordedBy: user.name,
      notes: item.notes || undefined,
      createdAt,
    }));

    this.wasteLogs = [...createdLogs, ...this.wasteLogs];
    this.syncWasteDelete(replaced.map(w => w.id));
    this.syncWasteUpsert(createdLogs);

    this.logAudit(
      user,
      replaced.length > 0 ? 'WASTE_DAILY_UPDATED' : 'WASTE_DAILY_RECORDED',
      'OPERATIONAL',
      `DAY-${date}`,
      `${replaced.length > 0 ? 'Ubah' : 'Input'} rekap sisa makanan ${date}: ${items.map(i => `${i.category} ${i.quantity} kg`).join(', ')}`
    );

    return createdLogs;
  }

  // Hanya menghapus 5 kategori sisa makanan pada tanggal itu, bukan limbah dapur lain.
  public deleteDailyWasteLogs(date: string, user: User): boolean {
    const removed = this.wasteLogs.filter(w => w.date === date && WASTE_NUTRITION_CATEGORIES.has(w.wasteCategory.toLowerCase()));
    if (removed.length === 0) return false;
    this.wasteLogs = this.wasteLogs.filter(w => !removed.includes(w));
    this.syncWasteDelete(removed.map(w => w.id));
    this.logAudit(
      user,
      'WASTE_DAILY_DELETED',
      'OPERATIONAL',
      `DAY-${date}`,
      `Menghapus rekap sisa makanan tanggal ${date}`
    );
    return true;
  }

  // --- DAILY TODOS ---
  public getDailyTodos(date?: string): DailyTodoItem[] {
    const targetDate = date || localDateIso();
    const filtered = this.todos.filter(t => t.date === targetDate);
    // If no todos exist for requested date, and it's today, seed today's items
    if (filtered.length === 0 && targetDate === localDateIso()) {
      // ID diberi tanggal: dulu memakai ID template yang sama setiap hari sehingga saling menimpa.
      const seeded = INITIAL_TODOS.map(t => ({ ...t, id: `${t.id}-${targetDate}`, date: targetDate, isCompleted: false, completedAt: undefined, completedBy: undefined }));
      this.todos.push(...seeded);
      setStored(STORAGE_KEYS.TODOS, this.todos);
      this.pushCloud('daily_todos', () => supabase.from('daily_todos').upsert(seeded.map(mapTodoToSupabase)));
      return [...seeded];
    }
    // Tanggal tanpa tugas tetap kosong; dulu mengembalikan seluruh riwayat sehingga progres dan daftar kacau.
    return filtered;
  }

  public getAllTodos(): DailyTodoItem[] {
    return [...this.todos];
  }

  public addTodo(
    todo: Omit<DailyTodoItem, 'id' | 'createdAt'>,
    user?: User
  ): DailyTodoItem {
    const newId = `TODO-${Date.now().toString().slice(-6)}`;
    const newTodo: DailyTodoItem = {
      ...todo,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    this.todos.unshift(newTodo);
    setStored(STORAGE_KEYS.TODOS, this.todos);
    this.pushCloud('daily_todos', () => supabase.from('daily_todos').upsert(mapTodoToSupabase(newTodo)));

    if (user) {
      this.logAudit(
        user,
        'TODO_CREATED',
        'OPERATIONAL',
        newId,
        `Menambahkan Tugas Harian: ${newTodo.title} [${newTodo.category}]`
      );
    }
    return newTodo;
  }

  public toggleTodo(id: string, user?: User): DailyTodoItem {
    const idx = this.todos.findIndex(t => t.id === id);
    if (idx < 0) throw new Error('Tugas harian tidak ditemukan');
    const old = this.todos[idx];
    const newCompleted = !old.isCompleted;
    const nowTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const updated: DailyTodoItem = {
      ...old,
      isCompleted: newCompleted,
      completedAt: newCompleted ? nowTime : undefined,
      completedBy: newCompleted ? (user ? `${user.name} (${user.role})` : 'Petugas') : undefined,
    };
    this.todos[idx] = updated;
    setStored(STORAGE_KEYS.TODOS, this.todos);
    this.pushCloud('daily_todos', () => supabase.from('daily_todos').upsert(mapTodoToSupabase(updated)));

    if (user) {
      this.logAudit(
        user,
        newCompleted ? 'TODO_COMPLETED' : 'TODO_REOPENED',
        'OPERATIONAL',
        id,
        `${newCompleted ? 'Menyelesaikan' : 'Membuka kembali'} Tugas Harian: ${old.title}`
      );
    }
    return updated;
  }

  public deleteTodo(id: string, user?: User): boolean {
    const idx = this.todos.findIndex(t => t.id === id);
    if (idx < 0) return false;
    const old = this.todos[idx];
    this.todos.splice(idx, 1);
    setStored(STORAGE_KEYS.TODOS, this.todos);
    this.pushCloud('daily_todos', () => supabase.from('daily_todos').delete().eq('id', id));

    if (user) {
      this.logAudit(
        user,
        'TODO_DELETED',
        'OPERATIONAL',
        id,
        `Menghapus Tugas Harian: ${old.title}`
      );
    }
    return true;
  }

  public resetDailyTodos(date?: string): DailyTodoItem[] {
    const targetDate = date || localDateIso();
    const removedIds = this.todos.filter(t => t.date === targetDate).map(t => t.id);
    this.todos = this.todos.filter(t => t.date !== targetDate);
    const seeded = INITIAL_TODOS.map(t => ({
      ...t,
      date: targetDate,
      id: `TODO-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
    }));
    this.todos.push(...seeded);
    setStored(STORAGE_KEYS.TODOS, this.todos);
    if (removedIds.length > 0) {
      this.pushCloud('daily_todos', () => supabase.from('daily_todos').delete().in('id', removedIds));
    }
    this.pushCloud('daily_todos', () => supabase.from('daily_todos').upsert(seeded.map(mapTodoToSupabase)));
    return seeded;
  }

  // --- EMPLOYEES & ATTENDANCE OPERATIONS ---
  public getEmployees(): Employee[] {
    return [...this.employees];
  }

  public getEmployeeById(id: string): Employee | undefined {
    return this.employees.find(e => e.id === id);
  }

  public saveEmployee(empData: Omit<Employee, 'id'> | Employee, user: User): Employee {
    const existingIndex = 'id' in empData && empData.id ? this.employees.findIndex(e => e.id === empData.id) : -1;
    let savedEmployee: Employee;

    if (existingIndex >= 0 && 'id' in empData) {
      savedEmployee = { ...this.employees[existingIndex], ...empData };
      this.employees[existingIndex] = savedEmployee;
      this.logAudit(user, 'UPDATE', 'STAFF', savedEmployee.id, `Memperbarui data karyawan: ${savedEmployee.name} (${savedEmployee.nip})`);
    } else {
      // Dari nomor terbesar, bukan jumlah: setelah ada yang dihapus, jumlah+1 bisa bentrok.
      const maxNum = this.employees.reduce((m, e) => Math.max(m, parseInt(e.id.replace(/\D/g, ''), 10) || 0), 0);
      const nextId = `EMP-${String(maxNum + 1).padStart(3, '0')}`;
      savedEmployee = {
        ...empData,
        id: ('id' in empData && empData.id) ? empData.id : nextId,
      };
      this.employees.push(savedEmployee);
      this.logAudit(user, 'CREATE', 'STAFF', savedEmployee.id, `Mendaftarkan karyawan baru: ${savedEmployee.name} (${savedEmployee.nip})`);
    }

    setStored(STORAGE_KEYS.EMPLOYEES, this.employees);
    this.pushCloud('employees', () => supabase.from('employees').upsert(mapEmployeeToSupabase(savedEmployee)));
    return savedEmployee;
  }

  public updateEmployee(id: string, updates: Partial<Employee>, user: User): Employee {
    const index = this.employees.findIndex(e => e.id === id);
    if (index === -1) throw new Error(`Karyawan dengan ID ${id} tidak ditemukan.`);

    this.employees[index] = { ...this.employees[index], ...updates };
    setStored(STORAGE_KEYS.EMPLOYEES, this.employees);
    const updatedEmp = this.employees[index];
    this.pushCloud('employees', () => supabase.from('employees').upsert(mapEmployeeToSupabase(updatedEmp)));
    this.logAudit(user, 'UPDATE', 'STAFF', id, `Memperbarui profil staf: ${this.employees[index].name}`);
    return this.employees[index];
  }

  public deleteEmployee(id: string, user: User): void {
    const emp = this.employees.find(e => e.id === id);
    this.employees = this.employees.filter(e => e.id !== id);
    setStored(STORAGE_KEYS.EMPLOYEES, this.employees);
    this.pushCloud('employees', () => supabase.from('employees').delete().eq('id', id));
    if (emp) {
      this.logAudit(user, 'DELETE', 'STAFF', id, `Menghapus data staf: ${emp.name} (${emp.nip})`);
    }
  }

  public getAttendanceLogs(dateFilter?: string): EmployeeAttendance[] {
    if (dateFilter) {
      return this.attendanceLogs.filter(a => a.date === dateFilter);
    }
    return [...this.attendanceLogs];
  }

  public recordAttendance(
    attData: Omit<EmployeeAttendance, 'id' | 'createdAt'>,
    user: User
  ): EmployeeAttendance {
    const existingIndex = this.attendanceLogs.findIndex(
      a => a.employeeId === attData.employeeId && a.date === attData.date
    );

    let savedRecord: EmployeeAttendance;
    if (existingIndex >= 0) {
      savedRecord = {
        ...this.attendanceLogs[existingIndex],
        ...attData,
      };
      this.attendanceLogs[existingIndex] = savedRecord;
      this.logAudit(user, 'UPDATE', 'ATTENDANCE', savedRecord.id, `Update absensi: ${savedRecord.employeeName} (${savedRecord.status}) tgl ${savedRecord.date}`);
    } else {
      // Satu absensi per karyawan per hari, jadi ID dari tanggal + karyawan (tidak bentrok antar perangkat).
      const newId = `ATT-${attData.date.replace(/-/g, '')}-${attData.employeeId}`;
      savedRecord = {
        ...attData,
        id: newId,
        createdAt: new Date().toISOString(),
      };
      this.attendanceLogs.push(savedRecord);
      this.logAudit(user, 'CREATE', 'ATTENDANCE', savedRecord.id, `Pencatatan absensi: ${savedRecord.employeeName} (${savedRecord.status}) tgl ${savedRecord.date}`);
    }

    setStored(STORAGE_KEYS.ATTENDANCE, this.attendanceLogs);
    this.pushCloud('attendance_logs', () => supabase.from('attendance_logs').upsert(mapAttendanceToSupabase(savedRecord)));
    return savedRecord;
  }

  public recordBatchAttendance(
    entries: Omit<EmployeeAttendance, 'id' | 'createdAt'>[],
    user: User
  ): EmployeeAttendance[] {
    const results: EmployeeAttendance[] = [];
    for (const entry of entries) {
      const res = this.recordAttendance(entry, user);
      results.push(res);
    }
    return results;
  }

  /** Foto absen diambil saat dibuka, karena kolom foto tidak ikut dimuat saat sinkron. */
  public async getAttendancePhoto(id: string): Promise<string | undefined> {
    const local = this.attendanceLogs.find(a => a.id === id)?.photoUrl;
    if (local) return local;
    if (!isSupabaseConfigured()) return undefined;
    const { data, error } = await supabase.from('attendance_logs').select('photo_url').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as { photo_url?: string | null } | null)?.photo_url || undefined;
  }

  /**
   * Menghapus foto absen yang lebih tua dari masa simpan, sekali sehari per perangkat.
   * Jam masuk/pulang, status, dan catatan tidak disentuh.
   */
  public purgeOldAttendancePhotos(): void {
    const today = localDateIso();
    const KEY = 'sppg_attendance_photo_purge_date';
    try {
      if (localStorage.getItem(KEY) === today) return;
      localStorage.setItem(KEY, today);
    } catch {
      /* localStorage tidak tersedia: tetap jalankan */
    }
    const cutoff = localDateIso(new Date(Date.now() - ATTENDANCE_PHOTO_RETENTION_DAYS * 86400000));
    let changed = false;
    this.attendanceLogs = this.attendanceLogs.map(a => {
      if (a.date < cutoff && a.photoUrl) {
        changed = true;
        return { ...a, photoUrl: undefined };
      }
      return a;
    });
    if (changed) setStored(STORAGE_KEYS.ATTENDANCE, this.attendanceLogs);
    this.pushCloud('attendance_logs (hapus foto lama)', () =>
      supabase.from('attendance_logs').update({ photo_url: null }).lt('date', cutoff).not('photo_url', 'is', null)
    );
  }

  public deleteAttendance(id: string, user: User): void {
    const att = this.attendanceLogs.find(a => a.id === id);
    this.attendanceLogs = this.attendanceLogs.filter(a => a.id !== id);
    setStored(STORAGE_KEYS.ATTENDANCE, this.attendanceLogs);
    this.pushCloud('attendance_logs', () => supabase.from('attendance_logs').delete().eq('id', id));
    if (att) {
      this.logAudit(user, 'DELETE', 'ATTENDANCE', id, `Menghapus data presensi: ${att.employeeName} tgl ${att.date}`);
    }
  }

  // --- RE-SEED / RESET DATA ---
  public resetToSeedData(): void {
    this.resetToDefault();
  }

  // Clear all transaction data (Receiving, PO, Transactions, Non-Food Expenses, Stock Opname, Menu, Waste)
  // and set stock of all item master to 0, but preserve Users, Suppliers, and Master Item Catalog
  public clearTransactionsOnly(): void {
    this.receivings = [];
    this.transactions = [];
    this.nonFoodExpenses = [];
    this.purchaseOrders = [];
    this.opnames = [];
    this.menuOrders = [];
    this.wasteLogs = [];

    // Reset currentStock of all items to 0
    this.items = this.items.map(item => ({
      ...item,
      currentStock: 0,
    }));

    // Direct clear on Supabase Cloud
    if (isSupabaseConfigured()) {
      supabase.from('receiving_lines').delete().neq('id', '___').then();
      supabase.from('receiving_documents').delete().neq('id', '___').then();
      supabase.from('inventory_transactions').delete().neq('id', '___').then();
      supabase.from('non_food_expenses').delete().neq('id', '___').then();
      supabase.from('purchase_orders').delete().neq('id', '___').then();
      supabase.from('waste_logs').delete().neq('id', '___').then();
      supabase.from('item_master').update({ current_stock: 0, updated_at: new Date().toISOString() }).neq('id', '___').then();
    }

    // Clear PO print pool and PO sequence counter so fresh testing starts cleanly at 134
    try {
      localStorage.removeItem('sppg_po_print_pool');
      localStorage.removeItem('sppg_po_last_number_state');
    } catch (e) {
      console.warn('Could not clear PO pool / state:', e);
    }

    this.notifyAllChanged();

    this.logAudit(
      { id: 'SYS-001', name: 'System Admin', email: 'admin@sppg.id', role: 'SUPERADMIN' },
      'UPDATE',
      'SETTINGS',
      'CLEARED_TRANSACTIONS',
      'Data transaksi berhasil dibersihkan dan stok di-reset ke 0 untuk pengujian data baru.'
    );
  }

  public resetToDefault(): void {
    localStorage.removeItem('sppg_transactions_cleared_v1');
    localStorage.removeItem('sppg_auto_clean_transactions_20261001');
    localStorage.removeItem(STORAGE_KEYS.ITEMS);
    localStorage.removeItem(STORAGE_KEYS.SUPPLIERS);
    localStorage.removeItem(STORAGE_KEYS.RECEIVINGS);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.OPNAMES);
    localStorage.removeItem(STORAGE_KEYS.EQUIPMENT);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.NONFOOD_EXPENSES);
    localStorage.removeItem(STORAGE_KEYS.MENU_ORDERS);
    localStorage.removeItem(STORAGE_KEYS.WASTE_LOGS);
    localStorage.removeItem(STORAGE_KEYS.TODOS);
    localStorage.removeItem(STORAGE_KEYS.EMPLOYEES);
    localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
    localStorage.removeItem(STORAGE_KEYS.PURCHASE_ORDERS);
    localStorage.removeItem('sppg_po_print_pool');
    localStorage.removeItem('sppg_po_last_number_state');

    this.items = [...INITIAL_ITEMS];
    this.suppliers = [...INITIAL_SUPPLIERS];
    localStorage.removeItem('sppg_real_suppliers_clean_v6');
    this.cleanAndSyncRealSuppliers();
    this.receivings = [...INITIAL_RECEIVINGS];
    this.transactions = [...INITIAL_TRANSACTIONS];
    this.opnames = [...INITIAL_OPNAMES];
    this.equipment = [...INITIAL_EQUIPMENT];
    this.auditLogs = [...INITIAL_AUDIT_LOGS];
    this.nonFoodExpenses = [...INITIAL_NONFOOD_EXPENSES];
    this.purchaseOrders = [...INITIAL_PURCHASE_ORDERS];
    this.menuOrders = [...INITIAL_MENU_ORDERS];
    this.wasteLogs = [...INITIAL_WASTE_LOGS];
    this.todos = [...INITIAL_TODOS];
    this.employees = [...REAL_EMPLOYEES];
    this.attendanceLogs = [...REAL_ATTENDANCE_LOGS];

    setStored(STORAGE_KEYS.ITEMS, this.items);
    setStored(STORAGE_KEYS.SUPPLIERS, this.suppliers);
    setStored(STORAGE_KEYS.RECEIVINGS, this.receivings);
    setStored(STORAGE_KEYS.TRANSACTIONS, this.transactions);
    setStored(STORAGE_KEYS.OPNAMES, this.opnames);
    setStored(STORAGE_KEYS.EQUIPMENT, this.equipment);
    setStored(STORAGE_KEYS.AUDIT_LOGS, this.auditLogs);
    setStored(STORAGE_KEYS.NONFOOD_EXPENSES, this.nonFoodExpenses);
    setStored(STORAGE_KEYS.PURCHASE_ORDERS, this.purchaseOrders);
    setStored(STORAGE_KEYS.MENU_ORDERS, this.menuOrders);
    setStored(STORAGE_KEYS.WASTE_LOGS, this.wasteLogs);
    setStored(STORAGE_KEYS.TODOS, this.todos);
    setStored(STORAGE_KEYS.EMPLOYEES, this.employees);
    setStored(STORAGE_KEYS.ATTENDANCE, this.attendanceLogs);
  }

  /**
   * Nama penanda tangan dokumen, diambil dari jabatan karyawan aktif (menu Karyawan).
   * Kosong jika belum ada, agar dokumen mencetak garis isian, bukan nama yang salah.
   */
  public getSignerName(role: SignerRole): string {
    const emp = this.employees.find(e => e.status === 'AKTIF' && SIGNER_POSITIONS[role].test(e.position));
    if (emp) return emp.name;
    if (role === 'KEPALA_SPPG') return this.users.find(u => u.role === 'KA_SPPG')?.name || '';
    return '';
  }

  public getSppgHeadName(): string {
    return this.getSignerName('KEPALA_SPPG');
  }

  // --- PENGATURAN APLIKASI (app_settings) ---
  public getAppSetting<T>(key: string, fallback: T): T {
    const value = this.appSettings[key];
    return value === undefined ? fallback : (value as T);
  }

  public saveAppSetting<T>(key: string, value: T, user?: User): void {
    this.appSettings = { ...this.appSettings, [key]: value };
    setStored(STORAGE_KEYS.APP_SETTINGS, this.appSettings);
    this.pushCloud('app_settings', () =>
      supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString(), updated_by: user?.name || null })
    );
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(APP_SETTINGS_CHANGED_EVENT));
  }

  // --- USERS MANAGEMENT ---
  public getUsers(): User[] {
    return [...this.users];
  }

  public registerUser(userData: Omit<User, 'id'> & { password?: string }): User {
    // Nomor berikutnya dari ID terbesar, bukan jumlah akun: setelah ada yang dihapus, jumlah+1 bisa bentrok.
    const maxNum = this.users.reduce((max, u) => {
      const n = parseInt(u.id.replace(/\D/g, ''), 10);
      return Number.isNaN(n) ? max : Math.max(max, n);
    }, 0);
    const newId = `USR-${String(maxNum + 1).padStart(3, '0')}`;
    if (this.users.some(u => u.email.toLowerCase() === userData.email.trim().toLowerCase())) {
      throw new Error(`Email ${userData.email.trim()} sudah dipakai akun lain.`);
    }
    const newUser: User = {
      id: newId,
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      role: userData.role,
      avatarUrl: userData.avatarUrl,
      phone: userData.phone,
      nip: userData.nip,
      employeeId: userData.employeeId,
    };
    this.users.push(newUser);
    setStored(STORAGE_KEYS.USERS, this.users);

    if (userData.password) {
      const passwords = getStored<Record<string, string>>('sppg_user_passwords_v1', {});
      passwords[newUser.email] = userData.password;
      setStored('sppg_user_passwords_v1', passwords);
    }

    return newUser;
  }

  public getUserPassword(email: string): string | undefined {
    const passwords = getStored<Record<string, string>>('sppg_user_passwords_v1', {});
    const clean = email.toLowerCase().trim();
    return passwords[clean];
  }

  public verifyUserCredentials(emailOrIdentifier: string, passwordInput: string): { valid: boolean; user?: User; error?: string } {
    const clean = emailOrIdentifier.toLowerCase().trim();
    // Boleh masuk dengan email lengkap atau bagian sebelum @ (mis. akmal.sppgjeru).
    const user = this.users.find(u => {
      const email = u.email.toLowerCase();
      return email === clean || email.split('@')[0] === clean;
    });

    if (!user) {
      return { valid: false, error: 'Email atau nama pengguna tidak terdaftar.' };
    }

    const passwords = getStored<Record<string, string>>('sppg_user_passwords_v1', {});
    const stored = passwords[user.email.toLowerCase()];
    if (!stored || stored !== passwordInput) {
      return { valid: false, error: 'Kata sandi salah untuk akun ini.' };
    }

    return { valid: true, user };
  }

  public updateUser(userId: string, data: Partial<User> & { password?: string }): User {
    const index = this.users.findIndex(u => u.id === userId);
    if (index === -1) throw new Error('Pengguna tidak ditemukan.');
    const { password, ...fields } = data;
    const updated: User = {
      ...this.users[index],
      ...fields,
      name: fields.name !== undefined ? fields.name.trim() : this.users[index].name,
      email: fields.email !== undefined ? fields.email.trim().toLowerCase() : this.users[index].email,
    };
    this.users[index] = updated;
    setStored(STORAGE_KEYS.USERS, this.users);

    if (password) {
      const passwords = getStored<Record<string, string>>('sppg_user_passwords_v1', {});
      passwords[updated.email] = password;
      setStored('sppg_user_passwords_v1', passwords);
    }
    return updated;
  }

  public deleteUser(userId: string): boolean {
    const user = this.users.find(u => u.id === userId);
    if (!user) return false;
    this.users = this.users.filter(u => u.id !== userId);
    setStored(STORAGE_KEYS.USERS, this.users);
    const passwords = getStored<Record<string, string>>('sppg_user_passwords_v1', {});
    if (passwords[user.email]) {
      delete passwords[user.email];
      setStored('sppg_user_passwords_v1', passwords);
    }
    return true;
  }
}

// Export single singleton instance
export const warehouseDb = new WarehouseDatabase();

/** Garis isian untuk tanda tangan yang namanya belum tercatat. */
export const SIGNER_BLANK = '..............................';

/** Nama penanda tangan, atau garis isian jika jabatan itu belum ada di data karyawan. */
export const signerName = (role: SignerRole): string => warehouseDb.getSignerName(role) || SIGNER_BLANK;
