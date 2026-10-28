import { ItemType } from '../types/warehouse';
import { normalizeToStandardCategory, StandardCategory } from './categoryStandards';
import { WAREHOUSE_SKU_DEFINITIONS, WarehouseSkuType } from './skuGenerator';
import { suggestDryLocation } from './warehouseRacks';

export const PACKAGING_NAME_PATTERN = /plastik|kresek|mika|thinwall|kemasan|kantong|kotak makan|styrofoam|klip|cling|wrap|tisu|tissue/i;
export const PPE_NAME_PATTERN = /masker|sarung tangan|glove|apd|celemek|apron|nurse cap|hairnet|penutup kepala|sepatu boot|face shield/i;
// Protein hewani disimpan beku; tahu, tempe, telur, sayur, dan buah cukup di chiller.
const FROZEN_PROTEIN_PATTERN = /ayam|daging|sapi|kambing|bebek|ikan|lele|nila|tongkol|udang|cumi|bakso|sosis|nugget|fillet|paha|dada/i;
// Sayur dan buah segar yang tidak dikenali dari nama di kategori standar; tanpa ini kategori PO umum
// ("Bahan Makanan") membuatnya terbaca bahan kering.
const FRESH_PRODUCE_PATTERN =
  /babycorn|baby corn|jagung manis|kol\b|kubis|sawi|pakcoy|brokoli|kembang kol|tomat|timun|mentimun|terong|kentang|cabai|cabe|daun bawang|seledri|kacang panjang|toge|tauge|jamur|labu siam|selada|jeruk|apel|anggur|jambu|nanas|salak|pir\b|semangka|melon|pepaya|pisang/i;

// Rak gudang untuk barang non-food baru, sama dengan pembagian rak di Gudang Non-Food.
export function suggestNonFoodLocation(category: StandardCategory, itemName: string): string | undefined {
  const racks = WAREHOUSE_SKU_DEFINITIONS.GUDANG_NONFOOD.suggestedLocations;
  if (category === 'P3K & Obat-obatan') return racks[3];
  if (category === 'Sanitasi, Kemasan & APD') {
    if (PPE_NAME_PATTERN.test(itemName)) return racks[2];
    if (PACKAGING_NAME_PATTERN.test(itemName)) return racks[1];
    return racks[0];
  }
  if (category === 'Operasional & Keperluan Lain') return 'Area Logistik Operasional';
  return undefined;
}

export interface NewItemPlacement {
  category: StandardCategory;
  itemType: ItemType;
  warehouse: WarehouseSkuType;
  location: string;
}

/**
 * Kategori standar, jenis barang (tab Bahan basah / kering / Operasional di Barang Keluar), gudang, dan rak
 * untuk barang yang baru masuk Master Barang. Kategori PO ("Protein", "Sayur", "Bahan Makanan") ikut dinormalkan.
 */
export function placeNewItem(category: string | undefined, itemName: string): NewItemPlacement {
  let std = normalizeToStandardCategory(category, itemName);
  const explicitDry = /kering|sembako|bumbu/i.test(category || '');
  if (std === 'Bahan Kering' && !explicitDry && FRESH_PRODUCE_PATTERN.test(itemName)) std = 'Bahan Basah';
  if (std === 'Bahan Kering' && (PACKAGING_NAME_PATTERN.test(itemName) || PPE_NAME_PATTERN.test(itemName))) std = 'Sanitasi, Kemasan & APD';
  if (std === 'Bahan Basah') {
    // Telur disimpan di chiller walau namanya memuat "ayam"
    const frozen = !/telur/i.test(itemName) && FROZEN_PROTEIN_PATTERN.test(itemName);
    const warehouse: WarehouseSkuType = frozen ? 'FREEZER' : 'GUDANG_BASAH';
    return { category: std, itemType: 'FOOD_DAILY_FLOW', warehouse, location: WAREHOUSE_SKU_DEFINITIONS[warehouse].defaultLocation };
  }
  if (std === 'Bahan Kering') {
    return {
      category: std,
      itemType: 'FOOD_CARRYING_STOCK',
      warehouse: 'GUDANG_KERING',
      location: suggestDryLocation(itemName) || WAREHOUSE_SKU_DEFINITIONS.GUDANG_KERING.defaultLocation,
    };
  }
  const warehouse: WarehouseSkuType = std === 'ATK & Administrasi' || std === 'Operasional & Keperluan Lain' ? 'OPERASIONAL_ATK' : 'GUDANG_NONFOOD';
  return {
    category: std,
    itemType: 'OPERATIONAL_CONSUMABLE',
    warehouse,
    location: suggestNonFoodLocation(std, itemName) || WAREHOUSE_SKU_DEFINITIONS[warehouse].defaultLocation,
  };
}
