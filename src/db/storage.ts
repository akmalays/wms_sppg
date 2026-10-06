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
import { getRomanMonth, getYearFromDate } from '../utils/poNumberGenerator';
import { angkaTerbilang } from '../utils/numberToWords';
import { removeFromPrintPool } from '../utils/poPrintPool';

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
};

// Initial realistic users for SPPG role-based testing
export const INITIAL_USERS: User[] = [
  {
    id: 'USR-001',
    name: 'Budi Santoso',
    email: 'budi.superadmin@sppg.id',
    role: 'SUPERADMIN',
  },
  {
    id: 'USR-002',
    name: 'Rizky Iman Ramdhan, S.Pd',
    email: 'rizky.kasppg@sppg.id',
    role: 'KA_SPPG',
  },
  {
    id: 'USR-003',
    name: 'Akmal',
    email: 'akmal@sppg.id',
    role: 'ADMIN',
  },
  {
    id: 'USR-004',
    name: 'Andi Pratama',
    email: 'andi.aslap@sppg.id',
    role: 'ASLAP',
  },
  {
    id: 'USR-005',
    name: 'Dewi Lestari',
    email: 'dewi.akuntan@sppg.id',
    role: 'AKUNTAN',
  },
];

// Supplier UMKM & mitra asli SPPG Jeru Tumpang (dari data nota pesanan).
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
    location: 'Lemari APD Dapur',
    expiryTrackingEnabled: false,
    isActive: true,
    notes: 'Isi 100 pcs per dus untuk staf pemorsian gizi.',
    lastMovementDate: '2026-09-20',
  },
  {
    id: 'ITM-OPS-004',
    name: 'Tissue Dapur Hand Towel Multifold',
    itemType: 'OPERATIONAL_CONSUMABLE',
    category: 'General Operational',
    subcategory: 'Kebersihan',
    baseUnit: 'Pack',
    minimumStock: 20,
    reorderPoint: 35,
    currentStock: 30,
    location: 'Gudang Non-Food Rak N3',
    expiryTrackingEnabled: false,
    isActive: true,
    notes: 'Tissue higienis pengering tangan dan meja persiapan.',
    lastMovementDate: '2026-09-18',
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
    date: new Date().toISOString().split('T')[0],
    title: 'Cek suhu & kelembaban cold storage / chiller (standar 2°C - 4°C)',
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
    notes: 'Suhu tercatat 3.2°C, chiller berfungsi optimal tanpa bunga es.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TODO-002',
    date: new Date().toISOString().split('T')[0],
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
    notes: 'Kondisi segar, aroma normal, suhu daging 4°C saat tiba.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'TODO-003',
    date: new Date().toISOString().split('T')[0],
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
    date: new Date().toISOString().split('T')[0],
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
    date: new Date().toISOString().split('T')[0],
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
    date: new Date().toISOString().split('T')[0],
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
    date: new Date().toISOString().split('T')[0],
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
    date: new Date().toISOString().split('T')[0],
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
    deliveryTerms: 'Pengiriman langsung ke Gudang Utama SPPG Jeru Tumpang sebelum jam 10:00 WIB.',
    createdBy: 'Akmal',
    createdByRole: 'Admin Logistik',
    approvedBy: 'Rizky Iman Ramdhan, S.Pd',
    approvedByRole: 'Kepala SPPG Jeru Tumpang',
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
    approvedByRole: 'Kepala SPPG Jeru Tumpang',
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
    approvedByRole: 'Kepala SPPG Jeru Tumpang',
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
        category: 'Alat Kebersihan',
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
    approvedByRole: 'Kepala SPPG Jeru Tumpang',
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

function setStored<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${key} to storage:`, e);
  }
}

class WarehouseDatabase {
  private items: ItemMaster[];
  private suppliers: Supplier[];
  private receivings: ReceivingDocument[];
  private transactions: InventoryTransaction[];
  private opnames: StockOpnameSession[];
  private equipment: EquipmentItem[];
  private auditLogs: AuditLog[];
  private nonFoodExpenses: NonFoodExpense[];
  private menuOrders: MenuOrder[];
  private wasteLogs: WasteLog[];
  private todos: DailyTodoItem[];
  private employees: Employee[];
  private attendanceLogs: EmployeeAttendance[];
  private users: User[];
  private purchaseOrders: PurchaseOrderNota[];
  private schoolBeneficiaries: SchoolBeneficiaryAllocation[];

  constructor() {
    const isTransactionsCleared = localStorage.getItem('sppg_transactions_cleared_v1') === 'true';

    this.users = getStored<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    // Ensure all 5 standard SPPG operational accounts exist and are up to date
    INITIAL_USERS.forEach(initUser => {
      const idx = this.users.findIndex(u => u.id === initUser.id || u.email.toLowerCase() === initUser.email.toLowerCase());
      if (idx >= 0) {
        this.users[idx] = {
          ...this.users[idx],
          name: initUser.name,
          email: initUser.email,
          role: initUser.role,
        };
      } else {
        this.users.push(initUser);
      }
    });

    setStored(STORAGE_KEYS.USERS, this.users);

    const passwords = getStored<Record<string, string>>('sppg_user_passwords_v1', {});
    passwords['akmal@sppg.id'] = passwords['akmal@sppg.id'] || 'admin123';
    passwords['akmal'] = passwords['akmal'] || 'admin123';
    passwords['dewi.akuntan@sppg.id'] = passwords['dewi.akuntan@sppg.id'] || 'akuntan123';
    passwords['dewi'] = passwords['dewi'] || 'akuntan123';
    passwords['rizky.kasppg@sppg.id'] = passwords['rizky.kasppg@sppg.id'] || 'kasppg123';
    passwords['rizky'] = passwords['rizky'] || 'kasppg123';
    passwords['andi.aslap@sppg.id'] = passwords['andi.aslap@sppg.id'] || 'aslap123';
    passwords['andi'] = passwords['andi'] || 'aslap123';
    passwords['budi.superadmin@sppg.id'] = passwords['budi.superadmin@sppg.id'] || 'superadmin123';
    passwords['budi'] = passwords['budi'] || 'superadmin123';
    setStored('sppg_user_passwords_v1', passwords);

    if (localStorage.getItem('sppg_active_user_name') === 'Akmal') {
      localStorage.setItem('sppg_active_user_id', 'USR-003');
      localStorage.setItem('sppg_active_user_role', 'ADMIN');
    }
    this.items = getStored<ItemMaster[]>(STORAGE_KEYS.ITEMS, INITIAL_ITEMS);
    this.suppliers = getStored<Supplier[]>(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
    this.cleanAndSyncRealSuppliers();
    this.receivings = getStored<ReceivingDocument[]>(STORAGE_KEYS.RECEIVINGS, isTransactionsCleared ? [] : INITIAL_RECEIVINGS);
    
    // Auto-migrate delivery order receiving signatures and receiver names to Akmal (Admin Gudang)
    let receivingsUpdated = false;
    this.receivings = this.receivings.map(r => {
      if (
        r.receiverName === 'Ahmad Fauzi' ||
        r.receiverName === 'Andi Pratama' ||
        r.receiverName === 'Siti Rahma' ||
        r.receiverRole === 'ASLAP' ||
        (r.receiverSignature && !r.receiverSignature.includes('Admin'))
      ) {
        receivingsUpdated = true;
        return {
          ...r,
          receiverId: 'USR-003',
          receiverName: 'Akmal',
          receiverRole: 'ADMIN',
          receiverSignature: 'VERIFIED: Akmal (Admin Gudang)',
        };
      }
      return r;
    });
    if (receivingsUpdated) {
      setStored(STORAGE_KEYS.RECEIVINGS, this.receivings);
    }

    this.transactions = getStored<InventoryTransaction[]>(STORAGE_KEYS.TRANSACTIONS, isTransactionsCleared ? [] : INITIAL_TRANSACTIONS);
    
    // Auto-migrate transactions recorded by Akmal to ADMIN role
    let txUpdated = false;
    this.transactions = this.transactions.map(tx => {
      if (tx.userName === 'Akmal' && tx.userRole !== 'ADMIN') {
        txUpdated = true;
        return {
          ...tx,
          userId: 'USR-003',
          userRole: 'ADMIN',
        };
      }
      return tx;
    });
    if (txUpdated) {
      setStored(STORAGE_KEYS.TRANSACTIONS, this.transactions);
    }

    // Ensure rich default consumption transactions are present only if not deliberately cleared
    if (!isTransactionsCleared) {
      const hasSembakoConsumption = this.transactions.some(
        t => t.transactionType === 'ISSUE_CONSUMPTION' && (t.category === 'Sembako' || t.itemName.toLowerCase().includes('beras'))
      );
      if (!hasSembakoConsumption && this.transactions.length > 0) {
        const extraTxs = INITIAL_TRANSACTIONS.filter(t => t.id > 'TX-2026-0004');
        this.transactions = [...this.transactions, ...extraTxs];
        setStored(STORAGE_KEYS.TRANSACTIONS, this.transactions);
      }
    }

    this.opnames = getStored<StockOpnameSession[]>(STORAGE_KEYS.OPNAMES, isTransactionsCleared ? [] : INITIAL_OPNAMES);
    this.equipment = getStored<EquipmentItem[]>(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    this.auditLogs = getStored<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
    this.nonFoodExpenses = getStored<NonFoodExpense[]>(STORAGE_KEYS.NONFOOD_EXPENSES, isTransactionsCleared ? [] : INITIAL_NONFOOD_EXPENSES);
    
    // Auto-migrate non-food expenses / daily shopping PIC to Akmal
    let nonFoodUpdated = false;
    this.nonFoodExpenses = this.nonFoodExpenses.map(exp => {
      if (exp.pic === 'Ahmad Fauzi' || exp.pic === 'Andi Pratama' || exp.recordedBy === 'Ahmad Fauzi' || exp.recordedBy === 'Andi Pratama') {
        nonFoodUpdated = true;
        return {
          ...exp,
          pic: 'Akmal',
          recordedBy: 'Akmal',
        };
      }
      return exp;
    });
    if (nonFoodUpdated) {
      setStored(STORAGE_KEYS.NONFOOD_EXPENSES, this.nonFoodExpenses);
    }

    this.purchaseOrders = getStored<PurchaseOrderNota[]>(STORAGE_KEYS.PURCHASE_ORDERS, isTransactionsCleared ? [] : INITIAL_PURCHASE_ORDERS);
    
    // Auto-migrate legacy PO numbers and ensure Ka SPPG is Rizky
    let poNeedsMigration = false;
    this.purchaseOrders = this.purchaseOrders.map((po, idx) => {
      let updatedPo = { ...po };
      if (!updatedPo.poNumber || updatedPo.poNumber.startsWith('PO/SPPG-JT/') || !updatedPo.poNumber.includes('NP/SPPG')) {
        poNeedsMigration = true;
        const seq = 134 + idx;
        const roman = getRomanMonth(updatedPo.date || '2026-09-28');
        const yr = getYearFromDate(updatedPo.date || '2026-09-28');
        updatedPo.poNumber = `NO. NP/SPPG/${seq}/${roman}/${yr}`;
      }
      if (!updatedPo.approvedBy || updatedPo.approvedBy.includes('Siti Rahma')) {
        poNeedsMigration = true;
        updatedPo.approvedBy = 'Rizky Iman Ramdhan, S.Pd';
      }
      return updatedPo;
    });
    if (poNeedsMigration) {
      setStored(STORAGE_KEYS.PURCHASE_ORDERS, this.purchaseOrders);
    }

    this.menuOrders = getStored<MenuOrder[]>(STORAGE_KEYS.MENU_ORDERS, isTransactionsCleared ? [] : INITIAL_MENU_ORDERS);
    if (!isTransactionsCleared && (!this.menuOrders.some(m => m.id === 'ORD-2026-006') || (this.menuOrders.find(m => m.id === 'ORD-2026-005')?.poArrivalItems?.length || 0) < 20)) {
      this.menuOrders = INITIAL_MENU_ORDERS;
      setStored(STORAGE_KEYS.MENU_ORDERS, this.menuOrders);
    }
    
    this.wasteLogs = getStored<WasteLog[]>(STORAGE_KEYS.WASTE_LOGS, isTransactionsCleared ? [] : INITIAL_WASTE_LOGS);
    if (!isTransactionsCleared && !this.wasteLogs.some(w => w.id === 'WST-025')) {
      const existingIds = new Set(this.wasteLogs.map(w => w.id));
      const missing = INITIAL_WASTE_LOGS.filter(w => !existingIds.has(w.id));
      if (missing.length > 0) {
        this.wasteLogs = [...this.wasteLogs, ...missing];
        setStored(STORAGE_KEYS.WASTE_LOGS, this.wasteLogs);
      }
    }

    // Auto-trigger clean transactions if requested for fresh testing
    const autoCleanKey = 'sppg_auto_clean_transactions_20261001';
    if (localStorage.getItem(autoCleanKey) !== 'done') {
      this.clearTransactionsOnly();
      localStorage.setItem(autoCleanKey, 'done');
    }
    this.todos = getStored<DailyTodoItem[]>(STORAGE_KEYS.TODOS, INITIAL_TODOS);
    let todosUpdated = false;
    this.todos = this.todos.map(t => {
      const initMatch = INITIAL_TODOS.find(it => it.id === t.id);
      let targetTime = t.targetTime || initMatch?.targetTime || (t.session === 'Pagi' ? '07:00' : t.session === 'Siang' ? '11:00' : t.session === 'Sore' ? '15:00' : '08:00');
      let assignedRole = t.assignedRole || initMatch?.assignedRole;
      let assignedUserName = t.assignedUserName || initMatch?.assignedUserName;
      let assignedUserId = t.assignedUserId || initMatch?.assignedUserId;
      let completedBy = t.completedBy;

      // ASLAP tasks belong to Andi Pratama, NOT Akmal
      if (assignedRole === 'ASLAP' || initMatch?.assignedRole === 'ASLAP') {
        assignedUserName = 'Andi Pratama';
        assignedUserId = 'USR-004';
        if (completedBy && completedBy.includes('Akmal (ASLAP)')) {
          completedBy = completedBy.replace('Akmal (ASLAP)', 'Andi Pratama (ASLAP)');
        }
        todosUpdated = true;
      }

      // ADMIN tasks belong to Akmal (USR-003)
      if (assignedRole === 'ADMIN' || initMatch?.assignedRole === 'ADMIN') {
        if (assignedUserName === 'Hendra Wijaya') {
          assignedUserName = 'Akmal';
          assignedUserId = 'USR-003';
          todosUpdated = true;
        }
      }

      return {
        ...t,
        targetTime,
        assignedRole,
        assignedUserId,
        assignedUserName,
        completedBy,
      };
    });
    if (todosUpdated || this.todos.some(t => !t.targetTime)) {
      setStored(STORAGE_KEYS.TODOS, this.todos);
    }
    this.employees = getStored<Employee[]>(STORAGE_KEYS.EMPLOYEES, REAL_EMPLOYEES);
    this.attendanceLogs = getStored<EmployeeAttendance[]>(STORAGE_KEYS.ATTENDANCE, REAL_ATTENDANCE_LOGS);
    this.schoolBeneficiaries = getStored<SchoolBeneficiaryAllocation[]>(
      STORAGE_KEYS.BENEFICIARIES,
      DEFAULT_SCHOOL_BENEFICIARIES
    );
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
    return [...this.auditLogs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
    const formatted = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
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
    this.auditLogs.unshift(newLog);
    setStored(STORAGE_KEYS.AUDIT_LOGS, this.auditLogs);
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
    const year = new Date().getFullYear();
    const count = this.receivings.length + 1;
    const docId = `GR-${year}-${String(count).padStart(4, '0')}`;
    const now = new Date();
    const timestampStr = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;

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
          lastMovementDate: doc.date || now.toISOString().slice(0, 10),
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

    // Save states
    setStored(STORAGE_KEYS.ITEMS, this.items);
    setStored(STORAGE_KEYS.RECEIVINGS, this.receivings);
    setStored(STORAGE_KEYS.TRANSACTIONS, this.transactions);

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
  public recordConsumption(
    itemId: string,
    quantity: number,
    location: string,
    user: User,
    notes: string,
    referenceDoc?: string
  ): InventoryTransaction {
    if (quantity <= 0) {
      throw new Error('Jumlah pengeluaran bahan harus lebih dari 0.');
    }
    const itemIndex = this.items.findIndex(i => i.id === itemId);
    if (itemIndex < 0) {
      throw new Error('Item tidak ditemukan.');
    }
    const item = this.items[itemIndex];

    if (item.currentStock < quantity) {
      // For real warehouse operations, alert if stock goes negative
      console.warn(`Pengeluaran melebihi stok tercatat: ${quantity} > ${item.currentStock}`);
    }

    const newStock = Number((item.currentStock - quantity).toFixed(2));
    const now = new Date();
    const timestampStr = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;
    const ref = referenceDoc || `ISS-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 100)}`;

    this.items[itemIndex] = {
      ...item,
      currentStock: newStock,
      lastMovementDate: now.toISOString().slice(0, 10),
    };

    const tx: InventoryTransaction = {
      id: `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: timestampStr,
      itemId: item.id,
      itemName: item.name,
      itemType: item.itemType,
      category: item.category,
      location: location || item.location,
      quantity: -quantity,
      unit: item.baseUnit,
      transactionType: 'ISSUE_CONSUMPTION',
      referenceDocument: ref,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      notes: notes || 'Pengeluaran untuk kebutuhan olahan dapur SPPG',
      balanceAfter: newStock,
    };

    this.transactions.unshift(tx);

    setStored(STORAGE_KEYS.ITEMS, this.items);
    setStored(STORAGE_KEYS.TRANSACTIONS, this.transactions);

    this.logAudit(
      user,
      'STOCK_CONSUMED',
      'INVENTORY',
      item.id,
      `Pengeluaran ${quantity} ${item.baseUnit} ${item.name} (${ref}): ${notes}`
    );

    return tx;
  }

  // --- DAILY FLOW SUMMARY & BATCH CONSUMPTION ---
  public getDailyFlowData(targetDate?: string): DailyFlowRecord[] {
    const date = targetDate || new Date().toISOString().slice(0, 10);
    // Daily flow applies to FOOD_DAILY_FLOW items: Protein, Sayuran, Buah
    const dailyItems = this.items.filter(i => i.itemType === 'FOOD_DAILY_FLOW');

    return dailyItems.map(item => {
      // Find today's receiving for this item
      const todayReceivingTx = this.transactions.filter(
        tx =>
          tx.itemId === item.id &&
          tx.transactionType === 'RECEIVING' &&
          tx.timestamp.startsWith(date)
      );
      const receivedToday = todayReceivingTx.reduce((sum, tx) => sum + tx.quantity, 0);

      // Find today's consumption for this item
      const todayConsumptionTx = this.transactions.filter(
        tx =>
          tx.itemId === item.id &&
          tx.transactionType === 'ISSUE_CONSUMPTION' &&
          tx.timestamp.startsWith(date)
      );
      const consumedToday = Math.abs(todayConsumptionTx.reduce((sum, tx) => sum + tx.quantity, 0));

      // Formula: Opening balance + Today's receiving - Today's consumption = Closing balance
      // We can derive opening balance as: CurrentStock - (receivedToday - consumedToday)
      const current = item.currentStock;
      const openingBalance = Math.max(0, Number((current - receivedToday + consumedToday).toFixed(2)));

      return {
        itemId: item.id,
        itemName: item.name,
        category: item.category as any,
        unit: item.baseUnit,
        openingBalance,
        receivedToday,
        consumedToday,
        closingBalance: current,
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
    const opnameId = `SO-${year}-${String(this.opnames.length + 1).padStart(4, '0')}`;

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

    this.logAudit(
      user,
      'STOCK_OPNAME_CREATED',
      'STOCK_OPNAME',
      opnameId,
      `Membuat sesi Stock Opname #${opnameId} (${countedItems.length} item) menunggu persetujuan.`
    );

    return newOpname;
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
    const timestampStr = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 5)}`;

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
            lastMovementDate: now.toISOString().slice(0, 10),
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

    setStored(STORAGE_KEYS.ITEMS, this.items);
    setStored(STORAGE_KEYS.OPNAMES, this.opnames);
    setStored(STORAGE_KEYS.TRANSACTIONS, this.transactions);

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
        this.transactions.push({
          id: `TX-INIT-${Date.now().toString().slice(-6)}`,
          timestamp: new Date().toISOString(),
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
        });
        setStored(STORAGE_KEYS.TRANSACTIONS, this.transactions);
      }
    } else {
      const idx = this.items.findIndex(i => i.id === item.id);
      if (idx < 0) throw new Error('Item tidak ditemukan untuk diperbarui.');
      this.items[idx] = item;
      this.logAudit(user, 'ITEM_MASTER_UPDATED', 'ITEM_MASTER', item.id, `Memperbarui data item: ${item.name}.`);
    }

    setStored(STORAGE_KEYS.ITEMS, this.items);
    return item;
  }

  public deleteItem(itemId: string, user: User): void {
    const idx = this.items.findIndex(i => i.id.toLowerCase() === itemId.toLowerCase());
    if (idx < 0) throw new Error('Item master tidak ditemukan.');
    const deletedItem = this.items[idx];
    this.items.splice(idx, 1);
    setStored(STORAGE_KEYS.ITEMS, this.items);
    this.logAudit(user, 'ITEM_MASTER_DELETED', 'ITEM_MASTER', itemId, `Menghapus master item: ${deletedItem.name} (${deletedItem.id}).`);
  }

  public toggleItemActive(itemId: string, user: User): ItemMaster {
    const idx = this.items.findIndex(i => i.id.toLowerCase() === itemId.toLowerCase());
    if (idx < 0) throw new Error('Item master tidak ditemukan.');
    const item = this.items[idx];
    item.isActive = !item.isActive;
    item.updatedAt = new Date().toISOString();
    setStored(STORAGE_KEYS.ITEMS, this.items);
    this.logAudit(user, 'ITEM_MASTER_UPDATED', 'ITEM_MASTER', itemId, `Mengubah status item ${item.name} menjadi ${item.isActive ? 'Aktif' : 'Nonaktif'}.`);
    return item;
  }

  public saveItemsBatch(newItems: ItemMaster[], user: User): ItemMaster[] {
    const saved: ItemMaster[] = [];
    const now = new Date().toISOString();

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
    }

    setStored(STORAGE_KEYS.ITEMS, this.items);
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
   * dan sinkronisasi 10 supplier UMKM mitra resmi SPPG Jeru Tumpang ke localStorage.
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
    setStored(STORAGE_KEYS.SUPPLIERS, this.suppliers);
    localStorage.setItem(FLAG, '1');
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

    setStored(STORAGE_KEYS.SUPPLIERS, this.suppliers);
    return supplier;
  }

  public deleteSupplier(supplierId: string, user: User): void {
    const idx = this.suppliers.findIndex(s => s.id === supplierId);
    if (idx < 0) throw new Error('Supplier tidak ditemukan.');
    const deletedName = this.suppliers[idx].name;
    this.suppliers.splice(idx, 1);
    setStored(STORAGE_KEYS.SUPPLIERS, this.suppliers);
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
    const now = new Date().toISOString().slice(0, 10);
    const updated: EquipmentItem = {
      ...old,
      condition,
      status,
      lastInspectedDate: now,
      notes: notes || old.notes,
    };

    this.equipment[idx] = updated;
    setStored(STORAGE_KEYS.EQUIPMENT, this.equipment);

    this.logAudit(
      user,
      'EQUIPMENT_CONDITION_CHANGED',
      'EQUIPMENT',
      equipmentId,
      `Mengubah status/kondisi alat ${old.name} (${equipmentId}): Kondisi [${old.condition} -> ${condition}], Status [${old.status} -> ${status}]. Catatan: ${notes}`
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

    setStored(STORAGE_KEYS.EQUIPMENT, this.equipment);
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
    const newId = `NFE-${Date.now().toString().slice(-6)}`;
    const newExpense: NonFoodExpense = {
      ...expense,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    this.nonFoodExpenses.unshift(newExpense);
    setStored(STORAGE_KEYS.NONFOOD_EXPENSES, this.nonFoodExpenses);

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
    setStored(STORAGE_KEYS.NONFOOD_EXPENSES, this.nonFoodExpenses);
    this.logAudit(
      user,
      'NONFOOD_EXPENSE_DELETED',
      'INVENTORY',
      id,
      `Menghapus catatan pengeluaran barang: ${deleted.itemName} (${deleted.quantity} ${deleted.unit || ''})`
    );
    return true;
  }

  public recordNonFoodExpensesBatch(
    expenses: Omit<NonFoodExpense, 'id' | 'createdAt'>[],
    user: User
  ): NonFoodExpense[] {
    const created: NonFoodExpense[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < expenses.length; i++) {
      const exp = expenses[i];
      const newId = `NFE-${(Date.now() + i).toString().slice(-6)}`;
      const newExpense: NonFoodExpense = {
        ...exp,
        id: newId,
        createdAt: now,
      };
      created.push(newExpense);
      this.nonFoodExpenses.unshift(newExpense);
    }

    setStored(STORAGE_KEYS.NONFOOD_EXPENSES, this.nonFoodExpenses);
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
          return { ...po, approvedBy: 'Rizky Iman Ramdhan, S.Pd' };
        }
        return po;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public getPurchaseOrderById(id: string): PurchaseOrderNota | undefined {
    const po = this.purchaseOrders.find(p => p.id === id || p.poNumber === id);
    if (!po) return undefined;
    if (!po.approvedBy || po.approvedBy.includes('Siti Rahma')) {
      return { ...po, approvedBy: 'Rizky Iman Ramdhan, S.Pd' };
    }
    return po;
  }

  public savePurchaseOrder(order: PurchaseOrderNota, user?: User): PurchaseOrderNota {
    const idx = this.purchaseOrders.findIndex(p => p.id === order.id);
    if (idx >= 0) {
      this.purchaseOrders[idx] = { ...order, updatedAt: new Date().toISOString() };
    } else {
      this.purchaseOrders.unshift({ ...order, createdAt: order.createdAt || new Date().toISOString() });
    }
    setStored(STORAGE_KEYS.PURCHASE_ORDERS, this.purchaseOrders);

    if (user) {
      this.logAudit(
        user,
        idx >= 0 ? 'PO_UPDATED' : 'PO_CREATED',
        'RECEIVING',
        order.id,
        `Nota Pesanan / PO ${order.poNumber} untuk ${order.supplierName} total Rp ${order.grandTotal.toLocaleString('id-ID')}`
      );
    }
    return order;
  }

  public deletePurchaseOrder(id: string, user?: User): boolean {
    const idx = this.purchaseOrders.findIndex(p => p.id === id);
    if (idx < 0) return false;
    const deleted = this.purchaseOrders.splice(idx, 1)[0];
    setStored(STORAGE_KEYS.PURCHASE_ORDERS, this.purchaseOrders);

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
        setStored(STORAGE_KEYS.MENU_ORDERS, this.menuOrders);
      }
    }

    if (user) {
      this.logAudit(user, 'PO_DELETED', 'RECEIVING', id, `Menghapus Nota Pesanan ${deleted.poNumber}`);
    }
    return true;
  }

  public receiveAndCompletePurchaseOrder(
    poId: string,
    weighedItems: WeighedPoItemInput[],
    metadata: ReceivePoMetadata,
    user: User
  ): { success: boolean; message: string; po?: PurchaseOrderNota; receivingId?: string } {
    const poIndex = this.purchaseOrders.findIndex(p => p.id === poId);
    if (poIndex < 0) {
      return { success: false, message: 'Nota Pesanan (PO) tidak ditemukan.' };
    }

    const po = this.purchaseOrders[poIndex];
    const nowIso = new Date().toISOString();
    const todayStr = metadata.date || nowIso.slice(0, 10);
    const arrivalTime = metadata.arrivalTime || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // 1. Generate ReceivingDocument
    const receivingId = `GR-${Date.now().toString().slice(-6)}`;
    const receivingLines = weighedItems.map(item => ({
      id: `RL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      itemId: item.itemId || `ITM-${Date.now().toString().slice(-4)}`,
      itemName: item.name,
      category: item.category as any,
      quantity: item.actualQty,
      unit: item.unit as any,
      conditionNote: item.conditionNote || 'Diterima dalam kondisi baik & segar',
    }));

    const receivingDoc: ReceivingDocument = {
      id: receivingId,
      date: todayStr,
      arrivalTime: arrivalTime,
      supplierId: metadata.supplierId || po.supplierId || 'SUP-DIRECT',
      supplierName: po.supplierName,
      deliveryNoteNo: metadata.deliveryNoteNo || `SJ-${po.poNumber.replace(/[^\w]/g, '-')}`,
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
    setStored(STORAGE_KEYS.RECEIVINGS, this.receivings);

    // 2. Auto-update Inventory Stock & Transactions if selected
    if (metadata.autoUpdateStock !== false) {
      weighedItems.forEach(itemInput => {
        if (itemInput.actualQty <= 0) return;

        // Check if item exists in this.items
        let targetItem = this.items.find(
          i => (itemInput.itemId && i.id === itemInput.itemId) ||
               i.name.trim().toLowerCase() === itemInput.name.trim().toLowerCase()
        );

        let itemToUpdate: ItemMaster;
        if (!targetItem) {
          // Auto create SKU in master items so stock is safely tracked
          const newSku = `ITM-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 100)}`;
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

        // Increment stock
        const newStock = Math.round((itemToUpdate.currentStock + itemInput.actualQty) * 100) / 100;
        itemToUpdate.currentStock = newStock;
        itemToUpdate.updatedAt = nowIso;
        itemToUpdate.lastMovementDate = todayStr;

        // Record Ledger Transaction
        const tx: InventoryTransaction = {
          id: `TX-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`,
          timestamp: `${nowIso.slice(0, 10)} ${arrivalTime}`,
          itemId: itemToUpdate.id,
          itemName: itemToUpdate.name,
          itemType: itemToUpdate.itemType,
          category: itemToUpdate.category,
          location: itemToUpdate.location,
          quantity: itemInput.actualQty,
          unit: itemToUpdate.baseUnit,
          transactionType: 'RECEIVING',
          referenceDocument: po.poNumber,
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          notes: `Penerimaan resmi PO ${po.poNumber} (${po.supplierName}). ${itemInput.conditionNote || ''}`.trim(),
          balanceAfter: newStock,
        };
        this.transactions.unshift(tx);
      });

      setStored(STORAGE_KEYS.ITEMS, this.items);
      setStored(STORAGE_KEYS.TRANSACTIONS, this.transactions);
    }

    // 3. Auto-record to Non-Food / Food Expense Report (Laporan Pengeluaran)
    const expenseIds: string[] = [];
    if (metadata.autoRecordExpense !== false) {
      weighedItems.forEach((itemInput, idx) => {
        if (itemInput.actualQty <= 0) return;
        const expId = `NFE-${(Date.now() + idx).toString().slice(-6)}`;
        const newExpense: NonFoodExpense = {
          id: expId,
          date: todayStr,
          time: arrivalTime,
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
          notes: `Belanja bahan PO ${po.poNumber} (${po.supplierName}). ${itemInput.notes || ''}`.trim(),
          createdAt: nowIso,
        };
        expenseIds.push(expId);
        this.nonFoodExpenses.unshift(newExpense);
      });

      setStored(STORAGE_KEYS.NONFOOD_EXPENSES, this.nonFoodExpenses);
    }

    // 4. Update the Purchase Order itself: mark as SELESAI and store real weighed figures
    const updatedPoItems: PurchaseOrderItem[] = weighedItems.map(w => ({
      id: w.poiId,
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
    setStored(STORAGE_KEYS.PURCHASE_ORDERS, this.purchaseOrders);

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
              arrivalTime: arrivalTime,
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
        }
      }
    });
    setStored(STORAGE_KEYS.MENU_ORDERS, this.menuOrders);

    // 6. Audit Trail
    this.logAudit(
      user,
      'PO_RECEIVED_COMPLETED',
      'RECEIVING',
      po.id,
      `Penerimaan & penimbangan fisik PO ${po.poNumber} dari ${po.supplierName}. Total Rp ${newGrandTotal.toLocaleString('id-ID')}, ${weighedItems.length} bahan diterima & stok otomatis diupdate.`
    );

    return {
      success: true,
      message: `Penerimaan PO ${po.poNumber} berhasil diselesaikan. Stok gudang dan laporan pengeluaran telah diperbarui!`,
      po: updatedPo,
      receivingId,
    };
  }


  // --- MENU ORDERS ---
  public getMenuOrders(): MenuOrder[] {
    return [...this.menuOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    return order;
  }

  public updateMenuOrderStatus(orderId: string, status: MenuOrder['status'], user: User): MenuOrder {
    const idx = this.menuOrders.findIndex(o => o.id === orderId);
    if (idx < 0) throw new Error('Order menu tidak ditemukan');
    const old = this.menuOrders[idx];
    const updated: MenuOrder = { ...old, status };
    this.menuOrders[idx] = updated;
    setStored(STORAGE_KEYS.MENU_ORDERS, this.menuOrders);

    this.logAudit(
      user,
      'MENU_ORDER_STATUS_CHANGED',
      'OPERATIONAL',
      orderId,
      `Status order ${old.menuTitle} diubah dari ${old.status} ke ${status}`
    );
    return updated;
  }

  public deletePurchaseOrdersByMenuOrderId(menuOrderId: string, user?: User): number {
    const targetOrder = this.menuOrders.find(o => o.id === menuOrderId);
    const removedPos: PurchaseOrderNota[] = [];

    this.purchaseOrders = this.purchaseOrders.filter(po => {
      const isMatch =
        po.relatedMenuOrderId === menuOrderId ||
        (targetOrder && po.notes && po.notes.includes(targetOrder.menuTitle)) ||
        (targetOrder && po.date === targetOrder.date && po.notes?.includes('Perencanaan Menu'));
      if (isMatch) {
        removedPos.push(po);
        try {
          removeFromPrintPool(po.id);
          removeFromPrintPool(po.poNumber);
        } catch {}
        return false;
      }
      return true;
    });

    if (removedPos.length > 0) {
      setStored(STORAGE_KEYS.PURCHASE_ORDERS, this.purchaseOrders);
      if (targetOrder) {
        targetOrder.poArrivalItems = [];
        setStored(STORAGE_KEYS.MENU_ORDERS, this.menuOrders);
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
    return [...this.wasteLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  public recordWasteLog(
    log: Omit<WasteLog, 'id' | 'createdAt'>,
    user: User
  ): WasteLog {
    const newId = `WST-${Date.now().toString().slice(-6)}`;
    const newLog: WasteLog = {
      ...log,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    this.wasteLogs.unshift(newLog);
    setStored(STORAGE_KEYS.WASTE_LOGS, this.wasteLogs);

    this.logAudit(
      user,
      'WASTE_RECORDED',
      'OPERATIONAL',
      newId,
      `Pencatatan Limbah [${newLog.wasteCategory}]: ${newLog.itemName} (${newLog.quantity} ${newLog.unit}) ditangani via ${newLog.disposalMethod}`
    );
    return newLog;
  }

  public recordWasteBatch(
    logs: Omit<WasteLog, 'id' | 'createdAt'>[],
    user: User
  ): WasteLog[] {
    const timestamp = Date.now();
    const createdLogs: WasteLog[] = [];

    logs.forEach((log, index) => {
      const newId = `WST-${timestamp.toString().slice(-6)}-${index + 1}`;
      const newLog: WasteLog = {
        ...log,
        id: newId,
        createdAt: new Date().toISOString(),
      };
      createdLogs.push(newLog);
      this.wasteLogs.unshift(newLog);
    });

    setStored(STORAGE_KEYS.WASTE_LOGS, this.wasteLogs);

    this.logAudit(
      user,
      'WASTE_BATCH_RECORDED',
      'OPERATIONAL',
      `BATCH-${timestamp}`,
      `Pencatatan Batch Limbah: ${createdLogs.length} butir limbah dicatat sekaligus.`
    );

    return createdLogs;
  }

  public deleteWasteLog(id: string, user: User): boolean {
    const idx = this.wasteLogs.findIndex(w => w.id === id);
    if (idx < 0) return false;
    const removed = this.wasteLogs[idx];
    this.wasteLogs.splice(idx, 1);
    setStored(STORAGE_KEYS.WASTE_LOGS, this.wasteLogs);

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
    day: string,
    items: {
      category: 'karbohidrat' | 'sayur' | 'protein hewani' | 'protein nabati' | 'buah';
      quantity: number;
      unit?: string;
      disposalMethod?: DisposalMethod;
      notes?: string;
    }[],
    user: User
  ): WasteLog[] {
    const nutritionCats = new Set(['karbohidrat', 'sayur', 'protein hewani', 'protein nabati', 'buah']);
    // Remove existing nutrition records for this specific date to avoid duplicate entries
    this.wasteLogs = this.wasteLogs.filter(
      w => !(w.date === date && nutritionCats.has(w.wasteCategory.toLowerCase() as any))
    );

    const timestamp = Date.now();
    const createdLogs: WasteLog[] = items.map((item, idx) => ({
      id: `WST-${timestamp.toString().slice(-6)}-${idx + 1}`,
      day: day.toLowerCase(),
      date,
      wasteCategory: item.category,
      itemName: `Limbah ${item.category}`,
      quantity: Number(item.quantity) || 0,
      unit: item.unit || 'Kg',
      sourceArea: 'SPPG Jeru Tumpang',
      reason: 'Sisa preparasi & porsi olahan dapur',
      disposalMethod: item.disposalMethod || 'Pakan Ternak & Kompos Organik',
      recordedBy: user.name,
      notes: item.notes,
      createdAt: new Date().toISOString(),
    }));

    this.wasteLogs = [...createdLogs, ...this.wasteLogs];
    setStored(STORAGE_KEYS.WASTE_LOGS, this.wasteLogs);

    this.logAudit(
      user,
      'WASTE_DAILY_RECORDED',
      'OPERATIONAL',
      `DAY-${date}`,
      `Input Rekap Limbah Harian [${date} (${day})]: ${items.map(i => `${i.category}: ${i.quantity} kg`).join(', ')}`
    );

    return createdLogs;
  }

  public deleteDailyWasteLogs(date: string, user: User): boolean {
    const beforeCount = this.wasteLogs.length;
    this.wasteLogs = this.wasteLogs.filter(w => w.date !== date);
    if (this.wasteLogs.length !== beforeCount) {
      setStored(STORAGE_KEYS.WASTE_LOGS, this.wasteLogs);
      this.logAudit(
        user,
        'WASTE_DAILY_DELETED',
        'OPERATIONAL',
        `DAY-${date}`,
        `Menghapus seluruh catatan limbah tanggal ${date}`
      );
      return true;
    }
    return false;
  }

  // --- DAILY TODOS ---
  public getDailyTodos(date?: string): DailyTodoItem[] {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const filtered = this.todos.filter(t => t.date === targetDate);
    // If no todos exist for requested date, and it's today, seed today's items
    if (filtered.length === 0 && targetDate === new Date().toISOString().split('T')[0]) {
      const seeded = INITIAL_TODOS.map(t => ({ ...t, date: targetDate }));
      this.todos.push(...seeded);
      setStored(STORAGE_KEYS.TODOS, this.todos);
      return [...seeded];
    }
    return filtered.length > 0 ? filtered : this.todos;
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
    const targetDate = date || new Date().toISOString().split('T')[0];
    this.todos = this.todos.filter(t => t.date !== targetDate);
    const seeded = INITIAL_TODOS.map(t => ({
      ...t,
      date: targetDate,
      id: `TODO-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`,
    }));
    this.todos.push(...seeded);
    setStored(STORAGE_KEYS.TODOS, this.todos);
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
      const nextId = `EMP-${String(this.employees.length + 1).padStart(3, '0')}`;
      savedEmployee = {
        ...empData,
        id: ('id' in empData && empData.id) ? empData.id : nextId,
      };
      this.employees.push(savedEmployee);
      this.logAudit(user, 'CREATE', 'STAFF', savedEmployee.id, `Mendaftarkan karyawan baru: ${savedEmployee.name} (${savedEmployee.nip})`);
    }

    setStored(STORAGE_KEYS.EMPLOYEES, this.employees);
    return savedEmployee;
  }

  public updateEmployee(id: string, updates: Partial<Employee>, user: User): Employee {
    const index = this.employees.findIndex(e => e.id === id);
    if (index === -1) throw new Error(`Karyawan dengan ID ${id} tidak ditemukan.`);

    this.employees[index] = { ...this.employees[index], ...updates };
    setStored(STORAGE_KEYS.EMPLOYEES, this.employees);
    this.logAudit(user, 'UPDATE', 'STAFF', id, `Memperbarui profil staf: ${this.employees[index].name}`);
    return this.employees[index];
  }

  public deleteEmployee(id: string, user: User): void {
    const emp = this.employees.find(e => e.id === id);
    this.employees = this.employees.filter(e => e.id !== id);
    setStored(STORAGE_KEYS.EMPLOYEES, this.employees);
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
      const newId = `ATT-${attData.date.replace(/-/g, '')}-${String(this.attendanceLogs.length + 1).padStart(3, '0')}`;
      savedRecord = {
        ...attData,
        id: newId,
        createdAt: new Date().toISOString(),
      };
      this.attendanceLogs.push(savedRecord);
      this.logAudit(user, 'CREATE', 'ATTENDANCE', savedRecord.id, `Pencatatan absensi: ${savedRecord.employeeName} (${savedRecord.status}) tgl ${savedRecord.date}`);
    }

    setStored(STORAGE_KEYS.ATTENDANCE, this.attendanceLogs);
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

  public deleteAttendance(id: string, user: User): void {
    const att = this.attendanceLogs.find(a => a.id === id);
    this.attendanceLogs = this.attendanceLogs.filter(a => a.id !== id);
    setStored(STORAGE_KEYS.ATTENDANCE, this.attendanceLogs);
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
    localStorage.setItem('sppg_transactions_cleared_v1', 'true');

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

    setStored(STORAGE_KEYS.RECEIVINGS, []);
    setStored(STORAGE_KEYS.TRANSACTIONS, []);
    setStored(STORAGE_KEYS.NONFOOD_EXPENSES, []);
    setStored(STORAGE_KEYS.PURCHASE_ORDERS, []);
    setStored(STORAGE_KEYS.OPNAMES, []);
    setStored(STORAGE_KEYS.MENU_ORDERS, []);
    setStored(STORAGE_KEYS.WASTE_LOGS, []);
    setStored(STORAGE_KEYS.ITEMS, this.items);

    // Clear PO print pool and PO sequence counter so fresh testing starts cleanly at 134
    try {
      localStorage.removeItem('sppg_po_print_pool');
      localStorage.removeItem('sppg_po_last_number_state');
    } catch (e) {
      console.warn('Could not clear PO pool / state:', e);
    }

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

  // --- USERS MANAGEMENT ---
  public getUsers(): User[] {
    return [...this.users];
  }

  public registerUser(userData: Omit<User, 'id'> & { password?: string }): User {
    const nextNum = this.users.length + 1;
    const newId = `USR-${String(nextNum).padStart(3, '0')}`;
    const newUser: User = {
      id: newId,
      name: userData.name.trim(),
      email: userData.email.trim().toLowerCase(),
      role: userData.role,
      avatarUrl: userData.avatarUrl,
      phone: userData.phone,
      nip: userData.nip,
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
    if (passwords[clean]) return passwords[clean];
    if (clean === 'akmal@sppg.id' || clean === 'akmal' || clean === 'admin') return 'admin123';
    if (clean === 'dewi.akuntan@sppg.id' || clean === 'dewi' || clean === 'akuntan') return 'akuntan123';
    if (clean === 'rizky.kasppg@sppg.id' || clean === 'rizky' || clean === 'kasppg') return 'kasppg123';
    if (clean === 'andi.aslap@sppg.id' || clean === 'andi' || clean === 'aslap') return 'aslap123';
    if (clean === 'budi.superadmin@sppg.id' || clean === 'budi' || clean === 'superadmin') return 'superadmin123';
    return undefined;
  }

  public verifyUserCredentials(emailOrIdentifier: string, passwordInput: string): { valid: boolean; user?: User; error?: string } {
    const clean = emailOrIdentifier.toLowerCase().trim();
    const user = this.users.find(u =>
      u.email.toLowerCase() === clean ||
      u.name.toLowerCase() === clean ||
      u.id.toLowerCase() === clean ||
      (u.role === 'ADMIN' && (clean === 'admin' || clean === 'akmal' || clean === 'akmal@sppg.id')) ||
      (u.role === 'KA_SPPG' && (clean === 'kasppg' || clean === 'ka sppg' || clean === 'rizky' || clean === 'rizky.kasppg@sppg.id')) ||
      (u.role === 'AKUNTAN' && (clean === 'akuntan' || clean === 'dewi' || clean === 'dewi.akuntan@sppg.id')) ||
      (u.role === 'ASLAP' && (clean === 'aslap' || clean === 'andi' || clean === 'andi.aslap@sppg.id')) ||
      (u.role === 'SUPERADMIN' && (clean === 'superadmin' || clean === 'budi' || clean === 'budi.superadmin@sppg.id'))
    );

    if (!user) {
      return { valid: false, error: 'Email atau nama pengguna tidak terdaftar dalam database petugas.' };
    }

    const passwords = getStored<Record<string, string>>('sppg_user_passwords_v1', {});
    const customPass = passwords[user.email] || passwords[clean];

    let isMatch = false;
    if (customPass && customPass === passwordInput) {
      isMatch = true;
    } else if (user.role === 'ADMIN' && (passwordInput === 'admin123' || passwordInput === 'akmal123')) {
      isMatch = true;
    } else if (user.role === 'KA_SPPG' && (passwordInput === 'kasppg123' || passwordInput === 'rizky123')) {
      isMatch = true;
    } else if (user.role === 'AKUNTAN' && (passwordInput === 'akuntan123' || passwordInput === 'dewi123')) {
      isMatch = true;
    } else if (user.role === 'ASLAP' && (passwordInput === 'aslap123' || passwordInput === 'andi123')) {
      isMatch = true;
    } else if (user.role === 'SUPERADMIN' && (passwordInput === 'superadmin123' || passwordInput === 'budi123')) {
      isMatch = true;
    }

    if (!isMatch) {
      return { valid: false, error: 'Kata sandi yang Anda masukkan salah untuk akun ini.' };
    }

    return { valid: true, user };
  }

  public updateUser(userId: string, data: Partial<User> & { password?: string }): User {
    const index = this.users.findIndex(u => u.id === userId);
    if (index === -1) throw new Error('Pengguna tidak ditemukan.');
    const updated = {
      ...this.users[index],
      ...data,
      name: data.name !== undefined ? data.name.trim() : this.users[index].name,
      email: data.email !== undefined ? data.email.trim().toLowerCase() : this.users[index].email,
    };
    this.users[index] = updated;
    setStored(STORAGE_KEYS.USERS, this.users);

    if (data.password) {
      const passwords = getStored<Record<string, string>>('sppg_user_passwords_v1', {});
      passwords[updated.email] = data.password;
      setStored('sppg_user_passwords_v1', passwords);
    }
    return updated;
  }

  public deleteUser(userId: string): boolean {
    const user = this.users.find(u => u.id === userId);
    if (!user) return false;
    this.users = this.users.filter(u => u.id !== userId);
    setStored(STORAGE_KEYS.USERS, this.users);
    return true;
  }
}

// Export single singleton instance
export const warehouseDb = new WarehouseDatabase();
