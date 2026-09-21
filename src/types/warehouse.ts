/**
 * SPPG Warehouse Management System MVP - Types & Interfaces
 * Satuan Pelayanan Pemenuhan Gizi (SPPG)
 */

export type UserRole =
  | 'SUPER_ADMIN'
  | 'MANAGER'
  | 'WAREHOUSE_MANAGER'
  | 'WAREHOUSE_STAFF'
  | 'PURCHASING'
  | 'QC';

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

export type ItemCategory = FoodCategory | OperationalCategory | EquipmentCategory;

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
