import React, { useState, useEffect, useRef } from 'react';
import logoSppgImg from '../assets/logo sppg.png';
import trayImg1 from '../assets/tray_sample_1.jpg';
import trayImg2 from '../assets/tray_double_1.jpg';
import trayImg3 from '../assets/tray_double_2.jpg';
import posterMenuImg from '../assets/poster-single.jpg';
import posterDoubleImg from '../assets/poster-double.jpg';
import sppgBuildingImg from '../assets/sppg_building.jpg';
import nasiPutihBowlImg from '../assets/nasi_putih_bowl.jpg';
import ayamBumbuKuningImg from '../assets/ayam_bumbu_kuning.jpg';
import tempeBacemImg from '../assets/tempe_bacem.jpg';
import sayurSopImg from '../assets/sayur_sop.jpg';
import buahPisangImg from '../assets/buah_pisang.jpg';
import sawahPadiImg from '../assets/sawah_padi.jpg';
import peternakanAyamImg from '../assets/peternakan_ayam.jpg';
import kebunSayurImg from '../assets/kebun_sayur.jpg';
import tempeMentahImg from '../assets/tempe_mentah.jpg';
import operasionalPenerimaanImg from '../assets/operasional_penerimaan.jpg';
import operasionalPengolahanImg from '../assets/operasional_pengolahan.jpg';
import operasionalPengemasanImg from '../assets/operasional_pengemasan.jpg';
import operasionalDistribusiImg from '../assets/operasional_distribusi.jpg';
import penyaluranSiswaImg from '../assets/penyaluran_siswa.jpg';
import {
  getWebsiteConfig,
  fetchWebsiteConfigFromCloud,
  WEBSITE_CONFIG_UPDATED_EVENT,
  DEFAULT_WEBSITE_CONFIG,
  WebsiteConfig
} from '../db/websiteConfigStorage';
import {
  Lock,
  LayoutDashboard,
  LayoutGrid,
  ArrowRight,
  ShieldCheck,
  Building2,
  Home,
  Scale,
  Leaf,
  Utensils,
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

export const WEEKLY_MENUS = [
  {
    day: 'Senin',
    date: '12 Jan 2026',
    title: 'Nasi Putih, Ayam Bumbu Kuning, Sayur Sop, dan Tempe',
    description: 'Menu yang disiapkan untuk penyaluran MBG hari ini.',
    image: trayImg1,
    components: [
      { name: 'Nasi Putih', image: nasiPutihBowlImg },
      { name: 'Ayam Bumbu Kuning', image: ayamBumbuKuningImg },
      { name: 'Sayur Sop', image: sayurSopImg },
      { name: 'Tempe', image: tempeBacemImg },
      { name: 'Buah Pisang', image: buahPisangImg },
    ]
  },
  {
    day: 'Selasa',
    date: '13 Jan 2026',
    title: 'Nasi Putih, Semur Daging Sapi, Perkedel, dan Tumis Buncis',
    description: 'Kaya zat besi hewani dan serat pangan untuk energi belajar optimal.',
    image: posterDoubleImg,
    components: [
      { name: 'Nasi Putih', image: nasiPutihBowlImg },
      { name: 'Semur Daging Sapi', image: ayamBumbuKuningImg },
      { name: 'Tumis Buncis', image: sayurSopImg },
      { name: 'Perkedel Kentang', image: tempeBacemImg },
      { name: 'Buah Pisang', image: buahPisangImg },
    ]
  },
  {
    day: 'Rabu',
    date: '14 Jan 2026',
    title: 'Nasi Putih, Ikan Bandeng Presto, Tahu Bacem, dan Sayur Bayam',
    description: 'Sumber asam lemak omega-3 dan zat besi penunjang daya konsentrasi siswa.',
    image: trayImg2,
    components: [
      { name: 'Nasi Putih', image: nasiPutihBowlImg },
      { name: 'Ikan Bandeng', image: ayamBumbuKuningImg },
      { name: 'Sayur Bayam', image: sayurSopImg },
      { name: 'Tahu Bacem', image: tempeBacemImg },
      { name: 'Buah Semangka', image: buahPisangImg },
    ]
  },
  {
    day: 'Kamis',
    date: '15 Jan 2026',
    title: 'Nasi Liwet Rempah, Ayam Panggang Madu, Tempe Mendoan, dan Capcay',
    description: 'Perpaduan cita rasa rempah nusantara minim minyak jenuh dengan nutrisi seimbang.',
    image: trayImg3,
    components: [
      { name: 'Nasi Liwet', image: nasiPutihBowlImg },
      { name: 'Ayam Panggang', image: ayamBumbuKuningImg },
      { name: 'Capcay Sayur', image: sayurSopImg },
      { name: 'Tempe Mendoan', image: tempeBacemImg },
      { name: 'Buah Pepaya', image: buahPisangImg },
    ]
  },
  {
    day: 'Jumat',
    date: '16 Jan 2026',
    title: 'Nasi Timbel, Telur Balado, Orek Tempe Manis, dan Sayur Lodeh',
    description: 'Porsi gizi seimbang dengan cita rasa tradisional yang disukai seluruh siswa.',
    image: posterMenuImg,
    components: [
      { name: 'Nasi Timbel', image: nasiPutihBowlImg },
      { name: 'Telur Balado', image: ayamBumbuKuningImg },
      { name: 'Sayur Lodeh', image: sayurSopImg },
      { name: 'Orek Tempe', image: tempeBacemImg },
      { name: 'Buah Jeruk', image: buahPisangImg },
    ]
  }
];

export const FOOD_COMPONENTS = [
  {
    id: 'karbohidrat',
    category: 'Karbohidrat',
    title: 'Nasi Putih',
    portion: 'Sesuai hasil penimbangan',
    origin: 'Beras lokal (sesuai ketersediaan)',
    description: 'Nasi dimasak dengan air bersih bersuhu terkontrol untuk menghasilkan tekstur pulen dan aman dikonsumsi.',
    image: nasiPutihBowlImg
  },
  {
    id: 'protein_hewani',
    category: 'Protein Hewani',
    title: 'Ayam Bumbu Kuning',
    portion: 'Sesuai hasil penimbangan (± 70 gram)',
    origin: 'Peternak lokal Pakis & Tumpang, Kab. Malang',
    description: 'Daging ayam segar pilihan diolah dengan bumbu rempah alami kunyit, jahe, dan serai tanpa pengawet atau penyedap berlebih.',
    image: ayamBumbuKuningImg
  },
  {
    id: 'protein_nabati',
    category: 'Protein Nabati',
    title: 'Tempe',
    portion: 'Sesuai hasil penimbangan (± 45 gram)',
    origin: 'Pengrajin tempe lokal Desa Jeru, Tumpang',
    description: 'Fermentasi kedelai higienis kaya protein nabati, zat besi, serat pangan, dan kalsium alami yang mudah dicerna.',
    image: tempeBacemImg
  },
  {
    id: 'sayuran',
    category: 'Sayuran',
    title: 'Sayur Sop',
    portion: 'Sesuai hasil penimbangan (± 75 gram)',
    origin: 'Kelompok tani sayur lereng Bromo & Poncokusumo',
    description: 'Wortel, kubis, dan buncis dipanen segar harian, dimasak dengan kaldu bening gurih bernutrisi tinggi serat dan mikronutrien.',
    image: sayurSopImg
  },
  {
    id: 'buah',
    category: 'Buah',
    title: 'Pisang',
    portion: '1 buah utuh (± 80 gram)',
    origin: 'Petani hortikultura Malang',
    description: 'Buah segar matang pohon sumber kalium alami dan vitamin C untuk melengkapi kebutuhan gizi harian siswa.',
    image: buahPisangImg
  }
];

export const OPERATIONAL_STEPS = [
  {
    step: 1,
    title: 'Penerimaan Bahan Pangan',
    description: 'Bahan yang diterima diperiksa berdasarkan jenis, jumlah, dan kondisi fisiknya.',
    image: operasionalPenerimaanImg
  },
  {
    step: 2,
    title: 'Persiapan dan Pengolahan',
    description: 'Bahan pangan disiapkan dan diolah sesuai menu serta prosedur kerja yang berlaku.',
    image: operasionalPengolahanImg
  },
  {
    step: 3,
    title: 'Pemeriksaan dan Pengemasan',
    description: 'Makanan diperiksa dan dikemas sebelum disiapkan untuk pengiriman ke sekolah.',
    image: operasionalPengemasanImg
  },
  {
    step: 4,
    title: 'Distribusi ke Sekolah',
    description: 'Makanan dikirim ke sekolah penerima sesuai jadwal distribusi yang ditetapkan.',
    image: operasionalDistribusiImg
  }
];

export const ACTIVITY_DOCS = [
  {
    id: 'doc-1',
    title: 'Persiapan Bahan',
    description: 'Pencucian dan pemotongan bahan makanan di dapur.',
    image: operasionalPengolahanImg
  },
  {
    id: 'doc-2',
    title: 'Pengemasan Makanan',
    description: 'Proses menata makanan ke dalam wadah sebelum distribusi.',
    image: operasionalPengemasanImg
  },
  {
    id: 'doc-3',
    title: 'Pemeriksaan Menu',
    description: 'Pemeriksaan kualitas dan kebersihan sebelum pengiriman.',
    image: operasionalPenerimaanImg
  },
  {
    id: 'doc-4',
    title: 'Penyaluran ke Sekolah',
    description: 'Dokumentasi penerimaan menu MBG di sekolah.',
    image: penyaluranSiswaImg
  }
];

export const LOCAL_SUPPLIERS = [
  {
    name: 'Poktan Sri Rejeki',
    location: 'Desa Malangsuko, Kec. Tumpang',
    product: 'Beras',
    image: sawahPadiImg
  },
  {
    name: 'UD Sumber Tani',
    location: 'Kec. Tumpang, Kab. Malang',
    product: 'Daging ayam',
    image: peternakanAyamImg
  },
  {
    name: 'Kelompok Tani Jeru',
    location: 'Desa Jeru, Kec. Tumpang',
    product: 'Sayuran segar',
    image: kebunSayurImg
  },
  {
    name: 'Industri Rumahan',
    location: 'Kec. Tumpang, Kab. Malang',
    product: 'Tempe',
    image: tempeMentahImg
  }
];

export const BENEFICIARY_SCHOOLS = [
  { name: 'SDN 1 Jeru', location: 'Desa Jeru, Tumpang' },
  { name: 'SDN 2 Jeru', location: 'Desa Jeru, Tumpang' },
  { name: 'SDN 1 Malangsuko', location: 'Malangsuko, Tumpang' },
  { name: 'SDN 2 Malangsuko', location: 'Malangsuko, Tumpang' },
  { name: 'SDN 3 Tumpang', location: 'Krajan Tumpang' },
  { name: 'SDN 1 Tumpang', location: 'Pusat Tumpang' },
  { name: 'SMPN 1 Tumpang', location: 'Kauman, Tumpang' },
  { name: 'SMPN 2 Tumpang', location: 'Kebonsari, Tumpang' },
  { name: 'SDN 2 Tumpang', location: 'Raya Tumpang' },
  { name: 'MI Miftahul Huda', location: 'Dsn. Krajan, Jeru' },
  { name: 'MI Nurul Huda', location: 'Tumpang Barat' },
  { name: 'MTs Al-Ittihad', location: 'Kecamatan Tumpang' },
  { name: 'SDN 4 Tumpang', location: 'Tumpang' },
  { name: 'SMPN 3 Tumpang', location: 'Tumpang' }
];

export const LandingPage: React.FC<LandingPageProps> = ({
  isStaffLoggedIn = false,
  onReturnToDashboard,
  staffName
}) => {
  const [config, setConfig] = useState<WebsiteConfig>(getWebsiteConfig);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [isMenuAutoPlay, setIsMenuAutoPlay] = useState(true);
  const [selectedComponentId, setSelectedComponentId] = useState('karbohidrat');
  const [showAllSchools, setShowAllSchools] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Hero Photo Slides Carousel (Dokumentasi Lapangan Kotak Kanan)
  const heroPhotoSlides = (config.hero.photoSlides && config.hero.photoSlides.length > 0)
    ? config.hero.photoSlides
    : (DEFAULT_WEBSITE_CONFIG.hero.photoSlides || []);

  const [currentHeroPhotoIndex, setCurrentHeroPhotoIndex] = useState(0);
  const [isHeroPhotoPaused, setIsHeroPhotoPaused] = useState(false);
  const activeHeroPhotoIndex = heroPhotoSlides.length > 0
    ? (currentHeroPhotoIndex % heroPhotoSlides.length)
    : 0;
  const currentHeroPhoto = heroPhotoSlides[activeHeroPhotoIndex] || heroPhotoSlides[0];

  // Helper render headline wording persis sesuai spesifikasi editorial
  const renderHeroTitle = (title: string) => {
    if (title.includes('Menu MBG Disiapkan Setiap Hari')) {
      return (
        <>
          <span className="block text-white">Dari Dapur SPPG</span>
          <span className="block text-white">Tumpang Jeru,</span>
          <span className="text-[#86efac] block">Menu MBG Disiapkan</span>
          <span className="text-[#86efac] block">Setiap Hari</span>
        </>
      );
    }
    if (title.includes('Menu MBG Disiapkan')) {
      const parts = title.split('Menu MBG Disiapkan');
      return (
        <>
          <span className="text-white">{parts[0]}</span>
          <span className="text-[#86efac]">Menu MBG Disiapkan{parts[1] || ''}</span>
        </>
      );
    }
    return <span className="text-white">{title}</span>;
  };

  const getFormattedHeroDate = () => {
    try {
      const now = new Date();
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const dayName = days[now.getDay()];
      const dateNum = now.getDate();
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();
      return `${dayName}, ${dateNum} ${monthName} ${year}`;
    } catch {
      return 'Selasa, 14 Jan 2026';
    }
  };

  // Timer auto-slide foto hero kotak kanan
  useEffect(() => {
    const isAutoSlide = config.hero.autoSlidePhotos ?? true;
    if (!isAutoSlide || isHeroPhotoPaused || heroPhotoSlides.length <= 1) return;

    const intervalTime = Math.max(2, config.hero.photoSlideInterval || 4) * 1000;
    const timer = setInterval(() => {
      setCurrentHeroPhotoIndex(prev => (prev + 1) % heroPhotoSlides.length);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [config.hero.autoSlidePhotos, config.hero.photoSlideInterval, isHeroPhotoPaused, heroPhotoSlides.length]);

  // Multi-Video Playlist & Loop Management untuk Video Latar Belakang Hero
  const videoList = (config.hero.videos && config.hero.videos.length > 0)
    ? config.hero.videos
    : (config.hero.videoUrl ? [{ id: 'vid-1', title: 'Video Hero Utama', url: config.hero.videoUrl, poster: config.hero.videoPoster }] : []);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const activeVideoIndex = videoList.length > 0 ? (currentVideoIndex % videoList.length) : 0;
  const activeVideo = videoList[activeVideoIndex];

  // Handler loop otomatis saat video latar selesai diputar
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

  // Pastikan browser modern mengizinkan autoplay video latar belakang secara otomatis
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideo?.url) return;
    el.muted = true;
    el.defaultMuted = true;
    try {
      el.setAttribute('muted', '');
    } catch {
      // Abaikan jika tidak didukung
    }

    const playPromise = el.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        console.warn('Autoplay latar belakang ditunda oleh kebijakan browser:', err);
      });
    }
  }, [activeVideoIndex, activeVideo?.url]);

  // Listener untuk memulai autoplay jika browser menahan pemutaran
  useEffect(() => {
    const handleFirstUserInteraction = () => {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    };

    window.addEventListener('click', handleFirstUserInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstUserInteraction, { once: true });
    return () => {
      window.removeEventListener('click', handleFirstUserInteraction);
      window.removeEventListener('touchstart', handleFirstUserInteraction);
    };
  }, []);

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

  // Timer Auto-Slide untuk Seksi Foto Menu MBG Mingguan
  useEffect(() => {
    if (!isMenuAutoPlay) return;
    const intervalTime = Math.max(2, config.menuSlider.intervalSeconds || 5) * 1000;
    const timer = setInterval(() => {
      setSelectedDayIndex(prev => (prev + 1) % WEEKLY_MENUS.length);
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isMenuAutoPlay, config.menuSlider.intervalSeconds]);

  return (
    <div className="min-h-screen bg-[#faf8f4] text-[#1c2420] font-sans selection:bg-[#d8eedf] selection:text-[#0c3123] antialiased">
      {/* Header Navigasi Editorial */}
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
              Menu MBG
            </a>
            <a href="#alur-operasional" className="hover:text-[#0c3123] transition-colors">
              Alur Operasional
            </a>
            <a href="#pemasok-bahan" className="hover:text-[#0c3123] transition-colors">
              Pemasok
            </a>
            <a href="#sekolah-penerima" className="hover:text-[#0c3123] transition-colors">
              Sekolah Penerima
            </a>
            <a href="#dokumentasi-kegiatan" className="hover:text-[#0c3123] transition-colors">
              Dokumentasi
            </a>
            <a href="#kontak-sppg" className="hover:text-[#0c3123] transition-colors">
              Kontak
            </a>
          </nav>

          {/* Status Layanan Publik / Tombol Dashboard untuk Staf */}
          <div className="flex items-center gap-2.5">
            {onReturnToDashboard ? (
              <div className="relative group flex items-center">
                <button
                  type="button"
                  onClick={onReturnToDashboard}
                  className="w-10 h-10 rounded-xl bg-[#0c3123] hover:bg-[#134431] active:bg-[#071f16] text-white flex items-center justify-center transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c3123] border border-[#1e5842]/40"
                  aria-label="Kembali ke Dashboard WMS"
                  title="Kembali ke Dashboard WMS"
                >
                  <LayoutGrid className="w-5 h-5 text-[#86efac]" />
                </button>

                {/* Tooltip */}
                <div
                  role="tooltip"
                  className="absolute right-0 top-full mt-2 hidden group-hover:flex group-focus-within:flex flex-col items-end z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg shadow-xl text-xs font-medium whitespace-nowrap flex items-center gap-2 border border-slate-700/60">
                    <span className="font-semibold text-white">Kembali ke Dashboard WMS</span>
                    {staffName && (
                      <>
                        <span className="text-slate-500">•</span>
                        <span className="text-emerald-400 font-normal">{staffName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
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
              key={`bg-${activeVideo.url}`}
              src={activeVideo.url}
              autoPlay
              muted
              loop={videoList.length <= 1}
              playsInline
              preload="auto"
              onEnded={handleVideoEnded}
              onError={handleVideoError}
              poster={activeVideo.poster || config.hero.videoPoster || trayImg1}
              className="w-full h-full object-cover object-center filter brightness-[0.78] contrast-[1.05] transition-opacity duration-700"
            />
            {/* Lapisan Gradient Tint Berlapis untuk Keterbacaan Sempurna */}
            <div
              className="absolute inset-0 bg-gradient-to-r from-[#0c2217]/85 via-[#0d261a]/65 to-[#081710]/45"
              style={{ opacity: Math.max(0.25, Math.min(0.85, config.hero.videoOverlayOpacity)) }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#091811]/90 via-transparent to-[#0a1b13]/35" />
          </div>
        ) : (
          <div className="absolute inset-0 z-0 bg-[#faf8f4]" />
        )}

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
            {/* Narasi Utama */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl backdrop-blur-md text-xs font-medium border border-white/20 bg-black/35 text-white/95 shadow-xs">
                <Home className="w-3.5 h-3.5 text-emerald-400" />
                <span>{config.hero.heroBadge}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[50px] font-bold font-display leading-[1.14] tracking-tight text-white drop-shadow-sm">
                {renderHeroTitle(config.hero.heroTitle)}
              </h1>

              <p className="text-sm sm:text-base leading-relaxed max-w-xl text-slate-200 drop-shadow-2xs">
                {config.hero.heroSubtitle}
              </p>

              {/* Tombol Aksi Publik & Kontrol Media Hero */}
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <a
                  href={config.hero.primaryCtaLink || '#siklus-menu'}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 transition-all cursor-pointer shadow-lg border border-emerald-500/30"
                >
                  <Utensils className="w-4 h-4 text-emerald-200" />
                  <span>{config.hero.primaryCtaText || 'Lihat Menu MBG'}</span>
                  <ChevronRight className="w-4 h-4 text-emerald-200" />
                </a>

                <a
                  href={config.hero.secondaryCtaLink || '#alur-pagi'}
                  className="inline-flex items-center gap-2.5 px-5 py-3.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors border bg-white/10 hover:bg-white/20 text-white border-white/25 backdrop-blur-md"
                >
                  <Clock className="w-4 h-4 text-white/90" />
                  <span>{config.hero.secondaryCtaText || 'Jadwal Operasional'}</span>
                  <ChevronRight className="w-4 h-4 text-white/90" />
                </a>
              </div>
            </div>

            {/* Visual Dokumentasi Operasional: Dokumentasi Slide Foto (Auto Slide & Kustomisasi) */}
            <div className="lg:col-span-5">
              <div
                className={`rounded-2xl p-3 border shadow-2xl backdrop-blur-md transition-all ${
                  config.hero.backgroundType === 'video'
                    ? 'bg-slate-900/90 border-slate-700/80 shadow-black/40'
                    : 'bg-white border-[#ded7c8]'
                }`}
                onMouseEnter={() => setIsHeroPhotoPaused(true)}
                onMouseLeave={() => setIsHeroPhotoPaused(false)}
              >
                {/* Frame Foto Utama dengan Auto-Slide & Navigasi */}
                <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-4/3 border border-slate-700/60 shadow-inner group">
                  {currentHeroPhoto ? (
                    <img
                      key={currentHeroPhoto.id || activeHeroPhotoIndex}
                      src={currentHeroPhoto.imageUrl}
                      alt={currentHeroPhoto.title}
                      className="w-full h-full object-cover object-center transition-all duration-700 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <img
                      src={trayImg1}
                      alt="Standar sajian nampan makan bergizi gratis SPPG Jeru"
                      className="w-full h-full object-cover object-center"
                    />
                  )}

                  {/* Gradient Overlay untuk Kontras Tag & Teks */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/35 pointer-events-none" />

                  {/* Badge Kategori & Status di Pojok Kiri Atas */}
                  <div className="absolute top-3 left-3 bg-black/80 text-white text-xs px-2.5 py-1.5 rounded-lg border border-white/10 shadow-sm pointer-events-none backdrop-blur-xs flex flex-col items-start gap-0.5">
                    <div className="flex items-center gap-1.5 font-semibold text-white">
                      <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                      <span>{currentHeroPhoto?.badge || 'Menu Hari Ini'}</span>
                    </div>
                    <span className="text-[10px] text-slate-300 pl-3.5 font-normal">
                      {getFormattedHeroDate()}
                    </span>
                  </div>

                  {/* Counter Slide di Pojok Kanan Atas */}
                  {heroPhotoSlides.length > 1 && (
                    <div className="absolute top-3 right-3 bg-black/75 text-white/90 text-[11px] font-mono font-medium px-2 py-0.5 rounded-md border border-white/20 backdrop-blur-xs shadow-xs pointer-events-none">
                      {activeHeroPhotoIndex + 1} / {heroPhotoSlides.length}
                    </div>
                  )}

                  {/* Tombol Navigasi Geser (Chevron Kiri & Kanan) */}
                  {heroPhotoSlides.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentHeroPhotoIndex(prev => (prev - 1 + heroPhotoSlides.length) % heroPhotoSlides.length);
                        }}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 active:bg-black text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-0 focus:opacity-100 cursor-pointer border border-white/20 shadow-md backdrop-blur-xs"
                        aria-label="Foto Sebelumnya"
                        title="Foto Sebelumnya"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentHeroPhotoIndex(prev => (prev + 1) % heroPhotoSlides.length);
                        }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 active:bg-black text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-0 focus:opacity-100 cursor-pointer border border-white/20 shadow-md backdrop-blur-xs"
                        aria-label="Foto Berikutnya"
                        title="Foto Berikutnya"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* Pagination Indicator Dots di Bawah Foto */}
                      <div className="absolute bottom-2.5 left-0 right-0 flex items-center justify-center gap-1.5 z-10 pointer-events-auto">
                        {heroPhotoSlides.map((slide, idx) => (
                          <button
                            key={slide.id || idx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentHeroPhotoIndex(idx);
                            }}
                            className={`h-1.5 rounded-full transition-all cursor-pointer ${
                              idx === activeHeroPhotoIndex
                                ? 'w-6 bg-emerald-400'
                                : 'w-1.5 bg-white/50 hover:bg-white/80'
                            }`}
                            aria-label={`Lihat slide ${idx + 1}`}
                            title={`Slide ${idx + 1}: ${slide.title}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Deskripsi & Keterangan Slide Foto */}
                <div className={`mt-3 p-3.5 rounded-xl border space-y-1 transition-all shadow-lg ${
                  config.hero.backgroundType === 'video'
                    ? 'bg-[#091523]/95 border-slate-800/80 text-slate-200'
                    : 'bg-[#f7f4ec] border-[#e8e2d4]'
                }`}>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className={`font-bold truncate pr-2 ${config.hero.backgroundType === 'video' ? 'text-white' : 'text-[#141d18]'}`}>
                      {currentHeroPhoto?.title || 'Nasi, Ayam Kecap, Tempe, Sayur, dan Buah'}
                    </span>
                    {currentHeroPhoto?.targetGrams && (
                      <span className="font-mono text-xs text-emerald-400 font-semibold shrink-0">
                        {currentHeroPhoto.targetGrams}
                      </span>
                    )}
                  </div>
                  <p className={`text-[11px] leading-relaxed ${
                    config.hero.backgroundType === 'video' ? 'text-slate-300' : 'text-[#55645c]'
                  }`}>
                    {currentHeroPhoto?.description || 'Menu ini disajikan sesuai standar gizi dengan porsi yang sesuai untuk anak sekolah.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Pilar Nilai Operasional Hero */}
          <div className="pt-10 lg:pt-14 mt-8 border-t border-white/15">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 md:divide-x md:divide-white/15">
              {/* Pilar 1: Penimbangan Bahan */}
              <div className="flex items-center gap-3.5 md:pr-6">
                <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Penimbangan Bahan</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Sesuai kebutuhan menu</p>
                </div>
              </div>

              {/* Pilar 2: Wadah Makanan */}
              <div className="flex items-center gap-3.5 md:px-8">
                <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Wadah Makanan</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Stainless steel food-grade</p>
                </div>
              </div>

              {/* Pilar 3: Pengelolaan Sisa Makanan */}
              <div className="flex items-center gap-3.5 md:pl-8">
                <div className="w-11 h-11 rounded-xl bg-emerald-950/80 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 shadow-inner">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Pengelolaan Sisa Makanan</h4>
                  <p className="text-xs text-slate-300 mt-0.5">Lebih ramah lingkungan</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SEKSI 2: MENU MBG MINGGU INI (#siklus-menu)
          ======================================================== */}
      <section id="siklus-menu" className="py-14 sm:py-20 bg-[#faf8f4] border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Seksi */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133d2c] text-white text-xs font-semibold mb-3 shadow-2xs">
                <span>Menu MBG</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
                Menu MBG Minggu Ini
              </h2>
              <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-2xl leading-relaxed">
                Variasi menu yang disiapkan untuk sekolah penerima manfaat setiap hari.
              </p>
            </div>

            {/* Kontrol Putar Otomatis & Panah Indikator */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsMenuAutoPlay(!isMenuAutoPlay)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-[#ded7c8] text-xs font-semibold text-[#141d18] hover:bg-[#f6f2e8] transition-colors shadow-2xs cursor-pointer"
                title={isMenuAutoPlay ? 'Jeda putar otomatis' : 'Mulai putar otomatis'}
              >
                {isMenuAutoPlay ? (
                  <Pause className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <Play className="w-3.5 h-3.5 text-emerald-700" />
                )}
                <span>Putar Otomatis</span>
              </button>

              <div className="flex items-center gap-1 bg-white p-1 rounded-full border border-[#ded7c8] shadow-2xs">
                <button
                  type="button"
                  onClick={() => setSelectedDayIndex(prev => (prev - 1 + WEEKLY_MENUS.length) % WEEKLY_MENUS.length)}
                  className="w-7 h-7 rounded-full hover:bg-[#f2ece1] flex items-center justify-center text-[#141d18] transition-colors cursor-pointer"
                  aria-label="Hari sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-2 text-[#2d3b32]">
                  {selectedDayIndex + 1} / {WEEKLY_MENUS.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDayIndex(prev => (prev + 1) % WEEKLY_MENUS.length)}
                  className="w-7 h-7 rounded-full hover:bg-[#f2ece1] flex items-center justify-center text-[#141d18] transition-colors cursor-pointer"
                  aria-label="Hari berikutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Baris Tab 5 Hari (Senin - Jumat) */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 mb-8">
            {WEEKLY_MENUS.map((item, idx) => {
              const isActive = selectedDayIndex === idx;
              return (
                <button
                  key={item.day}
                  type="button"
                  onClick={() => setSelectedDayIndex(idx)}
                  className={`p-3 rounded-2xl text-left transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-[#133d2c] text-white border-[#133d2c] shadow-xs'
                      : 'bg-white text-[#2a3830] border-[#ded7c8] hover:bg-[#f7f4ec]'
                  }`}
                >
                  <div className="text-sm font-bold">{item.day}</div>
                  <div className={`text-[11px] mt-0.5 ${isActive ? 'text-emerald-200 font-medium' : 'text-[#707e76]'}`}>
                    {item.date}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Kartu Utama Menu Terpilih */}
          {(() => {
            const currentMenu = WEEKLY_MENUS[selectedDayIndex] || WEEKLY_MENUS[0];
            return (
              <div className="bg-white rounded-3xl border border-[#ded7c8] p-5 sm:p-7 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                {/* Kolom Kiri: Foto Nampan Makanan Resolusi Tinggi dengan Panah Melayang */}
                <div className="lg:col-span-7 relative aspect-4/3 sm:aspect-16/10 rounded-2xl overflow-hidden bg-slate-900 border border-[#ded7c8] group">
                  <img
                    key={currentMenu.day}
                    src={currentMenu.image}
                    alt={currentMenu.title}
                    className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-102"
                  />
                  {/* Panah Navigasi Melayang Kiri */}
                  <button
                    type="button"
                    onClick={() => setSelectedDayIndex(prev => (prev - 1 + WEEKLY_MENUS.length) % WEEKLY_MENUS.length)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 hover:bg-white text-[#141d18] shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer z-10"
                    aria-label="Menu Sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {/* Panah Navigasi Melayang Kanan */}
                  <button
                    type="button"
                    onClick={() => setSelectedDayIndex(prev => (prev + 1) % WEEKLY_MENUS.length)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/95 hover:bg-white text-[#141d18] shadow-md flex items-center justify-center transition-transform hover:scale-105 cursor-pointer z-10"
                    aria-label="Menu Berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Kolom Kanan: Judul, Deskripsi & Komponen Menu Bulat */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
                  <div>
                    <div className="text-xs font-semibold text-[#6a7c73]">
                      {currentMenu.day}, {currentMenu.date}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold font-serif-display text-[#141d18] mt-1.5 leading-snug">
                      {currentMenu.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#55645c] mt-2.5 leading-relaxed">
                      {currentMenu.description}
                    </p>

                    {/* Box Komponen Menu */}
                    <div className="mt-6 p-4 sm:p-5 rounded-2xl bg-[#faf8f4] border border-[#ede7db]">
                      <div className="text-xs font-bold text-[#141d18] mb-3">
                        Komponen Menu
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {currentMenu.components.map((comp) => (
                          <div key={comp.name} className="flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full overflow-hidden border border-[#ded7c8] shadow-2xs bg-white">
                              <img
                                src={comp.image}
                                alt={comp.name}
                                className="w-full h-full object-cover object-center"
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-[#25322a] mt-1.5 leading-tight line-clamp-2">
                              {comp.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ========================================================
          SEKSI 3: KOMPONEN MENU (BAHAN & PORSI) (#komponen-menu)
          ======================================================== */}
      <section id="komponen-menu" className="py-14 sm:py-20 bg-white border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133d2c] text-white text-xs font-semibold mb-3 shadow-2xs">
              <span>Komponen Menu</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
              Bahan dan Porsi Makanan
            </h2>
            <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-2xl leading-relaxed">
              Informasi bahan makanan dan perkiraan porsi dari menu yang disajikan.
            </p>
          </div>

          {/* Kontainer Interaktif 3 Kolom */}
          <div className="bg-[#faf8f4] rounded-3xl border border-[#ded7c8] p-5 sm:p-8 shadow-xs">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
              {/* Kolom 1: Daftar Tab Komponen */}
              <div className="lg:col-span-4 space-y-2.5">
                {FOOD_COMPONENTS.map((item) => {
                  const isSelected = selectedComponentId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedComponentId(item.id)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white border-l-4 border-l-[#133d2c] border-[#ded7c8] shadow-xs'
                          : 'bg-white/60 border-[#e8e2d4] hover:bg-white text-[#4d5c53]'
                      }`}
                    >
                      <div className={`text-[11px] font-semibold ${isSelected ? 'text-[#133d2c]' : 'text-[#707e76]'}`}>
                        {item.category}
                      </div>
                      <div className="text-sm font-bold text-[#141d18] mt-0.5">
                        {item.title}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Kolom 2 & 3: Tampilan Foto Resolusi Tinggi & Detail Spesifikasi */}
              {(() => {
                const currentComp = FOOD_COMPONENTS.find(c => c.id === selectedComponentId) || FOOD_COMPONENTS[0];
                return (
                  <>
                    {/* Kolom 2: Foto Sajian dalam Mangkuk / Piring */}
                    <div className="lg:col-span-4 aspect-4/3 rounded-2xl overflow-hidden bg-stone-100 border border-[#ded7c8] shadow-xs">
                      <img
                        key={currentComp.id}
                        src={currentComp.image}
                        alt={currentComp.title}
                        className="w-full h-full object-cover object-center"
                      />
                    </div>

                    {/* Kolom 3: Rincian Spesifikasi Porsi, Asal Bahan, Keterangan */}
                    <div className="lg:col-span-4 space-y-4">
                      <div>
                        <span className="inline-block text-[11px] font-semibold text-[#133d2c] bg-[#ecf7f0] border border-[#c4e5ce] px-2.5 py-0.5 rounded-full mb-1.5">
                          {currentComp.category}
                        </span>
                        <h3 className="text-2xl font-bold font-serif-display text-[#141d18]">
                          {currentComp.title}
                        </h3>
                      </div>

                      <div className="space-y-3 pt-2 text-xs border-t border-[#e8e2d4]">
                        <div className="grid grid-cols-3 gap-2 py-1">
                          <span className="font-bold text-[#141d18]">Porsi</span>
                          <span className="col-span-2 text-[#4d5c53]">{currentComp.portion}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 py-1 border-t border-[#f0ece1]">
                          <span className="font-bold text-[#141d18]">Asal Bahan</span>
                          <span className="col-span-2 text-[#4d5c53]">{currentComp.origin}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 py-1 border-t border-[#f0ece1]">
                          <span className="font-bold text-[#141d18]">Keterangan</span>
                          <span className="col-span-2 text-[#4d5c53] leading-relaxed">
                            {currentComp.description}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================
          SEKSI 4: ALUR OPERASIONAL (#alur-operasional)
          ======================================================== */}
      <section id="alur-operasional" className="py-14 sm:py-20 bg-[#faf8f4] border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133d2c] text-white text-xs font-semibold mb-3 shadow-2xs">
              <span>Alur Operasional</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
              Tahapan Persiapan dan Penyaluran MBG
            </h2>
            <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-2xl leading-relaxed">
              Proses pelaksanaan MBG dari penerimaan bahan pangan hingga penyaluran ke sekolah.
            </p>
          </div>

          {/* 4 Kartu Berurutan dengan Panah Pemisah */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
            {OPERATIONAL_STEPS.map((step, idx) => (
              <div
                key={step.step}
                className="bg-white rounded-3xl p-4 sm:p-5 border border-[#ded7c8] shadow-xs flex flex-col justify-between relative group hover:border-[#133d2c] transition-all"
              >
                <div>
                  {/* Lingkaran Angka Tahapan Hijau Gelap */}
                  <div className="w-8 h-8 rounded-full bg-[#133d2c] text-white text-xs font-bold flex items-center justify-center mb-3.5 shadow-2xs">
                    {step.step}
                  </div>

                  {/* Foto Tahapan */}
                  <div className="aspect-4/3 rounded-2xl overflow-hidden bg-slate-900 border border-[#ded7c8] mb-4">
                    <img
                      src={step.image}
                      alt={step.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                  </div>

                  <h3 className="text-sm font-bold text-[#141d18] leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-xs text-[#55645c] mt-1.5 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Panah Pemisah Antar Kartu pada Desktop */}
                {idx < OPERATIONAL_STEPS.length - 1 && (
                  <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white border border-[#ded7c8] items-center justify-center text-[#707e76] shadow-2xs">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          SEKSI 5: DOKUMENTASI KEGIATAN (#dokumentasi-kegiatan)
          ======================================================== */}
      <section id="dokumentasi-kegiatan" className="py-14 sm:py-20 bg-white border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133d2c] text-white text-xs font-semibold mb-3 shadow-2xs">
                <span>Dokumentasi Kegiatan</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
                Dokumentasi Persiapan Menu MBG
              </h2>
              <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-2xl leading-relaxed">
                Foto kegiatan dari dapur hingga penyaluran makanan ke sekolah.
              </p>
            </div>

            {/* Tombol Panah Navigasi */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-[#faf8f4] border border-[#ded7c8] flex items-center justify-center text-[#141d18] hover:bg-[#f0ece1] transition-colors cursor-pointer"
                aria-label="Dokumentasi Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="w-8 h-8 rounded-full bg-[#faf8f4] border border-[#ded7c8] flex items-center justify-center text-[#141d18] hover:bg-[#f0ece1] transition-colors cursor-pointer"
                aria-label="Dokumentasi Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 4 Kartu Foto Dokumentasi Kegiatan */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {ACTIVITY_DOCS.map((doc) => (
              <div
                key={doc.id}
                className="bg-[#faf8f4] rounded-3xl p-4 border border-[#ded7c8] shadow-xs flex flex-col justify-between hover:border-[#133d2c] transition-all group"
              >
                <div>
                  <div className="aspect-4/3 rounded-2xl overflow-hidden bg-slate-900 border border-[#ded7c8] mb-3.5">
                    <img
                      src={doc.image}
                      alt={doc.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                  </div>
                  <h3 className="text-sm font-bold text-[#141d18]">
                    {doc.title}
                  </h3>
                  <p className="text-xs text-[#55645c] mt-1 leading-relaxed">
                    {doc.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          SEKSI 6: PEMASOK BAHAN PANGAN (#pemasok-bahan)
          ======================================================== */}
      <section id="pemasok-bahan" className="py-14 sm:py-20 bg-[#faf8f4] border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133d2c] text-white text-xs font-semibold mb-3 shadow-2xs">
                <span>Pemasok Bahan Pangan</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
                Pemasok Bahan Pangan
              </h2>
              <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-2xl leading-relaxed">
                Bahan makanan untuk menu MBG diperoleh dari pemasok lokal yang bekerja sama dengan SPPG Tumpang Jeru.
              </p>
            </div>

            {/* Tombol Daftar Pemasok */}
            <div className="shrink-0">
              <button
                type="button"
                onClick={() => setShowSupplierModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#ded7c8] text-xs font-bold text-[#141d18] hover:bg-[#f6f2e8] transition-colors shadow-2xs cursor-pointer"
              >
                <span>Daftar Pemasok</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#133d2c]" />
              </button>
            </div>
          </div>

          {/* 4 Kartu Pemasok Lokal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {LOCAL_SUPPLIERS.map((sup) => (
              <div
                key={sup.name}
                className="bg-white rounded-3xl p-4 border border-[#ded7c8] shadow-xs flex flex-col justify-between hover:border-[#133d2c] transition-all group"
              >
                <div>
                  <div className="aspect-16/10 rounded-2xl overflow-hidden bg-slate-900 border border-[#ded7c8] mb-3.5">
                    <img
                      src={sup.image}
                      alt={sup.name}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                  </div>
                  <h3 className="text-sm font-bold text-[#141d18]">
                    {sup.name}
                  </h3>
                  <div className="text-[11px] text-[#707e76] mt-0.5">
                    {sup.location}
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-[#f0ece1] text-xs">
                    <span className="text-[#707e76]">Bahan yang dipasok: </span>
                    <span className="font-bold text-[#133d2c]">{sup.product}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================
          SEKSI 7: SEKOLAH PENERIMA (#sekolah-penerima)
          ======================================================== */}
      <section id="sekolah-penerima" className="py-14 sm:py-20 bg-white border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#133d2c] text-white text-xs font-semibold mb-3 shadow-2xs">
                <span>Sekolah Penerima</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-[#141d18] tracking-tight">
                Daftar Sekolah Penerima MBG
              </h2>
              <p className="text-xs sm:text-sm text-[#55645c] mt-2 max-w-2xl leading-relaxed">
                Sekolah yang menerima layanan MBG dari SPPG MLG Tumpang Jeru.
              </p>
            </div>

            {/* Badge Total 14 Sekolah */}
            <div className="shrink-0">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#f6f2e8] border border-[#ded7c8] text-xs font-semibold text-[#141d18]">
                <span>Total 14 Sekolah</span>
              </span>
            </div>
          </div>

          {/* Grid Kartu Sekolah */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(showAllSchools ? BENEFICIARY_SCHOOLS : BENEFICIARY_SCHOOLS.slice(0, 8)).map((sch) => (
              <div
                key={sch.name}
                className="p-4 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] flex items-center gap-3.5 hover:border-[#133d2c] transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-[#ded7c8] flex items-center justify-center shrink-0 text-[#133d2c] shadow-2xs">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#141d18] truncate">
                    {sch.name}
                  </div>
                  <div className="text-[11px] text-[#707e76] truncate mt-0.5">
                    {sch.location}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Tombol Lihat Seluruh Sekolah */}
          {BENEFICIARY_SCHOOLS.length > 8 && (
            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setShowAllSchools(!showAllSchools)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#faf8f4] border border-[#ded7c8] text-xs font-bold text-[#133d2c] hover:bg-[#f0ece1] transition-colors cursor-pointer"
              >
                <span>{showAllSchools ? 'Tampilkan Lebih Sedikit' : 'Lihat Seluruh 14 Sekolah Penerima'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAllSchools ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ========================================================
          SEKSI 8: INFORMASI DAN KONTAK SPPG (#kontak-sppg)
          ======================================================== */}
      <section id="kontak-sppg" className="py-14 sm:py-20 bg-[#faf8f4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#0c2419] rounded-3xl p-6 sm:p-10 lg:p-12 text-white border border-[#1b4331] shadow-lg">
            {/* Bagian Atas: Kiri Teks + CTA, Kanan Foto Bangunan SPPG */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              <div className="lg:col-span-7 space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#153e2c] text-emerald-200 border border-emerald-700/50 text-xs font-semibold">
                  <span>Informasi dan Kontak</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold font-serif-display text-white tracking-tight">
                  Informasi dan Kontak SPPG
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-xl">
                  Untuk informasi menu, kegiatan operasional, atau penyaluran ke sekolah, silakan hubungi SPPG MLG Tumpang Jeru melalui kontak resmi yang tersedia.
                </p>

                <div className="pt-2">
                  <a
                    href="mailto:sppg.tumpangjeru@bgn.go.id"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#0c2419] font-bold text-xs sm:text-sm hover:bg-[#f0ece1] transition-all shadow-md cursor-pointer"
                  >
                    <span>Hubungi SPPG</span>
                    <ArrowRight className="w-4 h-4 text-[#0c2419]" />
                  </a>
                </div>
              </div>

              {/* Foto Nyata Bangunan SPPG Tumpang Jeru */}
              <div className="lg:col-span-5">
                <div className="aspect-16/10 rounded-2xl overflow-hidden border border-white/20 shadow-md">
                  <img
                    src={sppgBuildingImg}
                    alt="Gedung SPPG Tumpang Jeru"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              </div>
            </div>

            {/* Strip Informasi Bawah: Identitas, Alamat, Jam Operasional, Kontak */}
            <div className="mt-10 pt-8 border-t border-white/15 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-xs text-slate-300">
              {/* Kolom 1: Logo & Nama SPPG */}
              <div className="flex items-start gap-3">
                <img
                  src={logoSppgImg}
                  alt="Logo SPPG"
                  className="w-10 h-10 object-contain rounded-lg p-1 bg-white/10 border border-white/20 shrink-0"
                />
                <div>
                  <div className="font-bold text-white text-sm">SPPG MLG TUMPANG JERU</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Desa Jeru, Kec. Tumpang, Kab. Malang</div>
                </div>
              </div>

              {/* Kolom 2: Alamat */}
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Alamat</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">
                    Desa Jeru, Kec. Tumpang, Kab. Malang
                  </div>
                </div>
              </div>

              {/* Kolom 3: Jam Operasional */}
              <div className="flex items-start gap-3">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Jam Operasional</div>
                  <div className="text-[11px] text-slate-300 mt-0.5">Senin – Sabtu</div>
                  <div className="text-[11px] text-emerald-300 font-mono">04.00 – 14.00 WIB</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">(Penyaluran pagi)</div>
                </div>
              </div>

              {/* Kolom 4: Kontak */}
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-white">Kontak</div>
                  <div className="text-[11px] text-slate-300 mt-0.5 font-mono">0812-3456-7890</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">sppg.tumpangjeru@bgn.go.id</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modal Daftar Pemasok Lengkap */}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-[#ded7c8] shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-[#eee8dc]">
              <div>
                <h3 className="text-xl font-bold font-serif-display text-[#141d18]">
                  Daftar Pemasok Bahan Pangan Lokal
                </h3>
                <p className="text-xs text-[#55645c] mt-1">
                  Kemitraan strategis SPPG Tumpang Jeru bersama petani dan pengrajin pangan Malang.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="w-8 h-8 rounded-full bg-[#faf8f4] hover:bg-[#f0ece1] flex items-center justify-center text-slate-600 transition-colors cursor-pointer text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {LOCAL_SUPPLIERS.map((sup) => (
                <div key={sup.name} className="p-4 rounded-2xl bg-[#faf8f4] border border-[#ded7c8] flex items-center gap-4">
                  <img
                    src={sup.image}
                    alt={sup.name}
                    className="w-16 h-16 rounded-xl object-cover shrink-0 border border-[#ded7c8]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#141d18]">{sup.name}</div>
                    <div className="text-xs text-[#707e76]">{sup.location}</div>
                    <div className="text-xs font-semibold text-[#133d2c] mt-1">
                      Komoditas Pasokan: {sup.product}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="px-5 py-2.5 rounded-full bg-[#133d2c] text-white text-xs font-bold hover:bg-[#1c553d] transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Minimalis */}
      <footer className="bg-[#081710] text-[#708076] text-xs py-8 border-t border-[#12281d]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">SPPG MLG TUMPANG JERU</span>
            <span>•</span>
            <span>Badan Gizi Nasional RI</span>
          </div>
          <div>
            © 2026 Seluruh hak cipta dilindungi undang-undang.
          </div>
        </div>
      </footer>
    </div>
  );
};
