// Desain poster menu yang digambar langsung di kanvas (bukan dari gambar template Canva).
// Ukuran kanvas A4 tegak 1587 x 2245 px, sama dengan template gambar 1 menu.

export interface PosterTrayBox {cx: number; cy: number; w: number; h: number; rot: number}

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

export function drawGreenPoster(ctx: CanvasRenderingContext2D, input: DrawnPosterInput) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#2d6e3e");
  bg.addColorStop(1, "#1f5130");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

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

  const items = input.items.map((it) => it.trim()).filter(Boolean);
  const labels = items.slice(0, 4);
  if (items.length > 4) labels.push(items.slice(4).join(", "));
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  labels.forEach((text, i) => {
    const slot = GREEN_LABEL_SLOTS[i];
    let px = 46;
    let lines: string[] = [];
    for (; px >= 30; px -= 2) {
      ctx.font = `500 ${px}px ${SANS}`;
      lines = wrap(ctx, text, slot.wrapW);
      if (lines.length <= 3) break;
    }
    drawCenteredLines(ctx, lines, slot.x, slot.y, px);
    drawArrow(ctx, slot.from[0], slot.from[1], slot.to[0], slot.to[1], slot.bend, "#ffffff", 8);
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
