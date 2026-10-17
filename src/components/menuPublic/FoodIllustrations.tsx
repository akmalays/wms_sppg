import React, { useEffect, useState } from 'react';

/* ------------------------------------------------------------------ */
/* Ilustrasi makanan bawaan, dipilih dari nama bahan, agar petugas      */
/* tidak wajib mengunggah foto. Foto yang diunggah tetap didahulukan.   */
/* Gaya sama dengan hiasan alam (garis hijau tua, warna datar).         */
/* ------------------------------------------------------------------ */

const INK = '#1f4d2f';
const line = { stroke: INK, strokeWidth: 1.8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

type FoodKind =
  | 'nasi' | 'mie' | 'jagung'
  | 'ayam' | 'telur' | 'ikan' | 'daging' | 'tempe' | 'tahu'
  | 'sayur' | 'wortel'
  | 'pisang' | 'jeruk' | 'semangka' | 'apel'
  | 'susu' | 'piring';

const Bowl: React.FC<{ fill: string; children?: React.ReactNode }> = ({ fill, children }) => (
  <>
    {children}
    <path d="M8 34 H 56 C 56 47, 45 55, 32 55 C 19 55, 8 47, 8 34 Z" fill={fill} {...line} />
    <path d="M14 42 H 50" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" opacity="0.6" />
  </>
);

const Block: React.FC<{ front: string; top: string; side: string; children?: React.ReactNode }> = ({ front, top, side, children }) => (
  <>
    <path d="M10 26 L 19 17 H 55 L 46 26 Z" fill={top} {...line} />
    <path d="M46 26 L 55 17 V 39 L 46 48 Z" fill={side} {...line} />
    <rect x="10" y="26" width="36" height="22" rx="2" fill={front} {...line} />
    {children}
  </>
);

const SHAPES: Record<FoodKind, React.ReactNode> = {
  nasi: (
    <Bowl fill="#d6a76c">
      <path d="M12 34 C 12 22, 21 15, 32 15 C 43 15, 52 22, 52 34 Z" fill="#ffffff" {...line} />
      {[[22, 24], [30, 20], [38, 23], [26, 30], [35, 29], [43, 30], [19, 31]].map(([x, y]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx="2.2" ry="1.2" fill="#e2e8f0" />
      ))}
    </Bowl>
  ),
  mie: (
    <Bowl fill="#fca5a5">
      <path d="M11 34 C 12 26, 20 22, 32 22 C 44 22, 52 26, 53 34 Z" fill="#fde68a" {...line} />
      <path d="M16 31 q 4 -5 8 0 t 8 0 t 8 0 t 8 0 M18 27 q 4 -4 8 0 t 8 0 t 8 0" fill="none" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M40 10 L 30 30 M46 12 L 34 31" {...line} fill="none" />
    </Bowl>
  ),
  jagung: (
    <>
      <path d="M20 54 C 10 44, 12 26, 22 18 C 22 34, 26 46, 32 54 Z" fill="#4ade80" {...line} />
      <path d="M32 8 C 42 8, 46 20, 44 36 C 42 50, 36 56, 32 56 C 28 56, 22 50, 20 36 C 18 20, 22 8, 32 8 Z" fill="#fcd34d" {...line} />
      <path d="M24 20 H 40 M22 28 H 42 M22 36 H 42 M24 44 H 40 M28 12 V 52 M36 12 V 52" stroke="#f59e0b" strokeWidth="1.4" />
      <path d="M44 54 C 54 44, 52 26, 42 18 C 42 34, 38 46, 32 54 Z" fill="#22c55e" {...line} />
    </>
  ),
  ayam: (
    <>
      <path d="M24 42 L 13 53" stroke={INK} strokeWidth="8" strokeLinecap="round" />
      <path d="M24 42 L 13 53" stroke="#ffffff" strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="10" cy="51" r="3.5" fill="#ffffff" {...line} />
      <circle cx="15" cy="56" r="3.5" fill="#ffffff" {...line} />
      <path d="M22 42 C 12 32, 16 12, 34 10 C 52 9, 58 28, 46 38 C 40 43, 30 47, 22 42 Z" fill="#e8a33d" {...line} />
      <path d="M30 18 C 36 15, 44 16, 48 22" fill="none" stroke="#fde68a" strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  telur: (
    <>
      <path d="M32 9 C 46 9, 55 19, 53 31 C 57 44, 45 55, 32 53 C 18 57, 7 46, 11 34 C 7 20, 18 9, 32 9 Z" fill="#ffffff" {...line} />
      <circle cx="32" cy="32" r="10" fill="#fbbf24" {...line} />
      <circle cx="28.5" cy="28.5" r="2.5" fill="#fef3c7" />
    </>
  ),
  ikan: (
    <>
      <path d="M48 32 L 59 21 L 57 32 L 59 43 Z" fill="#f59e0b" {...line} />
      <path d="M6 32 C 16 17, 38 15, 50 32 C 38 49, 16 47, 6 32 Z" fill="#f59e0b" {...line} />
      <path d="M22 24 C 26 29, 26 35, 22 40" fill="none" {...line} />
      <path d="M30 26 L 34 30 M30 34 L 34 38 M38 27 L 42 31 M38 33 L 42 37" stroke="#b45309" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="15" cy="30" r="2" fill={INK} />
    </>
  ),
  daging: (
    <>
      <path d="M9 30 C 9 19, 24 13, 38 15 C 54 17, 59 30, 52 41 C 46 51, 22 53, 14 45 C 10 41, 9 36, 9 30 Z" fill="#b45309" {...line} />
      <path d="M18 28 C 24 24, 32 30, 40 24 M20 38 C 28 34, 36 40, 46 34" fill="none" stroke="#fcd9b6" strokeWidth="2.2" strokeLinecap="round" />
    </>
  ),
  tempe: (
    <Block front="#e9d7a5" top="#f5e9c4" side="#cfb57a">
      {[[15, 31], [22, 35], [29, 30], [36, 36], [41, 31], [17, 42], [26, 43], [34, 42], [41, 43]].map(([x, y]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx="2.4" ry="1.8" fill="#c89b52" />
      ))}
    </Block>
  ),
  tahu: (
    <Block front="#fde68a" top="#fef3c7" side="#fbbf24">
      {[[18, 33], [30, 38], [39, 32], [22, 42]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.2" fill="#f59e0b" />)}
    </Block>
  ),
  sayur: (
    <Bowl fill="#ffffff">
      <path d="M10 34 C 12 28, 22 25, 32 25 C 42 25, 52 28, 54 34 Z" fill="#fde68a" {...line} />
      <path d="M20 26 C 16 18, 22 12, 28 16 C 28 22, 24 26, 20 26 Z" fill="#22c55e" {...line} />
      <path d="M40 25 C 40 16, 48 13, 52 18 C 50 24, 45 26, 40 25 Z" fill="#4ade80" {...line} />
      <circle cx="26" cy="30" r="3.5" fill="#fb923c" {...line} />
      <circle cx="36" cy="29" r="3.5" fill="#fb923c" {...line} />
      <rect x="42" y="28" width="7" height="4" rx="2" fill="#86efac" {...line} />
    </Bowl>
  ),
  wortel: (
    <>
      <path d="M42 18 C 44 10, 52 8, 56 12 M44 20 C 50 18, 56 20, 58 26 M40 16 C 38 10, 40 6, 44 6" fill="none" stroke="#22c55e" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M38 16 L 48 26 L 18 54 C 12 58, 6 52, 10 46 Z" fill="#fb923c" {...line} />
      <path d="M26 34 L 30 38 M20 42 L 23 45 M32 26 L 36 30" stroke="#c2410c" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  pisang: (
    <>
      <path d="M10 22 C 12 46, 36 56, 56 42 C 54 39, 51 38, 48 39 C 34 46, 20 38, 17 21 Z" fill="#fcd34d" {...line} />
      <path d="M17 24 C 22 36, 32 41, 44 40" fill="none" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="10" y="15" width="7" height="8" rx="2" fill="#a16207" {...line} />
    </>
  ),
  jeruk: (
    <>
      <circle cx="32" cy="36" r="19" fill="#fb923c" {...line} />
      <path d="M32 17 C 34 11, 40 9, 46 11 C 44 17, 38 19, 32 17 Z" fill="#22c55e" {...line} />
      {[[24, 30], [38, 28], [30, 42], [42, 40], [22, 40]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" fill="#c2410c" />)}
    </>
  ),
  semangka: (
    <>
      <path d="M6 24 A 26 26 0 0 0 58 24 Z" fill="#22c55e" {...line} />
      <path d="M11 24 A 21 21 0 0 0 53 24 Z" fill="#f87171" />
      {[[22, 30], [32, 36], [42, 30], [27, 40], [37, 41]].map(([x, y]) => <ellipse key={`${x}${y}`} cx={x} cy={y} rx="1.4" ry="2.2" fill={INK} />)}
      <path d="M6 24 H 58" {...line} />
    </>
  ),
  apel: (
    <>
      <path d="M32 20 C 24 12, 10 18, 12 34 C 14 48, 24 56, 32 50 C 40 56, 50 48, 52 34 C 54 18, 40 12, 32 20 Z" fill="#ef4444" {...line} />
      <path d="M32 20 C 32 14, 34 10, 36 8" fill="none" {...line} />
      <path d="M35 13 C 40 8, 48 9, 50 13 C 45 17, 39 17, 35 13 Z" fill="#22c55e" {...line} />
      <path d="M20 28 C 19 32, 20 36, 22 38" fill="none" stroke="#fecaca" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  susu: (
    <>
      <path d="M20 22 L 26 10 H 38 L 44 22 Z" fill="#bfdbfe" {...line} />
      <rect x="20" y="22" width="24" height="34" rx="2" fill="#ffffff" {...line} />
      <path d="M32 30 C 36 36, 38 39, 38 42 A 6 6 0 0 1 26 42 C 26 39, 28 36, 32 30 Z" fill="#60a5fa" {...line} />
    </>
  ),
  piring: (
    <>
      <circle cx="32" cy="34" r="20" fill="#ffffff" {...line} />
      <circle cx="32" cy="34" r="13" fill="none" stroke="#e2e8f0" strokeWidth="2" />
      <path d="M8 16 V 28 M5 16 V 23 C 5 26, 11 26, 11 23 V 16" fill="none" {...line} />
      <path d="M8 28 V 52" {...line} />
      <path d="M56 16 C 60 20, 60 28, 56 30 V 52" fill="none" {...line} />
    </>
  )
};

// Urutan penting: buah dan hidangan khusus dicek dulu agar "Sayur Sop Wortel" jadi sayur, bukan wortel.
const KEYWORDS: [FoodKind, RegExp][] = [
  ['susu', /susu|yoghurt|yogurt/],
  ['pisang', /pisang/],
  ['jeruk', /jeruk/],
  ['semangka', /semangka|melon/],
  ['apel', /apel|pir\b|salak|jambu/],
  ['telur', /telur|telor/],
  ['ikan', /ikan|lele|tongkol|bandeng|nila|tuna|patin|kembung|bawal/],
  ['ayam', /ayam|bebek|unggas/],
  ['daging', /daging|sapi|rendang|empal|bakso|semur|kambing/],
  ['tempe', /tempe/],
  ['tahu', /tahu/],
  ['sayur', /sop|sup|sayur|bayam|kangkung|sawi|buncis|kubis|kol\b|brokoli|capcay|lodeh|asem|labu|terong|kacang panjang|pecel|tumis/],
  ['wortel', /wortel/],
  ['jagung', /jagung/],
  ['mie', /mie|mi\b|bihun|soun|spageti|makaroni/],
  ['nasi', /nasi|beras|lontong|ketupat|kentang|ubi|singkong|roti/]
];

export function foodKind(name: string, category = ''): FoodKind {
  const n = name.toLowerCase();
  const hit = KEYWORDS.find(([, re]) => re.test(n));
  if (hit) return hit[0];
  const c = category.toLowerCase();
  if (c.includes('karbo') || c.includes('pokok')) return 'nasi';
  if (c.includes('sayur')) return 'sayur';
  if (c.includes('nabati')) return 'tempe';
  return 'piring';
}

/** Ilustrasi sebagai elemen <svg>; bisa dipakai di HTML maupun di dalam SVG lain (pakai x/y/width/height). */
export const FoodIllustration: React.FC<{ name: string; category?: string } & React.SVGProps<SVGSVGElement>> = ({ name, category, ...svgProps }) => (
  <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...svgProps}>
    {SHAPES[foodKind(name, category)]}
  </svg>
);

/**
 * Foto bahan bila ada dan berhasil dimuat; selain itu ilustrasi bawaan di atas latar warna kelompoknya.
 * `className` mengatur ukuran dan sudut kotak; `photoClassName` khusus untuk foto (mis. object-cover).
 */
export const FoodImage: React.FC<{
  name: string;
  category: string;
  imageUrl?: string;
  alt: string;
  tint: string;
  className?: string;
  photoClassName?: string;
  illustrationClassName?: string;
}> = ({ name, category, imageUrl, alt, tint, className = '', photoClassName = 'object-cover', illustrationClassName = 'w-[72%] h-[72%]' }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);

  if (imageUrl && !failed) {
    return <img src={imageUrl} alt={alt} loading="lazy" onError={() => setFailed(true)} className={`${className} ${photoClassName}`} style={{ backgroundColor: tint }} />;
  }
  return (
    <div role={alt ? 'img' : undefined} aria-label={alt ? `Ilustrasi ${name}` : undefined} className={`${className} flex items-center justify-center`} style={{ backgroundColor: tint }}>
      <FoodIllustration name={name} category={category} className={illustrationClassName} />
    </div>
  );
};
