import React, {useState, useMemo} from "react";
import {useAuth} from "../context/AuthContext";
import {warehouseDb} from "../db/storage";
import {MenuOrder} from "../types/warehouse";
import {compressImageToWebP} from "../utils/imageCompressor";
import {
  Printer,
  Upload,
  Calendar,
  Utensils,
  UtensilsCrossed,
  RefreshCw,
  Check,
  Image as ImageIcon,
  Eye,
  Download,
  CheckCircle2,
  Sparkles,
  Maximize2,
  Rows,
  Columns,
  X,
} from "lucide-react";

// Authentic Official Canva Posters (Cleaned for Seamless Dynamic Rendering)
import templateMenuSingleClean from "../assets/poster-single.jpg";
import templateMenuDoubleClean from "../assets/poster-double.jpg";
import traySample1 from "../assets/tray_sample_1.jpg";
import trayDouble1 from "../assets/tray_double_1.jpg";
import trayDouble2 from "../assets/tray_double_2.jpg";

interface NutritionValues {
  energy: string; // kkal
  protein: string; // gr
  fat: string; // gr
  carb: string; // gr
  fiber: string; // gr
}

interface MenuCardData {
  noteTitle: string;
  items: string[];
  image: string;
  largePortion: NutritionValues;
  smallPortion: NutritionValues;
  largePortionText?: string;
  smallPortionText?: string;
}

// Format 5 baris nilai gizi untuk ditampilkan di textarea
function formatNutritionLines(n: NutritionValues): string {
  return [
    `Energi : ${n.energy || "0"} kkal`,
    `Protein : ${n.protein || "0"} gr`,
    `Lemak : ${n.fat || "0"} gr`,
    `Karbohidrat : ${n.carb || "0"} gr`,
    `Serat : ${n.fiber || "0"} gr`,
  ].join("\n");
}

// Parser teks baris nilai gizi (mendukung format WhatsApp maupun hanya angka per baris)
function parseNutritionText(text: string): NutritionValues {
  const result: NutritionValues = {
    energy: "",
    protein: "",
    fat: "",
    carb: "",
    fiber: "",
  };

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

// Parser cerdas pesan siaran WhatsApp lengkap
interface ParsedWhatsAppMenu {
  date?: string;
  menu1Items?: string[];
  menu1Small?: NutritionValues;
  menu1Large?: NutritionValues;
  menu2Title?: string;
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
      kecilText: kecilLines.join("\n"),
      besarText: besarLines.join("\n"),
    };
  };

  const p1 = parseSection(section1Text);
  if (p1.items.length > 0) result.menu1Items = p1.items;
  result.menu1Small = p1.small;
  result.menu1Large = p1.large;

  if (result.hasMenu2 && section2Text) {
    const p2 = parseSection(section2Text);
    result.menu2Title = "Menu 3B";
    if (p2.items.length > 0) result.menu2Items = p2.items;
    result.menu2Small = p2.small;
    result.menu2Large = p2.large;
  }

  return result;
}

// Format tanggal standar Indonesia: "Rabu, 23-09-2026"
function formatPosterDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const d = new Date(dateStr + "T00:00:00");
    const dayName = days[d.getDay()] || "";
    const [y, m, day] = dateStr.split("-");
    return `${dayName}, ${day}-${m}-${y}`;
  } catch {
    return dateStr;
  }
}

interface MenuPrintModuleProps {
  onNavigate?: (tab: string) => void;
}

export const MenuPrintModule: React.FC<MenuPrintModuleProps> = ({onNavigate}) => {
  useAuth();
  const [printMode, setPrintMode] = useState<"SINGLE" | "DOUBLE">("SINGLE");
  const [selectedDate, setSelectedDate] = useState<string>("2026-09-28");

  // Existing menu orders from database
  const [menuOrders] = useState<MenuOrder[]>(() => warehouseDb.getMenuOrders());

  // Menu 1 Data (Mode 1 Menu Standar / Sekolah)
  const [menu1, setMenu1] = useState<MenuCardData>({
    noteTitle: "Menu Makanan",
    items: ["nasi putih", "Ayam kungpao", "Tahu walik", "tumis labu siam+jagung"],
    image: traySample1,
    largePortion: {
      energy: "763,1",
      protein: "20,9",
      fat: "21,3",
      carb: "101,5",
      fiber: "4,8",
    },
    smallPortion: {
      energy: "554,2",
      protein: "17,3",
      fat: "18,2",
      carb: "79",
      fiber: "4",
    },
  });

  // Menu 2 Data (Mode 2 Menu - Menu Alternatif / Kelas 3B)
  const [menu2, setMenu2] = useState<MenuCardData>({
    noteTitle: "Menu 3B",
    items: ["nasi putih", "Ayam kecap", "Tahu isi sayur", "tumis labu siam+jagung"],
    image: trayDouble2,
    largePortion: {
      energy: "774,8",
      protein: "21,3",
      fat: "22,1",
      carb: "103,9",
      fiber: "5",
    },
    smallPortion: {
      energy: "559,7",
      protein: "18,2",
      fat: "19,1",
      carb: "79,8",
      fiber: "4,2",
    },
  });

  const [activeMenuEditor, setActiveMenuEditor] = useState<"MENU1" | "MENU2">("MENU1");
  const [isUploading1, setIsUploading1] = useState(false);
  const [isUploading2, setIsUploading2] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewLayout, setPreviewLayout] = useState<"WIDE" | "SPLIT">("WIDE");
  const [previewZoom, setPreviewZoom] = useState<100 | 125 | 150>(100);
  const [isModalPreviewOpen, setIsModalPreviewOpen] = useState(false);

  // Quick WhatsApp text broadcast parser
  const [showWhatsAppPaste, setShowWhatsAppPaste] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState("");
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // Handle parsing full WhatsApp text broadcast
  const handleApplyWhatsAppText = () => {
    if (!whatsAppText.trim()) return;
    const parsed = parseFullWhatsAppMenu(whatsAppText);

    if (parsed.date) {
      setSelectedDate(parsed.date);
    }

    if (parsed.menu1Items && parsed.menu1Items.length > 0) {
      setMenu1((prev) => ({
        ...prev,
        items: parsed.menu1Items || prev.items,
        largePortion: parsed.menu1Large || prev.largePortion,
        smallPortion: parsed.menu1Small || prev.smallPortion,
        largePortionText: parsed.menu1Large ? formatNutritionLines(parsed.menu1Large) : prev.largePortionText,
        smallPortionText: parsed.menu1Small ? formatNutritionLines(parsed.menu1Small) : prev.smallPortionText,
      }));
    }

    if (parsed.hasMenu2) {
      setMenu2((prev) => ({
        ...prev,
        noteTitle: parsed.menu2Title || "Menu 3B",
        items: parsed.menu2Items || prev.items,
        largePortion: parsed.menu2Large || prev.largePortion,
        smallPortion: parsed.menu2Small || prev.smallPortion,
        largePortionText: parsed.menu2Large ? formatNutritionLines(parsed.menu2Large) : prev.largePortionText,
        smallPortionText: parsed.menu2Small ? formatNutritionLines(parsed.menu2Small) : prev.smallPortionText,
      }));
      setPrintMode("DOUBLE");
    }

    setPasteSuccess(true);
    setTimeout(() => {
      setPasteSuccess(false);
      setShowWhatsAppPaste(false);
    }, 1200);
  };

  // Load menu dari order tersimpan sesuai tanggal
  const existingOrderForDate = useMemo(() => {
    return menuOrders.find((o) => o.date === selectedDate);
  }, [menuOrders, selectedDate]);

  // Handle Auto-fill from Order Menu
  const handleAutoFillFromOrder = (order: MenuOrder) => {
    if (!order) return;
    const rawItems = order.menuTitle
      ? order.menuTitle
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const itemsToSet = rawItems.length > 0 ? rawItems : menu1.items;

    setMenu1((prev) => ({
      ...prev,
      items: itemsToSet,
    }));
  };

  // Image upload handler with compression
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "MENU1" | "MENU2") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (target === "MENU1") setIsUploading1(true);
    else setIsUploading2(true);

    try {
      const result = await compressImageToWebP(file, {maxDimension: 1200, quality: 0.85});
      if (target === "MENU1") {
        setMenu1((prev) => ({...prev, image: result.dataUrl}));
      } else {
        setMenu2((prev) => ({...prev, image: result.dataUrl}));
      }
    } catch (err) {
      console.error("Gagal mengompresi gambar:", err);
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          if (target === "MENU1") {
            setMenu1((prev) => ({...prev, image: reader.result as string}));
          } else {
            setMenu2((prev) => ({...prev, image: reader.result as string}));
          }
        }
      };
      reader.readAsDataURL(file);
    } finally {
      if (target === "MENU1") setIsUploading1(false);
      else setIsUploading2(false);
    }
  };

  // Switch ke preset Double Mode
  const handleSetPresetDouble = () => {
    setPrintMode("DOUBLE");
    setSelectedDate("2026-09-25");
    setMenu1({
      noteTitle: "Menu Sekolah",
      items: ["Nasi Putih", "Ayam Woku", "Tempe Goreng", "Steam Buncis+Wortel", "Kelengkeng"],
      image: trayDouble1,
      largePortion: {
        energy: "749,2",
        protein: "19",
        fat: "18,8",
        carb: "111,2",
        fiber: "4,8",
      },
      smallPortion: {
        energy: "554,2",
        protein: "18,1",
        fat: "17,7",
        carb: "79,8",
        fiber: "3,8",
      },
    });
    setMenu2({
      noteTitle: "Menu 3B",
      items: ["Nasi Putih", "Honey Garlic Chicken", "Tempe Goreng", "Sup Labu Siam+Buncis+Jagung", "Kelengkeng"],
      image: trayDouble2,
      largePortion: {
        energy: "751,3",
        protein: "19,1",
        fat: "19,3",
        carb: "113,8",
        fiber: "5",
      },
      smallPortion: {
        energy: "559,3",
        protein: "18,8",
        fat: "18,2",
        carb: "81,1",
        fiber: "4",
      },
    });
  };

  // Switch ke preset Single Mode
  const handleSetPresetSingle = () => {
    setPrintMode("SINGLE");
    setSelectedDate("2026-09-23");
    setMenu1({
      noteTitle: "Menu Makanan",
      items: ["nasi putih", "ayam katsu", "saus curry (kentang+wortel)", "tahu goreng", "buah kelengkeng"],
      image: traySample1,
      largePortion: {
        energy: "748,5",
        protein: "19,1",
        fat: "21,2",
        carb: "110,7",
        fiber: "4,4",
      },
      smallPortion: {
        energy: "588",
        protein: "19,2",
        fat: "17,9",
        carb: "79,3",
        fiber: "3,8",
      },
    });
  };

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Export ke High-Resolution JPG / PNG langsung dari Canvas
  const handleDownloadImage = async (format: "jpg" | "png") => {
    setIsDownloading(true);
    try {
      const isSingle = printMode === "SINGLE";
      const canvas = document.createElement("canvas");
      canvas.width = isSingle ? 1587 : 2245;
      canvas.height = isSingle ? 2245 : 1587;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Fill white background (penting untuk format JPG agar tidak hitam)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 1. Draw Base Template Image
      const templateImg = new Image();
      templateImg.crossOrigin = "anonymous";
      templateImg.src = isSingle ? templateMenuSingleClean : templateMenuDoubleClean;
      await new Promise((res, rej) => {
        templateImg.onload = res;
        templateImg.onerror = rej;
      });
      ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

      // 2. Draw Dynamic Date on Pill
      ctx.save();
      ctx.fillStyle = "#ffffff";
      ctx.font = isSingle ? "800 44px Nunito, system-ui, sans-serif" : "800 34px Nunito, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (isSingle) {
        ctx.fillText(formatPosterDate(selectedDate), 793, 615);
      } else {
        ctx.fillText(formatPosterDate(selectedDate), 1082, 371);
      }
      ctx.restore();

      // 3. Draw Dynamic Elements
      if (isSingle) {
        // Overlay user food photo inside tray if custom uploaded
        if (menu1.image && menu1.image !== traySample1) {
          try {
            const userFoodImg = new Image();
            userFoodImg.crossOrigin = "anonymous";
            userFoodImg.src = menu1.image;
            await new Promise((r) => {
              userFoodImg.onload = r;
              userFoodImg.onerror = r;
            });

            ctx.save();
            ctx.translate(1045, 1120);
            ctx.rotate((28.5 * Math.PI) / 180);

            // Tray metallic border & shadow
            ctx.beginPath();
            ctx.roundRect(-290, -380, 580, 760, 48);
            ctx.fillStyle = "#cbd5e1";
            ctx.fill();
            ctx.lineWidth = 8;
            ctx.strokeStyle = "#94a3b8";
            ctx.stroke();

            // Image inside tray
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(-278, -368, 556, 736, 40);
            ctx.clip();
            ctx.drawImage(userFoodImg, -278, -368, 556, 736);
            ctx.restore();

            ctx.restore();
          } catch (e) {
            console.warn("Tray photo render error", e);
          }
        }

        // Draw Torn Note text (slanted -16.0 degrees matching 'Menu Makanan')
        ctx.save();
        ctx.translate(225, 830);
        ctx.rotate((-16.0 * Math.PI) / 180);

        // Bullet items (ukuran diperbesar dan jelas)
        ctx.fillStyle = "#2a2830";
        ctx.font = "600 34px Nunito, system-ui, sans-serif";
        let startY = 60;
        menu1.items.forEach((it) => {
          ctx.fillText("•", 10, startY);
          ctx.fillText(it, 40, startY);
          startY += 48;
        });
        ctx.restore();

        // Draw Nutrition Table values (titles and dividers already on template)
        ctx.save();
        ctx.font = "600 37px Nunito, system-ui, sans-serif";
        ctx.fillStyle = "#38353d";

        // Porsi Besar column
        ctx.fillText(`Energi : ${menu1.largePortion.energy} kkal`, 360, 1785);
        ctx.fillText(`Protein : ${menu1.largePortion.protein} gr`, 360, 1843);
        ctx.fillText(`Lemak : ${menu1.largePortion.fat} gr`, 360, 1901);
        ctx.fillText(`Karbohidrat : ${menu1.largePortion.carb} gr`, 360, 1959);
        ctx.fillText(`Serat : ${menu1.largePortion.fiber} gr`, 360, 2017);

        // Porsi Kecil column
        ctx.fillText(`Energi : ${menu1.smallPortion.energy} kkal`, 830, 1785);
        ctx.fillText(`Protein : ${menu1.smallPortion.protein} gr`, 830, 1843);
        ctx.fillText(`Lemak : ${menu1.smallPortion.fat} gr`, 830, 1901);
        ctx.fillText(`Karbohidrat : ${menu1.smallPortion.carb} gr`, 830, 1959);
        ctx.fillText(`Serat : ${menu1.smallPortion.fiber} gr`, 830, 2017);
        ctx.restore();
      } else {
        // DOUBLE MODE (Ukuran teks diperbesar agar tidak kekecilan saat diekspor)
        // Menu 1 Note (Sekolah - slanted -10.7 degrees)
        ctx.save();
        ctx.translate(140, 615);
        ctx.rotate((-10.7 * Math.PI) / 180);
        ctx.fillStyle = "#2a2830";
        ctx.font = "600 34px Nunito, system-ui, sans-serif";
        let y1 = 40;
        menu1.items.forEach((it) => {
          ctx.fillText("•", 0, y1);
          ctx.fillText(it, 26, y1);
          y1 += 44;
        });
        ctx.restore();

        // Menu 1 Nutrition (values only, titles on template)
        ctx.save();
        ctx.font = "600 30px Nunito, system-ui, sans-serif";
        ctx.fillStyle = "#38353d";
        ctx.fillText(`Energi : ${menu1.largePortion.energy} kkal`, 372, 1276);
        ctx.fillText(`Protein : ${menu1.largePortion.protein} g`, 372, 1320);
        ctx.fillText(`Lemak : ${menu1.largePortion.fat} g`, 372, 1364);
        ctx.fillText(`Karbohidrat : ${menu1.largePortion.carb} g`, 372, 1408);
        ctx.fillText(`Serat : ${menu1.largePortion.fiber} g`, 372, 1452);

        ctx.fillText(`Energi : ${menu1.smallPortion.energy} kkal`, 804, 1276);
        ctx.fillText(`Protein : ${menu1.smallPortion.protein} g`, 804, 1320);
        ctx.fillText(`Lemak : ${menu1.smallPortion.fat} g`, 804, 1364);
        ctx.fillText(`Karbohidrat : ${menu1.smallPortion.carb} g`, 804, 1408);
        ctx.fillText(`Serat : ${menu1.smallPortion.fiber} g`, 804, 1452);
        ctx.restore();

        // Menu 2 Note (3B - slanted -13.8 degrees)
        ctx.save();
        ctx.translate(1245, 600);
        ctx.rotate((-13.8 * Math.PI) / 180);
        ctx.fillStyle = "#2a2830";
        ctx.font = "600 34px Nunito, system-ui, sans-serif";
        let y2 = 40;
        menu2.items.forEach((it) => {
          ctx.fillText("•", 0, y2);
          ctx.fillText(it, 26, y2);
          y2 += 44;
        });
        ctx.restore();

        // Menu 2 Nutrition
        ctx.save();
        ctx.font = "600 30px Nunito, system-ui, sans-serif";
        ctx.fillStyle = "#38353d";
        ctx.fillText(`Energi : ${menu2.largePortion.energy} kkal`, 1198, 1276);
        ctx.fillText(`Protein : ${menu2.largePortion.protein} g`, 1198, 1320);
        ctx.fillText(`Lemak : ${menu2.largePortion.fat} g`, 1198, 1364);
        ctx.fillText(`Karbohidrat : ${menu2.largePortion.carb} g`, 1198, 1408);
        ctx.fillText(`Serat : ${menu2.largePortion.fiber} g`, 1198, 1452);

        ctx.fillText(`Energi : ${menu2.smallPortion.energy} kkal`, 1630, 1276);
        ctx.fillText(`Protein : ${menu2.smallPortion.protein} g`, 1630, 1320);
        ctx.fillText(`Lemak : ${menu2.smallPortion.fat} g`, 1630, 1364);
        ctx.fillText(`Karbohidrat : ${menu2.smallPortion.carb} g`, 1630, 1408);
        ctx.fillText(`Serat : ${menu2.smallPortion.fiber} g`, 1630, 1452);
        ctx.restore();
      }

      // Download
      const mimeType = format === "jpg" ? "image/jpeg" : "image/png";
      const ext = format === "jpg" ? "jpg" : "png";
      const dataUrl = canvas.toDataURL(mimeType, 0.95);
      const link = document.createElement("a");
      link.download = `Poster-Menu-MBG-${selectedDate}-${isSingle ? "1-Menu" : "2-Menu"}.${ext}`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(`Download ${format.toUpperCase()} failed`, err);
      alert(`Gagal mendownload gambar ${format.toUpperCase()}, silakan gunakan tombol Cetak / Simpan PDF.`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPng = () => handleDownloadImage("png");
  const handleDownloadJpg = () => handleDownloadImage("jpg");

  // Render poster element with container query scaling matching Canvas export 1:1
  const renderPosterElement = (isModal = false) => {
    const isSingle = printMode === "SINGLE";

    let maxWidthStyle = "960px";
    if (isSingle) {
      if (isModal) {
        maxWidthStyle = previewZoom === 150 ? "920px" : previewZoom === 125 ? "800px" : "700px";
      } else if (previewLayout === "WIDE") {
        maxWidthStyle = previewZoom === 150 ? "880px" : previewZoom === 125 ? "760px" : "660px";
      } else {
        maxWidthStyle = previewZoom === 150 ? "760px" : previewZoom === 125 ? "680px" : "600px";
      }
    } else {
      if (isModal) {
        maxWidthStyle = previewZoom === 150 ? "1480px" : previewZoom === 125 ? "1280px" : "1100px";
      } else if (previewLayout === "WIDE") {
        maxWidthStyle = previewZoom === 150 ? "1380px" : previewZoom === 125 ? "1200px" : "1040px";
      } else {
        maxWidthStyle = previewZoom === 150 ? "1100px" : previewZoom === 125 ? "960px" : "860px";
      }
    }

    if (isSingle) {
      return (
        <div
          id="printable-poster-single"
          className="poster-printable relative bg-white text-slate-800 mx-auto shadow-2xl rounded-2xl border border-slate-300 select-none transition-all duration-200"
          style={{
            width: "100%",
            maxWidth: maxWidthStyle,
            aspectRatio: "1587 / 2245",
            fontFamily: "'Nunito', 'Segoe UI', sans-serif",
            containerType: "inline-size",
          }}>
          {/* The Authentic Cleaned Template Background */}
          <img src={templateMenuSingleClean} alt="Template Cetak Menu MBG SPPG" className="absolute inset-0 w-full h-full object-fill pointer-events-none" />

          {/* 1. Dynamic Date Pill Overlay */}
          <div
            className="absolute flex items-center justify-center text-center select-none"
            style={{
              left: "25.7%",
              top: "24.6%",
              width: "48.5%",
              height: "5.5%",
            }}>
            <span className="text-white leading-none font-extrabold" style={{fontFamily: "'Nunito', sans-serif", fontSize: "clamp(11px, 3.5cqi, 26px)"}}>
              {formatPosterDate(selectedDate)}
            </span>
          </div>

          {/* 2. Dynamic Torn Paper Note Overlay */}
          <div
            className="absolute flex flex-col justify-start select-none"
            style={{
              left: "10.5%",
              top: "40.5%",
              width: "32%",
              height: "21%",
              transform: "rotate(-16deg)",
              transformOrigin: "top left",
              fontFamily: "'Nunito', sans-serif",
              padding: "2px 0px",
            }}>
            {menu1.noteTitle && menu1.noteTitle !== "Menu Makanan" && (
              <div className="text-[#2a2830] pb-1 mb-1 font-extrabold" style={{fontSize: "clamp(9px, 1.9cqi, 15px)", lineHeight: 1.15, borderBottom: "1.5px dashed #c8b89a"}}>
                {menu1.noteTitle}
              </div>
            )}
            <ul className="text-[#2a2830]" style={{margin: 0, padding: 0, listStyle: "none"}}>
              {menu1.items.map((it, idx) => (
                <li
                  key={idx}
                  className="flex items-start"
                  style={{
                    fontSize: "clamp(10.5px, 3cqi, 18px)",
                    fontWeight: 600,
                    lineHeight: 1.48,
                    marginBottom: "0.08em",
                    gap: "0.3em",
                    whiteSpace: "nowrap",
                  }}>
                  <span style={{fontWeight: 900, flexShrink: 0}}>•</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Dynamic Food Tray Overlay */}
          {menu1.image && menu1.image !== traySample1 && (
            <div
              className="absolute flex items-center justify-center select-none pointer-events-none"
              style={{
                left: "47.5%",
                top: "33%",
                width: "36.5%",
                height: "34%",
                transform: "rotate(28.5deg)",
              }}>
              <div className="w-full h-full rounded-2xl bg-slate-300 p-1 shadow-2xl ring-2 ring-slate-400/50 overflow-hidden">
                <img src={menu1.image} alt="Foto Nampan Menu" className="w-full h-full object-cover rounded-xl" />
              </div>
            </div>
          )}

          {/* 4. Dynamic Nutrition Table Overlay */}
          <div
            className="absolute flex items-start select-none"
            style={{
              left: "22.6%",
              top: "77.2%",
              width: "55%",
              height: "15%",
              fontFamily: "'Nunito', sans-serif",
            }}>
            <div className="w-full grid grid-cols-2" style={{columnGap: "10%"}}>
              {/* Porsi Besar Values */}
              <div style={{fontSize: "clamp(10.5px, 2.33cqi, 20px)", fontWeight: 600, lineHeight: 1.6, color: "#3a3840", whiteSpace: "nowrap"}}>
                <div>
                  Energi : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.largePortion.energy} kkal</strong>
                </div>
                <div>
                  Protein : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.largePortion.protein} gr</strong>
                </div>
                <div>
                  Lemak : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.largePortion.fat} gr</strong>
                </div>
                <div>
                  Karbohidrat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.largePortion.carb} gr</strong>
                </div>
                <div>
                  Serat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.largePortion.fiber} gr</strong>
                </div>
              </div>

              {/* Porsi Kecil Values */}
              <div style={{fontSize: "clamp(10.5px, 2.33cqi, 20px)", fontWeight: 600, lineHeight: 1.6, color: "#3a3840", whiteSpace: "nowrap"}}>
                <div>
                  Energi : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.smallPortion.energy} kkal</strong>
                </div>
                <div>
                  Protein : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.smallPortion.protein} gr</strong>
                </div>
                <div>
                  Lemak : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.smallPortion.fat} gr</strong>
                </div>
                <div>
                  Karbohidrat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.smallPortion.carb} gr</strong>
                </div>
                <div>
                  Serat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.smallPortion.fiber} gr</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // DOUBLE MENU POSTER
    return (
      <div
        id="printable-poster-double"
        className="poster-printable relative bg-white text-slate-800 mx-auto shadow-2xl rounded-2xl border border-slate-300 select-none transition-all duration-200"
        style={{
          width: "100%",
          maxWidth: maxWidthStyle,
          aspectRatio: "2245 / 1587",
          fontFamily: "'Nunito', 'Segoe UI', sans-serif",
          containerType: "inline-size",
        }}>
        {/* The Authentic Cleaned Double Template Background */}
        <img src={templateMenuDoubleClean} alt="Template Cetak Menu MBG SPPG (2 Menu)" className="absolute inset-0 w-full h-full object-fill pointer-events-none" />

        {/* 1. Dynamic Date Pill Overlay */}
        <div
          className="absolute flex items-center justify-center text-center select-none"
          style={{
            left: "35.9%",
            top: "20.9%",
            width: "24.6%",
            height: "5.4%",
          }}>
          <span className="text-white leading-none font-extrabold" style={{fontFamily: "'Nunito', sans-serif", fontSize: "clamp(9.5px, 2cqi, 24px)"}}>
            {formatPosterDate(selectedDate)}
          </span>
        </div>

        {/* 2. Menu 1 (Sekolah) Note Overlay */}
        <div
          className="absolute flex flex-col justify-start select-none"
          style={{
            left: "5.5%",
            top: "43.5%",
            width: "18.5%",
            height: "22%",
            transform: "rotate(-14.7deg)",
            transformOrigin: "top left",
            fontFamily: "'Nunito', sans-serif",
            padding: "2px 0px",
          }}>
          {menu1.noteTitle && menu1.noteTitle !== "Menu Sekolah" && (
            <div className="text-[#2a2830] pb-0.5 mb-1 font-extrabold" style={{fontSize: "clamp(8px, 1.45cqi, 11px)", lineHeight: 1.2, borderBottom: "1px dashed #c8b89a"}}>
              {menu1.noteTitle}
            </div>
          )}
          <ul style={{margin: 0, padding: 0, listStyle: "none"}}>
            {menu1.items.map((it, idx) => (
              <li
                key={idx}
                className="flex items-start"
                style={{
                  color: "#2a2830",
                  fontSize: "clamp(9.5px, 1.51cqi, 16px)",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  gap: "0.25em",
                  marginBottom: "0.04em",
                  whiteSpace: "nowrap",
                }}>
                <span style={{fontWeight: 900, flexShrink: 0}}>•</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 3. Menu 1 Food Tray Overlay (Only if custom uploaded) */}
        {menu1.image && menu1.image !== trayDouble1 && (
          <div
            className="absolute flex items-center justify-center select-none pointer-events-none"
            style={{
              left: "19.5%",
              top: "44%",
              width: "24.5%",
              height: "52%",
              transform: "rotate(26deg)",
            }}>
            <div className="w-full h-full rounded-2xl bg-slate-300 p-1 shadow-2xl ring-1 ring-slate-400/50 overflow-hidden">
              <img src={menu1.image} alt="Foto Nampan Menu 1" className="w-full h-full object-cover rounded-xl" />
            </div>
          </div>
        )}

        {/* 4a. Menu 1 Nutrition Table: Porsi Besar (Aligned with template header at 16.5%) */}
        <div
          className="absolute flex flex-col items-start select-none"
          style={{
            left: "16.5%",
            top: "78.2%",
            width: "16.5%",
            height: "15%",
            fontFamily: "'Nunito', sans-serif",
            fontSize: "clamp(9px, 1.34cqi, 16px)",
            fontWeight: 600,
            lineHeight: 1.55,
            color: "#3a3840",
            whiteSpace: "nowrap",
          }}>
          <div>
            Energi : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.largePortion.energy} kkal</strong>
          </div>
          <div>
            Protein : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.largePortion.protein} g</strong>
          </div>
          <div>
            Lemak : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.largePortion.fat} g</strong>
          </div>
          <div>
            Karbohidrat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.largePortion.carb} g</strong>
          </div>
          <div>
            Serat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.largePortion.fiber} g</strong>
          </div>
        </div>

        {/* 4b. Menu 1 Nutrition Table: Porsi Kecil (Aligned with template header at 35.8%) */}
        <div
          className="absolute flex flex-col items-start select-none"
          style={{
            left: "35.8%",
            top: "78.2%",
            width: "14%",
            height: "15%",
            fontFamily: "'Nunito', sans-serif",
            fontSize: "clamp(9px, 1.34cqi, 16px)",
            fontWeight: 600,
            lineHeight: 1.55,
            color: "#3a3840",
            whiteSpace: "nowrap",
          }}>
          <div>
            Energi : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.smallPortion.energy} kkal</strong>
          </div>
          <div>
            Protein : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.smallPortion.protein} g</strong>
          </div>
          <div>
            Lemak : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.smallPortion.fat} g</strong>
          </div>
          <div>
            Karbohidrat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.smallPortion.carb} g</strong>
          </div>
          <div>
            Serat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu1.smallPortion.fiber} g</strong>
          </div>
        </div>

        {/* 5. Menu 2 (3B) Note Overlay */}
        <div
          className="absolute flex flex-col justify-start select-none"
          style={{
            left: "54.8%",
            top: "41.5%",
            width: "18.5%",
            height: "22%",
            transform: "rotate(-13.8deg)",
            transformOrigin: "top left",
            fontFamily: "'Nunito', sans-serif",
            padding: "2px 0px",
          }}>
          {menu2.noteTitle && menu2.noteTitle !== "Menu 3B" && (
            <div className="text-[#2a2830] pb-0.5 mb-1 font-extrabold" style={{fontSize: "clamp(8px, 1.45cqi, 13px)", lineHeight: 1.2, borderBottom: "1px dashed #c8b89a"}}>
              {menu2.noteTitle}
            </div>
          )}
          <ul style={{margin: 0, padding: 0, listStyle: "none"}}>
            {menu2.items.map((it, idx) => (
              <li
                key={idx}
                className="flex items-start"
                style={{
                  color: "#2a2830",
                  fontSize: "clamp(9.5px, 1.51cqi, 16px)",
                  fontWeight: 600,
                  lineHeight: 1.4,
                  gap: "0.25em",
                  marginBottom: "0.04em",
                  whiteSpace: "nowrap",
                }}>
                <span style={{fontWeight: 900, flexShrink: 0}}>•</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 6. Menu 2 Food Tray Overlay (Only if custom uploaded) */}
        {menu2.image && menu2.image !== trayDouble2 && (
          <div
            className="absolute flex items-center justify-center select-none pointer-events-none"
            style={{
              left: "67.5%",
              top: "44%",
              width: "24.5%",
              height: "52%",
              transform: "rotate(26deg)",
            }}>
            <div className="w-full h-full rounded-2xl bg-slate-300 p-1 shadow-2xl ring-1 ring-slate-400/50 overflow-hidden">
              <img src={menu2.image} alt="Foto Nampan Menu 2" className="w-full h-full object-cover rounded-xl" />
            </div>
          </div>
        )}

        {/* 7a. Menu 2 Nutrition Table: Porsi Besar (Aligned with template header at 53.4%) */}
        <div
          className="absolute flex flex-col items-start select-none"
          style={{
            left: "53.4%",
            top: "78.2%",
            width: "16.5%",
            height: "15%",
            fontFamily: "'Nunito', sans-serif",
            fontSize: "clamp(9px, 1.34cqi, 16px)",
            fontWeight: 600,
            lineHeight: 1.55,
            color: "#3a3840",
            whiteSpace: "nowrap",
          }}>
          <div>
            Energi : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu2.largePortion.energy} kkal</strong>
          </div>
          <div>
            Protein : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu2.largePortion.protein} g</strong>
          </div>
          <div>
            Lemak : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu2.largePortion.fat} g</strong>
          </div>
          <div>
            Karbohidrat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu2.largePortion.carb} g</strong>
          </div>
          <div>
            Serat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu2.largePortion.fiber} g</strong>
          </div>
        </div>

        {/* 7b. Menu 2 Nutrition Table: Porsi Kecil (Aligned with template header at 72.6%) */}
        <div
          className="absolute flex flex-col items-start select-none"
          style={{
            left: "72.6%",
            top: "78.2%",
            width: "14%",
            height: "15%",
            fontFamily: "'Nunito', sans-serif",
            fontSize: "clamp(9px, 1.34cqi, 16px)",
            fontWeight: 600,
            lineHeight: 1.55,
            color: "#3a3840",
            whiteSpace: "nowrap",
          }}>
          <div>
            Energi : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu2.smallPortion.energy} kkal</strong>
          </div>
          <div>
            Protein : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu2.smallPortion.protein} g</strong>
          </div>
          <div>
            Lemak : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu2.smallPortion.fat} g</strong>
          </div>
          <div>
            Karbohidrat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu2.smallPortion.carb} g</strong>
          </div>
          <div>
            Serat : <strong style={{fontWeight: 700, color: "#1a1820"}}>{menu2.smallPortion.fiber} g</strong>
          </div>
        </div>
      </div>
    );
  };

  // Preview Card Header Toolbar
  const renderPreviewToolbar = () => (
    <div className="flex flex-wrap items-center justify-between gap-2.5 no-print px-1 pb-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-emerald-600" />
          <span>Pratinjau Hasil Cetak Poster Resmi</span>
        </span>
        <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-slate-100 text-slate-600 border border-slate-200">
          {printMode === "SINGLE" ? "1587 × 2245 px" : "2245 × 1587 px"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Toggle Layout Switcher */}
        <div className="inline-flex p-0.5 rounded-lg bg-slate-200/80 border border-slate-300">
          <button
            type="button"
            onClick={() => setPreviewLayout("WIDE")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer ${
              previewLayout === "WIDE" ? "bg-white text-emerald-800 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900 font-semibold"
            }`}
            title="Tampilan Penuh (Ukuran Besar)">
            <Rows className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pratinjau Besar</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewLayout("SPLIT")}
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-all cursor-pointer ${
              previewLayout === "SPLIT" ? "bg-white text-emerald-800 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900 font-semibold"
            }`}
            title="Tampilan Berdampingan (Form Kiri, Pratinjau Kanan)">
            <Columns className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Berdampingan</span>
          </button>
        </div>

        {/* Zoom Scale Controls */}
        <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
          <button
            type="button"
            onClick={() => setPreviewZoom(100)}
            className={`px-2 py-0.5 text-[11px] rounded transition-all cursor-pointer ${
              previewZoom === 100 ? "bg-white text-emerald-800 font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
            title="Ukuran Standar (100%)">
            100%
          </button>
          <button
            type="button"
            onClick={() => setPreviewZoom(125)}
            className={`px-2 py-0.5 text-[11px] rounded transition-all cursor-pointer ${
              previewZoom === 125 ? "bg-white text-emerald-800 font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
            title="Ukuran Besar (125%)">
            125%
          </button>
          <button
            type="button"
            onClick={() => setPreviewZoom(150)}
            className={`px-2 py-0.5 text-[11px] rounded transition-all cursor-pointer ${
              previewZoom === 150 ? "bg-white text-emerald-800 font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
            title="Ukuran Sangat Besar (150%)">
            150%
          </button>
        </div>

        {/* Modal Layar Penuh */}
        <button
          type="button"
          onClick={() => setIsModalPreviewOpen(true)}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
          title="Buka Pratinjau Layar Penuh Resolusi Tinggi">
          <Maximize2 className="w-3 h-3 text-slate-600" />
          <span className="hidden md:inline">Layar Penuh</span>
        </button>

        {/* Export Buttons */}
        <div className="flex items-center gap-1.5 pl-1 border-l border-slate-200">
          <button
            type="button"
            onClick={handleDownloadJpg}
            disabled={isDownloading}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg border border-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
            title="Download gambar resolusi tinggi format JPG">
            <Download className="w-3 h-3 text-emerald-800" />
            <span>JPG</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPng}
            disabled={isDownloading}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
            title="Download gambar resolusi tinggi format PNG">
            <Download className="w-3 h-3 text-slate-700" />
            <span>PNG</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer shadow-2xs"
            title="Cetak langsung ke printer atau simpan sebagai PDF A4">
            <Printer className="w-3 h-3" />
            <span>Cetak A4</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Form Editor Panel
  const renderFormEditor = () => {
    const isMenu1 = activeMenuEditor === "MENU1" || printMode === "SINGLE";
    const curMenu = isMenu1 ? menu1 : menu2;
    const setCurMenu = isMenu1 ? setMenu1 : setMenu2;
    const isUploading = isMenu1 ? isUploading1 : isUploading2;
    const targetTag = isMenu1 ? "MENU1" : "MENU2";

    const box1Content = (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tanggal Menu MBG</span>
          </span>
          <span className="text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">{formatPosterDate(selectedDate)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pilih Tanggal:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-semibold text-slate-800 bg-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pilih dari Order Tersimpan:</label>
            <select
              value={existingOrderForDate?.id || ""}
              onChange={(e) => {
                const found = menuOrders.find((o) => o.id === e.target.value);
                if (found) {
                  setSelectedDate(found.date);
                  handleAutoFillFromOrder(found);
                }
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800">
              <option value="">-- Muat Dari Order Menu --</option>
              {menuOrders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.date} - {ord.menuTitle.slice(0, 28)}...
                </option>
              ))}
            </select>
          </div>
        </div>

        {existingOrderForDate && (
          <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center justify-between gap-2">
            <div className="text-[11px] text-emerald-950">
              <div className="font-bold flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tersedia order menu tanggal ini:</span>
              </div>
              <div className="truncate font-medium text-emerald-900 mt-0.5 max-w-[240px]">{existingOrderForDate.menuTitle}</div>
            </div>
            <button
              type="button"
              onClick={() => handleAutoFillFromOrder(existingOrderForDate)}
              className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shrink-0 cursor-pointer shadow-2xs">
              Gunakan
            </button>
          </div>
        )}

        {/* Tombol Tempel Teks WhatsApp Lengkap */}
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Tempel Format WhatsApp (Ahli Gizi):</span>
            </div>
            <button type="button" onClick={() => setShowWhatsAppPaste((prev) => !prev)} className="text-[11px] text-emerald-700 font-semibold hover:underline cursor-pointer">
              {showWhatsAppPaste ? "Tutup" : "Tempel Pesan WA"}
            </button>
          </div>

          {showWhatsAppPaste && (
            <div className="space-y-2 pt-1">
              <textarea
                rows={6}
                value={whatsAppText}
                onChange={(e) => setWhatsAppText(e.target.value)}
                placeholder={`Tempel broadcast WhatsApp di sini, contoh:\nNILAI GIZI 28/09/26 Senin\nnasi putih\nAyam kungpao\nTahu walik\ntumis labu siam+jagung\n\n*Porsi Kecil*\nEnergi : 554,2 kkal\n...\n*Porsi Besar*\nEnergi : 763,1 kkal\n...`}
                className="w-full p-2 text-xs rounded-lg border border-slate-300 font-mono bg-white text-slate-800 leading-relaxed"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500">Otomatis mengisi tanggal, menu, dan nilai gizi Porsi Besar/Kecil</span>
                <button
                  type="button"
                  onClick={handleApplyWhatsAppText}
                  disabled={!whatsAppText.trim()}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 rounded-lg shadow-xs cursor-pointer flex items-center gap-1 shrink-0">
                  {pasteSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                      <span>Berhasil Diterapkan!</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Terapkan Otomatis</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );

    const box2Content = (
      <div className="space-y-4">
        {/* Tab Switcher jika Mode 2 Menu */}
        {printMode === "DOUBLE" && (
          <div className="flex items-center gap-2 p-1 bg-slate-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveMenuEditor("MENU1")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeMenuEditor === "MENU1" ? "bg-white text-emerald-800 font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}>
              Editor Menu 1 (Sekolah)
            </button>
            <button
              type="button"
              onClick={() => setActiveMenuEditor("MENU2")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeMenuEditor === "MENU2" ? "bg-white text-emerald-800 font-bold shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}>
              Editor Menu 2 (Alternatif/3B)
            </button>
          </div>
        )}

        {/* Box 2: Detail Menu yang Sedang Diedit */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Utensils className="w-3.5 h-3.5 text-emerald-600" />
              <span>{printMode === "SINGLE" ? "Detail Menu Makanan" : isMenu1 ? "Detail Menu 1 (Sekolah)" : "Detail Menu 2 (Alternatif / 3B)"}</span>
            </span>
          </div>

          {/* Judul Kertas Catatan */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Judul Kertas Catatan:</label>
            <input
              type="text"
              value={curMenu.noteTitle}
              onChange={(e) => setCurMenu((prev) => ({...prev, noteTitle: e.target.value}))}
              placeholder="Contoh: Menu Makanan / Menu Sekolah / Menu 3B"
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 font-semibold text-slate-800 bg-white"
            />
          </div>

          {/* Upload Foto Nampan Makanan */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                <span>Foto Nampan Makanan:</span>
              </label>
              {isUploading && <span className="text-[10px] text-emerald-700 animate-pulse font-semibold">Mengompresi...</span>}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-xl border border-slate-300 overflow-hidden bg-white shrink-0 relative shadow-2xs">
                <img src={curMenu.image} alt="Preview Nampan" className="w-full h-full object-cover" />
              </div>

              <div className="flex-1 space-y-1.5">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer shadow-2xs">
                  <Upload className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Upload Foto Nampan Baru</span>
                  <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, targetTag)} className="hidden" />
                </label>
                <div className="text-[10px] text-slate-400">Foto baru otomatis diletakkan pada posisi nampan stainless dengan sudut kemiringan presisi.</div>
              </div>
            </div>
          </div>

          {/* Butir Menu Makanan */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-600">Daftar Butir Menu (Satu per baris):</label>
              <span className="text-[10px] text-slate-400">{curMenu.items.length} Bahan / Lauk</span>
            </div>
            <textarea
              rows={5}
              value={curMenu.items.join("\n")}
              onChange={(e) => {
                const lines = e.target.value
                  .split("\n")
                  .map((l) => l.replace(/^[•\-\*\s]+/, "").trim())
                  .filter(Boolean);
                setCurMenu((prev) => ({...prev, items: lines}));
              }}
              placeholder="Contoh:&#10;nasi putih&#10;ayam katsu&#10;saus curry&#10;tahu goreng&#10;buah kelengkeng"
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 font-medium text-slate-800 bg-white font-mono leading-relaxed"
            />
          </div>

          {/* Editor Kandungan Gizi: Porsi Besar vs Porsi Kecil */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Kandungan Zat Gizi (Satu per baris):</span>
              </span>
              <span className="text-[10px] text-slate-400">Porsi Besar & Kecil</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {/* Textarea Porsi Besar */}
              <div className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-1.5">
                <div className="flex items-center justify-between pb-1 border-b border-amber-200/60">
                  <span className="font-bold text-amber-900 text-xs">Porsi Besar</span>
                  <span className="text-[10px] text-amber-700 font-mono">5 Nilai Gizi</span>
                </div>
                <textarea
                  rows={6}
                  value={curMenu.largePortionText ?? formatNutritionLines(curMenu.largePortion)}
                  onChange={(e) => {
                    const text = e.target.value;
                    const parsed = parseNutritionText(text);
                    setCurMenu((prev) => ({
                      ...prev,
                      largePortionText: text,
                      largePortion: {
                        energy: parsed.energy !== "" ? parsed.energy : prev.largePortion.energy,
                        protein: parsed.protein !== "" ? parsed.protein : prev.largePortion.protein,
                        fat: parsed.fat !== "" ? parsed.fat : prev.largePortion.fat,
                        carb: parsed.carb !== "" ? parsed.carb : prev.largePortion.carb,
                        fiber: parsed.fiber !== "" ? parsed.fiber : prev.largePortion.fiber,
                      },
                    }));
                  }}
                  placeholder={`Energi : 763,1 kkal\nProtein : 20,9 gr\nLemak : 21,3 gr\nKarbohidrat : 101,5 gr\nSerat : 4,8 gr`}
                  className="w-full p-2 text-xs rounded-lg border border-amber-300 font-medium text-slate-800 bg-white font-mono leading-relaxed focus:ring-1 focus:ring-amber-500"
                />
                <div className="text-[10px] text-amber-800/80 leading-tight">Format: Energi, Protein, Lemak, Karbohidrat, Serat</div>
              </div>

              {/* Textarea Porsi Kecil */}
              <div className="p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-1.5">
                <div className="flex items-center justify-between pb-1 border-b border-emerald-200/60">
                  <span className="font-bold text-emerald-900 text-xs">Porsi Kecil</span>
                  <span className="text-[10px] text-emerald-700 font-mono">5 Nilai Gizi</span>
                </div>
                <textarea
                  rows={6}
                  value={curMenu.smallPortionText ?? formatNutritionLines(curMenu.smallPortion)}
                  onChange={(e) => {
                    const text = e.target.value;
                    const parsed = parseNutritionText(text);
                    setCurMenu((prev) => ({
                      ...prev,
                      smallPortionText: text,
                      smallPortion: {
                        energy: parsed.energy !== "" ? parsed.energy : prev.smallPortion.energy,
                        protein: parsed.protein !== "" ? parsed.protein : prev.smallPortion.protein,
                        fat: parsed.fat !== "" ? parsed.fat : prev.smallPortion.fat,
                        carb: parsed.carb !== "" ? parsed.carb : prev.smallPortion.carb,
                        fiber: parsed.fiber !== "" ? parsed.fiber : prev.smallPortion.fiber,
                      },
                    }));
                  }}
                  placeholder={`Energi : 554,2 kkal\nProtein : 17,3 gr\nLemak : 18,2 gr\nKarbohidrat : 79 gr\nSerat : 4 gr`}
                  className="w-full p-2 text-xs rounded-lg border border-emerald-300 font-medium text-slate-800 bg-white font-mono leading-relaxed focus:ring-1 focus:ring-emerald-500"
                />
                <div className="text-[10px] text-emerald-800/80 leading-tight">Format: Energi, Protein, Lemak, Karbohidrat, Serat</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );

    if (previewLayout === "WIDE") {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 no-print">
          <div className="lg:col-span-5 space-y-4">{box1Content}</div>
          <div className="lg:col-span-7 space-y-4">{box2Content}</div>
        </div>
      );
    }

    return (
      <div className="space-y-4 no-print">
        {box1Content}
        {box2Content}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Print Page Styles */}
      <style>{`
        @media print {
          body {
            background-color: white !important;
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
          .poster-printable {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 auto !important;
            width: 100vw !important;
            max-width: 100vw !important;
            height: 98vh !important;
            max-height: 98vh !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          @page {
            size: ${printMode === "SINGLE" ? "portrait" : "landscape"};
            margin: 0;
          }
        }
      `}</style>

      {/* Header Studio Section (No Print) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <Printer className="w-6 h-6 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Cetak Menu MBG SPPG</span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {printMode === "SINGLE" ? "1 Menu (Potrait)" : "2 Menu (Landscape)"}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Desain resmi 1:1 identik dengan template Canva SPPG Jeru Tumpang. Siap cetak A4 & download JPG / PNG.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadJpg}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50">
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? "Memproses..." : "Download JPG"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={isDownloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50">
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? "Memproses..." : "Download PNG"}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs transition-colors cursor-pointer">
              <Printer className="w-4 h-4" />
              <span>Cetak / PDF A4</span>
            </button>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("menu_orders")}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer">
                <UtensilsCrossed className="w-3.5 h-3.5 text-slate-500" />
                <span>Order Menu</span>
              </button>
            )}
          </div>
        </div>

        {/* Mode Selector & Quick Presets */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Pilihan Mode Poster:</span>
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200">
              <button
                type="button"
                onClick={handleSetPresetSingle}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  printMode === "SINGLE" ? "bg-white text-emerald-800 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}>
                1 Menu (Standar / Sama)
              </button>
              <button
                type="button"
                onClick={handleSetPresetDouble}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  printMode === "DOUBLE" ? "bg-white text-emerald-800 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}>
                2 Menu (Dibedakan / Alternatif)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={printMode === "SINGLE" ? handleSetPresetSingle : handleSetPresetDouble}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-slate-200"
              title="Reset data ke contoh resmi SPPG">
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Contoh Sampel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Layout based on previewLayout */}
      {previewLayout === "WIDE" ? (
        <div className="space-y-6">
          {/* 1. Preview Card Lebar Penuh (Ukuran Besar & Jelas) */}
          <div className="bg-slate-100/80 p-4 md:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            {renderPreviewToolbar()}
            <div className="overflow-x-auto pb-4 pt-1 flex justify-center">{renderPosterElement()}</div>
          </div>

          {/* 2. Panel Editor Form di Bawah */}
          <div className="w-full">{renderFormEditor()}</div>
        </div>
      ) : (
        /* Split Berdampingan: Form di Kiri (5 Kolom), Preview di Kanan (7 Kolom) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 space-y-4 no-print">{renderFormEditor()}</div>
          <div className="lg:col-span-7 space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            {renderPreviewToolbar()}
            <div className="overflow-x-auto pb-4">{renderPosterElement()}</div>
          </div>
        </div>
      )}

      {/* Modal Fullscreen Preview */}
      {isModalPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col p-3 md:p-6 overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60 shrink-0">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="text-sm font-bold text-white">Pratinjau Resolusi Penuh Poster MBG</h3>
                <p className="text-[11px] text-slate-400">{printMode === "SINGLE" ? "1 Menu Portrait (1587 × 2245 px)" : "2 Menu Landscape (2245 × 1587 px)"}</p>
              </div>
            </div>

            {/* Center Zoom Controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300 hidden sm:inline">Skala:</span>
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setPreviewZoom(100)}
                  className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                    previewZoom === 100 ? "bg-emerald-600 text-white font-bold" : "text-slate-300 hover:text-white"
                  }`}>
                  100%
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(125)}
                  className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                    previewZoom === 125 ? "bg-emerald-600 text-white font-bold" : "text-slate-300 hover:text-white"
                  }`}>
                  125%
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewZoom(150)}
                  className={`px-2.5 py-1 text-xs rounded transition-all cursor-pointer ${
                    previewZoom === 150 ? "bg-emerald-600 text-white font-bold" : "text-slate-300 hover:text-white"
                  }`}>
                  150%
                </button>
              </div>
            </div>

            {/* Right Action buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadJpg}
                disabled={isDownloading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer">
                <Download className="w-3.5 h-3.5" />
                <span>Unduh JPG</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={isDownloading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-900 bg-slate-200 hover:bg-white rounded-lg transition-colors cursor-pointer">
                <Download className="w-3.5 h-3.5" />
                <span>Unduh PNG</span>
              </button>
              <button
                type="button"
                onClick={() => setIsModalPreviewOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Tutup Pratinjau">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            <div className="w-full flex justify-center py-4">{renderPosterElement(true)}</div>
          </div>
        </div>
      )}
    </div>
  );
};
