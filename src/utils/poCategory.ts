import { PACKAGING_NAME_PATTERN, PPE_NAME_PATTERN } from './itemPlacement';

// Pilihan dropdown Kategori di form PO menu. Nilai di luar daftar ini (mis. "Bahan Basah" dari Master Barang)
// tidak bisa ditampilkan <select>, sehingga browser menunjukkan pilihan pertama, yaitu Protein.
export const PO_CATEGORIES = ['Protein', 'Sembako', 'Sayur dan Buah', 'Sayur', 'Buah', 'Bumbu', 'Bahan Olahan', 'Lain-lain'] as const;
export type PoCategory = (typeof PO_CATEGORIES)[number];

export const isPoCategory = (value: string | undefined): value is PoCategory => PO_CATEGORIES.includes(value as PoCategory);

// Urutan penting: "Petis Udang" dan "Bumbu Ayam" harus kena Bumbu sebelum Protein, "Mie Telur" dan "Kaldu Ayam" kena
// Sembako, dan "Tomat Buah" kena Sayur sebelum Buah. Pengelompokan mengikuti rekap PO dapur.
const NAME_RULES: [RegExp, PoCategory][] = [
  [/kulit lumpia|lontong|bakso|sosis|nugget|kornet/, 'Bahan Olahan'],
  [/bumbu|(?<!daun )bawang|cabe|cabai|daun jeruk|daun salam|kacang tanah|kemangi|lengkuas|petis|sereh|serai|terasi|asam jawa|jahe|kunyit|kencur|ketumbar|merica|\blada\b|\bpala\b|kemiri|garam|cuka/, 'Bumbu'],
  [/beras|gula|\bmie?\b|bihun|soun|minyak|royco|masako|kaldu|santan|saos|saus|kecap|soda kue|tepung|madu|galon/, 'Sembako'],
  // \bayam\b: tanpa batas kata, "bayam" ikut terbaca Protein.
  [/\bayam\b|daging|\bsapi\b|kambing|bebek|\bikan\b|lele|\bnila\b|tongkol|\budang\b|cumi|telur|\btahu\b|tempe|fillet/, 'Protein'],
  [/sayur|wortel|\bkol\b|kubis|sawi|bayam|kangkung|buncis|kacang panjang|toge|tauge|labu|terong|tomat|timun|kentang|brokoli|pakcoy|jagung|daun bawang|seledri|sledri|selada|babycorn|baby corn/, 'Sayur'],
  [/buah|pisang|semangka|melon|pepaya|apel|jeruk|salak|anggur|nanas|mangga|\bpir\b|kelengkeng|lengkeng/, 'Buah'],
];

function fromName(itemName: string): PoCategory | null {
  if (PACKAGING_NAME_PATTERN.test(itemName) || PPE_NAME_PATTERN.test(itemName)) return 'Lain-lain';
  const name = itemName.toLowerCase();
  return NAME_RULES.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

// Kategori Master Barang dan jenis pasokan supplier berupa teks bebas ("Protein & Unggas", "Sayur & Buah Segar").
function fromCategoryText(text: string | undefined): PoCategory | null {
  const c = (text || '').toLowerCase();
  if (c.includes('olahan')) return 'Bahan Olahan';
  if (['protein', 'unggas', 'telur', 'ikan', 'daging', 'tahu', 'tempe'].some(k => c.includes(k))) return 'Protein';
  if (['bumbu', 'rempah'].some(k => c.includes(k))) return 'Bumbu';
  if (c.includes('sayur') && c.includes('buah')) return 'Sayur dan Buah';
  if (c.includes('sayur')) return 'Sayur';
  if (c.includes('buah')) return 'Buah';
  if (['sembako', 'beras', 'minyak', 'tepung', 'pemanis', 'bahan kering', 'karbohidrat'].some(k => c.includes(k))) return 'Sembako';
  if (['plastik', 'kemasan', 'sanitasi', 'atk'].some(k => c.includes(k))) return 'Lain-lain';
  return null;
}

/** Kategori dari yang paling pasti: nama bahan, Master Barang, kategori sebelumnya, lalu jenis pasokan supplier. */
export function inferPoCategory(input: {
  itemName: string;
  masterCategory?: string;
  previous?: string;
  supplierCategory?: string;
}): PoCategory {
  return (
    fromName(input.itemName) ||
    fromCategoryText(input.masterCategory) ||
    (isPoCategory(input.previous) ? input.previous : null) ||
    fromCategoryText(input.supplierCategory) ||
    'Lain-lain'
  );
}
