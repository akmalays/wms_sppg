import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import logoSppgImg from '../assets/logo sppg.png';
import {
  getWebsiteConfig,
  WebsiteConfig,
  WEBSITE_CONFIG_UPDATED_EVENT,
  IngredientNutritionInfo
} from '../db/websiteConfigStorage';
import {
  Utensils,
  Scale,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  QrCode,
  Share2,
  Printer,
  Copy,
  Check,
  ArrowLeft,
  Heart,
  Flame,
  Wheat,
  Activity,
  Award,
  Calendar,
  MapPin,
  ExternalLink,
  ChevronDown,
  Info
} from 'lucide-react';

interface DailyMenuPublicPageProps {
  onBackToHome?: () => void;
}

export const DailyMenuPublicPage: React.FC<DailyMenuPublicPageProps> = ({ onBackToHome }) => {
  const [config, setConfig] = useState<WebsiteConfig>(getWebsiteConfig);
  const [selectedPortion, setSelectedPortion] = useState<'SMALL' | 'LARGE'>('LARGE');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [activeIngredientId, setActiveIngredientId] = useState<string | null>(null);

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
        const origin = typeof window !== 'undefined' ? window.location.origin : 'https://sppg-tumpangjeru.bgn.go.id';
        const targetUrl = `${origin}/menu-mbg-hari-ini`;
        const url = await QRCode.toDataURL(targetUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: '#0c2419',
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

  const activePortion = selectedPortion === 'LARGE' ? menuToday.portionLarge : menuToday.portionSmall;

  const handleCopyLink = async () => {
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      await navigator.clipboard.writeText(`${origin}/menu-mbg-hari-ini`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
      alert('Tautan berhasil disalin: ' + window.location.href);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-[#faf8f4] text-[#141d18] font-sans selection:bg-[#d8eedf] selection:text-[#0c3123] antialiased">
      {/* Top Bar Header Publik */}
      <header className="sticky top-0 z-30 bg-[#faf8f4]/95 backdrop-blur-md border-b border-[#e5dfd3]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-3">
          {/* Logo & Identitas */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (onBackToHome) {
                  onBackToHome();
                } else {
                  window.location.href = '/';
                }
              }}
              className="p-2 rounded-xl bg-white border border-[#ded7c8] hover:bg-[#f2ece1] text-[#141d18] transition-colors cursor-pointer"
              title="Kembali ke Beranda"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <img
              src={logoSppgImg}
              alt="Logo SPPG"
              className="w-10 h-10 object-contain rounded-lg p-1 bg-white border border-[#ded8cb]"
            />

            <div>
              <div className="text-[10px] font-semibold text-[#0c3123] tracking-wide">
                SPPG MLG TUMPANG JERU
              </div>
              <div className="text-xs sm:text-sm font-bold font-serif-display text-[#141d18]">
                Transparansi Menu MBG Hari Ini
              </div>
            </div>
          </div>

          {/* Tombol QR Code & Bagikan */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#133d2c] text-white text-xs font-semibold hover:bg-[#1a4f39] transition-all shadow-2xs cursor-pointer"
              title="Lihat & Cetak QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden sm:inline">QR Code</span>
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="p-2 rounded-full bg-white border border-[#ded7c8] hover:bg-[#f6f2e8] text-[#141d18] transition-colors cursor-pointer"
              title="Salin Tautan Halaman"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Banner Identitas Menu Hari Ini */}
        <section className="bg-white rounded-3xl border border-[#ded7c8] p-5 sm:p-8 shadow-xs overflow-hidden">
          {/* Badge Tanggal & Status QC */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ecf7f0] text-[#0c3123] border border-[#c4e5ce] text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-emerald-700" />
              <span>{menuToday.dateText}</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faf8f4] text-[#55645c] border border-[#ded7c8] text-[11px] font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{menuToday.qcStatus}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
            {/* Kiri: Judul & Narasi Edukatif */}
            <div className="lg:col-span-7 space-y-3">
              <div className="text-xs font-semibold text-[#0c3123]">
                {menuToday.menuSubtitle}
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] leading-tight">
                {menuToday.menuTitle}
              </h1>
              <p className="text-xs sm:text-sm text-[#55645c] leading-relaxed pt-1">
                {menuToday.description}
              </p>

              {/* Jaminan Keamanan Pangan */}
              <div className="pt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#0c3123]">
                <div className="inline-flex items-center gap-1 bg-[#ecf7f0] border border-[#c4e5ce] px-2.5 py-1 rounded-lg font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{menuToday.allergensWarning}</span>
                </div>
              </div>
            </div>

            {/* Kanan: Foto Sajian Lengkap */}
            <div className="lg:col-span-5 relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-900 border border-[#ded7c8] shadow-xs group">
              <img
                src={menuToday.imageUrl}
                alt={menuToday.menuTitle}
                className="w-full h-full object-cover object-center group-hover:scale-102 transition-transform duration-500"
              />
              <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-md text-white text-[10px] font-mono px-2.5 py-1 rounded-lg border border-white/20">
                Wadah SUS 304 Food-Grade
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            SWITCHER INTERAKTIF: PORSI BESAR vs PORSI KECIL
            ======================================================== */}
        <section className="bg-white rounded-3xl border border-[#ded7c8] p-5 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#133d2c] mb-1">
                <Scale className="w-4 h-4 text-emerald-700" />
                <span>Pilihan Tingkat Porsi Konsumsi</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif-display text-[#141d18]">
                Bandingkan Takaran Porsi & Kebutuhan Kalori
              </h2>
              <p className="text-xs text-[#55645c] mt-0.5">
                Klik porsi di bawah untuk melihat penyesuaian gramatur dan nilai gizi secara interaktif.
              </p>
            </div>

            {/* Segmented Button Porsi */}
            <div className="inline-flex p-1 rounded-2xl bg-[#f4efe4] border border-[#ded7c8] shrink-0">
              <button
                type="button"
                onClick={() => setSelectedPortion('SMALL')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  selectedPortion === 'SMALL'
                    ? 'bg-[#133d2c] text-white shadow-xs'
                    : 'text-[#44534a] hover:text-[#141d18]'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Porsi Kecil</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  selectedPortion === 'SMALL' ? 'bg-emerald-900 text-emerald-200' : 'bg-white/60 text-slate-600'
                }`}>
                  PAUD – SD 3
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPortion('LARGE')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  selectedPortion === 'LARGE'
                    ? 'bg-[#133d2c] text-white shadow-xs'
                    : 'text-[#44534a] hover:text-[#141d18]'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Porsi Besar</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                  selectedPortion === 'LARGE' ? 'bg-emerald-900 text-emerald-200' : 'bg-white/60 text-slate-600'
                }`}>
                  SD 4 – SMP
                </span>
              </button>
            </div>
          </div>

          {/* Kartu Ringkasan Porsi Terpilih */}
          <div className="p-5 rounded-2xl bg-[#faf8f4] border border-[#ede7db] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#e8e2d4]">
              <div>
                <span className="text-xs font-bold text-[#133d2c] bg-[#ecf7f0] border border-[#c4e5ce] px-2.5 py-0.5 rounded-md">
                  {activePortion.tierName}
                </span>
                <div className="text-xs text-[#55645c] mt-1.5 leading-relaxed">
                  {activePortion.description}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] text-[#707e76] font-medium">Estimasi Energi</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-[#133d2c]">
                    {activePortion.targetCalories}
                  </div>
                </div>
                <div className="h-8 w-px bg-[#ded7c8]" />
                <div className="text-right">
                  <div className="text-[10px] text-[#707e76] font-medium">Total Bobot Matang</div>
                  <div className="text-xl sm:text-2xl font-bold font-mono text-[#133d2c]">
                    {activePortion.totalGramature}
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Kartu Makronutrien Terdistribusi */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-white border border-[#ded7c8] shadow-2xs">
                <div className="flex items-center justify-between text-xs text-[#707e76]">
                  <span>Protein</span>
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="text-lg font-bold font-mono text-[#141d18] mt-1">
                  {activePortion.proteinGrams}
                </div>
                <div className="text-[10px] text-[#55645c] mt-0.5">Pertumbuhan jaringan</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#ded7c8] shadow-2xs">
                <div className="flex items-center justify-between text-xs text-[#707e76]">
                  <span>Karbohidrat</span>
                  <Wheat className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="text-lg font-bold font-mono text-[#141d18] mt-1">
                  {activePortion.carbGrams}
                </div>
                <div className="text-[10px] text-[#55645c] mt-0.5">Energi otak & belajar</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#ded7c8] shadow-2xs">
                <div className="flex items-center justify-between text-xs text-[#707e76]">
                  <span>Lemak Sehat</span>
                  <Flame className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="text-lg font-bold font-mono text-[#141d18] mt-1">
                  {activePortion.fatGrams}
                </div>
                <div className="text-[10px] text-[#55645c] mt-0.5">Pelindung organ & hormon</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white border border-[#ded7c8] shadow-2xs">
                <div className="flex items-center justify-between text-xs text-[#707e76]">
                  <span>Serat Pangan</span>
                  <Heart className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="text-lg font-bold font-mono text-[#141d18] mt-1">
                  {activePortion.fiberGrams}
                </div>
                <div className="text-[10px] text-[#55645c] mt-0.5">Pencernaan sehat</div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================
            MANFAAT & NILAI GIZI DARI MASING-MASING BAHAN
            ======================================================== */}
        <section className="bg-white rounded-3xl border border-[#ded7c8] p-5 sm:p-8 shadow-xs space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#133d2c] mb-1">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Transparansi Komponen Pangan</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif-display text-[#141d18]">
              Manfaat dan Nilai Gizi dari Masing-Masing Bahan
            </h2>
            <p className="text-xs text-[#55645c] mt-1">
              Setiap lauk dan sayur diolah dari komoditas lokal Malang dengan takaran yang disesuaikan secara ilmiah.
            </p>
          </div>

          <div className="space-y-4">
            {menuToday.ingredients.map((item: IngredientNutritionInfo) => {
              const currentPortionText = selectedPortion === 'LARGE' ? item.portionLarge : item.portionSmall;
              const isExpanded = activeIngredientId === item.id;

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-[#ded7c8] bg-[#faf8f4] overflow-hidden transition-all hover:border-[#133d2c]"
                >
                  <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* Foto & Identitas Bahan */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-white border border-[#ded7c8] shrink-0 shadow-2xs">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-[#133d2c]">
                          {item.category}
                        </div>
                        <h3 className="text-base font-bold text-[#141d18] truncate">
                          {item.name}
                        </h3>
                        <div className="text-xs text-[#55645c] font-medium mt-0.5">
                          {item.nutritionHighlight}
                        </div>
                      </div>
                    </div>

                    {/* Takaran Terpilih & Tombol Expand */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#eee7db]">
                      <div className="bg-white px-3 py-1.5 rounded-xl border border-[#ded7c8] text-right">
                        <div className="text-[10px] text-[#707e76]">
                          {selectedPortion === 'LARGE' ? 'Takaran Porsi Besar' : 'Takaran Porsi Kecil'}
                        </div>
                        <div className="text-xs sm:text-sm font-mono font-bold text-[#133d2c]">
                          {currentPortionText}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setActiveIngredientId(isExpanded ? null : item.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-[#ded7c8] hover:bg-[#f2ece1] text-[#141d18] transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isExpanded ? 'Tutup' : 'Manfaat'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Bagian Detail Manfaat Kesehatan (Expandable) */}
                  {isExpanded && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 border-t border-[#eee7db] bg-white space-y-3">
                      <div>
                        <div className="text-xs font-bold text-[#141d18]">Khasiat & Manfaat Tumbuh Kembang:</div>
                        <p className="text-xs text-[#55645c] leading-relaxed mt-1">
                          {item.healthBenefits}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#707e76] pt-2 border-t border-[#f2ece1]">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Pemasok: <strong className="text-[#141d18]">{item.supplier}</strong></span>
                        </div>
                        {item.notes && (
                          <div className="text-[11px] text-[#55645c] italic">
                            {item.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================
            QR CODE STIKER & KOTAK AKSES CEPAT
            ======================================================== */}
        <section className="bg-[#133d2c] rounded-3xl p-6 sm:p-8 text-white shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-8 space-y-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1b4e39] text-emerald-200 text-xs font-semibold">
                <QrCode className="w-3.5 h-3.5 text-emerald-300" />
                <span>Akses Cepat Pengawasan Orang Tua & Guru</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif-display text-white">
                Scan QR Code untuk Membuka Halaman Ini Kapan Saja
              </h2>
              <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed max-w-xl">
                Kode QR ini dapat dicetak dan ditempel pada wadah nampan, boks termal distribusi, maupun mading sekolah agar siswa dan orang tua dapat memverifikasi nilai gizi secara langsung.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsQrModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#133d2c] text-xs font-bold hover:bg-[#f0ece1] transition-colors cursor-pointer shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak Stiker QR Code</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#1b4e39] text-emerald-200 border border-emerald-600/40 text-xs font-semibold hover:bg-[#235d45] transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? 'Tautan Disalin!' : 'Salin Tautan'}</span>
                </button>
              </div>
            </div>

            {/* QR Code Preview Kotak Kanan */}
            <div className="md:col-span-4 flex justify-center">
              <div className="bg-white p-3 rounded-2xl shadow-lg border border-emerald-700/40 text-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="QR Code Menu Hari Ini"
                    className="w-40 h-40 object-contain mx-auto"
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-xs text-slate-400">
                    Memuat QR...
                  </div>
                )}
                <div className="text-[10px] font-mono font-bold text-[#133d2c] mt-1.5">
                  /menu-mbg-hari-ini
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Modal Cetak / Unduh Stiker QR Code */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border border-[#ded7c8] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[#eee8dc]">
              <div>
                <h3 className="text-base font-bold font-serif-display text-[#141d18]">
                  Stiker QR Code MBG Hari Ini
                </h3>
                <p className="text-[11px] text-[#707e76]">
                  Untuk wadah nampan, boks termal, atau papan mading sekolah
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="w-7 h-7 rounded-full bg-[#faf8f4] hover:bg-[#f0ece1] flex items-center justify-center text-slate-600 cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Tampilan Stiker Siap Cetak */}
            <div id="printable-qr-sticker" className="p-4 rounded-2xl border-2 border-dashed border-[#133d2c]/40 bg-[#faf8f4] text-center space-y-3">
              <div className="flex items-center justify-center gap-2">
                <img
                  src={logoSppgImg}
                  alt="Logo SPPG"
                  className="w-7 h-7 object-contain"
                />
                <div className="text-left">
                  <div className="text-[9px] font-bold text-[#133d2c]">SPPG MLG TUMPANG JERU</div>
                  <div className="text-[8px] text-[#707e76]">Badan Gizi Nasional RI</div>
                </div>
              </div>

              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt="QR Code"
                  className="w-48 h-48 mx-auto bg-white p-2 rounded-xl border border-[#ded7c8] shadow-2xs"
                />
              )}

              <div className="space-y-0.5">
                <div className="text-xs font-bold text-[#141d18]">
                  Scan Info Gizi & Menu Hari Ini
                </div>
                <div className="text-[10px] text-[#55645c]">
                  {menuToday.dateText}
                </div>
                <div className="text-[9px] font-mono text-emerald-800 pt-1">
                  domain/menu-mbg-hari-ini
                </div>
              </div>
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2 rounded-full bg-white border border-[#ded7c8] text-xs font-bold text-[#141d18] hover:bg-[#f6f2e8] transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-slate-700" />
                <span>Cetak</span>
              </button>

              {qrDataUrl && (
                <a
                  href={qrDataUrl}
                  download={`qr-menu-mbg-${menuToday.dateText.replace(/\s+/g, '-').toLowerCase()}.png`}
                  className="px-4 py-2 rounded-full bg-[#133d2c] text-white text-xs font-bold hover:bg-[#1a4f39] transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <span>Unduh PNG</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer Minimalis */}
      <footer className="bg-white border-t border-[#e5dfd3] py-6 text-center text-xs text-[#707e76]">
        <div className="max-w-5xl mx-auto px-4 space-y-1">
          <div>
            <strong>SPPG MLG TUMPANG JERU</strong> • Satuan Pelayanan Pemenuhan Gizi Nasional
          </div>
          <div className="text-[11px] text-[#909e95]">
            Jl. Pattimura No. 107, Desa Jeru, Kec. Tumpang, Kab. Malang • Badan Gizi Nasional RI
          </div>
        </div>
      </footer>
    </div>
  );
};
