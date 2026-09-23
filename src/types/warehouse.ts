/**
 * SPPG Warehouse Management System MVP - Types & Interfaces
 * Satuan Pelayanan Pemenuhan Gizi (SPPG)
 */

export type UserRole =
  | 'SUPERADMIN'
  | 'ADMIN'
  | 'KA_SPPG'
  | 'ASLAP'
  | 'AKUNTAN';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export type ItemType =
  | 'FOOD_DAILY_FLOW'
  | 'FOOD_CARRYING_STOCK'
  | 'OPERATIONAL_CONSUMABLE'
  | 'EQUIPMENT';

export type MainItemCategory = 'Bahan Kering' | 'Bahan Basah' | 'Bahan Peralatan';

export type FoodCategory = 'Sembako' | 'Protein' | 'Sayuran' | 'Buah';

export type OperationalCategory =
  | 'Cleaning'
  | 'Packaging'
  | 'Hygiene/PPE'
  | 'General Operational';

export type EquipmentCategory =
  | 'Kitchen Equipment'
  | 'Cleaning Equipment'
  | 'Warehouse Equipment'
  | 'Electronic Equipment';

export type ItemCategory = MainItemCategory | FoodCategory | OperationalCategory | EquipmentCategory | string;

export function normalizeItemCategory(category?: string): MainItemCategory {
  const c = (category || '').toLowerCase();
  if (c.includes('kering') || c.includes('sembako') || c.includes('beras') || c.includes('minyak') || c.includes('gula') || c.includes('tepung')) {
    return 'Bahan Kering';
  }
  if (c.includes('basah') || c.includes('protein') || c.includes('sayur') || c.includes('buah') || c.includes('ayam') || c.includes('daging') || c.includes('telur')) {
    return 'Bahan Basah';
  }
  if (c.includes('alat') || c.includes('clean') || c.includes('pack') || c.includes('hygiene') || c.includes('kemasan') || c.includes('operasional')) {
    return 'Bahan Peralatan';
  }
  return 'Bahan Kering';
}

export type BaseUnit =
  | 'Kg'
  | 'Liter'
  | 'Gram'
  | 'Pack'
  | 'Pcs'
  | 'Roll'
  | 'Dus'
  | 'Botol'
  | 'Ikat';

export type StockStatus = 'NORMAL' | 'LOW' | 'OUT_OF_STOCK';

export interface ItemMaster {
  id: string; // SKU e.g. ITM-SMB-001
  name: string;
  itemType: ItemType;
  category: ItemCategory;
  subcategory?: string;
  baseUnit: BaseUnit;
  minimumStock: number;
  reorderPoint: number;
  currentStock: number;
  location: string;
  expiryTrackingEnabled: boolean;
  isActive: boolean;
  notes?: string;
  lastMovementDate?: string;
}

export interface Supplier {
  id: string; // e.g. SUP-001
  name: string;
  contactPerson: string;
  phone: string;
  address: string;
  supplyCategory: string;
  isActive: boolean;
  notes?: string;
}

export interface WarehouseLocation {
  id: string;
  name: string;
  description?: string;
}

export interface ReceivingLine {
  id: string;
  itemId: string;
  itemName: string;
  category: ItemCategory;
  quantity: number;
  unit: BaseUnit;
  conditionNote?: string;
  batchNumber?: string;
  expiryDate?: string;
}

export type ReceivingStatus = 'DRAFT' | 'VERIFIED_POSTED';

export interface ReceivingDocument {
  id: string; // e.g. GR-2026-0001
  date: string; // YYYY-MM-DD
  arrivalTime: string; // HH:mm
  supplierId: string;
  supplierName: string;
  deliveryNoteNo?: string; // Surat Jalan
  receiverId: string;
  receiverName: string;
  receiverRole: UserRole;
  status: ReceivingStatus;
  notes?: string;
  lines: ReceivingLine[];
  supplierSignature?: string; // Data URL or text representation
  receiverSignature?: string;
  createdAt: string;
}

export type TransactionType =
  | 'RECEIVING'
  | 'ISSUE_CONSUMPTION'
  | 'ADJUSTMENT'
  | 'STOCK_OPNAME_ADJUSTMENT';

export interface InventoryTransaction {
  id: string;
  timestamp: string;
  itemId: string;
  itemName: string;
  itemType: ItemType;
  category: ItemCategory;
  location: string;
  quantity: number; // positive for addition, negative for deduction
  unit: BaseUnit;
  transactionType: TransactionType;
  referenceDocument: string; // e.g. GR-2026-0001 or SO-2026-0001
  userId: string;
  userName: string;
  userRole: UserRole;
  notes?: string;
  balanceAfter: number;
}

export type OpnameStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface StockOpnameItem {
  id: string;
  itemId: string;
  itemName: string;
  category: ItemCategory;
  unit: BaseUnit;
  systemStock: number;
  physicalCount: number;
  variance: number; // physicalCount - systemStock
  reason: string;
}

export interface StockOpnameSession {
  id: string; // e.g. SO-2026-0001
  date: string;
  location: string;
  createdById: string;
  createdByName: string;
  status: OpnameStatus;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  notes?: string;
  items: StockOpnameItem[];
  createdAt: string;
}

export type EquipmentCondition = 'GOOD' | 'NEEDS_INSPECTION' | 'DAMAGED';
export type EquipmentStatus = 'ACTIVE' | 'IN_REPAIR' | 'LOST' | 'RETIRED';

export interface EquipmentItem {
  id: string; // e.g. EQ-KIT-001
  name: string;
  category: EquipmentCategory;
  quantity: number;
  unit: string;
  location: string;
  condition: EquipmentCondition;
  status: EquipmentStatus;
  assignedTo?: string;
  lastInspectedDate: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entity: 'RECEIVING' | 'INVENTORY' | 'STOCK_OPNAME' | 'EQUIPMENT' | 'ITEM_MASTER' | 'SUPPLIER' | 'AUTH';
  entityId: string;
  details: string;
}

export type AuditLogEntry = AuditLog;

export interface DailyFlowRecord {
  itemId: string;
  itemName: string;
  category: FoodCategory;
  unit: BaseUnit;
  openingBalance: number;
  receivedToday: number;
  consumedToday: number;
  closingBalance: number;
}

export type NonFoodCategory =
  | 'Peralatan Dapur'
  | 'ATK & Dokumentasi'
  | 'Bahan Pembersih & Sanitasi'
  | 'Perlengkapan Kebersihan & APD'
  | 'Pemeliharaan & Utilitas'
  | string;

export type NonFoodDepartment =
  | 'Dapur Pengolahan Utama'
  | 'Area Cuci & Sanitasi'
  | 'Administrasi & Kantor'
  | 'Gudang Kering & Basah'
  | 'Distribusi & Kemasan'
  | string;

export interface NonFoodExpense {
  id: string; // e.g. NFE-2026-001
  date: string; // YYYY-MM-DD or '20 sept 2026'
  itemId?: string;
  itemName: string;
  category: NonFoodCategory;
  quantity: number | string; // e.g. 1 or '1 pack'
  unit?: string;
  time?: string; // Jam Ambil (e.g. '19.55')
  volunteer?: string; // Relawan (e.g. 'Roni', 'Puspitasari')
  pic?: string; // PIC (e.g. 'Teguh', 'Ade', 'Akmal')
  unitPrice?: number;
  totalCost?: number;
  department?: NonFoodDepartment;
  recipient?: string;
  recipientName?: string;
  issuedBy?: string;
  recordedBy?: string;
  receiptRef?: string;
  notes?: string;
  createdAt?: string;
}

export type MenuOrderStatus = 'PLANNED' | 'PREPPING' | 'COOKING' | 'DISTRIBUTED' | 'COMPLETED' | 'CANCELLED';

export interface MenuIngredientReq {
  itemId?: string;
  name?: string;
  itemName?: string;
  quantity: number | string;
  unit: string;
}

export interface MenuPoArrivalItem {
  category: string;
  itemName: string;
  qtyOrder: string;
  qtyArrived: string;
  supplier: string;
  arrivalTime: string;
  pic: string;
  notes?: string;
}

export interface MenuOrder {
  id: string; // e.g. ORD-2026-001
  date: string; // YYYY-MM-DD
  poDate?: string; // e.g. 'Minggu, 19 Sept 2026'
  mealSession: 'Pagi' | 'Siang' | 'Snack';
  menuTitle: string;
  menuDescription?: string;
  targetPortions: number;
  totalBeneficiaries?: number; // Total Penerima Manfaat (e.g. 3044)
  status: MenuOrderStatus;
  keyIngredients?: MenuIngredientReq[];
  poArrivalItems?: MenuPoArrivalItem[];
  chefInCharge?: string;
  notes?: string;
  createdAt: string;
}

export type WasteCategory =
  | 'Limbah Olahan Dapur'
  | 'Bahan Rusak / Kadaluarsa'
  | 'Sisa Makanan Distribusi'
  | 'Kemasan & Non-Organik'
  | 'karbohidrat'
  | 'sayur'
  | 'protein hewani'
  | 'protein nabati'
  | 'buah'
  | string;

export type DisposalMethod =
  | 'Kompos Organik'
  | 'Pakan Maggot / Ternak'
  | 'Bank Sampah / Daur Ulang'
  | 'TPS Terpadu'
  | string;

export interface WasteLog {
  id: string; // e.g. WST-2026-001
  day?: string; // Hari (e.g. 'Jumat', 'Senin')
  date: string; // YYYY-MM-DD
  wasteCategory: WasteCategory;
  itemName?: string;
  quantity: number;
  unit: 'Kg' | 'Liter' | 'Gram' | 'Pcs' | string;
  sourceArea: string; // e.g. 'Dapur SPPG Jeru Tumpang'
  reason?: string;
  disposalMethod: DisposalMethod;
  recordedBy: string;
  notes?: string;
  createdAt?: string;
}

export type TodoCategory =
  | 'Penerimaan & QC'
  | 'Persiapan Dapur'
  | 'Sanitasi & Kebersihan'
  | 'Administrasi & Stok'
  | 'Stock Opname'
  | 'Distribusi';

export type TodoPriority = 'Tinggi' | 'Sedang' | 'Rendah';

export interface DailyTodoItem {
  id: string; // e.g. TODO-001
  date: string; // YYYY-MM-DD
  title: string;
  category: TodoCategory;
  priority: TodoPriority;
  session?: 'Pagi' | 'Siang' | 'Sore' | 'Harian';
  isCompleted: boolean;
  completedAt?: string;
  completedBy?: string;
  assignedRole?: UserRole | 'ALL';
  notes?: string;
  createdAt: string;
}



