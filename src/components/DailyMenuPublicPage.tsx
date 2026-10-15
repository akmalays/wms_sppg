import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import logoSppgImg from '../assets/logo sppg.png';
import anakSehatImg from '../assets/anak_sehat_mbg.jpg';
import cuciTanganImg from '../assets/cuci_tangan_mbg.jpg';
import menu3bIlustrasiImg from '../assets/menu_3b_ilustrasi.jpg';
import tempeMaskotImg from '../assets/tempe_maskot_mbg.jpg';
import sayurWortelImg from '../assets/sayur_wortel_mbg.jpg';
import nasiPutihBowlImg from '../assets/nasi_putih_bowl.jpg';
import ayamBumbuKuningImg from '../assets/ayam_bumbu_kuning.jpg';
import tempeBacemImg from '../assets/tempe_bacem.jpg';
import sayurSopImg from '../assets/sayur_sop.jpg';
import buahPisangImg from '../assets/buah_pisang.jpg';
import trayImg1 from '../assets/tray_sample_1.jpg';

import {
  getWebsiteConfig,
  WebsiteConfig,
  WEBSITE_CONFIG_UPDATED_EVENT,
  IngredientNutritionInfo
} from '../db/websiteConfigStorage';

import {
  Utensils,
  Share2,
  QrCode,
  Calendar,
  Users,
  CheckCircle2,
  Scale,
  Sparkles,
  Heart,
  Activity,
  Flame,
  Wheat,
  Droplets,
  Leaf,
  Check,
  Copy,
  X,
  Info,
  BookOpen,
  Award,
  ShieldCheck,
  Clock,
  FileText,
  ChevronRight,
  ArrowRight,
  Printer,
  HeartHandshake,
  Lightbulb,
  ArrowLeft,
  Landmark
} from 'lucide-react';

interface DailyMenuPublicPageProps {
  onBackToHome?: () => void;
}

export const DailyMenuPublicPage: React.FC<DailyMenuPublicPageProps> = ({ onBackToHome }) => {
  const [config, setConfig] = useState<WebsiteConfig>(getWebsiteConfig);
  const [selectedMenuType, setSelectedMenuType] = useState<'REGULER' | '3B'>('REGULER');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [is3bModalOpen, setIs3bModalOpen] = useState<boolean>(false);
  const [isNutritionModalOpen, setIsNutritionModalOpen] = useState<boolean>(false);
  const [isIngredientsModalOpen, setIsIngredientsModalOpen] = useState<boolean>(false);
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientNutritionInfo | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [quizSelection, setQuizSelection] = useState<string | null>('tempe'); // Default match image (selected 'Tempe bacem')

  const menuToday = config.menuToday;

  // Sinkronisasi realtime jika admin mengubah menu di CMS
  useEffect(() => {
    const handleUpdate = () => {
      setConfig(getWebsiteConfig());
    };
    window.addEventListener(WEBSITE_CONFIG_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(WEBSITE_CONFIG_UPDATED_EVENT, handleUpdate);
  }, []);

  // Generate QR Code untuk tautan halaman saat ini
  useEffect(() => {
    const generateQr = async () => {
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sppg-jeru.com';
        const targetUrl = `${origin}/menu-mbg-hari-ini`;
        const url = await QRCode.toDataURL(targetUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: '#0f3e2e',
            light: '#ffffff'
          }
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error('Gagal generate QR code:', err);
      }
    };
    generateQr();
  }, []);

  const handleCopyLink = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sppg-jeru.com';
      await navigator.clipboard.writeText(`${origin}/menu-mbg-hari-ini`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      alert('Tautan halaman: ' + window.location.href);
    }
  };

  const handleShare = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sppg-jeru.com';
    const shareUrl = `${origin}/menu-mbg-hari-ini`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Menu MBG Hari Ini - SPPG Jeru`,
          text: `Cek kandungan gizi, porsi, dan bahan menu Program Makan Bergizi Gratis SPPG Tumpang Jeru hari ini!`,
          url: shareUrl,
        });
      } catch {
        handleCopyLink();
      }
    } else {
      handleCopyLink();
    }
  };

  const handlePrintSticker = () => {
    window.print();
  };

  // Nilai gizi adaptif sesuai jenis menu yang dipilih (Reguler vs 3B)
  const currentNutrition = selectedMenuType === 'REGULER'
    ? {
        energy: '685',
        protein: '29',
        carbs: '96',
        fat: '17',
        fiber: '7,8',
        label: 'Peserta Didik di Sekolah',
        riceGrams: '150',
        chickenGrams: '75',
        soupGrams: '90',
        tempeGrams: '50',
        bananaGrams: '85',
      }
    : {
        energy: '725',
        protein: '34',
        carbs: '92',
        fat: '19',
        fiber: '8,5',
        label: 'Ibu Hamil, Menyusui & Balita',
        riceGrams: '130',
        chickenGrams: '85',
        soupGrams: '100',
        tempeGrams: '60',
        bananaGrams: '90',
      };

  return (
    <div className="min-h-screen bg-[#faf8f5] text-[#1e2922] font-sans antialiased selection:bg-[#d8eedf] selection:text-[#0f3e2e]">
      {/* ========================================================
          1. HEADER NAVBAR
          ======================================================== */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#e7e1d6] shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-3">
          {/* Logo & Identitas */}
          <div className="flex items-center gap-3">
            {onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="p-2 rounded-xl bg-[#f7f4ed] hover:bg-[#ede7db] text-slate-700 transition-colors cursor-pointer"
                title="Kembali ke Beranda"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}

            <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 p-1 flex items-center justify-center shrink-0">
              <img
                src={logoSppgImg}
                alt="Logo SPPG"
                className="w-full h-full object-contain"
              />
            </div>

            <div>
              <div className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>SPPG MLG TUMPANG JERU</span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                Program Makan Bergizi Gratis
              </div>
            </div>
          </div>

          {/* Tombol Bagikan & QR Code */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="Bagikan Tautan Menu"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4 text-slate-600" />}
              <span>{copiedLink ? 'Tersalin' : 'Bagikan'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#064e3b] hover:bg-[#043e2e] text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="Buka QR Code"
            >
              <QrCode className="w-4 h-4 text-emerald-200" />
              <span>QR Code</span>
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          KONTEN UTAMA
          ======================================================== */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">

        {/* ========================================================
            2. HERO SECTION CARD
            ======================================================== */}
        <section className="bg-gradient-to-br from-[#ebf5ed]/70 via-white to-[#fbf7ed] rounded-3xl border border-[#ded8cb] p-6 sm:p-8 shadow-xs overflow-hidden relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Sisi Kiri: Teks & Menu List */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white border border-emerald-600 text-[#065f46] text-xs font-semibold shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  {menuToday.dateText}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#065f46] text-white text-xs font-semibold shadow-2xs">
                  <Users className="w-3.5 h-3.5 text-emerald-100" />
                  {selectedMenuType === 'REGULER' ? 'Menu Reguler' : 'Menu 3B'}
                </span>
              </div>

              <div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                  Menu MBG Hari Ini
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                  Makanan bergizi untuk mendukung tumbuh kembang dan semangat belajar.
                </p>
              </div>

              {/* Kotak Hijau Ringkasan Menu */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#e8f4ec] border border-[#cbe4d2] flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#d4ecd9] flex items-center justify-center shrink-0 text-[#065f46]">
                  <Utensils className="w-7 h-7" />
                </div>
                <div className="space-y-0.5 text-slate-900 text-sm sm:text-base font-bold leading-tight">
                  <div>Nasi putih</div>
                  <div>Ayam bumbu kuning</div>
                  <div>Sayur sop, Tempe bacem</div>
                  <div>Pisang</div>
                </div>
              </div>
            </div>

            {/* Sisi Kanan: Foto Wadah Ompreng MBG */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/90 shadow-md group w-full max-w-[420px] aspect-4/3">
                <img
                  src={menuToday.imageUrl || trayImg1}
                  alt="Menu MBG Hari Ini"
                  className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
                />

                {/* Yellow Note Sticker */}
                <div className="absolute top-3 right-3 bg-[#fef9c3] border border-[#fde047] text-[#713f12] px-3.5 py-2 rounded-2xl shadow-sm rotate-2 text-xs font-bold max-w-[170px] leading-snug">
                  <div className="text-[10px] text-amber-700/80 mb-0.5 flex items-center gap-1 font-semibold">
                    <span>🌱</span>
                    <span>Menu sehat</span>
                  </div>
                  Menu sehat untuk tubuh kuat dan semangat belajar! ✨
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            3. PILIH JENIS MENU & BANNER MENU 3B
            ======================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Kolom Kiri: Pilihan Jenis Menu (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-[#ded8cb] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Users className="w-5 h-5 text-emerald-700" />
                <span>Pilih Jenis Menu</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Informasi ditampilkan sesuai kelompok penerima manfaat.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Option 1: Menu Reguler */}
              <div
                onClick={() => setSelectedMenuType('REGULER')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  selectedMenuType === 'REGULER'
                    ? 'border-emerald-600 bg-emerald-50/60 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedMenuType === 'REGULER' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">Menu Reguler</div>
                    <div className="text-xs text-slate-500">Peserta didik di sekolah</div>
                  </div>
                </div>

                <div className="shrink-0">
                  {selectedMenuType === 'REGULER' ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-slate-300 bg-white" />
                  )}
                </div>
              </div>

              {/* Option 2: Menu 3B */}
              <div
                onClick={() => setSelectedMenuType('3B')}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  selectedMenuType === '3B'
                    ? 'border-emerald-600 bg-emerald-50/60 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedMenuType === '3B' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500'
                  }`}>
                    <HeartHandshake className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-sm">Menu 3B</div>
                    <div className="text-xs text-slate-500">Ibu hamil, ibu menyusui, balita non-PAUD</div>
                  </div>
                </div>

                <div className="shrink-0">
                  {selectedMenuType === '3B' ? (
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                      <Check className="w-4 h-4 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-slate-300 bg-white" />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Mau Tahu Perbedaan Menu 3B? (4 cols) */}
          <div className="lg:col-span-4 bg-[#edf7f0] rounded-3xl border border-[#cbe4d2] p-5 sm:p-6 shadow-xs flex flex-col justify-between items-center text-center">
            <div className="space-y-2.5 w-full">
              <div className="font-bold text-slate-900 text-base sm:text-lg">
                Mau tahu perbedaan menu 3B?
              </div>
              <div className="w-full max-w-[280px] h-36 sm:h-40 mx-auto overflow-hidden flex items-center justify-center p-1">
                <img
                  src={menu3bIlustrasiImg}
                  alt="Ilustrasi Menu 3B"
                  className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIs3bModalOpen(true)}
              className="w-full mt-2 py-2.5 px-4 rounded-full bg-white hover:bg-slate-50 border border-emerald-300 text-slate-800 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs hover:shadow-xs"
            >
              <span>Lihat penjelasan menu 3B</span>
              <ArrowRight className="w-4 h-4 text-emerald-700" />
            </button>
          </div>
        </section>

        {/* ========================================================
            4. INFORMASI GIZI PER PORSI & MANFAAT UNTUK ANAK
            ======================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Kolom Kiri: 5 Metrik Gizi (8 cols) */}
          <div className="lg:col-span-7 bg-white rounded-3xl border border-[#ded8cb] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base sm:text-lg">
                  <Activity className="w-5 h-5 text-emerald-700" />
                  <span>Informasi Gizi per Porsi</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Nilai gizi ditampilkan berdasarkan resep dan takaran yang tercatat.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsNutritionModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-emerald-800 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-1.5 rounded-full transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
              >
                <span>Lihat detail gizi</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* 5 Cards Gizi Sejajar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {/* Energi */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 text-center flex flex-col justify-between items-center shadow-2xs hover:border-amber-300 transition-colors">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-1">
                  <Flame className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-500 font-medium">Energi</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight my-0.5">
                  {currentNutrition.energy}
                </div>
                <div className="text-xs text-slate-500">kkal</div>
              </div>

              {/* Protein */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 text-center flex flex-col justify-between items-center shadow-2xs hover:border-rose-300 transition-colors">
                <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-1">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-500 font-medium">Protein</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight my-0.5">
                  {currentNutrition.protein}
                </div>
                <div className="text-xs text-slate-500">gram</div>
              </div>

              {/* Karbohidrat */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 text-center flex flex-col justify-between items-center shadow-2xs hover:border-amber-300 transition-colors">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-1">
                  <Wheat className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-500 font-medium">Karbohidrat</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight my-0.5">
                  {currentNutrition.carbs}
                </div>
                <div className="text-xs text-slate-500">gram</div>
              </div>

              {/* Lemak */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 text-center flex flex-col justify-between items-center shadow-2xs hover:border-sky-300 transition-colors">
                <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mb-1">
                  <Droplets className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-500 font-medium">Lemak</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight my-0.5">
                  {currentNutrition.fat}
                </div>
                <div className="text-xs text-slate-500">gram</div>
              </div>

              {/* Serat Pangan */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 text-center flex flex-col justify-between items-center shadow-2xs hover:border-emerald-300 transition-colors col-span-2 sm:col-span-1">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                  <Leaf className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-500 font-medium">Serat Pangan</div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight my-0.5">
                  {currentNutrition.fiber}
                </div>
                <div className="text-xs text-slate-500">gram</div>
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Manfaat untuk Anak (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-[#ded8cb] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div className="font-bold text-slate-900 text-base sm:text-lg mb-3">
              Manfaat untuk Anak
            </div>

            <div className="flex items-center gap-4 sm:gap-5">
              <div className="w-32 h-40 sm:w-36 sm:h-44 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  src={anakSehatImg}
                  alt="Anak Sehat Berenergi"
                  className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                />
              </div>

              <div className="space-y-3 sm:space-y-3.5 text-xs sm:text-sm text-slate-800">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Memberi energi</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Membantu pertumbuhan</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Menjaga daya tahan tubuh</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Mendukung konsentrasi belajar</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            5. RINCIAN MENU DAN BAHAN MAKANAN (5 CARDS SEJAJAR)
            ======================================================== */}
        <section className="bg-white rounded-3xl border border-[#ded8cb] p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                <Leaf className="w-5 h-5 text-emerald-700" />
                <span>Rincian Menu dan Bahan Makanan</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Daftar bahan makanan, kategori, dan takaran porsi pada menu hari ini.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsIngredientsModalOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-emerald-800 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-1.5 rounded-full transition-colors cursor-pointer self-start sm:self-auto shadow-2xs"
            >
              <span>Lihat detail bahan</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* Card 1: Nasi putih */}
            <div
              onClick={() => {
                const item = menuToday.ingredients.find(i => i.id === 'ing-1');
                if (item) setSelectedIngredient(item);
              }}
              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between items-center text-center group"
            >
              <div className="w-22 h-22 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden bg-white border border-slate-100 shadow-2xs mb-3 flex items-center justify-center p-0.5">
                <img
                  src={nasiPutihBowlImg}
                  alt="Nasi Putih"
                  className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="space-y-1.5 w-full">
                <div className="font-bold text-slate-900 text-sm sm:text-base">Nasi putih</div>
                <div>
                  <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60">
                    Karbohidrat
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-slate-700 pt-0.5">
                  ± {currentNutrition.riceGrams} gram
                </div>
              </div>
            </div>

            {/* Card 2: Ayam bumbu kuning */}
            <div
              onClick={() => {
                const item = menuToday.ingredients.find(i => i.id === 'ing-2');
                if (item) setSelectedIngredient(item);
              }}
              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between items-center text-center group"
            >
              <div className="w-22 h-22 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden bg-white border border-slate-100 shadow-2xs mb-3 flex items-center justify-center p-0.5">
                <img
                  src={ayamBumbuKuningImg}
                  alt="Ayam Bumbu Kuning"
                  className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="space-y-1.5 w-full">
                <div className="font-bold text-slate-900 text-sm sm:text-base">Ayam bumbu kuning</div>
                <div>
                  <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
                    Protein hewani
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-slate-700 pt-0.5">
                  ± {currentNutrition.chickenGrams} gram
                </div>
              </div>
            </div>

            {/* Card 3: Sayur sop */}
            <div
              onClick={() => {
                const item = menuToday.ingredients.find(i => i.id === 'ing-4');
                if (item) setSelectedIngredient(item);
              }}
              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between items-center text-center group"
            >
              <div className="w-22 h-22 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden bg-white border border-slate-100 shadow-2xs mb-3 flex items-center justify-center p-0.5">
                <img
                  src={sayurSopImg}
                  alt="Sayur Sop"
                  className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="space-y-1.5 w-full">
                <div className="font-bold text-slate-900 text-sm sm:text-base">Sayur sop</div>
                <div>
                  <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    Sayuran
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-slate-700 pt-0.5">
                  ± {currentNutrition.soupGrams} gram
                </div>
              </div>
            </div>

            {/* Card 4: Tempe bacem */}
            <div
              onClick={() => {
                const item = menuToday.ingredients.find(i => i.id === 'ing-3');
                if (item) setSelectedIngredient(item);
              }}
              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between items-center text-center group"
            >
              <div className="w-22 h-22 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden bg-white border border-slate-100 shadow-2xs mb-3 flex items-center justify-center p-0.5">
                <img
                  src={tempeBacemImg}
                  alt="Tempe Bacem"
                  className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="space-y-1.5 w-full">
                <div className="font-bold text-slate-900 text-sm sm:text-base">Tempe bacem</div>
                <div>
                  <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                    Protein nabati
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-slate-700 pt-0.5">
                  ± {currentNutrition.tempeGrams} gram
                </div>
              </div>
            </div>

            {/* Card 5: Pisang */}
            <div
              onClick={() => {
                const item = menuToday.ingredients.find(i => i.id === 'ing-5');
                if (item) setSelectedIngredient(item);
              }}
              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-emerald-500 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between items-center text-center group col-span-2 sm:col-span-1"
            >
              <div className="w-22 h-22 sm:w-24 sm:h-24 mx-auto rounded-full overflow-hidden bg-white border border-slate-100 shadow-2xs mb-3 flex items-center justify-center p-0.5">
                <img
                  src={buahPisangImg}
                  alt="Pisang"
                  className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                />
              </div>
              <div className="space-y-1.5 w-full">
                <div className="font-bold text-slate-900 text-sm sm:text-base">Pisang</div>
                <div>
                  <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200/60">
                    Buah
                  </span>
                </div>
                <div className="text-xs sm:text-sm font-semibold text-slate-700 pt-0.5 leading-tight">
                  <div>1 buah</div>
                  <div className="text-xs text-slate-500 font-normal">(± {currentNutrition.bananaGrams} gram)</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            6. BARIS EDUKASI: KENALI ISI PIRINGMU, PAHLAWAN GIZI, MISI SEHAT
            ======================================================== */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Kenali Isi Piringmu */}
          <div className="bg-white rounded-3xl border border-[#ded8cb] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base sm:text-lg">
              <Leaf className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700" />
              <span>Kenali Isi Piringmu</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-4 sm:gap-5">
                {/* SVG Illustrated Plate representing "Isi Piringku" */}
                <div className="w-32 h-32 sm:w-36 sm:h-36 shrink-0 relative flex items-center justify-center">
                  <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-md">
                    {/* Outer plate rim */}
                    <circle cx="60" cy="60" r="56" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="4" />
                    <circle cx="60" cy="60" r="50" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="2 2" />
                    
                    {/* Top Left: Karbohidrat (35%) */}
                    <path
                      d="M 60 60 L 60 12 A 48 48 0 0 0 14 74 Z"
                      fill="#fef3c7"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    <circle cx="36" cy="36" r="2.5" fill="#d97706" opacity="0.4" />
                    <circle cx="44" cy="45" r="3" fill="#d97706" opacity="0.4" />
                    <circle cx="30" cy="50" r="2.5" fill="#d97706" opacity="0.4" />
                    <text x="36" y="44" fontSize="8.5" fontWeight="bold" fill="#92400e" textAnchor="middle">Nasi</text>

                    {/* Top Right: Sayuran (35%) */}
                    <path
                      d="M 60 60 L 60 12 A 48 48 0 0 1 106 74 Z"
                      fill="#dcfce7"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    <circle cx="82" cy="36" r="3.5" fill="#16a34a" opacity="0.5" />
                    <circle cx="74" cy="47" r="3" fill="#ea580c" opacity="0.7" />
                    <circle cx="88" cy="50" r="2.5" fill="#16a34a" opacity="0.5" />
                    <text x="82" y="44" fontSize="8.5" fontWeight="bold" fill="#166534" textAnchor="middle">Sayur</text>

                    {/* Bottom Left: Lauk Pauk (15%) */}
                    <path
                      d="M 60 60 L 14 74 A 48 48 0 0 0 60 108 Z"
                      fill="#ffedd5"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    <rect x="28" y="78" width="14" height="11" rx="2.5" fill="#c2410c" opacity="0.6" />
                    <text x="36" y="87" fontSize="7.5" fontWeight="bold" fill="#9a3412" textAnchor="middle">Lauk</text>

                    {/* Bottom Right: Buah (15%) */}
                    <path
                      d="M 60 60 L 106 74 A 48 48 0 0 1 60 108 Z"
                      fill="#fef9c3"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                    />
                    <path d="M 72 82 Q 81 93 90 84" stroke="#ca8a04" strokeWidth="3.5" fill="none" strokeLinecap="round" />
                    <text x="82" y="87" fontSize="7.5" fontWeight="bold" fill="#854d0e" textAnchor="middle">Buah</text>

                    {/* Center divider circle */}
                    <circle cx="60" cy="60" r="11" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
                    <text x="60" y="63.5" fontSize="7" fontWeight="bold" fill="#0f172a" textAnchor="middle">Gizi</text>
                  </svg>
                </div>

                <div className="text-xs sm:text-sm text-slate-700 leading-tight space-y-2">
                  <p className="text-slate-500 font-medium mb-1.5 text-xs">Setiap menu memiliki peran penting untuk tubuhmu.</p>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                    <span><strong>Karbohidrat</strong> – sumber energi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500 shrink-0" />
                    <span><strong>Protein hewani</strong> – membangun tubuh</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-700 shrink-0" />
                    <span><strong>Protein nabati</strong> – menambah gizi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                    <span><strong>Sayuran</strong> – kaya vitamin dan serat</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-400 shrink-0" />
                    <span><strong>Buah</strong> – menjaga daya tahan tubuh</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Pahlawan Gizi Hari Ini */}
          <div className="bg-white rounded-3xl border border-[#ded8cb] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base sm:text-lg">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-sky-600" />
              <span>Pahlawan Gizi Hari Ini</span>
            </div>

            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center p-1">
                  <img
                    src={tempeMaskotImg}
                    alt="Tempe Maskot"
                    className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                  />
                </div>

                <div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Tempe</div>
                  <div className="mt-1.5">
                    <span className="text-xs sm:text-sm font-semibold px-3 py-1 rounded-full bg-[#dcfce7] text-[#166534] border border-emerald-200 inline-block">
                      Protein Nabati
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 sm:space-y-3 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">Membantu pertumbuhan dan memperbaiki jaringan tubuh.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">Mengandung protein, kalsium dan probiotik.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">Baik untuk kesehatan tulang dan pencernaan.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Misi Sehat Hari Ini */}
          <div className="bg-white rounded-3xl border border-[#ded8cb] p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base sm:text-lg">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700" />
              <span>Misi Sehat Hari Ini</span>
            </div>

            <div className="space-y-2.5">
              <p className="text-xs sm:text-sm text-slate-700 font-medium">
                Biasakan cuci tangan dengan sabun sebelum makan.
              </p>

              <div className="relative rounded-2xl overflow-hidden bg-sky-50 border border-sky-100 shadow-2xs h-40 sm:h-44 w-full flex items-center justify-center">
                <img
                  src={cuciTanganImg}
                  alt="Cuci Tangan Pakai Sabun"
                  className="w-full h-full object-cover"
                />

                {/* Floating yellow sticky note badge */}
                <div className="absolute bottom-2.5 right-2.5 bg-[#fef9c3] border border-[#fde047] text-[#713f12] text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs max-w-[160px] leading-tight text-center">
                  Tangan bersih, makanan lebih aman dan sehat! ✨
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            7. KUIS GIZI SINGKAT & TAHUKAH KAMU?
            ======================================================== */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Kolom Kiri: Kuis Gizi Singkat (8 cols) */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-[#ded8cb] p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base sm:text-lg">
              <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
              <span>Kuis Gizi Singkat</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-700">
              Mana yang termasuk sumber <strong>protein nabati</strong> dari menu hari ini?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              {/* Pilihan Jawaban (7 cols) */}
              <div className="sm:col-span-7 grid grid-cols-2 gap-3">
                {[
                  { id: 'nasi', label: 'Nasi putih', isCorrect: false },
                  { id: 'ayam', label: 'Ayam bumbu kuning', isCorrect: false },
                  { id: 'tempe', label: 'Tempe bacem', isCorrect: true },
                  { id: 'pisang', label: 'Pisang', isCorrect: false },
                ].map(opt => {
                  const isSelected = quizSelection === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setQuizSelection(opt.id)}
                      className={`p-3.5 sm:p-4 rounded-2xl border text-left text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-all cursor-pointer ${
                        isSelected && opt.isCorrect
                          ? 'border-emerald-600 bg-emerald-50/70 text-emerald-950 font-bold shadow-2xs'
                          : isSelected && !opt.isCorrect
                          ? 'border-rose-400 bg-rose-50 text-rose-800'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected && opt.isCorrect
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : isSelected && !opt.isCorrect
                          ? 'border-rose-500 bg-rose-500 text-white'
                          : 'border-slate-300 bg-white'
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback Hasil Kuis (5 cols) */}
              <div className="sm:col-span-5">
                {quizSelection === 'tempe' && (
                  <div className="p-4 sm:p-5 rounded-3xl bg-[#edf8f1] border border-emerald-300 text-emerald-900 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-4 h-4 stroke-[3]" />
                      </div>
                      <div className="space-y-1">
                        <div className="font-bold text-emerald-950 text-sm sm:text-base">Benar!</div>
                        <p className="text-xs text-emerald-800 leading-relaxed">
                          Tempe bacem merupakan sumber protein nabati yang baik untuk pertumbuhan dan kesehatan tubuh.
                        </p>
                      </div>
                    </div>
                    <img
                      src={tempeBacemImg}
                      alt="Tempe"
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shrink-0 border border-emerald-200 shadow-xs"
                    />
                  </div>
                )}

                {quizSelection && quizSelection !== 'tempe' && (
                  <div className="p-4 sm:p-5 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold text-sm">
                      !
                    </div>
                    <div className="space-y-1">
                      <div className="font-bold text-sm sm:text-base">Kurang tepat, yuk coba lagi!</div>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        Protein nabati berasal dari olahan kacang-kacangan nabati seperti kedelai.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Tahukah Kamu? (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-[#ded8cb] p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-2.5 text-slate-900 font-bold text-base sm:text-lg">
              <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-700" />
              <span>Tahukah Kamu?</span>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 my-auto py-2">
              <div className="w-24 h-24 sm:w-28 sm:h-28 overflow-hidden shrink-0 flex items-center justify-center">
                <img
                  src={sayurWortelImg}
                  alt="Wortel dan Sayuran"
                  className="w-full h-full object-contain hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Speech bubble pointing towards carrot */}
              <div className="relative p-3.5 sm:p-4 rounded-2xl bg-[#f8faf8] border border-slate-200/90 text-xs sm:text-sm text-slate-700 leading-relaxed shadow-2xs flex-1">
                <div className="hidden sm:block absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-6 border-t-transparent border-b-6 border-b-transparent border-r-8 border-r-slate-200" />
                <div className="hidden sm:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-0 h-0 border-t-5 border-t-transparent border-b-5 border-b-transparent border-r-7 border-r-[#f8faf8]" />
                <p className="font-medium text-slate-800 mb-1 leading-snug">
                  Warna sayuran yang berbeda menandakan kandungan gizi yang berbeda juga.
                </p>
                <p className="text-emerald-800 font-bold text-xs sm:text-sm leading-snug">
                  Yuk, coba makan berbagai warna sayuran!
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            8. FOOTER BANNER HIJAU TUA (SCAN QR & LINK AKSES)
            ======================================================== */}
        <section className="bg-[#064e3b] rounded-3xl p-6 sm:p-8 text-white shadow-md">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            {/* Sisi Kiri: Scan QR Code Box & Deskripsi */}
            <div className="lg:col-span-4 flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-white p-1.5 shrink-0 flex items-center justify-center shadow-xs">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-full h-full object-contain rounded-xl" />
                ) : (
                  <QrCode className="w-10 h-10 text-[#064e3b]" />
                )}
              </div>
              <div className="space-y-1">
                <div className="font-bold text-white text-sm">Akses Menu Ini Kapan Saja</div>
                <div className="text-[11px] text-emerald-200 leading-snug">
                  Scan QR Code atau kunjungi tautan ini untuk melihat menu terbaru.
                </div>
              </div>
            </div>

            {/* Sisi Tengah: Tautan URL dengan Copy Button */}
            <div className="lg:col-span-4">
              <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/20 text-xs transition-colors shadow-2xs">
                <span className="font-mono text-emerald-100 truncate text-[11px] sm:text-xs">
                  https://sppg-jeru.com/menu-mbg-hari-ini
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer shrink-0"
                  title="Salin Tautan"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Sisi Kanan: Metadata Waktu & Sumber Data */}
            <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-start xl:items-center justify-end gap-4 text-xs text-emerald-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-300 shrink-0" />
                <div>
                  <div className="text-[10px] text-emerald-300 font-medium">Terakhir diperbarui</div>
                  <div className="font-semibold text-white">{menuToday.dateText} • 06.30 WIB</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-300 shrink-0" />
                <div>
                  <div className="text-[10px] text-emerald-300 font-medium">Sumber data gizi</div>
                  <div className="font-semibold text-white">Resep dan takaran porsi SPPG Tumpang Jeru</div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* ========================================================
          MODAL: PENJELASAN MENU 3B
          ======================================================== */}
      {is3bModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[#ded8cb] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Standar Gizi Khusus Menu 3B
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Ibu Hamil, Ibu Menyusui, dan Balita Non-PAUD
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIs3bModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 rounded-2xl bg-rose-50/60 border border-rose-200/60 space-y-1">
                <div className="font-bold text-rose-900">1. Ibu Hamil & Menyusui</div>
                <p className="text-[11px] text-rose-800 leading-relaxed">
                  Memerlukan tambahan energi +300 kkal, zat besi ganda guna pencegahan anemia ibu dan janin, asam folat untuk pembentukan tabung saraf, serta kalsium tinggi.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50/60 border border-amber-200/60 space-y-1">
                <div className="font-bold text-amber-900">2. Balita Non-PAUD (Usia 1–4 Tahun)</div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Tekstur makanan lebih lunak, dipotong dadu higienis, porsi disesuaikan dengan volume lambung kecil, serta minim natrium dan bumbu tajam.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 space-y-1">
                <div className="font-bold text-emerald-900">3. Pencegahan Stunting Nasional</div>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Intervensi 1000 Hari Pertama Kehidupan (HPK) merupakan kunci utama menuntaskan masalah gizi kronis di tingkat desa dan kecamatan.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedMenuType('3B');
                  setIs3bModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-[#0f3e2e] text-white text-xs font-bold hover:bg-[#165640] transition-colors cursor-pointer"
              >
                Terapkan Tampilan Menu 3B
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DETAIL NILAI GIZI LENGKAP
          ======================================================== */}
      {isNutritionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#ded8cb] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Rincian Angka Kecukupan Gizi (AKG)
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedMenuType === 'REGULER' ? 'Standar Menu Reguler Anak Sekolah' : 'Standar Menu 3B (Ibu & Balita)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNutritionModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <th className="py-2">Nutrien</th>
                    <th className="py-2 text-right">Nilai per Porsi</th>
                    <th className="py-2 text-right">% AKG Harian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-2 font-medium">Energi Total</td>
                    <td className="py-2 text-right font-mono font-bold text-slate-900">{currentNutrition.energy} kkal</td>
                    <td className="py-2 text-right font-mono text-emerald-700">34%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Protein Total</td>
                    <td className="py-2 text-right font-mono font-bold text-slate-900">{currentNutrition.protein} g</td>
                    <td className="py-2 text-right font-mono text-emerald-700">38%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Karbohidrat</td>
                    <td className="py-2 text-right font-mono font-bold text-slate-900">{currentNutrition.carbs} g</td>
                    <td className="py-2 text-right font-mono text-emerald-700">32%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Lemak Sehat</td>
                    <td className="py-2 text-right font-mono font-bold text-slate-900">{currentNutrition.fat} g</td>
                    <td className="py-2 text-right font-mono text-emerald-700">25%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Serat Pangan</td>
                    <td className="py-2 text-right font-mono font-bold text-slate-900">{currentNutrition.fiber} g</td>
                    <td className="py-2 text-right font-mono text-emerald-700">30%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Kalsium</td>
                    <td className="py-2 text-right font-mono font-bold text-slate-900">210 mg</td>
                    <td className="py-2 text-right font-mono text-emerald-700">21%</td>
                  </tr>
                  <tr>
                    <td className="py-2 font-medium">Zat Besi</td>
                    <td className="py-2 text-right font-mono font-bold text-slate-900">3,6 mg</td>
                    <td className="py-2 text-right font-mono text-emerald-700">24%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsNutritionModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: DETAIL BAHAN & PETANI LOKAL
          ======================================================== */}
      {(selectedIngredient || isIngredientsModalOpen) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 border border-[#ded8cb] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedIngredient ? selectedIngredient.name : 'Daftar Semua Komponen Bahan'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {selectedIngredient ? selectedIngredient.category : 'Takaran gramatur dan sertifikasi lokal'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedIngredient(null);
                  setIsIngredientsModalOpen(false);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedIngredient ? (
              <div className="space-y-3 text-xs">
                <div className="w-full h-36 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                  <img
                    src={selectedIngredient.imageUrl}
                    alt={selectedIngredient.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                  <div className="font-bold text-emerald-950">Khasiat & Nilai Nutrisi:</div>
                  <p className="text-emerald-800 leading-relaxed text-[11px]">
                    {selectedIngredient.healthBenefits}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block">Mitra Pemasok:</span>
                    <strong className="text-slate-800">{selectedIngredient.supplier}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-slate-400 block">Takaran Porsi:</span>
                    <strong className="text-slate-800 font-mono">
                      {selectedMenuType === 'REGULER' ? selectedIngredient.portionLarge : selectedIngredient.portionSmall}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {menuToday.ingredients.map(item => (
                  <div key={item.id} className="p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-3 bg-[#faf8f5]">
                    <div className="flex items-center gap-3">
                      <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-xl object-cover" />
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{item.name}</div>
                        <div className="text-[10px] text-slate-500">{item.supplier}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-emerald-800">
                        {selectedMenuType === 'REGULER' ? item.portionLarge : item.portionSmall}
                      </div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                        {item.category}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSelectedIngredient(null);
                  setIsIngredientsModalOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: CETAK / UNDUH STIKER QR CODE
          ======================================================== */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 border border-[#ded8cb] shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  QR Code Menu MBG
                </h3>
                <p className="text-[11px] text-slate-500">
                  Scan untuk transparansi nilai gizi langsung
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div id="printable-qr-sticker" className="p-4 rounded-2xl border-2 border-dashed border-emerald-600/40 bg-[#faf8f5] text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <img src={logoSppgImg} alt="Logo SPPG" className="w-6 h-6 object-contain" />
                <div className="text-left">
                  <div className="text-[9px] font-bold text-slate-900">SPPG MLG TUMPANG JERU</div>
                  <div className="text-[8px] text-slate-500">Program Makan Bergizi Gratis</div>
                </div>
              </div>

              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-44 h-44 mx-auto bg-white p-2 rounded-xl border border-slate-200 shadow-2xs"
                />
              )}

              <div className="text-xs font-bold text-slate-900">
                Menu MBG Hari Ini
              </div>
              <div className="text-[10px] text-slate-500">
                {menuToday.dateText}
              </div>
              <div className="text-[9px] font-mono text-emerald-800">
                domain/menu-mbg-hari-ini
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handlePrintSticker}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak</span>
              </button>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`qr-menu-mbg-${menuToday.dateText.replace(/\s+/g, '-').toLowerCase()}.png`}
                  className="px-4 py-2 rounded-xl bg-[#0f3e2e] text-white text-xs font-bold hover:bg-[#165640] transition-colors cursor-pointer"
                >
                  Unduh PNG
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          FOOTER MINIMALIS COPYRIGHT
          ======================================================== */}
      <footer className="bg-white border-t border-[#e7e1d6] py-5 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 space-y-1">
          <div>
            <strong>SPPG MLG TUMPANG JERU</strong> • Satuan Pelayanan Pemenuhan Gizi Nasional
          </div>
          <div className="text-[11px] text-slate-400">
            Desa Jeru, Kec. Tumpang, Kab. Malang • Badan Gizi Nasional RI
          </div>
        </div>
      </footer>
    </div>
  );
};
