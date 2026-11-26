import { ItemMaster } from '../types/warehouse';
import { inferPoCategory, isPoCategory, PoCategory } from './poCategory';
import { convertQty } from './unitConversion';

export type MatchKind = 'EXACT' | 'SIMILAR' | 'NEW';

export interface MasterCandidate {
  item: ItemMaster;
  score: number;
}

export interface ParsedWaPoItem {
  id: string;
  rawLine: string;
  rawName: string;
  rawQty: string;
  qtyNumber: number;
  rawUnit: string;
  formattedQty: string;
  sectionCategory?: PoCategory;
  category: PoCategory;
  matchKind: MatchKind;
  matchedItem?: ItemMaster;
  suggestedName: string;
  candidates: MasterCandidate[];
}

export interface ParsedWaPoResult {
  items: ParsedWaPoItem[];
  unparsedLines: string[];
}

const UNIT_ALIASES: Record<string, string> = {
  kg: 'Kg',
  kilo: 'Kg',
  kilogram: 'Kg',
  g: 'Gram',
  gr: 'Gram',
  gram: 'Gram',
  ons: 'Ons',
  l: 'Liter',
  lt: 'Liter',
  ltr: 'Liter',
  liter: 'Liter',
  ml: 'Ml',
  pcs: 'Pcs',
  pc: 'Pcs',
  buah: 'Pcs',
  biji: 'Pcs',
  butir: 'Butir',
  ekor: 'Ekor',
  pack: 'Pack',
  pak: 'Pack',
  bks: 'Bks',
  bungkus: 'Bks',
  sachet: 'Sachet',
  dus: 'Dus',
  ktn: 'Dus',
  karton: 'Dus',
  box: 'Dus',
  ikat: 'Ikat',
  roll: 'Roll',
  botol: 'Botol',
  btl: 'Botol',
  jerigen: 'Jerigen',
  pouch: 'Pouch',
  sak: 'Sak',
  karung: 'Sak',
  krat: 'Krat',
  layah: 'Layah',
  bal: 'Bal',
  ball: 'Bal',
  papan: 'Papan',
  tray: 'Tray',
  kaleng: 'Kaleng',
  galon: 'Galon',
  tabung: 'Tabung',
  sisir: 'Sisir',
  tandan: 'Tandan',
  lembar: 'Lembar',
  rim: 'Rim',
  unit: 'Unit',
  set: 'Set',
};

const KNOWN_UNIT_KEYS = Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length);
const UNIT_REGEX_PART = KNOWN_UNIT_KEYS.join('|');

// Pasangan kata yang membedakan jenis bahan dalam satu keluarga: "tepung terigu" tidak boleh cocok dengan "tepung maizena".
const MUTUALLY_EXCLUSIVE_GROUPS: string[][] = [
  ['terigu', 'maizena', 'tapioka', 'kanji', 'beras', 'ketan', 'panir', 'roti', 'sagu', 'bumbu'],
  ['merah', 'putih', 'bombay', 'hijau', 'rawit', 'keriting', 'besar', 'kecil', 'hitam', 'kuning'],
  ['goreng', 'wijen', 'kelapa', 'zaitun', 'ikan', 'wijen'],
  ['pasir', 'aren', 'jawa', 'halus', 'batu', 'cair'],
  ['ayam', 'sapi', 'ikan', 'bebek', 'kambing', 'udang', 'cumi', 'telur', 'tahu', 'tempe'],
  ['manis', 'asin', 'pedas', 'asam', 'tawar'],
];

const SYNONYMS: Record<string, string> = {
  cabai: 'cabe',
  telor: 'telur',
  saos: 'saus',
  pokcoy: 'pakcoy',
  sereh: 'serai',
  laos: 'lengkuas',
  tauge: 'toge',
  sledri: 'seledri',
  lengkeng: 'kelengkeng',
  bomby: 'bombay',
  bombai: 'bombay',
  ktn: 'dus',
  karton: 'dus',
  ball: 'bal',
  btl: 'botol',
  bks: 'bungkus',
  pak: 'pack',
  fillet: 'filet',
  brokoly: 'brokoli',
  wortl: 'wortel',
  maisenna: 'maizena',
  maisena: 'maizena',
  teriggu: 'terigu',
};

// Kata kemasan/merek/ukuran yang boleh diabaikan saat membandingkan kemiripan nama inti bahan.
const NOISE_TOKENS = new Set([
  'segar', 'fresh', 'super', 'lokal', 'premium', 'kemasan', 'isi', 'netto',
  'sak', 'dus', 'karton', 'ktn', 'pack', 'pak', 'bks', 'bungkus', 'botol', 'btl',
  'krat', 'layah', 'bal', 'ball', 'papan', 'pcs', 'kg', 'gr', 'gram', 'liter', 'ltr', 'ml',
  'buah', 'sayur', 'daun', 'pipa', 'sanan', 'ras', 'emas', 'mentari', 'tropical', 'segitiga', 'biru',
]);

const SIZE_TOKEN_RE = /^\d+(?:[.,]\d+)?(?:kg|gr|g|ml|l|lt|ltr|pcs|pc|bks|sachet|pack|dus|sak)?$/;

const stripWaFormatting = (line: string) =>
  line
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[*_~`]/g, '')
    .trim();

function detectSectionCategory(cleanLine: string): PoCategory | null {
  // Baris judul seksi biasanya diakhiri ":" atau hanya nama kategori tanpa angka jumlah.
  const withoutColon = cleanLine.replace(/[:\-–—]+$/, '').trim();
  if (!withoutColon || /\d/.test(withoutColon)) return null;
  const lower = withoutColon.toLowerCase();
  if (/^(protein|lauk)(\s+(hewani|nabati))?$/.test(lower)) return 'Protein';
  if (/^(sembako|bahan\s+kering|karbohidrat)$/.test(lower)) return 'Sembako';
  if (/^sayur\s*(dan|&|\/)\s*buah$/.test(lower)) return 'Sayur dan Buah';
  if (/^(sayur|sayuran)$/.test(lower)) return 'Sayur';
  if (/^(buah|buah-buahan|buah\s+segar)$/.test(lower)) return 'Buah';
  if (/^(bumbu|bumbu\s+dapur|rempah)$/.test(lower)) return 'Bumbu';
  if (/^(bahan\s+olahan|olahan)$/.test(lower)) return 'Bahan Olahan';
  if (/^(lain[\s-]*lain|lainnya|pelengkap|non[\s-]*food|operasional)$/.test(lower)) return 'Lain-lain';
  return null;
}

function isIgnorableHeader(cleanLine: string): boolean {
  const lower = cleanLine.toLowerCase();
  if (!lower) return true;
  if (/^(sppg|list\s+order|daftar\s+(order|belanja|po|bahan)|order\s+bahan|po\s+bahan|belanja\s+menu|pesanan|hari|tanggal|tgl|menu\b)/i.test(lower)) {
    return true;
  }
  // Garis pemisah atau catatan singkat tanpa angka
  if (/^[-=_·•.]+$/.test(lower)) return true;
  return false;
}

function normalizeToken(raw: string): string {
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) return '';
  return SYNONYMS[clean] || clean;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

function coreTokens(tokens: string[]): string[] {
  const filtered = tokens.filter(t => !NOISE_TOKENS.has(t) && !SIZE_TOKEN_RE.test(t));
  return filtered.length > 0 ? filtered : tokens;
}

function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[b.length];
}

function tokensSimilar(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4) {
    if (a.startsWith(b) || b.startsWith(a)) return 0.88;
    const dist = editDistance(a, b);
    if (dist === 1) return 0.85;
    if (dist === 2 && Math.min(a.length, b.length) >= 6) return 0.72;
  }
  return 0;
}

function hasConflictingQualifier(aTokens: string[], bTokens: string[]): boolean {
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  for (const group of MUTUALLY_EXCLUSIVE_GROUPS) {
    const aIn = group.filter(w => aSet.has(w));
    const bIn = group.filter(w => bSet.has(w));
    if (aIn.length > 0 && bIn.length > 0) {
      const shares = aIn.some(w => bSet.has(w));
      if (!shares) return true;
    }
  }
  return false;
}

function scoreMasterMatch(queryRaw: string, item: ItemMaster): number {
  const qNorm = tokenize(queryRaw).join(' ');
  const mNorm = tokenize(item.name).join(' ');
  if (!qNorm || !mNorm) return 0;
  if (qNorm === mNorm) return 1;

  const qAll = tokenize(queryRaw);
  const mAll = tokenize(item.name);
  if (hasConflictingQualifier(qAll, mAll)) return 0;

  const qCore = coreTokens(qAll);
  const mCore = coreTokens(mAll);
  if (qCore.length === 0 || mCore.length === 0) return 0;

  if (qCore.join(' ') === mCore.join(' ')) return 0.96;

  // Hitung berapa token inti query yang cocok dengan token inti master, dan sebaliknya.
  const qBest = qCore.map(qt => Math.max(...mCore.map(mt => tokensSimilar(qt, mt))));
  const mBest = mCore.map(mt => Math.max(...qCore.map(qt => tokensSimilar(qt, mt))));

  const qMatchedCount = qBest.filter(s => s >= 0.72).length;
  if (qMatchedCount === 0) return 0;

  // Jika query punya >= 2 kata inti dan hanya 1 kata generik (mis. "tepung" atau "minyak" atau "bawang") yang cocok
  // sementara kata keduanya tidak cocok sama sekali, tolak agar "tepung maizena" tidak menebak "tepung terigu".
  const GENERIC_HEADS = new Set(['tepung', 'minyak', 'bawang', 'cabe', 'gula', 'susu', 'saus', 'kecap', 'ikan', 'daging', 'kacang', 'daun', 'buah', 'sayur', 'bumbu']);
  if (qCore.length >= 2 && qMatchedCount === 1) {
    const matchedIdx = qBest.findIndex(s => s >= 0.72);
    if (matchedIdx >= 0 && GENERIC_HEADS.has(qCore[matchedIdx])) return 0;
  }
  if (mCore.length >= 2 && mBest.filter(s => s >= 0.72).length === 1) {
    const matchedIdx = mBest.findIndex(s => s >= 0.72);
    if (matchedIdx >= 0 && GENERIC_HEADS.has(mCore[matchedIdx])) return 0;
  }

  const qCoverage = qBest.reduce((a, b) => a + b, 0) / qCore.length;
  const mCoverage = mBest.reduce((a, b) => a + b, 0) / mCore.length;

  // Frasa utuh termuat di master (mis. "beras" -> "Beras Mentari 25kg", "royco" -> "Royco 250gr")
  const paddedM = ` ${mCore.join(' ')} `;
  const paddedQ = ` ${qCore.join(' ')} `;
  if (paddedM.includes(paddedQ)) {
    return Math.min(0.94, 0.8 + 0.14 * mCoverage);
  }
  if (paddedQ.includes(paddedM)) {
    return Math.min(0.92, 0.78 + 0.14 * qCoverage);
  }

  // Semua kata inti query hadir di master (urutan bebas)
  if (qMatchedCount === qCore.length) {
    return Math.min(0.91, 0.74 * qCoverage + 0.17 * mCoverage);
  }

  // Sebagian besar kata inti cocok (mis. "brokoli hijau" -> "Brokoli", "tempe sanan" -> "Tempe")
  const combined = 0.6 * qCoverage + 0.4 * mCoverage;
  return combined >= 0.62 ? Number(combined.toFixed(3)) : 0;
}

function standardizeUnit(rawUnit: string): string {
  const clean = rawUnit.trim().toLowerCase().replace(/\.$/, '');
  if (!clean) return 'Kg';
  return UNIT_ALIASES[clean] || (clean.charAt(0).toUpperCase() + clean.slice(1));
}

function formatWaQty(qtyNumber: number, rawUnit: string, masterUnit?: string): string {
  const stdUnit = standardizeUnit(rawUnit);
  if (masterUnit) {
    const converted = convertQty(qtyNumber, stdUnit, masterUnit);
    if (converted !== null) {
      return `${converted} ${masterUnit}`;
    }
  }
  return `${qtyNumber} ${stdUnit}`;
}

function parseItemLine(cleanLine: string): { rawName: string; qtyNumber: number; rawUnit: string; rawQty: string } | null {
  // Buang nomor urut / bullet di awal: "1. ", "1) ", "- ", "• "
  const body = cleanLine.replace(/^(?:\d+\s*[.)\-]\s*|[•\-–—]\s+)/, '').trim();
  if (!body) return null;

  // Pola 1: "nama bahan 17 krat" atau "nama bahan : 15 kg" atau "nama bahan 15kg"
  const withUnitRe = new RegExp(`^(.+?)(?:\\s*[:=\\-–]\\s*|\\s+)(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_REGEX_PART})\\.?$`, 'i');
  const m1 = body.match(withUnitRe);
  if (m1) {
    const rawName = m1[1].replace(/[:=\-–]+$/, '').trim();
    const qtyNumber = parseFloat(m1[2].replace(',', '.'));
    const rawUnit = m1[3].trim();
    if (rawName && qtyNumber > 0) {
      return { rawName, qtyNumber, rawUnit, rawQty: `${m1[2]} ${rawUnit}` };
    }
  }

  // Pola 2: satuan kustom 1 kata setelah angka di akhir baris (mis. "tempe 45 potong")
  const genericUnitRe = /^(.+?)(?:\s*[:=\-–]\s*|\s+)(\d+(?:[.,]\d+)?)\s*([a-zA-Z]{2,12})\.?$/;
  const m2 = body.match(genericUnitRe);
  if (m2) {
    const rawName = m2[1].replace(/[:=\-–]+$/, '').trim();
    const qtyNumber = parseFloat(m2[2].replace(',', '.'));
    const rawUnit = m2[3].trim();
    if (rawName && qtyNumber > 0) {
      return { rawName, qtyNumber, rawUnit, rawQty: `${m2[2]} ${rawUnit}` };
    }
  }

  // Pola 3: angka saja di akhir tanpa satuan (mis. "telur ayam 10")
  const qtyOnlyRe = /^(.+?)(?:\s*[:=\-–]\s*|\s+)(\d+(?:[.,]\d+)?)$/;
  const m3 = body.match(qtyOnlyRe);
  if (m3) {
    const rawName = m3[1].replace(/[:=\-–]+$/, '').trim();
    const qtyNumber = parseFloat(m3[2].replace(',', '.'));
    if (rawName && qtyNumber > 0 && !/^\d{4}$/.test(m3[2])) {
      return { rawName, qtyNumber, rawUnit: '', rawQty: m3[2] };
    }
  }

  return null;
}

/**
 * Baca daftar PO dari teks WhatsApp dan cocokkan tiap bahan dengan Master Barang.
 * Mengembalikan daftar siap kroscek beserta baris yang tidak terbaca agar tidak ada bahan terlewat diam-diam.
 */
export function parseWhatsappPoText(text: string, masterItems: ItemMaster[]): ParsedWaPoResult {
  const activeItems = masterItems.filter(it => it.isActive !== false && it.itemType !== 'EQUIPMENT');
  const items: ParsedWaPoItem[] = [];
  const unparsedLines: string[] = [];
  let currentSection: PoCategory | undefined;

  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const clean = stripWaFormatting(rawLine);
    if (!clean) return;

    const section = detectSectionCategory(clean);
    if (section) {
      currentSection = section;
      return;
    }

    const parsed = parseItemLine(clean);
    if (!parsed) {
      if (!isIgnorableHeader(clean)) {
        unparsedLines.push(clean);
      }
      return;
    }

    const scored: MasterCandidate[] = activeItems
      .map(item => ({ item, score: scoreMasterMatch(parsed.rawName, item) }))
      .filter(c => c.score >= 0.62)
      .sort((a, b) => b.score - a.score || a.item.name.length - b.item.name.length)
      .slice(0, 3);

    const best = scored[0];
    const matchKind: MatchKind = best
      ? best.score >= 0.99
        ? 'EXACT'
        : 'SIMILAR'
      : 'NEW';

    const suggestedName = best ? best.item.name : parsed.rawName;
    const formattedQty = formatWaQty(parsed.qtyNumber, parsed.rawUnit, best?.item.baseUnit);

    // Kategori dari judul seksi WA diprioritaskan bila valid; bila tidak ada seksi, tebak dari nama/master.
    const inferred = inferPoCategory({
      itemName: suggestedName,
      masterCategory: best?.item.category,
      previous: currentSection,
    });
    const category: PoCategory = currentSection && isPoCategory(currentSection)
      ? (currentSection === 'Sayur dan Buah' && (inferred === 'Bumbu' || inferred === 'Sayur' || inferred === 'Buah') ? inferred : currentSection)
      : inferred;

    items.push({
      id: `wa-${idx}-${parsed.rawName.toLowerCase().slice(0, 12)}`,
      rawLine: clean,
      rawName: parsed.rawName,
      rawQty: parsed.rawQty,
      qtyNumber: parsed.qtyNumber,
      rawUnit: parsed.rawUnit,
      formattedQty,
      sectionCategory: currentSection,
      category,
      matchKind,
      matchedItem: best?.item,
      suggestedName,
      candidates: scored,
    });
  });

  return { items, unparsedLines };
}
