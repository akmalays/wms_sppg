// Alergen yang umum pada makanan anak, dibaca dari nama hidangan dan bahan menu hari itu. Hasilnya ditampilkan
// sebagai "Mengandung: ..." di halaman publik, jadi selalu mengikuti menu dan tidak perlu diketik petugas.
// Hanya nama yang jelas menunjuk alergen yang dicocokkan; bila tidak ada yang cocok, tidak ditampilkan apa pun,
// karena "bebas alergen" adalah klaim yang tidak bisa dipastikan dari nama bahan.

interface AllergenRule {
  label: string;
  pattern: RegExp;
}

const RULES: AllergenRule[] = [
  // "kacang panjang", "kacang hijau", "kacang merah", "kacang polong" adalah sayur/polong, bukan kacang tanah
  { label: 'kacang tanah', pattern: /kacang\s+tanah|bumbu\s+kacang|sambal\s+kacang|saus\s+kacang|selai\s+kacang|\bpecel\b|gado[\s-]?gado|karedok|rempeyek|\bpeyek\b/ },
  { label: 'kacang pohon', pattern: /\bmete\b|almond|kenari|hazelnut|pistachio|\bpecan\b/ },
  { label: 'telur', pattern: /\btel[uo]r\b|\bpuyuh\b|mayo|mayones/ },
  { label: 'susu', pattern: /\bsusu\b(?!\s+kedelai)|\bkeju\b|yo[g]?hurt|mentega|\bbutter\b|\bkrim\b|\bcream\b/ },
  { label: 'ikan', pattern: /\bikan\b|bandeng|\blele\b|tongkol|\btuna\b|salmon|\bnila\b|patin|kakap|\bteri\b|gurame|cakalang|kembung|tenggiri/ },
  { label: 'udang dan kerang', pattern: /udang|rebon|terasi|\bpetis\b|kerang|\bcumi|kepiting|rajungan|lobster/ },
  { label: 'kedelai', pattern: /kedelai|\btempe\b|\btahu\b|\bkecap\b|tauco|edamame/ },
  { label: 'gandum', pattern: /terigu|gandum|\broti\b|\bmie?\b|pasta|makaroni|spag+het+i|\bpanir\b|tepung\s+roti/ },
  { label: 'wijen', pattern: /wijen/ },
];

/** Daftar alergen yang terdeteksi, urut sesuai RULES dan tanpa ganda. */
export function detectAllergens(names: string[]): string[] {
  const text = names.map(n => n.toLowerCase()).join(' | ');
  return RULES.filter(r => r.pattern.test(text)).map(r => r.label);
}
