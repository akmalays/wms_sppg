import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {warehouseDb} from "../db/storage";
import {MenuOrder, type MenuPosterMenu} from "../types/warehouse";
import {compressImageToWebP} from "../utils/imageCompressor";
import {cutoutTrayPhoto, preloadBgRemoval} from "../utils/trayCutout";
import {publishPosterNutrition, publishTrays, uploadPosterPhoto, type NutritionPublish, type TrayPublish} from "../utils/menuTrayPublish";
import {fetchWebsiteConfigFromCloud, getWebsiteConfig, WEBSITE_CONFIG_UPDATED_EVENT} from "../db/websiteConfigStorage";
import {LabelPlacementOverlay} from "./print/LabelPlacementOverlay";
import {LabelNameFields} from "./print/LabelNameFields";
import {posterLabelToStage} from "./menuPublic/TrayStage";
import {AiTrayPointsButton} from "./ai/AiTrayPointsButton";
import {localDateIso} from "../utils/localDate";
import {useToast} from "../context/ToastContext";
import {FIELD_INPUT, FIELD_LABEL, BTN_PRIMARY, BTN_SECONDARY} from "./common/FormDialog";

// Template Canva SPPG. Judul kertas ("Menu Makanan", "Menu Sekolah", "Menu 3B") dan foto nampan
// contoh sudah tercetak di template; aplikasi hanya menulis tanggal, daftar menu, foto, dan nilai gizi.
// Desain baru: ekspor template kosong dari Canva ke src/assets, lalu tambahkan entrinya di POSTER_TEMPLATES.
import templateSingle from "../assets/poster-single.jpg";
import templateDouble from "../assets/poster-double.jpg";
import logoSppg from "../assets/logo sppg.png";
import {drawGreenPoster, drawGreenDoublePoster, drawPurplePoster, drawPurpleDoublePoster, greenLabelTexts, greenDoubleLabelDefaults, greenDoubleToSingle, greenTrayBox, photoPointToBox, shownLabel, GREEN_LABEL_DEFAULTS, type DrawnMenu, type DrawnPosterInput, type PosterTrayBox, type LabelPlacement} from "./print/menuPosterDesigns";

interface NutritionValues {
  energy: string; // kkal
  protein: string; // gr
  fat: string; // gr
  carb: string; // gr
  fiber: string; // gr
}

interface MenuCardData {
  items: string[];
  /** Foto nampan hasil unggah; null berarti foto contoh di template yang tampil. */
  photo: string | null;
  /** Foto asli sebelum background dihapus; terisi berarti `photo` adalah potongan nampan bertransparansi. */
  photoOriginal?: string | null;
  largePortion: NutritionValues;
  smallPortion: NutritionValues;
  /** Letak nama hidangan yang digeser di pratinjau (desain Hijau); null = letak bawaan desain. */
  labelPlacements?: LabelPlacement[] | null;
}

const EMPTY_NUTRITION: NutritionValues = {energy: "", protein: "", fat: "", carb: "", fiber: ""};
const emptyMenu = (): MenuCardData => ({items: [], photo: null, largePortion: {...EMPTY_NUTRITION}, smallPortion: {...EMPTY_NUTRITION}});

/** Isi poster tersimpan (Order Menu) ke kartu menu di layar. */
const posterMenuToCard = (m: MenuPosterMenu | undefined): MenuCardData =>
  m
    ? {
        items: m.items ?? [],
        photo: m.photoUrl,
        photoOriginal: m.photoOriginalUrl,
        largePortion: {...EMPTY_NUTRITION, ...m.largePortion},
        smallPortion: {...EMPTY_NUTRITION, ...m.smallPortion},
        labelPlacements: m.labelPlacements,
      }
    : emptyMenu();

/** Pembanding isi poster, agar yang tidak berubah (mis. baru dimuat) tidak disimpan ulang. */
const posterSnapshot = (menus: MenuCardData[], printMode: string, templateIds: Record<string, string>) =>
  JSON.stringify({menus, printMode, templateIds});

const NUTRITION_ROWS: {key: keyof NutritionValues; label: string; unit: string}[] = [
  {key: "energy", label: "Energi", unit: "kkal"},
  {key: "protein", label: "Protein", unit: "gr"},
  {key: "fat", label: "Lemak", unit: "gr"},
  {key: "carb", label: "Karbohidrat", unit: "gr"},
  {key: "fiber", label: "Serat", unit: "gr"},
];

// Parser teks baris nilai gizi (mendukung format WhatsApp maupun hanya angka per baris)
function parseNutritionText(text: string): NutritionValues {
  const result: NutritionValues = {...EMPTY_NUTRITION};

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let hasLabeledMatch = false;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("porsi")) continue;

    const numMatch = line.match(/(\d+(?:[.,]\d+)?)/);
    const val = numMatch ? numMatch[1] : "";

    if (lower.includes("energi") || lower.includes("kalori") || lower.includes("kkal")) {
      result.energy = val;
      hasLabeledMatch = true;
    } else if (lower.includes("protein")) {
      result.protein = val;
      hasLabeledMatch = true;
    } else if (lower.includes("lemak") || lower.includes("fat")) {
      result.fat = val;
      hasLabeledMatch = true;
    } else if (lower.includes("karbo") || lower.includes("carb")) {
      result.carb = val;
      hasLabeledMatch = true;
    } else if (lower.includes("serat") || lower.includes("fiber")) {
      result.fiber = val;
      hasLabeledMatch = true;
    }
  }

  // Jika tanpa label teks, asumsikan 5 baris berurutan: Energi, Protein, Lemak, Karbo, Serat
  if (!hasLabeledMatch) {
    const numbers: string[] = [];
    for (const line of lines) {
      const m = line.match(/(\d+(?:[.,]\d+)?)/);
      if (m) numbers.push(m[1]);
    }
    if (numbers[0]) result.energy = numbers[0];
    if (numbers[1]) result.protein = numbers[1];
    if (numbers[2]) result.fat = numbers[2];
    if (numbers[3]) result.carb = numbers[3];
    if (numbers[4]) result.fiber = numbers[4];
  }

  return result;
}

const hasAnyNutrition = (n: NutritionValues) => Object.values(n).some(Boolean);

// Bentuk teks untuk kotak isian gizi: satu zat gizi per baris, sama dengan format pesan ahli gizi.
const formatNutritionText = (n: NutritionValues) =>
  hasAnyNutrition(n) ? NUTRITION_ROWS.map((row) => `${row.label}: ${n[row.key]}`).join("\n") : "";

// Parser pesan siaran WhatsApp dari ahli gizi
interface ParsedWhatsAppMenu {
  date?: string;
  menu1Items?: string[];
  menu1Small?: NutritionValues;
  menu1Large?: NutritionValues;
  menu2Items?: string[];
  menu2Small?: NutritionValues;
  menu2Large?: NutritionValues;
  hasMenu2: boolean;
}

function parseFullWhatsAppMenu(rawText: string): ParsedWhatsAppMenu {
  const result: ParsedWhatsAppMenu = {
    hasMenu2: false,
  };

  // 1. Ekstrak tanggal (misal 28/09/26 atau 28-09-2026)
  const dateMatch = rawText.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, "0");
    const month = dateMatch[2].padStart(2, "0");
    let year = dateMatch[3];
    if (year.length === 2) year = "20" + year;
    result.date = `${year}-${month}-${day}`;
  }

  // 2. Cek pemisah Menu 2 / B3 / 3B
  const menu2SeparatorRegex = /(?:^|\n)\s*\*?(?:B3|3B|Menu\s*3B|Menu\s*B3)\*?\s*(?:\n|$)/i;
  const separatorMatch = rawText.match(menu2SeparatorRegex);

  let section1Text = rawText;
  let section2Text = "";

  if (separatorMatch && separatorMatch.index !== undefined) {
    result.hasMenu2 = true;
    section1Text = rawText.substring(0, separatorMatch.index);
    section2Text = rawText.substring(separatorMatch.index + separatorMatch[0].length);
  }

  const parseSection = (sectionText: string) => {
    const lines = sectionText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const items: string[] = [];
    const kecilLines: string[] = [];
    const besarLines: string[] = [];
    let mode: "ITEMS" | "KECIL" | "BESAR" = "ITEMS";

    for (const line of lines) {
      const lower = line.toLowerCase();
      if (lower.includes("porsi") && (lower.includes("kecil") || lower.includes("kcl"))) {
        mode = "KECIL";
        continue;
      }
      if (lower.includes("porsi") && (lower.includes("besar") || lower.includes("bsr"))) {
        mode = "BESAR";
        continue;
      }

      if (mode === "ITEMS") {
        if (lower.startsWith("nilai gizi") || lower.startsWith("menu") || lower.startsWith("*menu")) {
          continue;
        }
        const clean = line
          .replace(/^[•\-\*\s]+/, "")
          .replace(/\*+$/, "")
          .trim();
        if (clean) items.push(clean);
      } else if (mode === "KECIL") {
        kecilLines.push(line);
      } else if (mode === "BESAR") {
        besarLines.push(line);
      }
    }

    return {
      items,
      small: parseNutritionText(kecilLines.join("\n")),
      large: parseNutritionText(besarLines.join("\n")),
    };
  };

  const p1 = parseSection(section1Text);
  if (p1.items.length > 0) result.menu1Items = p1.items;
  result.menu1Small = p1.small;
  result.menu1Large = p1.large;

  if (result.hasMenu2 && section2Text) {
    const p2 = parseSection(section2Text);
    if (p2.items.length > 0) result.menu2Items = p2.items;
    result.menu2Small = p2.small;
    result.menu2Large = p2.large;
  }

  return result;
}

// Format tanggal standar Indonesia: "Rabu, 23-09-2026"
function formatPosterDate(dateStr: string): string {
  if (!dateStr) return "";
  const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;
  const [y, m, day] = dateStr.split("-");
  return `${days[d.getDay()]}, ${day}-${m}-${y}`;
}

// Format panjang untuk desain yang digambar di kanvas: "Selasa, 3 November 2026"
function formatPosterDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  if (!dateStr || Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", {weekday: "long", day: "numeric", month: "long", year: "numeric"});
}

// Rencana menu menyimpan hidangan dipisah koma; "+" tetap satu hidangan (mis. "tumis labu siam+jagung").
const splitDishes = (text?: string) =>
  (text || "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------------------------
// Tata letak poster dalam piksel template asli. Pratinjau, cetak, dan unduhan memakai satu kanvas
// yang sama, jadi posisi di layar selalu sama dengan hasil cetak.
// ---------------------------------------------------------------------------------------------
interface NoteBox {x: number; y: number; rot: number; w: number; h: number; maxPx: number; minPx: number}
interface TrayBox {cx: number; cy: number; w: number; h: number; rot: number}
interface NutritionColumn {x: number; y: number; px: number; gap: number}

type PosterMode = "SINGLE" | "DOUBLE";

interface PosterBase {
  id: string;
  name: string;
  mode: PosterMode;
  width: number;
  height: number;
  /** Petunjuk di bawah isian hidangan bila desain memakai urutan hidangan secara khusus. */
  itemsHint?: string;
}

// Desain yang digambar langsung di kanvas (lihat print/menuPosterDesigns.ts).
interface DrawnPosterTemplate extends PosterBase {
  kind: "drawn";
  draw: (ctx: CanvasRenderingContext2D, input: DrawnPosterInput) => void;
  /** Nama hidangan dan panahnya bisa digeser di pratinjau. */
  labels?: {texts: (items: string[]) => string[]; defaults: (menuIndex: number) => LabelPlacement[]};
}

type PosterTemplate = ImagePosterTemplate | DrawnPosterTemplate;

const isDrawnPoster = (template: PosterTemplate): template is DrawnPosterTemplate => "draw" in template;

interface ImagePosterTemplate extends PosterBase {
  kind?: "image";
  src: string;
  /** color: warna tulisan tanggal, menyesuaikan latar di template (bawaan putih). */
  date: {x: number; y: number; px: number; color?: string};
  notes: NoteBox[]; // per menu
  trays: TrayBox[]; // per menu
  nutrition: {large: NutritionColumn; small: NutritionColumn}[]; // per menu
}

// Urutan menentukan desain bawaan: entri pertama tiap jenis poster terpilih saat halaman dibuka.
const POSTER_TEMPLATES: PosterTemplate[] = [
  {
    id: "sppg",
    name: "Template SPPG",
    mode: "SINGLE",
    src: templateSingle,
    width: 1587,
    height: 2245,
    date: {x: 793, y: 618, px: 58},
    notes: [{x: 165, y: 905, rot: -15, w: 445, h: 370, maxPx: 42, minPx: 22}],
    trays: [{cx: 1034, cy: 1095, w: 540, h: 655, rot: 16}],
    nutrition: [{large: {x: 360, y: 1785, px: 37, gap: 58}, small: {x: 830, y: 1785, px: 37, gap: 58}}],
  },
  {
    id: "sppg",
    name: "Template SPPG",
    mode: "DOUBLE",
    src: templateDouble,
    width: 2245,
    height: 1587,
    date: {x: 1082, y: 371, px: 50},
    notes: [
      {x: 120, y: 700, rot: -15, w: 275, h: 205, maxPx: 27, minPx: 17},
      {x: 1228, y: 712, rot: -15, w: 260, h: 195, maxPx: 27, minPx: 17},
    ],
    trays: [
      {cx: 680, cy: 785, w: 380, h: 460, rot: 23},
      {cx: 1815, cy: 826, w: 380, h: 460, rot: 21},
    ],
    nutrition: [
      {large: {x: 372, y: 1276, px: 30, gap: 44}, small: {x: 804, y: 1276, px: 30, gap: 44}},
      {large: {x: 1198, y: 1276, px: 30, gap: 44}, small: {x: 1630, y: 1276, px: 30, gap: 44}},
    ],
  },
  {
    id: "hijau",
    name: "Hijau",
    mode: "SINGLE",
    kind: "drawn",
    width: 1587,
    height: 2245,
    draw: drawGreenPoster,
    labels: {texts: greenLabelTexts, defaults: () => GREEN_LABEL_DEFAULTS},
    itemsHint: "Desain Hijau menaruh hidangan di sekeliling nampan sesuai urutan baris: 1 kiri atas, 2 kanan atas, 3 kiri bawah, 4 kanan bawah, 5 dan seterusnya di bawah. Kalau letak makanan di foto berbeda, pakai \"Atur nama dan letak\" di pratinjau untuk menggeser atau mengganti nama dan pangkal panahnya.",
  },
  {
    id: "ceria",
    name: "Ceria",
    mode: "SINGLE",
    kind: "drawn",
    width: 1587,
    height: 2245,
    draw: drawPurplePoster,
  },
  {
    id: "hijau",
    name: "Hijau",
    mode: "DOUBLE",
    kind: "drawn",
    width: 2245,
    height: 1587,
    draw: drawGreenDoublePoster,
    labels: {texts: greenLabelTexts, defaults: greenDoubleLabelDefaults},
    itemsHint: "Desain Hijau menaruh hidangan di sekeliling nampan sesuai urutan baris: 1 kiri atas, 2 kanan atas, 3 kiri bawah, 4 kanan bawah, 5 dan seterusnya di bawah. Kalau letak makanan di foto berbeda, pakai \"Atur nama dan letak\" di pratinjau; tiap menu diatur di tabnya masing-masing.",
  },
  {
    id: "ceria",
    name: "Ceria",
    mode: "DOUBLE",
    kind: "drawn",
    width: 2245,
    height: 1587,
    draw: drawPurpleDoublePoster,
  },
];

// Logo SLHS diambil dari template SPPG 1 menu (berlatar putih) agar semua desain memakai logo yang sama.
const SLHS_CROP = {sx: 1380, sy: 52, sw: 146, sh: 112};
// Logo yayasan diambil dari template SPPG 2 menu.
const YAYASAN_CROP = {sx: 2096, sy: 48, sw: 92, sh: 94};

const templatesFor = (mode: PosterMode) => POSTER_TEMPLATES.filter((t) => t.mode === mode);
const DEFAULT_TEMPLATE_IDS: Record<PosterMode, string> = {SINGLE: templatesFor("SINGLE")[0].id, DOUBLE: templatesFor("DOUBLE")[0].id};
const findTemplate = (mode: PosterMode, id: string) => templatesFor(mode).find((t) => t.id === id) ?? templatesFor(mode)[0];

const INK = "#2a2830";
const FONT = "Nunito, system-ui, sans-serif";

function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

// Daftar menu di kertas: ukuran huruf mengecil sampai semua butir muat di kotak kertas.
function drawNote(ctx: CanvasRenderingContext2D, box: NoteBox, rawItems: string[]) {
  const items = rawItems.map((it) => it.trim()).filter(Boolean);
  if (items.length === 0) return;
  let px = box.maxPx;
  let rows: string[][] = [];
  for (px = box.maxPx; px >= box.minPx; px--) {
    ctx.font = `700 ${px}px ${FONT}`;
    const bullet = px * 0.9;
    rows = items.map((it) => wrapWords(ctx, it, box.w - bullet));
    const total = rows.reduce((n, r) => n + r.length, 0) * px * 1.3;
    if (total <= box.h) break;
  }
  px = Math.max(px, box.minPx);
  const lineHeight = px * 1.3;
  const bullet = px * 0.9;

  ctx.save();
  ctx.translate(box.x, box.y);
  ctx.rotate((box.rot * Math.PI) / 180);
  ctx.font = `700 ${px}px ${FONT}`;
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  let y = px;
  for (const lines of rows) {
    ctx.fillText("•", 0, y);
    for (const line of lines) {
      ctx.fillText(line, bullet, y);
      y += lineHeight;
    }
  }
  ctx.restore();
}

function drawTrayPhoto(ctx: CanvasRenderingContext2D, box: TrayBox, img: HTMLImageElement) {
  ctx.save();
  ctx.translate(box.cx, box.cy);
  ctx.rotate((box.rot * Math.PI) / 180);
  ctx.beginPath();
  ctx.roundRect(-box.w / 2, -box.h / 2, box.w, box.h, 28);
  ctx.fillStyle = "#cbd5e1";
  ctx.fill();
  ctx.save();
  ctx.clip();
  // Isi penuh kotak nampan, sisi yang berlebih dipotong
  const scale = Math.max(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#94a3b8";
  ctx.stroke();
  ctx.restore();
}

// Warna latar template di sekeliling kotak nampan (median, agar tepi kertas atau sayur di dekatnya tidak ikut).
function sampleBackdrop(ctx: CanvasRenderingContext2D, box: TrayBox, scale: number): string {
  const rad = (box.rot * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    for (const [fx, fy] of [[i / steps - 0.5, -0.5], [i / steps - 0.5, 0.5], [-0.5, i / steps - 0.5], [0.5, i / steps - 0.5]]) {
      const lx = fx * (box.w + 60);
      const ly = fy * (box.h + 60);
      const x = Math.round((box.cx + lx * cos - ly * sin) * scale);
      const y = Math.round((box.cy + lx * sin + ly * cos) * scale);
      if (x < 0 || y < 0 || x >= ctx.canvas.width || y >= ctx.canvas.height) continue;
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      rs.push(r);
      gs.push(g);
      bs.push(b);
    }
  }
  if (rs.length === 0) return "#ffffff";
  const median = (arr: number[]) => arr.sort((a, b) => a - b)[Math.floor(arr.length / 2)];
  return `rgb(${median(rs)}, ${median(gs)}, ${median(bs)})`;
}

// Potongan nampan tanpa background: nampan contoh ditutup warna latar, lalu nampan baru digambar utuh dengan bayangan seperti contoh di template.
function drawTrayCutout(ctx: CanvasRenderingContext2D, box: TrayBox, img: HTMLImageElement, backdrop: string | null) {
  ctx.save();
  ctx.translate(box.cx, box.cy);
  ctx.rotate((box.rot * Math.PI) / 180);
  ctx.save();
  if (!backdrop) ctx.globalAlpha = 0;
  ctx.filter = "blur(14px)";
  ctx.fillStyle = backdrop ?? "transparent";
  ctx.beginPath();
  ctx.roundRect(-box.w / 2 - 12, -box.h / 2 - 12, box.w + 24, box.h + 24, 40);
  ctx.fill();
  ctx.restore();
  const scale = Math.min(box.w / img.naturalWidth, box.h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.shadowColor = "rgba(15, 23, 42, 0.28)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

// Tempat foto pada desain kanvas, sebelum foto nampan diunggah (desain ini tidak punya nampan contoh).
function drawTrayPlaceholder(ctx: CanvasRenderingContext2D, box: TrayBox, colors: {fill: string; stroke: string; text: string}) {
  ctx.save();
  ctx.translate(box.cx, box.cy);
  ctx.rotate((box.rot * Math.PI) / 180);
  ctx.beginPath();
  ctx.roundRect(-box.w / 2, -box.h / 2, box.w, box.h, 36);
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.setLineDash([22, 16]);
  ctx.lineWidth = 5;
  ctx.strokeStyle = colors.stroke;
  ctx.stroke();
  ctx.rotate((-box.rot * Math.PI) / 180);
  ctx.fillStyle = colors.text;
  ctx.font = `700 44px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Foto nampan", 0, 0);
  ctx.restore();
}

const nutritionRowsFor = (values: NutritionValues) =>
  NUTRITION_ROWS.map((row) => ({label: row.label, value: values[row.key] ? `${values[row.key]} ${row.unit}` : "-"}));

function drawNutrition(ctx: CanvasRenderingContext2D, col: NutritionColumn, values: NutritionValues) {
  if (!hasAnyNutrition(values)) return;
  ctx.save();
  ctx.textBaseline = "alphabetic";
  NUTRITION_ROWS.forEach((row, i) => {
    const y = col.y + col.gap * i;
    const label = `${row.label} : `;
    ctx.font = `600 ${col.px}px ${FONT}`;
    ctx.fillStyle = "#3a3840";
    ctx.fillText(label, col.x, y);
    const labelWidth = ctx.measureText(label).width;
    ctx.font = `800 ${col.px}px ${FONT}`;
    ctx.fillStyle = "#1a1820";
    ctx.fillText(`${values[row.key] || "-"} ${row.unit}`, col.x + labelWidth, y);
  });
  ctx.restore();
}

const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string): Promise<HTMLImageElement> {
  let p = imageCache.get(src);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      // Foto poster tersimpan di storage Supabase; tanpa CORS kanvas terkunci dan poster tidak bisa diunduh
      if (/^https?:\/\//.test(src)) img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gambar gagal dimuat."));
      img.src = src;
    });
    imageCache.set(src, p);
    p.catch(() => imageCache.delete(src));
  }
  return p;
}

let fontsReady: Promise<unknown> | null = null;
const ensureFonts = () => {
  if (!fontsReady) {
    fontsReady = Promise.all(
      [
        "600 30px Nunito",
        "700 30px Nunito",
        "800 30px Nunito",
        '400 30px "Plus Jakarta Sans"',
        '500 30px "Plus Jakarta Sans"',
        '600 30px "Plus Jakarta Sans"',
        '700 30px "Plus Jakarta Sans"',
        '800 30px "Plus Jakarta Sans"',
        '800 30px "Baloo 2"',
        "italic 800 30px Fraunces",
      ].map((f) => document.fonts.load(f))
    ).catch(() => undefined);
  }
  return fontsReady;
};

// scale < 1 untuk gambar kecil pilihan desain. isStale dicek setelah gambar termuat agar gambar
// dari isian lama tidak menimpa yang baru.
async function drawPoster(canvas: HTMLCanvasElement, layout: PosterTemplate, date: string, menus: MenuCardData[], scale = 1, isStale?: () => boolean) {
  if (isDrawnPoster(layout)) return drawCanvasPoster(canvas, layout, date, menus, scale, isStale);
  const [template, ...photos] = await Promise.all([
    loadImage(layout.src),
    ...menus.map((m) => (m.photo ? loadImage(m.photo).catch(() => null) : Promise.resolve(null))),
    ensureFonts(),
  ]);
  if (isStale?.()) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.drawImage(template as HTMLImageElement, 0, 0, layout.width, layout.height);

  if (date) {
    ctx.save();
    ctx.fillStyle = layout.date.color ?? "#ffffff";
    ctx.font = `800 ${layout.date.px}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(formatPosterDate(date), layout.date.x, layout.date.y);
    ctx.restore();
  }

  layout.notes.forEach((box, i) => {
    const menu = menus[i];
    if (!menu) return;
    const photo = photos[i] as HTMLImageElement | null | undefined;
    if (photo && menu.photoOriginal) drawTrayCutout(ctx, layout.trays[i], photo, sampleBackdrop(ctx, layout.trays[i], scale));
    else if (photo) drawTrayPhoto(ctx, layout.trays[i], photo);
    drawNote(ctx, box, menu.items);
    drawNutrition(ctx, layout.nutrition[i].large, menu.largePortion);
    drawNutrition(ctx, layout.nutrition[i].small, menu.smallPortion);
  });
}

async function drawCanvasPoster(canvas: HTMLCanvasElement, layout: DrawnPosterTemplate, date: string, menus: MenuCardData[], scale: number, isStale?: () => boolean) {
  const [logo, slhsSource, yayasanSource, photos] = await Promise.all([
    loadImage(logoSppg),
    loadImage(templateSingle),
    loadImage(templateDouble),
    Promise.all(menus.map((m) => (m.photo ? loadImage(m.photo).catch(() => null) : Promise.resolve(null)))),
    ensureFonts(),
  ]);
  if (isStale?.()) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = Math.round(layout.width * scale);
  canvas.height = Math.round(layout.height * scale);
  ctx.scale(scale, scale);
  const drawnMenus: DrawnMenu[] = menus.map((menu, i) => ({
    items: menu.items,
    large: nutritionRowsFor(menu.largePortion),
    small: nutritionRowsFor(menu.smallPortion),
    labelPlacements: menu.labelPlacements ?? undefined,
    drawTray: (box: PosterTrayBox, placeholder) => {
      const photo = photos[i];
      if (photo && menu.photoOriginal) drawTrayCutout(ctx, box, photo, null);
      else if (photo) drawTrayPhoto(ctx, box, photo);
      else drawTrayPlaceholder(ctx, box, placeholder);
    },
  }));
  const input: DrawnPosterInput = {
    ...drawnMenus[0],
    menus: drawnMenus,
    dateLong: formatPosterDateLong(date),
    logo,
    slhs: {img: slhsSource, ...SLHS_CROP},
    yayasan: {img: yayasanSource, ...YAYASAN_CROP},
  };
  layout.draw(ctx, input);
}

const THUMB_SCALE = 0.25;

// Pilihan desain: tiap template digambar kecil dengan isian yang sama seperti pratinjau utama.
const PosterThumb: React.FC<{template: PosterTemplate; date: string; menus: MenuCardData[]; selected: boolean; onSelect: () => void}> = ({
  template,
  date,
  menus,
  selected,
  onSelect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stale = false;
    const frame = requestAnimationFrame(() => {
      drawPoster(canvas, template, date, menus, THUMB_SCALE, () => stale)
        .then(() => !stale && setStatus("ready"))
        .catch(() => !stale && setStatus("error"));
    });
    return () => {
      stale = true;
      cancelAnimationFrame(frame);
    };
  }, [template, date, menus]);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`group text-left rounded-lg border p-1.5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-1 ${
        selected ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"
      }`}>
      <div className="relative rounded-md overflow-hidden bg-slate-50" style={{aspectRatio: `${template.width} / ${template.height}`}}>
        <canvas ref={canvasRef} aria-hidden="true" className={`block w-full h-full ${status === "ready" ? "" : "invisible"}`} />
        {status !== "ready" && (
          <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] text-slate-600">
            {status === "loading" ? "Memuat..." : "Template gagal dimuat"}
          </span>
        )}
      </div>
      <span className={`block mt-1.5 px-0.5 text-[11px] leading-tight ${selected ? "font-semibold text-emerald-800" : "font-medium text-slate-700"}`}>{template.name}</span>
    </button>
  );
};

// ---------------------------------------------------------------------------------------------

interface MenuPrintModuleProps {
  onNavigate?: (tab: string) => void;
}

const MENU_LABELS = {SINGLE: ["Menu"], DOUBLE: ["Menu sekolah", "Menu 3B"]} as const;

export const MenuPrintModule: React.FC<MenuPrintModuleProps> = ({onNavigate}) => {
  const toast = useToast();
  const [menuOrders, setMenuOrders] = useState<MenuOrder[]>(() => warehouseDb.getMenuOrders());
  const [printMode, setPrintMode] = useState<PosterMode>("SINGLE");
  const [templateIds, setTemplateIds] = useState<Record<PosterMode, string>>(DEFAULT_TEMPLATE_IDS);
  const [selectedDate, setSelectedDate] = useState<string>(() => localDateIso());
  const [menus, setMenus] = useState<MenuCardData[]>(() => [emptyMenu(), emptyMenu()]);
  const [activeMenu, setActiveMenu] = useState(0);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [cutoutIndex, setCutoutIndex] = useState<number | null>(null);
  const [cutoutStatus, setCutoutStatus] = useState("");
  const [downloading, setDownloading] = useState<"jpg" | "png" | null>(null);
  const [renderError, setRenderError] = useState("");
  const [showWhatsAppPaste, setShowWhatsAppPaste] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState("");
  const [pasteResult, setPasteResult] = useState("");
  const [filledFromOrderId, setFilledFromOrderId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [placingLabels, setPlacingLabels] = useState(false);
  const placementSupported = (() => {
    const t = findTemplate(printMode, templateIds[printMode]);
    return isDrawnPoster(t) && Boolean(t.labels);
  })();
  useEffect(() => {
    if (!placementSupported) setPlacingLabels(false);
  }, [placementSupported]);
  const [posterSave, setPosterSave] = useState<{state: "idle" | "saving" | "saved" | "failed"; message?: string}>({state: "idle"});
  const [saveRetry, setSaveRetry] = useState(0);

  // Rencana menu bisa datang belakangan dari sinkronisasi cloud
  useEffect(() => {
    const reload = () => setMenuOrders(warehouseDb.getMenuOrders());
    window.addEventListener("sppg_warehouse_sync", reload);
    return () => window.removeEventListener("sppg_warehouse_sync", reload);
  }, []);

  const orderForDate = useMemo(
    () => menuOrders.find((o) => o.date === selectedDate && o.status !== "CANCELLED"),
    [menuOrders, selectedDate]
  );

  const visibleMenus = useMemo(() => (printMode === "SINGLE" ? menus.slice(0, 1) : menus), [printMode, menus]);
  const modeTemplates = templatesFor(printMode);
  const activeTemplate = findTemplate(printMode, templateIds[printMode]);
  const editingIndex = printMode === "SINGLE" ? 0 : activeMenu;
  const current = menus[editingIndex];
  // Letak nama hidangan yang bisa digeser: hanya desain yang mendukung, dan jumlahnya mengikuti label yang tergambar.
  const labelSetup = isDrawnPoster(activeTemplate) && activeTemplate.labels
    ? {texts: activeTemplate.labels.texts(current.items), defaults: activeTemplate.labels.defaults(editingIndex)}
    : null;
  const hasPlacements = Boolean(current.labelPlacements);
  useEffect(() => {
    if (!hasPlacements) setPlacingLabels(false);
  }, [hasPlacements]);
  // Jumlah hidangan bisa berubah setelah letak diatur: label baru memakai letak bawaan, label yang hilang dibuang.
  const placementsForOverlay = labelSetup && current.labelPlacements
    ? labelSetup.texts.map((_, i) => current.labelPlacements![i] ?? labelSetup.defaults[i])
    : null;
  const shownLabelTexts = labelSetup ? labelSetup.texts.map((t, i) => shownLabel(t, current.labelPlacements?.[i])) : [];

  const updateMenu = (index: number, patch: Partial<MenuCardData>) =>
    setMenus((prev) => prev.map((m, i) => (i === index ? {...m, ...patch} : m)));

  // Teks yang sedang diketik per kotak gizi; dilepas saat kotak ditinggalkan agar tampil rapi sesuai hasil baca.
  const [nutritionDrafts, setNutritionDrafts] = useState<Record<string, string>>({});
  const setNutritionText = (index: number, portion: "largePortion" | "smallPortion", text: string) => {
    setNutritionDrafts((prev) => ({...prev, [`${index}-${portion}`]: text}));
    updateMenu(index, {[portion]: parseNutritionText(text)});
  };
  const clearNutritionDraft = (index: number, portion: "largePortion" | "smallPortion") =>
    setNutritionDrafts((prev) => {
      const {[`${index}-${portion}`]: _, ...rest} = prev;
      return rest;
    });

  const fillFromOrder = useCallback((order: MenuOrder) => {
    const regular = splitDishes(order.menuTitle);
    const b3 = splitDishes(order.specialDietB3);
    setMenus((prev) => [
      {...prev[0], items: regular.length > 0 ? regular : prev[0].items},
      {...prev[1], items: b3.length > 0 ? b3 : prev[1].items},
    ]);
    if (b3.length > 0) setPrintMode("DOUBLE");
    setFilledFromOrderId(order.id);
  }, []);

  // Isi poster tersimpan di order tanggalnya. Saat tanggal (atau ordernya) berganti: muat poster yang tersimpan, atau
  // mulai dari rencana menu. Isi dari tanggal lain dibuang dulu supaya foto dan gizinya tidak ikut tersimpan ke sini.
  const loadedKeyRef = useRef<string | null>(null);
  const loadedOrderIdRef = useRef<string | null>(null);
  const lastSavedRef = useRef("");
  useEffect(() => {
    const key = `${selectedDate}|${orderForDate?.id ?? ""}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    if (!orderForDate) return;
    const fromOtherOrder = loadedOrderIdRef.current !== null && loadedOrderIdRef.current !== orderForDate.id;
    loadedOrderIdRef.current = orderForDate.id;
    const saved = orderForDate.poster;
    if (saved) {
      const nextMenus = [0, 1].map((i) => posterMenuToCard(saved.menus[i]));
      const nextTemplates = {...DEFAULT_TEMPLATE_IDS, ...(saved.templateIds as Partial<Record<PosterMode, string>> | undefined)};
      setMenus(nextMenus);
      setPrintMode(saved.printMode);
      setTemplateIds(nextTemplates);
      setFilledFromOrderId(orderForDate.id);
      lastSavedRef.current = posterSnapshot(nextMenus, saved.printMode, nextTemplates);
      setPosterSave({state: "saved"});
      return;
    }
    if (fromOtherOrder) setMenus([emptyMenu(), emptyMenu()]);
    fillFromOrder(orderForDate);
    setPosterSave({state: "idle"});
  }, [selectedDate, orderForDate, fillFromOrder]);

  // Gambar ulang pratinjau setiap ada perubahan; permintaan yang tertinggal diabaikan.
  const drawSeq = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const seq = ++drawSeq.current;
    const isStale = () => seq !== drawSeq.current;
    const frame = requestAnimationFrame(() => {
      if (isStale()) return;
      drawPoster(canvas, activeTemplate, selectedDate, visibleMenus, 1, isStale)
        .then(() => !isStale() && setRenderError(""))
        .catch(() => !isStale() && setRenderError("Template poster gagal dimuat. Muat ulang halaman lalu coba lagi."));
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTemplate, selectedDate, visibleMenus]);

  const handleApplyWhatsAppText = () => {
    if (!whatsAppText.trim()) return;
    const parsed = parseFullWhatsAppMenu(whatsAppText);
    const filled: string[] = [];

    if (parsed.date) {
      setSelectedDate(parsed.date);
      filled.push(`tanggal ${formatPosterDate(parsed.date)}`);
    }
    setMenus((prev) => {
      const next = [...prev];
      if (parsed.menu1Items) next[0] = {...next[0], items: parsed.menu1Items};
      if (parsed.menu1Large && hasAnyNutrition(parsed.menu1Large)) next[0] = {...next[0], largePortion: parsed.menu1Large};
      if (parsed.menu1Small && hasAnyNutrition(parsed.menu1Small)) next[0] = {...next[0], smallPortion: parsed.menu1Small};
      if (parsed.hasMenu2) {
        if (parsed.menu2Items) next[1] = {...next[1], items: parsed.menu2Items};
        if (parsed.menu2Large && hasAnyNutrition(parsed.menu2Large)) next[1] = {...next[1], largePortion: parsed.menu2Large};
        if (parsed.menu2Small && hasAnyNutrition(parsed.menu2Small)) next[1] = {...next[1], smallPortion: parsed.menu2Small};
      }
      return next;
    });
    if (parsed.menu1Items) filled.push(`${parsed.menu1Items.length} hidangan`);
    if ((parsed.menu1Large && hasAnyNutrition(parsed.menu1Large)) || (parsed.menu1Small && hasAnyNutrition(parsed.menu1Small))) {
      filled.push("nilai gizi");
    }
    if (parsed.hasMenu2) {
      setPrintMode("DOUBLE");
      filled.push("menu 3B");
    }

    if (filled.length === 0) {
      setPasteResult("Tidak ada data yang dikenali. Periksa formatnya, lalu coba lagi.");
      return;
    }
    setPasteResult(`Terisi: ${filled.join(", ")}. Periksa lagi sebelum dicetak.`);
    setWhatsAppText("");
    setShowWhatsAppPaste(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const index = editingIndex;
    setUploadingIndex(index);
    try {
      const result = await compressImageToWebP(file, {maxDimension: 1200, quality: 0.85});
      updateMenu(index, {photo: result.dataUrl, photoOriginal: null});
      setUploadingIndex(null);
      await removeBackground(index, result.dataUrl);
    } catch {
      toast.error("Foto gagal dibaca. Coba foto lain dengan format JPG atau PNG.", "Foto nampan");
    } finally {
      setUploadingIndex(null);
    }
  };

  const editingPhoto = menus[editingIndex]?.photo;
  const editingCutDone = Boolean(menus[editingIndex]?.photoOriginal);
  useEffect(() => {
    if (editingPhoto && !editingCutDone) preloadBgRemoval();
  }, [editingPhoto, editingCutDone]);

  const handleRemoveBackground = () => {
    const source = menus[editingIndex]?.photo;
    if (source) removeBackground(editingIndex, source);
  };

  async function removeBackground(index: number, source: string) {
    setCutoutIndex(index);
    setCutoutStatus("Menyiapkan...");
    try {
      const trimmed = await cutoutTrayPhoto(source, setCutoutStatus);
      const result = await compressImageToWebP(new File([trimmed], "nampan.png", {type: "image/png"}), {maxDimension: 1200, quality: 0.9});
      updateMenu(index, {photo: result.dataUrl, photoOriginal: source});
    } catch {
      toast.error("Background gagal dihapus. Periksa koneksi internet (model diunduh saat pertama kali), lalu coba lagi.", "Foto nampan");
    } finally {
      setCutoutIndex(null);
      setCutoutStatus("");
    }
  }

  // Foto tanpa background otomatis tampil di halaman menu publik, selama tanggal poster sama dengan tanggal halaman.
  // Tanggal berbeda: petugas memutuskan sendiri, supaya poster besok tidak tampil sebagai menu hari ini.
  const [pageDateText, setPageDateText] = useState(() => getWebsiteConfig().menuToday.dateText);
  useEffect(() => {
    const refresh = () => setPageDateText(getWebsiteConfig().menuToday.dateText);
    window.addEventListener(WEBSITE_CONFIG_UPDATED_EVENT, refresh);
    fetchWebsiteConfigFromCloud().then((res) => setPageDateText(res.config.menuToday.dateText));
    return () => window.removeEventListener(WEBSITE_CONFIG_UPDATED_EVENT, refresh);
  }, []);
  const posterDateLong = formatPosterDateLong(selectedDate);
  const dateMatchesPage = pageDateText.toLowerCase().includes((posterDateLong.split(", ").pop() ?? "").toLowerCase());

  // Letak nama poster diubah ke koordinat panggung halaman publik; undefined = letak bawaan.
  const stageLabelsOf = useCallback(
    (menu: MenuCardData, i: number) => {
      const labelSource = isDrawnPoster(activeTemplate) ? activeTemplate.labels : undefined;
      if (!labelSource || !menu.labelPlacements) return undefined;
      const defaults = labelSource.defaults(i);
      return labelSource.texts(menu.items).map((text, n) => {
        const placed = menu.labelPlacements?.[n] ?? defaults[n];
        return {text, ...posterLabelToStage(printMode === "DOUBLE" ? greenDoubleToSingle(placed, i) : placed)};
      });
    },
    [activeTemplate, printMode]
  );

  const trayPublishes = useMemo<TrayPublish[]>(
    () =>
      visibleMenus.flatMap((menu, i): TrayPublish[] => {
        if (!menu.photo || !menu.photoOriginal) return [];
        const target = i === 0 ? "reguler" : "b3";
        const labels = stageLabelsOf(menu, i);
        return [labels ? {target, photo: menu.photo, labels, dishes: menu.items} : {target, photo: menu.photo, dishes: menu.items}];
      }),
    [visibleMenus, stageLabelsOf]
  );

  // Simpan isi poster ke Order Menu tanggal ini setiap ada perubahan (jeda 1,2 detik), supaya poster bisa dibuka lagi
  // dari perangkat mana pun dan Atur Website bisa mengambil foto, gizi, dan letak namanya.
  const busyPhoto = uploadingIndex !== null || cutoutIndex !== null;
  useEffect(() => {
    if (!orderForDate || loadedKeyRef.current !== `${selectedDate}|${orderForDate.id}` || busyPhoto) return;
    const snapshot = posterSnapshot(menus, printMode, templateIds);
    if (snapshot === lastSavedRef.current) return;
    const orderId = orderForDate.id;
    const timer = setTimeout(async () => {
      setPosterSave({state: "saving"});
      try {
        const posterMenus = await Promise.all(
          menus.map(async (m, i) => ({
            items: m.items,
            photoUrl: m.photo ? await uploadPosterPhoto(m.photo) : null,
            photoOriginalUrl: m.photoOriginal ? await uploadPosterPhoto(m.photoOriginal) : null,
            largePortion: m.largePortion,
            smallPortion: m.smallPortion,
            labelPlacements: m.labelPlacements ?? null,
            stageLabels: stageLabelsOf(m, i) ?? null,
          }))
        );
        warehouseDb.saveMenuOrderPoster(orderId, {menus: posterMenus, printMode, templateIds, updatedAt: new Date().toISOString()});
        lastSavedRef.current = snapshot;
        setPosterSave({state: "saved"});
      } catch (err) {
        setPosterSave({state: "failed", message: err instanceof Error ? err.message : "Koneksi bermasalah."});
      }
    }, 1200);
    return () => clearTimeout(timer);
    // orderForDate berganti objek setiap kali tersimpan; yang menentukan hanya id-nya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menus, printMode, templateIds, orderForDate?.id, selectedDate, busyPhoto, stageLabelsOf, saveRetry]);
  const trayKey = useMemo(() => JSON.stringify(trayPublishes), [trayPublishes]);
  const [trayStatus, setTrayStatus] = useState<{state: "idle" | "sending" | "sent" | "failed"; key: string; message?: string}>({state: "idle", key: ""});
  const trayQueue = useRef<Promise<void>>(Promise.resolve());
  const trayHasLabels = useRef<Record<string, boolean>>({});

  const sendTrays = useCallback((items: TrayPublish[], key: string) => {
    setTrayStatus({state: "sending", key});
    // Letak nama yang dikembalikan ke bawaan di poster juga dikembalikan di halaman menu.
    const withResets = items.map((item) => (item.labels === undefined && trayHasLabels.current[item.target] ? {...item, labels: null} : item));
    trayQueue.current = trayQueue.current.then(async () => {
      try {
        await publishTrays(withResets);
        withResets.forEach((item) => {
          trayHasLabels.current[item.target] = Boolean(item.labels);
        });
        setTrayStatus((s) => (s.key === key ? {state: "sent", key} : s));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Koneksi bermasalah.";
        setTrayStatus((s) => (s.key === key ? {state: "failed", key, message} : s));
      }
    });
  }, []);

  useEffect(() => {
    if (trayPublishes.length === 0 || !dateMatchesPage) return;
    const timer = setTimeout(() => sendTrays(trayPublishes, trayKey), 1000);
    return () => clearTimeout(timer);
    // trayKey sudah mewakili isi trayPublishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trayKey, dateMatchesPage, sendTrays]);

  // Angka gizi ikut terkirim seperti foto, tanpa tombol. Gizi 3B diambil dari menus[1] di mode apa pun, karena poster
  // satu menu pun bisa punya menu 3B. Menu yang gizinya kosong semua dilewati agar poster baru tidak mengosongkan halaman.
  const nutritionPublishes = useMemo<NutritionPublish[]>(
    () =>
      menus.flatMap((m, i): NutritionPublish[] =>
        hasAnyNutrition(m.largePortion) || hasAnyNutrition(m.smallPortion)
          ? [{target: i === 0 ? "reguler" : "b3", large: m.largePortion, small: m.smallPortion}]
          : []
      ),
    [menus]
  );
  const nutritionKey = useMemo(() => JSON.stringify(nutritionPublishes), [nutritionPublishes]);
  const [nutritionStatus, setNutritionStatus] = useState<{state: "idle" | "sending" | "sent" | "failed"; key: string; message?: string}>({state: "idle", key: ""});
  const posterDay = posterDateLong.split(", ").pop() ?? "";

  const sendNutrition = useCallback((items: NutritionPublish[], key: string, day: string) => {
    setNutritionStatus({state: "sending", key});
    // Antrean yang sama dengan foto: keduanya membaca lalu menulis config yang sama
    trayQueue.current = trayQueue.current.then(async () => {
      try {
        await publishPosterNutrition(items, day);
        setNutritionStatus((s) => (s.key === key ? {state: "sent", key} : s));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Koneksi bermasalah.";
        setNutritionStatus((s) => (s.key === key ? {state: "failed", key, message} : s));
      }
    });
  }, []);

  // Hanya setelah poster tanggal ini termuat, supaya isian tanggal lain yang masih di layar tidak ikut terkirim.
  const orderIdForDate = orderForDate?.id;
  useEffect(() => {
    if (nutritionPublishes.length === 0 || !dateMatchesPage || !orderIdForDate || loadedKeyRef.current !== `${selectedDate}|${orderIdForDate}`) return;
    const timer = setTimeout(() => sendNutrition(nutritionPublishes, nutritionKey, posterDay), 1000);
    return () => clearTimeout(timer);
    // nutritionKey sudah mewakili isi nutritionPublishes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nutritionKey, dateMatchesPage, orderIdForDate, selectedDate, posterDay, sendNutrition]);

  const handleDownload = async (format: "jpg" | "png") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloading(format);
    try {
      // Pastikan kanvas memuat isian terakhir sebelum diekspor
      await drawPoster(canvas, activeTemplate, selectedDate, visibleMenus);
      const dataUrl = canvas.toDataURL(format === "jpg" ? "image/jpeg" : "image/png", 0.95);
      const link = document.createElement("a");
      const designSuffix = modeTemplates.length > 1 ? `-${activeTemplate.id}` : "";
      link.download = `Poster-Menu-MBG-${selectedDate}-${printMode === "SINGLE" ? "1-menu" : "2-menu"}${designSuffix}.${format}`;
      link.href = dataUrl;
      link.click();
    } catch {
      toast.error("Gambar poster gagal dibuat. Coba lagi, atau pakai Cetak lalu simpan sebagai PDF.", "Unduh gagal");
    } finally {
      setDownloading(null);
    }
  };

  const handlePrint = async () => {
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        await drawPoster(canvas, activeTemplate, selectedDate, visibleMenus);
      } catch {
        toast.error("Poster gagal disiapkan untuk dicetak. Muat ulang halaman lalu coba lagi.", "Cetak gagal");
        return;
      }
    }
    window.print();
  };

  const missing: string[] = [];
  visibleMenus.forEach((m, i) => {
    const name = MENU_LABELS[printMode][i];
    if (!m.items.some((it) => it.trim())) missing.push(`daftar ${name.toLowerCase()}`);
    if (!hasAnyNutrition(m.largePortion) && !hasAnyNutrition(m.smallPortion)) missing.push(`nilai gizi ${name.toLowerCase()}`);
  });
  const showB3NutritionOnly = printMode === "SINGLE" && Boolean(orderForDate?.specialDietB3?.trim());
  if (showB3NutritionOnly && !hasAnyNutrition(menus[1].largePortion) && !hasAnyNutrition(menus[1].smallPortion)) {
    missing.push("nilai gizi 3B untuk halaman menu");
  }

  const nutritionInputs = (index: number) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {(["largePortion", "smallPortion"] as const).map((portion) => {
        const id = `nutrition-${index}-${portion}`;
        const values = menus[index][portion];
        const unread = NUTRITION_ROWS.filter((row) => !values[row.key]).map((row) => row.label.toLowerCase());
        return (
          <div key={portion}>
            <label htmlFor={id} className="block text-xs font-medium text-slate-700 mb-1">
              {portion === "largePortion" ? "Porsi besar" : "Porsi kecil"}
            </label>
            <textarea
              id={id}
              rows={5}
              value={nutritionDrafts[`${index}-${portion}`] ?? formatNutritionText(values)}
              onChange={(e) => setNutritionText(index, portion, e.target.value)}
              onBlur={() => clearNutritionDraft(index, portion)}
              placeholder={portion === "largePortion" ? "Energi: 763,1\nProtein: 28,4\nLemak: 22,5\nKarbohidrat: 110,2\nSerat: 6,3" : "Energi: 560\nProtein: 20,1\nLemak: 16,8\nKarbohidrat: 80,5\nSerat: 4,7"}
              className="w-full p-2.5 text-xs font-mono tabular-nums rounded-lg border border-slate-300 bg-white text-slate-900 leading-relaxed placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            />
            <p className={`mt-0.5 text-[11px] ${hasAnyNutrition(values) && unread.length > 0 ? "text-amber-700" : "text-slate-600"}`}>
              {!hasAnyNutrition(values) ? "Belum diisi" : unread.length === 0 ? "Kelima zat gizi terbaca" : `Belum terbaca: ${unread.join(", ")}`}
            </p>
          </div>
        );
      })}
    </div>
  );

  const segmentBtn = (active: boolean) =>
    `flex-1 sm:flex-none min-h-[44px] sm:min-h-[32px] px-3 py-1 rounded-md text-xs leading-tight transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
      active ? "bg-white text-slate-900 font-semibold shadow-2xs" : "text-slate-700 hover:text-slate-900 font-medium"
    }`;

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          header, footer, nav, .no-print {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
            width: 100% !important;
          }
          .poster-print-area {
            border: none !important;
            padding: 0 !important;
            background: none !important;
          }
          .poster-canvas {
            display: block !important;
            width: auto !important;
            height: auto !important;
            max-width: 100vw !important;
            max-height: 98vh !important;
            margin: 0 auto !important;
            border: none !important;
            box-shadow: none !important;
          }
          @page {
            size: A4 ${printMode === "SINGLE" ? "portrait" : "landscape"};
            margin: 0;
          }
        }
      `}</style>

      <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 no-print">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cetak Menu MBG</h1>
            <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
              Poster menu harian dari template SPPG. Isi tanggal, hidangan, dan nilai gizi, lalu cetak A4 atau unduh gambarnya untuk dibagikan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button type="button" onClick={() => handleDownload("jpg")} disabled={downloading !== null} className={`${BTN_SECONDARY} disabled:opacity-50 disabled:cursor-not-allowed`}>
              {downloading === "jpg" ? "Menyiapkan..." : "Unduh JPG"}
            </button>
            <button type="button" onClick={() => handleDownload("png")} disabled={downloading !== null} className={`${BTN_SECONDARY} disabled:opacity-50 disabled:cursor-not-allowed`}>
              {downloading === "png" ? "Menyiapkan..." : "Unduh PNG"}
            </button>
            <button type="button" onClick={handlePrint} className={BTN_PRIMARY}>
              Cetak A4
            </button>
          </div>
        </div>
        {missing.length > 0 && (
          <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Belum diisi: {missing.join(", ")}. Bagian yang kosong tidak tercetak di poster.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-4 items-start">
        {/* Isian poster */}
        <div className="space-y-4 no-print">
          <section className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
            <div>
              <span className={FIELD_LABEL} id="poster-mode-label">Jenis poster</span>
              <div role="radiogroup" aria-labelledby="poster-mode-label" className="flex sm:inline-flex w-full sm:w-auto p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                <button type="button" role="radio" aria-checked={printMode === "SINGLE"} onClick={() => setPrintMode("SINGLE")} className={segmentBtn(printMode === "SINGLE")}>
                  1 menu (A4 tegak)
                </button>
                <button type="button" role="radio" aria-checked={printMode === "DOUBLE"} onClick={() => setPrintMode("DOUBLE")} className={segmentBtn(printMode === "DOUBLE")}>
                  2 menu, sekolah dan 3B (A4 mendatar)
                </button>
              </div>
            </div>

            {modeTemplates.length > 1 && (
              <div>
                <span className={FIELD_LABEL} id="poster-design-label">
                  Desain poster
                </span>
                <div role="radiogroup" aria-labelledby="poster-design-label" className={`grid gap-2 ${printMode === "SINGLE" ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}>
                  {modeTemplates.map((t) => (
                    <PosterThumb
                      key={t.id}
                      template={t}
                      date={selectedDate}
                      menus={visibleMenus}
                      selected={t.id === activeTemplate.id}
                      onSelect={() => setTemplateIds((prev) => ({...prev, [printMode]: t.id}))}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-600">Semua desain memakai isian yang sama. Unduh dan cetak mengikuti desain yang dipilih.</p>
              </div>
            )}

            <div>
              <label htmlFor="poster-date" className={FIELD_LABEL}>
                Tanggal menu
              </label>
              <div className="flex items-center gap-2">
                <input id="poster-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value || localDateIso())} className={`${FIELD_INPUT} sm:max-w-[220px] font-mono`} />
                {selectedDate !== localDateIso() && (
                  <button type="button" onClick={() => setSelectedDate(localDateIso())} className={`${BTN_SECONDARY} shrink-0`}>
                    Hari ini
                  </button>
                )}
              </div>
              {selectedDate !== localDateIso() && (
                <p className="mt-1 text-[11px] text-amber-700">Tanggal poster bukan hari ini ({formatPosterDate(localDateIso())}).</p>
              )}
              {orderForDate ? (
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-700 min-w-0">
                    Rencana menu tanggal ini: <span className="font-semibold text-slate-900">{orderForDate.menuTitle}</span>
                    {orderForDate.specialDietB3 && <span className="block text-slate-600">3B: {orderForDate.specialDietB3}</span>}
                  </p>
                  <button type="button" onClick={() => fillFromOrder(orderForDate)} className={`${BTN_SECONDARY} shrink-0`}>
                    {filledFromOrderId === orderForDate.id ? "Isi ulang dari rencana" : "Isi dari rencana menu"}
                  </button>
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-600">
                  Belum ada rencana menu untuk tanggal ini, jadi isi poster tidak tersimpan dan hilang saat halaman dimuat ulang.{" "}
                  {onNavigate && (
                    <button type="button" onClick={() => onNavigate("menu_orders")} className="font-semibold text-emerald-800 underline cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                      Buka Order Menu
                    </button>
                  )}
                </p>
              )}
              {orderForDate && posterSave.state !== "idle" && (
                <p role={posterSave.state === "failed" ? "alert" : undefined} aria-live="polite" className={`mt-1.5 text-[11px] ${posterSave.state === "failed" ? "text-rose-700" : "text-slate-600"}`}>
                  {posterSave.state === "saving" && "Menyimpan isi poster ke Order Menu..."}
                  {posterSave.state === "saved" && "Foto, gizi, dan letak nama tersimpan di Order Menu tanggal ini. Atur Website bisa mengambilnya lewat Isi otomatis."}
                  {posterSave.state === "failed" && (
                    <>
                      Isi poster belum tersimpan. {posterSave.message}{" "}
                      <button
                        type="button"
                        onClick={() => {
                          lastSavedRef.current = "";
                          setSaveRetry((n) => n + 1);
                        }}
                        className="font-semibold underline cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                      >
                        Coba lagi
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Tempel pesan WhatsApp ahli gizi</h2>
                  <p className="text-[11px] text-slate-600">Tanggal, hidangan, dan nilai gizi terisi sekaligus.</p>
                </div>
                <button type="button" onClick={() => setShowWhatsAppPaste((v) => !v)} aria-expanded={showWhatsAppPaste} className={BTN_SECONDARY}>
                  {showWhatsAppPaste ? "Tutup" : "Tempel pesan"}
                </button>
              </div>
              {showWhatsAppPaste && (
                <div className="mt-3 space-y-2">
                  <label htmlFor="wa-text" className="sr-only">
                    Pesan WhatsApp
                  </label>
                  <textarea
                    id="wa-text"
                    rows={8}
                    value={whatsAppText}
                    onChange={(e) => setWhatsAppText(e.target.value)}
                    placeholder={`NILAI GIZI 28/09/26 Senin\nnasi putih\nayam kungpao\ntahu walik\n\n*Porsi Kecil*\nEnergi : 554,2 kkal\nProtein : 17,3 gr\n...\n*Porsi Besar*\nEnergi : 763,1 kkal\n...\n\n*3B*\n...`}
                    className="w-full p-2.5 text-xs rounded-lg border border-slate-300 bg-white font-mono text-slate-900 leading-relaxed placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  />
                  <div className="flex justify-end">
                    <button type="button" onClick={handleApplyWhatsAppText} disabled={!whatsAppText.trim()} className={`${BTN_PRIMARY} disabled:opacity-50 disabled:cursor-not-allowed`}>
                      Isi dari pesan
                    </button>
                  </div>
                </div>
              )}
              {pasteResult && (
                <p role="status" className="mt-2 text-[11px] text-slate-700">
                  {pasteResult}
                </p>
              )}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {printMode === "DOUBLE" ? (
              <div role="tablist" aria-label="Menu yang diisi" className="flex border-b border-slate-200">
                {MENU_LABELS.DOUBLE.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    role="tab"
                    aria-selected={activeMenu === i}
                    onClick={() => setActiveMenu(i)}
                    className={`flex-1 min-h-[44px] px-3 text-xs border-b-2 -mb-px cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600 ${
                      activeMenu === i ? "border-emerald-700 text-slate-900 font-semibold" : "border-transparent text-slate-600 hover:text-slate-900 font-medium"
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <h2 className="px-4 pt-4 text-sm font-semibold text-slate-800">Isi menu</h2>
            )}

            <div className="p-4 space-y-4">
              <div>
                <label htmlFor="menu-items" className={FIELD_LABEL}>
                  Hidangan, satu per baris
                </label>
                <textarea
                  id="menu-items"
                  rows={5}
                  value={current.items.join("\n")}
                  onChange={(e) =>
                    updateMenu(editingIndex, {
                      items: e.target.value.split("\n").map((l) => l.replace(/^[•\-\*]\s*/, "")),
                    })
                  }
                  onBlur={() => updateMenu(editingIndex, {items: current.items.map((l) => l.trim()).filter(Boolean)})}
                  placeholder={"nasi putih\nayam kungpao\ntahu walik\ntumis labu siam+jagung\nbuah kelengkeng"}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 leading-relaxed placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                />
                <p className="mt-1 text-[11px] text-slate-600">Tulisan otomatis mengecil bila daftar panjang, agar tetap muat di kertas.</p>
                {activeTemplate.itemsHint && <p className="mt-0.5 text-[11px] text-slate-600">{activeTemplate.itemsHint}</p>}
              </div>

              <div>
                <span className={FIELD_LABEL}>Foto nampan</span>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                    {current.photo ? (
                      <img src={current.photo} alt="Foto nampan yang dipakai" className={`w-full h-full ${current.photoOriginal ? "object-contain" : "object-cover"}`} />
                    ) : (
                      <span className="text-[11px] text-slate-600 text-center leading-tight px-1">Foto contoh</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingIndex !== null || cutoutIndex !== null} className={`${BTN_SECONDARY} disabled:opacity-50`}>
                      {uploadingIndex === editingIndex ? "Memproses foto..." : current.photo ? "Ganti foto" : "Unggah foto"}
                    </button>
                    {current.photo && !current.photoOriginal && (
                      <button type="button" onClick={handleRemoveBackground} disabled={cutoutIndex !== null} className={`${BTN_SECONDARY} disabled:opacity-50`}>
                        {cutoutIndex === editingIndex ? cutoutStatus : "Hapus background"}
                      </button>
                    )}
                    {current.photoOriginal && (
                      <button type="button" onClick={() => updateMenu(editingIndex, {photo: current.photoOriginal ?? null, photoOriginal: null})} className={BTN_SECONDARY}>
                        Kembalikan background
                      </button>
                    )}
                    {current.photo && (
                      <button type="button" onClick={() => updateMenu(editingIndex, {photo: null, photoOriginal: null})} disabled={cutoutIndex !== null} className={`${BTN_SECONDARY} disabled:opacity-50`}>
                        Pakai foto contoh
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" tabIndex={-1} aria-hidden="true" />
                </div>
                <p className="mt-1 text-[11px] text-slate-600">Foto diambil dari atas, nampan tegak memanjang. Foto menutupi nampan contoh di template.</p>
                {!current.photoOriginal && (
                  <p className="mt-0.5 text-[11px] text-slate-600">Background dihapus otomatis setelah foto diunggah, supaya nampan menyatu dengan poster dan halaman menu. Pertama kali perlu mengunduh model sekitar 80 MB; foto tetap diproses di perangkat ini.</p>
                )}
                {current.photo && !current.photoOriginal && cutoutIndex === null && (
                  <p className="mt-1 text-[11px] font-medium text-amber-800">Foto ini belum dikirim ke halaman menu, karena halaman menu hanya memakai foto tanpa background.</p>
                )}
                {trayPublishes.length > 0 && (
                  <div aria-live="polite" className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                    <p className="text-xs text-slate-700 min-w-0">
                      {trayStatus.key === trayKey && trayStatus.state === "sending" && "Mengirim ke halaman menu..."}
                      {trayStatus.key === trayKey && trayStatus.state === "sent" && "Foto dan letak nama sudah tampil di halaman menu."}
                      {trayStatus.key === trayKey && trayStatus.state === "failed" && `Belum terkirim ke halaman menu. ${trayStatus.message ?? ""}`}
                      {trayStatus.key !== trayKey && (dateMatchesPage ? "Menunggu dikirim ke halaman menu..." : `Halaman menu masih untuk ${pageDateText || "tanggal lain"}, poster ini ${posterDateLong}. Foto belum dikirim agar tidak salah tanggal.`)}
                    </p>
                    {(trayStatus.key === trayKey ? trayStatus.state === "failed" : !dateMatchesPage) && (
                      <button type="button" onClick={() => sendTrays(trayPublishes, trayKey)} className={`${BTN_SECONDARY} shrink-0`}>
                        {trayStatus.key === trayKey ? "Coba kirim lagi" : "Tetap kirim ke halaman menu"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <span className={FIELD_LABEL}>Nilai gizi</span>
                {nutritionInputs(editingIndex)}
                <p className="mt-1 text-[11px] text-slate-600">Tempel dari pesan ahli gizi, atau tulis satu zat gizi per baris. Tanpa nama zat gizi, angka dibaca berurutan: energi, protein, lemak, karbohidrat, serat. Pakai koma untuk desimal, misalnya 763,1.</p>
              </div>

              {showB3NutritionOnly && (
                <div className="border-t border-slate-200 pt-4">
                  <span className={FIELD_LABEL}>Nilai gizi menu 3B</span>
                  {nutritionInputs(1)}
                  <p className="mt-1 text-[11px] text-slate-600">Tidak tercetak di poster satu menu, hanya tampil di halaman menu.</p>
                </div>
              )}

              {orderForDate && nutritionPublishes.length > 0 && (
                <div aria-live="polite" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <p className="text-xs text-slate-700 min-w-0">
                    {nutritionStatus.key === nutritionKey && nutritionStatus.state === "sending" && "Mengirim angka gizi ke halaman menu..."}
                    {nutritionStatus.key === nutritionKey && nutritionStatus.state === "sent" && "Angka gizi sudah tampil di halaman menu."}
                    {nutritionStatus.key === nutritionKey && nutritionStatus.state === "failed" && `Angka gizi belum terkirim ke halaman menu. ${nutritionStatus.message ?? ""}`}
                    {nutritionStatus.key !== nutritionKey && (dateMatchesPage ? "Menunggu dikirim ke halaman menu..." : `Halaman menu masih untuk ${pageDateText || "tanggal lain"}, poster ini ${posterDateLong}. Angka gizi ikut saat memakai Isi otomatis di Atur Website.`)}
                  </p>
                  {nutritionStatus.key === nutritionKey && nutritionStatus.state === "failed" && (
                    <button type="button" onClick={() => sendNutrition(nutritionPublishes, nutritionKey, posterDay)} className={`${BTN_SECONDARY} shrink-0`}>
                      Coba kirim lagi
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Pratinjau: kanvas yang sama dipakai untuk cetak dan unduh */}
        <section className="poster-print-area bg-white rounded-xl border border-slate-200 p-3 sm:p-4 lg:sticky lg:top-4">
          <div className="flex items-center justify-between gap-2 mb-3 no-print">
            <h2 className="text-sm font-semibold text-slate-800">Pratinjau</h2>
            <span className="text-[11px] text-slate-600">Sama persis dengan hasil cetak dan unduhan</span>
          </div>
          {renderError && (
            <p role="alert" className="mb-3 text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 no-print">
              {renderError}
            </p>
          )}
          {labelSetup && (
            <div className="mb-3 no-print flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-xs text-slate-700 min-w-0">
                {placingLabels
                  ? "Geser kotak nama ke tempat kosong dan bulatan kuning ke makanannya di foto. Namanya bisa diganti di bawah pratinjau."
                  : current.labelPlacements
                  ? "Letak nama sudah diatur sendiri."
                  : "Letak nama mengikuti urutan baris hidangan."}
              </p>
              <div className="flex flex-wrap items-start gap-2 min-w-0">
                {current.photo && (
                  <AiTrayPointsButton
                    photo={current.photo}
                    texts={shownLabelTexts}
                    onPoints={(points, natural) => {
                      const box = greenTrayBox(printMode, editingIndex);
                      const base = placementsForOverlay ?? labelSetup.defaults.slice(0, labelSetup.texts.length);
                      updateMenu(editingIndex, {
                        labelPlacements: base.map((p, i) => {
                          const point = points[i];
                          if (!point) return p;
                          const {x, y} = photoPointToBox(point, natural, box, true);
                          return {...p, tipX: x, tipY: y};
                        }),
                      });
                    }}
                  />
                )}
                {current.labelPlacements && (
                  <button type="button" onClick={() => updateMenu(editingIndex, {labelPlacements: null})} className={BTN_SECONDARY}>
                    Kembalikan bawaan
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={placingLabels}
                  disabled={labelSetup.texts.length === 0}
                  onClick={() => {
                    if (!placingLabels && !current.labelPlacements) {
                      updateMenu(editingIndex, {labelPlacements: labelSetup.defaults.slice(0, labelSetup.texts.length)});
                    }
                    setPlacingLabels((v) => !v);
                  }}
                  className={`${placingLabels ? BTN_PRIMARY : BTN_SECONDARY} disabled:opacity-50`}
                >
                  {placingLabels ? "Selesai" : "Atur nama dan letak"}
                </button>
              </div>
            </div>
          )}
          <div className="relative">
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={`Pratinjau poster menu ${formatPosterDate(selectedDate)}`}
              className="poster-canvas block w-full h-auto rounded-lg border border-slate-200 bg-slate-50"
              style={{aspectRatio: `${activeTemplate.width} / ${activeTemplate.height}`}}
            />
            {placingLabels && labelSetup && placementsForOverlay && (
              <LabelPlacementOverlay
                view={{x: 0, y: 0, w: activeTemplate.width, h: activeTemplate.height}}
                texts={shownLabelTexts}
                placements={placementsForOverlay}
                onChange={(next) => updateMenu(editingIndex, {labelPlacements: next})}
              />
            )}
          </div>
          {placingLabels && labelSetup && placementsForOverlay && (
            <LabelNameFields
              idPrefix={`poster-${editingIndex}`}
              texts={labelSetup.texts}
              placements={placementsForOverlay}
              onChange={(next) => updateMenu(editingIndex, {labelPlacements: next})}
            />
          )}
        </section>
      </div>
    </div>
  );
};
