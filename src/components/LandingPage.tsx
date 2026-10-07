import React, { useState, useEffect, useRef } from 'react';
import logoSppgImg from '../assets/logo sppg.png';
import trayImg1 from '../assets/tray_sample_1.jpg';
import trayImg2 from '../assets/tray_double_1.jpg';
import trayImg3 from '../assets/tray_double_2.jpg';
import posterMenuImg from '../assets/poster-single.jpg';
import {
  getWebsiteConfig,
  fetchWebsiteConfigFromCloud,
  WEBSITE_CONFIG_UPDATED_EVENT,
  WebsiteConfig
} from '../db/websiteConfigStorage';
import {
  Lock,
  ArrowRight,
  ShieldCheck,
  Building2,
  Scale,
  Truck,
  HeartHandshake,
  CheckCircle2,
  Users,
  MapPin,
  Phone,
  Mail,
  UtensilsCrossed,
  Recycle,
  Layers,
  Clock,
  Calendar,
  AlertCircle,
  FileCheck,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Award,
  ChevronDown,
  Info,
  Play,
  Pause,
  Volume2,
  VolumeX
} from 'lucide-react';

export interface LandingPageProps {
  onNavigateToLogin?: () => void;
  isStaffLoggedIn?: boolean;
  onReturnToDashboard?: () => void;
  staffName?: string;
}

interface TraySectionInfo {
  id: string;
  name: string;
  category: string;
  targetGrams: string;
  calories: string;
  supplier: string;
  description: string;
}

const TRAY_SECTIONS: TraySectionInfo[] = [
  {
    id: 'karbohidrat',
    name: 'Nasi Pulen Varietas Lokal',
    category: 'Karbohidrat Kompleks',
    targetGrams: '150 gram',
    calories: '200 kkal',
    supplier: 'Poktan Sri Rejeki, Malangsuko Tumpang',
    description: 'Beras pandanwangi lokal hasil panen petani Tumpang, dimasak dengan air tersaring bersuhu konstan untuk tekstur pulen dan mudah dicerna.'
  },
  {
    id: 'protein_hewani',
    name: 'Ayam Ungkep Rempah Bumbu Kuning',
    category: 'Protein Hewani Utama',
    targetGrams: '70 gram',
    calories: '165 kkal',
    supplier: 'UD Sumberpasir Farm, Pakis Malang',
    description: 'Daging ayam segar bersertifikasi halal, diolah dengan marinasi kunyit, jahe, dan serai tanpa tambahan pengawet atau MSG berlebih.'
  },
  {
    id: 'protein_nabati',
    name: 'Tempe Bacem Tradisional Kedelai Lokal',
    category: 'Protein Nabati',
    targetGrams: '45 gram',
    calories: '85 kkal',
    supplier: 'Rumah Produksi Tempe Krajan, Desa Jeru',
    description: 'Fermentasi kedelai non-GMO lokal dengan gula kelapa murni, kaya probiotik, zat besi, dan serat alami.'
  },
  {
    id: 'sayur',
    name: 'Sayur Sop Wortel, Buncis & Kol Segar',
    category: 'Serat & Vitamin',
    targetGrams: '75 gram',
    calories: '45 kkal',
    supplier: 'Kelompok Tani Sayur Poncokusumo',
    description: 'Sayur dataran tinggi lereng Bromo yang dipetik sore hari dan langsung dimasak subuh hari, menjaga kandungan folat dan vitamin A.'
  },
  {
    id: 'buah',
    name: 'Semangka Manis & Pisang Mas Lokal',
    category: 'Buah Segar Pemanis Alami',
    targetGrams: '60 gram',
    calories: '40 kkal',
    supplier: 'Mitra Holtikultura Malang Timur',
    description: 'Buah potong segar dicuci dengan air ozonisasi berstandar pangan, disajikan dalam wadah dingin bersekat khusus.'
  },
  {
    id: 'susu',
    name: 'Susu Sapi Murni Pasteurisasi',
    category: 'Kalsium & Nutrisi Mikro',
    targetGrams: '150 ml',
    calories: '110 kkal',
    supplier: 'Koperasi Susu Segar Malang',
    description: 'Susu sapi perah murni tanpa penambahan gula buatan, dikemas higienis berstandar BPOM untuk pertumbuhan tulang siswa.'
  }
];

export const LandingPage: React.FC<LandingPageProps> = ({
  isStaffLoggedIn = false,
  onReturnToDashboard,
  staffName
}) => {
  const [selectedTraySection, setSelectedTraySection] = useState<TraySectionInfo>(TRAY_SECTIONS[0]);
  const [config, setConfig] = useState<WebsiteConfig>(getWebsiteConfig);
  const [isMuted, setIsMuted] = useState(true);
  const [currentMenuSlide, setCurrentMenuSlide] = useState(0);
  const [isMenuPaused, setIsMenuPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Multi-Video Playlist & Loop Management
  const videoList = (config.hero.videos && config.hero.videos.length > 0)
    ? config.hero.videos
    : (config.hero.videoUrl ? [{ id: 'vid-1', title: 'Video Hero Utama', url: config.hero.videoUrl, poster: config.hero.videoPoster }] : []);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const activeVideoIndex = videoList.length > 0 ? (currentVideoIndex % videoList.length) : 0;
  const activeVideo = videoList[activeVideoIndex];

  // Handler loop otomatis saat video selesai diputar (seamless transition ke video berikutnya)
  const handleVideoEnded = () => {
    if (videoList.length > 1) {
      setCurrentVideoIndex(prev => (prev + 1) % videoList.length);
    } else if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleVideoError = () => {
    console.warn('Gagal memuat video aktif:', activeVideo?.url);
    if (videoList.length > 1) {
      setCurrentVideoIndex(prev => (prev + 1) % videoList.length);
    }
  };

  // Pastikan browser modern (Chrome, Safari, iOS) mengizinkan autoplay tanpa terhalang
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideo?.url) return;

    el.muted = isMuted;
    el.defaultMuted = true;

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Autoplay dicegah oleh kebijakan browser (menunggu interaksi):', err);
      });
    }
  }, [activeVideoIndex, activeVideo?.url, isMuted]);

  // Timer auto-switch jika pengguna mengaktifkan interval pergantian detik (> 0)
  useEffect(() => {
    const intervalSec = config.hero.videoIntervalSeconds;
    if (!intervalSec || intervalSec <= 0 || videoList.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentVideoIndex(prev => (prev + 1) % videoList.length);
    }, intervalSec * 1000);

    return () => clearInterval(timer);
  }, [config.hero.videoIntervalSeconds, videoList.length]);

  // Sinkronisasi otomatis saat konfigurasi diubah di dashboard CMS dan ambil data cloud
  useEffect(() => {
    const handleConfigUpdate = () => {
      setConfig(getWebsiteConfig());
    };
    window.addEventListener(WEBSITE_CONFIG_UPDATED_EVENT, handleConfigUpdate);

    // Tarik pembaruan konfigurasi dari Cloud Supabase di latar belakang
    fetchWebsiteConfigFromCloud().then(result => {
      if (result.fromCloud) {
        setConfig(result.config);
      }
    });

    return () => window.removeEventListener(WEBSITE_CONFIG_UPDATED_EVENT, handleConfigUpdate);
  }, []);

  // Timer Auto-Slide untuk Seksi Foto Menu
  useEffect(() => {
    const slides = config.menuSlider.slides;
    if (!config.menuSlider.autoSlide || isMenuPaused || slides.length <= 1) return;

    const intervalTime = Math.max(2, config.menuSlider.intervalSeconds || 4) * 1000;
    const timer = setInterval(() => {
      setCurrentMenuSlide(prev => (prev + 1) % slides.length);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [config.menuSlider.autoSlide, config.menuSlider.intervalSeconds, isMenuPaused, config.menuSlider.slides.length]);

  return (
    <div className="min-h-screen bg-[#faf8f4] text-[#1c2420] font-sans selection:bg-[#d8eedf] selection:text-[#0c3123] antialiased">
      {/* 1. Bar Resmi Kenegaraan */}
      <div className="bg-[#111915] text-[#9ba8a0] text-xs py-2 px-4 sm:px-6 lg:px-8 border-b border-[#222e27]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34d399]" />
            <span className="font-semibold text-slate-100">
              Badan Gizi Nasional Republik Indonesia
            </span>
            <span className="text-[#3b4b42] hidden sm:inline">•</span>
            <span className="text-[#9ba8a0] hidden sm:inline">
              Program Pemenuhan Gizi Nasional
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-[#86948b]">
            <span>Satuan Pelayanan: SPPG MLG TUMPANG JERU</span>
            <span className="text-[#3b4b42] hidden md:inline">•</span>
            <span className="hidden md:inline font-mono">Kode Satuan: SPPG-001/MLG</span>
          </div>
        </div>
      </div>

      {/* 2. Banner Pratinjau Petugas Logged In */}
      {isStaffLoggedIn && (
        <div className="bg-[#0b291d] text-[#bbf7d0] text-xs py-2.5 px-4 sm:px-6 lg:px-8 border-b border-[#164e37]">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#4ade80] animate-pulse" />
              <span>
                Pratinjau Publik Aktif • Anda sedang masuk sebagai{' '}
                <strong className="text-white font-semibold">{staffName || 'Petugas'}</strong>
              </span>
            </div>
            {onReturnToDashboard && (
              <button
                type="button"
                onClick={onReturnToDashboard}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white text-[#0b291d] font-semibold hover:bg-[#f0fdf4] transition-colors cursor-pointer text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>Kembali ke Dashboard WMS</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Header Navigasi Editorial */}
      <header className="sticky top-0 z-30 bg-[#faf8f4]/95 backdrop-blur-md border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Logo & Identitas SPPG */}
          <div className="flex items-center gap-3.5">
            <img
              src={logoSppgImg}
              alt="Logo SPPG"
              className="w-12 h-12 object-contain shrink-0 rounded-lg p-1 bg-white border border-[#ded8cb] shadow-2xs"
            />
            <div>
              <div className="text-[11px] font-semibold text-[#0c3123] tracking-wide">
                Badan Gizi Nasional RI
              </div>
              <div className="text-base font-bold text-[#141d18] font-serif-display leading-tight flex items-center gap-2">
                <span>SPPG MLG TUMPANG JERU</span>
              </div>
              <div className="text-[10px] text-[#63726a] font-medium">
                Desa Jeru, Kec. Tumpang, Kab. Malang
              </div>
            </div>
          </div>

          {/* Navigasi Seksi Publik */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-[#44534a]">
            <a href="#siklus-menu" className="hover:text-[#0c3123] transition-colors">
              Siklus Menu MBG
            </a>
            <a href="#eksplorasi-nampan" className="hover:text-[#0c3123] transition-colors">
              Eksplorasi Nampan
            </a>
            <a href="#alur-pagi" className="hover:text-[#0c3123] transition-colors">
              Rantai Waktu 04.00
            </a>
            <a href="#kajian-visual" className="hover:text-[#0c3123] transition-colors">
              Kajian Visual
            </a>
            <a href="#pemasok-malang" className="hover:text-[#0c3123] transition-colors">
              Pemasok Desa
            </a>
            <a href="#sekolah-sasaran" className="hover:text-[#0c3123] transition-colors">
              14 Sekolah
            </a>
            <a href="#kontak-pelayanan" className="hover:text-[#0c3123] transition-colors">
              Kontak
            </a>
          </nav>

          {/* Status Layanan Publik / Tombol Dashboard untuk Staf */}
          <div className="flex items-center gap-2.5">
            {isStaffLoggedIn && onReturnToDashboard ? (
              <button
                type="button"
                onClick={onReturnToDashboard}
                className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-xs font-semibold text-white bg-[#0c3123] hover:bg-[#134431] active:bg-[#071f16] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c3123]"
              >
                <Lock className="w-3.5 h-3.5 text-[#86efac]" />
                <span>Kembali ke Dashboard WMS</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#ecf7f0] text-[#0c3123] border border-[#c4e5ce]">
                <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                <span className="font-semibold">Layanan Publik Aktif</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 4. Hero Section: Editorial Headline dengan Video Latar Belakang Sinematik */}
      <section className="relative overflow-hidden pt-16 pb-16 lg:pt-24 lg:pb-28 border-b border-[#e5dfd3]">
        {/* Background Video atau Pola Alam */}
        {config.hero.backgroundType === 'video' && activeVideo?.url ? (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <video
              ref={videoRef}
              key={activeVideo.url}
              autoPlay
              muted={isMuted}
              playsInline
              webkit-playsinline="true"
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              poster={activeVideo.poster || config.hero.videoPoster || trayImg1}
              className="w-full h-full object-cover object-center filter brightness-[0.7] contrast-[1.05] transition-opacity duration-700"
            >
              <source src={activeVideo.url} type="video/mp4" />
              <source src={activeVideo.url} type="video/webm" />
            </video>
            {/* Lapisan Gradient Tint Berlapis untuk Keterbacaan Sempurna */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#0c2217]/95 via-[#0d261a]/85 to-[#081710]/75"
              style={{ opacity: config.hero.videoOverlayOpacity }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#091811] via-transparent to-[#0a1b13]/60" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-[#faf8f4]" />
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            {/* Narasi Utama */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md backdrop-blur-md text-xs font-medium border border-white/20 bg-white/10 text-emerald-200">
                <Building2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>{config.hero.heroBadge}</span>
              </div>

              <h1 className={`text-3xl sm:text-4xl lg:text-5xl font-bold font-serif-display leading-[1.15] tracking-tight ${
                config.hero.backgroundType === 'video' ? 'text-white drop-shadow-sm' : 'text-[#111915]'
              }`}>
                {config.hero.heroTitle}
              </h1>

              <p className={`text-base leading-relaxed max-w-2xl ${
                config.hero.backgroundType === 'video' ? 'text-slate-200 drop-shadow-2xs' : 'text-[#4a5850]'
              }`}>
                {config.hero.heroSubtitle}
              </p>

              {/* Tombol Aksi Publik & Kontrol Media Hero */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <a
                  href={config.hero.primaryCtaLink || '#siklus-menu'}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 transition-all cursor-pointer shadow-lg border border-emerald-500/30"
                >
                  <span>{config.hero.primaryCtaText || 'Lihat Siklus Menu MBG'}</span>
                  <ChevronRight className="w-4 h-4 text-emerald-200" />
                </a>

                <a
                  href={config.hero.secondaryCtaLink || '#alur-pagi'}
                  className={`inline-flex items-center gap-2 px-5 py-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors border ${
                    config.hero.backgroundType === 'video'
                      ? 'bg-white/15 hover:bg-white/25 text-white border-white/30 backdrop-blur-md'
                      : 'bg-white hover:bg-[#f2ece1] text-[#25322b] border-[#d8d0c0]'
                  }`}
                >
                  <Clock className="w-4 h-4 text-emerald-300" />
                  <span>{config.hero.secondaryCtaText || 'Alur Operasional 04.00 WIB'}</span>
                </a>

                {/* Kontrol Multi-Video Playlist & Suara */}
                {config.hero.backgroundType === 'video' && (
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Indikator Looping Playlist jika terdapat lebih dari 1 video */}
                    {videoList.length > 1 && (
                      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/40 hover:bg-black/60 text-white text-xs font-medium border border-white/20 backdrop-blur-md shadow-xs">
                        <button
                          type="button"
                          onClick={() => setCurrentVideoIndex(prev => (prev - 1 + videoList.length) % videoList.length)}
                          className="p-1 hover:text-emerald-300 transition-colors cursor-pointer"
                          title="Video Sebelumnya"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-semibold text-emerald-300">
                          Video {activeVideoIndex + 1}/{videoList.length}
                        </span>
                        <span className="text-slate-300 hidden sm:inline truncate max-w-[140px] md:max-w-[200px]">
                          {activeVideo?.title || 'Video Hero'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentVideoIndex(prev => (prev + 1) % videoList.length)}
                          className="p-1 hover:text-emerald-300 transition-colors cursor-pointer"
                          title="Video Berikutnya"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Tombol Kontrol Suara Video */}
                    <button
                      type="button"
                      onClick={() => {
                        if (videoRef.current) {
                          videoRef.current.muted = !videoRef.current.muted;
                          setIsMuted(videoRef.current.muted);
                        }
                      }}
                      title={isMuted ? 'Nyalakan audio video latar' : 'Bisukan audio video latar'}
                      className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-black/40 hover:bg-black/60 text-white text-xs font-medium border border-white/20 backdrop-blur-md transition-colors cursor-pointer shadow-xs"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4 text-slate-300" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                      <span className="hidden sm:inline">{isMuted ? 'Hening' : 'Suara Aktif'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Nilai Utama Rantai Pasok */}
              <div className={`pt-6 border-t grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs ${
                config.hero.backgroundType === 'video'
                  ? 'border-white/15 text-slate-200'
                  : 'border-[#e8e2d6] text-[#44534a]'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className={`font-semibold ${config.hero.backgroundType === 'video' ? 'text-white' : 'text-[#1c2420]'}`}>
                    100% Timbangan Riil
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className={`font-semibold ${config.hero.backgroundType === 'video' ? 'text-white' : 'text-[#1c2420]'}`}>
                    Wadah SUS 304 Food-Grade
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className={`font-semibold ${config.hero.backgroundType === 'video' ? 'text-white' : 'text-[#1c2420]'}`}>
                    Zero Organic Waste
                  </span>
                </div>
              </div>
            </div>

            {/* Visual Nyata Makanan & Lembar Data */}
            <div className="lg:col-span-5">
              <div className={`rounded-2xl p-3.5 border shadow-xl backdrop-blur-md ${
                config.hero.backgroundType === 'video'
                  ? 'bg-slate-900/80 border-slate-700/80'
                  : 'bg-white border-[#ded7c8]'
              }`}>
                <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-4/3 border border-slate-700/60 shadow-inner">
                  <img
                    src={trayImg1}
                    alt="Standar sajian nampan makan bergizi gratis SPPG Jeru"
                    className="w-full h-full object-cover object-center"
                  />
                  <div className="absolute top-3 left-3 bg-[#111915]/90 text-white text-[11px] font-medium px-2.5 py-1 rounded-md border border-slate-700 flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />
                    <span>Dokumentasi Lapangan Nyata</span>
                  </div>
                  {config.hero.backgroundType === 'video' && (
                    <div className="absolute bottom-3 right-3 bg-black/75 text-emerald-300 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-emerald-500/30">
                      Live Feed Video Background
                    </div>
                  )}
                </div>

                <div className={`mt-3.5 p-3 rounded-lg border space-y-1 ${
                  config.hero.backgroundType === 'video'
                    ? 'bg-slate-800/90 border-slate-700 text-slate-200'
                    : 'bg-[#f7f4ec] border-[#e8e2d4]'
                }`}>
                  <div className="flex items-center justify-between text-xs">
                    <span className={`font-bold ${config.hero.backgroundType === 'video' ? 'text-white' : 'text-[#141d18]'}`}>
                      Sajian Porsi Lengkap MBG
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400 font-bold">AKG 1/3 Harian</span>
                  </div>
                  <p className={`text-[11px] leading-relaxed ${
                    config.hero.backgroundType === 'video' ? 'text-slate-300' : 'text-[#55645c]'
                  }`}>
                    Nasi pulen, ayam ungkep rempah, tempe bacem kedelai lokal, sayur sop segar, buah semangka, dan susu pasteurisasi.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Scorecard Operasional (Tabular Data & Metric Strip) */}
      <section className="bg-white border-b border-[#e5dfd3] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-4 sm:p-5 rounded-xl bg-[#faf8f4] border border-[#e3dccf]">
              <div className="text-3xl sm:text-4xl font-bold font-serif-display text-[#0c3123] tabular-nums">
                3.044
              </div>
              <div className="text-xs font-bold text-[#1a231f] mt-1.5">
                Porsi Harian Terdistribusi
              </div>
              <div className="text-[11px] text-[#5f6f66] mt-1">
                Kapasitas produksi dapur higienis per hari aktif sekolah
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-[#faf8f4] border border-[#e3dccf]">
              <div className="text-3xl sm:text-4xl font-bold font-serif-display text-[#0c3123] tabular-nums">
                14
              </div>
              <div className="text-xs font-bold text-[#1a231f] mt-1.5">
                Sekolah Sasaran Penerima
              </div>
              <div className="text-[11px] text-[#5f6f66] mt-1">
                SDN, SMPN, dan MI di wilayah Kecamatan Tumpang
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-[#faf8f4] border border-[#e3dccf]">
              <div className="text-3xl sm:text-4xl font-bold font-serif-display text-[#0c3123] tabular-nums">
                10+
              </div>
              <div className="text-xs font-bold text-[#1a231f] mt-1.5">
                Kelompok Tani & Pemasok Lokal
              </div>
              <div className="text-[11px] text-[#5f6f66] mt-1">
                Peternak ayam Pakis, beras Tumpang, sayur Poncokusumo
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-xl bg-[#faf8f4] border border-[#e3dccf]">
              <div className="text-3xl sm:text-4xl font-bold font-serif-display text-[#0c3123] tabular-nums">
                100%
              </div>
              <div className="text-xs font-bold text-[#1a231f] mt-1.5">
                Verifikasi Timbangan Riil
              </div>
              <div className="text-[11px] text-[#5f6f66] mt-1">
                Pencatatan digital FIFO & uji organoleptik harian
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5.5. Seksi Interaktif: Siklus Menu Makanan Bergizi & Auto-Slide Carousel */}
      <section
        id="siklus-menu"
        className="py-16 lg:py-22 bg-[#f6f2e8] border-b border-[#e5dfd3] relative overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Seksi */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#ecf7f0] text-[#0c3123] border border-[#c4e5ce] text-xs font-semibold mb-2">
                <UtensilsCrossed className="w-3.5 h-3.5 text-[#0c3123]" />
                <span>{config.menuSlider.sectionBadge || 'Siklus Pangan Bergizi'}</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#111915] leading-tight">
                {config.menuSlider.sectionTitle || 'Koleksi Foto Menu & Siklus Porsi Gizi MBG'}
              </h2>
              <p className="text-sm text-[#4d5c53] mt-2.5 leading-relaxed">
                {config.menuSlider.sectionSubtitle || 'Variasi olahan makanan harian yang dirotasi secara berkala guna mencukupi kebutuhan energi, protein hewani, protein nabati, dan mikronutrien anak sekolah.'}
              </p>
            </div>

            {/* Kontrol Auto-Slide & Navigasi Cepat */}
            <div className="flex items-center gap-3 shrink-0">
              {config.menuSlider.autoSlide && (
                <button
                  type="button"
                  onClick={() => setIsMenuPaused(!isMenuPaused)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#ded7c8] text-xs font-semibold text-[#0c3123] hover:bg-[#fcfbf9] transition-colors cursor-pointer shadow-2xs"
                  title={isMenuPaused ? 'Lanjutkan putar otomatis' : 'Jeda putar otomatis'}
                >
                  {isMenuPaused ? <Play className="w-3.5 h-3.5 text-emerald-700" /> : <Pause className="w-3.5 h-3.5 text-amber-700" />}
                  <span>{isMenuPaused ? 'Lanjut Putar' : `Auto-Slide (${config.menuSlider.intervalSeconds}s)`}</span>
                </button>
              )}

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#ded7c8] shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    const total = config.menuSlider.slides.length;
                    setCurrentMenuSlide(prev => (prev - 1 + total) % total);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#f2ece1] text-[#0c3123] transition-colors cursor-pointer"
                  title="Menu Sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-2 text-[#2d3b32]">
                  {currentMenuSlide + 1} / {config.menuSlider.slides.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const total = config.menuSlider.slides.length;
                    setCurrentMenuSlide(prev => (prev + 1) % total);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#f2ece1] text-[#0c3123] transition-colors cursor-pointer"
                  title="Menu Berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Tab Filter Hari Cepat */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {config.menuSlider.slides.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentMenuSlide(idx)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  currentMenuSlide === idx
                    ? 'bg-[#0c3123] text-white shadow-xs'
                    : 'bg-white text-[#44534a] border border-[#ded7c8] hover:bg-[#fbf9f5]'
                }`}
              >
                <span>{s.day}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  currentMenuSlide === idx ? 'bg-emerald-800 text-emerald-200' : 'bg-slate-100 text-slate-600'
                }`}>
                  #{idx + 1}
                </span>
              </button>
            ))}
          </div>

          {/* Kartu Utama Slide Menu Terpilih */}
          {(() => {
            const slide = config.menuSlider.slides[currentMenuSlide] || config.menuSlider.slides[0];
            if (!slide) return null;

            return (
              <div
                onMouseEnter={() => {
                  if (config.menuSlider.pauseOnHover) setIsMenuPaused(true);
                }}
                onMouseLeave={() => {
                  if (config.menuSlider.pauseOnHover) setIsMenuPaused(false);
                }}
                className="bg-white rounded-3xl border border-[#ded7c8] shadow-md overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 transition-all"
              >
                {/* Kolom Kiri: Foto Sajian Menu Resolusi Tinggi */}
                <div className="lg:col-span-7 relative bg-slate-950 aspect-4/3 lg:aspect-auto overflow-hidden group">
                  <img
                    key={slide.imageUrl}
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="w-full h-full object-cover object-center transition-all duration-500 group-hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                  {/* Badges Atas */}
                  <div className="absolute top-4 left-4 flex flex-wrap items-center gap-2">
                    <span className="bg-[#0c3123]/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-lg border border-emerald-600/40 shadow-xs">
                      {slide.day}
                    </span>
                    <span className="bg-white/90 backdrop-blur-md text-[#0c3123] text-xs font-semibold px-2.5 py-1 rounded-lg shadow-xs">
                      {slide.category}
                    </span>
                  </div>

                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white text-xs">
                    <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20">
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span className="font-medium font-mono text-[11px]">{slide.calories}</span>
                    </div>

                    {slide.targetGrams && (
                      <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg border border-white/20 font-mono text-[11px]">
                        Target Porsi: {slide.targetGrams}
                      </div>
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: Rincian Resep & Spesifikasi Gizi */}
                <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0c3123] uppercase tracking-wider">
                        Spesifikasi Porsi Harian
                      </span>
                      <span className="text-xs font-mono text-slate-500 font-medium">
                        Slide {currentMenuSlide + 1} dari {config.menuSlider.slides.length}
                      </span>
                    </div>

                    <h3 className="text-xl sm:text-2xl font-bold font-serif-display text-[#111915] leading-snug">
                      {slide.title}
                    </h3>

                    <div className="p-3.5 rounded-xl bg-[#faf8f4] border border-[#e8e2d4] space-y-2">
                      <div className="text-xs font-bold text-[#141d18]">Komponen Sajian Terpadu:</div>
                      <p className="text-xs text-[#4d5c53] leading-relaxed">
                        {slide.description}
                      </p>
                    </div>

                    {slide.allergens && (
                      <div className="flex items-center gap-2 text-xs text-[#0c3123] font-medium bg-[#ecf7f0] p-2.5 rounded-lg border border-[#c4e5ce]">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{slide.allergens}</span>
                      </div>
                    )}
                  </div>

                  {/* Indikator Titik Progress Slide */}
                  <div className="pt-4 border-t border-[#eee8dc] flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {config.menuSlider.slides.map((_, dotIdx) => (
                        <button
                          key={dotIdx}
                          type="button"
                          onClick={() => setCurrentMenuSlide(dotIdx)}
                          className={`h-2 rounded-full transition-all cursor-pointer ${
                            currentMenuSlide === dotIdx ? 'w-7 bg-[#0c3123]' : 'w-2 bg-[#ded7c8] hover:bg-[#8e9d95]'
                          }`}
                          title={`Buka slide ${dotIdx + 1}`}
                        />
                      ))}
                    </div>

                    <a
                      href="#eksplorasi-nampan"
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#0c3123] hover:underline"
                    >
                      <span>Lihat Gramatur Detail Nampan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* 6. Komponen Interaktif: Eksplorasi Nampan 5 Sekat SUS 304 */}
      <section id="eksplorasi-nampan" className="py-16 lg:py-20 bg-[#faf8f4] border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-bold text-[#0c3123] uppercase tracking-wider">
              Anatomi Porsi Pangan
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#111915] mt-1 leading-tight">
              Eksplorasi Takaran & Sumber Bahan Setiap Sekat
            </h2>
            <p className="text-sm text-[#4d5c53] mt-3 leading-relaxed">
              Klik salah satu komponen sekat di bawah untuk memeriksa gramatur target, estimasi nilai energi, serta kelompok tani yang memasok bahan bakunya.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Navigasi Pilihan Sekat */}
            <div className="lg:col-span-5 space-y-2">
              {TRAY_SECTIONS.map((sec) => {
                const isSelected = selectedTraySection.id === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setSelectedTraySection(sec)}
                    className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#0c3123] text-white border-[#0c3123] shadow-xs'
                        : 'bg-white text-[#222d27] border-[#ded7c8] hover:bg-[#f6f2e8]'
                    }`}
                  >
                    <div>
                      <div className={`text-[11px] font-semibold ${isSelected ? 'text-[#86efac]' : 'text-[#0c3123]'}`}>
                        {sec.category}
                      </div>
                      <div className="text-sm font-bold mt-0.5">{sec.name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-xs font-mono font-bold ${isSelected ? 'text-white' : 'text-[#1c2420]'}`}>
                        {sec.targetGrams}
                      </div>
                      <div className={`text-[10px] ${isSelected ? 'text-slate-300' : 'text-[#63726a]'}`}>
                        {sec.calories}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Kartu Rincian Spesifikasi Terpilih */}
            <div className="lg:col-span-7 bg-white rounded-2xl p-6 sm:p-8 border border-[#ded7c8] shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-[#eee8dc]">
                <div>
                  <div className="text-xs font-bold text-[#0c3123]">
                    {selectedTraySection.category}
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold font-serif-display text-[#111915] mt-1">
                    {selectedTraySection.name}
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-[#f2ece1] px-3 py-1.5 rounded-lg border border-[#ded5c5] text-right">
                    <div className="text-[10px] text-[#55645c]">Takaran Matang</div>
                    <div className="text-sm font-mono font-bold text-[#0c3123]">
                      {selectedTraySection.targetGrams}
                    </div>
                  </div>
                  <div className="bg-[#f2ece1] px-3 py-1.5 rounded-lg border border-[#ded5c5] text-right">
                    <div className="text-[10px] text-[#55645c]">Nilai Kalori</div>
                    <div className="text-sm font-mono font-bold text-[#0c3123]">
                      {selectedTraySection.calories}
                    </div>
                  </div>
                </div>
              </div>

              <div className="py-6 space-y-4">
                <div>
                  <div className="text-xs font-bold text-[#141d18]">Deskripsi Pengolahan & Nutrisi:</div>
                  <p className="text-sm text-[#4d5c53] mt-1.5 leading-relaxed">
                    {selectedTraySection.description}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-[#faf8f4] border border-[#e8e2d4] flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-[#0c3123] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-[#141d18]">Sumber Pemasok Pertanian:</div>
                    <div className="text-xs text-[#0c3123] font-semibold mt-0.5">
                      {selectedTraySection.supplier}
                    </div>
                    <div className="text-[11px] text-[#63726a] mt-0.5">
                      Terdaftar dalam Master Supplier WMS SPPG MLG TUMPANG JERU dengan verifikasi nota timbangan fisik.
                    </div>
                  </div>
                </div>
              </div>

              {/* Jaminan Higienitas */}
              <div className="pt-5 border-t border-[#eee8dc] flex flex-wrap items-center justify-between gap-3 text-xs text-[#55645c]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0c3123]" />
                  <span>Wadah SUS 304 Tahan Karat Food-Grade</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#0c3123]" />
                  <span>Uji Organoleptik Rasa & Suhu</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Alur Kronologis Operasional Pagi (04.00 - 13.00 WIB) */}
      <section id="alur-pagi" className="py-16 lg:py-20 bg-white border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-bold text-[#0c3123] uppercase tracking-wider">
              Disiplin Waktu Operasional
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#111915] mt-1 leading-tight">
              Rantai Waktu 04.00 Pagi Menuju Meja Siswa
            </h2>
            <p className="text-sm text-[#4d5c53] mt-3 leading-relaxed">
              Jadwal ketat satuan pelayanan dirancang agar makanan disajikan hangat dan segar di waktu istirahat sekolah tanpa pernah terlambat.
            </p>
          </div>

          <div className="space-y-4">
            {/* Jam 04.00 */}
            <div className="p-6 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[#0c3123] transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#0c3123] text-white font-mono text-sm font-bold flex items-center justify-center shrink-0">
                  04.00
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0c3123]">Langkah 1: Dok Penerimaan</div>
                  <h3 className="text-base font-bold font-serif-display text-[#111915] mt-0.5">
                    Penerimaan & Verifikasi Timbangan Fisik
                  </h3>
                  <p className="text-xs text-[#55645c] mt-1 max-w-2xl leading-relaxed">
                    Petugas asisten lapangan menimbang bahan baku basah dan kering dari petani lokal, mencocokkan nota surat jalan, dan mengecek kesegaran bahan sebelum masuk gudang.
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#55645c] shrink-0 md:text-right font-medium">
                Pencatatan digital FIFO & Uji Visual
              </div>
            </div>

            {/* Jam 05.30 */}
            <div className="p-6 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[#0c3123] transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#0c3123] text-white font-mono text-sm font-bold flex items-center justify-center shrink-0">
                  05.30
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0c3123]">Langkah 2: Dapur Higienis</div>
                  <h3 className="text-base font-bold font-serif-display text-[#111915] mt-0.5">
                    Persiapan Bahan & Pengolahan Masakan
                  </h3>
                  <p className="text-xs text-[#55645c] mt-1 max-w-2xl leading-relaxed">
                    Tim juru masak mengenakan APD lengkap (penutup kepala, celemek, masker, sarung tangan), mengolah masakan dalam panci stainless besar bersuhu terukur.
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#55645c] shrink-0 md:text-right font-medium">
                Suhu inti matang daging ≥ 75°C
              </div>
            </div>

            {/* Jam 08.00 */}
            <div className="p-6 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[#0c3123] transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#0c3123] text-white font-mono text-sm font-bold flex items-center justify-center shrink-0">
                  08.00
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0c3123]">Langkah 3: Kendali Mutu</div>
                  <h3 className="text-base font-bold font-serif-display text-[#111915] mt-0.5">
                    Uji Organoleptik & Penataan Wadah SUS 304
                  </h3>
                  <p className="text-xs text-[#55645c] mt-1 max-w-2xl leading-relaxed">
                    Kepala SPPG menguji rasa, tekstur, aroma, dan menyimpan sampel makanan 24 jam dalam lemari pendingin. Nampan 5 sekat diisi sesuai gramatur standar.
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#55645c] shrink-0 md:text-right font-medium">
                Penyimpanan sampel arsip uji lab
              </div>
            </div>

            {/* Jam 09.30 */}
            <div className="p-6 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[#0c3123] transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#0c3123] text-white font-mono text-sm font-bold flex items-center justify-center shrink-0">
                  09.30
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0c3123]">Langkah 4: Logistik Rantai Pasok</div>
                  <h3 className="text-base font-bold font-serif-display text-[#111915] mt-0.5">
                    Distribusi Armada Tertutup ke 14 Sekolah
                  </h3>
                  <p className="text-xs text-[#55645c] mt-1 max-w-2xl leading-relaxed">
                    Wadah disusun rapi dalam boks termal dan diangkut dengan armada tertutup menuju SDN 1 Jeru, SMPN 1 Tumpang, dan 12 titik sasaran lainnya.
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#55645c] shrink-0 md:text-right font-medium">
                Tiba sebelum jam istirahat pertama
              </div>
            </div>

            {/* Jam 12.30 */}
            <div className="p-6 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[#0c3123] transition-colors">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-[#0c3123] text-white font-mono text-sm font-bold flex items-center justify-center shrink-0">
                  12.30
                </div>
                <div>
                  <div className="text-xs font-bold text-[#0c3123]">Langkah 5: Sanitasi & Evaluasi</div>
                  <h3 className="text-base font-bold font-serif-display text-[#111915] mt-0.5">
                    Penarikan Wadah Kotor & Zero Organic Waste
                  </h3>
                  <p className="text-xs text-[#55645c] mt-1 max-w-2xl leading-relaxed">
                    Wadah dijemput, dicuci dengan mesin uap panas, dan disterilkan untuk hari berikutnya. Sisa kupasan sayur dialirkan sebagai pakan ternak warga Desa Jeru.
                  </p>
                </div>
              </div>
              <div className="text-xs text-[#55645c] shrink-0 md:text-right font-medium">
                Sterilisasi suhu tinggi & daur ulang sisa
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Galeri Dokumentasi Fotografi Nyata (Kajian Visual) */}
      <section id="kajian-visual" className="py-16 lg:py-20 bg-[#faf8f4] border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-bold text-[#0c3123] uppercase tracking-wider">
              {config.visualStudy.sectionBadge || 'Dokumentasi Arsip Unit'}
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#111915] mt-1 leading-tight">
              {config.visualStudy.sectionTitle || 'Kajian Visual Sajian Makanan di Lapangan'}
            </h2>
            <p className="text-sm text-[#4d5c53] mt-3 leading-relaxed">
              {config.visualStudy.sectionSubtitle || 'Foto riil dari fasilitas dapur dan persiapan penyajian SPPG MLG TUMPANG JERU.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {config.visualStudy.items.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-3 border border-[#ded7c8] shadow-xs flex flex-col justify-between hover:border-[#0c3123] transition-colors group">
                <div>
                  <div className="aspect-4/3 rounded-xl overflow-hidden bg-slate-900 border border-[#ded7c8] relative">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                    {item.badge && (
                      <div className="absolute top-2.5 left-2.5 bg-[#0c3123]/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow-xs">
                        {item.badge}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-[10px] font-bold text-[#0c3123] uppercase tracking-wide">
                      {item.category}
                    </div>
                    <div className="text-sm font-bold text-[#141d18] mt-0.5">{item.title}</div>
                    <p className="text-[11px] text-[#55645c] mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {item.date && (
                  <div className="px-3 pb-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>{item.date}</span>
                    <span className="text-emerald-700 font-medium">Terverifikasi Tim QC</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Pemasok Pertanian & UMKM Desa Jeru dan Sekitarnya */}
      <section id="pemasok-malang" className="py-16 lg:py-20 bg-white border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-bold text-[#0c3123] uppercase tracking-wider">
              Kedaulatan Pangan Desa
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#111915] mt-1 leading-tight">
              Pemasok Pertanian Lokal & Industri Rumahan Malang
            </h2>
            <p className="text-sm text-[#4d5c53] mt-3 leading-relaxed">
              Seluruh anggaran belanja bahan baku pangan dialirkan langsung kepada kelompok tani dan peternak di wilayah Tumpang, Pakis, dan Poncokusumo untuk memajukan perekonomian desa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] space-y-2">
              <div className="text-xs font-bold text-[#111915]">UD Sumberpasir Farm</div>
              <div className="text-[11px] text-[#55645c]">Kecamatan Pakis, Kab. Malang</div>
              <div className="pt-2 text-xs font-semibold text-[#0c3123]">
                Pasokan: Telur Segar & Daging Ayam
              </div>
              <div className="text-[11px] text-[#6b7b72] leading-relaxed">
                Peternakan ayam ras petelur mandiri dengan sanitasi kandang teruji.
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] space-y-2">
              <div className="text-xs font-bold text-[#111915]">Poktan Padi Sri Rejeki</div>
              <div className="text-[11px] text-[#55645c]">Desa Malangsuko, Kec. Tumpang</div>
              <div className="pt-2 text-xs font-semibold text-[#0c3123]">
                Pasokan: Beras Pandanwangi Lokal
              </div>
              <div className="text-[11px] text-[#6b7b72] leading-relaxed">
                Penggilingan beras lokal tanpa pemutih kimiawi, langsung dari sawah Tumpang.
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] space-y-2">
              <div className="text-xs font-bold text-[#111915]">Tani Makmur Poncokusumo</div>
              <div className="text-[11px] text-[#55645c]">Lereng Bromo, Poncokusumo</div>
              <div className="pt-2 text-xs font-semibold text-[#0c3123]">
                Pasokan: Sayur Mayur Dataran Tinggi
              </div>
              <div className="text-[11px] text-[#6b7b72] leading-relaxed">
                Wortel manis, buncis renyah, dan brokoli segar dari tanah vulkanik subur.
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] space-y-2">
              <div className="text-xs font-bold text-[#111915]">Sentra Tempe Krajan Jeru</div>
              <div className="text-[11px] text-[#55645c]">Dsn. Krajan, Desa Jeru, Tumpang</div>
              <div className="pt-2 text-xs font-semibold text-[#0c3123]">
                Pasokan: Tempe & Tahu Kedelai
              </div>
              <div className="text-[11px] text-[#6b7b72] leading-relaxed">
                Pengrajin kedelai tradisional tetangga unit dengan proses fermentasi higienis.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. Direktori 14 Sekolah Binaan */}
      <section id="sekolah-sasaran" className="py-16 lg:py-20 bg-[#faf8f4] border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-12">
            <div className="text-xs font-bold text-[#0c3123] uppercase tracking-wider">
              Wilayah Layanan Pendidikan
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#111915] mt-1 leading-tight">
              14 Sekolah Sasaran Penerima Manfaat
            </h2>
            <p className="text-sm text-[#4d5c53] mt-3 leading-relaxed">
              Lembaga pendidikan formal penerima distribusi rutin setiap hari efektif belajar di wilayah Kecamatan Tumpang.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { name: 'SDN 1 Jeru', loc: 'Desa Jeru, Tumpang', target: '240 Siswa' },
              { name: 'SDN 2 Jeru', loc: 'Desa Jeru, Tumpang', target: '185 Siswa' },
              { name: 'SDN 1 Malangsuko', loc: 'Malangsuko, Tumpang', target: '295 Siswa' },
              { name: 'SDN 2 Malangsuko', loc: 'Malangsuko, Tumpang', target: '210 Siswa' },
              { name: 'SDN 1 Tumpang', loc: 'Pusat Tumpang', target: '380 Siswa' },
              { name: 'SDN 2 Tumpang', loc: 'Raya Tumpang', target: '260 Siswa' },
              { name: 'SDN 3 Tumpang', loc: 'Krajan Tumpang', target: '190 Siswa' },
              { name: 'SMPN 1 Tumpang', loc: 'Kauman, Tumpang', target: '520 Siswa' },
              { name: 'SMPN 2 Tumpang', loc: 'Kebonsari, Tumpang', target: '340 Siswa' },
              { name: 'MI Miftahul Huda', loc: 'Dsn. Krajan, Jeru', target: '145 Siswa' },
              { name: 'MI Nurul Huda', loc: 'Tumpang Barat', target: '130 Siswa' },
              { name: 'MTs Al-Ittihad', loc: 'Kecamatan Tumpang', target: '149 Siswa' },
            ].map((sch, idx) => (
              <div
                key={idx}
                className="bg-white p-4 rounded-xl border border-[#ded7c8] flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs font-bold text-[#141d18]">{sch.name}</div>
                  <div className="text-[11px] text-[#55645c]">{sch.loc}</div>
                </div>
                <div className="text-[11px] font-mono font-bold text-[#0c3123] bg-[#ecf7f0] border border-[#c4e5ce] px-2 py-0.5 rounded shrink-0">
                  {sch.target}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 11. Komitmen Kemitraan Publik */}
      <section className="py-16 bg-white border-b border-[#e5dfd3]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#111915] rounded-3xl p-8 sm:p-12 text-white border border-[#222e27] flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-[#19241f] text-[#86efac] text-xs font-medium border border-[#26372f]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#34d399]" />
                <span>Pelayanan Pemenuhan Gizi Nasional</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-serif-display leading-tight">
                Komitmen Mutu & Pengawasan Terbuka
              </h2>
              <p className="text-xs sm:text-sm text-[#9ba8a0] leading-relaxed">
                SPPG MLG TUMPANG JERU membuka komunikasi terbuka bersama komite sekolah, dewan guru, dan orang tua murid demi memastikan asupan gizi anak-anak kita selalu prima.
              </p>
            </div>

            <div className="shrink-0">
              <a
                href="#kontak-pelayanan"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl text-xs sm:text-sm font-bold text-[#111915] bg-white hover:bg-[#f0ece1] transition-colors cursor-pointer"
              >
                <span>Hubungi Layanan Unit</span>
                <ArrowRight className="w-4 h-4 text-[#0c3123]" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 12. Footer Resmi Lembaga */}
      <footer id="kontak-pelayanan" className="bg-[#111915] text-[#86948b] text-xs py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-10 border-b border-[#222e27]">
            {/* Identitas */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src={logoSppgImg}
                  alt="Logo SPPG"
                  className="w-10 h-10 object-contain rounded-lg p-1 bg-white/10 border border-white/20"
                />
                <div>
                  <div className="text-white font-bold font-serif-display text-base">SPPG MLG TUMPANG JERU</div>
                  <div className="text-[11px] text-[#86948b]">Satuan Pelayanan Pemenuhan Gizi</div>
                </div>
              </div>
              <p className="text-[11px] text-[#86948b] leading-relaxed max-w-md">
                Unit Pelaksana Program Pemenuhan Gizi Nasional Badan Gizi Nasional Republik Indonesia. Bertanggung jawab atas pengelolaan rantai pasok bahan pangan, produksi dapur higienis, dan pengantaran makanan bergizi di wilayah Kecamatan Tumpang, Kabupaten Malang.
              </p>
            </div>

            {/* Lokasi */}
            <div className="space-y-2.5">
              <div className="text-slate-200 font-semibold text-xs flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#34d399]" />
                <span>Alamat Kantor & Gudang</span>
              </div>
              <p className="text-[11px] text-[#86948b] leading-relaxed">
                Jl. Pattimura No. 107, Dsn. Krajan, Desa Jeru, Kec. Tumpang, Kabupaten Malang, Jawa Timur 65156.
              </p>
              <div className="text-[11px] text-[#55645c] pt-1">
                Kawasan Sentra Dapur Higienis SPPG Jeru
              </div>
            </div>

            {/* Jam Operasional */}
            <div className="space-y-2.5">
              <div className="text-slate-200 font-semibold text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#34d399]" />
                <span>Jadwal Operasional Harian</span>
              </div>
              <ul className="space-y-1.5 text-[11px] text-[#86948b]">
                <li>Senin – Sabtu: 04.00 – 14.00 WIB</li>
                <li>Penerimaan Bahan: 04.30 – 07.00 WIB</li>
                <li>Distribusi Makanan: 09.30 – 11.00 WIB</li>
                <li className="text-[#55645c] pt-1">Minggu & Hari Libur Nasional: Tutup</li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#55645c]">
            <div>
              © 2026 Badan Gizi Nasional Republik Indonesia. Seluruh hak cipta dilindungi undang-undang.
            </div>
            <div>
              Satuan Pelayanan SPPG MLG TUMPANG JERU • Portal Informasi Publik
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
