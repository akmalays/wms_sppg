// Desain poster menu yang digambar langsung di kanvas (bukan dari gambar template Canva).
// Ukuran kanvas A4 tegak 1587 x 2245 px, sama dengan template gambar 1 menu.

export interface PosterTrayBox {cx: number; cy: number; w: number; h: number; rot: number}

/** Letak satu nama hidangan di poster (koordinat kanvas 1587 x 2245): titik tengah teks dan ujung panah. */
export interface LabelPlacement {x: number; y: number; tipX: number; tipY: number}

export interface DrawnPosterInput {
  /** "Selasa, 3 November 2026" */
  dateLong: string;
  items: string[];
  /** Baris gizi siap cetak, mis. {label: "Energi", value: "763,1 kkal"}; value "-" bila kosong. */
  large: {label: string; value: string}[];
  small: {label: string; value: string}[];
  logo: HTMLImageElement;
  slhs: {img: HTMLImageElement; sx: number; sy: number; sw: number; sh: number};
  /** Menggambar foto nampan (atau tempat foto bila belum diunggah) di kotak yang diberikan. */
  drawTray: (box: PosterTrayBox, placeholder: {fill: string; stroke: string; text: string}) => void;
  /** Letak label yang digeser petugas, per urutan label; kosong atau null = letak bawaan desain. */
  labelPlacements?: (LabelPlacement | null)[];
}

export const SOCIAL = {instagram: "sppgmalangtumpangjeru", tiktok: "sppg.jeru"};

const SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
const W = 1587;
const H = 2245;

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

function drawSlhs(ctx: CanvasRenderingContext2D, slhs: DrawnPosterInput["slhs"], x: number, y: number, w: number, h: number) {
  drawImageFit(ctx, slhs.img, slhs.sw, slhs.sh, x, y, w, h, [slhs.sx, slhs.sy, slhs.sw, slhs.sh]);
}

// Panah lengkung dari (x1, y1) ke (x2, y2); bend menggeser titik kendali tegak lurus garis.
function drawArrow(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, bend: number, color: string, width: number) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const cx = mx + (-(y2 - y1) / len) * bend;
  const cy = my + ((x2 - x1) / len) * bend;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.stroke();
  const angle = Math.atan2(y2 - cy, x2 - cx);
  const head = width * 4.2;
  ctx.beginPath();
  ctx.moveTo(x2 - head * Math.cos(angle - 0.55), y2 - head * Math.sin(angle - 0.55));
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(angle + 0.55), y2 - head * Math.sin(angle + 0.55));
  ctx.stroke();
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

const GREEN_TRAY_CENTER = [793, 1205];

/**
 * Letak bawaan label Hijau dalam bentuk yang bisa digeser. tip adalah pangkal panah di makanan (panah berangkat
 * dari nampan menuju teks), jadi petugas menggeser tip ke sekat yang benar di foto.
 */
export const GREEN_LABEL_DEFAULTS: LabelPlacement[] = GREEN_LABEL_SLOTS.map((s) => ({x: s.x, y: s.y, tipX: s.from[0], tipY: s.from[1]}));

// Ukuran kotak teks label, dipakai untuk menentukan dari mana panah custom berangkat.
function labelLines(ctx: CanvasRenderingContext2D, text: string, wrapW: number): {lines: string[]; px: number} {
  let px = 46;
  let lines: string[] = [];
  for (; px >= 30; px -= 2) {
    ctx.font = `500 ${px}px ${SANS}`;
    lines = wrap(ctx, text, wrapW);
    if (lines.length <= 3) break;
  }
  return {lines, px};
}

// Panah custom: berangkat dari titik makanan yang ditunjuk petugas menuju tepi kotak teks, sama seperti panah bawaan.
// Lengkungan dibuat menjauhi tengah nampan agar tidak memotong foto.
function drawPlacedArrow(ctx: CanvasRenderingContext2D, p: LabelPlacement, halfW: number, halfH: number) {
  const dx = p.tipX - p.x;
  const dy = p.tipY - p.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const exit = Math.min(dx ? halfW / Math.abs(dx) : Infinity, dy ? halfH / Math.abs(dy) : Infinity);
  const ex = p.x + dx * exit + (dx / len) * 22;
  const ey = p.y + dy * exit + (dy / len) * 22;
  const ax = ex - p.tipX;
  const ay = ey - p.tipY;
  const alen = Math.hypot(ax, ay);
  // Titik makanan di dalam atau terlalu dekat dengan teks: panah tidak digambar.
  if (exit >= 1 || alen < 40) return;
  const mx = (p.tipX + ex) / 2 - GREEN_TRAY_CENTER[0];
  const my = (p.tipY + ey) / 2 - GREEN_TRAY_CENTER[1];
  const away = (-ay / alen) * mx + (ax / alen) * my >= 0 ? 1 : -1;
  drawArrow(ctx, p.tipX, p.tipY, ex, ey, Math.min(48, alen * 0.22) * away, "#ffffff", 8);
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
  input.drawTray({cx: 793, cy: 1205, w: 540, h: 790, rot: -90}, {fill: "rgba(255,255,255,0.08)", stroke: "rgba(255,255,255,0.6)", text: "#ffffff"});

  const labels = greenLabelTexts(input.items);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  labels.forEach((text, i) => {
    const slot = GREEN_LABEL_SLOTS[i];
    const placed = input.labelPlacements?.[i];
    const {lines, px} = labelLines(ctx, text, slot.wrapW);
    ctx.font = `500 ${px}px ${SANS}`;
    if (placed) {
      drawCenteredLines(ctx, lines, placed.x, placed.y, px);
      const halfW = Math.max(...lines.map((l) => ctx.measureText(l).width)) / 2;
      const halfH = (lines.length * px * 1.15) / 2;
      drawPlacedArrow(ctx, placed, halfW, halfH);
    } else {
      drawCenteredLines(ctx, lines, slot.x, slot.y, px);
      drawArrow(ctx, slot.from[0], slot.from[1], slot.to[0], slot.to[1], slot.bend, "#ffffff", 8);
    }
  });
  ctx.textAlign = "left";

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
  const widths = [...text].map((ch) => ctx.measureText(ch).width + spacing);
  const total = widths.reduce((a, b) => a + b, 0) - spacing;
  let acc = 0;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  [...text].forEach((ch, i) => {
    const a = -Math.PI / 2 + (acc + widths[i] / 2 - total / 2) / r;
    ctx.save();
    ctx.translate(cx + r * Math.cos(a), cy + r * Math.sin(a));
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    acc += widths[i];
  });
  ctx.restore();
}

export function drawPurplePoster(ctx: CanvasRenderingContext2D, input: DrawnPosterInput) {
  ctx.fillStyle = "#fbf1e1";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(56, 56, W - 112, H - 112);

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

  // Judul: "Menu Makan" miring, "BERGIZI GRATIS" melengkung
  ctx.save();
  ctx.translate(793, 360);
  ctx.rotate((-6 * Math.PI) / 180);
  ctx.fillStyle = PURPLE;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitPx(ctx, "Menu Makan", (px) => `italic 800 ${px}px Fraunces, Georgia, serif`, 190, 1080);
  ctx.fillText("Menu Makan", 0, 0);
  ctx.restore();

  ctx.fillStyle = PURPLE;
  ctx.font = `800 150px "Baloo 2", ${SANS}`;
  drawArcText(ctx, "BERGIZI GRATIS", 793, 1720, 1150, 4);

  // Tanggal di pil ungu
  ctx.beginPath();
  ctx.roundRect(793 - 330, 642, 660, 94, 47);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitPx(ctx, input.dateLong, (px) => `700 ${px}px ${SANS}`, 48, 600);
  ctx.fillText(input.dateLong, 793, 691);
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
