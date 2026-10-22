import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {warehouseDb} from "../db/storage";
import {MenuOrder} from "../types/warehouse";
import {compressImageToWebP} from "../utils/imageCompressor";
import {localDateIso} from "../utils/localDate";
import {useToast} from "../context/ToastContext";
import {FIELD_INPUT, FIELD_LABEL, BTN_PRIMARY, BTN_SECONDARY} from "./common/FormDialog";

// Template Canva resmi SPPG. Judul kertas ("Menu Makanan", "Menu Sekolah", "Menu 3B") dan foto nampan
// contoh sudah tercetak di template; aplikasi hanya menulis tanggal, daftar menu, foto, dan nilai gizi.
import templateSingle from "../assets/poster-single.jpg";
import templateDouble from "../assets/poster-double.jpg";

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
  largePortion: NutritionValues;
  smallPortion: NutritionValues;
}

const EMPTY_NUTRITION: NutritionValues = {energy: "", protein: "", fat: "", carb: "", fiber: ""};
const emptyMenu = (): MenuCardData => ({items: [], photo: null, largePortion: {...EMPTY_NUTRITION}, smallPortion: {...EMPTY_NUTRITION}});

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

interface PosterLayout {
  src: string;
  width: number;
  height: number;
  date: {x: number; y: number; px: number};
  notes: NoteBox[]; // per menu
  trays: TrayBox[]; // per menu
  nutrition: {large: NutritionColumn; small: NutritionColumn}[]; // per menu
}

const LAYOUTS: Record<"SINGLE" | "DOUBLE", PosterLayout> = {
  SINGLE: {
    src: templateSingle,
    width: 1587,
    height: 2245,
    date: {x: 793, y: 618, px: 44},
    notes: [{x: 175, y: 905, rot: -11, w: 470, h: 300, maxPx: 34, minPx: 20}],
    trays: [{cx: 1034, cy: 1095, w: 540, h: 655, rot: 16}],
    nutrition: [{large: {x: 360, y: 1785, px: 37, gap: 58}, small: {x: 830, y: 1785, px: 37, gap: 58}}],
  },
  DOUBLE: {
    src: templateDouble,
    width: 2245,
    height: 1587,
    date: {x: 1082, y: 371, px: 34},
    notes: [
      {x: 125, y: 690, rot: -12, w: 290, h: 215, maxPx: 30, minPx: 18},
      {x: 1232, y: 705, rot: -12, w: 270, h: 205, maxPx: 30, minPx: 18},
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
};

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
    fontsReady = Promise.all(["600 30px Nunito", "700 30px Nunito", "800 30px Nunito"].map((f) => document.fonts.load(f))).catch(() => undefined);
  }
  return fontsReady;
};

async function drawPoster(canvas: HTMLCanvasElement, mode: "SINGLE" | "DOUBLE", date: string, menus: MenuCardData[]) {
  const layout = LAYOUTS[mode];
  const [template, ...photos] = await Promise.all([
    loadImage(layout.src),
    ...menus.map((m) => (m.photo ? loadImage(m.photo).catch(() => null) : Promise.resolve(null))),
    ensureFonts(),
  ]);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = layout.width;
  canvas.height = layout.height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.drawImage(template as HTMLImageElement, 0, 0, layout.width, layout.height);

  if (date) {
    ctx.save();
    ctx.fillStyle = "#ffffff";
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
    if (photo) drawTrayPhoto(ctx, layout.trays[i], photo);
    drawNote(ctx, box, menu.items);
    drawNutrition(ctx, layout.nutrition[i].large, menu.largePortion);
    drawNutrition(ctx, layout.nutrition[i].small, menu.smallPortion);
  });
}

// ---------------------------------------------------------------------------------------------

interface MenuPrintModuleProps {
  onNavigate?: (tab: string) => void;
}

const MENU_LABELS = {SINGLE: ["Menu"], DOUBLE: ["Menu sekolah", "Menu 3B"]} as const;

export const MenuPrintModule: React.FC<MenuPrintModuleProps> = ({onNavigate}) => {
  const toast = useToast();
  const [menuOrders, setMenuOrders] = useState<MenuOrder[]>(() => warehouseDb.getMenuOrders());
  const [printMode, setPrintMode] = useState<"SINGLE" | "DOUBLE">("SINGLE");
  const [selectedDate, setSelectedDate] = useState<string>(() => localDateIso());
  const [menus, setMenus] = useState<MenuCardData[]>(() => [emptyMenu(), emptyMenu()]);
  const [activeMenu, setActiveMenu] = useState(0);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<"jpg" | "png" | null>(null);
  const [renderError, setRenderError] = useState("");
  const [showWhatsAppPaste, setShowWhatsAppPaste] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState("");
  const [pasteResult, setPasteResult] = useState("");
  const [filledFromOrderId, setFilledFromOrderId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoFilledRef = useRef(false);

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

  const visibleMenus = printMode === "SINGLE" ? menus.slice(0, 1) : menus;
  const editingIndex = printMode === "SINGLE" ? 0 : activeMenu;
  const current = menus[editingIndex];

  const updateMenu = (index: number, patch: Partial<MenuCardData>) =>
    setMenus((prev) => prev.map((m, i) => (i === index ? {...m, ...patch} : m)));

  const updateNutrition = (index: number, portion: "largePortion" | "smallPortion", key: keyof NutritionValues, value: string) =>
    setMenus((prev) => prev.map((m, i) => (i === index ? {...m, [portion]: {...m[portion], [key]: value.replace(/[^\d.,]/g, "")}} : m)));

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

  // Saat halaman dibuka, isi dari rencana menu hari ini bila ada (sekali saja, agar ketikan tidak tertimpa)
  useEffect(() => {
    if (autoFilledRef.current || !orderForDate) return;
    autoFilledRef.current = true;
    fillFromOrder(orderForDate);
  }, [orderForDate, fillFromOrder]);

  // Gambar ulang pratinjau setiap ada perubahan; permintaan yang tertinggal diabaikan.
  const drawSeq = useRef(0);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const seq = ++drawSeq.current;
    const frame = requestAnimationFrame(() => {
      if (seq !== drawSeq.current) return;
      drawPoster(canvas, printMode, selectedDate, visibleMenus)
        .then(() => setRenderError(""))
        .catch(() => setRenderError("Template poster gagal dimuat. Muat ulang halaman lalu coba lagi."));
    });
    return () => cancelAnimationFrame(frame);
    // visibleMenus berubah identitas setiap render; menus dan printMode sudah mewakilinya
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printMode, selectedDate, menus]);

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
      updateMenu(index, {photo: result.dataUrl});
    } catch {
      toast.error("Foto gagal dibaca. Coba foto lain dengan format JPG atau PNG.", "Foto nampan");
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleDownload = async (format: "jpg" | "png") => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDownloading(format);
    try {
      // Pastikan kanvas memuat isian terakhir sebelum diekspor
      await drawPoster(canvas, printMode, selectedDate, visibleMenus);
      const dataUrl = canvas.toDataURL(format === "jpg" ? "image/jpeg" : "image/png", 0.95);
      const link = document.createElement("a");
      link.download = `Poster-Menu-MBG-${selectedDate}-${printMode === "SINGLE" ? "1-menu" : "2-menu"}.${format}`;
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
        await drawPoster(canvas, printMode, selectedDate, visibleMenus);
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

            <div>
              <label htmlFor="poster-date" className={FIELD_LABEL}>
                Tanggal menu
              </label>
              <input id="poster-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className={`${FIELD_INPUT} sm:max-w-[220px] font-mono`} />
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
                  Belum ada rencana menu untuk tanggal ini.{" "}
                  {onNavigate && (
                    <button type="button" onClick={() => onNavigate("menu_orders")} className="font-semibold text-emerald-800 underline cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600">
                      Buka Order Menu
                    </button>
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
              </div>

              <div>
                <span className={FIELD_LABEL}>Foto nampan</span>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
                    {current.photo ? (
                      <img src={current.photo} alt="Foto nampan yang dipakai" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[11px] text-slate-600 text-center leading-tight px-1">Foto contoh</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingIndex !== null} className={`${BTN_SECONDARY} disabled:opacity-50`}>
                      {uploadingIndex === editingIndex ? "Memproses foto..." : current.photo ? "Ganti foto" : "Unggah foto"}
                    </button>
                    {current.photo && (
                      <button type="button" onClick={() => updateMenu(editingIndex, {photo: null})} className={BTN_SECONDARY}>
                        Pakai foto contoh
                      </button>
                    )}
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" tabIndex={-1} aria-hidden="true" />
                </div>
                <p className="mt-1 text-[11px] text-slate-600">Foto diambil dari atas, nampan tegak memanjang. Foto menutupi nampan contoh di template.</p>
              </div>

              <div>
                <span className={FIELD_LABEL}>Nilai gizi</span>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr>
                        <th scope="col" className="text-left font-semibold px-3 py-2">
                          Zat gizi
                        </th>
                        <th scope="col" className="text-left font-semibold px-2 py-2">
                          Porsi besar
                        </th>
                        <th scope="col" className="text-left font-semibold px-2 py-2">
                          Porsi kecil
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {NUTRITION_ROWS.map((row) => (
                        <tr key={row.key}>
                          <th scope="row" className="text-left font-medium text-slate-700 px-3 py-1.5 sm:whitespace-nowrap">
                            {row.label} <span className="font-normal text-slate-600">({row.unit})</span>
                          </th>
                          {(["largePortion", "smallPortion"] as const).map((portion) => (
                            <td key={portion} className="px-2 py-1.5">
                              <input
                                type="text"
                                inputMode="decimal"
                                value={current[portion][row.key]}
                                onChange={(e) => updateNutrition(editingIndex, portion, row.key, e.target.value)}
                                aria-label={`${row.label} ${portion === "largePortion" ? "porsi besar" : "porsi kecil"} (${row.unit})`}
                                placeholder="0"
                                className={`${FIELD_INPUT} font-mono tabular-nums text-right`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">Pakai koma untuk desimal, misalnya 763,1.</p>
              </div>
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
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Pratinjau poster menu ${formatPosterDate(selectedDate)}`}
            className="poster-canvas block w-full h-auto rounded-lg border border-slate-200 bg-slate-50"
            style={{aspectRatio: `${LAYOUTS[printMode].width} / ${LAYOUTS[printMode].height}`}}
          />
        </section>
      </div>
    </div>
  );
};
