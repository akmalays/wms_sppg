// Desain poster menu yang digambar langsung di kanvas (bukan dari gambar template Canva).
// Ukuran kanvas A4 tegak 1587 x 2245 px, sama dengan template gambar 1 menu.

export interface PosterTrayBox {cx: number; cy: number; w: number; h: number; rot: number}

/**
 * Letak satu nama hidangan di poster (koordinat kanvas 1587 x 2245): titik tengah teks dan ujung panah.
 * label: nama yang ditulis petugas, menggantikan nama dari daftar hidangan. labelFor: nama hidangan saat label ditulis,
 * supaya label tidak menempel ke hidangan lain bila daftar hidangan berubah.
 */
export interface LabelPlacement {x: number; y: number; tipX: number; tipY: number; label?: string; labelFor?: string}

/** Nama yang ditampilkan untuk satu label: tulisan petugas bila masih untuk hidangan yang sama, selain itu nama hidangan. */
export function shownLabel(text: string, placed: LabelPlacement | null | undefined): string {
  const custom = placed?.label?.trim();
  if (!custom) return text;
  if (placed?.labelFor && placed.labelFor.trim().toLowerCase() !== text.trim().toLowerCase()) return text;
  return custom;
}

/** Satu menu di poster: hidangan, nilai gizi, dan cara menggambar foto nampannya. */
export interface DrawnMenu {
  items: string[];
  /** Baris gizi siap cetak, mis. {label: "Energi", value: "763,1 kkal"}; value "-" bila kosong. */
  large: {label: string; value: string}[];
  small: {label: string; value: string}[];
  /** Menggambar foto nampan (atau tempat foto bila belum diunggah) di kotak yang diberikan. */
  drawTray: (box: PosterTrayBox, placeholder: {fill: string; stroke: string; text: string}) => void;
  /** Letak label yang digeser petugas, per urutan label; kosong atau null = letak bawaan desain. */
  labelPlacements?: (LabelPlacement | null)[];
}

interface CroppedImage {img: HTMLImageElement; sx: number; sy: number; sw: number; sh: number}

/** Poster 1 menu memakai menu pertama langsung dari input; poster 2 menu memakai `menus`. */
export interface DrawnPosterInput extends DrawnMenu {
  /** "Selasa, 3 November 2026" */
  dateLong: string;
  menus: DrawnMenu[];
  logo: HTMLImageElement;
  slhs: CroppedImage;
  yayasan: CroppedImage;
}

export const SOCIAL = {instagram: "sppgmalangtumpangjeru", tiktok: "sppg.jeru"};

const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
const W = 1587;
const H = 2245;
// Poster 2 menu: A4 mendatar, sama dengan template gambar 2 menu.
const DW = 2245;
const DH = 1587;
const DOUBLE_MENU_TITLES = ["Menu Sekolah", "Menu 3B"];
const YAYASAN_LINES = ["YAYASAN PENDIDIKAN DAN SOSIAL", "ISLAM DARUSSALAM AL-MACHFUDZ"];

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || ctx.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Ukuran huruf terbesar (<= px) yang membuat teks muat di lebar maxWidth.
function fitPx(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, px: number, maxWidth: number, minPx = 12): number {
  for (; px > minPx; px -= 2) {
    ctx.font = font(px);
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  ctx.font = font(px);
  return px;
}

function drawImageFit(ctx: CanvasRenderingContext2D, img: CanvasImageSource, iw: number, ih: number, x: number, y: number, w: number, h: number, crop?: [number, number, number, number]) {
  const s = Math.min(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  if (crop) ctx.drawImage(img, crop[0], crop[1], crop[2], crop[3], dx, dy, dw, dh);
  else ctx.drawImage(img, dx, dy, dw, dh);
}

function drawSlhs(ctx: CanvasRenderingContext2D, slhs: CroppedImage, x: number, y: number, w: number, h: number) {
  drawImageFit(ctx, slhs.img, slhs.sw, slhs.sh, x, y, w, h, [slhs.sx, slhs.sy, slhs.sw, slhs.sh]);
}

// Panah lengkung dari (x1, y1) ke (x2, y2); bend menggeser titik kendali tegak lurus garis.
/** Bentuk panah sebagai path SVG, supaya halaman publik menggambar panah yang sama dengan poster. */
export function arrowPaths(x1: number, y1: number, x2: number, y2: number, bend: number, width: number): {line: string; head: string} {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const cx = mx + (-(y2 - y1) / len) * bend;
  const cy = my + ((x2 - x1) / len) * bend;
  const angle = Math.atan2(y2 - cy, x2 - cx);
  const head = width * 4.2;
  return {
    line: `M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}`,
    head: `M${x2 - head * Math.cos(angle - 0.55)} ${y2 - head * Math.sin(angle - 0.55)}L${x2} ${y2}L${x2 - head * Math.cos(angle + 0.55)} ${y2 - head * Math.sin(angle + 0.55)}`,
  };
}

function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, bend: number, color: string, width: number) {
  const {line, head} = arrowPaths(x1, y1, x2, y2, bend, width);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(line));
  ctx.stroke(new Path2D(head));
  ctx.restore();
}

function drawInstagramIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  ctx.roundRect(x + s * 0.05, y + s * 0.05, s * 0.9, s * 0.9, s * 0.26);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + s / 2, y + s / 2, s * 0.21, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + s * 0.74, y + s * 0.26, s * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTiktokIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.13;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + s * 0.56, y + s * 0.08);
  ctx.lineTo(x + s * 0.56, y + s * 0.68);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + s * 0.38, y + s * 0.7, s * 0.18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + s * 0.56, y + s * 0.08);
  ctx.quadraticCurveTo(x + s * 0.62, y + s * 0.34, x + s * 0.9, y + s * 0.36);
  ctx.stroke();
  ctx.restore();
}

// Baris Instagram dan TikTok, dipusatkan di (cx, cy).
function drawSocialRow(ctx: CanvasRenderingContext2D, cx: number, cy: number, px: number, color: string) {
  ctx.save();
  ctx.font = `600 ${px}px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "middle";
  const icon = px * 1.25;
  const gapIcon = px * 0.45;
  const gapGroup = px * 1.6;
  const igW = ctx.measureText(SOCIAL.instagram).width;
  const ttW = ctx.measureText(SOCIAL.tiktok).width;
  const total = icon + gapIcon + igW + gapGroup + icon + gapIcon + ttW;
  let x = cx - total / 2;
  drawInstagramIcon(ctx, x, cy - icon / 2, icon, color);
  x += icon + gapIcon;
  ctx.fillText(SOCIAL.instagram, x, cy);
  x += igW + gapGroup;
  drawTiktokIcon(ctx, x, cy - icon / 2, icon, color);
  x += icon + gapIcon;
  ctx.fillText(SOCIAL.tiktok, x, cy);
  ctx.restore();
}

// Teks beberapa baris rata tengah, blok dipusatkan vertikal di cy.
function drawCenteredLines(ctx: CanvasRenderingContext2D, lines: string[], cx: number, cy: number, px: number) {
  const lh = px * 1.15;
  let y = cy - ((lines.length - 1) * lh) / 2;
  for (const line of lines) {
    ctx.fillText(line, cx, y);
    y += lh;
  }
}

// ---------------------------------------------------------------------------------------------
// Doodle makanan transparan di lapisan paling belakang, agar latar tidak polos. Gambar garis dalam kotak 24 x 24;
// susunan, putaran, dan ukurannya dibuat acak dengan rumus tetap supaya poster yang sama selalu tampak sama.
// ---------------------------------------------------------------------------------------------

const DOODLE_PATHS = [
  "M3 12h18a9 8 0 0 1-18 0zM8 9q1.5-2 0-4M12 9q1.5-2 0-4M16 9q1.5-2 0-4", // mangkuk berasap
  "M12 7c-4-3-9 1-8 6s5 9 8 7c3 2 7-2 8-7s-4-9-8-6zM12 7V3M12 5q3-3 6-1q-3 3-6 1z", // apel
  "M2 12q7-8 15 0q-8 8-15 0zM17 12l5-5v10zM6.5 10.5h.01", // ikan
  "M5 5h12l-1.5 15h-9zM17 8q5 0 3.5 5-1 2.5-4 2", // cangkir
  "M4 21l10-10 3 3zM8 17l2-2M11 14l1.5 1.5M15 11l4-4M16 13l5-2M14 10l1-5", // wortel
  "M3 14c0-6 7-8 10-5 5 0 6 7 1 8-2 4-10 3-11-3zM13 13a2.5 2.5 0 1 0-5 0a2.5 2.5 0 1 0 5 0", // telur ceplok
  "M8 3v6a3 3 0 0 0 6 0V3M11 3v18", // garpu
  "M12 3c-3 0-4 3-4 5s1.5 4 4 4 4-2 4-4-1-5-4-5zM12 12v9", // sendok
  "M4 20C4 9 12 4 21 4c0 9-6 16-17 16zM4 20L15 9", // daun
  "M5 5c0 9 6 15 16 14-1 2-4 3-7 3C7 22 3 14 5 5z", // pisang
  "M7 9l3-5h5l2 5v12H7zM7 9h10M10 4V3h5v1", // kotak susu
  "M12 7a8 8 0 1 0 .01 0zM12 7L9 4M12 7l3-3M12 7V3", // tomat
];

// Bilangan semu 0..1 yang tetap untuk tiap sel.
const doodleRand = (col: number, row: number, salt: number) => {
  const v = Math.sin(col * 127.1 + row * 311.7 + salt * 74.7) * 43758.5453;
  return v - Math.floor(v);
};

function drawDoodles(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, alpha: number) {
  const cell = 138;
  const size = 80;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const paths = DOODLE_PATHS.map((d) => new Path2D(d));
  const rows = Math.ceil(h / cell) + 1;
  const cols = Math.ceil(w / cell) + 1;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const px = x + col * cell + (row % 2 ? cell / 2 : 0) + (doodleRand(col, row, 1) - 0.5) * 34;
      const py = y + row * cell + (doodleRand(col, row, 2) - 0.5) * 34;
      // Baris genap dan ganjil bergeser pola agar doodle yang sama tidak bertumpuk berdekatan.
      const path = paths[(col * 5 + row * 7 + Math.floor(doodleRand(col, row, 3) * 3)) % paths.length];
      const scale = (size / 24) * (0.85 + doodleRand(col, row, 4) * 0.35);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((doodleRand(col, row, 5) - 0.5) * 0.9);
      ctx.scale(scale, scale);
      ctx.translate(-12, -12);
      ctx.lineWidth = 1.15;
      ctx.stroke(path);
      ctx.restore();
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------
// Hijau: nama hidangan di sekeliling nampan dengan panah, nilai gizi dua kolom di bawah.
// Urutan hidangan mengikuti urutan baris isian: kiri atas, kanan atas, kiri bawah, kanan bawah, bawah.
// ---------------------------------------------------------------------------------------------

const GREEN_LABEL_SLOTS = [
  {x: 200, y: 990, from: [450, 1000], to: [318, 958], bend: -36, wrapW: 300},
  {x: 1387, y: 990, from: [1137, 1000], to: [1269, 958], bend: 36, wrapW: 300},
  {x: 200, y: 1345, from: [450, 1395], to: [318, 1385], bend: 36, wrapW: 300},
  {x: 1387, y: 1345, from: [1137, 1395], to: [1269, 1385], bend: -36, wrapW: 300},
  {x: 793, y: 1610, from: [793, 1420], to: [793, 1540], bend: 26, wrapW: 640},
];

/** Label desain Hijau: 4 hidangan pertama masing-masing satu label, sisanya digabung di label ke-5. */
export function greenLabelTexts(items: string[]): string[] {
  const clean = items.map((it) => it.trim()).filter(Boolean);
  const labels = clean.slice(0, 4);
  if (clean.length > 4) labels.push(clean.slice(4).join(", "));
  return labels;
}

export const GREEN_TRAY_CENTER = [793, 1205];

/** Kotak foto nampan Hijau sebelum diputar -90 derajat. */
export const GREEN_TRAY_BOX = {w: 540, h: 790};

/** Bagian poster Hijau yang berisi nampan dan nama hidangan (di antara dua garis mendatar). */
export const GREEN_TRAY_BAND = {x: 0, y: 790, w: W, h: 890};

/** Lebar teks label bawaan Hijau, per urutan label. */
export const GREEN_LABEL_WRAP = GREEN_LABEL_SLOTS.map((s) => s.wrapW);

/**
 * Letak bawaan label Hijau dalam bentuk yang bisa digeser. tip adalah pangkal panah di makanan (panah berangkat
 * dari nampan menuju teks), jadi petugas menggeser tip ke sekat yang benar di foto.
 */
export const GREEN_LABEL_DEFAULTS: LabelPlacement[] = GREEN_LABEL_SLOTS.map((s) => ({x: s.x, y: s.y, tipX: s.from[0], tipY: s.from[1]}));

// Ukuran kotak teks label, dipakai untuk menentukan dari mana panah custom berangkat.
export function labelLines(ctx: CanvasRenderingContext2D, text: string, wrapW: number, maxPx: number, minPx: number, fontOf: (px: number) => string = (px) => `500 ${px}px ${SANS}`): {lines: string[]; px: number} {
  let px = maxPx;
  let lines: string[] = [];
  for (; px >= minPx; px -= 2) {
    ctx.font = fontOf(px);
    lines = wrap(ctx, text, wrapW);
    if (lines.length <= 3) break;
  }
  return {lines, px};
}

/**
 * Panah custom: berangkat dari titik makanan yang ditunjuk petugas menuju tepi kotak teks, sama seperti panah bawaan.
 * Lengkungan dibuat menjauhi tengah nampan agar tidak memotong foto. Null bila titik makanan di dalam atau terlalu
 * dekat dengan teks, panahnya tidak digambar.
 */
export function placedArrow(p: LabelPlacement, halfW: number, halfH: number, center: number[]): {x1: number; y1: number; x2: number; y2: number; bend: number} | null {
  const dx = p.tipX - p.x;
  const dy = p.tipY - p.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return null;
  const exit = Math.min(dx ? halfW / Math.abs(dx) : Infinity, dy ? halfH / Math.abs(dy) : Infinity);
  const ex = p.x + dx * exit + (dx / len) * 22;
  const ey = p.y + dy * exit + (dy / len) * 22;
  const ax = ex - p.tipX;
  const ay = ey - p.tipY;
  const alen = Math.hypot(ax, ay);
  if (exit >= 1 || alen < 40) return null;
  const mx = (p.tipX + ex) / 2 - center[0];
  const my = (p.tipY + ey) / 2 - center[1];
  const away = (-ay / alen) * mx + (ax / alen) * my >= 0 ? 1 : -1;
  return {x1: p.tipX, y1: p.tipY, x2: ex, y2: ey, bend: Math.min(48, alen * 0.22) * away};
}

function drawPlacedArrow(ctx: CanvasRenderingContext2D, p: LabelPlacement, halfW: number, halfH: number, center: number[], arrowW: number) {
  const arrow = placedArrow(p, halfW, halfH, center);
  if (arrow) drawArrow(ctx, arrow.x1, arrow.y1, arrow.x2, arrow.y2, arrow.bend, "#ffffff", arrowW);
}

type GreenSlot = (typeof GREEN_LABEL_SLOTS)[number];

function drawGreenLabels(
  ctx: CanvasRenderingContext2D,
  menu: DrawnMenu,
  slots: GreenSlot[],
  center: number[],
  type: {maxPx: number; minPx: number; arrowW: number}
) {
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  greenLabelTexts(menu.items).forEach((text, i) => {
    const slot = slots[i];
    const placed = menu.labelPlacements?.[i];
    const {lines, px} = labelLines(ctx, shownLabel(text, placed), slot.wrapW, type.maxPx, type.minPx);
    ctx.font = `500 ${px}px ${SANS}`;
    if (placed) {
      drawCenteredLines(ctx, lines, placed.x, placed.y, px);
      const halfW = Math.max(...lines.map((l) => ctx.measureText(l).width)) / 2;
      const halfH = (lines.length * px * 1.15) / 2;
      drawPlacedArrow(ctx, placed, halfW, halfH, center, type.arrowW);
    } else {
      drawCenteredLines(ctx, lines, slot.x, slot.y, px);
      drawArrow(ctx, slot.from[0], slot.from[1], slot.to[0], slot.to[1], slot.bend, "#ffffff", type.arrowW);
    }
  });
  ctx.textAlign = "left";
}

// ---------------------------------------------------------------------------------------------
// Ornamen sayur untuk desain Hijau, digambar vektor dengan bayangan agar tampak seperti potongan foto.
// ---------------------------------------------------------------------------------------------

function withShadow(ctx: CanvasRenderingContext2D, blur: number, offsetY: number, draw: () => void) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.32)";
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = offsetY;
  draw();
  ctx.restore();
}

// Daun runcing (seperti daun salam/kemangi): pangkal di (x, y), memanjang ke arah angle sepanjang len.
function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, width = 0.36, tone: "dark" | "light" = "dark") {
  const w = len * width;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const grad = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
  if (tone === "light") {
    grad.addColorStop(0, "#a6d65a");
    grad.addColorStop(1, "#5d9e2c");
  } else {
    grad.addColorStop(0, "#7fbf45");
    grad.addColorStop(1, "#3e7d23");
  }
  withShadow(ctx, len * 0.12, len * 0.05, () => {
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(len * 0.25, -w * 0.95, len * 0.7, -w * 0.75, len, 0);
    ctx.bezierCurveTo(len * 0.7, w * 0.75, len * 0.25, w * 0.95, 0, 0);
    ctx.fill();
  });
  // Tulang daun dan urat
  ctx.strokeStyle = "rgba(225, 245, 190, 0.75)";
  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.5, len * 0.012);
  ctx.beginPath();
  ctx.moveTo(-len * 0.06, 0);
  ctx.quadraticCurveTo(len * 0.5, -w * 0.06, len * 0.94, 0);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, len * 0.006);
  ctx.strokeStyle = "rgba(225, 245, 190, 0.45)";
  for (let i = 1; i <= 5; i++) {
    const t = i / 6.2;
    const bx = len * t;
    const span = Math.sin(Math.PI * t) * w * 0.38;
    ctx.beginPath();
    ctx.moveTo(bx, 0);
    ctx.quadraticCurveTo(bx + len * 0.06, -span * 0.6, bx + len * 0.11, -span);
    ctx.moveTo(bx, 0);
    ctx.quadraticCurveTo(bx + len * 0.06, span * 0.6, bx + len * 0.11, span);
    ctx.stroke();
  }
  ctx.restore();
}

function drawTomato(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  withShadow(ctx, r * 0.35, r * 0.14, () => {
    const body = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
    body.addColorStop(0, "#ff8a66");
    body.addColorStop(0.45, "#e8392a");
    body.addColorStop(1, "#a3170f");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.06, r * 0.94, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // Lekuk halus agar tidak terlihat seperti bola
  ctx.strokeStyle = "rgba(120, 15, 8, 0.25)";
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.1, cy - r * 0.85);
  ctx.quadraticCurveTo(cx - r * 0.45, cy, cx - r * 0.15, cy + r * 0.85);
  ctx.moveTo(cx + r * 0.2, cy - r * 0.85);
  ctx.quadraticCurveTo(cx + r * 0.55, cy, cx + r * 0.3, cy + r * 0.82);
  ctx.stroke();
  // Kilau
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.42, cy - r * 0.45, r * 0.2, r * 0.1, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(cx - r * 0.18, cy - r * 0.62, r * 0.05, 0, Math.PI * 2);
  ctx.fill();
  // Kelopak dan tangkai
  const top = cy - r * 0.82;
  ctx.fillStyle = "#2f7a26";
  ctx.strokeStyle = "#235e1c";
  ctx.lineWidth = r * 0.02;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const tipX = cx + Math.cos(a) * r * 0.62;
    const tipY = top + Math.sin(a) * r * 0.3;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a - 0.5) * r * 0.08, top + Math.sin(a - 0.5) * r * 0.05);
    ctx.quadraticCurveTo(cx + Math.cos(a) * r * 0.35, top + Math.sin(a) * r * 0.25 - r * 0.06, tipX, tipY);
    ctx.quadraticCurveTo(cx + Math.cos(a) * r * 0.3, top + Math.sin(a) * r * 0.12, cx + Math.cos(a + 0.5) * r * 0.08, top + Math.sin(a + 0.5) * r * 0.05);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = "#2f6b22";
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, top);
  ctx.quadraticCurveTo(cx + r * 0.05, top - r * 0.2, cx + r * 0.18, top - r * 0.28);
  ctx.stroke();
  ctx.restore();
}

// Rumpun daun lebar (selada/kemangi) di bawah tomat.
function drawLeafCluster(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, flip = 1) {
  const leaves: [number, number, number, number, "dark" | "light"][] = [
    [-0.35, 0.1, 0.95, Math.PI * 0.95, "dark"],
    [0.3, 0.15, 0.9, Math.PI * 0.05, "dark"],
    [-0.1, 0.25, 1.0, Math.PI * 0.62, "light"],
    [0.05, 0.2, 0.85, Math.PI * 0.3, "light"],
    [-0.2, 0.15, 0.8, Math.PI * 0.8, "light"],
  ];
  for (const [dx, dy, l, a, tone] of leaves) {
    const angle = flip === 1 ? a : Math.PI - a;
    drawLeaf(ctx, cx + dx * size * flip, cy + dy * size, size * l, angle, 0.62, tone);
  }
}

function drawGreenOrnaments(ctx: CanvasRenderingContext2D) {
  // Kanan atas, di samping judul: rumpun daun dengan dua tomat
  drawLeafCluster(ctx, 1420, 690, 260, -1);
  drawTomato(ctx, 1540, 470, 120);
  drawTomato(ctx, 1360, 590, 135);
  // Kiri bawah, di antara label dan nilai gizi: rumpun daun dengan satu tomat yang terpotong tepi
  drawLeafCluster(ctx, 30, 1610, 190, 1);
  drawTomato(ctx, 40, 1530, 115);
  // Daun lepas di tepi
  drawLeaf(ctx, 30, 330, 190, -0.9, 0.38, "light");
  drawLeaf(ctx, 1590, 1170, 170, Math.PI + 0.5, 0.38);
  drawLeaf(ctx, -10, 1150, 150, 0.35, 0.38, "light");
  // Kaki: kemangi di kedua sudut, di atas pil sosial media
  drawLeaf(ctx, 0, 2060, 200, -0.25, 0.55);
  drawLeaf(ctx, 20, 2110, 170, -0.7, 0.55, "light");
  drawLeaf(ctx, 1590, 2040, 210, Math.PI + 0.3, 0.55);
  drawLeaf(ctx, 1590, 2100, 170, Math.PI + 0.75, 0.55, "light");
}

export function drawGreenPoster(ctx: CanvasRenderingContext2D, input: DrawnPosterInput) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#2d6e3e");
  bg.addColorStop(1, "#1f5130");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  drawDoodles(ctx, 0, 0, W, H, "#ffffff", 0.09);
  drawGreenOrnaments(ctx);

  // Kepala: logo SPPG dan nama di kiri, SLHS di kanan. Kedua logo berlatar putih kotak, jadi
  // dipangkas di lingkaran putih agar sudutnya tidak menonjol di latar hijau.
  ctx.fillStyle = "#ffffff";
  ctx.save();
  ctx.beginPath();
  ctx.arc(155, 131, 72, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  drawImageFit(ctx, input.logo, input.logo.naturalWidth, input.logo.naturalHeight, 90, 66, 130, 130);
  ctx.restore();
  ctx.font = `800 40px ${SANS}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("SPPG MALANG", 242, 122);
  ctx.fillText("TUMPANG JERU", 242, 170);
  ctx.save();
  ctx.beginPath();
  ctx.arc(1417, 131, 92, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  drawSlhs(ctx, input.slhs, 1342, 73, 150, 116);
  ctx.restore();

  // Judul dan tanggal
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 200px ${SANS}`;
  ctx.fillText("Menu MBG", 140, 440);
  ctx.fillText("Hari ini", 140, 630);
  fitPx(ctx, input.dateLong, (px) => `400 ${px}px ${SANS}`, 70, 1300);
  ctx.fillText(input.dateLong, 150, 730);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 790);
  ctx.lineTo(W, 790);
  ctx.stroke();

  // Foto tegak memanjang diputar -90 derajat agar nampan tampil mendatar
  input.drawTray({cx: GREEN_TRAY_CENTER[0], cy: GREEN_TRAY_CENTER[1], ...GREEN_TRAY_BOX, rot: -90}, {fill: "rgba(255,255,255,0.08)", stroke: "rgba(255,255,255,0.6)", text: "#ffffff"});

  drawGreenLabels(ctx, input, GREEN_LABEL_SLOTS, GREEN_TRAY_CENTER, {maxPx: 46, minPx: 30, arrowW: 8});

  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 1680);
  ctx.lineTo(W, 1680);
  ctx.stroke();

  // Nilai gizi
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 72px ${SANS}`;
  ctx.fillText("Porsi Besar", 220, 1772);
  ctx.fillText("Porsi Kecil", 870, 1772);
  const rowPx = Math.min(
    ...[...input.large, ...input.small].map((r) => fitPx(ctx, `${r.label} : ${r.value}`, (px) => `400 ${px}px ${SANS}`, 48, 600, 30))
  );
  ctx.font = `400 ${rowPx}px ${SANS}`;
  input.large.forEach((r, i) => ctx.fillText(`${r.label} : ${r.value}`, 220, 1846 + i * 56));
  input.small.forEach((r, i) => ctx.fillText(`${r.label} : ${r.value}`, 870, 1846 + i * 56));

  // Kaki: Instagram dan TikTok di pil putih
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(90, 2138, W - 180, 76, 38);
  ctx.fill();
  drawSocialRow(ctx, W / 2, 2176, 34, "#22592f");
}

// ---------------------------------------------------------------------------------------------
// Hijau 2 menu: susunan sama dengan versi 1 menu, tiap menu menempati setengah lebar poster.
// ---------------------------------------------------------------------------------------------

const GREEN_DOUBLE_PANEL_W = DW / 2;
const GREEN_DOUBLE_TRAY = {cx: 561, cy: 735, w: 380, h: 560};

const greenDoubleSlots = (menuIndex: number): GreenSlot[] => {
  const ox = menuIndex * GREEN_DOUBLE_PANEL_W;
  const slot = (x: number, y: number, from: number[], to: number[], bend: number, wrapW: number): GreenSlot => ({
    x: x + ox,
    y,
    from: [from[0] + ox, from[1]],
    to: [to[0] + ox, to[1]],
    bend,
    wrapW,
  });
  return [
    slot(125, 625, [310, 640], [242, 612], -24, 220),
    slot(997, 625, [812, 640], [880, 612], 24, 220),
    slot(125, 840, [310, 875], [242, 862], 24, 220),
    slot(997, 840, [812, 875], [880, 862], -24, 220),
    slot(561, 1002, [561, 900], [561, 966], 16, 620),
  ];
};

export const greenDoubleLabelDefaults = (menuIndex: number): LabelPlacement[] =>
  greenDoubleSlots(menuIndex).map((s) => ({x: s.x, y: s.y, tipX: s.from[0], tipY: s.from[1]}));

/** Kotak foto nampan Hijau sebelum diputar, untuk poster 1 menu atau menu ke-n di poster 2 menu. */
export const greenTrayBox = (mode: "SINGLE" | "DOUBLE", menuIndex: number) =>
  mode === "SINGLE"
    ? {cx: GREEN_TRAY_CENTER[0], cy: GREEN_TRAY_CENTER[1], ...GREEN_TRAY_BOX}
    : {...GREEN_DOUBLE_TRAY, cx: GREEN_DOUBLE_TRAY.cx + menuIndex * GREEN_DOUBLE_PANEL_W};

/**
 * Titik di foto (0 sampai 1 dari kiri atas) ke koordinat gambar, untuk foto yang digambar pas di dalam kotak.
 * rotated: foto diputar -90 derajat agar nampan mendatar.
 */
export function photoPointToBox(point: {nx: number; ny: number}, natural: {w: number; h: number}, box: {cx: number; cy: number; w: number; h: number}, rotated: boolean): {x: number; y: number} {
  const fit = Math.min(box.w / natural.w, box.h / natural.h);
  const dx = (point.nx - 0.5) * natural.w * fit;
  const dy = (point.ny - 0.5) * natural.h * fit;
  return rotated
    ? {x: Math.round(box.cx + dy), y: Math.round(box.cy - dx)}
    : {x: Math.round(box.cx + dx), y: Math.round(box.cy + dy)};
}

/** Ubah letak label poster Hijau 2 menu ke koordinat poster 1 menu, dengan nampan sebagai acuan. */
export function greenDoubleToSingle(p: LabelPlacement, menuIndex: number): LabelPlacement {
  const scale = GREEN_TRAY_BOX.h / GREEN_DOUBLE_TRAY.h;
  const cx = GREEN_DOUBLE_TRAY.cx + menuIndex * GREEN_DOUBLE_PANEL_W;
  const mapX = (x: number) => Math.round(GREEN_TRAY_CENTER[0] + (x - cx) * scale);
  const mapY = (y: number) => Math.round(GREEN_TRAY_CENTER[1] + (y - GREEN_DOUBLE_TRAY.cy) * scale);
  return {x: mapX(p.x), y: mapY(p.y), tipX: mapX(p.tipX), tipY: mapY(p.tipY), ...(p.label ? {label: p.label, labelFor: p.labelFor} : {})};
}

function drawYayasanText(ctx: CanvasRenderingContext2D, rightX: number, y: number, px: number, color: string) {
  ctx.save();
  ctx.font = `800 ${px}px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  YAYASAN_LINES.forEach((line, i) => ctx.fillText(line, rightX, y + i * px * 1.2));
  ctx.restore();
}

function drawGreenDoubleOrnaments(ctx: CanvasRenderingContext2D) {
  // Kanan atas, di bawah nama yayasan
  drawLeafCluster(ctx, 2080, 400, 135, -1);
  drawTomato(ctx, 2165, 275, 82);
  drawTomato(ctx, 2020, 315, 92);
  // Daun lepas di tepi dan di tengah, di antara dua menu
  drawLeaf(ctx, -8, 470, 95, -0.08, 0.38, "light");
  drawLeaf(ctx, 1122, 470, 100, 2.4, 0.38);
  drawLeaf(ctx, -8, 940, 110, 0.35, 0.38, "light");
  // Sudut bawah kanan
  drawLeaf(ctx, DW + 5, 1400, 170, Math.PI + 0.35, 0.55);
  drawLeaf(ctx, DW + 5, 1460, 130, Math.PI + 0.8, 0.55, "light");
}

export function drawGreenDoublePoster(ctx: CanvasRenderingContext2D, input: DrawnPosterInput) {
  const bg = ctx.createLinearGradient(0, 0, 0, DH);
  bg.addColorStop(0, "#2d6e3e");
  bg.addColorStop(1, "#1f5130");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, DW, DH);
  drawDoodles(ctx, 0, 0, DW, DH, "#ffffff", 0.09);
  drawGreenDoubleOrnaments(ctx);

  // Kepala: logo SPPG di kiri, yayasan di kanan. Logo berlatar putih kotak, jadi dipangkas di lingkaran putih.
  ctx.fillStyle = "#ffffff";
  ctx.save();
  ctx.beginPath();
  ctx.arc(110, 95, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  drawImageFit(ctx, input.logo, input.logo.naturalWidth, input.logo.naturalHeight, 58, 43, 104, 104);
  ctx.restore();
  ctx.font = `800 32px ${SANS}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("SPPG MALANG", 186, 86);
  ctx.fillText("TUMPANG JERU", 186, 124);
  drawYayasanText(ctx, 2040, 86, 30, "#ffffff");
  ctx.save();
  ctx.beginPath();
  ctx.arc(2125, 95, 58, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.clip();
  drawSlhs(ctx, input.yayasan, 2075, 45, 100, 100);
  ctx.restore();

  // Judul dan tanggal
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 118px ${SANS}`;
  ctx.fillText("Menu MBG Hari ini", 90, 280);
  fitPx(ctx, input.dateLong, (px) => `400 ${px}px ${SANS}`, 52, 1000);
  ctx.fillText(input.dateLong, 94, 350);

  const rule = (y: number) => {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(DW, y);
    ctx.stroke();
  };
  rule(392);
  rule(1058);

  // Pemisah dua menu
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.lineWidth = 3;
  ctx.setLineDash([3, 14]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(DW / 2, 500);
  ctx.lineTo(DW / 2, 1400);
  ctx.stroke();
  ctx.restore();

  const rows = input.menus.flatMap((m) => [...m.large, ...m.small]);
  const rowPx = rows.length
    ? Math.min(...rows.map((r) => fitPx(ctx, `${r.label} : ${r.value}`, (px) => `400 ${px}px ${SANS}`, 38, 430, 26)))
    : 38;

  input.menus.forEach((menu, m) => {
    const ox = m * GREEN_DOUBLE_PANEL_W;
    const cx = GREEN_DOUBLE_TRAY.cx + ox;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = `800 50px ${SANS}`;
    ctx.fillText(DOUBLE_MENU_TITLES[m], cx, 470);
    ctx.textAlign = "left";

    menu.drawTray(
      {cx, cy: GREEN_DOUBLE_TRAY.cy, w: GREEN_DOUBLE_TRAY.w, h: GREEN_DOUBLE_TRAY.h, rot: -90},
      {fill: "rgba(255,255,255,0.08)", stroke: "rgba(255,255,255,0.6)", text: "#ffffff"}
    );
    drawGreenLabels(ctx, menu, greenDoubleSlots(m), [cx, GREEN_DOUBLE_TRAY.cy], {maxPx: 34, minPx: 24, arrowW: 6});

    // Nilai gizi
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 50px ${SANS}`;
    ctx.fillText("Porsi Besar", 130 + ox, 1125);
    ctx.fillText("Porsi Kecil", 600 + ox, 1125);
    ctx.font = `400 ${rowPx}px ${SANS}`;
    menu.large.forEach((r, i) => ctx.fillText(`${r.label} : ${r.value}`, 130 + ox, 1182 + i * 48));
    menu.small.forEach((r, i) => ctx.fillText(`${r.label} : ${r.value}`, 600 + ox, 1182 + i * 48));
  });

  // Kaki: SLHS di kiri, Instagram dan TikTok di pil putih
  ctx.fillStyle = "#ffffff";
  ctx.save();
  ctx.beginPath();
  ctx.arc(120, 1478, 72, 0, Math.PI * 2);
  ctx.fill();
  ctx.clip();
  drawSlhs(ctx, input.slhs, 55, 1428, 130, 100);
  ctx.restore();
  ctx.beginPath();
  ctx.roundRect(560, 1458, 1125, 76, 38);
  ctx.fill();
  drawSocialRow(ctx, DW / 2, 1496, 34, "#22592f");
}

// ---------------------------------------------------------------------------------------------
// Ceria: latar krem dan ungu, judul melengkung, gizi di kiri bawah dan daftar menu di kanan bawah.
// ---------------------------------------------------------------------------------------------

const PURPLE = "#453a91";

function drawAsterisk(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, width: number) {
  ctx.save();
  ctx.strokeStyle = PURPLE;
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx - r * Math.cos(a), cy - r * Math.sin(a));
    ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.stroke();
  }
  ctx.restore();
}

// Teks di sepanjang busur lingkaran (cembung ke atas), dipusatkan di sudut paling atas.
function drawArcText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, r: number, spacing: number) {
  const chars = [...text];
  const total = ctx.measureText(text).width + spacing * (chars.length - 1);
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let prefix = "";
  chars.forEach((ch, i) => {
    // Posisi dari lebar teks sebelumnya, bukan jumlah lebar per huruf, agar kerning font tetap terpakai.
    const start = ctx.measureText(prefix + ch).width - ctx.measureText(ch).width + spacing * i;
    const a = -Math.PI / 2 + (start + ctx.measureText(ch).width / 2 - total / 2) / r;
    ctx.save();
    ctx.translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    prefix += ch;
  });
  ctx.restore();
}

export function drawPurplePoster(ctx: CanvasRenderingContext2D, input: DrawnPosterInput) {
  ctx.fillStyle = "#fbf1e1";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(56, 56, W - 112, H - 112);
  drawDoodles(ctx, 56, 56, W - 112, H - 112, PURPLE, 0.08);

  drawAsterisk(ctx, 40, 250, 150, 38);
  drawAsterisk(ctx, 1575, 660, 100, 30);

  // Kepala: logo SPPG dan nama di tengah, SLHS di kanan atas
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 38px ${SANS}`;
  const nameW = Math.max(ctx.measureText("SPPG Malang").width, ctx.measureText("Tumpang Jeru").width);
  const groupX = (W - (100 + 22 + nameW)) / 2;
  drawImageFit(ctx, input.logo, input.logo.naturalWidth, input.logo.naturalHeight, groupX, 92, 100, 100);
  ctx.fillStyle = PURPLE;
  ctx.fillText("SPPG Malang", groupX + 122, 136);
  ctx.fillText("Tumpang Jeru", groupX + 122, 182);
  drawSlhs(ctx, input.slhs, 1322, 84, 160, 120);

  // Judul: dua baris melengkung di lingkaran sepusat, jadi jarak antarbaris sama dari tengah sampai ujung.
  ctx.fillStyle = PURPLE;
  fitPx(ctx, "Menu Makan", (px) => `italic 800 ${px}px Fraunces, Georgia, serif`, 190, 1080);
  drawArcText(ctx, "Menu Makan", 793, 1720, 1268, 0);

  ctx.font = `800 150px "Baloo 2", ${SANS}`;
  drawArcText(ctx, "BERGIZI GRATIS", 793, 1720, 1150, 4);

  // Tanggal di pil ungu
  ctx.beginPath();
  ctx.roundRect(793 - 330, 676, 660, 94, 47);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitPx(ctx, input.dateLong, (px) => `700 ${px}px ${SANS}`, 48, 600);
  ctx.fillText(input.dateLong, 793, 725);
  ctx.textAlign = "left";

  input.drawTray({cx: 793, cy: 1125, w: 540, h: 840, rot: -96}, {fill: "#f5f3ff", stroke: "#a5a0d6", text: PURPLE});

  // Nilai gizi di kiri bawah
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = PURPLE;
  ctx.font = `800 56px ${SANS}`;
  ctx.fillText("Porsi Besar", 160, 1600);
  ctx.fillText("Porsi Kecil", 580, 1600);
  ctx.strokeStyle = PURPLE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(160, 1636);
  ctx.lineTo(960, 1636);
  ctx.stroke();
  const rowPx = Math.min(
    ...[...input.large, ...input.small].map((r) => fitPx(ctx, `${r.label} : ${r.value}`, (px) => `500 ${px}px ${SANS}`, 42, 405, 26))
  );
  ctx.font = `500 ${rowPx}px ${SANS}`;
  input.large.forEach((r, i) => ctx.fillText(`${r.label} : ${r.value}`, 160, 1706 + i * 60));
  input.small.forEach((r, i) => ctx.fillText(`${r.label} : ${r.value}`, 580, 1706 + i * 60));

  // Instagram dan TikTok di pil ungu
  ctx.beginPath();
  ctx.roundRect(160, 2040, 760, 86, 43);
  ctx.fill();
  drawSocialRow(ctx, 540, 2083, 30, "#ffffff");

  // Daftar menu di kanan bawah
  ctx.fillStyle = PURPLE;
  ctx.font = `800 66px ${SANS}`;
  ctx.fillText("Menu", 1030, 1600);
  ctx.fillText("Makanan", 1030, 1676);
  const items = input.items.map((it) => it.trim()).filter(Boolean);
  const top = 1760;
  const bottom = 2130;
  const maxW = 1480 - 1030 - 50;
  let px = 48;
  let rows: string[][] = [];
  for (; px >= 26; px -= 2) {
    ctx.font = `500 ${px}px ${SANS}`;
    rows = items.map((it) => wrap(ctx, it, maxW));
    if (rows.reduce((n, r) => n + r.length, 0) * px * 1.3 <= bottom - top) break;
  }
  let y = top;
  for (const lines of rows) {
    ctx.fillText("•", 1036, y);
    for (const line of lines) {
      ctx.fillText(line, 1080, y);
      y += px * 1.3;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Ceria 2 menu: bingkai dan judul melengkung sama dengan versi 1 menu; tiap menu berisi nampan,
// daftar hidangan di sampingnya, dan nilai gizi di bawahnya.
// ---------------------------------------------------------------------------------------------

export function drawPurpleDoublePoster(ctx: CanvasRenderingContext2D, input: DrawnPosterInput) {
  ctx.fillStyle = "#fbf1e1";
  ctx.fillRect(0, 0, DW, DH);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(44, 44, DW - 88, DH - 88);
  drawDoodles(ctx, 44, 44, DW - 88, DH - 88, PURPLE, 0.08);

  drawAsterisk(ctx, 26, 400, 110, 28);
  drawAsterisk(ctx, DW - 26, 1000, 90, 24);

  // Kepala: logo SPPG di kiri, yayasan di kanan
  ctx.textBaseline = "alphabetic";
  drawImageFit(ctx, input.logo, input.logo.naturalWidth, input.logo.naturalHeight, 90, 66, 96, 96);
  ctx.fillStyle = PURPLE;
  ctx.font = `700 32px ${SANS}`;
  ctx.fillText("SPPG Malang", 200, 108);
  ctx.fillText("Tumpang Jeru", 200, 146);
  drawYayasanText(ctx, 2045, 108, 26, PURPLE);
  drawSlhs(ctx, input.yayasan, 2060, 66, 96, 96);

  // Judul: dua baris melengkung di lingkaran sepusat, seperti versi 1 menu
  const titleCy = 1395;
  ctx.fillStyle = PURPLE;
  fitPx(ctx, "Menu Makan", (px) => `italic 800 ${px}px Fraunces, Georgia, serif`, 134, 800);
  drawArcText(ctx, "Menu Makan", DW / 2, titleCy, 1174, 0);
  ctx.font = `800 100px "Baloo 2", ${SANS}`;
  drawArcText(ctx, "BERGIZI GRATIS", DW / 2, titleCy, 1095, 3);

  // Tanggal di pil ungu
  ctx.beginPath();
  ctx.roundRect(DW / 2 - 235, 350, 470, 66, 33);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitPx(ctx, input.dateLong, (px) => `700 ${px}px ${SANS}`, 36, 430);
  ctx.fillText(input.dateLong, DW / 2, 383);
  ctx.textAlign = "left";

  // Pemisah dua menu
  ctx.save();
  ctx.strokeStyle = "#a5a0d6";
  ctx.lineWidth = 3;
  ctx.setLineDash([3, 14]);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(DW / 2, 445);
  ctx.lineTo(DW / 2, 1390);
  ctx.stroke();
  ctx.restore();

  const panelX = [100, 1160];
  const allRows = input.menus.flatMap((m) => [...m.large, ...m.small]);
  const rowPx = allRows.length
    ? Math.min(...allRows.map((r) => fitPx(ctx, `${r.label} : ${r.value}`, (px) => `500 ${px}px ${SANS}`, 34, 440, 24)))
    : 34;

  input.menus.forEach((menu, m) => {
    const px0 = panelX[m];
    menu.drawTray({cx: px0 + 305, cy: 735, w: 430, h: 590, rot: -96}, {fill: "#f5f3ff", stroke: "#a5a0d6", text: PURPLE});

    // Daftar hidangan di samping nampan
    const listX = px0 + 640;
    const maxW = 340;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = PURPLE;
    fitPx(ctx, DOUBLE_MENU_TITLES[m], (px) => `800 ${px}px ${SANS}`, 50, maxW + 30);
    ctx.fillText(DOUBLE_MENU_TITLES[m], listX, 520);
    const items = menu.items.map((it) => it.trim()).filter(Boolean);
    const top = 585;
    const bottom = 1000;
    let px = 38;
    let wrapped: string[][] = [];
    for (; px >= 22; px -= 2) {
      ctx.font = `500 ${px}px ${SANS}`;
      wrapped = items.map((it) => wrap(ctx, it, maxW - 30));
      if (wrapped.reduce((n, r) => n + r.length, 0) * px * 1.3 <= bottom - top) break;
    }
    let y = top;
    for (const lines of wrapped) {
      ctx.fillText("•", listX, y);
      for (const line of lines) {
        ctx.fillText(line, listX + 30, y);
        y += px * 1.3;
      }
    }

    // Nilai gizi di bawah
    ctx.font = `800 46px ${SANS}`;
    ctx.fillText("Porsi Besar", px0 + 20, 1100);
    ctx.fillText("Porsi Kecil", px0 + 510, 1100);
    ctx.strokeStyle = PURPLE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px0 + 20, 1124);
    ctx.lineTo(px0 + 950, 1124);
    ctx.stroke();
    ctx.font = `500 ${rowPx}px ${SANS}`;
    menu.large.forEach((r, i) => ctx.fillText(`${r.label} : ${r.value}`, px0 + 20, 1176 + i * 48));
    menu.small.forEach((r, i) => ctx.fillText(`${r.label} : ${r.value}`, px0 + 510, 1176 + i * 48));
  });

  // Kaki: SLHS di kiri, Instagram dan TikTok di pil ungu
  drawSlhs(ctx, input.slhs, 90, 1412, 140, 108);
  ctx.fillStyle = PURPLE;
  ctx.beginPath();
  ctx.roundRect(640, 1436, 965, 76, 38);
  ctx.fill();
  drawSocialRow(ctx, DW / 2, 1474, 30, "#ffffff");
}
