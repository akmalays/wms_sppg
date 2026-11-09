import type { MenuOrder } from '../types/warehouse';

// Perkiraan takaran satu bahan: berat bahan yang datang untuk menu itu dibagi jumlah porsi. Porsi besar dianggap lebih
// berat sesuai perbandingan total gramatur (atau energi) kedua porsi. Hasilnya berat mentah, belum dikurangi kulit dan susut.

export interface PortionEstimate {
  /** Kosong bila tidak bisa diperkirakan; note menjelaskan alasannya. */
  small: string;
  large: string;
  note: string;
}

interface PortionTier {
  totalGramature: string;
  targetCalories: string;
}

const firstNumber = (text: string | undefined) => {
  const m = text?.match(/\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(',', '.')) : NaN;
};

const GRAMS_PER_UNIT: Record<string, number> = { kg: 1000, kilo: 1000, kilogram: 1000, ons: 100, gr: 1, gram: 1, g: 1 };

const weightOf = (text: string): number | null => {
  const m = text.toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kilogram|kilo|kg|gram|gr|ons|g)\b/);
  return m ? parseFloat(m[1].replace(',', '.')) * GRAMS_PER_UNIT[m[2]] : null;
};

/** "62 Kg" langsung; "7 sak" pada "beras sak 25kg" dihitung dari berat kemasan di nama barang. */
const gramsOf = (itemName: string, qty: string): number | null => {
  const direct = weightOf(qty);
  if (direct !== null) return direct;
  const count = firstNumber(qty);
  const packWeight = weightOf(itemName);
  return Number.isFinite(count) && packWeight !== null ? count * packWeight : null;
};

const normalize = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

function purchasesOf(order: MenuOrder): { name: string; qty: string }[] {
  const arrivals = (order.poArrivalItems || []).map(p => ({ name: p.itemName, qty: firstNumber(p.qtyArrived) > 0 ? p.qtyArrived : p.qtyOrder }));
  if (arrivals.length > 0) return arrivals;
  return (order.keyIngredients || []).map(k => ({ name: k.name || k.itemName || '', qty: `${k.quantity} ${k.unit}` }));
}

// Data penerima tidak memisahkan kelas SD, jadi SD/MI dibagi dua rata. Kelompok B3 sebagian besar balita.
function portionCounts(order: MenuOrder) {
  let small = 0;
  let large = 0;
  (order.beneficiaryAllocations || []).forEach(a => {
    const n = a.portionCount || 0;
    if (a.category === 'SD / MI') {
      small += n / 2;
      large += n / 2;
    } else if (a.category === 'PAUD / TK' || a.category.includes('B3')) {
      small += n;
    } else {
      large += n;
    }
  });
  return { small, large };
}

const none = (note: string): PortionEstimate => ({ small: '', large: '', note });
const asPortion = (grams: number) => `± ${Math.max(1, Math.round(grams))} gram`;

export function estimateIngredientPortions(
  ingredientName: string,
  order: MenuOrder | undefined,
  smallTier: PortionTier,
  largeTier: PortionTier
): PortionEstimate {
  const name = normalize(ingredientName);
  if (!name) return none('');
  if (!order) return none('Belum bisa diperkirakan: belum ada rencana menu untuk tanggal halaman ini.');

  const purchases = purchasesOf(order);
  const exact = purchases.filter(p => normalize(p.name) === name);
  // "Beras" cocok dengan "beras sak 25kg"; "Ayam fillet" menjumlahkan fillet dada dan paha.
  const matched = exact.length > 0 ? exact : purchases.filter(p => normalize(p.name).startsWith(`${name} `));
  if (matched.length === 0) return none('Belum bisa diperkirakan: bahan ini tidak ditemukan di data belanja menu.');

  const weights = matched.map(p => gramsOf(p.name, p.qty));
  const unknownAt = weights.findIndex(w => w === null);
  if (unknownAt >= 0) return none(`Belum bisa diperkirakan: satuan "${matched[unknownAt].qty}" tidak bisa diubah ke gram.`);
  const totalGrams = (weights as number[]).reduce((sum, w) => sum + w, 0);
  if (totalGrams <= 0) return none('Belum bisa diperkirakan: berat bahan belum dicatat.');

  const counts = portionCounts(order);
  const portions = counts.small + counts.large;
  if (portions <= 0) return none('Belum bisa diperkirakan: jumlah porsi per sekolah belum ada.');

  const byWeight = firstNumber(largeTier.totalGramature) / firstNumber(smallTier.totalGramature);
  const byEnergy = firstNumber(largeTier.targetCalories) / firstNumber(smallTier.targetCalories);
  const ratio = byWeight > 0 && Number.isFinite(byWeight) ? byWeight : byEnergy;
  if (!(ratio > 0) || !Number.isFinite(ratio)) return none('Belum bisa diperkirakan: total gramatur porsi belum diisi.');

  const small = totalGrams / (counts.small + counts.large * ratio);
  const kg = (totalGrams / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 });
  return {
    small: asPortion(small),
    large: asPortion(small * ratio),
    note: `Perkiraan dari ${kg} kg bahan mentah untuk ${portions.toLocaleString('id-ID')} porsi. Ubah bila dapur punya takaran pasti.`,
  };
}

/** Takaran yang sudah ditulis petugas tidak ditimpa. */
export const withEstimatedPortions = <T extends { portionSmall: string; portionLarge: string }>(item: T, estimate: PortionEstimate): T =>
  !estimate.small || item.portionSmall.trim() || item.portionLarge.trim()
    ? item
    : { ...item, portionSmall: estimate.small, portionLarge: estimate.large };
