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
  UserRole
} from '../types/warehouse';

const STORAGE_KEYS = {
  ITEMS: 'sppg_items_v1',
  SUPPLIERS: 'sppg_suppliers_v1',
  RECEIVINGS: 'sppg_receivings_v1',
  TRANSACTIONS: 'sppg_transactions_v1',
  OPNAMES: 'sppg_opnames_v1',
  EQUIPMENT: 'sppg_equipment_v1',
  AUDIT_LOGS: 'sppg_audit_logs_v1',
};

// Initial realistic users for SPPG role-based testing
export const INITIAL_USERS: User[] = [
  {
    id: 'USR-001',
    name: 'Hendra Wijaya',
    email: 'hendra.manager@sppg.id',
    role: 'MANAGER',
  },
  {
    id: 'USR-002',
    name: 'Budi Santoso',
    email: 'budi.gudang@sppg.id',
    role: 'WAREHOUSE_MANAGER',
  },
  {
    id: 'USR-003',
    name: 'Siti Rahma',
    email: 'siti.staff@sppg.id',
    role: 'WAREHOUSE_STAFF',
  },
  {
    id: 'USR-004',
    name: 'Ahmad Fauzi',
    email: 'fauzi.qc@sppg.id',
    role: 'QC',
  },
  {
    id: 'USR-005',
    name: 'Dewi Lestari',
    email: 'dewi.purchasing@sppg.id',
    role: 'PURCHASING',
  },
  {
    id: 'USR-000',
    name: 'Admin SPPG Pusat',
    email: 'admin@sppg.id',
    role: 'SUPER_ADMIN',
  },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: 'SUP-001',
    name: 'PT ABC Pangan Mandiri',
    contactPerson: 'H. Suryanto',
    phone: '0812-3456-7890',
    address: 'Kawasan Industri Cikarang Blok B4, Bekasi',
    supplyCategory: 'Sembako & Beras',
    isActive: true,
    notes: 'Pemasok resmi beras premium, gula pasir, dan minyak goreng sawit.',
  },
  {
    id: 'SUP-002',
    name: 'CV Berkah Unggas Segar',
    contactPerson: 'Pak Joko M.',
    phone: '0813-8877-2211',
    address: 'Jl. Raya Parung No. 45, Bogor',
    supplyCategory: 'Protein & Unggas',
    isActive: true,
    notes: 'Supplier ayam karkas segar & telur ayam ras harian kualitas prima.',
  },
  {
    id: 'SUP-003',
    name: 'Koperasi Tani Makmur Subang',
    contactPerson: 'Ibu Ratna',
    phone: '0857-1122-3344',
    address: 'Kec. Ciater, Kab. Subang',
    supplyCategory: 'Sayuran Segar',
    isActive: true,
    notes: 'Petani mitra sayuran hijau segar, bayam, wortel, kangkung, & labu siam.',
  },
  {
    id: 'SUP-004',
    name: 'PT Buah Nusantara Segar',
    contactPerson: 'Dani Pratama',
    phone: '0821-9988-7766',
    address: 'Pasar Induk Kramat Jati Kios A-12, Jakarta Timur',
    supplyCategory: 'Buah Segar',
    isActive: true,
    notes: 'Penyedia buah harian pemenuhan gizi (pisang cavendish, semangka, pepaya).',
  },
  {
    id: 'SUP-005',
    name: 'PT Higienis Sanitasi Sentosa',
    contactPerson: 'Eko Prasetyo',
    phone: '0811-5544-3322',
    address: 'Jl. Daan Mogot KM 12 No. 88, Jakarta Barat',
    supplyCategory: 'Hygiene & Cleaning',
    isActive: true,
    notes: 'Penyedia perlengkapan kebersihan, sabun cuci food-grade, & APD dapur.',
  },
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

export const INITIAL_RECEIVINGS: ReceivingDocument[] = [
  {
    id: 'GR-2026-0001',
    date: '2026-09-20',
    arrivalTime: '07:15',
    supplierId: 'SUP-001',
    supplierName: 'PT ABC Pangan Mandiri',
    deliveryNoteNo: 'SJ-ABC-8842',
    receiverId: 'USR-003',
    receiverName: 'Siti Rahma',
    receiverRole: 'WAREHOUSE_STAFF',
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
    supplierSignature: 'CONFIRMED: Suryanto (PT ABC Pangan)',
    receiverSignature: 'VERIFIED: Siti Rahma (PIC Gudang)',
    createdAt: '2026-09-20T07:30:00Z',
  },
  {
    id: 'GR-2026-0002',
    date: '2026-09-20',
    arrivalTime: '06:40',
    supplierId: 'SUP-002',
    supplierName: 'CV Berkah Unggas Segar',
    deliveryNoteNo: 'SJ-BKS-0920',
    receiverId: 'USR-004',
    receiverName: 'Ahmad Fauzi',
    receiverRole: 'QC',
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
    supplierSignature: 'CONFIRMED: Joko M. (CV Berkah Unggas)',
    receiverSignature: 'VERIFIED: Ahmad Fauzi (QC Officer)',
    createdAt: '2026-09-20T06:55:00Z',
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
    userName: 'Siti Rahma',
    userRole: 'WAREHOUSE_STAFF',
    notes: 'Penerimaan barang dari PT ABC Pangan Mandiri',
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
    userName: 'Siti Rahma',
    userRole: 'WAREHOUSE_STAFF',
    notes: 'Penerimaan barang dari PT ABC Pangan Mandiri',
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
    userId: 'USR-004',
    userName: 'Ahmad Fauzi',
    userRole: 'QC',
    notes: 'Penerimaan protein dari CV Berkah Unggas Segar',
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
    userRole: 'WAREHOUSE_MANAGER',
    notes: 'Pengeluaran untuk persiapan menu makan siang SPPG Batch 1',
    balanceAfter: 45,
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'AUD-001',
    timestamp: '2026-09-20 07:30',
    userId: 'USR-003',
    userName: 'Siti Rahma',
    userRole: 'WAREHOUSE_STAFF',
    action: 'RECEIVING_POSTED',
    entity: 'RECEIVING',
    entityId: 'GR-2026-0001',
    details: 'Berhasil mencatat & memposting penerimaan 2 item dari PT ABC Pangan Mandiri (Total: 150 unit).',
  },
  {
    id: 'AUD-002',
    timestamp: '2026-09-20 06:55',
    userId: 'USR-004',
    userName: 'Ahmad Fauzi',
    userRole: 'QC',
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
    userRole: 'WAREHOUSE_MANAGER',
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

  constructor() {
    this.items = getStored<ItemMaster[]>(STORAGE_KEYS.ITEMS, INITIAL_ITEMS);
    this.suppliers = getStored<Supplier[]>(STORAGE_KEYS.SUPPLIERS, INITIAL_SUPPLIERS);
    this.receivings = getStored<ReceivingDocument[]>(STORAGE_KEYS.RECEIVINGS, INITIAL_RECEIVINGS);
    this.transactions = getStored<InventoryTransaction[]>(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS);
    this.opnames = getStored<StockOpnameSession[]>(STORAGE_KEYS.OPNAMES, INITIAL_OPNAMES);
    this.equipment = getStored<EquipmentItem[]>(STORAGE_KEYS.EQUIPMENT, INITIAL_EQUIPMENT);
    this.auditLogs = getStored<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, INITIAL_AUDIT_LOGS);
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
    const allowedRoles: UserRole[] = ['SUPER_ADMIN', 'MANAGER', 'WAREHOUSE_MANAGER'];
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
    } else {
      const idx = this.items.findIndex(i => i.id === item.id);
      if (idx < 0) throw new Error('Item tidak ditemukan untuk diperbarui.');
      this.items[idx] = item;
      this.logAudit(user, 'ITEM_MASTER_UPDATED', 'ITEM_MASTER', item.id, `Memperbarui data item: ${item.name}.`);
    }

    setStored(STORAGE_KEYS.ITEMS, this.items);
    return item;
  }

  // --- SUPPLIER MANAGEMENT ---
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

  // --- RE-SEED / RESET DATA ---
  public resetToSeedData(): void {
    this.resetToDefault();
  }

  public resetToDefault(): void {
    localStorage.removeItem(STORAGE_KEYS.ITEMS);
    localStorage.removeItem(STORAGE_KEYS.SUPPLIERS);
    localStorage.removeItem(STORAGE_KEYS.RECEIVINGS);
    localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
    localStorage.removeItem(STORAGE_KEYS.OPNAMES);
    localStorage.removeItem(STORAGE_KEYS.EQUIPMENT);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);

    this.items = [...INITIAL_ITEMS];
    this.suppliers = [...INITIAL_SUPPLIERS];
    this.receivings = [...INITIAL_RECEIVINGS];
    this.transactions = [...INITIAL_TRANSACTIONS];
    this.opnames = [...INITIAL_OPNAMES];
    this.equipment = [...INITIAL_EQUIPMENT];
    this.auditLogs = [...INITIAL_AUDIT_LOGS];

    setStored(STORAGE_KEYS.ITEMS, this.items);
    setStored(STORAGE_KEYS.SUPPLIERS, this.suppliers);
    setStored(STORAGE_KEYS.RECEIVINGS, this.receivings);
    setStored(STORAGE_KEYS.TRANSACTIONS, this.transactions);
    setStored(STORAGE_KEYS.OPNAMES, this.opnames);
    setStored(STORAGE_KEYS.EQUIPMENT, this.equipment);
    setStored(STORAGE_KEYS.AUDIT_LOGS, this.auditLogs);
  }
}

// Export single singleton instance
export const warehouseDb = new WarehouseDatabase();
